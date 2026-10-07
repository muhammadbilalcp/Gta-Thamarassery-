// Lofted car bodies. A car is described by a handful of curves along its length (roof
// line, belt line, plan width ...); cross-sections are swept between them to get a smooth
// shell with real tumblehome, a raked windscreen and rounded corners.

import * as THREE from 'three';
import { SURF, WHITE_UV, curve } from './parts.js';

const SUB = 2; // ring subdivisions between profile keys
const KEYS = 8;

function ringKeys(f, zIn) {
  // Inside the nose / tail the section is the shoulder section shrunk towards its centre,
  // which rounds the ends off without any folds.
  const nose = f.nose;
  let z = zIn;
  let t = 0;
  if (zIn > f.z1 - nose) {
    z = f.z1 - nose;
    t = (zIn - z) / nose;
  } else if (zIn < f.z0 + nose) {
    z = f.z0 + nose;
    t = (z - zIn) / nose;
  }
  const keys = ringKeysAt(f, z);
  if (t <= 0) return keys;
  const sx = 1 - 0.2 * t * t;
  const sy = 1 - 0.26 * t * t;
  const yc = (keys[0][1] + keys[keys.length - 1][1]) * 0.47;
  return keys.map((k) => [k[0] * sx, yc + (k[1] - yc) * sy]);
}

function ringKeysAt(f, z) {
  const yb = f.under(z);
  const wm = f.width(z);
  const yt = f.top(z);
  const ys = Math.min(f.belt(z), yt - 0.05);
  const wt = Math.min(f.roofWidth(z), wm * 0.96);
  const crown = f.crown ?? 0.025;
  const drop = f.edgeDrop ?? 0.06;
  const inset = f.roofInset ?? 0.76;
  const sill = f.sill ?? 0.1;
  return [
    [0, yb],
    [wm * 0.72, yb],
    [wm * 0.965, yb + sill],
    [wm, yb + (ys - yb) * 0.56],
    [wm * 0.975, ys],
    [wt, Math.max(ys + 0.004, yt - drop)],
    [wt * inset, yt],
    [0, yt + crown],
  ];
}

function ringPoints(keys) {
  // Catmull-Rom through the keys, SUB segments per span.
  const pts = [];
  const n = keys.length;
  for (let k = 0; k < n - 1; k++) {
    const p0 = keys[Math.max(0, k - 1)];
    const p1 = keys[k];
    const p2 = keys[k + 1];
    const p3 = keys[Math.min(n - 1, k + 2)];
    for (let s = 0; s < SUB; s++) {
      const t = s / SUB;
      const t2 = t * t;
      const t3 = t2 * t;
      const out = [0, 0];
      for (let a = 0; a < 2; a++) {
        const m1 = (p2[a] - p0[a]) * 0.4;
        const m2 = (p3[a] - p1[a]) * 0.4;
        out[a] = (2 * t3 - 3 * t2 + 1) * p1[a] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[a] + (t3 - t2) * m2;
      }
      out[0] = Math.max(0, out[0]);
      pts.push(out);
    }
  }
  pts.push(keys[n - 1].slice());
  return pts;
}

