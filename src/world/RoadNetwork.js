// Road graph: smooth centrelines, junction trimming, flyover profiles, traffic lanes and
// the sidewalk graph that pedestrians use. Pure data - no rendering in here.

import { NODES, EDGES, FLYOVERS, ROAD_CLASSES, laneOffset, carriageHalf, FLYOVER_DECK_HALF } from './layout.js';
import { smoothPolyline, lineIntersect, clamp, lerp } from '../utils/math.js';

const STEP = 3;
const JUNCTION_MARGIN = 5.5;
export const STOP_LINE_SETBACK = 5.2; // stop line distance before the junction mouth

const perp = (d) => ({ x: -d.z, z: d.x });

export class Edge {
  constructor(def, nodes) {
    Object.assign(this, def);
    this.spec = ROAD_CLASSES[def.cls];
    this.half = carriageHalf(def.cls);
    this.walk = this.spec.sidewalk;
    const ctrl = [nodes[def.a].p, ...(def.via || []), nodes[def.b].p];
    const pts = smoothPolyline(ctrl, STEP);
    this.samples = [];
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      if (i > 0) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      this.samples.push({ x: pts[i][0], z: pts[i][1], s, tx: 0, tz: 0, nx: 0, nz: 0 });
    }
    const n = this.samples.length;
    for (let i = 0; i < n; i++) {
      const p = this.samples[Math.max(0, i - 1)];
      const q = this.samples[Math.min(n - 1, i + 1)];
      const dx = q.x - p.x;
      const dz = q.z - p.z;
      const l = Math.hypot(dx, dz) || 1;
      const sm = this.samples[i];
      sm.tx = dx / l;
      sm.tz = dz / l;
      sm.nx = sm.tz; // left normal
      sm.nz = -sm.tx;
    }
    this.length = s;
    this.trim = [0, 0];
    this.fly = [null, null]; // flyover at end a / b
  }

  /** Interpolated centreline frame at arc length s. */
  at(s) {
    const sm = this.samples;
    const n = sm.length;
    s = clamp(s, 0, this.length);
    let i = Math.min(n - 2, Math.floor((s / this.length) * (n - 1)));
    while (i > 0 && sm[i].s > s) i--;
    while (i < n - 2 && sm[i + 1].s < s) i++;
    const a = sm[i];
    const b = sm[i + 1];
    const t = clamp((s - a.s) / (b.s - a.s || 1), 0, 1);
    let tx = lerp(a.tx, b.tx, t);
    let tz = lerp(a.tz, b.tz, t);
    const l = Math.hypot(tx, tz) || 1;
    tx /= l;
    tz /= l;
    return { x: lerp(a.x, b.x, t), z: lerp(a.z, b.z, t), tx, tz, nx: tz, nz: -tx, s };
  }

  /** Deck height of the inner (flyover) lanes at arc length s. */
  flyHeight(s) {
    let h = 0;
    if (this.fly[0]) h = Math.max(h, this.fly[0].profile(s));
    if (this.fly[1]) h = Math.max(h, this.fly[1].profile(this.length - s));
    return h;
  }

  /** True when the inner lanes are on a flyover / ramp at s. */
  inFlyZone(s) {
    return (this.fly[0] && s < this.fly[0].half) || (this.fly[1] && this.length - s < this.fly[1].half);
  }
}

export class Flyover {
  constructor(def) {
    Object.assign(this, def);
    this.deckHalf = FLYOVER_DECK_HALF;
    this.samples = [];
  }
  profile(d) {
    d = Math.abs(d);
    if (d >= this.half) return 0;
    if (d <= this.flat) return this.height;
    const t = (this.half - d) / (this.half - this.flat);
    return this.height * t * t * (3 - 2 * t);
  }
}

