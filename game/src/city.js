// Solmar Bay city model: 4 districts on an 800x800 plane, a 100-unit road grid,
// deterministic buildings (seeded), landmarks, ATMs. Pure data + geometry helpers.
// No rendering here — scene.js draws this.
import { WORLD_HALF } from './tuning.js';
import { createRng } from './rng.js';

export const DISTRICTS = [
  { name: 'Marina', x0: -400, z0: -400, x1: 0, z1: 0, color: '#2e6f8e', ground: '#3d5a4a' },
  { name: 'Vice Beach', x0: 0, z0: -400, x1: 400, z1: 0, color: '#c98a4a', ground: '#c2a878' },
  { name: 'Downtown', x0: -400, z0: 0, x1: 0, z1: 400, color: '#4a5a7a', ground: '#555560' },
  { name: 'Little Havana', x0: 0, z0: 0, x1: 400, z1: 400, color: '#8e6a3a', ground: '#6a5a4a' },
];

export const LANDMARKS = {
  garage: { name: "Rico's Garage", x: -150, z: -150, label: 'GARAGE' },
  safehouse: { name: 'Mara Safehouse', x: 150, z: 150, label: 'SAFEHOUSE' },
  hospital: { name: 'Solmar General', x: -250, z: 250, label: 'HOSPITAL' },
  policeHq: { name: 'Solmar PD HQ', x: 250, z: -250, label: 'POLICE HQ' },
  marina: { name: 'Marina Pier', x: -320, z: -320, label: 'MARINA' },
  beach: { name: 'Vice Beach', x: 320, z: -320, label: 'BEACH' },
  plaza: { name: 'Calle Ocho Plaza', x: 250, z: 250, label: 'PLAZA' },
  tower: { name: 'Solmar Tower', x: -50, z: 50, label: 'TOWER' },
};

const ATM_SPOTS = [
  [-350, -250], [-50, -350], [150, -150], [350, -50],
  [-250, 50], [-50, 150], [150, 350], [350, 250],
];

export function createCity(seed) {
  const rng = createRng(seed);
  const buildings = [];
  // One block = 100x100 between roads (roads at multiples of 100, width 14).
  // A building sits inside its block with a margin, so roads stay clear.
  for (let bx = -4; bx < 4; bx += 1) {
    for (let bz = -4; bz < 4; bz += 1) {
      const cx = bx * 100 + 50;
      const cz = bz * 100 + 50;
      // Landmark blocks stay open (plaza / pier / beach / garage yard).
      if (isNearLandmark(cx, cz)) continue;
      if (rng.chance(0.14)) continue; // empty lot / park
      const n = rng.int(1, 2);
      for (let i = 0; i < n; i += 1) {
        const w = rng.range(18, 34);
        const d = rng.range(18, 34);
        const ox = n === 1 ? 0 : (i === 0 ? -20 : 20);
        const oz = n === 1 ? 0 : (i === 0 ? -18 : 18);
        const h = rng.chance(0.12) ? rng.range(45, 70) : rng.range(10, 32);
        buildings.push({
          x: cx + ox, z: cz + oz, w, d, h,
          color: pickBuildingColor(rng),
        });
      }
    }
  }
  const atms = ATM_SPOTS.map(([x, z], i) => ({ id: i, x, z, cooldownUntil: 0 }));
  return { seed, buildings, atms, landmarks: LANDMARKS, districts: DISTRICTS };
}

function isNearLandmark(x, z) {
  for (const key of Object.keys(LANDMARKS)) {
    const lm = LANDMARKS[key];
    if (Math.abs(x - lm.x) < 55 && Math.abs(z - lm.z) < 55) return true;
  }
  return false;
}

function pickBuildingColor(rng) {
  const palette = [0x8a7a6a, 0x6a7a8a, 0x9a8a7a, 0x7a6a8a, 0xa89080, 0x5a6a7a, 0x8a9a7a, 0xb0a090];
  return palette[Math.floor(rng.next() * palette.length)];
}

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.name;
  }
  return 'Solmar Bay';
}

export function isOnRoad(x, z) {
  const rx = Math.abs(((x + 400) % 100) - 50);
  const rz = Math.abs(((z + 400) % 100) - 50);
  return rx > 43 || rz > 43;
}

// Push a circle (x,z,r) out of every building AABB. Returns corrected {x,z} + hit flag.
export function collideCircle(city, x, z, r) {
  let hit = false;
  for (const b of city.buildings) {
    const bx0 = b.x - b.w / 2 - r, bx1 = b.x + b.w / 2 + r;
    const bz0 = b.z - b.d / 2 - r, bz1 = b.z + b.d / 2 + r;
    if (x > bx0 && x < bx1 && z > bz0 && z < bz1) {
      hit = true;
      const dxl = x - bx0, dxr = bx1 - x, dzl = z - bz0, dzr = bz1 - z;
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) x = bx0; else if (m === dxr) x = bx1;
      else if (m === dzl) z = bz0; else z = bz1;
    }
  }
  x = Math.max(-WORLD_HALF + 6, Math.min(WORLD_HALF - 6, x));
  z = Math.max(-WORLD_HALF + 6, Math.min(WORLD_HALF - 6, z));
  return { x, z, hit };
}

// Snap a point to the nearest road centreline (used by autopilot recovery teleports).
export function nearestRoadPoint(x, z) {
  const snap = (v) => {
    const rel = v + 400;
    const block = Math.floor(rel / 100);
    const inBlock = rel - block * 100;
    if (inBlock < 7) return block * 100 - 400;
    if (inBlock > 93) return (block + 1) * 100 - 400;
    return v;
  };
  const sx = snap(x), sz = snap(z);
  const dx = Math.abs(sx - x), dz = Math.abs(sz - z);
  if (dx < dz) return { x: sx, z };
  return { x, z: sz };
}

export function randomRoadPoint(rng) {
  const gx = rng.int(-4, 3) * 100 + rng.pick([-50, 50]);
  const gz = rng.int(-4, 3) * 100 + rng.pick([-50, 50]);
  return { x: gx + rng.range(-30, 30), z: gz + rng.range(-30, 30) };
}
