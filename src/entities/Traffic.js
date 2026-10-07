// Ambient traffic. Vehicles follow the lane graph (keeping left), hold a gap to whatever is
// ahead, obey the signals, take the flyovers on the inner lanes and are recycled once they
// are far from the player.

import { VEHICLES, TRAFFIC_MIX, baseType } from './vehicles/specs.js';
import { STOP_LINE_SETBACK } from '../world/RoadNetwork.js';
import { RNG } from '../utils/rng.js';
import { clamp, damp, angleDiff } from '../utils/math.js';

const SPAWN_MIN = 110;
const SPAWN_MAX = 330;
const DESPAWN = 400;
const _s = {};
const _s2 = {};

let nextId = 1;

class TrafficVehicle {
  constructor(type, visual, colour, rng) {
    this.id = nextId++;
    this.type = type;
    this.base = baseType(type);
    this.spec = VEHICLES[this.base];
    this.visual = visual;
    this.colour = colour;
    this.model = visual.model;
    this.length = this.model.size.length;
    this.width = this.model.size.width;
    this.radius = this.spec.radius;
    this.twoWheeler = !!this.model.twoWheeler;
    this.path = null;
    this.next = null;
    this.d = 0;
    this.v = 0;
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.heading = 0;
    this.pitch = 0;
    this.roll = 0;
    this.steer = 0;
    this.spin = 0;
    this.hint = 0;
    this.brake = 0;
    this.temper = rng.float(0.82, 1.12);
    // Two-wheelers and autos wander within the lane, as they do.
    this.offset = this.twoWheeler ? rng.float(-1.0, 1.0) : this.base === 'auto' ? rng.float(-0.5, 0.6) : rng.float(-0.22, 0.22);
    this.stun = 0;
    this.blocked = 0;
    this.honk = rng.float(2, 6);
    this.vx = 0;
    this.vz = 0;
  }
}

export class Traffic {
  constructor(game) {
    this.game = game;
    this.roads = game.world.roads;
    this.renderer = game.vehicles;
    this.rng = new RNG(5150);
    this.active = [];
    this.max = game.quality.traffic;
    this.time = 0;
    // Only real lanes (not junction connectors) are used for spawning.
    this.lanes = this.roads.lanes.filter((l) => l.kind === 'lane' && l.length > 30);
    for (const l of this.lanes) {
      const n = l.pts.length / 3;
      const m = Math.floor(n / 2) * 3;
      l.cx = l.pts[m];
      l.cz = l.pts[m + 2];
    }
    this._spawnTimer = 0;
  }

  // ------------------------------------------------------------------------ spawning
  _pickType(lane) {
    const e = lane.edge;
    for (let tries = 0; tries < 6; tries++) {
      const t = this.rng.weighted(TRAFFIC_MIX);
      const heavy = VEHICLES[baseType(t)].heavy;
      if (heavy && e.cls === 'street') continue;
      // Buses keep to the outer lanes, autos stay off the flyovers.
      if (heavy && lane.inner) continue;
      if (baseType(t) === 'auto' && lane.inner && lane.edge.cls === 'highway') continue;
      return t;
    }
    return 'hatchback';
  }

  _chooseNext(path) {
    if (!path.next.length) return null;
    if (path.next.length === 1) return path.next[0].path;
    const w = path.next.map((n) => [n.path, n.turn === 'S' ? 6 : n.turn === 'L' ? 2.2 : 1.8]);
    return this.rng.weighted(w);
  }

  _free(lane, d, gap) {
    for (const o of lane.vehicles) if (Math.abs(o.d - d) < gap) return false;
    return true;
  }

  spawn(focus, anywhere = false) {
    const rng = this.rng;
    for (let tries = 0; tries < 8; tries++) {
      const lane = rng.pick(this.lanes);
      const dx = lane.cx - focus.x;
      const dz = lane.cz - focus.z;
      if (dx * dx + dz * dz > (SPAWN_MAX + lane.length) ** 2) continue;
      const d = rng.float(6, lane.length - 6);
      lane.sample(d, _s);
      const dist = Math.hypot(_s.x - focus.x, _s.z - focus.z);
      if (dist > SPAWN_MAX || (!anywhere && dist < SPAWN_MIN) || (anywhere && dist < 26)) continue;
      const type = this._pickType(lane);
      const len = VEHICLES[baseType(type)].heavy ? 13 : 8;
      if (!this._free(lane, d, len + 6)) continue;
      const colour = rng.weighted(VEHICLES[baseType(type)].paints);
      const visual = this.renderer.create(type, colour);
      if (!visual) continue;
      const v = new TrafficVehicle(type, visual, colour, rng);
      v.path = lane;
      v.d = d;
      v.next = this._chooseNext(lane);
      v.v = lane.speed * v.spec.traffic * 0.7;
      lane.vehicles.push(v);
      this.active.push(v);
      this._place(v, 0);
      return v;
    }
    return null;
  }

