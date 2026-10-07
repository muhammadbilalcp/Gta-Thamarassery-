// Custom texture layers for the landmarks (cladding, stadium seats, the pitch ...) and a
// sign sheet allocator so every name board in the city shares the same material.

import { makeCanvas, fitText, font, weather, shade, roundRect } from '../../utils/canvas.js';
import { RNG } from '../../utils/rng.js';
import { heightToNormal } from '../FacadeTextures.js';

const S = 1024;

/** Shelf packer over 1024 x 1024 sheets. Signs may have transparent backgrounds. */
export class SignSheets {
  constructor(count = 3) {
    this.sheets = [];
    for (let i = 0; i < count; i++) {
      const canvas = makeCanvas(S, S);
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, S, S);
      this.sheets.push({ canvas, ctx, x: 0, y: 0, row: 0 });
    }
    this.rects = {};
  }

  /**
   * Reserve w x h pixels and draw into them. `draw(ctx, w, h)` works in local coordinates.
   * Returns { sheet, u0, v0, u1, v1, aspect }.
   */
  add(id, w, h, draw) {
    const pad = 6;
    for (let i = 0; i < this.sheets.length; i++) {
      const sh = this.sheets[i];
      if (sh.x + w + pad > S) {
        sh.x = 0;
        sh.y += sh.row + pad;
        sh.row = 0;
      }
      if (sh.y + h + pad > S) continue;
      const x = sh.x;
      const y = sh.y;
      sh.x += w + pad;
      sh.row = Math.max(sh.row, h);
      sh.ctx.save();
      sh.ctx.translate(x, y);
      sh.ctx.beginPath();
      sh.ctx.rect(0, 0, w, h);
      sh.ctx.clip();
      draw(sh.ctx, w, h);
      sh.ctx.restore();
      const r = { sheet: i, u0: x / S, u1: (x + w) / S, v0: 1 - (y + h) / S, v1: 1 - y / S, aspect: w / h };
      this.rects[id] = r;
      return r;
    }
    console.warn('[signs] out of sheet space for', id);
    return { sheet: 0, u0: 0, u1: 0.01, v0: 0, v1: 0.01, aspect: 1 };
  }

  get(id) {
    return this.rects[id];
  }
}

/** Plain board: coloured panel, big line, optional second line. */
export function board(ctx, w, h, { bg = '#0d5a3a', fg = '#fff', lines = [], border = null, radius = 10, weights = [] }) {
  if (bg) {
    roundRect(ctx, 1, 1, w - 2, h - 2, radius);
    ctx.fillStyle = bg;
    ctx.fill();
    if (border) {
      ctx.lineWidth = 5;
      ctx.strokeStyle = border;
      roundRect(ctx, 6, 6, w - 12, h - 12, radius * 0.7);
      ctx.stroke();
    }
  }
  ctx.fillStyle = fg;
  const n = lines.length;
  const total = lines.reduce((s, l) => s + (l.size ?? 1), 0);
  let y = h * 0.08;
  const usable = h * 0.84;
  lines.forEach((l, i) => {
    const lh = (usable * (l.size ?? 1)) / total;
    ctx.fillStyle = l.color || fg;
    fitText(ctx, l.text, w / 2, y + lh / 2 + 2, w - 36, lh * 0.82, weights[i] ?? l.weight ?? 800);
    y += lh;
  });
  void n;
}

