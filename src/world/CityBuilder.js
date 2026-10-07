// Procedural filler city. Landmarks are hand built elsewhere; everything else - shop rows,
// showrooms, apartment towers, lodges, tiled-roof houses, compound walls, rooftop tanks and
// hoardings - is generated here along the road network and then inside the blocks.

import * as THREE from 'three';
import { ChunkSet } from '../utils/ChunkSet.js';
import { SurfaceWriter } from '../utils/MeshBuilder.js';
import { kerbCanvas } from './RoadTextures.js';
import { LayerAtlas } from '../utils/LayerAtlas.js';
import { Landmarks } from './landmarks/Landmarks.js';
import { Props } from './Props.js';
import { SURF } from './SurfaceMap.js';
import { buildFacades, buildShopAtlas, buildHoardingAtlas, BAY, FLOOR, SHOP_COLS, SHOP_ROWS } from './FacadeTextures.js';
import { CORE } from './layout.js';
import { RNG } from '../utils/rng.js';
import { clamp, lerp } from '../utils/math.js';

const GROUND_H = 3.5;
const FREE = [SURF.LAND, SURF.VERGE];

export function frame(cx, cz, fx, fz) {
  const l = Math.hypot(fx, fz) || 1;
  fx /= l;
  fz /= l;
  const rx = fz;
  const rz = -fx;
  return {
    cx,
    cz,
    fx,
    fz,
    rx,
    rz,
    rot: Math.atan2(rz, rx),
    P(lx, y, lz) {
      return [cx + rx * lx + fx * lz, y, cz + rz * lx + fz * lz];
    },
    N(lx, lz) {
      return [rx * lx + fx * lz, 0, rz * lx + fz * lz];
    },
  };
}

export class CityBuilder {
  constructor(world) {
    this.world = world;
    this.assets = world.assets;
    this.surface = world.surface;
    this.roads = world.roads;
    this.colliders = world.colliders;
    this.terrain = world.terrain;
    this.quality = world.quality;
    this.rng = new RNG(20260930);
    this.chunks = new ChunkSet(170);
    this.group = new THREE.Group();
    this.group.name = 'city';
    this.parking = [];
    this.buildings = [];
    this.count = 0;
  }

  /** Textures and the shared material. Must run before anything draws into the city. */
  prepare() {
    const a = this.assets;
    this.facades = buildFacades(a);
    this.shops = buildShopAtlas(a);
    this.hoardings = buildHoardingAtlas(a);
    this.byStyle = {};
    for (const f of this.facades) (this.byStyle[f.style] ||= []).push(f);

    // Everything the city is made of lives in one texture array -> one material.
    const atlas = new LayerAtlas(this.quality.name === 'high' ? 1024 : 512, this.quality.name === 'low' ? 256 : 512);
    const surf = {};
    const tex = a.textures;
    for (const f of this.facades) surf[f.key] = { layer: atlas.add(f.key, f.color, { orm: f.orm, normal: f.normal }), tint: [1, 1, 1] };
    for (let i = 0; i < 4; i++) {
      const region = [(i % 2) * 1024, Math.floor(i / 2) * 1024, 1024, 1024];
      atlas.add(`shops${i}`, this.shops.canvas, { orm: this.shops.orm, region });
      atlas.add(`hoard${i}`, this.hoardings.canvas, { region, rough: 0.55, metal: 0.05 });
    }
    const photo = (name, set, roughScale = 1) => atlas.add(name, set.map.image, { normal: set.normalMap.image, roughImage: set.roughnessMap.image, roughScale });
    const plaster = photo('plaster', tex.plaster);
    const concrete = photo('concrete', tex.concrete);
    const rooftile = photo('rooftile', tex.rooftile);
    const mossy = photo('mossy', tex.mossy);
    const plaza = photo('plaza', tex.plaza);
    const corrugated = atlas.add('corrugated', tex.corrugated.map.image, { normal: tex.corrugated.normalMap.image, rough: 0.62, metal: 0.45 });
    const flatMetal = atlas.add('flatMetal', null, { rough: 0.5, metal: 0.75 });
    const flatMatte = atlas.add('flatMatte', null, { rough: 0.6, metal: 0 });
    const mud = photo('mud', tex.mud);
    const kerb = atlas.add('kerb', kerbCanvas(), { rough: 0.85 });
    const kerbWhite = atlas.add('kerbWhite', kerbCanvas('#e6e3da', '#1b1b1b'), { rough: 0.85 });
    Object.assign(surf, {
      trim: { layer: plaster, tint: [0.91, 0.9, 0.86] },
      trimDark: { layer: plaster, tint: [0.4, 0.33, 0.26] },
      roofFlat: { layer: concrete, tint: [0.56, 0.55, 0.53] },
      roofTile: { layer: rooftile, tint: [0.9, 0.7, 0.6] },
      wall: { layer: mossy, tint: [0.86, 0.84, 0.78] },
      apron: { layer: plaza, tint: [0.8, 0.78, 0.74] },
      awning: { layer: corrugated, tint: [0.75, 0.78, 0.8] },
      awningRed: { layer: corrugated, tint: [0.75, 0.3, 0.24] },
      awningBlue: { layer: corrugated, tint: [0.25, 0.45, 0.66] },
      awningGreen: { layer: corrugated, tint: [0.25, 0.55, 0.36] },
      steel: { layer: flatMetal, tint: [0.23, 0.24, 0.25] },
      tank: { layer: flatMatte, tint: [0.07, 0.07, 0.07] },
      tankBlue: { layer: flatMatte, tint: [0.16, 0.37, 0.6] },
      // Road furniture and the metro share the same material.
      rdConcrete: { layer: concrete, tint: [0.85, 0.84, 0.8] },
      rdConcreteDark: { layer: concrete, tint: [0.6, 0.59, 0.57] },
      rdMedian: { layer: mud, tint: [0.72, 0.69, 0.6] },
      rdPlaza: { layer: plaza, tint: [0.81, 0.79, 0.76] },
      rdKerb: { layer: kerb, tint: [1, 1, 1] },
      rdKerbWhite: { layer: kerbWhite, tint: [1, 1, 1] },
      teal: { layer: flatMatte, tint: [0.1, 0.62, 0.6] },
      cream: { layer: plaster, tint: [0.94, 0.91, 0.84] },
      rail: { layer: flatMetal, tint: [0.56, 0.57, 0.58] },
    });
    this.surf = surf;
    this.shopLayer = atlas.index.shops0;
    this.hoardLayer = atlas.index.hoard0;
    // Landmarks and street furniture add their own layers before the array is baked.
    this.landmarks = new Landmarks(this);
    this.landmarks.prepare(atlas);
    this.props = new Props(this);
    atlas.build(a.maxAniso);
    this.atlas = atlas;
    this.material = atlas.material({ alphaTest: 0.5 });
  }

