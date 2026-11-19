// Police: wanted 0-5, pursuit cars, roadblocks at 4+ stars, bust / wasted.
// The autopilot never fails a mission: busted or wasted just respawns the player
// (safehouse / hospital), clears wanted, and the mission continues.
import { POLICE, PLAYER, CAR } from './tuning.js';
import { createCar, stepCar, bumpCars, nearestCar } from './drive.js';
import { collideCircle, nearestRoadPoint } from './city.js';
import { sfx } from './audio.js';

export function wantedFor(heat) {
  if (heat < 1) return 0;
  if (heat < 2) return 1;
  if (heat < 3) return 2;
  if (heat < 4) return 3;
  if (heat < 5) return 4;
  return 5;
}

export function stepPolice(world, dt) {
  const p = world.player;
  p.wanted = wantedFor(p.heat || 0);
  // Heat decays when the player is quiet.
  if (p.heat > 0 && world.quietTimer > 6) p.heat = Math.max(0, p.heat - POLICE.heatDecay * dt * 10);
  const wanted = p.wanted;
  // Spawn pursuit cars.
  const policeCars = world.cars.filter((c) => c.driver === 'police');
  const want = wanted === 0 ? 0 : Math.min(POLICE.maxCars, wanted);
  if (policeCars.length < want) {
    const a = Math.random() * Math.PI * 2;
    const sx = p.x + Math.sin(a) * POLICE.spawnDistance;
    const sz = p.z + Math.cos(a) * POLICE.spawnDistance;
    const pt = nearestRoadPoint(sx, sz);
    const car = createCar('sedan', pt.x, pt.z, Math.atan2(p.x - pt.x, p.z - pt.z), 'police');
    world.cars.push(car);
  }
  // Remove police cars when wanted drops to 0.
  if (wanted === 0) {
    for (const car of policeCars) car.hp = 0;
    world.cars = world.cars.filter((c) => c.driver !== 'police' || c.hp > 0);
  }
  // Pursuit steering: aim at the player, ram.
  for (const car of world.cars) {
    if (car.driver !== 'police' || car.hp <= 0) continue;
    const dx = p.x - car.x, dz = p.z - car.z;
    const d = Math.hypot(dx, dz);
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, dh * 1.6));
    stepCar(world, car, { steer, throttle: d > 8 ? 1 : 0.4, drift: false }, dt);
  }
  // Car-vs-car bumps (police ramming the player).
  const playerCar = world.cars.find((c) => c.id === p.inCar);
  if (playerCar) {
    for (const car of world.cars) {
      if (car.driver !== 'police') continue;
      const impact = bumpCars(playerCar, car);
      if (impact > 0) {
        p.hp = Math.max(0, p.hp - 1);
        if (Math.random() < 0.3) sfx.hit();
      }
    }
  }
  // Roadblocks at 4+ stars: two police cars parked across the road ahead.
  if (wanted >= POLICE.roadblockAt && !world.roadblock) {
    const ahead = {
      x: p.x + Math.sin(p.heading) * 60,
      z: p.z + Math.cos(p.heading) * 60,
    };
    const pt = nearestRoadPoint(ahead.x, ahead.z);
    const c1 = createCar('sedan', pt.x - 4, pt.z, 0, 'police');
    const c2 = createCar('sedan', pt.x + 4, pt.z, 0, 'police');
    c1.speed = 0; c2.speed = 0;
    world.cars.push(c1, c2);
    world.roadblock = { x: pt.x, z: pt.z, until: world.elapsed + 25 };
  }
  if (world.roadblock && world.elapsed > world.roadblock.until) world.roadblock = null;
  // Bust: a police car close + player slow for bustSeconds.
  const near = nearestCar(world, p.x, p.z, 7, 'police');
  const playerSpeed = playerCar ? Math.abs(playerCar.speed) : (p.speed || 0);
  if (near && playerSpeed < 3 && wanted > 0) {
    p.bustTimer = (p.bustTimer || 0) + dt;
    if (p.bustTimer > PLAYER.bustSeconds) return bustPlayer(world);
  } else {
    p.bustTimer = 0;
  }
  // Wasted: hp hits 0.
  if (p.hp <= 0) return wastePlayer(world);
  // Wrecked car: the player bails out automatically.
  if (playerCar && playerCar.hp <= 0) {
    playerCar.driver = 'none';
    p.inCar = null;
    p.hp = Math.max(20, p.hp);
    world.feed.push('Your ride is wrecked — find another car.');
  }
  return null;
}

function bustPlayer(world) {
  const p = world.player;
  p.bustTimer = 0;
  p.heat = 0; p.wanted = 0;
  p.cash = Math.max(0, p.cash - PLAYER.wastedCashLoss);
  respawnAt(world, world.city.landmarks.safehouse.x, world.city.landmarks.safehouse.z);
  sfx.busted();
  world.feed.push('BUSTED — the cops dropped you at the safehouse.');
  return 'busted';
}

function wastePlayer(world) {
  const p = world.player;
  p.hp = 100; p.armor = 0;
  p.heat = 0; p.wanted = 0;
  p.cash = Math.max(0, p.cash - PLAYER.wastedCashLoss);
  respawnAt(world, world.city.landmarks.hospital.x, world.city.landmarks.hospital.z);
  world.feed.push('WASTED — you woke up at Solmar General.');
  return 'wasted';
}

function respawnAt(world, x, z) {
  const p = world.player;
  if (p.inCar) {
    const car = world.cars.find((c) => c.id === p.inCar);
    if (car) car.driver = 'none';
    p.inCar = null;
  }
  const hit = collideCircle(world.city, x, z, 0.8);
  p.x = hit.x; p.z = hit.z;
  p.heading = 0;
  p.speed = 0;
}
