// radio.js — Solmar Bay radio: three stations, all music synthesized
// live with WebAudio oscillators. No audio files, no streams.
// Each station has its own tempo, root note, waveform and bassline
// pattern, so switching stations is audible immediately.
import { TUNE } from './tuning.js';

const SCALES = {
  drive: [0, 3, 5, 7, 10],
  night: [0, 2, 3, 7, 8, 10],
  chill: [0, 2, 4, 7, 9],
};

export class Radio {
  constructor(audio) {
    this.audio = audio;
    this.on = true;
    this.station = 0;
    this._timer = null;
    this._step = 0;
    this._nextAt = 0;
    this._started = false;
  }
  get name() {
    return TUNE.stations[this.station].name;
  }
  state() {
    return { on: this.on, station: this.name };
  }
  setStation(i) {
    const n = TUNE.stations.length;
    this.station = ((i % n) + n) % n;
    this._step = 0;
    return this.name;
  }
  toggle() {
    this.on = !this.on;
    if (!this.on) this._stopLoop();
    else this._startLoop();
    return this.on;
  }
  start() {
    if (this._started) return;
    this._started = true;
    if (this.on) this._startLoop();
  }
  _startLoop() {
    this.audio.resume();
    if (this._timer) return;
    this._nextAt = 0;
    this._timer = setInterval(() => this._tick(), 60);
  }
  _stopLoop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }
  _tick() {
    if (!this.audio.ctx || !this.audio.master || !this.on) return;
    const now = this.audio.ctx.currentTime;
    if (this._nextAt < now) this._nextAt = now + 0.05;
    const st = TUNE.stations[this.station];
    const stepDur = 60 / st.tempo / 2;
    while (this._nextAt < now + 0.25) {
      this._scheduleStep(st, this._step, this._nextAt, stepDur);
      this._step++;
      this._nextAt += stepDur;
    }
  }
  _scheduleStep(st, step, t, stepDur) {
    const scale = SCALES[st.mood] || SCALES.drive;
    const bar = Math.floor(step / 8) % 4;
    const inBar = step % 8;
    const root = st.root;
    // Bass on beats 0 and 4, root or fifth.
    if (inBar === 0 || inBar === 4) {
      const note = root * (inBar === 4 && bar % 2 === 1 ? 1.5 : 1);
      this._note(note, t, stepDur * 1.8, st.wave, 0.16);
    }
    // Chord pad at bar start.
    if (inBar === 0) {
      const third = root * 2 * Math.pow(2, scale[1] / 12);
      const fifth = root * 2 * Math.pow(2, scale[2] / 12);
      this._note(third, t, stepDur * 7, 'sine', 0.05);
      this._note(fifth, t, stepDur * 7, 'sine', 0.05);
    }
    // Melody: pentatonic wander, denser on the night station.
    const density = st.mood === 'night' ? 0.6 : st.mood === 'drive' ? 0.45 : 0.3;
    if (((step * 2654435761) >>> 0) % 100 < density * 100) {
      const deg = ((step * 7 + bar * 3) % scale.length);
      const oct = 4 + ((step + bar) % 2);
      const freq = root * Math.pow(2, oct) * Math.pow(2, scale[deg] / 12);
      this._note(freq, t, stepDur * 0.9, st.wave, 0.07);
    }
    // Hat tick on off-beats for the drive station.
    if (st.mood === 'drive' && inBar % 2 === 1) {
      this._hat(t);
    }
  }
  _note(freq, t, dur, type, vol) {
    try {
      const o = this.audio.ctx.createOscillator();
      const g = this.audio.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(this.audio.master);
      o.start(t);
      o.stop(t + dur + 0.05);
    } catch (e) {}
  }
  _hat(t) {
    try {
      const len = Math.floor(this.audio.ctx.sampleRate * 0.03);
      const buf = this.audio.ctx.createBuffer(1, len, this.audio.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.audio.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.audio.ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 6000;
      const g = this.audio.ctx.createGain();
      g.gain.value = 0.05;
      src.connect(f);
      f.connect(g);
      g.connect(this.audio.master);
      src.start(t);
    } catch (e) {}
  }
}
