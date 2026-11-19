// traffic.js — Ambient life: cars cruising the avenue grid and
// pedestrians strolling the sidewalks. Traffic cars are stealable
// (the story needs them), peds react to danger by fleeing.
// All cars the world knows about live in world.allCars.
import * as THREE from 'three';
import { TUNE, clamp, dist2d } from './tuning.js';
import { Car } from './drive.js';

const PED_JACKETS = [0xc0392b, 0x2e86c1, 0x28b463, 0xf39c12, 0x8e44ad, 0x16a085, 0xe67e22, 0x95a5a6];

export class Traffic {
  constructor(world) {
    this.world = world;
    this.peds = [];
    this._spawnCars();
    this._spawnPeds();
  }
  _spawnCars() {
    const rng = this.world.rng;
    const kinds = ['sedan', 'sedan', 'muscle', 'truck', 'sports'];
    for (let i = 0; i < TUNE.trafficCars; i++) {
      const p = this.world.city.randomRoadPoint();
      const kind = kinds[i % kinds.length];
      const heading = rng.chance(0.5) ? 0 : Math.PI / 2;
      const car = new Car(this.world, kind, p.x, p.z, heading + (rng.chance(0.5) ? Math.PI : 0));
      car.speed = rng.range(8, 14);
      car.isTraffic = true;
      this.world.allCars.push(car);
    }
    // Parked cars near landmarks, ready to be borrowed.
    for (let i = 0; i < TUNE.parkedCars; i++) {
      const p = this.world.city.randomRoadPoint();
      const car = new Car(this.world, 'sedan', p.x, p.z, rng.range(0, Math.PI * 2));
      car.speed = 0;
      car.isParked = true;
      this.world.allCars.push(car);
    }
  }
  _spawnPeds() {
    const rng = this.world.rng;
    for (let i = 0; i < TUNE.peds; i++) {
      const p = this.world.city.randomRoadPoint();
      const mesh = this.world.scene.makePedMesh(PED_JACKETS[i % PED_JACKETS.length]);
      mesh.position.set(p.x, 0, p.z);
      this.world.scene.dynamic.add(mesh);
      this.peds.push({
        pos: new THREE.Vector3(p.x, 0, p.z),
        heading: rng.range(0, Math.PI * 2),
        speed: rng.range(1, 2.2),
        mesh,
        flee: 0,
        phase: rng.range(0, Math.PI * 2),
      });
    }
  }
  update(dt) {
    const world = this.world;
    // Traffic cars: cruise along their avenue, turn at intersections,
    // avoid the player car with a soft swerve.
    for (const car of world.allCars) {
      if (!car.alive || car.isPolice || car === world.player.inCar) continue;
      if (car.isParked) continue;
      const onXRoad = Math.abs(car.pos.x % TUNE.roadSpacing) < 4 || Math.abs(car.pos.x % TUNE.roadSpacing) > TUNE.roadSpacing - 4;
      // Follow the road direction; at an intersection, sometimes turn.
      const nearIntersection = Math.abs(car.pos.z % TUNE.roadSpacing) < 6 || Math.abs(car.pos.x % TUNE.roadSpacing) < 6;
      let steer = 0;
      if (nearIntersection && world.rng.chance(0.02)) {
        car.heading += (world.rng.chance(0.5) ? 1 : -1) * Math.PI / 2;
      }
      // Stay on the road: nudge back toward the nearest avenue line.
      // Steering sign: turning right (steer +1) decreases heading.
      const horiz = Math.abs(Math.sin(car.heading)) > Math.abs(Math.cos(car.heading));
      if (horiz) {
        const line = Math.round(car.pos.z / TUNE.roadSpacing) * TUNE.roadSpacing;
        steer = clamp((line - car.pos.z) * 0.05, -0.4, 0.4) * Math.sign(Math.sin(car.heading) || 1);
      } else {
        const line = Math.round(car.pos.x / TUNE.roadSpacing) * TUNE.roadSpacing;
        steer = -clamp((line - car.pos.x) * 0.05, -0.4, 0.4) * Math.sign(Math.cos(car.heading) || 1);
      }
      // Slow down if a car is right ahead.
      let target = 11;
      for (const other of world.allCars) {
        if (other === car || !other.alive) continue;
        const d = dist2d(car.pos.x, car.pos.z, other.pos.x, other.pos.z);
        if (d < 9) {
          const ahead = Math.sin(car.heading) * (other.pos.x - car.pos.x) + Math.cos(car.heading) * (other.pos.z - car.pos.z);
          if (ahead > 0) target = 0;
        }
      }
      car.cruise(target, steer, dt);
    }
    // Car-to-car bumps.
    const cars = world.allCars;
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        if (cars[i].alive && cars[j].alive) cars[i].bump(cars[j]);
      }
    }
    // Peds: stroll, flee from the player car / gunfire, stay on streets.
    const player = world.player;
    for (const ped of this.peds) {
      const dPlayer = dist2d(ped.pos.x, ped.pos.z, player.pos.x, player.pos.z);
      if (dPlayer < 8 && (player.inCar || world.combat.recentShot > 0)) ped.flee = 2.5;
      if (ped.flee > 0) {
        ped.flee -= dt;
        const away = Math.atan2(ped.pos.x - player.pos.x, ped.pos.z - player.pos.z);
        ped.heading = away;
        ped.speed = 4.5;
      } else {
        ped.speed = 1.4;
        if (world.rng.chance(0.004)) ped.heading += (world.rng.chance(0.5) ? 1 : -1) * Math.PI / 2;
      }
      const nx = ped.pos.x + Math.sin(ped.heading) * ped.speed * dt;
      const nz = ped.pos.z + Math.cos(ped.heading) * ped.speed * dt;
      if (world.city.inBounds(nx, nz) && !world.city.hitsBuilding(nx, nz, 0.6)) {
        ped.pos.x = nx;
        ped.pos.z = nz;
      } else {
        ped.heading += Math.PI / 2;
      }
      ped.mesh.position.set(ped.pos.x, 0, ped.pos.z);
      ped.mesh.rotation.y = ped.heading;
      ped.phase += dt * (ped.flee > 0 ? 14 : 6);
      ped.mesh.position.y = Math.abs(Math.sin(ped.phase)) * 0.06;
    }
  }
}
