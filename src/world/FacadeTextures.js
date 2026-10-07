// Painted building skins. Each facade style is a 4 x 4 grid of bays drawn in metric units
// with matching roughness / metalness and normal maps, so window glass catches the sky and
// sunshades and balconies pick up light. Shopfronts and hoardings carry Malayalam + English.

import * as THREE from 'three';
import { makeCanvas, canvasTexture, fitText, font, roundRect, weather, shade } from '../utils/canvas.js';
import { RNG } from '../utils/rng.js';

export const BAY = 3.4; // metres per bay
export const FLOOR = 3.1; // metres per floor
const GRID = 4;

class Layers {
  constructor(size, seed) {
    this.size = size;
    this.color = makeCanvas(size, size);
    this.orm = makeCanvas(size / 2, size / 2);
    this.height = makeCanvas(size / 2, size / 2);
    this.c = this.color.getContext('2d');
    this.o = this.orm.getContext('2d');
    this.h = this.height.getContext('2d');
    this.o.scale(0.5, 0.5);
    this.h.scale(0.5, 0.5);
    this.rng = new RNG(seed);
    this.surface(0, 0, size, size, '#ccc', 0.92, 0, 0.5);
  }

  /** Fill a rectangle on all three layers. rough / metal 0..1, height 0..1 (0.5 = wall plane). */
  surface(x, y, w, h, colour, rough = 0.9, metal = 0, height = 0.5) {
    if (colour) {
      this.c.fillStyle = colour;
      this.c.fillRect(x, y, w, h);
    }
    this.o.fillStyle = `rgb(255,${Math.round(rough * 255)},${Math.round(metal * 255)})`;
    this.o.fillRect(x, y, w, h);
    const v = Math.round(height * 255);
    this.h.fillStyle = `rgb(${v},${v},${v})`;
    this.h.fillRect(x, y, w, h);
  }

  glass(x, y, w, h, tint = [70, 96, 110], curtain = true) {
    const { c, rng } = this;
    const g = c.createLinearGradient(x, y, x + w * 0.3, y + h);
    const k = rng.float(0.75, 1.15);
    g.addColorStop(0, `rgb(${tint[0] * 1.5 * k},${tint[1] * 1.5 * k},${tint[2] * 1.5 * k})`);
    g.addColorStop(0.5, `rgb(${tint[0] * 0.75 * k},${tint[1] * 0.78 * k},${tint[2] * 0.8 * k})`);
    g.addColorStop(1, `rgb(${tint[0] * 0.4},${tint[1] * 0.42},${tint[2] * 0.45})`);
    this.surface(x, y, w, h, null, 0.08, 0.62, 0.34);
    c.fillStyle = g;
    c.fillRect(x, y, w, h);
    if (curtain && rng.chance(0.55)) {
      // Curtains or blinds half drawn behind the glass.
      const cw = w * rng.float(0.25, 0.6);
      const left = rng.chance(0.5);
      c.fillStyle = `rgba(${rng.int(170, 235)},${rng.int(160, 220)},${rng.int(140, 200)},${rng.float(0.35, 0.6)})`;
      c.fillRect(left ? x : x + w - cw, y, cw, h);
      c.fillStyle = 'rgba(0,0,0,0.12)';
      for (let i = 0; i < cw; i += 7) c.fillRect((left ? x : x + w - cw) + i, y, 2, h);
    }
    // Sky glint.
    c.fillStyle = 'rgba(255,255,255,0.10)';
    c.beginPath();
    c.moveTo(x, y + h * 0.55);
    c.lineTo(x + w * 0.45, y);
    c.lineTo(x + w * 0.7, y);
    c.lineTo(x, y + h * 0.9);
    c.fill();
  }

  frame(x, y, w, h, t, colour, height = 0.56) {
    this.surface(x, y, w, t, colour, 0.55, 0.1, height);
    this.surface(x, y + h - t, w, t, colour, 0.55, 0.1, height);
    this.surface(x, y, t, h, colour, 0.55, 0.1, height);
    this.surface(x + w - t, y, t, h, colour, 0.55, 0.1, height);
  }

