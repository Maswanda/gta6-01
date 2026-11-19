// All sound is synthesised with WebAudio — no audio files, no network.
// v4 adds the helicopter's rotor chop and a station-change blip for the
// radio, on top of v2's wanted sting, pickup chime, car horn, tyre skid,
// door slam, race countdown beeps and low ambient pad, and the engine,
// siren, gunshots, punches and mission jingles.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
    this.rotorOsc = null;
    this.rotorGain = null;
    this.rotorTimer = 0;
    this.padOsc = null;
    this.padGain = null;
    this.enabled = true;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      // Engine: a low sawtooth whose pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const engineFilter = this.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      this.engineOsc.connect(engineFilter);
      engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      // Siren: a sine that alternates between two tones.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 780;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      // Ambient pad: two detuned triangles, very quiet, always on.
      this.padOsc = this.ctx.createOscillator();
      this.padOsc.type = 'triangle';
      this.padOsc.frequency.value = 110;
      const padOsc2 = this.ctx.createOscillator();
      padOsc2.type = 'triangle';
      padOsc2.frequency.value = 164.8;
      this.padGain = this.ctx.createGain();
      this.padGain.gain.value = 0.02;
      this.padOsc.connect(this.padGain);
      padOsc2.connect(this.padGain);
      this.padGain.connect(this.master);
      this.padOsc.start();
      padOsc2.start();
    } catch {
      this.ctx = null;
    }
  }

  engine(speed01, driving) {
    if (!this.ctx || !this.engineOsc) return;
    const target = driving ? 0.05 + speed01 * 0.11 : 0.0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    this.engineOsc.frequency.setTargetAtTime(52 + speed01 * 130, this.ctx.currentTime, 0.08);
  }

  siren(on, dt) {
    if (!this.ctx || !this.sirenOsc) return;
    if (!on) {
      this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      return;
    }
    this.sirenTimer += dt;
    const high = Math.floor(this.sirenTimer / 0.42) % 2 === 0;
    this.sirenOsc.frequency.setTargetAtTime(high ? 820 : 620, this.ctx.currentTime, 0.03);
    this.sirenGain.gain.setTargetAtTime(0.05, this.ctx.currentTime, 0.1);
  }

  // The helicopter's rotor: a low sawtooth thud that chops about twelve
  // times a second while the air unit is up, fading out when it leaves.
  rotor(on, dt) {
    if (!this.ctx) return;
    if (on && !this.rotorOsc) {
      this.rotorOsc = this.ctx.createOscillator();
      this.rotorOsc.type = 'sawtooth';
      this.rotorOsc.frequency.value = 27;
      this.rotorGain = this.ctx.createGain();
      this.rotorGain.gain.value = 0.0001;
      this.rotorOsc.connect(this.rotorGain);
      this.rotorGain.connect(this.master);
      this.rotorOsc.start();
      this.rotorTimer = 0;
    }
    if (!this.rotorOsc) return;
    const now = this.ctx.currentTime;
    if (on) {
      this.rotorTimer += dt;
      // The chop: the gain pulses up and down with the rotor's beat.
      const chop = 0.5 + 0.5 * Math.sin(this.rotorTimer * Math.PI * 2 * 12);
      this.rotorGain.gain.setTargetAtTime(0.02 + 0.03 * chop, now, 0.03);
    } else {
      this.rotorGain.gain.setTargetAtTime(0.0001, now, 0.1);
      const osc = this.rotorOsc;
      setTimeout(() => { try { osc.stop(); } catch (e) { /* already stopped */ } }, 600);
      this.rotorOsc = null;
      this.rotorGain = null;
    }
  }

  // A short two-note blip when the radio changes station.
  stationBlip() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const [offset, freq] of [[0, 880], [0.07, 1174.66]]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.08, now + offset + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.09);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now + offset);
      osc.stop(now + offset + 0.12);
    }
  }

  blip(freq, dur, type, vol) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol || 0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noiseBurst(dur, vol, lowpass) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass || 1800;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
  }

  shot() {
    this.noiseBurst(0.14, 0.5, 2600);
    this.blip(160, 0.08, 'square', 0.2);
  }

  punch() {
    this.noiseBurst(0.09, 0.35, 500);
  }

  crash() {
    this.noiseBurst(0.25, 0.4, 900);
  }

  skid() {
    this.noiseBurst(0.18, 0.16, 2400);
  }

  horn() {
    this.blip(370, 0.28, 'square', 0.22);
    this.blip(466, 0.28, 'square', 0.18);
  }

  door() {
    this.noiseBurst(0.08, 0.3, 700);
    this.blip(90, 0.1, 'sine', 0.3);
  }

  chime() {
    this.blip(880, 0.12, 'sine', 0.25);
    setTimeout(() => this.blip(1318, 0.18, 'sine', 0.22), 90);
  }

  pickup() {
    this.blip(1046, 0.1, 'triangle', 0.25);
    setTimeout(() => this.blip(1568, 0.16, 'triangle', 0.22), 80);
  }

  register() {
    // A cash-register cha-ching for a payout or a stopped crime.
    this.blip(1568, 0.07, 'square', 0.22);
    setTimeout(() => this.blip(2093, 0.12, 'square', 0.2), 70);
    setTimeout(() => this.blip(2637, 0.2, 'triangle', 0.22), 150);
  }

  heistSting() {
    // A low, dramatic hit when the heist kicks off.
    this.blip(110, 0.5, 'sawtooth', 0.22);
    this.blip(165, 0.5, 'sawtooth', 0.18);
    setTimeout(() => this.blip(220, 0.4, 'sawtooth', 0.2), 220);
  }

  sting() {
    // A short dramatic hit when the wanted level jumps.
    this.blip(220, 0.25, 'sawtooth', 0.2);
    this.blip(233, 0.25, 'sawtooth', 0.2);
    this.blip(110, 0.35, 'sawtooth', 0.18);
  }

  countdownBeep(final) {
    this.blip(final ? 880 : 440, final ? 0.3 : 0.14, 'square', 0.22);
  }

  jingle() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.22, 'triangle', 0.28), i * 110));
  }

  fanfare() {
    // A longer mission-complete fanfare.
    const notes = [523, 659, 784, 1046, 784, 1046, 1318];
    notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.24, 'triangle', 0.26), i * 120));
  }

  busted() {
    const notes = [392, 311, 233];
    notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.3, 'sawtooth', 0.18), i * 160));
  }
}