  build() {
    // Hand-built places first so that the filler city grows around them.
    this.landmarks.build();
    this._frontages();
    this._interior();
    this.props.build();
  }

  /** Bake every cell into a mesh. Roads and the metro have drawn into the cells as well. */
  finish() {
    this.chunks.build(this.group, { city: this.material });
    return this.group;
  }

  /** Writer for the cell at (x, z) that draws with the layer and tint of surface `key`. */
  use(key, x, z) {
    const b = this.chunks.get('city', x, z, { color: true, layer: true });
    const s = this.surf[key];
    if (!s) throw new Error(`unknown surface: ${key}`);
    return new SurfaceWriter(b, s.layer, s.tint);
  }

  // ------------------------------------------------------------------------- zoning
  density(x, z) {
    let d = 0;
    for (const n of this.roads.junctions) {
      if (n.arms.length < 3) continue;
      const w = n.flyover ? 420 : 300;
      d = Math.max(d, 1 - Math.hypot(x - n.x, z - n.z) / w);
    }
    return clamp(d, 0, 1);
  }

  pickFacade(style) {
    return this.rng.pick(this.byStyle[style]);
  }

  // ----------------------------------------------------------------- road frontages
  _frontages() {
    const rng = this.rng;
    for (const e of this.roads.edges) {
      for (const side of [1, -1]) {
        let s = e.trim[0] + 5;
        const end = e.length - e.trim[1] - 5;
        let guard = 0;
        while (s < end && guard++ < 400) {
          const probe = e.at(s);
          const dens = this.density(probe.x, probe.z);
          const lot = this._chooseLot(e.cls, dens);
          const w = Math.min(lot.width, end - s);
          if (w < 7) break;
          const f = e.at(s + w / 2);
          // Keep clear of the metro viaduct where it runs beside the road.
          const extra = this.world.metroClearance ? this.world.metroClearance(e, side, s + w / 2) : 0;
          const setback = lot.setback + extra;
          const edgeOut = e.half + e.walk;
          const lat = side * (edgeOut + setback + lot.depth / 2);
          const cx = f.x + f.nx * lat;
          const cz = f.z + f.nz * lat;
          const fx = -f.nx * side;
          const fz = -f.nz * side;
          const fr = frame(cx, cz, fx, fz);
          const lotW = w - lot.gap;
          if (!this.surface.rectIsFree(cx, cz, lotW / 2 + 0.3, lot.depth / 2 + 0.3, fr.rot, FREE)) {
            s += 4;
            continue;
          }
          // Paved apron between the footpath and the building.
          if (setback > 0.6 && lot.apron) {
            const ax = f.x + f.nx * side * (edgeOut + setback / 2);
            const az = f.z + f.nz * side * (edgeOut + setback / 2);
            const af = frame(ax, az, fx, fz);
            if (this.surface.rectIsFree(ax, az, lotW / 2, setback / 2 - 0.05, af.rot, FREE)) {
              this._apron(af, lotW, setback);
              if (setback > 5.5) this._parkingRow(af, lotW, setback, lot.bikes);
            }
          }
          this._lot(fr, lotW, lot, dens);
          s += w;
        }
      }
    }
  }

