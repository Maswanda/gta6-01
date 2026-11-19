// Solmar Bay: Heatwave v4 — tuning: every number the game balances on.
// One place, so a balance pass touches one file instead of twelve.
export const T = {
  mapHalf: 300,
  roadStep: 52,
  roadHalf: 7,
  // Player on foot.
  walkSpeed: 9,
  runSpeed: 13,
  talkRadius: 26,
  reachRadius: 30,
  checkpointRadius: 20,
  // Cars.
  carAccel: 14,
  carBrake: 30,
  carMaxSpeed: 28,
  sportsMaxSpeed: 36,
  carReverseMax: 10,
  steerRate: 2.1,
  driftSpeed: 18,
  // Wanted / police.
  maxWanted: 5,
  hiddenDecay: 14, // seconds of game time, crouched + unseen, per star
  normalDecay: 26, // seconds of game time, per star
  safehouseDecay: 8, // seconds of game time, per star, at the safehouse
  safehouseHeal: 2, // hp per second of game time, at the safehouse
  policeRamCooldown: 1, // seconds per unit (v4 fix: was every substep)
  policeRamDamage: 6,
  policeRamCarDamage: 2, // enemy bullets vs a car (v4 fix)
  policeChaseSpeed: 24,
  policeSpawnDist: 40,
  // Helicopter.
  heliSpawnOffset: 25, // spawns at player +25/+25 (v4 fix: was 120 away)
  heliSpeed: 22,
  heliHeight: 26,
  heliLitDist: 70,
  heliRetreat: 30,
  // Crime.
  crimeGrace: 0.5,
  carjackRamDist: 10, // v4 fix: was 6
  pursuitRamDist: 8, // v4 fix: was 5
  ramMinSpeed: 3, // v4 fix: was 6
  atmPunchDist: 4,
  atmRobCash: 250,
  atmRobWanted: 2,
  // Combat.
  pistolDamage: 50, // v4 fix: was 34 (2 shots per enemy)
  pistolMag: 15, // v4 fix: was 12
  pistolAmmoStart: 15, // v4 fix: was 12
  pistolRange: 70,
  pistolCone: 0.35, // radians off heading that still counts as a hit
  shotgunDamage: 90,
  shotgunMag: 6,
  smgDamage: 25,
  smgMag: 30,
  enemyHp: 100,
  enemyShootRange: 55,
  enemyShootDamage: 4, // v4 balance: 5 enemies at 6 dmg / 1.4s out-DPS the player (100 hp) before 10 pistol shots land
  enemyShootInterval: 2.2, // v4 balance: was 1.4s — the player must survive a 5-enemy firefight
  reloadTime: 1.1,
  // Day / night.
  dayLength: 240, // seconds of game time per full day
  // Autopilot.
  autoCarStopDist: 30, // drive to within 30, then walk (v4 fix)
  autoUnstuckTime: 3, // seconds with no progress -> reverse/sidestep
  // Economy.
  startCash: 500,
  taxiFare: 120,
  vehiclePrices: { sedan: 800, muscle: 1500, sports: 4000 },
  vehicleSellBack: 0.6,
};

