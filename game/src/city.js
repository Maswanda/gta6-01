// city.js — Solmar Bay: a seeded road-grid city. Roads run at multiples of
// 52 across -312..312; buildings fill the blocks between roads but never
// cover a landmark or a mission target, so every goto point is reachable by
// car. Also owns the day/night clock (240 s per day) and the ATM list.
import { T, LM, districtAt, dist, clamp } from './tuning.js';
import { makeRng } from './rng.js';

export const ATM_SPOTS = [
  [26, -52], [-52, 26], [104, 52], [-104, -52],
  [156, 156], [-156, 156], [52, -104], [-52, -208],
];

export class City {
  constructor(seed) {
    this.seed = seed;
    this.rng = makeRng(seed);
    this._dayFrac = 0.12; // morning light at boot
    this.buildings = [];
    this.palms = [];
    this._buildCity();
    // ATMs: {x, z, cooldown} — cooldown in game seconds.
    this.atms = ATM_SPOTS.map(([x, z]) => ({ x, z, cooldown: 0 }));
  }
  _buildCity() {
    const rng = this.rng;
    const step = T.roadStep;
    const half = T.worldHalf;
    // Blocks between roads: block centers sit halfway between road lines.
    for (let bx = -half + step / 2; bx < half; bx += step) {
      for (let bz = -half + step / 2; bz < half; bz += step) {
        // Keep the marina water strip clear (north edge) and the pier clear.
        if (bz > 260) continue;
        // Never build on a landmark / mission target.
        let clear = true;
        for (const k of Object.keys(LM)) {
          const [lx, lz] = LM[k];
          if (dist(bx, bz, lx, lz) < 34) { clear = false; break; }
        }
        if (!clear) continue;
        // Never build on an ATM.
        for (const [ax, az] of ATM_SPOTS) {
          if (dist(bx, bz, ax, az) < 26) { clear = false; break; }
        }
        if (!clear) continue;
        // 1-3 buildings per block, seeded.
        const n = rng.int(1, 3);
        for (let i = 0; i < n; i++) {
          const ox = rng.range(-14, 14), oz = rng.range(-14, 14);
          const w = rng.range(10, 20), d = rng.range(10, 20);
          const h = rng.range(8, 42);
          const x = bx + ox, z = bz + oz;
          // Keep buildings off the roads (road half-width 7 + margin).
          const nearRoadX = Math.abs(((x + half) % step) - step / 2) < step / 2 - 9;
          const nearRoadZ = Math.abs(((z + half) % step) - step / 2) < step / 2 - 9;
          if (!nearRoadX || !nearRoadZ) continue;
          this.buildings.push({
            x, z, w, d, h,
            color: this._buildingColor(x, z),
            lit: rng.chance(0.5),
          });
        }
        // Palms along the block edges.
        if (rng.chance(0.6)) {
          this.palms.push({ x: bx + rng.range(-20, 20), z: bz + rng.range(-20, 20) });
        }
      }
    }
  }
  _buildingColor(x, z) {
    const d = districtAt(x, z);
    const palette = {
      'Marina': [0xffe8c9, 0xfff3e0, 0xffd9a0],
      'Vice Beach': [0xffd1dc, 0xc9f2ff, 0xfff1a8],
      'Downtown': [0x9fb4c7, 0xb8c4cc, 0x8fa3b5],
      'Little Havana': [0xffb36b, 0xff8f5e, 0xffd166],
    };
    const arr = palette[d] || palette['Downtown'];
    return arr[Math.abs(Math.floor(x * 7 + z * 13)) % arr.length];
  }
  // Day/night. dayFrac 0 = sunrise, 0.5 = sunset; night is 0.55..1.0.
  dayFrac() { return this._dayFrac; }
  nightness() {
    const f = this._dayFrac;
    const dusk = clamp((f - 0.55) / 0.1, 0, 1);
    const dawn = 1 - clamp((f - 0.95) / 0.05, 0, 1);
    return Math.min(dusk, dawn);
  }
  setDayFrac(f) {
    this._dayFrac = ((f % 1) + 1) % 1;
    return this.nightness();
  }
  update(dt) {
    this._dayFrac = (this._dayFrac + dt / T.dayLengthSec) % 1;
    for (const a of this.atms) if (a.cooldown > 0) a.cooldown -= dt;
  }
  nearestAtm(x, z, skipCooldown) {
    let best = null, bestD = Infinity;
    for (const a of this.atms) {
      if (skipCooldown && a.cooldown > 0) continue;
      const d = dist(x, z, a.x, a.z);
      if (d < bestD) { best = a; bestD = d; }
    }
    return best ? { atm: best, d: bestD } : null;
  }
  // Is (x,z) inside a building footprint (for collision)?
  buildingAt(x, z) {
    for (const b of this.buildings) {
      if (Math.abs(x - b.x) < b.w / 2 + 1 && Math.abs(z - b.z) < b.d / 2 + 1) return b;
    }
    return null;
  }
  clampToWorld(x, z) {
    return [clamp(x, -T.worldHalf, T.worldHalf), clamp(z, -T.worldHalf, T.worldHalf)];
  }
}