export function loftBody(shape) {
  const f = {
    top: curve(shape.top),
    belt: curve(shape.belt),
    width: curve(shape.width),
    roofWidth: curve(shape.roofWidth),
    under: curve(shape.under),
    crown: shape.crown,
    edgeDrop: shape.edgeDrop,
    roofInset: shape.roofInset,
    sill: shape.sill,
    nose: shape.nose ?? 0.16,
  };
  const z0 = shape.top[0][0];
  const z1 = shape.top[shape.top.length - 1][0];
  f.z0 = z0;
  f.z1 = z1;
  const Z = shape.zones;
  const pw = (Z.pillarWidth ?? 0.1) / 2;

  // Stations: every zone boundary plus regular fill so curves stay smooth.
  const marks = new Set([z0, z1]);
  for (const t of [shape.top, shape.belt, shape.width]) for (const p of t) marks.add(p[0]);
  for (const key of ['windshield', 'rear', 'side']) if (Z[key]) Z[key].forEach((v) => marks.add(v));
  for (const p of Z.pillars || []) {
    marks.add(p - pw);
    marks.add(p + pw);
  }
  const bumper = shape.bumper ?? 0.22;
  for (const k of [0.35, 0.7, 1]) {
    marks.add(z0 + f.nose * k);
    marks.add(z1 - f.nose * k);
  }
  const sorted = [...marks].filter((v) => v >= z0 && v <= z1).sort((a, b) => a - b);
  void bumper;
  const stations = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] < 0.012) continue;
    if (i > 0) {
      const prev = stations[stations.length - 1];
      const gap = sorted[i] - prev;
      const n = Math.ceil(gap / 0.26);
      for (let k = 1; k < n; k++) stations.push(prev + (gap * k) / n);
    }
    stations.push(sorted[i]);
  }

  const rings = stations.map((z) => ringPoints(ringKeys(f, z)));
  const R = rings.length;
  const N = rings[0].length;
  const midY = (f.under(0) + f.top(0)) / 2;

  const classify = (z, band) => {
    if (band <= 1) return SURF.black;
    if (band === 6) {
      if (Z.windshield && z > Z.windshield[0] && z < Z.windshield[1]) return SURF.glass;
      if (Z.rear && z > Z.rear[0] && z < Z.rear[1]) return SURF.glass;
      if (Z.board && z > Z.board[0] && z < Z.board[1]) return SURF.black;
      if (shape.roofSurface) return SURF[shape.roofSurface];
      return SURF.paint;
    }
    if (band === 5) return shape.roofSurface && z > Z.side[0] && z < Z.side[1] ? SURF[shape.roofSurface] : SURF.paint;
    if (band === 4) {
      if (Z.side && z > Z.side[0] && z < Z.side[1]) {
        for (const p of Z.pillars || []) if (Math.abs(z - p) < pw) return shape.pillarSurface ? SURF[shape.pillarSurface] : SURF.black;
        return shape.openSides ? SURF.seat : SURF.glass;
      }
      return SURF.paint;
    }
    if (shape.stripe && band === 3) return SURF[shape.stripe];
    if (shape.lowerSurface && band <= 3) return SURF[shape.lowerSurface];
    return SURF.paint;
  };

  // Smooth normals on the grid.
  const normals = [];
  const P = (i, j) => {
    const ii = Math.max(0, Math.min(R - 1, i));
    const jj = Math.max(0, Math.min(N - 1, j));
    return [rings[ii][jj][0], rings[ii][jj][1], stations[ii]];
  };
  for (let i = 0; i < R; i++) {
    normals.push([]);
    for (let j = 0; j < N; j++) {
      const a = P(i + 1, j);
      const b = P(i - 1, j);
      const c = P(i, j + 1);
      const d = P(i, j - 1);
      const ux = a[0] - b[0];
      const uy = a[1] - b[1];
      const uz = a[2] - b[2];
      const vx = c[0] - d[0];
      const vy = c[1] - d[1];
      const vz = c[2] - d[2];
      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      const p = P(i, j);
      if (nx * p[0] + ny * (p[1] - midY) < 0) {
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }
      if (j === 0 || j === N - 1) nx = 0;
      const l = Math.hypot(nx, ny, nz) || 1;
      normals[i].push([nx / l, ny / l, nz / l]);
    }
  }

  const pos = [];
  const nor = [];
  const col = [];
  const surf = [];
  const uv = [];
  const pushV = (p, n, s, mirror) => {
    const m = mirror ? -1 : 1;
    pos.push(p[0] * m, p[1], p[2]);
    nor.push(n[0] * m, n[1], n[2]);
    col.push(s.color[0], s.color[1], s.color[2]);
    surf.push(s.surf[0], s.surf[1], s.surf[2], s.surf[3]);
    uv.push(WHITE_UV[0], WHITE_UV[1]);
  };
  const tri = (a, b, c, s, mirror) => {
    // a,b,c = [point, normal]; keep the face pointing the way its normals do.
    const ax = b[0][0] - a[0][0];
    const ay = b[0][1] - a[0][1];
    const az = b[0][2] - a[0][2];
    const bx = c[0][0] - a[0][0];
    const by = c[0][1] - a[0][1];
    const bz = c[0][2] - a[0][2];
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    if (nx * nx + ny * ny + nz * nz < 1e-12) return;
    const avg = [a[1][0] + b[1][0] + c[1][0], a[1][1] + b[1][1] + c[1][1], a[1][2] + b[1][2] + c[1][2]];
    let order = nx * avg[0] + ny * avg[1] + nz * avg[2] >= 0 ? [a, b, c] : [a, c, b];
    if (mirror) order = [order[0], order[2], order[1]];
    for (const v of order) pushV(v[0], v[1], s, mirror);
  };

  for (let i = 0; i < R - 1; i++) {
    const zm = (stations[i] + stations[i + 1]) / 2;
    for (let j = 0; j < N - 1; j++) {
      const band = Math.min(KEYS - 2, Math.floor(j / SUB));
      const s = classify(zm, band);
      const a = [P(i, j), normals[i][j]];
      const b = [P(i + 1, j), normals[i + 1][j]];
      const c = [P(i + 1, j + 1), normals[i + 1][j + 1]];
      const d = [P(i, j + 1), normals[i][j + 1]];
      for (const mirror of [false, true]) {
        tri(a, b, c, s, mirror);
        tri(a, c, d, s, mirror);
      }
    }
  }
  // End caps.
  for (const end of [0, R - 1]) {
    const dir = end === 0 ? -1 : 1;
    const centre = [[0, midY, stations[end] + dir * 0.03], [0, 0, dir]];
    for (let j = 0; j < N - 1; j++) {
      const a = [P(end, j), [normals[end][j][0] * 0.5, normals[end][j][1] * 0.5, dir]];
      const b = [P(end, j + 1), [normals[end][j + 1][0] * 0.5, normals[end][j + 1][1] * 0.5, dir]];
      for (const mirror of [false, true]) tri(centre, a, b, shape.capSurface ? SURF[shape.capSurface] : shape.lowerSurface ? SURF[shape.lowerSurface] : SURF.paint, mirror);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aSurf', new THREE.Float32BufferAttribute(surf, 4));
  g.userData.fn = f;
  return g;
}
