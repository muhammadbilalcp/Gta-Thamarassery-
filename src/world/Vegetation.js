// Kerala is green. Coconut palms, rain trees, banana clumps and bougainvillea hedges are
// instanced per world cell from a single alpha-tested atlas, and sway gently in the breeze.

import * as THREE from 'three';
import { MeshBuilder } from '../utils/MeshBuilder.js';
import { SURF } from './SurfaceMap.js';
import { CORE } from './layout.js';
import { makeCanvas, canvasTexture } from '../utils/canvas.js';
import { RNG } from '../utils/rng.js';
import { lerp } from '../utils/math.js';

const CELL = 380;

// Atlas regions in UV space (v measured from the bottom).
const R = {
  frond: { u0: 0.004, u1: 0.246, v0: 0.004, v1: 0.996 },
  banana: { u0: 0.254, u1: 0.496, v0: 0.004, v1: 0.996 },
  leaves: { u0: 0.504, u1: 0.996, v0: 0.504, v1: 0.996 },
  palmBark: { u0: 0.504, u1: 0.746, v0: 0.004, v1: 0.496 },
  treeBark: { u0: 0.754, u1: 0.996, v0: 0.004, v1: 0.496 },
};

function buildAtlas(assets) {
  const S = 1024;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const rng = new RNG(31);
  ctx.clearRect(0, 0, S, S);

  // --- coconut frond: rib with leaflets, canvas x 0..256, full height
  {
    const w = 256;
    const cx = w / 2;
    for (let y = 10; y < S - 10; y += 5) {
      const t = y / S; // 0 at tip (top of canvas) .. 1 at base
      const reach = (w / 2 - 8) * Math.sin(Math.min(1, (1 - t) * 1.25 + 0.12) * Math.PI * 0.5) * (0.35 + 0.65 * Math.min(1, t * 4));
      for (const s of [-1, 1]) {
        const g = 70 + rng.int(0, 70);
        ctx.strokeStyle = `rgb(${40 + rng.int(0, 40)},${g + 50},${30 + rng.int(0, 30)})`;
        ctx.lineWidth = 4.2;
        ctx.beginPath();
        ctx.moveTo(cx, y);
        ctx.quadraticCurveTo(cx + s * reach * 0.6, y - 16, cx + s * reach, y - 34 + rng.int(-6, 6));
        ctx.stroke();
      }
    }
    ctx.strokeStyle = '#8a9a48';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(cx, 4);
    ctx.lineTo(cx, S - 4);
    ctx.stroke();
  }
  // --- banana leaf
  {
    const x0 = 256;
    const w = 256;
    const cx = x0 + w / 2;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, 12);
    ctx.bezierCurveTo(cx + w * 0.52, S * 0.2, cx + w * 0.5, S * 0.75, cx, S - 60);
    ctx.bezierCurveTo(cx - w * 0.5, S * 0.75, cx - w * 0.52, S * 0.2, cx, 12);
    ctx.closePath();
    const g = ctx.createLinearGradient(x0, 0, x0 + w, 0);
    g.addColorStop(0, '#3f7d2c');
    g.addColorStop(0.5, '#78b046');
    g.addColorStop(1, '#3f7d2c');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.clip();
    ctx.strokeStyle = 'rgba(30,70,20,0.45)';
    ctx.lineWidth = 2;
    for (let y = 20; y < S; y += 13) {
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(x0, y - 50);
      ctx.moveTo(cx, y);
      ctx.lineTo(x0 + w, y - 50);
      ctx.stroke();
    }
    // Wind-torn slits.
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 5;
    for (let i = 0; i < 16; i++) {
      const y = rng.int(80, S - 160);
      const s = rng.sign();
      ctx.beginPath();
      ctx.moveTo(cx + s * w * 0.5, y - 40);
      ctx.lineTo(cx + s * w * rng.float(0.1, 0.3), y - 40 + rng.int(28, 44));
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#b9c86a';
    ctx.fillRect(cx - 4, 10, 8, S - 20);
  }
  // --- leaf cluster (top right 512 x 512)
  {
    const x0 = 512;
    const y0 = 0;
    for (let i = 0; i < 520; i++) {
      const a = rng.float(0, Math.PI * 2);
      const r = Math.sqrt(rng.next()) * 236;
      const x = x0 + 256 + Math.cos(a) * r;
      const y = y0 + 256 + Math.sin(a) * r * 0.92;
      const l = rng.float(16, 34);
      const shadeK = rng.float(0.55, 1.15) * (0.75 + 0.25 * (1 - (y - y0) / 512));
      ctx.fillStyle = `rgb(${Math.round(58 * shadeK)},${Math.round(128 * shadeK)},${Math.round(44 * shadeK)})`;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rng.float(0, Math.PI * 2));
      ctx.beginPath();
      ctx.ellipse(0, 0, l, l * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(20,50,15,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-l, 0);
      ctx.lineTo(l, 0);
      ctx.stroke();
      ctx.restore();
    }
  }
  // --- palm bark (ringed)
  {
    const x0 = 512;
    const y0 = 512;
    ctx.fillStyle = '#8a8172';
    ctx.fillRect(x0, y0, 256, 512);
    for (let y = y0; y < y0 + 512; y += 17) {
      ctx.fillStyle = `rgba(40,34,28,${rng.float(0.35, 0.6)})`;
      ctx.fillRect(x0, y + rng.int(-2, 2), 256, rng.int(3, 6));
      ctx.fillStyle = `rgba(190,180,160,${rng.float(0.08, 0.2)})`;
      ctx.fillRect(x0, y + 7, 256, 5);
    }
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = `rgba(${rng.int(30, 70)},${rng.int(30, 60)},${rng.int(20, 50)},${rng.float(0.1, 0.35)})`;
      ctx.fillRect(x0 + rng.int(0, 252), y0 + rng.int(0, 508), rng.int(2, 5), rng.int(6, 24));
    }
  }
  // --- tree bark
  {
    const x0 = 768;
    const y0 = 512;
    ctx.fillStyle = '#5d5044';
    ctx.fillRect(x0, y0, 256, 512);
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = `rgba(${rng.int(20, 120)},${rng.int(20, 100)},${rng.int(15, 80)},${rng.float(0.15, 0.45)})`;
      ctx.fillRect(x0 + rng.int(0, 252), y0 + rng.int(0, 500), rng.int(3, 8), rng.int(14, 60));
    }
    // Moss toward the base.
    const g = ctx.createLinearGradient(0, y0 + 300, 0, y0 + 512);
    g.addColorStop(0, 'rgba(70,100,50,0)');
    g.addColorStop(1, 'rgba(70,100,50,0.5)');
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, 256, 512);
  }
  const tex = canvasTexture(c, { anisotropy: Math.min(4, assets.maxAniso) });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

