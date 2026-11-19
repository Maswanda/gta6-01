// Saving v4: cash, story progress, weapons, side-activity results and the
// garage persist in localStorage so the player can continue after closing
// the tab. Autosaves on mission complete and on every side-job payout. The
// v3 key is separate from v2's, so an old save never loads into the new
// story. v4 also keeps a crime tally: how many ambient events the player
// stopped, and which cars Rico's garage holds for them.
const KEY = 'solmar-bay-heatwave-save-v3';

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
        weapon: w.combat.weapon,
        unlocked: w.combat.unlocked,
        ammo: w.combat.ammo,
        reserve: w.combat.reserve,
        health: w.player.health,
        side: w.side.getSave(),
        crime: w.crime ? w.crime.getSave() : null,
        garage: w.garage ? w.garage.getSave() : null,
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
      w.combat.weapon = d.weapon || 'pistol';
      w.combat.unlocked = d.unlocked || { pistol: true, shotgun: false, smg: false };
      w.combat.ammo = d.ammo || { pistol: 12, shotgun: 6, smg: 30 };
      w.combat.reserve = d.reserve || { pistol: 48, shotgun: 18, smg: 90 };
      w.missions.index = Math.min(d.missionIndex || 0, w.missions.defs.length - 1);
      w.missions.done = !!d.done;
      w.missions.step = 0;
      w.side.applySave(d.side);
      if (w.crime) w.crime.applySave(d.crime);
      if (w.garage) {
        w.garage.applySave(d.garage);
        w.garage.respawnOwned(w);
      }
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
