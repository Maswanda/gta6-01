// tuning.js — Solmar Bay: all gameplay constants in one place.
// The world is a 2D simulation on the x/z plane (y = 0); scene.js draws it in 3D.
export const T = {
  // World
  worldHalf: 312,            // city spans -312..312 on x and z
  roadStep: 52,              // roads at multiples of 52
  roadHalfWidth: 7,          // half-width of a road
  dayLengthSec: 240,         // one full day/night cycle, in game seconds
  // Player on foot
  walkSpeed: 7,
  runSpeed: 11,
  // Cars
  carAccel: 26,
  carBrake: 40,
  carMaxSpeed: 34,
  sportsMaxSpeed: 46,
  carTurn: 2.1,
  carGrip: 6.0,
  carHp: 100,
  autopilotCarHp: 1000,     // reinforced: straight-line autopilot navigation survives building bumps
  // Wanted / police
  maxWanted: 5,
  wantedDecayNormalSec: 26,  // game seconds for one star to cool off in the open
  wantedDecayHiddenSec: 14,  // game seconds for one star to cool off while hidden + crouched
  safehouseDecaySec: 10,     // game seconds per star while resting at the safehouse
  heliWanted: 4,             // wanted level that lifts the helicopter off
  roadblockWanted: 4,        // wanted level that spawns roadblocks
  // Combat
  weapons: {
    pistol: { name: 'Pistol', damage: 50, mag: 12, reserve: 96, range: 60, rate: 0.22 },
    shotgun: { name: 'Shotgun', damage: 34, pellets: 5, mag: 6, reserve: 36, range: 26, rate: 0.7 },
    smg: { name: 'SMG', damage: 26, mag: 30, reserve: 180, range: 45, rate: 0.09 },
  },
  enemyHp: 100,
  enemyBulletCarDamage: 2,   // enemy bullets damage the CAR, never the player inside it
  enemyBulletPlayerDamage: 3,
  enemyShootInterval: 1.4,
  enemyShootRange: 55,
  // ATM robbery
  atmReward: 250,
  atmWanted: 2,
  atmRange: 3,               // tryAtm reach (on-foot interaction)
  atmCooldownSec: 60,
  // Missions
  gotoRadius: 40,            // goto/deliver targets sit mid-block; radius 40 lets a car reach them
  talkRadius: 9,
  killRadius: 70,
  // Garage
  vehiclePrices: { sedan: 800, muscle: 1500, sports: 3000, van: 1200 },
  vehicleSellBack: 0.5,      // sell returns half the price
  // Side activities
  taxiFare: 120,
  racePrize: 300,
  collectibleReward: 50,
  // Save
  saveKey: 'solmar-bay-heatwave-save-v4',
};

// Landmarks — the playtest teleports to these exact points; every one sits
// on or within gotoRadius of a road (roads at multiples of 52).
export const LM = {
  pier: [-60, 300],
  garage: [156, 104],
  warehouse: [-156, -104],
  bar: [104, -156],
  docks: [-208, 52],
  bank: [26, -26],
  safehouse: [26, 182],
  clockTower: [-130, 26],
  marina: [30, 236],
  casino: [78, -10],
};

// Districts, by quadrant-ish bands.
export function districtAt(x, z) {
  if (z >= 150) return 'Marina';
  if (x >= 100) return 'Vice Beach';
  if (z <= -150) return 'Little Havana';
  if (x <= -150) return 'Little Havana';
  return 'Downtown';
}

export function dist2(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return dx * dx + dz * dz;
}
export function dist(ax, az, bx, bz) { return Math.sqrt(dist2(ax, az, bx, bz)); }

// Vec3 — a minimal THREE.Vector3-compatible position (x, y, z with set/copy).
// The playtest harness calls .set(x, y, z) and .copy(v) on player/car/heli
// positions, and THREE's own .copy reads .x/.y/.z — so positions are Vec3,
// not plain {x, z} objects. y stays 0 on the ground plane.
export class Vec3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
}
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function angDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
