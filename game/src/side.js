// Side activities: taxi fares, vigilante (clear a wave), and time trials.
// Each pays cash and is tracked in the save. Simple, real, and autopilot-friendly.
import { randomRoadPoint } from './city.js';
import { spawnEnemies } from './combat.js';
import { sfx } from './audio.js';

export function createSide() {
  return {
    taxi: { active: false, fare: 0, tx: 0, tz: 0, timer: 0 },
    vigilante: { active: false, left: 0 },
    trial: { active: false, tx: 0, tz: 0, timer: 0, best: null },
    results: { taxiDone: 0, vigilanteDone: 0, trialsDone: 0 },
  };
}

export function startTaxi(world) {
  const s = world.side.taxi;
  const pt = randomRoadPoint(world.rng);
  s.active = true;
  s.tx = pt.x; s.tz = pt.z;
  s.fare = 250;
  s.timer = 75;
  world.feed.push('Taxi fare: take the passenger to the marker — $250.');
}

export function startVigilante(world) {
  const s = world.side.vigilante;
  s.active = true;
  s.left = 4;
  spawnEnemies(world, 'gang', 4, world.player.x + 35, world.player.z, world.rng);
  world.feed.push('Vigilante: clear 4 Bay Kings — $400.');
}

export function startTrial(world) {
  const s = world.side.trial;
  const pt = randomRoadPoint(world.rng);
  s.active = true;
  s.tx = pt.x; s.tz = pt.z;
  s.timer = 60;
  world.feed.push('Time trial: reach the marker in 60 seconds — $350.');
}

export function stepSide(world, dt) {
  const p = world.player;
  const s = world.side;
  if (s.taxi.active) {
    s.taxi.timer -= dt;
    const d = Math.hypot(p.x - s.taxi.tx, p.z - s.taxi.tz);
    if (d < 12) {
      p.cash += s.taxi.fare;
      s.results.taxiDone += 1;
      s.taxi.active = false;
      sfx.cash();
      world.feed.push(`Taxi fare complete — +$${s.taxi.fare}.`);
    } else if (s.taxi.timer <= 0) {
      s.taxi.active = false;
      world.feed.push('Taxi fare expired.');
    }
  }
  if (s.vigilante.active) {
    const left = world.enemies.length;
    if (left === 0) {
      p.cash += 400;
      s.results.vigilanteDone += 1;
      s.vigilante.active = false;
      sfx.cash();
      world.feed.push('Vigilante complete — +$400.');
    }
  }
  if (s.trial.active) {
    s.trial.timer -= dt;
    const d = Math.hypot(p.x - s.trial.tx, p.z - s.trial.tz);
    if (d < 12) {
      p.cash += 350;
      s.results.trialsDone += 1;
      if (s.trial.best === null || s.trial.timer > s.trial.best) s.trial.best = s.trial.timer;
      s.trial.active = false;
      sfx.cash();
      world.feed.push('Time trial complete — +$350.');
    } else if (s.trial.timer <= 0) {
      s.trial.active = false;
      world.feed.push('Time trial expired.');
    }
  }
}
