// garage.js — Rico's Garage: buy, sell and select vehicles, plus the
// safehouse rest logic (the garage module owns the player's property).
// Owned cars and the selection persist through the save system.
import { TUNE, dist2d } from './tuning.js';

export class Garage {
  constructor(world) {
    this.world = world;
    this.owned = [...TUNE.garageStartOwned];
    this.selected = this.owned[0] || null;
    this._uiOpen = false;
  }
  state() {
    return { owned: [...this.owned], selected: this.selected };
  }
  reset(world) {
    // Wipe the in-memory garage so a load() from storage is the only
    // source of truth afterwards (used by the save/load check).
    this.owned = [];
    this.selected = null;
  }
  canAfford(id) {
    const spec = TUNE.vehicles[id];
    return spec && this.world.player.cash >= spec.price;
  }
  buyVehicle(id) {
    const spec = TUNE.vehicles[id];
    if (!spec) return false;
    if (this.owned.includes(id)) return false;
    if (this.world.player.cash < spec.price) return false;
    this.world.player.cash -= spec.price;
    this.owned.push(id);
    this.selected = id;
    this.world.audio.cash();
    this.world.hud.toast(spec.label + ' is yours — $' + spec.price.toLocaleString('en-US'));
    return true;
  }
  sellVehicle(id) {
    const spec = TUNE.vehicles[id];
    if (!spec || !this.owned.includes(id)) return false;
    if (this.owned.length <= 1) {
      this.world.hud.toast('Keep at least one car in the garage.');
      return false;
    }
    this.owned = this.owned.filter((v) => v !== id);
    const refund = Math.floor(spec.price * 0.6);
    this.world.player.cash += refund;
    if (this.selected === id) this.selected = this.owned[0];
    this.world.audio.cash();
    this.world.hud.toast(spec.label + ' sold for $' + refund.toLocaleString('en-US'));
    return true;
  }
  selectVehicle(id) {
    if (!this.owned.includes(id)) return false;
    this.selected = id;
    this.world.hud.toast(TUNE.vehicles[id].label + ' selected');
    return true;
  }
  // Open the garage UI when the player is at the garage and presses E.
  // Not while the story wants a talk at the garage (Rico's ledger).
  tryOpen() {
    const p = this.world.player;
    const g = TUNE.landmarks.garage;
    if (dist2d(p.pos.x, p.pos.z, g.x, g.z) > 18) return false;
    const step = this.world.missions.currentStep;
    if (step && step.kind === 'talk' && step.at === 'garage') return false;
    this.openUI();
    return true;
  }
  openUI() {
    const world = this.world;
    const list = document.getElementById('garage-list');
    if (!list) return;
    let html = '';
    for (const [id, spec] of Object.entries(TUNE.vehicles)) {
      const has = this.owned.includes(id);
      const sel = this.selected === id;
      html += '<div class="garage-row">' +
        '<span class="garage-name">' + spec.label + (sel ? ' ★' : '') + '</span>' +
        '<span class="garage-price">' + (has ? 'OWNED' : '$' + spec.price.toLocaleString('en-US')) + '</span>' +
        (has
          ? '<button class="hud-btn-small" data-act="select" data-id="' + id + '">SELECT</button>' +
            (this.owned.length > 1 ? '<button class="hud-btn-small" data-act="sell" data-id="' + id + '">SELL</button>' : '')
          : '<button class="hud-btn-small" data-act="buy" data-id="' + id + '">BUY</button>') +
        '</div>';
    }
    list.innerHTML = html;
    list.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => {
        const act = b.dataset.act;
        const id = b.dataset.id;
        if (act === 'buy') this.buyVehicle(id);
        if (act === 'sell') this.sellVehicle(id);
        if (act === 'select') this.selectVehicle(id);
        this.openUI();
      });
    });
    world.hud.showGarage(true);
    this._uiOpen = true;
  }
  closeUI() {
    this.world.hud.showGarage(false);
    this._uiOpen = false;
  }
  get uiOpen() {
    return this._uiOpen;
  }
}
