// shots.js — the ?shot= scenes for the 4 screenshots. Each one stages real
// game state (a mission in progress, the helicopter overhead, combat, the
// garage) and marks the document SHOT_READY once the frame has settled.
// The playtest captures: 1-showcase (Marina day, mission 1, full HUD),
// 2-heli (5-star heli pursuit at night), 3-combat (mission + shotgun),
// 4-garage (Rico's Garage, 3 rides).
import { LM } from './tuning.js';

export function stageShot(world, name) {
  const w = world;
  const p = w.player;
  const set = (x, z, heading) => {
    if (p.inCar) { p.exitCar(); }
    p.pos.x = x; p.pos.z = z; p.heading = heading || 0;
  };
  if (name === 'showcase') {
    w.missions.index = 0; w.missions.step = 0; w.missions.done = false;
    w.missions._killSpawned = false; w.missions._heliSet = false;
    w.city.setDayFrac(0.12);
    w.police.setWanted(1);
    set(LM.marina[0], LM.marina[1], 0.6);
    // A few parked rides so the showcase reads as a living street.
    for (const c of w.traffic.parkCarsNear(LM.marina[0], LM.marina[1])) w.allCars.push(c);
    w.radio.setStation(0);
    p.cash = 1250;
  } else if (name === 'heli') {
    w.missions.index = 10; w.missions.step = 0; w.missions.done = false;
    w.city.setDayFrac(0.72);
    w.police.setWanted(4);
    set(30, 236, 2.6);
    // Put the chopper in front of the player (orbit angle = player
    // heading), lit, so the chase camera actually sees it + its cone.
    w.heli.active = true;
    w.heli.lit = true;
    w.heli.orbitAngle = 2.6;
    w.heli.pos.x = 30 + Math.sin(2.6) * 26; w.heli.pos.z = 236 + Math.cos(2.6) * 26; w.heli.pos.y = 16;
    w.heli.lastKnown.x = 30; w.heli.lastKnown.z = 236;
    p.cash = 3400;
  } else if (name === 'combat') {
    w.missions.index = 3; w.missions.step = 1; w.missions.done = false;
    w.missions._killSpawned = true;
    w.combat.clearEnemies();
    w.combat.unlock('shotgun');
    w.combat.switchWeapon('shotgun');
    w.combat.spawnEnemies([
      { x: -198, z: 58, kind: 'bayking' },
      { x: -208, z: 62, kind: 'bayking' },
      { x: -216, z: 52, kind: 'enforcer' },
    ]);
    w.city.setDayFrac(0.3);
    w.police.setWanted(2);
    set(-208, 40, 0.1);
    p.cash = 2100;
  } else if (name === 'garage') {
    w.missions.index = 5; w.missions.step = 0; w.missions.done = false;
    w.city.setDayFrac(0.2);
    w.police.setWanted(0);
    p.cash = 5000;
    w.garage.owned = ['sedan', 'muscle', 'sports'];
    w.garage.selected = 'sports';
    set(LM.garage[0] - 6, LM.garage[1] + 8, 2.2);
    // The three rides to pick from, parked at the garage for real.
    for (const c of w.traffic.parkCarsNear(LM.garage[0], LM.garage[1])) w.allCars.push(c);
  }
  // Let one frame render, then mark the shot ready.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { document.title = 'SHOT_READY'; });
  });
}
