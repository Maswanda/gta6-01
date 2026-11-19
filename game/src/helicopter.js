// Helicopter: lifts off at 4+ stars, hunts the player's last known spot
// with a spotlight. While the light is on the player, the heat does not
// cool. Enough damage brings it down; it retreats for 30s, then may return.
import * as THREE from 'three';
import { T } from './tuning.js';

export class Helicopter {
  constructor(world) {
    this.world = world;
    this.active = false;
    this.lit = false;
    this.hp = 100;
    this.retreatTimer = 0;
    this.pos = new THREE.Vector3(0, T.heliHeight, 0);
    this.lastKnown = new THREE.Vector3(0, 0, 0);
    this.group = null;
    this.spot = null;
    this.updateTimer = 0;
  }

  get state() {
    return { active: this.active, lit: this.lit, hp: this.hp };
  }

  spawn() {
    const w = this.world;
    const p = w.player.pos;
    // Spawn close (+25/+25) so the spotlight finds the player in ~3s
    // (v4 fix: the old 120-unit spawn never got lit in time).
    this.pos.set(p.x + T.heliSpawnOffset, T.heliHeight, p.z + T.heliSpawnOffset);
    this.lastKnown.set(p.x, 0, p.z);
    this.hp = 100;
    this.active = true;
    if (this.group) {
      this.group.visible = true;
      this.group.position.copy(this.pos);
    }
  }

  damage(amount, world) {
    if (!this.active) return;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.active = false;
      this.lit = false;
      this.retreatTimer = T.heliRetreat;
      if (this.group) this.group.visible = false;
      if (world) world.audio.blip(60, 0.5, 'sawtooth', 0.3);
    }
  }

  step(dt) {
    const w = this.world;
    if (this.retreatTimer > 0) this.retreatTimer -= dt;
    if (!this.active) {
      if (w.wanted >= 4 && this.retreatTimer <= 0) this.spawn();
      return;
    }
    if (w.wanted < 4) {
      // Heat gone: the chopper leaves.
      this.active = false;
      this.lit = false;
      if (this.group) this.group.visible = false;
      return;
    }
    // Track the player, refreshing lastKnown about once a second.
    this.updateTimer -= dt;
    if (this.updateTimer <= 0) {
      this.updateTimer = 1;
      this.lastKnown.set(w.player.pos.x, 0, w.player.pos.z);
    }
    const dx = this.lastKnown.x - this.pos.x;
    const dz = this.lastKnown.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 2) {
      const sp = Math.min(T.heliSpeed * dt, d);
      this.pos.x += (dx / d) * sp;
      this.pos.z += (dz / d) * sp;
    }
    // Spotlight: lit when close enough to the player in plan view.
    const pd = Math.hypot(w.player.pos.x - this.pos.x, w.player.pos.z - this.pos.z);
    this.lit = pd < T.heliLitDist;
    if (this.group) {
      this.group.position.copy(this.pos);
      this.group.rotation.y += dt * 2;
    }
    if (this.spot) {
      this.spot.position.set(this.pos.x, this.pos.y - 1, this.pos.z);
      this.spot.target.position.set(w.player.pos.x, 0, w.player.pos.z);
      this.spot.target.updateMatrixWorld();
      this.spot.visible = this.lit;
    }
  }
}