const uvIn = (r, u, v) => [lerp(r.u0, r.u1, u), lerp(r.v0, r.v1, v)];

class PlantBuilder {
  constructor() {
    this.b = new MeshBuilder({ color: true, uv2: true });
  }

  /** Tapered, bent trunk. Sway weight is stored in uv1.x. */
  trunk(points, r0, r1, region, tint, swayTop, seg = 7) {
    const b = this.b;
    const n = points.length;
    const base = b.count;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const p = points[i];
      const r = lerp(r0, r1, t) * (i === 0 ? 1.25 : 1);
      for (let k = 0; k <= seg; k++) {
        const a = (k / seg) * Math.PI * 2;
        const nx = Math.cos(a);
        const nz = Math.sin(a);
        const uv = uvIn(region, k / seg, t);
        b.vertex(p[0] + nx * r, p[1], p[2] + nz * r, nx, 0.1, nz, uv[0], uv[1], swayTop * t * t, 0, tint[0], tint[1], tint[2]);
      }
    }
    for (let i = 0; i < n - 1; i++) {
      for (let k = 0; k < seg; k++) {
        const a = base + i * (seg + 1) + k;
        const c = a + seg + 1;
        b.tri(a, c, a + 1);
        b.tri(a + 1, c, c + 1);
      }
    }
  }

  /**
   * A leaf blade following a drooping spine. Cross-section is a shallow inverted V so the
   * leaf has volume from every angle.
   */
  blade(origin, dir, up, length, width, droop, region, tint, sway, segs = 5, fold = 0.35) {
    const b = this.b;
    const side = new THREE.Vector3().crossVectors(dir, up).normalize();
    const rows = [];
    const p = new THREE.Vector3().copy(origin);
    const d = new THREE.Vector3().copy(dir);
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const w = width * Math.sin(Math.min(1, t * 1.15 + 0.12) * Math.PI) * 0.5 + width * 0.06;
      rows.push({ p: p.clone(), w, t, d: d.clone() });
      // Advance along the spine and bend it downwards.
      p.addScaledVector(d, length / segs);
      d.y -= (droop / segs) * (0.6 + t * 1.2);
      d.normalize();
    }
    const base = b.count;
    for (const r of rows) {
      const n = new THREE.Vector3().crossVectors(side, r.d).normalize();
      const drop = r.w * fold;
      const sw = sway * (0.25 + r.t * 0.75);
      const l = r.p.clone().addScaledVector(side, -r.w).addScaledVector(n, -drop);
      const c = r.p;
      const rr = r.p.clone().addScaledVector(side, r.w).addScaledVector(n, -drop);
      const shadeK = 0.78 + 0.3 * r.t;
      const uvL = uvIn(region, 0, r.t);
      const uvC = uvIn(region, 0.5, r.t);
      const uvR = uvIn(region, 1, r.t);
      b.vertex(l.x, l.y, l.z, n.x - side.x * 0.4, n.y + 0.3, n.z - side.z * 0.4, uvL[0], uvL[1], sw, 0, tint[0] * shadeK, tint[1] * shadeK, tint[2] * shadeK);
      b.vertex(c.x, c.y, c.z, n.x, n.y + 0.3, n.z, uvC[0], uvC[1], sw, 0, tint[0] * shadeK, tint[1] * shadeK, tint[2] * shadeK);
      b.vertex(rr.x, rr.y, rr.z, n.x + side.x * 0.4, n.y + 0.3, n.z + side.z * 0.4, uvR[0], uvR[1], sw, 0, tint[0] * shadeK, tint[1] * shadeK, tint[2] * shadeK);
    }
    for (let i = 0; i < segs; i++) {
      const a = base + i * 3;
      b.tri(a, a + 1, a + 3);
      b.tri(a + 1, a + 4, a + 3);
      b.tri(a + 1, a + 2, a + 4);
      b.tri(a + 2, a + 5, a + 4);
    }
  }

  /** Cluster of crossed leaf cards with normals bent away from `centre` for soft shading. */
  cluster(pos, size, centre, tint, sway, cards = 3) {
    const b = this.b;
    // Pseudo-random but repeatable orientation per cluster.
    const h = Math.abs(Math.sin(pos.x * 12.9898 + pos.y * 78.233 + pos.z * 37.719) * 43758.5453) % 1;
    for (let k = 0; k < cards; k++) {
      const a = (k / cards) * Math.PI + h * Math.PI;
      const tilt = (k === cards - 1 && cards > 2 ? 1.15 : 0.25) + (h - 0.5) * 0.5;
      const ax = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const ay = new THREE.Vector3(Math.sin(a) * Math.sin(tilt), Math.cos(tilt), -Math.cos(a) * Math.sin(tilt));
      const corners = [
        [-1, -1, 0, 0],
        [1, -1, 1, 0],
        [1, 1, 1, 1],
        [-1, 1, 0, 1],
      ];
      const base = b.count;
      for (const [sx, sy, u, v] of corners) {
        const p = pos.clone().addScaledVector(ax, sx * size).addScaledVector(ay, sy * size * 0.85);
        // Normals lean outwards and up so the crown shades like a rounded mass.
        const n = p.clone().sub(centre).normalize();
        n.y = Math.abs(n.y) * 0.5 + 0.75;
        n.normalize();
        const uv = uvIn(R.leaves, u, v);
        const k2 = 0.78 + 0.22 * ((sy + 1) / 2);
        b.vertex(p.x, p.y, p.z, n.x, n.y, n.z, uv[0], uv[1], sway, 0, tint[0] * k2, tint[1] * k2, tint[2] * k2);
      }
      b.tri(base, base + 1, base + 2);
      b.tri(base, base + 2, base + 3);
    }
  }

  build() {
    const g = this.b.build();
    return g;
  }
}

