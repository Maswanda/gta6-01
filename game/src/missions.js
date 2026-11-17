// The story: Jax Marlowe, a retired getaway driver in Solmar Bay, gets pulled
// back in by Mara Voss. Five missions, each a chain of steps (go to, talk,
// steal, deliver on a timer, fight, escape), with a beacon in the world, a
// blip on the minimap and a payout at the end of each one.
import { CFG } from './config.js';

export class Missions {
  constructor(scene, landmarks) {
    this.scene = scene;
    this.landmarks = landmarks;
    this.index = 0; // which mission is active
    this.step = 0; // which step inside it
    this.done = false;
    this.timer = 0; // counts down on timed steps
    this.hasPackage = false;
    this.hasCash = false;
    this.talkReady = false;
    this.defs = this.buildDefs();
    // The beacon: a glowing column + ring marking the current objective.
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffd23a, transparent: true, opacity: 0.28, depthWrite: false,
    });
    this.beacon = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true), beamMat);
    beam.position.y = 30;
    this.beacon.add(beam);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 3.0, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd23a, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.12;
    this.beacon.add(ring);
    this.beacon.visible = false;
    scene.add(this.beacon);
    this.beaconRing = ring;
  }

  buildDefs() {
    const L = this.landmarks;
    return [
      {
        id: 'meet-mara',
        title: '1 — Meet Mara',
        story: 'Mara Voss is waiting on the pier. She has a job for you.',
        reward: 150,
        steps: [
          { text: 'Go to the pier and meet Mara', target: L.pier, radius: 4, type: 'talk',
            talk: 'Mara: "Jax. One last run and we\'re square. First — I need wheels. Borrow something nice."' },
        ],
      },
      {
        id: 'borrowed-wheels',
        title: '2 — Borrowed Wheels',
        story: 'Mara needs a clean car. Any car will do — preferably someone else\'s.',
        reward: 250,
        steps: [
          { text: 'Steal a car (walk up to one and press E)', target: null, radius: 0, type: 'steal' },
          { text: 'Drive it to Rico\'s garage', target: L.garage, radius: 6, type: 'goto' },
        ],
      },
      {
        id: 'hot-delivery',
        title: '3 — Hot Delivery',
        story: 'A package at the warehouse, a buyer at the rooftop bar. The cops will be watching.',
        reward: 500,
        steps: [
          { text: 'Pick up the package at the warehouse (press E)', target: L.warehouse, radius: 4, type: 'talk',
            talk: 'Package secured. The buyer is across town — move fast, the heat is already on.' },
          { text: 'Deliver the package to the rooftop bar — beat the clock!', target: L.bar, radius: 5, type: 'deliver', time: CFG.missionTimeLimit },
        ],
      },
      {
        id: 'payback',
        title: '4 — Payback at the Docks',
        story: 'The Kestrel crew jumped Mara\'s courier. Return the favour.',
        reward: 600,
        steps: [
          { text: 'Go to the docks', target: L.docks, radius: 8, type: 'goto' },
          { text: 'Deal with the Kestrel crew (3 left)', target: L.docks, radius: 30, type: 'defeat' },
        ],
      },
      {
        id: 'big-score',
        title: '5 — The Big Score',
        story: 'Solmar Bank, midday, one bag. Grab it, lose the cops, get home.',
        reward: 1500,
        steps: [
          { text: 'Get to Solmar Bank', target: L.bank, radius: 6, type: 'goto' },
          { text: 'Grab the cash (press E)', target: L.bank, radius: 4, type: 'talk',
            talk: 'Cash in the bag — three stars and every cruiser in the city is coming. RUN.' },
          { text: 'Lose the heat and reach the safehouse', target: L.safehouse, radius: 5, type: 'escape' },
        ],
      },
    ];
  }

  current() {
    return this.done ? null : this.defs[this.index];
  }

  currentStep() {
    const m = this.current();
    return m ? m.steps[this.step] : null;
  }

  objectiveText() {
    if (this.done) return 'Story complete — free roam Solmar Bay. Press M for missions.';
    const s = this.currentStep();
    return s ? s.text : '';
  }

  // The world-space point the beacon and minimap should mark, or null.
  targetPoint() {
    const s = this.currentStep();
    if (!s || !s.target) return null;
    return s.target;
  }

  startMission(world) {
    const m = this.current();
    if (!m) return;
    this.step = 0;
    this.timer = 0;
    world.hud.showBanner(m.title, m.story);
    world.hud.flashMessage(m.story);
    world.sound.jingle();
    this.enterStep(world);
  }

  enterStep(world) {
    const s = this.currentStep();
    if (!s) return;
    this.talkReady = false;
    if (s.type === 'deliver') this.timer = s.time || CFG.missionTimeLimit;
    if (s.type === 'defeat') {
      const base = this.landmarks.docks;
      world.combat.spawnEnemies(world, [
        new THREE.Vector3(base.x + 6, 0, base.z + 4),
        new THREE.Vector3(base.x - 5, 0, base.z + 8),
        new THREE.Vector3(base.x + 2, 0, base.z - 7),
      ]);
      world.hud.flashMessage('Three of them. Fists or pistol — your call.');
    }
    if (s.type === 'talk' && s.talk) this.talkReady = true;
    this.updateBeacon();
  }

  updateBeacon() {
    const t = this.targetPoint();
    if (!t) {
      this.beacon.visible = false;
      return;
    }
    this.beacon.visible = true;
    this.beacon.position.set(t.x, 0, t.z);
  }

  // Called every frame; returns 'complete' when the whole story is done.
  update(dt, world) {
    if (this.done) return;
    const s = this.currentStep();
    if (!s) return;
    const p = world.player.inCar ? world.player.inCar.pos : world.player.pos;
    // Beacon pulse.
    if (this.beacon.visible) {
      const t = performance.now() / 600;
      this.beaconRing.scale.setScalar(1 + Math.sin(t) * 0.15);
    }
    if (s.type === 'deliver' || (s.type === 'escape' && this.timer > 0)) {
      this.timer -= dt;
      if (this.timer <= 0) {
        world.hud.showBanner('TOO SLOW', 'The buyer walked. The job is still open — try again.');
        this.failStep(world);
        return;
      }
    }
    if (s.type === 'defeat') {
      const left = world.combat.enemiesLeft();
      if (left === 0) {
        this.advance(world);
      } else {
        s.text = `Deal with the Kestrel crew (${left} left)`;
      }
      return;
    }
    if (s.type === 'steal') {
      if (world.player.inCar && world.player.inCar.stolen) this.advance(world);
      return;
    }
    if (s.type === 'talk') {
      if (!s.target) return;
      const d = Math.hypot(p.x - s.target.x, p.z - s.target.z);
      if (d < s.radius) {
        world.hud.setPrompt('Press E — talk');
        if (world.input.consume('KeyE')) {
          if (s.talk) world.hud.flashMessage(s.talk);
          world.sound.chime();
          if (this.current().id === 'hot-delivery' && this.step === 0) {
            this.hasPackage = true;
            world.police.addWanted(2, world);
          }
          if (this.current().id === 'big-score' && this.step === 1) {
            this.hasCash = true;
            world.police.addWanted(3, world);
          }
          this.advance(world);
        }
      }
      return;
    }
    if (s.type === 'deliver') {
      if (!this.hasPackage) return;
      const d = Math.hypot(p.x - s.target.x, p.z - s.target.z);
      if (d < s.radius) {
        this.hasPackage = false;
        this.advance(world);
      }
      return;
    }
    if (s.type === 'escape') {
      const d = Math.hypot(p.x - s.target.x, p.z - s.target.z);
      if (d < s.radius && world.police.wanted === 0) {
        this.hasCash = false;
        this.advance(world);
      } else if (d < s.radius) {
        world.hud.setPrompt('Lose the cops first!');
      }
      return;
    }
    // Plain 'goto'.
    if (s.target) {
      const d = Math.hypot(p.x - s.target.x, p.z - s.target.z);
      if (d < s.radius) this.advance(world);
    }
  }

  failStep(world) {
    // Timed step failed: restart the current mission from its first step.
    this.step = 0;
    this.hasPackage = false;
    this.timer = 0;
    world.sound.busted();
    this.enterStep(world);
  }

  advance(world) {
    const m = this.current();
    this.step += 1;
    world.sound.chime();
    if (this.step >= m.steps.length) {
      // Mission complete: payout, save, next mission.
      world.player.cash += m.reward;
      world.hud.showBanner('MISSION COMPLETE', `${m.title} — +$${m.reward}`);
      world.hud.flashMessage(`+$${m.reward} — ${m.title} done`);
      world.sound.jingle();
      world.combat.clearEnemies();
      this.index += 1;
      this.step = 0;
      if (this.index >= this.defs.length) {
        this.done = true;
        this.beacon.visible = false;
        world.hud.showBanner('STORY COMPLETE', 'You pulled off the Big Score. Solmar Bay is yours — free roam!');
        world.save.save();
        return;
      }
      world.save.save();
      this.startMission(world);
      return;
    }
    this.enterStep(world);
  }
}
