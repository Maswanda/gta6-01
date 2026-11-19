// crime.js — The Dynamic Crime System.
// Three street crimes happen live around the player:
//   carjacking — a thief walks up to a parked car, steals it and flees;
//     ram the stolen car to stop it.
//   atm — a thief works an ATM; walk up and punch him.
//   pursuit — a fugitive sprints away; run him down in a car.
// Each resolved crime pays a small reward and counts as an
// intervention. Crimes also spawn on their own while you play.
import * as THREE from 'three';
import { TUNE, dist2d } from './tuning.js';

export class Crime {
  constructor(world) {
    this.world = world;
    this.event = null;
    this.interventions = 0;
    this._ambientTimer = 45;
    this._actor = null;
  }
  get active() {
    return !!this.event;
  }
  eventPos() {
    if (!this.event) return null;
    const a = this._actor;
    return a ? { x: a.pos.x, z: a.pos.z } : { x: this.event.x, z: this.event.z };
  }
  forceCrime(type) {
    if (!['carjacking', 'atm', 'pursuit'].includes(type)) return false;
    this._start(type);
    return true;
  }
  clearCrime() {
    this._removeActor();
    this.event = null;
  }
  _start(type) {
    const world = this.world;
    this.clearCrime();
    const p = world.player;
    // Stage the crime 25-40m from the player, on a road.
    const a = world.rng.range(0, Math.PI * 2);
    const d = world.rng.range(25, 40);
    const x = p.pos.x + Math.sin(a) * d;
    const z = p.pos.z + Math.cos(a) * d;
    const mesh = world.scene.makeEnemyMesh();
    mesh.position.set(x, 0, z);
    world.scene.dynamic.add(mesh);
    this._actor = {
      pos: new THREE.Vector3(x, 0, z),
      heading: a,
      mesh,
      speed: type === 'pursuit' ? 5.5 : 2.2,
    };
    let targetCar = null;
    if (type === 'carjacking') {
      // Pick a parked/traffic car near the crime spot.
      let bestD = Infinity;
      for (const car of world.allCars) {
        if (!car.alive || car.isPolice || car === p.inCar) continue;
        const dd = dist2d(x, z, car.pos.x, car.pos.z);
        if (dd < bestD) {
          bestD = dd;
          targetCar = car;
        }
      }
    }
    this.event = {
      type,
      phase: type === 'carjacking' ? 'approach' : 'active',
      grace: TUNE.crimeGraceSec,
      approach: TUNE.crimeApproachSec,
      x,
      z,
      targetCar,
      paid: false,
    };
    world.hud.toast(
      type === 'carjacking' ? 'Carjacking in progress — stop the thief!' :
      type === 'atm' ? 'ATM robbery — punch the thief!' :
      'Fugitive fleeing — run him down!',
    );
  }
  // Punch resolution: returns true when the punch stopped a crime.
  tryPunch() {
    const world = this.world;
    if (!this.event || !this._actor) return false;
    const p = world.player;
    const a = this._actor;
    if (this.event.type === 'atm' && dist2d(p.pos.x, p.pos.z, a.pos.x, a.pos.z) < 3) {
      this._resolve('Thief down. The bank thanks you.');
      return true;
    }
    if (this.event.type === 'carjacking' && this.event.phase === 'approach' &&
        dist2d(p.pos.x, p.pos.z, a.pos.x, a.pos.z) < 3) {
      this._resolve('You caught the carjacker before he got the car.');
      return true;
    }
    return false;
  }
  _resolve(msg) {
    const world = this.world;
    this.interventions += 1;
    world.player.cash += 150;
    world.audio.cash();
    world.hud.toast(msg + ' +$150');
    this.clearCrime();
  }
  _removeActor() {
    if (this._actor) {
      if (this._actor.mesh && this._actor.mesh.parent) this._actor.mesh.parent.remove(this._actor.mesh);
      this._actor = null;
    }
  }
  update(dt) {
    const world = this.world;
    const p = world.player;
    // Ambient spawns while playing.
    if (world.state === 'playing' && !this.event) {
      this._ambientTimer -= dt;
      if (this._ambientTimer <= 0) {
        this._ambientTimer = world.rng.range(40, 80);
        if (world.rng.chance(0.7)) {
          this._start(world.rng.pick(['carjacking', 'atm', 'pursuit']));
        }
      }
    }
    if (!this.event || !this._actor) return;
    const ev = this.event;
    const a = this._actor;
    if (ev.type === 'carjacking') {
      const car = ev.targetCar;
      if (!car || !car.alive) {
        this.clearCrime();
        return;
      }
      if (ev.phase === 'approach') {
        // Walk to the car.
        ev.approach -= dt;
        const ang = Math.atan2(car.pos.x - a.pos.x, car.pos.z - a.pos.z);
        a.heading = ang;
        a.pos.x += Math.sin(ang) * a.speed * dt;
        a.pos.z += Math.cos(ang) * a.speed * dt;
        if (ev.approach <= 0 || dist2d(a.pos.x, a.pos.z, car.pos.x, car.pos.z) < 2) {
          ev.phase = 'flee';
          ev.grace = TUNE.crimeGraceSec;
          car.isParked = false;
          car.speed = 0;
          world.hud.toast('He\'s got the car — ram it to stop him!');
        }
      } else if (ev.phase === 'flee') {
        // Drive off; the grace window is the player's chance to
        // catch the car before it is gone for good. The thief rides
        // with the car, so the event position tracks it.
        ev.grace -= dt;
        const away = Math.atan2(car.pos.x - p.pos.x, car.pos.z - p.pos.z);
        car.heading = away;
        car.cruise(24, 0, dt);
        a.pos.copy(car.pos);
        a.mesh.position.set(a.pos.x, 0, a.pos.z);
        // Rammed hard enough? The stolen car stops.
        if (p.inCar && dist2d(p.inCar.pos.x, p.inCar.pos.z, car.pos.x, car.pos.z) < 3.6 &&
            Math.abs(p.inCar.speed) > 6) {
          car.speed = 0;
          this._resolve('Stolen car recovered!');
          return;
        }
        if (ev.grace <= -25) {
          // Got away.
          world.hud.toast('The carjacker got away.');
          this.clearCrime();
          return;
        }
      }
      a.mesh.position.set(a.pos.x, 0, a.pos.z);
      a.mesh.rotation.y = a.heading;
    } else if (ev.type === 'atm') {
      // The thief works the ATM; he stays put until punched.
      a.mesh.position.set(a.pos.x, 0, a.pos.z);
      a.mesh.rotation.y = a.heading + Math.sin(world.time.now * 2) * 0.3;
      if (world.rng.chance(0.002)) {
        world.hud.toast('The ATM thief is getting away…');
        this.clearCrime();
      }
    } else if (ev.type === 'pursuit') {
      // The fugitive sprints away from the player.
      const away = Math.atan2(a.pos.x - p.pos.x, a.pos.z - p.pos.z);
      a.heading = away;
      a.pos.x += Math.sin(away) * a.speed * dt;
      a.pos.z += Math.cos(away) * a.speed * dt;
      a.mesh.position.set(a.pos.x, 0, a.pos.z);
      a.mesh.rotation.y = a.heading;
      // Run him down in a car.
      if (p.inCar && dist2d(p.inCar.pos.x, p.inCar.pos.z, a.pos.x, a.pos.z) < 3) {
        this._resolve('Fugitive stopped. The PD thanks you.');
        return;
      }
      if (!world.city.inBounds(a.pos.x, a.pos.z)) {
        world.hud.toast('The fugitive escaped the city.');
        this.clearCrime();
      }
    }
  }
}
