// rng.js — Seeded random number generator for Solmar Bay.
// Deterministic: the same seed always produces the same sequence.
// Used for city layout, traffic spawns and the ?shot= scenes.
export class SeededRandom {
  constructor(seed = 11) {
    this.seed = seed >>> 0;
  }
  next() {
    // mulberry32 — small, fast, well distributed.
    this.seed = (this.seed + 0x6d2b79f5) >>> 0;
    let t = this.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min, max) {
    return min + this.next() * (max - min);
  }
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }
  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }
  chance(p) {
    return this.next() < p;
  }
}
