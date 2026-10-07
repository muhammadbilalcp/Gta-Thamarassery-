// Static collision world. Everything solid is a vertical prism: an oriented box or a
// cylinder with a height range, stored in a uniform grid.

const CELL = 24;

export class CollisionWorld {
  constructor() {
    this.items = [];
    this.grid = new Map();
    this._stamp = 0;
  }

  _key(i, j) {
    return (i + 4096) * 8192 + (j + 4096);
  }

  _insert(item, minX, minZ, maxX, maxZ) {
    const i0 = Math.floor(minX / CELL);
    const i1 = Math.floor(maxX / CELL);
    const j0 = Math.floor(minZ / CELL);
    const j1 = Math.floor(maxZ / CELL);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const k = this._key(i, j);
        let cell = this.grid.get(k);
        if (!cell) {
          cell = [];
          this.grid.set(k, cell);
        }
        cell.push(item);
      }
    }
    this.items.push(item);
    return item;
  }

  addBox(cx, cz, hx, hz, rot = 0, y0 = -5, y1 = 50, tag = '') {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const ex = Math.abs(hx * c) + Math.abs(hz * s);
    const ez = Math.abs(hx * s) + Math.abs(hz * c);
    return this._insert({ type: 0, x: cx, z: cz, hx, hz, c, s, y0, y1, tag, stamp: 0 }, cx - ex, cz - ez, cx + ex, cz + ez);
  }

  addCircle(cx, cz, r, y0 = -5, y1 = 50, tag = '') {
    return this._insert({ type: 1, x: cx, z: cz, r, y0, y1, tag, stamp: 0 }, cx - r, cz - r, cx + r, cz + r);
  }

  /** Thin wall between two points. */
  addWall(ax, az, bx, bz, thickness, y0, y1, tag = '') {
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) return null;
    return this.addBox((ax + bx) / 2, (az + bz) / 2, len / 2, thickness / 2, Math.atan2(dz, dx), y0, y1, tag);
  }

  /**
   * Push a vertical cylinder (x, z, radius, y-range) out of everything it overlaps.
   * Mutates `p` and returns the number of contacts; the summed push normal is left in `out`.
   */
  resolveCircle(p, radius, y0, y1, out) {
    const stamp = ++this._stamp;
    let hits = 0;
    if (out) {
      out.nx = 0;
      out.nz = 0;
      out.depth = 0;
    }
    const i0 = Math.floor((p.x - radius) / CELL);
    const i1 = Math.floor((p.x + radius) / CELL);
    const j0 = Math.floor((p.z - radius) / CELL);
    const j1 = Math.floor((p.z + radius) / CELL);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const cell = this.grid.get(this._key(i, j));
        if (!cell) continue;
        for (let k = 0; k < cell.length; k++) {
          const it = cell[k];
          if (it.stamp === stamp) continue;
          it.stamp = stamp;
          if (y1 < it.y0 || y0 > it.y1) continue;
          let nx = 0;
          let nz = 0;
          let depth = 0;
          if (it.type === 1) {
            const dx = p.x - it.x;
            const dz = p.z - it.z;
            const d = Math.hypot(dx, dz);
            const min = radius + it.r;
            if (d >= min) continue;
            if (d < 1e-4) {
              nx = 1;
              nz = 0;
            } else {
              nx = dx / d;
              nz = dz / d;
            }
            depth = min - d;
          } else {
            // Into box space.
            const dx = p.x - it.x;
            const dz = p.z - it.z;
            const lx = dx * it.c + dz * it.s;
            const lz = -dx * it.s + dz * it.c;
            const qx = Math.max(-it.hx, Math.min(it.hx, lx));
            const qz = Math.max(-it.hz, Math.min(it.hz, lz));
            let ox = lx - qx;
            let oz = lz - qz;
            const d = Math.hypot(ox, oz);
            if (d >= radius) continue;
            if (d < 1e-4) {
              // Centre is inside: leave through the nearest face.
              const px = it.hx - Math.abs(lx);
              const pz = it.hz - Math.abs(lz);
              if (px < pz) {
                ox = Math.sign(lx) || 1;
                oz = 0;
                depth = px + radius;
              } else {
                ox = 0;
                oz = Math.sign(lz) || 1;
                depth = pz + radius;
              }
            } else {
              ox /= d;
              oz /= d;
              depth = radius - d;
            }
            nx = ox * it.c - oz * it.s;
            nz = ox * it.s + oz * it.c;
          }
          p.x += nx * depth;
          p.z += nz * depth;
          hits++;
          if (out) {
            out.nx += nx;
            out.nz += nz;
            out.depth = Math.max(out.depth, depth);
            out.tag = it.tag;
          }
        }
      }
    }
    if (out && hits > 0) {
      const l = Math.hypot(out.nx, out.nz) || 1;
      out.nx /= l;
      out.nz /= l;
    }
    return hits;
  }

  /** Distance along a 3D ray to the first solid, or maxDist. Used by the camera. */
  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    const stamp = ++this._stamp;
    let best = maxDist;
    // Walk the grid coarsely: sample cells along the ray.
    const steps = Math.ceil(maxDist / (CELL * 0.5)) + 1;
    let lastKey = null;
    for (let s = 0; s <= steps; s++) {
      const t = Math.min(maxDist, s * CELL * 0.5);
      const cx = Math.floor((ox + dx * t) / CELL);
      const cz = Math.floor((oz + dz * t) / CELL);
      for (let a = -1; a <= 1; a++) {
        for (let b = -1; b <= 1; b++) {
          const key = this._key(cx + a, cz + b);
          if (key === lastKey) continue;
          const cell = this.grid.get(key);
          if (!cell) continue;
          for (let k = 0; k < cell.length; k++) {
            const it = cell[k];
            if (it.stamp === stamp) continue;
            it.stamp = stamp;
            if (it.noCamera) continue;
            const hit = it.type === 1 ? rayCylinder(it, ox, oy, oz, dx, dy, dz) : rayBox(it, ox, oy, oz, dx, dy, dz);
            if (hit !== null && hit < best) best = hit;
          }
        }
      }
      lastKey = this._key(cx, cz);
    }
    return best;
  }
}

function rayBox(it, ox, oy, oz, dx, dy, dz) {
  const rx = ox - it.x;
  const rz = oz - it.z;
  const lx = rx * it.c + rz * it.s;
  const lz = -rx * it.s + rz * it.c;
  const ldx = dx * it.c + dz * it.s;
  const ldz = -dx * it.s + dz * it.c;
  let tmin = 0;
  let tmax = Infinity;
  const slab = (o, d, lo, hi) => {
    if (Math.abs(d) < 1e-7) return o >= lo && o <= hi;
    let t1 = (lo - o) / d;
    let t2 = (hi - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    return tmin <= tmax;
  };
  if (!slab(lx, ldx, -it.hx, it.hx)) return null;
  if (!slab(lz, ldz, -it.hz, it.hz)) return null;
  if (!slab(oy, dy, it.y0, it.y1)) return null;
  return tmin;
}

function rayCylinder(it, ox, oy, oz, dx, dy, dz) {
  const rx = ox - it.x;
  const rz = oz - it.z;
  const a = dx * dx + dz * dz;
  if (a < 1e-8) return null;
  const b = 2 * (rx * dx + rz * dz);
  const c = rx * rx + rz * rz - it.r * it.r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  if (t < 0) return null;
  const y = oy + dy * t;
  if (y < it.y0 || y > it.y1) return null;
  return t;
}
