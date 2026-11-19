// traffic.js — Solmar Bay: the living street.
// Fourteen traffic cars cruise the road grid and twenty-eight pedestrians
// walk the sidewalks, so the city never feels empty. Traffic cars are
// moved directly along their road (they are scenery with collision);
// pedestrians fall and respawn when a car clips them, and the law notices.
import { Dice } from './rng.js';
import { randomRoadPoint } from './city.js';

const TRAFFIC_COLORS = [0x8a8f96, 0x3a6fd8, 0xd8d0c0, 0x2a2a2a, 0x7a3a6a, 0x4a7a3a];
const PED_COLORS = [0xd83a3a, 0x3a6fd8, 0x2e8f5a, 0xe8c832, 0x8f5a2e, 0x7a4a8f, 0x5a6b7a];

export class StreetLife {
  constructor(world) {
    this.world = world;
    this.dice = new Dice(4242);
    this.traffic = [];
    this.peds = [];
    this.spawnTraffic(14);
    this.spawnPeds(28);
  }
  spawnTraffic(n) {
    for (let i = 0; i < n; i++) {
      const p = randomRoadPoint(this.world.layout, this.dice);
      const type = this.dice.pick(['sedan', 'sedan', 'taxi', 'truck', 'muscle']);
      const axis = this.dice.chance(0.5) ? 'z' : 'x';
      const line = axis === 'z' ? p.x : p.z;
      // Snap the line to the nearest road coordinate.
      const roadAt = this.world.layout.roadAt;
      let nearest = roadAt[0];
      for (const c of roadAt) if (Math.abs(c - line) < Math.abs(nearest - line)) nearest = c;
      const along = axis === 'z' ? p.z : p.x;
      const dir = this.dice.chance(0.5) ? 1 : -1;
      const car = this.world.drive.createCar(type, 0, 0, 0, { traffic: true });
      car.mesh.userData.bodyMat.color.setHex(this.dice.pick(TRAFFIC_COLORS));
      car.traffic = { axis, line: nearest, along, dir, speed: this.dice.range(9, 15), lane: 3.6 };
      this.traffic.push(car);
      this.placeTrafficCar(car);
    }
  }
  placeTrafficCar(car) {
    const t = car.traffic;
    if (t.axis === 'z') {
      car.x = t.line + t.lane * (t.dir > 0 ? 1 : -1);
      car.z = t.along;
      car.heading = t.dir > 0 ? 0 : Math.PI;
    } else {
      car.x = t.along;
      car.z = t.line + t.lane * (t.dir > 0 ? 1 : -1);
      car.heading = t.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
  }
  spawnPeds(n) {
    for (let i = 0; i < n; i++) {
      const p = randomRoadPoint(this.world.layout, this.dice);
      const mesh = this.world.stage.makePed(this.dice.pick(PED_COLORS));
      const axis = this.dice.chance(0.5) ? 'z' : 'x';
      const roadAt = this.world.layout.roadAt;
      const line = axis === 'z' ? p.x : p.z;
      let nearest = roadAt[0];
      for (const c of roadAt) if (Math.abs(c - line) < Math.abs(nearest - line)) nearest = c;
      const ped = {
        x: 0, z: 0, heading: 0, speed: this.dice.range(1.2, 2.4),
        mesh, axis, line: nearest, along: axis === 'z' ? p.z : p.x,
        dir: this.dice.chance(0.5) ? 1 : -1, down: false, downTimer: 0, walkPhase: Math.random() * 6,
      };
      this.peds.push(ped);
      this.placePed(ped);
    }
  }
  placePed(ped) {
    const off = 9.5; // sidewalk, clear of the road
    if (ped.axis === 'z') {
      ped.x = ped.line + off * (ped.dir > 0 ? 1 : -1);
      ped.z = ped.along;
      ped.heading = ped.dir > 0 ? 0 : Math.PI;
    } else {
      ped.x = ped.along;
      ped.z = ped.line + off * (ped.dir > 0 ? 1 : -1);
      ped.heading = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
    ped.mesh.rotation.z = 0;
  }
  update(dt) {
    const half = this.world.layout.half;
    // Traffic.
    for (const car of this.traffic) {
      if (car.dead) continue;
      const t = car.traffic;
      t.along += t.dir * t.speed * dt;
      // At an intersection, sometimes turn onto the crossing road.
      const roadAt = this.world.layout.roadAt;
      const nearCross = roadAt.some((c) => Math.abs(t.along - c) < 1.2);
      if (nearCross && Math.random() < dt * 0.25) {
        const newLine = t.along;
        let nearest = roadAt[0];
        for (const c of roadAt) if (Math.abs(c - newLine) < Math.abs(nearest - newLine)) nearest = c;
        const oldAxis = t.axis;
        t.axis = oldAxis === 'z' ? 'x' : 'z';
        t.line = nearest;
        t.along = oldAxis === 'z' ? car.x : car.z;
        t.dir = Math.random() < 0.5 ? 1 : -1;
      }
      if (t.along > half - 12) {
        t.along = half - 12;
        t.dir = -1;
      } else if (t.along < -half + 12) {
        t.along = -half + 12;
        t.dir = 1;
      }
      this.placeTrafficCar(car);
      car.speed = t.speed;
    }
    // Pedestrians.
    const pc = this.world.player.inCar;
    for (const ped of this.peds) {
      if (ped.down) {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          ped.down = false;
          const p = randomRoadPoint(this.world.layout, this.dice);
          ped.axis = Math.random() < 0.5 ? 'z' : 'x';
          ped.line = ped.axis === 'z' ? p.x : p.z;
          const roadAt = this.world.layout.roadAt;
          let nearest = roadAt[0];
          for (const c of roadAt) if (Math.abs(c - ped.line) < Math.abs(nearest - c)) nearest = c;
          ped.line = nearest;
          ped.along = ped.axis === 'z' ? p.z : p.x;
          ped.dir = Math.random() < 0.5 ? 1 : -1;
          this.placePed(ped);
        }
        continue;
      }
      ped.along += ped.dir * ped.speed * dt;
      if (ped.along > half - 12) {
        ped.along = half - 12;
        ped.dir = -1;
      } else if (ped.along < -half + 12) {
        ped.along = -half + 12;
        ped.dir = 1;
      }
      this.placePed(ped);
      ped.walkPhase += dt * ped.speed * 3;
      const swing = Math.sin(ped.walkPhase) * 0.45;
      const legs = ped.mesh.userData.legs || [];
      if (legs[0]) legs[0].rotation.x = swing;
      if (legs[1]) legs[1].rotation.x = -swing;
      // A player car clipping a ped knocks them down and draws the law.
      if (pc) {
        const d = Math.hypot(ped.x - pc.x, ped.z - pc.z);
        if (d < 2.1 && Math.hypot(pc.vx, pc.vz) > 4) {
          ped.down = true;
          ped.downTimer = 6;
          ped.mesh.rotation.z = Math.PI / 2 * 0.9;
          this.world.wanted = Math.min(5, this.world.wanted + 1);
          this.world.hud.toast('Pedestrian down! The law noticed.');
          this.world.sfx.noise(0.2, 0.3, 900);
        }
      }
    }
  }
}
