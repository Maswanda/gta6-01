// shots.js — Solmar Bay: the ?shot= hook for screenshots.
// Load the game with ?shot=showcase (or heli, combat, garage) and the
// game stages that scene, points a cinematic camera, and raises
// window.__SHOT_READY__ when the frame is ready to capture. The scene
// is deterministic (fixed positions, golden-hour light), so the same
// query always stages the same picture. No shot param means normal play.
export function applyShot(world, query) {
  const kind = query.get('shot');
  if (!kind) return false;
  const seed = Number(query.get('seed') || 11);
  world.shotMode = true;
  world.started = true;
  world.hud.showMenu(false);
  // A staged scene starts the story at mission 1 so the objective reads.
  if (!world.missions.mission && !world.missions.done) world.missions.startMission(0);
  const p = world.player;
  const stage = world.stage;
  const setCar = (type, x, z, heading) => {
    const car = world.drive.createCar(type, x, z, heading);
    world.drive.enterCar(car);
    return car;
  };
  const place = (x, z, heading, hour, wanted) => {
    world.walker.spawn(x, z, heading);
    world.hour = hour;
    world.wanted = wanted;
    stage.setTimeOfDay(hour);
  };
  const lookFrom = (px, py, pz, lx, ly, lz) => stage.setCamera(px, py, pz, lx, ly, lz);
  if (kind === 'showcase') {
    // Golden hour at the marina: the bay, the tower, the minimap, the radio.
    place(-160, 190, Math.PI * 0.85, 17.5, 0);
    setCar('muscle', -160, 190, Math.PI * 0.85);
    world.cash = 12900;
    world.radio.index = 0;
    world.missions.step = { kind: 'goto', x: -224, z: 224, r: 12, text: 'Meet Mara at the Marina' };
    lookFrom(-160 - 26, 9, 190 + 26, -160, 2, 190);
  } else if (kind === 'heli') {
    // Four-star chase: the air unit overhead, spotlight on, a patrol car alongside.
    place(-40, -40, Math.PI * 0.25, 19.2, 4);
    setCar('sedan', -40, -40, Math.PI * 0.25);
    world.cash = 8600;
    const cop = world.drive.createCar('sedan', -34, -52, Math.PI * 0.25, { cop: true });
    world.police.cops.push(cop);
    const heli = world.helicopter.spawn();
    heli.x = -40;
    heli.z = -40;
    heli.y = 55;
    heli.mesh.position.set(-40, 55, -40);
    world.heliLit = true;
    world.missions.step = { kind: 'goto', x: 224, z: 224, r: 12, text: 'Lose the air unit — reach the Hills', needCar: true };
    lookFrom(-40 - 30, 12, -40 + 30, -40, 6, -40);
  } else if (kind === 'combat') {
    // Dockside shootout: shotgun out, crew in front, wanted stars up.
    place(-180, -180, Math.PI * 0.75, 18.1, 3);
    world.combat.giveWeapon('shotgun', 24);
    world.cash = 5400;
    for (let i = 0; i < 3; i++) {
      world.combat.spawnEnemy('gang', -180 + (i - 1) * 5, -180 - 14 - i * 2, { hold: true });
    }
    world.missions.step = { kind: 'kill', n: 3, sx: -180, sz: -196, text: 'Clear the Bay Kings at Vice Beach', enemies: [...world.enemies] };
    lookFrom(-180 - 16, 6, -180 + 18, -180, 1.5, -192);
  } else if (kind === 'garage') {
    // Rico's Garage: three rides on the forecourt, the deal on the door.
    place(-96, 168, Math.PI, 12.0, 0);
    world.cash = 9800;
    world.garage.owned = ['sedan', 'muscle', 'taxi'];
    world.garage.selected = 'muscle';
    world.garage.spawnOwned('sedan');
    world.garage.spawnOwned('muscle');
    world.garage.spawnOwned('taxi');
    world.missions.step = { kind: 'goto', x: -96, z: 192, r: 12, text: "Rico's Garage — pick a ride" };
    lookFrom(-96 - 24, 10, 168 + 26, -96, 1.5, 190);
  } else {
    return false;
  }
  // Let the renderer draw a few frames, then raise the flag.
  world.shotSeed = seed;
  let frames = 0;
  const tick = () => {
    frames++;
    if (frames >= 4) {
      window.__SHOT_READY__ = true;
      document.title = 'SHOT_READY';
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return true;
}
