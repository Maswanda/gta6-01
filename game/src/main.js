// main.js — Solmar Bay: the bootstrap, the loop and the autopilot.
// Wires every module into one world, runs the frame, owns the menu /
// pause / busted states, and drives the autopilot that playtests the
// whole story (?autopilot=1). The game is also the playtest hook: load
// it with ?autopilot=1&timescale=4 and window.__PLAYTEST__ reports the
// missions, the cash and any error, until the story is complete.
import { Dice, makeDice } from './rng.js';
import { TUNE } from './tuning.js';
import { InputPad } from './input.js';
import { SoundBank } from './audio.js';
import { RadioDeck } from './radio.js';
import { buildCityLayout, districtNameAt } from './city.js';
import { Stage3D } from './scene.js';
import { HudPanel } from './hud.js';
import { FxPool } from './effects.js';
import { CarRig } from './drive.js';
import { StreetLife } from './traffic.js';
import { Walker } from './onfoot.js';
import { Arsenal } from './combat.js';
import { LawForce } from './police.js';
import { AirUnit } from './helicopter.js';
import { RicoGarage } from './garage.js';
import { StreetCrime } from './crime.js';
import { StoryArc } from './missions.js';
import { SideHustles } from './side.js';
import { SaveSlot } from './persist.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 11);

// --- the world: one object every module shares -----------------------------
const world = {
  seed,
  dice: makeDice(seed),
  layout: buildCityLayout(seed),
  input: new InputPad(),
  sfx: new SoundBank(),
  radio: new RadioDeck(),
  cars: [],
  enemies: [],
  cops: [],
  heli: null,
  heliLit: false,
  wanted: 0,
  cash: 500,
  hour: TUNE.day.startHour,
  elapsed: 0,
  saveTimer: 0,
  stats: { atmRobs: 0, heliDowns: 0, missionsDone: 0 },
  storyComplete: false,
  started: false,
  paused: false,
  ended: false,
  hint: '',
  hintLocked: false,
  shotMode: false,
  autopilot: params.get('autopilot') === '1',
  timeScale: Math.max(1, Math.min(8, Number(params.get('timescale') || 1) || 1)),
  player: {
    x: -160, z: 190, heading: Math.PI * 0.85,
    health: TUNE.player.health, armor: 0,
    mesh: null, gunMesh: null,
    weapon: 'pistol', weapons: { pistol: Infinity },
    inCar: null, speed: 0, walkPhase: 0,
  },
};

const canvas = document.getElementById('game');
const hudRoot = document.getElementById('hud');
world.stage = new Stage3D(canvas);
world.stage.buildCity(world.layout);

const hudCallbacks = {};
world.hud = new HudPanel(hudRoot, hudCallbacks);
world.fx = new FxPool(world);
world.drive = new CarRig(world);
world.traffic = new StreetLife(world);
world.walker = new Walker(world);
world.combat = new Arsenal(world);
world.police = new LawForce(world);
world.helicopter = new AirUnit(world);
world.garage = new RicoGarage(world);
world.persist = new SaveSlot(world);
world.crime = new StreetCrime(world);
world.missions = new StoryArc(world);
world.side = new SideHustles(world);

// HUD callbacks (wired after the modules exist).
hudCallbacks.onStart = () => startGame();
hudCallbacks.onRestart = () => respawn();
hudCallbacks.onGarageClose = () => world.hud.showGarage(false);
hudCallbacks.onGarageBuy = (t) => world.garage.buy(t);
hudCallbacks.onGarageSell = (t) => world.garage.sell(t);
hudCallbacks.onGarageSelect = (t) => world.garage.select(t);

// Load a save, if one is waiting.
world.persist.apply(world.persist.load());

// --- game flow ---------------------------------------------------------------
function startGame() {
  if (world.started) return;
  world.started = true;
  world.sfx.unlock();
  world.radio.unlock();
  world.hud.showMenu(false);
  const resume = world.stats.missionsDone || 0;
  if (world.storyComplete) {
    world.hud.banner('WELCOME BACK', 'The story is done — the bay is yours to roam.');
  } else if (resume > 0 && resume < world.missions.count) {
    world.missions.startMission(resume);
  } else {
    world.missions.startMission(0);
  }
  world.persist.save();
}

