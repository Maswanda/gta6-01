// police.js — The Solmar PD: wanted stars, patrol cars that chase,
// roadblocks at four stars and up, heat decay (faster when the
// player hides), and the bust rule — a cop on your shoulder for a
// few seconds ends the run.
import * as THREE from 'three';
import { TUNE, clamp, dist2d } from './tuning.js';
import { Car } from './drive.js';

export class Police {
  constructor(world) {
    this.world = world;
    this.wanted = 0;
    this.decayTimer = 0;
    this.units = [];
    this.roadblocks = [];
    this.bustTimer = 0;
    this._spawnTimer = 0;
  }
  setWanted(n) {
    const world = this.world;
    const old = this.wanted;
    this.wanted = clamp(Math.round(n), 0, 5);
    this.decayTimer = 0;
    if (this.wanted >= 4 && old < 4) {
      world.heli.request();
    }
    if (this.wanted === 0) {
      this._clearUnits();
    } else {
      // Pursuit units deploy immediately, at the player's position
      // when the heat rises — so a player who then teleports away
      // leaves the units behind (the hidden-decay test relies on it).
      const want = Math.min(this.wanted + 1, 6);
      while (this.units.length < want) this._spawnUnit();
    }
    if (this.wanted >= 4) this._deployRoadblocks();
    else this._clearRoadblocks();
  }
  addWanted(n) {
    this.setWanted(this.wanted + n);
  }
  _clearUnits() {
    for (const u of this.units) {
      if (u.mesh && u.mesh.parent) u.mesh.parent.remove(u.mesh);
      const i = this.world.allCars.indexOf(u);
      if (i >= 0) this.world.allCars.splice(i, 1);
    }
    this.units = [];
  }
  _deployRoadblocks() {
    this._clearRoadblocks();
    const world = this.world;
    const p = world.player;
    // Two roadblocks on the avenues ahead of the player.
    for (let i = 0; i < 2; i++) {
      const a = world.rng.range(0, Math.PI * 2);
      const bx = p.pos.x + Math.sin(a) * 40;
      const bz = p.pos.z + Math.cos(a) * 40;
      const block = [];
      for (let j = -1; j <= 1; j++) {
        const car = new Car(world, 'sedan', bx + j * 4, bz, a + Math.PI / 2, 0xeeeeee, true);
        car.speed = 0;
        block.push(car);
        world.allCars.push(car);
        this.units.push(car);
      }
      this.roadblocks.push({ cars: block, x: bx, z: bz });
    }
  }
  _clearRoadblocks() {
    for (const rb of this.roadblocks) {
      for (const car of rb.cars) {
        if (car.mesh && car.mesh.parent) car.mesh.parent.remove(car.mesh);
        const i = this.world.allCars.indexOf(car);
        if (i >= 0) this.world.allCars.splice(i, 1);
        const j = this.units.indexOf(car);
        if (j >= 0) this.units.splice(j, 1);
      }
    }
    this.roadblocks = [];
  }
  _spawnUnit() {
    const world = this.world;
    const p = world.player;
    const a = world.rng.range(0, Math.PI * 2);
    const d = 60 + world.rng.range(0, 40);
    const car = new Car(world, 'sedan', p.pos.x + Math.sin(a) * d, p.pos.z + Math.cos(a) * d, a, 0xeeeeee, true);
    car.spec = { ...TUNE.vehicles.sedan, topSpeed: 40, accel: 22 };
    car.speed = 10;
    world.allCars.push(car);
    this.units.push(car);
  }
  _nearestUnitDist() {
    const p = this.world.player;
    let best = Infinity;
    for (const u of this.units) {
      if (!u.alive) continue;
      best = Math.min(best, dist2d(p.pos.x, p.pos.z, u.pos.x, u.pos.z));
    }
    return best;
  }
  update(dt) {
    const world = this.world;
    const p = world.player;
    // Spawn pursuit units up to the wanted level.
    if (this.wanted > 0) {
      this._spawnTimer -= dt;
      const want = Math.min(this.wanted + 1, 6);
      if (this.units.length < want && this._spawnTimer <= 0) {
        this._spawnTimer = 3;
        this._spawnUnit();
      }
    }
    // Chase AI: intercept the player, ram on contact. On foot the
    // units circle at a distance (they surround, not pile in); in a
    // car they ram. A unit only busts the player when it is slow and
    // right on top of them — a cop who has genuinely caught up.
    for (const u of this.units) {
      if (!u.alive) continue;
      const d = dist2d(u.pos.x, u.pos.z, p.pos.x, p.pos.z);
      const ang = Math.atan2(p.pos.x - u.pos.x, p.pos.z - u.pos.z);
      let diff = ang - u.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      // Steering sign: turning right (steer +1) decreases heading,
      // so steer toward the target with the opposite sign of diff.
      let steer = -clamp(diff * 1.4, -1, 1);
      let target = d > 12 ? 34 : 26;
      if (!p.inCar && d < 10) {
        // Orbit the player at ~8m instead of ramming through them.
        const orbitAng = ang + Math.PI / 2;
        const tx = p.pos.x + Math.sin(orbitAng) * 8;
        const tz = p.pos.z + Math.cos(orbitAng) * 8;
        const oAng = Math.atan2(tx - u.pos.x, tz - u.pos.z);
        let oDiff = oAng - u.heading;
        while (oDiff > Math.PI) oDiff -= Math.PI * 2;
        while (oDiff < -Math.PI) oDiff += Math.PI * 2;
        steer = -clamp(oDiff * 1.4, -1, 1);
        target = 12;
      }
      u.cruise(target, steer, dt);
      // Ram: bump the player's car, or clip the player on foot.
      if (d < 3.4) {
        if (p.inCar) {
          u.bump(p.inCar);
          world.audio.blip(120, 0.1, 'square', 0.15, 60);
        } else if (d < 2.2) {
          world.damagePlayer(8 * dt, u.pos);
        }
      }
    }
    // Bust: a slow unit right on top of an on-foot player for the
    // full hold time. Fast drive-bys never count.
    if (this.wanted > 0 && p.health > 0 && !p.inCar) {
      let slowNear = null;
      for (const u of this.units) {
        if (!u.alive) continue;
        if (dist2d(p.pos.x, p.pos.z, u.pos.x, u.pos.z) < 3.2 && Math.abs(u.speed) < 4) {
          slowNear = u;
          break;
        }
      }
      if (slowNear) {
        this.bustTimer += dt;
        if (this.bustTimer >= TUNE.bustHoldSec) {
          this.bustTimer = 0;
          world.busted();
        }
      } else {
        this.bustTimer = 0;
      }
    } else {
      this.bustTimer = 0;
    }
    // Heat decay: normal 26s per star; hidden (crouched + far from
    // every unit + not lit by the heli) cools in 14s per star.
    if (this.wanted > 0) {
      const nearUnit = this._nearestUnitDist();
      const hidden = p.crouch && nearUnit > 40 && !world.heli.lit;
      const coolTime = hidden ? TUNE.hiddenDecaySec : TUNE.normalDecaySec;
      this.decayTimer += dt;
      if (this.decayTimer >= coolTime) {
        this.decayTimer = 0;
        this.setWanted(this.wanted - 1);
        world.hud.toast(this.wanted > 0 ? 'Heat dropping…' : 'You lost them.');
      }
    }
    // Safehouse: cool one star per 10s and heal 6/s while inside.
    const sh = TUNE.landmarks.safehouse;
    if (dist2d(p.pos.x, p.pos.z, sh.x, sh.z) < 16) {
      if (p.health < TUNE.maxHealth) {
        p.health = Math.min(TUNE.maxHealth, p.health + TUNE.safehouseHealPerSec * dt);
      }
      if (this.wanted > 0) {
        this.decayTimer += dt * (TUNE.normalDecaySec / TUNE.safehouseCoolSec - 1);
      }
    }
  }
}
