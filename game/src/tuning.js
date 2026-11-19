// tuning.js — Solmar Bay: every number the game runs on, in one place.
// Change a value here and the whole city follows. Nothing else in the
// game hard-codes a balance number; every module reads TUNE.
export const TUNE = {
  city: {
    size: 640, // playable square, metres, centred on 0,0
    block: 64, // road grid spacing
    roadWidth: 14,
    districts: [
      { name: 'Marina', cx: -160, cz: 160, color: 0x2e7f8f },
      { name: 'Downtown', cx: 160, cz: -160, color: 0x8f7a2e },
      { name: 'Vice Beach', cx: -160, cz: -160, color: 0x2e8f5a },
      { name: 'The Hills', cx: 160, cz: 160, color: 0x7a4a8f },
    ],
  },
  player: {
    walkSpeed: 9,
    runSpeed: 15,
    health: 100,
    armor: 100,
    punchDamage: 12,
    enterCarRadius: 4.5,
  },
  cars: {
    sedan: { label: 'Solmar Sedan', top: 34, accel: 16, grip: 0.9, price: 1200, color: 0x3a6fd8 },
    muscle: { label: 'Bay Muscle', top: 42, accel: 20, grip: 0.75, price: 3500, color: 0xd83a3a },
    taxi: { label: 'Bay Cab', top: 30, accel: 13, grip: 0.95, price: 900, color: 0xe8c832 },
    truck: { label: 'Harbor Truck', top: 26, accel: 10, grip: 0.8, price: 2200, color: 0x5a6b7a },
  },
  weapons: {
    pistol: { label: 'Pistol', damage: 25, rate: 0.28, range: 60, price: 400, auto: false },
    shotgun: { label: 'Shotgun', damage: 18, rate: 0.85, range: 26, price: 1200, auto: false, pellets: 6 },
    smg: { label: 'SMG', damage: 14, rate: 0.09, range: 45, price: 2500, auto: true },
  },
  police: {
    // Wanted stars 0..5. Each star is a heat level; the law answers in kind.
    stars: [0, 1, 2, 3, 4, 5],
    decayPerSec: 0.05, // stars fall slowly while hidden and unlit
    decayHiddenBonus: 0.12, // extra decay while no officer sees the player
    arrestHoldSeconds: 3, // an officer must hold the player this long to bust them (the bust fix: this value exists and is read by name)
    bustRadius: 2.2,
    maxCars: [0, 2, 3, 4, 5, 6],
    roadblockAtStars: 4,
    copHealth: 60,
    copDamage: 8,
  },
  helicopter: {
    spawnAtStars: 4,
    cruiseHeight: 55,
    followSpeed: 26,
    retreatDamage: 100, // damage that makes the air unit pull off
    spotlightRange: 70,
    rotorDamage: 30,
  },
  radio: {
    stations: [
      { name: 'SOLMAR 88.5', mood: 'chill', bpm: 92, wave: 'sine' },
      { name: 'BAY 101', mood: 'drive', bpm: 128, wave: 'square' },
      { name: 'MARINA 94.3', mood: 'night', bpm: 104, wave: 'sawtooth' },
    ],
  },
  crime: {
    atmReward: 250,
    atmWanted: 2,
    eventReward: [150, 400],
    eventCooldownSec: 45,
  },
  garage: {
    dailyDealDiscount: 0.2,
    sellBack: 0.6,
  },
  missions: {
    reward: [300, 400, 500, 600, 700, 800, 900, 1000, 1200, 1500, 2000, 2500],
  },
  day: {
    dayLengthSec: 240, // one full day/night cycle
    startHour: 17.5, // golden hour at boot
  },
  save: {
    key: 'solmar-bay-save-v4',
  },
};
