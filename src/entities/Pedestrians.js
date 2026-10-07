// A handful of people on the footpaths. They wander the sidewalk graph, pause now and then,
// use the zebra crossings and are recycled around the player so only nearby ones animate.

import { Character } from './Character.js';
import { RNG } from '../utils/rng.js';
import * as THREE from 'three';
import { dampAngle, clamp } from '../utils/math.js';

const _frustum = new THREE.Frustum();
const _proj = new THREE.Matrix4();
const _sphere = new THREE.Sphere(new THREE.Vector3(), 1.6);

const NEAR = 40;
const FAR = 125;
const RECYCLE = 150;

// Tints multiply the avatar's pale suit: shirts in light colours, trousers dark, and the
// occasional white mundu.
const OUTFITS = [
  { top: 0xffffff, bottom: 0xffffff },
  { top: 0x8fb0e8, bottom: 0x3c3f4c },
  { top: 0xffffff, bottom: 0x2f3546 },
  { top: 0xe0b98a, bottom: 0x4c3d30 },
  { top: 0xa6dcb4, bottom: 0x272c38 },
  { top: 0xf2a08e, bottom: 0x303030 },
  { top: 0xc9bff0, bottom: 0xffffff },
  { top: 0x6f8fd0, bottom: 0xffffff },
  { top: 0xf0e08a, bottom: 0x3a3228 },
];
const SAREES = [0xffffff, 0xffd9c9, 0xcfe6ff, 0xffe9a6, 0xd9ffd9, 0xf0c9ff, 0xffc9d9];

class Ped {
  constructor(character, rng) {
    this.character = character;
    this.object = character.root;
    this.link = null;
    this.forward = true;
    this.t = 0; // distance along the link
    this.seg = 0;
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.heading = 0;
    this.speed = rng.float(1.15, 1.6);
    this.v = 0;
    this.idle = 0;
    this.visible = false;
    this.flee = 0;
    this.fx = 0;
    this.fz = 0;
    this.side = rng.float(-0.55, 0.55);
  }
}

export class Pedestrians {
  constructor(game) {
    this.game = game;
    this.roads = game.world.roads;
    this.ground = game.world.ground;
    this.rng = new RNG(8086);
    this.active = [];
    this.links = this.roads.walkLinks.filter((l) => l.length > 6);
    for (const l of this.links) {
      const m = l.pts[Math.floor(l.pts.length / 2)];
      l.mx = m[0];
      l.mz = m[1];
      // Cumulative lengths for sampling.
      l.cum = [0];
      for (let i = 1; i < l.pts.length; i++) l.cum.push(l.cum[i - 1] + Math.hypot(l.pts[i][0] - l.pts[i - 1][0], l.pts[i][1] - l.pts[i - 1][1]));
    }
    // Candidate starting points every few metres along every footpath.
    this.points = [];
    for (const l of this.links) {
      if (l.kind === 'cross') continue;
      for (let t = 2; t < l.length - 2; t += 12) {
        let i = 0;
        while (i < l.pts.length - 2 && l.cum[i + 1] < t) i++;
        const u = (t - l.cum[i]) / (l.cum[i + 1] - l.cum[i] || 1);
        this.points.push({ l, t, x: l.pts[i][0] + (l.pts[i + 1][0] - l.pts[i][0]) * u, z: l.pts[i][1] + (l.pts[i + 1][1] - l.pts[i][1]) * u });
      }
    }
    this._near = [];
    const count = game.quality.pedestrians;
    for (let i = 0; i < count; i++) {
      const female = i % 3 === 2;
      const kind = female ? 'michelleLite' : 'avatarLite';
      const tint = female ? { all: true, top: this.rng.pick(SAREES) } : this.rng.pick(OUTFITS);
      const c = new Character(game.assets, kind, { tint, height: this.rng.float(1.56, 1.8) });
      // Tiny meshes are not worth a draw call on a passer-by.
      c.model.traverse((o) => {
        if (o.isMesh && /Eye|Teeth/i.test(o.name)) o.visible = false;
      });
      c.root.visible = false;
      game.scene.add(c.root);
      this.active.push(new Ped(c, this.rng));
    }
    this._cursor = 0;
  }

  _respawn(p, focus, initial = false) {
    const rng = this.rng;
    const near = this._near;
    near.length = 0;
    const min = initial ? 8 : NEAR;
    for (const pt of this.points) {
      const d = Math.hypot(pt.x - focus.x, pt.z - focus.z);
      if (d < FAR - 10 && d > min) near.push(pt);
    }
    if (!near.length) return false;
    const pt = rng.pick(near);
    p.link = pt.l;
    p.forward = rng.chance(0.5);
    p.t = pt.t;
    p.seg = 0;
    p.idle = 0;
    p.flee = 0;
    this._sample(p);
    p.y = this.ground.height(p.x, p.z, 1, 2);
    p.heading = Math.atan2(p.dx, p.dz);
    return true;
  }

