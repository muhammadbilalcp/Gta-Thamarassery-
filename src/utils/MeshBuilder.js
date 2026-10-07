// Accumulates triangles into a BufferGeometry. Used by every procedural mesh in the game.

import * as THREE from 'three';

export class MeshBuilder {
  constructor({ uv2 = false, color = false, layer = false } = {}) {
    this.layer = layer ? [] : null;
    this.curLayer = 0; // texture-array layer written to every new vertex
    this.tint = WHITE; // default vertex colour when none is passed
    this.p = [];
    this.n = [];
    this.uv = [];
    this.uv2 = uv2 ? [] : null;
    this.col = color ? [] : null;
    this.idx = [];
    this.count = 0;
  }

  get empty() {
    return this.idx.length === 0;
  }

  vertex(x, y, z, nx, ny, nz, u = 0, v = 0, u2 = 0, v2 = 0, r = 1, g = 1, b = 1) {
    this.p.push(x, y, z);
    this.n.push(nx, ny, nz);
    this.uv.push(u, v);
    if (this.uv2) this.uv2.push(u2, v2);
    if (this.col) this.col.push(r, g, b);
    if (this.layer) this.layer.push(this.curLayer);
    return this.count++;
  }

  tri(a, b, c) {
    this.idx.push(a, b, c);
  }

  /**
   * Flat quad from four corner points given in order around the quad.
   * `uvs` is [[u,v] x4]. Winding is fixed up automatically so the face points along `hint`.
   */
  quad(p0, p1, p2, p3, uvs = QUAD_UV, hint = null, color = null, uvs2 = null) {
    const ax = p1[0] - p0[0];
    const ay = p1[1] - p0[1];
    const az = p1[2] - p0[2];
    const bx = p3[0] - p0[0];
    const by = p3[1] - p0[1];
    const bz = p3[2] - p0[2];
    let nx = ay * bz - az * by;
    let ny = az * bx - ax * bz;
    let nz = ax * by - ay * bx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    let flip = false;
    if (hint && nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) {
      flip = true;
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
    const c = color || this.tint;
    const u2 = uvs2 || uvs;
    const i0 = this.vertex(p0[0], p0[1], p0[2], nx, ny, nz, uvs[0][0], uvs[0][1], u2[0][0], u2[0][1], c[0], c[1], c[2]);
    const i1 = this.vertex(p1[0], p1[1], p1[2], nx, ny, nz, uvs[1][0], uvs[1][1], u2[1][0], u2[1][1], c[0], c[1], c[2]);
    const i2 = this.vertex(p2[0], p2[1], p2[2], nx, ny, nz, uvs[2][0], uvs[2][1], u2[2][0], u2[2][1], c[0], c[1], c[2]);
    const i3 = this.vertex(p3[0], p3[1], p3[2], nx, ny, nz, uvs[3][0], uvs[3][1], u2[3][0], u2[3][1], c[0], c[1], c[2]);
    if (flip) {
      this.idx.push(i0, i2, i1, i0, i3, i2);
    } else {
      this.idx.push(i0, i1, i2, i0, i2, i3);
    }
  }

  /**
   * Axis aligned box rotated about Y. UVs are in metres scaled by `uvScale` so textures keep
   * their real size. `faces` selects which sides to emit (default: all but the bottom).
   */
  box(cx, cy, cz, sx, sy, sz, rot = 0, { uvScale = 1, faces = 'xXzZY', color = null, uvOffset = 0 } = {}) {
    const hx = sx / 2;
    const hy = sy / 2;
    const hz = sz / 2;
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const P = (lx, ly, lz) => [cx + lx * c - lz * s, cy + ly, cz + lx * s + lz * c];
    const N = (lx, lz) => [lx * c - lz * s, 0, lx * s + lz * c];
    const uv = (w, h) => [
      [uvOffset, 0],
      [uvOffset + w * uvScale, 0],
      [uvOffset + w * uvScale, h * uvScale],
      [uvOffset, h * uvScale],
    ];
    if (faces.includes('X')) this.quad(P(hx, -hy, hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(hx, hy, hz), uv(sz, sy), N(1, 0), color);
    if (faces.includes('x')) this.quad(P(-hx, -hy, -hz), P(-hx, -hy, hz), P(-hx, hy, hz), P(-hx, hy, -hz), uv(sz, sy), N(-1, 0), color);
    if (faces.includes('Z')) this.quad(P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz), uv(sx, sy), N(0, 1), color);
    if (faces.includes('z')) this.quad(P(hx, -hy, -hz), P(-hx, -hy, -hz), P(-hx, hy, -hz), P(hx, hy, -hz), uv(sx, sy), N(0, -1), color);
    if (faces.includes('Y')) this.quad(P(-hx, hy, hz), P(hx, hy, hz), P(hx, hy, -hz), P(-hx, hy, -hz), uv(sx, sz), [0, 1, 0], color);
    if (faces.includes('y')) this.quad(P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, -hy, hz), P(-hx, -hy, hz), uv(sx, sz), [0, -1, 0], color);
  }

