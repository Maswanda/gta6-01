// radio.js — RadioSystem: 3 procedural Web Audio stations, no samples, no
// network. The station name is in the HUD every frame; R cycles stations.
// Stations: SOLMAR 88.5 (sunny pop), BAY 101 (bass-heavy night drive),
// VICE FM 99.9 (talk + jingles). Each station is a tiny step sequencer.
export const STATIONS = [
  { name: 'SOLMAR 88.5', bpm: 112, root: 220, wave: 'triangle', mood: 'Sunny pop' },
  { name: 'BAY 101', bpm: 92, root: 110, wave: 'sawtooth', mood: 'Night drive bass' },
  { name: 'VICE FM 99.9', bpm: 128, root: 262, wave: 'square', mood: 'Talk + jingles' },
];

export class Radio {
  constructor(audio) {
    this.audio = audio;
    this.on = true;
    this.station = 0;
    this._step = 0;
    this._nextTime = 0;
    this._timer = null;
  }
  get name() { return STATIONS[this.station].name; }
  get state() { return { on: this.on, station: this.name }; }
  setStation(i) {
    this.station = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length;
    this._step = 0;
    this._blip();
    return this.name;
  }
  cycle() { return this.setStation(this.station + 1); }
  toggle() { this.on = !this.on; return this.on; }
  _blip() { try { this.audio.ensure(); this.audio.blip(1200); } catch {} }
  // Called every frame: schedules the current station's loop a bar ahead.
  update(dt) {
    if (!this.on) return;
    const st = STATIONS[this.station];
    const audio = this.audio;
    if (!audio.ctx) return;
    try {
      const now = audio.ctx.currentTime;
      if (this._nextTime < now) this._nextTime = now + 0.05;
      const stepDur = 60 / st.bpm / 2; // eighth notes
      while (this._nextTime < now + 0.25) {
        const s = this._step % 16;
        const t = this._nextTime;
        // Bass line: root on 0, 3, 6, 10, 12; fifth on 8.
        const bassNotes = { 0: 1, 3: 1, 6: 1, 8: 1.5, 10: 1, 12: 1.5 };
        if (bassNotes[s]) this._note(st.root * bassNotes[s], st.wave, stepDur * 1.8, 0.16, t);
        // Sparkle: pentatonic plucks on the off-beats.
        if (s % 4 === 2) this._note(st.root * 4 * [1, 1.2, 1.5, 1.8][(this._step >> 2) % 4], 'sine', stepDur, 0.07, t);
        // Hat tick every eighth on BAY 101.
        if (this.station === 1 && s % 2 === 1) this._hat(t);
        this._step++;
        this._nextTime += stepDur;
      }
    } catch { /* radio is cosmetic */ }
  }
  _note(freq, wave, dur, vol, t) {
    const audio = this.audio;
    if (!audio.ctx || !audio.master) return;
    const o = audio.ctx.createOscillator();
    const g = audio.ctx.createGain();
    o.type = wave; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(audio.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  _hat(t) {
    const audio = this.audio;
    if (!audio.ctx || !audio.master) return;
    const len = Math.floor(audio.ctx.sampleRate * 0.03);
    const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource(); src.buffer = buf;
    const f = audio.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
    const g = audio.ctx.createGain(); g.gain.value = 0.05;
    src.connect(f); f.connect(g); g.connect(audio.master);
    src.start(t);
  }
}
