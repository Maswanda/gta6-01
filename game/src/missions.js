// Missions: the 12-job story. A mission is a small state machine; each
// step is talk / reach / kill / race / heli / heist. NPCs live only for
// their step and stand at the door of their landmark (south face +3), so a
// teleport onto the landmark always leaves them in talk range.
import * as THREE from 'three';
import { MISSIONS, LANDMARKS, T } from './tuning.js';

export class Missions {
  constructor(world) {
    this.world = world;
    this.index = 0;
    this.step = 0;
    this.done = false;
    this.npc = null; // { name, x, z, mesh }
    this.enemiesSpawned = false;
    // NOTE: onEnter(0) is NOT called here — the scene does not exist yet
    // at construction time. Game.boot() calls it after scene.init().
  }

  get current() {
    return MISSIONS[this.index];
  }

  get title() {
    return this.done ? 'Story Complete' : this.current.title;
  }

  state() {
    const cur = this.done ? null : this.current;
    return {
      index: this.index,
      step: this.step,
      title: this.title,
      done: this.done,
      missionsDone: this.index + (this.done ? 1 : 0),
      text: cur ? cur.text : 'Solmar Bay is yours.',
      target: this.currentTarget(),
    };
  }

  // Where the autopilot (and the HUD) should head right now.
  currentTarget() {
    if (this.done) return null;
    const w = this.world;
    const m = this.current;
    const kind = this.stepKind();
    if (kind === 'talk' && this.npc) return { x: this.npc.x, z: this.npc.z, kind: 'talk' };
    if (kind === 'reach') {
      const at = this.stepAt();
      const p = w.city.landmarkPos(at);
      return { x: p.x, z: p.z, kind: 'reach' };
    }
    if (kind === 'kill') {
      if (!this.enemiesSpawned) {
        const p = w.city.landmarkPos(m.at);
        return { x: p.x, z: p.z, kind: 'reach' };
      }
      const alive = w.combat.enemies.filter((e) => e.hp > 0);
      if (alive.length) {
        const e = alive[0];
        return { x: e.pos.x, z: e.pos.z, kind: 'kill' };
      }
      return null;
    }
    if (kind === 'race') {
      const cp = w.side.race.checkpoints[w.side.race.index];
      if (cp) return { x: cp.x, z: cp.z, kind: 'race' };
      return null;
    }
    if (kind === 'heli') {
      if (this.step === 0) return null; // wait for the chopper
      const p = w.city.landmarkPos('safehouse');
      return { x: p.x, z: p.z, kind: 'reach' };
    }
    if (kind === 'heist') {
      if (this.step === 0) return { x: LANDMARKS.casino[0], z: LANDMARKS.casino[1], kind: 'reach' };
      if (this.step === 1 && this.npc) return { x: this.npc.x, z: this.npc.z, kind: 'talk' };
      if (this.step === 2) {
        const alive = w.combat.enemies.filter((e) => e.hp > 0);
        if (alive.length) {
          const e = alive[0];
          return { x: e.pos.x, z: e.pos.z, kind: 'kill' };
        }
        return { x: 78, z: -20, kind: 'kill' };
      }
      const p = w.city.landmarkPos('safehouse');
      return { x: p.x, z: p.z, kind: 'reach' };
    }
    return null;
  }

  // The kind of the current step (a mission's `then` is step 1, `then2` step 2).
  stepKind() {
    const m = this.current;
    if (this.step === 0) return m.kind;
    if (this.step === 1 && m.then) return m.then.kind;
    if (this.step === 2 && m.then2) return m.then2.kind;
    return m.kind;
  }

  stepAt() {
    const m = this.current;
    if (this.step === 0) return m.at;
    if (this.step === 1 && m.then) return m.then.at;
    if (this.step === 2 && m.then2) return m.then2.at;
    return m.at;
  }

  spawnNpc(name, landmark) {
    this.clearNpc();
    const w = this.world;
    const door = w.city.doorPos(landmark);
    const clamped = w.city.clampToMap(door.x, door.z);
    const mesh = w.scene.makeNpcMesh(name, clamped.x, clamped.z);
    this.npc = { name, x: clamped.x, z: clamped.z, mesh, landmark };
    return this.npc;
  }

  clearNpc() {
    if (this.npc && this.npc.mesh) this.world.scene.removeMesh(this.npc.mesh);
    this.npc = null;
  }

