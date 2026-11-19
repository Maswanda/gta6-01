// Cars: the player's ride, parked cars to steal, AI traffic on the avenues
// and police interceptors. Five drivable types — sedan, sports, van, truck
// and the muscle car, Rico's garage-only flagship — each with its own
// handling and its own body, so stealing a sports car actually feels
// different from stealing a van. One arcade driving model, tuned per type,
// with circle-vs-building and car-vs-car bumps.
import { CFG, STREET_LINES, VEHICLE_TYPES } from './config.js';
import { collideCircle } from './city.js';

const CAR_COLORS = [0xc23b2e, 0x2e6fc2, 0xe8c33a, 0x3aa84f, 0xe8e4da, 0x22242a, 0x7a4fc2, 0xd06a2e];

// Body specs per type: [width, height, depth, x, y, z, material] for the
// main body, the cabin and any extra part, plus the four wheel spots.
function bodySpec(type) {
  if (type === 'sports') {
    return {
      parts: [
        ['box', 1.9, 0.5, 4.6, 0, 0.5, 0, 'paint'],
        ['box', 1.5, 0.42, 1.9, 0, 0.95, -0.3, 'glass'],
        ['box', 1.8, 0.1, 0.4, 0, 0.95, -2.1, 'tyre'],
      ],
      wheels: [[-0.9, 1.5], [0.9, 1.5], [-0.9, -1.5], [0.9, -1.5]],
    };
  }
  if (type === 'van') {
    return {
      parts: [
        ['box', 2.1, 1.5, 4.6, 0, 1.05, 0, 'paint'],
        ['box', 1.9, 0.6, 1.2, 0, 1.5, 1.7, 'glass'],
      ],
      wheels: [[-0.95, 1.5], [0.95, 1.5], [-0.95, -1.5], [0.95, -1.5]],
    };
  }
  if (type === 'muscle') {
    return {
      parts: [
        ['box', 2.0, 0.6, 4.8, 0, 0.55, 0, 'paint'],
        ['box', 0.7, 0.22, 1.0, 0, 0.95, 1.2, 'tyre'],
        ['box', 0.5, 0.04, 4.82, 0, 0.87, 0, 'stripe'],
        ['box', 1.6, 0.5, 2.0, 0, 1.05, -0.4, 'glass'],
      ],
      wheels: [[-0.95, 1.6], [0.95, 1.6], [-1.0, -1.6], [1.0, -1.6]],
    };
  }
  if (type === 'truck') {
    return {
      parts: [
        ['box', 2.0, 1.3, 1.6, 0, 0.95, 1.4, 'paint'],
        ['box', 2.0, 0.7, 2.8, 0, 0.65, -0.8, 'paint'],
        ['box', 1.6, 0.7, 2.2, 0, 1.3, -0.8, 'load'],
      ],
      wheels: [[-0.95, 1.6], [0.95, 1.6], [-0.95, -1.6], [0.95, -1.6]],
    };
  }
  return {
    parts: [
      ['box', 2.0, 0.62, 4.4, 0, 0.55, 0, 'paint'],
      ['box', 1.7, 0.55, 2.2, 0, 1.1, -0.2, 'glass'],
    ],
    wheels: [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]],
  };
}

export function makeCarMesh(color, isPolice, type) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x18222e });
  const tyre = new THREE.MeshLambertMaterial({ color: 0x141518 });
  const mats = {
    paint,
    glass,
    tyre,
    stripe: new THREE.MeshLambertMaterial({ color: 0x141518 }),
    load: new THREE.MeshLambertMaterial({ color: 0x8a6a48 }),
  };
  const spec = bodySpec(type);
  for (const [, w, h, d, x, y, z, mat] of spec.parts) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats[mat]);
    m.position.set(x, y, z);
    g.add(m);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of spec.wheels) {
    const w = new THREE.Mesh(wheelGeo, tyre);
    w.position.set(wx, 0.36, wz);
    g.add(w);
    wheels.push(w);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.18, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x2244cc, emissive: 0x2244cc }),
    );
    bar.position.set(0, 1.45, -0.2);
    bar.name = 'lightbar';
    g.add(bar);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.02, 0.2, 4.42),
      new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }),
    );
    stripe.position.y = 0.62;
    g.add(stripe);
  }
  // Headlights: two small emissive boxes up front.
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xffe98a });
  for (const sx of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.08), lampMat);
    lamp.position.set(sx, 0.62, 2.22);
    g.add(lamp);
  }
  g.userData.wheels = wheels;
  return g;
}