  _sample(p) {
    const l = p.link;
    const t = clamp(p.t, 0, l.length);
    let i = clamp(p.seg, 0, l.pts.length - 2);
    while (i > 0 && l.cum[i] > t) i--;
    while (i < l.pts.length - 2 && l.cum[i + 1] < t) i++;
    p.seg = i;
    const a = l.pts[i];
    const b = l.pts[i + 1];
    const span = l.cum[i + 1] - l.cum[i] || 1;
    const u = (t - l.cum[i]) / span;
    const dx = (b[0] - a[0]) / span;
    const dz = (b[1] - a[1]) / span;
    const dir = p.forward ? 1 : -1;
    // Keep to one side of the footpath.
    p.x = a[0] + (b[0] - a[0]) * u + dz * p.side * dir;
    p.z = a[1] + (b[1] - a[1]) * u - dx * p.side * dir;
    p.dx = dx * dir;
    p.dz = dz * dir;
  }

  _advance(p) {
    // Reached an end of the link: carry on along another one from the same node.
    const l = p.link;
    const node = p.forward ? l.b : l.a;
    const options = node.links.filter((k) => k !== l && k.length > 3);
    if (!options.length) {
      p.forward = !p.forward;
      p.t = clamp(p.t, 0, l.length);
      return;
    }
    // Prefer to keep walking rather than cross the road.
    const w = options.map((k) => [k, k.kind === 'cross' ? 0.5 : k.kind === 'corner' ? 2 : 3]);
    const next = this.rng.weighted(w);
    p.link = next;
    p.forward = next.a === node;
    p.t = p.forward ? 0 : next.length;
    p.seg = p.forward ? 0 : next.pts.length - 2;
    if (this.rng.chance(0.18)) p.idle = this.rng.float(2, 7);
  }

  update(dt, focus) {
    const list = this.active;
    const pv = this.game.player.vehicle;
    const cam = this.game.camera;
    _proj.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_proj);
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!p.link) {
        if (!this._respawn(p, focus, true)) continue;
      }
      const d = Math.hypot(p.x - focus.x, p.z - focus.z);
      if (d > RECYCLE) {
        if (!this._respawn(p, focus)) continue;
      }
      const visible = d < FAR;
      p.visible = visible;
      // Draw only those the camera can see (close ones always, for their shadows).
      _sphere.center.set(p.x, p.y + 0.9, p.z);
      const drawn = visible && (d < 22 || _frustum.intersectsSphere(_sphere));
      if (drawn !== p.drawn) {
        p.drawn = drawn;
        p.object.visible = drawn;
      }
      const shadow = d < 45;
      if (shadow !== p.shadow) {
        p.shadow = shadow;
        p.character.model.traverse((o) => {
          if (o.isMesh) o.castShadow = shadow;
        });
      }
      if (!visible) continue;

      let speed = p.speed;
      if (p.flee > 0) {
        // Jump clear of a car and keep running for a moment.
        p.flee -= dt;
        speed = 4.6;
        p.x += p.fx * speed * dt;
        p.z += p.fz * speed * dt;
        p.dx = p.fx;
        p.dz = p.fz;
        if (p.flee <= 0) this._respawn(p, { x: p.x, z: p.z }, true);
      } else if (p.idle > 0) {
        p.idle -= dt;
        speed = 0;
      } else {
        // Step back from fast traffic that is about to run us over.
        if (pv && Math.abs(pv.vf) > 3) {
          const dx = p.x - pv.pos.x;
          const dz = p.z - pv.pos.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 7 + Math.abs(pv.vf) * 0.35) {
            const fx = Math.sin(pv.heading);
            const fz = Math.cos(pv.heading);
            const along = (dx * fx + dz * fz) * Math.sign(pv.vf);
            const lat = dx * fz - dz * fx;
            if (along > -1 && Math.abs(lat) < 2.4) {
              const s = Math.sign(lat) || 1;
              p.fx = fz * s;
              p.fz = -fx * s;
              p.flee = 1.6;
              this.game.audio?._tone({ freq: 620, freq2: 480, dur: 0.22, gain: 0.03, type: 'triangle' });
            }
          }
        }
        p.t += speed * dt * (p.forward ? 1 : -1);
        if (p.t > p.link.length || p.t < 0) this._advance(p);
        this._sample(p);
      }
      p.v = speed;
      p.y = this.ground.height(p.x, p.z, p.y + 0.3, 0.6);
      if (speed > 0.1) p.heading = dampAngle(p.heading, Math.atan2(p.dx, p.dz), 8, dt);
      p.object.position.set(p.x, p.y, p.z);
      p.object.rotation.y = p.heading;
      p.character.locomotion(speed, dt, false);
      // Distant walkers animate at half rate.
      if (p.drawn && (d < 55 || (i + this._cursor) % 2 === 0)) p.character.update(d < 55 ? dt : dt * 2);
    }
    this._cursor++;
  }

  collect(x, z, range, out, pool) {
    for (const p of this.active) {
      if (!p.visible) continue;
      const dx = p.x - x;
      const dz = p.z - z;
      if (dx * dx + dz * dz > range * range) continue;
      const ob = pool();
      ob.x = p.x;
      ob.z = p.z;
      ob.y = p.y;
      ob.r = 0.35;
      ob.vx = 0;
      ob.vz = 0;
      ob.mass = 0.05;
      ob.ref = p;
      ob.onHit = (by, strength, nx, nz) => {
        p.fx = -nx;
        p.fz = -nz;
        p.flee = 2.2;
        void strength;
      };
      out.push(ob);
    }
  }
}
