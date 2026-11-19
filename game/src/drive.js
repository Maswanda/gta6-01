// drive.js — Vehicle physics for Solmar Bay.
// Arcade handling: accelerate / brake / reverse, steering that scales
// with speed, drift when the tail steps out, and AABB collision
// against buildings plus soft car-to-car bumps. No external physics.
import * as THREE from 'three';
import { TUNE, clamp, angleLerp } from './tuning.js';

export class Car {
  constructor(world, kind, x, z, heading = 0, color = null, isPolice = false) {
    this.world = world;
    this.kind = kind;
    this.spec = TUNE.vehicles[kind] || TUNE.vehicles.sedan;
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.alive = true;
    this.isPolice = isPolice;
    this.drifting = false;
    this.color = color !== null ? color : this.spec.color;
    this.mesh = world.scene.makeCarMesh(this.color, kind);
    if (isPolice) {
      // Police livery: white body + light bar.
      this.mesh.children[0].material = this.mesh.children[0].material.clone();
      this.mesh.children[0].material.color.setHex(0xeeeeee);
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.18, 0.5),
        new THREE.MeshBasicMaterial({ color: 0x2244ff }),
      );
      bar.position.set(0, 1.62, -0.2);
      this.mesh.add(bar);
      this.lightBar = bar;
    }
    this.syncMesh(0);
    world.scene.dynamic.add(this.mesh);
  }
  get forward() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }
  // Drive with player input. steer: -1..1, throttle: -1..1.
  drive(steer, throttle, dt) {
    const spec = this.spec;
    this.steer = steer;
    const maxFwd = spec.topSpeed;
    const maxRev = 12;
    if (throttle > 0) this.speed += spec.accel * throttle * dt;
    else if (throttle < 0) {
      if (this.speed > 0.5) this.speed -= spec.accel * 1.6 * dt; // brake
      else this.speed += spec.accel * 0.7 * throttle * dt; // reverse
    } else {
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 8 * dt);
    }
    this.speed = clamp(this.speed, -maxRev, maxFwd);
    // Steering: tighter at low speed, looser at top speed.
    // Convention: heading = atan2(dx, dz), forward = (sin h, cos h).
    // Turning right (D, steer +1) decreases the heading.
    const speedFactor = clamp(Math.abs(this.speed) / 14, 0.15, 1);
    const steerRate = 2.1 * speedFactor * (this.speed >= 0 ? 1 : -1);
    this.heading -= steer * steerRate * dt * Math.sign(this.speed || 1);
    // Drift: hard steering at speed makes the tail step out.
    const lateral = Math.abs(steer) > 0.75 && Math.abs(this.speed) > 13;
    this.drifting = lateral;
    if (lateral) {
      this.speed -= this.speed * 0.25 * dt;
    }
    this._move(dt);
  }
  // Coast / AI cruise at a target speed.
  cruise(targetSpeed, steer, dt) {
    const diff = targetSpeed - this.speed;
    this.speed += clamp(diff, -10 * dt, 8 * dt);
    this.heading -= steer * 1.4 * dt * Math.sign(this.speed || 1);
    this.drifting = false;
    this._move(dt);
  }
  _move(dt) {
    const f = this.forward;
    let nx = this.pos.x + f.x * this.speed * dt;
    let nz = this.pos.z + f.z * this.speed * dt;
    // Building collision: slide along the wall, scrub speed.
    if (this.world.city.hitsBuilding(nx, nz, 1.6)) {
      const altX = this.world.city.hitsBuilding(nx, this.pos.z, 1.6) ? this.pos.x : nx;
      const altZ = this.world.city.hitsBuilding(this.pos.x, nz, 1.6) ? this.pos.z : nz;
      if (this.world.city.hitsBuilding(altX, altZ, 1.6)) {
        nx = this.pos.x;
        nz = this.pos.z;
        this.speed *= 0.4;
      } else {
        nx = altX;
        nz = altZ;
        this.speed *= 0.75;
      }
    }
    // City bounds.
    nx = clamp(nx, -this.world.city.half - 4, this.world.city.half + 4);
    nz = clamp(nz, -this.world.city.half - 4, this.world.city.half + 4);
    this.pos.x = nx;
    this.pos.z = nz;
    this.syncMesh(dt);
  }
  // Soft collision with another car: push apart, share speed.
  bump(other) {
    const dx = other.pos.x - this.pos.x;
    const dz = other.pos.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d >= 3.4 || d < 0.01) return false;
    const push = (3.4 - d) / 2;
    const nx = dx / d;
    const nz = dz / d;
    this.pos.x -= nx * push;
    this.pos.z -= nz * push;
    other.pos.x += nx * push;
    other.pos.z += nz * push;
    const avg = (this.speed + other.speed) / 2;
    this.speed = avg * 0.7;
    other.speed = avg * 0.7;
    this.syncMesh(0);
    other.syncMesh(0);
    return true;
  }
  syncMesh(dt) {
    if (!this.mesh) return;
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.heading;
    if (this.lightBar) {
      const t = performance.now() / 250;
      this.lightBar.material.color.setHex(Math.floor(t) % 2 === 0 ? 0x2244ff : 0xff2222);
    }
  }
  destroy() {
    this.alive = false;
    if (this.mesh && this.mesh.parent) this.mesh.parent.remove(this.mesh);
  }
}