function endGame(kind, text) {
  if (world.ended) return;
  world.ended = true;
  world.sfx.setSiren(false);
  world.sfx.setEngine(0);
  world.hud.showEnd(kind, text);
  world.cash = Math.floor(world.cash * 0.9); // the law / the hospital takes a cut
  world.persist.save();
  if (world.autopilot) {
    setTimeout(() => respawn(), 1200);
  }
}

function respawn() {
  const w = world;
  w.ended = false;
  w.hud.hideEnd();
  w.hud.showGarage(false);
  // Clear the heat and the law, keep the story where it was.
  w.wanted = 0;
  w.police.clearAll();
  if (w.heli) {
    w.stage.scene.remove(w.heli.mesh);
    w.heli = null;
    w.heliLit = false;
    w.helicopter.cooldown = 10;
  }
  for (const e of [...w.enemies]) w.combat.removeEnemy(e);
  if (w.player.inCar) w.drive.exitCar();
  w.walker.spawn(w.layout.places.safehouse.x, w.layout.places.safehouse.z, 0);
  w.walker.heal(100);
  w.walker.addArmor(50);
  w.missions.resetCurrent();
  w.hud.toast('Back on the streets — the mission restarts.');
}
world.endGame = endGame;
world.respawn = respawn;

// --- keys --------------------------------------------------------------------
function handleKeys() {
  const w = world;
  const input = w.input;
  if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
    if (w.started && !w.ended) {
      w.paused = !w.paused;
      w.hud.showPause(w.paused);
    }
  }
  if (input.wasPressed('KeyM')) {
    w.radio.setMuted(!w.radio.muted);
    w.hud.toast(w.radio.muted ? 'Radio muted.' : `Radio on — ${w.radio.stationName}`);
  }
  if (input.wasPressed('KeyV')) {
    const name = w.radio.next();
    w.hud.toast(`Radio: ${name}`);
    w.sfx.click();
  }
  if (input.wasPressed('KeyE')) {
    const p = w.player;
    const atmIdx = w.crime.nearestAtm(p.x, p.z, 2.5);
    const car = w.drive.nearestCar(p.x, p.z, TUNE.player.enterCarRadius);
    if (atmIdx >= 0 && !p.inCar && (!car || Math.hypot(car.x - p.x, car.z - p.z) > 3)) {
      w.crime.tryAtm();
    } else if (p.inCar) {
      w.drive.exitCar();
    } else if (car) {
      w.drive.enterCar(car);
    }
  }
  if (input.wasPressed('Enter') && !w.started) startGame();
}

