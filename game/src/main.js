// main.js — Boot and the game loop for Solmar Bay.
// Assembles every system into one World, runs the frame loop, and
// exposes the window.__solmar API the playtest and the ?shot=
// staging use. This file is the only place the systems meet.
import * as THREE from 'three';
import { TUNE, clamp, dist2d } from './tuning.js';
import { SeededRandom } from './rng.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { Radio } from './radio.js';
import { City } from './city.js';
import { Scene3D } from './scene.js';
import { Hud } from './hud.js';
import { Effects } from './effects.js';
import { Car } from './drive.js';
import { Traffic } from './traffic.js';
import { Police } from './police.js';
import { Helicopter } from './helicopter.js';
import { Garage } from './garage.js';
import { Crime } from './crime.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { Side } from './side.js';
import { Save } from './persist.js';
import { OnFoot } from './onfoot.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = parseInt(params.get('seed') || '11', 10) || 11;

class World {
  constructor() {
    this.rng = new SeededRandom(seed);
    this.time = { now: 0 };
    this.state = 'menu';
    this.cameraLocked = false;
    this.hint = '';
    this.drifting = false;
    this.unlocked = { pistol: true, shotgun: false, smg: false };
    this.input = new Input();
    this.audio = new AudioEngine();
    this.radio = new Radio(this.audio);
    this.city = new City(seed);
    this.scene = new Scene3D(this.city);
    this.hud = new Hud();
    this.effects = new Effects(this.scene);
    this.allCars = [];
    // Player.
    this.player = {
      pos: new THREE.Vector3(-60, 0, 280),
      heading: 0,
      health: TUNE.maxHealth,
      armor: 50,
      cash: TUNE.startCash,
      inCar: null,
      crouch: false,
      moving: false,
      mesh: this.scene.makePlayerMesh(),
    };
    this.player.mesh.position.copy(this.player.pos);
    this.scene.dynamic.add(this.player.mesh);
    // Systems (order matters: police needs heli, combat needs missions).
    this.traffic = new Traffic(this);
    this.heli = new Helicopter(this);
    this.police = new Police(this);
    this.garage = new Garage(this);
    this.crime = new Crime(this);
    this.combat = new Combat(this);
    this.missions = new Missions(this);
    this.side = new Side(this);
    this.save = new Save(this);
    this.onfoot = new OnFoot(this);
    Object.defineProperty(this.player, 'weapon', {
      get: () => this.combat.weapon,
      configurable: true,
    });
    this._wireButtons();
  }
  _wireButtons() {
    const on = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    };
    on('btn-start', () => this.start(false));
    on('btn-resume', () => this.resume());
    on('btn-busted', () => this.respawn());
    on('btn-dead', () => this.respawn());
    on('btn-garage-close', () => this.garage.closeUI());
  }
  start(fromMenu) {
    this.audio.resume();
    this.radio.start();
    this.state = 'playing';
    this.hud.showMenu(false);
    this.hud.showPause(false);
    this.missions.start();
    this.hud.toast('Solmar Bay — find Mara at the pier.');
  }
  resume() {
    this.state = 'playing';
    this.hud.showPause(false);
  }
  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.hud.showPause(true);
  }
  respawn() {
    const p = this.player;
    const sh = TUNE.landmarks.safehouse;
    if (p.inCar) p.inCar = null;
    p.pos.set(sh.x, 0, sh.z + 6);
    p.heading = Math.PI;
    p.health = TUNE.maxHealth;
    p.armor = 50;
    p.cash = Math.floor(p.cash * 0.9);
    this.police.setWanted(0);
    this.hud.showBusted(false);
    this.hud.showDead(false);
    this.state = 'playing';
    this.scene.snapCamera(p.pos.x, p.pos.z, p.heading, false);
  }
  busted() {
    this.audio.busted();
    this.police.setWanted(0);
    this.player.cash = Math.floor(this.player.cash * (1 - TUNE.bustCashLoss));
    this.hud.showBusted(true);
    this.state = 'busted';
  }
  damagePlayer(n, fromPos) {
    const p = this.player;
    if (p.health <= 0 || this.state !== 'playing') return;
    let dmg = n;
    if (p.armor > 0) {
      const absorbed = Math.min(p.armor, dmg * 0.6);
      p.armor -= absorbed;
      dmg -= absorbed;
    }
    p.health -= dmg;
    this.effects.screenFlash(0xff2222, 0.25);
    if (p.health <= 0) {
      p.health = 0;
      this.audio.busted();
      this.hud.showDead(true);
      this.state = 'dead';
    }
  }
  // ATM robbery: +$250, +2 wanted.
  robAtm() {
    this.player.cash += TUNE.atmReward;
    this.police.addWanted(TUNE.atmWanted);
    this.audio.cash();
    this.hud.toast('ATM robbed  +$' + TUNE.atmReward + ' — the heat is on!');
    return true;
  }
  teleport(x, z) {
    const p = this.player;
    p.pos.set(x, 0, z);
    if (p.inCar) {
      p.inCar.pos.set(x, 0, z);
      p.inCar.speed = 0;
      p.inCar.syncMesh(0);
    }
    p.mesh.position.copy(p.pos);
    if (!this.cameraLocked) this.scene.snapCamera(x, z, p.heading, !!p.inCar);
    return true;
  }
  // ---- per-frame ----
  _driveCar(dt) {
    const p = this.player;
    const car = p.inCar;
    const input = this.input;
    let steer = 0;
    let throttle = 0;
    if (input.down('KeyW') || input.down('ArrowUp')) throttle += 1;
    if (input.down('KeyS') || input.down('ArrowDown')) throttle -= 1;
    if (input.down('KeyA') || input.down('ArrowLeft')) steer -= 1;
    if (input.down('KeyD') || input.down('ArrowRight')) steer += 1;
    car.drive(steer, throttle, dt);
    this.drifting = car.drifting;
    if (car.drifting) {
      this.effects.skid(car.pos.x - Math.sin(car.heading) * 1.4, car.pos.z - Math.cos(car.heading) * 1.4, car.heading);
      if (this.rng.chance(0.3)) this.effects.smoke(new THREE.Vector3(car.pos.x, 0.4, car.pos.z));
    }
    // Player follows the car.
    p.pos.copy(car.pos);
    p.heading = car.heading;
    p.mesh.visible = false;
    this.audio.engine(Math.abs(car.speed) / car.spec.topSpeed, true);
    // In-car action keys.
    if (input.pressed('KeyF')) this.onfoot.exitCar();
    if (input.pressed('KeyE') || input.pressed('KeyT')) {
      // E talks first; if there is no talk to have, E gets out of the
      // car (the harness exits the car with E before a shootout).
      const talked = this.missions.tryTalk();
      this.side.tryInteract();
      this.garage.tryOpen();
      if (input.pressed('KeyE') && !talked) this.onfoot.exitCar();
    }
    if (input.pressed('KeyG')) this.combat.tryShoot();
    if (input.pressed('KeyR')) this.combat.reload();
    if (input.pressed('Digit1')) this.combat.selectWeapon('pistol');
    if (input.pressed('Digit2')) this.combat.selectWeapon('shotgun');
    if (input.pressed('Digit3')) this.combat.selectWeapon('smg');
    if (input.pressed('KeyQ')) {
      this.radio.setStation(this.radio.station + 1);
      this.hud.toast('Radio: ' + this.radio.name);
    }
  }
  update(dt) {
    this.time.now += dt;
    this.city.advance(dt);
    // Pause toggle.
    if (this.input.pressed('Escape')) {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
      else if (this.garage.uiOpen) this.garage.closeUI();
    }
    if (this.state !== 'playing') return;
    const p = this.player;
    if (p.inCar) this._driveCar(dt);
    else {
      this.drifting = false;
      this.onfoot.update(dt);
      this.audio.engine(0, false);
      p.mesh.visible = true;
    }
    this.traffic.update(dt);
    this.police.update(dt);
    this.heli.update(dt);
    this.crime.update(dt);
    this.combat.update(dt);
    this.missions.update(dt);
    this.side.update(dt);
    // Siren while wanted.
    this.audio.siren(this.police.wanted > 0);
    // Hint line.
    if (this.side.taxi.state === 'pickup' && this.side.taxi.passenger &&
        dist2d(p.pos.x, p.pos.z, this.side.taxi.passenger.x, this.side.taxi.passenger.z) < 12) {
      this.hint = 'Press T to pick up the passenger';
    } else {
      this.hint = this.missions.currentHint();
    }
  }
  render(dt) {
    const p = this.player;
    this.scene.updateDayNight(this.city.nightness());
    if (!this.cameraLocked) {
      this.scene.updateCamera(p.pos.x, p.pos.z, p.heading, !!p.inCar, dt);
      const sh = this.effects.shakeOffset();
      this.scene.camera.position.x += sh.x;
      this.scene.camera.position.y += sh.y;
    }
    this.effects.update(dt, this.scene.camera);
    this.hud.update(this);
    this.scene.render();
  }
}

