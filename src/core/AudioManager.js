// All sound is synthesised with WebAudio - no sample downloads, nothing to license.
// City bed, distant horns, birds and crows, engine with gear changes, horn, tyres, impacts.

import { clamp, lerp } from '../utils/math.js';

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.engineOn = false;
    this.time = 0;
    this.nextHorn = 4;
    this.nextBird = 2;
    this.nextCrow = 7;
    this.voices = [];
  }

  /** Must be called from a user gesture. */
  start() {
    if (this.ctx || !this.enabled) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      this.enabled = false;
      return;
    }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.55;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 5;
    this.master.connect(comp).connect(c.destination);

    this.noiseBuffer = this._noise(2.5, 'white');
    this.brownBuffer = this._noise(4, 'brown');

    // --- city bed
    const bed = c.createBufferSource();
    bed.buffer = this.brownBuffer;
    bed.loop = true;
    const bedFilter = c.createBiquadFilter();
    bedFilter.type = 'lowpass';
    bedFilter.frequency.value = 520;
    this.bedGain = c.createGain();
    this.bedGain.gain.value = 0.16;
    bed.connect(bedFilter).connect(this.bedGain).connect(this.master);
    bed.start();
    // Tyre hiss of traffic in the distance.
    const hiss = c.createBufferSource();
    hiss.buffer = this.noiseBuffer;
    hiss.loop = true;
    const hissFilter = c.createBiquadFilter();
    hissFilter.type = 'bandpass';
    hissFilter.frequency.value = 1500;
    hissFilter.Q.value = 0.5;
    this.hissGain = c.createGain();
    this.hissGain.gain.value = 0.012;
    hiss.connect(hissFilter).connect(this.hissGain).connect(this.master);
    hiss.start();

    // --- engine
    this.eng = {};
    const e = this.eng;
    e.osc1 = c.createOscillator();
    e.osc1.type = 'sawtooth';
    e.osc2 = c.createOscillator();
    e.osc2.type = 'square';
    e.sub = c.createOscillator();
    e.sub.type = 'triangle';
    e.filter = c.createBiquadFilter();
    e.filter.type = 'lowpass';
    e.filter.frequency.value = 500;
    e.filter.Q.value = 1.2;
    e.gain = c.createGain();
    e.gain.gain.value = 0;
    e.g1 = c.createGain();
    e.g1.gain.value = 0.5;
    e.g2 = c.createGain();
    e.g2.gain.value = 0.22;
    e.g3 = c.createGain();
    e.g3.gain.value = 0.55;
    e.osc1.connect(e.g1).connect(e.filter);
    e.osc2.connect(e.g2).connect(e.filter);
    e.sub.connect(e.g3).connect(e.filter);
    // Rattle for two-strokes and diesels.
    e.rough = c.createBufferSource();
    e.rough.buffer = this.noiseBuffer;
    e.rough.loop = true;
    e.roughGain = c.createGain();
    e.roughGain.gain.value = 0;
    e.roughFilter = c.createBiquadFilter();
    e.roughFilter.type = 'bandpass';
    e.roughFilter.frequency.value = 900;
    e.rough.connect(e.roughFilter).connect(e.roughGain).connect(e.filter);
    e.filter.connect(e.gain).connect(this.master);
    e.osc1.start();
    e.osc2.start();
    e.sub.start();
    e.rough.start();

    // --- wind and tyres
    const wind = c.createBufferSource();
    wind.buffer = this.noiseBuffer;
    wind.loop = true;
    this.windFilter = c.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 600;
    this.windFilter.Q.value = 0.4;
    this.windGain = c.createGain();
    this.windGain.gain.value = 0;
    wind.connect(this.windFilter).connect(this.windGain).connect(this.master);
    wind.start();
    const skid = c.createBufferSource();
    skid.buffer = this.noiseBuffer;
    skid.loop = true;
    const skidFilter = c.createBiquadFilter();
    skidFilter.type = 'bandpass';
    skidFilter.frequency.value = 1900;
    skidFilter.Q.value = 3.5;
    this.skidGain = c.createGain();
    this.skidGain.gain.value = 0;
    skid.connect(skidFilter).connect(this.skidGain).connect(this.master);
    skid.start();

    // --- horn
    this.horn = {};
    const h = this.horn;
    h.a = c.createOscillator();
    h.a.type = 'square';
    h.a.frequency.value = 415;
    h.b = c.createOscillator();
    h.b.type = 'square';
    h.b.frequency.value = 523;
    h.filter = c.createBiquadFilter();
    h.filter.type = 'lowpass';
    h.filter.frequency.value = 2400;
    h.gain = c.createGain();
    h.gain.gain.value = 0;
    h.a.connect(h.filter);
    h.b.connect(h.filter);
    h.filter.connect(h.gain).connect(this.master);
    h.a.start();
    h.b.start();

    // --- passing traffic voices
    for (let i = 0; i < 4; i++) {
      const src = c.createBufferSource();
      src.buffer = this.brownBuffer;
      src.loop = true;
      src.playbackRate.value = 0.8 + i * 0.15;
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 700;
      const g = c.createGain();
      g.gain.value = 0;
      const pan = c.createStereoPanner ? c.createStereoPanner() : null;
      src.connect(f).connect(g);
      if (pan) g.connect(pan).connect(this.master);
      else g.connect(this.master);
      src.start();
      this.voices.push({ g, f, pan });
    }
  }

  _noise(seconds, kind) {
    const c = this.ctx;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    return buf;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  // ------------------------------------------------------------------- one-shot sounds
  _burst({ freq = 800, q = 1, dur = 0.12, gain = 0.2, type = 'bandpass', sweep = 0, pan = 0 }) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f).connect(g);
    if (pan && c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = pan;
      g.connect(p).connect(this.master);
    } else g.connect(this.master);
    src.start(t, Math.random() * 2);
    src.stop(t + dur + 0.05);
  }

  _tone({ freq, freq2 = freq, dur = 0.2, gain = 0.1, type = 'sine', pan = 0, attack = 0.01, delay = 0 }) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, freq2), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
    o.connect(g);
    if (c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = pan;
      g.connect(p).connect(this.master);
    } else g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  step(strength = 1) {
    this._burst({ freq: 380 + Math.random() * 160, q: 1.4, dur: 0.07, gain: 0.05 * strength, type: 'bandpass' });
  }

  door() {
    this._burst({ freq: 190, q: 1.2, dur: 0.11, gain: 0.3, type: 'lowpass' });
    setTimeout(() => this._burst({ freq: 1400, q: 4, dur: 0.04, gain: 0.07 }), 60);
  }

  crash(strength) {
    const s = clamp(strength / 18, 0.15, 1);
    this._burst({ freq: 2600, q: 0.5, dur: 0.35 * s + 0.12, gain: 0.5 * s, type: 'lowpass', sweep: -2300 });
    this._burst({ freq: 140, q: 1, dur: 0.22, gain: 0.55 * s, type: 'lowpass' });
    if (s > 0.5) this._burst({ freq: 5200, q: 2, dur: 0.45, gain: 0.12 * s, type: 'bandpass' });
  }

  setHorn(on, kind = 'car') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const h = this.horn;
    if (on) {
      const f = kind === 'auto' ? [680, 860] : kind === 'bus' ? [310, 392] : kind === 'bike' ? [520, 655] : [415, 523];
      h.a.frequency.setTargetAtTime(f[0], t, 0.005);
      h.b.frequency.setTargetAtTime(f[1], t, 0.005);
    }
    h.gain.gain.setTargetAtTime(on ? 0.09 : 0, t, 0.015);
  }

  // ------------------------------------------------------------------------ per frame
  /**
   * @param {number} dt
   * @param {object|null} vehicle the vehicle the player is driving
   * @param {number} throttle 0..1
   * @param {Array} nearby traffic near the listener: [{ dist, pan, speed }]
   */
  update(dt, vehicle, throttle = 0, nearby = []) {
    if (!this.ctx) return;
    this.time += dt;
    const c = this.ctx;
    const t = c.currentTime;
    const e = this.eng;
    if (vehicle) {
      const spec = vehicle.spec;
      const v = Math.abs(vehicle.vf);
      const norm = clamp(v / spec.top, 0, 1);
      // Fake gearbox: revs climb through each ratio and drop on the shift.
      const gears = 5;
      const g = Math.min(gears - 1, Math.floor(norm * gears));
      const inGear = norm * gears - g;
      const lo = g === 0 ? 0 : 0.42;
      let rpm = lerp(lo, 1, inGear);
      rpm = Math.max(rpm, 0.12 + throttle * 0.18);
      const f = spec.engine.base + spec.engine.range * rpm;
      e.osc1.frequency.setTargetAtTime(f, t, 0.04);
      e.osc2.frequency.setTargetAtTime(f * 0.502, t, 0.04);
      e.sub.frequency.setTargetAtTime(f * 0.25, t, 0.04);
      e.filter.frequency.setTargetAtTime(380 + rpm * 1500 + throttle * 900, t, 0.06);
      e.gain.gain.setTargetAtTime(0.055 + throttle * 0.075 + rpm * 0.03, t, 0.08);
      e.roughGain.gain.setTargetAtTime(spec.engine.rough ? 0.5 : 0.12, t, 0.1);
      e.roughFilter.frequency.setTargetAtTime(500 + rpm * 900, t, 0.1);
      this.windGain.gain.setTargetAtTime(norm * norm * 0.2, t, 0.2);
      this.windFilter.frequency.setTargetAtTime(400 + norm * 1200, t, 0.2);
      this.skidGain.gain.setTargetAtTime(clamp(vehicle.slip - 0.25, 0, 1) * 0.16 * (v > 4 ? 1 : 0), t, 0.05);
    } else {
      e.gain.gain.setTargetAtTime(0, t, 0.15);
      this.windGain.gain.setTargetAtTime(0, t, 0.3);
      this.skidGain.gain.setTargetAtTime(0, t, 0.05);
    }
    this.bedGain.gain.setTargetAtTime(vehicle ? 0.1 : 0.17, t, 0.5);

    // Passing traffic.
    for (let i = 0; i < this.voices.length; i++) {
      const voice = this.voices[i];
      const n = nearby[i];
      if (n) {
        const vol = clamp(1 - n.dist / 38, 0, 1) ** 2 * (0.1 + Math.min(0.14, n.speed * 0.01));
        voice.g.gain.setTargetAtTime(vol, t, 0.12);
        voice.f.frequency.setTargetAtTime(420 + n.speed * 45, t, 0.2);
        voice.pan?.pan.setTargetAtTime(clamp(n.pan, -1, 1), t, 0.1);
      } else voice.g.gain.setTargetAtTime(0, t, 0.2);
    }

    // Distant horns - Kochi is never quiet for long.
    this.nextHorn -= dt;
    if (this.nextHorn <= 0) {
      this.nextHorn = 2.5 + Math.random() * 7;
      const base = [392, 440, 523, 620, 700][Math.floor(Math.random() * 5)];
      const pan = Math.random() * 2 - 1;
      const n = Math.random() < 0.5 ? 1 : 2;
      for (let k = 0; k < n; k++) {
        this._tone({ freq: base, dur: 0.16 + Math.random() * 0.22, gain: 0.012 + Math.random() * 0.012, type: 'square', pan, delay: k * 0.3 });
        this._tone({ freq: base * 1.26, dur: 0.16 + Math.random() * 0.2, gain: 0.008, type: 'square', pan, delay: k * 0.3 });
      }
    }
    // Small birds.
    this.nextBird -= dt;
    if (this.nextBird <= 0) {
      this.nextBird = 1.5 + Math.random() * 6;
      const pan = Math.random() * 2 - 1;
      const notes = 2 + Math.floor(Math.random() * 4);
      const f0 = 2600 + Math.random() * 1800;
      for (let k = 0; k < notes; k++) {
        this._tone({ freq: f0 * (1 + Math.random() * 0.2), freq2: f0 * (0.75 + Math.random() * 0.5), dur: 0.07 + Math.random() * 0.06, gain: 0.014, pan, delay: k * (0.09 + Math.random() * 0.05) });
      }
    }
    // Crows.
    this.nextCrow -= dt;
    if (this.nextCrow <= 0) {
      this.nextCrow = 6 + Math.random() * 14;
      const pan = Math.random() * 2 - 1;
      const n = 2 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) {
        this._tone({ freq: 640, freq2: 470, dur: 0.24, gain: 0.011, type: 'sawtooth', pan, delay: k * 0.34, attack: 0.03 });
      }
    }
  }
}
