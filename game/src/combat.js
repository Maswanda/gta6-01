// Combat v2: fists plus three guns — pistol, shotgun and SMG — with per-
// weapon magazines, switching on 1/2/3 (Q cycles), and two enemy kinds: the
// Kestrel brawlers who close in and swing, and the shooters who keep their
// distance and fire back. Muzzle flashes and takedown bursts run through
// the effects pool.
import { CFG, WEAPONS } from './config.js';

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.weapon = 'pistol';
    this.unlocked = { pistol: true, shotgun: false, smg: false };
    this.ammo = { pistol: CFG.magSize, shotgun: CFG.shotgunMag, smg: CFG.smgMag };
    this.reserve = { pistol: 48, shotgun: 18, smg: 90 };
    this.punchTimer = 0;
    this.shootTimer = 0;
    this.tracer = null;
    this.tracerTimer = 0;
    this.enemies = [];
  }

  get def() {
    return WEAPONS[this.weapon];
  }

  get mag() {
    return this.ammo[this.weapon];
  }

  get spare() {
    return this.reserve[this.weapon];
  }

  unlock(name, world) {
    if (this.unlocked[name]) return;
    this.unlocked[name] = true;
    world.hud.flashMessage(`New weapon unlocked: ${WEAPONS[name].name} — press ${name === 'shotgun' ? '2' : '3'} to use it`);
    world.sound.jingle();
  }

  switchWeapon(name, world) {
    if (!this.unlocked[name] || this.weapon === name) return;
    this.weapon = name;
    world.hud.flashMessage(`${WEAPONS[name].name} ready — ${this.ammo[name]}/${this.reserve[name]} rounds`);
    world.sound.blip(660, 0.06, 'square', 0.15);
  }

  cycleWeapon(world) {
    const order = ['pistol', 'shotgun', 'smg'].filter((w) => this.unlocked[w]);
    const i = order.indexOf(this.weapon);
    this.switchWeapon(order[(i + 1) % order.length], world);
  }

  update(dt, world) {
    if (this.punchTimer > 0) this.punchTimer -= dt;
    if (this.shootTimer > 0) this.shootTimer -= dt;
    if (this.tracer) {
      this.tracerTimer -= dt;
      if (this.tracerTimer <= 0) {
        this.scene.remove(this.tracer);
        this.tracer = null;
      }
    }
    const player = world.player;
    const pp = player.inCar ? player.inCar.pos : player.pos;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const dx = pp.x - e.pos.x;
      const dz = pp.z - e.pos.z;
      const d = Math.hypot(dx, dz);
      e.attackTimer -= dt;
      if (e.kind === 'shooter') {
        // Keep a firing distance, strafe a little, shoot when in range.
        // Guard d ~ 0 (player standing on the shooter): dividing by d
        // would poison the position with NaN, so hold still instead.
        if (d > 16) {
          e.pos.x += (dx / d) * 3.0 * dt;
          e.pos.z += (dz / d) * 3.0 * dt;
        } else if (d > 0.01 && d < 8) {
          e.pos.x -= (dx / d) * 2.0 * dt;
          e.pos.z -= (dz / d) * 2.0 * dt;
        }
        e.heading = Math.atan2(dx, dz);
        if (e.attackTimer <= 0 && d < 26) {
          e.attackTimer = 1.6;
          world.sound.shot();
          world.effects.muzzle(e.pos.clone().setY(1.4), e.pos.clone().sub(pp).normalize().multiplyScalar(-1));
          player.damage(7);
          world.hud.flashMessage('Kestrel shooter hit you!');
        }
      } else {
        if (d > 2.2) {
          const sp = 3.4;
          e.pos.x += (dx / d) * sp * dt;
          e.pos.z += (dz / d) * sp * dt;
          e.heading = Math.atan2(dx, dz);
        } else if (e.attackTimer <= 0) {
          e.attackTimer = 1.1;
          player.damage(9);
          world.hud.flashMessage('Kestrel crew hit you!');
          world.sound.punch();
        }
      }
      e.mesh.position.copy(e.pos);
      e.mesh.rotation.y = e.heading;
      const t = performance.now() / 1000;
      e.mesh.children.forEach((c, i) => {
        if (c.geometry && c.geometry.type === 'BoxGeometry' && c.position.y < 0.8) {
          c.rotation.x = Math.sin(t * 9 + i) * 0.4;
        }
      });
    }
  }

  tryPunch(world) {
    if (this.punchTimer > 0 || world.player.inCar) return false;
    this.punchTimer = CFG.punchCooldown;
    world.sound.punch();
    const p = world.player;
    const f = p.forward;
    const hit = (pos, radius, damage, knock) => {
      const dx = pos.x - p.pos.x;
      const dz = pos.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      const along = dx * f.x + dz * f.z;
      const side = Math.abs(dx * f.z - dz * f.x);
      // Point-blank: a target standing on the player is always in reach.
      if (d < 1.0 || (along > 0 && along < CFG.punchRange + radius && side < 1.2)) {
        if (knock) {
          pos.x += f.x * 1.6;
          pos.z += f.z * 1.6;
        }
        return damage;
      }
      return 0;
    };
    let any = false;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const dmg = hit(e.pos, 0.6, CFG.punchDamage, true);
      if (dmg > 0) {
        e.hp -= dmg;
        any = true;
        world.effects.burst(e.pos, 0xff5a4a, 5, 2, 0.4);
        if (e.hp <= 0) this.dropEnemy(e, world);
      }
    }
    if (!any) {
      for (const ped of world.peds.list) {
        if (ped.down > 0) continue;
        const dx = ped.pos.x - p.pos.x;
        const dz = ped.pos.z - p.pos.z;
        const d = Math.hypot(dx, dz);
        const along = dx * f.x + dz * f.z;
        const side = Math.abs(dx * f.z - dz * f.x);
        // Point-blank: a ped standing on the player is always in reach.
        if (d < 1.0 || (along > 0 && along < CFG.punchRange + 0.5 && side < 1.2)) {
          ped.down = 1;
          ped.downTimer = 0;
          world.police.addWanted(1, world);
          any = true;
        }
      }
    }
    return any;
  }

  tryShoot(world) {
    if (this.shootTimer > 0 || world.player.inCar) return false;
    const def = this.def;
    if (this.ammo[this.weapon] <= 0) {
      world.hud.flashMessage('Magazine empty — press R to reload');
      world.sound.blip(140, 0.08, 'square', 0.2);
      this.shootTimer = 0.3;
      return false;
    }
    this.shootTimer = def.cooldown;
    this.ammo[this.weapon] -= 1;
    world.sound.shot();
    world.gunshotTimer = 1.5;
    const p = world.player;
    const f = p.forward;
    const origin = p.pos.clone();
    origin.y = 1.4;
    world.effects.muzzle(origin, f);
    const end = origin.clone().addScaledVector(f, def.range);
    const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
    this.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe98a }));
    this.scene.add(this.tracer);
    this.tracerTimer = 0.06;
    // Shotgun: several pellets, each with its own spread.
    const pellets = def.pellets || 1;
    let hitAny = false;
    for (let pi = 0; pi < pellets; pi++) {
      const spread = pellets > 1 ? (Math.random() - 0.5) * 0.22 : 0;
      const dir = new THREE.Vector3(
        f.x * Math.cos(spread) - f.z * Math.sin(spread), 0,
        f.x * Math.sin(spread) + f.z * Math.cos(spread),
      );
      let best = null;
      let bestD = Infinity;
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        const dx = e.pos.x - p.pos.x;
        const dz = e.pos.z - p.pos.z;
        const d = Math.hypot(dx, dz);
        const along = dx * dir.x + dz * dir.z;
        const side = Math.abs(dx * dir.z - dz * dir.x);
        // Point-blank: an enemy standing on the player is always hit.
        const inArc = along > 0 && along < def.range && side < 1.4;
        const reach = d < 1.5 ? 0 : along;
        if ((inArc || d < 1.5) && reach < bestD) {
          best = e;
          bestD = reach;
        }
      }
      if (best) {
        best.hp -= def.damage;
        hitAny = true;
        world.effects.burst(best.pos, 0xff5a4a, 4, 2, 0.35);
        if (best.hp <= 0) this.dropEnemy(best, world);
      }
    }
    if (hitAny) world.hud.flashMessage('Hit!');
    return hitAny;
  }

  reload(world) {
    const def = this.def;
    if (this.ammo[this.weapon] === def.mag || this.reserve[this.weapon] <= 0) return;
    const need = def.mag - this.ammo[this.weapon];
    const take = Math.min(need, this.reserve[this.weapon]);
    this.ammo[this.weapon] += take;
    this.reserve[this.weapon] -= take;
    world.sound.blip(520, 0.07, 'square', 0.18);
    world.hud.flashMessage(`Reloaded ${def.name} — ${this.ammo[this.weapon]}/${this.reserve[this.weapon]} rounds`);
  }

  // specs: an array of { pos, kind } — 'brawler' closes in and swings,
  // 'shooter' keeps its distance and fires. Mixed crews are fine.
  spawnEnemies(world, specs) {
    this.clearEnemies();
    for (const spec of specs) {
      const pos = spec.pos;
      const kind = spec.kind || 'brawler';
      const g = new THREE.Group();
      const isShooter = kind === 'shooter';
      const jacket = new THREE.MeshLambertMaterial({ color: isShooter ? 0x2a3a5a : 0x8a2a2a });
      const skin = new THREE.MeshLambertMaterial({ color: 0xb07a4a });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.9, 0.42), jacket);
      body.position.y = 1.15;
      g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
      head.position.y = 1.8;
      g.add(head);
      const legs = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.7, 0.32),
        new THREE.MeshLambertMaterial({ color: 0x222222 }),
      );
      legs.position.y = 0.35;
      g.add(legs);
      if (isShooter) {
        // A long gun, so the player can tell at a glance.
        const gun = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.12, 1.1),
          new THREE.MeshLambertMaterial({ color: 0x111111 }),
        );
        gun.position.set(0.3, 1.2, 0.5);
        g.add(gun);
      }
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1.15, 24),
        new THREE.MeshBasicMaterial({ color: isShooter ? 0xff8833 : 0xff3333, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.06;
      g.add(ring);
      g.position.copy(pos);
      this.scene.add(g);
      this.enemies.push({
        mesh: g, pos: pos.clone(), heading: 0,
        hp: isShooter ? 80 : 100, attackTimer: 0, kind: kind || 'brawler',
      });
    }
  }

  dropEnemy(e, world) {
    e.mesh.rotation.x = -Math.PI / 2;
    e.mesh.position.y = 0.3;
    world.effects.burst(e.pos, 0xff5a4a, 12, 3, 0.7);
    world.effects.cashShower(e.pos.clone().setY(1));
    world.sound.register();
    world.player.cash += 40;
    world.hud.showCashPopup(40);
    world.hud.flashMessage('Kestrel down — +$40');
  }

  clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies = [];
  }

  enemiesLeft() {
    return this.enemies.filter((e) => e.hp > 0).length;
  }
}