function palm(seed, height, lean, lo = false) {
  const rng = new RNG(seed);
  const pb = new PlantBuilder();
  const pts = [];
  const n = lo ? 4 : 8;
  const dir = rng.float(0, Math.PI * 2);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const off = lean * t * t;
    pts.push([Math.cos(dir) * off, height * t, Math.sin(dir) * off]);
  }
  pb.trunk(pts, 0.24, 0.15, R.palmBark, [1, 1, 1], 0.35, lo ? 5 : 7);
  const top = new THREE.Vector3(pts[n][0], pts[n][1], pts[n][2]);
  const fronds = lo ? 10 : 15;
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2 + rng.float(-0.2, 0.2);
    const ring = i % 3; // upright young fronds, level ones, hanging old ones
    const elev = ring === 0 ? rng.float(0.75, 1.05) : ring === 1 ? rng.float(0.3, 0.55) : rng.float(-0.1, 0.15);
    const d = new THREE.Vector3(Math.cos(a) * Math.cos(elev), Math.sin(elev), Math.sin(a) * Math.cos(elev));
    const len = rng.float(4.2, 5.6) * (ring === 2 ? 0.92 : 1);
    const g = ring === 2 ? [0.78, 0.8, 0.5] : [rng.float(0.8, 1), rng.float(0.9, 1.05), rng.float(0.7, 0.9)];
    pb.blade(top, d, new THREE.Vector3(0, 1, 0), len, lo ? 1.45 : 1.25, ring === 0 ? 1.5 : ring === 1 ? 1.25 : 0.9, R.frond, g, 1, lo ? 3 : 5, 0.42);
  }
  if (!lo) {
    // Coconuts tucked under the crown.
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const p = top.clone().add(new THREE.Vector3(Math.cos(a) * 0.3, -0.35, Math.sin(a) * 0.3));
      pb.cluster(p, 0.2, top, [0.5, 0.75, 0.25], 0.3, 2);
    }
  }
  return pb.build();
}