export class Car {
  constructor(scene, x, z, heading, color, opts = {}) {
    this.scene = scene;
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.color = color;
    this.type = opts.type || 'sedan';
    this.tune = VEHICLE_TYPES[this.type] || VEHICLE_TYPES.sedan;
    this.isPolice = !!opts.police;
    this.isPlayer = false;
    this.stolen = false;
    this.parked = !!opts.parked;
    // A car bought from Rico's carries its garage id, so the garage can
    // find it again to sell it — and so a taxi fare in it pays extra.
    this.garageId = opts.garageId || null;
    this.garageOwned = !!opts.garageId;
    this.alive = true;
    this.mesh = makeCarMesh(color, this.isPolice, this.type);
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    // Traffic AI state: which street line it follows and which way.
    this.axis = opts.axis || 'x';
    this.line = opts.line ?? 0;
    this.dir = opts.dir || 1;
    this.targetSpeed = CFG.trafficSpeed;
    this.skidTimer = 0;
    // Drift state: set by drive() when the car slides through a hard turn.
    this.drifting = false;
    this.driftSteer = 0;
    // A per-car top-speed override (the police set it from the wanted level).
    this.topSpeedOverride = null;
  }

  get forward() {
    return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  get label() {
    return this.isPolice ? 'Interceptor' : this.tune.label;
  }

  // Arcade driving: throttle/steer in -1..1, dt seconds. Returns a crash
  // report when the car hits something hard, else null.
  drive(throttle, steer, dt, colliders, others) {
    const prev = this.pos.clone();
    const t = this.tune;
    if (throttle > 0) {
      this.speed += t.accel * throttle * dt;
    } else if (throttle < 0) {
      this.speed -= (this.speed > 0.5 ? t.brake : t.accel * 0.6) * dt;
    } else {
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 6 * dt);
    }
    const top = this.topSpeedOverride ?? (this.isPolice ? CFG.policeTopSpeed : t.topSpeed);
    this.speed = Math.max(-CFG.carReverseMax, Math.min(top, this.speed));
    // Drift: a hard steer at speed swings the tail out — extra yaw, a
    // sideways slide and body roll. Only the player and the police ever
    // steer hard enough to drift; traffic never does.
    this.drifting = Math.abs(steer) > 0.7 && Math.abs(this.speed) > 14;
    this.driftSteer = this.drifting ? steer : 0;
    if (Math.abs(this.speed) > 0.2) {
      let yaw = steer * t.steer * dt * Math.min(1, Math.abs(this.speed) / 8) * Math.sign(this.speed);
      if (this.drifting) yaw += steer * t.steer * dt * 0.55;
      this.heading += yaw;
    }
    const f = this.forward;
    this.pos.addScaledVector(f, this.speed * dt);
    if (this.drifting) {
      // The tail slides out sideways, opposite the turn.
      const slide = -steer * Math.abs(this.speed) * 0.1 * dt;
      this.pos.x += Math.cos(this.heading) * slide;
      this.pos.z -= Math.sin(this.heading) * slide;
    }
    if (collideCircle(this.pos, t.radius, colliders)) {
      const impact = Math.abs(this.speed);
      this.pos.copy(prev);
      this.speed *= -0.25;
      if (impact > 8) return { crashed: true, impact };
    }
    // Other cars: soft push apart.
    for (const o of others) {
      if (o === this || !o.alive) continue;
      const dx = this.pos.x - o.pos.x;
      const dz = this.pos.z - o.pos.z;
      const d = Math.hypot(dx, dz);
      const min = t.radius + o.tune.radius - 0.4;
      if (d < min && d > 0.01) {
        const push = (min - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        this.pos.x += nx * push;
        this.pos.z += nz * push;
        o.pos.x -= nx * push;
        o.pos.z -= nz * push;
        const avg = (this.speed + o.speed) / 2;
        this.speed = avg * 0.7;
        o.speed = avg * 0.7;
      }
    }
    this.syncMesh(dt);
    return null;
  }

  // Traffic: follow its street line, turn at intersections, slow for cars ahead.
  driveTraffic(dt, colliders, others) {
    const f = this.forward;
    let clear = true;
    for (const o of others) {
      if (o === this || !o.alive) continue;
      const dx = o.pos.x - this.pos.x;
      const dz = o.pos.z - this.pos.z;
      const ahead = dx * f.x + dz * f.z;
      const side = Math.abs(dx * f.z - dz * f.x);
      if (ahead > 0 && ahead < 9 && side < 2.4) {
        clear = false;
        break;
      }
    }
    const want = clear ? this.targetSpeed : 0;
    this.speed += Math.sign(want - this.speed) * Math.min(Math.abs(want - this.speed), 8 * dt);
    const prev = this.pos.clone();
    this.pos.addScaledVector(f, this.speed * dt);
    if (collideCircle(this.pos, this.tune.radius, colliders)) {
      this.pos.copy(prev);
      this.speed = 0;
      this.turnAround();
    }
    const onX = this.axis === 'x';
    const along = onX ? this.pos.x : this.pos.z;
    const across = onX ? this.pos.z : this.pos.x;
    for (const line of STREET_LINES) {
      if (Math.abs(across - line) > 0.5) continue;
      const distToNext = this.nearestLineAhead(along, this.dir);
      if (distToNext !== null && distToNext < 2 && Math.abs(this.speed) > 0.5) {
        if (Math.random() < 0.35) this.turnAt(line, distToNext);
      }
    }
    if (along > CFG.cityHalf + 4 || along < -CFG.cityHalf - 4) this.turnAround();
    this.syncMesh(dt);
  }

  nearestLineAhead(along, dir) {
    let best = null;
    for (const line of STREET_LINES) {
      const d = (line - along) * dir;
      if (d > 0 && (best === null || d < best)) best = d;
    }
    return best;
  }

  turnAt(line, distToNext) {
    const onX = this.axis === 'x';
    if (onX) {
      this.pos.z = line;
      this.pos.x += this.dir * (distToNext - 0.1);
      this.axis = 'z';
      this.dir = Math.random() < 0.5 ? 1 : -1;
      this.heading = this.dir > 0 ? 0 : Math.PI;
    } else {
      this.pos.x = line;
      this.pos.z += this.dir * (distToNext - 0.1);
      this.axis = 'x';
      this.dir = Math.random() < 0.5 ? 1 : -1;
      this.heading = this.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    this.line = line;
  }

  turnAround() {
    this.dir *= -1;
    this.heading += Math.PI;
    if (this.axis === 'x') {
      this.pos.x = Math.max(-CFG.cityHalf, Math.min(CFG.cityHalf, this.pos.x));
    } else {
      this.pos.z = Math.max(-CFG.cityHalf, Math.min(CFG.cityHalf, this.pos.z));
    }
  }

  syncMesh(dt) {
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.heading;
    // Body roll while drifting: the car leans out of the turn.
    this.mesh.rotation.z = -this.driftSteer * 0.1;
    const spin = (this.speed * dt) / 0.36;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
  }

  remove() {
    this.alive = false;
    this.scene.remove(this.mesh);
  }
}

function pickType(rng) {
  const r = rng.next();
  if (r < 0.12) return 'sports';
  if (r < 0.3) return 'van';
  if (r < 0.42) return 'truck';
  return 'sedan';
}

// Spawn the traffic fleet and the parked cars the player can steal.
export function spawnTraffic(scene, rng) {
  const cars = [];
  for (let i = 0; i < CFG.trafficCount; i += 1) {
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const line = rng.pick(STREET_LINES);
    const along = rng.range(-CFG.cityHalf, CFG.cityHalf);
    const dir = rng.chance(0.5) ? 1 : -1;
    const off = rng.chance(0.5) ? 3.2 : -3.2;
    const x = axis === 'x' ? along : line + off;
    const z = axis === 'x' ? line + off : along;
    const heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const type = pickType(rng);
    const car = new Car(scene, x, z, heading, rng.pick(CAR_COLORS), { axis, line, dir, type });
    car.targetSpeed = rng.range(8, 12);
    cars.push(car);
  }
  return cars;
}

export function spawnParked(scene, rng) {
  const cars = [];
  for (let i = 0; i < CFG.parkedCount; i += 1) {
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const line = rng.pick(STREET_LINES);
    const along = rng.range(-CFG.cityHalf + 20, CFG.cityHalf - 20);
    const side = rng.chance(0.5) ? 5.6 : -5.6;
    const x = axis === 'x' ? along : line + side;
    const z = axis === 'x' ? line + side : along;
    const heading = axis === 'x' ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
    const type = pickType(rng);
    const car = new Car(scene, x, z, heading, rng.pick(CAR_COLORS), { parked: true, axis, line, dir: 1, type });
    cars.push(car);
  }
  return cars;
}

// A guaranteed sports car at the Marina, for the Smash and Grab mission.
export function spawnMarinaSports(scene, landmarks) {
  const m = landmarks.marina;
  return new Car(scene, m.x + 6, m.z - 6, Math.PI / 2, 0xe8c33a, { parked: true, type: 'sports' });
}

// Four luxury sports cars parked in a row in front of the Meridian Casino
// — stealable, and the heist's getaway rides. The centre of the row stays
// clear for the casino entrance and its red carpet.
export function spawnCasinoSports(scene, landmarks) {
  const c = landmarks.casino;
  const spots = [
    { x: c.x - 14, color: 0xd83a5a },
    { x: c.x - 8, color: 0x2e6fc2 },
    { x: c.x + 8, color: 0xe8c33a },
    { x: c.x + 14, color: 0x7a4fc2 },
  ];
  const cars = [];
  for (const s of spots) {
    cars.push(new Car(scene, s.x, c.z + 18, 0, s.color, { parked: true, type: 'sports' }));
  }
  return cars;
}

// A car bought from Rico's garage: parked on the street outside it, owned
// by the player, and tagged with its garage id so the garage can sell it
// back and the taxi meter can pay extra for it.
export function spawnOwnedCar(scene, type, x, z, garageId) {
  return new Car(scene, x, z, Math.PI / 2, 0xe8c33a, { type, parked: true, garageId });
}
