// Procedural Web Audio: no samples, no network. One shared AudioContext + master gain.
// Every sound is a tiny oscillator/noise envelope. Safe when audio is suspended.
let ctx = null;
let master = null;

export function getAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return { ctx, master };
  } catch {
    return null;
  }
}

function env(gainNode, t0, peak, dur) {
  gainNode.gain.setValueAtTime(0.0001, t0);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + 0.012);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
}

export function blip(freq, dur = 0.12, type = 'sine', vol = 0.25) {
  const a = getAudio();
  if (!a) return;
  try {
    const t0 = a.ctx.currentTime;
    const o = a.ctx.createOscillator();
    const g = a.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    env(g, t0, vol, dur);
    o.connect(g); g.connect(a.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  } catch { /* audio is best-effort */ }
}

export function noiseBurst(dur = 0.2, vol = 0.3, lowpass = 1200) {
  const a = getAudio();
  if (!a) return;
  try {
    const t0 = a.ctx.currentTime;
    const len = Math.max(1, Math.floor(a.ctx.sampleRate * dur));
    const buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.ctx.createBufferSource();
    src.buffer = buf;
    const f = a.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = lowpass;
    const g = a.ctx.createGain();
    env(g, t0, vol, dur);
    src.connect(f); f.connect(g); g.connect(a.master);
    src.start(t0);
  } catch { /* audio is best-effort */ }
}

export const sfx = {
  shot() { noiseBurst(0.14, 0.5, 2600); blip(160, 0.08, 'square', 0.2); },
  shotgun() { noiseBurst(0.3, 0.65, 1500); blip(90, 0.16, 'square', 0.25); },
  hit() { blip(220, 0.07, 'triangle', 0.2); },
  cash() { blip(880, 0.09, 'sine', 0.25); setTimeout(() => blip(1320, 0.12, 'sine', 0.25), 90); },
  mission() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.28), i * 110)); },
  busted() { blip(320, 0.4, 'sawtooth', 0.2); setTimeout(() => blip(240, 0.5, 'sawtooth', 0.2), 200); },
  sirenBlip() { blip(950, 0.18, 'sine', 0.08); },
  pickup() { blip(660, 0.1, 'sine', 0.22); },
  engineStart() { blip(70, 0.3, 'sawtooth', 0.15); },
};
