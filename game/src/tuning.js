// Solmar Bay: Heatwave — every tuning number in one place.
// The city is a flat 800x800 plane (x,z in [-400,400]); the simulation is 2D logic
// (x/z plane) with a 3D renderer on top, so the autopilot and the player share one truth.
export const STEP = 1 / 60;
export const DAY_LENGTH = 240; // seconds per full day/night cycle
export const WORLD_HALF = 400;

export const PLAYER = {
  hp: 100, armor: 100,
  walkSpeed: 6, runSpeed: 11,
  enterCarRadius: 5,
  bustSeconds: 3.5, // police within 6 units for this long = busted
  wastedCashLoss: 200,
};

export const CAR = {
  accel: 26, brake: 46, reverseMax: 12,
  steer: 2.4, grip: 8.5, driftGrip: 3.2,
  kinds: {
    sedan: { maxSpeed: 33, hp: 100, price: 0, color: 0x3a7bd5, label: 'Vapid Sedan' },
    sport: { maxSpeed: 43, hp: 80, price: 2500, color: 0xd53a3a, label: 'Comet Sport' },
    taxi: { maxSpeed: 30, hp: 110, price: 1200, color: 0xe8c832, label: 'Downtown Taxi' },
    truck: { maxSpeed: 26, hp: 160, price: 1800, color: 0x5a7a4a, label: 'Benson Truck' },
  },
};

export const POLICE = {
  maxSpeed: 37, ramDamage: 6, chaseRadius: 220,
  spawnDistance: 90, maxCars: 4,
  heatPerKill: 1, heatPerRob: 1, heatDecay: 0.02,
  roadblockAt: 4, heliAt: 4,
};

export const WEAPONS = {
  pistol: { damage: 25, rate: 0.28, range: 70, spread: 0.03, auto: false, label: 'Pistol' },
  shotgun: { damage: 14, pellets: 6, rate: 0.85, range: 34, spread: 0.12, auto: false, label: 'Shotgun' },
  smg: { damage: 13, rate: 0.09, range: 52, spread: 0.06, auto: true, label: 'SMG' },
};

export const ENEMY = {
  gang: { hp: 50, speed: 5, damage: 8, range: 40, rate: 1.1, label: 'Bay King' },
  king: { hp: 130, speed: 4.2, damage: 14, range: 46, rate: 0.9, label: 'Bay King Enforcer' },
};

export const ATM = {
  robAmountMin: 220, robAmountMax: 480,
  tryRange: 3, cooldownSeconds: 60,
};

export const CRIME = {
  eventEveryMin: 25, eventEveryMax: 45,
  muggingReward: 150, carjackReward: 300,
};

export const GARAGE = { clearStarCost: 150 };

// Mission rewards in story order (12 missions, $).
export const MISSION_REWARD = [500, 750, 900, 1000, 1500, 1200, 1800, 2000, 2500, 3000, 4000, 6000];

export const SAVE_KEY = 'solmar-bay-heatwave-save-v4';
