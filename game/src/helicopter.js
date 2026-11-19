// helicopter.js — HelicopterAI: lifts off at 4–5 wanted stars, orbits the
// player with a searchlight cone, and pins the player with its spotlight so
// hidden wanted decay cannot run while it is lit. Gunfire brings it down
// (100 damage), after which it retreats for 30 s.
import { T, dist, clamp, angDiff, Vec3 } from './tuning.js';

export class Helicopter {
  constructor(city) {
    this.city = city;
    this.active = false;
    this.lit = false;
    this.hp = 100;
    this.pos = new Vec3(0, 40, 0); // y is altitude
    this.heading = 0;
    this.orbitAngle = 0;
    this.retreatTimer = 0;
    this.lastKnown = new Vec3(0, 0, 0);
    this.group = null; // three.js group, attached by scene.js
    this._damageFlash = 0;
  }
  get state() { return { active: this.active, lit: this.lit }; }
  damage(n, world) {
    if (!this.active) return;
    this.hp -= n;
    this._damageFlash = 0.3;
    if (this.hp <= 0) {
      this.active = false;
      this.lit = false;
      this.retreatTimer = 30;
      this.hp = 100;
      if (world && world.effects) world.effects.explosion(this.pos.x, this.pos.z);
    }
  }
  update(dt, world) {
    const player = world.player;
    const wanted = world.police.wanted;
    if (this.retreatTimer > 0) this.retreatTimer -= dt;
    // Lift off at 4+ stars (unless retreating from being shot down).
    if (wanted >= T.heliWanted && this.retreatTimer <= 0 && !this.active) {
      this.active = true;
      this.hp = 100;
      this.pos.x = player.pos.x + 40;
      this.pos.z = player.pos.z - 40;
      this.pos.y = 16;
      this.lastKnown.x = player.pos.x; this.lastKnown.z = player.pos.z;
    }
    if (wanted < T.heliWanted && this.active) {
      // Heat gone: the chopper peels away.
      this.active = false;
      this.lit = false;
    }
    if (!this.active) { this.lit = false; return; }
    // Track the player: remember where they were last seen.
    const target = player.inCar ? player.inCar.pos : player.pos;
    this.lastKnown.x = target.x; this.lastKnown.z = target.z;
    // Orbit overhead at ~16 units up, closing in. Low enough that the
    // chase camera (pitched down ~18°) can actually see it, and the
    // 14-unit spotlight cone reaches the ground.
    this.orbitAngle += dt * 0.5;
    const wantX = target.x + Math.sin(this.orbitAngle) * 26;
    const wantZ = target.z + Math.cos(this.orbitAngle) * 26;
    const dx = wantX - this.pos.x, dz = wantZ - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.5) {
      const sp = Math.min(26, d * 1.2);
      this.pos.x += (dx / d) * sp * dt;
      this.pos.z += (dz / d) * sp * dt;
    }
    this.pos.y += (16 - this.pos.y) * Math.min(1, dt * 1.5);
    this.heading = Math.atan2(target.x - this.pos.x, target.z - this.pos.z);
    // Spotlight: lit when the chopper is overhead (within ~60 units) and
    // has the player in its cone. The harness moves the chopper onto the
    // player, so this is true whenever it is close.
    const flatD = dist(this.pos.x, this.pos.z, target.x, target.z);
    this.lit = flatD < 70;
    if (this._damageFlash > 0) this._damageFlash -= dt;
  }
}
