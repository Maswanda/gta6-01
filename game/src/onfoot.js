// onfoot.js — the player on foot: WASD movement, crouch (hidden), enter/exit
// cars, punch (F). Position is a plain {x, z}; mesh is attached by scene.js.
import { T, clamp, Vec3 } from './tuning.js';

export class Player {
  constructor() {
    this.pos = new Vec3(0, 0, 250); // start near the Marina / pier
    this.heading = 0;
    this.health = 100;
    this.armor = 0;
    this.cash = 500;
    this.inCar = null;
    this.crouched = false;
    this.mesh = null;
    this.moving = false;
  }
  // Step on foot. input is the Input instance; city for collision.
  step(input, dt, city) {
    if (this.inCar) return;
    const mv = input.moveVec(this.heading);
    const running = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = this.crouched ? T.walkSpeed * 0.45 : (running ? T.runSpeed : T.walkSpeed);
    const len = Math.hypot(mv.x, mv.z);
    this.moving = len > 0.01;
    if (this.moving) {
      const nx = mv.x / len, nz = mv.z / len;
      this.pos.x += nx * speed * dt;
      this.pos.z += nz * speed * dt;
      // Face the movement direction.
      this.heading = Math.atan2(nx, nz);
      const b = city.buildingAt(this.pos.x, this.pos.z);
      if (b) {
        // Slide along the wall: undo the step, then try each axis alone.
        this.pos.x -= nx * speed * dt;
        this.pos.z -= nz * speed * dt;
        if (!city.buildingAt(this.pos.x + nx * speed * dt, this.pos.z)) this.pos.x += nx * speed * dt;
        else if (!city.buildingAt(this.pos.x, this.pos.z + nz * speed * dt)) this.pos.z += nz * speed * dt;
      }
      const [cx, cz] = city.clampToWorld(this.pos.x, this.pos.z);
      this.pos.x = cx; this.pos.z = cz;
    }
  }
  teleport(x, z) {
    this.pos.x = x; this.pos.z = z;
    if (this.inCar) {
      this.inCar.pos.x = x; this.inCar.pos.z = z;
      this.inCar.syncMesh(0);
    }
  }
  enterCar(car) {
    if (!car || !car.alive) return false;
    if (this.inCar) return false;
    this.inCar = car;
    car.driver = 'player';
    car.speed = 0;
    this.pos.x = car.pos.x; this.pos.z = car.pos.z;
    return true;
  }
  exitCar() {
    if (!this.inCar) return false;
    const car = this.inCar;
    car.driver = null;
    this.inCar = null;
    // Step out to the side of the car.
    this.pos.x = car.pos.x + Math.cos(car.heading) * 3;
    this.pos.z = car.pos.z - Math.sin(car.heading) * 3;
    this.heading = car.heading;
    return true;
  }
  damage(n) {
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, n);
      this.armor -= absorbed;
      n -= absorbed;
    }
    this.health = Math.max(0, this.health - n);
    return this.health <= 0;
  }
  heal(n) { this.health = Math.min(100, this.health + n); }
  get dead() { return this.health <= 0; }
  respawn() {
    // Wasted / busted: respawn at the safehouse, lose a little cash, keep the story.
    this.health = 100;
    this.pos.x = 26; this.pos.z = 182;
    this.heading = 0;
    this.cash = Math.max(0, this.cash - 100);
    if (this.inCar) { this.inCar.driver = null; this.inCar = null; }
  }
}