  shadowBelow(x, y, w, depth, strength = 0.35) {
    const g = this.c.createLinearGradient(0, y, 0, y + depth);
    g.addColorStop(0, `rgba(0,0,0,${strength})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    this.c.fillStyle = g;
    this.c.fillRect(x, y, w, depth);
  }

  /** Colour, ORM and normal canvases for this facade. */
  canvases() {
    return { color: this.color, orm: this.orm, normal: heightToNormal(this.height, 2.2) };
  }
}

export function heightToNormal(canvas, strength = 2) {
  const w = canvas.width;
  const h = canvas.height;
  const src = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  const out = makeCanvas(w, h);
  const ctx = out.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const at = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const k = (y * w + x) * 4;
      d[k] = (-dx / l) * 127 + 128;
      d[k + 1] = (dy / l) * 127 + 128;
      d[k + 2] = (1 / l) * 127 + 128;
      d[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

function plasterBase(L, assets, colour, strength = 0.5) {
  const { c, size } = L;
  c.fillStyle = colour;
  c.fillRect(0, 0, size, size);
  const img = assets.textures.plaster.map.image;
  c.globalCompositeOperation = 'multiply';
  c.globalAlpha = strength;
  c.drawImage(img, 0, 0, size, size);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
}

function acUnit(L, x, y) {
  L.shadowBelow(x - 2, y + 30, 58, 22, 0.3);
  L.surface(x, y, 54, 32, '#e6e6e0', 0.5, 0.2, 0.78);
  L.c.fillStyle = '#9a9a96';
  L.c.beginPath();
  L.c.arc(x + 17, y + 16, 11, 0, Math.PI * 2);
  L.c.fill();
  L.c.fillStyle = '#c9c9c4';
  for (let i = 0; i < 5; i++) L.c.fillRect(x + 34, y + 6 + i * 5, 15, 2);
  // Condensate stain.
  const g = L.c.createLinearGradient(0, y + 32, 0, y + 110);
  g.addColorStop(0, 'rgba(40,50,35,0.3)');
  g.addColorStop(1, 'rgba(40,50,35,0)');
  L.c.fillStyle = g;
  L.c.fillRect(x + 22, y + 32, 7, 78);
}

function railing(L, x, y, w, h, colour = '#2a2a2a', glassy = false) {
  if (glassy) {
    L.surface(x, y, w, h, null, 0.12, 0.5, 0.72);
    L.c.fillStyle = 'rgba(120,160,170,0.55)';
    L.c.fillRect(x, y, w, h);
    L.surface(x, y, w, 4, '#d0d0d0', 0.3, 0.8, 0.76);
    return;
  }
  L.surface(x, y, w, 4, colour, 0.45, 0.6, 0.74);
  L.surface(x, y + h - 4, w, 4, colour, 0.45, 0.6, 0.74);
  for (let i = 0; i <= w; i += 9) L.surface(x + i, y, 2.5, h, colour, 0.45, 0.6, 0.72);
}

// ------------------------------------------------------------------------ facade styles
const STYLES = {
  // White / cream apartment tower with balconies and coloured accent bands.
  apartment(L, assets, p) {
    const S = L.size / GRID;
    plasterBase(L, assets, p.wall, 0.45);
    for (let r = 0; r < GRID; r++) {
      for (let col = 0; col < GRID; col++) {
        const x = col * S;
        const y = r * S;
        const balcony = col % 2 === 0;
        if (col === 1) L.surface(x + S - 26, y, 26, S, p.accent, 0.85, 0, 0.55);
        if (balcony) {
          // Recessed balcony: dark opening, sliding door, slab and railing.
          L.surface(x + 22, y + 46, S - 44, S - 70, '#3a3c3d', 0.9, 0, 0.22);
          L.glass(x + 40, y + 62, S - 120, S - 86, [60, 80, 92]);
          L.frame(x + 40, y + 62, S - 120, S - 86, 5, '#ddd', 0.3);
          L.surface(x + S - 74, y + 76, 34, S - 100, shade(p.wall, -0.25), 0.9, 0, 0.26);
          if (L.rng.chance(0.4)) {
            // Laundry on the line.
            for (let i = 0; i < 3; i++) {
              L.c.fillStyle = ['#c2453c', '#3b6fa8', '#e2d8b8', '#4b8a57'][L.rng.int(0, 3)];
              L.c.fillRect(x + 50 + i * 34, y + 70, 24, 40 + L.rng.int(0, 20));
            }
          }
          L.surface(x + 14, y + S - 30, S - 28, 12, shade(p.wall, -0.08), 0.9, 0, 0.8);
          railing(L, x + 18, y + S - 84, S - 36, 54, p.rail, p.glassRail);
          L.shadowBelow(x + 22, y + 46, S - 44, 26, 0.45);
        } else {
          const wx = x + 58;
          const wy = y + 70;
          const ww = S - 116;
          const wh = 112;
          L.surface(wx - 12, wy - 22, ww + 24, 12, shade(p.wall, -0.06), 0.9, 0, 0.82); // chajja
          L.shadowBelow(wx - 12, wy - 10, ww + 24, 22, 0.4);
          L.glass(wx, wy, ww, wh);
          L.frame(wx, wy, ww, wh, 5, p.frame);
          L.surface(wx + ww / 2 - 2, wy, 4, wh, p.frame, 0.5, 0.1, 0.56);
          L.surface(wx - 6, wy + wh, ww + 12, 7, shade(p.wall, -0.12), 0.9, 0, 0.66);
          if (L.rng.chance(0.45)) acUnit(L, wx + ww - 50, wy + wh + 14);
        }
        L.surface(x, y, S, 8, shade(p.wall, -0.14), 0.9, 0, 0.6); // slab line
        L.shadowBelow(x, y + 8, S, 10, 0.18);
      }
    }
    L.surface(3 * S + S - 12, 0, 8, L.size, '#77797a', 0.6, 0.3, 0.7); // rain-water pipe
    weather(L.c, 0, 0, L.size, L.size, () => L.rng.next(), p.age);
  },

  // Older painted concrete block: grilles, mismatched windows, plenty of monsoon.
  concrete(L, assets, p) {
    const S = L.size / GRID;
    plasterBase(L, assets, p.wall, 0.7);
    for (let r = 0; r < GRID; r++) {
      for (let col = 0; col < GRID; col++) {
        const x = col * S;
        const y = r * S;
        const wx = x + 40;
        const wy = y + 66;
        const ww = S - 80;
        const wh = 120;
        // Continuous sunshade.
        L.surface(x, wy - 26, S, 13, shade(p.wall, -0.18), 0.92, 0, 0.84);
        L.shadowBelow(x, wy - 13, S, 30, 0.45);
        L.surface(wx - 5, wy - 5, ww + 10, wh + 10, shade(p.wall, -0.3), 0.9, 0, 0.42);
        L.glass(wx, wy, ww, wh, [58, 74, 78]);
        L.frame(wx, wy, ww, wh, 5, p.frame);
        for (let i = 1; i < 3; i++) L.surface(wx + (ww * i) / 3 - 2, wy, 4, wh, p.frame, 0.6, 0.1, 0.56);
        if (L.rng.chance(0.6)) {
          // Steel grille.
          L.c.strokeStyle = 'rgba(30,30,30,0.7)';
          L.c.lineWidth = 2;
          for (let i = 8; i < ww; i += 14) {
            L.c.beginPath();
            L.c.moveTo(wx + i, wy);
            L.c.lineTo(wx + i, wy + wh);
            L.c.stroke();
          }
          for (let j = 20; j < wh; j += 34) {
            L.c.beginPath();
            L.c.moveTo(wx, wy + j);
            L.c.lineTo(wx + ww, wy + j);
            L.c.stroke();
          }
        }
        if (L.rng.chance(0.4)) acUnit(L, wx + L.rng.int(0, ww - 60), wy + wh + 14);
        L.surface(x, y, S, 9, shade(p.wall, -0.22), 0.92, 0, 0.62);
        if (col === 0) L.surface(x + 6, y, 9, S, '#6d6f70', 0.6, 0.3, 0.72);
      }
    }
    // Cable runs.
    L.c.strokeStyle = 'rgba(15,15,15,0.55)';
    L.c.lineWidth = 2.5;
    for (let r = 0; r < GRID; r++) {
      L.c.beginPath();
      L.c.moveTo(0, r * S + 40);
      L.c.bezierCurveTo(L.size * 0.3, r * S + 58, L.size * 0.7, r * S + 30, L.size, r * S + 40);
      L.c.stroke();
    }
    weather(L.c, 0, 0, L.size, L.size, () => L.rng.next(), p.age * 1.6);
  },

  // Glass curtain wall office / showroom.
  glass(L, assets, p) {
    const S = L.size / GRID;
    L.surface(0, 0, L.size, L.size, '#1d2a30', 0.08, 0.7, 0.4);
    for (let r = 0; r < GRID; r++) {
      for (let col = 0; col < GRID; col++) {
        const x = col * S;
        const y = r * S;
        for (let k = 0; k < 2; k++) {
          const px = x + k * (S / 2);
          L.glass(px + 3, y + 3, S / 2 - 6, S * 0.72 - 3, p.tint, false);
          // Spandrel panel hides the slab.
          L.surface(px + 3, y + S * 0.72 + 3, S / 2 - 6, S * 0.28 - 6, `rgb(${p.tint[0] * 0.55},${p.tint[1] * 0.55},${p.tint[2] * 0.6})`, 0.2, 0.55, 0.42);
          if (L.rng.chance(0.3)) {
            L.c.fillStyle = `rgba(255,236,190,${L.rng.float(0.06, 0.16)})`;
            L.c.fillRect(px + 3, y + 3, S / 2 - 6, S * 0.72 - 3);
          }
        }
        L.surface(x, y, S, 5, p.mullion, 0.35, 0.7, 0.6);
        L.surface(x, y, 5, S, p.mullion, 0.35, 0.7, 0.6);
        L.surface(x + S / 2 - 2, y, 4, S, p.mullion, 0.35, 0.7, 0.58);
      }
    }
    weather(L.c, 0, 0, L.size, L.size, () => L.rng.next(), 0.35);
  },

  // Aluminium composite panels with ribbon windows - the look of most new showrooms.
  acp(L, assets, p) {
    const S = L.size / GRID;
    L.surface(0, 0, L.size, L.size, p.wall, 0.42, 0.45, 0.5);
    for (let r = 0; r < GRID; r++) {
      const y = r * S;
      L.glass(0, y + 70, L.size, 110, p.tint, false);
      for (let col = 0; col < GRID; col++) {
        const x = col * S;
        L.surface(x + S / 2 - 2, y + 70, 4, 110, '#2a2a2a', 0.4, 0.6, 0.55);
        L.surface(x, y, 3, S, shade(p.wall, -0.35), 0.5, 0.4, 0.4);
        L.surface(x + S / 2, y, 2, 70, shade(p.wall, -0.3), 0.5, 0.4, 0.42);
        L.surface(x + S / 2, y + 180, 2, S - 180, shade(p.wall, -0.3), 0.5, 0.4, 0.42);
      }
      L.surface(0, y, L.size, 3, shade(p.wall, -0.35), 0.5, 0.4, 0.4);
      L.surface(0, y + 62, L.size, 8, p.accent, 0.4, 0.4, 0.62);
    }
    weather(L.c, 0, 0, L.size, L.size, () => L.rng.next(), 0.5);
  },

  // Low residential block / lodge with long shared balconies.
  lodge(L, assets, p) {
    const S = L.size / GRID;
    plasterBase(L, assets, p.wall, 0.6);
    for (let r = 0; r < GRID; r++) {
      const y = r * S;
      L.surface(0, y + 40, L.size, S - 70, shade(p.wall, -0.45), 0.92, 0, 0.2);
      for (let col = 0; col < GRID; col++) {
        const x = col * S;
        // Door and window behind the corridor.
        L.surface(x + 30, y + 70, 70, S - 100, p.door, 0.7, 0, 0.24);
        L.glass(x + 130, y + 84, 96, 84, [60, 78, 84]);
        L.frame(x + 130, y + 84, 96, 84, 4, p.frame, 0.26);
        L.surface(x, y + 40, 16, S - 40, p.wall, 0.9, 0, 0.6); // column
      }
      L.shadowBelow(0, y + 40, L.size, 40, 0.5);
      L.surface(0, y + S - 30, L.size, 14, shade(p.wall, -0.1), 0.9, 0, 0.8);
      railing(L, 0, y + S - 84, L.size, 54, p.rail);
      L.surface(0, y, L.size, 40, p.band, 0.9, 0, 0.62);
      L.surface(0, y + 34, L.size, 6, shade(p.band, -0.25), 0.9, 0, 0.7);
    }
    weather(L.c, 0, 0, L.size, L.size, () => L.rng.next(), p.age * 1.3);
  },
};

// Kerala house: plain lime-washed wall, teak windows with shutters and a grille.
STYLES.house = function house(L, assets, p) {
  const S = L.size / GRID;
  plasterBase(L, assets, p.wall, 0.5);
  for (let r = 0; r < GRID; r++) {
    for (let col = 0; col < GRID; col++) {
      const x = col * S;
      const y = r * S;
      if ((col + r) % 2 === 1 && L.rng.chance(0.5)) continue; // blank bay
      const wx = x + 62;
      const wy = y + 74;
      const ww = S - 124;
      const wh = 118;
      L.surface(wx - 16, wy - 24, ww + 32, 12, shade(p.wall, -0.1), 0.9, 0, 0.84);
      L.shadowBelow(wx - 16, wy - 12, ww + 32, 24, 0.42);
      L.glass(wx, wy, ww, wh, [50, 62, 60]);
      L.frame(wx - 4, wy - 4, ww + 8, wh + 8, 9, p.wood, 0.6);
      L.surface(wx + ww / 2 - 4, wy, 8, wh, p.wood, 0.7, 0, 0.6);
      L.c.strokeStyle = 'rgba(20,20,20,0.6)';
      L.c.lineWidth = 2;
      for (let j = 16; j < wh; j += 20) {
        L.c.beginPath();
        L.c.moveTo(wx, wy + j);
        L.c.lineTo(wx + ww, wy + j);
        L.c.stroke();
      }
      L.surface(wx - 10, wy + wh + 4, ww + 20, 8, shade(p.wall, -0.14), 0.9, 0, 0.68);
    }
    L.surface(0, r * S, L.size, 7, shade(p.wall, -0.12), 0.9, 0, 0.6);
    // Painted dado along the base of each storey.
    L.surface(0, r * S + S - 34, L.size, 34, p.dado, 0.9, 0, 0.54);
  }
  weather(L.c, 0, 0, L.size, L.size, () => L.rng.next(), p.age);
};

const PALETTES = {
  house: [
    { wall: '#f1eee4', wood: '#5a3a22', dado: '#8a8f93', age: 1.0 },
    { wall: '#efe2b8', wood: '#4a2f1c', dado: '#9a5a3a', age: 1.1 },
    { wall: '#dbe8d6', wood: '#3d2b1c', dado: '#6f8f78', age: 1.0 },
  ],
  apartment: [
    { wall: '#efece3', accent: '#c8552f', rail: '#2b2b2b', frame: '#f5f5f0', age: 0.7 },
    { wall: '#e9e4d2', accent: '#3d6f96', rail: '#3a3a3a', frame: '#ffffff', age: 0.8, glassRail: true },
    { wall: '#f1efe9', accent: '#7f8f3e', rail: '#555', frame: '#eee', age: 0.6 },
  ],
  concrete: [
    { wall: '#d9c58f', frame: '#5b3d2a', age: 1.0 },
    { wall: '#b9cdb4', frame: '#ece6d6', age: 1.1 },
    { wall: '#d6a9a0', frame: '#f0ece2', age: 1.0 },
    { wall: '#a9c2d4', frame: '#eeeeee', age: 0.9 },
  ],
  glass: [
    { tint: [70, 110, 128], mullion: '#c8ccd0' },
    { tint: [60, 96, 86], mullion: '#2a2d30' },
  ],
  acp: [
    { wall: '#c9cdd0', accent: '#c4262c', tint: [56, 78, 92] },
    { wall: '#e9e6df', accent: '#1f5fa8', tint: [60, 86, 98] },
  ],
  lodge: [
    { wall: '#e9dcb8', band: '#9a3b2c', door: '#5a3a24', frame: '#f0ece0', rail: '#3a2a20', age: 1.0 },
    { wall: '#dfe6e0', band: '#3f7a6a', door: '#3d2b20', frame: '#fff', rail: '#2b2b2b', age: 1.0 },
  ],
};

export function buildFacades(assets) {
  const out = [];
  let seed = 100;
  for (const style in PALETTES) {
    for (const palette of PALETTES[style]) {
      const L = new Layers(1024, seed++);
      STYLES[style](L, assets, palette);
      out.push({ style, palette, key: `facade_${style}_${out.length}`, ...L.canvases() });
    }
  }
  return out;
}

// ------------------------------------------------------------------------- shopfronts
const SHOPS = [
  ['കേരള ബേക്കറി', 'KERALA BAKERY', 'bakery'],
  ['മലബാർ ഹോട്ടൽ', 'MALABAR HOTEL', 'hotel'],
  ['നിള ടെക്സ്റ്റൈൽസ്', 'NILA TEXTILES', 'textile'],
  ['പെരിയാർ മെഡിക്കൽസ്', 'PERIYAR MEDICALS', 'medical'],
  ['കൊച്ചിൻ മൊബൈൽസ്', 'COCHIN MOBILES', 'mobile'],
  ['ശ്രീ കൃഷ്ണ സ്റ്റോഴ്സ്', 'SREE KRISHNA STORES', 'store'],
  ['സെന്റ് ജോർജ് ബേക്കറി', 'ST. GEORGE BAKERY', 'bakery'],
  ['അൽ അമീൻ ഹോട്ടൽ', 'AL AMEEN HOTEL', 'hotel'],
  ['ചായക്കട', 'TEA SHOP', 'tea'],
  ['സൂപ്പർ മാർക്കറ്റ്', 'MARGIN FREE MARKET', 'store'],
  ['നിള ജ്വല്ലേഴ്സ്', 'NILA JEWELLERS', 'jewel'],
  ['ഫ്രഷ് ജ്യൂസ്', 'COOL BAR & JUICE', 'juice'],
  ['പച്ചക്കറി കട', 'VEGETABLES', 'veg'],
  ['മലനാട് ബാങ്ക്', 'MALANAD BANK · ATM', 'bank'],
  ['സ്റ്റുഡിയോ', 'ROYAL STUDIO', 'mobile'],
  ['ഫർണിച്ചർ', 'KOCHI FURNITURE', 'textile'],
  ['ഇലക്ട്രോണിക്സ്', 'METRO ELECTRONICS', 'mobile'],
  ['ലോട്ടറി', 'BHAGYA LOTTERY', 'tea'],
  ['തട്ടുകട', 'THATTUKADA', 'tea'],
  ['ടയേഴ്സ്', 'NH TYRES & ALIGNMENT', 'garage'],
  ['സലൂൺ', 'GENTS SALOON', 'store'],
  ['ഹോട്ടൽ ആര്യാസ്', 'HOTEL ARYAS · VEG', 'hotel'],
  ['കസവ് സിൽക്ക്സ്', 'KASAVU SILKS', 'textile'],
  ['ഫ്രഷ് മീൻ', 'FRESH FISH', 'veg'],
  ['ബിരിയാണി', 'KOCHI BIRIYANI HOUSE', 'hotel'],
  ['മെട്രോ ഹോസ്പിറ്റൽ ഫാർമസി', 'PHARMACY · 24 HRS', 'medical'],
  ['ട്രാവൽസ്', 'BACKWATER TRAVELS', 'store'],
  ['പെയിന്റ്സ്', 'MARADU PAINTS', 'store'],
  ['ഓപ്റ്റിക്കൽസ്', 'VISION OPTICALS', 'jewel'],
  ['കട', 'STATIONERY & XEROX', 'store'],
  ['ഷവർമ', 'ARABIAN SHAWARMA', 'juice'],
  ['വർക്ക്ഷോപ്പ്', 'TWO WHEELER WORKSHOP', 'garage'],
];

const SIGN_COLOURS = [
  ['#b3131b', '#fff7d6'],
  ['#0f4c8a', '#ffffff'],
  ['#f2c01c', '#1a1a1a'],
  ['#0d6b45', '#fff'],
  ['#1a1a1a', '#ffd34d'],
  ['#ffffff', '#b3131b'],
  ['#6a1f7a', '#ffe9a6'],
  ['#e05a1a', '#ffffff'],
  ['#f4f1e8', '#0f4c8a'],
  ['#123a4a', '#9ff0e0'],
];

export const SHOP_COLS = 4;
export const SHOP_ROWS = 8;

export function buildShopAtlas(assets) {
  const W = 2048;
  const H = 2048;
  const canvas = makeCanvas(W, H);
  const c = canvas.getContext('2d');
  const orm = makeCanvas(W / 2, H / 2);
  const o = orm.getContext('2d');
  o.scale(0.5, 0.5);
  o.fillStyle = 'rgb(255,225,0)';
  o.fillRect(0, 0, W, H);
  const rng = new RNG(808);
  const tw = W / SHOP_COLS;
  const th = H / SHOP_ROWS;
  const corrugated = assets.textures.corrugated.map.image;
  SHOPS.forEach((shop, i) => {
    const x = (i % SHOP_COLS) * tw;
    const y = Math.floor(i / SHOP_COLS) * th;
    const kind = shop[2];
    const [bg, fg] = SIGN_COLOURS[rng.int(0, SIGN_COLOURS.length - 1)];
    c.save();
    c.beginPath();
    c.rect(x, y, tw, th);
    c.clip();
    // Wall / pier.
    c.fillStyle = shade(['#d8cfb8', '#c9d2c0', '#d9c0b0', '#cfd3d8'][rng.int(0, 3)], -0.05);
    c.fillRect(x, y, tw, th);
    const signH = 74;
    const open = { x: x + 14, y: y + signH + 8, w: tw - 28, h: th - signH - 22 };
    // Interior.
    const closed = rng.chance(0.16);
    if (closed) {
      c.drawImage(corrugated, open.x, open.y, open.w, open.h);
      c.fillStyle = 'rgba(70,80,90,0.35)';
      c.fillRect(open.x, open.y, open.w, open.h);
      c.fillStyle = 'rgba(255,255,255,0.75)';
      fitText(c, shop[0], open.x + open.w / 2, open.y + open.h / 2, open.w * 0.8, 44, 800);
      o.fillStyle = 'rgb(255,120,180)';
      o.fillRect(open.x, open.y, open.w, open.h);
    } else {
      const g = c.createLinearGradient(0, open.y, 0, open.y + open.h);
      g.addColorStop(0, '#15120f');
      g.addColorStop(1, '#3a332b');
      c.fillStyle = g;
      c.fillRect(open.x, open.y, open.w, open.h);
      // Warm tube-light wash.
      c.fillStyle = 'rgba(255,238,200,0.16)';
      c.fillRect(open.x, open.y, open.w, open.h * 0.5);
      c.fillStyle = 'rgba(255,255,255,0.85)';
      c.fillRect(open.x + 30, open.y + 10, open.w - 60, 4);
      drawGoods(c, kind, open, rng);
      const glassFront = ['jewel', 'mobile', 'bank', 'medical', 'textile'].includes(kind);
      if (glassFront) {
        c.fillStyle = 'rgba(150,190,200,0.16)';
        c.fillRect(open.x, open.y, open.w, open.h);
        c.strokeStyle = '#c9c9c9';
        c.lineWidth = 5;
        c.strokeRect(open.x + 2, open.y + 2, open.w - 4, open.h - 4);
        c.beginPath();
        c.moveTo(open.x + open.w * 0.62, open.y);
        c.lineTo(open.x + open.w * 0.62, open.y + open.h);
        c.stroke();
        o.fillStyle = 'rgb(255,30,140)';
        o.fillRect(open.x, open.y, open.w, open.h);
      }
      // Rolled-up shutter box.
      c.drawImage(corrugated, 0, 0, 512, 60, open.x, open.y, open.w, 20);
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fillRect(open.x, open.y + 20, open.w, 8);
    }
    // Step.
    c.fillStyle = '#8d877c';
    c.fillRect(x, y + th - 14, tw, 14);
    // Sign board.
    const g2 = c.createLinearGradient(0, y, 0, y + signH);
    g2.addColorStop(0, shade(bg, 0.12));
    g2.addColorStop(1, shade(bg, -0.12));
    c.fillStyle = g2;
    c.fillRect(x + 4, y + 4, tw - 8, signH - 4);
    c.strokeStyle = 'rgba(0,0,0,0.5)';
    c.lineWidth = 3;
    c.strokeRect(x + 5, y + 5, tw - 10, signH - 6);
    c.fillStyle = fg;
    fitText(c, shop[0], x + tw / 2, y + 30, tw - 40, 40, 800);
    c.globalAlpha = 0.92;
    fitText(c, shop[1], x + tw / 2, y + 60, tw - 60, 20, 700);
    c.globalAlpha = 1;
    o.fillStyle = 'rgb(255,110,40)';
    o.fillRect(x + 4, y + 4, tw - 8, signH - 4);
    weather(c, x, y, tw, th, () => rng.next(), 0.7);
    c.restore();
  });
  return { canvas, orm, count: SHOPS.length };
}

function drawGoods(c, kind, r, rng) {
  const shelf = (y, colours, h = 16) => {
    c.fillStyle = '#5a4632';
    c.fillRect(r.x + 10, y + h, r.w - 20, 4);
    for (let i = r.x + 14; i < r.x + r.w - 20; i += rng.int(8, 16)) {
      c.fillStyle = colours[rng.int(0, colours.length - 1)];
      c.fillRect(i, y + rng.int(0, 5), rng.int(6, 12), h - rng.int(0, 5));
    }
  };
  const bright = ['#d9412f', '#f2c01c', '#2f7fbf', '#3d9a4e', '#ffffff', '#e27a2a', '#8a3fa0'];
  if (kind === 'store' || kind === 'medical' || kind === 'mobile') {
    for (let k = 0; k < 4; k++) shelf(r.y + 30 + k * 30, kind === 'medical' ? ['#fff', '#d9f0e8', '#3d9a4e', '#d9412f'] : bright);
    c.fillStyle = '#6d5a44';
    c.fillRect(r.x + 10, r.y + r.h - 46, r.w * 0.6, 46);
  } else if (kind === 'bakery' || kind === 'jewel') {
    c.fillStyle = kind === 'jewel' ? '#3a0d12' : '#4a3a2a';
    c.fillRect(r.x + 8, r.y + 26, r.w - 16, r.h - 26);
    for (let k = 0; k < 3; k++) shelf(r.y + 34 + k * 26, kind === 'jewel' ? ['#f5d37a', '#e9b84a', '#fff1c0'] : ['#e9c28a', '#c98a4a', '#f5e1c0', '#8a4a2a']);
    c.fillStyle = 'rgba(200,230,240,0.3)';
    c.fillRect(r.x + 10, r.y + r.h - 56, r.w - 20, 50);
  } else if (kind === 'textile') {
    for (let i = 0; i < 7; i++) {
      c.fillStyle = bright[rng.int(0, bright.length - 1)];
      const w = (r.w - 40) / 7;
      c.fillRect(r.x + 20 + i * w, r.y + 34, w - 6, r.h - 60);
      c.fillStyle = 'rgba(255,255,255,0.25)';
      c.fillRect(r.x + 20 + i * w, r.y + 34, (w - 6) * 0.3, r.h - 60);
    }
  } else if (kind === 'hotel' || kind === 'tea' || kind === 'juice') {
    // Counter, glass snack case, stools.
    c.fillStyle = '#7a5a3a';
    c.fillRect(r.x + 10, r.y + r.h - 54, r.w * 0.5, 54);
    c.fillStyle = 'rgba(220,240,240,0.35)';
    c.fillRect(r.x + 16, r.y + r.h - 86, r.w * 0.34, 32);
    for (let i = 0; i < 8; i++) {
      c.fillStyle = ['#d98a2a', '#e9c04a', '#b8562a'][rng.int(0, 2)];
      c.beginPath();
      c.arc(r.x + 28 + i * 16, r.y + r.h - 66, 6, 0, Math.PI * 2);
      c.fill();
    }
    for (let i = 0; i < 3; i++) {
      c.fillStyle = '#c33';
      c.fillRect(r.x + r.w * 0.6 + i * 46, r.y + r.h - 40, 30, 8);
      c.fillStyle = '#333';
      c.fillRect(r.x + r.w * 0.6 + i * 46 + 12, r.y + r.h - 32, 5, 32);
    }
    if (kind === 'juice') for (let i = 0; i < 9; i++) {
      c.fillStyle = ['#f2a21c', '#e2412f', '#8bc34a', '#ffd34d'][rng.int(0, 3)];
      c.beginPath();
      c.arc(r.x + 30 + i * 24, r.y + 44, 9, 0, Math.PI * 2);
      c.fill();
    }
  } else if (kind === 'veg') {
    for (let k = 0; k < 3; k++) {
      for (let i = 0; i < 6; i++) {
        c.fillStyle = ['#3d9a4e', '#d9412f', '#e9c04a', '#8a3fa0', '#e27a2a', '#6db04a'][rng.int(0, 5)];
        const w = (r.w - 30) / 6;
        c.fillRect(r.x + 15 + i * w, r.y + r.h - 40 - k * 34, w - 6, 26);
      }
    }
  } else if (kind === 'bank') {
    c.fillStyle = '#e9eef2';
    c.fillRect(r.x + 8, r.y + 26, r.w - 16, r.h - 26);
    c.fillStyle = '#1f5fa8';
    c.fillRect(r.x + r.w * 0.66, r.y + 40, r.w * 0.26, r.h - 60);
    c.fillStyle = '#9fd0ff';
    c.fillRect(r.x + r.w * 0.7, r.y + 56, r.w * 0.18, 34);
  } else {
    // Garage: tyres and a dark bay.
    for (let i = 0; i < 5; i++) {
      c.strokeStyle = '#0b0b0b';
      c.lineWidth = 11;
      c.beginPath();
      c.arc(r.x + 50 + i * 46, r.y + r.h - 40 - (i % 2) * 40, 20, 0, Math.PI * 2);
      c.stroke();
    }
  }
}

// --------------------------------------------------------------------------- hoardings
const HOARDINGS = [
  { ml: 'ബ്രോട്ടോടൈപ്പ്', en: 'BROTOTYPE', sub: 'Become a software engineer', bg: ['#0b0b0c', '#2a2a2e'], fg: '#ffffff', accent: '#e11d2e' },
  { ml: 'കസവ് സിൽക്ക്സ്', en: 'KASAVU SILKS', sub: 'Wedding collection · Edappally', bg: ['#6a0f2a', '#c4262c'], fg: '#ffe9a6', accent: '#ffd34d' },
  { ml: 'നിള ജ്വല്ലേഴ്സ്', en: 'NILA JEWELLERS', sub: '916 Hallmark Gold', bg: ['#1a0d05', '#5a3a0a'], fg: '#f5d37a', accent: '#fff1c0' },
  { ml: 'ഓണം മെഗാ സെയിൽ', en: 'ONAM MEGA SALE', sub: 'Up to 60% off', bg: ['#f2a21c', '#e2412f'], fg: '#ffffff', accent: '#fff59d' },
  { ml: 'പെരിയാർ ബിൽഡേഴ്സ്', en: 'PERIYAR BUILDERS', sub: 'Lake-view apartments · Kakkanad', bg: ['#0f3d5a', '#2f8fb0'], fg: '#ffffff', accent: '#bdf0ff' },
  { ml: 'കൊച്ചി മെട്രോ', en: 'KOCHI METRO', sub: 'Aluva — Thrippunithura', bg: ['#0a5f66', '#2fd6cf'], fg: '#ffffff', accent: '#eaffff' },
  { ml: 'മെട്രോ ഹോസ്പിറ്റൽ', en: 'METRO HOSPITAL', sub: '24×7 Emergency · Palarivattom', bg: ['#f4f7f9', '#d5e6ee'], fg: '#0f4c8a', accent: '#d9412f' },
  { ml: 'കായൽ ഹോളിഡേയ്സ്', en: 'BACKWATER HOLIDAYS', sub: 'Houseboats · Alappuzha', bg: ['#0d5a3a', '#6db04a'], fg: '#ffffff', accent: '#fff59d' },
];

export function buildHoardingAtlas(assets) {
  const W = 2048;
  const H = 2048;
  const canvas = makeCanvas(W, H);
  const c = canvas.getContext('2d');
  const rng = new RNG(606);
  const tw = W / 2;
  const th = H / 4;
  HOARDINGS.forEach((h, i) => {
    const x = (i % 2) * tw;
    const y = Math.floor(i / 2) * th;
    c.save();
    c.beginPath();
    c.rect(x, y, tw, th);
    c.clip();
    const g = c.createLinearGradient(x, y, x + tw, y + th);
    g.addColorStop(0, h.bg[0]);
    g.addColorStop(1, h.bg[1]);
    c.fillStyle = g;
    c.fillRect(x, y, tw, th);
    // Graphic shapes.
    c.globalAlpha = 0.16;
    c.fillStyle = h.accent;
    c.beginPath();
    c.arc(x + tw * 0.86, y + th * 0.2, th * 0.7, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(x + tw * 0.1, y + th * 1.05, th * 0.5, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
    c.fillStyle = h.accent;
    c.fillRect(x + 60, y + th * 0.74, 150, 8);
    c.fillStyle = h.fg;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    fitText(c, h.ml, x + 60, y + th * 0.3, tw - 140, 118, 800, 'left');
    fitText(c, h.en, x + 60, y + th * 0.58, tw - 140, 86, 800, 'left');
    c.globalAlpha = 0.9;
    fitText(c, h.sub, x + 60, y + th * 0.86, tw - 140, 44, 400, 'left');
    c.globalAlpha = 1;
    // Frame.
    c.strokeStyle = '#2a2a2a';
    c.lineWidth = 14;
    c.strokeRect(x + 7, y + 7, tw - 14, th - 14);
    weather(c, x, y, tw, th, () => rng.next(), 0.45);
    c.restore();
  });
  return { canvas, count: HOARDINGS.length, cols: 2, rows: 4 };
}

export { roundRect, font };
