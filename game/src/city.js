// The city model: roads, buildings, collision, day/night.
// Pure data + math, no THREE here — scene.js renders what this describes.
import { T, LANDMARKS, BUILDINGS } from './tuning.js';

export class City {
  constructor(rng) {
    this.rng = rng;
    this.dayFracV = 0.1; // 0..1, 0 = dawn, 0.5 = noon, 0.7 = night
    // Resolve buildings to world AABBs. A landmark building is centred 8
    // units north (-z) of its landmark point, so the point sits nearer the
    // south face — the door side.
    this.buildings = BUILDINGS.map((b) => {
      const cx = b.at ? LANDMARKS[b.at][0] : b.cx;
      const cz = b.at ? LANDMARKS[b.at][1] - 8 : b.cz;
      return {
        name: b.name,
        cx,
        cz,
        hx: b.hx,
        hz: b.hz,
        h: b.h,
        color: b.color,
        minX: cx - b.hx,
        maxX: cx + b.hx,
        minZ: cz - b.hz,
        maxZ: cz + b.hz,
      };
    });
    this.byName = {};
    for (const b of this.buildings) this.byName[b.name] = b;
    // Door of a landmark building: south face (+z) plus 3.
    this.doors = {};
    for (const name of Object.keys(LANDMARKS)) {
      const b = this.byName[name];
      if (!b) continue;
      this.doors[name] = { x: b.cx, z: b.maxZ + 3 };
    }
    // ATMs: one at the bank, one at the casino, one at the bar.
    this.atms = [
      { x: LANDMARKS.bank[0] + 20, z: LANDMARKS.bank[1] + 10 },
      { x: LANDMARKS.casino[0] - 22, z: LANDMARKS.casino[1] + 8 },
      { x: LANDMARKS.bar[0] + 18, z: LANDMARKS.bar[1] - 6 },
    ];
  }

  dayFrac() {
    return this.dayFracV;
  }

  setDayFrac(f) {
    this.dayFracV = ((f % 1) + 1) % 1;
    return this.nightness();
  }

  // 0 = full day, 1 = full night. Night is 0.6..0.95 of the day.
  nightness() {
    const f = this.dayFracV;
    if (f < 0.55) return 0;
    if (f < 0.65) return (f - 0.55) / 0.1;
    if (f < 0.9) return 1;
    if (f < 0.97) return 1 - (f - 0.9) / 0.07;
    return 0;
  }

  advance(dt) {
    this.dayFracV = (this.dayFracV + dt / T.dayLength) % 1;
  }

  // Circle (x, z, r) vs every building AABB. Returns the pushed-out
  // position; the caller keeps y = 0. Also reports whether it hit.
  resolveCollision(x, z, r) {
    let hit = false;
    for (const b of this.buildings) {
      const nx = Math.max(b.minX, Math.min(x, b.maxX));
      const nz = Math.max(b.minZ, Math.min(z, b.maxZ));
      const dx = x - nx;
      const dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      hit = true;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const push = (r - d) / d;
        x += dx * push;
        z += dz * push;
      } else {
        // Dead centre: push out the nearest face.
        const toMinX = x - (b.minX - r);
        const toMaxX = (b.maxX + r) - x;
        const toMinZ = z - (b.minZ - r);
        const toMaxZ = (b.maxZ + r) - z;
        const m = Math.min(toMinX, toMaxX, toMinZ, toMaxZ);
        if (m === toMinX) x = b.minX - r;
        else if (m === toMaxX) x = b.maxX + r;
        else if (m === toMinZ) z = b.minZ - r;
        else z = b.maxZ + r;
      }
    }
    return { x, z, hit };
  }

  insideAnyBuilding(x, z, r = 0) {
    for (const b of this.buildings) {
      if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) return true;
    }
    return false;
  }

  clampToMap(x, z) {
    const m = T.mapHalf - 4;
    return {
      x: Math.max(-m, Math.min(m, x)),
      z: Math.max(-m, Math.min(m, z)),
    };
  }

  // Nearest point on the road grid to (x, z).
  nearestRoadPoint(x, z) {
    const snap = (v) => Math.round(v / T.roadStep) * T.roadStep;
    return { x: snap(x), z: snap(z) };
  }

  // Is (x, z) on a road (within the road half-width of a grid line)?
  onRoad(x, z) {
    const rx = Math.abs(x - Math.round(x / T.roadStep) * T.roadStep);
    const rz = Math.abs(z - Math.round(z / T.roadStep) * T.roadStep);
    return rx <= T.roadHalf + 2 || rz <= T.roadHalf + 2;
  }

  district(x, z) {
    if (z > 150) return 'Marina';
    if (x < -100 && z > 0) return 'Docks';
    if (x > 100 && z < -100) return 'Northside';
    if (x > 100) return 'Downtown';
    if (z < -100) return 'Old Town';
    return 'Solmar Bay';
  }

  landmarkPos(name) {
    const p = LANDMARKS[name];
    return p ? { x: p[0], z: p[1] } : { x: 0, z: 0 };
  }

  doorPos(name) {
    return this.doors[name] || this.landmarkPos(name);
  }

  nearestAtm(x, z, maxDist = 8) {
    let best = null;
    let bestD = maxDist;
    for (const a of this.atms) {
      const d = Math.hypot(a.x - x, a.z - z);
      if (d < bestD) {
        best = a;
        bestD = d;
      }
    }
    return best;
  }
}
