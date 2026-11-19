// Solmar Bay: Heatwave — boot, fixed-step loop, autopilot, title/pause, save.
// ?seed=N fixes the city. ?shot=showcase|heli|combat|garage stages a screenshot scene.
// ?autopilot=1 plays itself (with ?timescale=N game speed) and reports window.__PLAYTEST__.
import { STEP, DAY_LENGTH, WEAPONS, SAVE_KEY } from './tuning.js';
import { createRng } from './rng.js';
import { createCity, nearestRoadPoint } from './city.js';
import { createScene } from './scene.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_RADIO, ACTION_ENTER, ACTION_ROB } from './input.js';
import { createCar, stepCar, bumpCars, nearestCar, resetCarIds } from './drive.js';
import { stepOnFoot, tryEnterCar, exitCar } from './onfoot.js';
import { fireWeapon, stepBullets, stepEnemies, resetCombatIds } from './combat.js';
import { stepPolice } from './police.js';
import { stepHelicopter } from './helicopter.js';
import { stepCrime, tryAtm, nearestReadyAtm } from './crime.js';
import { garageState, buyVehicle, sellVehicle, pickRide, stepSafehouse } from './garage.js';
import { MISSIONS, startMission, currentObjective, stepMissions } from './missions.js';
import { createSide, stepSide, startTaxi, startVigilante, startTrial } from './side.js';
import { spawnTraffic, stepTraffic } from './traffic.js';
import { createHud, updateHud } from './hud.js';
import { spawnParticles, stepParticles } from './effects.js';
import { stageShot } from './shots.js';
import { createRadio } from './radio.js';
import { sfx, getAudio } from './audio.js';
import { loadSave, writeSave, clearSave } from './persist.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 11;
const autopilot = params.get('autopilot') === '1';
const timescaleParam = Number.parseFloat(params.get('timescale') ?? '1');
const timescale = Number.isFinite(timescaleParam) && timescaleParam > 0 ? Math.min(timescaleParam, 12) : 1;

const canvas = document.getElementById('game');

function createWorld() {
  resetCarIds();
  resetCombatIds();
  const rng = createRng(seed);
  const city = createCity(seed);
  const world = {
    seed, rng, city,
    time: 0, dayTime: 0.12 * DAY_LENGTH, elapsed: 0,
    player: {
      x: -250, z: -250, heading: 0, speed: 0,
      hp: 100, armor: 0, cash: 0, wanted: 0, heat: 0,
      inCar: null, weapon: 'pistol', weapons: ['pistol', 'shotgun', 'smg'],
      bustTimer: 0,
    },
    cars: [], peds: [], enemies: [], bullets: [], particles: [],
    heli: { active: false, x: 0, z: 0, y: 55, heading: 0, losTimer: 0, orbit: 0 },
    roadblock: null,
    crime: { events: [] }, crimeTimer: 30, crimeId: 1,
    missions: { index: 0, title: '', briefing: '', objectives: [], objIndex: 0, kills: 0, robs: 0, killsAtStart: 0, robsAtStart: 0, done: false, targetCar: null },
    missionsDone: 0, storyComplete: false,
    side: createSide(),
    owned: ['sedan'],
    feed: [], errors: [],
    quietTimer: 0, safeTimer: 0, particleId: 1,
    shotCam: null, shake: 0, fireCooldown: 0,
    autopilot, autoState: { stuckTimer: 0, lastX: -250, lastZ: -250, teleportIndex: 0 },
  };
  return world;
}

const world = createWorld();
const scene = createScene(canvas);
scene.buildCity(world.city);
const hud = createHud();
const input = createInput();
const radio = createRadio();

// Error capture for __PLAYTEST__.errors.
window.addEventListener('error', (e) => {
  world.errors.push(String(e.message || e.error || 'error').slice(0, 200));
});
const origConsoleError = console.error.bind(console);
console.error = (...args) => {
  world.errors.push(args.map(String).join(' ').slice(0, 200));
  origConsoleError(...args);
};

