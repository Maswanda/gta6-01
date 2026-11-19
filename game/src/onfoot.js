// On-foot movement: walk/run, building collision, enter/exit cars.
import { PLAYER } from './tuning.js';
import { collideCircle } from './city.js';
import { nearestCar } from './drive.js';

// input: {steer -1..1 (strafe/turn), throttle -1..1 (forward/back), run bool}.
// On foot, steering turns the player; throttle moves forward/back.
export function stepOnFoot(world, dt, input) {
  const p = world.player;
  p.heading += input.steer * 2.6 * dt;
  const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const move = input.throttle * speed;
  const nx = p.x + Math.sin(p.heading) * move * dt;
  const nz = p.z + Math.cos(p.heading) * move * dt;
  const hit = collideCircle(world.city, nx, nz, 0.8);
  p.x = hit.x; p.z = hit.z;
  p.speed = Math.abs(move);
}

// Try to enter the nearest empty car. Returns the car or null.
export function tryEnterCar(world) {
  const p = world.player;
  const car = nearestCar(world, p.x, p.z, PLAYER.enterCarRadius, 'none');
  if (!car) return null;
  car.driver = 'player';
  p.inCar = car.id;
  p.x = car.x; p.z = car.z; p.heading = car.heading;
  return car;
}

export function exitCar(world) {
  const p = world.player;
  const car = world.cars.find((c) => c.id === p.inCar);
  if (!car) { p.inCar = null; return; }
  car.driver = 'none';
  car.speed = 0;
  p.inCar = null;
  p.x = car.x - Math.sin(car.heading + Math.PI / 2) * 3;
  p.z = car.z - Math.cos(car.heading + Math.PI / 2) * 3;
  p.heading = car.heading;
  const hit = collideCircle(world.city, p.x, p.z, 0.8);
  p.x = hit.x; p.z = hit.z;
}
