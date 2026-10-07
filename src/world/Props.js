// Street furniture: street lights, traffic signals, green NHAI place boards, overhead
// direction gantries, bus shelters, utility poles with sagging wires and roadside hoardings.

import * as THREE from 'three';
import { SURF } from './SurfaceMap.js';
import { PLACE_NAMES, FLYOVER_DECK_HALF } from './layout.js';
import { STOP_LINE_SETBACK } from './RoadNetwork.js';
import { lerp } from '../utils/math.js';

const STEEL = [0.5, 0.52, 0.54];
const DARK = [0.16, 0.17, 0.18];
const CONCRETE = [0.66, 0.65, 0.62];

export class Props {
  constructor(city) {
    this.city = city;
    this.world = city.world;
    this.roads = city.roads;
    this.surface = city.surface;
    this.colliders = city.colliders;
    this.rng = city.rng;
    this.lamps = []; // traffic signal lamps: { x, y, z, nx, nz, node, arm, colour }
  }

  get marks() {
    return this.city.landmarks;
  }

  b(key, x, z, tint = null) {
    const b = this.city.use(key, x, z);
    if (tint) b.tint = tint;
    return b;
  }

  build() {
    this._streetLights();
    this._signals();
    this._placeBoards();
    this._gantries();
    this._busStops();
    this._utilityPoles();
    this._unipoles();
    this._signalMesh();
  }

  // -------------------------------------------------------------------- street lights
  _lightPole(x, z, y0, dirX, dirZ, arms, height = 9.5) {
    const b = this.b('steel', x, z, STEEL);
    b.cylinder(x, y0, z, 0.13, 0.075, height, 7, { cap: false });
    b.cylinder(x, y0, z, 0.2, 0.17, 0.9, 7, { cap: true });
    const l = Math.hypot(dirX, dirZ) || 1;
    dirX /= l;
    dirZ /= l;
    const rot = Math.atan2(dirZ, dirX);
    for (const s of arms) {
      // Builders are shared per cell, so reselect the steel surface for every arm.
      this.b('steel', x, z, STEEL);
      // Arm rises a little and reaches out over the carriageway.
      for (let k = 0; k < 3; k++) {
        const t0 = k / 3;
        const t1 = (k + 1) / 3;
        const r = lerp(0.1, 2.3, (t0 + t1) / 2) * s;
        const yy = y0 + height - 0.2 + Math.sin(((t0 + t1) / 2) * Math.PI * 0.5) * 0.7;
        b.tint = STEEL;
        b.box(x + dirX * r, yy, z + dirZ * r, 0.85, 0.09, 0.09, rot, { faces: 'xXzZYy' });
      }
      const hx = x + dirX * 2.9 * s;
      const hz = z + dirZ * 2.9 * s;
      b.tint = [0.3, 0.31, 0.33];
      b.box(hx, y0 + height + 0.5, hz, 1.0, 0.16, 0.34, rot, { faces: 'xXzZY' });
      const lamp = this.b('lamp', x, z);
      lamp.box(hx, y0 + height + 0.41, hz, 0.8, 0.04, 0.26, rot, { faces: 'y' });
    }
    this.colliders.addCircle(x, z, 0.22, y0 - 1, y0 + height, 'light');
  }

  _streetLights() {
    const rng = this.rng;
    for (const e of this.roads.edges) {
      const spec = e.spec;
      const from = e.trim[0] + 8;
      const to = e.length - e.trim[1] - 8;
      if (to - from < 20) continue;
      const median = spec.median > 0 && !e.metro;
      const spacing = e.cls === 'highway' ? 34 : e.cls === 'arterial' ? 30 : 28;
      let k = 0;
      for (let s = from + rng.float(0, 10); s < to; s += spacing, k++) {
        const f = e.at(s);
        if (median) {
          if (e.inFlyZone(s)) continue;
          if (this.surface.typeAt(f.x, f.z) !== SURF.MEDIAN) continue;
          this._lightPole(f.x, f.z, 0.33, f.nx, f.nz, [1, -1], e.cls === 'highway' ? 10.5 : 9.5);
        } else {
          const side = e.cls === 'street' ? 1 : k % 2 ? 1 : -1;
          const lat = side * (e.half + 0.55);
          this._lightPole(f.x + f.nx * lat, f.z + f.nz * lat, 0.19, -f.nx * side, -f.nz * side, [1], 8.5);
        }
      }
    }
    // Lights along the crown of each flyover.
    for (const fl of this.roads.flyovers) {
      for (const sm of fl.samples) {
        if (Math.round(sm.d) % 30 !== 0 || Math.abs(sm.d) > fl.half - 12) continue;
        this._lightPole(sm.x, sm.z, sm.h + 0.7, sm.nx, sm.nz, [1, -1], 8.5);
      }
    }
  }