export class LanePath {
  constructor(id) {
    this.id = id;
    this.pts = []; // flat [x,y,z,...]
    this.cum = [];
    this.length = 0;
    this.kind = 'lane';
    this.next = [];
    this.speed = 12;
    this.edge = null;
    this.dir = 1;
    this.index = 0;
    this.elevated = false;
    this.signal = null;
    this.turn = 'S';
    this.entry = false; // starts at a world exit node - traffic may spawn here
    this.exit = false;
    this.vehicles = []; // maintained by the traffic system
  }
  push(x, y, z) {
    const n = this.pts.length / 3;
    if (n > 0) {
      const dx = x - this.pts[(n - 1) * 3];
      const dy = y - this.pts[(n - 1) * 3 + 1];
      const dz = z - this.pts[(n - 1) * 3 + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 0.05) return;
      this.length += d;
    }
    this.pts.push(x, y, z);
    this.cum.push(this.length);
  }
  /** Sample position + tangent at distance d. `hint` is the last segment index for speed. */
  sample(d, out, hint = 0) {
    const n = this.cum.length;
    d = clamp(d, 0, this.length);
    let i = clamp(hint, 0, n - 2);
    while (i > 0 && this.cum[i] > d) i--;
    while (i < n - 2 && this.cum[i + 1] < d) i++;
    const span = this.cum[i + 1] - this.cum[i] || 1;
    const t = (d - this.cum[i]) / span;
    const a = i * 3;
    const b = a + 3;
    const p = this.pts;
    out.x = p[a] + (p[b] - p[a]) * t;
    out.y = p[a + 1] + (p[b + 1] - p[a + 1]) * t;
    out.z = p[a + 2] + (p[b + 2] - p[a + 2]) * t;
    out.tx = (p[b] - p[a]) / span;
    out.ty = (p[b + 1] - p[a + 1]) / span;
    out.tz = (p[b + 2] - p[a + 2]) / span;
    out.i = i;
    return out;
  }
}

export class RoadNetwork {
  constructor() {
    this.nodes = {};
    this.edges = [];
    this.edgeById = {};
    this.flyovers = [];
    this.lanes = [];
    this.junctions = [];
    this.walkNodes = [];
    this.walkLinks = [];
    this._buildEdges();
    this._buildNodes();
    this._buildFlyovers();
    this._buildJunctionGeometry();
    this._buildLanes();
    this._buildSidewalkGraph();
    this._buildSampleGrid();
  }

  _buildSampleGrid() {
    this.sampleGrid = new Map();
    const cell = 32;
    this.sampleCell = cell;
    for (const e of this.edges) {
      for (const sm of e.samples) {
        const k = `${Math.floor(sm.x / cell)}|${Math.floor(sm.z / cell)}`;
        let list = this.sampleGrid.get(k);
        if (!list) this.sampleGrid.set(k, (list = []));
        list.push({ e, sm });
      }
    }
  }

  /** Nearest road centreline sample within `max` metres: { edge, sample, dist, lateral } or null. */
  nearestEdge(x, z, max = 40) {
    const cell = this.sampleCell;
    const ci = Math.floor(x / cell);
    const cj = Math.floor(z / cell);
    const r = Math.ceil(max / cell);
    let best = null;
    let bd = max * max;
    for (let i = ci - r; i <= ci + r; i++) {
      for (let j = cj - r; j <= cj + r; j++) {
        const list = this.sampleGrid.get(`${i}|${j}`);
        if (!list) continue;
        for (const it of list) {
          const dx = x - it.sm.x;
          const dz = z - it.sm.z;
          const d = dx * dx + dz * dz;
          if (d < bd) {
            bd = d;
            best = it;
          }
        }
      }
    }
    if (!best) return null;
    const sm = best.sm;
    const lateral = (x - sm.x) * sm.nx + (z - sm.z) * sm.nz;
    return { edge: best.e, sample: sm, dist: Math.sqrt(bd), lateral };
  }

  _buildEdges() {
    for (const id in NODES) {
      const n = NODES[id];
      this.nodes[id] = { id, ...n, x: n.p[0], z: n.p[1], arms: [] };
    }
    for (const def of EDGES) {
      const e = new Edge(def, this.nodes);
      this.edges.push(e);
      this.edgeById[e.id] = e;
    }
  }

