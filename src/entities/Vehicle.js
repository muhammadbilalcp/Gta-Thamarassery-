// A vehicle the player can drive. Arcade handling: a bicycle model for yaw, momentum carried
// in world space so the tail steps out when grip runs out, progressive power and drag.

import * as THREE from 'three';
import { VEHICLES, baseType } from './vehicles/specs.js';
import { clamp, damp, lerp, saturate } from '../utils/math.js';

const GRAVITY = 16;
const _hit = { nx: 0, nz: 0, depth: 0, tag: '' };
const _pt = { x: 0, z: 0 };

export class Vehicle {
  constructor(game, type, x, z, heading, colour) {
    this.game = game;
    this.type = baseType(type);
    this.spec = VEHICLES[this.type];
    this.visual = game.vehicles.create(this.type, colour);
    this.model = this.visual.model;
    this.colour = colour;
    this.pos = new THREE.Vector3(x, 0, z);
    this.pos.y = game.world.ground.height(x, z, 0.5);
    this.heading = heading;
    this.vx = 0; // world-space velocity
    this.vz = 0;
    this.vy = 0;
    this.vf = 0; // forward speed
    this.vl = 0; // sideways speed (+ = to the left)
    this.yawRate = 0;
    this.steer = 0;
    this.pitch = 0;
    this.roll = 0;
    this.bodyPitch = 0;
    this.bodyRoll = 0;
    this.spin = 0;
    this.brakeLight = 0;
    this.airborne = false;
    this.occupied = false;
    this.slip = 0;
    this.lastImpact = 0;
    this.accel = 0;
    this.radius = this.spec.radius;
    this.halfLength = this.model.size.length / 2;
    this.height = this.model.size.height;
    this.twoWheeler = !!this.model.twoWheeler;
    this.sleeping = true;
    this.sync();
  }

  get speed() {
    return Math.hypot(this.vx, this.vz);
  }

  get kmh() {
    return Math.abs(this.vf) * 3.6;
  }

  forward(out) {
    out.x = Math.sin(this.heading);
    out.z = Math.cos(this.heading);
    return out;
  }

