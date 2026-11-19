// garage.js — Solmar Bay: Rico's Garage and the safehouse.
// The garage sells the four cars (a daily deal is 20% off), buys them
// back at 60%, and lets the player pick which owned car is theirs.
// The safehouse is a breather: rest heals, cools two wanted stars and
// saves the game. Both open with a key when the player is close.
import { TUNE } from './tuning.js';

export class RicoGarage {
  constructor(world) {
    this.world = world;
    const types = Object.keys(TUNE.cars);
    world.garage = {
      owned: ['sedan'],
      selected: 'sedan',
      deal: types[Math.floor(Math.random() * types.length)],
    };
    this.lastDay = 0;
    this.spawned = {}; // type -> car entity on the forecourt
    this.spawnOwned('sedan');
  }
  dealPrice(type) {
    const spec = TUNE.cars[type];
    if (this.world.garage.deal === type) return Math.floor(spec.price * (1 - TUNE.garage.dailyDealDiscount));
    return spec.price;
  }
  spawnOwned(type) {
    if (this.spawned[type]) return this.spawned[type];
    const g = this.world.layout.places.garage;
    const idx = Object.keys(this.spawned).length;
    const car = this.world.drive.createCar(type, g.x - 10 + idx * 7, g.z + 12, Math.PI);
    this.spawned[type] = car;
    return car;
  }
  buy(type) {
    const w = this.world;
    const g = w.garage;
    if (g.owned.includes(type)) {
      this.select(type);
      return;
    }
    const price = this.dealPrice(type);
    if (w.cash < price) {
      w.sfx.denied();
      w.hud.toast(`Need $${price.toLocaleString('en-US')} for the ${TUNE.cars[type].label}.`);
      return;
    }
    w.cash -= price;
    g.owned.push(type);
    g.selected = type;
    this.spawnOwned(type);
    w.sfx.cash();
    w.hud.toast(`Bought the ${TUNE.cars[type].label} — it is on the forecourt.`);
    w.hud.showGarage(true, this.uiData());
  }
  sell(type) {
    const w = this.world;
    const g = w.garage;
    if (!g.owned.includes(type)) return;
    if (g.owned.length <= 1) {
      w.sfx.denied();
      w.hud.toast('Cannot sell your last ride.');
      return;
    }
    const price = Math.floor(TUNE.cars[type].price * TUNE.garage.sellBack);
    w.cash += price;
    g.owned = g.owned.filter((t) => t !== type);
    if (g.selected === type) g.selected = g.owned[0];
    if (this.spawned[type]) {
      w.drive.removeCar(this.spawned[type]);
      delete this.spawned[type];
    }
    w.sfx.cash();
    w.hud.toast(`Sold the ${TUNE.cars[type].label} for $${price.toLocaleString('en-US')}.`);
    w.hud.showGarage(true, this.uiData());
  }
  select(type) {
    const w = this.world;
    if (!w.garage.owned.includes(type)) return;
    w.garage.selected = type;
    this.spawnOwned(type);
    w.sfx.click();
    w.hud.toast(`${TUNE.cars[type].label} selected — on the forecourt.`);
    w.hud.showGarage(true, this.uiData());
  }
  uiData() {
    const g = this.world.garage;
    return {
      cars: Object.entries(TUNE.cars).map(([type, spec]) => ({ type, label: spec.label, price: this.dealPrice(type) })),
      owned: [...g.owned],
      selected: g.selected,
      deal: g.deal ? { type: g.deal, label: TUNE.cars[g.deal].label, price: TUNE.cars[g.deal].price } : null,
    };
  }
  rest() {
    const w = this.world;
    w.walker.heal(100);
    w.walker.addArmor(50);
    w.wanted = Math.max(0, w.wanted - 2);
    w.hour = (w.hour + 2) % 24;
    w.persist.save();
    w.sfx.pickup();
    w.hud.toast('Rested at the safehouse — healed, cooled down, saved.');
    w.hud.banner('SAFEHOUSE', 'Health restored. Heat cooled. Game saved.');
  }
  update(dt) {
    const w = this.world;
    // Rotate the daily deal when the day turns.
    const day = Math.floor(w.elapsed / TUNE.day.dayLengthSec);
    if (day !== this.lastDay) {
      this.lastDay = day;
      const types = Object.keys(TUNE.cars);
      w.garage.deal = types[Math.floor(Math.random() * types.length)];
    }
    const p = w.player;
    const g = w.layout.places.garage;
    const s = w.layout.places.safehouse;
    const dg = Math.hypot(p.x - g.x, p.z - g.z);
    const ds = Math.hypot(p.x - s.x, p.z - s.z);
    if (dg < 14 && w.input.wasPressed('KeyG')) {
      w.hud.showGarage(true, this.uiData());
      w.sfx.click();
    }
    if (ds < 10 && w.input.wasPressed('KeyH')) {
      this.rest();
    }
    if (dg < 14) w.hint = 'Press G — Rico\'s Garage';
    else if (ds < 10) w.hint = 'Press H — Safehouse: rest & cool down';
    else if (!w.hintLocked) w.hint = '';
  }
}