  _chooseLot(cls, dens) {
    const rng = this.rng;
    if (cls === 'highway') {
      return rng.weighted([
        [{ kind: 'showroom', width: rng.float(22, 34), depth: rng.float(16, 24), setback: rng.float(8, 12), floors: rng.int(2, 4), gap: 2.5, apron: true }, 3 + dens * 2],
        [{ kind: 'commercial', width: rng.float(14, 24), depth: rng.float(14, 20), setback: rng.float(3, 7), floors: rng.int(3, 5 + Math.round(dens * 5)), gap: 1.2, apron: true, shops: true }, 3 + dens * 5],
        [{ kind: 'tower', width: rng.float(26, 36), depth: rng.float(24, 30), setback: rng.float(10, 16), floors: rng.int(9, 17), gap: 5 }, 1.6],
        [{ kind: 'office', width: rng.float(20, 30), depth: rng.float(16, 22), setback: rng.float(6, 10), floors: rng.int(5, 9 + Math.round(dens * 4)), gap: 3, apron: true }, 1.2 + dens * 3],
        [{ kind: 'lodge', width: rng.float(14, 20), depth: rng.float(12, 16), setback: rng.float(3, 6), floors: rng.int(3, 4), gap: 2, apron: true }, 1],
        [{ kind: 'empty', width: rng.float(10, 22), depth: 12, setback: 3, floors: 0, gap: 0 }, 1.4 - dens],
      ]);
    }
    if (cls === 'arterial') {
      return rng.weighted([
        [{ kind: 'commercial', width: rng.float(9, 19), depth: rng.float(11, 17), setback: rng.float(1.2, 3.2), floors: rng.int(2, 4 + Math.round(dens * 3)), gap: rng.chance(0.6) ? 0.15 : 1.5, apron: true, shops: true, bikes: true }, 7 + dens * 4],
        [{ kind: 'office', width: rng.float(15, 24), depth: rng.float(13, 18), setback: rng.float(3, 6), floors: rng.int(4, 7), gap: 2, apron: true }, 1 + dens * 2],
        [{ kind: 'lodge', width: rng.float(12, 18), depth: rng.float(11, 15), setback: rng.float(2, 5), floors: rng.int(2, 4), gap: 1.5, apron: true }, 1.4],
        [{ kind: 'tower', width: rng.float(24, 32), depth: rng.float(22, 28), setback: rng.float(9, 14), floors: rng.int(8, 15), gap: 4 }, 0.9],
        [{ kind: 'house', width: rng.float(13, 17), depth: rng.float(11, 14), setback: rng.float(5, 8), floors: rng.int(1, 2), gap: 1 }, 1.6 - dens],
        [{ kind: 'empty', width: rng.float(8, 16), depth: 10, setback: 3, floors: 0, gap: 0 }, 0.9 - dens * 0.6],
      ]);
    }
    return rng.weighted([
      [{ kind: 'house', width: rng.float(13, 18), depth: rng.float(11, 14), setback: rng.float(4, 7), floors: rng.int(1, 2), gap: 1 }, 5],
      [{ kind: 'commercial', width: rng.float(8, 14), depth: rng.float(9, 13), setback: rng.float(1, 2.5), floors: rng.int(1, 3), gap: 0.3, apron: true, shops: true, bikes: true }, 3],
      [{ kind: 'lodge', width: rng.float(12, 16), depth: rng.float(10, 13), setback: rng.float(3, 5), floors: rng.int(2, 3), gap: 1.5 }, 1.5],
      [{ kind: 'empty', width: rng.float(8, 14), depth: 10, setback: 3, floors: 0, gap: 0 }, 1],
    ]);
  }

  _lot(fr, w, lot, dens) {
    switch (lot.kind) {
      case 'showroom':
        return this._block(fr, w, lot.depth, lot.floors, { facade: this.pickFacade(this.rng.chance(0.6) ? 'acp' : 'glass'), glassGround: true, hoarding: this.rng.chance(0.35), ledge: 0 });
      case 'commercial':
        return this._block(fr, w, lot.depth, lot.floors, { facade: this.pickFacade(this.rng.weighted([['concrete', 5], ['acp', 2], ['glass', 1]])), shops: true, hoarding: this.rng.chance(0.3 + dens * 0.25), ledge: 0.55, tanks: true });
      case 'office':
        return this._block(fr, w, lot.depth, lot.floors, { facade: this.pickFacade(this.rng.weighted([['glass', 4], ['acp', 3], ['concrete', 1]])), glassGround: true, hoarding: this.rng.chance(0.2), ledge: 0 });
      case 'lodge':
        return this._block(fr, w, lot.depth, lot.floors, { facade: this.pickFacade('lodge'), ledge: 0.9, tanks: true, tiledCap: this.rng.chance(0.5) });
      case 'tower':
        return this._tower(fr, w, lot.depth, lot.floors);
      case 'house':
        return this._house(fr, w, lot.depth, lot.floors);
      default:
        return null;
    }
  }

