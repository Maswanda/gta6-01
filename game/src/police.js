// police.js — Solmar Bay: the wanted level and the law's answer.
// Wanted is a float; stars are its ceiling. Cops spawn by the star count,
// chase the player, and — when the player is on foot and an officer
// reaches them — hold them for arrestHoldSeconds before the bust lands.
// That hold time is read from TUNE by name (the bust fix: the value
// exists, it is used, and the timer resets the moment the player breaks away).
import { TUNE } from './tuning.js';
import { randomRoadPoint } from './city.js';

export class LawForce {
  constructor(world) {
    this.world = world;
    this.cops = [];
    world.cops = this.cops;
    this.roadblock = [];
    this.arrestTimer = 0;
    this.copShootTimer = 0;
  }
  stars() {
    const w = this.world.wanted;
    if (w < 0.5) return 0;
    return Math.min(5, Math.ceil(w - 0.01));
  }
  addWanted(n) {
    this.world.wanted = Math.min(5, Math.max(0, this.world.wanted + n));
  }
  spawnCop(x, z) {
    const heading = Math.atan2(this.world.player.x - x, this.world.player.z - z);
    const car = this.world.drive.createCar('sedan', x, z, heading, { cop: true });
    car.health = TUNE.police.copHealth;
    car.shootTimer = 1 + Math.random();
    this.cops.push(car);
    return car;
  }
  removeCop(car) {
    const i = this.cops.indexOf(car);
    if (i >= 0) this.cops.splice(i, 1);
    this.world.drive.removeCar(car);
  }
  clearAll() {
    for (const c of [...this.cops]) this.removeCop(c);
    for (const c of [...this.roadblock]) this.world.drive.removeCar(c);
    this.roadblock = [];
    this.arrestTimer = 0;
  }
  update(dt) {
    const w = this.world;
    const stars = this.stars();
    // --- wanted decay: the helicopter's spotlight freezes it. ---
    if (!w.heliLit) {
      const hidden = this.cops.every((c) => Math.hypot(c.x - w.player.x, c.z - w.player.z) > 45);
      const rate = TUNE.police.decayPerSec + (hidden ? TUNE.police.decayHiddenBonus : 0);
      w.wanted = Math.max(0, w.wanted - rate * dt);
    }
    w.sfx.setSiren(stars >= 1);
    // --- keep the cop count matched to the stars. ---
    const want = TUNE.police.maxCars[stars] || 0;
    while (this.cops.length < want) {
      const p = randomRoadPoint(w.layout, w.dice);
      const ang = Math.random() * Math.PI * 2;
      const dist = 70 + Math.random() * 40;
      const x = w.player.x + Math.cos(ang) * dist;
      const z = w.player.z + Math.sin(ang) * dist;
      const c = w.layout.half - 10;
      this.spawnCop(Math.max(-c, Math.min(c, x)), Math.max(-c, Math.min(c, z)));
    }
    while (this.cops.length > want) {
      // Drop the farthest cop first.
      let far = this.cops[0];
      let farD = -1;
      for (const c of this.cops) {
        const d = Math.hypot(c.x - w.player.x, c.z - w.player.z);
        if (d > farD) {
          farD = d;
          far = c;
        }
      }
      this.removeCop(far);
    }
    // --- roadblocks at four stars and up. ---
    if (stars >= TUNE.police.roadblockAtStars && this.roadblock.length === 0) {
      const p = w.player;
      const fx = Math.sin(p.heading);
      const fz = Math.cos(p.heading);
      for (const side of [-6, 0, 6]) {
        const bx = p.x + fx * 34 - fz * side;
        const bz = p.z + fz * 34 + fx * side;
        const car = w.drive.createCar('sedan', bx, bz, p.heading + Math.PI / 2, { cop: true });
        car.health = TUNE.police.copHealth;
        this.roadblock.push(car);
      }
      w.hud.toast('ROADBLOCK AHEAD — the PD sealed the street!');
    } else if (stars < TUNE.police.roadblockAtStars && this.roadblock.length > 0) {
      for (const c of [...this.roadblock]) w.drive.removeCar(c);
      this.roadblock = [];
    }
    // --- cops chase, shoot, and (on foot) arrest. ---
    let arresting = false;
    for (const cop of [...this.cops]) {
      if (cop.health <= 0) {
        w.fx.explosion(cop.x, 1, cop.z);
        w.sfx.explosion();
        this.removeCop(cop);
        this.addWanted(1);
        w.hud.toast('You took out a patrol car — heat rising!');
        continue;
      }
      const dx = w.player.x - cop.x;
      const dz = w.player.z - cop.z;
      const d = Math.hypot(dx, dz);
      const heading = Math.atan2(dx, dz);
      // Light bar flash.
      const flip = Math.floor(performance.now() / 260) % 2 === 0;
      if (cop.mesh.userData.lightBarA) cop.mesh.userData.lightBarA.visible = flip;
      if (cop.mesh.userData.lightBarB) cop.mesh.userData.lightBarB.visible = !flip;
      if (d > 2.0) {
        w.drive.stepCar(cop, dt, heading, 1);
      } else {
        // On top of the player: hold still (the arrest happens below).
        cop.vx *= Math.exp(-dt * 4);
        cop.vz *= Math.exp(-dt * 4);
        cop.x += cop.vx * dt;
        cop.z += cop.vz * dt;
        cop.mesh.position.set(cop.x, 0, cop.z);
      }
      // Cops shoot at a player on foot from three stars up.
      cop.shootTimer -= dt;
      if (stars >= 3 && !w.player.inCar && cop.shootTimer <= 0 && d < 32 && !w.ended) {
        cop.shootTimer = 1.3 + Math.random() * 0.6;
        w.fx.muzzle(cop.x + Math.sin(heading) * 1.5, 1.4, cop.z + Math.cos(heading) * 1.5, heading);
        w.sfx.shot();
        if (Math.random() < 0.22) {
          const died = w.walker.damage(TUNE.police.copDamage);
          w.hud.toast('A cop winged you!');
          if (died) w.endGame('wasted', 'The Solmar PD does not miss twice.');
        }
      }
      // Arrest: on foot, an officer within bust radius holds the player.
      if (!w.player.inCar && d <= TUNE.police.bustRadius && !w.ended) {
        arresting = true;
      }
    }
    if (arresting) {
      this.arrestTimer += dt;
      if (this.arrestTimer === dt || Math.floor(this.arrestTimer) !== Math.floor(this.arrestTimer - dt)) {
        w.hud.toast(`An officer has you — ${Math.max(0, TUNE.police.arrestHoldSeconds - this.arrestTimer).toFixed(1)}s to break away!`);
      }
      if (this.arrestTimer >= TUNE.police.arrestHoldSeconds) {
        this.arrestTimer = 0;
        w.endGame('busted', 'The Solmar PD booked you. Bail was not cheap.');
      }
    } else {
      this.arrestTimer = 0;
    }
  }
}
