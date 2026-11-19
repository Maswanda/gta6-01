// The story: Jax Marlowe, a retired getaway driver in Solmar Bay, gets
// pulled back in by Mara Voss. Twelve missions now, each a chain of steps —
// go to, talk, steal, deliver on a timer, fight, race, escape — with a
// beacon in the world, a blip on the minimap and a payout at the end of
// each one. Finishing the docks unlocks the shotgun; beating the rival crew
// unlocks the SMG. The tenth is the Marina Heist: slip past the casino
// guard, crack the vault, and outrun the whole PD to the safehouse. Press
// M any time to see the whole job list.
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
      {
        id: 'marina-heist',
        title: '10 — The Marina Heist',
        story: 'The Meridian Casino vault, one night, one crew. Slip past the guard, crack the vault, outrun the PD.',
        reward: CFG.heistReward,
        steps: [
          { text: 'Get to the Meridian Casino entrance', target: L.casinoEntrance, radius: 5, type: 'goto' },
          { text: 'Slip past the guard (press E)', target: L.casinoEntrance, radius: 4, type: 'talk',
            talk: 'Guard: "Meridian\'s closed to walk-ins tonight." You smile, show the forged pass, and walk in.' },
          { text: 'Take down the vault guards (2 left)', target: L.casino, radius: 30, type: 'defeat',
            center: 'casino', wanted: 3, enemies: [
              // Offsets keep the guards clear of the casino doorway
              // (78,-20) so nobody spawns on top of the player.
              { kind: 'shooter', dx: 2, dz: 8 },
              { kind: 'shooter', dx: 6, dz: 3 },
            ] },
          { text: 'Getaway — drive the cash to the safehouse, beat the clock!', target: L.safehouse, radius: 5, type: 'deliver', time: CFG.heistTimeLimit },
        ],
      },
      {
        id: 'air-support',
        title: '11 — Air Support',
        story: 'The PD put a chopper over the Bay. Lose the air unit and get home — the spotlight is the real enemy.',
        reward: CFG.mission11Reward,
        steps: [
          { text: 'Make some noise — the PD lifts the chopper at 4 stars', target: null, radius: 0, type: 'heli-trigger' },
          { text: 'Break the spotlight — lose the chopper and reach the safehouse', target: L.safehouse, radius: 5, type: 'escape' },
        ],
      },
      {
        id: 'last-run',
        title: '12 — The Last Run',
        story: "Mara's last job. One ledger, one pier, no heat. Bring the book home and the Bay is yours.",
        reward: CFG.mission12Reward,
        steps: [
          { text: 'Talk to Rico at the garage (press E)', target: L.garage, radius: 5, type: 'talk',
            talk: 'Rico: "Last one, Jax. The ledger goes to the pier — quiet, no heat."',
            gives: 'package' },
          { text: 'Carry the ledger to the pier, beat the clock!', target: L.pier, radius: 6, type: 'deliver', time: 150 },
          { text: 'Get home to the safehouse', target: L.safehouse, radius: 5, type: 'goto' },
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
    if (m.id === 'marina-heist') world.sound.heistSting();
    this.enterStep(world);
  }

  enterStep(world) {
    const s = this.currentStep();
    if (!s) return;
    this.talkReady = false;
    if (s.type === 'deliver') this.timer = s.time || CFG.missionTimeLimit;
    // A step that names a wanted level raises the heat when it starts
    // (the vault guards trip the alarm; a talk step raises it on the talk).
    if (s.wanted && s.type !== 'talk') world.police.addWanted(s.wanted, world);
    // The air-support step kicks the heat straight to four stars, so the
    // chopper lifts off the moment the job starts.
    if (s.type === 'heli-trigger') world.police.addWanted(CFG.heliWanted, world);
    if (s.type === 'defeat' && s.enemies) {
      const base = this.landmarks[s.center || 'docks'];
      world.combat.spawnEnemies(world, s.enemies.map((e) => ({
        pos: new THREE.Vector3(base.x + e.dx, 0, base.z + e.dz),
        kind: e.kind,
      })));
      world.hud.flashMessage(`${s.enemies.length} of them. Fists or pistol — your call.`);
    }
    if (s.type === 'race') world.side.startRace(world, true);
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

  // Distance from the player (or their car) to a step target.
  distTo(world, target) {
    const p = world.player.inCar ? world.player.inCar.pos : world.player.pos;
    return Math.hypot(p.x - target.x, p.z - target.z);
  }

  update(dt, world) {
    if (this.done) return;
    const s = this.currentStep();
    if (!s) return;
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
    // The race owns its step: it advances on a win, fails on a timeout.
    if (s.type === 'race') return;
    if (s.type === 'defeat') {
      const left = world.combat.enemiesLeft();
      if (left === 0) this.advance(world);
      else s.text = `Deal with the Kestrel crew (${left} left)`;
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
      this.stepTalk(s, world);
      return;
    }
    if (s.type === 'deliver') {
      this.stepDeliver(s, world);
      return;
    }
    if (s.type === 'escape') {
      this.stepEscape(s, world);
      return;
    }
    if (s.type === 'heli-trigger') {
      // The step is done once the air unit is overhead.
      if (world.heli && world.heli.active) this.advance(world);
      return;
    }
    if (s.target && this.distTo(world, s.target) < s.radius) this.advance(world);
  }

  stepTalk(s, world) {
    if (!s.target) return;
    if (this.distTo(world, s.target) >= s.radius) return;
    world.hud.setPrompt('Press E — talk');
    if (!world.input.consume('KeyE')) return;
    if (s.talk) world.hud.flashMessage(s.talk);
    world.sound.chime();
    if (s.gives === 'package') this.hasPackage = true;
    if (s.gives === 'cash') this.hasCash = true;
    if (s.wanted) world.police.addWanted(s.wanted, world);
    this.advance(world);
  }

  stepDeliver(s, world) {
    const id = this.current().id;
    if (id === 'the-informant' && !this.hasPackage) return;
    if (id === 'hot-delivery' && !this.hasPackage) return;
    if (id === 'last-run' && !this.hasPackage) return;
    if (id === 'smash-and-grab' && !world.player.inCar) return;
    if (this.distTo(world, s.target) >= s.radius) return;
    this.hasPackage = false;
    this.advance(world);
  }

  stepEscape(s, world) {
    if (this.distTo(world, s.target) >= s.radius) return;
    if (world.police.wanted === 0) {
      this.hasCash = false;
      this.advance(world);
    } else {
      world.hud.setPrompt('Lose the cops first!');
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
    if (this.step < m.steps.length) {
      this.enterStep(world);
      return;
    }
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
  }
}
