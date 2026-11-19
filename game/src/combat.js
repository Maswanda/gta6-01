// combat.js — Solmar Bay: weapons, enemies and pickups.
// Hitscan shooting: the nearest enemy inside a forward cone takes the
// shot. Enemies are spawned by missions (they keep the references and
// watch them die); this module only moves, shoots and buries them.
// Pickups (cash, health, armor) are small glowing boxes the player walks over.
import * as THREE from 'three';
import { TUNE } from './tuning.js';

const ENEMY_STYLE = {
  gang: { color: 0xc22a2a, health: 50, damage: 7, range: 38, label: 'Street gang' },
  guard: { color: 0x2a3a6a, health: 80, damage: 10, range: 46, label: 'Armed guard' },
};

export class Arsenal {
  constructor(world) {
    this.world = world;
    this.lastShot = 0;
    this.pickups = [];
  }
  currentSpec() {
    return TUNE.weapons[this.world.player.weapon || 'pistol'];
  }
  giveWeapon(name, ammo = 0) {
    const p = this.world.player;
    p.weapons = p.weapons || { pistol: Infinity };
    if (name === 'pistol') {
      p.weapons.pistol = Infinity;
    } else {
      p.weapons[name] = (p.weapons[name] || 0) + ammo;
    }
    p.weapon = name;
  }
  hasWeapon(name) {
    const w = this.world.player.weapons || { pistol: Infinity };
    return (w[name] || 0) > 0;
  }
  spawnEnemy(kind, x, z, opts = {}) {
    const style = ENEMY_STYLE[kind] || ENEMY_STYLE.gang;
    const mesh = this.world.stage.makePed(style.color);
    const enemy = {
      kind, x, z, heading: Math.random() * Math.PI * 2,
      health: opts.health || style.health,
      maxHealth: opts.health || style.health,
      damage: style.damage, range: style.range,
      mesh, dead: false, shootTimer: 1 + Math.random(),
      speed: opts.speed || 6, hold: !!opts.hold, walkPhase: Math.random() * 6,
    };
    mesh.position.set(x, 0, z);
    this.world.enemies.push(enemy);
    return enemy;
  }
  removeEnemy(enemy) {
    const i = this.world.enemies.indexOf(enemy);
    if (i >= 0) this.world.enemies.splice(i, 1);
    this.world.stage.scene.remove(enemy.mesh);
  }
  spawnPickup(kind, x, z, amount) {
    const colors = { cash: 0x39d03a, health: 0xff5a5a, armor: 0x3a6fd8 };
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.9, 0.9),
      new THREE.MeshBasicMaterial({ color: colors[kind] || 0xffffff }),
    );
    mesh.position.set(x, 0.7, z);
    this.world.stage.scene.add(mesh);
    const pk = { kind, x, z, amount, mesh, bob: Math.random() * 6 };
    this.pickups.push(pk);
    return pk;
  }
  shoot() {
    const w = this.world;
    const p = w.player;
    const now = performance.now() / 1000;
    const spec = this.currentSpec();
    if (now - this.lastShot < spec.rate) return false;
    const ammo = (p.weapons || {})[p.weapon || 'pistol'];
    if (ammo !== Infinity && (ammo || 0) <= 0) {
      w.sfx.denied();
      w.hud.toast('Out of ammo — restock at the garage or safehouse.');
      return false;
    }
    this.lastShot = now;
    if (ammo !== Infinity) p.weapons[p.weapon] = ammo - 1;
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    const mx = p.x + fx * 1.4;
    const mz = p.z + fz * 1.4;
    w.fx.muzzle(mx, 1.4, mz, p.heading);
    w.sfx.shot();
    // Find the nearest enemy inside the forward cone.
    const cone = spec.pellets ? 0.6 : 0.34;
    let best = null;
    let bestD = spec.range;
    for (const e of w.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x;
      const dz = e.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > spec.range) continue;
      const dot = (dx * fx + dz * fz) / (d || 1);
      if (dot < Math.cos(cone)) continue;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    // The helicopter is a target too, when it is overhead and in front.
    let heliHit = false;
    const heli = w.heli;
    if (heli && !heli.gone) {
      const dx = heli.x - p.x;
      const dz = heli.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < spec.range + 20) {
        const dot = (dx * fx + dz * fz) / (d || 1);
        if (dot > Math.cos(0.5)) {
          heliHit = true;
          w.helicopter.damage(spec.damage);
        }
      }
    }
    if (best) {
      const dmg = spec.pellets ? spec.damage * 3 : spec.damage;
      this.damageEnemy(best, dmg);
      w.fx.burst(best.x, 1.4, best.z, 0xff5a5a, 6, 6, 0.3, 4);
    } else if (!heliHit) {
      // A tracer puff where the shot went.
      w.fx.burst(p.x + fx * spec.range * 0.7, 1.4, p.z + fz * spec.range * 0.7, 0xffd76a, 2, 2, 0.15, 0);
    }
    return true;
  }
  damageEnemy(enemy, amount) {
    enemy.health -= amount;
    if (enemy.health <= 0 && !enemy.dead) {
      enemy.dead = true;
      this.world.fx.burst(enemy.x, 1.2, enemy.z, 0xff5a5a, 12, 8, 0.6, 6);
      this.world.fx.burst(enemy.x, 1.2, enemy.z, 0xffffff, 6, 5, 0.3, 4);
      this.world.sfx.noise(0.25, 0.25, 1000);
      enemy.mesh.rotation.z = Math.PI / 2 * 0.9;
      this.spawnPickup('cash', enemy.x, enemy.z, this.world.dice.int(40, 120));
      setTimeout(() => this.removeEnemy(enemy), 4000);
    }
  }
  update(dt) {
    const w = this.world;
    const p = w.player;
    // Player fire: click or F. SMG is automatic while held.
    const spec = this.currentSpec();
    if (!p.inCar && !w.ended && w.started) {
      if (spec.auto) {
        if (w.input.mouseDown || w.input.isDown('KeyF')) this.shoot();
      } else if (w.input.wasPressed('KeyF') || (w.input.mouseDown && !this._mouseHeld)) {
        this.shoot();
      }
      this._mouseHeld = w.input.mouseDown;
    }
    // Enemies: close in (unless holding), shoot with a hit chance.
    for (const e of [...w.enemies]) {
      if (e.dead) continue;
      const dx = p.x - e.x;
      const dz = p.z - e.z;
      const d = Math.hypot(dx, dz);
      if (!e.hold && d > 6) {
        const sp = e.speed * dt;
        e.x += (dx / d) * sp;
        e.z += (dz / d) * sp;
        e.heading = Math.atan2(dx, dz);
        e.walkPhase += dt * 8;
        const swing = Math.sin(e.walkPhase) * 0.4;
        const legs = e.mesh.userData.legs || [];
        if (legs[0]) legs[0].rotation.x = swing;
        if (legs[1]) legs[1].rotation.x = -swing;
      }
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = e.heading;
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && d < e.range && !w.ended) {
        e.shootTimer = 1.1 + Math.random() * 0.7;
        const hitChance = Math.max(0.12, 0.42 - d / 140);
        w.fx.muzzle(e.x + Math.sin(e.heading) * 1.2, 1.4, e.z + Math.cos(e.heading) * 1.2, e.heading);
        w.sfx.shot();
        if (Math.random() < hitChance) {
          if (p.inCar) {
            // The car takes the bullet: bodywork, not the driver.
            // A moving car is hard to hurt — a hit only chips the paint.
            p.inCar.health -= 2;
            if (p.inCar.health <= 0) {
              const wreck = p.inCar;
              w.fx.explosion(wreck.x, 1, wreck.z);
              w.sfx.explosion();
              w.drive.exitCar();
              w.drive.removeCar(wreck);
              w.hud.toast('Your car was shot to pieces!');
            }
          } else {
            const died = w.walker.damage(e.damage);
            w.hud.toast('You took a hit!');
            if (died) w.endGame('wasted', 'The streets of Solmar Bay claimed another one.');
          }
        }
      }
    }
    // Pickups: bob, and collect on proximity.
    for (const pk of [...this.pickups]) {
      pk.bob += dt * 3;
      pk.mesh.position.y = 0.7 + Math.sin(pk.bob) * 0.15;
      pk.mesh.rotation.y += dt * 2;
      const d = Math.hypot(p.x - pk.x, p.z - pk.z);
      if (d < 2.2) {
        if (pk.kind === 'cash') {
          w.cash += pk.amount;
          w.hud.toast(`+$${pk.amount}`);
          w.sfx.cash();
        } else if (pk.kind === 'health') {
          w.walker.heal(pk.amount);
          w.hud.toast(`+${pk.amount} health`);
          w.sfx.pickup();
        } else if (pk.kind === 'armor') {
          w.walker.addArmor(pk.amount);
          w.hud.toast(`+${pk.amount} armor`);
          w.sfx.pickup();
        }
        w.stage.scene.remove(pk.mesh);
        const i = this.pickups.indexOf(pk);
        if (i >= 0) this.pickups.splice(i, 1);
      }
    }
  }
}
