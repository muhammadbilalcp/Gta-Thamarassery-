// Geometry toolkit for procedural vehicles. Every part carries the same attributes:
//   position, normal, uv (into the shared vehicle atlas), color and
//   aSurf = (paint mask, roughness, metalness, light type)
// so that a whole vehicle merges into one draw call.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// light types stored in aSurf.w
export const LIGHT = { NONE: 0, HEAD: 1, TAIL: 2, INDICATOR: 3 };

export const SURF = {
  paint: { color: [1, 1, 1], surf: [1, 0.3, 0.35, 0] },
  paintMatte: { color: [1, 1, 1], surf: [1, 0.6, 0.05, 0] },
  glass: { color: [0.075, 0.09, 0.1], surf: [0, 0.1, 0.92, 0] },
  black: { color: [0.035, 0.035, 0.04], surf: [0, 0.62, 0.05, 0] },
  rubber: { color: [0.025, 0.025, 0.028], surf: [0, 0.9, 0, 0] },
  darkGrey: { color: [0.12, 0.12, 0.13], surf: [0, 0.55, 0.3, 0] },
  chrome: { color: [0.86, 0.87, 0.88], surf: [0, 0.16, 1, 0] },
  steel: { color: [0.45, 0.46, 0.48], surf: [0, 0.38, 0.9, 0] },
  alloy: { color: [0.7, 0.71, 0.73], surf: [0, 0.3, 0.95, 0] },
  head: { color: [0.86, 0.88, 0.9], surf: [0, 0.12, 0.75, LIGHT.HEAD] },
  tail: { color: [0.5, 0.0, 0.0], surf: [0, 0.18, 0.1, LIGHT.TAIL] },
  indicator: { color: [0.85, 0.36, 0.02], surf: [0, 0.2, 0.1, LIGHT.INDICATOR] },
  white: { color: [0.92, 0.92, 0.9], surf: [0, 0.5, 0.05, 0] },
  yellow: { color: [0.93, 0.68, 0.06], surf: [0, 0.5, 0.05, 0] },
  ksrtcRed: { color: [0.5, 0.03, 0.03], surf: [0, 0.38, 0.2, 0] },
  cream: { color: [0.9, 0.84, 0.62], surf: [0, 0.45, 0.1, 0] },
  seat: { color: [0.09, 0.08, 0.08], surf: [0, 0.8, 0, 0] },
  skin: { color: [0.52, 0.34, 0.24], surf: [0, 0.75, 0, 0] },
  cloth: { color: [1, 1, 1], surf: [0.85, 0.9, 0, 0] },
  trouser: { color: [0.1, 0.11, 0.16], surf: [0, 0.9, 0, 0] },
  helmet: { color: [0.06, 0.06, 0.07], surf: [0, 0.2, 0.3, 0] },
  plate: { color: [1, 1, 1], surf: [0, 0.45, 0, 0] },
  canvasYellow: { color: [0.9, 0.66, 0.05], surf: [0, 0.75, 0, 0] },
};

export const WHITE_UV = [0.985, 0.015];

/** Stamp uniform colour / surface attributes on a geometry and optionally transform it. */
export function part(geo, surface, matrix = null, uvRect = null) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  if (matrix) g.applyMatrix4(matrix);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  const surf = new Float32Array(n * 4);
  const s = typeof surface === 'string' ? SURF[surface] : surface;
  for (let i = 0; i < n; i++) {
    col.set(s.color, i * 3);
    surf.set(s.surf, i * 4);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSurf', new THREE.BufferAttribute(surf, 4));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  const uv = g.attributes.uv;
  if (uvRect) {
    for (let i = 0; i < n; i++) {
      uv.setXY(i, uvRect.u0 + uv.getX(i) * (uvRect.u1 - uvRect.u0), uvRect.v0 + uv.getY(i) * (uvRect.v1 - uvRect.v0));
    }
  } else {
    for (let i = 0; i < n; i++) uv.setXY(i, WHITE_UV[0], WHITE_UV[1]);
  }
  // Drop attributes that would stop geometries from merging.
  for (const key of Object.keys(g.attributes)) {
    if (!['position', 'normal', 'uv', 'color', 'aSurf'].includes(key)) g.deleteAttribute(key);
  }
  return g;
}

