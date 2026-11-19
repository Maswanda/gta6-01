// Screenshot scenes behind ?shot=showcase|heli|combat|garage.
// Each stages a REAL game state (real rules, real HUD) from a fresh world, then the
// main loop paints it and sets document.title = 'SHOT_READY' for the capture.
// The four shots prove four different things: world, heli pursuit, combat, garage.
import { createCar } from './drive.js';
import { spawnEnemies } from './combat.js';
import { startMission } from './missions.js';

function frameCam(world, px, pz, dist, height, heading) {
  const bx = px - Math.sin(heading) * dist;
  const bz = pz - Math.cos(heading) * dist;
  world.shotCam = { x: bx, y: height, z: bz, lx: px, ly: 2, lz: pz };
}

function putPlayerInCar(world, kind, x, z, heading) {
  const car = createCar(kind, x, z, heading, 'player');
  world.cars.push(car);
  const p = world.player;
  p.inCar = car.id;
  p.x = x; p.z = z; p.heading = heading;
  return car;
}

export function stageShot(world, name) {
  const p = world.player;
  // Fresh, deterministic state for every shot.
  world.enemies = [];
  world.bullets = [];
  world.particles = [];
  world.cars = world.cars.filter((c) => c.driver === 'traffic');
  world.heli.active = false;
  world.shotCam = null;

  if (name === 'heli') {
    // Night Vice Beach, 4 red wanted stars, helicopter spotlight overhead.
    world.dayTime = 0.75 * 240;
    p.wanted = 4; p.heat = 4;
    p.cash = 12400;
    putPlayerInCar(world, 'sport', 320, -320, Math.PI * 0.6);
    world.heli.active = true;
    world.heli.x = 320; world.heli.z = -340; world.heli.y = 55;
    world.heli.heading = 0;
    world.missions.index = 10;
    world.missions.title = 'Air Support';
    startMission(world, 10);
    frameCam(world, 320, -320, 34, 20, Math.PI * 0.6);
    return;
  }
  if (name === 'combat') {
    // Dusk Vice Beach, mission 3, shotgun out, Bay Kings in front of the player.
    world.dayTime = 0.5 * 240;
    p.wanted = 2; p.heat = 2;
    p.cash = 3850;
    p.weapon = 'shotgun';
    putPlayerInCar(world, 'sedan', 280, -260, Math.PI * 0.25);
    spawnEnemies(world, 'gang', 3, 300, -240, world.rng);
    world.missions.index = 2;
    world.missions.title = 'First Blood';
    startMission(world, 2);
    frameCam(world, 290, -250, 30, 16, Math.PI * 0.25);
    return;
  }
  if (name === 'garage') {
    // Daytime Marina, Rico's Garage, three rides to pick from.
    world.dayTime = 0.28 * 240;
    p.wanted = 0; p.heat = 0;
    p.cash = 9200;
    const g = world.city.landmarks.garage;
    world.cars.push(createCar('sedan', g.x - 10, g.z + 8, 0, 'none'));
    world.cars.push(createCar('sport', g.x + 2, g.z + 10, 0, 'none'));
    world.cars.push(createCar('taxi', g.x + 14, g.z + 6, 0, 'none'));
    p.x = g.x; p.z = g.z + 22; p.heading = Math.PI;
    p.inCar = null;
    world.missions.index = 5;
    world.missions.title = "Rico's Ride";
    startMission(world, 5);
    frameCam(world, g.x + 2, g.z + 8, 36, 22, Math.PI);
    return;
  }
  // showcase (default): daytime Marina, mission 1, full HUD, car by the pier.
  world.dayTime = 0.12 * 240;
  p.wanted = 0; p.heat = 0;
  p.cash = 500;
  putPlayerInCar(world, 'sedan', -300, -300, Math.PI * 0.75);
  world.missions.index = 0;
  world.missions.title = 'Meet Mara';
  startMission(world, 0);
  frameCam(world, -300, -300, 32, 18, Math.PI * 0.75);
}
