// missions.js — Solmar Bay: the twelve-mission story of Rook, a driver
// new to the bay, working for the fixer Mara Voss against the Bay Kings.
// Each mission is data (steps with a kind); the engine sets a step up,
// watches it complete, and chains the next. The final mission ends the story.
import { TUNE } from './tuning.js';

const MISSIONS = [
  { title: 'Welcome to Solmar', brief: 'Rook lands in Solmar Bay. Mara Voss wants a word at the Marina.',
    steps: [{ kind: 'goto', x: -224, z: 224, r: 12, text: 'Meet Mara at the Marina' }] },
  { title: 'First Wheels', brief: 'Mara needs wheels. Take any car and bring it Downtown.',
    steps: [
      { kind: 'enterCar', text: 'Take a car — press E near one' },
      { kind: 'goto', x: 224, z: -224, r: 40, text: 'Drive to Downtown', needCar: true },
    ] },
  { title: 'The Drop', brief: 'A package is waiting at Vice Pier. Take it to the Hills.',
    steps: [
      { kind: 'collect', x: -224, z: -224, r: 9, text: 'Pick up the package at Vice Pier' },
      { kind: 'deliver', x: 224, z: 224, r: 40, text: 'Deliver it to the Hills Observatory', needCar: true },
    ] },
  { title: 'Bay Kings', brief: 'The Bay Kings are taxing the beach. Clear them out.',
    steps: [{ kind: 'kill', n: 3, sx: -192, sz: -192, text: 'Clear the Bay Kings at Vice Beach' }] },
  { title: 'Getaway Driver', brief: 'Move a package across town. The law will be on you.',
    steps: [
      { kind: 'goto', x: 0, z: 0, r: 12, text: 'Meet the crew at the crossroads' },
      { kind: 'deliver', x: -96, z: 192, r: 14, text: "Drive the package to Rico's Garage", needCar: true, setWanted: 2 },
    ] },
  { title: 'Night Shift', brief: 'Mara wants quick cash. An ATM will do.',
    steps: [{ kind: 'robAtm', text: 'Rob an ATM — press E at a glowing kiosk' }] },
  { title: 'The Informant', brief: 'An informant at Solmar Tower has names. The Kings know too.',
    steps: [
      { kind: 'goto', x: 224, z: -224, r: 12, text: 'Meet the informant at Solmar Tower' },
      { kind: 'kill', n: 4, sx: 192, sz: -192, text: 'Ambush! Clear the gang' },
    ] },
  { title: 'Hot Wheels', brief: 'A street race across the bay. You will need muscle.',
    steps: [
      { kind: 'enterCar', type: 'muscle', text: 'Get a muscle car', spawnCar: { type: 'muscle', dx: 14, dz: 6 } },
      { kind: 'goto', x: 64, z: 64, r: 12, text: 'Checkpoint 1 — the plaza', needCar: true },
      { kind: 'goto', x: -192, z: -64, r: 12, text: 'Checkpoint 2 — the beach road', needCar: true },
      { kind: 'goto', x: 224, z: 224, r: 40, text: 'Checkpoint 3 — the Hills finish line', needCar: true },
    ] },
  { title: 'The Vault', brief: 'Two ATMs, one night. Mara is counting.',
    steps: [
      { kind: 'robAtm', text: 'Rob an ATM (1/2)' },
      { kind: 'robAtm', text: 'Rob another ATM (2/2)' },
    ] },
  { title: 'Heatwave', brief: 'Hit the Downtown job, then survive the heat.',
    steps: [
      { kind: 'goto', x: 0, z: -192, r: 12, text: 'Hit the Downtown job' },
      { kind: 'survive', seconds: 60, text: 'Survive 60 seconds at 4 stars', setWanted: 4 },
    ] },
  { title: 'Air Support', brief: 'The PD air unit is over the bay. Drive it off.',
    steps: [{ kind: 'heliDown', text: 'Drive off the PD air unit — shoot it until it retreats', setWanted: 4 }] },
  { title: 'The Last Run', brief: 'One last job. The tower loot, the Marina, the whole PD behind you.',
    steps: [
      { kind: 'collect', x: 224, z: -224, r: 9, text: 'Grab the loot at Solmar Tower' },
      { kind: 'deliver', x: -224, z: 224, r: 40, text: 'Run it to the Marina', needCar: true, setWanted: 5 },
      { kind: 'survive', seconds: 30, text: 'Hold the Marina for 30 seconds' },
    ] },
];

