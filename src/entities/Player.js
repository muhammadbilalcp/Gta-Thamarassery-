// Third-person character controller: walk, run, jump, gravity, collision with the world,
// and getting in and out of vehicles.

import * as THREE from 'three';
import { Character } from './Character.js';
import { angleDiff, clamp, damp, dampAngle } from '../utils/math.js';

const WALK = 1.85;
const RUN = 6.1;
const JUMP = 5.6;
const GRAVITY = 17;
const RADIUS = 0.34;
const _hit = { nx: 0, nz: 0, depth: 0 };
const _door = new THREE.Vector3();

export class Player {
  constructor(game, x, z, heading) {
    this.game = game;
    this.character = new Character(game.assets, 'avatar');
    this.object = this.character.root;
    game.scene.add(this.object);
    this.pos = new THREE.Vector3(x, game.world.ground.height(x, z, 1), z);
    this.vel = new THREE.Vector3();
    this.heading = heading;
    this.grounded = true;
    this.vehicle = null;
    this.speed = 0;
    this.coyote = 0;
    this.inWater = false;
    this.object.position.copy(this.pos);
    this.object.rotation.y = heading;
  }

  get driving() {
    return !!this.vehicle;
  }

  update(dt, input, cameraYaw) {
    if (this.vehicle) {
      this._ride();
      return;
    }
    const world = this.game.world;
    // Camera-relative movement. Camera forward on the ground plane is (-sin yaw, -cos yaw).
    const mx = input.moveX;
    const my = input.moveY;
    const fx = -Math.sin(cameraYaw);
    const fz = -Math.cos(cameraYaw);
    const rx = -fz;
    const rz = fx;
    let dx = fx * my + rx * mx;
    let dz = fz * my + rz * mx;
    const len = Math.hypot(dx, dz);
    const moving = len > 0.01;
    if (moving) {
      dx /= len;
      dz /= len;
    }
    const wade = this.inWater ? 0.45 : 1;
    const target = moving ? (input.sprint ? RUN : WALK) * wade : 0;
    const rate = this.grounded ? (moving ? 11 : 14) : 2.2;
    this.vel.x = damp(this.vel.x, dx * target, rate, dt);
    this.vel.z = damp(this.vel.z, dz * target, rate, dt);
    this.speed = Math.hypot(this.vel.x, this.vel.z);

    if (moving) {
      const want = Math.atan2(dx, dz);
      const turn = Math.abs(angleDiff(this.heading, want));
      this.heading = dampAngle(this.heading, want, turn > 2 ? 18 : 12, dt);
    }

    // Jump (a little coyote time makes kerb edges forgiving).
    this.coyote = this.grounded ? 0.12 : Math.max(0, this.coyote - dt);
    if (input.hit('Space') && this.coyote > 0 && !this.inWater) {
      this.vel.y = JUMP;
      this.grounded = false;
      this.coyote = 0;
      this.game.audio?.step(1.2);
    }

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;

    // Walls, poles, vehicles.
    const hits = world.colliders.resolveCircle(this.pos, RADIUS, this.pos.y + 0.45, this.pos.y + 1.7, _hit);
    if (hits) {
      const vn = this.vel.x * _hit.nx + this.vel.z * _hit.nz;
      if (vn < 0) {
        this.vel.x -= _hit.nx * vn;
        this.vel.z -= _hit.nz * vn;
      }
    }
    for (const ob of this.game.obstaclesNear(this.pos.x, this.pos.z, 6, this)) {
      if (Math.abs(ob.y - this.pos.y) > 2) continue;
      const ox = this.pos.x - ob.x;
      const oz = this.pos.z - ob.z;
      const d = Math.hypot(ox, oz);
      const min = RADIUS + ob.r;
      if (d < min && d > 1e-4) {
        this.pos.x += (ox / d) * (min - d);
        this.pos.z += (oz / d) * (min - d);
      }
    }
    this.game.clampToWorld(this.pos);

    // Vertical.
    let ground = world.ground.height(this.pos.x, this.pos.z, this.pos.y, 0.55);
    const waterFloor = world.terrain.waterLevel - 1.15;
    this.inWater = ground < world.terrain.waterLevel - 0.5;
    if (ground < waterFloor) ground = waterFloor;
    if (this.grounded) {
      if (ground < this.pos.y - 0.6) {
        this.grounded = false; // walked off a ledge
      } else {
        this.pos.y = damp(this.pos.y, ground, 24, dt);
        this.vel.y = 0;
      }
    }
    if (!this.grounded) {
      this.vel.y -= GRAVITY * dt;
      this.pos.y += this.vel.y * dt;
      if (this.pos.y <= ground && this.vel.y <= 0) {
        this.pos.y = ground;
        this.vel.y = 0;
        this.grounded = true;
        this.game.audio?.step(1.4);
      }
    }

    this.object.position.copy(this.pos);
    this.object.rotation.y = this.heading;
    this.character.locomotion(this.speed, dt, !this.grounded);
    this.character.update(dt);

    // Footsteps.
    if (this.grounded && this.speed > 0.5) {
      this._stride = (this._stride || 0) + this.speed * dt;
      const stride = this.speed > 3.2 ? 1.25 : 0.72;
      if (this._stride > stride) {
        this._stride = 0;
        this.game.audio?.step(this.speed > 3.2 ? 1 : 0.6);
      }
    }
  }

