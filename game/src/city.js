// city.js — Solmar Bay: the procedural city layout, data only (no meshes).
// A seeded Dice lays out the road grid, the buildings, the four landmarks,
// the ATMs, the garage and the safehouse. scene.js turns this into meshes;
// traffic, police and missions read the same layout, so everyone agrees
// on where the roads and the places are.
import { Dice } from './rng.js';
import { TUNE } from './tuning.js';

export function buildCityLayout(seed = 11) {
  const dice = new Dice(seed);
  const size = TUNE.city.size;
  const half = size / 2;
  const block = TUNE.city.block;
  const roadAt = [];
  for (let c = -half; c <= half; c += block) roadAt.push(c);
  const roads = [];
  for (const c of roadAt) {
    roads.push({ axis: 'z', at: c, from: -half, to: half }); // runs north-south (constant x)
    roads.push({ axis: 'x', at: c, from: -half, to: half }); // runs east-west (constant z)
  }
  // Landmarks, one per district, fixed so missions can name them.
  const landmarks = [
    { kind: 'lighthouse', name: 'Mercy Point Lighthouse', x: -224, z: 224, district: 'Marina' },
    { kind: 'tower', name: 'Solmar Tower', x: 224, z: -224, district: 'Downtown' },
    { kind: 'pier', name: 'Vice Pier', x: -224, z: -224, district: 'Vice Beach' },
    { kind: 'observatory', name: 'Hills Observatory', x: 224, z: 224, district: 'The Hills' },
  ];
  const landmarkBlocks = new Set(landmarks.map((l) => `${Math.round(l.x / block)},${Math.round(l.z / block)}`));
  // Buildings: one per block, inset from the roads; Downtown builds tall.
  const buildings = [];
  const parks = [];
  for (let ix = 0; ix < roadAt.length - 1; ix++) {
    for (let iz = 0; iz < roadAt.length - 1; iz++) {
      const x0 = roadAt[ix];
      const z0 = roadAt[iz];
      const cx = x0 + block / 2;
      const cz = z0 + block / 2;
      const key = `${Math.round(cx / block)},${Math.round(cz / block)}`;
      if (landmarkBlocks.has(key)) continue;
      if (dice.chance(0.12)) {
        parks.push({ x: cx, z: cz, w: block - 18, d: block - 18 });
        continue;
      }
      const district = districtAt({ districts: TUNE.city.districts }, cx, cz);
      const tall = district.name === 'Downtown';
      const h = tall ? dice.range(35, 85) : dice.range(9, 30);
      const w = dice.range(20, 38);
      const d = dice.range(20, 38);
      const palette = tall
        ? [0x6b7a8f, 0x8f8578, 0x5a6b7a, 0x7a6b5a]
        : [0x9a8f7a, 0x7a8f9a, 0x8f7a6b, 0x6b7a5a, 0xa89a80];
      buildings.push({ x: cx, z: cz, w, d, h, color: dice.pick(palette), district: district.name });
    }
  }
  // ATMs on street corners, for the robbery loop.
  const atms = [
    { x: -64, z: -64 }, { x: 64, z: 64 }, { x: -192, z: 64 },
    { x: 192, z: -64 }, { x: 0, z: 192 }, { x: 192, z: 128 },
  ];
  const places = {
    marina: { x: -224, z: 224, name: 'Marina' },
    downtown: { x: 224, z: -224, name: 'Downtown' },
    beach: { x: -224, z: -224, name: 'Vice Beach' },
    hills: { x: 224, z: 224, name: 'The Hills' },
    garage: { x: -96, z: 192, name: "Rico's Garage" },
    safehouse: { x: 192, z: 224, name: 'Safehouse' },
    pier: { x: -224, z: -224, name: 'Vice Pier' },
    tower: { x: 224, z: -224, name: 'Solmar Tower' },
    lighthouse: { x: -224, z: 224, name: 'Mercy Point Lighthouse' },
    observatory: { x: 224, z: 224, name: 'Hills Observatory' },
  };
  return { size, half, block, roadAt, roads, buildings, parks, landmarks, atms, places, seed, districts: TUNE.city.districts };
}

export function districtAt(layout, x, z) {
  let best = layout.districts[0];
  let bestD = Infinity;
  for (const d of layout.districts) {
    const dx = x - d.cx;
    const dz = z - d.cz;
    const dd = dx * dx + dz * dz;
    if (dd < bestD) {
      bestD = dd;
      best = d;
    }
  }
  return best;
}

export function districtNameAt(layout, x, z) {
  return districtAt(layout, x, z).name;
}

// The closest point on any road to (x, z), snapped to the road centre.
export function nearestRoadPoint(layout, x, z) {
  let best = null;
  let bestD = Infinity;
  for (const c of layout.roadAt) {
    const d1 = Math.abs(x - c);
    if (d1 < bestD) {
      bestD = d1;
      best = { x: c, z };
    }
    const d2 = Math.abs(z - c);
    if (d2 < bestD) {
      bestD = d2;
      best = { x, z: c };
    }
  }
  return best;
}

export function randomRoadPoint(layout, dice) {
  const c = dice.pick(layout.roadAt);
  const along = dice.range(-layout.half + 20, layout.half - 20);
  if (dice.chance(0.5)) return { x: c, z: along };
  return { x: along, z: c };
}

export function clampToCity(layout, x, z) {
  const h = layout.half - 8;
  return { x: Math.max(-h, Math.min(h, x)), z: Math.max(-h, Math.min(h, z)) };
}
