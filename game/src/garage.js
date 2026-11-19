// Garage: buy / sell / select vehicles, persisted in the save. Owned
// vehicles are real cars parked at the garage; selecting one makes it the
// player's ride when they leave the garage.
import { VEHICLES, T } from './tuning.js';

export class Garage {
  constructor(world) {
    this.world = world;
    this.owned = [];
    this.selected = null;
  }

  state() {
    return { owned: [...this.owned], selected: this.selected };
  }

  price(id) {
    return VEHICLES[id] ? VEHICLES[id].price : null;
  }

  buy(id) {
    const w = this.world;
    const v = VEHICLES[id];
    if (!v || this.owned.includes(id)) return false;
    if (w.player.cash < v.price) return false;
    w.player.cash -= v.price;
    this.owned.push(id);
    this.selected = id;
    this.syncOwnedCars();
    w.audio.blip(520, 0.1, 'square', 0.2);
    return true;
  }

  sell(id) {
    const w = this.world;
    const v = VEHICLES[id];
    if (!v || !this.owned.includes(id)) return false;
    this.owned = this.owned.filter((o) => o !== id);
    if (this.selected === id) this.selected = this.owned[0] || null;
    w.player.cash += Math.round(v.price * T.vehicleSellBack);
    this.syncOwnedCars();
    return true;
  }

  select(id) {
    if (!this.owned.includes(id)) return false;
    this.selected = id;
    return true;
  }

  reset(world) {
    this.owned = [];
    this.selected = null;
    this.syncOwnedCars();
  }

  // Owned cars sit parked in a row by the garage; unowned ones are removed.
  syncOwnedCars() {
    const w = this.world;
    if (!w || !w.scene) return;
    // Remove previously spawned owned cars.
    for (const car of [...w.allCars]) {
      if (car.ownedByGarage) {
        car.alive = false;
        if (car.mesh) car.mesh.visible = false;
        const i = w.allCars.indexOf(car);
        if (i >= 0) w.allCars.splice(i, 1);
      }
    }
    const g = w.city.landmarkPos('garage');
    this.owned.forEach((id, i) => {
      const v = VEHICLES[id];
      if (!v) return;
      const car = w.game.spawnParkedCar(g.x - 24 + i * 9, g.z + 26, id, v.color);
      if (car) car.ownedByGarage = true;
    });
  }
}
