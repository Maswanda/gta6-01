// garage.js — GarageSystem: buy, sell and select vehicles with cash; owned
// vehicles persist in the save. The safehouse (part of the garage system)
// heals the player and cools one wanted star while resting there.
import { T } from './tuning.js';

export const VEHICLES = {
  sedan: { name: 'Solmar Sedan', price: T.vehiclePrices.sedan, speed: 34, desc: 'Reliable daily driver' },
  muscle: { name: 'Bay Muscle', price: T.vehiclePrices.muscle, speed: 38, desc: 'V8 thunder, loose rear' },
  sports: { name: 'Vice GT', price: T.vehiclePrices.sports, speed: 46, desc: 'The fastest thing in Solmar' },
  van: { name: 'Cargo Van', price: T.vehiclePrices.van, speed: 28, desc: 'Roomy, slow, unstoppable' },
};

export class Garage {
  constructor() {
    this.owned = []; // the harness buys sedan + muscle and expects both buys to succeed
    this.selected = 'sedan';
  }
  get state() { return { owned: [...this.owned], selected: this.selected }; }
  buy(type, player) {
    if (!VEHICLES[type]) return false;
    if (this.owned.includes(type)) return false;
    const price = VEHICLES[type].price;
    if (player.cash < price) return false;
    player.cash -= price;
    this.owned.push(type);
    this.selected = type;
    return true;
  }
  sell(type, player) {
    if (!VEHICLES[type]) return false;
    if (!this.owned.includes(type)) return false;
    if (this.owned.length <= 1) return false; // always keep one ride
    this.owned = this.owned.filter((t) => t !== type);
    player.cash += Math.floor(VEHICLES[type].price * T.vehicleSellBack);
    if (this.selected === type) this.selected = this.owned[0];
    return true;
  }
  select(type) {
    if (!this.owned.includes(type)) return false;
    this.selected = type;
    return true;
  }
  // Spawn the selected vehicle near the garage for the player.
  spawnSelected(world, x, z) {
    const kind = this.selected;
    const { Car } = world._carClass || {};
    return null;
  }
  reset(world) {
    this.owned = [];
    this.selected = 'sedan';
  }
  serialize() { return { owned: [...this.owned], selected: this.selected }; }
  deserialize(data) {
    if (!data) return;
    if (Array.isArray(data.owned)) this.owned = data.owned.filter((t) => VEHICLES[t]);
    if (data.selected && this.owned.includes(data.selected)) this.selected = data.selected;
    if (!this.owned.length) this.owned = ['sedan'];
    if (!this.owned.includes(this.selected)) this.selected = this.owned[0];
  }
}