function broadTree(seed, height, spread, lo = false) {
  const rng = new RNG(seed);
  const pb = new PlantBuilder();
  const trunkH = height * 0.42;
  pb.trunk(
    [
      [0, 0, 0],
      [0.1, trunkH * 0.5, 0.05],
      [0.0, trunkH, -0.05],
    ],
    0.42,
    0.26,
    R.treeBark,
    [1, 1, 1],
    0.1,
    lo ? 5 : 7,
  );
  const centre = new THREE.Vector3(0, trunkH + height * 0.3, 0);
  // Limbs.
  for (let i = 0; i < (lo ? 0 : 4); i++) {
    const a = (i / 4) * Math.PI * 2 + rng.float(0, 0.8);
    const end = [Math.cos(a) * spread * 0.55, trunkH + height * rng.float(0.2, 0.34), Math.sin(a) * spread * 0.55];
    pb.trunk([[0, trunkH - 0.4, 0], [end[0] * 0.5, lerp(trunkH, end[1], 0.6), end[2] * 0.5], end], 0.2, 0.07, R.treeBark, [0.9, 0.9, 0.9], 0.3, 5);
  }
  const clusters = lo ? 13 : 30;
  for (let i = 0; i < clusters; i++) {
    const a = rng.float(0, Math.PI * 2);
    const r = Math.sqrt(rng.next()) * spread;
    const y = trunkH + height * rng.float(0.1, 0.6) * (1 - (r / spread) * 0.5);
    const p = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    // Inner clusters sit in shade, outer and upper ones catch the light.
    const lit = 0.62 + 0.38 * Math.min(1, r / spread + ((y - trunkH) / (height * 0.6)) * 0.5);
    const k = rng.float(0.85, 1.1) * lit;
    pb.cluster(p, rng.float(1.5, 2.2) * (lo ? 1.45 : 1), centre, [0.72 * k, 0.98 * k, 0.6 * k], 0.6, lo ? 2 : 3);
  }
  return pb.build();
}

