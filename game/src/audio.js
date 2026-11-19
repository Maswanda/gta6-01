// audio.js — procedural Web Audio: no samples, no network. Engine hum,
// gunshots, pickups and UI blips are all synthesized oscillators/noise.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this._engineOsc = null;
    this._engineGain = null;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    } catch { this.ctx = null; }
  }
  _osc(type, freq, dur, vol, slideTo) {
    if (!this.ctx || !this.enabled) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    } catch { /* audio is cosmetic */ }
  }
  _noise(dur, vol, freq) {
    if (!this.ctx || !this.enabled) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = freq || 1200;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t);
    } catch { /* cosmetic */ }
  }
  blip(freq = 880) { this._osc('sine', freq, 0.09, 0.25); }
  pickup() { this._osc('sine', 660, 0.12, 0.3, 990); }
  cash() { this._osc('sine', 990, 0.1, 0.25); this._osc('sine', 1320, 0.14, 0.2); }
  shot(kind) {
    if (kind === 'shotgun') { this._noise(0.28, 0.5, 900); this._osc('square', 120, 0.15, 0.3, 50); }
    else if (kind === 'smg') { this._noise(0.09, 0.3, 2000); }
    else { this._noise(0.14, 0.4, 1500); }
  }
  reload() { this._osc('square', 300, 0.06, 0.15); this._osc('square', 220, 0.06, 0.15); }
  siren(on) {
    if (!this.ctx || !this.enabled) return;
    if (on && !this._sirenOsc) {
      try {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine'; o.frequency.value = 700;
        g.gain.value = 0.04;
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 0.7;
        const lg = this.ctx.createGain(); lg.gain.value = 250;
        lfo.connect(lg); lg.connect(o.frequency);
        o.connect(g); g.connect(this.master);
        o.start(); lfo.start();
        this._sirenOsc = o; this._sirenLfo = lfo; this._sirenGain = g;
      } catch { /* cosmetic */ }
    } else if (!on && this._sirenOsc) {
      try { this._sirenOsc.stop(); this._sirenLfo.stop(); } catch {}
      this._sirenOsc = null; this._sirenLfo = null; this._sirenGain = null;
    }
  }
  // Engine hum follows speed; call every frame.
  engine(speed01, on) {
    if (!this.ctx || !this.enabled) return;
    try {
      if (on && !this._engineOsc) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sawtooth'; o.frequency.value = 60;
        g.gain.value = 0.03;
        o.connect(g); g.connect(this.master);
        o.start();
        this._engineOsc = o; this._engineGain = g;
      } else if (!on && this._engineOsc) {
        try { this._engineOsc.stop(); } catch {}
        this._engineOsc = null; this._engineGain = null;
      }
      if (this._engineOsc) {
        this._engineOsc.frequency.value = 55 + speed01 * 130;
        this._engineGain.gain.value = 0.02 + speed01 * 0.05;
      }
    } catch { /* cosmetic */ }
  }
}
