// Side activities: taxi fares, street races, hidden packages.
// Each is small, repeatable, and pays cash.
import { COLLECTIBLES, T } from './tuning.js';

export class Side {
  constructor(world) {
    this.world = world;
    this.taxi = { state: 'idle', passenger: null, dest: null, doneCount: 0 };
    this.race = { state: 'idle', checkpoints: [], index: 0, doneCount: 0 };
    this.collectibles = { found: new Set(), total: COLLECTIBLES.length };
  }

  state() {
    return {
      taxi: { state: this.taxi.state, done: this.taxi.doneCount },
      race: { state: this.race.state, checkpoint: this.race.index, done: this.race.doneCount },
      collectibles: { found: this.collectibles.found.size, total: this.collectibles.total },
    };
  }

  // --- Taxi ---
  startTaxi() {
    const w = this.world;
    if (this.taxi.state === 'pickup' || this.taxi.state === 'dropoff') return false;
    const spots = [
      { x: -208, z: 52 },
      { x: 104, z: -156 },
      { x: -130, z: 26 },
      { x: 156, z: 104 },
      { x: -60, z: 300 },
    ];
    const p = spots[Math.floor(w.rng() * spots.length)];
    const d = spots[Math.floor(w.rng() * spots.length)];
    this.taxi = { state: 'pickup', passenger: { x: p.x, z: p.z }, dest: { x: d.x, z: d.z }, doneCount: this.taxi.doneCount };
    return true;
  }

  pickupTaxi() {
    if (this.taxi.state !== 'pickup') return false;
    this.taxi.state = 'dropoff';
    return true;
  }

  stepTaxi(dt) {
    const w = this.world;
    if (this.taxi.state === 'pickup' && this.taxi.passenger) {
      // The passenger waits; nothing moves on its own.
      return;
    }
    if (this.taxi.state === 'dropoff' && this.taxi.dest) {
      const d = Math.hypot(w.player.pos.x - this.taxi.dest.x, w.player.pos.z - this.taxi.dest.z);
      if (d < 12) {
        w.player.cash += T.taxiFare;
        this.taxi.doneCount++;
        this.taxi = { state: 'done', passenger: null, dest: null, doneCount: this.taxi.doneCount };
      }
    }
  }

  // --- Race ---
  startRace(checkpoints) {
    const cps = checkpoints || [[104, -104], [-104, -104], [-104, 104], [104, 104]];
    this.race = {
      state: 'racing',
      checkpoints: cps.map(([x, z]) => ({ x, z })),
      index: 0,
      doneCount: this.race.doneCount,
    };
    return true;
  }

  stepRace(dt) {
    const w = this.world;
    if (this.race.state !== 'racing') return;
    const cp = this.race.checkpoints[this.race.index];
    if (!cp) return;
    const d = Math.hypot(w.player.pos.x - cp.x, w.player.pos.z - cp.z);
    if (d < T.checkpointRadius) {
      this.race.index++;
      w.audio.blip(700 + this.race.index * 80, 0.1, 'square', 0.2);
      if (this.race.index >= this.race.checkpoints.length) {
        this.race.state = 'done';
        this.race.doneCount++;
        w.player.cash += 300;
      }
    }
  }

  // --- Collectibles ---
  collectibleIds() {
    return COLLECTIBLES.map((c) => c.id);
  }

  collectiblePos(id) {
    const c = COLLECTIBLES.find((x) => x.id === id);
    return c ? { x: c.x, z: c.z } : null;
  }

  stepCollectibles() {
    const w = this.world;
    for (const c of COLLECTIBLES) {
      if (this.collectibles.found.has(c.id)) continue;
      const d = Math.hypot(w.player.pos.x - c.x, w.player.pos.z - c.z);
      if (d < 6) {
        this.collectibles.found.add(c.id);
        w.player.cash += 150;
        w.audio.blip(880, 0.12, 'square', 0.2);
      }
    }
  }

  step(dt) {
    this.stepTaxi(dt);
    this.stepRace(dt);
    this.stepCollectibles();
  }
}