function banana(seed, lo = false) {
  const rng = new RNG(seed);
  const pb = new PlantBuilder();
  for (let s = 0; s < (lo ? 2 : 3); s++) {
    const ox = rng.float(-0.7, 0.7);
    const oz = rng.float(-0.7, 0.7);
    const h = rng.float(1.6, 2.4);
    pb.trunk([[ox, 0, oz], [ox + 0.05, h * 0.5, oz], [ox, h, oz]], 0.15, 0.09, R.palmBark, [0.55, 0.85, 0.4], 0.3, lo ? 4 : 6);
    const top = new THREE.Vector3(ox, h, oz);
    const leaves = lo ? 4 : rng.int(5, 7);
    for (let i = 0; i < leaves; i++) {
      const a = (i / leaves) * Math.PI * 2 + rng.float(-0.3, 0.3);
      const elev = rng.float(0.35, 1.1);
      const d = new THREE.Vector3(Math.cos(a) * Math.cos(elev), Math.sin(elev), Math.sin(a) * Math.cos(elev));
      pb.blade(top, d, new THREE.Vector3(0, 1, 0), rng.float(1.9, 2.7), lo ? 0.75 : 0.62, 1.5, R.banana, [0.95, 1, 0.9], 1, lo ? 2 : 4, 0.12);
    }
  }
  return pb.build();
}

function shrub(seed, flower) {
  const rng = new RNG(seed);
  const pb = new PlantBuilder();
  const centre = new THREE.Vector3(0, 0.3, 0);
  for (let i = 0; i < 6; i++) {
    const a = rng.float(0, Math.PI * 2);
    const r = rng.float(0, 0.55);
    const p = new THREE.Vector3(Math.cos(a) * r, rng.float(0.4, 0.95), Math.sin(a) * r);
    const pink = flower && i % 2 === 0;
    pb.cluster(p, rng.float(0.5, 0.78), centre, pink ? [2.6, 0.5, 1.5] : [0.8, 1, 0.7], 0.5, 2);
  }
  return pb.build();
}

export class Vegetation {
  constructor(world) {
    this.world = world;
    this.assets = world.assets;
    this.surface = world.surface;
    this.terrain = world.terrain;
    this.roads = world.roads;
    this.colliders = world.colliders;
    this.quality = world.quality;
    this.group = new THREE.Group();
    this.group.name = 'vegetation';
    this.rng = new RNG(777);
    this.cells = new Map();
    this.time = 0;
  }

