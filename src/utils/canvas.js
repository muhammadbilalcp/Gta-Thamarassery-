// Canvas helpers for generated textures (signage, facades, road markings).

import * as THREE from 'three';
import { SIGN_FONT } from '../core/Assets.js';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function canvasTexture(canvas, { srgb = true, repeat = false, anisotropy = 8, mipmaps = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = anisotropy;
  t.generateMipmaps = mipmaps;
  t.minFilter = mipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

export const font = (px, weight = 700) => `${weight} ${px}px ${SIGN_FONT}`;

/** Draw text shrunk to fit `maxWidth`. Returns the pixel size that was used. */
export function fitText(ctx, text, x, y, maxWidth, px, weight = 700, align = 'center') {
  let size = px;
  ctx.font = font(size, weight);
  let w = ctx.measureText(text).width;
  if (w > maxWidth) {
    size = Math.max(6, Math.floor((size * maxWidth) / w));
    ctx.font = font(size, weight);
    w = ctx.measureText(text).width;
  }
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  return size;
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Speckle noise that breaks up flat canvas fills. */
export function grain(ctx, w, h, amount = 0.06, rand = Math.random) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 255 * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

/** Vertical rain streaks and grime - Kerala walls wear the monsoon. */
export function weather(ctx, x, y, w, h, rand, strength = 1) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const streaks = Math.floor((w / 18) * strength);
  for (let i = 0; i < streaks; i++) {
    const sx = x + rand() * w;
    const len = h * (0.15 + rand() * 0.55);
    const width = 2 + rand() * 9;
    const g = ctx.createLinearGradient(0, y, 0, y + len);
    const a = (0.05 + rand() * 0.13) * strength;
    const tone = rand() < 0.35 ? '38,52,30' : '25,25,22';
    g.addColorStop(0, `rgba(${tone},${a})`);
    g.addColorStop(1, `rgba(${tone},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(sx, y, width, len);
  }
  // Damp band along the base.
  const g2 = ctx.createLinearGradient(0, y + h * 0.82, 0, y + h);
  g2.addColorStop(0, 'rgba(30,38,26,0)');
  g2.addColorStop(1, `rgba(30,38,26,${0.28 * strength})`);
  ctx.fillStyle = g2;
  ctx.fillRect(x, y + h * 0.82, w, h * 0.18);
  ctx.restore();
}

export function shade(hex, amount) {
  const c = new THREE.Color(hex);
  if (amount >= 0) c.lerp(new THREE.Color(0xffffff), amount);
  else c.lerp(new THREE.Color(0x000000), -amount);
  return `#${c.getHexString()}`;
}
