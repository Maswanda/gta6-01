// Solmar Bay: Heatwave v3 — bootstrap, game loop, camera, car enter/exit
// and the menu / playing / paused / busted / wasted state machine. v3 wires
// in the dynamic crime system, the day/night cycle, the casino's luxury
// sports cars, drift and the police chase that loses the trail, the Marina
// Heist, and the presentation polish (cash popups, wanted pulse, crime and
// day/night readouts).
import { CFG } from './config.js';
import { Rng } from './random.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { buildCity, collideCircle } from './city.js';
import { Player, lerpAngle } from './player.js';
import { Car, spawnTraffic, spawnParked, spawnMarinaSports, spawnCasinoSports } from './vehicles.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { SideActivities } from './side.js';
import { Effects } from './effects.js';
import { HUD } from './hud.js';
import { Save } from './save.js';
import { CrimeSystem } from './crime.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

const rng = new Rng(CFG.seed);
const city = buildCity(scene, rng);
const { colliders, landmarks } = city;

const world = {
  scene, camera, renderer, colliders, landmarks, city,
  state: 'menu',
  input: new Input(),
  sound: new SoundBank(),
  gunshotTimer: 0,
  camYaw: Math.PI,
  camPitch: 0.32,
  camDist: 9,
  camTarget: new THREE.Vector3(),
  shotCam: null,
  allCars: [],
  shake: 0,
};
world.input.attach(canvas);
world.hud = new HUD();
world.effects = new Effects(scene);
world.player = new Player(scene, landmarks.spawn);
world.traffic = spawnTraffic(scene, rng);
world.parkedCars = spawnParked(scene, rng);
world.marinaSports = spawnMarinaSports(scene, landmarks);
world.casinoSports = spawnCasinoSports(scene, landmarks);
world.allCars = [...world.traffic, ...world.parkedCars, world.marinaSports, ...world.casinoSports];
world.peds = new Pedestrians(scene, rng, colliders);
world.police = new Police(scene);
world.combat = new Combat(scene);
world.missions = new Missions(scene, landmarks);
world.side = new SideActivities(scene, landmarks, rng);
world.crime = new CrimeSystem(scene, landmarks, rng);
world.save = new Save(world);

// --- Car enter / exit -------------------------------------------------------
world.enterCar = function enterCar(car, silent) {
  const p = world.player;
  if (!car || !car.alive) return;
  if (car.parked || car.axis) {
    // Taking a parked or traffic car is grand theft auto in Solmar Bay.
    if (!car.stolen) {
      car.stolen = true;
      world.police.addWanted(1, world);
      if (!silent) world.hud.flashMessage(`Car stolen! (${car.label}) +1 wanted star`);
    }
  }
  p.inCar = car;
  car.isPlayer = true;
  car.parked = false;
  car.speed = 0;
  p.hide();
  world.sound.ensure();
  world.sound.door();
  if (!silent) world.hud.flashMessage(`${car.label} — ${car.tune.topSpeed * 3.6 | 0} km/h top speed`);
};

world.exitCar = function exitCar() {
  const p = world.player;
  const car = p.inCar;
  if (!car) return;
  car.isPlayer = false;
  car.speed = 0;
  p.inCar = null;
  const side = new THREE.Vector3(Math.cos(car.heading), 0, -Math.sin(car.heading));
  p.pos.copy(car.pos).addScaledVector(side, 2.4);
  collideCircle(p.pos, CFG.playerRadius, colliders);
  p.heading = car.heading;
  p.show();
  p.mesh.position.copy(p.pos);
  world.sound.door();
};

