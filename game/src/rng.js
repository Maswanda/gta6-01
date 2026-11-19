// rng.js — Solmar Bay: seeded dice for the whole city.
// Every random choice in the game flows through a Dice so a seed
// reproduces a layout, a traffic pattern or a crime roll exactly.
export class Dice {
  constructor(seed = 1337) {
    this.state = (seed >>> 0) || 1;
  }
  // mulberry32: small, fast, good enough for a game.
  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) {
    return a + (b - a) * this.next();
  }
  int(a, b) {
    return Math.floor(this.range(a, b + 1));
  }
  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }
  chance(p) {
    return this.next() < p;
  }
  // A stable hash of a string, for per-district seeds.
  static hashSeed(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
}

export function makeDice(seed) {
  return new Dice(seed);
}