const M = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const E = new THREE.Euler();

/** Transform matrix from position, euler rotation and scale. */
export function xf(px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  E.set(rx, ry, rz, 'YXZ');
  Q.setFromEuler(E);
  return new THREE.Matrix4().compose(new THREE.Vector3(px, py, pz), Q.clone(), new THREE.Vector3(sx, sy, sz));
}

export const box = (w, h, d, surface, m, uvRect) => part(new THREE.BoxGeometry(w, h, d), surface, m, uvRect);

/** Box with softened edges - reads far better than a hard cube on bodywork. */
export function roundBox(w, h, d, r, surface, m, seg = 1) {
  const shape = new THREE.Shape();
  const hw = w / 2 - r;
  const hh = h / 2 - r;
  shape.moveTo(-hw, -h / 2);
  shape.lineTo(hw, -h / 2);
  shape.absarc(hw, -hh, r, -Math.PI / 2, 0, false);
  shape.lineTo(w / 2, hh);
  shape.absarc(hw, hh, r, 0, Math.PI / 2, false);
  shape.lineTo(-hw, h / 2);
  shape.absarc(-hw, hh, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(-w / 2, -hh);
  shape.absarc(-hw, -hh, r, Math.PI, Math.PI * 1.5, false);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, d - r * 2),
    bevelEnabled: true,
    bevelThickness: r,
    bevelSize: r,
    bevelSegments: seg,
    curveSegments: Math.max(2, seg + 1),
  });
  g.translate(0, 0, -(d - r * 2) / 2);
  return part(g, surface, m);
}

export const cyl = (r0, r1, h, seg, surface, m) => part(new THREE.CylinderGeometry(r1, r0, h, seg, 1), surface, m);

export const sphere = (r, surface, m, ws = 8, hs = 6) => part(new THREE.SphereGeometry(r, ws, hs), surface, m);

export const capsule = (r, len, surface, m) => part(new THREE.CapsuleGeometry(r, len, 2, 7), surface, m);

export const torus = (R, r, surface, m, arc = Math.PI * 2, rs = 5, ts = 12) => part(new THREE.TorusGeometry(R, r, rs, ts, arc), surface, m);

/** Tube from point a to point b (array [x,y,z]). */
export function tube(a, b, r, surface, seg = 8, r1 = r) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const d = new THREE.Vector3().subVectors(B, A);
  const len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  M.compose(A.add(B).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
  return part(new THREE.CylinderGeometry(r1, r, len, seg, 1), surface, M.clone());
}

/** Flat quad facing +Z before transformation, mapped to an atlas rectangle. */
export function decal(w, h, uvRect, m, surface = 'plate') {
  return part(new THREE.PlaneGeometry(w, h), surface, m, uvRect);
}

export function merge(parts) {
  const list = parts.flat(Infinity).filter(Boolean);
  const g = mergeGeometries(list, false);
  for (const p of list) p.dispose();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/** Piecewise smooth curve through [[x, y], ...] (x ascending). */
export function curve(table) {
  return (x) => {
    const n = table.length;
    if (x <= table[0][0]) return table[0][1];
    if (x >= table[n - 1][0]) return table[n - 1][1];
    let i = 0;
    while (i < n - 2 && table[i + 1][0] < x) i++;
    const p0 = table[Math.max(0, i - 1)];
    const p1 = table[i];
    const p2 = table[i + 1];
    const p3 = table[Math.min(n - 1, i + 2)];
    const t = (x - p1[0]) / (p2[0] - p1[0]);
    // Finite difference tangents scaled to the segment, clamped to avoid overshoot.
    const span = p2[0] - p1[0];
    let m1 = ((p2[1] - p0[1]) / (p2[0] - p0[0] || 1)) * span;
    let m2 = ((p3[1] - p1[1]) / (p3[0] - p1[0] || 1)) * span;
    const d = p2[1] - p1[1];
    if (d === 0) {
      m1 = 0;
      m2 = 0;
    } else {
      if (m1 / d < 0) m1 = 0;
      if (m2 / d < 0) m2 = 0;
      m1 = Math.sign(m1) * Math.min(Math.abs(m1), Math.abs(d) * 3);
      m2 = Math.sign(m2) * Math.min(Math.abs(m2), Math.abs(d) * 3);
    }
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2;
  };
}
