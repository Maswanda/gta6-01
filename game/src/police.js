// Police: wanted-level response. Units spawn, chase, ram; roadblocks at
// 4+ stars. Wanted cools off: hidden (crouched + unseen) in 14s of game
// time, normal in 26s, faster at the safehouse — and never while the
// helicopter's spotlight is on the player.
import * as THREE from 'three';
import { T } from './tuning.js';

export class Police {
  constructor(world) {
    this.world = world;
    this.units = [];
    this.decayTimer = 0;
    this.spawnTimer = 0;
    this.roadblock = [];
  }

  unitCountFor(wanted) {
    return Math.min(5, wanted + 1);
  }

  nearestUnitDist() {
    const w = this.world;
    let best = Infinity;
    for (const u of this.units) {
      if (!u.alive) continue;
      const d = Math.hypot(u.pos.x - w.player.pos.x, u.pos.z - w.player.pos.z);
      if (d < best) best = d;
    }
    return best;
  }

  step(dt) {
    const w = this.world;
    const wanted = w.wanted;
    // Spawn / despawn to match the wanted level.
    const want = wanted > 0 ? this.unitCountFor(wanted) : 0;
    this.spawnTimer -= dt;
    if (this.units.filter((u) => u.alive).length < want && this.spawnTimer <= 0) {
      this.spawnTimer = 1.5;
      const p = w.player.pos;
      const a = w.rng() * Math.PI * 2;
      const car = w.game.spawnParkedCar(
        p.x + Math.cos(a) * T.policeSpawnDist,
        p.z + Math.sin(a) * T.policeSpawnDist,
        'police',
      );
      if (car) {
        car.isPolice = true;
        car.ramCooldown = 0;
        this.units.push(car);
      }
    }
    if (wanted === 0) {
      for (const u of this.units) {
        if (u.alive) {
          u.alive = false;
          if (u.mesh) u.mesh.visible = false;
        }
      }
      this.units = [];
    }
    // Chase + ram.
    const safehouse = w.city.landmarkPos('safehouse');
    const nearSafehouse = Math.hypot(w.player.pos.x - safehouse.x, w.player.pos.z - safehouse.z) < 40;
    for (const u of this.units) {
      if (!u.alive) continue;
      if (u.ramCooldown > 0) u.ramCooldown -= dt;
      const dx = w.player.pos.x - u.pos.x;
      const dz = w.player.pos.z - u.pos.z;
      const d = Math.hypot(dx, dz);
      // Police hold off at the safehouse: it is a hiding spot.
      if (nearSafehouse && d < 45) {
        u.speed = 0;
        u.syncMesh();
        continue;
      }
      if (d > 3) {
        u.heading = Math.atan2(dx, dz);
        u.speed = Math.min(T.policeChaseSpeed, d * 0.8 + 6);
        const nx = u.pos.x + Math.sin(u.heading) * u.speed * dt;
        const nz = u.pos.z + Math.cos(u.heading) * u.speed * dt;
        const hit = w.city.resolveCollision(nx, nz, 2.2);
        u.pos.set(hit.x, 0, hit.z);
        u.syncMesh();
      } else if (u.ramCooldown <= 0) {
        // Ram: one hit per second per unit (v4 fix).
        u.ramCooldown = T.policeRamCooldown;
        if (w.player.crouching) {
          // A crouched, hiding player is not rammed (v4 fix).
        } else if (w.player.inCar) {
          w.player.inCar.hp -= T.policeRamDamage;
          if (w.player.inCar.hp <= 0) {
            w.player.inCar.hp = 0;
            w.game.ejectFromWreck();
          }
        } else {
          w.player.health -= T.policeRamDamage;
          if (w.player.health <= 0) {
            w.player.health = 0;
            w.game.respawn();
          }
        }
      }
    }
    // Wanted decay.
    if (wanted > 0) {
      const heliLit = w.heli && w.heli.lit;
      if (!heliLit) {
        const hidden = w.player.crouching && this.nearestUnitDist() > 45;
        const atSafehouse = nearSafehouse;
        let rate = 0;
        if (atSafehouse) rate = dt / T.safehouseDecay;
        else if (hidden) rate = dt / T.hiddenDecay;
        else rate = dt / T.normalDecay;
        this.decayTimer += rate;
        if (this.decayTimer >= 1) {
          this.decayTimer = 0;
          w.wanted = Math.max(0, w.wanted - 1);
        }
      }
      // Safehouse healing, even while the heat is on.
      if (nearSafehouse && w.player.health < 100) {
        w.player.health = Math.min(100, w.player.health + T.safehouseHeal * dt);
      }
    }
  }
}
