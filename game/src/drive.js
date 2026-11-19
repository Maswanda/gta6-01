// Cars: arcade physics, drift, enter/exit, mesh sync.
// A car is plain data + a mesh; the world owns the list (world.allCars).
import * as THREE from 'three';
import { T } from './tuning.js';

let nextCarId = 1;

export function makeCar(world, kind, x, z, heading = 0, color = 0x888888) {
  const car = {
    id: nextCarId++,
    kind,
    pos: new THREE.Vector3(x, 0, z),
    heading,
    speed: 0,
    maxSpeed: kind === 'sports' ? T.sportsMaxSpeed : T.carMaxSpeed,
    alive: true,
    isPolice: kind === 'police',
    hp: 100,
    drifting: false,
    mesh: null,
    color,
  };
  car.mesh = world.scene.makeCarMesh(car);
  car.syncMesh = function () {
    if (!car.mesh) return;
    car.mesh.position.set(car.pos.x, 0.4, car.pos.z);
    car.mesh.rotation.y = -car.heading;
  };
  car.syncMesh();
  return car;
}

export class DriveSys {
  constructor(world) {
    this.world = world;
  }

  // One physics step for a car under input axes. Returns drift state.
  stepCar(car, dt, throttle, steer) {
    if (!car.alive) return;
    const w = this.world;
    const maxFwd = car.maxSpeed;
    if (throttle > 0) {
      car.speed += T.carAccel * dt * throttle;
      if (car.speed > maxFwd) car.speed = maxFwd;
    } else if (throttle < 0) {
      if (car.speed > 0.5) car.speed -= T.carBrake * dt;
      else {
        car.speed -= T.carAccel * 0.7 * dt;
        if (car.speed < -T.carReverseMax) car.speed = -T.carReverseMax;
      }
    } else {
      // Coast down.
      car.speed -= Math.sign(car.speed) * 8 * dt;
      if (Math.abs(car.speed) < 0.2) car.speed = 0;
    }
    const spd = Math.abs(car.speed);
    const turning = steer !== 0 && spd > 0.5;
    if (turning) {
      const dir = car.speed >= 0 ? 1 : -1;
      car.heading += steer * T.steerRate * dt * dir * Math.min(1, spd / 10);
    }
    // Drift: fast + hard steering.
    car.drifting = spd > T.driftSpeed && steer !== 0;
    if (car.drifting) {
      // Lateral slide: bleed a little sideways velocity into the heading.
      car.heading += steer * 0.35 * dt;
    }
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    let nx = car.pos.x + fx * car.speed * dt;
    let nz = car.pos.z + fz * car.speed * dt;
    const hit = w.city.resolveCollision(nx, nz, 2.2);
    if (hit.hit) {
      car.speed *= 0.45;
    }
    nx = hit.x;
    nz = hit.z;
    const clamped = w.city.clampToMap(nx, nz);
    car.pos.set(clamped.x, 0, clamped.z);
    car.syncMesh();
  }

  enterCar(player, car) {
    if (!car || !car.alive || car.isPolice) return false;
    player.inCar = car;
    player.pos.copy(car.pos);
    return true;
  }

  exitCar(player) {
    const car = player.inCar;
    if (!car) return false;
    player.inCar = null;
    // Step out to the left of the car.
    const lx = car.pos.x + Math.cos(car.heading) * 3;
    const lz = car.pos.z - Math.sin(car.heading) * 3;
    const spot = this.world.city.resolveCollision(lx, lz, 1);
    player.pos.set(spot.x, 0, spot.z);
    player.heading = car.heading;
    return true;
  }

  nearestCar(x, z, maxDist = 8, excludePolice = true) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.world.allCars) {
      if (!car.alive) continue;
      if (excludePolice && car.isPolice) continue;
      const d = Math.hypot(car.pos.x - x, car.pos.z - z);
      if (d < bestD) {
        best = car;
        bestD = d;
      }
    }
    return best;
  }

  nearestSportsCar(x, z, maxDist = 60) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.world.allCars) {
      if (!car.alive || car.kind !== 'sports') continue;
      const d = Math.hypot(car.pos.x - x, car.pos.z - z);
      if (d < bestD) {
        best = car;
        bestD = d;
      }
    }
    return best;
  }
}
