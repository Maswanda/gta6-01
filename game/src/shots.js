// Deterministic screenshot scenes v3: ?shot=crime|night|drift|heist stages
// the game (positions, wanted level, mission, camera, day fraction) so each
// screenshot shows several v3 systems at once, identically on every load —
// a dynamic crime event, the casino at night, a drift with the police
// behind, and the Marina Heist.
export function applyShot(world, name) {
  const w = world;
  w.state = 'playing';
  w.hud.hideMenu();
  w.hud.hideEnd();
  w.hud.hidePause();
  const lm = w.landmarks;
  if (name === 'crime') {
    // Cover: a police pursuit in progress — a fugitive sports car fleeing
    // two interceptors — with the player closing in, the Hot Delivery
    // running, Solmar Tower and Downtown behind, minimap + HUD live.
    w.missions.index = 2;
    w.missions.step = 1;
    w.missions.hasPackage = true;
    w.missions.enterStep(w);
    w.missions.timer = 118;
    w.crime.forceCrime('pursuit', w);
    const pos = w.crime.eventPos();
    const car = w.marinaSports;
    w.enterCar(car, true);
    car.pos.set(pos.x + 8, 0, pos.z + 10);
    car.heading = Math.PI;
    car.speed = 20;
    car.syncMesh(0);
    w.player.pos.copy(car.pos);
    w.police.wanted = 2;
    w.police.syncCars(w);
    w.shotCam = { pos: new THREE.Vector3(pos.x + 14, 6, pos.z + 24), look: new THREE.Vector3(pos.x, 2, pos.z) };
    w.hud.flashMessage('Police pursuit — ram the fugitive!');
  } else if (name === 'night') {
    // The Meridian Casino at night: neon sign, canopy, red carpet and the
    // four luxury sports cars, the heist live, street lights on.
    w.city.setDayFrac(0.75);
    w.missions.index = 9;
    w.missions.step = 0;
    w.missions.enterStep(w);
    w.player.pos.set(78, 0, 6);
    w.player.heading = Math.PI;
    w.player.mesh.position.copy(w.player.pos);
    w.shotCam = { pos: new THREE.Vector3(78, 7, 28), look: new THREE.Vector3(78, 14, -26) };
    w.hud.flashMessage('The Meridian Casino at night — the heist is on.');
  } else if (name === 'drift') {
    // Drifting the sports car down the beachfront avenue at nightfall, the
    // police behind, the Hot Delivery running. W + D are held so the car
    // really drifts (and lays smoke) for the shot.
    w.missions.index = 2;
    w.missions.step = 1;
    w.missions.hasPackage = true;
    w.missions.enterStep(w);
    w.missions.timer = 118;
    const car = w.marinaSports;
    w.enterCar(car, true);
    car.pos.set(-180, 0, 208);
    car.heading = Math.PI / 2;
    car.speed = 22;
    car.syncMesh(0);
    w.player.pos.copy(car.pos);
    w.input.pressKey('KeyW');
    w.input.pressKey('KeyD');
    w.police.wanted = 3;
    w.police.syncCars(w);
    const [p1, p2] = w.police.cars;
    if (p1) { p1.pos.set(-192, 0, 196); p1.heading = Math.PI / 2; p1.speed = 24; p1.syncMesh(0); }
    if (p2) { p2.pos.set(-186, 0, 214); p2.heading = Math.PI / 2; p2.speed = 23; p2.syncMesh(0); }
    w.shotCam = { pos: new THREE.Vector3(-152, 6, 188), look: new THREE.Vector3(-112, 2, 226) };
    w.hud.flashMessage('Drift the beachfront — lose the cops!');
  } else if (name === 'heist') {
    // The Marina Heist: the vault guards are up at the casino, three stars
    // on the player, the neon sign and the getaway cars in frame.
    w.missions.index = 9;
    w.missions.step = 2;
    w.missions.enterStep(w);
    w.player.pos.set(78, 0, 4);
    w.player.heading = Math.PI;
    w.player.mesh.position.copy(w.player.pos);
    w.shotCam = { pos: new THREE.Vector3(58, 6, 22), look: new THREE.Vector3(78, 4, -20) };
    w.hud.flashMessage('The Marina Heist — crack the vault!');
  }
}
