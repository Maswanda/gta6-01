// rng.js — small deterministic RNG (mulberry32) so the city, traffic and
// peds are identical for a given seed. Seeded from the ?seed= URL param.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    range(lo, hi) { return lo + next() * (hi - lo); },
    int(lo, hi) { return Math.floor(lo + next() * (hi - lo + 1)); },
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    chance(p) { return next() < p; },
  };
}

export function seedFromUrl() {
  try {
    const m = /[?&]seed=(\d+)/.exec(location.search);
    if (m) return parseInt(m[1], 10) >>> 0;
  } catch { /* no location in some harnesses */ }
  return 11;
}
