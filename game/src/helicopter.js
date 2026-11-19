// HelicopterAI — the Solmar Bay PD air unit. v4's headline system: when the
// player's wanted level reaches four stars, a chopper lifts off, closes in
// and pins the player in a searchlight cone. While the light is on the
// player, hiding from ground units does nothing — the only escapes are to
// break line of sight, reach the safehouse, or shoot the chopper down. The
// rotor is a third WebAudio voice, the downwash kicks up dust on the street,
// and pedestrians scatter when the light sweeps over them.
import { CFG } from './config.js';

const ROTOR_WASH_INTERVAL = 0.14;

export class HelicopterAI {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.hp = CFG.heliHp;
    this.retreatTimer = 0;
    this.searchTimer = 0;
    this.orbitAngle = 0;
    this.washTimer = 0;
    this.litPlayer = false;
    this.lastKnown = new THREE.Vector3();
    this.pos = new THREE.Vector3();
    this.group = null;
    this.rotor = null;
    this.tailRotor = null;
    this.spot = null;
    this.spotTarget = null;
    this.cone = null;
  }

  // Build the airframe once: dark-blue body, tail boom and fin, a long
  // main rotor, a small tail rotor, skids, and a searchlight bell under
  // the nose. Everything is primitives and Lambert materials — no assets.
  buildMesh() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1d3a6e });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x101418 });
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fd4e8, emissive: 0x1a3a4a });
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.4, 1.8), bodyMat);
    body.position.y = 0;
    g.add(body);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 1.6), glassMat);
    nose.position.set(2.2, 0.1, 0);
    g.add(nose);
    const boom = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.5, 0.5), bodyMat);
    boom.position.set(-3.6, 0.4, 0);
    g.add(boom);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.6, 0.9), darkMat);
    fin.position.set(-5.6, 1.0, 0);
    g.add(fin);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.8, 8), darkMat);
    mast.position.y = 1.0;
    g.add(mast);
    this.rotor = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.08, 0.5), darkMat);
    this.rotor.position.y = 1.45;
    g.add(this.rotor);
    this.tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.3), darkMat);
    this.tailRotor.position.set(-5.6, 0.6, 0.5);
    g.add(this.tailRotor);
    for (const z of [-0.8, 0.8]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.12, 0.12), darkMat);
      skid.position.set(0, -1.0, z);
      g.add(skid);
    }
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xfff6c8, emissive: 0xffe98a }),
    );
    lamp.position.set(1.6, -0.9, 0);
    g.add(lamp);
    // The searchlight: a real SpotLight aimed at the street, plus a faint
    // translucent cone so the beam reads in screenshots even in daylight.
    this.spot = new THREE.SpotLight(0xfff2b0, 900, 90, 0.32, 0.45, 1.2);
    this.spot.position.set(1.6, -0.9, 0);
    this.spotTarget = new THREE.Object3D();
    this.spot.target = this.spotTarget;
    g.add(this.spot);
    g.add(this.spotTarget);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xfff2b0, transparent: true, opacity: 0.10,
      side: THREE.DoubleSide, depthWrite: false,
    });
    // ConeGeometry puts its apex at the top (+h/2): sitting at -altitude/2
    // the apex is at the chopper and the wide base rests on the street.
    this.cone = new THREE.Mesh(new THREE.ConeGeometry(9, CFG.heliAltitude, 18, 1, true), coneMat);
    this.cone.position.y = -CFG.heliAltitude / 2;
    g.add(this.cone);
    this.group = g;
    this.scene.add(g);
    g.visible = false;
  }

  // Lift off above the player, already hunting.
  spawnNow(world) {
    if (!this.group) this.buildMesh();
    const p = world.player.inCar ? world.player.inCar.pos : world.player.pos;
    this.pos.set(p.x - 18, CFG.heliAltitude, p.z - 18);
    this.lastKnown.set(p.x, 0, p.z);
    this.hp = CFG.heliHp;
    this.active = true;
    this.litPlayer = false;
    this.searchTimer = 0;
    this.group.visible = true;
    this.group.position.copy(this.pos);
    world.hud.flashMessage('PD air unit overhead — break the spotlight or get home!');
    world.sound.siren();
  }

  remove(world) {
    if (this.group) this.group.visible = false;
    this.active = false;
    this.litPlayer = false;
    if (world) world.sound.rotor(false);
  }

  // Gunfire from the player: the chopper takes the hit, smokes, and at
  // zero health breaks off and stays away for a while.
  damage(amount, world) {
    if (!this.active) return;
    this.hp -= amount;
    world.effects.sparks(this.pos);
    if (this.hp <= 0) {
      this.retreatTimer = CFG.heliRetreatSeconds;
      this.remove(world);
      world.hud.flashMessage('Air unit shot down — the sky is clear for now!');
      world.sound.jingle();
    }
  }

  // True while the searchlight is actually on the player. The police use
  // this to decide whether hiding still works.
  spotlightOnPlayer() {
    return this.active && this.litPlayer;
  }

  // Where the light is pointing on the ground — pedestrians scatter from
  // it. The target lives in the chopper's local space, so add the chopper's
  // own position back to get world coordinates.
  litPos() {
    if (!this.active) return null;
    return new THREE.Vector3(
      this.spotTarget.position.x + this.pos.x, 0,
      this.spotTarget.position.z + this.pos.z,
    );
  }

  // True when the player is sheltering at the safehouse: the chopper holds
  // off and cannot spot them.
  sheltering(world) {
    const L = world.city.landmarks.safehouse;
    if (!L) return false;
    const p = world.player.inCar ? world.player.inCar.pos : world.player.pos;
    return Math.hypot(p.x - L.x, p.z - L.z) < CFG.safehouseRadius + 2;
  }

  update(dt, world) {
    if (this.retreatTimer > 0) this.retreatTimer -= dt;
    const wanted = world.police.wanted;
    if (!this.active) {
      if (wanted >= CFG.heliWanted && this.retreatTimer <= 0) this.spawnNow(world);
      return;
    }
    if (wanted <= 0) {
      this.remove(world);
      world.hud.flashMessage('Air unit stood down.');
      return;
    }
    const p = world.player.inCar ? world.player.inCar.pos : world.player.pos;
    const safe = this.sheltering(world);
    // Orbit the player, closing in fast from far away, holding a loose
    // circle once overhead.
    this.orbitAngle += CFG.heliOrbitSpeed * dt;
    const dist = Math.hypot(this.pos.x - p.x, this.pos.z - p.z);
    const tx = p.x + Math.cos(this.orbitAngle) * 12;
    const tz = p.z + Math.sin(this.orbitAngle) * 12;
    const speed = dist > 40 ? CFG.heliTopSpeed : CFG.heliTopSpeed * 0.45;
    const dx = tx - this.pos.x;
    const dz = tz - this.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    const step = Math.min(d, speed * dt);
    this.pos.x += (dx / d) * step;
    this.pos.z += (dz / d) * step;
    this.pos.y = CFG.heliAltitude;
    this.group.position.copy(this.pos);
    this.group.rotation.y = Math.atan2(-(p.z - this.pos.z), p.x - this.pos.x);
    this.rotor.rotation.y += dt * 28;
    this.tailRotor.rotation.x += dt * 40;
    world.sound.rotor(true, dt);
    // The spotlight tracks the player while they are out in the open; once
    // they break the beam it sweeps the last place they were seen.
    const close = Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < CFG.heliSpotRadius;
    if (close && !safe) {
      this.litPlayer = true;
      this.searchTimer = CFG.heliSearchSeconds;
      this.lastKnown.set(p.x, 0, p.z);
      // Local space: the chopper sits at +altitude, so the ground target is
      // one altitude below it, offset toward the player.
      this.spotTarget.position.set(p.x - this.pos.x, -CFG.heliAltitude, p.z - this.pos.z);
    } else {
      this.litPlayer = false;
      if (this.searchTimer > 0) this.searchTimer -= dt;
      const sweep = performance.now() / 1000 * 0.8;
      this.spotTarget.position.set(
        this.lastKnown.x - this.pos.x + Math.cos(sweep) * 10,
        -CFG.heliAltitude,
        this.lastKnown.z - this.pos.z + Math.sin(sweep) * 10,
      );
    }
    // Downwash: dust puffs on the street below, on a short timer.
    this.washTimer -= dt;
    if (this.washTimer <= 0) {
      this.washTimer = ROTOR_WASH_INTERVAL;
      world.effects.rotorWash(new THREE.Vector3(this.pos.x, 0, this.pos.z));
    }
  }
}
