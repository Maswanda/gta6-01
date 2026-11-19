// side.js — Solmar Bay: the side hustles.
// Two ways to earn outside the story: taxi fares (pick a rider up, drop
// them off, get paid by the distance) and ten bay coins hidden around
// the landmarks. A fare only runs while the player stays in a car.
import * as THREE from 'three';
import { randomRoadPoint } from './city.js';

const COIN_SPOTS = [
  [-224, 224], [224, -224], [-224, -224], [224, 224],
  [-96, 192], [192, 224], [0, 0], [128, 128],
  [-128, -128], [64, -192],
];

export class SideHustles {
  constructor(world) {
    this.world = world;
    this.fare = null; // { phase, ped, x, z, dest, pay }
    this.fareTimer = 12; // first fare after 12s
    this.coins = [];
    for (const [x, z] of COIN_SPOTS) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.9, 0.9),
        new THREE.MeshBasicMaterial({ color: 0xffd76a }),
      );
      mesh.position.set(x, 1.1, z);
      world.stage.scene.add(mesh);
      this.coins.push({ x, z, mesh, got: false, bob: Math.random() * 6 });
    }
    this.coinsGot = 0;
  }
  spawnFare() {
    const w = this.world;
    const p = randomRoadPoint(w.layout, w.dice);
    const ped = w.stage.makePed(0xe8e0d0);
    ped.position.set(p.x, 0, p.z);
    const dest = randomRoadPoint(w.layout, w.dice);
    const pay = 80 + Math.floor(Math.hypot(dest.x - p.x, dest.z - p.z) / 4);
    this.fare = { phase: 'pickup', ped, x: p.x, z: p.z, dest, pay };
    w.hud.toast('Taxi fare waiting — pick them up!');
  }
  clearFare(paid) {
    const w = this.world;
    if (!this.fare) return;
    if (paid) {
      w.cash += this.fare.pay;
      w.sfx.cash();
      w.hud.toast(`Fare paid: $${this.fare.pay}`);
    }
    w.stage.scene.remove(this.fare.ped);
    this.fare = null;
    this.fareTimer = 25;
  }
  update(dt) {
    const w = this.world;
    const p = w.player;
    // Taxi fares.
    if (!this.fare) {
      this.fareTimer -= dt;
      if (this.fareTimer <= 0 && p.inCar && w.started && !w.ended) this.spawnFare();
    } else {
      if (!p.inCar) {
        this.clearFare(false);
        w.hud.toast('Fare cancelled — you left the car.');
      } else if (this.fare.phase === 'pickup') {
        const d = Math.hypot(p.x - this.fare.x, p.z - this.fare.z);
        if (d < 5) {
          this.fare.phase = 'dropoff';
          w.stage.scene.remove(this.fare.ped);
          w.hud.toast('Rider aboard — take them to the marker.');
          w.sfx.pickup();
        }
      } else {
        const d = Math.hypot(p.x - this.fare.dest.x, p.z - this.fare.dest.z);
        if (d < 8) this.clearFare(true);
      }
    }
    // Bay coins.
    for (const c of this.coins) {
      if (c.got) continue;
      c.bob += dt * 2.5;
      c.mesh.position.y = 1.1 + Math.sin(c.bob) * 0.2;
      c.mesh.rotation.y += dt * 1.5;
      const d = Math.hypot(p.x - c.x, p.z - c.z);
      if (d < 2.6) {
        c.got = true;
        this.coinsGot++;
        w.stage.scene.remove(c.mesh);
        w.cash += 100;
        w.sfx.pickup();
        w.hud.toast(`Bay coin ${this.coinsGot}/10 (+$100)`);
        if (this.coinsGot >= COIN_SPOTS.length) {
          w.cash += 1000;
          w.hud.banner('ALL BAY COINS', 'Every coin found — +$1,000 bonus.');
        }
      }
    }
  }
  sideObjective() {
    if (!this.fare) return null;
    if (this.fare.phase === 'pickup') {
      return { x: this.fare.x, z: this.fare.z, text: 'Taxi fare — pick up the rider' };
    }
    return { x: this.fare.dest.x, z: this.fare.dest.z, text: 'Taxi fare — drop the rider off' };
  }
}
