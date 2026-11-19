// tuning.js — Every constant that defines Solmar Bay in one place:
// the city grid, the story landmarks, vehicles, weapons, radio
// stations, mission scripts and the timing rules the playtest checks.
// Nothing here is code the player sees — it is the game's balance sheet.
export const TUNE = {
  // ---- world ----
  cityHalf: 320,            // city spans -320 .. +320 on x and z
  roadSpacing: 52,          // avenue grid step
  roadWidth: 12,
  dayLengthSec: 240,        // one full day/night cycle, in game seconds
  startDayFrac: 0.32,       // late afternoon golden hour at boot
  // ---- player ----
  walkSpeed: 6.5,
  sprintSpeed: 10.5,
  crouchSpeed: 3.2,
  maxHealth: 100,
  startCash: 500,
  // ---- wanted / police ----
  normalDecaySec: 26,       // seconds of game time to cool one star
  hiddenDecaySec: 14,       // crouched + far from police: faster cool
  safehouseCoolSec: 10,     // one star per 10s of game time at safehouse
  safehouseHealPerSec: 6,
  bustHoldSec: 3,           // cop within 3m for this long = busted
  bustCashLoss: 0.1,         // lose 10% of cash when busted
  heliWanted: 4,            // stars needed for the air unit
  heliRetreatSec: 30,        // seconds before a damaged heli can return
  // ---- crime ----
  crimeApproachSec: 0.7,     // carjacker walks to the car
  crimeGraceSec: 0.4,        // window before the stolen car flees
  atmReward: 250,
  atmWanted: 2,
  // ---- vehicles ----
  vehicles: {
    sedan:  { label: 'Sedan',   price: 1200, topSpeed: 34, accel: 16, grip: 0.9,  color: 0x4a7a9e },
    muscle: { label: 'Muscle',  price: 2200, topSpeed: 38, accel: 19, grip: 0.85, color: 0xb03a2e },
    sports: { label: 'Sports',  price: 3500, topSpeed: 46, accel: 24, grip: 0.95, color: 0xf0a500 },
    truck:  { label: 'Truck',   price: 1800, topSpeed: 30, accel: 13, grip: 0.8,  color: 0x5d6d7e },
  },
  garageStartOwned: [],
  // ---- weapons ----
  weapons: {
    pistol:  { label: 'Pistol',  damage: 50, range: 34, mag: 12, reloadSec: 1.1, fireSec: 0.28, spread: 0.02 },
    shotgun: { label: 'Shotgun', damage: 100, range: 20, mag: 6,  reloadSec: 1.6, fireSec: 0.7,  spread: 0.09 },
    smg:     { label: 'SMG',     damage: 25, range: 30, mag: 30, reloadSec: 1.3, fireSec: 0.09, spread: 0.05 },
  },
  // ---- radio ----
  stations: [
    { name: 'SOLMAR 88.5', tempo: 96,  root: 55,  wave: 'sawtooth', mood: 'drive' },
    { name: 'BAY 101',     tempo: 122, root: 65,  wave: 'square',   mood: 'night' },
    { name: 'MARINA 94.3', tempo: 78,  root: 49,  wave: 'triangle', mood: 'chill' },
  ],
  // ---- story landmarks (fixed city coordinates) ----
  landmarks: {
    pier:       { x: -60,  z: 300,  label: 'Solmar Pier' },
    garage:     { x: 156,  z: 104,  label: 'Rico\u2019s Garage' },
    warehouse:  { x: -156, z: -104, label: 'Old Warehouse' },
    bar:        { x: 104,  z: -156, label: 'The Rusty Anchor' },
    docks:      { x: -208, z: 52,   label: 'Solmar Docks' },
    bank:       { x: 26,   z: -26,  label: 'Bay National Bank' },
    safehouse:  { x: 26,   z: 182,  label: 'Safehouse' },
    clockTower: { x: -130, z: 26,   label: 'Clock Tower' },
    marina:     { x: 30,   z: 236,  label: 'Marina' },
    casino:     { x: 78,   z: -10,  label: 'Casino Royale Bay' },
  },
  districts: [
    { name: 'Marina',     x0: -320, z0: 180, x1: 60,   z1: 320,  tint: 0x4a8a9a },
    { name: 'Downtown',   x0: -60,  z0: -160, x1: 320,  z1: 180,  tint: 0x5a6a8b },
    { name: 'Old Town',   x0: -320, z0: -320, x1: -60,  z1: 180,  tint: 0x9a7a55 },
    { name: 'Beachfront', x0: 60,   z0: 180,  x1: 320,  z1: 320,  tint: 0xab9a6a },
  ],
  // ---- missions: 12 chapters of the Solmar Bay story ----
  // step kinds: talk | goto | drive | shoot | survive
  missions: [
    { title: 'Meet Mara', reward: 300,
      brief: 'Mara waits at the pier. She has work for a driver who keeps his mouth shut.',
      steps: [
        { kind: 'talk', at: 'pier', text: 'Talk to Mara at the pier' },
      ] },
    { title: 'First Wheels', reward: 400,
      brief: 'A driver needs a car. Borrow one from the street and bring it to Rico\u2019s garage.',
      steps: [
        { kind: 'drive', at: 'garage', text: 'Drive any car to Rico\u2019s Garage' },
      ] },
    { title: 'The Pickup', reward: 500,
      brief: 'Pick up the package at the old warehouse, then drop it at The Rusty Anchor bar.',
      steps: [
        { kind: 'talk', at: 'warehouse', text: 'Collect the package at the warehouse' },
        { kind: 'drive', at: 'bar', text: 'Deliver the package to the bar' },
      ] },
    { title: 'Dockside Trouble', reward: 600,
      brief: 'Rivals are shaking down the docks. Clear them out — Rico will owe you a shotgun.',
      steps: [
        { kind: 'goto', at: 'docks', text: 'Reach the docks' },
        { kind: 'shoot', at: 'docks', count: 4, text: 'Take out the dock crew (4)' },
      ] },
    { title: 'The Clock Tower', reward: 700,
      brief: 'A client left a note at the clock tower. Read it, then meet the boat at the marina.',
      steps: [
        { kind: 'talk', at: 'clockTower', text: 'Read the note at the clock tower' },
        { kind: 'goto', at: 'marina', text: 'Go to the marina' },
      ] },
    { title: 'Joyride', reward: 800,
      brief: 'The client\u2019s sports car is parked at the marina. Take it for a spin to the garage.',
      steps: [
        { kind: 'drive', at: 'garage', text: 'Drive the sports car to the garage', needCar: 'sports' },
      ] },
    { title: 'Street Circuit', reward: 900,
      brief: 'Four checkpoints, one lap of the city. Beat the circuit and the street will know your name.',
      steps: [
        { kind: 'race', text: 'Hit all 4 checkpoints' },
      ] },
    { title: 'Warehouse War', reward: 1000,
      brief: 'The crew that hit the docks is back at the warehouse, heavier this time. End it.',
      steps: [
        { kind: 'goto', at: 'warehouse', text: 'Reach the warehouse' },
        { kind: 'shoot', at: 'warehouse', count: 6, text: 'Take out the warehouse crew (6)' },
      ] },
    { title: 'Bank Job Prep', reward: 1200,
      brief: 'Case the Bay National Bank, grab the floor plan, then cool off at the safehouse.',
      steps: [
        { kind: 'talk', at: 'bank', text: 'Case the bank, get the plan' },
        { kind: 'goto', at: 'safehouse', text: 'Lay low at the safehouse' },
      ] },
    { title: 'The Marina Heist', reward: 2500,
      brief: 'The casino vault. In through the front, out through the chaos. Rico is counting on you.',
      steps: [
        { kind: 'goto', at: 'casino', text: 'Reach the casino' },
        { kind: 'talk', at: 'casino', text: 'Talk your way past the guard' },
        { kind: 'shoot', at: 'casino', count: 2, text: 'Take out the vault guards (2)' },
        { kind: 'goto', at: 'safehouse', text: 'Escape to the safehouse' },
      ] },
    { title: 'Air Support', reward: 1500,
      brief: 'Four stars and a chopper on your tail. Lose the heat at the safehouse — the sky is watching.',
      steps: [
        { kind: 'survive', text: 'Wait for the chopper overhead' },
        { kind: 'goto', at: 'safehouse', text: 'Lose the heat at the safehouse' },
      ] },
    { title: 'The Last Run', reward: 2000,
      brief: 'One last job. Take the ledger from Rico to the pier, then vanish into the safehouse.',
      steps: [
        { kind: 'talk', at: 'garage', text: 'Take the ledger from Rico' },
        { kind: 'goto', at: 'pier', text: 'Deliver the ledger to the pier' },
        { kind: 'goto', at: 'safehouse', text: 'Vanish at the safehouse' },
      ] },
  ],
  // ---- side activities ----
  taxiFare: 150,
  racePrize: 300,
  collectibleReward: 100,
  collectibles: [
    { id: 'pkg-1', x: -260, z: 260 },
    { id: 'pkg-2', x: 240,  z: -260 },
    { id: 'pkg-3', x: -260, z: -240 },
    { id: 'pkg-4', x: 260,  z: 200 },
    { id: 'pkg-5', x: 0,    z: 0 },
  ],
  raceCheckpoints: [
    { x: 104,  z: -104 },
    { x: -104, z: -104 },
    { x: -104, z: 104 },
    { x: 104,  z: 104 },
  ],
  // ---- misc ----
  saveKey: 'solmar-bay-heatwave-save-v4',
  peds: 28,
  trafficCars: 14,
  parkedCars: 8,
};

// District lookup for a world position.
export function districtAt(x, z) {
  for (const d of TUNE.districts) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  }
  return TUNE.districts[1];
}

// Nightness 0..1 for a day fraction: 0.7 is deep night, 0.1 is day.
export function nightnessAt(frac) {
  const f = ((frac % 1) + 1) % 1;
  const dusk = smoothstep(0.55, 0.68, f);
  const dawn = 1 - smoothstep(0.88, 0.97, f);
  return dusk * dawn;
}
export function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
export function dist2d(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}
export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
