// city.js — The layout of Solmar Bay: road grid, building blocks,
// districts, landmarks, props and the day/night clock.
// Pure data + geometry math; the three.js meshes live in scene.js.
import { SeededRandom } from './rng.js';
import { TUNE, districtAt, nightnessAt, clamp } from './tuning.js';

export class City {
  constructor(seed = 11) {
    this.rng = new SeededRandom(seed);
    this.half = TUNE.cityHalf;
    this.spacing = TUNE.roadSpacing;
    this.roadWidth = TUNE.roadWidth;
    this._dayFrac = TUNE.startDayFrac;
    this.buildings = [];
    this.colliders = [];
    this.palms = [];
    this.lamps = [];
    this.containers = [];
    this.cranes = [];
    this.boats = [];
    this.roads = [];
    this._buildRoads();
    this._buildBlocks();
    this._buildProps();
    this._buildLandmarkColliders();
  }
  _buildRoads() {
    for (let i = -6; i <= 6; i++) {
      const c = i * this.spacing;
      this.roads.push({ axis: 'x', at: c });
      this.roads.push({ axis: 'z', at: c });
    }
  }
  _buildBlocks() {
    const rng = this.rng;
    const keepOut = [];
    for (const lm of Object.values(TUNE.landmarks)) keepOut.push({ x: lm.x, z: lm.z, r: 20 });
    for (const cp of TUNE.raceCheckpoints) keepOut.push({ x: cp.x, z: cp.z, r: 14 });
    for (const c of TUNE.collectibles) keepOut.push({ x: c.x, z: c.z, r: 10 });
    keepOut.push({ x: 0, z: 0, r: 16 });
    for (let bx = -5; bx <= 5; bx++) {
      for (let bz = -5; bz <= 5; bz++) {
        const cx = bx * this.spacing + this.spacing / 2;
        const cz = bz * this.spacing + this.spacing / 2;
        // The marina basin and the beach strip stay open.
        if (cz > 200 && cx > -40 && cx < 140) continue;
        if (cz > 272) continue;
        if (keepOut.some((k) => Math.hypot(cx - k.x, cz - k.z) < k.r + 14)) continue;
        const d = districtAt(cx, cz);
        const downtown = d.name === 'Downtown';
        const n = downtown ? (rng.chance(0.4) ? 2 : 1) : (rng.chance(0.55) ? 2 : 1);
        for (let i = 0; i < n; i++) {
          const ox = n === 1 ? 0 : (i === 0 ? -11 : 11);
          const oz = n === 1 ? 0 : (i === 0 ? 9 : -9);
          const w = rng.range(12, 24);
          const dep = rng.range(12, 22);
          const h = downtown
            ? rng.range(24, 68)
            : d.name === 'Old Town'
              ? rng.range(8, 18)
              : rng.range(10, 30);
          const x = cx + ox;
          const z = cz + oz;
          if (keepOut.some((k) => Math.hypot(x - k.x, z - k.z) < k.r + 10)) continue;
          const shade = rng.range(0.85, 1.15);
          const base = d.tint;
          const r = Math.min(255, Math.round(((base >> 16) & 255) * shade));
          const g = Math.min(255, Math.round(((base >> 8) & 255) * shade));
          const b = Math.min(255, Math.round((base & 255) * shade));
          const color = (r << 16) | (g << 8) | b;
          this.buildings.push({ x, z, w, d: dep, h, color, district: d.name });
          this.colliders.push({ x0: x - w / 2, z0: z - dep / 2, x1: x + w / 2, z1: z + dep / 2 });
        }
      }
    }
  }
  _buildProps() {
    const rng = this.rng;
    // Palm trees along the beach strip and the marina walk.
    for (let i = 0; i < 46; i++) {
      const x = rng.range(-300, 300);
      const z = rng.range(276, 294);
      if (Math.hypot(x - -60, z - 300) < 18) continue;
      this.palms.push({ x, z, h: rng.range(5, 8), lean: rng.range(-0.12, 0.12) });
    }
    for (let i = 0; i < 18; i++) {
      this.palms.push({ x: rng.range(-20, 130), z: rng.range(210, 240), h: rng.range(5, 7), lean: rng.range(-0.1, 0.1) });
    }
    // Street lamps on road corners.
    for (let i = -5; i <= 5; i += 2) {
      for (let j = -5; j <= 5; j += 2) {
        this.lamps.push({ x: i * this.spacing + 8, z: j * this.spacing + 8 });
        this.lamps.push({ x: i * this.spacing - 8, z: j * this.spacing - 8 });
      }
    }
    // Freight containers at the docks.
    const cols = [0xc0392b, 0x2e86c1, 0x28b463, 0xd4ac0d, 0x7d3c98];
    for (let i = 0; i < 14; i++) {
      const x = -248 + (i % 7) * 12;
      const z = 20 + Math.floor(i / 7) * 14;
      this.containers.push({ x, z, color: cols[i % cols.length], rot: rng.chance(0.3) ? Math.PI / 2 : 0 });
      this.colliders.push({ x0: x - 6, z0: z - 2.5, x1: x + 6, z1: z + 2.5 });
    }
    // Two gantry cranes over the docks.
    this.cranes.push({ x: -230, z: 60 });
    this.cranes.push({ x: -230, z: 30 });
    // Boats moored in the marina basin.
    for (let i = 0; i < 7; i++) {
      this.boats.push({ x: -10 + i * 18, z: 214 + (i % 2) * 12, len: rng.range(7, 11), color: [0xffffff, 0xe74c3c, 0x3498db, 0xf1c40f][i % 4] });
    }
  }
  _buildLandmarkColliders() {
    // Each landmark building gets a simple AABB so the player and cars
    // cannot drive through it. The landmark point itself stays clear.
    const L = TUNE.landmarks;
    const add = (lm, w, d, ox = 0, oz = 0) => {
      this.colliders.push({ x0: lm.x + ox - w / 2, z0: lm.z + oz - d / 2, x1: lm.x + ox + w / 2, z1: lm.z + oz + d / 2 });
    };
    add(L.garage, 26, 14, 0, -12);
    add(L.warehouse, 30, 18, 0, -14);
    add(L.bar, 14, 10, 0, -8);
    add(L.bank, 22, 16, 0, -10);
    add(L.safehouse, 12, 10, 0, -8);
    add(L.casino, 30, 18, 0, -12);
    add(L.clockTower, 10, 10, 0, -6);
    // Pier hut and marina office.
    this.colliders.push({ x0: -72, z0: 292, x1: -48, z1: 300 });
  }
  // ---- clock ----
  advance(dt) {
    this._dayFrac = (this._dayFrac + dt / TUNE.dayLengthSec) % 1;
  }
  setDayFrac(f) {
    this._dayFrac = ((f % 1) + 1) % 1;
    return this.nightness();
  }
  dayFrac() {
    return this._dayFrac;
  }

