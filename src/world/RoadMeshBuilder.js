// Turns the road graph into meshes: carriageways, sidewalks, medians, junction floors,
// painted markings, flyovers (ramps, decks, parapets, piers) and bridges over water.
// It also stamps everything into the surface map and registers the solid parts as colliders.

import * as THREE from 'three';
import { ChunkSet } from '../utils/ChunkSet.js';
import { SURF } from './SurfaceMap.js';
import { buildRoadMaterials } from './RoadTextures.js';
import { ROAD_CLASSES, FLYOVER_DECK_HALF, laneOffset } from './layout.js';
import { STOP_LINE_SETBACK } from './RoadNetwork.js';
import { clamp, lerp, smoothstep } from '../utils/math.js';

export const ROAD_Y = 0.03;
export const WALK_Y = 0.19;
export const MEDIAN_Y = 0.33;
const ISLAND_Y = 0.2;
const PARAPET_H = 1.05;
const PARAPET_T = 0.45;
const GIRDER = 1.5;
const EMBANK_H = 3.1;
const STEP = 3;

export function edgeFrames(edge, s0, s1, step = STEP) {
  const out = [];
  const n = Math.max(1, Math.ceil((s1 - s0) / step));
  for (let i = 0; i <= n; i++) {
    const f = edge.at(lerp(s0, s1, i / n));
    f.h = 0;
    f.k = 1;
    out.push(f);
  }
  return out;
}

/**
 * Sweep profile segments along frames. A segment is
 *   { a:[lat,y,abs?], b:[lat,y,abs?], n:[nLat,nY], mat, uv:'strip'|'metric', tile, taper }
 */
export function sweep(chunks, frames, segs, batch = 14) {
  if (frames.length < 2) return;
  for (let start = 0; start < frames.length - 1; start += batch) {
    const end = Math.min(frames.length - 1, start + batch);
    const mid = frames[(start + end) >> 1];
    for (const sg of segs) {
      const b = chunks.get(sg.mat, mid.x, mid.z, { uv2: true });
      const rows = [];
      const len = Math.hypot(sg.b[0] - sg.a[0], sg.b[1] - sg.a[1]);
      for (let i = start; i <= end; i++) {
        const f = frames[i];
        const k = sg.taper ? f.k : 1;
        const ya = sg.a[2] ? sg.a[1] : f.h + sg.a[1] * k;
        const yb = sg.b[2] ? sg.b[1] : f.h + sg.b[1] * k;
        const ax = f.x + f.nx * sg.a[0];
        const az = f.z + f.nz * sg.a[0];
        const bx = f.x + f.nx * sg.b[0];
        const bz = f.z + f.nz * sg.b[0];
        const nx = f.nx * sg.n[0];
        const ny = sg.n[1];
        const nz = f.nz * sg.n[0];
        let v = f.s / sg.tile;
        let vb = v;
        let ua = 0;
        let ub = 1;
        if (sg.uv === 'along') {
          // Texture runs along the road (painted kerb stones): u follows the road, v spans the face.
          ua = ub = f.s / sg.tile;
          v = 0;
          vb = 1;
        } else if (sg.uv === 'strip') {
          ua = sg.u0 ?? 0;
          ub = sg.u1 ?? 1;
        } else {
          ua = (sg.uOff ?? 0) / sg.tile;
          ub = ua + Math.max(len, Math.abs(yb - ya)) / sg.tile;
        }
        rows.push([
          [ax, ya, az, ua, v, nx, ny, nz],
          [bx, yb, bz, ub, vb, nx, ny, nz],
        ]);
      }
      b.ribbon(rows, [0, 1, 0], null, sg.n[1] > 0.5 || sg.n[1] < -0.5 ? 0.25 : 0);
    }
  }
}

