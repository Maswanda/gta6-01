// The wanted system v2: stars rise when the player breaks the law, and the
// response escalates with them — more interceptors, faster cars, harder
// rams, and at four stars a roadblock goes up on the street ahead. Lay low
// out of sight and the heat cools off one star at a time.
import { CFG, STREET_LINES } from './config.js';
import { Car } from './vehicles.js';

export class Police {
  constructor(scene) {
    this.scene = scene;
    this.wanted = 0;
    this.cars = [];
    this.heatTimer = 0;
    this.decayTimer = 0;
    this.bustTimer = 0;
    this.busted = false;
    this.roadblock = null;
  }

  addWanted(n, world) {
    const before = this.wanted;
    this.wanted = Math.max(0, Math.min(CFG.maxWanted, this.wanted + n));
    this.decayTimer = 0;
    if (this.wanted > before) {
      world.hud.flashMessage(this.wanted >= 3 ? 'HEAT IS ON — lose the cops!' : 'Wanted level up!');
      world.sound.sting();
      world.sound.siren(true, 0);
    }
    this.syncCars(world);
  }

  clearWanted() {
    this.wanted = 0;
    this.bustTimer = 0;
    for (const c of this.cars) c.remove();
    this.cars = [];
    this.clearRoadblock();
  }

  // How many interceptors a wanted level fields, and how fast they are.
  wantedTuning() {
    const w = this.wanted;
    return {
      count: w === 0 ? 0 : Math.min(4, w + 1),
      topSpeed: CFG.policeTopSpeed + (w - 1) * 1.6,
      ram: w >= 4 ? 1.5 : 1,
    };
  }

  syncCars(world) {
    const tune = this.wantedTuning();
    while (this.cars.length < tune.count) {
      const p = world.player.inCar ? world.player.inCar.pos : world.player.pos;
      const angle = Math.random() * Math.PI * 2;
      const x = p.x + Math.sin(angle) * 70;
      const z = p.z + Math.cos(angle) * 70;
      const car = new Car(this.scene, x, z, Math.atan2(p.x - x, p.z - z), 0x1a1a22, { police: true });
      car.targetSpeed = tune.topSpeed;
      car.topSpeedOverride = tune.topSpeed;
      this.cars.push(car);
      world.allCars.push(car);
    }
    while (this.cars.length > tune.count) {
      const c = this.cars.pop();
      c.remove();
      const i = world.allCars.indexOf(c);
      if (i >= 0) world.allCars.splice(i, 1);
    }
    if (this.wanted >= CFG.roadblockWanted) this.ensureRoadblock(world);
    else this.clearRoadblock();
  }

  // Two interceptors parked across the street ahead of the player, about
  // 70u up the player's line of travel — so the block is something to
  // out-drive, not something the player has already passed.
  ensureRoadblock(world) {
    if (this.roadblock) return;
    const p = world.player.inCar ? world.player.inCar.pos : world.player.pos;
    const heading = world.player.inCar ? world.player.inCar.heading : world.player.heading;
    const f = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    const ahead = p.clone().addScaledVector(f, CFG.roadblockAhead);
    // Snap to the nearest street line so the block sits on a road.
    let bestLine = STREET_LINES[0];
    let bestD = Infinity;
    for (const line of STREET_LINES) {
      const d = Math.min(Math.abs(ahead.x - line), Math.abs(ahead.z - line));
      if (d < bestD) { bestD = d; bestLine = line; }
    }
    const onX = Math.abs(ahead.x - bestLine) < Math.abs(ahead.z - bestLine);
    const cars = [];
    for (const off of [-4, 4]) {
      const x = onX ? bestLine + off : ahead.x + (off > 0 ? 4 : -4);
      const z = onX ? ahead.z + (off > 0 ? 4 : -4) : bestLine + off;
      const car = new Car(this.scene, x, z, onX ? 0 : Math.PI / 2, 0x1a1a22, { police: true, parked: true });
      car.speed = 0;
      cars.push(car);
      world.allCars.push(car);
    }
    this.roadblock = { cars, x: ahead.x, z: ahead.z };
    world.hud.flashMessage('Roadblock ahead — go around it!');
    world.sound.sting();
  }