  build() {
    const tex = buildAtlas(this.assets);
    const uniforms = { uTime: { value: 0 } };
    this.uniforms = uniforms;
    const sway = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\n#ifndef USE_UV1\nattribute vec2 uv1;\n#endif')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          #ifdef USE_INSTANCING
            float ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
          #else
            float ph = 0.0;
          #endif
          float sw = uv1.x;
          float gust = sin(uTime * 0.7 + ph * 0.2) * 0.5 + 0.5;
          transformed.x += (sin(uTime * 1.6 + ph + position.y * 0.35) * 0.16 + gust * 0.22) * sw;
          transformed.z += cos(uTime * 1.25 + ph * 1.3 + position.x * 0.4) * 0.12 * sw;
          transformed.y += sin(uTime * 2.1 + ph + position.x * 0.8 + position.z * 0.6) * 0.06 * sw;`,
        );
    };
    this.material = new THREE.MeshStandardMaterial({
      map: tex,
      vertexColors: true,
      alphaTest: 0.42,
      side: THREE.DoubleSide,
      roughness: 1,
      metalness: 0,
      envMapIntensity: 0.25,
    });
    this.material.onBeforeCompile = sway;
    this.depthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.42 });
    this.depthMaterial.onBeforeCompile = sway;

    this.types = {
      palmA: palm(1, 10.5, 1.4),
      palmB: palm(2, 12.5, 2.6),
      palmC: palm(3, 8.5, 0.6),
      treeA: broadTree(4, 10, 5.2),
      treeB: broadTree(5, 8, 4.2),
      banana: banana(6),
      shrub: shrub(7, false),
      bougainvillea: shrub(8, true),
    };
    // Lighter stand-ins for the distance.
    this.far = {
      palmA: palm(1, 10.5, 1.4, true),
      palmB: palm(2, 12.5, 2.6, true),
      palmC: palm(3, 8.5, 0.6, true),
      treeA: broadTree(4, 10, 5.2, true),
      treeB: broadTree(5, 8, 4.2, true),
      banana: banana(6, true),
    };
    this._streetTrees();
    this._medians();
    this._scatter();
    this._instantiate();
    return this.group;
  }

  _add(type, x, z, scale, rot, y = null) {
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    const key = `${type}|${cx}|${cz}`;
    let list = this.cells.get(key);
    if (!list) this.cells.set(key, (list = { type, items: [] }));
    list.items.push([x, y ?? this.surface.heightAt(x, z) - 0.05, z, scale, rot]);
  }

  _tree(x, z, big = false) {
    const rng = this.rng;
    const palmy = rng.chance(big ? 0.45 : 0.68);
    if (palmy) {
      this._add(rng.pick(['palmA', 'palmA', 'palmB', 'palmC']), x, z, rng.float(0.85, 1.2), rng.float(0, Math.PI * 2));
      this.colliders.addCircle(x, z, 0.28, -1, 9, 'palm');
    } else {
      this._add(rng.pick(['treeA', 'treeB']), x, z, rng.float(0.8, 1.25), rng.float(0, Math.PI * 2));
      this.colliders.addCircle(x, z, 0.45, -1, 4, 'tree');
    }
  }

  _streetTrees() {
    const rng = this.rng;
    for (const e of this.roads.edges) {
      for (const side of [1, -1]) {
        let s = e.trim[0] + rng.float(6, 14);
        const end = e.length - e.trim[1] - 6;
        while (s < end) {
          const f = e.at(s);
          const lat = side * (e.half + e.walk + rng.float(0.9, 1.8));
          const x = f.x + f.nx * lat;
          const z = f.z + f.nz * lat;
          const t = this.surface.typeAt(x, z);
          if ((t === SURF.LAND || t === SURF.VERGE || t === SURF.OPEN) && this.terrain.waterDistance(x, z) > 2) this._tree(x, z, true);
          s += rng.float(13, 26);
        }
      }
    }
  }

  _medians() {
    const rng = this.rng;
    for (const e of this.roads.edges) {
      if (!e.medianRange) continue;
      for (let s = e.medianRange[0] + 2; s < e.medianRange[1] - 2; s += rng.float(2.6, 4.2)) {
        const f = e.at(s);
        if (this.surface.typeAt(f.x, f.z) !== SURF.MEDIAN) continue;
        // Leave room around metro piers and street lights.
        if (rng.chance(0.18)) continue;
        this._add(rng.chance(0.4) ? 'bougainvillea' : 'shrub', f.x, f.z, rng.float(0.7, 1.05), rng.float(0, 6.28), 0.3);
      }
    }
  }

  _scatter() {
    const rng = this.rng;
    const count = Math.round(15000 * (this.quality.vegetation ?? 1));
    const w = CORE.maxX - CORE.minX + 160;
    const h = CORE.maxZ - CORE.minZ + 160;
    for (let i = 0; i < count; i++) {
      const x = CORE.minX - 80 + rng.next() * w;
      const z = CORE.minZ - 80 + rng.next() * h;
      const t = this.surface.typeAt(x, z);
      if (t !== SURF.LAND && t !== SURF.VERGE && t !== SURF.OPEN) continue;
      const wd = this.terrain.waterDistance(x, z);
      if (wd < 1.2) continue;
      // Keep a little clear of walls and buildings.
      let blocked = false;
      for (const [dx, dz] of [[1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6]]) {
        const tt = this.surface.typeAt(x + dx, z + dz);
        if (tt === SURF.BUILDING || tt === SURF.ROAD || tt === SURF.SIDEWALK) blocked = true;
      }
      if (blocked) continue;
      const r = rng.next();
      if (wd < 9 && rng.chance(0.7)) {
        // Palms crowd the water's edge.
        this._add(rng.pick(['palmA', 'palmB', 'palmB']), x, z, rng.float(0.9, 1.25), rng.float(0, 6.28));
        this.colliders.addCircle(x, z, 0.28, -2, 9, 'palm');
      } else if (r < 0.5) this._tree(x, z);
      else if (r < 0.62) this._tree(x, z, true);
      else if (r < 0.8) this._add('banana', x, z, rng.float(0.8, 1.3), rng.float(0, 6.28));
      else this._add(rng.chance(0.3) ? 'bougainvillea' : 'shrub', x, z, rng.float(0.9, 1.7), rng.float(0, 6.28));
    }
  }

  _instantiate() {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    let total = 0;
    const LOD_AT = 210;
    for (const [, cell] of this.cells) {
      const geo = this.types[cell.type];
      const mesh = new THREE.InstancedMesh(geo, this.material, cell.items.length);
      cell.items.forEach((it, i) => {
        p.set(it[0], it[1], it[2]);
        q.setFromAxisAngle(up, it[4]);
        s.set(it[3], it[3] * (0.92 + ((i * 37) % 17) / 100), it[3]);
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.computeBoundingBox();
      mesh.castShadow = true;
      mesh.receiveShadow = false; // self-shadowing leaf cards read as black blotches
      mesh.customDepthMaterial = this.depthMaterial;
      mesh.matrixAutoUpdate = false;
      mesh.name = `veg-${cell.type}`;
      this.group.add(mesh);
      const farGeo = this.far[cell.type];
      if (farGeo) {
        mesh.userData.lod = { near: true, at: LOD_AT };
        const lo = new THREE.InstancedMesh(farGeo, this.material, cell.items.length);
        lo.instanceMatrix = mesh.instanceMatrix;
        lo.boundingSphere = mesh.boundingSphere;
        lo.boundingBox = mesh.boundingBox;
        lo.castShadow = false;
        lo.receiveShadow = false;
        lo.matrixAutoUpdate = false;
        lo.name = `veg-${cell.type}-far`;
        lo.userData.lod = { near: false, at: LOD_AT };
        this.group.add(lo);
      } else {
        // Shrubs simply disappear in the distance.
        mesh.userData.lod = { near: true, at: 420 };
      }
      total += cell.items.length;
    }
    this.total = total;
    this.cells.clear();
  }

  update(dt) {
    this.time += dt;
    this.uniforms.uTime.value = this.time;
  }
}
