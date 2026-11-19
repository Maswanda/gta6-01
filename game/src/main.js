// Solmar Bay: Heatwave v4 — orchestrator. Builds the world, runs the loop,
// exposes the test API (window.__solmar), the autopilot (?autopilot=1)
// and the screenshot setups (?shot=...).
import * as THREE from 'three';
import { T, LANDMARKS, VEHICLES } from './tuning.js';
import { makeRng } from './rng.js';
import { City } from './city.js';
import { SceneSys } from './scene.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { Radio } from './radio.js';
import { DriveSys, makeCar } from './drive.js';
import { OnFoot } from './onfoot.js';
import { Combat } from './combat.js';
import { Crime } from './crime.js';
import { Police } from './police.js';
import { Helicopter } from './helicopter.js';
import { Garage } from './garage.js';
import { Side } from './side.js';
import { Missions } from './missions.js';
import { Traffic } from './traffic.js';
import { Effects } from './effects.js';
import { Hud } from './hud.js';
import { SaveSys } from './persist.js';
import { applyShotMode } from './shots.js';

const params = new URLSearchParams(location.search);
const SEED = Number(params.get('seed') || 11);
const TIMESCALE = Number(params.get('timescale') || 1);
const AUTOPILOT = params.get('autopilot') === '1';
const SHOT = params.get('shot') || null;

const CAR_COLORS = { sedan: 0x777777, sports: 0xd8a020, muscle: 0x8e3f3f, police: 0xdddddd, taxi: 0xd8c020 };

export class Game {
  constructor() {
    this.rng = makeRng(SEED);
    this.started = false;
    this.elapsed = 0;
    this.errors = [];
    this.wanted = 0;
    this.timescale = TIMESCALE;
    this.autopilot = AUTOPILOT;
    this.shotMode = SHOT;
    // Autopilot navigation state.
    this.autoStuckTimer = 0;
    this.autoLastPos = { x: 0, z: 0 };
    this.autoReverseTimer = 0;
    this.autoDetour = null;
    this.autoDetourTimer = 0;

    const w = {};
    this.world = w;
    w.game = this;
    w.rng = this.rng;
    w.city = new City(this.rng);
    w.audio = new AudioSys();
    w.radio = new Radio(w.audio);
    w.input = new Input();
    w.scene = new SceneSys(w);
    w.drive = new DriveSys(w);
    w.onfoot = new OnFoot(w);
    w.combat = new Combat(w);
    w.crime = new Crime(w);
    w.police = new Police(w);
    w.heli = new Helicopter(w);
    w.garage = new Garage(w);
    w.side = new Side(w);
    w.missions = new Missions(w);
    w.traffic = new Traffic(w);
    w.effects = new Effects(w);
    w.hud = new Hud(w);
    w.save = new SaveSys(w);
    w.wanted = 0;
    // The world object carries `wanted` as a live property the systems
    // read; keep it in sync through the game's setter.
    Object.defineProperty(w, 'wanted', {
      get: () => this.wanted,
      set: (v) => { this.wanted = Math.max(0, Math.min(T.maxWanted, Math.round(v))); },
    });
    w.player = {
      pos: new THREE.Vector3(-60, 0, 260),
      heading: 0,
      health: 100,
      cash: T.startCash,
      inCar: null,
      crouching: false,
      mesh: null,
    };
    w.allCars = [];
    window.addEventListener('error', (e) => {
      this.errors.push(String(e.message || e.error || 'error').slice(0, 200));
    });
  }

  // --- world helpers used by the systems ---
  spawnParkedCar(x, z, kind, color) {
    const w = this.world;
    const spot = w.city.resolveCollision(x, z, 2.5);
    const clamped = w.city.clampToMap(spot.x, spot.z);
    const car = makeCar(w, kind, clamped.x, clamped.z, 0, color ?? CAR_COLORS[kind] ?? 0x888888);
    w.allCars.push(car);
    return car;
  }

