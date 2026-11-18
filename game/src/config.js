// Solmar Bay: Heatwave v2 — every number that shapes the game, in one place.
// v2 raises the city: more traffic and pedestrians, four drivable vehicle
// types, three weapons, a stamina bar, and tuning for nine story missions
// plus the taxi, collectible and street-race side activities.
export const CFG = {
  seed: 2024,
  // City grid: streets every blockPitch, streetWidth wide, blocks between them.
  blockPitch: 52,
  streetWidth: 14,
  streetCount: 9, // street lines at -208 .. +208
  worldHalf: 262, // playable bounds (city + pier + water edge)
  cityHalf: 218,
  // On-foot player.
  walkSpeed: 5.4,
  runSpeed: 9.8,
  playerRadius: 0.55,
  playerHealth: 100,
  staminaMax: 100,
  staminaDrain: 26, // per second while sprinting
  staminaRegen: 18, // per second while not sprinting
  // Driving — the defaults are the sedan; each type overrides them.
  carAccel: 16,
  carBrake: 34,
  carReverseMax: 9,
  carTopSpeed: 30,
  carSteer: 2.1,
  carRadius: 1.7,
  trafficSpeed: 10,
  trafficCount: 20,
  parkedCount: 14,
  // Pedestrians.
  pedCount: 28,
  pedSpeed: 1.6,
  // Police / wanted.
  maxWanted: 5,
  policeTopSpeed: 31,
  bustDistance: 4.5,
  bustHoldSeconds: 3,
  wantedDecaySeconds: 26,
  roadblockWanted: 4, // a roadblock goes up at this many stars
  // Combat.
  punchRange: 2.3,
  punchDamage: 26,
  punchCooldown: 0.45,
  pistolDamage: 34,
  pistolRange: 42,
  magSize: 12,
  shotgunDamage: 22,
  shotgunPellets: 5,
  shotgunRange: 18,
  shotgunMag: 6,
  smgDamage: 16,
  smgRange: 30,
  smgMag: 30,
  // Missions and side activities.
  missionTimeLimit: 150, // seconds for the hot delivery
  taxiTimeLimit: 120,
  raceTimeLimit: 150,
  collectibleCount: 10,
  // Camera.
  camDistanceFoot: 7.5,
  camDistanceCar: 11,
  camHeightFoot: 3.2,
  camHeightCar: 4.6,
};

// Street centre lines, derived from the grid so every system agrees on them.
export const STREET_LINES = [];
for (let i = 0; i < CFG.streetCount; i++) {
  STREET_LINES.push(-208 + i * CFG.blockPitch);
}

// Drivable vehicle types: distinct handling and a label the HUD shows when
// Jax gets in. The police interceptor is a tuned sedan of its own.
export const VEHICLE_TYPES = {
  sedan: { topSpeed: 30, accel: 16, brake: 34, steer: 2.1, radius: 1.7, label: 'Sedan' },
  sports: { topSpeed: 40, accel: 22, brake: 38, steer: 2.6, radius: 1.6, label: 'Sports car' },
  van: { topSpeed: 24, accel: 12, brake: 30, steer: 1.7, radius: 1.9, label: 'Van' },
  truck: { topSpeed: 26, accel: 13, brake: 32, steer: 1.8, radius: 2.0, label: 'Truck' },
};

// Weapons. The pistol is Jax's from the start; the shotgun is earned after
// the docks payback, the SMG after the rival crew is dealt with.
export const WEAPONS = {
  pistol: { name: 'Pistol', damage: 34, range: 42, mag: 12, cooldown: 0.28, auto: false },
  shotgun: { name: 'Shotgun', damage: 22, pellets: 5, range: 18, mag: 6, cooldown: 0.9, auto: false },
  smg: { name: 'SMG', damage: 16, range: 30, mag: 30, cooldown: 0.09, auto: true },
};

// The city's districts, by region — the HUD, minimap and mission text use
// these names, and the city builder styles each one differently.
export function districtAt(x, z) {
  if (z > CFG.worldHalf - 8) return 'Pier';
  if (z >= 150) return 'Marina';
  if (x <= -100) return 'Old Town';
  if (z <= -150) return 'Northside';
  if (Math.abs(x) <= 60 && Math.abs(z) <= 60) return 'Downtown';
  if (z >= 60) return 'Beachfront';
  return 'Midtown';
}