export class RoadMeshBuilder {
  constructor({ assets, roads, surface, terrain, colliders, city }) {
    this.city = city;
    this.assets = assets;
    this.roads = roads;
    this.surface = surface;
    this.terrain = terrain;
    this.colliders = colliders;
    this.chunks = new ChunkSet(320);
    // Carriageway surfaces keep their own high-resolution materials; kerbs, footpaths,
    // parapets and piers are drawn into the shared city material.
    const shared = { concrete: 'rdConcrete', concreteDark: 'rdConcreteDark', medianTop: 'rdMedian', pavers: 'pavers', plaza: 'rdPlaza', kerb: 'rdKerb', kerbWhite: 'rdKerbWhite' };
    this.out = {
      get: (mat, x, z, opts) => (shared[mat] ? this.city.use(shared[mat], x, z) : this.chunks.get(mat, x, z, opts)),
    };
    this.group = new THREE.Group();
    this.group.name = 'roads';
    this.piers = [];
    this.bridgeRuns = [];
  }

  build() {
    const a = this.assets;
    const rm = buildRoadMaterials(a);
    this.decals = rm.decals;
    this.materials = {
      road_highway: rm.highway.material,
      road_arterial: rm.arterial.material,
      road_street: rm.street.material,
      road_plain: rm.plain.material,
      deck: rm.deck.material,
      decals: rm.decals.material,
    };
    this.roadTex = rm;

    for (const e of this.roads.edges) this._edge(e);
    for (const node of this.roads.junctions) this._junction(node);
    for (const f of this.roads.flyovers) this._flyover(f);
    for (const e of this.roads.edges) this._bridges(e);

    const flags = {
      road_highway: { cast: false },
      road_arterial: { cast: false },
      road_street: { cast: false },
      road_plain: { cast: false },
      deck: { cast: false },
      decals: { cast: false, renderOrder: 2 },
    };
    this.chunks.build(this.group, this.materials, flags);
    return this.group;
  }

  // ------------------------------------------------------------------ plain road sections
  _edge(e) {
    const s0 = e.trim[0];
    const s1 = e.length - e.trim[1];
    if (s1 - s0 < 2) return;
    const frames = edgeFrames(e, s0, s1);
    const half = e.half;
    const tex = this.roadTex[e.cls];
    sweep(this.out, frames, [{ a: [half, ROAD_Y, 1], b: [-half, ROAD_Y, 1], n: [0, 1], mat: `road_${e.cls}`, uv: 'strip', tile: tex.length }]);
    this._rasterStrip(frames, -half, half, SURF.ROAD);
    this._rasterStrip(frames, -half - e.walk - 5, -half - e.walk, SURF.VERGE, [SURF.ROAD, SURF.SIDEWALK, SURF.MEDIAN, SURF.PAVED, SURF.RESERVED]);
    this._rasterStrip(frames, half + e.walk, half + e.walk + 5, SURF.VERGE, [SURF.ROAD, SURF.SIDEWALK, SURF.MEDIAN, SURF.PAVED, SURF.RESERVED]);

    // Sidewalks on both sides.
    for (const side of [1, -1]) {
      const k0 = side * half;
      const k1 = side * (half + 0.2);
      const o = side * (half + e.walk);
      sweep(this.out, frames, [
        { a: [k0, ROAD_Y, 1], b: [k0, WALK_Y, 1], n: [-side, 0], mat: 'kerbWhite', uv: 'along', tile: 4 },
        { a: [k0, WALK_Y, 1], b: [k1, WALK_Y, 1], n: [0, 1], mat: 'concrete', uv: 'metric', tile: 3 },
        { a: [k1, WALK_Y, 1], b: [o, WALK_Y, 1], n: [0, 1], mat: 'pavers', uv: 'metric', tile: 2.4 },
        { a: [o, WALK_Y, 1], b: [o, -0.6, 1], n: [side, 0], mat: 'concrete', uv: 'metric', tile: 3 },
      ]);
      this._rasterStrip(frames, Math.min(k0, o), Math.max(k0, o), SURF.SIDEWALK);
    }

    // Median (not under flyover ramps - those own the centre of the road).
    const spec = e.spec;
    if (spec.median > 0) {
      const m0 = Math.max(s0, e.fly[0] ? e.fly[0].half + 1.5 : s0 + 1);
      const m1 = Math.min(s1, e.fly[1] ? e.length - e.fly[1].half - 1.5 : s1 - 1);
      if (m1 - m0 > 6) {
        const mf = edgeFrames(e, m0, m1);
        const m = spec.median / 2;
        sweep(this.out, mf, [
          { a: [m, ROAD_Y, 1], b: [m, MEDIAN_Y, 1], n: [1, 0], mat: 'kerb', uv: 'along', tile: 4 },
          { a: [m, MEDIAN_Y, 1], b: [-m, MEDIAN_Y, 1], n: [0, 1], mat: 'medianTop', uv: 'metric', tile: 3 },
          { a: [-m, MEDIAN_Y, 1], b: [-m, ROAD_Y, 1], n: [-1, 0], mat: 'kerb', uv: 'along', tile: 4 },
        ]);
        this._cap(mf[0], m, MEDIAN_Y, -1);
        this._cap(mf[mf.length - 1], m, MEDIAN_Y, 1);
        this._rasterStrip(mf, -m, m, SURF.MEDIAN);
        e.medianRange = [m0, m1];
      }
    }
  }

