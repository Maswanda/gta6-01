// Combat: weapons, enemies, shooting, punching, reload.
// The harness aims by setting player.heading at the target and pressing G,
// so a shot hits the nearest living enemy inside a cone in front.
import * as THREE from 'three';
import { T } from './tuning.js';

const WEAPONS = {
  pistol: { damage: T.pistolDamage, mag: T.pistolMag, range: T.pistolRange, name: 'Pistol' },
  shotgun: { damage: T.shotgunDamage, mag: T.shotgunMag, range: 40, name: 'Shotgun' },
  smg: { damage: T.smgDamage, mag: T.smgMag, range: 55, name: 'SMG' },
};

export class Combat {
  constructor(world) {
    this.world = world;
    this.weapon = 'pistol';
    this.ammo = { pistol: T.pistolAmmoStart, shotgun: 0, smg: 0 };
    this.reserve = { pistol: 999, shotgun: 999, smg: 999 };
    this.unlocked = { shotgun: false, smg: false };
    this.enemies = [];
    this.reloadTimer = 0;
    this.shootCooldown = 0;
  }

  weaponDef() {
    return WEAPONS[this.weapon];
  }

  spawnEnemies(kind, x, z, count) {
    const w = this.world;
    const made = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + 0.6;
      const ex = x + Math.cos(a) * 14;
      const ez = z + Math.sin(a) * 14;
      const e = {
        id: `${kind}-${Date.now()}-${i}`,
        kind,
        pos: new THREE.Vector3(ex, 0, ez),
        hp: T.enemyHp,
        alive: true,
        shootTimer: 0.8 + i * 0.4,
        mesh: null,
      };
      e.mesh = w.scene.makeEnemyMesh(e);
      e.mesh.position.copy(e.pos);
      this.enemies.push(e);
      made.push(e);
    }
    return made;
  }

  enemiesLeft() {
    return this.enemies.filter((e) => e.hp > 0).length;
  }

  clearEnemies() {
    for (const e of this.enemies) {
      if (e.mesh) this.world.scene.removeMesh(e.mesh);
    }
    this.enemies = [];
  }

  // Fire the current weapon. Returns the enemy hit, or null.
  shoot() {
    const w = this.world;
    if (this.reloadTimer > 0 || this.shootCooldown > 0) return null;
    if (this.ammo[this.weapon] <= 0) {
      this.reload();
      return null;
    }
    this.ammo[this.weapon]--;
    this.shootCooldown = 0.18;
    w.audio.shot();
    const p = w.player.inCar ? w.player.inCar.pos : w.player.pos;
    const def = this.weaponDef();
    let best = null;
    let bestScore = Infinity;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const dx = e.pos.x - p.x;
      const dz = e.pos.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > def.range) continue;
      const ang = Math.atan2(dx, dz);
      let diff = Math.abs(ang - w.player.heading);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff > T.pistolCone) continue;
      const score = d + diff * 20;
      if (score < bestScore) {
        best = e;
        bestScore = score;
      }
    }
    if (best) {
      best.hp -= def.damage;
      w.effects.muzzle(p, w.player.heading);
      if (best.hp <= 0) {
        best.hp = 0;
        if (best.mesh) best.mesh.visible = false;
        w.audio.blip(180, 0.15, 'sawtooth', 0.2);
      }
      return best;
    }
    w.effects.muzzle(p, w.player.heading);
    return null;
  }

  reload() {
    if (this.reloadTimer > 0) return;
    const def = this.weaponDef();
    if (this.ammo[this.weapon] >= def.mag) return;
    this.reloadTimer = T.reloadTime;
  }

  punch() {
    // F: a melee swing. Its real job in v4 is stopping an ATM thief —
    // the key handler consumes F before the crime system sees it, so the
    // punch itself asks crime whether a thief is in reach (fix #5).
    this.world.audio.blip(90, 0.08, 'square', 0.15);
    if (this.world.crime) return this.world.crime.tryAtmPunch();
    return false;
  }

  switchWeapon(name) {
    if (name === 'shotgun' && !this.unlocked.shotgun) return false;
    if (name === 'smg' && !this.unlocked.smg) return false;
    if (!WEAPONS[name]) return false;
    this.weapon = name;
    return true;
  }

  unlock(name) {
    if (name === 'shotgun') {
      this.unlocked.shotgun = true;
      this.ammo.shotgun = WEAPONS.shotgun.mag;
    }
    if (name === 'smg') {
      this.unlocked.smg = true;
      this.ammo.smg = WEAPONS.smg.mag;
    }
  }

  step(dt) {
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const def = this.weaponDef();
        this.ammo[this.weapon] = def.mag;
        this.reloadTimer = 0;
      }
    }
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    // Enemies shoot back at the player.
    const w = this.world;
    const p = w.player.inCar ? w.player.inCar.pos : w.player.pos;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      e.shootTimer -= dt;
      if (e.shootTimer > 0) continue;
      e.shootTimer = T.enemyShootInterval;
      const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z);
      if (d > T.enemyShootRange) continue;
      if (w.player.inCar) {
        // Enemy bullets vs a car: 2 hp per hit (v4 fix).
        w.player.inCar.hp -= T.policeRamCarDamage;
        if (w.player.inCar.hp <= 0) {
          w.player.inCar.hp = 0;
          w.game.ejectFromWreck();
        }
      } else {
        w.player.health -= T.enemyShootDamage;
        if (w.player.health <= 0) {
          w.player.health = 0;
          w.game.respawn();
        }
      }
    }
  }
}
