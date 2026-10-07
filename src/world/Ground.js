// "What am I standing on?" - ground level plus the elevated flyover decks above it.

export class Ground {
  constructor(surface, roads, terrain) {
    this.surface = surface;
    this.roads = roads;
    this.terrain = terrain;
  }

  /** Deck height of flyover `f` at (x, z), or null when the point is not on the deck. */
  deckHeight(f, x, z) {
    if (x < f.minX || x > f.maxX || z < f.minZ || z > f.maxZ) return null;
    const sm = f.samples;
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < sm.length; i += 2) {
      const dx = x - sm[i].x;
      const dz = z - sm[i].z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (bestD > 400) return null;
    let out = null;
    for (let i = Math.max(0, best - 2); i < Math.min(sm.length - 1, best + 2); i++) {
      const a = sm[i];
      const b = sm[i + 1];
      const ex = b.x - a.x;
      const ez = b.z - a.z;
      const l2 = ex * ex + ez * ez;
      const t = ((x - a.x) * ex + (z - a.z) * ez) / l2;
      if (t < -0.02 || t > 1.02) continue;
      const px = a.x + ex * t;
      const pz = a.z + ez * t;
      const lat = Math.hypot(x - px, z - pz);
      if (lat > f.deckHalf - 0.3) continue;
      out = a.h + (b.h - a.h) * t;
      break;
    }
    return out;
  }

  /**
   * Height of the highest surface that something with its feet at `y` can stand on.
   * `step` is how far up it is able to climb in one go.
   */
  height(x, z, y, step = 0.65) {
    let h = this.surface.heightAt(x, z);
    const fl = this.roads.flyovers;
    for (let i = 0; i < fl.length; i++) {
      const d = this.deckHeight(fl[i], x, z);
      if (d !== null && d > h && d <= y + step) h = d + 0.04;
    }
    return h;
  }

  /** Lowest ceiling above (x, y, z) - used to keep the camera from poking through decks. */
  ceiling(x, z, y) {
    let c = Infinity;
    const fl = this.roads.flyovers;
    for (let i = 0; i < fl.length; i++) {
      const d = this.deckHeight(fl[i], x, z);
      if (d !== null && d - 1.5 > y) c = Math.min(c, d - 1.5);
    }
    return c;
  }
}
