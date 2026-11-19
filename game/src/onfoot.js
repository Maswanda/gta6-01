// On-foot movement: WASD relative to the camera-facing heading, collision
// push-out, crouch. The player walks where the camera looks; heading is the
// direction the player faces (also the aim direction).
import * as THREE from 'three';
import { T } from './tuning.js';

export class OnFoot {
  constructor(world) {
    this.world = world;
  }

  step(player, dt, axes, cameraHeading) {
    const w = this.world;
    if (player.inCar) return;
    const speed = player.crouching ? T.walkSpeed * 0.45 : T.runSpeed;
    let mx = axes.x;
    let mz = axes.z;
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len;
      mz /= len;
      // Rotate the input by the camera heading so W always walks away
      // from the camera: W -> forward (sin h, cos h), D -> right.
      const s = Math.sin(cameraHeading);
      const c = Math.cos(cameraHeading);
      const wx = mx * c - mz * s;
      const wz = -mx * s - mz * c;
      let nx = player.pos.x + wx * speed * dt;
      let nz = player.pos.z + wz * speed * dt;
      const hit = w.city.resolveCollision(nx, nz, 1);
      nx = hit.x;
      nz = hit.z;
      const clamped = w.city.clampToMap(nx, nz);
      player.pos.set(clamped.x, 0, clamped.z);
      // Face the movement direction.
      player.heading = Math.atan2(wx, wz);
    }
    if (player.mesh) {
      player.mesh.position.copy(player.pos);
      player.mesh.rotation.y = -player.heading;
    }
  }
}