  _cap(f, halfWidth, y, dir) {
    const b = this.out.get('kerb', f.x, f.z, { uv2: true });
    const ax = f.x + f.nx * halfWidth;
    const az = f.z + f.nz * halfWidth;
    const bx = f.x - f.nx * halfWidth;
    const bz = f.z - f.nz * halfWidth;
    b.quad([ax, ROAD_Y, az], [bx, ROAD_Y, bz], [bx, y, bz], [ax, y, az], [[0, 0], [0.25, 0], [0.25, 1], [0, 1]], [f.tx * dir, 0, f.tz * dir]);
  }

  _rasterStrip(frames, latA, latB, type, keep = null) {
    const s = this.surface;
    for (let i = 0; i < frames.length - 1; i++) {
      const f = frames[i];
      const g = frames[i + 1];
      s.quad(
        [f.x + f.nx * latA, f.z + f.nz * latA],
        [f.x + f.nx * latB, f.z + f.nz * latB],
        [g.x + g.nx * latB, g.z + g.nz * latB],
        [g.x + g.nx * latA, g.z + g.nz * latA],
        type,
        keep,
      );
    }
  }

  // ------------------------------------------------------------------------- junctions
  _junction(node) {
    const floor = this.out.get('road_plain', node.x, node.z, { uv2: true });
    floor.polygon(node.outline, ROAD_Y, 1 / 18, true, null, [node.x, node.z]);
    // uv2 for the polygon is world * 1/18 too; good enough for the normal map.
    const out = node.outline;
    for (let i = 0; i < out.length; i++) {
      const a = out[i];
      const b = out[(i + 1) % out.length];
      this.surface.tri(node.x, node.z, a[0], a[1], b[0], b[1], SURF.ROAD);
    }
    for (const c of node.corners) {
      const n = c.kerb.length;
      const top = this.out.get('pavers', node.x, node.z, { uv2: true });
      const kerb = this.out.get('kerbWhite', node.x, node.z, { uv2: true });
      const back = this.out.get('concrete', node.x, node.z, { uv2: true });
      const rowsTop = [];
      const rowsKerb = [];
      const rowsBack = [];
      let run = 0;
      for (let i = 0; i < n; i++) {
        const k = c.kerb[i];
        const o = c.outer[i];
        if (i > 0) run += Math.hypot(k.x - c.kerb[i - 1].x, k.z - c.kerb[i - 1].z);
        // Kerb normal points toward the junction centre.
        let nx = node.x - k.x;
        let nz = node.z - k.z;
        const l = Math.hypot(nx, nz) || 1;
        nx /= l;
        nz /= l;
        rowsTop.push([
          [k.x, WALK_Y, k.z, k.x / 2.4, k.z / 2.4],
          [o.x, WALK_Y, o.z, o.x / 2.4, o.z / 2.4],
        ]);
        rowsKerb.push([
          [k.x, ROAD_Y, k.z, run / 4, 0, nx, 0, nz],
          [k.x, WALK_Y, k.z, run / 4, 1, nx, 0, nz],
        ]);
        rowsBack.push([
          [o.x, WALK_Y, o.z, 0, run / 3, -nx, 0, -nz],
          [o.x, -0.6, o.z, 0.3, run / 3, -nx, 0, -nz],
        ]);
        if (i > 0) {
          const pk = c.kerb[i - 1];
          const po = c.outer[i - 1];
          this.surface.quad([pk.x, pk.z], [po.x, po.z], [o.x, o.z], [k.x, k.z], SURF.SIDEWALK);
        }
      }
      top.ribbon(rowsTop, [0, 1, 0], null, 0.25);
      kerb.ribbon(rowsKerb, [0, 1, 0], null, 0);
      back.ribbon(rowsBack, [0, 1, 0], null, 0);
    }
    if (node.arms.length >= 3) {
      for (const arm of node.arms) this._armMarkings(node, arm);
    }
  }