  _buildNodes() {
    for (const e of this.edges) {
      for (const end of [0, 1]) {
        const node = this.nodes[end === 0 ? e.a : e.b];
        const probe = e.at(end === 0 ? Math.min(14, e.length / 2) : Math.max(e.length - 14, e.length / 2));
        const sgn = end === 0 ? 1 : -1;
        let dx = probe.x - node.x;
        let dz = probe.z - node.z;
        const l = Math.hypot(dx, dz) || 1;
        dx /= l;
        dz /= l;
        node.arms.push({
          edge: e,
          end,
          sgn,
          d: { x: dx, z: dz },
          angle: Math.atan2(dz, dx),
          half: e.half,
          walk: e.walk,
          trim: 0,
        });
      }
    }
    for (const id in this.nodes) {
      const node = this.nodes[id];
      node.arms.sort((a, b) => a.angle - b.angle);
      node.arms.forEach((a, i) => (a.index = i));
      const n = node.arms.length;
      if (n < 2) continue;
      const need = new Array(n).fill(n === 2 ? 9 : 7);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        if (n === 2 && i === 1) break;
        const A = node.arms[i];
        const B = node.arms[j];
        let between = B.angle - A.angle;
        if (between <= 0) between += Math.PI * 2;
        if (between > Math.PI * 0.9) continue; // nearly opposite or reflex: no corner conflict
        const pa = perp(A.d);
        const pb = perp(B.d);
        const wa = A.half + A.walk;
        const wb = B.half + B.walk;
        const hit = lineIntersect(node.x + pa.x * wa, node.z + pa.z * wa, A.d.x, A.d.z, node.x - pb.x * wb, node.z - pb.z * wb, B.d.x, B.d.z);
        if (!hit) continue;
        const ta = (hit.x - node.x) * A.d.x + (hit.z - node.z) * A.d.z;
        const tb = (hit.x - node.x) * B.d.x + (hit.z - node.z) * B.d.z;
        need[i] = Math.max(need[i], ta);
        need[j] = Math.max(need[j], tb);
      }
      for (let i = 0; i < n; i++) {
        const arm = node.arms[i];
        arm.trim = clamp(need[i] + JUNCTION_MARGIN, 6, Math.min(70, arm.edge.length * 0.45));
        arm.edge.trim[arm.end] = arm.trim;
      }
      node.isJunction = true;
      this.junctions.push(node);
    }
  }

  _buildFlyovers() {
    for (const def of FLYOVERS) {
      const f = new Flyover(def);
      const node = this.nodes[def.node];
      const e0 = this.edgeById[def.edges[0]];
      const e1 = this.edgeById[def.edges[1]];
      const end0 = e0.a === def.node ? 0 : 1;
      const end1 = e1.a === def.node ? 0 : 1;
      e0.fly[end0] = f;
      e1.fly[end1] = f;
      f.node = node;
      f.nodeId = def.node;
      f.e0 = e0;
      f.e1 = e1;
      f.end0 = end0;
      f.end1 = end1;
      node.flyover = f;
      // Walk from -half (on e0) through the node to +half (on e1).
      const count = Math.round((f.half * 2) / STEP);
      for (let i = 0; i <= count; i++) {
        const d = -f.half + (i / count) * f.half * 2;
        let fr;
        let flip;
        if (d < 0) {
          const s = end0 === 0 ? -d : e0.length + d;
          fr = e0.at(s);
          flip = end0 === 0 ? -1 : 1; // travelling toward the node
        } else {
          const s = end1 === 0 ? d : e1.length - d;
          fr = e1.at(s);
          flip = end1 === 0 ? 1 : -1; // travelling away from the node
        }
        const tx = fr.tx * flip;
        const tz = fr.tz * flip;
        f.samples.push({ x: fr.x, z: fr.z, tx, tz, nx: tz, nz: -tx, d, h: f.profile(d) });
      }
      // Bounding box for quick rejection.
      f.minX = Math.min(...f.samples.map((s) => s.x)) - 12;
      f.maxX = Math.max(...f.samples.map((s) => s.x)) + 12;
      f.minZ = Math.min(...f.samples.map((s) => s.z)) - 12;
      f.maxZ = Math.max(...f.samples.map((s) => s.z)) + 12;
      this.flyovers.push(f);
    }
  }

  /** Frame of an arm at distance `d` from its node, expressed looking away from the node. */
  armFrame(arm, d) {
    const e = arm.edge;
    const fr = e.at(arm.end === 0 ? d : e.length - d);
    const tx = fr.tx * arm.sgn;
    const tz = fr.tz * arm.sgn;
    // right = perp(t) (clockwise neighbour side), left = -perp(t)
    return { x: fr.x, z: fr.z, tx, tz, rx: -tz, rz: tx };
  }

  _buildJunctionGeometry() {
    for (const node of this.junctions) {
      const arms = node.arms;
      const n = arms.length;
      for (const arm of arms) {
        const f = this.armFrame(arm, arm.trim);
        arm.mouth = f;
        arm.kerbR = { x: f.x + f.rx * arm.half, z: f.z + f.rz * arm.half };
        arm.kerbL = { x: f.x - f.rx * arm.half, z: f.z - f.rz * arm.half };
        arm.outR = { x: f.x + f.rx * (arm.half + arm.walk), z: f.z + f.rz * (arm.half + arm.walk) };
        arm.outL = { x: f.x - f.rx * (arm.half + arm.walk), z: f.z - f.rz * (arm.half + arm.walk) };
      }
      node.corners = [];
      for (let i = 0; i < n; i++) {
        const A = arms[i];
        const B = arms[(i + 1) % n];
        const kerb = cornerCurve(node, A.kerbR, A.mouth, B.kerbL, B.mouth, 10);
        const outer = cornerCurve(node, A.outR, A.mouth, B.outL, B.mouth, 10);
        node.corners.push({ a: A, b: B, kerb, outer });
      }
      // Asphalt outline (clockwise): mouth of each arm followed by the kerb curve to the next arm.
      const outline = [];
      for (let i = 0; i < n; i++) {
        outline.push([arms[i].kerbL.x, arms[i].kerbL.z]);
        for (const p of node.corners[i].kerb) outline.push([p.x, p.z]);
      }
      node.outline = outline;
      let r = 0;
      for (const p of outline) r = Math.max(r, Math.hypot(p[0] - node.x, p[1] - node.z));
      node.radius = r + 6;
    }
  }

  _buildLanes() {
    const lanes = this.lanes;
    const make = () => {
      const l = new LanePath(lanes.length);
      lanes.push(l);
      return l;
    };
    // --- lanes along edges -----------------------------------------------------------
    for (const e of this.edges) {
      e.lanePaths = { 1: [], [-1]: [] };
      for (const dir of [1, -1]) {
        for (let i = 0; i < e.spec.lanes; i++) {
          const inner = e.spec.separatorAfter > 0 && i < e.spec.separatorAfter;
          const startEnd = dir === 1 ? 0 : 1;
          const finishEnd = dir === 1 ? 1 : 0;
          const elevStart = inner && !!e.fly[startEnd];
          const elevFinish = inner && !!e.fly[finishEnd];
          const d0 = elevStart ? 0 : e.trim[startEnd];
          const d1 = elevFinish ? 0 : e.trim[finishEnd];
          const from = dir === 1 ? d0 : e.length - d0;
          const to = dir === 1 ? e.length - d1 : d1;
          const span = Math.abs(to - from);
          const steps = Math.max(2, Math.ceil(span / STEP));
          const lane = make();
          lane.edge = e;
          lane.dir = dir;
          lane.index = i;
          lane.speed = e.spec.speed * (i === 0 && e.spec.lanes > 1 ? 1.06 : i === e.spec.lanes - 1 && e.spec.lanes > 2 ? 0.88 : 1);
          lane.inner = inner;
          lane.elevStart = elevStart;
          lane.elevFinish = elevFinish;
          const off = laneOffset(e.cls, i) * dir;
          for (let k = 0; k <= steps; k++) {
            const s = lerp(from, to, k / steps);
            const fr = e.at(s);
            const y = inner ? e.flyHeight(s) : 0;
            lane.push(fr.x + fr.nx * off, y, fr.z + fr.nz * off);
          }
          const startNode = this.nodes[dir === 1 ? e.a : e.b];
          const finishNode = this.nodes[dir === 1 ? e.b : e.a];
          lane.startNode = startNode;
          lane.endNode = finishNode;
          lane.entry = !!startNode.exit;
          lane.exit = !!finishNode.exit;
          e.lanePaths[dir].push(lane);
        }
      }
    }
    // --- connections at nodes -----------------------------------------------------------
    for (const id in this.nodes) {
      const node = this.nodes[id];
      if (node.arms.length < 2) continue;
      for (const armIn of node.arms) {
        const e = armIn.edge;
        const dirIn = armIn.end === 1 ? 1 : -1; // direction of travel that arrives at this node
        const incoming = e.lanePaths[dirIn];
        const surfaceIn = incoming.filter((l) => !l.elevFinish);
        for (const lane of incoming) {
          if (lane.elevFinish) {
            // Carry straight on across the flyover.
            const f = e.fly[armIn.end];
            const other = f.e0 === e ? f.e1 : f.e0;
            const otherEnd = f.e0 === e ? f.end1 : f.end0;
            const dirOut = otherEnd === 0 ? 1 : -1;
            lane.next.push({ path: other.lanePaths[dirOut][lane.index], turn: 'S' });
            continue;
          }
          if (node.signal) lane.signal = { node, arm: armIn.index };
          const kIn = surfaceIn.indexOf(lane);
          for (const armOut of node.arms) {
            if (armOut === armIn) continue;
            const eo = armOut.edge;
            const dirOut = armOut.end === 0 ? 1 : -1;
            const surfaceOut = eo.lanePaths[dirOut].filter((l) => !l.elevStart);
            if (!surfaceOut.length) continue;
            // Signed turn angle: incoming heading is -armIn.d, outgoing is armOut.d.
            const hx = -armIn.d.x;
            const hz = -armIn.d.z;
            const cross = hx * armOut.d.z - hz * armOut.d.x; // > 0 : clockwise = right turn
            const dot = hx * armOut.d.x + hz * armOut.d.z;
            const ang = Math.atan2(cross, dot);
            let turn = 'S';
            if (ang > 0.62) turn = 'R';
            else if (ang < -0.62) turn = 'L';
            if (Math.abs(ang) > 2.7) continue; // no U-turns
            let target = null;
            if (turn === 'L') {
              if (kIn === surfaceIn.length - 1) target = surfaceOut[surfaceOut.length - 1];
            } else if (turn === 'R') {
              if (kIn === 0) target = surfaceOut[0];
            } else {
              const t = surfaceIn.length > 1 ? kIn / (surfaceIn.length - 1) : 0.5;
              target = surfaceOut[Math.round(t * (surfaceOut.length - 1))];
            }
            if (!target) continue;
            const c = make();
            c.kind = 'connector';
            c.turn = turn;
            c.node = node;
            c.speed = turn === 'S' ? Math.min(lane.speed, target.speed) * 0.85 : 6.2;
            c.freeLeft = turn === 'L';
            buildConnector(c, lane, target);
            c.next.push({ path: target, turn: 'S' });
            lane.next.push({ path: c, turn });
          }
        }
      }
    }
  }

  _buildSidewalkGraph() {
    // Walk nodes sit at both ends of every sidewalk strip; links run along the strip,
    // around junction corners and across the zebra crossing of every arm.
    const nodes = this.walkNodes;
    const links = this.walkLinks;
    const addNode = (x, z) => {
      nodes.push({ id: nodes.length, x, z, links: [] });
      return nodes[nodes.length - 1];
    };
    const addLink = (a, b, pts, kind) => {
      const link = { a, b, pts, kind, length: 0 };
      for (let i = 1; i < pts.length; i++) link.length += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      links.push(link);
      a.links.push(link);
      b.links.push(link);
    };
    for (const e of this.edges) {
      e.walkEnds = { left: [null, null], right: [null, null] };
      const from = e.trim[0];
      const to = e.length - e.trim[1];
      if (to - from < 8) continue;
      for (const side of ['left', 'right']) {
        const off = (e.half + e.walk * 0.5) * (side === 'left' ? 1 : -1);
        const pts = [];
        const steps = Math.max(2, Math.ceil((to - from) / 6));
        for (let k = 0; k <= steps; k++) {
          const fr = e.at(lerp(from, to, k / steps));
          pts.push([fr.x + fr.nx * off, fr.z + fr.nz * off]);
        }
        const a = addNode(pts[0][0], pts[0][1]);
        const b = addNode(pts[pts.length - 1][0], pts[pts.length - 1][1]);
        e.walkEnds[side] = [a, b];
        addLink(a, b, pts, 'walk');
      }
    }
    for (const node of this.junctions) {
      const arms = node.arms;
      // The arm's "right" (clockwise side looking away from the node) maps to an edge side.
      const sideNode = (arm, which) => {
        // looking away from node: right = perp(t). For end 0 travel dir == edge dir so right = edge right.
        const edgeSide = arm.end === 0 ? (which === 'R' ? 'right' : 'left') : which === 'R' ? 'left' : 'right';
        return arm.edge.walkEnds[edgeSide][arm.end];
      };
      for (const c of node.corners) {
        const a = sideNode(c.a, 'R');
        const b = sideNode(c.b, 'L');
        if (!a || !b) continue;
        const pts = c.kerb.map((k, i) => [(k.x + c.outer[i].x) / 2, (k.z + c.outer[i].z) / 2]);
        addLink(a, b, [[a.x, a.z], ...pts, [b.x, b.z]], 'corner');
      }
      if (arms.length >= 3) {
        for (const arm of arms) {
          const a = sideNode(arm, 'L');
          const b = sideNode(arm, 'R');
          if (!a || !b) continue;
          const f = this.armFrame(arm, arm.trim + 2.2);
          const w = arm.half + arm.walk * 0.5;
          addLink(a, b, [[a.x, a.z], [f.x - f.rx * w, f.z - f.rz * w], [f.x + f.rx * w, f.z + f.rz * w], [b.x, b.z]], 'cross');
          arm.crossing = { x: f.x, z: f.z, rx: f.rx, rz: f.rz, tx: f.tx, tz: f.tz, half: arm.half };
        }
      }
    }
  }

  /** Signal state for an arm of a signalised junction. One arm gets green at a time. */
  signalState(node, armIndex, time) {
    const n = node.arms.length;
    const green = n > 3 ? 9 : 11;
    const yellow = 2.2;
    const allRed = 1.3;
    const slot = green + yellow + allRed;
    const phase = (time + (node.x * 0.37 + node.z * 0.11)) % (slot * n);
    const t = ((phase % (slot * n)) + slot * n) % (slot * n);
    const active = Math.floor(t / slot);
    if (active !== armIndex) return 'red';
    const local = t - active * slot;
    if (local < green) return 'green';
    if (local < green + yellow) return 'yellow';
    return 'red';
  }
}

