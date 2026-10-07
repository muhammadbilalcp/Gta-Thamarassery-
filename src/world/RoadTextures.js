// Road surface textures: real asphalt photo texture (Poly Haven, CC0) with Indian lane
// markings, wear, oil staining and repair patches painted over it in metric units.

import * as THREE from 'three';
import { makeCanvas, canvasTexture } from '../utils/canvas.js';
import { RNG } from '../utils/rng.js';
import { ROAD_CLASSES, carriageHalf, FLYOVER_DECK_HALF } from './layout.js';

const WHITE = 'rgba(232,232,224,0.93)';
const YELLOW = 'rgba(226,178,44,0.92)';

function base(assets, widthM, lengthM, pxW, pxH, seed, tint = 'rgba(30,30,32,0.18)') {
  const canvas = makeCanvas(pxW, pxH);
  const ctx = canvas.getContext('2d');
  const sx = pxW / widthM;
  const sy = pxH / lengthM;
  ctx.setTransform(sx, 0, 0, sy, 0, 0);
  const img = assets.textures.asphalt.map.image;
  const tile = lengthM / Math.round(lengthM / 4.5);
  const pat = ctx.createPattern(img, 'repeat');
  pat.setTransform(new DOMMatrix().scale(tile / img.width, tile / img.height));
  // Even grey first, then the photographed grain on top at reduced strength: keeps the
  // texture of real bitumen without the same crack repeating every few metres.
  ctx.fillStyle = '#5b5c5e';
  ctx.fillRect(0, 0, widthM, lengthM);
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, widthM, lengthM);
  ctx.globalAlpha = 1;
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, widthM, lengthM);
  return { canvas, ctx, rng: new RNG(seed), widthM, lengthM };
}

/** Draw something at y and again wrapped so the texture tiles along its length. */
function wrapped(t, y, h, fn) {
  fn(y);
  if (y + h > t.lengthM) fn(y - t.lengthM);
  if (y < 0) fn(y + t.lengthM);
}

