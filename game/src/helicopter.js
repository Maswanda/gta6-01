// helicopter.js — Solmar Bay: the PD air unit.
// Spawns at four wanted stars, climbs to cruise height and shadows the
// player. Its spotlight pins the player: while lit, the wanted level
// cannot decay (hiding does not work under the beam). The player can
// shoot it down — 100 damage makes it pull off and retreat. It will
// not come back until its cooldown clears.
import { TUNE } from './tuning.js';

export class AirUnit {
  constructor(world) {
    this.world = world;
    world.helicopter = this;
    this.cooldown = 0;
  }
  get heli() {
    return this.world.heli;
  }
  spawn() {
    const w = this.world;
    const p = w.player;
    const mesh = w.stage.makeHeli();
    const heli = {
      x: p.x - 40, y: TUNE.helicopter.cruiseHeight, z: p.z - 40,
      heading: 0, damage: 0, mesh, gone: false, retreating: false,
    };
    mesh.position.set(heli.x, heli.y, heli.z);
    w.heli = heli;
    w.hud.toast('PD AIR UNIT overhead — the spotlight is on you!');
    w.sfx.setSiren(true);
    return heli;
  }
  damage(amount) {
    const heli = this.world.heli;
    if (!heli || heli.gone) return false;
    heli.damage += amount;
    this.world.fx.burst(heli.x, heli.y, heli.z, 0xffd76a, 8, 8, 0.5, 4);
    if (heli.damage >= TUNE.helicopter.retreatDamage) {
      this.world.stats.heliDowns = (this.world.stats.heliDowns || 0) + 1;
      this.retreat(heli, 'You drove the air unit off — the beam is gone.');
      return true;
    }
    return false;
  }
  retreat(heli, msg) {
    heli.gone = true;
    heli.retreating = true;
    const ud = heli.mesh.userData;
    if (ud.spot) ud.spot.intensity = 0;
    if (ud.cone) ud.cone.visible = false;
    this.world.heliLit = false;
    if (msg) this.world.hud.toast(msg);
    this.world.sfx.noise(0.4, 0.3, 700);
  }
  update(dt) {
    const w = this.world;
    this.cooldown = Math.max(0, this.cooldown - dt);
    const stars = w.police ? w.police.stars() : 0;
    let heli = w.heli;
    // Spawn when the heat hits four stars.
    if (!heli && stars >= TUNE.helicopter.spawnAtStars && this.cooldown <= 0 && !w.ended) {
      heli = this.spawn();
    }
    if (!heli) {
      w.heliLit = false;
      return;
    }
    const p = w.player;
    if (heli.retreating) {
      // Climb and fly away, then despawn.
      heli.y += 26 * dt;
      heli.x += (heli.x - p.x) * 0.4 * dt;
      heli.z += (heli.z - p.z) * 0.4 * dt;
      heli.mesh.position.set(heli.x, heli.y, heli.z);
      heli.mesh.userData.rotor.rotation.y += dt * 34;
      const d = Math.hypot(heli.x - p.x, heli.z - p.z);
      if (heli.y > 150 || d > 260) {
        w.stage.scene.remove(heli.mesh);
        w.heli = null;
        this.cooldown = 20;
      }
      return;
    }
    // The heat fell: the air unit leaves on its own.
    if (stars < TUNE.helicopter.spawnAtStars) {
      this.retreat(heli, 'The air unit pulled off — the heat is down.');
      return;
    }
    // Follow the player, holding cruise height.
    const dx = p.x - heli.x;
    const dz = p.z - heli.z;
    const d = Math.hypot(dx, dz);
    const sp = TUNE.helicopter.followSpeed;
    if (d > 2) {
      heli.x += (dx / d) * sp * dt;
      heli.z += (dz / d) * sp * dt;
    }
    heli.heading = Math.atan2(dx, dz);
    heli.mesh.position.set(heli.x, heli.y, heli.z);
    heli.mesh.rotation.y = heli.heading;
    heli.mesh.userData.rotor.rotation.y += dt * 30;
    // Spotlight on the player: the beam pins them and freezes wanted decay.
    const ud = heli.mesh.userData;
    ud.spotTarget.position.set(p.x, 0, p.z);
    ud.spot.intensity = 7;
    ud.cone.visible = true;
    // Aim the cone at the player (the cone hangs below the heli).
    ud.cone.lookAt(p.x - heli.x, -heli.y, p.z - heli.z);
    const lit = d < TUNE.helicopter.spotlightRange + 40;
    w.heliLit = lit;
    if (heli.damage > 60 && Math.random() < dt * 2) {
      w.fx.smoke(heli.x, heli.y - 1, heli.z);
    }
  }
}