  populate(focus) {
    let guard = 0;
    while (this.active.length < this.max && guard++ < this.max * 6) this.spawn(focus, true);
  }

  remove(v) {
    const i = this.active.indexOf(v);
    if (i >= 0) this.active.splice(i, 1);
    const k = v.path.vehicles.indexOf(v);
    if (k >= 0) v.path.vehicles.splice(k, 1);
    v.visual.dispose();
    v.dead = true;
  }

  // ------------------------------------------------------------------------- update
  update(dt, focus) {
    this.time += dt;
    const list = this.active;
    // Recycle.
    for (let i = list.length - 1; i >= 0; i--) {
      const v = list[i];
      const dx = v.x - focus.x;
      const dz = v.z - focus.z;
      if (dx * dx + dz * dz > DESPAWN * DESPAWN) this.remove(v);
    }
    this._spawnTimer -= dt;
    if (list.length < this.max && this._spawnTimer <= 0) {
      this.spawn(focus);
      this._spawnTimer = 0.12;
    }

    const player = this.game.player;
    const pv = player.vehicle;
    const px = pv ? pv.pos.x : player.pos.x;
    const pz = pv ? pv.pos.z : player.pos.z;
    const py = pv ? pv.pos.y : player.pos.y;
    const pr = pv ? pv.halfLength + 0.3 : 0.5;
    const peds = this.game.pedestrians ? this.game.pedestrians.active : null;

    for (let i = 0; i < list.length; i++) {
      const v = list[i];
      if (v.dead) continue;
      const path = v.path;
      const want = path.speed * v.spec.traffic * v.temper;
      let gap = Infinity; // free distance ahead of the front bumper
      let lead = 0; // speed of whatever is ahead
      const front = v.d + v.length / 2;

      // Leader in the same lane, then in the lane we are about to enter.
      for (const o of path.vehicles) {
        if (o === v || o.d <= v.d) continue;
        const g = o.d - o.length / 2 - front;
        if (g < gap) {
          gap = g;
          lead = o.v;
        }
      }
      const toEnd = path.length - front;
      if (v.next && toEnd < 45) {
        for (const o of v.next.vehicles) {
          const g = toEnd + o.d - o.length / 2;
          if (g < gap) {
            gap = g;
            lead = o.v;
          }
        }
        // Do not enter a junction we cannot clear.
      }
      // Signals. Left turns filter through on a free left.
      if (path.signal && v.next && !v.next.freeLeft) {
        const state = this.roads.signalState(path.signal.node, path.signal.arm, this.time);
        const stop = path.length - STOP_LINE_SETBACK - front;
        if (state === 'red' || (state === 'yellow' && stop > v.v * 1.1)) {
          if (stop > -2 && stop < gap) {
            gap = Math.max(0, stop);
            lead = 0;
          }
        }
      }
      // Anything else in the way: cross traffic, the player, pedestrians.
      const fx = Math.sin(v.heading);
      const fz = Math.cos(v.heading);
      const look = 6 + v.v * 1.6;
      const half = v.width / 2 + 0.35;
      const probe = (ox, oz, oy, r, ov, other) => {
        if (Math.abs(oy - v.y) > 2.2) return;
        const dx = ox - v.x;
        const dz = oz - v.z;
        const along = dx * fx + dz * fz;
        if (along < 0 || along > look + v.length / 2 + r) return;
        const lat = Math.abs(dx * fz - dz * fx);
        if (lat > half + r) return;
        if (other && other.id < v.id) {
          // Two vehicles facing each other: the older one goes first.
          const ofx = Math.sin(other.heading);
          const ofz = Math.cos(other.heading);
          const back = -dx * ofx - dz * ofz;
          const olat = Math.abs(-dx * ofz + dz * ofx);
          if (back > 0 && olat < other.width / 2 + v.radius + 0.35 && fx * ofx + fz * ofz < 0.3) {
            /* we yield */
          }
        }
        const g = along - v.length / 2 - r;
        if (g < gap) {
          gap = g;
          lead = ov;
        }
      };
      probe(px, pz, py, pr, pv ? Math.max(0, pv.vx * fx + pv.vz * fz) : 0, null);
      if (pv) {
        const hfx = Math.sin(pv.heading);
        const hfz = Math.cos(pv.heading);
        probe(px + hfx * pv.halfLength * 0.7, pz + hfz * pv.halfLength * 0.7, py, pv.radius, 0, null);
        probe(px - hfx * pv.halfLength * 0.7, pz - hfz * pv.halfLength * 0.7, py, pv.radius, 0, null);
      }
      if (path.kind === 'connector' || toEnd < 30 || v.d < 14) {
        for (let k = 0; k < list.length; k++) {
          const o = list[k];
          if (o === v || o.path === path || o.dead) continue;
          const dx = o.x - v.x;
          const dz = o.z - v.z;
          if (dx * dx + dz * dz > 900) continue;
          // Only give way to vehicles with priority (lower id) to avoid a stand-off.
          if (o.id > v.id && o.v > 0.5) continue;
          probe(o.x, o.z, o.y, o.radius, Math.max(0, o.vx * fx + o.vz * fz), o);
        }
      }
      if (peds) {
        for (let k = 0; k < peds.length; k++) {
          const p = peds[k];
          if (!p.visible) continue;
          probe(p.x, p.z, p.y, 0.5, 0, null);
        }
      }
      for (const o of this.game.vehicleManager.list) {
        if (o.occupied) continue;
        const dx = o.pos.x - v.x;
        const dz = o.pos.z - v.z;
        if (dx * dx + dz * dz > 600) continue;
        probe(o.pos.x, o.pos.z, o.pos.y, o.radius + 0.4, 0, null);
      }

      // Intelligent-driver style speed control.
      const aMax = v.spec.accel * 0.5;
      let acc;
      if (v.stun > 0) {
        v.stun -= dt;
        acc = -9;
      } else {
        const s0 = v.twoWheeler ? 1.2 : 2.2;
        const T = v.twoWheeler ? 0.7 : 1.0;
        const dv = v.v - lead;
        const sStar = s0 + Math.max(0, v.v * T + (v.v * dv) / (2 * Math.sqrt(aMax * 3.2)));
        const free = 1 - (v.v / Math.max(0.1, want)) ** 4;
        const inter = gap === Infinity ? 0 : (sStar / Math.max(0.3, gap)) ** 2;
        acc = clamp(aMax * (free - inter), -9, aMax);
      }
      v.v = Math.max(0, v.v + acc * dt);
      if (gap < 0.4) v.v = 0;
      v.brake = damp(v.brake, acc < -0.8 || (v.v < 0.2 && gap < 6) ? 1 : 0, 10, dt);

      // Impatience: a blast of the horn, and eventually squeeze past.
      if (v.v < 0.3 && gap < 5) {
        v.blocked += dt;
        v.honk -= dt;
        if (v.honk <= 0 && v.blocked > 2.5) {
          v.honk = 3 + this.rng.float(0, 5);
          this._honk(v);
        }
        if (v.blocked > 14 && !(path.signal && toEnd < 12)) {
          v.v = 1.2; // creep through rather than dead-lock the junction
        }
      } else v.blocked = Math.max(0, v.blocked - dt * 2);

      v.d += v.v * dt;
      if (v.d >= path.length) {
        const next = v.next;
        const k = path.vehicles.indexOf(v);
        if (k >= 0) path.vehicles.splice(k, 1);
        if (!next) {
          v.path = path;
          this.remove(v);
          i--;
          continue;
        }
        v.d -= path.length;
        v.path = next;
        v.hint = 0;
        next.vehicles.push(v);
        v.next = this._chooseNext(next);
      }
      this._place(v, dt);
    }
  }

