// Solmar Bay: Heatwave — shared tuning constants for the whole game.
// One place for every number that shapes how the city, cars, police and
// missions feel, so a balance tweak never means hunting through files.
export const CFG = {
  seed: 1337,
  // City grid: streets every BLOCK units, STREET_W wide, blocks between them.
  blockPitch: 52,
  streetWidth: 14,
  streetCount: 9, // street lines at -208 .. +208
  worldHalf: 262, // playable bounds (city + pier + water edge)
  cityHalf: 218,
  // On-foot player.
  walkSpeed: 5.2,
  runSpeed: 9.4,
  playerRadius: 0.55,
  playerHealth: 100,
  // Driving (arcade model).
  carAccel: 16,
  carBrake: 34,
  carReverseMax: 9,
  carTopSpeed: 30,
  carSteer: 2.1,
  carRadius: 1.7,
  trafficSpeed: 10,
  trafficCount: 14,
  parkedCount: 10,
  // Pedestrians.
  pedCount: 18,
  pedSpeed: 1.6,
  // Police / wanted.
  maxWanted: 5,
  policeTopSpeed: 31,
  bustDistance: 4.5,
  bustHoldSeconds: 3,
  wantedDecaySeconds: 26,
  // Combat.
  punchRange: 2.3,
  punchDamage: 26,
  punchCooldown: 0.45,
  pistolDamage: 34,
  pistolRange: 42,
  magSize: 12,
  // Missions.
  missionTimeLimit: 150, // seconds for the hot delivery
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
