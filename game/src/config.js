// Solmar Bay: Heatwave v4 — every number that shapes the game, in one place.
// v4 keeps v3's city, missions and handling, and adds: the PD helicopter
// that hunts the player at four and five stars, a procedural radio with
// three stations, Rico's garage (buy, sell and choose cars, with a safehouse
// that heals and cools the heat), and two more story missions — twelve in
// all, ending with the Last Run.
export const CFG = {
  seed: 2024,
  // Day / night: one full cycle lasts dayLength seconds of game time.
  dayLength: 240,
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
  crouchSpeed: 0.5, // crouching halves the walk speed
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
  wantedDecayHiddenSeconds: 14, // heat cools off faster when out of sight
  hiddenRadius: 45, // a cop further than this cannot see the player
  hiddenRadiusCrouched: 75, // crouching widens the hidden radius
  roadblockWanted: 4, // a roadblock goes up at this many stars
  roadblockAhead: 70, // how far ahead of the player's travel it is laid
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
  // Helicopter: the PD air unit that joins the chase at four stars.
  heliWanted: 4, // stars needed before the chopper lifts off
  heliAltitude: 26, // metres above the street
  heliTopSpeed: 20, // metres per second while closing in
  heliOrbitSpeed: 0.35, // radians per second around the player
  heliSpotRadius: 30, // inside this, the searchlight pins the player
  heliRetreatSeconds: 30, // how long a shot-down chopper stays away
  heliHp: 100, // gunfire that brings it down
  heliSearchSeconds: 12, // circles the last known spot this long
  // Rico's garage: buy, sell and choose cars; the safehouse rests the heat.
  garageRadius: 8, // how close to stand to open the garage
  garageSellBack: 0.6, // selling returns this fraction of the price
  garageDealPct: 0.2, // the daily deal's discount
  safehouseRadius: 6,
  safehouseHealRate: 6, // health per second while resting at the safehouse
  safehouseStarSeconds: 10, // seconds at the safehouse to lose one star
  // Radio: three procedural stations, mixed quietly under the game.
  radioVolume: 0.06,
  // Missions and side activities.
  missionTimeLimit: 150, // seconds for the hot delivery
  heistTimeLimit: 150, // seconds for the Marina Heist getaway
  heistReward: 2500,
  mission11Reward: 1500, // Air Support
  mission12Reward: 3000, // The Last Run
  taxiTimeLimit: 120,
  taxiNightBonus: 100, // extra fare for a night shift
  raceTimeLimit: 150,
  collectibleCount: 10,
  // Dynamic crime: ambient events and the ATM.
  crimeSeed: 2077,
  crimeCooldown: 45, // seconds of quiet between ambient events
  crimeLifetime: 60, // an ignored event fizzles after this long
  crimeRewardCarjacking: 150,
  crimeRewardPursuit: 200,
  crimeRewardAtm: 150,
  atmRobReward: 250,
  atmRobWanted: 2,
  atmRobCooldown: 90,
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
// Jax gets in. The police interceptor is a tuned sedan of its own. v4 adds
// the muscle car — Rico's flagship, the Sunset GT, only sold at the garage.
export const VEHICLE_TYPES = {
  sedan: { topSpeed: 30, accel: 16, brake: 34, steer: 2.1, radius: 1.7, label: 'Sedan' },
  sports: { topSpeed: 40, accel: 22, brake: 38, steer: 2.6, radius: 1.6, label: 'Sports car' },
  van: { topSpeed: 24, accel: 12, brake: 30, steer: 1.7, radius: 1.9, label: 'Van' },
  truck: { topSpeed: 26, accel: 13, brake: 32, steer: 1.8, radius: 2.0, label: 'Truck' },
  muscle: { topSpeed: 36, accel: 20, brake: 36, steer: 2.4, radius: 1.7, label: 'Muscle car' },
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
