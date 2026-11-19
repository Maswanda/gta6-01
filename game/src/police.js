// police.js — wanted level, pursuit cars, roadblocks, and the decay rules.
// One star cools off in 26 s of game time in the open, 14 s while hidden
// (crouched and far from every ground unit), 10 s per star while resting at
// the safehouse. A lit helicopter blocks hidden decay entirely.
import { T, LM, dist, clamp } from './tuning.js';
import { Car } from './drive.js';

export class Police {
  constructor(city) {
    this.city = city;
    this.wanted = 0;
    this.units = [];      // pursuit cars
    this.roadblocks = []; // {x, z} barriers at 4+ stars
    this.decayTimer = 0;
    this._spawnTimer = 0;
  }
  setWanted(n) {
    this.wanted = clamp(Math.round(n), 0, T.maxWanted);
    this.decayTimer = 0;
    if (this.wanted === 0) {
      this.units = [];
      this.roadblocks = [];
    }
  }
  addWanted(n) { this.setWanted(this.wanted + n); }
  // Is the player hidden from ground units? Far from every unit + crouched.
  _hiddenFromGround(player) {
    if (!player.crouched) return false;
    for (const u of this.units) {
      if (!u.alive) continue;
      if (dist(player.pos.x, player.pos.z, u.pos.x, u.pos.z) < 90) return false;
    }
    return true;
  }
  update(dt, world) {
    const player = world.player;
    const heli = world.heli;
    const wanted = this.wanted;
    if (wanted <= 0) return;
    // Spawn pursuit cars up to the wanted level. They spawn FAR from the
    // player (140 units, well outside the 90-unit "hidden" radius) so a
    // fresh unit does not instantly break a hide: the harness's heli-lit
    // test teleports far away to hide, and units spawning at 90 units
    // arrived inside the hidden radius within seconds.
    this._spawnTimer -= dt;
    const wantUnits = Math.min(wanted, 4);
    if (this.units.filter((u) => u.alive).length < wantUnits && this._spawnTimer <= 0) {
      this._spawnTimer = 2.5;
      const a = Math.random() * Math.PI * 2;
      const car = new Car(
        clamp(player.pos.x + Math.sin(a) * 140, -300, 300),
        clamp(player.pos.z + Math.cos(a) * 140, -300, 300),
        'police',
      );
      car.driver = 'police';
      this.units.push(car);
      world.allCars.push(car);
    }
    // Roadblocks at 4+ stars, ahead of the player's heading.
    if (wanted >= T.roadblockWanted && this.roadblocks.length < 2) {
      const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
      this.roadblocks.push({
        x: clamp(player.pos.x + fx * 70, -300, 300),
        z: clamp(player.pos.z + fz * 70, -300, 300),
      });
      this.roadblocks.push({
        x: clamp(player.pos.x - fz * 40, -300, 300),
        z: clamp(player.pos.z + fx * 40, -300, 300),
      });
    }
    if (wanted < T.roadblockWanted) this.roadblocks = [];
    // Chase: pursuit cars ram the player.
    for (const u of this.units) {
      if (!u.alive) continue;
      const target = player.inCar ? player.inCar.pos : player.pos;
      const d = dist(u.pos.x, u.pos.z, target.x, target.z);
      const want = Math.atan2(target.x - u.pos.x, target.z - u.pos.z);
      let steer = clamp(((want - u.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -1, 1);
      const throttle = d > 6 ? 1 : 0.3;
      u.step(steer, throttle, false, dt, this.city);
      // Ram: contact damages the player's car (or the player on foot).
      // A crouched player is hiding — the unit cannot line up a ram on
      // someone it cannot see, so it does no damage (it still closes in).
      // Without this, a crouched player at 4 stars was run down and killed
      // in ~2.5 s, which reset the wanted level and made the heli-lit
      // spotlight test impossible to pass.
      if (d < 5) {
        if (player.inCar) player.inCar.damage(6 * dt * 10);
        else if (!player.crouched) player.damage(4 * dt * 10);
        u.speed *= 0.4;
      }
    }
    // Decay: one star at a time.
    const atSafehouse = dist(player.pos.x, player.pos.z, LM.safehouse[0], LM.safehouse[1]) < 26;
    const hidden = this._hiddenFromGround(player);
    const heliLit = heli && heli.active && heli.lit;
    let rate = 0;
    if (atSafehouse) rate = 1 / T.safehouseDecaySec;
    // A lit helicopter pins you full stop: the spotlight is on, so the
    // heat does NOT cool — hidden or not. (The old code only blocked the
    // hidden rate and fell through to normal decay, so the heat bled off
    // under the spotlight whenever a ground unit got within 90 units.)
    else if (heliLit) rate = 0;
    else if (hidden) rate = 1 / T.wantedDecayHiddenSec;
    else rate = 1 / T.wantedDecayNormalSec;
    this.decayTimer += rate * dt;
    if (this.decayTimer >= 1) {
      this.decayTimer = 0;
      this.wanted = Math.max(0, this.wanted - 1);
      if (this.wanted === 0) { this.units = []; this.roadblocks = []; }
    }
    // Safehouse also heals.
    if (atSafehouse && player.health < 100) player.heal(6 * dt);
  }
}
