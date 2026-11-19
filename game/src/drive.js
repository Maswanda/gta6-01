// drive.js — Solmar Bay: arcade car physics, entry and exit.
// A car is a velocity vector, not just a speed: the heading turns and
// the velocity follows it through grip, so the handbrake really drifts.
// Collisions are circle-vs-building-box, pushed out along the shallow axis.
import { TUNE } from './tuning.js';

export class CarRig {
  constructor(world) {
    this.world = world;
  }
  createCar(type, x, z, heading, opts = {}) {
    const spec = TUNE.cars[type] || TUNE.cars.sedan;
    const mesh = opts.cop ? this.world.stage.makeCopCar() : this.world.stage.makeCar(spec.color, type);
    const car = {
      type,
      label: spec.label,
      top: spec.top,
      accel: spec.accel,
      grip: spec.grip,
      color: spec.color,
      x, z, heading,
      vx: 0, vz: 0,
      speed: 0,
      health: 100,
      mesh,
      isCop: !!opts.cop,
      isTraffic: !!opts.traffic,
      isPlayer: false,
      dead: false,
    };
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    this.world.cars.push(car);
    return car;
  }
  removeCar(car) {
    const i = this.world.cars.indexOf(car);
    if (i >= 0) this.world.cars.splice(i, 1);
    this.world.stage.scene.remove(car.mesh);
  }
  // --- player driving -----------------------------------------------------
  updatePlayerCar(dt) {
    const p = this.world.player;
    const car = p.inCar;
    if (!car) return;
    const input = this.world.input;
    const fwd = input.moveY(); // W/S
    const steer = input.moveX(); // A/D
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    const speed = Math.hypot(car.vx, car.vz);
    const forwardSpeed = car.vx * fx + car.vz * fz;
    // Steering: stronger at speed, reversed when reversing.
    const steerRate = 2.3 * Math.min(1, Math.abs(forwardSpeed) / 10 + 0.25);
    car.heading += steer * steerRate * dt * (forwardSpeed >= 0 ? 1 : -1) * (input.handbrake ? 1.5 : 1);
    const nfx = Math.sin(car.heading);
    const nfz = Math.cos(car.heading);
    // Engine force along the new heading.
    if (fwd > 0) {
      car.vx += nfx * car.accel * dt;
      car.vz += nfz * car.accel * dt;
    } else if (fwd < 0) {
      if (forwardSpeed > 0.5) {
        // Brake.
        car.vx -= nfx * car.accel * 1.4 * dt;
        car.vz -= nfz * car.accel * 1.4 * dt;
      } else {
        // Reverse.
        car.vx -= nfx * car.accel * 0.55 * dt;
        car.vz -= nfz * car.accel * 0.55 * dt;
      }
    }
    // Grip: split velocity into forward and lateral; lateral decays by grip.
    const fSpeed = car.vx * nfx + car.vz * nfz;
    let lx = car.vx - nfx * fSpeed;
    let lz = car.vz - nfz * fSpeed;
    const grip = car.grip * (input.handbrake ? 0.35 : 1);
    const damp = Math.exp(-dt * (2.2 + grip * 6));
    lx *= damp;
    lz *= damp;
    car.vx = nfx * fSpeed + lx;
    car.vz = nfz * fSpeed + lz;
    // Cap speed.
    const sp = Math.hypot(car.vx, car.vz);
    const cap = fSpeed >= 0 ? car.top : car.top / 3;
    if (sp > cap) {
      car.vx *= cap / sp;
      car.vz *= cap / sp;
    }
    // Rolling drag when coasting.
    if (fwd === 0) {
      const d = Math.exp(-dt * 0.7);
      car.vx *= d;
      car.vz *= d;
    }
    car.x += car.vx * dt;
    car.z += car.vz * dt;
    this.collideBuildings(car, 2.3);
    this.collideCars(car);
    const c = this.clampCity(car.x, car.z);
    car.x = c.x;
    car.z = c.z;
    car.speed = Math.hypot(car.vx, car.vz);
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    // Wheel spin + skid marks + engine hum.
    const spin = car.speed * dt * 2.4;
    for (const w of car.mesh.userData.wheels || []) w.rotation.x += spin;
    if (input.handbrake && car.speed > 8) {
      this.world.fx.skid(car.x - nfx * 1.6, car.z - nfz * 1.6, car.heading);
      if (Math.random() < dt * 8) this.world.sfx.noise(0.08, 0.05, 1800);
    }
    this.world.sfx.setEngine(Math.min(1, car.speed / car.top));
    p.x = car.x;
    p.z = car.z;
    p.heading = car.heading;
    p.speed = car.speed;
  }
  // --- generic car motion (traffic, cops) ----------------------------------
  stepCar(car, dt, targetHeading, throttle) {
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    // Turn toward the target heading.
    let diff = targetHeading - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.heading += Math.max(-2.0 * dt, Math.min(2.0 * dt, diff));
    const nfx = Math.sin(car.heading);
    const nfz = Math.cos(car.heading);
    const want = throttle * car.top * 0.7;
    const fSpeed = car.vx * nfx + car.vz * nfz;
    const acc = fSpeed < want ? car.accel * 0.7 : -car.accel;
    car.vx += nfx * acc * dt;
    car.vz += nfz * acc * dt;
    // Grip.
    const fs2 = car.vx * nfx + car.vz * nfz;
    let lx = car.vx - nfx * fs2;
    let lz = car.vz - nfz * fs2;
    const damp = Math.exp(-dt * 7);
    lx *= damp;
    lz *= damp;
    car.vx = nfx * fs2 + lx;
    car.vz = nfz * fs2 + lz;
    car.x += car.vx * dt;
    car.z += car.vz * dt;
    this.collideBuildings(car, 2.3);
    const c = this.clampCity(car.x, car.z);
    car.x = c.x;
    car.z = c.z;
    car.speed = Math.hypot(car.vx, car.vz);
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    const spin = car.speed * dt * 2.4;
    for (const w of car.mesh.userData.wheels || []) w.rotation.x += spin;
  }
  // --- collisions -----------------------------------------------------------
  collideBuildings(car, r) {
    const layout = this.world.layout;
    for (const b of layout.buildings) {
      const dx = car.x - b.x;
      const dz = car.z - b.z;
      const hw = b.w / 2 + r;
      const hd = b.d / 2 + r;
      if (Math.abs(dx) > hw || Math.abs(dz) > hd) continue;
      // Push out along the shallow axis.
      const px = hw - Math.abs(dx);
      const pz = hd - Math.abs(dz);
      if (px < pz) {
        car.x = b.x + (dx > 0 ? hw : -hw);
        car.vx *= -0.25;
      } else {
        car.z = b.z + (dz > 0 ? hd : -hd);
        car.vz *= -0.25;
      }
      const impact = Math.hypot(car.vx, car.vz);
      if (impact > 12) {
        car.health -= (impact - 12) * 0.4;
        this.world.fx.burst(car.x, 1, car.z, 0xffd76a, 6, 7, 0.4, 5);
        this.world.sfx.noise(0.15, 0.25, 1200);
      }
      car.vx *= 0.6;
      car.vz *= 0.6;
    }
    for (const l of layout.landmarks) {
      if (l.kind !== 'tower' && l.kind !== 'lighthouse' && l.kind !== 'observatory') continue;
      const dx = car.x - l.x;
      const dz = car.z - l.z;
      const rr = 8 + r;
      const d = Math.hypot(dx, dz);
      if (d < rr && d > 0.01) {
        car.x = l.x + (dx / d) * rr;
        car.z = l.z + (dz / d) * rr;
        car.vx *= 0.5;
        car.vz *= 0.5;
      }
    }
  }
  collideCars(car) {
    for (const other of this.world.cars) {
      if (other === car || other.dead) continue;
      const dx = car.x - other.x;
      const dz = car.z - other.z;
      const d = Math.hypot(dx, dz);
      if (d < 4.4 && d > 0.01) {
        const push = (4.4 - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        car.x += nx * push;
        car.z += nz * push;
        other.x -= nx * push;
        other.z -= nz * push;
        const rel = Math.abs(car.speed - other.speed);
        if (rel > 10) {
          car.health -= 2;
          other.health -= 2;
          this.world.fx.burst((car.x + other.x) / 2, 1, (car.z + other.z) / 2, 0xffd76a, 5, 6, 0.35, 5);
          this.world.sfx.noise(0.12, 0.2, 1400);
        }
        car.vx *= 0.7;
        car.vz *= 0.7;
      }
    }
  }
  clampCity(x, z) {
    const h = this.world.layout.half - 6;
    return { x: Math.max(-h, Math.min(h, x)), z: Math.max(-h, Math.min(h, z)) };
  }
  // --- entry / exit ---------------------------------------------------------
  nearestCar(x, z, maxD = 6) {
    let best = null;
    let bestD = maxD;
    for (const car of this.world.cars) {
      if (car.dead || car.isCop) continue;
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }
  enterCar(car) {
    const p = this.world.player;
    p.inCar = car;
    car.isPlayer = true;
    p.mesh.visible = false;
    this.world.sfx.click();
    return car;
  }
  exitCar() {
    const p = this.world.player;
    const car = p.inCar;
    if (!car) return;
    car.isPlayer = false;
    car.vx *= 0.2;
    car.vz *= 0.2;
    p.inCar = null;
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    p.x = car.x - fz * 3.2;
    p.z = car.z + fx * 3.2;
    p.heading = car.heading;
    p.mesh.visible = true;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    this.world.sfx.setEngine(0);
  }
}
