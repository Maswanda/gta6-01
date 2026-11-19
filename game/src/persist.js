// persist.js — Solmar Bay: the save slot (localStorage, one key).
// Cash, the garage, the weapons, the missions done and the clock.
// Everything is guarded: a browser without storage just plays unsaved.
import { TUNE } from './tuning.js';

export class SaveSlot {
  constructor(world) {
    this.world = world;
    this.key = TUNE.save.key;
  }
  save() {
    const w = this.world;
    try {
      const data = {
        cash: Math.floor(w.cash),
        garage: { owned: [...w.garage.owned], selected: w.garage.selected },
        weapons: { ...(w.player.weapons || { pistol: Infinity }) },
        weapon: w.player.weapon || 'pistol',
        missionsDone: w.stats.missionsDone || 0,
        storyComplete: !!w.storyComplete,
        coinsGot: w.side ? w.side.coinsGot : 0,
        hour: w.hour,
      };
      // Infinity is not JSON: store the pistol as -1.
      if (data.weapons.pistol === Infinity) data.weapons.pistol = -1;
      localStorage.setItem(this.key, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }
  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.weapons && data.weapons.pistol === -1) data.weapons.pistol = Infinity;
      return data;
    } catch {
      return null;
    }
  }
  apply(data) {
    if (!data) return;
    const w = this.world;
    if (typeof data.cash === 'number') w.cash = data.cash;
    if (data.garage && Array.isArray(data.garage.owned) && data.garage.owned.length > 0) {
      w.garage.owned = data.garage.owned;
      w.garage.selected = data.garage.selected || data.garage.owned[0];
      for (const t of w.garage.owned) w.garage.spawnOwned(t);
    }
    if (data.weapons) {
      w.player.weapons = data.weapons;
      w.player.weapon = data.weapon || 'pistol';
    }
    if (typeof data.missionsDone === 'number') w.stats.missionsDone = data.missionsDone;
    if (typeof data.hour === 'number') w.hour = data.hour;
    if (data.storyComplete) w.storyComplete = true;
  }
  clear() {
    try {
      localStorage.removeItem(this.key);
    } catch {
      // No storage: nothing to clear.
    }
  }
}
