// The wanted system: stars rise when the player breaks the law, police
// interceptors spawn at the city edge and chase, and standing still next to
// one for too long gets Jax busted. Lay low and the heat cools off.
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
  }

  addWanted(n, world) {
    const before = this.wanted;
    this.wanted = Math.max(0, Math.min(CFG.maxWanted, this.wanted + n));
    this.decayTimer = 0;
    if (this.wanted > before) {
      world.hud.flashMessage(this.wanted >= 3 ? 'HEAT IS ON — lose the cops!' : 'Wanted level up!');
      world.sound.siren(true, 0);
    }
    this.syncCars(world);
  }

  clearWanted() {
    this.wanted = 0;
    this.bustTimer = 0;
    for (const c of this.cars) c.remove();
    this.cars = [];
  }

  syncCars(world) {
    const want = this.wanted === 0 ? 0 : Math.min(4, this.wanted + 1);
    while (this.cars.length < want) {
      const p = world.player.inCar ? world.player.inCar.pos : world.player.pos;
      const angle = Math.random() * Math.PI * 2;
      const x = p.x + Math.sin(angle) * 70;
      const z = p.z + Math.cos(angle) * 70;
      const car = new Car(this.scene, x, z, Math.atan2(p.x - x, p.z - z), 0x1a1a22, { police: true });
      car.targetSpeed = CFG.policeTopSpeed;
      this.cars.push(car);
      world.allCars.push(car);
    }
    while (this.cars.length > want) {
      const c = this.cars.pop();
      c.remove();
      const i = world.allCars.indexOf(c);
      if (i >= 0) world.allCars.splice(i, 1);
    }
  }

  update(dt, world) {
    const player = world.player;
    const playerPos = player.inCar ? player.inCar.pos : player.pos;
    const playerSpeed = player.inCar ? Math.abs(player.inCar.speed) : player.speed;
    // Heat cools off when the player stays clean and out of sight.
    if (this.wanted > 0) {
      this.decayTimer += dt;
      const nearest = this.nearestDistance(playerPos);
      if (this.decayTimer > CFG.wantedDecaySeconds && (nearest === null || nearest > 45)) {
        this.wanted -= 1;
        this.decayTimer = 0;
        world.hud.flashMessage('Heat cooling off…');
        this.syncCars(world);
      }
    }
    // Siren while any police are out.
    world.sound.siren(this.cars.length > 0, dt);
    // Chase: steer toward the player, ram, and hold them for a bust.
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
      const res = c.drive(throttle, steer, dt, world.colliders, world.allCars);
      if (res && res.crashed) world.sound.crash();
      // Ram damage when the interceptor slams the player.
      if (dist < 3.4 && Math.abs(c.speed) > 6) {
        if (player.inCar) {
          player.inCar.speed *= 0.55;
          player.damage(6);
        } else {
          player.damage(10);
        }
        c.speed *= 0.4;
      }
      // Flash the light bar.
      const bar = c.mesh.getObjectByName('lightbar');
      if (bar) {
        bar.material.emissive.setHex(Math.floor(performance.now() / 260) % 2 === 0 ? 0xff2222 : 0x2244ff);
      }
    }
    // Bust: slow and cornered next to a cruiser.
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