  // --------------------------------------------------------------------- primitives
  _register(fr, w, d, h, tag = 'building') {
    this.surface.rect(fr.cx, fr.cz, w / 2, d / 2, fr.rot, SURF.BUILDING);
    this.colliders.addBox(fr.cx, fr.cz, w / 2, d / 2, fr.rot, -2, h, tag);
    this.buildings.push({ x: fr.cx, z: fr.cz, w, d, h, rot: fr.rot });
    this.count++;
  }

  /** Four walls textured with a repeating facade. y0..y1, optional skip of the front. */
  _walls(fr, w, d, y0, y1, key, { skipFront = false, floorOffset = 0 } = {}) {
    const b = this.use(key, fr.cx, fr.cz);
    const hw = w / 2;
    const hd = d / 2;
    const v0 = (y0 - floorOffset) / (FLOOR * 4);
    const v1 = (y1 - floorOffset) / (FLOOR * 4);
    const side = (p0, p1, len, normal, uOff) => {
      const bays = Math.max(1, Math.round(len / BAY));
      const u0 = uOff;
      const u1 = uOff + bays / 4;
      b.quad([p0[0], y0, p0[2]], [p1[0], y0, p1[2]], [p1[0], y1, p1[2]], [p0[0], y1, p0[2]], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], normal);
    };
    if (!skipFront) side(fr.P(-hw, 0, hd), fr.P(hw, 0, hd), w, fr.N(0, 1), 0);
    side(fr.P(hw, 0, hd), fr.P(hw, 0, -hd), d, fr.N(1, 0), 0.25);
    side(fr.P(hw, 0, -hd), fr.P(-hw, 0, -hd), w, fr.N(0, -1), 0.5);
    side(fr.P(-hw, 0, -hd), fr.P(-hw, 0, hd), d, fr.N(-1, 0), 0.75);
  }

  _box(key, fr, lx, y, lz, sx, sy, sz, faces = 'xXzZY', uvScale = 0.33) {
    const b = this.use(key, fr.cx, fr.cz);
    const c = fr.P(lx, y, lz);
    b.box(c[0], y + sy / 2, c[2], sx, sy, sz, fr.rot, { faces, uvScale });
  }

  _flatRoof(fr, w, d, h, parapet = 0.9) {
    const b = this.use('roofFlat', fr.cx, fr.cz);
    const hw = w / 2;
    const hd = d / 2;
    b.quad(fr.P(-hw, h, hd), fr.P(hw, h, hd), fr.P(hw, h, -hd), fr.P(-hw, h, -hd), [[0, 0], [w / 4, 0], [w / 4, d / 4], [0, d / 4]], [0, 1, 0]);
    if (parapet <= 0) return;
    const t = this.use('trim', fr.cx, fr.cz);
    const th = 0.2;
    const ring = [
      [-hw, hd, hw, hd, 0, 1],
      [hw, hd, hw, -hd, 1, 0],
      [hw, -hd, -hw, -hd, 0, -1],
      [-hw, -hd, -hw, hd, -1, 0],
    ];
    for (const [ax, az, bx, bz, nx, nz] of ring) {
      const len = Math.hypot(bx - ax, bz - az);
      const uv = [[0, 0], [len / 3, 0], [len / 3, parapet / 3], [0, parapet / 3]];
      // outer, inner and top faces
      t.quad(fr.P(ax, h, az), fr.P(bx, h, bz), fr.P(bx, h + parapet, bz), fr.P(ax, h + parapet, az), uv, fr.N(nx, nz));
      const ix = -nx * th;
      const iz = -nz * th;
      t.quad(fr.P(ax + ix, h, az + iz), fr.P(bx + ix, h, bz + iz), fr.P(bx + ix, h + parapet, bz + iz), fr.P(ax + ix, h + parapet, az + iz), uv, fr.N(-nx, -nz));
      t.quad(fr.P(ax, h + parapet, az), fr.P(bx, h + parapet, bz), fr.P(bx + ix, h + parapet, bz + iz), fr.P(ax + ix, h + parapet, az + iz), [[0, 0], [len / 3, 0], [len / 3, 0.07], [0, 0.07]], [0, 1, 0]);
    }
  }

  _hipRoof(fr, w, d, y0, rise, overhang = 0.7, key = 'roofTile') {
    const b = this.use(key, fr.cx, fr.cz);
    const hw = w / 2 + overhang;
    const hd = d / 2 + overhang;
    const alongX = hw >= hd;
    const ridge = Math.abs(hw - hd);
    const rx = alongX ? ridge : 0;
    const rz = alongX ? 0 : ridge;
    const y1 = y0 + rise;
    const T = 2.4;
    const A = fr.P(-hw, y0, hd);
    const B = fr.P(hw, y0, hd);
    const C = fr.P(hw, y0, -hd);
    const D = fr.P(-hw, y0, -hd);
    const R0 = fr.P(-rx, y1, rz);
    const R1 = fr.P(rx, y1, rz);
    const R2 = fr.P(rx, y1, -rz);
    const R3 = fr.P(-rx, y1, -rz);
    const slope = (p0, p1, p2, p3, run, normal) => {
      const len = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
      const top = Math.hypot(p2[0] - p3[0], p2[2] - p3[2]);
      const sl = Math.hypot(run, rise);
      const off = (len - top) / 2;
      b.quad(p0, p1, p2, p3, [[0, 0], [len / T, 0], [(len - off) / T, sl / T], [off / T, sl / T]], normal);
    };
    // front (+f), right (+r), back, left
    slope(A, B, R1, R0, hd - rz, [fr.fx * 0.5, 0.85, fr.fz * 0.5]);
    slope(B, C, R2, R1, hw - rx, [fr.rx * 0.5, 0.85, fr.rz * 0.5]);
    slope(C, D, R3, R2, hd - rz, [-fr.fx * 0.5, 0.85, -fr.fz * 0.5]);
    slope(D, A, R0, R3, hw - rx, [-fr.rx * 0.5, 0.85, -fr.rz * 0.5]);
    // Soffit.
    const s = this.use('trimDark', fr.cx, fr.cz);
    s.quad(A, B, C, D, [[0, 0], [w / 3, 0], [w / 3, d / 3], [0, d / 3]], [0, -1, 0]);
  }

  _tank(fr, lx, lz, h, blue = false) {
    const p = fr.P(lx, 0, lz);
    this._box('trim', fr, lx, h, lz, 1.6, 0.9, 1.6, 'xXzZY');
    // Builders are shared per cell: select the surface right before drawing with it.
    const b = this.use(blue ? 'tankBlue' : 'tank', fr.cx, fr.cz);
    b.cylinder(p[0], h + 0.9, p[2], 0.72, 0.66, 1.25, 12);
    b.cylinder(p[0], h + 2.15, p[2], 0.66, 0.2, 0.25, 12);
  }

  _hoarding(fr, lx, lz, base, width = 9, height = 4.5, face = 1) {
    const st = this.use('steel', fr.cx, fr.cz);
    const legs = 3.2;
    for (const o of [-width * 0.35, 0, width * 0.35]) {
      const p = fr.P(lx + o, 0, lz - 0.35 * face);
      st.box(p[0], base + (legs + height) / 2, p[2], 0.16, legs + height, 0.16, fr.rot, { faces: 'xXzZ' });
      const q = fr.P(lx + o, 0, lz - 1.6 * face);
      st.box((p[0] + q[0]) / 2, base + legs * 0.6, (p[2] + q[2]) / 2, 0.1, 0.1, 1.4, fr.rot, { faces: 'xXzZYy' });
    }
    const tile = this.rng.int(0, this.hoardings.count - 1);
    // Two boards per array layer, stacked.
    const col = tile % 2;
    const row = Math.floor(tile / 2);
    const u0 = 0;
    const u1 = 1;
    const v1 = 1 - (row % 2) / 2;
    const v0 = v1 - 0.5;
    const hb = this.use('trim', fr.cx, fr.cz);
    hb.curLayer = this.hoardLayer + ((row >= 2 ? 2 : 0) + col) * 2;
    hb.tint = [1, 1, 1];
    const y0 = base + legs;
    const y1 = y0 + height;
    const hw = width / 2;
    hb.quad(fr.P(lx - hw, y0, lz), fr.P(lx + hw, y0, lz), fr.P(lx + hw, y1, lz), fr.P(lx - hw, y1, lz), face > 0 ? [[u0, v0], [u1, v0], [u1, v1], [u0, v1]] : [[u1, v0], [u0, v0], [u0, v1], [u1, v1]], fr.N(0, face));
    const back = this.use('steel', fr.cx, fr.cz);
    back.quad(fr.P(lx - hw, y0, lz - 0.12 * face), fr.P(lx + hw, y0, lz - 0.12 * face), fr.P(lx + hw, y1, lz - 0.12 * face), fr.P(lx - hw, y1, lz - 0.12 * face), undefined, fr.N(0, -face));
  }

  _shopFront(fr, w, d) {
    const n = Math.max(1, Math.round(w / 4.8));
    const each = w / n;
    const hd = d / 2;
    const awningKeys = ['awning', 'awningRed', 'awningBlue', 'awningGreen'];
    for (let i = 0; i < n; i++) {
      const x0 = -w / 2 + i * each;
      const x1 = x0 + each;
      const tile = this.rng.int(0, this.shops.count - 1);
      // The 4 x 8 shop sheet is split over four array layers of 2 x 4 tiles each.
      const col = tile % SHOP_COLS;
      const row = Math.floor(tile / SHOP_COLS);
      const b = this.use('trim', fr.cx, fr.cz);
      b.curLayer = this.shopLayer + ((row >= SHOP_ROWS / 2 ? 2 : 0) + (col >= SHOP_COLS / 2 ? 1 : 0)) * 2;
      b.tint = [1, 1, 1];
      const u0 = (col % 2) / 2;
      const u1 = u0 + 0.5;
      const v1 = 1 - (row % 4) / 4;
      const v0 = v1 - 0.25;
      b.quad(fr.P(x0, 0.06, hd), fr.P(x1, 0.06, hd), fr.P(x1, GROUND_H, hd), fr.P(x0, GROUND_H, hd), [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], fr.N(0, 1));
      // Awning over most shops.
      if (this.rng.chance(0.7)) {
        const a = this.use(this.rng.pick(awningKeys), fr.cx, fr.cz);
        const y = GROUND_H - 0.95;
        const depth = this.rng.float(1.0, 1.7);
        const pts = [fr.P(x0 + 0.1, y + 0.3, hd + 0.02), fr.P(x1 - 0.1, y + 0.3, hd + 0.02), fr.P(x1 - 0.1, y - 0.15, hd + depth), fr.P(x0 + 0.1, y - 0.15, hd + depth)];
        const uv = [[0, 0], [each / 2, 0], [each / 2, depth / 2], [0, depth / 2]];
        a.quad(pts[0], pts[1], pts[2], pts[3], uv, [fr.fx * 0.3, 0.95, fr.fz * 0.3]);
        a.quad(pts[0], pts[1], pts[2], pts[3], uv, [-fr.fx * 0.3, -0.95, -fr.fz * 0.3]);
      }
    }
  }

  _glassGround(fr, w, d, key) {
    // Showroom ground floor: full-height glazing between piers, reuse the glass facade.
    const glass = this.byStyle.glass[0];
    const b = this.use(glass.key, fr.cx, fr.cz);
    const hd = d / 2;
    const bays = Math.max(1, Math.round(w / BAY));
    b.quad(fr.P(-w / 2, 0.06, hd), fr.P(w / 2, 0.06, hd), fr.P(w / 2, GROUND_H, hd), fr.P(-w / 2, GROUND_H, hd), [[0, 0.02], [bays / 4, 0.02], [bays / 4, 0.19], [0, 0.19]], fr.N(0, 1));
    // Entrance canopy.
    this._box('trim', fr, 0, GROUND_H - 0.25, hd + 1.1, Math.min(w * 0.5, 9), 0.25, 2.2, 'xXzZYy');
    void key;
  }

  _apron(fr, w, depth) {
    const b = this.use('apron', fr.cx, fr.cz);
    const hw = w / 2;
    const hd = depth / 2;
    b.quad(fr.P(-hw, 0.07, hd), fr.P(hw, 0.07, hd), fr.P(hw, 0.07, -hd), fr.P(-hw, 0.07, -hd), [[0, 0], [w / 3, 0], [w / 3, depth / 3], [0, depth / 3]], [0, 1, 0]);
    this.surface.rect(fr.cx, fr.cz, hw, hd, fr.rot, SURF.PAVED, [SURF.ROAD, SURF.SIDEWALK, SURF.BUILDING]);
  }

  _parkingRow(fr, w, depth, bikes) {
    // Nose-in parking facing the building; the list is consumed by the vehicle manager.
    const n = Math.floor((w - 2) / 2.9);
    const heading = Math.atan2(-fr.fx, -fr.fz);
    for (let i = 0; i < n; i++) {
      if (!this.rng.chance(0.42)) continue;
      const lx = -w / 2 + 1.6 + i * 2.9 + this.rng.float(-0.2, 0.2);
      const p = fr.P(lx, 0, -depth / 2 + 3.0);
      this.parking.push({ x: p[0], z: p[2], heading: heading + this.rng.float(-0.06, 0.06), kind: 'car' });
    }
    void bikes;
  }

  // ------------------------------------------------------------------ building types
  _block(fr, w, d, floors, o) {
    const h = GROUND_H + (floors - 1) * FLOOR;
    this._register(fr, w, d, h + 1);
    const key = o.facade.key;
    if (o.shops) {
      this._shopFront(fr, w, d);
      // Sides and back of the ground floor.
      this._walls(fr, w, d, 0, GROUND_H, key, { skipFront: true });
      // Bikes pulled up outside the shops.
      const n = Math.floor(w / 3);
      for (let i = 0; i < n; i++) {
        if (!this.rng.chance(0.2)) continue;
        const p = fr.P(-w / 2 + 1 + i * 3, 0, d / 2 + 1.2);
        this.parking.push({ x: p[0], z: p[2], heading: Math.atan2(fr.rx, fr.rz) + this.rng.float(-0.3, 0.3) + (this.rng.chance(0.5) ? Math.PI : 0), kind: 'bike' });
      }
    } else if (o.glassGround) {
      this._glassGround(fr, w, d, key);
      this._walls(fr, w, d, 0, GROUND_H, key, { skipFront: true });
    } else {
      this._walls(fr, w, d, 0, GROUND_H, key, { floorOffset: GROUND_H - FLOOR });
    }
    if (floors > 1) this._walls(fr, w, d, GROUND_H, h, key, { floorOffset: GROUND_H });
    // Slab edges / sunshades give the facade real depth.
    if (o.ledge > 0) {
      for (let k = 1; k < floors; k++) {
        const y = GROUND_H + (k - 1) * FLOOR;
        this._box('trim', fr, 0, y - 0.08, d / 2 + o.ledge / 2, w + 0.1, 0.14, o.ledge, 'xXZYy');
      }
    }
    // Band above the shops.
    if (o.shops || o.glassGround) this._box('trim', fr, 0, GROUND_H - 0.02, d / 2 + 0.12, w + 0.06, 0.3, 0.24, 'xXZYy');
    if (o.tiledCap) {
      this._hipRoof(fr, w, d, h, 2.2, 0.8);
    } else {
      this._flatRoof(fr, w, d, h);
      this._roofClutter(fr, w, d, h, o);
    }
    return h;
  }

  _roofClutter(fr, w, d, h, o) {
    const rng = this.rng;
    // Stair head room.
    const sx = rng.float(-w / 2 + 2.2, w / 2 - 2.2);
    this._box('trim', fr, sx, h, -d / 2 + 2.2, 3.2, 2.6, 3.4, 'xXzZY');
    if (o.tanks !== false) {
      const n = rng.int(1, 2 + Math.floor(w / 14));
      for (let i = 0; i < n; i++) this._tank(fr, rng.float(-w / 2 + 1.5, w / 2 - 1.5), rng.float(-d / 2 + 1.5, d / 2 - 3), h, rng.chance(0.2));
    }
    if (o.hoarding) {
      const bw = clamp(w - 2, 5, 12);
      this._hoarding(fr, 0, d / 2 - 0.5, h + 0.9, bw, bw * 0.48);
    }
  }

  _tower(fr, w, d, floors) {
    const rng = this.rng;
    const facade = this.pickFacade('apartment');
    // Tower sits inside a walled compound.
    const tw = w * rng.float(0.62, 0.78);
    const td = d * rng.float(0.6, 0.75);
    const h = floors * FLOOR;
    const tf = frame(fr.cx, fr.cz, fr.fx, fr.fz);
    this._register(tf, tw, td, h + 3);
    this._walls(tf, tw, td, 0, h, facade.key);
    // Balcony slabs front and back.
    for (let k = 1; k <= floors; k++) {
      const y = k * FLOOR - 0.12;
      this._box('trim', tf, 0, y, td / 2 + 0.45, tw * 0.96, 0.13, 0.9, 'xXZYy');
      this._box('trim', tf, 0, y, -td / 2 - 0.45, tw * 0.96, 0.13, 0.9, 'xXzYy');
    }
    // Terracotta crown - the signature of Kochi's apartment towers.
    if (rng.chance(0.75)) {
      this._box('trim', tf, 0, h, 0, tw + 0.5, 0.5, td + 0.5, 'xXzZY');
      this._hipRoof(tf, tw * 0.9, td * 0.9, h + 0.5, 3.2, 0.9);
    } else {
      this._flatRoof(tf, tw, td, h, 1.1);
      this._box('trim', tf, 0, h, 0, 5, 3.4, 5, 'xXzZY');
      this._tank(tf, tw * 0.25, 0, h + 3.4);
    }
    this._compound(fr, w, d, 1.9, 5);
    // Visitor parking inside the gate.
    for (let i = 0; i < 3; i++) {
      if (!rng.chance(0.5)) continue;
      const p = fr.P(-w / 2 + 2 + i * 2.8, 0, d / 2 - 3.2);
      this.parking.push({ x: p[0], z: p[2], heading: Math.atan2(fr.fx, fr.fz) + Math.PI, kind: 'car' });
    }
    return h;
  }

  _house(fr, w, d, floors) {
    const rng = this.rng;
    const facade = this.pickFacade('house');
    const hw = w * rng.float(0.6, 0.72);
    const hd = d * rng.float(0.58, 0.7);
    const h = floors * FLOOR;
    const hf = frame(fr.cx - fr.fx * 0.8, fr.cz - fr.fz * 0.8, fr.fx, fr.fz);
    this._register(hf, hw, hd, h + 2);
    this._walls(hf, hw, hd, 0, h, facade.key);
    this._hipRoof(hf, hw, hd, h, rng.float(1.9, 2.6), 0.85);
    // Sit-out with its own little roof, as every Kerala house has.
    const pw = Math.min(4.4, hw * 0.5);
    const px = rng.float(-hw * 0.2, hw * 0.2);
    for (const s of [-1, 1]) this._box('trim', hf, px + s * (pw / 2 - 0.2), 0, hd / 2 + 1.7, 0.32, 2.7, 0.32, 'xXzZ');
    this._box('trimDark', hf, px, 0.06, hd / 2 + 0.02, 1.15, 2.2, 0.08, 'Z');
    this._box('trim', hf, px, 0, hd / 2 + 1.0, pw, 0.2, 2.0, 'xXZY');
    const porch = frame(hf.cx + hf.fx * (hd / 2 + 1.0) + hf.rx * px, hf.cz + hf.fz * (hd / 2 + 1.0) + hf.rz * px, hf.fx, hf.fz);
    this._hipRoof(porch, pw, 2.0, 2.7, 0.9, 0.35);
    this.colliders.addBox(porch.cx, porch.cz, pw / 2, 1.0, porch.rot, 2.4, 4, 'porch');
    this._compound(fr, w, d, 1.45, 3.4);
    if (rng.chance(0.55)) {
      const p = fr.P(w / 2 - 2.4, 0, d / 2 - 3.4);
      this.parking.push({ x: p[0], z: p[2], heading: Math.atan2(fr.fx, fr.fz) + Math.PI, kind: rng.chance(0.6) ? 'car' : 'bike' });
    }
    return h;
  }

  _compound(fr, w, d, height, gate) {
    const b = this.use('wall', fr.cx, fr.cz);
    const hw = w / 2 - 0.1;
    const hd = d / 2 - 0.1;
    const t = 0.2;
    const seg = (ax, az, bx, bz) => {
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.3) return;
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      const p = fr.P(mx, 0, mz);
      const alongX = Math.abs(bx - ax) > Math.abs(bz - az);
      b.box(p[0], height / 2, p[2], alongX ? len : t, height, alongX ? t : len, fr.rot, { uvScale: 0.4, faces: 'xXzZY' });
      const p0 = fr.P(ax, 0, az);
      const p1 = fr.P(bx, 0, bz);
      const c = this.colliders.addWall(p0[0], p0[2], p1[0], p1[2], t + 0.05, -1, height, 'compound');
      if (c) c.noCamera = height < 1.6;
    };
    seg(-hw, hd, -gate / 2, hd);
    seg(gate / 2, hd, hw, hd);
    seg(hw, hd, hw, -hd);
    seg(hw, -hd, -hw, -hd);
    seg(-hw, -hd, -hw, hd);
    // Gate posts.
    for (const s of [-1, 1]) this._box('trim', fr, (s * gate) / 2, 0, hd, 0.42, height + 0.35, 0.42, 'xXzZY');
  }

  // ------------------------------------------------------------------ block interiors
  _interior() {
    const rng = this.rng;
    const step = 25;
    const max = Math.round(2600 * (this.quality.vegetation ?? 1));
    // Candidate sites on a jittered grid, visited in random order so every district fills evenly.
    const sites = [];
    for (let z = CORE.minZ + 20; z < CORE.maxZ - 20; z += step) {
      for (let x = CORE.minX + 20; x < CORE.maxX - 20; x += step) sites.push([x + rng.float(-8, 8), z + rng.float(-8, 8)]);
    }
    for (let i = sites.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [sites[i], sites[j]] = [sites[j], sites[i]];
    }
    let placed = 0;
    for (const [px, pz] of sites) {
      if (placed >= max) break;
      if (this.surface.typeAt(px, pz) !== SURF.LAND) continue;
      const road = this.roads.nearestEdge(px, pz, 420);
      if (!road) continue;
      const dens = this.density(px, pz);
      const far = road.dist;
      // Towers cluster near the big junctions, houses fill the quiet interior.
      const tower = rng.chance(0.08 + dens * 0.2) && far > 40;
      const w = tower ? rng.float(24, 32) : rng.float(13, 18);
      const d = tower ? rng.float(22, 28) : rng.float(11, 15);
      // Face the nearest road, or sit square to it.
      const sm = road.sample;
      const toward = Math.sign(road.lateral) || 1;
      let fx = -sm.nx * toward;
      let fz = -sm.nz * toward;
      if (rng.chance(0.35)) {
        const s = rng.sign();
        fx = sm.tx * s;
        fz = sm.tz * s;
      }
      const fr = frame(px, pz, fx, fz);
      if (!this.surface.rectIsFree(px, pz, w / 2 + 1.2, d / 2 + 1.2, fr.rot, [SURF.LAND])) continue;
      if (tower) this._tower(fr, w, d, rng.int(8, 18));
      else if (rng.chance(0.2)) this._block(fr, w * 0.85, d * 0.85, rng.int(2, 4), { facade: this.pickFacade(rng.chance(0.5) ? 'lodge' : 'concrete'), ledge: 0.6, tanks: true });
      else this._house(fr, w, d, rng.int(1, 2));
      placed++;
    }
  }
}

export { lerp };
