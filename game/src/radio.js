// RadioSystem: 3 procedural Web Audio stations, no samples, no network.
// Each station is a step sequencer over a scale; the HUD shows the station name.
// Key R (or radio.next()) switches. Safe when audio is suspended: it just stays silent.
import { getAudio } from './audio.js';

export const STATIONS = [
  { name: 'SOLMAR FM', desc: 'synthwave', bpm: 112, wave: 'sawtooth', scale: [0, 3, 5, 7, 10], root: 110, bass: 55 },
  { name: 'VICE 88', desc: 'funk', bpm: 96, wave: 'square', scale: [0, 3, 5, 6, 10], root: 98, bass: 49 },
  { name: 'BAY TALK', desc: 'talk radio', bpm: 80, wave: 'triangle', scale: [0, 2, 4, 7, 9], root: 131, bass: 65 },
];

export function createRadio() {
  return {
    index: 0, timer: null, step: 0, gainNode: null,
    name() { return STATIONS[this.index].name; },
    next() {
      this.index = (this.index + 1) % STATIONS.length;
      this.step = 0;
      this.restart();
      return this.name();
    },
    start() { this.restart(); },
    stop() {
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
    },
    restart() {
      this.stop();
      const a = getAudio();
      if (!a) return;
      try {
        if (!this.gainNode) {
          this.gainNode = a.ctx.createGain();
          this.gainNode.gain.value = 0.12;
          this.gainNode.connect(a.master);
        }
        const st = STATIONS[this.index];
        const stepMs = 60000 / st.bpm / 2;
        this.timer = setInterval(() => this.playStep(a, st), stepMs);
      } catch { /* radio is best-effort */ }
    },
    playStep(a, st) {
      try {
        if (a.ctx.state === 'suspended') return;
        const t0 = a.ctx.currentTime;
        const s = this.step;
        this.step += 1;
        // Bass on beats 0 and 2 of each bar.
        if (s % 4 === 0 || s % 4 === 2) {
          const o = a.ctx.createOscillator();
          const g = a.ctx.createGain();
          o.type = 'sine';
          o.frequency.value = st.bass * (s % 8 === 4 ? 1.5 : 1);
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
          o.connect(g); g.connect(this.gainNode);
          o.start(t0); o.stop(t0 + 0.36);
        }
        // Melody: pentatonic walk, deterministic-ish from step.
        if (s % 2 === 0) {
          const deg = [0, 2, 1, 4, 3, 2, 4, 1][Math.floor(s / 2) % 8];
          const semi = st.scale[deg % st.scale.length] + 12 * Math.floor(deg / st.scale.length);
          const freq = st.root * Math.pow(2, semi / 12) * 2;
          const o = a.ctx.createOscillator();
          const g = a.ctx.createGain();
          o.type = st.wave;
          o.frequency.value = freq;
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.exponentialRampToValueAtTime(0.14, t0 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
          o.connect(g); g.connect(this.gainNode);
          o.start(t0); o.stop(t0 + 0.26);
        }
      } catch { /* ignore audio errors */ }
    },
  };
}
