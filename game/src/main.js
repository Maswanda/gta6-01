// Solmar Bay: Heatwave — bootstrap, game loop, camera, car enter/exit and
// the menu / playing / paused / busted / wasted state machine.
import { CFG } from './config.js';
import { Rng } from './random.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { buildCity, collideCircle } from './city.js';
import { Player, lerpAngle } from './player.js';
import { Car, spawnTraffic, spawnParked } from './vehicles.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { Save } from './save.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

const rng = new Rng(CFG.seed);
const { colliders, landmarks } = buildCity(scene, rng);

const world = {
  scene, camera, renderer, colliders, landmarks,
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
world.player = new Player(scene, landmarks.spawn);
world.traffic = spawnTraffic(scene, rng);
world.parkedCars = spawnParked(scene, rng);
world.allCars = [...world.traffic, ...world.parkedCars];
world.peds = new Pedestrians(scene, rng, colliders);
world.police = new Police(scene);
world.combat = new Combat(scene);
world.missions = new Missions(scene, landmarks);
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
      if (!silent) world.hud.flashMessage('Car stolen! +1 wanted star');
    }
  }
  p.inCar = car;
  car.isPlayer = true;
  car.parked = false;
  car.speed = 0;
  p.hide();
  world.sound.ensure();
};

world.exitCar = function exitCar() {
  const p = world.player;
  const car = p.inCar;
  if (!car) return;
  car.isPlayer = false;
  car.speed = 0;
  p.inCar = null;
  // Step out on the driver's side.
  const side = new THREE.Vector3(Math.cos(car.heading), 0, -Math.sin(car.heading));
  p.pos.copy(car.pos).addScaledVector(side, 2.4);
  collideCircle(p.pos, CFG.playerRadius, colliders);
  p.heading = car.heading;
  p.show();
  p.mesh.position.copy(p.pos);
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
    world.missions.index = 0;
    world.missions.done = false;
    world.combat.ammo = CFG.magSize;
    world.combat.reserve = 48;
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
  // Mouse drag orbits; wheel zooms.
  world.camYaw -= world.input.mouseDX * 0.004;
  world.camPitch = Math.max(0.08, Math.min(0.9, world.camPitch + world.input.mouseDY * 0.003));
  world.camDist = Math.max(5, Math.min(16, world.camDist + world.input.wheel * 0.01));
  // While driving, ease the camera behind the car's heading.
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
  const look = new THREE.Vector3(target.x, target.y + 1.6, target.z);
  camera.position.lerp(new THREE.Vector3(cx, cy, cz), Math.min(1, dt * 8));
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

  if (world.state === 'playing') {
    if (input.consume('Escape')) {
      world.state = 'paused';
      world.hud.showPause();
    }
    // Enter / exit cars. E is consumed here ONLY when it actually does
    // something (a car is near, or the player is in one) — otherwise the
    // press falls through to the mission talk handler below.
    if (!p.inCar) {
      const nearCar = nearestCar(3.4);
      if (nearCar && input.consume('KeyE')) world.enterCar(nearCar, false);
    } else if (input.consume('KeyE')) {
      world.exitCar();
    }
    // Combat on foot.
    if (!p.inCar) {
      if (input.held('Mouse0') || input.consume('KeyF')) world.combat.tryPunch(world);
      if (input.consume('KeyG') || input.consume('Mouse2')) world.combat.tryShoot(world);
      if (input.consume('KeyR')) world.combat.reload(world);
    }
    // Driving.
    if (p.inCar) {
      const car = p.inCar;
      const axes = input.moveAxes();
      const throttle = axes.y;
      const steerInput = axes.x;
      // Screen-right (D) turns the car right: heading decreases.
      const res = car.drive(throttle, -steerInput, dt, colliders, world.allCars);
      if (res && res.crashed) {
        world.sound.crash();
        world.shake = 0.5;
        p.damage(2);
      }
      // Running over a pedestrian is a crime.
      if (world.peds.hitByCar(car.pos, Math.abs(car.speed))) {
        world.police.addWanted(1, world);
        world.hud.flashMessage('You hit a pedestrian! +1 wanted star');
        world.sound.crash();
      }
      world.sound.engine(Math.abs(car.speed) / CFG.carTopSpeed, true);
    } else {
      world.sound.engine(0, false);
      p.update(dt, input, world.camYaw, colliders, world.allCars);
      // Near-car prompt.
      const car = nearestCar(3.4);
      if (car) world.hud.setPrompt(car.stolen || !car.parked ? 'Press E — get in' : 'Press E — steal car');
    }
    // Traffic keeps flowing; parked cars stay put.
    for (const car of world.traffic) {
      if (car.alive && !car.isPlayer) car.driveTraffic(dt, colliders, world.allCars);
    }
    world.peds.update(dt, world);
    world.police.update(dt, world);
    world.combat.update(dt, world);
    world.missions.update(dt, world);
    if (world.gunshotTimer > 0) world.gunshotTimer -= dt;
    if (p.health <= 0) endGame('wasted');
    else if (world.police.busted) {
      world.police.busted = false;
      endGame('busted');
    }
    // Slow health regen out of trouble.
    if (p.health < CFG.playerHealth && world.police.wanted === 0) p.heal(dt * 2);
    updateCamera(dt);
    world.hud.update(dt, world);
  } else if (world.state === 'menu' || world.state === 'end' || world.state === 'paused') {
    // Idle city behind the overlays: traffic and pedestrians keep moving.
    for (const car of world.traffic) {
      if (car.alive && !car.isPlayer) car.driveTraffic(dt, colliders, world.allCars);
    }
    world.peds.update(dt, world);
    if (world.shotCam) {
      camera.position.copy(world.shotCam.pos);
      camera.lookAt(world.shotCam.look);
    } else {
      // Slow orbit over downtown.
      const t = now / 1000;
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

// Screenshot mode: stage a scene straight away, no menu clicks needed.
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
    // In a car, report the car's position — the player's own pos freezes
    // while driving, so the car is where the player actually is.
    const pos = p.inCar ? p.inCar.pos : p.pos;
    return {
      x: pos.x, z: pos.z, health: p.health, cash: p.cash,
      inCar: !!p.inCar, speed: p.inCar ? p.inCar.speed : p.speed,
    };
  },
  get wanted() { return world.police.wanted; },
  get mission() {
    const m = world.missions;
    return { index: m.index, step: m.step, done: m.done, text: m.objectiveText(), timer: m.timer };
  },
  get enemiesLeft() { return world.combat.enemiesLeft(); },
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
  setWanted: (n) => { world.police.wanted = n; world.police.syncCars(world); },
};

requestAnimationFrame(frame);
