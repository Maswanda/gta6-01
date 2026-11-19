// main.js — Solmar Bay boot, fixed-timestep loop, the autopilot (?autopilot=1),
// the ?shot= staging, and the window.__solmar hook the playtest drives.
// The simulation is 2D (x/z); scene.js draws it in 3D.
import { T, LM, dist, clamp, angDiff } from './tuning.js';
import { seedFromUrl } from './rng.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { Radio } from './radio.js';
import { City } from './city.js';
import { Car, nearestCar } from './drive.js';
import { Traffic } from './traffic.js';
import { Player } from './onfoot.js';
import { Combat } from './combat.js';
import { Police } from './police.js';
import { Helicopter } from './helicopter.js';
import { Crime } from './crime.js';
import { Garage } from './garage.js';
import { Missions } from './missions.js';
import { Side } from './side.js';
import { Save } from './persist.js';
import { Hud } from './hud.js';
import { Effects } from './effects.js';
import { Scene } from './scene.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(location.search);
const SEED = seedFromUrl();
const AUTOPILOT = params.get('autopilot') === '1';
const TIMESCALE = Math.max(1, Math.min(16, Number(params.get('timescale') || '1') || 1));
const SHOT = params.get('shot');

// ---- world ----
const city = new City(SEED);
const input = new Input();
const audio = new AudioSys();
const radio = new Radio(audio);
const traffic = new Traffic(city, SEED);
const player = new Player();
const combat = new Combat();
const police = new Police(city);
const heli = new Helicopter(city);
const crime = new Crime(city);
const garage = new Garage();
const side = new Side(city);
const effects = new Effects();
const allCars = [...traffic.cars];
// A starter sedan near the pier so the player can drive from the start.
const starterCar = new Car(-52, 260, 'sedan');
allCars.push(starterCar);

const world = {
  city, input, audio, radio, traffic, player, combat, police, heli, crime,
  garage, side, effects, allCars, seed: SEED,
  _carClass: { Car },
};
const missions = new Missions(world);
world.missions = missions;
const save = new Save(world);
world.save = save;
const hud = new Hud(world);
world.hud = hud;
const scene = new Scene(world);
world.scene = scene;
heli.group = scene._heliGroup;
// The playtest drives the player by its mesh (teleport + visual sync).
player.mesh = scene._playerMesh;

// ---- playtest / error capture ----
const playErrors = [];
window.addEventListener('error', (e) => { playErrors.push(String(e.message || e.error || 'error')); });

// ---- autopilot ----
const auto = {
  enabled: AUTOPILOT,
  car: null,          // the car the autopilot adopted/spawned (reused, never re-spawned per step)
  stuckT: 0,          // seconds left in the current stuck window
  stuckPos: null,     // position at the start of the window
  objKey: '',
  idleT: 0,
};

function ensureAutoCar() {
  if (player.inCar) return player.inCar;
  // Reuse the adopted car while it is alive, near and healthy.
  if (auto.car && auto.car.alive && auto.car.hp > 50
    && dist(auto.car.pos.x, auto.car.pos.z, player.pos.x, player.pos.z) < 40) {
    return auto.car;
  }
  const near = nearestCar(allCars, player.pos.x, player.pos.z, 40);
  if (near) {
    auto.car = near;
    near.reinforced = true; near.hp = Math.max(near.hp, 1000); near.maxHp = 1000;
    return near;
  }
  const c = new Car(player.pos.x + 8, player.pos.z + 4, 'sedan');
  c.reinforced = true; c.hp = 1000; c.maxHp = 1000;
  allCars.push(c);
  auto.car = c;
  return c;
}

function teleportCarNear(car, tx, tz) {
  // Recovery: place the car just outside the objective so it can drive in.
  const dx = tx - car.pos.x, dz = tz - car.pos.z;
  const d = Math.hypot(dx, dz) || 1;
  const nx = tx - (dx / d) * 12, nz = tz - (dz / d) * 12;
  car.pos.set(nx, 0, nz);
  car.heading = Math.atan2(tx - nx, tz - nz);
  car.speed = 0;
  car.slide = 0;
  car.syncMesh(0);
  player.pos.copy(car.pos);
  auto.stuckT = 0;
  auto.stuckPos = null;
}