  _decalQuad(cx, cz, tx, tz, halfAcross, halfAlong, uv, y = ROAD_Y + 0.012) {
    // `t` is the direction the decal's "up" (v axis) points along.
    const rx = -tz;
    const rz = tx;
    const b = this.out.get('decals', cx, cz, { uv2: true });
    const p = (a, l) => [cx + rx * a + tx * l, y, cz + rz * a + tz * l];
    b.quad(
      p(-halfAcross, -halfAlong),
      p(halfAcross, -halfAlong),
      p(halfAcross, halfAlong),
      p(-halfAcross, halfAlong),
      [
        [uv.u0, uv.v0],
        [uv.u1, uv.v0],
        [uv.u1, uv.v1],
        [uv.u0, uv.v1],
      ],
      [0, 1, 0],
    );
  }

  _armMarkings(node, arm) {
    const e = arm.edge;
    const spec = e.spec;
    const d = this.decals;
    const roads = this.roads;
    // Zebra crossing.
    const fz = roads.armFrame(arm, arm.trim + 2.4);
    const m = spec.median / 2;
    for (let a = -arm.half + 0.5; a <= arm.half - 0.5; a += 1.0) {
      if (Math.abs(a) < m + 0.2) continue;
      if (arm.edge.fly[arm.end] && Math.abs(a) < FLYOVER_DECK_HALF + 0.3) continue;
      this._decalQuad(fz.x + fz.rx * a, fz.z + fz.rz * a, fz.tx, fz.tz, 0.27, 1.6, d.zebra);
    }
    // Stop line across the approaching carriageway (the arm's right-hand side looking outward).
    const fs = roads.armFrame(arm, arm.trim + STOP_LINE_SETBACK);
    const inner = arm.edge.fly[arm.end] ? FLYOVER_DECK_HALF + 0.6 : m + 0.1;
    const outer = arm.half - spec.shoulder;
    const mid = (inner + outer) / 2;
    this._decalQuad(fs.x + fs.rx * mid, fs.z + fs.rz * mid, fs.tx, fs.tz, (outer - inner) / 2, 0.22, d.stop);
    // Lane arrows pointing at the junction.
    const fa = roads.armFrame(arm, arm.trim + STOP_LINE_SETBACK + 9);
    const lanes = [];
    for (let i = 0; i < spec.lanes; i++) {
      const isInner = spec.separatorAfter > 0 && i < spec.separatorAfter;
      if (isInner && arm.edge.fly[arm.end]) continue;
      lanes.push(i);
    }
    lanes.forEach((i, k) => {
      const off = laneOffset(e.cls, i);
      let kind = 'S';
      if (k === lanes.length - 1 && lanes.length > 1) kind = 'SL';
      if (lanes.length === 1) kind = 'SL';
      this._decalQuad(fa.x + fa.rx * off, fa.z + fa.rz * off, -fa.tx, -fa.tz, 0.62, 2.3, d.arrows[kind]);
    });
  }

