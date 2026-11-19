// onfoot.js — Moving on foot: WASD walk, sprint, crouch (stealth),
// punch, talk to NPCs, enter/exit cars, and the generic "interact"
// resolution the missions and side activities use.
import * as THREE from 'three';
import { TUNE, clamp, dist2d } from './tuning.js';
import { Car } from './drive.js';

export class OnFoot {
  constructor(world) {
    this.world = world;
  }
  update(dt) {
    const world = this.world;
    const p = world.player;
    if (p.inCar || p.health <= 0) return;
    const input = world.input;
    const crouched = p.crouch;
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = crouched ? TUNE.crouchSpeed : sprint ? TUNE.sprintSpeed : TUNE.walkSpeed;
    let mx = 0;
    let mz = 0;
    if (input.down('KeyW') || input.down('ArrowUp')) mz += 1;
    if (input.down('KeyS') || input.down('ArrowDown')) mz -= 1;
    if (input.down('KeyA') || input.down('ArrowLeft')) mx -= 1;
    if (input.down('KeyD') || input.down('ArrowRight')) mx += 1;
    if (mx !== 0 || mz !== 0) {
      const len = Math.hypot(mx, mz);
      mx /= len;
      mz /= len;
      // Camera-relative movement: forward is the player heading,
      // right is (-cos h, sin h) for the atan2(dx, dz) convention.
      const fx = Math.sin(p.heading);
      const fz = Math.cos(p.heading);
      const rx = -Math.cos(p.heading);
      const rz = Math.sin(p.heading);
      const vx = (fx * mz + rx * mx) * speed;
      const vz = (fz * mz + rz * mx) * speed;
      const nx = p.pos.x + vx * dt;
      const nz = p.pos.z + vz * dt;
      const fixed = world.city.resolveCircle(nx, nz, 0.6);
      p.pos.x = fixed.x;
      p.pos.z = fixed.z;
      // Face the movement direction.
      const target = Math.atan2(vx, vz);
      let d = target - p.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      p.heading += clamp(d, -6 * dt, 6 * dt);
      p.moving = true;
    } else {
      p.moving = false;
    }
    p.mesh.position.copy(p.pos);
    p.mesh.rotation.y = p.heading;
    // Crouch toggle.
    if (input.pressed('KeyC')) {
      p.crouch = !p.crouch;
    }
    // F: punch first (crime thief / ATM / nearby enemy), otherwise
    // step into the nearest car. One key, clear priority.
    if (input.pressed('KeyF') && !p.inCar) {
      if (!this.punch()) this.tryEnterCar();
    }
    // Talk / interact (E) and taxi pickup (T).
    if (input.pressed('KeyE') || input.pressed('KeyT')) {
      world.missions.tryTalk();
      world.side.tryInteract();
      world.garage.tryOpen();
    }
    // Weapon switch.
    if (input.pressed('Digit1')) world.combat.selectWeapon('pistol');
    if (input.pressed('Digit2')) world.combat.selectWeapon('shotgun');
    if (input.pressed('Digit3')) world.combat.selectWeapon('smg');
    // Reload.
    if (input.pressed('KeyR')) world.combat.reload();
    // Shoot.
    if (input.down('KeyG')) world.combat.tryShoot();
    // Radio.
    if (input.pressed('KeyQ')) {
      world.radio.setStation(world.radio.station + 1);
      world.hud.toast('Radio: ' + world.radio.name);
    }
  }
  // Returns true if the punch connected with something.
  punch() {
    const world = this.world;
    const p = world.player;
    world.audio.blip(140, 0.08, 'square', 0.12, 70);
    // Crime intervention: punch the thief.
    if (world.crime.tryPunch()) return true;
    // ATM rob: near the bank front.
    const bank = TUNE.landmarks.bank;
    if (dist2d(p.pos.x, p.pos.z, bank.x, bank.z) < 16) {
      world.robAtm();
      return true;
    }
    // Punch an enemy at close range.
    const e = world.combat.nearestEnemy(2.2);
    if (e) {
      world.combat.damageEnemy(e, 34, world);
      return true;
    }
    return false;
  }
  nearestCar(maxDist = 4.5) {
    const p = this.world.player;
    let best = null;
    let bestD = maxDist;
    for (const car of this.world.allCars) {
      if (!car.alive || car.isPolice) continue;
      const d = dist2d(p.pos.x, p.pos.z, car.pos.x, car.pos.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }
  tryEnterCar() {
    const world = this.world;
    const p = world.player;
    if (p.inCar) return false;
    const car = this.nearestCar();
    if (!car) return false;
    p.inCar = car;
    car.isParked = false;
    car.speed = 0;
    world.audio.door();
    world.hud.toast(car.spec.label + ' — drive with WASD, F to get out');
    return true;
  }
  // Spawn (or reuse) a sports car next to the player and get in.
  enterSportsCar() {
    const world = this.world;
    const p = world.player;
    if (p.inCar) return true;
    let car = null;
    for (const c of world.allCars) {
      if (c.alive && c.kind === 'sports' && !c.isPolice && dist2d(p.pos.x, p.pos.z, c.pos.x, c.pos.z) < 30) {
        car = c;
        break;
      }
    }
    if (!car) {
      car = new Car(world, 'sports', p.pos.x + Math.sin(p.heading) * 4, p.pos.z + Math.cos(p.heading) * 4, p.heading);
      world.allCars.push(car);
    } else {
      car.pos.set(p.pos.x + Math.sin(p.heading) * 3, 0, p.pos.z + Math.cos(p.heading) * 3);
      car.syncMesh(0);
    }
    p.inCar = car;
    car.speed = 0;
    world.audio.door();
    return true;
  }
  exitCar() {
    const world = this.world;
    const p = world.player;
    if (!p.inCar) return;
    const car = p.inCar;
    const side = Math.PI / 2;
    p.pos.set(
      car.pos.x + Math.sin(car.heading + side) * 2.5,
      0,
      car.pos.z + Math.cos(car.heading + side) * 2.5,
    );
    const fixed = world.city.resolveCircle(p.pos.x, p.pos.z, 0.6);
    p.pos.x = fixed.x;
    p.pos.z = fixed.z;
    p.heading = car.heading;
    p.inCar = null;
    world.audio.door();
  }
}
