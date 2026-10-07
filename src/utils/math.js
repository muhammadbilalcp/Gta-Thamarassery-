// Small math helpers shared across the game.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const saturate = (v) => clamp(v, 0, 1);
export const smoothstep = (a, b, v) => {
  const t = saturate((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const TAU = Math.PI * 2;

/** Frame-rate independent exponential damping. */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

/** Shortest signed angular difference b - a in (-PI, PI]. */
export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

export const dampAngle = (a, b, lambda, dt) => a + angleDiff(a, b) * (1 - Math.exp(-lambda * dt));

export const dist2 = (ax, az, bx, bz) => {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
};

/** Intersection of two 2D lines given as point + direction. Returns null when parallel. */
export function lineIntersect(px, pz, dx, dz, qx, qz, ex, ez) {
  const det = dx * ez - dz * ex;
  if (Math.abs(det) < 1e-6) return null;
  const t = ((qx - px) * ez - (qz - pz) * ex) / det;
  return { x: px + dx * t, z: pz + dz * t, t };
}

/** Centripetal-ish Catmull-Rom through 2D points, sampled to roughly `step` metres. */
export function smoothPolyline(points, step = 3) {
  if (points.length < 3) return resample(points, step);
  const dense = [];
  const n = points.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(n - 1, i + 2)];
    const segLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const steps = Math.max(2, Math.ceil(segLen / 1.5));
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      dense.push(catmull(p0, p1, p2, p3, t));
    }
  }
  dense.push(points[n - 1].slice());
  return resample(dense, step);
}

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  const out = [0, 0];
  // Tension 0.5 with tangents softened so tight control polygons do not overshoot.
  for (let i = 0; i < 2; i++) {
    const m1 = (p2[i] - p0[i]) * 0.42;
    const m2 = (p3[i] - p1[i]) * 0.42;
    out[i] =
      (2 * t3 - 3 * t2 + 1) * p1[i] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[i] + (t3 - t2) * m2;
  }
  return out;
}

/** Resample a polyline to (approximately) uniform spacing, keeping both end points. */
export function resample(points, step) {
  let total = 0;
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    cum.push(total);
  }
  const count = Math.max(1, Math.round(total / step));
  const out = [];
  let j = 0;
  for (let i = 0; i <= count; i++) {
    const d = (i / count) * total;
    while (j < points.length - 2 && cum[j + 1] < d) j++;
    const span = cum[j + 1] - cum[j] || 1;
    const t = (d - cum[j]) / span;
    out.push([lerp(points[j][0], points[j + 1][0], t), lerp(points[j][1], points[j + 1][1], t)]);
  }
  return out;
}

export function polylineLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return total;
}

/** Point in polygon (array of [x,z]). */
export function pointInPolygon(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const zi = poly[i][1];
    const xj = poly[j][0];
    const zj = poly[j][1];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Distance from point to segment, plus the parametric position along it. */
export function pointSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz || 1e-9;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / len2, 0, 1);
  const cx = ax + dx * t;
  const cz = az + dz * t;
  return { d: Math.hypot(px - cx, pz - cz), t, x: cx, z: cz };
}

export function distToPolyline(px, pz, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const r = pointSegment(px, pz, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    if (r.d < best) best = r.d;
  }
  return best;
}

/** Signed distance to polygon boundary: negative inside. */
export function signedDistPolygon(px, pz, poly) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const r = pointSegment(px, pz, poly[j][0], poly[j][1], poly[i][0], poly[i][1]);
    if (r.d < best) best = r.d;
  }
  return pointInPolygon(px, pz, poly) ? -best : best;
}
