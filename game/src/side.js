// Side activities: the things that make Solmar Bay worth roaming when no
// mission is live — a taxi run, a hidden collectible hunt and a checkpoint
// street race. All three are repeatable, pay cash, and save their best
// results. Interact with T; collectibles are picked up by walking over them.
import { CFG } from './config.js';

const COLLECTIBLE_SPOTS = [
  { id: 'pier', at: 'pier' },
  { id: 'safehouse', at: 'safehouse' },
  { id: 'park-north', at: 'parkA' },
  { id: 'park-south', at: 'parkB' },
  { id: 'bank', at: 'bank' },
  { id: 'garage', at: 'garage' },
  { id: 'warehouse', at: 'warehouse' },
  { id: 'docks', at: 'docks' },
  { id: 'bar', at: 'bar' },
  { id: 'clocktower', at: 'clockTower' },
];

const RACE_POINTS = [
  new THREE.Vector3(104, 0, -104),
  new THREE.Vector3(-104, 0, -104),
  new THREE.Vector3(-104, 0, 104),
  new THREE.Vector3(104, 0, 104),
];

export class SideActivities {
  constructor(scene, landmarks) {
    this.scene = scene;
    this.landmarks = landmarks;
    this.collected = new Set();
    this.collectibleMeshes = new Map();
    this.taxi = { state: 'idle', passenger: null, dest: null, timer: 0 };
    this.race = { state: 'idle', index: 0, timer: 0, story: false };
    this.taxiBest = 0;
    this.raceBest = 0;
    this.taxiRuns = 0;
    this.raceRuns = 0;
    this.markerMat = new THREE.MeshBasicMaterial({
      color: 0x39d0ff, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide,
    });
    this.buildCollectibles();
    this.buildTaxiMarker();
    this.buildRaceMarkers();
  }

