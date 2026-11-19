// side.js — side activities: taxi fares (T), time-trial race (Y), and
// collectibles scattered around the city. Each pays cash; results persist
// in the save.
import { T, dist } from './tuning.js';

export class Side {
  constructor(city) {
    this.city = city;
    this.taxi = { state: 'idle', passenger: null, dest: null, earned: 0 };
    this.race = { state: 'idle', point: 0, earned: 0 };
    this.collectibles = { found: 0, total: 8, ids: [] };
    this._points = [[104, -104], [-104, -104], [-104, 104], [104, 104]];
    // 8 collectibles: hidden packages at fixed spots.
    const spots = [
      [-260, 260], [260, 260], [-260, -260], [260, -260],
      [0, 260], [-260, 0], [260, 0], [0, -260],
    ];
    this._collectibleSpots = spots.map(([x, z], i) => ({ id: 'pkg' + (i + 1), x, z, found: false }));
  }
  get state() {
    return {
      taxi: { state: this.taxi.state, earned: this.taxi.earned },
      race: { state: this.race.state, earned: this.race.earned },
      collectibles: { found: this.collectibles.found, total: this.collectibles.total },
    };
  }
  startTaxi(world) {
    if (this.taxi.state === 'pickup' || this.taxi.state === 'dropoff') return false;
    const p = world.player.inCar ? world.player.inCar.pos : world.player.pos;
    // Passenger a short drive away, destination across town.
    const a = Math.random() * Math.PI * 2;
    const px = Math.max(-280, Math.min(280, p.x + Math.sin(a) * 90));
    const pz = Math.max(-280, Math.min(280, p.z + Math.cos(a) * 90));
    const dx = -px, dz = -pz;
    this.taxi = { state: 'pickup', passenger: { x: px, z: pz }, dest: { x: dx, z: dz }, earned: this.taxi.earned };
    return true;
  }
  // T near the passenger picks them up; T near the destination drops them off.
  taxiInteract(world) {
    const p = world.player.inCar ? world.player.inCar.pos : world.player.pos;
    if (this.taxi.state === 'pickup') {
      if (dist(p.x, p.z, this.taxi.passenger.x, this.taxi.passenger.z) < 12) {
        this.taxi.state = 'dropoff';
        return 'picked';
      }
    } else if (this.taxi.state === 'dropoff') {
      if (dist(p.x, p.z, this.taxi.dest.x, this.taxi.dest.z) < 14) {
        this.taxi.state = 'idle';
        this.taxi.earned += T.taxiFare;
        world.player.cash += T.taxiFare;
        return 'done';
      }
    }
    return null;
  }
  startRace() {
    if (this.race.state === 'running') return false;
    this.race = { state: 'running', point: 0, earned: this.race.earned };
    return true;
  }
  update(dt, world) {
    const p = world.player.inCar ? world.player.inCar.pos : world.player.pos;
    if (this.race.state === 'running') {
      const pt = this._points[this.race.point];
      if (pt && dist(p.x, p.z, pt[0], pt[1]) <= T.gotoRadius) {
        this.race.point++;
        if (this.race.point >= this._points.length) {
          this.race.state = 'idle';
          this.race.earned += T.racePrize;
          world.player.cash += T.racePrize;
        } else if (world.audio) world.audio.pickup();
      }
    }
    // Collectibles: walk or drive over them.
    for (const c of this._collectibleSpots) {
      if (!c.found && dist(p.x, p.z, c.x, c.z) < 6) {
        c.found = true;
        this.collectibles.found++;
        world.player.cash += T.collectibleReward;
        if (world.audio) world.audio.pickup();
      }
    }
  }
  collectibleIds() { return this._collectibleSpots.filter((c) => !c.found).map((c) => c.id); }
  collectiblePos(id) {
    const c = this._collectibleSpots.find((s) => s.id === id);
    return c ? { x: c.x, z: c.z } : null;
  }
  serialize() {
    return {
      taxiEarned: this.taxi.earned,
      raceEarned: this.race.earned,
      collectibles: this._collectibleSpots.filter((c) => c.found).map((c) => c.id),
    };
  }
  deserialize(d) {
    if (!d) return;
    if (typeof d.taxiEarned === 'number') this.taxi.earned = d.taxiEarned;
    if (typeof d.raceEarned === 'number') this.race.earned = d.raceEarned;
    if (Array.isArray(d.collectibles)) {
      for (const c of this._collectibleSpots) c.found = d.collectibles.includes(c.id);
      this.collectibles.found = this._collectibleSpots.filter((c) => c.found).length;
    }
  }
}