function cornerCurve(node, pa, fa, pb, fb, segments) {
  // Bezier from pa (on arm A) to pb (on arm B). Control point = intersection of the two kerb
  // lines when it lies toward the node, else a point pulled toward the node.
  let cx;
  let cz;
  const hit = lineIntersect(pa.x, pa.z, fa.tx, fa.tz, pb.x, pb.z, fb.tx, fb.tz);
  const mx = (pa.x + pb.x) / 2;
  const mz = (pa.z + pb.z) / 2;
  const span = Math.hypot(pa.x - pb.x, pa.z - pb.z);
  let ok = false;
  if (hit) {
    const ta = (hit.x - pa.x) * fa.tx + (hit.z - pa.z) * fa.tz;
    const tb = (hit.x - pb.x) * fb.tx + (hit.z - pb.z) * fb.tz;
    if (ta < 0.5 && tb < 0.5 && Math.hypot(hit.x - mx, hit.z - mz) < span * 1.2) {
      cx = hit.x;
      cz = hit.z;
      ok = true;
    }
  }
  if (!ok) {
    cx = mx;
    cz = mz;
  }
  // Soften the corner a little so kerbs read as rounded rather than pointed.
  cx = lerp(cx, mx, 0.25);
  cz = lerp(cz, mz, 0.25);
  const out = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = 1 - t;
    out.push({ x: u * u * pa.x + 2 * u * t * cx + t * t * pb.x, z: u * u * pa.z + 2 * u * t * cz + t * t * pb.z });
  }
  return out;
}