// Drive the player's car toward (tx, tz); stop inside radius. Returns true when arrived.
function autoDriveTo(tx, tz, radius, dt) {
  if (!player.inCar) {
    const car = ensureAutoCar();
    if (!car) return false;
    // Get in: walk if close, teleport next to it if far.
    const d = dist(player.pos.x, player.pos.z, car.pos.x, car.pos.z);
    if (d > 8) { player.pos.set(car.pos.x + 2, 0, car.pos.z + 2); }
    player.enterCar(car);
    return false;
  }
  const car = player.inCar;
  const d = dist(car.pos.x, car.pos.z, tx, tz);
  if (d <= radius) {
    car.step(0, 0, true, dt, city);
    return true;
  }
  const want = Math.atan2(tx - car.pos.x, tz - car.pos.z);
  const err = angDiff(car.heading, want);
  const steer = clamp(err * 2.2, -1, 1);
  const throttle = Math.abs(err) > 1.2 ? 0.4 : 1;
  car.step(steer, throttle, false, dt, city);
  // Stuck recovery over a 4-second window (never per-step: per-step the
  // car barely moves, so a per-step check teleports every 4 s).
  const key = `${tx},${tz}`;
  if (auto.objKey !== key) { auto.objKey = key; auto.stuckT = 0; auto.stuckPos = null; }
  if (auto.stuckT <= 0) {
    auto.stuckT = 4;
    auto.stuckPos = { x: car.pos.x, z: car.pos.z };
  } else {
    auto.stuckT -= dt;
    if (auto.stuckT <= 0) {
      const moved = dist(car.pos.x, car.pos.z, auto.stuckPos.x, auto.stuckPos.z);
      // Never teleport a player already inside the objective radius.
      if (moved < 3 && dist(car.pos.x, car.pos.z, tx, tz) > radius) {
        teleportCarNear(car, tx, tz);
      }
    }
  }
  return false;
}

function autoStep(dt) {
  if (!auto.enabled || missions.done) return;
  const obj = missions.objective();
  if (!obj) return;
  const pPos = player.inCar ? player.inCar.pos : player.pos;
  if (obj.kind === 'talk') {
    const d = dist(pPos.x, pPos.z, obj.x, obj.z);
    if (d > T.talkRadius) {
      if (player.inCar) {
        if (autoDriveTo(obj.x, obj.z, 10, dt)) player.exitCar();
      } else if (d > 30) {
        player.teleport(obj.x, obj.z);
      } else {
        // Walk the last stretch.
        const want = Math.atan2(obj.x - pPos.x, obj.z - pPos.z);
        player.heading = want;
        input.pressKey('KeyW');
        player.step(input, dt, city);
        input.releaseKey('KeyW');
      }
    } else {
      missions.onTalk();
    }
    return;
  }
  if (obj.kind === 'goto' || obj.kind === 'race') {
    autoDriveTo(obj.x, obj.z, T.gotoRadius, dt);
    return;
  }
  if (obj.kind === 'safehouse') {
    // Drive there, then wait for the heat to cool off.
    if (dist(pPos.x, pPos.z, obj.x, obj.z) > T.gotoRadius) {
      autoDriveTo(obj.x, obj.z, T.gotoRadius, dt);
    }
    return;
  }
  if (obj.kind === 'kill') {
    const d = dist(pPos.x, pPos.z, obj.x, obj.z);
    if (d > 25) { autoDriveTo(obj.x, obj.z, 20, dt); return; }
    if (player.inCar) player.exitCar();
    const alive = combat.alive;
    if (!alive.length) return;
    // Aim at the nearest living enemy and fire; reload when dry.
    let best = null, bestD = Infinity;
    for (const e of alive) {
      const dd = dist(player.pos.x, player.pos.z, e.pos.x, e.pos.z);
      if (dd < bestD) { best = e; bestD = dd; }
    }
    if (!best) return;
    player.heading = Math.atan2(best.pos.x - player.pos.x, best.pos.z - player.pos.z);
    if (combat.ammo[combat.weapon] <= 0) combat.reload();
    else combat.fire(player, audio, world);
    return;
  }
  if (obj.kind === 'heli') {
    // Idle: the mission sets 4 stars, the chopper lifts off, the step advances.
    return;
  }
}

