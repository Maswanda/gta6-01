// combat.js — Weapons and enemies for Solmar Bay.
// Hitscan shooting: aim along the player heading, hit the nearest
// living enemy inside a narrow cone and weapon range. Ammo, reload,
// weapon unlocks (shotgun after the docks, SMG after the warehouse)
// and enemy AI (approach and shoot back) live here.
import * as THREE from 'three';
import { TUNE, clamp, dist2d } from './tuning.js';

export class Combat {
  constructor(world) {
    this.world = world;
    this.ammo = { pistol: 12, shotgun: 6, smg: 30 };
    this.weapon = 'pistol';
    this.enemies = [];
    this.recentShot = 0;
    this._fireTimer = 0;
    this._reloadTimer = 0;
    this._reloading = false;
  }
  get enemiesLeft() {
    return this.enemies.filter((e) => e.hp > 0).length;
  }
  selectWeapon(id) {
    const world = this.world;
    if (!TUNE.weapons[id]) return false;
    if (id === 'shotgun' && !world.unlocked.shotgun) return false;
    if (id === 'smg' && !world.unlocked.smg) return false;
    this.weapon = id;
    this._reloading = false;
    this._reloadTimer = 0;
    return true;
  }
  reload() {
    if (this._reloading) return;
    const spec = TUNE.weapons[this.weapon];
    if (this.ammo[this.weapon] >= spec.mag) return;
    this._reloading = true;
    this._reloadTimer = spec.reloadSec;
    this.world.audio.blip(300, 0.06, 'square', 0.08, 200);
  }
  tryShoot() {
    const world = this.world;
    if (this._reloading || this._fireTimer > 0) return;
    const spec = TUNE.weapons[this.weapon];
    if (this.ammo[this.weapon] <= 0) {
      this.reload();
      return;
    }
    this._fireTimer = spec.fireSec;
    this.ammo[this.weapon] -= 1;
    this.recentShot = 0.6;
    world.audio.shot(this.weapon);
    const p = world.player;
    const muzzle = new THREE.Vector3(
      p.pos.x + Math.sin(p.heading) * 1.1,
      1.2,
      p.pos.z + Math.cos(p.heading) * 1.1,
    );
    world.effects.muzzle(muzzle, p.heading);
    // Find the best target: nearest living enemy inside the cone.
    let best = null;
    let bestD = spec.range;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const d = dist2d(p.pos.x, p.pos.z, e.pos.x, e.pos.z);
      if (d > spec.range) continue;
      const ang = Math.atan2(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
      let diff = ang - p.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const cone = spec.spread * 3 + 0.12;
      if (Math.abs(diff) < cone && d < bestD) {
        bestD = d;
        best = e;
      }
    }
    if (best) {
      this.damageEnemy(best, spec.damage, world);
      const hitPos = new THREE.Vector3(best.pos.x, 1.2, best.pos.z);
      world.effects.hitSpark(hitPos);
    }
  }
  damageEnemy(e, dmg, world) {
    if (e.hp <= 0) return;
    e.hp -= dmg;
    world.effects.blood(new THREE.Vector3(e.pos.x, 1.1, e.pos.z));
    world.audio.hit();
    if (e.hp <= 0) {
      e.hp = 0;
      e.deadAt = world.time.now;
      // Fall over and fade.
      if (e.mesh) {
        e.mesh.rotation.x = -Math.PI / 2;
        e.mesh.position.y = 0.25;
      }
      world.missions.onEnemyDown(e);
    }
  }
  nearestEnemy(maxDist) {
    const p = this.world.player;
    let best = null;
    let bestD = maxDist;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const d = dist2d(p.pos.x, p.pos.z, e.pos.x, e.pos.z);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }
  // Spawn a crew of hostiles around a point (mission combat steps).
  spawnCrew(x, z, count, tag) {
    const world = this.world;
    const rng = world.rng;
    const spawned = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rng.range(-0.4, 0.4);
      const r = rng.range(6, 12);
      const ex = x + Math.sin(a) * r;
      const ez = z + Math.cos(a) * r;
      const mesh = world.scene.makeEnemyMesh();
      mesh.position.set(ex, 0, ez);
      world.scene.dynamic.add(mesh);
      const e = {
        pos: new THREE.Vector3(ex, 0, ez),
        heading: rng.range(0, Math.PI * 2),
        hp: 100,
        mesh,
        tag: tag || 'crew',
        shootTimer: rng.range(1, 2.5),
        speed: rng.range(2.2, 3.4),
      };
      this.enemies.push(e);
      spawned.push(e);
    }
    return spawned;
  }
  clearEnemies() {
    for (const e of this.enemies) {
      if (e.mesh && e.mesh.parent) e.mesh.parent.remove(e.mesh);
    }
    this.enemies = [];
  }
  update(dt) {
    const world = this.world;
    this._fireTimer = Math.max(0, this._fireTimer - dt);
    this.recentShot = Math.max(0, this.recentShot - dt);
    if (this._reloading) {
      this._reloadTimer -= dt;
      if (this._reloadTimer <= 0) {
        this._reloading = false;
        const spec = TUNE.weapons[this.weapon];
        this.ammo[this.weapon] = spec.mag;
      }
    }
    const p = world.player;
    // Enemy AI: close in, shoot back when in range.
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const d = dist2d(e.pos.x, e.pos.z, p.pos.x, p.pos.z);
      if (p.health > 0 && d < 26) {
        // Approach the player.
        const ang = Math.atan2(p.pos.x - e.pos.x, p.pos.z - e.pos.z);
        e.heading = ang;
        if (d > 9) {
          const nx = e.pos.x + Math.sin(ang) * e.speed * dt;
          const nz = e.pos.z + Math.cos(ang) * e.speed * dt;
          const fixed = world.city.resolveCircle(nx, nz, 0.6);
          e.pos.x = fixed.x;
          e.pos.z = fixed.z;
        }
        // Shoot back.
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && d < 20) {
          e.shootTimer = 1.6 + world.rng.range(0, 1);
          const hitChance = clamp(0.5 - d / 50, 0.1, 0.45);
          if (world.rng.chance(hitChance)) {
            world.damagePlayer(8 + world.rng.range(0, 8), e.pos);
          }
          world.audio.blip(190, 0.07, 'square', 0.06, 90);
          const muzzle = new THREE.Vector3(e.pos.x + Math.sin(ang), 1.2, e.pos.z + Math.cos(ang));
          world.effects.muzzle(muzzle, ang);
        }
      }
      e.mesh.position.set(e.pos.x, 0, e.pos.z);
      e.mesh.rotation.y = e.heading;
    }
    // Remove long-dead enemies.
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.hp <= 0 && world.time.now - (e.deadAt || 0) > 12) {
        if (e.mesh && e.mesh.parent) e.mesh.parent.remove(e.mesh);
        this.enemies.splice(i, 1);
      }
    }
  }
}
