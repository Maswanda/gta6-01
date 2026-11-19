// missions.js — the 12-mission story, chained by explicit nextIndex.
// Mission 12 has nextIndex null: finishing it ends the story (done=true).
// Steps: talk (press E near a point), goto (reach a point, radius 40 so a
// car can make it), kill (clear the spawned enemies), race (checkpoints),
// heli (the chopper must be overhead), safehouse (reach it with no heat).
import { T, LM, dist } from './tuning.js';

const M = (title, steps, nextIndex, reward = 300) => ({ title, steps, nextIndex, reward });

export const MISSIONS = [
  M('Meet Mara', [
    { kind: 'talk', x: LM.pier[0], z: LM.pier[1], text: 'Meet Mara at the pier' },
  ], 1, 200),
  M('Hot Wheels', [
    { kind: 'goto', x: LM.garage[0], z: LM.garage[1], text: 'Get to the garage' },
  ], 2, 250),
  M('First Blood', [
    { kind: 'talk', x: LM.warehouse[0], z: LM.warehouse[1], text: 'Pick up the package at the warehouse' },
    { kind: 'goto', x: LM.bar[0], z: LM.bar[1], text: 'Deliver it to the bar' },
  ], 3, 350),
  M('Cash Run', [
    { kind: 'goto', x: LM.docks[0], z: LM.docks[1], text: 'Get to the docks' },
    { kind: 'kill', x: LM.docks[0], z: LM.docks[1], count: 3, kind2: 'bayking', text: 'Clear the Bay Kings (0/3)' },
  ], 4, 450),
  M('The Getaway', [
    { kind: 'talk', x: LM.clockTower[0], z: LM.clockTower[1], text: 'Meet the fixer at the clock tower' },
    { kind: 'goto', x: LM.marina[0], z: LM.marina[1], text: 'Reach the marina' },
  ], 5, 400),
  M("Rico's Ride", [
    { kind: 'goto', x: LM.garage[0], z: LM.garage[1], text: "Get Rico's ride from the garage" },
  ], 6, 400),
  M('Bay Kings Turf', [
    { kind: 'race', points: [[104, -104], [-104, -104], [-104, 104], [104, 104]], text: 'Race the turf: hit every checkpoint' },
  ], 7, 600),
  M('Midnight Delivery', [
    { kind: 'goto', x: LM.warehouse[0], z: LM.warehouse[1], text: 'Get to the warehouse' },
    { kind: 'kill', x: LM.warehouse[0], z: LM.warehouse[1], count: 4, kind2: 'enforcer', text: 'Clear the enforcers (0/4)' },
  ], 8, 550),
  M('Heat Wave', [
    { kind: 'goto', x: LM.bank[0], z: LM.bank[1], text: 'Get to the bank' },
    { kind: 'talk', x: LM.bank[0], z: LM.bank[1], text: 'Rob the bank', wanted: 3, cash: 500 },
    { kind: 'goto', x: LM.safehouse[0], z: LM.safehouse[1], text: 'Lay low at the safehouse' },
  ], 9, 500),
  M('The Marina Heist', [
    { kind: 'goto', x: LM.casino[0], z: LM.casino[1], text: 'Get to the casino' },
    { kind: 'talk', x: LM.casino[0], z: LM.casino[1], text: 'Talk your way past the guard' },
    { kind: 'kill', x: 78, z: -20, count: 2, kind2: 'enforcer', text: 'Take down the vault guards (0/2)', wanted: 3 },
    { kind: 'goto', x: LM.safehouse[0], z: LM.safehouse[1], text: 'Drive the cash home' },
  ], 10, 1200),
  M('Air Support', [
    { kind: 'heli', text: 'The heat is on — the chopper is overhead' },
    { kind: 'safehouse', x: LM.safehouse[0], z: LM.safehouse[1], text: 'Lose the heat at the safehouse' },
  ], 11, 800),
  M('The Last Run', [
    { kind: 'talk', x: LM.garage[0], z: LM.garage[1], text: 'Talk to Rico at the garage' },
    { kind: 'goto', x: LM.pier[0], z: LM.pier[1], text: 'Carry the ledger to the pier' },
    { kind: 'goto', x: LM.safehouse[0], z: LM.safehouse[1], text: 'Get home to the safehouse' },
  ], null, 1500),
];

