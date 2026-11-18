// Seeded randomness: the city, traffic, pedestrians and collectibles are
// all built from one seed, so every load — and every screenshot — sees the
// same Solmar Bay. Nothing in the game reads Math.random() for layout.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed) {
    this.next = mulberry32(seed);
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
  // A shuffled copy of a list (Fisher–Yates, driven by this seed).
  shuffle(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }
  // A value with a bell-ish spread around the middle, for natural variety.
  around(mid, spread) {
    return mid + (this.next() + this.next() - 1) * spread;
  }
  // A child generator derived from this one, so a subsystem (the crime
  // system) can draw its own deterministic stream without disturbing the
  // city layout's draws.
  fork(seed) {
    return new Rng((seed >>> 0) ^ Math.floor(this.next() * 0xffffffff));
  }
}
