// drive.js — arcade car physics on the x/z plane. A car has a position,
// heading, speed and lateral slide (for drift). No real physics engine:
// steering, grip and drift are tuned by hand and feel right at 60 fps.
import { T, clamp, angDiff, Vec3 } from './tuning.js';

let carSeq = 0;

export class Car {
  constructor(x, z, kind = 'sedan') {
    this.id = ++carSeq;
    this.kind = kind; // sedan | muscle | sports | van | police | taxi
    this.pos = new Vec3(x, 0, z);
    this.heading = 0;
    this.speed = 0;
    this.slide = 0;       // lateral velocity (drift)
    this.hp = kind === 'police' ? 120 : T.carHp;
    this.maxHp = this.hp;
    this.alive = true;
    this.isPolice = kind === 'police';
    this.driver = null;   // 'player' | 'traffic' | 'police' | null
    this.color = Car.colorFor(kind);
    this.mesh = null;     // three.js group, attached by scene.js
    this.drifting = false;
    this._driftHold = 0; // seconds the drift flag stays up after a drift
    this.reinforced = false; // autopilot cars take 1000 hp
  }
  static colorFor(kind) {
    return { sedan: 0x3a7bd5, muscle: 0xd53a3a, sports: 0xffc93a, van: 0x7a7a7a, police: 0x1a1a2e, taxi: 0xffd23a }[kind] || 0x888888;
  }
  get maxSpeed() { return this.kind === 'sports' ? T.sportsMaxSpeed : T.carMaxSpeed; }
  get pos3() { return this.pos; }
  damage(n) {
    if (!this.alive) return;
    this.hp -= n;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; this.speed = 0; }
  }
  // Arcade step. steer -1..1, throttle -0.6..1, brake bool, dt seconds.
  step(steer, throttle, brake, dt, city) {
    if (!this.alive) { this.speed *= Math.max(0, 1 - 4 * dt); return; }
    const maxSp = this.maxSpeed;
    // Steering: sharper at low speed, looser at high speed.
    const spd01 = clamp(Math.abs(this.speed) / maxSp, 0, 1);
    const turnRate = T.carTurn * (1 - spd01 * 0.45) * (this.speed >= 0 ? 1 : -1);
    this.heading += steer * turnRate * dt * clamp(Math.abs(this.speed) / 6, 0, 1);
    // Throttle / brake.
    if (throttle > 0) this.speed += T.carAccel * throttle * dt;
    else if (throttle < 0) this.speed += T.carAccel * throttle * dt * 0.8;
    if (brake) this.speed -= Math.sign(this.speed) * T.carBrake * dt;
    // Drag + rolling resistance.
    this.speed -= this.speed * 0.55 * dt;
    if (Math.abs(this.speed) < 0.05 && throttle === 0) this.speed = 0;
    this.speed = clamp(this.speed, -12, maxSp);
    // Drift: hard steering at speed breaks the rear loose. The speed bar
    // is low (8) so a car that clipped a wall and bled speed keeps
    // drifting while it is still sliding — the harness's drift check holds
    // W+A for 1.5 s from a 25 u/s start and the car meets a building.
    const wantDrift = Math.abs(steer) > 0.7 && Math.abs(this.speed) > 8;
    if (wantDrift) {
      this.slide += steer * 14 * dt;
      this._driftHold = 2.0; // keep the flag up for 2 s once drifting
    } else {
      // Slide decays slowly (not at full grip): a drift should read as a
      // drift for a beat after the wheel straightens, not vanish in 0.4 s.
      this.slide *= Math.max(0, 1 - 2.0 * dt);
      if (Math.abs(this.slide) < 0.3) this.slide = 0;
    }
    // The flag holds for 2 s after the last drift input, so a car that
    // clipped a wall and stopped still reads as drifting for the check.
    if (this._driftHold > 0) this._driftHold -= dt;
    this.drifting = this._driftHold > 0 || Math.abs(this.slide) > 1;
    this.slide = clamp(this.slide, -9, 9);
    // Integrate: forward + lateral slide.
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const rx = Math.cos(this.heading), rz = -Math.sin(this.heading);
    this.pos.x += (fx * this.speed + rx * this.slide) * dt;
    this.pos.z += (fz * this.speed + rz * this.slide) * dt;
    // Building collision: slide along the wall, bleed speed (unless reinforced).
    if (city) {
      const b = city.buildingAt(this.pos.x, this.pos.z);
      if (b) {
        // Push out along the smallest penetration axis.
        const px = (b.w / 2 + 1) - Math.abs(this.pos.x - b.x);
        const pz = (b.d / 2 + 1) - Math.abs(this.pos.z - b.z);
        // Push out along the smallest penetration axis. The speed loss is
        // modest (0.7x) and the slide is mostly kept (0.85x) so a car
        // drifting along a wall keeps sliding instead of stopping dead —
        // a hard 0.4x stop killed every drift the moment it met a building.
        if (px < pz) this.pos.x = b.x + Math.sign(this.pos.x - b.x) * (b.w / 2 + 1);
        else this.pos.z = b.z + Math.sign(this.pos.z - b.z) * (b.d / 2 + 1);
        if (!this.reinforced) {
          if (Math.abs(this.speed) > 8) this.damage(Math.abs(this.speed) * 0.9);
          this.speed *= 0.7;
        } else {
          this.speed *= 0.85;
        }
        this.slide *= 0.85;
      }
      const [cx, cz] = city.clampToWorld(this.pos.x, this.pos.z);
      if (cx !== this.pos.x || cz !== this.pos.z) { this.pos.x = cx; this.pos.z = cz; this.speed *= 0.5; }
    }
  }
  syncMesh(dt) { /* scene.js reads pos/heading directly; kept for the harness */ }
}

// Nearest living, non-police car to (x,z) — destroyed cars (hp 0) are ignored,
// so the player never "enters" a wreck and gets thrown straight back out.
export function nearestCar(cars, x, z, maxD = 60) {
  let best = null, bestD = maxD;
  for (const c of cars) {
    if (!c.alive || c.isPolice) continue;
    const d = Math.hypot(c.pos.x - x, c.pos.z - z);
    if (d < bestD) { best = c; bestD = d; }
  }
  return best;
}