  // -------------------------------------------------------------------------- flyovers
  _flyover(f) {
    const half = f.deckHalf;
    const inner = half - PARAPET_T;
    const frames = f.samples.map((s) => ({
      x: s.x,
      z: s.z,
      nx: s.nx,
      nz: s.nz,
      tx: s.tx,
      tz: s.tz,
      s: s.d + f.half,
      d: s.d,
      h: s.h,
      k: smoothstep(0, 7, f.half - Math.abs(s.d)),
    }));
    const tex = this.roadTex.deck;
    // Deck surface. The ramp foot dips slightly below the road so it blends in.
    sweep(this.out, frames.map((fr) => ({ ...fr, h: fr.h + ROAD_Y + 0.012 })), [{ a: [inner, 0], b: [-inner, 0], n: [0, 1], mat: 'deck', uv: 'strip', tile: tex.length }]);

    // Split into solid embankment runs and elevated runs.
    const runs = [];
    let cur = null;
    frames.forEach((fr, i) => {
      const solid = fr.h < EMBANK_H;
      if (!cur || cur.solid !== solid) {
        if (cur) cur.frames.push(fr); // share the boundary row
        cur = { solid, frames: [fr], start: i };
        runs.push(cur);
      } else cur.frames.push(fr);
    });

    for (const run of runs) {
      const fr = run.frames;
      if (fr.length < 2) continue;
      for (const side of [1, -1]) {
        const a = side * inner;
        const b = side * half;
        const segs = [
          { a: [a, 0], b: [a, PARAPET_H], n: [-side, 0], mat: 'concrete', uv: 'metric', tile: 3, taper: true },
          { a: [a, PARAPET_H], b: [b, PARAPET_H], n: [0, 1], mat: 'concrete', uv: 'metric', tile: 3, taper: true },
        ];
        sweep(this.out, fr, segs);
        // Outer face: parapet + girder fascia, or the retaining wall down to the ground.
        const rows = [];
        const builder = this.out.get(run.solid ? 'concreteDark' : 'concrete', fr[fr.length >> 1].x, fr[fr.length >> 1].z, { uv2: true });
        for (const q of fr) {
          const top = q.h + PARAPET_H * q.k;
          const bottom = run.solid ? -0.6 : q.h - GIRDER;
          const x = q.x + q.nx * b;
          const z = q.z + q.nz * b;
          rows.push([
            [x, top, z, q.s / 3, top / 3, q.nx * side, 0, q.nz * side],
            [x, bottom, z, q.s / 3, bottom / 3, q.nx * side, 0, q.nz * side],
          ]);
        }
        builder.ribbon(rows, [0, 1, 0], null, 0);
      }
      if (!run.solid) {
        sweep(this.out, fr, [{ a: [half, -GIRDER], b: [-half, -GIRDER], n: [0, -1], mat: 'concreteDark', uv: 'metric', tile: 3 }]);
      }
    }

    // Abutment walls where the embankment ends.
    for (let r = 0; r < runs.length - 1; r++) {
      const q = runs[r + 1].frames[0];
      const facing = runs[r].solid ? 1 : -1; // wall faces the open side
      const b = this.out.get('concreteDark', q.x, q.z, { uv2: true });
      const lx = q.x + q.nx * half;
      const lz = q.z + q.nz * half;
      const rx = q.x - q.nx * half;
      const rz = q.z - q.nz * half;
      const top = q.h - GIRDER + 0.05;
      b.quad([lx, -0.4, lz], [rx, -0.4, rz], [rx, top, rz], [lx, top, lz], [[0, 0], [half * 2 / 3, 0], [half * 2 / 3, top / 3], [0, top / 3]], [q.tx * facing, 0, q.tz * facing]);
      this.colliders.addWall(lx, lz, rx, rz, 0.6, -2, top, 'abutment');
    }

    // Centre divider on the deck.
    sweep(this.out, frames, [
      { a: [0.28, 0], b: [0.2, 0.75], n: [1, 0.1], mat: 'concrete', uv: 'metric', tile: 3, taper: true },
      { a: [0.2, 0.75], b: [-0.2, 0.75], n: [0, 1], mat: 'concrete', uv: 'metric', tile: 3, taper: true },
      { a: [-0.2, 0.75], b: [-0.28, 0], n: [-1, 0.1], mat: 'concrete', uv: 'metric', tile: 3, taper: true },
    ]);

    // Colliders for parapets and the divider.
    for (let i = 0; i < frames.length - 1; i++) {
      const p = frames[i];
      const q = frames[i + 1];
      const hMin = Math.min(p.h, q.h);
      const hMax = Math.max(p.h, q.h);
      const solid = hMin < EMBANK_H;
      for (const side of [1, -1]) {
        const lat = side * (half - PARAPET_T / 2);
        const c = this.colliders.addWall(p.x + p.nx * lat, p.z + p.nz * lat, q.x + q.nx * lat, q.z + q.nz * lat, PARAPET_T, solid ? -2 : hMin - GIRDER, hMax + PARAPET_H + 0.4, 'parapet');
        if (c && !solid) c.noCamera = hMin > 4;
      }
      if (Math.min(p.k, q.k) > 0.5) {
        const c = this.colliders.addWall(p.x, p.z, q.x, q.z, 0.5, hMin - 0.2, hMax + 0.8, 'divider');
        if (c) c.noCamera = true;
      }
    }

    // Piers and the paved island under the deck.
    const node = f.node;
    const armTrim = Math.max(...node.arms.filter((a) => a.edge === f.e0 || a.edge === f.e1).map((a) => a.trim));
    let cross = 10;
    for (const a of node.arms) if (a.edge !== f.e0 && a.edge !== f.e1) cross = Math.max(cross, a.half + 2.5);
    const dEmb = this._embankEnd(f);
    const pierAt = [];
    for (const sgn of [-1, 1]) {
      for (let d = cross + 2; d < dEmb - 6; d += 27) pierAt.push(sgn * d);
    }
    for (const d of pierAt) this._pier(f, d);
    f.pierD = pierAt;
    f.embankEnd = dEmb;

    for (const sgn of [-1, 1]) {
      const from = armTrim + 0.5;
      const to = dEmb - 0.6;
      if (to - from < 4) continue;
      const fr = frames.filter((q) => q.d * sgn >= from && q.d * sgn <= to).map((q) => ({ ...q, h: 0 }));
      if (fr.length < 2) continue;
      const w = half - 0.6;
      sweep(this.out, fr, [
        { a: [w, ROAD_Y, 1], b: [w, ISLAND_Y, 1], n: [1, 0], mat: 'kerb', uv: 'along', tile: 4 },
        { a: [w, ISLAND_Y, 1], b: [-w, ISLAND_Y, 1], n: [0, 1], mat: 'plaza', uv: 'metric', tile: 3 },
        { a: [-w, ISLAND_Y, 1], b: [-w, ROAD_Y, 1], n: [-1, 0], mat: 'kerb', uv: 'along', tile: 4 },
      ]);
      const endRow = sgn > 0 ? fr[0] : fr[fr.length - 1];
      this._cap(endRow, w, ISLAND_Y, sgn > 0 ? -1 : 1);
      this._rasterStrip(fr, -w, w, SURF.PAVED);
    }
    // Everything under the solid ramps is not usable ground.
    const solidFrames = frames.filter((q) => Math.abs(q.d) >= dEmb - 1);
    const left = solidFrames.filter((q) => q.d < 0);
    const right = solidFrames.filter((q) => q.d > 0);
    this._rasterStrip(left, -half, half, SURF.MEDIAN);
    this._rasterStrip(right, -half, half, SURF.MEDIAN);
  }