// ---- game state ----
let playing = false;
let paused = false;
let elapsed = 0;
let startedAt = 0;

function startGame(demo) {
  if (playing) return;
  playing = true;
  startedAt = performance.now();
  const menu = document.getElementById('menu');
  if (menu) menu.style.display = 'none';
  audio.ensure();
  if (demo) auto.enabled = true;
  missions.start();
}

function enterNearestCar() {
  const car = nearestCar(allCars, player.pos.x, player.pos.z, 9);
  if (!car) return false;
  return player.enterCar(car);
}
function enterSportsCar() {
  let best = null, bestD = 60;
  for (const c of allCars) {
    if (!c.alive || c.isPolice || c.kind !== 'sports') continue;
    const d = dist(player.pos.x, player.pos.z, c.pos.x, c.pos.z);
    if (d < bestD) { best = c; bestD = d; }
  }
  if (!best) {
    best = new Car(player.pos.x + 6, player.pos.z + 4, 'sports');
    allCars.push(best);
  }
  if (player.inCar) player.exitCar();
  return player.enterCar(best);
}

// ---- the window.__solmar hook (the playtest drives the game through this) ----
window.__solmar = {
  get mission() { return missions.state; },
  get player() {
    return {
      cash: player.cash, health: player.health, armor: player.armor,
      inCar: !!player.inCar, carKind: player.inCar ? player.inCar.kind : null,
      x: player.pos.x, z: player.pos.z, heading: player.heading,
    };
  },
  get wanted() { return police.wanted; },
  get enemiesLeft() { return combat.enemiesLeft; },
  get unlocked() { return combat.unlocked; },
  get side() { return side.state; },
  get radio() { return radio.state; },
  get garage() { return garage.state; },
  get heli() { return heli.state; },
  get drifting() { return { drifting: !!(player.inCar && player.inCar.drifting) }; },
  get crime() { return crime.state; },
  world,
  start: (demo) => startGame(!!demo),
  teleport: (x, z) => player.teleport(x, z),
  enterNearestCar,
  enterSportsCar,
  setWanted: (n) => police.setWanted(n),
  setDayFrac: (f) => city.setDayFrac(f),
  robAtm: () => crime.robAtm(player, world),
  clearCrime: () => crime.clear(),
  forceCrime: (type) => crime.force(type, world),
  crimePos: () => crime.eventPos(),
  startTaxi: () => side.startTaxi(world),
  startRace: () => side.startRace(),
  collectibleIds: () => side.collectibleIds(),
  collectiblePos: (id) => side.collectiblePos(id),
  setStation: (i) => radio.setStation(i),
  buyVehicle: (t) => garage.buy(t, player),
  selectVehicle: (t) => garage.select(t),
  sellVehicle: (t) => garage.sell(t, player),
  crouch: (b) => { player.crouched = !!b; },
};
window.__GAME__ = false;
Object.defineProperty(window, '__PLAYTEST__', {
  get() {
    return {
      missionIndex: missions.index,
      missionTitle: missions.current ? missions.current.title : 'Done',
      missionsDone: missions.done ? 12 : missions.index,
      cash: Math.floor(player.cash),
      wanted: police.wanted,
      elapsed: Math.round(elapsed),
      errors: playErrors,
      done: missions.storyComplete,
    };
  },
});

// ---- fixed-timestep loop ----
let last = performance.now();
let acc = 0;
const STEP = 1 / 60;
let booted = false;