  // Called when a mission becomes current: set up its first step.
  onEnter(index) {
    const w = this.world;
    this.enemiesSpawned = false;
    const m = MISSIONS[index];
    if (!m) return;
    if (m.kind === 'talk') this.spawnNpc(m.npc, m.at);
    else if (m.kind === 'race') w.side.startRace(m.checkpoints);
    else if (m.kind === 'heli') w.game.setWanted(4);
    else if (m.kind === 'heist') { /* step 0 is just reaching the casino */ }
  }

  // Advance to the next step, or the next mission.
  advance() {
    const w = this.world;
    const m = this.current;
    if (this.step === 0 && m.then) {
      this.step = 1;
      return;
    }
    if (this.step === 1 && m.then2) {
      this.step = 2;
      return;
    }
    // Mission complete.
    if (m.unlock) w.combat.unlock(m.unlock);
    this.clearNpc();
    this.index++;
    this.step = 0;
    if (this.index >= MISSIONS.length) {
      this.done = true;
      this.index = MISSIONS.length - 1;
      w.player.cash += 1000;
      return;
    }
    this.onEnter(this.index);
  }

  // E key: talk to the current NPC when in range. Returns true if a
  // conversation happened.
  talk() {
    const w = this.world;
    if (this.done || !this.npc) return false;
    const d = Math.hypot(w.player.pos.x - this.npc.x, w.player.pos.z - this.npc.z);
    if (d > T.talkRadius) return false;
    const m = this.current;
    const kind = this.stepKind();
    if (kind === 'talk') {
      // The bank job raises the heat the moment Rico talks.
      if (this.index === 8 && this.step === 0) w.game.addWanted(2);
      w.audio.blip(520, 0.12, 'square', 0.2);
      this.advance();
      return true;
    }
    if (kind === 'heist' && this.step === 1) {
      // Talk the vault guard: get inside.
      this.clearNpc();
      this.step = 2;
      w.audio.blip(520, 0.12, 'square', 0.2);
      return true;
    }
    return false;
  }

  // Per-frame step checker. (Named `update`, not `step`: the mission
  // step number already lives on `this.step`.)
  update(dt) {
    const w = this.world;
    if (this.done) return;
    const m = this.current;
    const kind = this.stepKind();
    const p = w.player.pos;
    if (kind === 'reach') {
      const at = this.stepAt();
      const t = w.city.landmarkPos(at);
      const d = Math.hypot(p.x - t.x, p.z - t.z);
      if (d < T.reachRadius) this.advance();
    } else if (kind === 'kill') {
      if (!this.enemiesSpawned) {
        const t = w.city.landmarkPos(m.at);
        const d = Math.hypot(p.x - t.x, p.z - t.z);
        if (d < 60) {
          this.enemiesSpawned = true;
          w.combat.spawnEnemies(m.kind, t.x, t.z, m.enemies);
        }
      } else if (w.combat.enemiesLeft() === 0) {
        this.advance();
      }
    } else if (kind === 'race') {
      if (w.side.race.state === 'done') this.advance();
    } else if (kind === 'heli') {
      if (this.step === 0) {
        if (w.heli.active && w.heli.lit) this.advance();
      } else {
        const t = w.city.landmarkPos('safehouse');
        const d = Math.hypot(p.x - t.x, p.z - t.z);
        if (d < T.reachRadius) this.advance();
      }
    } else if (kind === 'heist') {
      if (this.step === 0) {
        const d = Math.hypot(p.x - LANDMARKS.casino[0], p.z - LANDMARKS.casino[1]);
        if (d < T.reachRadius) {
          this.step = 1;
          this.spawnNpc('Guard', 'casino');
        }
      } else if (this.step === 1) {
        // Talk advances via talk(); nothing here.
      } else if (this.step === 2) {
        if (!this.enemiesSpawned) {
          this.enemiesSpawned = true;
          w.combat.spawnEnemies('vault', 78, -20, m.guards);
        } else if (w.combat.enemiesLeft() === 0) {
          w.game.setWanted(3);
          this.step = 3;
        }
      } else if (this.step === 3) {
        const t = w.city.landmarkPos('safehouse');
        const d = Math.hypot(p.x - t.x, p.z - t.z);
        if (d < T.reachRadius) this.advance();
      }
    }
  }
}
