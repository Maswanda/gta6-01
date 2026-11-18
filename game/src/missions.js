// The story v2: Jax Marlowe, a retired getaway driver in Solmar Bay, gets
// pulled back in by Mara Voss. Nine missions now, each a chain of steps —
// go to, talk, steal, deliver on a timer, fight, race, escape — with a
// beacon in the world, a blip on the minimap and a payout at the end of
// each one. Finishing the docks unlocks the shotgun; beating the rival crew
// unlocks the SMG. Press M any time to see the whole job list.
import { CFG } from './config.js';

export class Missions {
  constructor(scene, landmarks) {
    this.scene = scene;
    this.landmarks = landmarks;
    this.index = 0;
    this.step = 0;
    this.done = false;
    this.timer = 0;
    this.hasPackage = false;
    this.hasCash = false;
    this.talkReady = false;
    this.defs = this.buildDefs();
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
            talk: 'Package secured. The buyer is across town — move fast, the heat is already on.',
            gives: 'package', wanted: 2 },
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
          { text: 'Deal with the Kestrel crew (3 left)', target: L.docks, radius: 30, type: 'defeat',
            center: 'docks', enemies: [
              { kind: 'brawler', dx: 6, dz: 4 },
              { kind: 'brawler', dx: -5, dz: 8 },
              { kind: 'brawler', dx: 2, dz: -7 },
            ] },
        ],
      },
      {
        id: 'the-informant',
        title: '5 — The Informant',
        story: 'A Kestrel informant will talk — in Old Town, by the clock tower. Bring what he gives you to the Marina.',
        reward: 400,
        steps: [
          { text: 'Meet the informant at the Old Town clock tower', target: L.clockTower, radius: 5, type: 'talk',
            talk: 'Informant: "The Kestrels are moving product through the Marina. Take this ledger to the boat — quietly."',
            gives: 'package' },
          { text: 'Carry the ledger to the Marina', target: L.marina, radius: 6, type: 'deliver' },
        ],
      },
      {
        id: 'smash-and-grab',
        title: '6 — Smash and Grab',
        story: 'A gold sports car sits at the Marina, keys in it. Take it — and get it to Rico before its owner notices.',
        reward: 700,
        steps: [
          { text: 'Go to the Marina', target: L.marina, radius: 8, type: 'goto' },
          { text: 'Steal the gold sports car (press E)', target: null, radius: 0, type: 'steal-sports' },
          { text: 'Get the sports car to Rico\'s garage — beat the clock!', target: L.garage, radius: 6, type: 'deliver', time: 120 },
        ],
      },
      {
        id: 'street-heat',
        title: '7 — Street Heat',
        story: 'The Kestrel crew races the beachfront every night. Beat their course and the streets are yours.',
        reward: 700,
        steps: [
          { text: 'Get to the race start at Rico\'s garage', target: L.garage, radius: 8, type: 'goto' },
          { text: 'Win the street race — 4 checkpoints, beat the clock!', target: L.garage, radius: 8, type: 'race' },
        ],
      },
      {
        id: 'the-rival',
        title: '8 — The Rival',
        story: 'The Kestrel crew is back at the warehouse — and this time they brought guns. End it.',
        reward: 800,
        steps: [
          { text: 'Go to the warehouse', target: L.warehouse, radius: 8, type: 'goto' },
          { text: 'Take down the Kestrel crew (5 left)', target: L.warehouse, radius: 30, type: 'defeat',
            center: 'warehouse', enemies: [
              { kind: 'brawler', dx: 6, dz: 4 },
              { kind: 'brawler', dx: -5, dz: 8 },
              { kind: 'shooter', dx: 2, dz: -7 },
              { kind: 'shooter', dx: -8, dz: -4 },
              { kind: 'shooter', dx: 10, dz: 2 },
            ] },
        ],
      },
      {
        id: 'big-score',
        title: '9 — The Big Score',
        story: 'Solmar Bank, midday, one bag. Grab it, lose the cops, get home.',
        reward: 2000,
        steps: [
          { text: 'Get to Solmar Bank', target: L.bank, radius: 6, type: 'goto' },
          { text: 'Grab the cash (press E)', target: L.bank, radius: 4, type: 'talk',
            talk: 'Cash in the bag — three stars and every cruiser in the city is coming. RUN.',
            gives: 'cash', wanted: 3 },
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
    if (s.type === 'defeat' && s.enemies) {
      const base = this.landmarks[s.center || 'docks'];
      world.combat.spawnEnemies(world, s.enemies.map((e) => ({
        pos: new THREE.Vector3(base.x + e.dx, 0, base.z + e.dz),
        kind: e.kind,
      })));
      world.hud.flashMessage(`${s.enemies.length} of them. Fists or pistol — your call.`);
    }
    if (s.type === 'race') {
      world.side.startRace(world, true);
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

  update(dt, world) {
    if (this.done) return;
    const s = this.currentStep();
    if (!s) return;
    const p = world.player.inCar ? world.player.inCar.pos : world.player.pos;
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
    if (s.type === 'race') {
      // The race owns this step: it advances on a win, fails on a timeout.
      return;
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
    if (s.type === 'steal-sports') {
      const car = world.player.inCar;
      if (car && car.stolen && car.type === 'sports') {
        world.hud.flashMessage('That\'s the one — get it to Rico\'s!');
        this.advance(world);
      } else if (car && car.stolen) {
        world.hud.setPrompt('Wrong car — the gold sports car is at the Marina');
      }
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
          if (s.gives === 'package') this.hasPackage = true;
          if (s.gives === 'cash') this.hasCash = true;
          if (s.wanted) world.police.addWanted(s.wanted, world);
          this.advance(world);
        }
      }
      return;
    }
    if (s.type === 'deliver') {
      if (this.current().id === 'the-informant' && !this.hasPackage) return;
      if (this.current().id === 'hot-delivery' && !this.hasPackage) return;
      if (this.current().id === 'smash-and-grab' && !world.player.inCar) return;
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
    if (s.target) {
      const d = Math.hypot(p.x - s.target.x, p.z - s.target.z);
      if (d < s.radius) this.advance(world);
    }
  }

  failStep(world) {
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
      world.player.cash += m.reward;
      world.hud.showBanner('MISSION COMPLETE', `${m.title} — +$${m.reward}`);
      world.hud.flashMessage(`+$${m.reward} — ${m.title} done`);
      world.sound.fanfare();
      world.combat.clearEnemies();
      // Weapon rewards for the story's big fights.
      if (m.id === 'payback') world.combat.unlock('shotgun', world);
      if (m.id === 'the-rival') world.combat.unlock('smg', world);
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