  /** controls: { throttle -1..1, steer -1..1 (+ = left), handbrake bool } or null when parked. */
  update(dt, controls) {
    const spec = this.spec;
    const g = this.game.world.ground;
    const throttle = controls ? controls.throttle : 0;
    const steerIn = controls ? controls.steer : 0;
    const handbrake = controls ? controls.handbrake : !this.occupied;

    if (!controls && this.speed < 0.05 && !this.airborne) {
      if (!this.sleeping) {
        this.vx = this.vz = this.vf = this.vl = 0;
        this.brakeLight = 0;
        this.visual.setLights(0, 0);
        this.sync();
        this.sleeping = true;
      }
      return;
    }
    this.sleeping = false;

    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    const lx = fz; // left
    const lz = -fx;
    let vf = this.vx * fx + this.vz * fz;
    let vl = this.vx * lx + this.vz * lz;

    const inWater = this.game.world.terrain.waterDistance(this.pos.x, this.pos.z) < -1 && this.pos.y < -0.3;

    // ---- steering: less lock the faster you go
    const speedAbs = Math.abs(vf);
    const lock = spec.steer * lerp(1, 0.16, saturate(speedAbs / (spec.top * 0.7)) ** 0.8);
    this.steer = damp(this.steer, steerIn * lock, steerIn !== 0 ? 6.5 : 9, dt);

    // ---- longitudinal forces
    let a = 0;
    let braking = false;
    if (!this.airborne) {
      if (throttle > 0) {
        if (vf > -0.4) a = spec.accel * throttle * (1 - saturate(vf / spec.top) ** 1.8);
        else {
          a = spec.brake * throttle;
          braking = true;
        }
      } else if (throttle < 0) {
        if (vf > 0.4) {
          a = spec.brake * throttle;
          braking = true;
        } else a = spec.accel * 0.75 * throttle * (1 - saturate(-vf / spec.reverse));
      }
      const rolling = 0.32 + (throttle === 0 ? 1.1 : 0) + (inWater ? 6 : 0);
      const drag = 0.00085 * vf * vf;
      const resist = (rolling + drag + (handbrake ? 10 : 0)) * dt;
      vf += a * dt;
      if (Math.abs(vf) <= resist && throttle === 0) vf = 0;
      else vf -= Math.sign(vf) * Math.min(Math.abs(vf), resist);
      if (braking && Math.sign(vf) !== Math.sign(vf - a * dt) && Math.abs(vf) < 0.6) vf = 0;
    }
    this.accel = a;
    this.brakeLight = damp(this.brakeLight, braking || (handbrake && this.occupied && speedAbs > 0.5) ? 1 : 0, 18, dt);

    // ---- yaw
    let yawRate = (vf / spec.wheelbase) * Math.tan(this.steer);
    const grip = spec.grip * (handbrake ? 0.5 : 1) * (inWater ? 0.4 : 1);
    const aLat = vf * yawRate;
    let slip = 0;
    if (Math.abs(aLat) > grip) {
      slip = Math.abs(aLat) - grip;
      yawRate *= lerp(grip / Math.abs(aLat), 1, handbrake ? 0.75 : 0.15);
    }
    if (this.airborne) yawRate *= 0.2;
    this.yawRate = yawRate;
    this.heading += yawRate * dt;

    // ---- carry momentum through the rotation, then let the tyres scrub the sideways part
    const wx = fx * vf + lx * vl;
    const wz = fz * vf + lz * vl;
    const nfx = Math.sin(this.heading);
    const nfz = Math.cos(this.heading);
    const nlx = nfz;
    const nlz = -nfx;
    vf = wx * nfx + wz * nfz;
    vl = wx * nlx + wz * nlz;
    const lateralGrip = this.airborne ? 0 : handbrake ? 2.4 : lerp(13, 7.5, saturate(slip / 6));
    vl *= Math.exp(-lateralGrip * dt);
    this.slip = damp(this.slip, saturate(Math.abs(vl) / 4) + saturate(slip / 8), 8, dt);
    this.vf = vf;
    this.vl = vl;
    this.vx = nfx * vf + nlx * vl;
    this.vz = nfz * vf + nlz * vl;

    // ---- integrate + collide
    this.pos.x += this.vx * dt;
    this.pos.z += this.vz * dt;
    this._collide(dt);

    // ---- ground contact, pitch and roll from the wheel heights
    const hb = spec.wheelbase / 2;
    const hw = this.model.size.width * 0.42;
    const px = this.pos.x;
    const pz = this.pos.z;
    const y = this.pos.y;
    const step = 0.7;
    const hF = g.height(px + nfx * hb, pz + nfz * hb, y, step);
    const hR = g.height(px - nfx * hb, pz - nfz * hb, y, step);
    const hL = g.height(px + nlx * hw, pz + nlz * hw, y, step);
    const hRt = g.height(px - nlx * hw, pz - nlz * hw, y, step);
    let ground = (hF + hR) / 2;
    const floor = this.game.world.terrain.waterLevel - 0.75;
    if (ground < floor) ground = floor;
    if (this.pos.y > ground + 0.25) {
      this.airborne = true;
      this.vy -= GRAVITY * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= ground) {
        this.pos.y = ground;
        if (this.vy < -5) this._impact(Math.abs(this.vy) * 0.6);
        this.vy = 0;
        this.airborne = false;
      }
    } else {
      this.airborne = false;
      this.vy = 0;
      this.pos.y = damp(this.pos.y, ground, 22, dt);
    }
    const tp = Math.atan2(hF - hR, spec.wheelbase);
    const tr = Math.atan2(hL - hRt, hw * 2); // + = leaning right (left side higher)
    this.pitch = damp(this.pitch, tp, 10, dt);
    this.roll = damp(this.roll, tr, 10, dt);

    // Body motion on the springs: squat, dive and lean.
    const tyreLat = clamp(vf * this.yawRate, -14, 14);
    const targetPitch = clamp(a * 0.0065, -0.06, 0.05);
    const targetRoll = this.twoWheeler ? clamp(-Math.atan(tyreLat / 9.81) * (spec.lean ?? 0.5) * 1.1, -0.56, 0.56) : tyreLat * 0.0058;
    this.bodyPitch = damp(this.bodyPitch, targetPitch, 5, dt);
    this.bodyRoll = damp(this.bodyRoll, targetRoll, this.twoWheeler ? 7 : 5, dt);
    this.spin += (vf / (this.model.wheels[0].r || 0.3)) * dt;