  // ------------------------------------------------------------------ traffic signals
  _head(x, y, z, nx, nz, node, arm) {
    const rot = Math.atan2(nz, nx);
    const b = this.b('steel', x, z, [0.08, 0.08, 0.09]);
    b.box(x, y + 0.75, z, 0.3, 1.5, 0.46, rot, { faces: 'xXzZYy' });
    b.tint = [0.92, 0.75, 0.1];
    b.box(x - nx * 0.17, y + 0.75, z - nz * 0.17, 0.04, 1.8, 0.78, rot, { faces: 'xXzZYy' });
    for (let i = 0; i < 3; i++) {
      this.lamps.push({ x: x + nx * 0.17, y: y + 1.25 - i * 0.5, z: z + nz * 0.17, nx, nz, node, arm, colour: i });
    }
  }

  _signals() {
    for (const node of this.roads.junctions) {
      if (!node.signal || node.arms.length < 3) continue;
      for (const arm of node.arms) {
        const f = this.roads.armFrame(arm, arm.trim + STOP_LINE_SETBACK - 0.6);
        // Approaching traffic uses the arm's right-hand half (looking away from the node).
        const kerb = arm.half + 0.7;
        const px = f.x + f.rx * kerb;
        const pz = f.z + f.rz * kerb;
        const b = this.b('steel', px, pz, [0.2, 0.21, 0.22]);
        b.cylinder(px, 0.19, pz, 0.12, 0.1, 6.4, 7, { cap: true });
        this.colliders.addCircle(px, pz, 0.2, -1, 6.5, 'signal');
        // Heads face the oncoming traffic, i.e. away from the junction.
        this._head(px, 3.0, pz, f.tx, f.tz, node, arm.index);
        const inner = arm.edge.fly[arm.end] ? FLYOVER_DECK_HALF + 1.2 : arm.edge.spec.median / 2 + 0.6;
        const reach = Math.min(kerb - inner, 8.5);
        if (reach > 3.5) {
          const rot = Math.atan2(f.rz, f.rx);
          b.tint = [0.2, 0.21, 0.22];
          b.box(px - (f.rx * reach) / 2, 6.35, pz - (f.rz * reach) / 2, reach, 0.14, 0.14, rot, { faces: 'xXzZYy' });
          this._head(px - f.rx * (reach - 0.3), 5.0, pz - f.rz * (reach - 0.3), f.tx, f.tz, node, arm.index);
        }
      }
    }
  }

