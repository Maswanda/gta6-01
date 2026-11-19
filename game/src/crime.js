// Dynamic Crime System v4: Solmar Bay does not wait for a mission to feel
// alive. Between story jobs, ambient crime erupts on its own — a thug
// jacking a parked car, a fugitive sports car fleeing two interceptors, a
// thief working the bank ATM — and the player can step in for a reward, or
// ignore it and watch it fizzle. The police dispatch to active events, and
// nearby pedestrians scatter. The player can also rob the ATM themselves
// (press E at the bank, +$250 and +2 wanted, on a cooldown). Events are
// seeded, so the same city spawns the same sequence of crimes. v4: stopping
// a crime while the chopper is overhead pays a $50 air-assist bonus.
import { CFG } from './config.js';
import { Rng } from './random.js';
import { Car } from './vehicles.js';

const EVENT_TYPES = ['carjacking', 'pursuit', 'atm'];

export class CrimeSystem {
  constructor(scene, landmarks, rng) {
    this.scene = scene;
    this.landmarks = landmarks;
    // A seeded stream of its own, so crime never disturbs the city layout.
    this.rng = rng.fork(CFG.crimeSeed);
    this.event = null;
    this.cooldown = 50; // first ambient event after ~50s of game time
    this.interventions = 0;
    this.eventsSeen = 0;
    this.atmRobTimer = 0;
    // The ATM sits on the bank's south face.
    const bank = landmarks.bank;
    this.atmPos = new THREE.Vector3(bank.x + 4, 0, bank.z + 16);
    this.buildAtm();
    // Red beacon over an active event, in the mission beacon's style.
    this.beacon = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.32, depthWrite: false }),
    );
    beam.position.y = 30;
    this.beacon.add(beam);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 3.0, 32),
      new THREE.MeshBasicMaterial({ color: 0xff3333, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.12;
    this.beacon.add(ring);
    this.beacon.visible = false;
    scene.add(this.beacon);
    this.beaconRing = ring;
  }

  buildAtm() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 2.0, 0.8),
      new THREE.MeshLambertMaterial({ color: 0x2a4a6a }),
    );
    body.position.y = 1.0;
    g.add(body);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.7),
      new THREE.MeshBasicMaterial({ color: 0x39d0ff }),
    );
    screen.position.set(0, 1.45, 0.42);
    g.add(screen);
    const slot = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.12, 0.1),
      new THREE.MeshLambertMaterial({ color: 0x111111 }),
    );
    slot.position.set(0, 0.9, 0.42);
    g.add(slot);
    g.position.copy(this.atmPos);
    this.scene.add(g);
    this.atmMesh = g;
  }

  // --- Player robbery -------------------------------------------------------
  // The debug hook and the E interaction both call this: +$250, +2 wanted,
  // 90s cooldown. Returns false while the cooldown runs.
  robAtm(world) {
    if (this.atmRobTimer > 0) return false;
    this.atmRobTimer = CFG.atmRobCooldown;
    world.player.cash += CFG.atmRobReward;
    world.police.addWanted(CFG.atmRobWanted, world);
    world.hud.flashMessage(`ATM robbed — +$${CFG.atmRobReward}! The PD is coming.`);
    world.hud.showCashPopup(CFG.atmRobReward);
    world.sound.register();
    world.effects.cashShower(this.atmPos.clone().setY(1.5));
    world.save.save();
    return true;
  }

  // --- Event lifecycle ------------------------------------------------------
  forceCrime(type, world) {
    if (this.event) this.clearCrime(world);
    return this.spawnEvent(type, world);
  }

  clearCrime(world) {
    if (!this.event) return;
    this.removeEventActors(world);
    this.event = null;
    this.beacon.visible = false;
    this.cooldown = CFG.crimeCooldown;
  }

  spawnEvent(type, world) {
    if (type === 'carjacking') return this.spawnCarjacking(world);
    if (type === 'pursuit') return this.spawnPursuit(world);
    return this.spawnAtmRobbery(world);
  }

  pickEventType() {
    return this.rng.pick(EVENT_TYPES);
  }

  // A thug walks up to a parked car, steals it and flees. Ram the car, or
  // punch the thug before he gets in.
  spawnCarjacking(world) {
    const candidates = world.parkedCars.filter(
      (c) => c.alive && !c.isPlayer && !c.stolen && c !== world.marinaSports,
    );
    if (!candidates.length) return false;
    const car = this.rng.pick(candidates);
    const thug = this.spawnCrimePed(world, car.pos.x + 3, car.pos.z + 2, 'thug');
    if (!thug) return false;
    this.event = {
      type: 'carjacking', age: 0, car, thug, phase: 'approach',
      grace: 0, responders: [],
    };
    this.eventsSeen += 1;
    this.dispatchResponder(world, car.pos);
    this.announce(world, '🚨 Carjacking in progress — stop the thief!');
    return true;
  }

  // A fugitive sports car flees two interceptors. Ram the fugitive.
  spawnPursuit(world) {
    const p = world.player.inCar ? world.player.inCar.pos : world.player.pos;
    const angle = this.rng.range(0, Math.PI * 2);
    const x = p.x + Math.sin(angle) * 45;
    const z = p.z + Math.cos(angle) * 45;
    const heading = Math.atan2(p.x - x, p.z - z);
    const fugitive = new Car(this.scene, x, z, heading, 0xd83a5a, { type: 'sports' });
    fugitive.targetSpeed = 26;
    fugitive.topSpeedOverride = 30;
    world.allCars.push(fugitive);
    const interceptors = [];
    for (let i = 0; i < 2; i++) {
      const back = 12 + i * 8;
      const ix = x - Math.sin(heading) * back + (i === 0 ? -3 : 3);
      const iz = z - Math.cos(heading) * back;
      const cop = new Car(this.scene, ix, iz, heading, 0x1a1a22, { police: true });
      cop.targetSpeed = CFG.policeTopSpeed;
      cop.topSpeedOverride = CFG.policeTopSpeed;
      world.allCars.push(cop);
      interceptors.push(cop);
    }
    this.event = {
      type: 'pursuit', age: 0, fugitive, interceptors, responders: interceptors,
    };
    this.eventsSeen += 1;
    this.announce(world, '🚨 Police pursuit — ram the fugitive to help the PD!');
    return true;
  }

  // A thief works the bank ATM. Punch him to stop the robbery.
  spawnAtmRobbery(world) {
    const thief = this.spawnCrimePed(world, this.atmPos.x + 1.5, this.atmPos.z + 1, 'thief');
    if (!thief) return false;
    this.event = { type: 'atm', age: 0, thief, responders: [] };
    this.eventsSeen += 1;
    this.dispatchResponder(world, this.atmPos);
    this.announce(world, '🚨 ATM robbery at Solmar Bank — stop the thief!');
    return true;
  }

  spawnCrimePed(world, x, z, role) {
    if (!world.peds) return null;
    const ped = world.peds.spawnOne(this.rng);
    ped.pos.set(x, 0, z);
    ped.mesh.position.copy(ped.pos);
    ped.waiting = true;
    ped.speed = 0;
    ped.isCrime = true;
    ped.crimeRole = role;
    world.peds.list.push(ped);
    return ped;
  }

  dispatchResponder(world, pos) {
    const p = world.player.inCar ? world.player.inCar.pos : world.player.pos;
    const angle = Math.atan2(p.x - pos.x, p.z - pos.z);
    const x = pos.x + Math.sin(angle) * 55;
    const z = pos.z + Math.cos(angle) * 55;
    const cop = new Car(this.scene, x, z, angle, 0x1a1a22, { police: true });
    cop.targetSpeed = CFG.policeTopSpeed;
    cop.topSpeedOverride = CFG.policeTopSpeed;
    world.allCars.push(cop);
    if (this.event) this.event.responders.push(cop);
    return cop;
  }

  announce(world, text) {
    world.hud.flashMessage(text);
    world.sound.sting();
    const pos = this.eventPos();
    if (pos) {
      this.beacon.position.set(pos.x, 0, pos.z);
      this.beacon.visible = true;
    }
  }

  eventPos() {
    const e = this.event;
    if (!e) return null;
    if (e.type === 'carjacking') return e.car ? e.car.pos.clone() : null;
    if (e.type === 'pursuit') return e.fugitive ? e.fugitive.pos.clone() : null;
    if (e.type === 'atm') return e.thief ? e.thief.pos.clone() : null;
    return null;
  }

  removeEventActors(world) {
    const e = this.event;
    if (!e) return;
    for (const cop of e.responders || []) {
      cop.remove();
      const i = world.allCars.indexOf(cop);
      if (i >= 0) world.allCars.splice(i, 1);
    }
    if (e.type === 'pursuit' && e.fugitive) {
      e.fugitive.remove();
      const i = world.allCars.indexOf(e.fugitive);
      if (i >= 0) world.allCars.splice(i, 1);
    }
    if (e.thug) this.removeCrimePed(world, e.thug);
    if (e.thief) this.removeCrimePed(world, e.thief);
  }

  removeCrimePed(world, ped) {
    const i = world.peds.list.indexOf(ped);
    if (i >= 0) world.peds.list.splice(i, 1);
    world.peds.scene.remove(ped.mesh);
  }

  resolve(world, reward, text) {
    this.interventions += 1;
    // v4: if the chopper is overhead when a crime is stopped, the PD pays
    // a $50 air-assist bonus on top of the reward.
    if (world.heli && world.heli.active) reward += 50;
    world.player.cash += reward;
    world.hud.showCashPopup(reward);
    world.hud.showBanner('CRIME STOPPED', `${text} — +$${reward}`);
    world.hud.flashMessage(`${text} — +$${reward}`);
    world.sound.register();
    const pos = this.eventPos();
    if (pos) world.effects.cashShower(pos.clone().setY(1.5));
    world.save.save();
    this.removeEventActors(world);
    this.event = null;
    this.beacon.visible = false;
    this.cooldown = CFG.crimeCooldown;
  }

  fizzle(world) {
    world.hud.flashMessage('The crime fizzled out — Solmar Bay moves on.');
    this.removeEventActors(world);
    this.event = null;
    this.beacon.visible = false;
    this.cooldown = CFG.crimeCooldown;
  }

  update(dt, world) {
    if (this.atmRobTimer > 0) this.atmRobTimer -= dt;
    if (!this.event) {
      this.cooldown -= dt;
      if (this.cooldown <= 0) {
        this.spawnEvent(this.pickEventType(), world);
        this.cooldown = CFG.crimeCooldown;
      }
      return;
    }
    const e = this.event;
    e.age += dt;
    if (e.age > CFG.crimeLifetime) {
      this.fizzle(world);
      return;
    }
    const pos = this.eventPos();
    if (pos) {
      this.beacon.position.set(pos.x, 0, pos.z);
      this.beacon.visible = true;
      this.beaconRing.scale.setScalar(1 + Math.sin(performance.now() / 300) * 0.15);
      // Nearby pedestrians scatter from the crime, not just from the player.
      world.peds.scatterFrom(pos, 30);
    }
    if (e.type === 'carjacking') this.updateCarjacking(dt, world, e);
    else if (e.type === 'pursuit') this.updatePursuit(dt, world, e);
    else if (e.type === 'atm') this.updateAtm(dt, world, e);
    this.updateResponders(dt, world, e, pos);
  }

  updateCarjacking(dt, world, e) {
    const car = e.car;
    if (e.phase === 'approach' && e.thug) {
      // The thug walks up to the car and gets in.
      const dx = car.pos.x - e.thug.pos.x;
      const dz = car.pos.z - e.thug.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.6) {
        e.phase = 'flee';
        e.grace = 0.4;
        car.stolen = true;
        car.parked = false;
        car.targetSpeed = 22;
        car.topSpeedOverride = 24;
        e.thug.mesh.visible = false;
        world.hud.flashMessage('The car is stolen — ram it to stop the thief!');
      } else {
        e.thug.pos.x += (dx / d) * 5 * dt;
        e.thug.pos.z += (dz / d) * 5 * dt;
        e.thug.mesh.position.copy(e.thug.pos);
        e.thug.heading = Math.atan2(dx, dz);
        e.thug.mesh.rotation.y = e.thug.heading;
      }
      // Punching the thug before he gets in stops the jacking.
      if (e.thug.down > 0) {
        this.resolve(world, CFG.crimeRewardCarjacking, 'Carjacker down');
      }
      return;
    }
    // The stolen car flees along the streets; the grace keeps a ram that
    // landed while it was still parked from counting.
    if (e.grace > 0) e.grace -= dt;
    else {
      const pc = world.player.inCar;
      if (pc && Math.hypot(pc.pos.x - car.pos.x, pc.pos.z - car.pos.z) < 3.2 && Math.abs(pc.speed) > 6) {
        this.resolve(world, CFG.crimeRewardCarjacking, 'Stolen car stopped');
        return;
      }
    }
    car.driveTraffic(dt, world.colliders, world.allCars);
  }

  updatePursuit(dt, world, e) {
    const f = e.fugitive;
    f.driveTraffic(dt, world.colliders, world.allCars);
    for (const cop of e.interceptors) {
      const dx = f.pos.x - cop.pos.x;
      const dz = f.pos.z - cop.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.01) continue;
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - cop.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, dh * 1.4));
      cop.drive(dist > 6 ? 1 : 0.4, steer, dt, world.colliders, world.allCars);
    }
    // Ram the fugitive to catch him.
    const pc = world.player.inCar;
    if (pc && Math.hypot(pc.pos.x - f.pos.x, pc.pos.z - f.pos.z) < 3.2 && Math.abs(pc.speed) > 6) {
      this.resolve(world, CFG.crimeRewardPursuit, 'Fugitive caught');
    }
  }

  updateAtm(dt, world, e) {
    // Punching the thief stops the robbery.
    if (e.thief.down > 0) {
      this.resolve(world, CFG.crimeRewardAtm, 'ATM thief down');
    }
  }

  updateResponders(dt, world, e, pos) {
    if (!pos) return;
    for (const cop of e.responders || []) {
      if (e.type === 'pursuit') continue; // the interceptors chase the fugitive
      const dx = pos.x - cop.pos.x;
      const dz = pos.z - cop.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 4) continue;
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - cop.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, dh * 1.4));
      cop.drive(1, steer, dt, world.colliders, world.allCars);
    }
  }

  getSave() {
    return { interventions: this.interventions, eventsSeen: this.eventsSeen };
  }

  applySave(d) {
    if (!d) return;
    this.interventions = d.interventions || 0;
    this.eventsSeen = d.eventsSeen || 0;
  }
}
