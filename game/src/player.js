// Jax Marlowe on foot v4: an articulated figure (body, head, cap, legs
// that swing when walking) with camera-relative WASD movement. Sprinting is
// faster but drains a stamina bar that refills when he walks — so a long
// chase on foot is a decision, not a default. Resting at the safehouse
// refills stamina twice as fast while the heat cools off. When driving, the
// figure hides inside the car.
import { CFG } from './config.js';
import { collideCircle } from './city.js';

export class Player {
  constructor(scene, spawn) {
    this.pos = spawn.clone();
    this.heading = 0;
    this.speed = 0;
    this.health = CFG.playerHealth;
    this.cash = 0;
    this.stamina = CFG.staminaMax;
    // True while Jax is sheltering at the safehouse — the garage system
    // sets it every frame, and stamina refills twice as fast there.
    this.resting = false;
    this.inCar = null;
    this.moving = false;
    this.sprinting = false;
    this.crouching = false; // hold C: half speed, squashed mesh, harder to spot
    this.crouchForced = false; // the play-test / debug hook holds it instead
    this.hurtTimer = 0;
    this.mesh = this.buildMesh();
    this.mesh.position.copy(this.pos);
    scene.add(this.mesh);
  }

  buildMesh() {
    const g = new THREE.Group();
    const jacket = new THREE.MeshLambertMaterial({ color: 0x2e6f5e });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5e });
    const denim = new THREE.MeshLambertMaterial({ color: 0x2e3a5e });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.85, 0.4), jacket);
    body.position.y = 1.15;
    body.name = 'body';
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
    head.position.y = 1.78;
    head.name = 'head';
    g.add(head);
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.27, 0.28, 0.1, 12),
      new THREE.MeshLambertMaterial({ color: 0xc23b2e }),
    );
    cap.position.y = 1.98;
    g.add(cap);
    this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.7, 0.3), denim);
    this.legL.position.set(-0.18, 0.35, 0);
    g.add(this.legL);
    this.legR = this.legL.clone();
    this.legR.position.x = 0.18;
    g.add(this.legR);
    this.armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.24), jacket);
    this.armL.position.set(-0.48, 1.15, 0);
    g.add(this.armL);
    this.armR = this.armL.clone();
    this.armR.position.x = 0.48;
    g.add(this.armR);
    return g;
  }

  get forward() {
    return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  // Camera-relative movement; camYaw is the camera's yaw around the player.
  update(dt, input, camYaw, colliders, cars) {
    if (this.inCar) return;
    const axes = input.moveAxes();
    const wantRun = input.held('ShiftLeft') || input.held('ShiftRight');
    // Crouching halves the walk speed and squashes the figure, and the
    // police lose the trail sooner while the player stays low.
    this.crouching = input.held('KeyC') || this.crouchForced;
    this.mesh.scale.y = this.crouching ? 0.62 : 1;
    // Sprint only while there is stamina left; it refills while walking.
    this.sprinting = wantRun && this.stamina > 1 && !this.crouching;
    if (this.sprinting) this.stamina = Math.max(0, this.stamina - CFG.staminaDrain * dt);
    else this.stamina = Math.min(CFG.staminaMax, this.stamina + CFG.staminaRegen * (this.resting ? 2 : 1) * dt);
    const top = this.crouching ? CFG.walkSpeed * CFG.crouchSpeed
      : this.sprinting ? CFG.runSpeed : CFG.walkSpeed;
    const fx = Math.sin(camYaw);
    const fz = Math.cos(camYaw);
    const rx = -Math.cos(camYaw);
    const rz = Math.sin(camYaw);
    let mx = fx * axes.y + rx * axes.x;
    let mz = fz * axes.y + rz * axes.x;
    const len = Math.hypot(mx, mz);
    this.moving = len > 0.01;
    if (this.moving) {
      mx /= len;
      mz /= len;
      const targetHeading = Math.atan2(mx, mz);
      this.heading = lerpAngle(this.heading, targetHeading, Math.min(1, dt * 12));
      this.speed = top;
      const prev = this.pos.clone();
      this.pos.x += mx * top * dt;
      this.pos.z += mz * top * dt;
      if (collideCircle(this.pos, CFG.playerRadius, colliders)) {
        // Try sliding along each axis before giving up.
        this.pos.copy(prev);
        this.pos.x += mx * top * dt;
        if (collideCircle(this.pos, CFG.playerRadius, colliders)) this.pos.x = prev.x;
        this.pos.z += mz * top * dt;
        if (collideCircle(this.pos, CFG.playerRadius, colliders)) this.pos.z = prev.z;
      }
      // Bump into cars: they are solid.
      for (const car of cars) {
        if (!car.alive) continue;
        const dx = this.pos.x - car.pos.x;
        const dz = this.pos.z - car.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < CFG.playerRadius + 1.6 && d > 0.01) {
          this.pos.x = car.pos.x + (dx / d) * (CFG.playerRadius + 1.6);
          this.pos.z = car.pos.z + (dz / d) * (CFG.playerRadius + 1.6);
        }
      }
    } else {
      this.speed = 0;
    }
    // Walk-cycle swing, faster when sprinting.
    const t = performance.now() / 1000;
    const swing = this.moving ? Math.sin(t * (this.sprinting ? 14 : 9)) * 0.55 : 0;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.8;
    this.armR.rotation.x = swing * 0.8;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    if (this.hurtTimer > 0) this.hurtTimer -= dt;
  }

  damage(amount) {
    if (this.hurtTimer > 0) return;
    this.health -= amount;
    this.hurtTimer = 0.6;
  }

  heal(amount) {
    this.health = Math.min(CFG.playerHealth, this.health + amount);
  }

  hide() {
    this.mesh.visible = false;
  }

  show() {
    this.mesh.visible = true;
  }
}

export function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