  nightness() {
    return nightnessAt(this._dayFrac);
  }
  // ---- queries ----
  onRoad(x, z) {
    const w = this.roadWidth / 2 + 1;
    for (const r of this.roads) {
      if (r.axis === 'x' && Math.abs(x - r.at) <= w) return true;
      if (r.axis === 'z' && Math.abs(z - r.at) <= w) return true;
    }
    return false;
  }
  inBounds(x, z) {
    return Math.abs(x) <= this.half + 8 && Math.abs(z) <= this.half + 8;
  }
  // Circle (radius r) vs AABB colliders. Returns corrected position.
  resolveCircle(x, z, r) {
    let nx = x;
    let nz = z;
    for (const c of this.colliders) {
      const cx = clamp(nx, c.x0, c.x1);
      const cz = clamp(nz, c.z0, c.z1);
      const dx = nx - cx;
      const dz = nz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          nx = cx + (dx / d) * r;
          nz = cz + (dz / d) * r;
        } else {
          // Inside the box: push out along the smallest penetration axis.
          const pl = nx - (c.x0 - r);
          const pr = c.x1 + r - nx;
          const pt = nz - (c.z0 - r);
          const pb = c.z1 + r - nz;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) nx = c.x0 - r;
          else if (m === pr) nx = c.x1 + r;
          else if (m === pt) nz = c.z0 - r;
          else nz = c.z1 + r;
        }
      }
    }
    return { x: nx, z: nz };
  }
  hitsBuilding(x, z, r) {
    for (const c of this.colliders) {
      const cx = clamp(x, c.x0, c.x1);
      const cz = clamp(z, c.z0, c.z1);
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }
  // Random point on a road, for traffic and spawns.
  randomRoadPoint() {
    const rng = this.rng;
    const horizontal = rng.chance(0.5);
    const line = Math.floor(rng.range(-6, 7)) * this.spacing;
    const along = rng.range(-300, 300);
    return horizontal ? { x: along, z: line } : { x: line, z: along };
  }
}
