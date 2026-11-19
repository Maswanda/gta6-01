// Ambient traffic: cars that cruise the road grid so the streets feel
// alive. They keep to roads, turn at intersections, and wrap at the map
// edge. They never target the player.
import { T } from './tuning.js';

export class Traffic {
  constructor(world) {
    this.world = world;
    this.cars = [];
  }

  spawnInitial(n) {
    const w = this.world;
    const colors = [0x777777, 0x8e6d3f, 0x3f5a7a, 0x7a3f3f, 0x4a4a4a];
    for (let i = 0; i < n; i++) {
      const onXRoad = w.rng() > 0.5;
      const line = Math.round((w.rng() * 2 - 1) * 5) * T.roadStep;
      const along = (w.rng() * 2 - 1) * (T.mapHalf - 20);
      const x = onXRoad ? along : line;
      const z = onXRoad ? line : along;
      const car = w.game.spawnParkedCar(x, z, 'sedan', colors[i % colors.length]);
      if (!car) continue;
      car.heading = onXRoad ? (w.rng() > 0.5 ? Math.PI / 2 : -Math.PI / 2) : w.rng() > 0.5 ? 0 : Math.PI;
      car.speed = 10 + w.rng() * 6;
      car.isTraffic = true;
      this.cars.push(car);
    }
  }

  step(dt) {
    const w = this.world;
    for (const car of this.cars) {
      if (!car.alive) continue;
      // Cruise forward; at an intersection, sometimes turn.
      const onRoadX = Math.abs(car.pos.z - Math.round(car.pos.z / T.roadStep) * T.roadStep) < 3;
      const onRoadZ = Math.abs(car.pos.x - Math.round(car.pos.x / T.roadStep) * T.roadStep) < 3;
      if ((onRoadX || onRoadZ) && w.rng() < dt * 0.15) {
        car.heading += (w.rng() > 0.5 ? 1 : -1) * Math.PI / 2;
      }
      let nx = car.pos.x + Math.sin(car.heading) * car.speed * dt;
      let nz = car.pos.z + Math.cos(car.heading) * car.speed * dt;
      const hit = w.city.resolveCollision(nx, nz, 2.2);
      if (hit.hit) {
        // Bumped a building: turn around.
        car.heading += Math.PI / 2;
        nx = car.pos.x;
        nz = car.pos.z;
      }
      const clamped = w.city.clampToMap(nx, nz);
      if (clamped.x !== nx || clamped.z !== nz) {
        car.heading += Math.PI;
        nx = car.pos.x;
        nz = car.pos.z;
      }
      car.pos.set(clamped.x, 0, clamped.z);
      car.syncMesh();
    }
  }
}
