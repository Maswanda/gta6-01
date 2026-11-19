// Dynamic Crime System: random street crime (muggings, carjackings) the player can
// answer for cash, plus ATM robbery. ATM rules (bug fix from fab2d34): tryAtm range 3,
// a robbed ATM cools down 60 s, and the robAtm objective skips ATMs on cooldown.
import { ATM, CRIME } from './tuning.js';
import { sfx } from './audio.js';

export function stepCrime(world, dt, rng) {
  // Spawn a street crime every so often while the player is free-roaming.
  world.crimeTimer -= dt;
  if (world.crimeTimer <= 0) {
    world.crimeTimer = rng.range(CRIME.eventEveryMin, CRIME.eventEveryMax);
    const kind = rng.chance(0.5) ? 'mugging' : 'carjack';
    const a = rng.range(0, Math.PI * 2);
    const x = world.player.x + Math.sin(a) * rng.range(30, 80);
    const z = world.player.z + Math.cos(a) * rng.range(30, 80);
    world.crime.events.push({
      id: world.crimeId++, kind, x, z,
      reward: kind === 'mugging' ? CRIME.muggingReward : CRIME.carjackReward,
      until: world.elapsed + 90,
    });
    world.feed.push(kind === 'mugging'
      ? 'Street crime reported nearby — a mugging in progress.'
      : 'Street crime reported nearby — a carjacking in progress.');
  }
  // Expire old events.
  world.crime.events = world.crime.events.filter((e) => world.elapsed < e.until);
  // Answering a crime: reach it, get the cash.
  for (const e of world.crime.events) {
    const d = Math.hypot(world.player.x - e.x, world.player.z - e.z);
    if (d < 6) {
      world.player.cash += e.reward;
      world.player.heat = Math.min(5, (world.player.heat || 0) + 0.5);
      world.feed.push(`You stopped a ${e.kind} — +$${e.reward}.`);
      sfx.cash();
      e.until = 0;
    }
  }
  world.crime.events = world.crime.events.filter((e) => world.elapsed < e.until);
}

// Nearest ATM that is NOT on cooldown.
export function nearestReadyAtm(world, x, z) {
  let best = null, bestD = Infinity;
  for (const atm of world.city.atms) {
    if (world.elapsed < atm.cooldownUntil) continue;
    const d = Math.hypot(atm.x - x, atm.z - z);
    if (d < bestD) { bestD = d; best = atm; }
  }
  return best;
}

// Try to rob: must be within tryRange of a ready ATM. Returns cash taken or 0.
export function tryAtm(world, rng) {
  const p = world.player;
  for (const atm of world.city.atms) {
    if (world.elapsed < atm.cooldownUntil) continue;
    const d = Math.hypot(atm.x - p.x, atm.z - p.z);
    if (d <= ATM.tryRange) {
      const take = rng.int(ATM.robAmountMin, ATM.robAmountMax);
      p.cash += take;
      p.heat = Math.min(5, (p.heat || 0) + 1);
      atm.cooldownUntil = world.elapsed + ATM.cooldownSeconds;
      world.missions.robs = (world.missions.robs || 0) + 1;
      world.feed.push(`ATM robbed — +$${take}. The cops are coming.`);
      sfx.cash();
      return take;
    }
  }
  return 0;
}
