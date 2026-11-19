// RadioSystem — three procedural radio stations, all synthesized live with
// the Web Audio API. No audio files, no network, nothing to download: a
// tiny 16-step sequencer plays bass, lead and hats from each station's own
// pattern table, and the current station's name sits in the HUD in every
// frame. V cycles stations; the radio starts when a run starts and stops
// when the player goes back to the menu.
import { CFG } from './config.js';

const LOOKAHEAD = 0.18; // seconds of music scheduled ahead of the playhead

export const STATIONS = [
  {
    name: 'SOLMAR 88.5 — Sunset Drive', bpm: 92, bassWave: 'triangle', leadWave: 'sine',
    bass: [110, 0, 0, 110, 130.8, 0, 110, 0, 164.8, 0, 0, 164.8, 196, 0, 164.8, 0],
    lead: [440, 0, 523.25, 0, 659.25, 0, 523.25, 0, 587.33, 0, 659.25, 0, 783.99, 0, 659.25, 0],
    hats: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1],
  },
  {
    name: 'BAY 101 — Heatwave Rock', bpm: 128, bassWave: 'square', leadWave: 'sawtooth',
    bass: [82.4, 82.4, 0, 82.4, 98, 0, 82.4, 0, 110, 110, 0, 110, 123.47, 0, 110, 0],
    lead: [329.63, 0, 0, 329.63, 0, 392, 0, 329.63, 440, 0, 0, 440, 0, 493.88, 0, 392],
    hats: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  },
  {
    name: 'MARINA 94.3 — Night Jazz', bpm: 76, bassWave: 'sine', leadWave: 'triangle',
    bass: [130.81, 0, 0, 0, 164.81, 0, 0, 0, 196, 0, 0, 0, 246.94, 0, 196, 0],
    lead: [523.25, 0, 659.25, 0, 0, 783.99, 0, 659.25, 587.33, 0, 659.25, 0, 0, 523.25, 0, 0],
    hats: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
  },
];

export class RadioSystem {
  constructor(sound) {
    this.sound = sound;
    this.index = 0;
    this.on = false;
    this.step = 0;
    this.nextStepTime = 0;
  }

  station() {
    return STATIONS[this.index];
  }

  stationName() {
    return this.station().name;
  }

  start() {
    if (this.on) return;
    this.on = true;
    this.sound.ensure();
    const ctx = this.sound.ctx;
    if (ctx) this.nextStepTime = ctx.currentTime + 0.1;
  }

  stop() {
    this.on = false;
  }

  // Cycle to the next station and tell the player which one is playing.
  cycle(world) {
    if (!this.on) this.start();
    this.index = (this.index + 1) % STATIONS.length;
    this.sound.ensure();
    const ctx = this.sound.ctx;
    if (ctx) this.nextStepTime = ctx.currentTime + 0.05;
    this.step = 0;
    this.announce(world);
  }

  // Flash the new station's name and blip — the player should never have
  // to guess what just started playing.
  announce(world) {
    if (!world) return;
    world.hud.flashMessage(`♪ ${this.stationName()}`);
    world.sound.stationBlip();
  }

  // One scheduled note: a short oscillator blip with a quick decay, mixed
  // quietly under the game's sound effects.
  noteAt(freq, time, dur, wave, vol) {
    const ctx = this.sound.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, time);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(vol, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(gain);
    gain.connect(this.sound.master);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  // A hat is a burst of filtered noise, kept very short and quiet.
  hatAt(time, vol) {
    const ctx = this.sound.ctx;
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * 0.04);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sound.master);
    src.start(time);
  }

  update() {
    if (!this.on) return;
    const ctx = this.sound.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const st = this.station();
    const stepDur = 60 / st.bpm / 4;
    while (this.nextStepTime < ctx.currentTime + LOOKAHEAD) {
      const s = this.step % 16;
      const t = this.nextStepTime;
      if (st.bass[s]) this.noteAt(st.bass[s], t, stepDur * 1.8, st.bassWave, CFG.radioVolume * 0.9);
      if (st.lead[s]) this.noteAt(st.lead[s], t, stepDur * 1.4, st.leadWave, CFG.radioVolume * 0.55);
      if (st.hats[s]) this.hatAt(t, CFG.radioVolume * 0.4);
      this.step += 1;
      this.nextStepTime += stepDur;
    }
  }
}