  clearRoadblock() {
    if (!this.roadblock) return;
    for (const c of this.roadblock.cars) c.remove();
    this.roadblock = null;
  }

  update(dt, world) {
    const player = world.player;
    const playerPos = player.inCar ? player.inCar.pos : player.pos;
    const playerSpeed = player.inCar ? Math.abs(player.inCar.speed) : player.speed;
    if (this.wanted > 0) {
      this.decayTimer += dt;
      const nearest = this.nearestDistance(playerPos);
      // Hidden means no cop can see the player: further than the hidden
      // radius — 45u on foot or in a car, 75u while crouched. Heat cools
      // off in 14s when hidden, not 26s, so losing the tail matters.
      const hiddenRadius = player.crouching ? CFG.hiddenRadiusCrouched : CFG.hiddenRadius;
      const hidden = nearest === null || nearest > hiddenRadius;
      if (hidden && this.decayTimer > CFG.wantedDecayHiddenSeconds) {
        this.wanted -= 1;
        this.decayTimer = 0;
        world.hud.flashMessage('Heat cooling off…');
        this.syncCars(world);
      }
    }
    world.sound.siren(this.cars.length > 0, dt);
    const tune = this.wantedTuning();
    let nearest = null;
    for (const c of this.cars) {
      if (!c.alive) continue;
      const dx = playerPos.x - c.pos.x;
      const dz = playerPos.z - c.pos.z;
      const dist = Math.hypot(dx, dz);
      if (nearest === null || dist < nearest) nearest = dist;
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, dh * 1.4));
      const throttle = dist > 6 ? 1 : 0.4;
      // The interceptor's top speed follows the wanted level.
      const res = c.drive(throttle, steer, dt, world.colliders, world.allCars);
      if (res && res.crashed) world.sound.crash();
      if (dist < 3.4 && Math.abs(c.speed) > 6) {
        const dmg = Math.round(6 * tune.ram);
        if (player.inCar) {
          player.inCar.speed *= 0.55;
          player.damage(dmg);
        } else {
          player.damage(dmg + 4);
        }
        c.speed *= 0.4;
        world.effects.sparks(c.pos.clone().setY(1));
      }
      const bar = c.mesh.getObjectByName('lightbar');
      if (bar) {
        bar.material.emissive.setHex(Math.floor(performance.now() / 260) % 2 === 0 ? 0xff2222 : 0x2244ff);
      }
    }
    // A roadblock too far behind the player, or one the player has turned
    // away from, is lifted and re-laid ahead of the new line of travel.
    if (this.roadblock) {
      const d = Math.hypot(playerPos.x - this.roadblock.x, playerPos.z - this.roadblock.z);
      const heading = player.inCar ? player.inCar.heading : player.heading;
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      const dx = this.roadblock.x - playerPos.x;
      const dz = this.roadblock.z - playerPos.z;
      const dl = Math.hypot(dx, dz) || 1;
      const aheadDot = (dx / dl) * fx + (dz / dl) * fz;
      if (d > 120 || aheadDot < 0.3) {
        this.clearRoadblock();
        this.ensureRoadblock(world);
      }
    }
    if (this.wanted > 0 && nearest !== null && nearest < CFG.bustDistance && playerSpeed < 1.5) {
      this.bustTimer += dt;
      if (this.bustTimer > CFG.bustedHoldSeconds) {
        this.busted = true;
        this.bustTimer = 0;
      }
    } else {
      this.bustTimer = 0;
    }
  }

  nearestDistance(pos) {
    let best = null;
    for (const c of this.cars) {
      if (!c.alive) continue;
      const d = Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z);
      if (best === null || d < best) best = d;
    }
    return best;
  }
}