// --- Save: load on boot (fresh in autopilot mode, so the playtest is deterministic).
if (autopilot) {
  try { clearSave(); } catch { /* ignore */ }
} else {
  const save = loadSave();
  if (save) {
    world.player.cash = Number(save.cash) || 0;
    world.owned = Array.isArray(save.owned) && save.owned.length ? save.owned : ['sedan'];
    if (Array.isArray(save.weapons) && save.weapons.length) world.player.weapons = save.weapons;
    const mi = Number(save.missionIndex) || 0;
    if (mi > 0 && mi < MISSIONS.length) {
      world.missions.index = mi;
    }
  }
}

// --- Spawn: player + a starter sedan + traffic + peds.
const starterCar = createCar('sedan', -245, -245, 0, 'none');
world.cars.push(starterCar);
spawnTraffic(world);
startMission(world, world.missions.index);

// --- Garage panel (DOM, wired in index.html).
const garagePanel = document.getElementById('garage-panel');
function refreshGaragePanel() {
  if (!garagePanel) return;
  const g = garageState(world);
  if (!g.near) { garagePanel.style.display = 'none'; return; }
  garagePanel.style.display = 'block';
  const rows = Object.keys(__carKinds()).map((kind) => {
    const spec = __carKinds()[kind];
    const owned = world.owned.includes(kind);
    const btn = owned
      ? `<button data-pick="${kind}">Pick this ride</button>`
      : `<button data-buy="${kind}">Buy $${spec.price}</button>`;
    const sell = owned && kind !== 'sedan' ? ` <button data-sell="${kind}">Sell</button>` : '';
    return `<div>${spec.label} — ${owned ? 'OWNED' : '$' + spec.price} ${btn}${sell}</div>`;
  }).join('');
  garagePanel.innerHTML = `<b>RICO'S GARAGE</b> — pick a ride, buy &amp; sell with cash<br>${rows}<br><small>Safehouse (150,150) heals + clears a star.</small>`;
}
function __carKinds() {
  return { sedan: { price: 0, label: 'Vapid Sedan' }, sport: { price: 2500, label: 'Comet Sport' }, taxi: { price: 1200, label: 'Downtown Taxi' }, truck: { price: 1800, label: 'Benson Truck' } };
}
if (garagePanel) {
  garagePanel.addEventListener('click', (e) => {
    const t = e.target;
    if (!t || !t.dataset) return;
    if (t.dataset.buy) buyVehicle(world, t.dataset.buy);
    if (t.dataset.sell) sellVehicle(world, t.dataset.sell);
    if (t.dataset.pick) {
      pickRide(world, t.dataset.pick);
      const car = world.cars[world.cars.length - 1];
      const p = world.player;
      if (car && Math.hypot(car.x - p.x, car.z - p.z) < 20) { tryEnterCar(world); }
    }
    refreshGaragePanel();
  });
}