  _embankEnd(f) {
    // Distance from the node at which the deck drops below the embankment height.
    for (let d = f.flat; d < f.half; d += 0.5) if (f.profile(d) < EMBANK_H) return d;
    return f.half;
  }

  _frameAt(f, d) {
    const t = clamp((d + f.half) / (f.half * 2), 0, 1) * (f.samples.length - 1);
    const i = Math.min(f.samples.length - 2, Math.floor(t));
    const u = t - i;
    const a = f.samples[i];
    const b = f.samples[i + 1];
    return {
      x: lerp(a.x, b.x, u),
      z: lerp(a.z, b.z, u),
      tx: a.tx,
      tz: a.tz,
      nx: a.nx,
      nz: a.nz,
      h: lerp(a.h, b.h, u),
      d,
    };
  }

  _pier(f, d) {
    const q = this._frameAt(f, d);
    const rot = Math.atan2(q.nz, q.nx); // local X runs across the deck
    const top = q.h - GIRDER;
    const capH = 1.7;
    const colH = top - capH;
    const b = this.out.get('concrete', q.x, q.z, { uv2: true });
    b.box(q.x, colH / 2, q.z, 2.6, colH, 1.7, rot, { uvScale: 1 / 3, faces: 'xXzZ' });
    // Hammerhead cap: trapezoid widening toward the deck.
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const P = (lx, y, lz) => [q.x + lx * c - lz * s, y, q.z + lx * s + lz * c];
    const w0 = 1.5;
    const w1 = f.deckHalf - 1.0;
    const t = 1.0;
    const uv = [[0, 0], [1, 0], [1, 0.5], [0, 0.5]];
    b.quad(P(-w0, colH, t), P(w0, colH, t), P(w1, top, t), P(-w1, top, t), uv, [-s, 0, c]);
    b.quad(P(w0, colH, -t), P(-w0, colH, -t), P(-w1, top, -t), P(w1, top, -t), uv, [s, 0, -c]);
    b.quad(P(w0, colH, t), P(w0, colH, -t), P(w1, top, -t), P(w1, top, t), uv, [c, -0.5, s]);
    b.quad(P(-w0, colH, -t), P(-w0, colH, t), P(-w1, top, t), P(-w1, top, -t), uv, [-c, -0.5, -s]);
    // Hazard stripes painted around the base.
    const k = this.out.get('kerb', q.x, q.z, { uv2: true });
    k.box(q.x, 0.75, q.z, 2.66, 1.1, 1.76, rot, { uvScale: 1 / 4, faces: 'xXzZ' });
    this.colliders.addBox(q.x, q.z, 1.3, 0.85, rot, -2, top, 'pier');
    this.piers.push({ x: q.x, z: q.z, rot, top, flyover: f.id });
  }

