// Save / load: one localStorage key, plain JSON, versioned so an old
// save never crashes a new build.
const KEY = 'solmar-bay-heatwave-save-v4';
const VERSION = 4;

export class SaveSys {
  constructor(world) {
    this.world = world;
  }

  snapshot() {
    const w = this.world;
    return {
      version: VERSION,
      cash: Math.round(w.player.cash),
      missionIndex: w.missions.index,
      missionStep: w.missions.step,
      unlocked: { ...w.combat.unlocked },
      garage: { owned: [...w.garage.owned], selected: w.garage.selected },
      side: {
        taxiDone: w.side.taxi.doneCount,
        raceDone: w.side.race.doneCount,
        collectibles: [...w.side.collectibles.found],
      },
      dayFrac: w.city.dayFrac(),
    };
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.snapshot()));
      return true;
    } catch {
      return false;
    }
  }

  load() {
    let data = null;
    try {
      data = JSON.parse(localStorage.getItem(KEY) || 'null');
    } catch {
      data = null;
    }
    if (!data || data.version !== VERSION) return false;
    const w = this.world;
    if (typeof data.cash === 'number') w.player.cash = data.cash;
    if (data.unlocked) Object.assign(w.combat.unlocked, data.unlocked);
    if (data.garage) {
      w.garage.owned = [...(data.garage.owned || [])];
      w.garage.selected = data.garage.selected || null;
      w.garage.syncOwnedCars();
    }
    if (data.side) {
      if (typeof data.side.taxiDone === 'number') w.side.taxi.doneCount = data.side.taxiDone;
      if (typeof data.side.raceDone === 'number') w.side.race.doneCount = data.side.raceDone;
      if (Array.isArray(data.side.collectibles)) {
        w.side.collectibles.found = new Set(data.side.collectibles);
      }
    }
    if (typeof data.dayFrac === 'number') w.city.setDayFrac(data.dayFrac);
    return true;
  }

  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch { /* ignore */ }
  }
}