function step(dt) {
  elapsed += dt;
  // Autopilot first (it drives input / actions).
  autoStep(dt);
  // Player: drive or walk.
  if (player.inCar) {
    const car = player.inCar;
    if (!car.alive) { player.exitCar(); }
    else {
      const steer = input.steer();
      const throttle = input.throttle();
      car.step(steer, throttle, input.down('KeyS') && throttle <= 0 ? false : false, dt, city);
      if (input.drift && Math.abs(car.speed) > 10) car.slide += input.steer() * 6 * dt;
      audio.engine(Math.abs(car.speed) / car.maxSpeed, true);
    }
  } else {
    player.step(input, dt, city);
    audio.engine(0, false);
  }
  // Discrete keys.
  if (input.takePressed('KeyE')) {
    // Talk FIRST: if a mission talk is in range, do it — even from the
    // car. (E used to exit the car before trying to talk, which stranded
    // the player in a car at a talk point: the talk never fired and the
    // mission could not advance.)
    if (!missions.onTalk()) {
      if (player.inCar) player.exitCar();
      else {
        // E near a car enters it; E near an ATM robs it.
        if (!enterNearestCar()) {
          const p = player.pos;
          const near = city.nearestAtm(p.x, p.z, true);
          if (near && near.d <= T.atmRange + 12) crime.tryAtm(player, world);
        }
      }
    }
  }
  if (input.takePressed('KeyF')) crime.punch(player);
  if (input.takePressed('KeyG')) {
    if (combat.ammo[combat.weapon] <= 0) combat.reload();
    else combat.fire(player, audio, world);
  }
  if (input.takePressed('KeyR')) {
    if (combat.ammo[combat.weapon] <= 0) combat.reload();
    else radio.cycle();
  }
  if (input.takePressed('Digit1')) combat.switchWeapon('pistol');
  if (input.takePressed('Digit2')) combat.switchWeapon('shotgun');
  if (input.takePressed('Digit3')) combat.switchWeapon('smg');
  if (input.takePressed('KeyT')) {
    const r = side.taxiInteract(world);
    if (!r) side.startTaxi(world);
  }
  if (input.takePressed('KeyY')) side.startRace();
  if (input.takePressed('KeyP')) { paused = !paused; hud.toast(paused ? 'Paused' : 'Resumed'); }
  if (input.takePressed('KeyH')) hud.toast('Solmar Bay — 12 missions, radio, garage, heli. WASD drive, E talk, G fire.');
  // World systems.
  traffic.update(dt, player.pos);
  combat.update(dt, player, world);
  police.update(dt, world);
  heli.update(dt, world);
  crime.update(dt, world);
  missions.update(dt);
  side.update(dt, world);
  // Safehouse rest: heal while resting at the safehouse (the police may
  // still be hunting you there, so the heal has to outpace their damage).
  if (dist(player.pos.x, player.pos.z, LM.safehouse[0], LM.safehouse[1]) < 26) {
    player.heal(25 * dt);
  }
  city.update(dt);
  radio.update(dt);
  effects.update(dt);
  // Wasted / busted.
  if (player.dead) {
    player.respawn();
    police.setWanted(0);
    hud.toast('Wasted — back at the safehouse');
  }
  if (player.inCar && !player.inCar.alive) {
    player.exitCar();
    hud.toast('Your ride is wrecked');
  }
  // Rendering happens once per frame in frame(), not per simulation step.
}

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  if (!booted) {
    booted = true;
    window.__GAME__ = true;
    window.__solmarReady = true;
  }
  if (!playing || paused) {
    // Still render so the menu / shot scenes show.
    scene.render(0);
    return;
  }
  acc += dt * TIMESCALE;
  let n = 0;
  while (acc >= STEP && n < 120) {
    step(STEP);
    acc -= STEP;
    n++;
  }
  if (n >= 120) acc = 0; // drop backlog rather than spiral
  // One render + one HUD update per frame, after all simulation steps.
  hud.update();
  scene.render(dt);
}

// ---- boot ----
function boot() {
  // Start screen.
  const menu = document.getElementById('menu');
  const startBtn = document.getElementById('menu-start');
  if (startBtn) startBtn.addEventListener('click', () => startGame(false));
  window.addEventListener('keydown', (e) => {
    if (!playing && (e.code === 'Enter' || e.code === 'Space')) startGame(false);
  });
  // URL modes auto-start.
  if (SHOT) {
    startGame(false);
    stageShot(world, SHOT);
  } else if (AUTOPILOT) {
    startGame(true);
  }
  requestAnimationFrame(frame);
}
boot();
