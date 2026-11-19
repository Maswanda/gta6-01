// 12 story missions, chained by explicit nextIndex (mission 12 nextIndex: null => done).
// Objective types: goto (radius 40 — a car can actually reach it), enterCar, kill,
// robAtm (skips ATMs on cooldown), survive (wanted >= level for N seconds), chase.
// Missions never fail: busted/wasted just respawns the player and the mission continues.
import { MISSION_REWARD } from './tuning.js';
import { spawnEnemies } from './combat.js';
import { createCar } from './drive.js';
import { nearestReadyAtm } from './crime.js';
import { sfx } from './audio.js';

const L = (x, z) => ({ x, z });

export const MISSIONS = [
  { title: 'Meet Mara', briefing: 'Mara is waiting at the Marina Pier. Go meet her.',
    objectives: [{ type: 'goto', ...L(-320, -320), radius: 40, label: 'Go to the Marina Pier' }], nextIndex: 1 },
  { title: 'Hot Wheels', briefing: 'You need wheels. Grab a car and cruise to Vice Beach.',
    objectives: [
      { type: 'enterCar', label: 'Get in a car' },
      { type: 'goto', ...L(320, -320), radius: 40, label: 'Drive to Vice Beach', inCar: true },
    ], nextIndex: 2 },
  { title: 'First Blood', briefing: 'Bay Kings are shaking down the Marina. Clear 3 of them.',
    objectives: [{ type: 'kill', kind: 'gang', count: 3, label: 'Clear the Bay Kings (0/3)' }], nextIndex: 3 },
  { title: 'Cash Run', briefing: 'The crew needs cash. Rob any ATM — watch the cooldown.',
    objectives: [{ type: 'robAtm', count: 1, label: 'Rob an ATM' }], nextIndex: 4 },
  { title: 'The Getaway', briefing: 'The cops are onto you. Survive 45 seconds at 2 stars.',
    objectives: [{ type: 'survive', seconds: 45, level: 2, label: 'Lose the cops (45s)' }], nextIndex: 5 },
  { title: "Rico's Ride", briefing: "Rico needs a car at his garage. Deliver one, in one piece.",
    objectives: [{ type: 'goto', ...L(-150, -150), radius: 40, label: "Deliver a car to Rico's Garage", inCar: true }], nextIndex: 6 },
  { title: 'Bay Kings Turf', briefing: 'Take the fight to Little Havana. 5 Kings, including 2 enforcers.',
    objectives: [{ type: 'kill', kind: 'mixed', count: 5, label: 'Clear the turf (0/5)' }], nextIndex: 7 },
  { title: 'Midnight Delivery', briefing: 'A package for Calle Ocho Plaza. No questions, no stops.',
    objectives: [{ type: 'goto', ...L(250, 250), radius: 40, label: 'Deliver to Calle Ocho Plaza' }], nextIndex: 8 },
  { title: 'Heat Wave', briefing: 'Three stars and rising. Survive 60 seconds of full heat.',
    objectives: [{ type: 'survive', seconds: 60, level: 3, label: 'Survive the heat (60s)' }], nextIndex: 9 },
  { title: 'The Marina Heist', briefing: 'Two ATMs, one night. Hit them both, then get back to the Marina.',
    objectives: [
      { type: 'robAtm', count: 2, label: 'Rob 2 ATMs (0/2)' },
      { type: 'goto', ...L(-320, -320), radius: 40, label: 'Get back to the Marina' },
    ], nextIndex: 10 },
  { title: 'Air Support', briefing: 'A police chopper is on you. Survive 60 seconds at 4 stars and drop 2 Kings.',
    objectives: [
      { type: 'survive', seconds: 60, level: 4, label: 'Survive the chopper (60s)' },
      { type: 'kill', kind: 'gang', count: 2, label: 'Drop 2 Bay Kings (0/2)' },
    ], nextIndex: 11 },
  { title: 'The Last Run', briefing: 'One last job: run the Kings’ courier off the road, then vanish at the safehouse.',
    objectives: [
      { type: 'chase', label: 'Destroy the courier car' },
      { type: 'goto', ...L(150, 150), radius: 40, label: 'Vanish at the safehouse' },
    ], nextIndex: null },
];

