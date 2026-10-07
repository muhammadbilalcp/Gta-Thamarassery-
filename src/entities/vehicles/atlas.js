// One shared texture for every vehicle: Kerala number plates, bus destination boards and
// liveries. Anything untextured samples a white texel in the corner.

import { makeCanvas, canvasTexture, fitText, font, roundRect } from '../../utils/canvas.js';
import { RNG } from '../../utils/rng.js';

const SIZE = 2048;

const DESTINATIONS = [
  ['എറണാകുളം', 'ERNAKULAM'],
  ['ആലുവ', 'ALUVA'],
  ['തൃപ്പൂണിത്തുറ', 'THRIPPUNITHURA'],
  ['വൈറ്റില ഹബ്', 'VYTTILA HUB'],
  ['കാക്കനാട്', 'KAKKANAD'],
  ['ഫോർട്ട് കൊച്ചി', 'FORT KOCHI'],
  ['ഇടപ്പള്ളി', 'EDAPPALLY'],
  ['ആലപ്പുഴ', 'ALAPPUZHA'],
];

const PRIVATE_NAMES = ['ST. GEORGE', 'SREE KRISHNA', 'AL-AMEEN', 'KOCHI QUEEN', 'MALABAR EXPRESS', 'JAI HIND'];

export function buildVehicleAtlas(maxAniso = 8) {
  const canvas = makeCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  const rng = new RNG(4242);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, SIZE, SIZE);
  const rects = { plates: [], platesYellow: [], boards: [], privateNames: [], privateFront: [] };
  const uv = (x, y, w, h) => ({ u0: x / SIZE, v0: 1 - (y + h) / SIZE, u1: (x + w) / SIZE, v1: 1 - y / SIZE });

  // --- number plates: "KL 07 CB 4321" (KL-07 is Ernakulam RTO) --------------------------
  const plate = (x, y, w, h, yellow) => {
    ctx.fillStyle = yellow ? '#f2c313' : '#f4f4f0';
    roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 10);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#111';
    ctx.stroke();
    // IND strip
    ctx.fillStyle = '#1d3f9c';
    ctx.fillRect(x + 8, y + 10, 34, h - 20);
    ctx.fillStyle = '#fff';
    ctx.font = font(13, 700);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('IND', x + 25, y + h - 22);
    const rto = rng.pick(['07', '07', '07', '39', '41', '43', '17', '08']);
    const series = String.fromCharCode(65 + rng.int(0, 25)) + String.fromCharCode(65 + rng.int(0, 25));
    const num = String(rng.int(1, 9999)).padStart(4, '0');
    ctx.fillStyle = '#111';
    fitText(ctx, `KL ${rto} ${series} ${num}`, x + w / 2 + 18, y + h / 2 + 3, w - 70, h * 0.62, 800);
  };
  const PW = 384;
  const PH = 96;
  for (let i = 0; i < 10; i++) {
    const x = (i % 5) * PW;
    const y = Math.floor(i / 5) * PH;
    plate(x, y, PW, PH, false);
    rects.plates.push(uv(x, y, PW, PH));
  }
  for (let i = 0; i < 5; i++) {
    const x = i * PW;
    const y = 2 * PH;
    plate(x, y, PW, PH, true);
    rects.platesYellow.push(uv(x, y, PW, PH));
  }

  // --- KSRTC destination boards (Malayalam over English) ---------------------------------
  const BW = 1024;
  const BH = 128;
  DESTINATIONS.forEach((d, i) => {
    const x = (i % 2) * BW;
    const y = 300 + Math.floor(i / 2) * BH;
    ctx.fillStyle = '#0c0c0c';
    ctx.fillRect(x, y, BW, BH);
    ctx.fillStyle = '#ffd21f';
    fitText(ctx, d[0], x + BW * 0.36, y + BH / 2 + 4, BW * 0.62, 86, 800);
    ctx.fillStyle = '#ffffff';
    fitText(ctx, d[1], x + BW * 0.84, y + BH / 2 + 4, BW * 0.28, 44, 700);
    rects.boards.push(uv(x + 6, y + 6, BW - 12, BH - 12));
  });

  // --- KSRTC side lettering ---------------------------------------------------------------
  {
    const x = 0;
    const y = 820;
    ctx.fillStyle = '#9e0d0d';
    ctx.fillRect(x, y, 1024, 160);
    ctx.fillStyle = '#f6e9b8';
    fitText(ctx, 'കെ.എസ്.ആർ.ടി.സി', x + 300, y + 84, 540, 96, 800);
    ctx.fillStyle = '#ffffff';
    fitText(ctx, 'KSRTC', x + 800, y + 84, 380, 96, 800);
    rects.ksrtcSide = uv(x, y, 1024, 160);
  }
  {
    const x = 1024;
    const y = 820;
    ctx.fillStyle = '#9e0d0d';
    ctx.fillRect(x, y, 1024, 160);
    ctx.fillStyle = '#f6e9b8';
    fitText(ctx, 'FAST PASSENGER', x + 512, y + 84, 900, 86, 800);
    rects.ksrtcType = uv(x, y, 1024, 160);
  }

  // --- private bus names (they are always flamboyant) --------------------------------------
  PRIVATE_NAMES.forEach((name, i) => {
    const x = (i % 2) * 1024;
    const y = 1000 + Math.floor(i / 2) * 150;
    const g = ctx.createLinearGradient(x, y, x + 1024, y);
    const hues = [[205, 40], [350, 20], [140, 60], [280, 30], [25, 50], [190, 320]][i];
    g.addColorStop(0, `hsl(${hues[0]} 80% 38%)`);
    g.addColorStop(1, `hsl(${hues[1]} 85% 48%)`);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, 1024, 150);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let k = 0; k < 9; k++) {
      ctx.beginPath();
      ctx.moveTo(x + k * 130 - 40, y + 150);
      ctx.lineTo(x + k * 130 + 60, y);
      ctx.lineTo(x + k * 130 + 100, y);
      ctx.lineTo(x + k * 130, y + 150);
      ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth = 8;
    ctx.font = font(104, 800);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(name, x + 512, y + 82);
    fitText(ctx, name, x + 512, y + 82, 960, 104, 800);
    rects.privateNames.push(uv(x, y, 1024, 150));
  });

  // --- auto rickshaw rear panel -------------------------------------------------------------
  {
    const x = 0;
    const y = 1470;
    ctx.fillStyle = '#0b0b0b';
    ctx.fillRect(x, y, 512, 256);
    ctx.fillStyle = '#f0c313';
    fitText(ctx, 'കൊച്ചി', x + 256, y + 84, 460, 110, 800);
    ctx.fillStyle = '#fff';
    fitText(ctx, 'HORN · OK · PLEASE', x + 256, y + 190, 460, 44, 700);
    rects.autoRear = uv(x, y, 512, 256);
  }

  // --- white texel block ---------------------------------------------------------------------
  ctx.fillStyle = '#fff';
  ctx.fillRect(SIZE - 64, SIZE - 64, 64, 64);

  const texture = canvasTexture(canvas, { anisotropy: maxAniso });
  return { texture, rects };
}
