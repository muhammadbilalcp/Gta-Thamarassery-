// Kochi Metro: elevated viaduct on single piers (portal frames where it has to straddle a
// carriageway), stations with vaulted roofs and bilingual name boards, and turquoise
// three-car trains that run the line and call at every station.

import * as THREE from 'three';
import { MeshBuilder } from '../utils/MeshBuilder.js';
import { sweep } from './RoadMeshBuilder.js';
import { SURF } from './SurfaceMap.js';
import { METRO } from './layout.js';
import { smoothPolyline, clamp, lerp } from '../utils/math.js';

const H = METRO.railHeight;
const DECK = METRO.deckHalf;
const TRACK = 2.05; // track centre offset from the viaduct centreline
const STATION_LEN = 64;
const CAR_LEN = 19.5;
const CAR_GAP = 0.7;

export class Metro {
  constructor(world) {
    this.world = world;
    this.assets = world.assets;
    this.roads = world.roads;
    this.surface = world.surface;
    this.colliders = world.colliders;
    const shared = { concrete: 'rdConcrete', concreteDark: 'rdConcreteDark', steel: 'steel', rail: 'rail', teal: 'teal', cream: 'cream', roof: 'roofSteel', glass: 'glassWall', platform: 'rdPlaza' };
    // Everything static is drawn into the shared city material.
    this.chunks = { get: (mat, x, z) => world.city.use(shared[mat], x, z) };
    this.group = new THREE.Group();
    this.group.name = 'metro';
    this.lines = [];
    this.trains = [];
    this._plan();
  }

  // ------------------------------------------------------------------------ alignment
  _plan() {
    for (const def of METRO.lines) {
      const ctrl = [];
      for (const piece of def.pieces) {
        if (piece.pts) {
          for (const p of piece.pts) ctrl.push([p[0], p[1]]);
          continue;
        }
        const e = this.roads.edgeById[piece.edge];
        const from = piece.from ?? 0;
        const to = piece.to ?? e.length;
        const off = (piece.offset ?? 0) * (piece.side ?? 1);
        const n = Math.max(2, Math.ceil(Math.abs(to - from) / 9));
        const list = [];
        for (let i = 0; i <= n; i++) {
          const f = e.at(lerp(from, to, i / n));
          list.push([f.x + f.nx * off, f.z + f.nz * off]);
        }
        if (piece.dir < 0) list.reverse();
        for (const p of list) ctrl.push(p);
      }
      // Drop points that double back on themselves where pieces meet.
      const clean = [ctrl[0]];
      for (let i = 1; i < ctrl.length; i++) {
        const a = clean[clean.length - 1];
        if (Math.hypot(ctrl[i][0] - a[0], ctrl[i][1] - a[1]) > 5) clean.push(ctrl[i]);
      }
      const pts = smoothPolyline(clean, 3);
      const path = [];
      let s = 0;
      for (let i = 0; i < pts.length; i++) {
        if (i > 0) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        path.push({ x: pts[i][0], z: pts[i][1], s, h: H });
      }
      for (let i = 0; i < path.length; i++) {
        const a = path[Math.max(0, i - 1)];
        const b = path[Math.min(path.length - 1, i + 1)];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const l = Math.hypot(dx, dz) || 1;
        path[i].tx = dx / l;
        path[i].tz = dz / l;
        path[i].nx = dz / l;
        path[i].nz = -dx / l;
        path[i].k = 1;
      }
      const line = { id: def.id, path, length: s, stations: [] };
      for (const st of def.stations) {
        let best = 0;
        let bd = Infinity;
        path.forEach((p, i) => {
          const d = Math.hypot(p.x - st.near[0], p.z - st.near[1]);
          if (d < bd) {
            bd = d;
            best = i;
          }
        });
        const p = path[best];
        line.stations.push({ ...st, index: best, s: p.s, x: p.x, z: p.z, tx: p.tx, tz: p.tz, nx: p.nx, nz: p.nz });
      }
      line.stations.sort((a, b) => a.s - b.s);
      this.lines.push(line);
    }
  }

