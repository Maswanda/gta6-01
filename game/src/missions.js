// missions.js — The twelve-chapter story of Solmar Bay.
// Each mission is a list of steps (talk / goto / drive / shoot /
// survive / race). The machine tracks the current mission and step,
// spawns combat crews, hands out rewards and weapon unlocks, and
// tells the HUD what the objective is and where it is.
import { TUNE, dist2d } from './tuning.js';

const GOTO_RADIUS = 12;
const TALK_RADIUS = 10;

export class Missions {
  constructor(world) {
    this.world = world;
    this.index = 0;
    this.step = 0;
    this.done = false;
    this._raceCp = 0;
    this._shootCrew = [];
    this._started = false;
  }
  get current() {
    return this.done ? null : TUNE.missions[this.index];
  }
  get currentStep() {
    const m = this.current;
    return m ? m.steps[this.step] : null;
  }
  currentObjective() {
    if (this.done) return 'Story complete — Solmar Bay is yours.';
    const s = this.currentStep;
    if (!s) return '';
    const m = this.current;
    return 'M' + (this.index + 1) + ' · ' + m.title + ' — ' + s.text;
  }
  currentTarget() {
    const s = this.currentStep;
    if (!s) return null;
    if (s.kind === 'race') {
      return TUNE.raceCheckpoints[this._raceCp] || null;
    }
    if (s.at) {
      const lm = TUNE.landmarks[s.at];
      return lm ? { x: lm.x, z: lm.z } : null;
    }
    return null;
  }
  start() {
    if (this._started) return;
    this._started = true;
    this._beginMission(0);
  }
  // Jump the story to a mission/step (used by the ?shot= staging so
  // a screenshot shows the right chapter and objective).
  jumpTo(index, step) {
    this._started = true;
    this.index = index;
    this.step = step;
    this.done = false;
    this._onStepStart();
  }
  _beginMission(i) {
    this.index = i;
    this.step = 0;
    const m = TUNE.missions[i];
    this.world.hud.toast('M' + (i + 1) + ' — ' + m.title);
    this.world.hud.flash(m.title);
    this.world.audio.mission();
    if (i === 10) {
      // M11 Air Support: the heat jumps to four stars the moment the
      // job starts, so the chopper lifts off.
      this.world.police.setWanted(4);
    }
    this._onStepStart();
  }
  _onStepStart() {
    const s = this.currentStep;
    if (!s) return;
    if (s.kind === 'shoot') {
      const lm = TUNE.landmarks[s.at];
      this._shootCrew = this.world.combat.spawnCrew(lm.x, lm.z, s.count || 3, 'm' + (this.index + 1));
      this.world.hud.toast(s.text);
    } else if (s.kind === 'race') {
      this._raceCp = 0;
      this.world.hud.toast('Street circuit — hit all 4 checkpoints!');
    }
  }
  // KeyE near a talk target.
  tryTalk() {
    const s = this.currentStep;
    if (!s || s.kind !== 'talk') return false;
    const lm = TUNE.landmarks[s.at];
    const p = this.world.player;
    if (dist2d(p.pos.x, p.pos.z, lm.x, lm.z) > TALK_RADIUS) return false;
    this._completeStep();
    return true;
  }
  onEnemyDown(e) {
    // The M10 vault: when the last vault guard drops, the alarm
    // trips and the heat jumps to three stars.
    const s = this.currentStep;
    if (!s || s.kind !== 'shoot') return;
    if (this._shootCrew.every((c) => c.hp <= 0)) {
      if (this.index === 9) {
        this.world.police.setWanted(3);
        this.world.hud.toast('Vault alarm! Three stars — run!');
      }
    }
  }
  _completeStep() {
    const m = this.current;
    const s = this.currentStep;
    // Bank job prep raises the heat when the plan is grabbed.
    if (this.index === 8 && s && s.kind === 'talk') {
      this.world.police.setWanted(2);
      this.world.hud.toast('You cased the bank — the PD noticed. Two stars.');
    }
    this.step += 1;
    if (this.step >= m.steps.length) {
      this._completeMission();
    } else {
      this._onStepStart();
    }
  }
  _completeMission() {
    const m = this.current;
    const world = this.world;
    world.player.cash += m.reward;
    world.audio.mission();
    world.hud.toast('Job done: ' + m.title + '  +$' + m.reward.toLocaleString('en-US'));
    // Weapon unlocks.
    if (this.index === 3) {
      world.unlocked.shotgun = true;
      world.combat.selectWeapon('shotgun');
      world.hud.toast('Shotgun unlocked — press 2 to equip it.');
    }
    if (this.index === 7) {
      world.unlocked.smg = true;
      world.combat.selectWeapon('smg');
      world.hud.toast('SMG unlocked — press 3 to equip it.');
    }
    if (this.index >= TUNE.missions.length - 1) {
      this.done = true;
      this.step = 0;
      world.hud.flash('STORY COMPLETE');
      return;
    }
    this._beginMission(this.index + 1);
  }
  update(dt) {
    if (this.done || !this._started) return;
    const world = this.world;
    const p = world.player;
    const s = this.currentStep;
    if (!s) return;
    if (s.kind === 'goto' || s.kind === 'drive') {
      const lm = TUNE.landmarks[s.at];
      if (!lm) return;
      const near = dist2d(p.pos.x, p.pos.z, lm.x, lm.z) < GOTO_RADIUS;
      if (s.kind === 'goto' && near) {
        this._completeStep();
      } else if (s.kind === 'drive' && near && p.inCar) {
        if (!s.needCar || p.inCar.kind === s.needCar) {
          this._completeStep();
        }
      }
    } else if (s.kind === 'shoot') {
      if (this._shootCrew.length > 0 && this._shootCrew.every((c) => c.hp <= 0)) {
        this._completeStep();
      }
    } else if (s.kind === 'survive') {
      // The chopper is up and overhead.
      const h = world.heli;
      if (h.active && dist2d(h.pos.x, h.pos.z, p.pos.x, p.pos.z) < 100) {
        this._completeStep();
      }
    } else if (s.kind === 'race') {
      const cp = TUNE.raceCheckpoints[this._raceCp];
      if (cp && dist2d(p.pos.x, p.pos.z, cp.x, cp.z) < GOTO_RADIUS) {
        this._raceCp += 1;
        world.audio.pickup();
        if (this._raceCp >= TUNE.raceCheckpoints.length) {
          this._completeStep();
        } else {
          world.hud.toast('Checkpoint ' + this._raceCp + ' / 4');
        }
      }
    }
  }
  currentHint() {
    const world = this.world;
    const p = world.player;
    const s = this.currentStep;
    if (!s) return '';
    if (s.kind === 'talk') {
      const lm = TUNE.landmarks[s.at];
      if (dist2d(p.pos.x, p.pos.z, lm.x, lm.z) < TALK_RADIUS + 6) return 'Press E to talk';
    }
    if (p.inCar) {
      if (world.combat.enemiesLeft > 0) return 'G shoot · R reload · F exit car';
      return 'F exit car · Q radio';
    }
    const car = world.onfoot.nearestCar(4.5);
    if (car) return 'Press F to enter the car';
    if (world.combat.enemiesLeft > 0) return 'G shoot · R reload · 1/2/3 weapons';
    if (s.kind === 'goto' || s.kind === 'drive') return 'Follow the yellow marker on the map';
    return 'WASD move · Shift sprint · C crouch';
  }
}