  teleport(x, z) {
    const w = this.world;
    const spot = w.city.resolveCollision(x, z, 1);
    const clamped = w.city.clampToMap(spot.x, spot.z);
    if (w.player.inCar) {
      w.player.inCar.pos.set(clamped.x, 0, clamped.z);
      w.player.inCar.speed = 0;
      w.player.inCar.syncMesh();
    }
    w.player.pos.set(clamped.x, 0, clamped.z);
    if (w.player.mesh) w.player.mesh.position.copy(w.player.pos);
    return true;
  }

  setWanted(n) {
    this.world.wanted = n;
    this.world.police.decayTimer = 0;
    return this.world.wanted;
  }

  addWanted(n) {
    return this.setWanted(this.world.wanted + n);
  }

  enterNearestCar() {
    const w = this.world;
    const car = w.drive.nearestCar(w.player.pos.x, w.player.pos.z, 8, true);
    if (!car) return false;
    return w.drive.enterCar(w.player, car);
  }

  enterSportsCar() {
    const w = this.world;
    let car = w.drive.nearestSportsCar(w.player.pos.x, w.player.pos.z, 60);
    if (!car) {
      car = this.spawnParkedCar(w.player.pos.x + 2, w.player.pos.z + 2, 'sports', CAR_COLORS.sports);
    }
    if (!car) return false;
    return w.drive.enterCar(w.player, car);
  }

  exitCar() {
    return this.world.drive.exitCar(this.world.player);
  }

  ejectFromWreck() {
    const w = this.world;
    const car = w.player.inCar;
    if (!car) return;
    car.alive = false;
    car.speed = 0;
    w.drive.exitCar(w.player);
    w.audio.blip(70, 0.4, 'sawtooth', 0.3);
  }

  respawn() {
    const w = this.world;
    w.player.health = 100;
    w.player.cash = Math.max(0, w.player.cash - 100);
    this.setWanted(0);
    if (w.player.inCar) w.drive.exitCar(w.player);
    const s = w.city.landmarkPos('safehouse');
    this.teleport(s.x, s.z + 20);
  }

  crouch(on) {
    this.world.player.crouching = !!on;
    return this.world.player.crouching;
  }

  // --- key bindings ---
  bindKeys() {
    const w = this.world;
    w.input.on('KeyE', (down) => {
      if (!down || !this.started) return;
      // E tries talk FIRST (even from inside the car), then exit the car,
      // then rob an ATM, then enter the nearest car (v4 fix #8).
      if (w.missions.talk()) return;
      if (w.player.inCar) {
        w.drive.exitCar(w.player);
        return;
      }
      if (w.city.nearestAtm(w.player.pos.x, w.player.pos.z, 8)) {
        if (w.crime.robAtm()) return;
      }
      const car = w.drive.nearestCar(w.player.pos.x, w.player.pos.z, 8, true);
      if (car) w.drive.enterCar(w.player, car);
    });
    w.input.on('KeyF', (down) => {
      if (down && this.started) w.combat.punch();
    });
    w.input.on('KeyG', (down) => {
      if (down && this.started) w.combat.shoot();
    });
    w.input.on('KeyR', (down) => {
      if (down && this.started) w.combat.reload();
    });
    w.input.on('KeyT', (down) => {
      if (!down || !this.started) return;
      if (w.side.taxi.state === 'pickup') {
        const t = w.side.taxi;
        const d = Math.hypot(w.player.pos.x - t.passenger.x, w.player.pos.z - t.passenger.z);
        if (d < 12) w.side.pickupTaxi();
      }
    });
    w.input.on('KeyC', (down) => {
      if (down && this.started) this.crouch(!w.player.crouching);
    });
    w.input.on('Digit1', (down) => { if (down) w.radio.setStation(0); });
    w.input.on('Digit2', (down) => { if (down) w.radio.setStation(1); });
    w.input.on('Digit3', (down) => { if (down) w.radio.setStation(2); });
    w.input.on('KeyQ', (down) => { if (down) w.radio.cycle(); });
  }

