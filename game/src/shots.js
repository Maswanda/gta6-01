// Deterministic screenshot scenes v2: ?shot=chase|street|drive|menu stages
// the game (positions, wanted level, mission, camera) so each screenshot
// shows several v2 systems at once, identically on every load — the new
// districts and landmarks, the sports car, the bigger HUD and minimap.
export function applyShot(world, name) {
  const w = world;
  w.state = 'playing';
  w.hud.hideMenu();
  w.hud.hideEnd();
  w.hud.hidePause();
  const lm = w.landmarks;
  if (name === 'chase') {
    // Cover: a police chase at 3 stars in the sports car, the Hot Delivery
    // running, Solmar Tower and Downtown behind, minimap + HUD live.
    w.missions.index = 2;
    w.missions.step = 1;
    w.missions.hasPackage = true;
    w.missions.enterStep(w);
    w.missions.timer = 118;
    const car = w.marinaSports;
    w.enterCar(car, true);
    car.pos.set(0, 0, 120);
    car.heading = Math.PI;
    car.speed = 26;
    car.syncMesh(0);
    w.player.pos.set(0, 0, 120);
    w.police.wanted = 3;
    w.police.syncCars(w);
    const [p1, p2] = w.police.cars;
    if (p1) { p1.pos.set(-4, 0, 132); p1.heading = Math.PI; p1.speed = 24; p1.syncMesh(0); }
    if (p2) { p2.pos.set(5, 0, 136); p2.heading = Math.PI; p2.speed = 23; p2.syncMesh(0); }
    w.shotCam = { pos: new THREE.Vector3(6, 5, 142), look: new THREE.Vector3(0, 2, 108) };
    w.hud.flashMessage('Hot delivery — 3 stars, lose the cops!');
  } else if (name === 'street') {
    // On foot in Old Town by the clock tower: pedestrians, traffic, the
    // informant mission live, a cruiser in frame.
    w.missions.index = 4;
    w.missions.step = 0;
    w.missions.enterStep(w);
    w.player.pos.set(-124, 0, 10);
    w.player.heading = Math.PI / 2;
    w.player.mesh.position.copy(w.player.pos);
    w.police.addWanted(1, w);
    const pc = w.police.cars[0];
    if (pc) { pc.pos.set(-112, 0, -6); pc.heading = Math.PI / 2; pc.syncMesh(0); }
    w.shotCam = { pos: new THREE.Vector3(-112, 5.5, 22), look: new THREE.Vector3(-128, 3, 8) };
  } else if (name === 'drive') {
    // Driving the sports car down the beachfront avenue toward the Marina,
    // the Smash and Grab live, ferris wheel and sea in the background.
    w.missions.index = 5;
    w.missions.step = 1;
    w.missions.enterStep(w);
    const car = w.marinaSports;
    w.enterCar(car, true);
    car.pos.set(-104, 0, 208);
    car.heading = Math.PI / 2;
    car.speed = 30;
    car.syncMesh(0);
    w.player.pos.copy(car.pos);
    w.shotCam = { pos: new THREE.Vector3(-126, 5.5, 196), look: new THREE.Vector3(-70, 2, 208) };
    w.hud.flashMessage('Smash and Grab — the gold sports car!');
  } else if (name === 'menu') {
    // Start screen over the Downtown skyline and Solmar Tower.
    w.state = 'menu';
    w.hud.showMenu(false);
    w.shotCam = { pos: new THREE.Vector3(90, 55, 130), look: new THREE.Vector3(-20, 8, -20) };
  }
}