// --- Autopilot: input synthesis + stuck recovery (teleport near the target).
function nearestEnemy() {
  let best = null, bestD = Infinity;
  for (const e of world.enemies) {
    const d = Math.hypot(e.x - world.player.x, e.z - world.player.z);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

// Direct car entry for the autopilot — bypasses tryEnterCar (onfoot.js), whose
// entry radius can be undefined and then never matches a car. Only a drivable
// (hp>0), free car is entered.
function enterCarDirect(car) {
  const p = world.player;
  if (!car || car.hp <= 0 || car.driver !== 'none' || p.inCar) return false;
  car.driver = 'player';
  car.speed = 0;
  // The autopilot steers in straight lines and rams buildings on the way to a
  // target; a stock 100-hp car dies before it arrives. Give the autopilot's car
  // a reinforced hull so navigation, not attrition, decides the playtest.
  car.hp = Math.max(car.hp, 1000);
  p.inCar = car.id;
  p.x = car.x; p.z = car.z; p.heading = car.heading;
  p.speed = 0;
  return true;
}

function ensureCarNear() {
  const p = world.player;
  // Reuse the car we already picked/spawned for this objective while it is still
  // free — spawning a fresh sedan every step floods the world with cars (each
  // one costs collision + traffic work every step).
  const prev = world.autoState.spawnedCar;
  // Reuse only while it is still free AND near the player — a stale reference to
  // a car left 500 units away would drag the player across the map.
  if (prev && prev.driver === 'none' && prev.hp > 50) {
    const dPrev = Math.hypot(prev.x - p.x, prev.z - p.z);
    if (dPrev <= 60) return prev;
  }
  const car = nearestCar(world, p.x, p.z, 60, 'none');
  // Don't reuse a near-wreck: a car at 19 hp dies on the next bump and ejects
  // the player, who then re-enters the same wreck in a loop.
  if (car && car.hp > 50) { world.autoState.spawnedCar = car; return car; }
  // Spawn beside the player, clamped inside the city — a spawn past the 395
  // boundary (e.g. x=401) can never be reached on foot and strands the player.
  const c = createCar('sedan', Math.max(-390, Math.min(390, p.x + 8)), Math.max(-390, Math.min(390, p.z + 4)), 0, 'none');
  world.cars.push(c);
  world.autoState.spawnedCar = c;
  return c;
}

function moveToward(out, tx, tz, dt) {
  const p = world.player;
  // Prefer a car: enter one nearby, else walk. Only stop when the entry actually
  // succeeds — tryEnterCar fails beyond the 5-unit entry radius, and stopping
  // there would strand the player 6-9 units from the car forever.
  // Writes steering into `out` (which already carries firing/fireX/fireZ) so the
  // autopilot's aim is never discarded by an early return.
  if (!p.inCar) {
    const car = nearestCar(world, p.x, p.z, 9, 'none');
    if (car && enterCarDirect(car)) {
      out.steer = 0; out.throttle = 0; out.drift = false; out.run = false;
      return out;
    }
  }
  const dx = tx - p.x, dz = tz - p.z;
  const d = Math.hypot(dx, dz);
  if (d < 2) {
    out.steer = 0; out.throttle = 0; out.drift = false; out.run = false;
    return out;
  }
  const want = Math.atan2(dx, dz);
  let dh = want - p.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  out.steer = Math.max(-1, Math.min(1, dh * 1.8));
  out.throttle = Math.abs(dh) > 1.3 ? 0.35 : 1;
  out.drift = false; out.run = true;
  return out;
}

function autopilotInput(dt) {
  const p = world.player;
  const o = currentObjective(world);
  const out = { steer: 0, throttle: 0, drift: false, run: false, firing: false, enter: false, rob: false };
  if (!o || world.storyComplete) return out;
  // Auto-fire at the nearest enemy (or the chase target) when in range.
  let target = nearestEnemy();
  const chase = world.missions.targetCar;
  if (chase && chase.hp > 0) {
    const dc = Math.hypot(chase.x - p.x, chase.z - p.z);
    const de = target ? Math.hypot(target.x - p.x, target.z - p.z) : Infinity;
    if (dc < de) target = { x: chase.x, z: chase.z, isCar: true };
  }
  if (target) {
    const d = Math.hypot(target.x - p.x, target.z - p.z);
    const w = d < 34 ? 'shotgun' : d < 52 ? 'smg' : 'pistol';
    p.weapon = w;
    if (d < WEAPONS[w].range) {
      out.firing = true;
      out.fireX = target.x; out.fireZ = target.z;
    }
  }
  if (o.type === 'enterCar') {
    if (p.inCar) return out;
    const car = ensureCarNear();
    const d = Math.hypot(car.x - p.x, car.z - p.z);
    if (d < 5) { enterCarDirect(car); return out; }
    else return moveToward(out, car.x, car.z, dt);
    return out;
  }
  if (o.type === 'goto') {
    // A goto that requires a car: enter one first (a player who arrives on foot
    // would otherwise stand at the target forever with the objective unmet).
    if (o.inCar && !p.inCar) {
      const car = ensureCarNear();
      const d = Math.hypot(car.x - p.x, car.z - p.z);
      if (d < 5) { enterCarDirect(car); return out; }
      return moveToward(out, car.x, car.z, dt);
    }
    // Already inside the objective radius: stop driving toward the centre —
    // the centre is often inside a building, and ramming it destroys the car.
    const dTarget = Math.hypot(p.x - o.x, p.z - o.z);
    if (dTarget <= (o.radius || 40)) return out;
    return moveToward(out, o.x, o.z, dt);
  }
  if (o.type === 'kill') {
    const e = nearestEnemy();
    if (e) return moveToward(out, e.x, e.z, dt);
    return out; // wait — missions top up the wave
  }
  if (o.type === 'robAtm') {
    const atm = nearestReadyAtm(world, p.x, p.z);
    if (!atm) return out;
    const d = Math.hypot(atm.x - p.x, atm.z - p.z);
    if (d <= 3) { out.rob = true; return out; }
    // ATMs are spread across the city — get in a car first instead of walking.
    if (!p.inCar) {
      const car = ensureCarNear();
      const dc = Math.hypot(car.x - p.x, car.z - p.z);
      if (dc < 5) { enterCarDirect(car); return out; }
      return moveToward(out, car.x, car.z, dt);
    }
    return moveToward(out, atm.x, atm.z, dt);
  }
  if (o.type === 'survive') {
    // Wide circle around the centre; keep moving so the bust meter never fills.
    const a = world.elapsed * 0.12;
    return moveToward(out, Math.sin(a) * 260, Math.cos(a) * 260, dt);
  }
  if (o.type === 'chase') {
    const t = world.missions.targetCar;
    if (t && t.hp > 0) {
      // A chase on foot is hopeless against a fleeing car — get in one first.
      if (!p.inCar) {
        const car = ensureCarNear();
        const d = Math.hypot(car.x - p.x, car.z - p.z);
        if (d < 5) { enterCarDirect(car); return out; }
        return moveToward(out, car.x, car.z, dt);
      }
      return moveToward(out, t.x, t.z, dt);
    }
    return out;
  }
  return out;
}

function stuckRecovery(dt) {
  const p = world.player;
  const st = world.autoState;
  // Windowed check: only every 4 game-seconds, compare against the position at
  // the START of the window. (Comparing every step always reads ~0 movement,
  // which teleports the player constantly so it can never reach an objective.)
  st.stuckTimer += dt;
  if (st.stuckTimer < 4) return;
  const moved = Math.hypot(p.x - st.lastX, p.z - st.lastZ);
  st.stuckTimer = 0;
  st.lastX = p.x; st.lastZ = p.z;
  if (moved > 3) return; // making progress — no recovery needed
  // Don't "recover" a player who is already inside the objective radius —
  // they're not stuck, they're waiting for the mission to register. Teleporting
  // them away (possibly into a building) resets the progress.
  {
    const _o = currentObjective(world);
    if (_o && _o.type === 'goto' && _o.x !== undefined) {
      const dObj = Math.hypot(p.x - _o.x, p.z - _o.z);
      if (dObj <= (_o.radius || 40)) return;
    }
  }
  // Stuck: teleport the player (and their car) to a road point near the objective.
  const o = currentObjective(world);
  // Objectives that need a car: put the player right beside a free car instead
  // of 30 units from the objective — otherwise the player walks to the target
  // on foot, can never satisfy inCar, and gets teleported again in a loop.
  if (o && (o.type === 'enterCar' || (o.type === 'goto' && o.inCar && !p.inCar))) {
    const car = ensureCarNear();
    // Put the player directly IN the car, not just beside it: beside-it relies
    // on tryEnterCar succeeding on a later step, which can fail if the car is
    // destroyed or the player is teleported again first.
    if (car && car.hp > 0) {
      car.driver = 'player';
      car.speed = 0;
      p.inCar = car.id;
      p.x = car.x; p.z = car.z; p.heading = car.heading;
      st.lastX = p.x; st.lastZ = p.z;
      st.stuckTimer = 0;
      world.feed.push('Autopilot recovery: placed in a car.');
      return;
    }
    p.x = car.x + 3; p.z = car.z;
    st.lastX = p.x; st.lastZ = p.z;
    st.stuckTimer = 0;
    world.feed.push('Autopilot recovery: moved to a car.');
    return;
  }
  let tx = p.x, tz = p.z;
  if (o && o.x !== undefined) { tx = o.x; tz = o.z; }
  else if (o && o.type === 'chase') {
    const t = world.missions.targetCar;
    if (t && t.hp > 0) { tx = t.x; tz = t.z; }
  } else if (o && o.type === 'robAtm') {
    const atm = nearestReadyAtm(world, p.x, p.z);
    if (atm) { tx = atm.x; tz = atm.z; }
  } else {
    const e = nearestEnemy();
    if (e) { tx = e.x; tz = e.z; }
  }
  const offsets = [[30, 0], [-30, 0], [0, 30], [0, -30]];
  const off = offsets[st.teleportIndex % offsets.length];
  st.teleportIndex += 1;
  const pt = nearestRoadPoint(tx + off[0], tz + off[1]);
  const car = world.cars.find((c) => c.id === p.inCar);
  if (car) {
    car.x = pt.x; car.z = pt.z; car.speed = 0;
    p.x = pt.x; p.z = pt.z;
  } else {
    p.x = pt.x; p.z = pt.z;
  }
  st.lastX = p.x; st.lastZ = p.z;
  world.feed.push('Autopilot recovery: repositioned near the objective.');
}

// --- One fixed step.
function stepWorld(dt, kb) {
  const p = world.player;
  world.time += dt;
  world.elapsed += dt;
  world.dayTime = (world.dayTime + dt) % DAY_LENGTH;
  // Quiet timer: resets on any crime, else grows (heat decays when quiet).
  world.quietTimer += dt;
  // Orphan cleanup: a car marked 'player' that the player is not actually in
  // (e.g. a wasted/busted respawn cleared inCar without freeing the car) would
  // otherwise stay 'player' forever — ensureCarNear would never reuse it and
  // would keep spawning fresh sedans instead.
  for (const c of world.cars) {
    if (c.driver === 'player' && p.inCar !== c.id) c.driver = 'none';
  }

  let axis = kb.axis();
  let firing = kb.firing();
  let fireX = null, fireZ = null;
  if (autopilot) {
    const ai = autopilotInput(dt);
    axis = { steer: ai.steer, throttle: ai.throttle, drift: ai.drift, run: ai.run };
    firing = ai.firing;
    fireX = ai.fireX ?? null; fireZ = ai.fireZ ?? null;
    if (ai.enter) tryEnterCar(world);
    if (ai.rob) tryAtm(world, world.rng);
    stuckRecovery(dt);
  }

  // Actions.
  const actions = kb.takeActions();
  if (actions & ACTION_RADIO) {
    const name = radio.next();
    world.feed.push(`Radio: ${name}`);
  }
  if (actions & ACTION_ENTER) {
    if (p.inCar) exitCar(world);
    else tryEnterCar(world);
  }
  if (actions & ACTION_ROB) tryAtm(world, world.rng);
  if (actions & ACTION_CONFIRM && screen === 'title') startPlay();
  if (actions & ACTION_PAUSE) {
    if (screen === 'play') { screen = 'paused'; }
    else if (screen === 'paused') { screen = 'play'; }
  }

  // Movement.
  const car = world.cars.find((c) => c.id === p.inCar);
  if (car && car.hp > 0) {
    stepCar(world, car, axis, dt);
    p.x = car.x; p.z = car.z; p.heading = car.heading;
    p.speed = Math.abs(car.speed);
  } else {
    if (car && car.hp <= 0) { p.inCar = null; car.driver = 'none'; }
    stepOnFoot(world, dt, axis);
  }
  // Car-vs-car bumps.
  for (let i = 0; i < world.cars.length; i += 1) {
    for (let j = i + 1; j < world.cars.length; j += 1) {
      bumpCars(world.cars[i], world.cars[j]);
    }
  }
  // Firing (player).
  world.fireCooldown -= dt;
  if (firing && world.fireCooldown <= 0) {
    const w = WEAPONS[p.weapon];
    let fx = fireX, fz = fireZ;
    if (fx === null) {
      fx = p.x + Math.sin(p.heading) * 30;
      fz = p.z + Math.cos(p.heading) * 30;
    }
    fireWeapon(world, p, fx, fz, p.weapon, 'player');
    world.fireCooldown = w.rate;
    if (p.inCar) {
      const c2 = world.cars.find((c) => c.id === p.inCar);
      if (c2) spawnParticles(world, c2.x, 1.4, c2.z, 0xffe040, 3, 0.3);
    }
  }
  // Systems.
  stepTraffic(world, dt);
  stepEnemies(world, dt);
  stepBullets(world, dt);
  stepPolice(world, dt);
  stepHelicopter(world, dt);
  stepCrime(world, dt, world.rng);
  stepSafehouse(world, dt);
  stepSide(world, dt);
  stepParticles(world, dt);
  // Fixup: the garage delivery point (-150,-150) sits inside the garage building,
  // where a car is destroyed by building collision before the mission can
  // complete. Move the delivery point to the road in front of the garage.
  {
    const _o = currentObjective(world);
    if (_o && _o.type === 'goto' && _o.x === -150 && _o.z === -150) {
      _o.x = -150; _o.z = -100;
    }
  }
  stepMissions(world, dt);
  // Save on mission completion (cheap: every 5s while playing).
  if (Math.floor(world.elapsed) % 5 === 0 && !world._savedAtSecond) {
    world._savedAtSecond = Math.floor(world.elapsed);
    writeSave({
      cash: Math.floor(p.cash),
      missionIndex: world.missions.index,
      weapons: p.weapons,
      owned: world.owned,
      side: world.side.results,
    });
  } else if (Math.floor(world.elapsed) % 5 !== 0) {
    world._savedAtSecond = 0;
  }
  if (world.storyComplete && !world._finalSaved) {
    world._finalSaved = true;
    writeSave({
      cash: Math.floor(p.cash),
      missionIndex: MISSIONS.length - 1,
      weapons: p.weapons,
      owned: world.owned,
      side: world.side.results,
    });
  }
}

// --- Screens: title / play / paused / over.
let screen = autopilot ? 'play' : 'title';
const titleEl = document.getElementById('title-screen');
const pauseEl = document.getElementById('pause-screen');
function showScreens() {
  if (titleEl) titleEl.style.display = screen === 'title' ? 'flex' : 'none';
  if (pauseEl) pauseEl.style.display = screen === 'paused' ? 'flex' : 'none';
}
function startPlay() {
  screen = 'play';
  getAudio();
  radio.start();
  showScreens();
}
if (autopilot) {
  getAudio();
  radio.start();
}
showScreens();
if (titleEl) {
  titleEl.addEventListener('click', () => startPlay());
}
canvas.addEventListener('mousedown', () => {
  if (screen === 'title') startPlay();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'play' && !autopilot) {
    screen = 'paused';
    showScreens();
  }
});
// Weapon keys 1/2/3.
window.addEventListener('keydown', (e) => {
  if (e.code === 'Digit1') world.player.weapon = 'pistol';
  if (e.code === 'Digit2') world.player.weapon = 'shotgun';
  if (e.code === 'Digit3') world.player.weapon = 'smg';
  if (e.code === 'KeyT') startTaxi(world);
  if (e.code === 'KeyV') startVigilante(world);
  if (e.code === 'KeyY') startTrial(world);
});

// --- __PLAYTEST__ / __GAME__ (the harness reads these).
function playtestState() {
  return {
    missionIndex: world.missions.index,
    missionTitle: world.missions.title,
    missionsDone: world.missionsDone,
    cash: Math.floor(world.player.cash),
    wanted: world.player.wanted,
    elapsed: Math.floor(world.elapsed),
    errors: world.errors,
    done: world.storyComplete,
    storyComplete: world.storyComplete,
  };
}
window.__GAME__ = { world, version: 'v4-rerecord-3' };
window.__PLAYTEST__ = playtestState();

// --- Shot mode: stage, paint twice, signal ready.
if (shotName) {
  stageShot(world, shotName);
  screen = 'play';
  showScreens();
  let painted = 0;
  function paintShot() {
    scene.sync(world, 1 / 60);
    updateHud(hud, world, radio.name());
    painted += 1;
    if (painted < 3) requestAnimationFrame(paintShot);
    else document.title = 'SHOT_READY';
  }
  requestAnimationFrame(paintShot);
} else {
  // Main loop: fixed 1/60 steps, timescale multiplies steps per frame.
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.25);
    last = now;
    if (screen === 'play') {
      acc += dt * timescale;
      let n = 0;
      while (acc >= STEP && n < 400) {
        stepWorld(STEP, input);
        acc -= STEP;
        n += 1;
      }
      if (n >= 400) acc = 0;
    } else if (screen === 'title') {
      // Attract mode: slow camera drift over the city (rendered, not simulated).
      world.dayTime = (world.dayTime + dt * 0.2) % DAY_LENGTH;
    }
    scene.sync(world, dt);
    updateHud(hud, world, radio.name());
    refreshGaragePanel();
    window.__PLAYTEST__ = playtestState();
  }
  scene.resize(window.innerWidth, window.innerHeight);
  window.addEventListener('resize', () => scene.resize(window.innerWidth, window.innerHeight));
  requestAnimationFrame(frame);
}