  _place(v, dt) {
    const path = v.path;
    path.sample(v.d, _s, v.hint);
    v.hint = _s.i;
    // Aim a little ahead for a smoother heading through bends.
    path.sample(Math.min(path.length, v.d + Math.max(1.5, v.length * 0.4)), _s2, v.hint);
    let hx = _s2.x - _s.x;
    let hz = _s2.z - _s.z;
    if (hx * hx + hz * hz < 1e-4) {
      hx = _s.tx;
      hz = _s.tz;
    }
    const heading = Math.atan2(hx, hz);
    const turn = dt > 0 ? angleDiff(v.heading, heading) / dt : 0;
    const prevX = v.x;
    const prevZ = v.z;
    v.heading = dt > 0 ? v.heading + angleDiff(v.heading, heading) * Math.min(1, dt * 9) : heading;
    // Left normal of the path keeps the lateral offset on the correct side.
    const l = Math.hypot(_s.tx, _s.tz) || 1;
    const nx = _s.tz / l;
    const nz = -_s.tx / l;
    v.x = _s.x + nx * v.offset;
    v.z = _s.z + nz * v.offset;
    v.y = _s.y + 0.03;
    if (dt > 0) {
      v.vx = (v.x - prevX) / dt;
      v.vz = (v.z - prevZ) / dt;
    }
    v.pitch = damp(v.pitch, Math.atan2(_s.ty, l), 8, dt || 1);
    const lat = clamp(v.v * turn, -12, 12);
    const roll = v.twoWheeler ? -Math.atan(lat / 9.81) * 1.1 : lat * 0.005;
    v.roll = damp(v.roll, roll, 6, dt || 1);
    v.steer = damp(v.steer, clamp((turn * v.spec.wheelbase) / Math.max(2, v.v), -0.6, 0.6), 8, dt || 1);
    v.spin += (v.v / (v.model.wheels[0].r || 0.3)) * dt;
    v.visual.update(v.x, v.y, v.z, v.heading, v.pitch, v.roll, v.steer, v.spin);
    v.visual.setLights(v.brake, 0);
  }

