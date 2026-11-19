// Solmar Bay: Heatwave — the tuning bible, rewritten for v4.
// One object holds every number the game runs on: the city grid, the
// on-foot feel, the cars, the wanted ladder, the guns, the chopper, Rico's
// garage, the radio, the story payouts and the ambient crime clock. v4's
// additions live here too — the air unit that answers four stars, the
// garage's buy/sell/rest numbers, and the last two story rewards.

export const CFG = {
  // World seed and the day that turns over it.
  seed: 2024,
  dayLength: 240,

  // The street grid: nine lines, 52 apart, 14 wide.
  blockPitch: 52,
  streetWidth: 14,
  streetCount: 9,
  worldHalf: 262,
  cityHalf: 218,

  // Jax on foot.
  walkSpeed: 5.4,
  runSpeed: 9.8,
  playerRadius: 0.55,
  playerHealth: 100,
  staminaMax: 100,
  staminaDrain: 26,
  staminaRegen: 18,
  crouchSpeed: 0.5,

  // Cars. The sedan numbers are the fallback; each type overrides them.
  carAccel: 16,
  carBrake: 34,
  carReverseMax: 9,
  carTopSpeed: 30,
  carSteer: 2.1,
  carRadius: 1.7,
  trafficSpeed: 10,
  trafficCount: 20,
  parkedCount: 14,

  // Locals on the sidewalks.
  pedCount: 28,
  pedSpeed: 1.6,

  // The wanted ladder and the PD's answer to it.
  maxWanted: 5,
  policeTopSpeed: 31,
  bustDistance: 4.5,
  bustHoldSeconds: 3,
  wantedDecaySeconds: 26,
  wantedDecayHiddenSeconds: 14,
  hiddenRadius: 45,
  hiddenRadiusCrouched: 75,
  roadblockWanted: 4,
  roadblockAhead: 70,

  // Fists and guns.
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

  // The PD air unit.
  heliWanted: 4,
  heliAltitude: 26,
  heliTopSpeed: 20,
  heliOrbitSpeed: 0.35,
  heliSpotRadius: 30,
  heliRetreatSeconds: 30,
  heliHp: 100,
  heliSearchSeconds: 12,

  // Rico's garage and the safehouse next door.
  garageRadius: 8,
  garageSellBack: 0.6,
  garageDealPct: 0.2,
  safehouseRadius: 6,
  safehouseHealRate: 6,
  safehouseStarSeconds: 10,

  // The radio sits quietly under everything else.
  radioVolume: 0.06,

  // Story, side jobs and the crime clock.
  missionTimeLimit: 150,
  heistTimeLimit: 150,
  heistReward: 2500,
  mission11Reward: 1500,
  mission12Reward: 3000,
  taxiTimeLimit: 120,
  taxiNightBonus: 100,
  raceTimeLimit: 150,
  collectibleCount: 10,
  crimeSeed: 2077,
  crimeCooldown: 45,
  crimeLifetime: 60,
  crimeRewardCarjacking: 150,
  crimeRewardPursuit: 200,
  crimeRewardAtm: 150,
  atmRobReward: 250,
  atmRobWanted: 2,
  atmRobCooldown: 90,

  // Chase camera.
  camDistanceFoot: 7.5,
  camDistanceCar: 11,
  camHeightFoot: 3.2,
  camHeightCar: 4.6,
};

// Street centre lines, built from the grid so every system agrees.
export const STREET_LINES = [];
for (let i = 0; i < CFG.streetCount; i += 1) {
  STREET_LINES.push(-208 + i * CFG.blockPitch);
}

// Five drivable types. The interceptor is a tuned sedan of its own; the
// muscle car is Rico's flagship and only ever comes from the garage.
export const VEHICLE_TYPES = {
  sedan: { topSpeed: 30, accel: 16, brake: 34, steer: 2.1, radius: 1.7, label: 'Sedan' },
  sports: { topSpeed: 40, accel: 22, brake: 38, steer: 2.6, radius: 1.6, label: 'Sports car' },
  van: { topSpeed: 24, accel: 12, brake: 30, steer: 1.7, radius: 1.9, label: 'Van' },
  truck: { topSpeed: 26, accel: 13, brake: 32, steer: 1.8, radius: 2.0, label: 'Truck' },
  muscle: { topSpeed: 36, accel: 20, brake: 36, steer: 2.4, radius: 1.7, label: 'Muscle car' },
};

// Guns. The pistol is Jax's from the start; the shotgun comes after the
// docks payback and the SMG after the rival crew is finished.
export const WEAPONS = {
  pistol: { name: 'Pistol', damage: 34, range: 42, mag: 12, cooldown: 0.28, auto: false },
  shotgun: { name: 'Shotgun', damage: 22, pellets: 5, range: 18, mag: 6, cooldown: 0.9, auto: false },
  smg: { name: 'SMG', damage: 16, range: 30, mag: 30, cooldown: 0.09, auto: true },
};

// District names by region — the HUD, the minimap and the mission text all
// read from here, and the city builder styles each one differently. The
// order matters: the pier outranks the Marina, the Marina outranks Old
// Town, and Downtown only claims the middle of the map.
export function districtAt(x, z) {
  if (z > CFG.worldHalf - 8) return 'Pier';
  if (z >= 150) return 'Marina';
  if (x <= -100) return 'Old Town';
  if (z <= -150) return 'Northside';
  if (Math.abs(x) <= 60 && Math.abs(z) <= 60) return 'Downtown';
  if (z >= 60) return 'Beachfront';
  return 'Midtown';
}
