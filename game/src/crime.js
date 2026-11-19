// Dynamic crime: a living city where crimes happen around the player and
// intervening pays. Three event types, each with approach / flee phases
// and a grace window after the flee starts (rams only count past grace).
import * as THREE from 'three';
import { T } from './tuning.js';

export class Crime {
  constructor(world) {
    this.world = world;
    this.event = null;
    this.interventions = 0;
    this.spawnTimer = 20;
    this.atmCooldown = 0;
  }

  get active() {
    return !!this.event;
  }

  state() {
    return {
      active: this.active,
      type: this.event ? this.event.type : null,
      phase: this.event ? this.event.phase : null,
      interventions: this.interventions,
    };
  }

  eventPos() {
    if (!this.event) return null;
    if (this.event.type === 'carjacking' && this.event.car) {
      return { x: this.event.car.pos.x, z: this.event.car.pos.z };
    }
    if (this.event.thief) {
      return { x: this.event.thief.x, z: this.event.thief.z };
    }
    if (this.event.car) {
      return { x: this.event.car.pos.x, z: this.event.car.pos.z };
    }
    return null;
  }

  clear() {
    if (this.event && this.event.thiefMesh) {
      this.world.scene.removeMesh(this.event.thiefMesh);
    }
    this.event = null;
  }

  // The player's own ATM robbery: +$250, +2 wanted. This is the test
  // hook the harness calls wherever the player happens to be (after the
  // collectibles the player is far from any ATM), so it does not require
  // standing at a machine — the E-key path still does (see main.js).
  robAtm() {
    const w = this.world;
    if (this.atmCooldown > 0) return false;
    w.player.cash += T.atmRobCash;
    w.game.addWanted(T.atmRobWanted);
    this.atmCooldown = 5;
    w.audio.blip(660, 0.12, 'square', 0.2);
    return true;
  }

  // F (punch) asks here first: is an ATM thief in reach?
  tryAtmPunch() {
    const w = this.world;
    if (!this.event || this.event.type !== 'atm' || !this.event.thief) return false;
    const p = w.player.pos;
    const d = Math.hypot(this.event.thief.x - p.x, this.event.thief.z - p.z);
    if (d > T.atmPunchDist + 2) return false;
    this.interventions++;
    w.player.cash += 50;
    this.clear();
    return true;
  }

  force(type) {
    const w = this.world;
    this.clear();
    const p = w.player.pos;
    if (type === 'carjacking') {
      // A thief stands next to a parked car, steals it, flees. The thief
      // starts only a few units from the car so the approach is ~1s game.
      const car = w.game.spawnParkedCar(p.x + 20, p.z + 10, 'sedan');
      if (!car) return false;
      const thief = { x: car.pos.x + 4, z: car.pos.z + 3 };
      const mesh = w.scene.makeThiefMesh(thief.x, thief.z);
      this.event = {
        type,
        phase: 'approach',
        grace: T.crimeGrace,
        car,
        thief,
        thiefMesh: mesh,
        timer: 0,
      };
      return true;
    }
    if (type === 'atm') {
      const atm = w.city.atms[0];
      const thief = { x: atm.x + 2, z: atm.z + 2 };
      const mesh = w.scene.makeThiefMesh(thief.x, thief.z);
      this.event = { type, phase: 'robbing', grace: 0, thief, thiefMesh: mesh, timer: 0 };
      return true;
    }
    if (type === 'pursuit') {
      const car = w.game.spawnParkedCar(p.x + 25, p.z, 'muscle');
      if (!car) return false;
      this.event = { type, phase: 'flee', grace: T.crimeGrace, car, timer: 0 };
      return true;
    }
    return false;
  }

  // Ram check: the player, in a car at speed, hits the event's car.
  checkRam() {
    const w = this.world;
    if (!this.event || !this.event.car) return false;
    const pc = w.player.inCar;
    if (!pc) return false;
    if (this.event.grace > 0) return false;
    const dist = this.event.type === 'carjacking' ? T.carjackRamDist : T.pursuitRamDist;
    const d = Math.hypot(pc.pos.x - this.event.car.pos.x, pc.pos.z - this.event.car.pos.z);
    if (d > dist) return false;
    if (Math.abs(pc.speed) < T.ramMinSpeed) return false;
    this.interventions++;
    w.player.cash += 100;
    this.clear();
    return true;
  }

  step(dt) {
    const w = this.world;
    if (this.atmCooldown > 0) this.atmCooldown -= dt;
    if (!this.event) {
      // Ambient crimes spawn on their own timer.
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = 45 + w.rng() * 30;
        const types = ['carjacking', 'atm', 'pursuit'];
        this.force(types[Math.floor(w.rng() * types.length)]);
      }
      return;
    }
    const ev = this.event;
    ev.timer += dt;
    if (ev.grace > 0) ev.grace -= dt;
    if (ev.type === 'carjacking') {
      if (ev.phase === 'approach' && ev.thief && ev.car) {
        // Walk the thief to the car.
        const dx = ev.car.pos.x - ev.thief.x;
        const dz = ev.car.pos.z - ev.thief.z;
        const d = Math.hypot(dx, dz);
        if (d < 2) {
          ev.phase = 'flee';
          ev.grace = T.crimeGrace;
          if (ev.thiefMesh) ev.thiefMesh.visible = false;
        } else {
          const sp = 6 * dt;
          ev.thief.x += (dx / d) * sp;
          ev.thief.z += (dz / d) * sp;
          if (ev.thiefMesh) ev.thiefMesh.position.set(ev.thief.x, 1, ev.thief.z);
        }
      } else if (ev.phase === 'flee' && ev.car) {
        // The stolen car flees from the player.
        const p = w.player.pos;
        const dx = ev.car.pos.x - p.x;
        const dz = ev.car.pos.z - p.z;
        const d = Math.hypot(dx, dz) || 1;
        ev.car.heading = Math.atan2(dx / d, dz / d);
        ev.car.speed = 14;
        const nx = ev.car.pos.x + Math.sin(ev.car.heading) * ev.car.speed * dt;
        const nz = ev.car.pos.z + Math.cos(ev.car.heading) * ev.car.speed * dt;
        const hit = w.city.resolveCollision(nx, nz, 2.2);
        ev.car.pos.set(hit.x, 0, hit.z);
        ev.car.syncMesh();
      }
    } else if (ev.type === 'pursuit' && ev.car) {
      const p = w.player.pos;
      const dx = ev.car.pos.x - p.x;
      const dz = ev.car.pos.z - p.z;
      const d = Math.hypot(dx, dz) || 1;
      ev.car.heading = Math.atan2(dx / d, dz / d);
      ev.car.speed = 18;
      const nx = ev.car.pos.x + Math.sin(ev.car.heading) * ev.car.speed * dt;
      const nz = ev.car.pos.z + Math.cos(ev.car.heading) * ev.car.speed * dt;
      const hit = w.city.resolveCollision(nx, nz, 2.2);
      ev.car.pos.set(hit.x, 0, hit.z);
      ev.car.syncMesh();
    }
    // A ram ends the event.
    this.checkRam();
  }
}