  _honk(v) {
    const audio = this.game.audio;
    if (!audio.ctx) return;
    const cam = this.game.camera;
    const dx = v.x - cam.position.x;
    const dz = v.z - cam.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 70) return;
    const gain = 0.09 * (1 - dist / 70) ** 1.5;
    const right = cam.matrixWorld.elements;
    const pan = clamp((dx * right[0] + dz * right[2]) / Math.max(4, dist), -1, 1);
    const f = v.base === 'auto' ? 760 : v.spec.heavy ? 300 : v.twoWheeler ? 560 : 430;
    const n = this.rng.int(1, 3);
    for (let i = 0; i < n; i++) {
      audio._tone({ freq: f, dur: 0.18 + this.rng.float(0, 0.25), gain, type: 'square', pan, delay: i * 0.32 });
      audio._tone({ freq: f * 1.25, dur: 0.18, gain: gain * 0.6, type: 'square', pan, delay: i * 0.32 });
    }
  }

  // ----------------------------------------------------------------------- services
  collect(x, z, range, out, pool) {
    for (const v of this.active) {
      const dx = v.x - x;
      const dz = v.z - z;
      const reach = range + v.length / 2;
      if (dx * dx + dz * dz > reach * reach) continue;
      const fx = Math.sin(v.heading);
      const fz = Math.cos(v.heading);
      const span = Math.max(0, v.length / 2 - v.radius);
      const n = span > 1.6 ? 5 : span > 0.2 ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const o = n === 1 ? 0 : -span + (2 * span * i) / (n - 1);
        const ob = pool();
        ob.x = v.x + fx * o;
        ob.z = v.z + fz * o;
        ob.y = v.y;
        ob.r = v.radius;
        ob.vx = v.vx;
        ob.vz = v.vz;
        ob.mass = v.spec.heavy ? 8 : v.twoWheeler ? 0.4 : 1.5;
        ob.ref = v;
        ob.onHit = (by, strength) => {
          v.stun = Math.min(3, 0.6 + strength * 0.12);
          v.v *= 0.3;
        };
        out.push(ob);
      }
    }
  }

  _near(pos, reach) {
    let best = null;
    let bd = Infinity;
    for (const v of this.active) {
      if (v.v > 2.8 || Math.abs(v.y - pos.y) > 2) continue;
      const dx = pos.x - v.x;
      const dz = pos.z - v.z;
      const fx = Math.sin(v.heading);
      const fz = Math.cos(v.heading);
      const along = clamp(dx * fx + dz * fz, -v.length / 2, v.length / 2);
      const d = Math.hypot(dx - fx * along, dz - fz * along) - v.width / 2;
      if (d < reach && d < bd) {
        bd = d;
        best = v;
      }
    }
    return best;
  }

  /** Something the player could take, for the prompt. */
  peek(pos, reach) {
    return this._near(pos, reach);
  }

  /** Hand a stopped traffic vehicle over to the player. */
  claim(pos, reach) {
    const v = this._near(pos, reach);
    if (!v) return null;
    const { x, z, heading, colour, base } = v;
    this.remove(v);
    return this.game.vehicleManager.spawn(base, x, z, heading, colour);
  }

  nearest(camera, out) {
    out.length = 0;
    const cx = camera.position.x;
    const cz = camera.position.z;
    const e = camera.matrixWorld.elements;
    for (const v of this.active) {
      const dx = v.x - cx;
      const dz = v.z - cz;
      const d = Math.hypot(dx, dz);
      if (d > 40 || v.v < 1) continue;
      out.push({ dist: d, pan: (dx * e[0] + dz * e[2]) / Math.max(3, d), speed: v.v });
    }
    out.sort((a, b) => a.dist - b.dist);
    out.length = Math.min(4, out.length);
    return out;
  }

  nearestLanePoint(x, z) {
    let best = null;
    let bd = Infinity;
    for (const l of this.lanes) {
      const p = l.pts;
      for (let i = 0; i < p.length - 3; i += 6) {
        const dx = p[i] - x;
        const dz = p[i + 2] - z;
        const d = dx * dx + dz * dz;
        if (d < bd) {
          bd = d;
          best = { x: p[i], y: p[i + 1], z: p[i + 2], tx: p[i + 3] - p[i], tz: p[i + 5] - p[i + 2] };
        }
      }
    }
    return best;
  }
}
