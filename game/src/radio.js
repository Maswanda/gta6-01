// radio.js — Solmar Bay: three procedural radio stations, no audio files.
// A tiny step sequencer plays a bassline and a melody per station with
// WebAudio oscillators. V switches station, the HUD shows the name.
// If the browser has no audio (headless), the deck still tracks the
// station so the game and the HUD keep working.
import { TUNE } from './tuning.js';

const SCALES = {
  chill: [0, 3, 5, 7, 10],
  drive: [0, 2, 3, 7, 8],
  night: [0, 2, 5, 7, 10],
};
const ROOTS = { chill: 110, drive: 98, night: 82 };

export class RadioDeck {
  constructor() {
    this.index = 0;
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.playing = false;
  }
  get station() {
    return TUNE.radio.stations[this.index];
  }
  get stationName() {
    return this.station.name;
  }
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.14;
      this.master.connect(this.ctx.destination);
      this.start();
    } catch {
      // No audio: the deck still tracks the station.
    }
  }
  start() {
    if (this.playing || !this.ctx) return;
    this.playing = true;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 90);
  }
  stop() {
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
  setMuted(m) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.14, this.ctx.currentTime, 0.05);
  }
  next() {
    this.index = (this.index + 1) % TUNE.radio.stations.length;
    this.step = 0;
    return this.stationName;
  }
  prev() {
    this.index = (this.index - 1 + TUNE.radio.stations.length) % TUNE.radio.stations.length;
    this.step = 0;
    return this.stationName;
  }
  schedule() {
    if (!this.ctx || !this.playing) return;
    const st = this.station;
    const spb = 60 / st.bpm / 4; // 16th notes
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      const s = this.step % 16;
      const bar = Math.floor(this.step / 16);
      const scale = SCALES[st.mood];
      const root = ROOTS[st.mood];
      // Bass on beats 0, 4, 8, 12 (and a pickup on 14 for drive).
      if (s % 4 === 0 || (st.mood === 'drive' && s === 14)) {
        const deg = scale[(bar + (s === 0 ? 0 : 1)) % scale.length];
        this.note(root * Math.pow(2, deg / 12), spb * 3.2, st.wave, 0.5);
      }
      // Sparse melody: a note every few steps, deterministic by step+bar.
      const melSeed = (bar * 16 + s) % 7;
      if (s % 2 === 0 && melSeed < 3) {
        const deg = scale[(bar * 3 + s) % scale.length] + 12;
        this.note(root * Math.pow(2, deg / 12), spb * 1.8, 'triangle', 0.16);
      }
      // Hat tick on off-beats for drive/night.
      if (st.mood !== 'chill' && s % 2 === 1) {
        this.note(6000, 0.02, 'square', 0.02);
      }
      this.nextTime += spb;
      this.step++;
    }
  }
  note(freq, dur, type, vol) {
    if (!this.ctx) return;
    const t = this.nextTime;
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
  }
}
