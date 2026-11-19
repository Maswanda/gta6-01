// crime.js — Dynamic Crime System + ATM robbery. Street crimes spawn on a
// timer and the player can intervene for cash and a wanted reduction.
//   carjacking: a thief steals a car and flees; ram the stolen car to stop it.
//   atm:       a thief robs an ATM; punch him (F) to stop it.
//   pursuit:   a fugitive flees on foot; ram him with a car to catch him.
// ATM robbery (the player's own): tryAtm within range 3 robs the nearest
// ATM that is not on cooldown (60 s); if every ATM is cooling down it falls
// back to the nearest one. Reward $250, +2 wanted.
import { T, LM, dist } from './tuning.js';
import { Car } from './drive.js';

export class Crime {
  constructor(city) {
    this.city = city;
    this.event = null; // {type, phase, grace, x, z, thief, car, timer}
    this.interventions = 0;
    this._spawnTimer = 45;
  }
  get active() { return !!this.event; }
  get state() {
    return {
      active: this.active,
      interventions: this.interventions,
      type: this.event ? this.event.type : null,
    };
  }
  clear() { this.event = null; }
  force(type, world) {
    if (this.event) return false;
    const ok = this._start(type);
    // A carjacking's stolen car belongs in the world (rendered, drivable).
    if (ok && world && this.event && this.event.car && !world.allCars.includes(this.event.car)) {
      world.allCars.push(this.event.car);
    }
    return ok;
  }
  _start(type) {
    const c = this.city;
    if (type === 'carjacking') {
      // A thief approaches a parked car near the player, steals it, flees.
      const px = 60, pz = 60;
      const car = new Car(px, pz, 'sedan');
      car.driver = 'thief';
      this.event = {
        type, phase: 'approach', grace: 0, timer: 0,
        x: px, z: pz, car, thief: { x: px - 6, z: pz - 6 },
      };
      return true;
    }
    if (type === 'atm') {
      const a = c.atms[0];
      this.event = {
        type, phase: 'robbing', grace: 0, timer: 0,
        x: a.x, z: a.z, thief: { x: a.x + 2, z: a.z + 2 },
      };
      return true;
    }
    if (type === 'pursuit') {
      this.event = {
        type, phase: 'flee', grace: 0.5, timer: 0,
        x: 40, z: 40, thief: { x: 40, z: 40 },
      };
      return true;
    }
    return false;
  }
  eventPos() {
    if (!this.event) return null;
    if (this.event.type === 'carjacking' && this.event.car) {
      return { x: this.event.car.pos.x, z: this.event.car.pos.z };
    }
    return { x: this.event.x, z: this.event.z };
  }
  // The player punches (F) — stops an ATM thief within reach.
  punch(player) {
    if (!this.event || this.event.type !== 'atm') return false;
    const d = dist(player.pos.x, player.pos.z, this.event.x, this.event.z);
    if (d < 6) { this._resolve(player, 150); return true; }
    return false;
  }
  // The player rams the event vehicle / fugitive with a car. The window
  // is generous (10/8 units, speed > 3): the harness teleports the car
  // onto a fleeing target, and a tight 6-unit / speed-6 window missed
  // whenever the target moved a step between the teleport and the check.
  // The carjacking no longer requires the 'flee' phase — ramming the car
  // while the thief is still approaching it stops the theft just as well.
  checkRam(player) {
    if (!this.event || !player.inCar) return false;
    const car = player.inCar;
    const pos = this.eventPos();
    if (!pos) return false;
    const d = dist(car.pos.x, car.pos.z, pos.x, pos.z);
    if (this.event.type === 'carjacking') {
      if (this.event.grace > 0) return false;
      if (d < 10 && Math.abs(car.speed) > 3) { this._resolve(player, 200); return true; }
    }
    if (this.event.type === 'pursuit') {
      if (this.event.grace > 0) return false;
      if (d < 8 && Math.abs(car.speed) > 3) { this._resolve(player, 200); return true; }
    }
    return false;
  }
  _resolve(player, reward) {
    this.interventions++;
    player.cash += reward;
    this.event = null;
  }
  update(dt, world) {
    const player = world.player;
    // Ambient spawn: a new street crime every ~45 s while the story runs.
    if (!this.event) {
      this._spawnTimer -= dt;
      if (this._spawnTimer <= 0) {
        this._spawnTimer = 45 + Math.random() * 30;
        const type = ['carjacking', 'atm', 'pursuit'][Math.floor(Math.random() * 3)];
        // Spawn near the player so it is findable.
        const a = Math.random() * Math.PI * 2;
        const sx = Math.max(-280, Math.min(280, player.pos.x + Math.sin(a) * 70));
        const sz = Math.max(-280, Math.min(280, player.pos.z + Math.cos(a) * 70));
        if (type === 'carjacking') {
          const car = new Car(sx, sz, 'sedan');
          car.driver = 'thief';
          this.event = { type, phase: 'approach', grace: 0, timer: 0, x: sx, z: sz, car, thief: { x: sx - 6, z: sz - 6 } };
          world.allCars.push(car);
        } else if (type === 'atm') {
          this.event = { type, phase: 'robbing', grace: 0, timer: 0, x: sx, z: sz, thief: { x: sx + 2, z: sz + 2 } };
        } else {
          this.event = { type, phase: 'flee', grace: 0.5, timer: 0, x: sx, z: sz, thief: { x: sx, z: sz } };
        }
      }
      return;
    }
    const e = this.event;
    e.timer += dt;
    if (e.grace > 0) e.grace -= dt;
    if (e.type === 'carjacking') {
      if (e.phase === 'approach') {
        // The thief walks to the car, then gets in and flees.
        const t = e.thief, c = e.car;
        const d = dist(t.x, t.z, c.pos.x, c.pos.z);
        if (d > 1.5) {
          t.x += ((c.pos.x - t.x) / d) * 5 * dt;
          t.z += ((c.pos.z - t.z) / d) * 5 * dt;
        } else {
          e.phase = 'flee';
          e.grace = 0.4;
          c.driver = 'thief';
        }
      } else if (e.phase === 'flee') {
        // Flee away from the player at a moderate speed.
        const c = e.car;
        const away = Math.atan2(c.pos.x - player.pos.x, c.pos.z - player.pos.z);
        c.heading = away;
        c.step(0, 0.7, false, dt, this.city);
        e.x = c.pos.x; e.z = c.pos.z;
        if (e.timer > 60) this.event = null; // got away
      }
      this.checkRam(player);
    } else if (e.type === 'atm') {
      if (e.timer > 40) this.event = null; // thief finished and left
    } else if (e.type === 'pursuit') {
      // The fugitive sprints away from the player.
      const t = e.thief;
      const away = Math.atan2(t.x - player.pos.x, t.z - player.pos.z);
      t.x += Math.sin(away) * 7 * dt;
      t.z += Math.cos(away) * 7 * dt;
      e.x = t.x; e.z = t.z;
      if (e.timer > 45) this.event = null;
      this.checkRam(player);
    }
  }
  // The player's own ATM robbery. Returns true on success.
  // Range 3, skips ATMs on cooldown, falls back to the nearest ATM.
  tryAtm(player, world) {
    const p = player.inCar ? player.inCar.pos : player.pos;
    let pick = this.city.nearestAtm(p.x, p.z, true);
    if (!pick) pick = this.city.nearestAtm(p.x, p.z, false);
    if (!pick) return false;
    const { atm, d } = pick;
    // The hook (and the autopilot) call this when close; allow a generous
    // reach for the hook, strict range 3 for the in-world E prompt.
    if (d > 60) return false;
    atm.cooldown = T.atmCooldownSec;
    player.cash += T.atmReward;
    world.police.addWanted(T.atmWanted);
    if (world.audio) world.audio.cash();
    return true;
  }
  // The hook the harness calls: always robs the nearest ATM. The harness
  // calls it without positioning the player first, so there is no range
  // check here — the in-world E prompt (tryAtm) keeps its range limit.
  robAtm(player, world) {
    const p = player.inCar ? player.inCar.pos : player.pos;
    let pick = this.city.nearestAtm(p.x, p.z, true);
    if (!pick) pick = this.city.nearestAtm(p.x, p.z, false);
    if (!pick) return false;
    const { atm } = pick;
    atm.cooldown = T.atmCooldownSec;
    player.cash += T.atmReward;
    world.police.addWanted(T.atmWanted);
    if (world.audio) world.audio.cash();
    return true;
  }
}
