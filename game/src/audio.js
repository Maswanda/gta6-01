// Procedural audio: everything is synthesized with WebAudio, no samples,
// no network. All entry points are guarded so a missing AudioContext (or a
// headless run) can never throw into the game loop.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.radioGain = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.radioTimer = null;
    this.radioStep = 0;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      this.radioGain = this.ctx.createGain();
      this.radioGain.gain.value = 0.16;
      this.radioGain.connect(this.master);
      return true;
    } catch {
      return false;
    }
  }

  resume() {
    try {
      if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
    } catch { /* audio is decorative */ }
  }

  // A short blip: square osc with a fast decay envelope.
  blip(freq, dur = 0.08, type = 'square', vol = 0.2) {
    if (!this.ensure()) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch { /* ignore */ }
  }

  shot() {
    if (!this.ensure()) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * 0.09);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = 0.5;
      src.connect(g);
      g.connect(this.master);
      src.start(t);
    } catch { /* ignore */ }
  }

  // Engine drone: one sawtooth whose pitch follows speed.
  engine(speedNorm) {
    if (!this.ensure()) return;
    try {
      if (!this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineGain = this.ctx.createGain();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 50;
        this.engineGain.gain.value = 0;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 400;
        this.engineOsc.connect(f);
        f.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
      }
      const t = this.ctx.currentTime;
      this.engineOsc.frequency.setTargetAtTime(45 + speedNorm * 120, t, 0.05);
      this.engineGain.gain.setTargetAtTime(speedNorm > 0.02 ? 0.05 + speedNorm * 0.06 : 0, t, 0.1);
    } catch { /* ignore */ }
  }

  // Radio: a looping bassline per station, stepped on a timer.
  startRadio(station) {
    this.stopRadio();
    if (!this.ensure() || !station) return;
    const stepMs = 260;
    this.radioStep = 0;
    this.radioTimer = setInterval(() => {
      if (this.muted) return;
      try {
        const semis = station.pattern[this.radioStep % station.pattern.length];
        const freq = station.base * Math.pow(2, semis / 12);
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + stepMs / 1000);
        o.connect(g);
        g.connect(this.radioGain);
        o.start(t);
        o.stop(t + stepMs / 1000 + 0.02);
        this.radioStep++;
      } catch { /* ignore */ }
    }, stepMs);
  }

  stopRadio() {
    if (this.radioTimer) {
      clearInterval(this.radioTimer);
      this.radioTimer = null;
    }
  }
}