  /** Square-section beam between two arbitrary points (a, b are [x, y, z]). */
  beam(a, b, width, depth = width, { color = null, uvScale = 0.25, widthEnd = width, depthEnd = depth } = {}) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-5) return;
    // Side vector: horizontal and perpendicular to the beam (falls back to X for vertical beams).
    let sx = dz;
    let sz = -dx;
    let sl = Math.hypot(sx, sz);
    if (sl < 1e-5) {
      sx = 1;
      sz = 0;
      sl = 1;
    }
    sx /= sl;
    sz /= sl;
    // Up vector = side x direction.
    const ux = (0 * dz - sz * dy) / len;
    const uy = (sz * dx - sx * dz) / len;
    const uz = (sx * dy - 0 * dx) / len;
    const corner = (p, w, d, i, j) => [p[0] + sx * w * i + ux * d * j, p[1] + uy * d * j, p[2] + sz * w * i + uz * d * j];
    const w0 = width / 2;
    const d0 = depth / 2;
    const w1 = widthEnd / 2;
    const d1 = depthEnd / 2;
    const faces = [
      [1, 1, 1, -1, [sx, 0, sz]],
      [-1, -1, -1, 1, [-sx, 0, -sz]],
      [-1, 1, 1, 1, [ux, uy, uz]],
      [1, -1, -1, -1, [-ux, -uy, -uz]],
    ];
    for (const [i0, j0, i1, j1, n] of faces) {
      const p0 = corner(a, w0, d0, i0, j0);
      const p1 = corner(a, w0, d0, i1, j1);
      const p2 = corner(b, w1, d1, i1, j1);
      const p3 = corner(b, w1, d1, i0, j0);
      const span = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
      this.quad(p0, p1, p2, p3, [[0, 0], [span * uvScale, 0], [span * uvScale, len * uvScale], [0, len * uvScale]], n, color);
    }
  }

  /** Vertical cylinder / cone frustum with optional caps. */
  cylinder(cx, y0, cz, r0, r1, h, seg = 12, { color = null, cap = true, uvScale = 1 } = {}) {
    const c = color || this.tint;
    const base = this.count;
    const slope = (r0 - r1) / h;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const nl = Math.hypot(1, slope);
      const u = (i / seg) * Math.PI * 2 * Math.max(r0, r1) * uvScale;
      this.vertex(cx + ca * r0, y0, cz + sa * r0, ca / nl, slope / nl, sa / nl, u, 0, u, 0, c[0], c[1], c[2]);
      this.vertex(cx + ca * r1, y0 + h, cz + sa * r1, ca / nl, slope / nl, sa / nl, u, h * uvScale, u, h * uvScale, c[0], c[1], c[2]);
    }
    for (let i = 0; i < seg; i++) {
      const a = base + i * 2;
      this.idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
    if (cap && r1 > 0.001) {
      const centre = this.vertex(cx, y0 + h, cz, 0, 1, 0, 0.5, 0.5, 0.5, 0.5, c[0], c[1], c[2]);
      const ring = this.count;
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        this.vertex(cx + Math.cos(a) * r1, y0 + h, cz + Math.sin(a) * r1, 0, 1, 0, 0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5, 0, 0, c[0], c[1], c[2]);
      }
      for (let i = 0; i < seg; i++) this.idx.push(centre, ring + i + 1, ring + i);
    }
  }

  /**
   * Ribbon through rows of points. rows[k] = [[x,y,z,u,v], ...] with the same count in every
   * row. Normals are smoothed afterwards by build({ smooth: true }).
   */
  ribbon(rows, hint = [0, 1, 0], color = null, uv2Scale = 0) {
    const c = color || this.tint;
    const width = rows[0].length;
    const base = this.count;
    for (const row of rows) {
      for (const v of row) {
        const u2 = uv2Scale ? v[0] * uv2Scale : v[3];
        const v2 = uv2Scale ? v[2] * uv2Scale : v[4];
        // Optional per-vertex normal in v[5..7] (kerb faces, parapets on curved roads).
        if (v.length >= 8) this.vertex(v[0], v[1], v[2], v[5], v[6], v[7], v[3], v[4], u2, v2, c[0], c[1], c[2]);
        else this.vertex(v[0], v[1], v[2], hint[0], hint[1], hint[2], v[3], v[4], u2, v2, c[0], c[1], c[2]);
      }
    }
    if (rows[0][0].length >= 8) hint = [rows[0][0][5], rows[0][0][6], rows[0][0][7]];
    // Decide winding from the first cell.
    const a = rows[0][0];
    const b = rows[0][1];
    const d = rows[1][0];
    const nx = (b[1] - a[1]) * (d[2] - a[2]) - (b[2] - a[2]) * (d[1] - a[1]);
    const ny = (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]);
    const nz = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
    const flip = nx * hint[0] + ny * hint[1] + nz * hint[2] < 0;
    for (let k = 0; k < rows.length - 1; k++) {
      for (let i = 0; i < width - 1; i++) {
        const i0 = base + k * width + i;
        const i1 = i0 + 1;
        const i2 = i0 + width + 1;
        const i3 = i0 + width;
        if (flip) this.idx.push(i0, i2, i1, i0, i3, i2);
        else this.idx.push(i0, i1, i2, i0, i2, i3);
      }
    }
  }

  /** Triangle fan over a flat polygon at height y (polygon as [[x,z],...]). */
  polygon(points, y, uvScale = 1, up = true, color = null, centre = null) {
    const c = color || this.tint;
    let cx = 0;
    let cz = 0;
    if (centre) {
      cx = centre[0];
      cz = centre[1];
    } else {
      for (const p of points) {
        cx += p[0];
        cz += p[1];
      }
      cx /= points.length;
      cz /= points.length;
    }
    const ny = up ? 1 : -1;
    const ci = this.vertex(cx, y, cz, 0, ny, 0, cx * uvScale, cz * uvScale, cx * uvScale, cz * uvScale, c[0], c[1], c[2]);
    const base = this.count;
    for (const p of points) this.vertex(p[0], y, p[1], 0, ny, 0, p[0] * uvScale, p[1] * uvScale, p[0] * uvScale, p[1] * uvScale, c[0], c[1], c[2]);
    // Orientation of the outline decides the winding.
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      area += a[0] * b[1] - b[0] * a[1];
    }
    const ccwInXZ = area > 0; // x -> z positive rotation, which faces -Y
    for (let i = 0; i < points.length; i++) {
      const a = base + i;
      const b = base + ((i + 1) % points.length);
      if (ccwInXZ === up) this.idx.push(ci, b, a);
      else this.idx.push(ci, a, b);
    }
  }

  build({ smooth = false } = {}) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.uv2) g.setAttribute('uv1', new THREE.Float32BufferAttribute(this.uv2, 2));
    if (this.col) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    if (this.layer) g.setAttribute('aLayer', new THREE.Float32BufferAttribute(this.layer, 1));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    if (smooth) g.computeVertexNormals();
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

const QUAD_UV = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];
const WHITE = [1, 1, 1];

/**
 * A view on a shared MeshBuilder that always writes with its own texture layer and tint.
 * Many surfaces share one builder per world cell; going through a writer means the order
 * in which different surfaces are drawn never matters.
 */
export class SurfaceWriter {
  constructor(builder, layer, tint) {
    this.b = builder;
    this.curLayer = layer;
    this.tint = tint;
  }
  _apply() {
    this.b.curLayer = this.curLayer;
    this.b.tint = this.tint;
    return this.b;
  }
  get count() {
    return this.b.count;
  }
  vertex(...a) {
    return this._apply().vertex(...a);
  }
  tri(...a) {
    return this.b.tri(...a);
  }
  quad(...a) {
    return this._apply().quad(...a);
  }
  box(...a) {
    return this._apply().box(...a);
  }
  beam(...a) {
    return this._apply().beam(...a);
  }
  cylinder(...a) {
    return this._apply().cylinder(...a);
  }
  ribbon(...a) {
    return this._apply().ribbon(...a);
  }
  polygon(...a) {
    return this._apply().polygon(...a);
  }
}