function nearestCar(maxDist) {
  const p = world.player.pos;
  let best = null;
  let bestD = maxDist;
  for (const car of world.allCars) {
    if (!car.alive || car.isPolice) continue;
    const d = Math.hypot(car.pos.x - p.x, car.pos.z - p.z);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

// --- State changes ----------------------------------------------------------
function startGame(continueSave) {
  world.sound.ensure();
  if (continueSave) {
    world.save.load();
    world.hud.flashMessage('Welcome back to Solmar Bay.');
  } else {
    world.save.clear();
    world.player.cash = 0;
    world.player.health = CFG.playerHealth;
    world.player.stamina = CFG.staminaMax;
    world.missions.index = 0;
    world.missions.done = false;
    world.combat.weapon = 'pistol';
    world.combat.unlocked = { pistol: true, shotgun: false, smg: false };
    world.combat.ammo = { pistol: CFG.magSize, shotgun: CFG.shotgunMag, smg: CFG.smgMag };
    world.combat.reserve = { pistol: 48, shotgun: 18, smg: 90 };
    world.side.reset();
    world.police.clearWanted();
  }
  world.missions.step = 0;
  world.state = 'playing';
  world.hud.hideMenu();
  world.hud.hideEnd();
  world.missions.startMission(world);
}

function toMenu() {
  world.state = 'menu';
  world.save.save();
  world.hud.showMenu(world.save.hasSave());
}

function endGame(kind) {
  const p = world.player;
  if (kind === 'busted') {
    const fine = Math.floor(p.cash * 0.2);
    p.cash -= fine;
    world.police.clearWanted();
    world.sound.busted();
    world.hud.showEnd('BUSTED', `The Solmar Bay PD caught up with you. Fine: $${fine}. Your crew bailed you out.`);
  } else {
    p.cash = Math.floor(p.cash / 2);
    world.sound.busted();
    world.hud.showEnd('WASTED', 'You got taken out. Half your cash is gone — the streets keep what they take.');
  }
  world.state = 'end';
  world.save.save();
}

function respawn() {
  const p = world.player;
  if (p.inCar) {
    p.inCar.isPlayer = false;
    p.inCar = null;
  }
  p.pos.copy(landmarks.spawn);
  p.heading = 0;
  p.health = CFG.playerHealth;
  p.show();
  p.mesh.position.copy(p.pos);
  world.camYaw = Math.PI;
  world.hud.hideEnd();
  world.state = 'playing';
}

world.hud.onStart = startGame;
world.hud.onResume = () => {
  if (world.state === 'end') respawn();
  else if (world.state === 'paused') {
    world.state = 'playing';
    world.hud.hidePause();
  }
};
world.hud.onRestart = () => {
  world.save.clear();
  startGame(false);
};
world.hud.onMenu = toMenu;

// --- Camera -----------------------------------------------------------------
function updateCamera(dt) {
  const p = world.player;
  const target = p.inCar ? p.inCar.pos : p.pos;
  const driving = !!p.inCar;
  world.camYaw -= world.input.mouseDX * 0.004;
  world.camPitch = Math.max(0.08, Math.min(0.9, world.camPitch + world.input.mouseDY * 0.003));
  world.camDist = Math.max(5, Math.min(16, world.camDist + world.input.wheel * 0.01));
  if (driving) {
    const want = p.inCar.heading + Math.PI;
    world.camYaw = lerpAngle(world.camYaw, want, Math.min(1, dt * 1.2));
  }
  const dist = driving ? CFG.camDistanceCar : CFG.camDistanceFoot;
  const height = driving ? CFG.camHeightCar : CFG.camHeightFoot;
  const d = world.camDist * (dist / 9);
  const cx = target.x + Math.sin(world.camYaw) * d * Math.cos(world.camPitch);
  const cz = target.z + Math.cos(world.camYaw) * d * Math.cos(world.camPitch);
  const cy = target.y + height + Math.sin(world.camPitch) * d * 0.6;
  // Speed-based look-ahead: at speed the camera looks further up the road,
  // and it settles more slowly, so fast driving feels fast.
  const speed01 = driving ? Math.min(1, Math.abs(p.inCar.speed) / p.inCar.tune.topSpeed) : 0;
  const lookAhead = driving ? speed01 * 9 : 0;
  const look = new THREE.Vector3(
    target.x + (driving ? p.inCar.forward.x * lookAhead : 0),
    target.y + 1.6,
    target.z + (driving ? p.inCar.forward.z * lookAhead : 0),
  );
  camera.position.lerp(new THREE.Vector3(cx, cy, cz), Math.min(1, dt * (8 - speed01 * 3)));
  if (world.shake > 0) {
    camera.position.x += (Math.random() - 0.5) * world.shake;
    camera.position.y += (Math.random() - 0.5) * world.shake;
    world.shake = Math.max(0, world.shake - dt * 2);
  }
  camera.lookAt(look);
}

// --- Main loop --------------------------------------------------------------
let last = performance.now();
let firstFrame = true;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const input = world.input;
  const p = world.player;
  const t = now / 1000;
  city.animate(dt, t);

  if (world.state === 'playing') {
    if (input.consume('Escape')) {
      world.state = 'paused';
      world.hud.showPause();
    }
    if (input.consume('KeyM')) world.hud.toggleTracker(world);
    // E does one thing per press: talk to a mission contact first, then
    // rob the ATM at the bank, then enter or exit a car. The talk takes
    // priority, so a press next to a contact never just opens a car door —
    // on foot or from the driver's seat.
    const step = world.missions.currentStep();
    const isTalk = step && step.type === 'talk' && step.target;
    let nearTalk = false;
    if (isTalk) {
      const pp = p.inCar ? p.inCar.pos : p.pos;
      nearTalk = Math.hypot(pp.x - step.target.x, pp.z - step.target.z) < step.radius;
    }
    const nearAtm = !p.inCar && Math.hypot(p.pos.x - world.crime.atmPos.x, p.pos.z - world.crime.atmPos.z) < 4;
    if (nearAtm) world.hud.setPrompt('Press E — rob the ATM (+$250, +2 wanted)');
    if (!nearTalk) {
      // One E press, routed once: the ATM first, then a car.
      const ePressed = input.consume('KeyE');
      if (ePressed && nearAtm && world.crime.robAtm(world)) {
        // Robbed — the press is spent.
      } else if (ePressed && !p.inCar) {
        const nearCar = nearestCar(3.4);
        if (nearCar) world.enterCar(nearCar, false);
      } else if (ePressed && p.inCar) {
        world.exitCar();
      }
    }
    // When nearTalk, the E press is left for missions.update to consume.
    // Combat on foot: punch, shoot (auto-fire for the SMG), reload, weapons.
    if (!p.inCar) {
      const wk = input.weaponKey();
      if (wk) world.combat.switchWeapon(wk, world);
      if (input.consume('KeyQ')) world.combat.cycleWeapon(world);
      if (input.held('Mouse0') || input.consume('KeyF')) world.combat.tryPunch(world);
      if (world.combat.def.auto) {
        if (input.held('Mouse2') || input.held('KeyG')) world.combat.tryShoot(world);
      } else if (input.consume('KeyG') || input.consume('Mouse2')) {
        world.combat.tryShoot(world);
      }
      if (input.consume('KeyR')) world.combat.reload(world);
    }
    // Driving.
    if (p.inCar) {
      const car = p.inCar;
      const axes = input.moveAxes();
      const throttle = axes.y;
      const steerInput = axes.x;
      const res = car.drive(throttle, -steerInput, dt, colliders, world.allCars);
      if (res && res.crashed) {
        world.sound.crash();
        // The camera shake scales with the impact — a tap shudders, a
        // 30 km/h wall hit rattles the whole frame.
        world.shake = Math.min(1.2, 0.25 + res.impact * 0.03);
        world.effects.sparks(car.pos.clone().setY(1));
        p.damage(2);
      }
      // A drift lays down thick smoke and sparks at the rear wheels.
      if (car.drifting) {
        const back = car.pos.clone().addScaledVector(car.forward, -1.8);
        world.effects.driftSmoke(back);
        if (Math.random() < 0.4) world.sound.skid();
      }
      // Hard cornering or braking at speed lays down tyre smoke.
      if (Math.abs(car.speed) > 14 && (Math.abs(steerInput) > 0.7 || (throttle < 0 && car.speed > 10))) {
        const back = car.pos.clone().addScaledVector(car.forward, -1.8);
        world.effects.skid(back);
        if (Math.random() < 0.25) world.sound.skid();
      }
      // Horn: honk, and nearby pedestrians scatter.
      if (input.consume('KeyH')) {
        world.sound.horn();
        for (const ped of world.peds.list) {
          if (Math.hypot(ped.pos.x - car.pos.x, ped.pos.z - car.pos.z) < 15) ped.flee = 2;
        }
      }
      if (world.peds.hitByCar(car.pos, Math.abs(car.speed))) {
        world.police.addWanted(1, world);
        world.hud.flashMessage('You hit a pedestrian! +1 wanted star');
        world.sound.crash();
      }
      world.sound.engine(Math.abs(car.speed) / car.tune.topSpeed, true);
    } else {
      world.sound.engine(0, false);
      p.update(dt, input, world.camYaw, colliders, world.allCars);
      const car = nearestCar(3.4);
      if (car) world.hud.setPrompt(car.stolen || !car.parked ? `Press E — get in (${car.label})` : `Press E — steal ${car.label}`);
    }
    for (const car of world.traffic) {
      if (car.alive && !car.isPlayer) car.driveTraffic(dt, colliders, world.allCars);
    }
    world.peds.update(dt, world);
    world.police.update(dt, world);
    world.combat.update(dt, world);
    world.missions.update(dt, world);
    world.side.update(dt, world);
    world.crime.update(dt, world);
    world.effects.update(dt);
    if (world.gunshotTimer > 0) world.gunshotTimer -= dt;
    if (p.health <= 0) endGame('wasted');
    else if (world.police.busted) {
      world.police.busted = false;
      endGame('busted');
    }
    if (p.health < CFG.playerHealth && world.police.wanted === 0) p.heal(dt * 2);
    updateCamera(dt);
    world.hud.update(dt, world);
  } else if (world.state === 'menu' || world.state === 'end' || world.state === 'paused') {
    for (const car of world.traffic) {
      if (car.alive && !car.isPlayer) car.driveTraffic(dt, colliders, world.allCars);
    }
    world.peds.update(dt, world);
    world.effects.update(dt);
    if (world.shotCam) {
      camera.position.copy(world.shotCam.pos);
      camera.lookAt(world.shotCam.look);
    } else {
      camera.position.set(
        Math.sin(t * 0.03) * 150, 70, Math.cos(t * 0.03) * 150,
      );
      camera.lookAt(0, 10, 0);
    }
  }

  renderer.render(scene, camera);
  input.endFrame();
  if (firstFrame) {
    firstFrame = false;
    window.__solmarReady = true;
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  applyShot(world, shot);
} else {
  world.hud.showMenu(world.save.hasSave());
}

// Debug / play-test hook (used by the automated play-test only).
window.__solmar = {
  world,
  get state() { return world.state; },
  get player() {
    const p = world.player;
    const pos = p.inCar ? p.inCar.pos : p.pos;
    return {
      x: pos.x, z: pos.z, health: p.health, cash: p.cash,
      inCar: !!p.inCar, speed: p.inCar ? p.inCar.speed : p.speed,
      vehicle: p.inCar ? p.inCar.type : null,
      stamina: p.stamina,
    };
  },
  get wanted() { return world.police.wanted; },
  get mission() {
    const m = world.missions;
    return {
      index: m.index, step: m.step, done: m.done, total: m.defs.length,
      text: m.objectiveText(), timer: m.timer,
    };
  },
  get enemiesLeft() { return world.combat.enemiesLeft(); },
  get side() {
    const s = world.side;
    return {
      collected: s.collected.size, total: CFG.collectibleCount,
      taxi: s.taxi.state, taxiBest: s.taxiBest, taxiRuns: s.taxiRuns,
      race: s.race.state, raceBest: s.raceBest, raceRuns: s.raceRuns,
    };
  },
  get weapon() { return world.combat.weapon; },
  get unlocked() { return { ...world.combat.unlocked }; },
  start: (cont) => startGame(!!cont),
  teleport: (x, z) => {
    const p = world.player;
    if (p.inCar) { p.inCar.pos.set(x, 0, z); p.inCar.syncMesh(0); }
    p.pos.set(x, 0, z);
    p.mesh.position.copy(p.pos);
  },
  enterNearestCar: () => {
    const car = nearestCar(6);
    if (car) world.enterCar(car, true);
    return !!car;
  },
  enterSportsCar: () => {
    const car = world.marinaSports;
    if (!car) return false;
    world.player.pos.set(car.pos.x + 2, 0, car.pos.z);
    world.enterCar(car, true);
    return true;
  },
  setWanted: (n) => { world.police.wanted = n; world.police.syncCars(world); },
  startTaxi: () => world.side.startTaxi(world),
  startRace: () => world.side.startRace(world, false),
  collectiblePos: (id) => {
    const g = world.side.collectibleMeshes.get(id);
    return g ? { x: g.position.x, z: g.position.z } : null;
  },
  collectibleIds: () => [...world.side.collectibleMeshes.keys()],
  // v3 hooks: the day/night clock, the ATM, the crime system, drift and crouch.
  setDayFrac: (f) => world.city.setDayFrac(f),
  robAtm: () => world.crime.robAtm(world),
  forceCrime: (type) => world.crime.forceCrime(type, world),
  clearCrime: () => world.crime.clearCrime(world),
  get crime() {
    const c = world.crime;
    return {
      active: !!c.event, type: c.event ? c.event.type : null,
      interventions: c.interventions, eventsSeen: c.eventsSeen,
    };
  },
  crimePos: () => {
    const pos = world.crime.eventPos();
    return pos ? { x: pos.x, z: pos.z } : null;
  },
  get drifting() {
    const car = world.player.inCar;
    return { drifting: !!(car && car.drifting), speed: car ? Math.abs(car.speed) : 0 };
  },
  crouch: (on) => { world.player.crouchForced = !!on; return world.player.crouchForced; },
};

requestAnimationFrame(frame);
