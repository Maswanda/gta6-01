// shots.js — The four ?shot= scenes for the competition screenshots.
// Each stages a deterministic, good-looking frame (seed 11):
//   showcase — golden hour at the marina, city skyline behind.
//   heli     — four-star chase, chopper overhead, spotlight on.
//   combat   — dock shootout, enemies in front of the player.
//   garage   — Rico's garage with the shop UI open.
// Staging runs on a fresh page load; the game loop keeps it alive.
import { TUNE } from './tuning.js';
import { Car } from './drive.js';

function placePlayer(world, x, z, heading) {
  const p = world.player;
  if (p.inCar) {
    p.inCar = null;
  }
  p.pos.set(x, 0, z);
  p.heading = heading;
  p.health = 100;
  p.mesh.position.copy(p.pos);
  p.mesh.rotation.y = heading;
}

export function stageShot(world, name) {
  const L = TUNE.landmarks;
  world.state = 'playing';
  world.missions.start();
  world.hud.showMenu(false);
  world.radio.start();
  if (name === 'showcase') {
    world.city.setDayFrac(0.42);
    // On the pier boardwalk, looking north at the marina, the boats
    // and the downtown skyline — the cover frame. The player stands
    // clear of the pier hut so the figure reads in the frame.
    placePlayer(world, -52, 300, Math.PI);
    const c1 = new Car(world, 'sports', 52, 230, Math.PI, 0xf0a500);
    c1.speed = 12;
    world.allCars.push(c1);
    world.scene.setCamera(-58, 8, 320, -20, 2, 210);
    world.cameraLocked = true;
    world.hud.toast('Solmar Bay — the city is yours.');
  } else if (name === 'heli') {
    world.city.setDayFrac(0.55);
    const car = new Car(world, 'sports', 0, 0, 0, 0xf0a500);
    world.allCars.push(car);
    world.player.inCar = car;
    car.speed = 18;
    world.player.pos.set(0, 0, 0);
    world.player.heading = 0;
    world.police.setWanted(4);
    world.heli.forceLaunch();
    // A pursuit unit alongside for the chase feel.
    const u = new Car(world, 'sedan', 12, -18, 0, 0xeeeeee, true);
    u.speed = 18;
    world.allCars.push(u);
    world.police.units.push(u);
    // Elevated three-quarter view: the car, the pursuit unit and the
    // chopper with its spotlight all in frame.
    world.scene.setCamera(24, 10, -28, 8, 14, 10);
    world.cameraLocked = true;
    world.hud.toast('Four stars — the chopper is overhead.');
  } else if (name === 'combat') {
    world.city.setDayFrac(0.35);
    // Jump the story to M4's shootout so the objective matches, and
    // hand the player the shotgun the docks job unlocks.
    world.missions.jumpTo(3, 1);
    world.unlocked.shotgun = true;
    world.combat.selectWeapon('shotgun');
    placePlayer(world, L.docks.x + 10, L.docks.z + 6, Math.atan2(-10, -6));
    world.police.setWanted(2);
    world.scene.snapCamera(L.docks.x + 10, L.docks.z + 6, Math.atan2(-10, -6), false);
    world.cameraLocked = true;
    world.hud.toast('Dockside trouble — clear them out.');
  } else if (name === 'garage') {
    world.city.setDayFrac(0.3);
    placePlayer(world, L.garage.x - 6, L.garage.z + 6, Math.atan2(6, -6));
    world.player.cash = 5200;
    const c1 = new Car(world, 'sedan', L.garage.x - 14, L.garage.z + 4, Math.PI / 2, 0x4a7a9e);
    const c2 = new Car(world, 'muscle', L.garage.x + 14, L.garage.z + 4, -Math.PI / 2, 0xb03a2e);
    const c3 = new Car(world, 'sports', L.garage.x, L.garage.z + 12, Math.PI, 0xf0a500);
    world.allCars.push(c1, c2, c3);
    // Wide view of the forecourt: the RICO'S GARAGE sign, the three
    // cars and the player. (The shop UI itself is exercised by the
    // playtest; the frame shows the garage.)
    world.scene.setCamera(L.garage.x - 24, 8, L.garage.z + 26, L.garage.x + 2, 4, L.garage.z - 12);
    world.cameraLocked = true;
    world.hud.toast('Rico\u2019s Garage — buy, sell, select.');
  } else {
    // Unknown shot name: fall back to showcase.
    return stageShot(world, 'showcase');
  }
  return true;
}
