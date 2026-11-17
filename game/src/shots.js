// Deterministic screenshot scenes: ?shot=chase|street|drive|menu stages the
// game (positions, wanted level, mission, camera) so each screenshot shows
// several systems at once, identically on every load.
export function applyShot(world, name) {
  const w = world;
  w.state = 'playing';
  w.hud.hideMenu();
  w.hud.hideEnd();
  w.hud.hidePause();
  const lm = w.landmarks;
  if (name === 'chase') {
    // Cover: police chase at 3 stars, hot delivery in progress, minimap + HUD.
    w.missions.index = 2;
    w.missions.step = 1;
    w.missions.hasPackage = true;
    w.missions.enterStep(w);
    w.missions.timer = 118;
    const car = w.parkedCars[0];
    w.enterCar(car, true);
    car.pos.set(0, 0, 120);
    car.heading = Math.PI;
    car.speed = 22;
    car.syncMesh(0);
    w.player.pos.set(0, 0, 120);
    // Exactly 3 stars: enterCar already added 1 for the theft.
    w.police.wanted = 3;
    w.police.syncCars(w);
    // Two interceptors tucked in right behind.
    const [p1, p2] = w.police.cars;
    if (p1) { p1.pos.set(-4, 0, 132); p1.heading = Math.PI; p1.speed = 24; p1.syncMesh(0); }
    if (p2) { p2.pos.set(5, 0, 136); p2.heading = Math.PI; p2.speed = 23; p2.syncMesh(0); }
    w.shotCam = { pos: new THREE.Vector3(6, 5, 142), look: new THREE.Vector3(0, 2, 108) };
    w.hud.flashMessage('Hot delivery — 3 stars, lose the cops!');
  } else if (name === 'street') {
    // On foot downtown: pedestrians, traffic, 1 star, first mission live.
    w.missions.index = 0;
    w.missions.step = 0;
    w.missions.enterStep(w);
    // On the avenue itself, so traffic and the cruiser share the frame.
    w.player.pos.set(26, 0, 4);
    w.player.heading = Math.PI;
    w.player.mesh.position.copy(w.player.pos);
    w.police.addWanted(1, w);
    const pc = w.police.cars[0];
    if (pc) { pc.pos.set(14, 0, -10); pc.heading = Math.PI / 2; pc.syncMesh(0); }
    w.shotCam = { pos: new THREE.Vector3(30, 5.5, 16), look: new THREE.Vector3(20, 2, -4) };
  } else if (name === 'drive') {
    // Driving fast down the beachfront avenue, mission 2 live.
    w.missions.index = 1;
    w.missions.step = 1;
    w.missions.enterStep(w);
    const car = w.parkedCars[2] || w.parkedCars[0];
    w.enterCar(car, true);
    car.pos.set(-104, 0, 208);
    car.heading = Math.PI / 2;
    car.speed = 26;
    car.syncMesh(0);
    w.player.pos.copy(car.pos);
    w.shotCam = { pos: new THREE.Vector3(-126, 5.5, 196), look: new THREE.Vector3(-70, 2, 208) };
    w.hud.flashMessage('Borrowed wheels — get it to Rico\'s garage!');
  } else if (name === 'menu') {
    // Start screen over the downtown skyline.
    w.state = 'menu';
    w.hud.showMenu(false);
    w.shotCam = { pos: new THREE.Vector3(90, 55, 130), look: new THREE.Vector3(-20, 8, -20) };
  }
}
