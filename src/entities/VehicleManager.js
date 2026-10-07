// Owns every vehicle that is not part of the traffic flow: parked ones and whatever the
// player is driving or has abandoned.

import { Vehicle } from './Vehicle.js';
import { VEHICLES, baseType } from './vehicles/specs.js';
import { RNG } from '../utils/rng.js';

export class VehicleManager {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.rng = new RNG(99);
  }

  randomPaint(type) {
    return this.rng.weighted(VEHICLES[baseType(type)].paints);
  }

  spawn(type, x, z, heading, colour = null) {
    const v = new Vehicle(this.game, type, x, z, heading, colour ?? this.randomPaint(type));
    if (!v.visual) return null;
    this.list.push(v);
    return v;
  }

  /**
   * Parking spots come from the city generator. Vehicles are only instantiated for spots
   * near the player; untouched ones are released again when the player moves away.
   */
  setParking(spots, share = 0.45) {
    const rng = this.rng;
    this.slots = [];
    for (const s of spots) {
      if (!s.fixed && !rng.chance(share)) continue;
      let type = s.kind;
      if (s.kind === 'car') type = rng.weighted([['hatchback', 5], ['sedan', 3], ['suv', 3]]);
      else if (s.kind === 'bike') type = rng.weighted([['motorcycle', 5], ['scooter', 5]]);
      this.slots.push({ x: s.x, z: s.z, heading: s.heading, type, colour: this.randomPaint(type), vehicle: null, gone: false });
    }
    this._scan = 0;
  }

  _updateSlots(focus) {
    if (!this.slots) return;
    const near = 240;
    const far = 300;
    // Spread the work: look at a slice of the slots each call.
    const n = this.slots.length;
    const batch = Math.min(n, 260);
    for (let k = 0; k < batch; k++) {
      const slot = this.slots[(this._scan + k) % n];
      if (slot.gone) continue;
      const d = Math.hypot(slot.x - focus.x, slot.z - focus.z);
      const v = slot.vehicle;
      if (v) {
        const moved = v.occupied || Math.hypot(v.pos.x - slot.x, v.pos.z - slot.z) > 0.6;
        if (moved) {
          // The player took it: it now lives on its own.
          slot.vehicle = null;
          slot.gone = true;
          v.stray = true;
        } else if (d > far) {
          this.remove(v);
          slot.vehicle = null;
        }
      } else if (d < near) {
        const made = this.spawn(slot.type, slot.x, slot.z, slot.heading, slot.colour);
        if (made) slot.vehicle = made;
      }
    }
    this._scan = (this._scan + batch) % Math.max(1, n);
    // Abandoned vehicles are cleaned up once they are well out of sight.
    for (let i = this.list.length - 1; i >= 0; i--) {
      const v = this.list[i];
      if (!v.stray || v.occupied) continue;
      if (Math.hypot(v.pos.x - focus.x, v.pos.z - focus.z) > 420) this.remove(v);
    }
  }

  remove(v) {
    const i = this.list.indexOf(v);
    if (i >= 0) this.list.splice(i, 1);
    v.dispose();
  }

  /** Closest unoccupied vehicle whose body is within `reach` metres of the point. */
  nearest(pos, reach = 2.4) {
    let best = null;
    let bestD = Infinity;
    for (const v of this.list) {
      if (v.occupied) continue;
      const dx = pos.x - v.pos.x;
      const dz = pos.z - v.pos.z;
      if (Math.abs(pos.y - v.pos.y) > 2) continue;
      // Distance to the vehicle's centre line segment.
      const fx = Math.sin(v.heading);
      const fz = Math.cos(v.heading);
      const along = Math.max(-v.halfLength, Math.min(v.halfLength, dx * fx + dz * fz));
      const d = Math.hypot(dx - fx * along, dz - fz * along) - v.model.size.width / 2;
      if (d < reach && d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  update(dt, focus) {
    this._slotTimer = (this._slotTimer || 0) - dt;
    if (focus && this._slotTimer <= 0) {
      this._slotTimer = 0.25;
      this._updateSlots(focus);
    }
    for (const v of this.list) {
      if (v.occupied) continue;
      if (!v.sleeping) v.update(dt, null);
    }
  }

  /** Append collision circles for vehicles near (x, z). */
  collect(x, z, range, exclude, out, pool) {
    for (const v of this.list) {
      if (v === exclude) continue;
      const dx = v.pos.x - x;
      const dz = v.pos.z - z;
      const reach = range + v.halfLength;
      if (dx * dx + dz * dz > reach * reach) continue;
      const fx = Math.sin(v.heading);
      const fz = Math.cos(v.heading);
      const r = v.radius;
      const span = Math.max(0, v.halfLength - r);
      const n = span > 1.6 ? 5 : span > 0.2 ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const o = n === 1 ? 0 : -span + (2 * span * i) / (n - 1);
        const ob = pool();
        ob.x = v.pos.x + fx * o;
        ob.z = v.pos.z + fz * o;
        ob.y = v.pos.y;
        ob.r = r;
        ob.vx = v.vx;
        ob.vz = v.vz;
        ob.mass = v.spec.heavy ? 6 : v.twoWheeler ? 0.3 : 1.2;
        ob.onHit = (by, strength, nx, nz) => {
          // Shunted by the player: roll away with some of the momentum.
          const k = Math.min(1, 0.55 / (ob.mass || 1));
          v.vx -= nx * strength * k;
          v.vz -= nz * strength * k;
          v.sleeping = false;
        };
        ob.ref = v;
        out.push(ob);
      }
    }
  }
}