// ---- boot ----
const world = new World();
window.__solmarWorld = world;

if (shotName) {
  stageShot(world, shotName);
}

// The public API.
window.__solmar = {
  world,
  start: (fromMenu) => world.start(fromMenu),
  get mission() {
    const m = world.missions.current;
    return {
      index: world.missions.index,
      step: world.missions.step,
      title: m ? m.title : 'Story complete',
      objective: world.missions.currentObjective(),
      done: world.missions.done,
    };
  },
  get player() {
    const p = world.player;
    return {
      cash: p.cash,
      health: p.health,
      armor: p.armor,
      weapon: world.combat.weapon,
      wanted: world.police.wanted,
      inCar: !!p.inCar,
      x: p.pos.x,
      z: p.pos.z,
    };
  },
  get wanted() {
    return world.police.wanted;
  },
  setWanted: (n) => world.police.setWanted(n),
  get unlocked() {
    return { ...world.unlocked };
  },
  get side() {
    // A plain snapshot (no .world reference) so the harness can
    // serialize it; the live object lives at world.side.
    const s = world.side;
    return {
      taxi: { state: s.taxi.state, passenger: s.taxi.passenger, dest: s.taxi.dest, fare: s.taxi.fare },
      race: { state: s.race.state, cp: s.race.cp },
      collected: [...s.collected],
    };
  },
  get enemiesLeft() {
    return world.combat.enemiesLeft;
  },
  startTaxi: () => world.side.startTaxi(),
  startRace: () => world.side.startRace(),
  collectibleIds: () => world.side.collectibleIds(),
  collectiblePos: (id) => world.side.collectiblePos(id),
  setDayFrac: (f) => world.city.setDayFrac(f),
  robAtm: () => world.robAtm(),
  clearCrime: () => world.crime.clearCrime(),
  forceCrime: (type) => world.crime.forceCrime(type),
  get crime() {
    return { active: world.crime.active, interventions: world.crime.interventions };
  },
  crimePos: () => world.crime.eventPos(),
  get drifting() {
    return { drifting: !!world.drifting };
  },
  crouch: (b) => {
    world.player.crouch = !!b;
    return world.player.crouch;
  },
  get radio() {
    return world.radio.state();
  },
  setStation: (i) => world.radio.setStation(i),
  buyVehicle: (id) => world.garage.buyVehicle(id),
  sellVehicle: (id) => world.garage.sellVehicle(id),
  selectVehicle: (id) => world.garage.selectVehicle(id),
  get garage() {
    return world.garage.state();
  },
  get heli() {
    return { active: world.heli.active, lit: world.heli.lit };
  },
  enterNearestCar: () => world.onfoot.tryEnterCar(),
  enterSportsCar: () => world.onfoot.enterSportsCar(),
  teleport: (x, z) => world.teleport(x, z),
  selectWeapon: (id) => world.combat.selectWeapon(id),
};

// ---- frame loop ----
let last = performance.now();
let frames = 0;
let readySet = false;
function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = (now - last) / 1000;
  last = now;
  // Game time tracks real time (clamped for physics stability), so
  // headless runs stay fast enough for the playtest's waits.
  const dt = Math.min(Math.max(rawDt, 0), 0.1);
  try {
    world.update(dt);
    world.render(dt);
  } catch (e) {
    // Never let one bad frame kill the page; the error still surfaces
    // in the console for debugging.
    console.error(e);
  }
  frames += 1;
  if (!readySet) {
    // Shot scenes need a few frames for the heli / crew to settle.
    const need = shotName ? 6 : 2;
    if (frames >= need) {
      readySet = true;
      window.__solmarReady = true;
    }
  }
  world.input.endFrame();
}
requestAnimationFrame(frame);
