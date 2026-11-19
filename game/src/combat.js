// Combat: 3 weapons, bullets, 2 enemy types. The player shoots; enemies shoot back.
// KEY RULE (bug fix from fab2d34): an enemy bullet that hits a player who is inside a car
// damages the CAR (2/hit), never the player inside it.
import { WEAPONS, ENEMY, STEP } from './tuning.js';
import { createRng } from './rng.js';
import { sfx } from './audio.js';

let nextBulletId = 1;
let nextEnemyId = 1;

export function spawnEnemies(world, kind, count, x, z, rng) {
  const spec = ENEMY[kind];
  const made = [];
  for (let i = 0; i < count; i += 1) {
    const a = rng ? rng.range(0, Math.PI * 2) : (i / count) * Math.PI * 2;
    const r = rng ? rng.range(8, 18) : 12;
    made.push({
      id: nextEnemyId, kind, x: x + Math.sin(a) * r, z: z + Math.cos(a) * r,
      heading: 0, hp: spec.hp, maxHp: spec.hp, cooldown: 0, state: 'hunt',
    });
    nextEnemyId += 1;
  }
  world.enemies.push(...made);
  return made;
}

export function fireWeapon(world, from, tx, tz, weaponName, owner) {
  const w = WEAPONS[weaponName];
  if (!w) return false;
  const dx = tx - from.x, dz = tz - from.z;
  const base = Math.atan2(dx, dz);
  const n = w.pellets || 1;
  for (let i = 0; i < n; i += 1) {
    const a = base + (Math.random() - 0.5) * w.spread * 2;
    const speed = 90;
    world.bullets.push({
      id: nextBulletId, x: from.x, z: from.z,
      vx: Math.sin(a) * speed, vz: Math.cos(a) * speed,
      life: w.range / speed, from: owner, damage: w.damage,
    });
    nextBulletId += 1;
  }
  if (owner === 'player') {
    if (weaponName === 'shotgun') sfx.shotgun(); else sfx.shot();
  }
  return true;
}

export function stepBullets(world, dt) {
  const p = world.player;
  for (const b of world.bullets) {
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    // Enemy bullets vs the player: in a car => the CAR takes 2/hit; on foot => the player.
    if (b.from === 'enemy') {
      const d = Math.hypot(b.x - p.x, b.z - p.z);
      if (d < 2.2) {
        b.life = 0;
        if (p.inCar) {
          const car = world.cars.find((c) => c.id === p.inCar);
          if (car) car.hp = Math.max(0, car.hp - 2);
        } else {
          p.hp = Math.max(0, p.hp - 8);
          sfx.hit();
        }
        continue;
      }
    }
    // Player bullets vs enemies.
    if (b.from === 'player') {
      for (const e of world.enemies) {
        if (e.hp <= 0) continue;
        const d = Math.hypot(b.x - e.x, b.z - e.z);
        if (d < 1.8) {
          b.life = 0;
          e.hp = Math.max(0, e.hp - b.damage);
          spawnHitSpark(world, e.x, e.z);
          if (e.hp <= 0) onEnemyKilled(world, e);
          break;
        }
      }
      if (b.life <= 0) continue;
      // Player bullets vs police cars (raises heat, damages the car).
      for (const car of world.cars) {
        if (car.driver !== 'police' || car.hp <= 0) continue;
        const d = Math.hypot(b.x - car.x, b.z - car.z);
        if (d < 2.4) {
          b.life = 0;
          car.hp = Math.max(0, car.hp - b.damage);
          world.player.heat = Math.min(5, (world.player.heat || 0) + 0.2);
          break;
        }
      }
      if (b.life <= 0) continue;
      // Player bullets vs the mission courier car (chase objective).
      const target = world.missions.targetCar;
      if (target && target.hp > 0) {
        const d = Math.hypot(b.x - target.x, b.z - target.z);
        if (d < 2.4) {
          b.life = 0;
          target.hp = Math.max(0, target.hp - b.damage);
          spawnHitSpark(world, target.x, target.z);
        }
      }
    }
  }
  world.bullets = world.bullets.filter((b) => b.life > 0);
  // Clean up dead enemies.
  world.enemies = world.enemies.filter((e) => e.hp > 0);
}

function onEnemyKilled(world, e) {
  const p = world.player;
  p.cash += e.kind === 'king' ? 120 : 60;
  p.heat = Math.min(5, (p.heat || 0) + 1);
  p.wanted = Math.min(5, Math.max(p.wanted, p.heat >= 3 ? 2 : 1));
  world.missions.kills = (world.missions.kills || 0) + 1;
  spawnHitSpark(world, e.x, e.z);
  sfx.cash();
}

export function spawnHitSpark(world, x, z) {
  for (let i = 0; i < 5; i += 1) {
    world.particles.push({
      id: world.particleId++, x, y: 1.2, z,
      life: 0.5, color: 0xffe040,
    });
  }
}

// Enemies hunt the player: walk toward them, shoot when in range and on cooldown.
export function stepEnemies(world, dt) {
  const p = world.player;
  for (const e of world.enemies) {
    const spec = ENEMY[e.kind];
    const d = Math.hypot(p.x - e.x, p.z - e.z);
    e.heading = Math.atan2(p.x - e.x, p.z - e.z);
    e.cooldown -= dt;
    if (d > spec.range * 0.9) {
      e.x += Math.sin(e.heading) * spec.speed * dt;
      e.z += Math.cos(e.heading) * spec.speed * dt;
    } else if (e.cooldown <= 0 && d < spec.range) {
      e.cooldown = spec.rate;
      fireWeapon(world, e, p.x, p.z, 'pistol', 'enemy');
    }
  }
}

export function resetCombatIds() { nextBulletId = 1; nextEnemyId = 1; }
