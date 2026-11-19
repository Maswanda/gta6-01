// GarageSystem + Safehouse: buy/sell vehicles with cash (owned vehicles persist
// in the save), pick a ride, and the safehouse heals + clears one wanted star.
// The garage is a real place (Rico's Garage landmark); standing in its yard opens it.
import { CAR, GARAGE } from './tuning.js';
import { createCar } from './drive.js';
import { sfx } from './audio.js';

export function garageState(world) {
  const p = world.player;
  const g = world.city.landmarks.garage;
  const d = Math.hypot(p.x - g.x, p.z - g.z);
  return { near: d < 26, dist: d };
}

export function buyVehicle(world, kind) {
  const p = world.player;
  const spec = CAR.kinds[kind];
  if (!spec) return false;
  if (world.owned.includes(kind)) return false;
  if (p.cash < spec.price) return false;
  p.cash -= spec.price;
  world.owned.push(kind);
  sfx.cash();
  world.feed.push(`You bought the ${spec.label} for $${spec.price}.`);
  return true;
}

export function sellVehicle(world, kind) {
  const p = world.player;
  const spec = CAR.kinds[kind];
  if (!spec || kind === 'sedan') return false;
  const i = world.owned.indexOf(kind);
  if (i === -1) return false;
  world.owned.splice(i, 1);
  const back = Math.floor(spec.price * 0.6);
  p.cash += back;
  sfx.cash();
  world.feed.push(`You sold the ${spec.label} for $${back}.`);
  return true;
}

// Spawn the chosen ride at the garage. Returns the car.
export function pickRide(world, kind) {
  const g = world.city.landmarks.garage;
  const car = createCar(kind, g.x + 12, g.z + 6, Math.PI / 2, 'none');
  world.cars.push(car);
  world.feed.push(`Your ${CAR.kinds[kind].label} is ready at Rico's Garage.`);
  return car;
}

// Safehouse: heal + clear one wanted star when the player stands in its yard.
export function stepSafehouse(world, dt) {
  const p = world.player;
  const sh = world.city.landmarks.safehouse;
  const d = Math.hypot(p.x - sh.x, p.z - sh.z);
  if (d < 26) {
    world.safeTimer = (world.safeTimer || 0) + dt;
    if (world.safeTimer > 2) {
      world.safeTimer = 0;
      if (p.hp < 100) { p.hp = Math.min(100, p.hp + 25); }
      if ((p.heat || 0) > 0) {
        p.heat = Math.max(0, p.heat - 1);
        world.feed.push('Safehouse — one star cleared.');
      }
    }
  } else {
    world.safeTimer = 0;
  }
}
