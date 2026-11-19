// combat.js — weapons and enemies. Hitscan shooting: the player aims with
// their heading, G fires, R reloads. Enemy bullets damage the CAR when the
// player is inside one (2/hit) and never the player — that is the v4 rule.
// Enemies are spawned by missions (docks, warehouse, casino vault).
import { T, dist, angDiff, clamp } from './tuning.js';

let enemySeq = 0;

export class Combat {
  constructor() {
    this.weapon = 'pistol';
    this.ammo = { pistol: 12, shotgun: 0, smg: 0 };
    this.reserve = { pistol: 96, shotgun: 0, smg: 0 };
    this.enemies = [];
    this.cooldown = 0;
    this.fireFlash = 0;
  }
  get unlocked() {
    return { shotgun: this.reserve.shotgun > 0 || this.ammo.shotgun > 0 || this.weapon === 'shotgun', smg: this.reserve.smg > 0 || this.ammo.smg > 0 || this.weapon === 'smg' };
  }
  unlock(kind) {
    const w = T.weapons[kind];
    if (!w) return;
    if (this.ammo[kind] === 0 && this.reserve[kind] === 0) {
      this.ammo[kind] = w.mag;
      this.reserve[kind] = w.reserve;
    }
  }
  switchWeapon(kind) {
    if (!T.weapons[kind]) return false;
    if (kind !== 'pistol' && this.ammo[kind] <= 0 && this.reserve[kind] <= 0) return false;
    this.weapon = kind;
    return true;
  }
  reload() {
    const w = T.weapons[this.weapon];
    const need = w.mag - this.ammo[this.weapon];
    if (need <= 0 || this.reserve[this.weapon] <= 0) return false;
    const take = Math.min(need, this.reserve[this.weapon]);
    this.ammo[this.weapon] += take;
    this.reserve[this.weapon] -= take;
    return true;
  }
  spawnEnemies(list) {
    // list: [{x, z, kind}] — kind 'bayking' | 'enforcer'
    for (const e of list) {
      this.enemies.push({
        id: ++enemySeq,
        kind: e.kind || 'bayking',
        pos: { x: e.x, z: e.z },
        hp: T.enemyHp,
        shootTimer: 0.8 + Math.random() * 0.8,
        heading: 0,
        mesh: null,
      });
    }
  }
  get alive() { return this.enemies.filter((e) => e.hp > 0); }
  get enemiesLeft() { return this.alive.length; }
  clearEnemies() { this.enemies = []; }
  // Fire the current weapon along the player's heading. Returns hits.
  // The helicopter is a valid target too (2D aim at its ground position):
  // gunfire brings it down, which is how mission 11 is won.
  fire(player, audio, world) {
    if (this.cooldown > 0) return 0;
    const w = T.weapons[this.weapon];
    if (this.ammo[this.weapon] <= 0) { this.reload(); return 0; }
    this.cooldown = w.rate;
    this.ammo[this.weapon] -= 1;
    this.fireFlash = 0.08;
    if (audio) audio.shot(this.weapon);
    const origin = player.inCar ? player.inCar.pos : player.pos;
    const heading = player.heading;
    let hits = 0;
    const pellets = w.pellets || 1;
    for (let p = 0; p < pellets; p++) {
      const spread = (pellets > 1 ? (p - (pellets - 1) / 2) * 0.09 : 0);
      const aim = heading + spread;
      let best = null, bestD = w.range, bestAng = 0.35;
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        const d = dist(origin.x, origin.z, e.pos.x, e.pos.z);
        if (d > w.range) continue;
        const ang = Math.abs(angDiff(aim, Math.atan2(e.pos.x - origin.x, e.pos.z - origin.z)));
        // Wider cone up close, tighter far away.
        const cone = 0.35 + (1 - d / w.range) * 0.25;
        if (ang < cone && d < bestD) { best = e; bestD = d; bestAng = ang; }
      }
      if (best) {
        best.hp -= w.damage;
        hits++;
        if (best.hp <= 0) best.hp = 0;
      }
      // Helicopter: same cone test against its ground position. Each
      // pellet that would hit it deals full weapon damage.
      const heli = world && world.heli;
      if (heli && heli.active) {
        const d = dist(origin.x, origin.z, heli.pos.x, heli.pos.z);
        if (d <= w.range) {
          const ang = Math.abs(angDiff(aim, Math.atan2(heli.pos.x - origin.x, heli.pos.z - origin.z)));
          const cone = 0.35 + (1 - d / w.range) * 0.25;
          if (ang < cone) {
            heli.damage(w.damage, world);
            hits++;
          }
        }
      }
    }
    return hits;
  }
  // Enemies shoot at the player. On foot the player takes damage; in a car
  // the CAR takes 2/hit and the player is safe inside it.
  update(dt, player, world) {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.fireFlash > 0) this.fireFlash -= dt;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const target = player.inCar ? player.inCar.pos : player.pos;
      const d = dist(e.pos.x, e.pos.z, target.x, target.z);
      e.heading = Math.atan2(target.x - e.pos.x, target.z - e.pos.z);
      e.shootTimer -= dt;
      if (d < T.enemyShootRange && e.shootTimer <= 0) {
        e.shootTimer = T.enemyShootInterval * (0.8 + Math.random() * 0.5);
        if (player.inCar) {
          player.inCar.damage(T.enemyBulletCarDamage);
        } else {
          player.damage(T.enemyBulletPlayerDamage);
        }
        if (world.effects) world.effects.muzzle(e.pos.x, e.pos.z);
      }
      // Enemies close in slowly if far away.
      if (d > 18) {
        const step = 3.2 * dt;
        e.pos.x += Math.sin(e.heading) * step;
        e.pos.z += Math.cos(e.heading) * step;
      }
    }
    // Drop dead enemies from the list once the player is far away.
    if (this.enemies.length > 40) this.enemies = this.enemies.filter((e) => e.hp > 0);
  }
}
