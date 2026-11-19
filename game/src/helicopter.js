// helicopter.js — The Solmar PD air unit.
// Lifts off at four stars, circles the player's last known position,
// and sweeps a searchlight across the ground. While the spotlight
// is on the player the heat will not cool — hiding is impossible
// until the chopper is shot down or the player breaks line of sight.
import * as THREE from 'three';
import { TUNE, clamp, dist2d } from './tuning.js';

export class Helicopter {
  constructor(world) {
    this.world = world;
    this.active = false;
    this.lit = false;
    this.hp = 100;
    this.retreatTimer = 0;
    this.pos = new THREE.Vector3(0, 26, 0);
    this.lastKnown = new THREE.Vector3(0, 0, 0);
    this._wanted = false;
    this.group = new THREE.Group();
    // Nose along local +z so rotation.y = atan2(dx, dz) points the
    // chopper along its direction of travel.
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.6, 4.4),
      new THREE.MeshLambertMaterial({ color: 0x7a9aba }),
    );
    body.position.y = 0;
    this.group.add(body);
    // Red beacon on top, blinking, so the chopper reads at night.
    this.beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }),
    );
    this.beacon.position.set(0, 1.1, -1.2);
    this.group.add(this.beacon);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 3.4),
      new THREE.MeshLambertMaterial({ color: 0x7a9aba }),
    );
    tail.position.set(0, 0.3, -3.6);
    this.group.add(tail);
    const rotor = new THREE.Mesh(
      new THREE.BoxGeometry(9, 0.08, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x111111 }),
    );
    rotor.position.y = 1.1;
    this.group.add(rotor);
    this.rotor = rotor;
    const skid = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.12, 3.4),
      new THREE.MeshLambertMaterial({ color: 0x111111 }),
    );
    skid.position.y = -1;
    this.group.add(skid);
    // Searchlight: a real spotlight + a visible cone.
    this.spot = new THREE.SpotLight(0xfff2b0, 0, 90, 0.32, 0.5, 1.2);
    this.spot.position.set(0, -0.5, 0);
    this.group.add(this.spot);
    this.spot.target.position.set(0, -30, 0);
    this.group.add(this.spot.target);
    const coneGeo = new THREE.ConeGeometry(9, 26, 16, 1, true);
    this.cone = new THREE.Mesh(
      coneGeo,
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.cone.rotation.x = Math.PI;
    this.cone.position.y = -13.5;
    this.group.add(this.cone);
    this.group.visible = false;
    world.scene.dynamic.add(this.group);
  }
  request() {
    if (this.active || this.retreatTimer > 0) return;
    this._wanted = true;
  }
  // Launch immediately, already overhead — used by the ?shot= staging
  // so the chopper is in frame on the first rendered frame.
  forceLaunch() {
    const world = this.world;
    const p = world.player;
    this.retreatTimer = 0;
    this._wanted = false;
    this.active = true;
    this.hp = 100;
    this.pos.set(p.pos.x + 18, 26, p.pos.z + 18);
    this.lastKnown.set(p.pos.x, 0, p.pos.z);
    this.group.visible = true;
  }
  _launch() {
    const world = this.world;
    const p = world.player;
    this.active = true;
    this.hp = 100;
    this._wanted = false;
    // Lift off close overhead so the spotlight is on the player
    // within a frame or two of the launch.
    this.pos.set(p.pos.x + 25, 26, p.pos.z + 25);
    this.lastKnown.set(p.pos.x, 0, p.pos.z);
    this.group.visible = true;
    world.hud.toast('PD air unit overhead — break line of sight!');
    world.audio.blip(440, 0.3, 'sawtooth', 0.12, 880);
  }
  damage(n, world) {
    if (!this.active) return;
    this.hp -= n;
    world.effects.smoke(this.pos);
    if (this.hp <= 0) {
      this.active = false;
      this.lit = false;
      this.retreatTimer = TUNE.heliRetreatSec;
      this.group.visible = false;
      this.spot.intensity = 0;
      this.cone.material.opacity = 0;
      world.effects.explosion(this.pos);
      world.hud.toast('Air unit down! The sky is clear — for now.');
      world.audio.noise(0.5, 0.4, 700);
    }
  }
  update(dt) {
    const world = this.world;
    if (this.retreatTimer > 0) this.retreatTimer -= dt;
    if (this._wanted && world.police.wanted >= TUNE.heliWanted) {
      this._launch();
    }
    if (!this.active) {
      this.lit = false;
      return;
    }
    if (world.police.wanted < TUNE.heliWanted) {
      // Heat dropped: the chopper peels away.
      this.active = false;
      this.lit = false;
      this.group.visible = false;
      this.spot.intensity = 0;
      this.cone.material.opacity = 0;
      return;
    }
    const p = world.player;
    // Track the player's last known position; drift toward it.
    this.lastKnown.x += (p.pos.x - this.lastKnown.x) * Math.min(1, dt * 0.4);
    this.lastKnown.z += (p.pos.z - this.lastKnown.z) * Math.min(1, dt * 0.4);
    const dx = this.lastKnown.x - this.pos.x;
    const dz = this.lastKnown.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    const speed = 26;
    if (d > 4) {
      this.pos.x += (dx / d) * speed * dt;
      this.pos.z += (dz / d) * speed * dt;
    }
    // Hover height with a gentle bob.
    this.pos.y = 26 + Math.sin(world.time.now * 1.4) * 1.2;
    this.group.position.copy(this.pos);
    this.group.rotation.y = Math.atan2(dx, dz);
    this.rotor.rotation.y += dt * 22;
    this.beacon.visible = Math.floor(world.time.now * 2.5) % 2 === 0;
    // Spotlight: on when the player is under the cone and it is dark
    // enough for the beam to matter — and always on at four stars
    // once the chopper is overhead (within 45m).
    const overhead = dist2d(this.pos.x, this.pos.z, p.pos.x, p.pos.z) < 45;
    const night = world.city.nightness();
    this.lit = overhead;
    this.spot.intensity = overhead ? (night > 0.4 ? 2.6 : 1.4) : 0;
    this.cone.material.opacity = overhead ? (night > 0.4 ? 0.16 : 0.07) : 0;
    // The beam follows the player when lit (the spotlight target
    // tracks them; the visible cone hangs straight down).
    if (overhead) {
      this.spot.target.position.set(p.pos.x - this.pos.x, -26, p.pos.z - this.pos.z);
    }
  }
}
