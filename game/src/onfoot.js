// onfoot.js — Solmar Bay: the player on foot.
// A/D turn, W/S walk, Shift runs. The walker owns the player's health
// and armor (armor soaks damage first) and the little gun box that shows
// when a weapon is out. Driving is drive.js; this is only the feet.
import { TUNE } from './tuning.js';

export class Walker {
  constructor(world) {
    this.world = world;
    const p = world.player;
    p.mesh = world.stage.makePed(0x2a6fd8);
    // A visible sidearm appears when a weapon is out (combat.js owns it).
    p.gunMesh = null;
    p.health = TUNE.player.health;
    p.armor = 0;
    p.speed = 0;
    p.walkPhase = 0;
  }
  spawn(x, z, heading) {
    const p = this.world.player;
    p.x = x;
    p.z = z;
    p.heading = heading;
    p.mesh.position.set(x, 0, z);
    p.mesh.rotation.y = heading;
    p.mesh.visible = true;
  }
  update(dt) {
    const w = this.world;
    const p = w.player;
    if (p.inCar || w.ended) return;
    const input = w.input;
    const turn = input.moveX();
    const fwd = input.moveY();
    const speed = input.running ? TUNE.player.runSpeed : TUNE.player.walkSpeed;
    p.heading += turn * 2.7 * dt * (fwd < 0 ? -1 : 1);
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    let mx = 0;
    let mz = 0;
    if (fwd !== 0) {
      mx = fx * fwd * speed;
      mz = fz * fwd * speed;
    }
    p.x += mx * dt;
    p.z += mz * dt;
    p.speed = Math.hypot(mx, mz);
    // Building collision (circle vs box).
    for (const b of w.layout.buildings) {
      const dx = p.x - b.x;
      const dz = p.z - b.z;
      const hw = b.w / 2 + 0.9;
      const hd = b.d / 2 + 0.9;
      if (Math.abs(dx) > hw || Math.abs(dz) > hd) continue;
      const px = hw - Math.abs(dx);
      const pz = hd - Math.abs(dz);
      if (px < pz) p.x = b.x + (dx > 0 ? hw : -hw);
      else p.z = b.z + (dz > 0 ? hd : -hd);
    }
    const h = w.layout.half - 6;
    p.x = Math.max(-h, Math.min(h, p.x));
    p.z = Math.max(-h, Math.min(h, p.z));
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    // Walk-cycle leg swing.
    p.walkPhase += dt * p.speed * 1.4;
    const swing = Math.sin(p.walkPhase) * (p.speed > 0.5 ? 0.5 : 0);
    const legs = p.mesh.userData.legs || [];
    if (legs[0]) legs[0].rotation.x = swing;
    if (legs[1]) legs[1].rotation.x = -swing;
  }
  // Damage soaks armor first, then health. Returns true when the player dies.
  damage(amount) {
    const p = this.world.player;
    let rest = amount;
    if (p.armor > 0) {
      const soaked = Math.min(p.armor, rest);
      p.armor -= soaked;
      rest -= soaked;
    }
    p.health -= rest;
    if (p.health <= 0) {
      p.health = 0;
      return true;
    }
    return false;
  }
  heal(amount) {
    const p = this.world.player;
    p.health = Math.min(TUNE.player.health, p.health + amount);
  }
  addArmor(amount) {
    const p = this.world.player;
    p.armor = Math.min(TUNE.player.armor, p.armor + amount);
  }
}
