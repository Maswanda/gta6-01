// audio.js — All sound in Solmar Bay is synthesized with WebAudio:
// no audio files, no network. SFX (shots, hits, cash, sirens) and the
// engine hum live here; the radio stations have their own engine.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this._ensure();
  }
  _ensure() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch (e) {
      this.ctx = null;
    }
  }
  resume() {
    this._ensure();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }
  // Short synthesized blip. freq in Hz, dur in seconds.
  blip(freq, dur, type = 'sine', vol = 0.2, slideTo = null) {
    if (!this.ctx || !this.master) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (e) {}
  }
  noise(dur, vol = 0.3, lowpass = 1200) {
    if (!this.ctx || !this.master) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start(t);
    } catch (e) {}
  }
  shot(weapon) {
    if (weapon === 'shotgun') this.noise(0.22, 0.5, 900);
    else if (weapon === 'smg') this.noise(0.08, 0.28, 1800);
    else this.noise(0.14, 0.38, 1400);
    this.blip(weapon === 'shotgun' ? 90 : 160, 0.08, 'square', 0.12, 50);
  }
  hit() { this.blip(220, 0.08, 'triangle', 0.18, 110); }
  cash() {
    this.blip(880, 0.09, 'sine', 0.16);
    setTimeout(() => this.blip(1320, 0.14, 'sine', 0.16), 80);
  }
  pickup() { this.blip(660, 0.1, 'sine', 0.18, 990); }
  mission() {
    this.blip(523, 0.12, 'sine', 0.2);
    setTimeout(() => this.blip(659, 0.12, 'sine', 0.2), 110);
    setTimeout(() => this.blip(784, 0.2, 'sine', 0.22), 220);
  }
  busted() {
    this.blip(392, 0.25, 'sawtooth', 0.2, 196);
    setTimeout(() => this.blip(311, 0.4, 'sawtooth', 0.2, 155), 240);
  }
  door() { this.blip(180, 0.07, 'square', 0.1, 120); }
  // Continuous engine hum while driving; speed 0..1.
  engine(speed, on) {
    if (!this.ctx || !this.master) return;
    try {
      if (!this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.value = 400;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        this.engineOsc.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
      }
      const target = on ? 0.05 + speed * 0.09 : 0;
      this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
      this.engineOsc.frequency.setTargetAtTime(50 + speed * 130, this.ctx.currentTime, 0.1);
      this.engineFilter.frequency.setTargetAtTime(300 + speed * 900, this.ctx.currentTime, 0.1);
    } catch (e) {}
  }
  // Two-tone police siren while wanted >= 1; call every frame.
  siren(on) {
    if (!this.ctx || !this.master) return;
    try {
      if (on && !this.sirenOsc) {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'sine';
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0.035;
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.master);
        this.sirenOsc.start();
      }
      if (!on && this.sirenOsc) {
        this.sirenOsc.stop();
        this.sirenOsc = null;
        this.sirenGain = null;
        return;
      }
      if (this.sirenOsc) {
        const t = this.ctx.currentTime;
        this.sirenOsc.frequency.setValueAtTime(660, t);
        this.sirenOsc.frequency.linearRampToValueAtTime(880, t + 0.45);
        this.sirenOsc.frequency.linearRampToValueAtTime(660, t + 0.9);
      }
    } catch (e) {}
  }
}