export class StoryArc {
  constructor(world) {
    this.world = world;
    this.index = -1; // no mission yet
    this.stepIdx = 0;
    this.step = null;
    this.nextTimer = 0;
    this.nextIndex = -1; // which mission the 2.5s gap leads to
    this.done = false;
  }
  get mission() {
    return this.index >= 0 && this.index < MISSIONS.length ? MISSIONS[this.index] : null;
  }
  get count() {
    return MISSIONS.length;
  }
  startMission(i) {
    const w = this.world;
    this.index = i;
    this.stepIdx = 0;
    this.nextIndex = -1;
    const m = MISSIONS[i];
    w.hud.banner(`MISSION ${i + 1}: ${m.title.toUpperCase()}`, m.brief);
    w.sfx.pickup();
    this.setupStep();
  }
  setupStep() {
    const w = this.world;
    const m = this.mission;
    if (!m) return;
    const def = m.steps[this.stepIdx];
    const step = { ...def };
    this.step = step;
    if (step.setWanted !== undefined) w.wanted = step.setWanted;
    if (step.spawnCar) {
      const c = w.drive.createCar(step.spawnCar.type, w.player.x + step.spawnCar.dx, w.player.z + step.spawnCar.dz, 0);
      step.spawnedCar = c;
    }
    if (step.kind === 'kill') {
      step.enemies = [];
      for (let i = 0; i < step.n; i++) {
        step.enemies.push(w.combat.spawnEnemy('gang', step.sx + (i - 1) * 4, step.sz + (i % 2) * 4));
      }
    }
    if (step.kind === 'collect') {
      w.combat.spawnPickup('cash', step.x, step.z, 150);
    }
    if (step.kind === 'robAtm') step.base = w.stats.atmRobs || 0;
    if (step.kind === 'heliDown') step.base = w.stats.heliDowns || 0;
    if (step.kind === 'survive') step.t = step.seconds;
    w.hud.setObjective(this.objectiveText());
  }
  objectiveText() {
    const step = this.step;
    if (!step) return '';
    if (step.kind === 'kill') {
      const dead = (step.enemies || []).filter((e) => e.dead).length;
      return `${step.text} (${dead}/${step.n})`;
    }
    return step.text;
  }
  currentObjective() {
    const w = this.world;
    const step = this.step;
    if (!step || this.done) return null;
    const text = this.objectiveText();
    if (step.kind === 'goto' || step.kind === 'collect' || step.kind === 'deliver') {
      return { x: step.x, z: step.z, text };
    }
    if (step.kind === 'kill') return { x: step.sx, z: step.sz, text };
    if (step.kind === 'enterCar') {
      if (step.spawnedCar && !step.spawnedCar.dead) return { x: step.spawnedCar.x, z: step.spawnedCar.z, text };
      const car = w.drive.nearestCar(w.player.x, w.player.z, 200);
      if (car) return { x: car.x, z: car.z, text };
      return { x: w.player.x, z: w.player.z, text };
    }
    if (step.kind === 'robAtm') {
      let best = null;
      let bestD = Infinity;
      let anyBest = null;
      let anyBestD = Infinity;
      w.layout.atms.forEach((a, i) => {
        const d = Math.hypot(a.x - w.player.x, a.z - w.player.z);
        if (d < anyBestD) {
          anyBestD = d;
          anyBest = a;
        }
        // Prefer an ATM that is not on cooldown; if every ATM is still
        // cooling down, fall back to the nearest one so the player at
        // least walks there and waits for it instead of standing still.
        if (w.crime && (w.crime.atmCooldown.get(i) || 0) > 0) return;
        if (d < bestD) {
          bestD = d;
          best = a;
        }
      });
      const pick = best || anyBest;
      return pick ? { x: pick.x, z: pick.z, text } : null;
    }
    if (step.kind === 'heliDown') {
      if (w.heli) return { x: w.heli.x, z: w.heli.z, text };
      return { x: w.player.x, z: w.player.z, text };
    }
    return { x: w.player.x, z: w.player.z, text }; // survive: no marker
  }
  stepDone() {
    const w = this.world;
    const p = w.player;
    const step = this.step;
    if (!step) return false;
    switch (step.kind) {
      case 'goto':
      case 'collect':
      case 'deliver': {
        if (step.needCar && !p.inCar) return false;
        return Math.hypot(p.x - step.x, p.z - step.z) < step.r;
      }
      case 'enterCar':
        return !!p.inCar && (!step.type || p.inCar.type === step.type);
      case 'kill':
        return (step.enemies || []).every((e) => e.dead);
      case 'robAtm':
        return (w.stats.atmRobs || 0) > step.base;
      case 'survive':
        return step.t <= 0;
      case 'heliDown':
        return (w.stats.heliDowns || 0) > step.base;
      default:
        return false;
    }
  }
  update(dt) {
    const w = this.world;
    if (this.done || !w.started || w.ended) return;
    if (this.index < 0) {
      // Between missions: count down to the NEXT one, never back to 1.
      if (this.done) return;
      this.nextTimer -= dt;
      if (this.nextTimer <= 0) this.startMission(this.nextIndex >= 0 ? this.nextIndex : 0);
      return;
    }
    const step = this.step;
    if (!step) return;
    if (step.kind === 'survive') step.t -= dt;
    if (this.stepDone()) {
      w.sfx.cash();
      this.stepIdx++;
      const m = this.mission;
      if (this.stepIdx >= m.steps.length) {
        this.completeMission();
      } else {
        this.setupStep();
      }
    }
  }
  completeMission() {
    const w = this.world;
    const i = this.index;
    const reward = TUNE.missions.reward[i] || 500;
    w.cash += reward;
    w.stats.missionsDone = (w.stats.missionsDone || 0) + 1;
    const m = this.mission;
    w.hud.banner('MISSION COMPLETE', `${m.title} — $${reward.toLocaleString('en-US')}`);
    w.hud.toast(`Mission complete: ${m.title} (+$${reward})`);
    w.persist.save();
    if (i + 1 >= MISSIONS.length) {
      this.done = true;
      this.index = -1;
      this.step = null;
      w.storyComplete = true;
      w.cash += 2500;
      w.hud.banner('STORY COMPLETE', 'Solmar Bay is yours, Rook. +$2,500 bonus.');
      return;
    }
    this.index = -1;
    this.step = null;
    this.nextIndex = i + 1;
    this.nextTimer = 2.5;
  }
  // A bust/waste restarts the current mission from its first step.
  resetCurrent() {
    if (this.done || this.index < 0) return;
    this.stepIdx = 0;
    this.setupStep();
  }
}
