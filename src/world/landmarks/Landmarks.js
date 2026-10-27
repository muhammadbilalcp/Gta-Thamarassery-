// The places that make this Kochi: LuLu Mall and the Marriott at Edappally, Forum Kochi
// at Maradu, the Kaloor stadium, Vyttila Mobility Hub, Brototype and Crowne Plaza at
// Kundannoor. Each is modelled from reference photographs (see docs/RESEARCH.md).

import { frame } from '../CityBuilder.js';
import { SURF } from '../SurfaceMap.js';
import { LANDMARKS, PLACE_NAMES, NODES, P } from '../layout.js';
import { FLOOR, BAY } from '../FacadeTextures.js';
import { SignSheets, board, buildLandmarkLayers } from './textures.js';
import { fitText, font } from '../../utils/canvas.js';
import { lerp } from '../../utils/math.js';

const TAU = Math.PI * 2;

export class Landmarks {
  constructor(city) {
    this.city = city;
    this.world = city.world;
    this.surface = city.surface;
    this.colliders = city.colliders;
    this.rng = city.rng;
  }

  // ------------------------------------------------------------------------- textures
  prepare(atlas) {
    const city = this.city;
    const L = buildLandmarkLayers(atlas, city.assets);
    const flat = (tint) => ({ layer: city.surf.tank.layer, tint });
    const metal = (tint) => ({ layer: city.surf.steel.layer, tint });
    Object.assign(city.surf, {
      luluStone: { layer: L.luluStone, tint: [1, 1, 1] },
      luluBand: { layer: L.luluStone, tint: [0.78, 0.66, 0.5] },
      forumLeaf: { layer: L.forumLeaf, tint: [1, 1, 1] },
      charcoal: { layer: L.charcoal, tint: [1, 1, 1] },
      seats: { layer: L.seats, tint: [1, 1, 1] },
      pitch: { layer: L.pitch, tint: [1, 1, 1] },
      lattice: { layer: L.lattice, tint: [1, 1, 1] },
      carpark: { layer: L.carpark, tint: [1, 1, 1] },
      pavers: { layer: L.pavers, tint: [1.05, 1.0, 0.97] },
      asphalt: { layer: L.asphalt, tint: [0.62, 0.62, 0.64] },
      lawn: { layer: L.grass, tint: [0.7, 0.85, 0.55] },
      white: flat([0.93, 0.93, 0.9]),
      offWhite: flat([0.84, 0.83, 0.78]),
      black: flat([0.04, 0.04, 0.045]),
      red: flat([0.72, 0.08, 0.1]),
      terracotta: { layer: city.surf.awning.layer, tint: [1.55, 0.74, 0.4] },
      roofSteel: metal([0.72, 0.75, 0.77]),
      greenSteel: metal([0.2, 0.42, 0.33]),
      chrome: metal([0.85, 0.86, 0.88]),
      lamp: flat([1.6, 1.55, 1.4]),
      concreteLm: { layer: city.surf.roofFlat.layer, tint: [0.84, 0.82, 0.78] },
      glassWall: { layer: city.surf[city.byStyle.glass[0].key].layer, tint: [1, 1, 1] },
      glassDark: { layer: city.surf[city.byStyle.glass[1].key].layer, tint: [1, 1, 1] },
      hotelWhite: { layer: city.surf[city.byStyle.apartment[0].key].layer, tint: [1, 1, 1] },
      hotelCream: { layer: city.surf[city.byStyle.apartment[1].key].layer, tint: [1, 0.97, 0.9] },
    });
    this.signs = new SignSheets(8);
    this._drawSigns();
    this.signLayers = this.signs.sheets.map((s, i) => atlas.add(`sign${i}`, s.canvas, { rough: 0.55, metal: 0.05 }));
  }