  _ride() {
    const v = this.vehicle;
    const m = v.model;
    this.pos.copy(v.pos);
    this.heading = v.heading;
    if (v.twoWheeler) {
      // Sit on the saddle and inherit the bike's lean and pitch.
      const s = m.seat;
      this.object.position.set(0, s.y - 0.93, s.z + 0.04).applyMatrix4(v.visual.matrix);
      this.object.quaternion.setFromRotationMatrix(v.visual.matrix);
    } else {
      this.object.position.copy(v.pos);
    }
  }

  /** Try to enter the nearest free vehicle. Returns true on success. */
  enter(vehicle) {
    this.vehicle = vehicle;
    vehicle.occupied = true;
    vehicle.sleeping = false;
    this.vel.set(0, 0, 0);
    this.speed = 0;
    if (vehicle.twoWheeler) {
      this.character.setVisible(true);
      this.character.setPose('ride');
    } else {
      this.character.setVisible(false);
    }
    this.game.audio?.door();
  }

  /** Step out on the driver's side, falling back to the other side or behind if blocked. */
  exit() {
    const v = this.vehicle;
    if (!v) return false;
    const col = this.game.world.colliders;
    const tries = [v.doorPoint(-1, new THREE.Vector3()), v.doorPoint(1, new THREE.Vector3())];
    const back = new THREE.Vector3(v.pos.x - Math.sin(v.heading) * (v.halfLength + 0.9), v.pos.y, v.pos.z - Math.cos(v.heading) * (v.halfLength + 0.9));
    tries.push(back);
    let spot = null;
    for (const t of tries) {
      const p = { x: t.x, z: t.z };
      const hits = col.resolveCircle(p, RADIUS, v.pos.y + 0.45, v.pos.y + 1.7, null);
      if (hits === 0 || Math.hypot(p.x - t.x, p.z - t.z) < 0.25) {
        spot = _door.set(p.x, v.pos.y, p.z);
        break;
      }
    }
    if (!spot) spot = _door.copy(tries[0]);
    v.occupied = false;
    this.vehicle = null;
    this.pos.copy(spot);
    this.pos.y = this.game.world.ground.height(spot.x, spot.z, v.pos.y + 0.5, 0.8);
    this.vel.set(0, 0, 0);
    this.grounded = true;
    this.heading = v.heading;
    this.character.setPose(null);
    this.character.setVisible(true);
    this.object.rotation.set(0, this.heading, 0);
    this.object.position.copy(this.pos);
    this.game.audio?.door();
    return true;
  }

  teleport(x, z, heading = this.heading) {
    if (this.vehicle) this.exit();
    this.pos.set(x, this.game.world.ground.height(x, z, 50, 100), z);
    this.vel.set(0, 0, 0);
    this.heading = heading;
    this.grounded = true;
    this.object.position.copy(this.pos);
    this.object.rotation.y = heading;
  }
}

export { clamp };
