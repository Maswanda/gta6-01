// Seeded randomness for the whole city. The layout, the traffic, the
// pedestrians, the collectibles and the garage's daily deal all draw from
// one seed, so every load — and every screenshot — opens on the same Solmar
// Bay. Layout code never touches Math.random().

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
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

  // One entry from a { item, weight } list, in proportion to its weight.
  // The garage draws its daily deal this way.
  weightedPick(entries) {
    let total = 0;
    for (const e of entries) total += e.weight;
    let roll = this.next() * total;
    for (const e of entries) {
      roll -= e.weight;
      if (roll <= 0) return e.item;
    }
    return entries[entries.length - 1].item;
  }

  // A shuffled copy — Fisher-Yates, driven by this seed.
  shuffle(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
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

  // A child generator off this one, so a subsystem (the crime system) can
  // draw its own deterministic stream without disturbing the city layout.
  fork(seed) {
    return new Rng((seed >>> 0) ^ Math.floor(this.next() * 0xffffffff));
  }
}