export function buildLandmarkLayers(atlas, assets) {
  const rng = new RNG(4711);
  const out = {};

  // --- LuLu: warm sandstone cladding in courses ------------------------------------
  {
    const c = makeCanvas(S, S);
    const h = makeCanvas(S / 2, S / 2);
    const ctx = c.getContext('2d');
    const hx = h.getContext('2d');
    hx.scale(0.5, 0.5);
    hx.fillStyle = '#808080';
    hx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#d9bf8f';
    ctx.fillRect(0, 0, S, S);
    const img = assets.textures.plaster.map.image;
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.55;
    ctx.drawImage(img, 0, 0, S, S);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    for (let y = 0; y < S; y += 128) {
      for (let x = 0; x < S; x += 256) {
        const off = (y / 128) % 2 ? 128 : 0;
        ctx.fillStyle = `rgba(${rng.int(150, 235)},${rng.int(120, 190)},${rng.int(70, 130)},${rng.float(0.05, 0.16)})`;
        ctx.fillRect(x + off, y, 256, 128);
        ctx.fillStyle = 'rgba(70,50,30,0.5)';
        ctx.fillRect(x + off, y, 3, 128);
        hx.fillStyle = '#404040';
        hx.fillRect(x + off, y, 4, 128);
      }
      ctx.fillStyle = 'rgba(70,50,30,0.55)';
      ctx.fillRect(0, y, S, 4);
      hx.fillStyle = '#383838';
      hx.fillRect(0, y, S, 5);
    }
    weather(ctx, 0, 0, S, S, () => rng.next(), 0.5);
    out.luluStone = atlas.add('luluStone', c, { normal: heightToNormal(h, 2.5), rough: 0.86 });
  }

  // --- Forum: green and yellow "palm leaf" panels behind the fins --------------------
  {
    const c = makeCanvas(S, S);
    const o = makeCanvas(S / 2, S / 2);
    const ctx = c.getContext('2d');
    const ox = o.getContext('2d');
    ox.fillStyle = 'rgb(255,60,120)';
    ox.fillRect(0, 0, S / 2, S / 2);
    ctx.fillStyle = '#1e2b2c';
    ctx.fillRect(0, 0, S, S);
    const greens = ['#4f9a2f', '#6db534', '#3c8a2b', '#8cc63f', '#2f7a2a'];
    const cell = S / 4;
    for (let r = 0; r < 4; r++) {
      for (let col = 0; col < 4; col++) {
        const x = col * cell;
        const y = r * cell;
        const up = (col + r) % 2 === 0;
        // Each bay: a leaning parallelogram of green with a yellow spine.
        ctx.fillStyle = greens[rng.int(0, greens.length - 1)];
        ctx.beginPath();
        if (up) {
          ctx.moveTo(x + 10, y + cell);
          ctx.lineTo(x + cell * 0.55, y);
          ctx.lineTo(x + cell - 10, y);
          ctx.lineTo(x + cell * 0.45, y + cell);
        } else {
          ctx.moveTo(x + 10, y);
          ctx.lineTo(x + cell * 0.55, y + cell);
          ctx.lineTo(x + cell - 10, y + cell);
          ctx.lineTo(x + cell * 0.45, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#f2c81e';
        ctx.lineWidth = 18;
        ctx.beginPath();
        if (up) {
          ctx.moveTo(x + cell * 0.2, y + cell);
          ctx.lineTo(x + cell * 0.72, y);
        } else {
          ctx.moveTo(x + cell * 0.2, y);
          ctx.lineTo(x + cell * 0.72, y + cell);
        }
        ctx.stroke();
        // Glass glint.
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(x, y, cell, cell * 0.4);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x, y, cell, 5);
      }
    }
    out.forumLeaf = atlas.add('forumLeaf', c, { orm: o });
  }

  // --- charcoal ACP panels -------------------------------------------------------------
  {
    const c = makeCanvas(S, S);
    const h = makeCanvas(S / 2, S / 2);
    const ctx = c.getContext('2d');
    const hx = h.getContext('2d');
    hx.scale(0.5, 0.5);
    hx.fillStyle = '#808080';
    hx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#3a3d41';
    ctx.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 256) {
      for (let x = 0; x < S; x += 256) {
        ctx.fillStyle = `rgba(${rng.int(40, 80)},${rng.int(40, 80)},${rng.int(45, 85)},0.5)`;
        ctx.fillRect(x + 3, y + 3, 250, 250);
        ctx.fillStyle = '#16181a';
        ctx.fillRect(x, y, 256, 4);
        ctx.fillRect(x, y, 4, 256);
        hx.fillStyle = '#303030';
        hx.fillRect(x, y, 256, 5);
        hx.fillRect(x, y, 5, 256);
      }
    }
    weather(ctx, 0, 0, S, S, () => rng.next(), 0.4);
    out.charcoal = atlas.add('charcoal', c, { normal: heightToNormal(h, 2), rough: 0.45, metal: 0.4 });
  }

  // --- stadium seating: blocks of yellow, blue, green and red seats --------------------
  {
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#8f8d86';
    ctx.fillRect(0, 0, S, S);
    const cols = ['#e9c31e', '#2f66b8', '#3c9a4a', '#d23b2f', '#e9c31e', '#e9c31e'];
    const rows = 32;
    const rh = S / rows;
    for (let block = 0; block < 4; block++) {
      const col = cols[rng.int(0, cols.length - 1)];
      const bx = block * (S / 4);
      for (let r = 0; r < rows; r++) {
        const y = r * rh;
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(bx, y + rh * 0.78, S / 4, rh * 0.22);
        for (let sx = bx + 14; sx < bx + S / 4 - 14; sx += 16) {
          ctx.fillStyle = rng.chance(0.06) ? '#777' : shade(col, rng.float(-0.12, 0.1));
          ctx.fillRect(sx, y + rh * 0.12, 12, rh * 0.62);
        }
      }
      ctx.fillStyle = '#a9a7a0';
      ctx.fillRect(bx, 0, 12, S);
    }
    out.seats = atlas.add('seats', c, { rough: 0.7 });
  }

  // --- football pitch ------------------------------------------------------------------
  {
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#3f8a35';
    ctx.fillRect(0, 0, S, S);
    // Mown stripes.
    const px = 150;
    const pw = S - 300;
    const py = 60;
    const ph = S - 120;
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
      ctx.fillRect(px, py + (i * ph) / 14, pw, ph / 14);
    }
    const img = assets.textures.grass.map.image;
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.4;
    ctx.drawImage(img, 0, 0, S, S);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 5;
    ctx.strokeRect(px, py, pw, ph);
    ctx.beginPath();
    ctx.moveTo(px, S / 2);
    ctx.lineTo(px + pw, S / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, 78, 0, Math.PI * 2);
    ctx.stroke();
    for (const end of [0, 1]) {
      const y0 = end ? py + ph : py;
      const d = end ? -1 : 1;
      ctx.strokeRect(S / 2 - 170, Math.min(y0, y0 + d * 140), 340, 140);
      ctx.strokeRect(S / 2 - 78, Math.min(y0, y0 + d * 48), 156, 48);
      ctx.beginPath();
      ctx.arc(S / 2, y0 + d * 94, 78, end ? Math.PI * 1.2 : Math.PI * 0.2, end ? Math.PI * 1.8 : Math.PI * 0.8);
      ctx.stroke();
    }
    out.pitch = atlas.add('pitch', c, { rough: 0.95 });
  }

  // --- space-frame lattice over polycarbonate (Mobility Hub skylights) -----------------
  {
    const c = makeCanvas(S, S);
    const o = makeCanvas(S / 2, S / 2);
    const ctx = c.getContext('2d');
    const ox = o.getContext('2d');
    ox.fillStyle = 'rgb(255,70,90)';
    ox.fillRect(0, 0, S / 2, S / 2);
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, '#cfe3e6');
    g.addColorStop(1, '#9db9bf');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = '#f4f4f0';
    ctx.lineWidth = 12;
    const step = S / 4;
    for (let i = -4; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo(i * step, 0);
      ctx.lineTo(i * step + S / 2, S);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i * step, 0);
      ctx.lineTo(i * step - S / 2, S);
      ctx.stroke();
    }
    for (let y = 0; y <= S; y += S / 2) ctx.fillRect(0, y - 6, S, 12);
    out.lattice = atlas.add('lattice', c, { orm: o });
  }

  // --- car-park decks: slabs, shadowed bays, bright parapets ---------------------------
  {
    const c = makeCanvas(S, S);
    const h = makeCanvas(S / 2, S / 2);
    const ctx = c.getContext('2d');
    const hx = h.getContext('2d');
    hx.scale(0.5, 0.5);
    hx.fillStyle = '#808080';
    hx.fillRect(0, 0, S, S);
    const fh = S / 4;
    for (let r = 0; r < 4; r++) {
      const y = r * fh;
      const g = ctx.createLinearGradient(0, y, 0, y + fh);
      g.addColorStop(0, '#0e0f10');
      g.addColorStop(1, '#2b2c2d');
      ctx.fillStyle = g;
      ctx.fillRect(0, y, S, fh);
      hx.fillStyle = '#202020';
      hx.fillRect(0, y, S, fh);
      // Cars glimpsed inside.
      for (let i = 0; i < 9; i++) {
        if (!rng.chance(0.6)) continue;
        ctx.fillStyle = ['#c9c9c9', '#8a1a1a', '#e8e8e8', '#1f3f78', '#333'][rng.int(0, 4)];
        ctx.fillRect(20 + i * 112, y + fh * 0.42, 84, fh * 0.2);
      }
      ctx.fillStyle = '#d8d2c2';
      ctx.fillRect(0, y + fh * 0.62, S, fh * 0.38);
      hx.fillStyle = '#c0c0c0';
      hx.fillRect(0, y + fh * 0.62, S, fh * 0.38);
      ctx.fillStyle = '#b8b2a4';
      ctx.fillRect(0, y, S, 14);
      for (let x = 0; x < S; x += 256) {
        ctx.fillStyle = '#cfc9b9';
        ctx.fillRect(x, y, 30, fh);
        hx.fillStyle = '#d0d0d0';
        hx.fillRect(x, y, 30, fh);
      }
    }
    weather(ctx, 0, 0, S, S, () => rng.next(), 0.9);
    out.carpark = atlas.add('carpark', c, { normal: heightToNormal(h, 2.5), rough: 0.9 });
  }

  // --- interlocking pavers for plazas and the bus apron --------------------------------
  out.pavers = atlas.add('pavers', assets.textures.pavers.map.image, { normal: assets.textures.pavers.normalMap.image, roughImage: assets.textures.pavers.roughnessMap.image });
  {
    // Car-park bitumen: the photographed grain at half strength so cracks do not dominate.
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#6a6b6d';
    ctx.fillRect(0, 0, S, S);
    ctx.globalAlpha = 0.45;
    ctx.drawImage(assets.textures.asphalt.map.image, 0, 0, S, S);
    ctx.globalAlpha = 1;
    out.asphalt = atlas.add('asphalt', c, { rough: 0.9 });
  }
  out.grass = atlas.add('grass', assets.textures.grass.map.image, { normal: assets.textures.grass.normalMap.image, rough: 0.95 });
  return out;
}

export { font };