// Landmarks: [x, z]. Buildings sit slightly north of their landmark point so
// a teleport onto the point lands nearer the south face, where the door is.
export const LANDMARKS = {
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

// Building footprints: half extents, centred 8 units north (-z) of the
// landmark point, so the south face is 6 units past the point.
export const BUILDINGS = [
  { name: 'pier', at: 'pier', hx: 20, hz: 12, h: 6, color: 0x8a6d4b },
  { name: 'garage', at: 'garage', hx: 18, hz: 14, h: 9, color: 0x3f6d8e },
  { name: 'warehouse', at: 'warehouse', hx: 18, hz: 14, h: 11, color: 0x7a6a55 },
  { name: 'bar', at: 'bar', hx: 16, hz: 12, h: 8, color: 0x8e4a3f },
  { name: 'docks', at: 'docks', hx: 18, hz: 12, h: 7, color: 0x5b6b7a },
  { name: 'bank', at: 'bank', hx: 16, hz: 12, h: 10, color: 0x9a8f6a },
  { name: 'safehouse', at: 'safehouse', hx: 16, hz: 12, h: 8, color: 0x4a7a5b },
  { name: 'clockTower', at: 'clockTower', hx: 12, hz: 12, h: 26, color: 0x6a6a7a },
  { name: 'marina', at: 'marina', hx: 18, hz: 12, h: 7, color: 0x3f8e7a },
  { name: 'casino', at: 'casino', hx: 18, hz: 14, h: 12, color: 0xb08a2e },
  // Fillers so the skyline is not empty.
  { name: 'towerA', at: null, cx: -52, cz: -104, hx: 14, hz: 14, h: 20, color: 0x5a5a6e },
  { name: 'towerB', at: null, cx: 104, cz: 52, hx: 14, hz: 14, h: 18, color: 0x6e5a5a },
  { name: 'towerC', at: null, cx: -208, cz: 156, hx: 14, hz: 14, h: 16, color: 0x5a6e5a },
  { name: 'towerD', at: null, cx: 208, cz: -52, hx: 14, hz: 14, h: 22, color: 0x6e6a5a },
  { name: 'blockE', at: null, cx: 0, cz: 104, hx: 14, hz: 12, h: 9, color: 0x7a7a8a },
  { name: 'blockF', at: null, cx: -104, cz: 208, hx: 14, hz: 12, h: 9, color: 0x8a7a6a },
];

// The 12-mission story. `kind` drives the autopilot + the step checker:
// talk (reach an NPC and press E), reach (get to a place), kill (clear the
// spawned enemies), heli (wait for the chopper overhead), race (checkpoints).
export const MISSIONS = [
  { title: 'Meet Mara', kind: 'talk', npc: 'Mara', at: 'pier', text: 'Mara waits at the pier. Say hello.' },
  { title: 'Wheels', kind: 'reach', at: 'garage', needCar: true, text: 'Get a car and drive to the garage.' },
  { title: 'The Pickup', kind: 'talk', npc: 'Dante', at: 'warehouse', then: { kind: 'reach', at: 'bar' }, text: 'Pick up the package at the warehouse, take it to the bar.' },
  { title: 'Dockside Trouble', kind: 'kill', at: 'docks', enemies: 3, unlock: 'shotgun', text: 'Clear the dockside crew.' },
  { title: 'The Clock Tower', kind: 'talk', npc: 'Ivy', at: 'clockTower', then: { kind: 'reach', at: 'marina' }, text: 'Meet Ivy at the clock tower, then head to the marina.' },
  { title: 'The Sports Car', kind: 'reach', at: 'garage', needSports: true, text: 'Take the sports car to the garage.' },
  { title: 'Street Race', kind: 'race', checkpoints: [[104, -104], [-104, -104], [-104, 104], [104, 104]], text: 'Beat the street race: four checkpoints.' },
  { title: 'Warehouse War', kind: 'kill', at: 'warehouse', enemies: 5, unlock: 'smg', text: 'Take back the warehouse.' },
  { title: 'The Bank Job', kind: 'talk', npc: 'Rico', at: 'bank', then: { kind: 'reach', at: 'safehouse' }, text: 'Rob the bank with Rico, then lay low at the safehouse.' },
  { title: 'The Marina Heist', kind: 'heist', at: 'casino', guards: 2, text: 'Hit the casino vault, then get home.' },
  { title: 'Air Support', kind: 'heli', then: { kind: 'reach', at: 'safehouse' }, text: 'The heat is on. Lose the chopper, lose the heat.' },
  { title: 'The Last Run', kind: 'talk', npc: 'Rico', at: 'garage', then: { kind: 'reach', at: 'pier' }, then2: { kind: 'reach', at: 'safehouse' }, text: 'One last run: the ledger to the pier, then home.' },
];

export const STATIONS = [
  { name: 'SOLMAR 88.5', base: 110, pattern: [0, 0, 7, 0, 5, 0, 3, 7] },
  { name: 'BAY 101', base: 130, pattern: [0, 3, 0, 5, 0, 7, 10, 7] },
  { name: 'PALM 96.3', base: 98, pattern: [0, 5, 7, 5, 3, 2, 0, 2] },
];

export const VEHICLES = {
  sedan: { price: 800, maxSpeed: 28, color: 0x3f6d8e, label: 'Sedan' },
  muscle: { price: 1500, maxSpeed: 31, color: 0x8e3f3f, label: 'Muscle' },
  sports: { price: 4000, maxSpeed: 36, color: 0xd8a020, label: 'Sports' },
};

export const COLLECTIBLES = [
  { id: 'pkg1', x: -260, z: -260 },
  { id: 'pkg2', x: 260, z: 260 },
  { id: 'pkg3', x: -260, z: 260 },
  { id: 'pkg4', x: 260, z: -260 },
  { id: 'pkg5', x: 0, z: -260 },
];
