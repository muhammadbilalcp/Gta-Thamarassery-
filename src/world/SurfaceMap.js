// 1 m raster of what the ground is made of. Used for physics heights, placement of
// buildings / vegetation, pedestrian walkability and the minimap.

import { WORLD } from './layout.js';
import { clamp } from '../utils/math.js';

export const SURF = {
  LAND: 0,
  ROAD: 1,
  SIDEWALK: 2,
  MEDIAN: 3,
  PAVED: 4, // plazas, parking aprons
  BUILDING: 5,
  RESERVED: 6, // landmark plots - keep clear of procedural filler
  VERGE: 7, // strip beside roads kept free of buildings
  OPEN: 8, // lawns and forecourts: nothing is built here but trees may grow
};

export const SURF_HEIGHT = {
  [SURF.ROAD]: 0.03,
  [SURF.SIDEWALK]: 0.19,
  [SURF.MEDIAN]: 0.33,
  [SURF.PAVED]: 0.06,
};

export class SurfaceMap {
  constructor(terrain) {
    this.terrain = terrain;
    this.minX = WORLD.minX - 60;
    this.minZ = WORLD.minZ - 60;
    this.w = Math.ceil(WORLD.maxX - WORLD.minX + 120);
    this.h = Math.ceil(WORLD.maxZ - WORLD.minZ + 120);
    this.data = new Uint8Array(this.w * this.h);
  }

  index(x, z) {
    const i = Math.floor(x - this.minX);
    const j = Math.floor(z - this.minZ);
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return -1;
    return j * this.w + i;
  }

  typeAt(x, z) {
    const k = this.index(x, z);
    return k < 0 ? SURF.LAND : this.data[k];
  }

  /** Rasterise a triangle. `keep` lists types that must not be overwritten. */
  tri(ax, az, bx, bz, cx, cz, type, keep = null) {
    const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx) - this.minX));
    const maxX = Math.min(this.w - 1, Math.ceil(Math.max(ax, bx, cx) - this.minX));
    const minZ = Math.max(0, Math.floor(Math.min(az, bz, cz) - this.minZ));
    const maxZ = Math.min(this.h - 1, Math.ceil(Math.max(az, bz, cz) - this.minZ));
    const area = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
    if (Math.abs(area) < 1e-6) return;
    const inv = 1 / area;
    for (let j = minZ; j <= maxZ; j++) {
      const pz = this.minZ + j + 0.5;
      for (let i = minX; i <= maxX; i++) {
        const px = this.minX + i + 0.5;
        const w0 = ((bx - px) * (cz - pz) - (bz - pz) * (cx - px)) * inv;
        const w1 = ((cx - px) * (az - pz) - (cz - pz) * (ax - px)) * inv;
        const w2 = 1 - w0 - w1;
        if (w0 < -0.001 || w1 < -0.001 || w2 < -0.001) continue;
        const k = j * this.w + i;
        if (keep && keep.includes(this.data[k])) continue;
        this.data[k] = type;
      }
    }
  }

  quad(a, b, c, d, type, keep) {
    this.tri(a[0], a[1], b[0], b[1], c[0], c[1], type, keep);
    this.tri(a[0], a[1], c[0], c[1], d[0], d[1], type, keep);
  }

  /** Oriented rectangle. */
  rect(cx, cz, hx, hz, rot, type, keep) {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const p = (lx, lz) => [cx + lx * c - lz * s, cz + lx * s + lz * c];
    this.quad(p(-hx, -hz), p(hx, -hz), p(hx, hz), p(-hx, hz), type, keep);
  }

  circle(cx, cz, r, type, keep) {
    const minX = Math.max(0, Math.floor(cx - r - this.minX));
    const maxX = Math.min(this.w - 1, Math.ceil(cx + r - this.minX));
    const minZ = Math.max(0, Math.floor(cz - r - this.minZ));
    const maxZ = Math.min(this.h - 1, Math.ceil(cz + r - this.minZ));
    for (let j = minZ; j <= maxZ; j++) {
      for (let i = minX; i <= maxX; i++) {
        const dx = this.minX + i + 0.5 - cx;
        const dz = this.minZ + j + 0.5 - cz;
        if (dx * dx + dz * dz > r * r) continue;
        const k = j * this.w + i;
        if (keep && keep.includes(this.data[k])) continue;
        this.data[k] = type;
      }
    }
  }

  /** True when every cell of the oriented rectangle is one of `allowed`. */
  rectIsFree(cx, cz, hx, hz, rot, allowed) {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const stepX = Math.max(1, Math.ceil(hx * 2));
    const stepZ = Math.max(1, Math.ceil(hz * 2));
    for (let a = 0; a <= stepX; a++) {
      const lx = -hx + (a / stepX) * hx * 2;
      for (let b = 0; b <= stepZ; b++) {
        const lz = -hz + (b / stepZ) * hz * 2;
        const x = cx + lx * c - lz * s;
        const z = cz + lx * s + lz * c;
        const k = this.index(x, z);
        if (k < 0) return false;
        if (!allowed.includes(this.data[k])) return false;
        if (this.terrain.waterDistance(x, z) < 2.5) return false;
      }
    }
    return true;
  }

  cellHeight(i, j) {
    const ci = clamp(i, 0, this.w - 1);
    const cj = clamp(j, 0, this.h - 1);
    const h = SURF_HEIGHT[this.data[cj * this.w + ci]];
    if (h !== undefined) return h;
    return this.terrain.height(this.minX + ci + 0.5, this.minZ + cj + 0.5);
  }

  /** Smooth ground-level height (roads, kerbs, banks). Does not include flyovers. */
  heightAt(x, z) {
    const fx = x - this.minX - 0.5;
    const fz = z - this.minZ - 0.5;
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    if (i < 0 || j < 0 || i >= this.w - 1 || j >= this.h - 1) return this.terrain.height(x, z);
    const u = fx - i;
    const v = fz - j;
    const a = this.cellHeight(i, j);
    const b = this.cellHeight(i + 1, j);
    const c = this.cellHeight(i, j + 1);
    const d = this.cellHeight(i + 1, j + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
}
