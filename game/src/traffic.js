// Traffic: 12 ambient cars cruising the road grid + 28 wandering peds.
// They keep the city alive; they never block a mission (they yield by slowing).
import { createCar, stepCar } from './drive.js';
import { randomRoadPoint, nearestRoadPoint, collideCircle } from './city.js';

export function spawnTraffic(world) {
  for (let i = 0; i < 12; i += 1) {
    const pt = randomRoadPoint(world.rng);
    const kind = world.rng.pick(['sedan', 'sedan', 'taxi', 'truck', 'sport']);
    const car = createCar(kind, pt.x, pt.z, world.rng.range(0, Math.PI * 2), 'traffic');
    car.speed = world.rng.range(8, 16);
    world.cars.push(car);
  }
  for (let i = 0; i < 28; i += 1) {
    const pt = randomRoadPoint(world.rng);
    world.peds.push({
      id: i + 1, x: pt.x, z: pt.z,
      heading: world.rng.range(0, Math.PI * 2),
      speed: world.rng.range(1, 2.4),
      color: [0xc04040, 0x4080c0, 0x40a060, 0xc0a040, 0x8040a0, 0x606060][i % 6],
      wander: world.rng.range(2, 8),
    });
  }
}

export function stepTraffic(world, dt) {
  const p = world.player;
  for (const car of world.cars) {
    if (car.driver !== 'traffic') continue;
    if (car.hp <= 0) continue;
    // Cruise along the road: steer toward the nearest road line, slow near the player.
    const dPlayer = Math.hypot(car.x - p.x, car.z - p.z);
    const target = dPlayer < 14 ? 0 : 1;
    const pt = nearestRoadPoint(car.x + Math.sin(car.heading) * 20, car.z + Math.cos(car.heading) * 20);
    const wantHeading = Math.atan2(pt.x - car.x, pt.z - car.z);
    let dh = wantHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, dh * 2));
    stepCar(world, car, { steer, throttle: target, drift: false }, dt);
    if (Math.random() < dt * 0.05) {
      car.heading += (Math.random() - 0.5) * 0.6; // occasional lane change
    }
  }
  // Remove wrecked traffic cars, respawn fresh ones far away.
  const before = world.cars.length;
  world.cars = world.cars.filter((c) => c.driver !== 'traffic' || c.hp > 0);
  if (world.cars.length < before) {
    const pt = randomRoadPoint(world.rng);
    const car = createCar('sedan', pt.x, pt.z, world.rng.range(0, Math.PI * 2), 'traffic');
    car.speed = 10;
    world.cars.push(car);
  }
  for (const ped of world.peds) {
    ped.wander -= dt;
    if (ped.wander <= 0) {
      ped.wander = world.rng.range(2, 8);
      ped.heading = world.rng.range(0, Math.PI * 2);
    }
    const nx = ped.x + Math.sin(ped.heading) * ped.speed * dt;
    const nz = ped.z + Math.cos(ped.heading) * ped.speed * dt;
    const hit = collideCircle(world.city, nx, nz, 0.6);
    ped.x = hit.x; ped.z = hit.z;
    if (hit.hit) ped.heading += Math.PI / 2;
  }
}
