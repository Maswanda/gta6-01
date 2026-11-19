// traffic.js — ambient traffic cars and wandering pedestrians. They drive
// and walk the road grid on their own; the player can steal a traffic car.
import { T, clamp } from './tuning.js';
import { Car } from './drive.js';
import { makeRng } from './rng.js';

const KINDS = ['sedan', 'sedan', 'muscle', 'van', 'taxi'];

export class Traffic {
  constructor(city, seed) {
    this.city = city;
    this.rng = makeRng(seed ^ 0x9e3779b9);
    this.cars = [];
    this.peds = [];
    for (let i = 0; i < 12; i++) this.cars.push(this._spawnCar());
    for (let i = 0; i < 28; i++) this.peds.push(this._spawnPed());
  }
  _roadCoord() {
    const n = Math.floor(this.rng.range(-6, 7));
    return n * T.roadStep;
  }
  _spawnCar() {
    const car = new Car(this._roadCoord(), this._roadCoord(), this.rng.pick(KINDS));
    car.heading = this.rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    car.speed = this.rng.range(6, 12);
    car.driver = 'traffic';
    return car;
  }
  _spawnPed() {
    return {
      x: this._roadCoord() + this.rng.range(-20, 20),
      z: this._roadCoord() + this.rng.range(-20, 20),
      heading: this.rng.range(0, Math.PI * 2),
      speed: this.rng.range(1.2, 2.4),
      retarget: this.rng.range(2, 8),
      color: this.rng.pick([0xff6b6b, 0x6bff8f, 0x6bb8ff, 0xffe66b, 0xc96bff, 0xff9f43]),
      mesh: null,
    };
  }
  update(dt, playerPos) {
    // Traffic cars: cruise the grid, turn at intersections, avoid the player.
    for (const car of this.cars) {
      if (!car.alive || car.parked) continue;
      const onRoadX = Math.abs(((car.pos.x % T.roadStep) + T.roadStep) % T.roadStep) < 4
        || Math.abs((((car.pos.x % T.roadStep) + T.roadStep) % T.roadStep) - T.roadStep) < 4;
      const onRoadZ = Math.abs(((car.pos.z % T.roadStep) + T.roadStep) % T.roadStep) < 4
        || Math.abs((((car.pos.z % T.roadStep) + T.roadStep) % T.roadStep) - T.roadStep) < 4;
      if (onRoadX && onRoadZ && this.rng.chance(dt * 0.5)) {
        car.heading += this.rng.pick([-Math.PI / 2, Math.PI / 2]);
      }
      // Gentle avoidance: slow down if the player is right ahead.
      const dx = playerPos.x - car.pos.x, dz = playerPos.z - car.pos.z;
      const ahead = Math.sin(car.heading) * dx + Math.cos(car.heading) * dz;
      const distP = Math.hypot(dx, dz);
      const throttle = (distP < 14 && ahead > 0) ? 0 : 0.5;
      car.step(0, throttle, false, dt, this.city);
      if (car.speed < 4) car.speed = 6;
    }
    // Peds: wander, retarget often, stay on the sidewalks (near roads).
    for (const p of this.peds) {
      p.retarget -= dt;
      if (p.retarget <= 0) {
        p.heading = this.rng.range(0, Math.PI * 2);
        p.retarget = this.rng.range(3, 9);
      }
      p.x += Math.sin(p.heading) * p.speed * dt;
      p.z += Math.cos(p.heading) * p.speed * dt;
      p.x = clamp(p.x, -T.worldHalf, T.worldHalf);
      p.z = clamp(p.z, -T.worldHalf, T.worldHalf);
      // Step out of buildings.
      const b = this.city.buildingAt(p.x, p.z);
      if (b) { p.heading += Math.PI / 2; p.x -= Math.sin(p.heading) * 2; p.z -= Math.cos(p.heading) * 2; }
    }
  }
  // Park three cars (sedan / muscle / sports) around a point for the
  // garage shot. Parked cars never drive off; the caller adds them to the
  // world's allCars so the renderer (and nearestCar) can see them.
  parkCarsNear(x, z) {
    const kinds = ['sedan', 'muscle', 'sports'];
    const offs = [[-6, -6], [6, -6], [0, 7]];
    const out = [];
    for (let i = 0; i < 3; i++) {
      const c = new Car(x + offs[i][0], z + offs[i][1], kinds[i]);
      c.heading = 0;
      c.speed = 0;
      c.parked = true;
      c.syncMesh(0);
      this.cars.push(c);
      out.push(c);
    }
    return out;
  }
  // All cars in the world (traffic + player-owned + police are tracked by main).
  get allCars() { return this.cars; }
}
