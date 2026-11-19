// GarageSystem — Rico's Garage: the place where the story's money becomes
// metal. The player buys, sells and chooses cars with cash, the cars they
// own persist in the save, and the safehouse next door is where the heat
// comes off: standing there heals Jax and, every ten seconds, drops one
// wanted star. The garage also runs a daily deal — one car at a discount,
// picked by the seeded RNG so every load of the same seed agrees. The panel
// is plain DOM over the canvas; B opens it at the garage, and the same
// panel is what screenshot 4 shows.
import { CFG } from './config.js';
import { Rng } from './random.js';
import { spawnOwnedCar } from './vehicles.js';

export const GARAGE_STOCK = [
  { id: 'sedan', type: 'sedan', name: 'Solmar Sedan', price: 800 },
  { id: 'van', type: 'van', name: 'Harbor Van', price: 600 },
  { id: 'truck', type: 'truck', name: 'Dock Truck', price: 1200 },
  { id: 'sports', type: 'sports', name: 'Marina GT', price: 2500 },
  { id: 'muscle', type: 'muscle', name: 'Sunset GT', price: 4000 },
];

export class GarageSystem {
  constructor(scene, landmarks, seed) {
    this.scene = scene;
    this.landmarks = landmarks;
    this.owned = [];
    this.activeId = null;
    this.panelOpen = false;
    this.restTimer = 0;
    this.spawned = {}; // garageId -> Car, for cars bought in this session
    this.dealId = null;
    const rng = new Rng(seed || 11);
    this.dealId = rng.weightedPick(GARAGE_STOCK.map((s) => ({ item: s.id, weight: 1 })));
    this.panelEl = document.getElementById('garage-panel');
    this.listEl = document.getElementById('garage-list');
    const closeBtn = document.getElementById('garage-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.closePanel());
    if (this.listEl) {
      this.listEl.addEventListener('click', (ev) => {
        const btn = ev.target.closest('button[data-act]');
        if (!btn) return;
        const id = btn.dataset.id;
        const act = btn.dataset.act;
        const world = window.__solmar && window.__solmar.world;
        if (!world) return;
        if (act === 'buy') this.buy(id, world);
        else if (act === 'sell') this.sell(id, world);
        else if (act === 'select') this.select(id, world);
      });
    }
  }

  item(id) {
    return GARAGE_STOCK.find((s) => s.id === id);
  }

  priceOf(item) {
    if (item.id === this.dealId) return Math.round(item.price * (1 - CFG.garageDealPct));
    return item.price;
  }

  isDeal(item) {
    return item.id === this.dealId;
  }

  // Open the panel — only at Rico's, on foot or in a car.
  togglePanel(world) {
    if (this.panelOpen) {
      this.closePanel();
      return;
    }
    const g = this.landmarks.garage;
    const p = world.player.inCar ? world.player.inCar.pos : world.player.pos;
    if (!g || Math.hypot(p.x - g.x, p.z - g.z) > CFG.garageRadius + 14) {
      world.hud.flashMessage("Rico's garage is on the north side — get there first (B).");
      return;
    }
    this.openPanel(world);
  }

  openPanel(world) {
    this.panelOpen = true;
    this.renderPanel(world);
    if (this.panelEl) this.panelEl.style.display = 'block';
  }

  closePanel() {
    this.panelOpen = false;
    if (this.panelEl) this.panelEl.style.display = 'none';
  }

  // Rebuild the panel's rows: name, price (with the daily deal struck
  // through), and the action that fits — buy, select, or sell.
  renderPanel(world) {
    if (!this.listEl) return;
    const cash = world.player.cash;
    const rows = GARAGE_STOCK.map((s) => {
      const price = this.priceOf(s);
      const owned = this.owned.includes(s.id);
      const active = this.activeId === s.id;
      const deal = this.isDeal(s) ? ' <span class="deal">DEAL −20%</span>' : '';
      let action = '';
      if (!owned) {
        action = `<button data-act="buy" data-id="${s.id}" ${cash < price ? 'disabled' : ''}>Buy $${price}</button>`;
      } else if (active) {
        action = `<button data-act="sell" data-id="${s.id}">Sell $${Math.round(price * CFG.garageSellBack)}</button> <span class="active-car">IN USE</span>`;
      } else {
        action = `<button data-act="select" data-id="${s.id}">Select</button> <button data-act="sell" data-id="${s.id}">Sell $${Math.round(price * CFG.garageSellBack)}</button>`;
      }
      return `<div class="garage-row"><span class="garage-name">${s.name}${deal}</span><span class="garage-price">$${price}</span>${action}</div>`;
    }).join('');
    this.listEl.innerHTML = rows +
      `<div class="garage-foot">Cash: $${cash} · Owned: ${this.owned.length} · Sell returns 60% · The daily deal changes each load.</div>`;
  }

  // Buy a car: pay, own it, and put it on the street outside Rico's.
  buy(id, world) {
    const s = this.item(id);
    if (!s || this.owned.includes(id)) return false;
    const price = this.priceOf(s);
    if (world.player.cash < price) {
      world.hud.flashMessage(`Not enough cash — the ${s.name} is $${price}.`);
      return false;
    }
    world.player.cash -= price;
    this.owned.push(id);
    this.activeId = id;
    this.spawnCar(id, world);
    world.hud.showBanner('NEW RIDE', `The ${s.name} is yours — $${price}. Keys are in the ignition.`);
    world.sound.jingle();
    world.save.save();
    this.renderPanel(world);
    return true;
  }

  // Sell a car back to Rico for 60%: it leaves the street and the list.
  sell(id, world) {
    const s = this.item(id);
    if (!s || !this.owned.includes(id)) return false;
    const back = Math.round(this.priceOf(s) * CFG.garageSellBack);
    const car = this.spawned[id];
    if (car) {
      this.scene.remove(car.mesh);
      const i = world.allCars.indexOf(car);
      if (i >= 0) world.allCars.splice(i, 1);
      delete this.spawned[id];
    }
    this.owned = this.owned.filter((o) => o !== id);
    if (this.activeId === id) this.activeId = this.owned.length ? this.owned[0] : null;
    world.player.cash += back;
    world.hud.flashMessage(`Sold the ${s.name} back to Rico — +$${back}.`);
    world.sound.chime();
    world.save.save();
    this.renderPanel(world);
    return true;
  }

  // Choose which owned car is the active one; if it is not on the street,
  // Rico rolls it out of the garage.
  select(id, world) {
    if (!this.owned.includes(id)) return false;
    this.activeId = id;
    if (!this.spawned[id]) this.spawnCar(id, world);
    const s = this.item(id);
    world.hud.flashMessage(`${s.name} ready outside Rico's.`);
    world.save.save();
    this.renderPanel(world);
    return true;
  }

  // Put an owned car on the street outside the garage, in a free spot.
  spawnCar(id, world) {
    const s = this.item(id);
    if (!s) return null;
    const g = this.landmarks.garage;
    const slot = Object.keys(this.spawned).length;
    const x = g.x + 16 + (slot % 2) * 6;
    const z = g.z + 8 + Math.floor(slot / 2) * 7;
    const car = spawnOwnedCar(this.scene, s.type, x, z, id);
    car.mesh.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    world.allCars.push(car);
    this.spawned[id] = car;
    return car;
  }

  // Bring back every car the save says the player owns.
  respawnOwned(world) {
    for (const id of this.owned) {
      if (!this.spawned[id]) this.spawnCar(id, world);
    }
  }

  // True while the player is sheltering at the safehouse.
  atSafehouse(world) {
    const L = this.landmarks.safehouse;
    if (!L) return false;
    const p = world.player.inCar ? world.player.inCar.pos : world.player.pos;
    return Math.hypot(p.x - L.x, p.z - L.z) < CFG.safehouseRadius;
  }

  // Near the garage: offer the panel. At the safehouse: rest — heal, and
  // cool one wanted star every ten seconds. The player rests only while
  // standing still there; driving off ends it.
  update(dt, world) {
    const p = world.player.inCar ? world.player.inCar.pos : world.player.pos;
    const g = this.landmarks.garage;
    if (g && !this.panelOpen && Math.hypot(p.x - g.x, p.z - g.z) < CFG.garageRadius) {
      world.hud.setPrompt("Press B — Rico's garage (buy / sell / choose a car)");
    }
    const resting = this.atSafehouse(world);
    world.player.resting = resting;
    if (!resting) {
      this.restTimer = 0;
      return;
    }
    world.player.heal(dt * CFG.safehouseHealRate);
    if (world.police.wanted > 0) {
      this.restTimer += dt;
      if (this.restTimer >= CFG.safehouseStarSeconds) {
        this.restTimer = 0;
        world.police.wanted = Math.max(0, world.police.wanted - 1);
        world.police.syncCars(world);
        world.hud.flashMessage('Safehouse — the heat is cooling off…');
      }
    }
  }

  getSave() {
    return { owned: [...this.owned], activeId: this.activeId, dealId: this.dealId };
  }

  applySave(d) {
    if (!d) return;
    this.owned = Array.isArray(d.owned) ? d.owned.slice() : [];
    this.activeId = d.activeId || null;
    if (d.dealId) this.dealId = d.dealId;
  }

  reset(world) {
    this.owned = [];
    this.activeId = null;
    this.restTimer = 0;
    this.closePanel();
    for (const id of Object.keys(this.spawned)) {
      this.scene.remove(this.spawned[id].mesh);
      if (world) {
        const i = world.allCars.indexOf(this.spawned[id]);
        if (i >= 0) world.allCars.splice(i, 1);
      }
    }
    this.spawned = {};
  }
}