  _signalMesh() {
    const geo = new THREE.CircleGeometry(0.17, 12);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: true, fog: true });
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, this.lamps.length));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const z = new THREE.Vector3(0, 0, 1);
    const n = new THREE.Vector3();
    const s = new THREE.Vector3(1, 1, 1);
    const c = new THREE.Color();
    this.lamps.forEach((l, i) => {
      n.set(l.nx, 0, l.nz).normalize();
      q.setFromUnitVectors(z, n);
      m.compose(new THREE.Vector3(l.x, l.y, l.z), q, s);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.set(0x111111));
    });
    mesh.count = this.lamps.length;
    mesh.frustumCulled = false;
    mesh.name = 'signal-lamps';
    this.lampMesh = mesh;
    this.city.group.add(mesh);
    this._lampState = new Array(this.lamps.length).fill(-1);
  }

  /** Light the right lamp on every signal head. */
  update(time) {
    if (!this.lampMesh) return;
    const on = [new THREE.Color(7, 0.35, 0.2), new THREE.Color(6, 3.4, 0.2), new THREE.Color(0.3, 6.5, 1.6)];
    const off = [new THREE.Color(0.12, 0.01, 0.01), new THREE.Color(0.1, 0.07, 0.0), new THREE.Color(0.0, 0.09, 0.03)];
    const order = { red: 0, yellow: 1, green: 2 };
    let dirty = false;
    for (let i = 0; i < this.lamps.length; i++) {
      const l = this.lamps[i];
      const state = order[this.roads.signalState(l.node, l.arm, time)];
      const lit = state === l.colour ? 1 : 0;
      if (this._lampState[i] === lit) continue;
      this._lampState[i] = lit;
      this.lampMesh.setColorAt(i, lit ? on[l.colour] : off[l.colour]);
      dirty = true;
    }
    if (dirty) this.lampMesh.instanceColor.needsUpdate = true;
  }

  // ------------------------------------------------------------------------- sign boards
  _postBoard(id, x, z, nx, nz, width, base = 2.3) {
    const r = this.marks.signs.get(id);
    if (!r) return;
    const h = width / r.aspect;
    const rx = nz;
    const rz = -nx;
    const b = this.b('steel', x, z, STEEL);
    for (const s of [-1, 1]) {
      const px = x + rx * (width / 2 - 0.25) * s;
      const pz = z + rz * (width / 2 - 0.25) * s;
      b.cylinder(px, 0, pz, 0.07, 0.07, base + h, 6, { cap: true });
    }
    this.colliders.addCircle(x, z, 0.3, -1, 3, 'sign');
    this.marks.signAt(id, x + nx * 0.09, base, z + nz * 0.09, nx, nz, width, false, { cx: x, cz: z });
    const back = this.b('steel', x, z, [0.35, 0.36, 0.37]);
    const hw = width / 2;
    back.quad([x + rx * hw - nx * 0.02, base, z + rz * hw - nz * 0.02], [x - rx * hw - nx * 0.02, base, z - rz * hw - nz * 0.02], [x - rx * hw - nx * 0.02, base + h, z - rz * hw - nz * 0.02], [x + rx * hw - nx * 0.02, base + h, z + rz * hw - nz * 0.02], undefined, [-nx, 0, -nz]);
  }

  _placeBoards() {
    for (const node of this.roads.junctions) {
      if (!PLACE_NAMES[node.id]) continue;
      for (const arm of node.arms) {
        const d = arm.trim + 34;
        if (arm.edge.length < d + 20) continue;
        const f = this.roads.armFrame(arm, d);
        const lat = arm.half + arm.walk + 1.4;
        const x = f.x + f.rx * lat;
        const z = f.z + f.rz * lat;
        const t = this.surface.typeAt(x, z);
        if (t === SURF.BUILDING || t === SURF.ROAD) continue;
        this._postBoard(`place_${node.id}`, x, z, f.tx, f.tz, 3.0);
      }
    }
    // Speed limit roundels here and there.
    for (const e of this.roads.edges) {
      if (e.cls === 'street' || e.length < 300) continue;
      for (const s of [e.length * 0.3, e.length * 0.7]) {
        const f = e.at(s);
        const side = s < e.length / 2 ? 1 : -1;
        const lat = side * (e.half + e.walk + 0.9);
        const x = f.x + f.nx * lat;
        const z = f.z + f.nz * lat;
        if (this.surface.typeAt(x, z) === SURF.BUILDING) continue;
        const b = this.b('steel', x, z, STEEL);
        b.cylinder(x, 0, z, 0.05, 0.05, 3.2, 6);
        // Left-hand traffic: a sign on the +n side faces traffic running along +t.
        this.marks.signAt('speed', x, 2.35, z, -f.tx * side, -f.tz * side, 0.9, false, { cx: x, cz: z });
      }
    }
  }

  _gantries() {
    const plan = { V: ['dir_V_n', 'dir_V_s'], K: ['dir_K_n', 'dir_K_s'], PB: ['dir_PB_n', 'dir_PB_s'], E: ['dir_E_n', 'dir_E_s'] };
    for (const fl of this.roads.flyovers) {
      const ids = plan[fl.nodeId];
      if (!ids) continue;
      [[fl.e0, fl.end0], [fl.e1, fl.end1]].forEach(([e, end], i) => {
        const d = fl.half + 46;
        if (e.length < d + 30) return;
        const s = end === 0 ? d : e.length - d;
        const f = e.at(s);
        // Carriageway heading for the node: traffic keeps left of its direction of travel.
        const toward = end === 0 ? -1 : 1; // along-edge direction that approaches the node
        const side = toward; // left of travel = +n when travelling along +t
        const inner = 0.35; // stands on the median
        const outer = e.half + 1.0;
        const ax = f.x + f.nx * side * inner;
        const az = f.z + f.nz * side * inner;
        const bx = f.x + f.nx * side * outer;
        const bz = f.z + f.nz * side * outer;
        const rot = Math.atan2(f.nz, f.nx);
        const b = this.b('steel', f.x, f.z, STEEL);
        for (const [px, pz] of [[ax, az], [bx, bz]]) {
          b.cylinder(px, 0, pz, 0.22, 0.18, 7.6, 8, { cap: true });
          this.colliders.addCircle(px, pz, 0.3, -1, 7.6, 'gantry');
        }
        const span = outer - inner;
        const mx = (ax + bx) / 2;
        const mz = (az + bz) / 2;
        for (const y of [6.4, 7.5]) b.box(mx, y, mz, span, 0.16, 0.16, rot, { faces: 'xXzZYy' });
        for (let k = 0; k <= 8; k++) {
          const t = k / 8;
          b.box(lerp(ax, bx, t), 6.95, lerp(az, bz, t), 0.08, 1.1, 0.08, rot, { faces: 'xXzZ' });
        }
        // The board faces the oncoming traffic.
        const nx = -f.tx * toward;
        const nz = -f.tz * toward;
        const bid = ids[i % 2];
        this.marks.signAt(bid, mx + nx * 0.2, 5.5, mz + nz * 0.2, nx, nz, Math.min(span - 1, 12), false, { cx: f.x, cz: f.z });
        const name = PLACE_NAMES[fl.nodeId];
        void name;
      });
    }
  }

  // --------------------------------------------------------------------------- shelters
  _busStops() {
    const rng = this.rng;
    for (const e of this.roads.edges) {
      if (e.cls === 'street' || e.length < 260) continue;
      for (const side of [1, -1]) {
        const s = e.length * (side > 0 ? 0.36 : 0.64) + rng.float(-20, 20);
        if (e.inFlyZone(s)) continue;
        const f = e.at(s);
        const lat = side * (e.half + e.walk + 1.7);
        const x = f.x + f.nx * lat;
        const z = f.z + f.nz * lat;
        const t = this.surface.typeAt(x, z);
        if (t !== SURF.LAND && t !== SURF.VERGE && t !== SURF.PAVED) continue;
        const rot = Math.atan2(f.tz, f.tx);
        const nx = -f.nx * side;
        const nz = -f.nz * side;
        const b = this.b('steel', x, z, [0.2, 0.35, 0.6]);
        for (const o of [-2.6, 2.6]) {
          b.box(x + f.tx * o - nx * 0.9, 1.3, z + f.tz * o - nz * 0.9, 0.12, 2.6, 0.12, rot, { faces: 'xXzZ' });
          b.box(x + f.tx * o + nx * 0.9, 1.3, z + f.tz * o + nz * 0.9, 0.1, 2.6, 0.1, rot, { faces: 'xXzZ' });
        }
        b.tint = [0.8, 0.82, 0.84];
        b.box(x, 2.7, z, 6.2, 0.12, 2.6, rot, { faces: 'xXzZYy' });
        b.tint = [0.3, 0.32, 0.34];
        b.box(x - nx * 0.6, 0.5, z - nz * 0.6, 4.6, 0.1, 0.5, rot, { faces: 'xXzZYy' });
        const back = this.b('trim', x, z, [0.85, 0.86, 0.8]);
        back.box(x - nx * 1.0, 1.4, z - nz * 1.0, 5.4, 1.9, 0.08, rot, { faces: 'xXzZYy', uvScale: 0.3 });
        this.marks.signAt('busStop', x + nx * 1.32, 2.8, z + nz * 1.32, nx, nz, 2.6, true, { cx: x, cz: z });
        this.colliders.addBox(x - nx * 1.0, z - nz * 1.0, 2.7, 0.15, rot, -1, 2.8, 'shelter');
        this.surface.rect(x, z, 3.2, 1.4, rot, SURF.PAVED, [SURF.ROAD, SURF.SIDEWALK, SURF.BUILDING]);
        (this.city.busStops ||= []).push({ x, z, nx, nz });
      }
    }
  }

  // ----------------------------------------------------------------------- utility poles
  _utilityPoles() {
    const rng = this.rng;
    for (const e of this.roads.edges) {
      if (e.cls === 'highway') continue;
      const side = e.cls === 'street' ? -1 : 1;
      const from = e.trim[0] + 12;
      const to = e.length - e.trim[1] - 12;
      let prev = null;
      for (let s = from; s < to; s += 36) {
        const f = e.at(s);
        const lat = side * (e.half + e.walk - 0.35);
        const x = f.x + f.nx * lat;
        const z = f.z + f.nz * lat;
        const rot = Math.atan2(f.nz, f.nx);
        const b = this.b('roofFlat', x, z, CONCRETE);
        b.box(x, 4.4, z, 0.26, 8.8, 0.22, rot, { faces: 'xXzZY', uvScale: 0.3 });
        b.tint = DARK;
        b.box(x, 8.2, z, 1.9, 0.1, 0.1, rot, { faces: 'xXzZYy' });
        b.box(x, 7.4, z, 1.3, 0.1, 0.1, rot, { faces: 'xXzZYy' });
        if (rng.chance(0.16)) {
          b.tint = [0.35, 0.37, 0.4];
          b.box(x + f.nx * 0.5 * side, 5.6, z + f.nz * 0.5 * side, 0.8, 1.1, 0.7, rot, { faces: 'xXzZYy' });
        }
        this.colliders.addCircle(x, z, 0.22, -1, 8, 'pole');
        const here = { x, z, nx: f.nx, nz: f.nz };
        if (prev) this._wires(prev, here);
        prev = here;
      }
    }
  }

  _wires(a, b) {
    const w = this.b('tank', (a.x + b.x) / 2, (a.z + b.z) / 2, [0.05, 0.05, 0.05]);
    const segs = 6;
    for (const [off, y] of [[-0.85, 8.3], [0, 8.3], [0.85, 8.3], [-0.55, 7.5], [0.55, 7.5]]) {
      let px = a.x + a.nx * off;
      let pz = a.z + a.nz * off;
      let py = y;
      for (let k = 1; k <= segs; k++) {
        const t = k / segs;
        const x = lerp(a.x + a.nx * off, b.x + b.nx * off, t);
        const z = lerp(a.z + a.nz * off, b.z + b.nz * off, t);
        const sag = Math.sin(t * Math.PI) * 0.75;
        const yy = y - sag;
        // Thin vertical ribbon, visible from both sides.
        w.quad([px, py, pz], [x, yy, z], [x, yy + 0.035, z], [px, py + 0.035, pz], undefined, [a.nx, 0, a.nz]);
        w.quad([px, py, pz], [x, yy, z], [x, yy + 0.035, z], [px, py + 0.035, pz], undefined, [-a.nx, 0, -a.nz]);
        px = x;
        pz = z;
        py = yy;
      }
    }
  }

  // ------------------------------------------------------------------ roadside hoardings
  _unipoles() {
    const rng = this.rng;
    for (const e of this.roads.edges) {
      if (e.cls !== 'highway') continue;
      let k = 0;
      for (let s = e.trim[0] + 60; s < e.length - e.trim[1] - 60; s += rng.float(110, 190), k++) {
        const side = k % 2 ? 1 : -1;
        const f = e.at(s);
        const lat = side * (e.half + e.walk + 3.2);
        const x = f.x + f.nx * lat;
        const z = f.z + f.nz * lat;
        const t = this.surface.typeAt(x, z);
        if (t !== SURF.LAND && t !== SURF.VERGE) continue;
        if (this.world.terrain.waterDistance(x, z) < 3) continue;
        const b = this.b('steel', x, z, [0.42, 0.44, 0.46]);
        b.cylinder(x, 0, z, 0.42, 0.36, 11.5, 10, { cap: true });
        this.colliders.addCircle(x, z, 0.5, -1, 11, 'unipole');
        this.surface.circle(x, z, 1.5, SURF.PAVED, [SURF.ROAD, SURF.SIDEWALK, SURF.BUILDING]);
        // Boards angled towards both directions of traffic.
        for (const dir of [1, -1]) {
          const nx = f.tx * dir * 0.92 - f.nx * side * 0.38;
          const nz = f.tz * dir * 0.92 - f.nz * side * 0.38;
          const fr = { cx: x, cz: z, fx: nx, fz: nz };
          const l = Math.hypot(nx, nz);
          const ux = nx / l;
          const uz = nz / l;
          const px = x + ux * 0.55;
          const pz = z + uz * 0.55;
          this._banner(px, 11.2, pz, ux, uz, 10, 5, fr);
        }
      }
    }
  }

  _banner(x, y, z, nx, nz, width, height, anchor) {
    const city = this.city;
    const tile = this.rng.int(0, city.hoardings.count - 1);
    const col = tile % 2;
    const row = Math.floor(tile / 2);
    const v1 = 1 - (row % 2) / 2;
    const v0 = v1 - 0.5;
    const rx = nz;
    const rz = -nx;
    const hw = width / 2;
    const frame = this.b('steel', anchor.cx, anchor.cz, [0.2, 0.21, 0.22]);
    frame.box(x - nx * 0.12, y + height / 2, z - nz * 0.12, width + 0.3, height + 0.3, 0.2, Math.atan2(rz, rx), { faces: 'xXzZYy' });
    const b = city.use('trim', anchor.cx, anchor.cz);
    b.curLayer = city.hoardLayer + ((row >= 2 ? 2 : 0) + col) * 2;
    b.tint = [1, 1, 1];
    const p0 = [x - rx * hw, y, z - rz * hw];
    const p1 = [x + rx * hw, y, z + rz * hw];
    b.quad(p0, p1, [p1[0], y + height, p1[2]], [p0[0], y + height, p0[2]], [[0, v0], [1, v0], [1, v1], [0, v1]], [nx, 0, nz]);
  }
}