  // --------------------------------------------------------------------------- bridges
  _bridges(e) {
    const s0 = e.trim[0];
    const s1 = e.length - e.trim[1];
    const frames = edgeFrames(e, s0, s1);
    let run = null;
    const runs = [];
    for (const f of frames) {
      const over = this.terrain.waterDistance(f.x, f.z) < 5;
      if (over) {
        if (!run) {
          run = [];
          runs.push(run);
        }
        run.push(f);
      } else run = null;
    }
    const out = e.half + e.walk;
    for (const fr of runs) {
      if (fr.length < 3) continue;
      const len = fr[fr.length - 1].s - fr[0].s;
      this.bridgeRuns.push({ edge: e, from: fr[0].s, to: fr[fr.length - 1].s });
      for (const side of [1, -1]) {
        const o = side * out;
        const i = side * (out - 0.32);
        sweep(this.out, fr, [
          { a: [i, WALK_Y, 1], b: [i, WALK_Y + 1.0, 1], n: [-side, 0], mat: 'concrete', uv: 'metric', tile: 3 },
          { a: [i, WALK_Y + 1.0, 1], b: [o, WALK_Y + 1.0, 1], n: [0, 1], mat: 'concrete', uv: 'metric', tile: 3 },
          { a: [o, WALK_Y + 1.0, 1], b: [o, -1.5, 1], n: [side, 0], mat: 'concrete', uv: 'metric', tile: 3 },
        ]);
        for (let k = 0; k < fr.length - 1; k++) {
          const p = fr[k];
          const q = fr[k + 1];
          const lat = side * (out - 0.16);
          const c = this.colliders.addWall(p.x + p.nx * lat, p.z + p.nz * lat, q.x + q.nx * lat, q.z + q.nz * lat, 0.34, -3, WALK_Y + 1.15, 'railing');
          if (c) c.noCamera = true;
        }
      }
      sweep(this.out, fr, [{ a: [out, -1.5, 1], b: [-out, -1.5, 1], n: [0, -1], mat: 'concreteDark', uv: 'metric', tile: 3 }]);
      // Piers standing in the water.
      const count = Math.max(1, Math.round(len / 20));
      for (let k = 0; k < count; k++) {
        const f = e.at(lerp(fr[0].s, fr[fr.length - 1].s, (k + 0.5) / count));
        if (this.terrain.waterDistance(f.x, f.z) > -2) continue;
        const rot = Math.atan2(f.nz, f.nx);
        const b = this.out.get('concreteDark', f.x, f.z, { uv2: true });
        b.box(f.x, -3.2, f.z, out * 2 - 2, 3.6, 1.4, rot, { uvScale: 1 / 3, faces: 'xXzZ' });
      }
    }
  }
}
