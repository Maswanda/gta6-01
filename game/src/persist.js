// persist.js — Save / load through localStorage.
// Stores cash, story progress, weapon unlocks, the garage and side
// activity results. Nothing here touches the network.
import { TUNE } from './tuning.js';

export class Save {
  constructor(world) {
    this.world = world;
    this.key = TUNE.saveKey;
  }
  snapshot() {
    const w = this.world;
    return {
      cash: Math.floor(w.player.cash),
      health: Math.round(w.player.health),
      missionIndex: w.missions.index,
      missionStep: w.missions.step,
      missionDone: w.missions.done,
      unlocked: { ...w.unlocked },
      garage: { owned: [...w.garage.owned], selected: w.garage.selected },
      side: w.side.snapshot(),
      dayFrac: w.city._dayFrac,
      savedAt: Date.now(),
    };
  }
  save() {
    try {
      const data = JSON.stringify(this.snapshot());
      localStorage.setItem(this.key, data);
      this.world.hud.toast('Progress saved.');
      return true;
    } catch (e) {
      return false;
    }
  }
  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return false;
      const data = JSON.parse(raw);
      const w = this.world;
      if (typeof data.cash === 'number') w.player.cash = data.cash;
      if (typeof data.health === 'number') w.player.health = data.health;
      if (data.unlocked) Object.assign(w.unlocked, data.unlocked);
      if (data.garage) {
        w.garage.owned = [...data.garage.owned];
        w.garage.selected = data.garage.selected;
      }
      if (data.side) w.side.restore(data.side);
      if (typeof data._dayFrac === 'number') w.city.setDayFrac(data._dayFrac);
      // Story progress is restored as the mission the player was on;
      // the step restarts from its beginning (steps are short).
      if (typeof data.missionIndex === 'number' && !data.missionDone) {
        w.missions.index = data.missionIndex;
        w.missions.step = 0;
        w.missions._started = true;
      }
      this.world.hud.toast('Save loaded.');
      return true;
    } catch (e) {
      return false;
    }
  }
}