  at(line, s, out = {}) {
    const path = line.path;
    s = clamp(s, 0, line.length);
    let i = Math.min(path.length - 2, Math.floor((s / line.length) * (path.length - 1)));
    while (i > 0 && path[i].s > s) i--;
    while (i < path.length - 2 && path[i + 1].s < s) i++;
    const a = path[i];
    const b = path[i + 1];
    const t = clamp((s - a.s) / (b.s - a.s || 1), 0, 1);
    out.x = lerp(a.x, b.x, t);
    out.z = lerp(a.z, b.z, t);
    out.tx = lerp(a.tx, b.tx, t);
    out.tz = lerp(a.tz, b.tz, t);
    out.nx = out.tz;
    out.nz = -out.tx;
    out.h = H;
    return out;
  }

  /** Reserve the ground under the viaduct so the city keeps clear of it. */
  reserve() {
    const keep = [SURF.ROAD, SURF.SIDEWALK, SURF.MEDIAN, SURF.PAVED];
    for (const line of this.lines) {
      const p = line.path;
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i];
        const b = p[i + 1];
        const w = 6.5;
        this.surface.quad([a.x + a.nx * w, a.z + a.nz * w], [a.x - a.nx * w, a.z - a.nz * w], [b.x - b.nx * w, b.z - b.nz * w], [b.x + b.nx * w, b.z + b.nz * w], SURF.RESERVED, keep);
      }
      for (const st of line.stations) {
        const rot = Math.atan2(st.tz, st.tx);
        this.surface.rect(st.x, st.z, STATION_LEN / 2 + 4, 15, rot, SURF.RESERVED, keep);
      }
    }
  }

  // ------------------------------------------------------------------------- geometry
  build() {
    for (const line of this.lines) {
      this._viaduct(line);
      this._piers(line);
      for (const st of line.stations) this._station(line, st);
    }
    this._trains();
    return this.group;
  }

  _viaduct(line) {
    const frames = line.path;
    const segs = [{ a: [3.0, -1.95], b: [-3.0, -1.95], n: [0, -1], mat: 'concreteDark', uv: 'metric', tile: 3 }];
    for (const s of [1, -1]) {
      segs.push(
        { a: [s * 3.0, -1.95], b: [s * DECK, -0.65], n: [s * 0.62, -0.78], mat: 'concrete', uv: 'metric', tile: 3 },
        { a: [s * DECK, -0.65], b: [s * DECK, 1.0], n: [s, 0], mat: 'concrete', uv: 'metric', tile: 3 },
        { a: [s * DECK, 1.0], b: [s * (DECK - 0.22), 1.0], n: [0, 1], mat: 'concrete', uv: 'metric', tile: 3 },
        { a: [s * (DECK - 0.22), 1.0], b: [s * (DECK - 0.22), -0.28], n: [-s, 0], mat: 'concrete', uv: 'metric', tile: 3 },
      );
      // Rails.
      for (const r of [TRACK - 0.72, TRACK + 0.72]) {
        segs.push({ a: [s * r + 0.04, 0], b: [s * r - 0.04, 0], n: [0, 1], mat: 'rail', uv: 'metric', tile: 3 });
        segs.push({ a: [s * r + 0.04, 0], b: [s * r + 0.04, -0.28], n: [1, 0], mat: 'rail', uv: 'metric', tile: 3 });
        segs.push({ a: [s * r - 0.04, 0], b: [s * r - 0.04, -0.28], n: [-1, 0], mat: 'rail', uv: 'metric', tile: 3 });
      }
    }
    segs.push({ a: [DECK - 0.22, -0.28], b: [-DECK + 0.22, -0.28], n: [0, 1], mat: 'concreteDark', uv: 'metric', tile: 3 });
    // Teal band along the parapet - the line's colour.
    for (const s of [1, -1]) segs.push({ a: [s * (DECK + 0.012), 0.72], b: [s * (DECK + 0.012), 0.5], n: [s, 0], mat: 'teal', uv: 'metric', tile: 3 });
    sweep(this.chunks, frames, segs, 16);
  }

  _pierAt(line, s) {
    const f = this.at(line, s, {});
    const type = this.surface.typeAt(f.x, f.z);
    const rot = Math.atan2(f.nz, f.nx);
    const top = H - 1.95;
    if (type !== SURF.ROAD) {
      this._column(f.x, f.z, rot, top, true);
      return;
    }
    // On the carriageway: straddle it with a portal frame.
    const find = (dir) => {
      for (let d = 2; d <= 26; d += 0.75) {
        const x = f.x + f.nx * d * dir;
        const z = f.z + f.nz * d * dir;
        const t = this.surface.typeAt(x, z);
        if (t !== SURF.ROAD) return d * dir + dir * 0.9;
      }
      return null;
    };
    const l = find(1);
    const r = find(-1);
    if (l === null || r === null) return;
    const b = this.chunks.get('concrete', f.x, f.z);
    for (const d of [l, r]) this._column(f.x + f.nx * d, f.z + f.nz * d, rot, top - 1.5, false);
    const mid = (l + r) / 2;
    b.box(f.x + f.nx * mid, top - 0.75, f.z + f.nz * mid, Math.abs(l - r) + 2.2, 1.5, 2.4, rot, { uvScale: 1 / 3, faces: 'xXzZYy' });
  }

  _column(x, z, rot, top, flare) {
    const b = this.chunks.get('concrete', x, z);
    const capH = flare ? 2.4 : 0;
    const colH = top - capH;
    // Octagonal shaft reads rounder than a box.
    b.cylinder(x, -0.4, z, 1.05, 1.0, colH + 0.4, 10, { cap: false, uvScale: 1 / 3 });
    if (flare) {
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      const P = (lx, y, lz) => [x + lx * c - lz * s, y, z + lx * s + lz * c];
      const w0 = 1.0;
      const w1 = 3.1;
      const t = 1.1;
      const uv = [[0, 0], [1, 0], [1, 0.6], [0, 0.6]];
      b.quad(P(-w0, colH, t), P(w0, colH, t), P(w1, top, t), P(-w1, top, t), uv, [-s, 0, c]);
      b.quad(P(w0, colH, -t), P(-w0, colH, -t), P(-w1, top, -t), P(w1, top, -t), uv, [s, 0, -c]);
      b.quad(P(w0, colH, t), P(w0, colH, -t), P(w1, top, -t), P(w1, top, t), uv, [c, -0.6, s]);
      b.quad(P(-w0, colH, -t), P(-w0, colH, t), P(-w1, top, t), P(-w1, top, -t), uv, [-c, -0.6, -s]);
    }
    const k = this.chunks.get('teal', x, z);
    k.cylinder(x, 1.55, z, 1.07, 1.07, 0.22, 10, { cap: false });
    this.colliders.addCircle(x, z, 1.1, -2, top, 'metro-pier');
    this.surface.circle(x, z, 1.4, SURF.MEDIAN, [SURF.ROAD]);
  }

  _piers(line) {
    const spacing = METRO.pillarSpacing;
    const inStation = (s) => line.stations.some((st) => Math.abs(st.s - s) < STATION_LEN / 2 + 2);
    for (let s = spacing / 2; s < line.length; s += spacing) {
      if (inStation(s)) continue;
      // Inside a junction the single pier would stand in the turning traffic: slide it out.
      let ps = s;
      const f = this.at(line, ps, {});
      for (const node of this.roads.junctions) {
        if (node.arms.length < 3) continue;
        const d = Math.hypot(f.x - node.x, f.z - node.z);
        if (d < node.radius - 4) {
          const before = this.at(line, ps - 3, {});
          const closer = Math.hypot(before.x - node.x, before.z - node.z) < d;
          ps += (closer ? 1 : -1) * (node.radius - 4 - d + 1);
        }
      }
      this._pierAt(line, clamp(ps, 2, line.length - 2));
    }
  }

  // ------------------------------------------------------------------------- stations
  _station(line, st) {
    const L = STATION_LEN;
    const frames = line.path.filter((p) => Math.abs(p.s - st.s) <= L / 2);
    if (frames.length < 3) return;
    const W = 9.4; // half width at platform level
    const roofLow = 4.3;
    const roofHigh = 6.6;
    // Platforms either side of the tracks.
    const segs = [];
    for (const s of [1, -1]) {
      segs.push(
        { a: [s * 3.9, 0.95], b: [s * W, 0.95], n: [0, 1], mat: 'platform', uv: 'metric', tile: 3 },
        { a: [s * 3.9, 0.95], b: [s * 3.9, -0.28], n: [-s, 0], mat: 'concreteDark', uv: 'metric', tile: 3 },
        { a: [s * 3.95, 0.96], b: [s * 4.35, 0.96], n: [0, 1], mat: 'teal', uv: 'metric', tile: 3 },
        { a: [s * W, -2.4], b: [s * W, 2.3], n: [s, 0], mat: 'cream', uv: 'metric', tile: 3 },
        { a: [s * W, 2.3], b: [s * W, 2.3 + 0.001], n: [s, 0], mat: 'cream', uv: 'metric', tile: 3 },
        { a: [s * (W - 0.2), 2.3], b: [s * (W - 0.2), 0.95], n: [-s, 0], mat: 'cream', uv: 'metric', tile: 3 },
        { a: [s * (W + 0.02), 1.7], b: [s * (W + 0.02), 1.35], n: [s, 0], mat: 'teal', uv: 'metric', tile: 3 },
      );
    }
    segs.push({ a: [W, -2.4], b: [-W, -2.4], n: [0, -1], mat: 'concreteDark', uv: 'metric', tile: 3 });
    // Vaulted metal roof in facets.
    const facets = 8;
    for (let i = 0; i < facets; i++) {
      const t0 = i / facets;
      const t1 = (i + 1) / facets;
      const x0 = lerp(-W - 0.9, W + 0.9, t0);
      const x1 = lerp(-W - 0.9, W + 0.9, t1);
      const y0 = roofLow + (roofHigh - roofLow) * Math.sin(Math.PI * t0) ** 0.8;
      const y1 = roofLow + (roofHigh - roofLow) * Math.sin(Math.PI * t1) ** 0.8;
      segs.push({ a: [x1, y1], b: [x0, y0], n: [(x0 + x1) / 40, 1], mat: 'roof', uv: 'metric', tile: 2.5, uOff: i * 2.5 });
      segs.push({ a: [x1, y1 - 0.2], b: [x0, y0 - 0.2], n: [-(x0 + x1) / 40, -1], mat: 'roof', uv: 'metric', tile: 2.5, uOff: i * 2.5 });
    }
    sweep(this.chunks, frames, segs, 40);

    const mid = frames[frames.length >> 1];
    const rot = Math.atan2(mid.nz, mid.nx);
    const c = Math.cos(rot);
    const sn = Math.sin(rot);
    const P = (lat, y, along) => [mid.x + mid.nx * lat + mid.tx * along, y, mid.z + mid.nz * lat + mid.tz * along];
    const conc = this.chunks.get('concrete', mid.x, mid.z);
    const steel = this.chunks.get('steel', mid.x, mid.z);
    const cream = this.chunks.get('cream', mid.x, mid.z);
    const glass = this.chunks.get('glass', mid.x, mid.z);
    const teal = this.chunks.get('teal', mid.x, mid.z);

    // Roof columns and end gables.
    for (let a = -L / 2 + 4; a <= L / 2 - 4; a += 8) {
      for (const s of [1, -1]) {
        const p = P(s * (W - 0.5), 0, a);
        steel.box(p[0], H + 0.95 + (roofLow - 0.95) / 2 + 0.2, p[2], 0.28, roofLow - 0.6, 0.28, rot, { faces: 'xXzZ' });
      }
    }
    // Concourse slung under the platforms, spanning the street.
    const cy0 = 6.0;
    const cy1 = H - 2.4;
    const cw = 12.5;
    const cl = L * 0.62;
    const face = (lat0, lat1, along0, along1, normal, builder, y0 = cy0, y1 = cy1) => {
      const p0 = P(lat0, y0, along0);
      const p1 = P(lat1, y0, along1);
      const len = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
      builder.quad(p0, p1, [p1[0], y1, p1[2]], [p0[0], y1, p0[2]], [[0, 0], [len / 3, 0], [len / 3, (y1 - y0) / 3], [0, (y1 - y0) / 3]], normal);
    };
    const nS = [mid.nx, 0, mid.nz];
    const nT = [mid.tx, 0, mid.tz];
    for (const s of [1, -1]) {
      face(s * cw, s * cw, -cl / 2, cl / 2, [nS[0] * s, 0, nS[2] * s], cream);
      face(s * (cw + 0.03), s * (cw + 0.03), -cl / 2 + 1, cl / 2 - 1, [nS[0] * s, 0, nS[2] * s], glass, cy0 + 1.2, cy1 - 1.1);
      face(s * (cw + 0.05), s * (cw + 0.05), -cl / 2, cl / 2, [nS[0] * s, 0, nS[2] * s], teal, cy1 - 0.75, cy1 - 0.4);
      face(-cw, cw, (s * cl) / 2, (s * cl) / 2, [nT[0] * s, 0, nT[2] * s], cream);
      face(-cw + 1, cw - 1, (s * cl) / 2 + s * 0.03, (s * cl) / 2 + s * 0.03, [nT[0] * s, 0, nT[2] * s], glass, cy0 + 1.2, cy1 - 1.1);
    }
    conc.quad(P(-cw, cy0, -cl / 2), P(cw, cy0, -cl / 2), P(cw, cy0, cl / 2), P(-cw, cy0, cl / 2), [[0, 0], [8, 0], [8, 14], [0, 14]], [0, -1, 0]);
    // Columns that carry the station, kept off the carriageway.
    for (const a of [-cl / 2 + 3, -cl / 6, cl / 6, cl / 2 - 3]) {
      for (const lat of [-cw + 1.2, 0, cw - 1.2]) {
        const p = P(lat, 0, a);
        const t = this.surface.typeAt(p[0], p[2]);
        if (t === SURF.ROAD) continue;
        conc.cylinder(p[0], -0.4, p[2], 0.75, 0.75, cy0 + 0.4, 10, { cap: false, uvScale: 1 / 3 });
        this.colliders.addCircle(p[0], p[2], 0.85, -2, cy0, 'station-column');
      }
    }
    // Entry buildings with stairs on both footpaths.
    for (const s of [1, -1]) {
      let lat = null;
      for (let d = cw - 2; d < cw + 16; d += 1) {
        const p = P(s * d, 0, 0);
        const t = this.surface.typeAt(p[0], p[2]);
        const t2 = this.surface.typeAt(...[P(s * (d + 5), 0, 0)[0], P(s * (d + 5), 0, 0)[2]]);
        if (t !== SURF.ROAD && t !== SURF.SIDEWALK && t !== SURF.MEDIAN && t2 !== SURF.ROAD) {
          lat = d + 3.4;
          break;
        }
      }
      if (lat === null) continue;
      const along = s * L * 0.18;
      const p = P(s * lat, 0, along);
      cream.box(p[0], cy1 / 2, p[2], 6.4, cy1, 11, rot, { uvScale: 1 / 3, faces: 'xXzZY' });
      const gp = P(s * (lat + 3.23 * 1), 0, along);
      void gp;
      // Glazed stair wall and a teal canopy over the entrance.
      for (const e of [1, -1]) {
        const q = P(s * lat, 0, along + e * 5.53);
        glass.box(q[0], 2.2 + (cy1 - 3.4) / 2, q[2], 5.2, cy1 - 3.4, 0.06, rot, { faces: 'zZ' });
      }
      const cnp = P(s * lat, 0, along);
      teal.box(cnp[0], 3.15, cnp[2], 7.6, 0.22, 12.4, rot, { faces: 'xXzZYy' });
      this.colliders.addBox(p[0], p[2], 3.2, 5.5, rot, -2, cy1, 'station-entry');
      this.surface.rect(p[0], p[2], 3.6, 5.9, rot, SURF.BUILDING, [SURF.ROAD]);
      // Link bridge from the entry to the concourse.
      const b0 = P(s * (lat - 3.2), 0, along);
      const b1 = P(s * cw, 0, along);
      const bl = Math.hypot(b1[0] - b0[0], b1[2] - b0[2]);
      if (bl > 0.6) {
        const bm = [(b0[0] + b1[0]) / 2, (b0[2] + b1[2]) / 2];
        cream.box(bm[0], cy0 + (cy1 - cy0) / 2, bm[1], bl, cy1 - cy0, 4.2, rot, { uvScale: 1 / 3, faces: 'zZYy' });
      }
    }
    // Name boards facing both ways along the road, plus one on each flank.
    const marks = this.world.city.landmarks;
    const id = `metro_${st.name}`;
    const y = cy1 - 2.3;
    for (const e of [1, -1]) {
      const p = P(0, 0, e * (cl / 2 + 0.12));
      marks.signAt(id, p[0], y, p[2], nT[0] * e, nT[2] * e, 16, false, { cx: mid.x, cz: mid.z });
    }
    for (const s of [1, -1]) {
      const p = P(s * (cw + 0.1), 0, 0);
      marks.signAt(id, p[0], y, p[2], nS[0] * s, nS[2] * s, 16, false, { cx: mid.x, cz: mid.z });
    }
    void c;
    void sn;
  }

  // --------------------------------------------------------------------------- trains
  _carGeometry(end) {
    // Rounded-rectangle section swept along the car; `end` cars get a raked nose.
    const b = new MeshBuilder({ color: true });
    const w = 1.45;
    const y0 = 0.35;
    const y1 = 3.75;
    const r = 0.42;
    const rb = 0.2;
    const bands = [0.9, 1.35, 1.75, 3.0];
    const section = [];
    // Right side, bottom to top, broken at every livery band.
    section.push([w, y0 + rb]);
    for (const y of bands) section.push([w, y]);
    for (let i = 0; i <= 4; i++) {
      const a = (i / 4) * (Math.PI / 2);
      section.push([w - r + Math.cos(a) * r, y1 - r + Math.sin(a) * r]);
    }
    for (let i = 0; i <= 4; i++) {
      const a = Math.PI / 2 + (i / 4) * (Math.PI / 2);
      section.push([-w + r + Math.cos(a) * r, y1 - r + Math.sin(a) * r]);
    }
    for (const y of [...bands].reverse()) section.push([-w, y]);
    section.push([-w, y0 + rb]);
    section.push([-w + rb, y0]);
    section.push([w - rb, y0]);
    section.push([w, y0 + rb]);

    const half = CAR_LEN / 2;
    const stations = end ? [-half, half - 2.6, half - 1.7, half - 0.9, half - 0.3, half] : [-half, half];
    const scaleAt = (z) => {
      if (!end || z <= half - 2.6) return [1, 1];
      const t = (z - (half - 2.6)) / 2.6;
      return [1 - 0.2 * t * t, 1 - 0.34 * t * t];
    };
    const white = [0.93, 0.94, 0.94];
    const teal = [0.08, 0.6, 0.58];
    const dark = [0.05, 0.07, 0.08];
    const grey = [0.3, 0.32, 0.34];
    const colourFor = (y, z) => {
      if (end && z > half - 2.3) return y > 1.75 && y < 3.0 ? dark : teal;
      if (y < 0.9) return grey;
      if (y > 1.75 && y < 3.0) return dark; // window band
      if (y >= 1.35 && y <= 1.75) return teal;
      if (y > 3.4) return grey;
      return white;
    };
    const cy = (y0 + y1) / 2;
    const rows = stations.map((z) => {
      const [sx, sy] = scaleAt(z);
      return section.map((p) => [p[0] * sx, y0 + (p[1] - y0) * sy, z]);
    });
    for (let k = 0; k < rows.length - 1; k++) {
      for (let i = 0; i < section.length - 1; i++) {
        const a = rows[k][i];
        const bb = rows[k][i + 1];
        const cc = rows[k + 1][i + 1];
        const d = rows[k + 1][i];
        const my = (section[i][1] + section[i + 1][1]) / 2;
        const mz = (a[2] + d[2]) / 2;
        const out = [(a[0] + bb[0]) / 2, (a[1] + bb[1]) / 2 - cy, 0.0001];
        b.quad(a, bb, cc, d, undefined, out, colourFor(my, mz));
      }
    }
    // End faces as fans.
    for (const [k, dir] of [[0, -1], [rows.length - 1, 1]]) {
      const row = rows[k];
      const z = row[0][2];
      const mid = row.reduce((m, p) => m + p[1], 0) / row.length;
      for (let i = 0; i < section.length - 1; i++) {
        const a = row[i];
        const bb = row[i + 1];
        const col = end && dir > 0 ? teal : grey;
        const i0 = b.vertex(0, mid, z, 0, 0, dir, 0, 0, 0, 0, col[0], col[1], col[2]);
        const i1 = b.vertex(a[0], a[1], z, 0, 0, dir, 0, 0, 0, 0, col[0], col[1], col[2]);
        const i2 = b.vertex(bb[0], bb[1], z, 0, 0, dir, 0, 0, 0, 0, col[0], col[1], col[2]);
        // Section runs counter-clockwise seen from +Z.
        if (dir > 0) b.tri(i0, i1, i2);
        else b.tri(i0, i2, i1);
      }
    }
    // Doors and window pillars along the sides.
    for (const s of [1, -1]) {
      for (let z = -half + 1.2; z < half - (end ? 3.6 : 1.4); z += 1.55) {
        const door = Math.abs(((z + half) % 4.65) - 2.3) < 0.8;
        const x = s * (w + 0.012);
        if (door) {
          b.quad([x, 0.95, z + 0.1], [x, 0.95, z + 1.45], [x, 3.1, z + 1.45], [x, 3.1, z + 0.1], undefined, [s, 0, 0], [0.82, 0.84, 0.85]);
          b.quad([x + s * 0.004, 1.75, z + 0.28], [x + s * 0.004, 1.75, z + 1.27], [x + s * 0.004, 2.9, z + 1.27], [x + s * 0.004, 2.9, z + 0.28], undefined, [s, 0, 0], dark);
        } else {
          b.quad([x, 1.72, z + 1.42], [x, 1.72, z + 1.55], [x, 3.02, z + 1.55], [x, 3.02, z + 1.42], undefined, [s, 0, 0], white);
        }
      }
    }
    if (end) {
      // Windscreen and headlamps on the nose.
      const zf = half + 0.01;
      const [sx, sy] = scaleAt(half);
      const Y = (y) => y0 + (y - y0) * sy;
      b.quad([-w * sx * 0.78, Y(1.85), zf], [w * sx * 0.78, Y(1.85), zf], [w * sx * 0.7, Y(3.25), zf], [-w * sx * 0.7, Y(3.25), zf], undefined, [0, 0, 1], dark);
      for (const s of [1, -1]) {
        b.quad([s * w * sx * 0.5, Y(1.2), zf], [s * w * sx * 0.82, Y(1.2), zf], [s * w * sx * 0.82, Y(1.42), zf], [s * w * sx * 0.5, Y(1.42), zf], undefined, [0, 0, 1], [1, 0.98, 0.9]);
      }
    }
    // Bogies and roof equipment.
    for (const z of [-half + 3.2, half - 3.2 - (end ? 1 : 0)]) b.box(0, 0.32, z, 2.3, 0.6, 3.2, 0, { color: [0.08, 0.08, 0.09] });
    b.box(0, 3.85, 0, 1.8, 0.28, CAR_LEN * 0.6, 0, { color: grey });
    return b.build({ smooth: false });
  }

  _trains() {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.35, envMapIntensity: 1.2 });
    const endGeo = this._carGeometry(true);
    const midGeo = this._carGeometry(false);
    for (const line of this.lines) {
      for (const dir of [1, -1]) {
        const cars = [];
        const group = new THREE.Group();
        for (let i = 0; i < 3; i++) {
          const mesh = new THREE.Mesh(i === 1 ? midGeo : endGeo, mat);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.userData.flip = i === 0; // leading car faces backwards in the consist
          group.add(mesh);
          cars.push(mesh);
        }
        this.group.add(group);
        const train = {
          line,
          dir,
          cars,
          group,
          s: dir > 0 ? line.length * 0.18 : line.length * 0.82,
          v: 0,
          dwell: 0,
          next: null,
          cruise: 17,
        };
        this.trains.push(train);
      }
    }
  }

  update(dt, focus) {
    const f = {};
    const g = {};
    for (const t of this.trains) {
      const line = t.line;
      // Next station ahead.
      let target = null;
      for (const st of line.stations) {
        const d = (st.s - t.s) * t.dir;
        if (d > 0.5 && (target === null || d < (target.s - t.s) * t.dir)) target = st;
      }
      if (t.dwell > 0) {
        t.dwell -= dt;
        t.v = 0;
      } else {
        const dist = target ? (target.s - t.s) * t.dir : Infinity;
        const brakeDist = (t.v * t.v) / (2 * 1.1);
        if (dist < brakeDist + 0.5) t.v = Math.max(0.6, t.v - 1.1 * dt);
        else t.v = Math.min(t.cruise, t.v + 0.9 * dt);
        t.s += t.v * dt * t.dir;
        if (target && dist < 0.6) {
          t.s = target.s;
          t.dwell = 7;
          t.v = 0;
        }
        // Run off the end of the map, come back on the other track.
        const span = (CAR_LEN + CAR_GAP) * 1.5 + 10;
        if (t.s > line.length + span) {
          t.dir = -1;
          t.s = line.length + span;
        } else if (t.s < -span) {
          t.dir = 1;
          t.s = -span;
        }
      }
      const lateral = TRACK * t.dir; // keep left
      let visible = false;
      for (let i = 0; i < 3; i++) {
        const car = t.cars[i];
        const cs = t.s + (1 - i) * (CAR_LEN + CAR_GAP) * t.dir;
        if (cs < 1 || cs > line.length - 1) {
          car.visible = false;
          continue;
        }
        this.at(line, clamp(cs + 6, 0, line.length), f);
        this.at(line, clamp(cs - 6, 0, line.length), g);
        const x = (f.x + g.x) / 2;
        const z = (f.z + g.z) / 2;
        const tx = f.x - g.x;
        const tz = f.z - g.z;
        const l = Math.hypot(tx, tz) || 1;
        const nx = tz / l;
        const nz = -tx / l;
        car.visible = true;
        car.position.set(x + nx * lateral, H - 0.02, z + nz * lateral);
        let yaw = Math.atan2(tx * t.dir, tz * t.dir);
        if (i === 2) yaw += Math.PI;
        if (i === 1) yaw += 0;
        car.rotation.y = yaw;
        visible = true;
      }
      t.group.visible = visible;
      t.x = t.cars[1].position.x;
      t.z = t.cars[1].position.z;
    }
    void focus;
  }
}
