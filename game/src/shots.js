// Screenshot setups: ?shot=showcase|heli|combat|garage stages a deterministic
// scene, then flips document.title to SHOT_READY so the capture harness
// knows the frame is composed. Seed 11 keeps every run identical.
export function applyShotMode(world, mode) {
  const w = world;
  const g = w.game;
  if (mode === 'showcase') {
    // Wide city view: the player in a sedan on the marina road, radio on,
    // daylight, minimap + HUD visible.
    g.teleport(0, 208);
    const car = g.spawnParkedCar(0, 212, 'sedan', 0x3f6d8e);
    if (car) {
      w.drive.enterCar(w.player, car);
      w.player.inCar.heading = Math.PI;
    }
    w.city.setDayFrac(0.12);
    w.radio.setStation(0);
  } else if (mode === 'heli') {
    // 5-star pursuit: the chopper overhead, spotlight on, player fleeing.
    g.teleport(0, 0);
    const car = g.spawnParkedCar(2, 4, 'sports', 0xd8a020);
    if (car) w.drive.enterCar(w.player, car);
    g.setWanted(4);
    w.heli.spawn();
    w.heli.lastKnown.set(0, 0, 0);
    w.city.setDayFrac(0.75);
  } else if (mode === 'combat') {
    // Mission firefight at the docks: enemies up, player aiming in.
    g.teleport(-208, 52);
    w.combat.spawnEnemies('dockside', -208, 52, 3);
    const alive = w.combat.enemies.filter((e) => e.hp > 0);
    if (alive.length) {
      const e = alive[0];
      w.player.heading = Math.atan2(e.pos.x - w.player.pos.x, e.pos.z - w.player.pos.z);
    }
    w.city.setDayFrac(0.15);
  } else if (mode === 'garage') {
    // Progression proof: the garage with owned cars and the save note.
    w.player.cash = 5000;
    g.teleport(156, 130);
    w.garage.buy('sedan');
    w.garage.buy('muscle');
    w.garage.select('muscle');
    w.city.setDayFrac(0.1);
  }
  // Let a frame render, then signal the harness.
  setTimeout(() => {
    document.title = 'SHOT_READY';
  }, 1200);
}
