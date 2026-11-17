// Combat: fists and the pistol. Punching is a short-range swing with
// knockback; the pistol is a hitscan raycast with a magazine, reload and
// muzzle feedback. Enemies (the Kestrel crew) use the same health pool.
import { CFG } from './config.js';

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.ammo = CFG.magSize;
    this.reserve = 48;
    this.punchTimer = 0;
    this.shootTimer = 0;
    this.tracer = null;
    this.tracerTimer = 0;
    this.enemies = [];
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
    // Enemies: close in and swing; they telegraph with a red marker.
    const player = world.player;
    const pp = player.inCar ? player.inCar.pos : player.pos;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const dx = pp.x - e.pos.x;
      const dz = pp.z - e.pos.z;
      const d = Math.hypot(dx, dz);
      e.attackTimer -= dt;
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
      e.mesh.position.copy(e.pos);
      e.mesh.rotation.y = e.heading;
      // Walk swing.
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
      const along = dx * f.x + dz * f.z;
      const side = Math.abs(dx * f.z - dz * f.x);
      if (along > 0 && along < CFG.punchRange + radius && side < 1.2) {
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
        if (e.hp <= 0) this.dropEnemy(e, world);
      }
    }
    // Punching a pedestrian is a crime, and they go down.
    if (!any) {
      for (const ped of world.peds.list) {
        if (ped.down > 0) continue;
        const dx = ped.pos.x - p.pos.x;
        const dz = ped.pos.z - p.pos.z;
        const along = dx * f.x + dz * f.z;
        const side = Math.abs(dx * f.z - dz * f.x);
        if (along > 0 && along < CFG.punchRange + 0.5 && side < 1.2) {
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
    if (this.ammo <= 0) {
      world.hud.flashMessage('Magazine empty — press R to reload');
      world.sound.blip(140, 0.08, 'square', 0.2);
      this.shootTimer = 0.3;
      return false;
    }
    this.shootTimer = 0.28;
    this.ammo -= 1;
    world.sound.shot();
    world.gunshotTimer = 1.5;
    const p = world.player;
    const f = p.forward;
    const origin = p.pos.clone();
    origin.y = 1.4;
    // Muzzle flash tracer.
    const end = origin.clone().addScaledVector(f, CFG.pistolRange);
    const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
    this.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe98a }));
    this.scene.add(this.tracer);
    this.tracerTimer = 0.06;
    // Hit the closest enemy near the firing line.
    let best = null;
    let bestD = Infinity;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const dx = e.pos.x - p.pos.x;
      const dz = e.pos.z - p.pos.z;
      const along = dx * f.x + dz * f.z;
      const side = Math.abs(dx * f.z - dz * f.x);
      if (along > 0 && along < CFG.pistolRange && side < 1.4 && along < bestD) {
        best = e;
        bestD = along;
      }
    }
    if (best) {
      best.hp -= CFG.pistolDamage;
      world.hud.flashMessage(`Hit! Kestrel down to ${Math.max(0, best.hp)} HP`);
      if (best.hp <= 0) this.dropEnemy(best, world);
      return true;
    }
    return false;
  }

  reload(world) {
    if (this.ammo === CFG.magSize || this.reserve <= 0) return;
    const need = CFG.magSize - this.ammo;
    const take = Math.min(need, this.reserve);
    this.ammo += take;
    this.reserve -= take;
    world.sound.blip(520, 0.07, 'square', 0.18);
    world.hud.flashMessage(`Reloaded — ${this.ammo}/${this.reserve} rounds`);
  }

  spawnEnemies(world, positions) {
    this.clearEnemies();
    for (const pos of positions) {
      const g = new THREE.Group();
      const jacket = new THREE.MeshLambertMaterial({ color: 0x8a2a2a });
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
      // Red marker so the player can spot them.
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1.15, 24),
        new THREE.MeshBasicMaterial({ color: 0xff3333, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.06;
      g.add(ring);
      g.position.copy(pos);
      this.scene.add(g);
      this.enemies.push({ mesh: g, pos: pos.clone(), heading: 0, hp: 100, attackTimer: 0 });
    }
  }

  dropEnemy(e, world) {
    e.mesh.rotation.x = -Math.PI / 2;
    e.mesh.position.y = 0.3;
    world.player.cash += 40;
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
