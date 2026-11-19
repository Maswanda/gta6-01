// side.js — Side activities: taxi fares, street races and hidden
// packages. Small money, but they make Solmar Bay feel alive between
// story jobs — and the playtest drives each of them.
import { TUNE, dist2d } from './tuning.js';

export class Side {
  constructor(world) {
    this.world = world;
    this.taxi = { state: 'idle', passenger: null, dest: null, fare: 0 };
    this.race = { state: 'idle', cp: 0 };
    this.collected = [];
    this._collectibles = TUNE.collectibles.map((c) => ({ ...c, taken: false }));
  }
  // ---- taxi ----
  startTaxi() {
    const world = this.world;
    const rng = world.rng;
    const p = world.city.randomRoadPoint();
    const d = world.city.randomRoadPoint();
    this.taxi = {
      state: 'pickup',
      passenger: { x: p.x, z: p.z },
      dest: { x: d.x, z: d.z },
      fare: TUNE.taxiFare,
    };
    world.hud.toast('Taxi fare — pick up the passenger (yellow marker).');
    return this.taxi;
  }
  // KeyT near the passenger, or near the destination with a passenger.
  tryInteract() {
    const world = this.world;
    const p = world.player;
    const input = world.input;
    if (!input.pressed('KeyT')) return false;
    if (this.taxi.state === 'pickup' && this.taxi.passenger) {
      if (dist2d(p.pos.x, p.pos.z, this.taxi.passenger.x, this.taxi.passenger.z) < 10) {
        this.taxi.state = 'dropoff';
        world.hud.toast('Passenger aboard — take them to the destination.');
        world.audio.pickup();
        return true;
      }
    } else if (this.taxi.state === 'dropoff' && this.taxi.dest) {
      if (dist2d(p.pos.x, p.pos.z, this.taxi.dest.x, this.taxi.dest.z) < 12) {
        world.player.cash += this.taxi.fare;
        world.audio.cash();
        world.hud.toast('Fare complete  +$' + this.taxi.fare);
        this.taxi = { state: 'done', passenger: null, dest: null, fare: 0 };
        return true;
      }
    }
    return false;
  }
  // ---- street race ----
  startRace() {
    this.race = { state: 'racing', cp: 0 };
    this.world.hud.toast('Street race — hit all 4 checkpoints!');
    return this.race;
  }
  // ---- collectibles ----
  collectibleIds() {
    return this._collectibles.filter((c) => !c.taken).map((c) => c.id);
  }
  collectiblePos(id) {
    const c = this._collectibles.find((x) => x.id === id);
    return c && !c.taken ? { x: c.x, z: c.z } : null;
  }
  update(dt) {
    const world = this.world;
    const p = world.player;
    // Taxi auto-complete when the player drives into the marker.
    if (this.taxi.state === 'pickup' && this.taxi.passenger) {
      if (dist2d(p.pos.x, p.pos.z, this.taxi.passenger.x, this.taxi.passenger.z) < 8) {
        // Standing on the passenger: prompt with a hint, pickup is on T.
        world.hint = 'Press T to pick up the passenger';
      }
    } else if (this.taxi.state === 'dropoff' && this.taxi.dest) {
      if (dist2d(p.pos.x, p.pos.z, this.taxi.dest.x, this.taxi.dest.z) < 10) {
        world.player.cash += this.taxi.fare;
        world.audio.cash();
        world.hud.toast('Fare complete  +$' + this.taxi.fare);
        this.taxi = { state: 'done', passenger: null, dest: null, fare: 0 };
      }
    }
    // Race checkpoints.
    if (this.race.state === 'racing') {
      const cp = TUNE.raceCheckpoints[this.race.cp];
      if (cp && dist2d(p.pos.x, p.pos.z, cp.x, cp.z) < 12) {
        this.race.cp += 1;
        world.audio.pickup();
        if (this.race.cp >= TUNE.raceCheckpoints.length) {
          this.race.state = 'done';
          world.player.cash += TUNE.racePrize;
          world.audio.cash();
          world.hud.toast('Race won!  +$' + TUNE.racePrize);
        } else {
          world.hud.toast('Checkpoint ' + this.race.cp + ' / 4');
        }
      }
    }
    // Collectibles: walk or drive over them.
    for (const c of this._collectibles) {
      if (c.taken) continue;
      if (dist2d(p.pos.x, p.pos.z, c.x, c.z) < 4) {
        c.taken = true;
        this.collected.push(c.id);
        world.player.cash += TUNE.collectibleReward;
        world.audio.cash();
        world.hud.toast('Hidden package found!  +$' + TUNE.collectibleReward);
      }
    }
  }
  // Serializable state for the save file.
  snapshot() {
    return {
      taxi: this.taxi.state,
      race: this.race.state,
      collected: [...this.collected],
    };
  }
  restore(snap) {
    if (!snap) return;
    if (snap.collected) {
      for (const id of snap.collected) {
        const c = this._collectibles.find((x) => x.id === id);
        if (c) c.taken = true;
      }
      this.collected = [...snap.collected];
    }
  }
}