    this.sync();
    this.visual.setLights(this.brakeLight, 0);
  }

  _collide() {
    const col = this.game.world.colliders;
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    const r = this.radius;
    const reach = Math.max(0, this.halfLength - r);
    const offsets = reach > 1.6 ? [reach, reach * 0.5, 0, -reach * 0.5, -reach] : reach > 0.2 ? [reach, 0, -reach] : [0];
    const y0 = this.pos.y + 0.35;
    const y1 = this.pos.y + this.height;
    let pushX = 0;
    let pushZ = 0;
    let torque = 0;
    let hits = 0;
    for (const o of offsets) {
      _pt.x = this.pos.x + fx * o;
      _pt.z = this.pos.z + fz * o;
      const ox = _pt.x;
      const oz = _pt.z;
      if (col.resolveCircle(_pt, r, y0, y1, _hit) > 0) {
        const dx = _pt.x - ox;
        const dz = _pt.z - oz;
        pushX += dx;
        pushZ += dz;
        torque += (fz * o * dx - fx * o * dz) * 0.06;
        hits++;
        this._bounce(_hit.nx, _hit.nz, 0.25);
      }
    }
    // Other vehicles and pedestrians.
    const others = this.game.obstaclesNear(this.pos.x, this.pos.z, this.halfLength + 8, this);
    for (const ob of others) {
      if (Math.abs(ob.y - this.pos.y) > 2.5) continue;
      for (const o of offsets) {
        const cx = this.pos.x + fx * o;
        const cz = this.pos.z + fz * o;
        const dx = cx - ob.x;
        const dz = cz - ob.z;
        const d = Math.hypot(dx, dz);
        const min = r + ob.r;
        if (d >= min || d < 1e-4) continue;
        const nx = dx / d;
        const nz = dz / d;
        const depth = min - d;
        const share = ob.mass ? clamp(ob.mass / (ob.mass + 1), 0.3, 1) : 1;
        pushX += nx * depth * share;
        pushZ += nz * depth * share;
        torque += (fz * o * nx - fx * o * nz) * depth * 0.05;
        hits++;
        const rel = (this.vx - (ob.vx || 0)) * nx + (this.vz - (ob.vz || 0)) * nz;
        if (rel < 0) {
          ob.onHit?.(this, -rel, nx, nz);
          this._bounce(nx, nz, 0.3, ob.vx || 0, ob.vz || 0);
        }
      }
    }
    if (hits) {
      this.pos.x += pushX / Math.max(1, hits * 0.6);
      this.pos.z += pushZ / Math.max(1, hits * 0.6);
      this.heading += clamp(torque, -0.05, 0.05);
      this.vf = this.vx * Math.sin(this.heading) + this.vz * Math.cos(this.heading);
    }
  }

  _bounce(nx, nz, restitution, ovx = 0, ovz = 0) {
    const rel = (this.vx - ovx) * nx + (this.vz - ovz) * nz;
    if (rel >= 0) return;
    this.vx -= nx * rel * (1 + restitution);
    this.vz -= nz * rel * (1 + restitution);
    // Scrub speed along the wall too.
    this.vx *= 0.985;
    this.vz *= 0.985;
    this._impact(-rel);
  }

  _impact(strength) {
    if (strength < 2.2) return;
    const now = performance.now();
    if (now - this.lastImpact < 180) return;
    this.lastImpact = now;
    if (this.occupied) this.game.onImpact?.(strength);
  }

  sync() {
    this.visual.update(this.pos.x, this.pos.y, this.pos.z, this.heading, this.pitch + this.bodyPitch, this.roll + this.bodyRoll, this.steer, this.spin);
  }

  /** World position of the door the player uses (right-hand drive). */
  doorPoint(side = -1, out = new THREE.Vector3()) {
    const lx = Math.cos(this.heading);
    const lz = -Math.sin(this.heading);
    const d = this.model.size.width / 2 + 0.75;
    const seatZ = this.model.seat?.z ?? 0;
    out.set(this.pos.x + lx * d * side + Math.sin(this.heading) * seatZ, this.pos.y, this.pos.z + lz * d * side + Math.cos(this.heading) * seatZ);
    return out;
  }

  dispose() {
    this.visual.dispose();
  }
}
