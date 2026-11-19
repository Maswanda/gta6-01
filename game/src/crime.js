// crime.js — Solmar Bay: the Dynamic Crime System and ATM robbery.
// The city keeps happening without the player: every so often a mugging,
// a carjacking or a shootout breaks out, and stopping it pays. ATMs are
// the quick score — hold E at a glowing kiosk for three seconds, take
// $250 and two stars of heat. The same ATM needs a minute before it pays again.
import { TUNE } from './tuning.js';
import { randomRoadPoint } from './city.js';

const EVENT_TYPES = [
  { kind: 'mugging', text: 'Mugging in progress — step in!', gang: 2 },
  { kind: 'carjack', text: 'Carjacking — stop the crew!', gang: 3 },
  { kind: 'shootout', text: 'Shootout on the street — clear it!', gang: 3 },
];

export class StreetCrime {
  constructor(world) {
    this.world = world;
    this.atmCooldown = new Map(); // atm index -> seconds left
    this.robbing = null; // { atm, t }
    this.event = null; // { type, x, z, enemies, timer }
    this.eventTimer = 20; // first event after 20s
  }
  nearestAtm(x, z, maxD = 3.2) {
    let best = -1;
    let bestD = maxD;
    this.world.layout.atms.forEach((a, i) => {
      const d = Math.hypot(a.x - x, a.z - z);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }
  // Called by main.js on E: returns true when a robbery starts (so main
  // does not also try to enter a car on the same press).
  tryAtm() {
    const w = this.world;
    const p = w.player;
    if (p.inCar) return false;
    const idx = this.nearestAtm(p.x, p.z);
    if (idx < 0) return false;
    if ((this.atmCooldown.get(idx) || 0) > 0) {
      w.hud.toast('This ATM is empty — it needs a minute.');
      w.sfx.denied();
      return true;
    }
    this.robbing = { atm: idx, t: 0 };
    w.hud.toast('Cracking the ATM — stay close…');
    return true;
  }
  finishRobbery() {
    const w = this.world;
    const idx = this.robbing.atm;
    this.robbing = null;
    w.cash += TUNE.crime.atmReward;
    w.stats.atmRobs = (w.stats.atmRobs || 0) + 1;
    w.police.addWanted(TUNE.crime.atmWanted);
    this.atmCooldown.set(idx, 60);
    w.sfx.cash();
    w.hud.toast(`+$${TUNE.crime.atmReward} — the ATM is empty. The law is coming.`);
    w.fx.burst(w.player.x, 1.5, w.player.z, 0x39d03a, 8, 5, 0.5, 3);
  }
  spawnEvent() {
    const w = this.world;
    const def = w.dice.pick(EVENT_TYPES);
    const p = randomRoadPoint(w.layout, w.dice);
    const enemies = [];
    for (let i = 0; i < def.gang; i++) {
      enemies.push(w.combat.spawnEnemy('gang', p.x + (i - 1) * 3, p.z + (i % 2) * 3));
    }
    // A victim ped, cowering nearby.
    const victim = w.stage.makePed(0xe8e0d0);
    victim.position.set(p.x + 6, 0, p.z + 6);
    this.event = { type: def.kind, text: def.text, x: p.x, z: p.z, enemies, victim, timer: 60 };
    w.hud.toast(`${def.text} ($${TUNE.crime.eventReward[0]}–$${TUNE.crime.eventReward[1]})`);
    w.hud.banner('CRIME IN PROGRESS', def.text);
  }
  clearEvent(rewarded) {
    const w = this.world;
    if (!this.event) return;
    for (const e of this.event.enemies) {
      if (!e.dead) w.combat.removeEnemy(e);
    }
    w.stage.scene.remove(this.event.victim);
    if (rewarded) {
      const pay = w.dice.int(TUNE.crime.eventReward[0], TUNE.crime.eventReward[1]);
      w.cash += pay;
      w.sfx.cash();
      w.hud.toast(`Crime stopped — $${pay} from a grateful local.`);
    }
    this.event = null;
    this.eventTimer = TUNE.crime.eventCooldownSec;
  }
  update(dt) {
    const w = this.world;
    for (const [k, v] of [...this.atmCooldown.entries()]) {
      const nv = v - dt;
      if (nv <= 0) this.atmCooldown.delete(k);
      else this.atmCooldown.set(k, nv);
    }
    // ATM robbery channel.
    if (this.robbing) {
      const a = w.layout.atms[this.robbing.atm];
      const d = Math.hypot(w.player.x - a.x, w.player.z - a.z);
      if (d > 4.5 || w.player.inCar) {
        this.robbing = null;
        w.hud.toast('Robbery aborted.');
      } else {
        this.robbing.t += dt;
        if (this.robbing.t >= 3) this.finishRobbery();
      }
    }
    // Crime events.
    if (!this.event) {
      this.eventTimer -= dt;
      if (this.eventTimer <= 0 && w.started && !w.ended) this.spawnEvent();
    } else {
      const ev = this.event;
      ev.timer -= dt;
      const allDead = ev.enemies.every((e) => e.dead);
      if (allDead) {
        this.clearEvent(true);
      } else if (ev.timer <= 0) {
        w.hud.toast('The crime played out without you.');
        this.clearEvent(false);
      }
    }
  }
  // The objective a crime event offers when no mission is running.
  sideObjective() {
    if (!this.event) return null;
    return { x: this.event.x, z: this.event.z, text: this.event.text };
  }
}
