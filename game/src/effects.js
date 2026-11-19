// Effects: a small pooled particle system for the game's feedback — tyre
// smoke when a car slides, sparks on a crash, muzzle flashes and the burst
// when an enemy goes down. v4 adds the rotor wash: dust kicked up in a ring
// on the street below the helicopter. One shared pool, no allocations in
// the hot loop.
const MAX_PARTICLES = 140;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.parts = [];
    this.geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    this.mats = {};
  }

  mat(color) {
    if (!this.mats[color]) {
      this.mats[color] = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
    }
    return this.mats[color];
  }

  spawn(pos, color, vel, life, size) {
    if (this.parts.length >= MAX_PARTICLES) {
      const old = this.parts.shift();
      this.scene.remove(old.mesh);
    }
    const mesh = new THREE.Mesh(this.geo, this.mat(color));
    mesh.position.copy(pos);
    mesh.position.y = Math.max(0.15, pos.y);
    mesh.scale.setScalar(size || 1);
    this.scene.add(mesh);
    this.parts.push({ mesh, vel: vel.clone(), life, maxLife: life });
  }

  // A spray of bits in all directions (impacts, takedowns).
  burst(pos, color, count, speed, life) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 2.2 + 0.6;
      this.spawn(
        pos,
        color,
        new THREE.Vector3(Math.sin(a) * speed, up, Math.cos(a) * speed),
        (life || 0.7) * (0.6 + Math.random() * 0.7),
        0.8 + Math.random() * 0.9,
      );
    }
  }

  // Grey tyre smoke at a wheel, drifting up and fading.
  skid(pos) {
    this.spawn(
      pos,
      0x9a9a9a,
      new THREE.Vector3((Math.random() - 0.5) * 1.2, 1.1 + Math.random(), (Math.random() - 0.5) * 1.2),
      0.9 + Math.random() * 0.4,
      1.4 + Math.random() * 0.8,
    );
  }

  // Hot sparks for a crash or a bullet hitting metal.
  sparks(pos) {
    this.burst(pos, 0xffc23a, 7, 3.2, 0.45);
    this.burst(pos, 0xffffff, 3, 2.0, 0.25);
  }

  // A shower of gold when cash changes hands — a takedown, a stopped crime,
  // an ATM robbery. The coins burst up and rain down.
  cashShower(pos) {
    this.burst(pos, 0xffc23a, 14, 3.5, 0.9);
    this.burst(pos, 0x7ddb8a, 6, 2.5, 0.7);
  }

  // Thick tyre smoke for a drift, bigger than the usual skid puff.
  driftSmoke(pos) {
    this.spawn(
      pos,
      0x8a8a8a,
      new THREE.Vector3((Math.random() - 0.5) * 1.6, 1.4 + Math.random(), (Math.random() - 0.5) * 1.6),
      1.1 + Math.random() * 0.4,
      2.0 + Math.random() * 0.8,
    );
    this.spawn(
      pos,
      0xffc23a,
      new THREE.Vector3((Math.random() - 0.5) * 2, 1.6 + Math.random(), (Math.random() - 0.5) * 2),
      0.35,
      1.0,
    );
  }

  // A brief muzzle flash at the gun.
  muzzle(pos, dir) {
    this.spawn(
      pos.clone().addScaledVector(dir, 0.8),
      0xffe98a,
      dir.clone().multiplyScalar(2),
      0.09,
      1.6,
    );
  }

  // Rotor wash: a ring of dust puffs on the street under the helicopter,
  // blown outward from the downwash. Called on a short timer, not every
  // frame, so it reads as a gust rather than a cloud.
  rotorWash(pos) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
      const r = 3.5 + Math.random() * 1.5;
      this.spawn(
        new THREE.Vector3(pos.x + Math.cos(a) * r, 0.3, pos.z + Math.sin(a) * r),
        0xb8a888,
        new THREE.Vector3(Math.cos(a) * 2.5, 0.6 + Math.random() * 0.5, Math.sin(a) * 2.5),
        0.7 + Math.random() * 0.3,
        1.2 + Math.random() * 0.6,
      );
    }
  }

  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.parts.splice(i, 1);
        continue;
      }
      p.mesh.position.addScaledVector(p.vel, dt);
      p.vel.y -= 2.4 * dt;
      p.vel.multiplyScalar(1 - 1.6 * dt);
      const k = p.life / p.maxLife;
      p.mesh.material = p.mesh.material; // shared material: fade by scale instead
      p.mesh.scale.setScalar(Math.max(0.05, k) * 1.2);
      if (p.mesh.position.y < 0.12) p.mesh.position.y = 0.12;
    }
  }

  clear() {
    for (const p of this.parts) this.scene.remove(p.mesh);
    this.parts = [];
  }
}
