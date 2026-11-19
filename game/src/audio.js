// audio.js — Solmar Bay: every sound effect, synthesized live in WebAudio.
// No audio files: the whole soundtrack is oscillators and filtered noise,
// so the game stays 100% self-contained. The context is created lazily
// on the first user gesture (browsers block audio before one).
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOn = false;
    this.sirenTimer = null;
  }
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }
  unlock() {
    this.ensure();
  }
  tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null) {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo !== null) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  noise(dur, vol = 0.3, lowpass = 3000) {
    if (!this.ensure()) return;
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
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
  }
  shot() {
    this.noise(0.12, 0.35, 2200);
    this.tone(180, 0.08, 'square', 0.12, 60);
  }
  explosion() {
    this.noise(0.7, 0.5, 900);
    this.tone(90, 0.6, 'sine', 0.3, 30);
  }
  pickup() {
    this.tone(660, 0.09, 'sine', 0.18);
    this.tone(990, 0.14, 'sine', 0.18);
  }
  click() {
    this.tone(1200, 0.04, 'square', 0.08);
  }
  denied() {
    this.tone(160, 0.18, 'square', 0.12, 110);
  }
  cash() {
    this.tone(880, 0.08, 'triangle', 0.16);
    this.tone(1320, 0.12, 'triangle', 0.16);
  }
  // A two-tone police siren, toggled on/off.
  setSiren(on) {
    if (on === this.sirenOn) return;
    this.sirenOn = on;
    if (!on) {
      if (this.sirenTimer) clearInterval(this.sirenTimer);
      this.sirenTimer = null;
      return;
    }
    if (!this.ensure()) return;
    let high = true;
    this.sirenTimer = setInterval(() => {
      if (!this.sirenOn) return;
      this.tone(high ? 950 : 700, 0.32, 'triangle', 0.045);
      high = !high;
    }, 340);
  }
  // A continuous engine hum whose pitch follows speed (0..1).
  setEngine(speed01) {
    if (!this.ensure()) return;
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 900;
      this.engineOsc.connect(f);
      f.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, t, 0.08);
    this.engineGain.gain.setTargetAtTime(speed01 > 0.02 ? 0.05 + speed01 * 0.05 : 0.0, t, 0.1);
  }
}