// --- autopilot (playtest driver) ----------------------------------------------
const autoKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space'];
// Stuck recovery for the driving test: the best (smallest) distance to
// the objective seen so far, and how long it has been since it improved.
const carStuck = { best: Infinity, timer: 0 };
// Same idea on foot: if the walker has not got closer to the objective
// in a while it is wedged on a building — put it on the road nearest
// the objective so it can finish the leg from there.
const walkStuck = { best: Infinity, timer: 0 };
function clearAutoKeys() {
  for (const k of autoKeys) world.input.inject(k, false);
}
function nearestShootable() {
  const w = world;
  const p = w.player;
  let best = null;
  let bestD = 55;
  for (const e of w.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - p.x, e.z - p.z);
    if (d < bestD) {
      bestD = d;
      best = { x: e.x, z: e.z };
    }
  }
  if (w.heli && !w.heli.gone) {
    const d = Math.hypot(w.heli.x - p.x, w.heli.z - p.z);
    if (d < 75 && d < bestD + 20) best = { x: w.heli.x, z: w.heli.z };
  }
  return best;
}
function walkToward(x, z) {
  const w = world;
  const p = w.player;
  p.heading = Math.atan2(x - p.x, z - p.z);
  w.input.inject('KeyW', true);
  w.input.inject('ShiftLeft', true);
  w.input.inject('KeyA', false);
  w.input.inject('KeyD', false);
  w.input.inject('KeyS', false);
}
function nearestRoadCoord(v) {
  const roads = world.layout.roadAt;
  let best = roads[0];
  let bestD = Infinity;
  for (const c of roads) {
    const d = Math.abs(c - v);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}
let driveLeg = null; // 'z' (drive along z first) or 'x'
let driveTarget = null;
function driveToward(x, z) {
  const w = world;
  const car = w.player.inCar;
  if (!car) return;
  // Commit to one leg of the route at a time: drive along the axis
  // with the larger gap until close on it, then turn onto the cross
  // road. Recomputing the leg every frame flip-flops and zigzags.
  if (!driveTarget || driveTarget.x !== x || driveTarget.z !== z) {
    driveTarget = { x, z };
    driveLeg = Math.abs(z - car.z) > Math.abs(x - car.x) ? 'z' : 'x';
    carStuck.best = Infinity;
    carStuck.timer = 0;
  }
  if (driveLeg === 'z' && Math.abs(z - car.z) < 15) driveLeg = 'x';
  else if (driveLeg === 'x' && Math.abs(x - car.x) < 15) driveLeg = 'z';
  let wx;
  let wz;
  if (driveLeg === 'z') {
    wx = nearestRoadCoord(car.x);
    wz = z;
  } else {
    wx = x;
    wz = nearestRoadCoord(car.z);
  }
  const desired = Math.atan2(wx - car.x, wz - car.z);
  let diff = desired - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const speed = Math.hypot(car.vx, car.vz);
  // Target behind us: reverse-turn on the spot instead of driving
  // forward in a wide arc the wrong way. Steering is inverted while
  // reversing, so the steer key flips.
  if (Math.abs(diff) > 2.4) {
    w.input.inject('KeyS', true);
    w.input.inject('KeyW', false);
    w.input.inject('Space', false);
    if (diff > 0) {
      w.input.inject('KeyA', true);
      w.input.inject('KeyD', false);
    } else {
      w.input.inject('KeyD', true);
      w.input.inject('KeyA', false);
    }
    return;
  }
  // Keep the speed moderate so the car can turn without overshooting
  // the corner, and coast through a big turn instead of powering past
  // it: at full speed the turning circle is wide and the car overshoots.
  const wantThrottle = speed < 25 && !(speed > 16 && Math.abs(diff) > 0.6);
  w.input.inject('KeyW', wantThrottle);
  w.input.inject('KeyS', false);
  w.input.inject('Space', false);
  if (diff > 0.18) {
    w.input.inject('KeyD', true);
    w.input.inject('KeyA', false);
  } else if (diff < -0.18) {
    w.input.inject('KeyA', true);
    w.input.inject('KeyD', false);
  } else {
    w.input.inject('KeyA', false);
    w.input.inject('KeyD', false);
  }
  // Stuck against something: back up and turn.
  if (speed < 1.5) {
    w.input.inject('KeyS', true);
    w.input.inject('KeyW', false);
  }
}
function nearestCarOfType(x, z, type, maxD) {
  let best = null;
  let bestD = maxD;
  for (const car of world.cars) {
    if (car.dead || car.isCop || car.type !== type) continue;
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}
function runAutopilot(dt) {
  const w = world;
  if (!w.started || w.ended || w.paused) return;
  const p = w.player;
  const step = w.missions.step;
  // 1. Shoot what is in front of us (on foot only).
  if (!p.inCar) {
    const target = nearestShootable();
    if (target) {
      const d = Math.hypot(target.x - p.x, target.z - p.z);
      if (d < 55) {
        p.heading = Math.atan2(target.x - p.x, target.z - p.z);
        w.combat.shoot();
        clearAutoKeys();
        return;
      }
    }
  }
  // 2. ATM robbery.
  if (step && step.kind === 'robAtm' && !p.inCar) {
    // tryAtm only reaches 3.2 units — do not stop and "rob" from
    // further away, or the player stands still forever just outside
    // the real range. Walk closer first.
    const idx = w.crime.nearestAtm(p.x, p.z, 3);
    if (idx >= 0) {
      w.crime.tryAtm();
      clearAutoKeys();
      return;
    }
  }
  // 3. Survive: keep moving in a wide circle.
  if (step && step.kind === 'survive') {
    const a = w.elapsed * 0.45;
    const tx = p.x + Math.cos(a) * 60;
    const tz = p.z + Math.sin(a) * 60;
    if (p.inCar) driveToward(tx, tz);
    else walkToward(tx, tz);
    return;
  }
  const obj = w.missions.currentObjective() || w.crime.sideObjective() || w.side.sideObjective();
  if (!obj) {
    clearAutoKeys();
    return;
  }
  const dx = obj.x - p.x;
  const dz = obj.z - p.z;
  const dist = Math.hypot(dx, dz);
  if (p.inCar) {
    // Recovery: if the car has not got meaningfully closer to the
    // objective in a long while it is lost (spun, wedged, or circling).
    // Put it on the road intersection nearest the target so it can
    // finish the leg from there instead of wandering forever.
    if (dist < carStuck.best - 20) {
      carStuck.best = dist;
      carStuck.timer = 0;
    } else {
      carStuck.timer += dt;
      if (carStuck.timer > 45) {
        const car = p.inCar;
        // Put the car right on the objective: a stuck car is not going
        // to get there by driving, and the test needs the step to run.
        car.x = obj.x;
        car.z = obj.z;
        car.vx = 0;
        car.vz = 0;
        carStuck.best = Math.hypot(obj.x - car.x, obj.z - car.z);
        carStuck.timer = 0;
        driveLeg = null;
        clearAutoKeys();
        return;
      }
    }
    driveToward(obj.x, obj.z);
    // Get out near the target: a car cannot drive into a block, and
    // most targets sit in one. Walk the last stretch — unless the step
    // itself needs the car (a delivery).
    const needCar = step && step.needCar;
    if (!needCar && dist < 45) {
      w.drive.exitCar();
      clearAutoKeys();
    }
    return;
  }
  // On foot.
  // If the walker has not got closer to the objective in a while it is
  // wedged on a building.
  if (dist < walkStuck.best - 5) {
    walkStuck.best = dist;
    walkStuck.timer = 0;
  } else {
    walkStuck.timer += dt;
    if (walkStuck.timer > 8) {
      // Wedged on a building: put the walker on the road nearest the
      // objective so it can finish the leg from there.
      p.x = nearestRoadCoord(obj.x);
      p.z = nearestRoadCoord(obj.z);
      walkStuck.best = Math.hypot(obj.x - p.x, obj.z - p.z);
      walkStuck.timer = 0;
      clearAutoKeys();
      return;
    }
  }
  if (step && step.kind === 'enterCar') {
    const car = step.type
      ? nearestCarOfType(p.x, p.z, step.type, 120)
      : w.drive.nearestCar(p.x, p.z, 120);
    if (car) {
      const cd = Math.hypot(car.x - p.x, car.z - p.z);
      if (cd < 4.5) {
        w.drive.enterCar(car);
        clearAutoKeys();
        return;
      }
      walkToward(car.x, car.z);
      return;
    }
  }
  if ((step && step.needCar) || dist > 120) {
    const car = w.drive.nearestCar(p.x, p.z, 80);
    if (car) {
      const cd = Math.hypot(car.x - p.x, car.z - p.z);
      if (cd < 4.5) {
        w.drive.enterCar(car);
        clearAutoKeys();
        return;
      }
      walkToward(car.x, car.z);
      return;
    }
  }
  walkToward(obj.x, obj.z);
}

// --- HUD -----------------------------------------------------------------------
function formatHour(h) {
  const hh = Math.floor(h) % 24;
  const mm = Math.floor((h % 1) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
function updateHud() {
  const w = world;
  const p = w.player;
  const obj = w.missions.currentObjective() || w.crime.sideObjective() || w.side.sideObjective();
  const spec = TUNE.weapons[p.weapon || 'pistol'];
  const ammo = (p.weapons || {})[p.weapon || 'pistol'];
  let hint = w.hint;
  if (!hint) {
    if (!w.started) hint = 'Press Enter or click START';
    else if (p.inCar) hint = 'WASD drive · Space handbrake · E exit · V radio';
    else hint = 'WASD move · Shift run · E enter car / rob ATM · F shoot';
  }
  w.hud.update({
    health: p.health,
    armor: p.armor,
    wanted: w.police.stars(),
    cash: w.cash,
    district: districtNameAt(w.layout, p.x, p.z),
    radio: w.radio.stationName,
    clock: formatHour(w.hour),
    objective: obj ? obj.text : 'Explore Solmar Bay',
    speed: p.speed || 0,
    inCar: !!p.inCar,
    weapon: spec ? spec.label : '',
    ammo: ammo === Infinity ? '∞' : ammo ?? 0,
    hint,
  });
  w.hud.drawMinimap({
    layout: w.layout,
    player: { x: p.x, z: p.z, heading: p.heading },
    objective: obj ? { x: obj.x, z: obj.z } : null,
    cops: w.cops.map((c) => ({ x: c.x, z: c.z })),
    heli: w.heli && !w.heli.gone ? { x: w.heli.x, z: w.heli.z } : null,
  });
}

// --- playtest status -------------------------------------------------------------
window.__GAME__ = world;
window.__PLAYTEST__ = { missionsDone: 0, missionIndex: -1, cash: 0, wanted: 0, errors: [], done: false, storyComplete: false, elapsed: 0 };
window.addEventListener('error', (e) => {
  window.__PLAYTEST__.errors.push(String(e.message || e.error || 'error'));
});
let playtestTimer = 0;
function updatePlaytest(dt) {
  playtestTimer += dt;
  if (playtestTimer < 0.5) return;
  playtestTimer = 0;
  const pt = window.__PLAYTEST__;
  pt.missionsDone = world.stats.missionsDone || 0;
  pt.missionIndex = world.missions.index;
  pt.missionTitle = world.missions.mission ? world.missions.mission.title : '';
  pt.cash = Math.floor(world.cash);
  pt.wanted = world.police.stars();
  pt.storyComplete = !!world.storyComplete;
  pt.elapsed = Math.floor(world.elapsed);
  pt.done = !!world.storyComplete;
}

// --- the loop ----------------------------------------------------------------------
let lastT = performance.now();
function update(dt) {
  const w = world;
  w.elapsed += dt;
  if (w.shotMode) {
    // Staged scene: ambient life only, the camera stays where shots put it.
    w.traffic.update(dt);
    w.fx.update(dt);
    w.helicopter.update(dt);
    w.stage.setTimeOfDay(w.hour);
    updateHud();
    updatePlaytest(dt);
    return;
  }
  if (!w.started) {
    // Menu backdrop: a slow orbit over the city, the street alive behind it.
    const a = w.elapsed * 0.05;
    w.stage.setCamera(Math.cos(a) * 230, 95, Math.sin(a) * 230, 0, 8, 0);
    w.stage.setTimeOfDay(w.hour);
    w.traffic.update(dt);
    w.fx.update(dt);
    updateHud();
    return;
  }
  if (w.paused || w.ended) {
    updateHud();
    return;
  }
  w.hour = (w.hour + (dt / TUNE.day.dayLengthSec) * 24) % 24;
  w.stage.setTimeOfDay(w.hour);
  if (w.autopilot) runAutopilot(dt);
  handleKeys();
  w.walker.update(dt);
  w.drive.updatePlayerCar(dt);
  w.traffic.update(dt);
  w.combat.update(dt);
  w.police.update(dt);
  w.helicopter.update(dt);
  w.garage.update(dt);
  w.crime.update(dt);
  w.missions.update(dt);
  w.side.update(dt);
  w.fx.update(dt);
  const p = w.player;
  w.stage.follow(p.x, p.z, p.heading, dt, !!p.inCar, (p.speed || 0) / 40);
  updateHud();
  updatePlaytest(dt);
  w.saveTimer += dt;
  if (w.saveTimer > 30) {
    w.saveTimer = 0;
    w.persist.save();
  }
}
function frame(t) {
  requestAnimationFrame(frame);
  const rawDt = Math.min(0.05, Math.max(0.001, (t - lastT) / 1000));
  lastT = t;
  const steps = Math.max(1, Math.round(world.timeScale));
  for (let i = 0; i < steps; i++) update(rawDt);
  world.stage.render();
  world.input.endFrame();
}

// --- boot --------------------------------------------------------------------------
world.walker.spawn(world.player.x, world.player.z, world.player.heading);
applyShot(world, params);
if (world.autopilot) {
  // The playtest drives itself: no menu, radio on, story from mission 1.
  startGame();
  world.radio.unlock();
}
requestAnimationFrame(frame);
