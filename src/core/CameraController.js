// Third-person camera. On foot it orbits the character under mouse control; in a vehicle it
// becomes a chase camera that trails the car, widens with speed and drifts back behind the
// vehicle when the mouse is left alone. Both modes pull in when something blocks the view.

import * as THREE from 'three';
import { clamp, damp, dampAngle, lerp, saturate } from '../utils/math.js';

const _target = new THREE.Vector3();
const _dir = new THREE.Vector3();

export class CameraController {
  constructor(camera, game) {
    this.camera = camera;
    this.game = game;
    this.yaw = Math.PI; // orbit angle: camera sits at target + (sin yaw, ., cos yaw) * dist
    this.pitch = 0.22;
    this.dist = 4.0;
    this.zoom = 1;
    this.target = new THREE.Vector3();
    this.smoothDist = 4;
    this.lookYaw = 0;
    this.shake = 0;
    this.baseFov = 58;
    this.mode = 'foot';
    this.initialised = false;
  }

  snapBehind(heading) {
    this.yaw = heading + Math.PI;
    this.lookYaw = 0;
    this.initialised = false;
  }

  addShake(amount) {
    this.shake = Math.min(1, this.shake + amount);
  }

  update(dt, input) {
    const player = this.game.player;
    const vehicle = player.vehicle;
    const mode = vehicle ? 'vehicle' : 'foot';
    if (mode !== this.mode) {
      this.mode = mode;
      if (vehicle) this.lookYaw = 0;
      else this.yaw += this.lookYaw;
    }
    this.zoom = clamp(this.zoom + input.wheel * 0.1, 0.6, 1.9);
    const mdx = input.mouseDX * input.sensitivity;
    const mdy = input.mouseDY * input.sensitivity;

    let want;
    let height;
    let fov = this.baseFov;
    if (vehicle) {
      const spec = vehicle.spec;
      const sf = saturate(Math.abs(vehicle.vf) / spec.top);
      // Mouse look is an offset that relaxes once the player stops moving the mouse.
      this.lookYaw -= mdx;
      this.pitch = clamp(this.pitch + mdy, -0.05, 1.1);
      const idle = (performance.now() - input.lastMouseMove) / 1000;
      if (idle > 1.4 && Math.abs(vehicle.vf) > 1.5) {
        this.lookYaw = damp(this.lookYaw, 0, 2.6, dt);
        this.pitch = damp(this.pitch, 0.2, 1.6, dt);
      }
      this.lookYaw = clamp(this.lookYaw, -Math.PI, Math.PI);
      const behind = vehicle.heading + Math.PI;
      this.yaw = dampAngle(this.yaw, behind, lerp(3.2, 5.2, sf), dt);
      want = spec.camera.dist * this.zoom * (1 + sf * 0.22);
      height = spec.camera.height * 0.62;
      fov = this.baseFov + sf * 15;
      _target.set(vehicle.pos.x, vehicle.pos.y + height, vehicle.pos.z);
      // Look slightly ahead of the car at speed.
      _target.x += Math.sin(vehicle.heading) * sf * 1.6;
      _target.z += Math.cos(vehicle.heading) * sf * 1.6;
    } else {
      this.yaw -= mdx;
      this.pitch = clamp(this.pitch + mdy, -0.55, 1.25);
      want = 3.9 * this.zoom;
      // Over-the-shoulder offset.
      const rx = Math.cos(this.yaw);
      const rz = -Math.sin(this.yaw);
      _target.set(player.pos.x + rx * 0.32, player.pos.y + 1.52, player.pos.z + rz * 0.32);
      fov = this.baseFov + saturate(player.speed / 7) * 4;
    }

    if (!this.initialised) {
      this.target.copy(_target);
      this.smoothDist = want;
      this.initialised = true;
    }
    const follow = vehicle ? 16 : 18;
    this.target.x = damp(this.target.x, _target.x, follow, dt);
    this.target.z = damp(this.target.z, _target.z, follow, dt);
    this.target.y = damp(this.target.y, _target.y, vehicle ? 9 : 12, dt);

    const yaw = this.yaw + (vehicle ? this.lookYaw : 0);
    const cp = Math.cos(this.pitch);
    _dir.set(Math.sin(yaw) * cp, Math.sin(this.pitch), Math.cos(yaw) * cp);

    // Obstruction: shorten the boom rather than clip through buildings, decks or the ground.
    const world = this.game.world;
    let allowed = world.colliders.raycast(this.target.x, this.target.y, this.target.z, _dir.x, _dir.y, _dir.z, want + 0.4) - 0.35;
    allowed = clamp(allowed, 0.7, want);
    for (let i = 1; i <= 4; i++) {
      const d = (allowed * i) / 4;
      const x = this.target.x + _dir.x * d;
      const y = this.target.y + _dir.y * d;
      const z = this.target.z + _dir.z * d;
      const floor = world.ground.height(x, z, y, 0.4) + 0.3;
      if (y < floor) {
        allowed = Math.max(0.7, d * ((this.target.y - floor) / Math.max(0.01, this.target.y - y)));
        break;
      }
      const ceil = world.ground.ceiling(x, z, this.target.y - 0.5);
      if (y > ceil - 0.25) {
        allowed = Math.max(0.7, d * ((ceil - 0.25 - this.target.y) / Math.max(0.01, y - this.target.y)));
        break;
      }
    }
    // Pull in instantly, ease back out.
    if (allowed < this.smoothDist) this.smoothDist = allowed;
    else this.smoothDist = damp(this.smoothDist, allowed, 4, dt);

    const cam = this.camera;
    cam.position.set(this.target.x + _dir.x * this.smoothDist, this.target.y + _dir.y * this.smoothDist, this.target.z + _dir.z * this.smoothDist);
    const minY = world.ground.height(cam.position.x, cam.position.z, cam.position.y + 0.5, 1) + 0.25;
    if (cam.position.y < minY) cam.position.y = minY;
    if (this.shake > 0.001) {
      const s = this.shake * 0.16;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
      cam.position.z += (Math.random() - 0.5) * s;
      this.shake = damp(this.shake, 0, 7, dt);
    }
    cam.lookAt(this.target.x, this.target.y + (vehicle ? 0.25 : 0.1), this.target.z);
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov = damp(cam.fov, fov, 4, dt);
      cam.updateProjectionMatrix();
    }
  }

  /** Yaw used for camera-relative movement. */
  get moveYaw() {
    return this.yaw;
  }
}