function laneWear(t, centre, laneWidth) {
  const { ctx, lengthM } = t;
  // Tyre tracks polish and darken two bands per lane.
  for (const off of [-0.78, 0.78]) {
    const x = centre + off;
    const g = ctx.createLinearGradient(x - 0.55, 0, x + 0.55, 0);
    g.addColorStop(0, 'rgba(10,10,12,0)');
    g.addColorStop(0.5, 'rgba(10,10,12,0.2)');
    g.addColorStop(1, 'rgba(10,10,12,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 0.55, 0, 1.1, lengthM);
  }
  // Oil drip line down the middle of the lane.
  const g = ctx.createLinearGradient(centre - 0.3, 0, centre + 0.3, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.5, 'rgba(0,0,0,0.13)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(centre - 0.3, 0, 0.6, lengthM);
  void laneWidth;
}

function blemishes(t, count) {
  const { ctx, rng, widthM, lengthM } = t;
  for (let i = 0; i < count; i++) {
    const x = rng.float(0.5, widthM - 0.5);
    const y = rng.float(0, lengthM);
    const kind = rng.next();
    if (kind < 0.16) {
      // Bitumen repair patch.
      const w = rng.float(0.8, 2.6);
      const h = rng.float(0.8, 3.2);
      wrapped(t, y, h, (yy) => {
        ctx.fillStyle = `rgba(14,14,16,${rng.float(0.1, 0.2)})`;
        ctx.fillRect(x - w / 2, yy, w, h);
        ctx.strokeStyle = 'rgba(5,5,5,0.2)';
        ctx.lineWidth = 0.04;
        ctx.strokeRect(x - w / 2, yy, w, h);
      });
    } else if (kind < 0.62) {
      // Oil / damp stain.
      const r = rng.float(0.3, 1.1);
      wrapped(t, y - r, r * 2, (yy) => {
        const g = ctx.createRadialGradient(x, yy + r, 0, x, yy + r, r);
        g.addColorStop(0, `rgba(0,0,0,${rng.float(0.12, 0.26)})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, yy, r * 2, r * 2);
      });
    } else {
      // Dusty light patch (dried mud / sand).
      const r = rng.float(0.5, 1.6);
      wrapped(t, y - r, r * 2, (yy) => {
        const g = ctx.createRadialGradient(x, yy + r, 0, x, yy + r, r);
        g.addColorStop(0, `rgba(150,128,100,${rng.float(0.1, 0.2)})`);
        g.addColorStop(1, 'rgba(150,128,100,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, yy, r * 2, r * 2);
      });
    }
  }
}

function solid(t, x, width = 0.15, colour = WHITE) {
  const { ctx, rng, lengthM } = t;
  ctx.fillStyle = colour;
  ctx.fillRect(x - width / 2, 0, width, lengthM);
  // Worn gaps.
  ctx.globalCompositeOperation = 'destination-out';
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 10; i++) {
    const y = rng.float(0, lengthM);
    ctx.fillStyle = `rgba(40,40,42,${rng.float(0.25, 0.6)})`;
    ctx.fillRect(x - width / 2, y, width, rng.float(0.1, 0.7));
  }
}

function dashed(t, x, dash, gap, width = 0.15, colour = WHITE) {
  const { ctx, rng, lengthM } = t;
  const period = dash + gap;
  const n = Math.round(lengthM / period);
  for (let i = 0; i < n; i++) {
    const y = i * period + gap / 2;
    ctx.fillStyle = colour;
    ctx.fillRect(x - width / 2, y, width, dash);
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = `rgba(40,40,42,${rng.float(0.2, 0.55)})`;
      ctx.fillRect(x - width / 2, y + rng.float(0, dash), width, rng.float(0.05, 0.3));
    }
  }
}

function hatch(t, x0, x1) {
  const { ctx, lengthM } = t;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, 0, x1 - x0, lengthM);
  ctx.clip();
  ctx.strokeStyle = 'rgba(232,232,224,0.8)';
  ctx.lineWidth = 0.13;
  for (let y = -2; y < lengthM + 2; y += 1.5) {
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y + (x1 - x0) * 1.2);
    ctx.stroke();
  }
  ctx.restore();
}

function finish(t, assets) {
  const tex = canvasTexture(t.canvas, { repeat: true, anisotropy: assets.maxAniso });
  return tex;
}

function roadMaterial(assets, tex, extra = {}) {
  const nor = assets.textures.asphalt.normalMap.clone();
  const rough = assets.textures.asphalt.roughnessMap.clone();
  for (const x of [nor, rough]) {
    x.channel = 1;
    x.repeat.set(1, 1);
    x.needsUpdate = true;
  }
  return new THREE.MeshStandardMaterial({
    map: tex,
    normalMap: nor,
    roughnessMap: rough,
    roughness: 0.92,
    metalness: 0,
    envMapIntensity: 0.9,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    ...extra,
  });
}

export function buildRoadMaterials(assets) {
  const out = {};

  // ----- highway: 4 + 4 lanes, separator between the flyover lanes and the service lanes
  {
    const spec = ROAD_CLASSES.highway;
    const half = carriageHalf('highway');
    const t = base(assets, half * 2, 18, 2048, 1024, 11);
    const c = half;
    for (const s of [-1, 1]) {
      const m = spec.median / 2;
      const lw = spec.laneWidth;
      for (let i = 0; i < 4; i++) {
        const off = m + (i + 0.5) * lw + (i >= 2 ? spec.separator : 0);
        laneWear(t, c + s * off, lw);
      }
    }
    blemishes(t, 46);
    for (const s of [-1, 1]) {
      const m = spec.median / 2;
      const lw = spec.laneWidth;
      solid(t, c + s * (m + 0.28), 0.15, YELLOW);
      dashed(t, c + s * (m + lw), 3, 6);
      const sa = c + s * (m + lw * 2);
      const sb = c + s * (m + lw * 2 + spec.separator);
      hatch(t, Math.min(sa, sb) + 0.1, Math.max(sa, sb) - 0.1);
      solid(t, c + s * (m + lw * 2 + 0.06), 0.13);
      solid(t, c + s * (m + lw * 2 + spec.separator - 0.06), 0.13);
      dashed(t, c + s * (m + lw * 3 + spec.separator), 3, 6);
      solid(t, c + s * (m + lw * 4 + spec.separator + 0.05), 0.15);
    }
    out.highway = { material: roadMaterial(assets, finish(t, assets)), length: 18, half };
  }

  // ----- arterial: 2 + 2 lanes with a median
  {
    const spec = ROAD_CLASSES.arterial;
    const half = carriageHalf('arterial');
    const t = base(assets, half * 2, 18, 1024, 1024, 23);
    const c = half;
    for (const s of [-1, 1]) {
      for (let i = 0; i < 2; i++) laneWear(t, c + s * (spec.median / 2 + (i + 0.5) * spec.laneWidth), spec.laneWidth);
    }
    blemishes(t, 30);
    for (const s of [-1, 1]) {
      const m = spec.median / 2;
      solid(t, c + s * (m + 0.26), 0.14, YELLOW);
      dashed(t, c + s * (m + spec.laneWidth), 3, 6);
      solid(t, c + s * (m + spec.laneWidth * 2 + 0.05), 0.14);
    }
    out.arterial = { material: roadMaterial(assets, finish(t, assets)), length: 18, half };
  }

  // ----- street: two lanes, no median
  {
    const spec = ROAD_CLASSES.street;
    const half = carriageHalf('street');
    const t = base(assets, half * 2, 18, 512, 1024, 37, 'rgba(40,36,34,0.14)');
    const c = half;
    for (const s of [-1, 1]) laneWear(t, c + s * spec.laneWidth * 0.5, spec.laneWidth);
    blemishes(t, 34);
    dashed(t, c, 1.5, 3, 0.12);
    solid(t, c - spec.laneWidth - 0.02, 0.1);
    solid(t, c + spec.laneWidth + 0.02, 0.1);
    out.street = { material: roadMaterial(assets, finish(t, assets)), length: 18, half };
  }

  // ----- flyover deck: the four inner lanes between the parapets
  {
    const spec = ROAD_CLASSES.highway;
    const half = FLYOVER_DECK_HALF - 0.45;
    const t = base(assets, half * 2, 18, 1024, 1024, 51, 'rgba(18,18,22,0.26)');
    const c = half;
    for (const s of [-1, 1]) {
      for (let i = 0; i < 2; i++) laneWear(t, c + s * (spec.median / 2 + (i + 0.5) * spec.laneWidth), spec.laneWidth);
    }
    blemishes(t, 16);
    for (const s of [-1, 1]) {
      const m = spec.median / 2;
      solid(t, c + s * (m + 0.2), 0.15, YELLOW);
      dashed(t, c + s * (m + spec.laneWidth), 3, 6);
      solid(t, c + s * (m + spec.laneWidth * 2 - 0.1), 0.15);
    }
    // Expansion joints.
    t.ctx.fillStyle = 'rgba(8,8,8,0.75)';
    t.ctx.fillRect(0, 8.9, half * 2, 0.12);
    out.deck = { material: roadMaterial(assets, finish(t, assets), { polygonOffset: false }), length: 18, half };
  }

  // ----- plain asphalt for junction floors
  {
    const t = base(assets, 18, 18, 1024, 1024, 77);
    blemishes(t, 40);
    const tex = finish(t, assets);
    out.plain = { material: roadMaterial(assets, tex), length: 18 };
  }

  out.decals = buildDecalAtlas(assets);
  return out;
}

// Zebra crossings, stop lines and lane arrows share one alpha atlas.
function buildDecalAtlas(assets) {
  const size = 1024;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const rng = new RNG(5);
  ctx.clearRect(0, 0, size, size);
  const cell = size / 4;
  const wear = (x, y, w, h, n) => {
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = `rgba(0,0,0,${rng.float(0.2, 0.75)})`;
      const ww = rng.float(4, 38);
      const hh = rng.float(2, 14);
      ctx.fillRect(x + rng.float(0, w - ww), y + rng.float(0, h - hh), ww, hh);
    }
    ctx.globalCompositeOperation = 'source-over';
  };
  // Row 0: zebra tile (one stripe + gap, tiles sideways), spans 2 cells wide.
  ctx.fillStyle = WHITE;
  ctx.fillRect(0, 8, cell, cell - 16);
  wear(0, 8, cell, cell - 16, 40);
  // Row 0, cell 2..3: stop line tile.
  ctx.fillStyle = WHITE;
  ctx.fillRect(cell * 2, cell * 0.3, cell * 2, cell * 0.4);
  wear(cell * 2, cell * 0.3, cell * 2, cell * 0.4, 30);
  // Row 1..2: arrows (straight, left, right, straight+left), each 1 x 2 cells.
  const arrow = (col, kind) => {
    const x0 = col * cell;
    const y0 = cell;
    const h = cell * 2;
    ctx.save();
    ctx.translate(x0 + cell / 2, y0);
    ctx.fillStyle = WHITE;
    const shaft = (x, top, bottom, w = 26) => ctx.fillRect(x - w / 2, top, w, bottom - top);
    const head = (x, y, dir) => {
      ctx.beginPath();
      if (dir === 'up') {
        ctx.moveTo(x, y);
        ctx.lineTo(x - 52, y + 120);
        ctx.lineTo(x + 52, y + 120);
      } else if (dir === 'left') {
        ctx.moveTo(x, y);
        ctx.lineTo(x + 96, y - 48);
        ctx.lineTo(x + 96, y + 48);
      } else {
        ctx.moveTo(x, y);
        ctx.lineTo(x - 96, y - 48);
        ctx.lineTo(x - 96, y + 48);
      }
      ctx.closePath();
      ctx.fill();
    };
    if (kind === 'S' || kind === 'SL' || kind === 'SR') {
      shaft(0, 130, h - 30);
      head(0, 24, 'up');
    }
    if (kind === 'L' || kind === 'SL') {
      if (kind === 'L') shaft(20, 200, h - 30);
      ctx.fillRect(-50, kind === 'L' ? 190 : 250, 80, 26);
      head(-116, kind === 'L' ? 203 : 263, 'left');
    }
    if (kind === 'R' || kind === 'SR') {
      if (kind === 'R') shaft(-20, 200, h - 30);
      ctx.fillRect(-30, kind === 'R' ? 190 : 250, 80, 26);
      head(116, kind === 'R' ? 203 : 263, 'right');
    }
    ctx.restore();
    wear(x0, y0, cell, h, 26);
  };
  arrow(0, 'S');
  arrow(1, 'L');
  arrow(2, 'R');
  arrow(3, 'SL');
  // Row 3: yellow box junction hatch tile and "SLOW" legend.
  ctx.strokeStyle = YELLOW;
  ctx.lineWidth = 12;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, cell * 3, cell, cell);
  ctx.clip();
  for (let i = -4; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 64, cell * 3);
    ctx.lineTo(i * 64 + cell, cell * 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i * 64 + cell, cell * 3);
    ctx.lineTo(i * 64, cell * 4);
    ctx.stroke();
  }
  ctx.restore();
  wear(0, cell * 3, cell, cell, 30);

  const tex = canvasTexture(canvas, { anisotropy: assets.maxAniso });
  const material = new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    alphaTest: 0.08,
    depthWrite: false,
    roughness: 0.78,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  const uv = (col, row, w, h) => ({ u0: col / 4, v0: 1 - (row + h) / 4, u1: (col + w) / 4, v1: 1 - row / 4 });
  return {
    material,
    zebra: uv(0, 0, 1, 1),
    stop: uv(2, 0, 2, 1),
    arrows: { S: uv(0, 1, 1, 2), L: uv(1, 1, 1, 2), R: uv(2, 1, 1, 2), SL: uv(3, 1, 1, 2) },
    box: uv(0, 3, 1, 1),
  };
}

/** Black / yellow painted kerb stones, as on every Kochi median. Returns a canvas. */
export function kerbCanvas(a = '#d9b21f', b = '#1b1b1b') {
  const W = 1024;
  const H = 1024;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const rng = new RNG(9);
  const n = 8;
  const w = W / n;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 ? a : b;
    ctx.fillRect(i * w, 0, w, H);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(i * w, 0, 4, H);
  }
  for (let i = 0; i < 520; i++) {
    ctx.fillStyle = `rgba(${rng.int(40, 90)},${rng.int(40, 80)},${rng.int(30, 60)},${rng.float(0.1, 0.45)})`;
    ctx.fillRect(rng.float(0, W), rng.float(0, H), rng.float(4, 44), rng.float(8, 90));
  }
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(20,16,10,0.5)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  return canvas;
}
