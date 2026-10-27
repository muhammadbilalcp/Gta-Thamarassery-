// Terrain height field. Thamarassery lies at the foot of the Western Ghats (Churam),
// with gentle Malabar river valleys and rolling roadside land.

import { WATER, WORLD } from './layout.js';
import { clamp, signedDistPolygon, distToPolyline } from '../utils/math.js';

const CELL = 4;
const MARGIN = 160;

export class Terrain {
  constructor() {
    this.minX = WORLD.minX - MARGIN;
    this.minZ = WORLD.minZ - MARGIN;
    this.maxX = WORLD.maxX + MARGIN;
    this.maxZ = WORLD.maxZ + MARGIN;
    this.nx = Math.ceil((this.maxX - this.minX) / CELL) + 1;
    this.nz = Math.ceil((this.maxZ - this.minZ) / CELL) + 1;
    this.sdf = new Float32Array(this.nx * this.nz);
    this.waterLevel = WATER.level;
    this._build();
  }

  _build() {
    const polys = WATER.polygons.map((poly) => {
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (const p of poly) {
        minX = Math.min(minX, p[0]);
        maxX = Math.max(maxX, p[0]);
        minZ = Math.min(minZ, p[1]);
        maxZ = Math.max(maxZ, p[1]);
      }
      return { poly, minX, maxX, minZ, maxZ };
    });
    const chans = WATER.channels.map((c) => {
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (const p of c.pts) {
        minX = Math.min(minX, p[0]);
        maxX = Math.max(maxX, p[0]);
        minZ = Math.min(minZ, p[1]);
        maxZ = Math.max(maxZ, p[1]);
      }
      return { ...c, minX, maxX, minZ, maxZ };
    });
    const FAR = 40;
    for (let j = 0; j < this.nz; j++) {
      const z = this.minZ + j * CELL;
      for (let i = 0; i < this.nx; i++) {
        const x = this.minX + i * CELL;
        let d = FAR;
        for (const p of polys) {
          if (x < p.minX - FAR || x > p.maxX + FAR || z < p.minZ - FAR || z > p.maxZ + FAR) continue;
          d = Math.min(d, signedDistPolygon(x, z, p.poly));
        }
        for (const c of chans) {
          const pad = FAR + c.width;
          if (x < c.minX - pad || x > c.maxX + pad || z < c.minZ - pad || z > c.maxZ + pad) continue;
          d = Math.min(d, distToPolyline(x, z, c.pts) - c.width / 2);
        }
        this.sdf[j * this.nx + i] = clamp(d, -FAR, FAR);
      }
    }
  }

  /** Signed distance to the nearest shoreline in metres, negative over water. */
  waterDistance(x, z) {
    const fx = clamp((x - this.minX) / CELL, 0, this.nx - 1.001);
    const fz = clamp((z - this.minZ) / CELL, 0, this.nz - 1.001);
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const s = this.sdf;
    const k = j * this.nx + i;
    const a = s[k];
    const b = s[k + 1];
    const c = s[k + this.nx];
    const d = s[k + this.nx + 1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  isWater(x, z) {
    return this.waterDistance(x, z) < -0.5;
  }

  /** Land height: 0 on land, sloping banks down to the bed. */
  height(x, z) {
    const d = this.waterDistance(x, z);
    if (d >= 1.5) return 0;
    // Bank starts 1.5 m inland, bed is 3.2 m deep.
    const t = clamp((1.5 - d) / 9, 0, 1);
    return -3.2 * t * t * (3 - 2 * t);
  }
}
