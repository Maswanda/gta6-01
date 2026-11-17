// Pedestrians: Solmar Bay locals strolling the sidewalks. They walk along
// street edges, turn at intersections, and scatter when a car bears down on
// them or a gun goes off. Hit one with a car and the wanted level rises.
import { CFG, STREET_LINES } from './config.js';
import { collideCircle } from './city.js';

const SHIRTS = [0xd8d8d8, 0x4a6fa5, 0xc27a3a, 0x7a4a8a, 0x4a8a5a, 0xc24a6a, 0x8a8a3a];

export class Pedestrians {
  constructor(scene, rng, colliders) {
    this.scene = scene;
    this.colliders = colliders;
    this.list = [];
    for (let i = 0; i < CFG.pedCount; i++) {
      this.list.push(this.spawnOne(rng, true));
    }
  }

  spawnOne(rng, anywhere) {
    const line = rng.pick(STREET_LINES);
    const side = rng.chance(0.5) ? 1 : -1;
    const offset = CFG.streetWidth / 2 + 1.6;
    const along = anywhere
      ? rng.range(-CFG.cityHalf, CFG.cityHalf)
      : rng.range(-CFG.cityHalf, CFG.cityHalf);
    const horizontal = rng.chance(0.5);
    const pos = horizontal
      ? new THREE.Vector3(along, 0, line + side * offset)
      : new THREE.Vector3(line + side * offset, 0, along);
    const heading = horizontal ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI);
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: rng.pick(SHIRTS) });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5e });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.8, 0.34), shirt);
    body.position.y = 1.05;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skin);
    head.position.y = 1.62;
    g.add(head);
    const legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.65, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x333a44 }),
    );
    legs.position.y = 0.32;
    g.add(legs);
    g.position.copy(pos);
    g.rotation.y = heading;
    this.scene.add(g);
    return {
      mesh: g, pos, heading,
      speed: CFG.pedSpeed * rng.range(0.8, 1.3),
      axis: horizontal ? 'x' : 'z',
      line, side, offset,
      flee: 0, down: 0, downTimer: 0,
    };
  }

  update(dt, world) {
    const playerPos = world.player.inCar ? world.player.inCar.pos : world.player.pos;
    const playerSpeed = world.player.inCar ? Math.abs(world.player.inCar.speed) : world.player.speed;
    for (const p of this.list) {
      if (p.down > 0) {
        p.downTimer += dt;
        p.mesh.rotation.x = Math.min(Math.PI / 2, p.mesh.rotation.x + dt * 4);
        if (p.downTimer > 4) {
          // Get back up and walk away from the trouble.
          p.down = 0;
          p.downTimer = 0;
          p.mesh.rotation.x = 0;
          p.flee = 3;
        }
        continue;
      }
      // Flee from a fast car or from gunfire nearby.
      const dx = p.pos.x - playerPos.x;
      const dz = p.pos.z - playerPos.z;
      const d = Math.hypot(dx, dz);
      if ((playerSpeed > 7 && d < 12) || (world.gunshotTimer > 0 && d < 18)) p.flee = 2.5;
      let speed = p.speed;
      let heading = p.heading;
      if (p.flee > 0) {
        p.flee -= dt;
        speed = 4.2;
        heading = Math.atan2(dx, dz);
      } else {
        // Stroll along the sidewalk; turn around at the city edge.
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
    }
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
}