  // --- Collectibles ---------------------------------------------------------
  buildCollectibles() {
    const gold = new THREE.MeshLambertMaterial({ color: 0xffc23a, emissive: 0x8a6a00 });
    for (const spot of COLLECTIBLE_SPOTS) {
      const base = this.landmarks[spot.at];
      if (!base) continue;
      const g = new THREE.Group();
      const coin = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), gold);
      coin.position.y = 1.4;
      g.add(coin);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1.15, 24),
        new THREE.MeshBasicMaterial({ color: 0xffc23a, side: THREE.DoubleSide, transparent: true, opacity: 0.7 }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.08;
      g.add(ring);
      g.position.set(base.x + 3, 0, base.z + 3);
      this.scene.add(g);
      this.collectibleMeshes.set(spot.id, g);
    }
  }

  // --- Taxi -----------------------------------------------------------------
  buildTaxiMarker() {
    this.taxiMarker = new THREE.Group();
    const person = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 1.1, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x39d0ff }),
    );
    person.position.y = 1.0;
    this.taxiMarker.add(person);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xc98a5e }),
    );
    head.position.y = 1.8;
    this.taxiMarker.add(head);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.4, 24),
      new THREE.MeshBasicMaterial({ color: 0x39d0ff, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.08;
    this.taxiMarker.add(ring);
    this.taxiMarker.visible = false;
    this.scene.add(this.taxiMarker);
    // The destination beacon reuses the mission beacon style, in blue.
    this.taxiBeacon = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 55, 12, 1, true), this.markerMat);
    beam.position.y = 27;
    this.taxiBeacon.add(beam);
    this.taxiBeacon.visible = false;
    this.scene.add(this.taxiBeacon);
  }

  taxiSpots() {
    const L = this.landmarks;
    return [L.pier, L.bar, L.bank, L.garage, L.docks, L.safehouse, L.marina, L.clockTower, L.warehouse].filter(Boolean);
  }

  startTaxi(world) {
    const spots = this.taxiSpots();
    const from = spots[Math.floor(Math.random() * spots.length)];
    let to = spots[Math.floor(Math.random() * spots.length)];
    while (to === from) to = spots[Math.floor(Math.random() * spots.length)];
    this.taxi = { state: 'pickup', passenger: from.clone(), dest: to.clone(), timer: CFG.taxiTimeLimit };
    this.taxiMarker.position.set(from.x, 0, from.z);
    this.taxiMarker.visible = true;
    world.hud.flashMessage('Taxi fare waiting — get to the blue marker (press T to pick up).');
    world.sound.chime();
  }

  // --- Street race ----------------------------------------------------------
  buildRaceMarkers() {
    this.raceRings = RACE_POINTS.map((pt) => {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(3.4, 4.4, 32),
        new THREE.MeshBasicMaterial({ color: 0xff5a4a, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(pt.x, 0.12, pt.z);
      ring.visible = false;
      this.scene.add(ring);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.2, 45, 10, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xff5a4a, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
      );
      beam.position.set(pt.x, 22, pt.z);
      beam.visible = false;
      this.scene.add(beam);
      return { ring, beam, pt };
    });
    // Start line at the garage.
    this.raceStart = new THREE.Group();
    const flag = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 2.6, 5),
      new THREE.MeshLambertMaterial({ color: 0xff5a4a }),
    );
    flag.position.y = 1.3;
    this.raceStart.add(flag);
    const L = this.landmarks;
    this.raceStart.position.set(L.garage.x - 8, 0, L.garage.z);
    this.scene.add(this.raceStart);
  }

  startRace(world, story) {
    this.race = { state: 'racing', index: 0, timer: CFG.raceTimeLimit, story: !!story };
    this.raceRings.forEach((r, i) => {
      r.ring.visible = i === 0;
      r.beam.visible = i === 0;
    });
    world.hud.showBanner('STREET RACE', story ? 'Beat the checkpoints — the Kestrel crew is watching.' : '4 checkpoints, beat the clock. Fastest run pays.');
    world.hud.flashMessage('Race started — drive through the red rings in order!');
    world.sound.jingle();
  }

  // --- Frame update ---------------------------------------------------------
  update(dt, world) {
    const p = world.player.inCar ? world.player.inCar.pos : world.player.pos;
    // Collectibles spin; pick one up by walking over it.
    const t = performance.now() / 1000;
    for (const [id, g] of this.collectibleMeshes) {
      if (this.collected.has(id)) continue;
      g.children[0].rotation.y = t * 1.6;
      g.children[0].position.y = 1.4 + Math.sin(t * 2 + id.length) * 0.25;
      if (Math.hypot(p.x - g.position.x, p.z - g.position.z) < 2.2) {
        this.collected.add(id);
        g.visible = false;
        world.player.cash += 50;
        world.hud.flashMessage(`Solmar coin ${this.collected.size}/${CFG.collectibleCount} — +$50`);
        world.sound.chime();
        world.effects.burst(g.position, 0xffc23a, 10, 2.5, 0.6);
        if (this.collected.size >= CFG.collectibleCount) {
          world.player.cash += 500;
          world.hud.showBanner('COLLECTOR', 'All 10 Solmar coins found — bonus +$500!');
          world.sound.jingle();
        }
        world.save.save();
      }
    }
    // Taxi.
    if (this.taxi.state === 'pickup') {
      const d = Math.hypot(p.x - this.taxi.passenger.x, p.z - this.taxi.passenger.z);
      if (d < 5) {
        world.hud.setPrompt('Press T — pick up the passenger');
        if (world.input.consume('KeyT')) {
          this.taxi.state = 'deliver';
          this.taxiMarker.visible = false;
          this.taxiBeacon.position.set(this.taxi.dest.x, 0, this.taxi.dest.z);
          this.taxiBeacon.visible = true;
          world.hud.flashMessage('Passenger in! Get them there before the clock runs out.');
          world.sound.chime();
        }
      }
    } else if (this.taxi.state === 'deliver') {
      this.taxi.timer -= dt;
      if (this.taxi.timer <= 0) {
        this.taxi.state = 'idle';
        this.taxiBeacon.visible = false;
        world.hud.flashMessage('Too slow — the passenger got out and walked.');
        return;
      }
      const d = Math.hypot(p.x - this.taxi.dest.x, p.z - this.taxi.dest.z);
      if (d < 6) {
        const spent = CFG.taxiTimeLimit - this.taxi.timer;
        this.taxiRuns += 1;
        if (!this.taxiBest || spent < this.taxiBest) this.taxiBest = spent;
        world.player.cash += 80;
        this.taxi.state = 'idle';
        this.taxiBeacon.visible = false;
        world.hud.showBanner('FARE COMPLETE', `+$80 — ${Math.round(spent)}s (best ${Math.round(this.taxiBest)}s)`);
        world.sound.jingle();
        world.save.save();
      }
    }
    // Race.
    if (this.race.state === 'racing') {
      this.race.timer -= dt;
      if (this.race.timer <= 0) {
        this.race.state = 'idle';
        this.raceRings.forEach((r) => { r.ring.visible = false; r.beam.visible = false; });
        world.hud.showBanner('RACE OVER', 'Out of time — the checkpoints are still there when you are ready.');
        if (this.race.story) world.missions.failStep(world);
        return;
      }
      const cur = this.raceRings[this.race.index];
      const d = Math.hypot(p.x - cur.pt.x, p.z - cur.pt.z);
      if (d < 6) {
        cur.ring.visible = false;
        cur.beam.visible = false;
        world.effects.burst(cur.pt, 0xff5a4a, 12, 3, 0.7);
        world.sound.chime();
        this.race.index += 1;
        if (this.race.index >= this.raceRings.length) {
          const spent = CFG.raceTimeLimit - this.race.timer;
          this.raceRuns += 1;
          if (!this.raceBest || spent < this.raceBest) this.raceBest = spent;
          const story = this.race.story;
          this.race.state = 'idle';
          if (story) {
            world.missions.advance(world);
          } else {
            world.player.cash += 300;
            world.hud.showBanner('RACE WON', `+$300 — ${Math.round(spent)}s (best ${Math.round(this.raceBest)}s)`);
            world.sound.jingle();
          }
          world.save.save();
        } else {
          const next = this.raceRings[this.race.index];
          next.ring.visible = true;
          next.beam.visible = true;
          world.hud.flashMessage(`Checkpoint ${this.race.index + 1} of ${this.raceRings.length} — go!`);
        }
      }
    }
    // Idle: offer a taxi or a race when the player is near the garage.
    if (this.taxi.state === 'idle' && this.race.state === 'idle' && !world.missions.done) {
      const g = this.landmarks.garage;
      if (g && Math.hypot(p.x - g.x, p.z - g.z) < 12) {
        world.hud.setPrompt('Press T — taxi fare · hold Shift+T — street race');
        if (world.input.consume('KeyT')) {
          if (world.input.held('ShiftLeft') || world.input.held('ShiftRight')) this.startRace(world, false);
          else this.startTaxi(world);
        }
      }
    }
  }

  // --- Save / restore -------------------------------------------------------
  getSave() {
    return {
      collected: [...this.collected],
      taxiBest: this.taxiBest,
      raceBest: this.raceBest,
      taxiRuns: this.taxiRuns,
      raceRuns: this.raceRuns,
    };
  }

  applySave(d) {
    if (!d) return;
    this.collected = new Set(d.collected || []);
    for (const [id, g] of this.collectibleMeshes) g.visible = !this.collected.has(id);
    this.taxiBest = d.taxiBest || 0;
    this.raceBest = d.raceBest || 0;
    this.taxiRuns = d.taxiRuns || 0;
    this.raceRuns = d.raceRuns || 0;
  }

  reset() {
    this.collected = new Set();
    for (const g of this.collectibleMeshes.values()) g.visible = true;
    this.taxi = { state: 'idle', passenger: null, dest: null, timer: 0 };
    this.race = { state: 'idle', index: 0, timer: 0, story: false };
    this.taxiMarker.visible = false;
    this.taxiBeacon.visible = false;
    this.raceRings.forEach((r) => { r.ring.visible = false; r.beam.visible = false; });
  }
}