function buildConnector(c, from, to) {
  const n0 = from.pts.length / 3;
  const ax = from.pts[(n0 - 1) * 3];
  const az = from.pts[(n0 - 1) * 3 + 2];
  const apx = from.pts[(n0 - 2) * 3];
  const apz = from.pts[(n0 - 2) * 3 + 2];
  let adx = ax - apx;
  let adz = az - apz;
  let l = Math.hypot(adx, adz) || 1;
  adx /= l;
  adz /= l;
  const bx = to.pts[0];
  const bz = to.pts[2];
  let bdx = to.pts[3] - bx;
  let bdz = to.pts[5] - bz;
  l = Math.hypot(bdx, bdz) || 1;
  bdx /= l;
  bdz /= l;
  const dist = Math.hypot(bx - ax, bz - az);
  const k = dist * (c.turn === 'S' ? 0.33 : 0.48);
  const c1x = ax + adx * k;
  const c1z = az + adz * k;
  const c2x = bx - bdx * k;
  const c2z = bz - bdz * k;
  const steps = Math.max(4, Math.ceil(dist / 2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const x = u * u * u * ax + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * bx;
    const z = u * u * u * az + 3 * u * u * t * c1z + 3 * u * t * t * c2z + t * t * t * bz;
    c.push(x, 0, z);
  }
}