  // --- autopilot ---
  autoWalkTo(tx, tz, dt) {
    const w = this.world;
    const p = w.player.pos;
    const dx = tx - p.x;
    const dz = tz - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 1) return true;
    const heading = Math.atan2(dx, dz);
    w.player.heading = heading;
    // Unstuck: no progress for 3s -> sidestep perpendicular.
    if (Math.hypot(p.x - this.autoLastPos.x, p.z - this.autoLastPos.z) < 0.5) {
      this.autoStuckTimer += dt;
    } else {
      this.autoStuckTimer = 0;
    }
    this.autoLastPos = { x: p.x, z: p.z };
    let hx = heading;
    if (this.autoStuckTimer > T.autoUnstuckTime) {
      hx = heading + Math.PI / 2;
      if (this.autoStuckTimer > T.autoUnstuckTime + 1.5) this.autoStuckTimer = 0;
    }
    w.onfoot.step(w.player, dt, { x: 0, z: -1 }, hx);
    return false;
  }

  autoDriveTo(tx, tz, dt) {
    const w = this.world;
    const car = w.player.inCar;
    if (!car) return false;
    // Waypoint: the target snapped to the road grid when it is off-road.
    let wx = tx;
    let wz = tz;
    if (!w.city.onRoad(tx, tz)) {
      const rp = w.city.nearestRoadPoint(tx, tz);
      wx = rp.x;
      wz = rp.z;
      if (w.city.insideAnyBuilding(wx, wz, 3)) {
        const tries = [[52, 0], [-52, 0], [0, 52], [0, -52], [104, 0], [-104, 0]];
        for (const [ox, oz] of tries) {
          if (!w.city.insideAnyBuilding(wx + ox, wz + oz, 3)) {
            wx += ox;
            wz += oz;
            break;
          }
        }
      }
    }
    // A detour overrides the waypoint while it lasts.
    if (this.autoDetour) {
      wx = this.autoDetour.x;
      wz = this.autoDetour.z;
      this.autoDetourTimer -= dt;
      if (this.autoDetourTimer <= 0) this.autoDetour = null;
    }
    const dx = wx - car.pos.x;
    const dz = wz - car.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 4) return true;
    const desired = Math.atan2(dx, dz);
    let diff = desired - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    // Unstuck: reversing when boxed in.
    const moved = Math.hypot(car.pos.x - this.autoLastPos.x, car.pos.z - this.autoLastPos.z);
    if (moved < 0.5 && Math.abs(car.speed) < 2) this.autoStuckTimer += dt;
    else this.autoStuckTimer = 0;
    this.autoLastPos = { x: car.pos.x, z: car.pos.z };
    if (this.autoReverseTimer > 0) {
      this.autoReverseTimer -= dt;
      w.drive.stepCar(car, dt, -1, diff > 0 ? -1 : 1);
      w.player.pos.copy(car.pos);
      w.player.heading = car.heading;
      return false;
    }
    if (this.autoStuckTimer > T.autoUnstuckTime) {
      this.autoStuckTimer = 0;
      this.autoReverseTimer = 1.2;
      // Jog sideways after reversing so the next approach differs.
      this.autoDetour = {
        x: car.pos.x + Math.cos(car.heading) * 45,
        z: car.pos.z - Math.sin(car.heading) * 45,
      };
      this.autoDetourTimer = 6;
      return false;
    }
    let throttle = 1;
    let steer = 0;
    if (Math.abs(diff) > 2.4) {
      // Facing away: reverse into the turn.
      throttle = -1;
      steer = diff > 0 ? -1 : 1;
    } else if (Math.abs(diff) > 0.12) {
      steer = diff > 0 ? 1 : -1;
    }
    w.drive.stepCar(car, dt, throttle, steer);
    w.player.pos.copy(car.pos);
    w.player.heading = car.heading;
    return false;
  }

  autopilotStep(dt) {
    const w = this.world;
    const m = w.missions;
    if (!this.started || m.done) return;
    // Mission 6: the sports car comes first.
    if (m.index === 5 && (!w.player.inCar || w.player.inCar.kind !== 'sports')) {
      const marina = w.city.landmarkPos('marina');
      const d = Math.hypot(w.player.pos.x - marina.x, w.player.pos.z - marina.z);
      if (d < 12) {
        this.enterSportsCar();
        return;
      }
      this.autoTravelTo(marina.x, marina.z, dt, 12);
      return;
    }
    // Combat: stand, aim, shoot.
    const kind = m.stepKind();
    const combatNow = kind === 'kill' || (kind === 'heist' && m.step === 2);
    const alive = w.combat.enemies.filter((e) => e.hp > 0);
    if (combatNow && alive.length > 0) {
      if (w.player.inCar) {
        this.exitCar();
        return;
      }
      const e = alive[0];
      const p = w.player.pos;
      const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z);
      if (d > 45) {
        this.autoWalkTo(e.pos.x, e.pos.z, dt);
        return;
      }
      w.player.heading = Math.atan2(e.pos.x - p.x, e.pos.z - p.z);
      if (w.combat.ammo[w.combat.weapon] <= 0) w.combat.reload();
      else w.combat.shoot();
      return;
    }
    const target = m.currentTarget();
    if (!target) return; // e.g. waiting for the chopper
    this.autoTravelTo(target.x, target.z, dt, target.kind === 'race' ? 12 : T.autoCarStopDist, target.kind);
  }

  autoTravelTo(tx, tz, dt, stopDist, kind = 'reach') {
    const w = this.world;
    const p = w.player.pos;
    const dist = Math.hypot(tx - p.x, tz - p.z);
    if (kind === 'talk' && dist < T.talkRadius - 3) {
      w.missions.talk();
      return;
    }
    if (dist <= stopDist) {
      if (w.player.inCar) {
        this.exitCar();
        return;
      }
      if (kind === 'talk') {
        if (dist < T.talkRadius - 3) w.missions.talk();
        else this.autoWalkTo(tx, tz, dt);
        return;
      }
      this.autoWalkTo(tx, tz, dt);
      return;
    }
    // Far: prefer the car.
    if (!w.player.inCar) {
      const car = w.drive.nearestCar(p.x, p.z, 40, true);
      if (car) {
        const cd = Math.hypot(car.pos.x - p.x, car.pos.z - p.z);
        if (cd < 6) {
          w.drive.enterCar(w.player, car);
        } else {
          this.autoWalkTo(car.pos.x, car.pos.z, dt);
        }
        return;
      }
      this.autoWalkTo(tx, tz, dt);
      return;
    }
    this.autoDriveTo(tx, tz, dt);
  }

  // --- main loop ---
  step(dt) {
    const w = this.world;
    if (!this.started) return;
    w.city.advance(dt);
    // Player movement.
    if (w.player.inCar) {
      const axes = w.input.driveAxes();
      w.drive.stepCar(w.player.inCar, dt, axes.throttle, axes.steer);
      w.player.pos.copy(w.player.inCar.pos);
      w.player.heading = w.player.inCar.heading;
      w.audio.engine(Math.abs(w.player.inCar.speed) / w.player.inCar.maxSpeed);
    } else {
      const axes = w.input.walkAxes();
      w.onfoot.step(w.player, dt, axes, w.player.heading);
      w.audio.engine(0);
    }
    w.traffic.step(dt);
    w.police.step(dt);
    w.heli.step(dt);
    w.crime.step(dt);
    w.combat.step(dt);
    w.side.step(dt);
    w.missions.update(dt);
    w.effects.step(dt);
    this.elapsed += dt;
  }

  frame(now) {
    const dtRaw = Math.min(0.1, (now - this.lastNow) / 1000 || 0.016);
    this.lastNow = now;
    const dt = dtRaw * this.timescale;
    // Substeps keep physics stable at high timescale.
    let remaining = dt;
    while (remaining > 0) {
      const s = Math.min(remaining, 0.05);
      this.step(s);
      remaining -= s;
    }
    if (this.autopilot) this.autopilotStep(dtRaw * this.timescale);
    if (this.started) {
      this.world.scene.followCamera(dtRaw);
      this.world.scene.render();
      this.world.hud.update(now);
    }
    if (this.autopilot) this.updatePlaytest();
    requestAnimationFrame((t) => this.frame(t));
  }

  updatePlaytest() {
    const w = this.world;
    window.__PLAYTEST__ = {
      missionIndex: w.missions.index,
      missionTitle: w.missions.title,
      missionsDone: w.missions.index + (w.missions.done ? 1 : 0),
      cash: Math.round(w.player.cash),
      wanted: w.wanted,
      elapsed: Math.round(this.elapsed),
      errors: this.errors.slice(),
      done: w.missions.done,
    };
  }

  start(withMenu = true) {
    const w = this.world;
    this.started = true;
    const menu = document.getElementById('menu');
    if (menu) menu.style.display = 'none';
    w.audio.resume();
    w.radio.start();
    return true;
  }

  boot() {
    const w = this.world;
    const canvas = document.getElementById('game');
    w.scene.init(canvas);
    w.hud.init();
    w.input.attach();
    this.bindKeys();
    // First mission setup needs the scene (NPC meshes).
    w.missions.onEnter(0);
    // Parked cars + traffic so the streets are never empty.
    const parked = [
      [-30, 250, 'sedan'], [30, 200, 'sedan'], [-100, 100, 'muscle'],
      [100, 0, 'sedan'], [0, -100, 'sedan'], [200, 150, 'sedan'],
      [-200, -50, 'muscle'], [50, -200, 'sedan'], [30, 250, 'sports'],
    ];
    for (const [x, z, kind] of parked) this.spawnParkedCar(x, z, kind);
    w.traffic.spawnInitial(8);
    // Menu overlay.
    const menu = document.getElementById('menu');
    if (menu) {
      menu.addEventListener('click', () => this.start(true));
    }
    this.lastNow = performance.now();
    requestAnimationFrame((t) => this.frame(t));
    // Test API.
    const api = {
      get mission() { return w.missions.state(); },
      get player() {
        return {
          cash: Math.round(w.player.cash),
          health: Math.round(w.player.health),
          x: Math.round(w.player.pos.x),
          z: Math.round(w.player.pos.z),
          inCar: !!w.player.inCar,
          vehicle: w.player.inCar ? w.player.inCar.kind : null,
        };
      },
      get wanted() { return w.wanted; },
      get heli() { return w.heli.state; },
      get radio() { return w.radio.state(); },
      get garage() { return w.garage.state(); },
      get enemiesLeft() { return w.combat.enemiesLeft(); },
      get drifting() { return { drifting: !!(w.player.inCar && w.player.inCar.drifting) }; },
      get crime() { return w.crime.state(); },
      get side() { return w.side.state(); },
      get unlocked() { return { ...w.combat.unlocked }; },
      world: w,
      start: (v) => this.start(v),
      teleport: (x, z) => this.teleport(x, z),
      enterNearestCar: () => this.enterNearestCar(),
      enterSportsCar: () => this.enterSportsCar(),
      setWanted: (n) => this.setWanted(n),
      setDayFrac: (f) => w.city.setDayFrac(f),
      robAtm: () => w.crime.robAtm(),
      clearCrime: () => w.crime.clear(),
      forceCrime: (t) => w.crime.force(t),
      crimePos: () => w.crime.eventPos(),
      startTaxi: () => w.side.startTaxi(),
      startRace: () => w.side.startRace(),
      collectibleIds: () => w.side.collectibleIds(),
      collectiblePos: (id) => w.side.collectiblePos(id),
      setStation: (i) => w.radio.setStation(i),
      buyVehicle: (id) => w.garage.buy(id),
      sellVehicle: (id) => w.garage.sell(id),
      selectVehicle: (id) => w.garage.select(id),
      crouch: (b) => this.crouch(b),
    };
    window.__solmar = api;
    window.__GAME__ = this;
    window.__solmarReady = true;
    if (this.shotMode) {
      this.start(false);
      applyShotMode(w, this.shotMode);
    }
    if (this.autopilot) {
      this.start(false);
    }
  }
}

const game = new Game();
game.boot();
