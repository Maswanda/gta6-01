// persist.js — save/load via localStorage. Cash, mission progress, weapons,
// owned vehicles and side results survive a reload.
import { T } from './tuning.js';

export class Save {
  constructor(world) {
    this.world = world;
    this.key = T.saveKey;
  }
  save() {
    const w = this.world;
    const data = {
      cash: w.player.cash,
      health: w.player.health,
      mission: w.missions.index,
      missionStep: w.missions.step,
      weapons: { weapon: w.combat.weapon, ammo: w.combat.ammo, reserve: w.combat.reserve },
      garage: w.garage.serialize(),
      side: w.side.serialize(),
      radioStation: w.radio.station,
      dayFrac: w.city.dayFrac(),
    };
    try { localStorage.setItem(this.key, JSON.stringify(data)); } catch {}
    return true;
  }
  load() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(this.key) || 'null'); } catch {}
    if (!data) return false;
    const w = this.world;
    if (typeof data.cash === 'number') w.player.cash = data.cash;
    if (typeof data.health === 'number') w.player.health = data.health;
    if (data.weapons) {
      if (data.weapons.weapon) w.combat.weapon = data.weapons.weapon;
      if (data.weapons.ammo) Object.assign(w.combat.ammo, data.weapons.ammo);
      if (data.weapons.reserve) Object.assign(w.combat.reserve, data.weapons.reserve);
    }
    if (data.garage) w.garage.deserialize(data.garage);
    if (data.side) w.side.deserialize(data.side);
    if (typeof data.radioStation === 'number') w.radio.station = data.radioStation;
    if (typeof data.dayFrac === 'number') w.city.setDayFrac(data.dayFrac);
    // Mission progress is restored only as a best-effort: the story resumes
    // at the saved mission, at its first step.
    if (typeof data.mission === 'number' && data.mission >= 0 && data.mission < 12) {
      w.missions.index = data.mission;
      w.missions.step = 0;
      w.missions.done = false;
      w.missions.storyComplete = false;
      w.missions._racePoint = 0;
      w.missions._killSpawned = false;
      w.missions._heliSet = false;
    }
    return true;
  }
  clear() { try { localStorage.removeItem(this.key); } catch {} }
}
