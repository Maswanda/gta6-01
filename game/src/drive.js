// Arcade car physics: accel/brake/steer with drift (Space), building collision,
// car-vs-car bumps. One car = {id, kind, x, z, heading, speed, hp, driver, color}.
import { CAR, STEP } from './tuning.js';
import { collideCircle } from './city.js';

let nextCarId = 1;

export function createCar(kind, x, z, heading, driver) {
  const spec = CAR.kinds[kind] ?? CAR.kinds.sedan;
  return {
    id: nextCarId, kind, x, z, heading, speed: 0,
    hp: spec.hp, maxHp: spec.hp, driver: driver || 'none',
    color: spec.color, steerVis: 0,
  };
}
export function resetCarIds() { nextCarId = 1; }

// input: {steer -1..1, throttle -1..1, drift bool}. Returns nothing; mutates car.
export function stepCar(world, car, input, dt) {
  const spec = CAR.kinds[car.kind];
  const grip = input.drift ? CAR.driftGrip : CAR.grip;
  const targetSpeed = input.throttle >= 0
    ? input.throttle * spec.maxSpeed
    : input.throttle * CAR.reverseMax;
  const accelRate = input.throttle >= 0 ? CAR.accel : CAR.brake;
  if (car.speed < targetSpeed) car.speed = Math.min(targetSpeed, car.speed + accelRate * dt);
  else car.speed = Math.max(targetSpeed, car.speed - CAR.brake * dt);
  // Steering scales with speed; drift lets the tail step out.
  const steerAmount = input.steer * CAR.steer * Math.min(1, Math.abs(car.speed) / 10) * (car.speed >= 0 ? 1 : -1);
  car.heading += steerAmount * dt * (input.drift ? 1.35 : 1);
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const hit = collideCircle(world.city, nx, nz, 2.0);
  if (hit.hit) {
    // Scrape along the wall: keep the tangential component, kill the rest.
    car.speed *= 0.55;
    car.hp = Math.max(0, car.hp - Math.abs(car.speed) * 0.02);
  }
  car.x = hit.x; car.z = hit.z;
  car.steerVis = input.steer;
}

// Simple circle-vs-circle bump between two cars (push apart + damage on hard hits).
export function bumpCars(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.01 || d > 4.6) return 0;
  const push = (4.6 - d) / 2;
  const nx = dx / d, nz = dz / d;
  a.x -= nx * push; a.z -= nz * push;
  b.x += nx * push; b.z += nz * push;
  const impact = Math.abs(a.speed - b.speed);
  if (impact > 12) {
    a.hp = Math.max(0, a.hp - impact * 0.25);
    b.hp = Math.max(0, b.hp - impact * 0.25);
    return impact;
  }
  return 0;
}

// Nearest car within radius of (x,z), optionally filtered by driver.
export function nearestCar(world, x, z, radius, driver) {
  let best = null, bestD = radius;
  for (const car of world.cars) {
    if (car.hp <= 0) continue; // a wreck is not a car anyone can enter or chase
    if (driver && car.driver !== driver) continue;
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}