export function startMission(world, index) {
  const def = MISSIONS[index];
  const ms = world.missions;
  ms.index = index;
  ms.title = def.title;
  ms.briefing = def.briefing;
  ms.objectives = def.objectives.map((o) => ({ ...o, done: false, timer: o.seconds ?? 0 }));
  ms.objIndex = 0;
  ms.killsAtStart = ms.kills || 0;
  ms.robsAtStart = ms.robs || 0;
  ms.targetCar = null;
  // onStart hooks.
  const first = ms.objectives[0];
  if (first && first.type === 'kill') {
    if (first.kind === 'mixed') {
      spawnEnemies(world, 'gang', 3, world.player.x + 30, world.player.z);
      spawnEnemies(world, 'king', 2, world.player.x - 30, world.player.z + 20, world.rng);
    } else {
      spawnEnemies(world, first.kind, first.count + 1, world.player.x + 30, world.player.z, world.rng);
    }
  }
  if (first && first.type === 'survive') {
    world.player.heat = Math.max(world.player.heat || 0, first.level);
  }
  if (first && first.type === 'chase') {
    const car = createCar('sport', world.player.x + 60, world.player.z + 40, 0, 'courier');
    car.hp = 120; car.maxHp = 120;
    world.cars.push(car);
    ms.targetCar = car;
  }
  world.feed.push(`MISSION: ${def.title} — ${def.briefing}`);
}

export function currentObjective(world) {
  const ms = world.missions;
  return ms.objectives[ms.objIndex] || null;
}

export function objectiveLabel(world) {
  const o = currentObjective(world);
  if (!o) return 'Story complete';
  if (o.type === 'kill') {
    const done = (world.missions.kills || 0) - world.missions.killsAtStart;
    return o.label.replace(/\(\d+\/\d+\)/, `(${Math.min(done, o.count)}/${o.count})`);
  }
  if (o.type === 'robAtm') {
    const done = (world.missions.robs || 0) - world.missions.robsAtStart;
    return o.label.replace(/\(\d+\/\d+\)/, `(${Math.min(done, o.count)}/${o.count})`);
  }
  if (o.type === 'survive') {
    return `${o.label.split(' (')[0]} (${Math.ceil(o.timer)}s)`;
  }
  return o.label;
}

// Advance the mission state machine. Returns 'missionDone' | 'storyDone' | null.
export function stepMissions(world, dt) {
  const ms = world.missions;
  if (ms.done) return null;
  const o = currentObjective(world);
  if (!o) return completeMission(world);
  const p = world.player;
  let done = false;
  if (o.type === 'goto') {
    const d = Math.hypot(p.x - o.x, p.z - o.z);
    done = d <= o.radius && (!o.inCar || p.inCar);
  } else if (o.type === 'enterCar') {
    done = !!p.inCar;
  } else if (o.type === 'kill') {
    const kills = (ms.kills || 0) - ms.killsAtStart;
    done = kills >= o.count;
    // Top up enemies if the player cleared the first wave early.
    if (!done && world.enemies.length === 0 && kills < o.count) {
      spawnEnemies(world, o.kind === 'mixed' ? 'gang' : o.kind, 2, p.x + 25, p.z, world.rng);
    }
  } else if (o.type === 'robAtm') {
    const robs = (ms.robs || 0) - ms.robsAtStart;
    done = robs >= o.count;
  } else if (o.type === 'survive') {
    // Pin the heat at the required level while surviving: without this, heat decay
    // would drop wanted below the level and the timer would stall forever.
    p.heat = Math.max(p.heat || 0, o.level);
    if ((p.wanted || 0) >= o.level) o.timer -= dt;
    done = o.timer <= 0;
  } else if (o.type === 'chase') {
    const t = ms.targetCar;
    done = !t || t.hp <= 0;
    if (!done && t) {
      // The courier flees from the player.
      const dx = t.x - p.x, dz = t.z - p.z;
      const d = Math.hypot(dx, dz);
      t.heading = Math.atan2(dx, dz);
      t.speed = Math.min(30, t.speed + 8 * dt);
      t.x += Math.sin(t.heading) * t.speed * dt;
      t.z += Math.cos(t.heading) * t.speed * dt;
    }
  }
  if (!done) return null;
  o.done = true;
  ms.objIndex += 1;
  if (ms.objIndex < ms.objectives.length) {
    const next = ms.objectives[ms.objIndex];
    if (next.type === 'kill') {
      spawnEnemies(world, next.kind === 'mixed' ? 'king' : next.kind, next.count + 1, p.x + 30, p.z, world.rng);
    }
    if (next.type === 'survive') p.heat = Math.max(p.heat || 0, next.level);
    if (next.type === 'chase') {
      const car = createCar('sport', p.x + 60, p.z + 40, 0, 'courier');
      car.hp = 120; car.maxHp = 120;
      world.cars.push(car);
      ms.targetCar = car;
    }
    return null;
  }
  return completeMission(world);
}

function completeMission(world) {
  const ms = world.missions;
  const reward = MISSION_REWARD[ms.index] ?? 500;
  world.player.cash += reward;
  world.missionsDone += 1;
  sfx.mission();
  world.feed.push(`Mission complete: ${ms.title} — +$${reward}.`);
  const next = MISSIONS[ms.index].nextIndex;
  if (next === null || next === undefined) {
    ms.done = true;
    world.storyComplete = true;
    world.feed.push('STORY COMPLETE — Solmar Bay is yours.');
    return 'storyDone';
  }
  startMission(world, next);
  return 'missionDone';
}