export class Missions {
  constructor(world) {
    this.world = world;
    this.index = 0;
    this.step = 0;
    this.done = false;
    this.storyComplete = false;
    this._racePoint = 0;
    this._killSpawned = false;
    this._heliSet = false;
    this._objective = '';
  }
  get current() { return MISSIONS[this.index]; }
  get state() {
    const m = this.current;
    return {
      index: this.index,
      step: this.step,
      title: m ? m.title : 'Done',
      done: this.done,
      objective: this._objective || (m ? m.steps[Math.min(this.step, m.steps.length - 1)].text : ''),
    };
  }
  // The objective the autopilot drives to: {kind, x, z, ...} or null.
  objective() {
    if (this.done || !this.current) return null;
    const s = this.current.steps[this.step];
    if (!s) return null;
    this._objective = s.text;
    if (s.kind === 'race') {
      const p = s.points[this._racePoint];
      return p ? { kind: 'goto', x: p[0], z: p[1], text: s.text } : null;
    }
    return s;
  }
  _advance() {
    const m = this.current;
    this.step++;
    this._racePoint = 0;
    this._killSpawned = false;
    if (this.step >= m.steps.length) {
      // Mission complete: reward, then follow nextIndex.
      const w = this.world;
      w.player.cash += m.reward;
      if (w.audio) w.audio.cash();
      if (m.title === 'Cash Run') w.combat.unlock('shotgun');
      if (m.title === 'Midnight Delivery') w.combat.unlock('smg');
      const next = m.nextIndex;
      if (next === null || next === undefined) {
        this.done = true;
        this.storyComplete = true;
        this.index = MISSIONS.length - 1;
        this.step = m.steps.length;
      } else {
        this.index = next;
        this.step = 0;
        this._enterStep();
      }
    } else {
      this._enterStep();
    }
  }
  _enterStep() {
    const s = this.current && this.current.steps[this.step];
    if (!s) return;
    this._objective = s.text;
    if (s.kind === 'kill' && !this._killSpawned) {
      this._killSpawned = true;
      const list = [];
      for (let i = 0; i < s.count; i++) {
        list.push({ x: s.x + (i - (s.count - 1) / 2) * 7, z: s.z + 5 + (i % 2) * 6, kind: s.kind2 || 'bayking' });
      }
      this.world.combat.spawnEnemies(list);
    }
    if (s.kind === 'heli' && !this._heliSet) {
      this._heliSet = true;
      this.world.police.setWanted(4);
    }
  }
  // The player pressed E: complete a talk step if in range.
  onTalk() {
    if (this.done || !this.current) return false;
    const s = this.current.steps[this.step];
    if (!s || s.kind !== 'talk') return false;
    const p = this.world.player.inCar ? this.world.player.inCar.pos : this.world.player.pos;
    if (dist(p.x, p.z, s.x, s.z) > T.talkRadius + 6) return false;
    if (s.wanted) this.world.police.setWanted(s.wanted);
    if (s.cash) this.world.player.cash += s.cash;
    this._advance();
    return true;
  }
  update(dt) {
    if (this.done || !this.current) return;
    const s = this.current.steps[this.step];
    if (!s) return;
    const w = this.world;
    const p = w.player.inCar ? w.player.inCar.pos : w.player.pos;
    if (s.kind === 'goto') {
      if (dist(p.x, p.z, s.x, s.z) <= T.gotoRadius) this._advance();
    } else if (s.kind === 'race') {
      const pt = s.points[this._racePoint];
      if (pt && dist(p.x, p.z, pt[0], pt[1]) <= T.gotoRadius) {
        this._racePoint++;
        if (this._racePoint >= s.points.length) this._advance();
        else if (w.audio) w.audio.pickup();
      }
    } else if (s.kind === 'kill') {
      if (this._killSpawned && w.combat.enemiesLeft === 0) {
        if (s.wanted) w.police.setWanted(s.wanted);
        this._advance();
      }
    } else if (s.kind === 'heli') {
      if (w.heli.active) this._advance();
    } else if (s.kind === 'safehouse') {
      if (dist(p.x, p.z, s.x, s.z) <= T.gotoRadius && w.police.wanted === 0) this._advance();
    }
  }
  start() {
    this.index = 0; this.step = 0; this.done = false; this.storyComplete = false;
    this._racePoint = 0; this._killSpawned = false; this._heliSet = false;
    this._enterStep();
  }
}
