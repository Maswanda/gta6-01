// Saving: cash, story progress and ammo persist in localStorage so the
// player can continue after closing the tab. Autosaves on mission complete.
const KEY = 'solmar-bay-heatwave-save-v1';

export class Save {
  constructor(world) {
    this.world = world;
  }

  hasSave() {
    try {
      return !!localStorage.getItem(KEY);
    } catch {
      return false;
    }
  }

  save() {
    try {
      const w = this.world;
      const data = {
        cash: w.player.cash,
        missionIndex: w.missions.index,
        done: w.missions.done,
        ammo: w.combat.ammo,
        reserve: w.combat.reserve,
        health: w.player.health,
        savedAt: Date.now(),
      };
      localStorage.setItem(KEY, JSON.stringify(data));
      w.hud.showSaveNote('Progress saved ✓');
    } catch {
      // Storage unavailable (private mode): the game still plays.
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      const w = this.world;
      w.player.cash = d.cash || 0;
      w.player.health = d.health || 100;
      w.combat.ammo = d.ammo ?? 12;
      w.combat.reserve = d.reserve ?? 48;
      w.missions.index = Math.min(d.missionIndex || 0, w.missions.defs.length - 1);
      w.missions.done = !!d.done;
      w.missions.step = 0;
      return true;
    } catch {
      return false;
    }
  }

  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch { /* ignore */ }
  }
}
