// Pedestrians: Solmar Bay locals with real variety — different heights,
// skin tones, shirts and a few hats, plus joggers who run the beachfront
// and a couple of regulars waiting at the bus stops. They stroll the
// sidewalks, turn at intersections, and scatter from a fast car, a gunshot
// — or the helicopter's searchlight sweeping the street. Hit one with a
// car and the wanted level rises.
import { CFG, STREET_LINES } from './config.js';
import { collideCircle } from './city.js';

const SHIRTS = [0xd8d8d8, 0x4a6fa5, 0xc27a3a, 0x7a4a8a, 0x4a8a5a, 0xc24a6a, 0x8a8a3a, 0x3a8a8a, 0xd8b23a];
const SKINS = [0xc98a5e, 0x8a5a3a, 0xe8b88a, 0x6a4530, 0xd8a878];
const PANTS = [0x333a44, 0x2e3a5e, 0x4a3a2a, 0x5a5a5a, 0x7a2a2a];
const HAT_COLORS = [0x22242a, 0xc23b2e, 0xe8c33a];

export class Pedestrians {
  constructor(scene, rng, colliders) {
    this.scene = scene;
    this.colliders = colliders;
    this.list = [];
    for (let i = 0; i < CFG.pedCount; i += 1) {
      this.list.push(this.spawnOne(rng));
    }
    // Two regulars waiting at the bus stop by the bank.
    for (const [x, z] of [[20, -18], [22, -14]]) {
      const p = this.spawnOne(rng);
      p.pos.set(x, 0, z);
      p.mesh.position.copy(p.pos);
      p.waiting = true;
      p.speed = 0;
      this.list.push(p);
    }
  }

  spawnOne(rng) {
    // All the random draws first, in a fixed order, so the seeded layout
    // is identical on every load; the mesh is built from the draws after.
    const line = rng.pick(STREET_LINES);
    const side = rng.chance(0.5) ? 1 : -1;
    const along = rng.range(-CFG.cityHalf, CFG.cityHalf);
    const horizontal = rng.chance(0.5);
    const heading = horizontal
      ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2)
      : (rng.chance(0.5) ? 0 : Math.PI);
    const jogger = rng.chance(0.16);
    const height = rng.around(1, 0.12);
    const shirtColor = rng.pick(SHIRTS);
    const skinColor = rng.pick(SKINS);
    const hasHat = rng.chance(0.25);
    const hatColor = hasHat ? rng.pick(HAT_COLORS) : null;
    const pantsColor = rng.pick(PANTS);
    const speed = (jogger ? CFG.pedSpeed * 2.6 : CFG.pedSpeed) * rng.range(0.8, 1.3);

    const offset = CFG.streetWidth / 2 + 1.6;
    const pos = horizontal
      ? new THREE.Vector3(along, 0, line + side * offset)
      : new THREE.Vector3(line + side * offset, 0, along);
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
    const skin = new THREE.MeshLambertMaterial({ color: skinColor });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.8, 0.34), shirt);
    body.position.y = 1.05;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skin);
    head.position.y = 1.62;
    g.add(head);
    if (hasHat) {
      const hat = new THREE.Mesh(
        new THREE.CylinderGeometry(0.26, 0.3, 0.12, 10),
        new THREE.MeshLambertMaterial({ color: hatColor }),
      );
      hat.position.y = 1.82;
      g.add(hat);
    }
    const legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.65, 0.3),
      new THREE.MeshLambertMaterial({ color: pantsColor }),
    );
    legs.position.y = 0.32;
    g.add(legs);
    g.position.copy(pos);
    g.rotation.y = heading;
    g.scale.set(1, height, 1);
    this.scene.add(g);
    return {
      mesh: g, pos, heading, speed,
      axis: horizontal ? 'x' : 'z',
      line, side, offset,
      flee: 0, down: 0, downTimer: 0,
      jogger, waiting: false, height,
    };
  }

  update(dt, world) {
    const playerPos = world.player.inCar ? world.player.inCar.pos : world.player.pos;
    const playerSpeed = world.player.inCar ? Math.abs(world.player.inCar.speed) : world.player.speed;
    // When the chopper's searchlight sweeps the street, the locals run
    // from the lit patch — the sky itself is a scare now.
    if (world.heli && world.heli.active) {
      const lit = world.heli.litPos();
      if (lit) this.scatterFrom(lit, 18);
    }
    for (const p of this.list) {
      this.stepPed(p, dt, world, playerPos, playerSpeed);
    }
  }

  stepPed(p, dt, world, playerPos, playerSpeed) {
    if (p.down > 0) {
      p.downTimer += dt;
      p.mesh.rotation.x = Math.min(Math.PI / 2, p.mesh.rotation.x + dt * 4);
      if (p.downTimer > 4) {
        p.down = 0;
        p.downTimer = 0;
        p.mesh.rotation.x = 0;
        p.flee = 3;
      }
      return;
    }
    if (p.waiting && p.flee <= 0) {
      // The regulars just stand there, watching the street.
      p.mesh.rotation.y += dt * 0.2;
      return;
    }
    const dx = p.pos.x - playerPos.x;
    const dz = p.pos.z - playerPos.z;
    const d = Math.hypot(dx, dz);
    if ((playerSpeed > 7 && d < 12) || (world.gunshotTimer > 0 && d < 18)) p.flee = 2.5;
    let speed = p.speed;
    let heading = p.heading;
    if (p.flee > 0) {
      p.flee -= dt;
      speed = 4.2;
      // Flee from a crime scene when one scared them, else from the player.
      const from = p.fleeFrom || playerPos;
      heading = Math.atan2(p.pos.x - from.x, p.pos.z - from.z);
      if (p.flee <= 0) p.fleeFrom = null;
    } else {
      const along = p.axis === 'x' ? p.pos.x : p.pos.z;
      if (along > CFG.cityHalf || along < -CFG.cityHalf) p.heading += Math.PI;
    }
    p.heading = heading;
    const nx = p.pos.x + Math.sin(heading) * speed * dt;
    const nz = p.pos.z + Math.cos(heading) * speed * dt;
    const probe = new THREE.Vector3(nx, 0, nz);
    if (!collideCircle(probe, 0.5, this.colliders)) {
      p.pos.copy(probe);
    } else {
      p.heading += Math.PI / 2;
    }
    p.mesh.position.copy(p.pos);
    p.mesh.rotation.y = p.heading;
    // Walk-cycle bob.
    const t = performance.now() / 1000;
    p.mesh.position.y = Math.abs(Math.sin(t * (p.jogger ? 10 : 6) + p.pos.x)) * 0.06;
  }

  // A car hit: the pedestrian goes down, the law notices.
  hitByCar(carPos, speed) {
    for (const p of this.list) {
      if (p.down > 0) continue;
      const d = Math.hypot(p.pos.x - carPos.x, p.pos.z - carPos.z);
      if (d < 2.2 && speed > 6) {
        p.down = 1;
        p.downTimer = 0;
        return true;
      }
    }
    return false;
  }

  // Scatter every pedestrian near a point — a crime scene empties the
  // sidewalk. The crime system calls this while an event is active.
  scatterFrom(pos, radius) {
    for (const p of this.list) {
      if (p.down > 0 || p.isCrime) continue;
      const d = Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z);
      if (d < radius) {
        p.flee = 2;
        p.fleeFrom = pos;
      }
    }
  }
}