  _drawSigns() {
    const s = this.signs;
    // Churam Mall (formerly LuLu)
    s.add('lulu', 512, 300, (c, w, h) => {
      const petals = ['#e6007e', '#f39200', '#ffde00', '#95c11f', '#009fe3', '#662483', '#e30613', '#00a19a'];
      c.save();
      c.translate(w / 2, 74);
      petals.forEach((col, i) => {
        c.rotate(TAU / petals.length);
        c.fillStyle = col;
        c.beginPath();
        c.ellipse(0, -36, 13, 34, 0, 0, TAU);
        c.fill();
      });
      c.restore();
      c.fillStyle = '#d3141c';
      c.font = `italic 800 110px Georgia, 'Times New Roman', serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = 8;
      c.strokeStyle = '#fff6d8';
      c.strokeText('CHURAM', w / 2, 200);
      c.fillText('CHURAM', w / 2, 200);
      void h;
    });
    s.add('luluMl', 512, 120, (c, w, h) => board(c, w, h, { bg: '#b3131b', fg: '#fff', border: '#f5d37a', lines: [{ text: 'താമരശ്ശേരി ചുരം മാൾ · CHURAM MALL' }] }));
    s.add('luluHyper', 512, 110, (c, w, h) => board(c, w, h, { bg: '#0d7a3a', fg: '#fff', lines: [{ text: 'THAMARASSERY HYPERMARKET' }] }));
    s.add('marriott', 512, 120, (c, w, h) => board(c, w, h, { bg: '#1a1010', fg: '#f3e6d0', border: '#8a1a1a', lines: [{ text: 'CHURAM RESORT', size: 1.4 }, { text: 'T H A M A R A S S E R Y', size: 0.7, weight: 400 }] }));
    // Chungam Center (formerly Forum)
    const butterfly = (c, x, y, k) => {
      const cols = ['#e6007e', '#f39200', '#009fe3', '#95c11f'];
      cols.forEach((col, i) => {
        c.fillStyle = col;
        c.beginPath();
        const a = -0.9 + i * 0.6;
        c.ellipse(x + Math.cos(a) * 18 * k, y + Math.sin(a) * 18 * k - 6 * k, 16 * k, 27 * k, a + Math.PI / 2, 0, TAU);
        c.fill();
      });
    };
    s.add('forumRoof', 512, 170, (c, w, h) => {
      butterfly(c, 62, 86, 1.35);
      c.fillStyle = '#4a4d52';
      fitText(c, 'chungam', 118, h / 2 + 8, w - 128, 150, 800, 'left');
    });
    s.add('forumScreen', 512, 300, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#f08a1c');
      g.addColorStop(1, '#e2521a');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      butterfly(c, 96, 150, 1.6);
      c.fillStyle = '#fff';
      fitText(c, 'CHUNGAM', 170, 122, w - 200, 110, 800, 'left');
      fitText(c, 'താമരശ്ശേരി · Thamarassery', 176, 206, w - 210, 40, 700, 'left');
      c.strokeStyle = '#111';
      c.lineWidth = 10;
      c.strokeRect(5, 5, w - 10, h - 10);
    });
    s.add('thomsun', 400, 96, (c, w, h) => board(c, w, h, { bg: '#f4f4f0', fg: '#c4161c', lines: [{ text: 'MALABAR' }], radius: 4 }));
    s.add('prestige', 256, 120, (c, w, h) => board(c, w, h, { bg: '#f4f4f0', fg: '#1a1a1a', lines: [{ text: 'Calicut', size: 1.4 }, { text: 'COMPLEX', size: 0.6, weight: 400 }], radius: 4 }));
    s.add('forumCanopy', 512, 80, (c, w, h) => board(c, w, h, { bg: '#16181a', fg: '#fff', lines: [{ text: 'chungam   ·   ചുങ്കം' }], radius: 2 }));
    s.add('artiste', 384, 96, (c, w, h) => board(c, w, h, { bg: null, fg: '#2a2a2a', lines: [{ text: 'WAYANAD GATEWAY' }] }));
    // Stadium.
    // Stadium.
    s.add('stadium', 1000, 170, (c, w, h) =>
      board(c, w, h, {
        bg: '#0f3f7a',
        fg: '#fff',
        border: '#f5d37a',
        lines: [{ text: 'താമരശ്ശേരി പഞ്ചായത്ത് സ്റ്റേഡിയം', size: 1.1 }, { text: 'THAMARASSERY STADIUM · KOZHIKODE', size: 0.8 }],
      }),
    );
    s.add('yellow', 256, 120, (c, w, h) => board(c, w, h, { bg: '#f2c313', fg: '#123a8a', lines: [{ text: 'മലബാർ ആർമി', size: 1.3 }, { text: 'THAMARASSERY · MALABAR', size: 0.6 }], radius: 0 }));
    s.add('gcda', 256, 80, (c, w, h) => board(c, w, h, { bg: '#f4f4f0', fg: '#0f3f7a', lines: [{ text: 'STADIUM · GATE' }], radius: 0 }));
    // KSRTC Thamarassery Depot.
    s.add('hub', 1000, 190, (c, w, h) =>
      board(c, w, h, {
        bg: '#0b5f8a',
        fg: '#fff',
        border: '#fff',
        lines: [{ text: 'കെ.എസ്.ആർ.ടി.സി താമരശ്ശേരി ഡിപ്പോ', size: 1.15 }, { text: 'KSRTC THAMARASSERY DEPOT', size: 0.85 }],
      }),
    );
    s.add('waterMetro', 512, 120, (c, w, h) => board(c, w, h, { bg: '#0a6f78', fg: '#fff', lines: [{ text: 'താമരശ്ശേരി ചുരം വ്യൂപോയിന്റ്', size: 1.1 }, { text: 'CHURAM VIEWPOINT · WAYANAD PASS', size: 0.8 }] }));
    s.add('ksrtcBoard', 512, 110, (c, w, h) => board(c, w, h, { bg: '#9e0d0d', fg: '#f6e9b8', lines: [{ text: 'കെ.എസ്.ആർ.ടി.സി · KSRTC THAMARASSERY' }] }));
    for (let i = 1; i <= 8; i++) s.add(`bay${i}`, 96, 96, (c, w, h) => {
      c.fillStyle = '#1456a0';
      c.beginPath();
      c.arc(w / 2, h / 2, 44, 0, TAU);
      c.fill();
      c.fillStyle = '#fff';
      fitText(c, String(i), w / 2, h / 2 + 3, 70, 64, 800);
    });
    // Thamarassery Hub / Bilal Complex (spawning spot)
    s.add('brototype', 1000, 200, (c, w, h) => {
      c.fillStyle = '#0b0b0c';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#e11d2e';
      c.fillRect(0, h - 14, w, 14);
      c.fillStyle = '#f2f2f2';
      c.save();
      c.translate(w / 2, h * 0.42);
      c.scale(1.2, 1);
      c.font = `900 95px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('GTA THAMARASSERY', 0, 0);
      c.restore();
      c.fillStyle = '#ffd34d';
      c.font = font(32, 700);
      c.textAlign = 'center';
      c.fillText('താമരശ്ശേരി ഹബ്ബ് · KOZHIKODE', w / 2, h * 0.8);
    });
    s.add('brototypeBlade', 128, 512, (c, w, h) => {
      c.fillStyle = '#e11d2e';
      c.fillRect(0, 0, w, h);
      c.save();
      c.translate(w / 2, h / 2);
      c.rotate(-Math.PI / 2);
      c.fillStyle = '#fff';
      c.font = `900 64px "Arial Black", Arial, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('THAMARASSERY', 0, 4);
      c.restore();
    });
    s.add('crowne', 512, 110, (c, w, h) => board(c, w, h, { bg: '#0a1d37', fg: '#ffd34d', border: '#e11d2e', lines: [{ text: 'കേരള പോലീസ് · താമരശ്ശേരി', size: 1.15 }, { text: 'KERALA POLICE STATION · THAMARASSERY', size: 0.8 }] }));
    s.add('policeStation', 512, 110, (c, w, h) => board(c, w, h, { bg: '#0a1d37', fg: '#ffd34d', border: '#e11d2e', lines: [{ text: 'കേരള പോലീസ് · താമരശ്ശേരി', size: 1.15 }, { text: 'KERALA POLICE STATION · THAMARASSERY', size: 0.8 }] }));
    s.add('teaShop', 512, 110, (c, w, h) => board(c, w, h, { bg: '#7a190b', fg: '#fff', border: '#ffd34d', lines: [{ text: 'മലബാർ ടീ സ്റ്റാൾ · MALABAR TEA HOTEL', size: 1.15 }, { text: 'CHAYA · KADI · POROTTA · BEEF', size: 0.75 }] }));
    // Metro station name boards.
    const metro = this.world.metro;
    if (metro) {
      for (const line of metro.lines) {
        for (const st of line.stations) {
          s.add(`metro_${st.name}`, 1000, 76, (c, w, h) => {
            const g = c.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, '#15918a');
            g.addColorStop(1, '#0b5f5b');
            c.fillStyle = g;
            c.fillRect(0, 0, w, h);
            c.fillStyle = '#fff';
            c.beginPath();
            c.arc(40, h / 2, 27, 0, TAU);
            c.fill();
            c.fillStyle = '#0d6f6a';
            fitText(c, 'T', 40, h / 2 + 2, 40, 38, 800);
            c.fillStyle = '#fff';
            fitText(c, st.ml, 80 + 215, h / 2 + 2, 420, 52, 800);
            fitText(c, st.name.toUpperCase(), 520 + 235, h / 2 + 2, 460, 44, 700);
          });
        }
      }
    }
    // Green trilingual NHAI place boards.
    for (const id in PLACE_NAMES) {
      const n = PLACE_NAMES[id];
      s.add(`place_${id}`, 300, 220, (c, w, h) =>
        board(c, w, h, {
          bg: '#0c6b3d',
          fg: '#fff',
          border: '#fff',
          radius: 14,
          lines: [{ text: n.ml, size: 1.1 }, { text: n.hi, size: 1.0, weight: 700 }, { text: n.en, size: 0.95 }],
        }),
      );
    }
    // Direction boards on the approaches.
    const dirs = [
      ['dir_V_n', ['↑ ചുരം · CHURAM PASS', '← കുന്നമംഗലം · KUNNAMANGALAM', '→ മുക്കം · MUKKAM']],
      ['dir_V_s', ['↑ കോഴിക്കോട് · KOZHIKODE', '← മുക്കം · MUKKAM', '→ കാരടി · KARADI']],
      ['dir_K_n', ['↑ ചുങ്കം · CHUNGAM', '← കുന്നമംഗലം · KUNNAMANGALAM', '→ കൈതപ്പൊയിൽ · KAITHAPOYIL']],
      ['dir_K_s', ['↑ കോഴിക്കോട് · KOZHIKODE', '← കാരടി · KARADI', '→ അടിവാരം · ADIVARAM']],
      ['dir_PB_n', ['↑ ചുരം കവാടം · CHURAM GATEWAY', '← കൊടുവള്ളി · KODUVALLY', '→ ഈങ്ങാപ്പുഴ · ENGAPUZHA']],
      ['dir_PB_s', ['↑ ചുങ്കം · CHUNGAM', '← ഈങ്ങാപ്പുഴ · ENGAPUZHA', '→ കൊടുവള്ളി · KODUVALLY']],
      ['dir_E_n', ['↑ വയനാട് · WAYANAD', '← ബാലുശ്ശേരി · BALUSSERY', '→ ചുരം വ്യൂ · CHURAM VIEW']],
      ['dir_E_s', ['↑ ചുങ്കം · CHUNGAM', '→ ഈങ്ങാപ്പുഴ · ENGAPUZHA', '← പുതുപ്പാടി · PUDUPPADI']],
    ];
    for (const [id, lines] of dirs) {
      s.add(id, 512, 230, (c, w, h) => board(c, w, h, { bg: '#0c6b3d', fg: '#fff', border: '#fff', radius: 12, lines: lines.map((t) => ({ text: t })) }));
    }
    s.add('busStop', 256, 96, (c, w, h) => board(c, w, h, { bg: '#1456a0', fg: '#fff', lines: [{ text: 'ബസ് സ്റ്റോപ്പ്', size: 1.1 }, { text: 'BUS STOP', size: 0.7 }], radius: 6 }));
    s.add('autoStand', 256, 96, (c, w, h) => board(c, w, h, { bg: '#f2c313', fg: '#111', lines: [{ text: 'ഓട്ടോ സ്റ്റാൻഡ്', size: 1.1 }, { text: 'AUTO STAND', size: 0.7 }], radius: 6 }));
    s.add('welcome', 512, 140, (c, w, h) => board(c, w, h, { bg: '#0b5f8a', fg: '#fff', border: '#fff', lines: [{ text: 'താമരശ്ശേരിയിലേക്ക് സ്വാഗതം', size: 1.1 }, { text: 'WELCOME TO THAMARASSERY · KOZHIKODE', size: 0.75 }] }));
    s.add('speed', 128, 128, (c, w, h) => {
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(w / 2, h / 2, 60, 0, TAU);
      c.fill();
      c.strokeStyle = '#d3141c';
      c.lineWidth = 12;
      c.beginPath();
      c.arc(w / 2, h / 2, 53, 0, TAU);
      c.stroke();
      c.fillStyle = '#111';
      fitText(c, '50', w / 2, h / 2 + 4, 80, 64, 800);
    });
    s.add('oberon', 512, 120, (c, w, h) => board(c, w, h, { bg: '#1a1a1a', fg: '#ffd34d', lines: [{ text: 'ചുങ്കം മാൾ', size: 1.1 }, { text: 'CHUNGAM MALL', size: 0.8 }] }));
    s.add('goldsouk', 512, 120, (c, w, h) => board(c, w, h, { bg: '#3a2408', fg: '#f5d37a', lines: [{ text: 'THAMARASSERY GOLD MALL', size: 1 }, { text: 'CHUNGAM', size: 0.6, weight: 400 }] }));
  }

  // --------------------------------------------------------------------------- helpers
  use(key, fr, tint = null) {
    const b = this.city.use(key, fr.cx, fr.cz);
    if (tint) b.tint = tint;
    return b;
  }

  /** Box with metric UVs. */
  box(key, fr, lx, y, lz, sx, sy, sz, { faces = 'xXzZY', tile = 4, tint = null } = {}) {
    const b = this.use(key, fr, tint);
    const c = fr.P(lx, 0, lz);
    b.box(c[0], y + sy / 2, c[2], sx, sy, sz, fr.rot, { faces, uvScale: 1 / tile });
  }

  /** Facade box: bays / floors mapped like the procedural buildings. */
  facadeBox(key, fr, lx, y0, lz, sx, sy, sz, skip = '') {
    const b = this.use(key, fr);
    const hw = sx / 2;
    const hd = sz / 2;
    const v0 = 0;
    const v1 = sy / (FLOOR * 4);
    const side = (p0, p1, len, n) => {
      const bays = Math.max(1, Math.round(len / BAY));
      b.quad([p0[0], y0, p0[2]], [p1[0], y0, p1[2]], [p1[0], y0 + sy, p1[2]], [p0[0], y0 + sy, p0[2]], [[0, v0], [bays / 4, v0], [bays / 4, v1], [0, v1]], n);
    };
    if (!skip.includes('Z')) side(fr.P(lx - hw, 0, lz + hd), fr.P(lx + hw, 0, lz + hd), sx, fr.N(0, 1));
    if (!skip.includes('X')) side(fr.P(lx + hw, 0, lz + hd), fr.P(lx + hw, 0, lz - hd), sz, fr.N(1, 0));
    if (!skip.includes('z')) side(fr.P(lx + hw, 0, lz - hd), fr.P(lx - hw, 0, lz - hd), sx, fr.N(0, -1));
    if (!skip.includes('x')) side(fr.P(lx - hw, 0, lz - hd), fr.P(lx - hw, 0, lz + hd), sz, fr.N(-1, 0));
  }

  /** Horizontal rectangle (paving, roofs) with metric UVs. */
  slab(key, fr, lx, y, lz, sx, sz, tile = 3, tint = null, up = true) {
    const b = this.use(key, fr, tint);
    const hw = sx / 2;
    const hd = sz / 2;
    b.quad(fr.P(lx - hw, y, lz + hd), fr.P(lx + hw, y, lz + hd), fr.P(lx + hw, y, lz - hd), fr.P(lx - hw, y, lz - hd), [[0, 0], [sx / tile, 0], [sx / tile, sz / tile], [0, sz / tile]], [0, up ? 1 : -1, 0]);
  }

  /** Name board. (x, y, z) is the bottom centre, (nx, nz) the way it faces. */
  signAt(id, x, y, z, nx, nz, width, both = false, anchor = { cx: x, cz: z }) {
    const r = this.signs.get(id);
    if (!r) return 0;
    const h = width / r.aspect;
    const l = Math.hypot(nx, nz) || 1;
    nx /= l;
    nz /= l;
    const rx = nz;
    const rz = -nx;
    const b = this.city.use('trim', anchor.cx, anchor.cz);
    b.curLayer = this.signLayers[r.sheet];
    b.tint = [1, 1, 1];
    const hw = width / 2;
    const ox = nx * 0.03;
    const oz = nz * 0.03;
    const p0 = [x - rx * hw + ox, y, z - rz * hw + oz];
    const p1 = [x + rx * hw + ox, y, z + rz * hw + oz];
    b.quad(p0, p1, [p1[0], y + h, p1[2]], [p0[0], y + h, p0[2]], [[r.u0, r.v0], [r.u1, r.v0], [r.u1, r.v1], [r.u0, r.v1]], [nx, 0, nz]);
    if (both) {
      const q0 = [x + rx * hw - ox, y, z + rz * hw - oz];
      const q1 = [x - rx * hw - ox, y, z - rz * hw - oz];
      b.quad(q0, q1, [q1[0], y + h, q1[2]], [q0[0], y + h, q0[2]], [[r.u0, r.v0], [r.u1, r.v0], [r.u1, r.v1], [r.u0, r.v1]], [-nx, 0, -nz]);
    }
    return h;
  }

  /** Sign on a frame: side = 'Z' front, 'z' back, 'X' right, 'x' left. */
  sign(id, fr, lx, y, lz, width, side = 'Z', both = false) {
    const n = side === 'Z' ? fr.N(0, 1) : side === 'z' ? fr.N(0, -1) : side === 'X' ? fr.N(1, 0) : fr.N(-1, 0);
    const p = fr.P(lx, 0, lz);
    return this.signAt(id, p[0], y, p[2], n[0], n[2], width, both, fr);
  }

  /** A hoarding tile used as a facade banner. */
  banner(fr, lx, y, lz, width, height, side = 'Z') {
    const tile = this.rng.int(0, this.city.hoardings.count - 1);
    const col = tile % 2;
    const row = Math.floor(tile / 2);
    const v1 = 1 - (row % 2) / 2;
    const v0 = v1 - 0.5;
    const n = side === 'Z' ? fr.N(0, 1) : side === 'z' ? fr.N(0, -1) : side === 'X' ? fr.N(1, 0) : fr.N(-1, 0);
    const p = fr.P(lx, 0, lz);
    const rx = n[2];
    const rz = -n[0];
    const b = this.city.use('trim', fr.cx, fr.cz);
    b.curLayer = this.city.hoardLayer + ((row >= 2 ? 2 : 0) + col) * 2;
    b.tint = [1, 1, 1];
    const hw = width / 2;
    const p0 = [p[0] - rx * hw + n[0] * 0.05, y, p[2] - rz * hw + n[2] * 0.05];
    const p1 = [p[0] + rx * hw + n[0] * 0.05, y, p[2] + rz * hw + n[2] * 0.05];
    b.quad(p0, p1, [p1[0], y + height, p1[2]], [p0[0], y + height, p0[2]], [[0, v0], [1, v0], [1, v1], [0, v1]], n);
  }

  solid(fr, lx, lz, sx, sz, h, tag) {
    const c = fr.P(lx, 0, lz);
    this.surface.rect(c[0], c[2], sx / 2, sz / 2, fr.rot, SURF.BUILDING, [SURF.ROAD, SURF.SIDEWALK]);
    this.colliders.addBox(c[0], c[2], sx / 2, sz / 2, fr.rot, -2, h, tag);
  }

  hollowSolid(fr, lx, lz, sx, sz, h, tag, doorWidth = 6, doorOffset = 0) {
    const wallThick = 0.8;
    const halfX = sx / 2;
    const halfZ = sz / 2;
    const c = fr.P(lx, 0, lz);
    this.surface.rect(c[0], c[2], halfX, halfZ, fr.rot, SURF.PAVED, [SURF.ROAD, SURF.BUILDING]);

    // Back wall (-Z)
    const back = fr.P(lx, 0, lz - halfZ + wallThick / 2);
    this.colliders.addBox(back[0], back[2], halfX, wallThick / 2, fr.rot, -2, h, `${tag}-back`);

    // Left wall (-X)
    const left = fr.P(lx - halfX + wallThick / 2, 0, lz);
    this.colliders.addBox(left[0], left[2], wallThick / 2, halfZ, fr.rot, -2, h, `${tag}-left`);

    // Right wall (+X)
    const right = fr.P(lx + halfX - wallThick / 2, 0, lz);
    this.colliders.addBox(right[0], right[2], wallThick / 2, halfZ, fr.rot, -2, h, `${tag}-right`);

    // Front wall (+Z) with doorway opening
    const frontZ = lz + halfZ - wallThick / 2;
    const halfDoor = doorWidth / 2;
    const segLeftWidth = halfX + (doorOffset - halfDoor);
    if (segLeftWidth > 0.5) {
      const segLeftX = lx - halfX + segLeftWidth / 2;
      const frontL = fr.P(segLeftX, 0, frontZ);
      this.colliders.addBox(frontL[0], frontL[2], segLeftWidth / 2, wallThick / 2, fr.rot, -2, h, `${tag}-front-l`);
    }
    const segRightWidth = halfX - (doorOffset + halfDoor);
    if (segRightWidth > 0.5) {
      const segRightX = lx + halfX - segRightWidth / 2;
      const frontR = fr.P(segRightX, 0, frontZ);
      this.colliders.addBox(frontR[0], frontR[2], segRightWidth / 2, wallThick / 2, fr.rot, -2, h, `${tag}-front-r`);
    }
  }

  paved(fr, lx, lz, sx, sz) {
    const c = fr.P(lx, 0, lz);
    this.surface.rect(c[0], c[2], sx / 2, sz / 2, fr.rot, SURF.PAVED, [SURF.ROAD, SURF.SIDEWALK, SURF.BUILDING, SURF.MEDIAN]);
  }

  park(fr, lx, lz, headingOffset = 0, kind = 'car') {
    const p = fr.P(lx, 0, lz);
    this.city.parking.push({ x: p[0], z: p[2], heading: Math.atan2(fr.fx, fr.fz) + headingOffset, kind, fixed: true });
  }

  pole(fr, lx, lz, h, r = 0.09, key = 'steel') {
    const b = this.use(key, fr);
    const p = fr.P(lx, 0, lz);
    b.cylinder(p[0], 0, p[2], r, r * 0.8, h, 8, { cap: true });
    this.colliders.addCircle(p[0], p[2], r + 0.1, -1, h, 'pole');
  }

  // ----------------------------------------------------------------------------- build
  build() {
    this._lulu();
    this._forum();
    this._stadium();
    this._hub();
    this._brototype();
    this._crowne();
    this._minorMalls();
  }

  // ============================================================================= LuLu
  _lulu() {
    const c = LANDMARKS.lulu.p;
    const fr = frame(c[0], c[1], 1, 0); // front faces east, local X runs north
    const W = 168; // north-south
    const D = 90; // east-west
    const H = 25;
    const z0 = -8; // main block sits back from the plaza
    // Forecourt and car parks.
    this.slab('pavers', fr, 0, 0.08, 58, 210, 44, 1.5);
    this.slab('asphalt', fr, -118, 0.07, 0, 60, 150, 4);
    this.paved(fr, 0, 58, 210, 44);
    this.paved(fr, -118, 0, 60, 150);
    // Main block.
    this.box('luluStone', fr, 0, 0, z0, W, H, D, { tile: 8 });
    this.box('luluBand', fr, 0, H, z0, W + 0.6, 2.2, D + 0.6, { tile: 8 });
    this.slab('roofFlat', fr, 0, H + 2.2, z0, W, D, 4);
    this.solid(fr, 0, z0, W, D, H + 3, 'lulu');
    // Ground floor glazing along the front.
    for (const s of [-1, 1]) {
      const b = this.use('glassWall', fr);
      const x0 = s * 26;
      const x1 = s * 80;
      const zf = z0 + D / 2 + 0.06;
      b.quad(fr.P(Math.min(x0, x1), 0.1, zf), fr.P(Math.max(x0, x1), 0.1, zf), fr.P(Math.max(x0, x1), 5.4, zf), fr.P(Math.min(x0, x1), 5.4, zf), [[0, 0.02], [4, 0.02], [4, 0.2], [0, 0.2]], fr.N(0, 1));
      this.box('luluBand', fr, s * 53, 5.4, z0 + D / 2 + 1.6, 56, 0.5, 3.4, { faces: 'xXZYy', tile: 8 });
    }
    // Central glass atrium with the white tensile roof.
    const aw = 46;
    const ad = 14;
    const ah = 28;
    const az = z0 + D / 2 + ad / 2 - 3;
    this.facadeBox('glassWall', fr, 0, 0, az, aw, ah, ad, 'z');
    this.hollowSolid(fr, 0, az, aw, ad, ah, 'lulu-atrium', 8.0);
    this.box('white', fr, 0, ah, az, aw + 1, 0.6, ad + 1, { faces: 'xXzZYy' });

    // Enterable Grand Atrium of Churam Mall
    this.slab('pavers', fr, 0, 0.05, az, aw - 2, ad - 2, 1.2, [0.98, 0.98, 0.96]);
    // Central Mall fountain & plant basin
    this.box('concreteLm', fr, 0, 0, az, 8, 0.7, 6, { faces: 'xXzZYy' });
    this.box('glassDark', fr, 0, 0.6, az, 7.2, 0.2, 5.2, { faces: 'Y' });
    // Shopping kiosks along both sides
    for (const sx of [-14, 14]) {
      this.box('charcoal', fr, sx, 0, az - 2, 6, 1.2, 2.5, { faces: 'xXzZYy' });
      this.box('charcoal', fr, sx, 0, az + 3, 6, 1.2, 2.5, { faces: 'xXzZYy' });
    }
    for (const s of [-1, 1]) this.box('luluStone', fr, s * (aw / 2 + 1.5), 0, az, 3, ah + 2, ad + 1, { tile: 8 });
    for (let i = -2; i <= 2; i++) {
      const p = fr.P(i * 9, 0, az - 2);
      const tent = this.use('white', fr);
      tent.cylinder(p[0], ah + 0.6, p[2], 5.6, 0.25, 8.5, 14, { cap: false });
      const m = this.use('chrome', fr);
      m.cylinder(p[0], ah + 9.1, p[2], 0.12, 0.05, 3.2, 6);
    }
    // Porte-cochere.
    this.box('white', fr, 0, 6.2, az + ad / 2 + 6, 34, 0.7, 13, { faces: 'xXzZYy' });
    for (const s of [-1, 1]) for (const d of [2, 11]) this.pole(fr, s * 15, az + ad / 2 + d, 6.2, 0.4, 'luluStone');
    // Signage and the big facade banners.
    const front = z0 + D / 2;
    this.sign('lulu', fr, 0, ah - 9.5, az + ad / 2 + 0.05, 17, 'Z');
    this.sign('luluMl', fr, 0, 7.2, az + ad / 2 + 12.6, 16, 'Z');
    for (const s of [-1, 1]) {
      this.sign('lulu', fr, s * 62, H - 11, front + 0.06, 16, 'Z');
      this.banner(fr, s * 38, 8, front, 15, 13.5);
    }
    this.sign('luluHyper', fr, 60, 5.8, front + 3.4, 18, 'Z');
    this.sign('lulu', fr, -W / 2 - 0.06, H - 12, z0 + 10, 18, 'x');
    this.sign('lulu', fr, W / 2 + 0.06, H - 12, z0 + 10, 18, 'X');
    this.banner(fr, -W / 2, 6, z0 - 18, 22, 13, 'x');
    this.sign('lulu', fr, 0, H + 2.4, z0 - D / 2 + 1, 20, 'z');
    // Flag poles and royal palms are added by the vegetation pass; keep posts here.
    for (let i = -4; i <= 4; i++) this.pole(fr, i * 5, 78, 11, 0.07, 'chrome');
    // Multi-level car park to the south.
    const pf = frame(...fr.P(-118, 0, -12).filter((_, i) => i !== 1), 1, 0);
    this.facadeBox('carpark', pf, 0, 0, 0, 52, 15.5, 46);
    this.slab('roofFlat', pf, 0, 15.5, 0, 52, 46, 4);
    this.solid(pf, 0, 0, 52, 46, 16, 'lulu-parking');
    this.sign('luluMl', pf, 0, 12, 23.1, 14, 'Z');
    // Surface parking in front.
    for (let i = 0; i < 26; i++) {
      if (this.rng.chance(0.62)) this.park(fr, -90 + i * 3.0, 62, Math.PI, 'car');
      if (this.rng.chance(0.5)) this.park(fr, -90 + i * 3.0, 72.5, 0, 'car');
    }
    for (let i = 0; i < 14; i++) if (this.rng.chance(0.7)) this.park(fr, 40 + i * 1.3, 50.5, Math.PI, 'bike');

    // Kochi Marriott behind the mall.
    const mf = frame(-345, -1838, 1, 0);
    const mh = 17 * FLOOR;
    this.facadeBox('hotelCream', mf, 0, 5, 0, 44, mh - 5, 24);
    this.facadeBox('glassWall', mf, 0, 0, 0, 46, 5, 26);
    this.box('luluBand', mf, 0, mh, 0, 45, 3, 25, { tile: 8 });
    this.box('luluBand', mf, 0, mh + 3, -3, 20, 4, 12, { tile: 8 });
    this.slab('roofFlat', mf, 0, mh + 3, 0, 45, 25, 4);
    this.solid(mf, 0, 0, 46, 26, mh + 6, 'marriott');
    this.sign('marriott', mf, 0, mh - 0.4, 12.6, 16, 'Z');
    this.sign('marriott', mf, -22.6, mh - 0.4, 0, 14, 'x');
    this.slab('pavers', mf, 0, 0.08, 26, 70, 26, 1.5);
    this.paved(mf, 0, 26, 70, 26);
    this.box('white', mf, 0, 5, 17, 18, 0.5, 9, { faces: 'xXzZYy' });
    for (let i = 0; i < 8; i++) if (this.rng.chance(0.6)) this.park(mf, -24 + i * 3, 32, Math.PI, 'car');

    // Skywalk from Edappally metro station.
    const st = this.world.metro?.lines[0]?.stations.find((s) => s.name === 'Edappally');
    if (st) {
      const end = fr.P(-W / 2 + 10, 0, front + 2);
      const from = [st.x + st.nx * 9, st.z + st.nz * 9];
      const dx = end[0] - from[0];
      const dz = end[2] - from[1];
      const len = Math.hypot(dx, dz);
      const sf = frame((from[0] + end[0]) / 2, (from[1] + end[2]) / 2, -dz / len, dx / len);
      this.box('glassWall', sf, 0, 7.2, 0, len, 3.2, 3.4, { faces: 'zZ', tile: 12 });
      this.box('white', sf, 0, 6.7, 0, len, 0.5, 3.8, { faces: 'xXzZYy' });
      this.box('white', sf, 0, 10.4, 0, len, 0.35, 4.2, { faces: 'xXzZYy' });
      for (let d = -len / 2 + 6; d < len / 2; d += 14) {
        const p = sf.P(d, 0, 0);
        if (this.surface.typeAt(p[0], p[2]) === SURF.ROAD) continue;
        this.pole(sf, d, 0, 6.7, 0.32, 'concreteLm');
      }
    }
  }

  // ============================================================================ Forum
  _forum() {
    const c = LANDMARKS.forum.p;
    const fr = frame(c[0], c[1], 1, 0);
    const W = 100; // along the highway
    const D = 104;
    const zc = 2;
    const front = zc + D / 2;
    // Forecourt.
    this.slab('asphalt', fr, 0, 0.07, front + 12, 128, 24, 4);
    this.slab('pavers', fr, 0, 0.085, front + 3.5, 110, 7, 1.5);
    this.paved(fr, 0, front + 10, 128, 28);
    // Charcoal podium and upper volume.
    this.box('charcoal', fr, 0, 0, zc, W, 13, D, { tile: 6 });
    this.box('charcoal', fr, 0, 13, zc - 3, W - 4, 15, D - 8, { tile: 6 });
    this.slab('roofFlat', fr, 0, 28, zc - 3, W - 4, D - 8, 4);
    this.solid(fr, 0, zc, W, D, 29, 'forum');
    // Glazed ground floor and entrance canopy.
    const g = this.use('glassDark', fr);
    g.quad(fr.P(-38, 0.1, front + 0.06), fr.P(38, 0.1, front + 0.06), fr.P(38, 5.2, front + 0.06), fr.P(-38, 5.2, front + 0.06), [[0, 0.02], [6, 0.02], [6, 0.2], [0, 0.2]], fr.N(0, 1));
    this.box('black', fr, 0, 5.3, front + 3.6, 58, 0.8, 7.4, { faces: 'xXzZYy' });
    this.sign('forumCanopy', fr, 0, 5.35, front + 7.32, 20, 'Z');
    for (const s of [-1, 1]) for (const x of [10, 27]) this.pole(fr, s * x, front + 6.6, 5.3, 0.22, 'chrome');

    // ================= Malabar Tea Stall & Hotel (Chaya Kada) =================
    const teaFr = frame(c[0] + 52, c[1] + 28, 0, 1);
    const tw = 14;
    const td = 10;
    const th = 4.2;
    this.box('charcoal', teaFr, 0, 0, 0, tw, th, td, { faces: 'xXzYy' });
    this.slab('roofFlat', teaFr, 0, th, 0, tw + 0.6, td + 0.6, 2);
    this.hollowSolid(teaFr, 0, 0, tw, td, th + 1, 'malabar-tea-hotel', 6.0);
    this.sign('teaShop', teaFr, 0, th - 0.7, td / 2 + 0.08, 11, 'Z');
    // Striped Awning over front entrance
    this.box('terracotta', teaFr, 0, 3.3, td / 2 + 1.4, tw + 0.8, 0.15, 2.8, { faces: 'xXzZYy' });
    // Interior floor
    this.slab('pavers', teaFr, 0, 0.05, 0, tw - 1.2, td - 1.2, 1.2, [0.95, 0.88, 0.82]);
    // Traditional Stainless Steel Tea Counter & Samovar (Boiler)
    this.box('chrome', teaFr, -3.2, 0, 2.2, 3.8, 1.15, 1.4, { faces: 'xXzZYy' });
    this.box('chrome', teaFr, -4.2, 1.15, 2.2, 0.8, 0.9, 0.8, { faces: 'xXzZYy' });
    // Glass pastry showcase (pazhampori, samosas)
    this.box('glassDark', teaFr, -2.0, 1.15, 2.2, 1.6, 0.6, 0.9, { faces: 'xXzZYy' });
    // Dining tables with wooden benches
    for (const tx of [2.2, 5.0]) {
      this.box('charcoal', teaFr, tx, 0, 1.5, 2.2, 0.9, 1.2, { faces: 'xXzZYy' });
      this.box('terracotta', teaFr, tx, 0, 0.3, 2.2, 0.5, 0.45, { faces: 'xXzZYy' });
      this.box('terracotta', teaFr, tx, 0, 2.7, 2.2, 0.5, 0.45, { faces: 'xXzZYy' });
      this.box('charcoal', teaFr, tx, 0, -2.2, 2.2, 0.9, 1.2, { faces: 'xXzZYy' });
      this.box('terracotta', teaFr, tx, 0, -3.4, 2.2, 0.5, 0.45, { faces: 'xXzZYy' });
      this.box('terracotta', teaFr, tx, 0, -1.0, 2.2, 0.5, 0.45, { faces: 'xXzZYy' });
    }
    // The signature facade: green / yellow leaf panels behind white vertical fins.
    const fw = 52;
    const fy0 = 6.4;
    const fy1 = 29.5;
    const leaf = this.use('forumLeaf', fr);
    const fz = front + 1.2;
    leaf.quad(fr.P(-fw / 2, fy0, fz), fr.P(fw / 2, fy0, fz), fr.P(fw / 2, fy1, fz), fr.P(-fw / 2, fy1, fz), [[0, 0], [fw / 14, 0], [fw / 14, (fy1 - fy0) / 12], [0, (fy1 - fy0) / 12]], fr.N(0, 1));
    this.box('charcoal', fr, 0, fy0, front + 0.6, fw + 1, fy1 - fy0, 1.2, { faces: 'xXY', tile: 6 });
    for (let x = -fw / 2; x <= fw / 2 + 0.01; x += 2.08) this.box('white', fr, x, fy0 - 0.4, fz + 0.75, 0.24, fy1 - fy0 + 1.2, 1.5, { faces: 'xXZY' });
    this.box('white', fr, 0, fy1 + 0.4, fz + 0.75, fw + 0.5, 0.4, 1.5, { faces: 'xXzZYy' });
    // Roof lettering, LED screens and tenant signs.
    this.sign('forumRoof', fr, 8, fy1 + 0.9, fz + 0.2, 17, 'Z');
    for (const s of [-1, 1]) {
      this.sign('forumScreen', fr, s * 38.5, 14.5, front + 0.08, 17, 'Z');
      this.box('black', fr, s * 38.5, 14.2, front + 0.02, 17.6, 10.6, 0.1, { faces: 'xXZYy' });
    }
    this.sign('thomsun', fr, -36, 25.6, front - 3.9, 17, 'Z');
    this.sign('prestige', fr, 40, 24.6, front - 3.9, 7.5, 'Z');
    this.sign('forumScreen', fr, W / 2 + 0.08, 15, zc + 20, 17, 'X');
    this.sign('forumScreen', fr, -W / 2 - 0.08, 15, zc + 20, 17, 'x');
    // White hotel block at the southern end.
    const hf = frame(...fr.P(-W / 2 - 17, 0, zc - 6).filter((_, i) => i !== 1), 1, 0);
    this.facadeBox('hotelWhite', hf, 0, 0, 0, 26, 12 * FLOOR, 62);
    this.box('white', hf, 0, 12 * FLOOR, 0, 27, 1.2, 63, { faces: 'xXzZY' });
    this.slab('roofFlat', hf, 0, 12 * FLOOR + 1.2, 0, 26, 62, 4);
    this.solid(hf, 0, 0, 26, 62, 12 * FLOOR + 2, 'artiste');
    this.sign('artiste', hf, 0, 12 * FLOOR - 4, 31.1, 12, 'Z');
    // Driveway furniture: cones are vegetation-free, flag poles, bollards.
    for (let i = -5; i <= 5; i++) this.pole(fr, i * 9, front + 24.5, 1.0, 0.09, 'black');
    for (let i = -3; i <= 3; i++) this.pole(fr, i * 4 + 46, front + 9, 10, 0.07, 'chrome');
    for (let i = 0; i < 24; i++) if (this.rng.chance(0.55)) this.park(fr, -58 + i * 3.0, front + 17.5, Math.PI, 'car');
    for (let i = 0; i < 16; i++) if (this.rng.chance(0.7)) this.park(fr, -50 + i * 1.3, front + 9.2, Math.PI, 'bike');
  }

  // ========================================================================== stadium
  _stadium() {
    const c = LANDMARKS.stadium.p;
    const cx = c[0];
    const cz = c[1];
    const fr = frame(cx, cz, 0, -1); // main gate faces north (Banerji Road / metro)
    const N = 48;
    const RO = 86;
    const tiers = [
      [50, 1.4, 60, 7.2],
      [60.6, 8.8, 70, 15.4],
      [70.6, 17.2, 81, 25],
    ];
    const gateAt = (i) => [0, 12, 24, 36].some((g) => i === g || i === (g + N - 1) % N);
    const pt = (r, a) => [cx + Math.cos(a) * r, cz + Math.sin(a) * r];
    const ring = (key, r0, y0, r1, y1, tint, tileU = 12, tileV = 12, nOut = false, skipGates = false) => {
      const b = this.use(key, fr, tint);
      for (let i = 0; i < N; i++) {
        if (skipGates && gateAt(i) && y0 < 7) continue;
        const a0 = (i / N) * TAU;
        const a1 = ((i + 1) / N) * TAU;
        const p0 = pt(r0, a0);
        const p1 = pt(r0, a1);
        const q0 = pt(r1, a0);
        const q1 = pt(r1, a1);
        const am = (a0 + a1) / 2;
        const arc = ((r0 + r1) / 2) * (a1 - a0);
        const u0 = (i * arc) / tileU;
        const u1 = ((i + 1) * arc) / tileU;
        const sl = Math.hypot(r1 - r0, y1 - y0);
        let hint;
        if (Math.abs(r1 - r0) < 0.01) hint = [Math.cos(am) * (nOut ? 1 : -1), 0, Math.sin(am) * (nOut ? 1 : -1)];
        else hint = [-Math.cos(am) * 0.5, 1, -Math.sin(am) * 0.5];
        b.quad([p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [q1[0], y1, q1[1]], [q0[0], y1, q0[1]], [[u0, 0], [u1, 0], [u1, sl / tileV], [u0, sl / tileV]], hint);
      }
    };
    // Pitch and its apron.
    const pitch = this.use('pitch', fr);
    pitch.quad([cx - 52, 0.12, cz + 52], [cx + 52, 0.12, cz + 52], [cx + 52, 0.12, cz - 52], [cx - 52, 0.12, cz - 52], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 1, 0]);
    this.surface.circle(cx, cz, 52, SURF.PAVED);
    // Seating tiers and the walls between them.
    let prev = null;
    for (const [r0, y0, r1, y1] of tiers) {
      ring('seats', r0, y0, r1, y1, null, 14, 9, false, true);
      ring('concreteLm', r0, prev ? prev[3] : 0.1, r0, y0, null, 6, 6, false, true);
      prev = [r0, y0, r1, y1];
    }
    // Advertising boards around the pitch.
    ring('red', 50.02, 0.12, 50.02, 1.1, [0.1, 0.25, 0.7], 6, 6, false, true);
    // Back wall of the top tier and the outer skin.
    ring('concreteLm', 81, 25, 81, 27.5, null, 6, 6, false);
    ring('concreteLm', 81.4, 4.2, 81.4, 27.5, [0.8, 0.77, 0.7], 6, 6, true);
    // Concourse slabs.
    for (const y of [4.2, 10.5, 17, 23.5]) {
      ring('concreteLm', 81.4, y, RO + 1, y, [0.74, 0.72, 0.68], 6, 6);
      ring('concreteLm', RO + 1, y - 0.7, RO + 1, y + 1.1, [0.88, 0.86, 0.8], 6, 6, true);
      const under = this.use('concreteLm', fr, [0.5, 0.5, 0.48]);
      for (let i = 0; i < N; i++) {
        const a0 = (i / N) * TAU;
        const a1 = ((i + 1) / N) * TAU;
        const p0 = pt(81.4, a0);
        const p1 = pt(81.4, a1);
        const q0 = pt(RO + 1, a0);
        const q1 = pt(RO + 1, a1);
        under.quad([p0[0], y - 0.7, p0[1]], [p1[0], y - 0.7, p1[1]], [q1[0], y - 0.7, q1[1]], [q0[0], y - 0.7, q0[1]], undefined, [0, -1, 0]);
      }
    }
    // Radial frames.
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU;
      const p = pt(RO, a);
      const b = this.use('concreteLm', fr, [0.9, 0.88, 0.83]);
      b.box(p[0], 14.5, p[1], 3.2, 29, 1.0, a, { uvScale: 0.25, faces: 'xXzZ' });
      this.colliders.addBox(p[0], p[1], 1.6, 0.5, a, -1, 29, 'stadium-frame');
    }
    // Shops in the ring under the stand, facing outwards.
    const shopB = () => {
      const b = this.city.use('trim', cx, cz);
      b.tint = [1, 1, 1];
      return b;
    };
    for (let i = 0; i < N; i++) {
      if (gateAt(i)) continue;
      const a0 = (i / N) * TAU + 0.012;
      const a1 = ((i + 1) / N) * TAU - 0.012;
      const p0 = pt(81.6, a0);
      const p1 = pt(81.6, a1);
      const am = (a0 + a1) / 2;
      const tile = this.rng.int(0, this.city.shops.count - 1);
      const col = tile % 4;
      const row = Math.floor(tile / 4);
      const b = shopB();
      b.curLayer = this.city.shopLayer + ((row >= 4 ? 2 : 0) + (col >= 2 ? 1 : 0)) * 2;
      const u0 = (col % 2) / 2;
      const v1 = 1 - (row % 4) / 4;
      b.quad([p1[0], 0.1, p1[1]], [p0[0], 0.1, p0[1]], [p0[0], 4.1, p0[1]], [p1[0], 4.1, p1[1]], [[u0, v1 - 0.25], [u0 + 0.5, v1 - 0.25], [u0 + 0.5, v1], [u0, v1]], [Math.cos(am), 0, Math.sin(am)]);
    }
    // Folded-plate roof: alternating ridges and valleys, terracotta above, steel below.
    const roofIn = 57;
    const roofOut = 92;
    const top = this.use('terracotta', fr);
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * TAU;
      const a1 = ((i + 1) / N) * TAU;
      const lift0 = i % 2 ? 2.6 : 0;
      const lift1 = (i + 1) % 2 ? 2.6 : 0;
      const p0 = pt(roofOut, a0);
      const p1 = pt(roofOut, a1);
      const q0 = pt(roofIn, a0);
      const q1 = pt(roofIn, a1);
      const A = [p0[0], 27.6 + lift0, p0[1]];
      const B = [p1[0], 27.6 + lift1, p1[1]];
      const C = [q1[0], 32.2 + lift1, q1[1]];
      const D = [q0[0], 32.2 + lift0, q0[1]];
      const uv = [[0, 0], [2, 0], [2, 6], [0, 6]];
      top.tint = [1.55, 0.74, 0.4];
      top.quad(A, B, C, D, uv, [0, 1, 0]);
      top.tint = [0.62, 0.66, 0.66];
      top.quad([A[0], A[1] - 0.25, A[2]], [B[0], B[1] - 0.25, B[2]], [C[0], C[1] - 0.25, C[2]], [D[0], D[1] - 0.25, D[2]], uv, [0, -1, 0]);
      // Fascia at the outer edge.
      top.tint = [1.3, 0.6, 0.32];
      top.quad([A[0], A[1] - 1.2, A[2]], [B[0], B[1] - 1.2, B[2]], B, A, [[0, 0], [2, 0], [2, 0.3], [0, 0.3]], [Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)]);
    }
    // Green steel trusses under every ridge and valley.
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU;
      const lift = i % 2 ? 2.6 : 0;
      const p = pt((roofIn + roofOut) / 2, a);
      const b = this.use('greenSteel', fr);
      const len = roofOut - roofIn;
      b.box(p[0], 29.1 + lift, p[1], len, 0.5, 0.35, a, { faces: 'xXzZYy' });
      const q = pt(RO - 2, a);
      b.box(q[0], 26.6 + lift / 2, q[1], 0.35, 3.4 + lift, 0.35, a, { faces: 'xXzZ' });
    }
    // The four giant floodlight pylons.
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      const b = this.use('concreteLm', fr, [0.92, 0.9, 0.86]);
      for (const s of [-1, 1]) {
        const a0 = a + s * 0.075;
        let prevP = null;
        for (let j = 0; j <= 16; j++) {
          const t = j / 16;
          // Legs start outside the bowl and arc in over the roof.
          const r = lerp(99, 72, t * t);
          const y = 60 * Math.sin((t * Math.PI) / 2);
          const ang = lerp(a0, a + s * 0.03, t);
          const p = [cx + Math.cos(ang) * r, y, cz + Math.sin(ang) * r];
          if (prevP) b.beam(prevP, p, lerp(2.6, 1.4, (j - 1) / 16), lerp(3.2, 1.6, (j - 1) / 16), { widthEnd: lerp(2.6, 1.4, t), depthEnd: lerp(3.2, 1.6, t) });
          prevP = p;
        }
        const foot = pt(99, a0);
        this.colliders.addCircle(foot[0], foot[1], 1.8, -1, 12, 'pylon');
      }
      // Cross ties between the legs.
      for (const t of [0.45, 0.7, 0.92]) {
        const r = lerp(99, 72, t * t);
        const y = 60 * Math.sin((t * Math.PI) / 2);
        const pa = [cx + Math.cos(lerp(a - 0.075, a - 0.03, t)) * r, y, cz + Math.sin(lerp(a - 0.075, a - 0.03, t)) * r];
        const pb = [cx + Math.cos(lerp(a + 0.075, a + 0.03, t)) * r, y, cz + Math.sin(lerp(a + 0.075, a + 0.03, t)) * r];
        b.beam(pa, pb, 1.1, 1.3);
      }
      // Lamp bank.
      const head = pt(71, a);
      const hb = this.use('black', fr);
      hb.box(head[0], 61.5, head[1], 1.2, 7.5, 15, a, { faces: 'xXzZYy' });
      const lamp = this.use('lamp', fr);
      const inx = -Math.cos(a);
      const inz = -Math.sin(a);
      for (let r = 0; r < 4; r++) {
        for (let q = -5; q <= 5; q++) {
          const lx = head[0] + inx * 0.66 - Math.sin(a) * q * 1.3;
          const lz = head[1] + inz * 0.66 + Math.cos(a) * q * 1.3;
          lamp.box(lx, 59 + r * 1.7, lz, 0.12, 1.1, 0.95, a, { faces: 'xXzZYy' });
        }
      }
    }
    // Colliders for the stands (gates stay open) and the paved ring around the bowl.
    for (let i = 0; i < N; i++) {
      if (gateAt(i)) continue;
      const a = ((i + 0.5) / N) * TAU;
      const p = pt(68, a);
      this.colliders.addBox(p[0], p[1], 18.2, (TAU * 68) / N / 2 + 0.6, a, -1, 30, 'stadium');
    }
    this.surface.circle(cx, cz, RO + 2, SURF.BUILDING, [SURF.PAVED]);
    const ap = this.use('apron', fr, [0.78, 0.76, 0.72]);
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * TAU;
      const a1 = ((i + 1) / N) * TAU;
      const p0 = pt(81, a0);
      const p1 = pt(81, a1);
      const q0 = pt(118, a0);
      const q1 = pt(118, a1);
      ap.quad([p0[0], 0.08, p0[1]], [p1[0], 0.08, p1[1]], [q1[0], 0.08, q1[1]], [q0[0], 0.08, q0[1]], [[p0[0] / 4, p0[1] / 4], [p1[0] / 4, p1[1] / 4], [q1[0] / 4, q1[1] / 4], [q0[0] / 4, q0[1] / 4]], [0, 1, 0]);
    }
    for (let i = 0; i < 4; i++) {
      // Gate tunnels are open ground.
      const a = (i * Math.PI) / 2;
      for (let r = 50; r < 90; r += 2) this.surface.circle(cx + Math.cos(a - 0.065) * r, cz + Math.sin(a - 0.065) * r, 4.4, SURF.PAVED, [SURF.ROAD]);
    }
    // Annulus outside the bowl.
    for (let i = 0; i < 180; i++) {
      const a = (i / 180) * TAU;
      for (let r = 90; r <= 116; r += 3) {
        const x = cx + Math.cos(a) * r;
        const z = cz + Math.sin(a) * r;
        const t = this.surface.typeAt(x, z);
        if (t === SURF.RESERVED || t === SURF.LAND || t === SURF.VERGE) this.surface.circle(x, z, 2, SURF.PAVED, [SURF.ROAD, SURF.SIDEWALK, SURF.BUILDING, SURF.MEDIAN]);
      }
    }
    // Name board over the north gate, club banners around the ring.
    this.signAt('stadium', cx, 19.5, cz - RO - 1.7, 0, -1, 40, false, fr);
    this.signAt('stadium', cx, 19.5, cz + RO + 1.7, 0, 1, 40, false, fr);
    this.signAt('stadium', cx - RO - 1.7, 19.5, cz, -1, 0, 40, false, fr);
    this.signAt('stadium', cx + RO + 1.7, 19.5, cz, 1, 0, 40, false, fr);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + 0.26;
      const p = pt(RO + 1.6, a);
      this.signAt(i % 2 ? 'yellow' : 'gcda', p[0], 12.2, p[1], Math.cos(a), Math.sin(a), i % 2 ? 9 : 6, false, fr);
    }
    // Parking on the apron.
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * TAU;
      if (!this.rng.chance(0.4)) continue;
      const near = [0, Math.PI / 2, Math.PI, Math.PI * 1.5].some((g) => Math.abs(((a - g + Math.PI * 3) % TAU) - Math.PI) < 0.16);
      if (near) continue;
      const p = pt(104, a);
      if (this.surface.typeAt(p[0], p[1]) !== SURF.PAVED) continue;
      this.city.parking.push({ x: p[0], z: p[1], heading: Math.atan2(-Math.cos(a), -Math.sin(a)), kind: this.rng.chance(0.3) ? 'bike' : 'car', fixed: true });
    }
  }

  // ============================================================== Vyttila Mobility Hub
  _hub() {
    const c = LANDMARKS.hub.p;
    const fr = frame(c[0], c[1] - 42, 0, 1); // bays face south, local X runs east
    const bays = 11;
    const bw = 13;
    const total = bays * bw;
    // Yard: paver apron by the bays, asphalt for the buses.
    this.slab('pavers', fr, 0, 0.08, 20, total + 30, 40, 1.5);
    this.slab('pavers', fr, 0, 0.075, 95, total + 50, 110, 1.5, [0.78, 0.76, 0.74]);
    this.slab('pavers', fr, 0, 0.08, -24, total + 30, 48, 1.5);
    this.paved(fr, 0, 40, total + 56, 230);
    this.box('white', fr, 0, 0, -16, total, 6.2, 12, { tile: 4 });
    this.slab('roofFlat', fr, 0, 6.2, -16, total, 12, 4);
    this.hollowSolid(fr, 0, -16, total, 12, 6.5, 'hub-hall', 28);

    // Enterable KSRTC Passenger Waiting Lounge
    this.slab('pavers', fr, 0, 0.05, -16, total - 2, 11, 1.2, [0.93, 0.93, 0.9]);
    // Rows of waiting passenger benches
    for (let bi = -4; bi <= 4; bi += 2) {
      this.box('steel', fr, bi * 12, 0, -15.5, 8, 0.55, 0.9, { faces: 'xXzZYy' });
      this.box('steel', fr, bi * 12, 0, -18.5, 8, 0.55, 0.9, { faces: 'xXzZYy' });
    }
    // Ticket Booking & Inquiry Counter
    this.box('charcoal', fr, 0, 0, -12, 14, 1.2, 1.4, { faces: 'xXzZYy' });
    this.box('glassDark', fr, 0, 1.2, -12, 13.6, 1.2, 0.1, { faces: 'xXzZY' });
    const shopRow = (z, n) => {
      for (let i = 0; i < n; i++) {
        const x0 = -total / 2 + (i * total) / n;
        const x1 = x0 + total / n;
        const tile = this.rng.int(0, this.city.shops.count - 1);
        const col = tile % 4;
        const row = Math.floor(tile / 4);
        const b = this.city.use('trim', fr.cx, fr.cz);
        b.tint = [1, 1, 1];
        b.curLayer = this.city.shopLayer + ((row >= 4 ? 2 : 0) + (col >= 2 ? 1 : 0)) * 2;
        const u0 = (col % 2) / 2;
        const v1 = 1 - (row % 4) / 4;
        b.quad(fr.P(x0, 0.1, z), fr.P(x1, 0.1, z), fr.P(x1, 3.9, z), fr.P(x0, 3.9, z), [[u0, v1 - 0.25], [u0 + 0.5, v1 - 0.25], [u0 + 0.5, v1], [u0, v1]], fr.N(0, 1));
      }
    };
    shopRow(-9.94, 26);
    this.sign('ksrtcBoard', fr, -40, 4.2, -9.9, 14, 'Z');
    this.sign('hub', fr, 20, 4.1, -9.9, 22, 'Z');
    // The canopy: a row of curved shells, each with a lattice skylight rising behind it.
    const profile = [
      [12.5, 5.0],
      [8, 6.4],
      [3, 7.8],
      [-2, 8.9],
      [-6.5, 9.6],
      [-10, 9.9],
    ];
    for (let i = 0; i < bays; i++) {
      const x0 = -total / 2 + i * bw;
      const b = this.use('roofSteel', fr);
      const cols = 6;
      const rowsTop = [];
      const rowsBot = [];
      for (const [z, y] of profile) {
        const rowT = [];
        const rowB = [];
        for (let k = 0; k <= cols; k++) {
          const t = k / cols;
          const arch = Math.sin(t * Math.PI) * 1.5;
          const p = fr.P(x0 + 0.25 + t * (bw - 0.5), 0, z);
          rowT.push([p[0], y + arch, p[2], t * 3, z / 4]);
          rowB.push([p[0], y + arch - 0.28, p[2], t * 3, z / 4]);
        }
        rowsTop.push(rowT);
        rowsBot.push(rowB);
      }
      b.tint = [0.74, 0.77, 0.79];
      b.ribbon(rowsTop, [0, 1, 0]);
      b.tint = [0.86, 0.87, 0.86];
      b.ribbon(rowsBot, [0, -1, 0]);
      // Front lip.
      const lip = this.use('white', fr);
      for (let k = 0; k < cols; k++) {
        const a = rowsTop[0][k];
        const bb = rowsTop[0][k + 1];
        lip.quad([a[0], a[1] - 0.5, a[2]], [bb[0], bb[1] - 0.5, bb[2]], [bb[0], bb[1] + 0.05, bb[2]], [a[0], a[1] + 0.05, a[2]], undefined, fr.N(0, 1));
      }
      // Lattice skylight.
      const lat = this.use('lattice', fr);
      const back = rowsTop[rowsTop.length - 1];
      const apex = fr.P(x0 + bw / 2, 0, -15.5);
      for (let k = 0; k < cols; k++) {
        const a = back[k];
        const bb = back[k + 1];
        const t0 = k / cols;
        const t1 = (k + 1) / cols;
        const ax = lerp(a[0], apex[0], 0.55);
        const az = lerp(a[2], apex[2], 1);
        const bx = lerp(bb[0], apex[0], 0.55);
        const bz = lerp(bb[2], apex[2], 1);
        const ay = 13.2 + Math.sin(t0 * Math.PI) * 2.4;
        const by = 13.2 + Math.sin(t1 * Math.PI) * 2.4;
        const uv = [[t0, 0], [t1, 0], [t1, 1], [t0, 1]];
        lat.quad([a[0], a[1], a[2]], [bb[0], bb[1], bb[2]], [bx, by, bz], [ax, ay, az], uv, [fr.fx, 0.6, fr.fz]);
        lat.quad([a[0], a[1], a[2]], [bb[0], bb[1], bb[2]], [bx, by, bz], [ax, ay, az], uv, [-fr.fx, -0.6, -fr.fz]);
      }
      // V columns.
      const base = fr.P(x0, 0, 2.5);
      const w = this.use('white', fr);
      for (const zt of [9.5, -5]) {
        const topP = fr.P(x0, 0, zt);
        const yTop = zt > 0 ? 6.0 : 9.2;
        const steps = 5;
        for (let s = 0; s < steps; s++) {
          const t0 = s / steps;
          const t1 = (s + 1) / steps;
          const mx = lerp(base[0], topP[0], (t0 + t1) / 2);
          const mz = lerp(base[2], topP[2], (t0 + t1) / 2);
          w.box(mx, lerp(0, yTop, (t0 + t1) / 2), mz, 0.42, yTop / steps + 0.3, Math.abs(zt - 2.5) / steps + 0.35, fr.rot, { faces: 'xXzZ' });
        }
      }
      w.box(base[0], 0.5, base[2], 0.9, 1.0, 0.9, fr.rot, { faces: 'xXzZY' });
      this.colliders.addCircle(base[0], base[2], 0.6, -1, 6, 'hub-column');
      if (i < 8) this.sign(`bay${i + 1}`, fr, x0 + bw / 2, 4.4, 12.6, 1.5, 'Z', true);
    }
    const endCol = fr.P(total / 2, 0, 2.5);
    this.colliders.addCircle(endCol[0], endCol[2], 0.6, -1, 6, 'hub-column');
    // Platform kerb.
    this.box('concreteLm', fr, 0, 0, 1.2, total, 0.32, 5, { faces: 'xXzZY', tile: 3 });
    // Buses standing in the bays, noses to the platform.
    const kinds = ['ksrtc', 'bus', 'ksrtc', 'bus', 'bus', 'ksrtc', 'bus'];
    for (let i = 0; i < bays; i++) {
      if (i % 3 === 1) continue;
      const p = fr.P(-total / 2 + i * bw + bw / 2, 0, 10.5);
      this.city.parking.push({ x: p[0], z: p[2], heading: Math.atan2(-fr.fx, -fr.fz), kind: kinds[i % kinds.length], fixed: true });
    }
    for (let i = 0; i < 12; i++) if (this.rng.chance(0.6)) this.park(fr, -total / 2 - 8 + i * 1.4, 150, 0, i % 3 ? 'auto' : 'bike');
    for (let i = 0; i < 10; i++) if (this.rng.chance(0.55)) this.park(fr, 30 + i * 3, 148, 0, 'car');
    // Driveway linking the yard to the Thrippunithura road.
    const road = this.world.roads.edgeById.TRP;
    const rf = road.at(176);
    const gp = fr.P(-total / 2 + 14, 0, 150);
    const drv = frame((gp[0] + rf.x) / 2, (gp[2] + rf.z) / 2, rf.x - gp[0], rf.z - gp[2]);
    const dl = Math.hypot(rf.x - gp[0], rf.z - gp[2]);
    this.slab('asphalt', drv, 0, 0.075, 0, 22, dl, 4);
    this.paved(drv, 0, 0, 22, dl);
    // Entrance gateway on the Thrippunithura road side.
    const gate = frame(...fr.P(-total / 2 + 14, 0, 148).filter((_, i) => i !== 1), -0.35, 1);
    for (const s of [-1, 1]) {
      this.box('white', gate, s * 12.5, 0, 0, 1.6, 9, 1.6, { faces: 'xXzZY' });
      const p = gate.P(s * 12.5, 0, 0);
      this.colliders.addCircle(p[0], p[2], 1.1, -1, 9, 'hub-gate');
    }
    this.box('white', gate, 0, 7, 0, 27, 0.6, 1.8, { faces: 'xXzZYy' });
    this.sign('hub', gate, 0, 7.7, 0.4, 24, 'Z', true);
    // Water metro terminal and a boat on the Kaniyampuzha.
    const wf = frame(c[0] + 150, c[1] - 6, -1, 0);
    this.box('white', wf, 0, 0, 0, 22, 4.6, 11, { tile: 4 });
    this.facadeBox('glassWall', wf, 0, 0.2, 5.6, 18, 3.6, 0.2, 'zxX');
    this.solid(wf, 0, 0, 22, 11, 5, 'water-metro');
    const roof = this.use('roofSteel', wf);
    const rr = [];
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      const row = [];
      for (const lx of [-13, 13]) {
        const p = wf.P(lx, 0, lerp(-7.5, 8.5, t));
        row.push([p[0], 4.7 + Math.sin(t * Math.PI) * 2.0, p[2], lx / 4, t * 4]);
      }
      rr.push(row);
    }
    roof.tint = [0.8, 0.9, 0.9];
    roof.ribbon(rr, [0, 1, 0]);
    roof.ribbon(rr, [0, -1, 0]);
    this.sign('waterMetro', wf, 0, 3.0, 5.75, 13, 'Z');
    this.slab('pavers', wf, 0, 0.08, 12, 40, 16, 1.5);
    this.paved(wf, 0, 12, 40, 16);
    // Jetty and catamaran.
    const jf = frame(c[0] + 178, c[1] - 6, 1, 0);
    this.box('concreteLm', jf, 0, -0.6, 8, 5, 0.9, 40, { faces: 'xXzZY', tile: 3 });
    const jp = jf.P(0, 0, 8);
    this.surface.rect(jp[0], jp[2], 2.5, 20, jf.rot, SURF.PAVED, [SURF.ROAD]);
    for (const s of [-1, 1]) {
      this.box('white', jf, s * 7.5, -0.7, 20, 2.6, 1.6, 22, { faces: 'xXzZY' });
      this.box('white', jf, s * 7.5, 0.9, 20, 2.0, 0.2, 19, { faces: 'xXzZY', tint: [0.1, 0.6, 0.6] });
    }
    this.box('white', jf, 7.5, 0.6, 20, 12, 0.5, 20, { faces: 'xXzZYy' });
    this.box('glassDark', jf, 7.5, 1.1, 19, 9.6, 2.3, 15, { faces: 'xXzZ', tile: 10 });
    this.box('white', jf, 7.5, 3.4, 19, 10.4, 0.3, 16.5, { faces: 'xXzZYy', tint: [0.1, 0.62, 0.62] });
  }

  // ======================================================================== Brototype
  _brototype() {
    const c = LANDMARKS.brototype.p;
    const hit = this.world.roads.nearestEdge(c[0], c[1], 120);
    const side = Math.sign(hit.lateral) || 1;
    const fr = frame(c[0], c[1], -hit.sample.nx * side, -hit.sample.nz * side);
    const W = 30;
    const D = 19;
    const floors = 4;
    const H = 3.6 + (floors - 1) * FLOOR;
    const front = D / 2;
    // Forecourt where the students park.
    this.slab('pavers', fr, 0, 0.08, front + 9, W + 16, 18, 1.5);
    this.paved(fr, 0, front + 9, W + 16, 18);
    // Body: dark frame, glass curtain wall between.
    this.facadeBox('charcoal', fr, 0, 0, 0, W, H + 1.2, D, 'Z');
    this.hollowSolid(fr, 0, 0, W, D, H + 2, 'brototype', 6.0);
    this.slab('roofFlat', fr, 0, H + 1.2, 0, W, D, 4);

    // Front glass with open 6m wide entrance doorway in center
    const g = this.use('glassDark', fr);
    // Left glass wing
    g.quad(fr.P(-W / 2 + 2.2, 0.1, front), fr.P(-3.0, 0.1, front), fr.P(-3.0, H - 2.2, front), fr.P(-W / 2 + 2.2, H - 2.2, front), [[0, 0], [1.2, 0], [1.2, 1], [0, 1]], fr.N(0, 1));
    // Right glass wing
    g.quad(fr.P(3.0, 0.1, front), fr.P(W / 2 - 2.2, 0.1, front), fr.P(W / 2 - 2.2, H - 2.2, front), fr.P(3.0, H - 2.2, front), [[0, 0], [1.2, 0], [1.2, 1], [0, 1]], fr.N(0, 1));
    // Transom glass above 3m doorway
    g.quad(fr.P(-3.0, 3.0, front), fr.P(3.0, 3.0, front), fr.P(3.0, H - 2.2, front), fr.P(-3.0, H - 2.2, front), [[0, 0], [1, 0], [1, 0.8], [0, 0.8]], fr.N(0, 1));

    // Interior floor and furniture inside Bilal Complex / Thamarassery Hub
    this.slab('pavers', fr, 0, 0.05, 0, W - 1.2, D - 1.2, 1.2, [0.96, 0.96, 0.94]);
    // Reception & Security desk
    this.box('charcoal', fr, 0, 0, 3.2, 4.4, 1.15, 1.5, { faces: 'xXzZYy' });
    this.box('black', fr, 0, 1.15, 3.2, 1.4, 0.65, 0.2, { faces: 'xXzZYy' });
    // Waiting Lounge Sofas
    this.box('red', fr, -7.5, 0, 2.5, 3.2, 0.75, 1.4, { faces: 'xXzZYy' });
    this.box('red', fr, 7.5, 0, 2.5, 3.2, 0.75, 1.4, { faces: 'xXzZYy' });
    // Workstations & Dev Desks
    this.box('white', fr, -6, 0, -4, 5.5, 0.95, 1.8, { faces: 'xXzZYy' });
    this.box('white', fr, 6, 0, -4, 5.5, 0.95, 1.8, { faces: 'xXzZYy' });
    this.box('black', fr, -6, 0.95, -4, 2.2, 0.6, 0.2, { faces: 'xXzZYy' });
    this.box('black', fr, 6, 0.95, -4, 2.2, 0.6, 0.2, { faces: 'xXzZYy' });
    // Potted indoor palm planters
    this.box('terracotta', fr, -10.5, 0, 4.5, 0.9, 0.85, 0.9, { faces: 'xXzZYy' });
    this.box('terracotta', fr, 10.5, 0, 4.5, 0.9, 0.85, 0.9, { faces: 'xXzZYy' });
    // Warm overhead ceiling light fixtures
    this.box('lamp', fr, 0, 3.5, 0, 3.5, 0.1, 7);
    this.box('lamp', fr, -6, 3.5, -3, 2.5, 0.1, 4.5);
    this.box('lamp', fr, 6, 3.5, -3, 2.5, 0.1, 4.5);
    this.sign('brototype', fr, 0, 2.4, -D / 2 + 0.35, 7.5, 'Z');

    for (const s of [-1, 1]) this.box('charcoal', fr, s * (W / 2 - 1.1), 0, front + 0.2, 2.2, H + 1.2, 0.5, { faces: 'xXZ', tile: 6 });
    this.box('black', fr, 0, H - 2.2, front + 0.22, W - 4.4, 3.4, 0.5, { faces: 'xXZYy' });
    for (let k = 1; k < floors; k++) this.box('black', fr, 0, 3.4 + (k - 1) * FLOOR, front + 0.12, W - 4.4, 0.22, 0.28, { faces: 'ZYy' });
    // Signage.
    this.sign('brototype', fr, 0, H - 2.05, front + 0.5, 15.5, 'Z');
    this.sign('brototypeBlade', fr, W / 2 + 0.35, 3.8, front - 1.2, 2.1, 'X', true);
    this.box('red', fr, W / 2 + 0.2, 3.7, front - 1.2, 0.3, 8.8, 2.3, { faces: 'xXzZYy' });
    // Entrance: glass doors under a canopy with red trim.
    this.box('white', fr, 0, 3.2, front + 2.4, 9, 0.28, 4.6, { faces: 'xXzZYy', tint: [0.7, 0.8, 0.9] });
    this.box('red', fr, 0, 3.05, front + 4.66, 9.1, 0.18, 0.12, { faces: 'xXzZYy' });
    for (const s of [-1, 1]) this.pole(fr, s * 4.1, front + 4.3, 3.2, 0.08, 'chrome');
    this.box('concreteLm', fr, 0, 0, front + 2, 8, 0.2, 4, { faces: 'xXZY', tile: 3 });
    // Bikes, bikes, bikes - and a couple of cars.
    for (let i = 0; i < 18; i++) if (this.rng.chance(0.78)) this.park(fr, -W / 2 - 5 + i * 1.25, front + 12.5, Math.PI + this.rng.float(-0.15, 0.15), 'bike');
    this.park(fr, W / 2 + 3, front + 11.5, Math.PI, 'car');
    this.park(fr, W / 2 + 6, front + 11.5, Math.PI, 'car');
    this.brototypeFrame = fr;
  }

  // ===================================================================== Thamarassery Police Station
  _crowne() {
    const c = LANDMARKS.crowne.p;
    const k = NODES.K.p;
    const fr = frame(c[0], c[1], k[0] - c[0], k[1] - c[1]);
    const H = 19 * FLOOR;
    this.facadeBox('glassWall', fr, 0, 0, 0, 44, 8, 30);
    this.facadeBox('hotelCream', fr, 0, 8, -2, 40, H - 8, 22);
    this.box('luluBand', fr, 0, H, -2, 41, 2.6, 23, { tile: 8 });
    this.slab('roofFlat', fr, 0, H + 2.6, -2, 41, 23, 4);
    this.hollowSolid(fr, 0, 0, 44, 30, H + 4, 'police-station', 6.0);
    this.sign('policeStation', fr, 0, 7.8, 15.1, 16, 'Z');
    this.sign('crowne', fr, 0, H - 1.2, 9.1, 17, 'Z');

    // Interior floor of Police Station
    this.slab('pavers', fr, 0, 0.05, 0, 42, 28, 1.2, [0.91, 0.93, 0.95]);
    // Duty Officer charge desk
    this.box('charcoal', fr, 0, 0, 4, 4.8, 1.15, 1.6, { faces: 'xXzZYy' });
    this.box('black', fr, 0, 1.15, 4, 1.2, 0.6, 0.2, { faces: 'xXzZYy' });
    // Police Lockup / Jail Cell with metal bars
    this.box('concreteLm', fr, -14, 0, -4, 0.4, 3.5, 12, { faces: 'xXzZY' });
    this.box('concreteLm', fr, -8, 0, -10, 12, 3.5, 0.4, { faces: 'xXzZY' });
    for (let bx = -13.5; bx <= -7; bx += 0.5) this.pole(fr, bx, 2, 3.5, 0.04, 'steel');
    this.box('charcoal', fr, -11, 0, -4, 2.2, 0.5, 1.1, { faces: 'xXzZYy' });
    // Officer office desks and filing cabinets
    this.box('white', fr, 8, 0, -2, 5, 0.95, 2, { faces: 'xXzZYy' });
    this.box('white', fr, 8, 0.95, -2, 1.8, 0.6, 0.2, { faces: 'xXzZYy' });
    this.box('steel', fr, 13, 0, -2, 1.4, 2.2, 1.1, { faces: 'xXzZYy' });

    this.slab('pavers', fr, 0, 0.08, 26, 60, 22, 1.5);
    this.paved(fr, 0, 26, 60, 22);
    this.box('white', fr, 0, 5.4, 19.5, 18, 0.5, 9, { faces: 'xXzZYy' });
    for (let i = 0; i < 9; i++) if (this.rng.chance(0.6)) this.park(fr, -24 + i * 3, 31, Math.PI, 'car');
  }

  // ================================================================ supporting malls
  _minorMalls() {
    // Oberon Mall on the bypass north of Palarivattom, Gold Souk Grande by Vyttila.
    const spots = [
      { id: 'oberon', at: P(-142, 1118), key: 'glassWall', w: 62, d: 44, h: 22 },
      { id: 'goldsouk', at: P(-70, 218), key: 'luluStone', w: 58, d: 46, h: 20 },
    ];
    for (const s of spots) {
      const hit = this.world.roads.nearestEdge(s.at[0], s.at[1], 200);
      if (!hit) continue;
      const side = Math.sign(hit.lateral) || 1;
      const fr = frame(s.at[0], s.at[1], -hit.sample.nx * side, -hit.sample.nz * side);
      if (!this.surface.rectIsFree(s.at[0], s.at[1], s.w / 2, s.d / 2, fr.rot, [SURF.LAND, SURF.VERGE])) continue;
      if (s.key === 'glassWall') this.facadeBox(s.key, fr, 0, 0, 0, s.w, s.h, s.d);
      else this.box(s.key, fr, 0, 0, 0, s.w, s.h, s.d, { tile: 8 });
      this.box('charcoal', fr, 0, s.h, 0, s.w + 0.6, 2, s.d + 0.6, { tile: 6 });
      this.slab('roofFlat', fr, 0, s.h + 2, 0, s.w, s.d, 4);
      this.city._register(fr, s.w, s.d, s.h + 3, s.id);
      this.sign(s.id, fr, 0, s.h - 5.5, s.d / 2 + 0.06, 22, 'Z');
      this.banner(fr, -s.w / 4, 6, s.d / 2, 13, 8);
      this.banner(fr, s.w / 4, 6, s.d / 2, 13, 8);
    }
  }
}
