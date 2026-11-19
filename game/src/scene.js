// scene.js — the three.js renderer: chase camera, day/night sun + sky,
// the road grid, buildings, cars, peds, the player and the helicopter.
// The simulation stays 2D (x/z); this file only draws it.
import * as THREE from 'three';
import { T } from './tuning.js';

export class Scene {
  constructor(world) {
    this.world = world;
    const canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
    this.renderer.setSize(1280, 800, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 220, 700);
    this.camera = new THREE.PerspectiveCamera(62, 1280 / 800, 0.5, 1200);
    // Lights: sun + sky fill.
    this.sun = new THREE.DirectionalLight(0xfff2d9, 2.2);
    this.sun.position.set(120, 180, 60);
    this.scene.add(this.sun);
    this.hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a5f3a, 0.9);
    this.scene.add(this.hemi);
    this._buildStatic();
    this._carMeshes = new Map();
    this._pedMeshes = new Map();
    this._enemyMeshes = new Map();
    this._playerMesh = this._makePlayer();
    this.scene.add(this._playerMesh);
    this._heliGroup = this._makeHeli();
    this.scene.add(this._heliGroup);
    this._effectMeshes = [];
  }
  _mat(color) { return new THREE.MeshLambertMaterial({ color }); }
  _buildStatic() {
    const S = this.scene;
    const half = T.worldHalf;
    // Ground.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(half * 2 + 80, half * 2 + 80),
      this._mat(0x4a7c3a),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.1, 0);
    S.add(ground);
    // Water (north strip, past the pier).
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(half * 2 + 80, 60),
      new THREE.MeshLambertMaterial({ color: 0x1e6f8e }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0, half + 28);
    S.add(water);
    // Roads: dark strips on the grid.
    const roadMat = this._mat(0x2e3440);
    for (let g = -half; g <= half; g += T.roadStep) {
      const v = new THREE.Mesh(new THREE.PlaneGeometry(T.roadHalfWidth * 2, half * 2), roadMat);
      v.rotation.x = -Math.PI / 2;
      v.position.set(g, 0, 0);
      S.add(v);
      const h = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, T.roadHalfWidth * 2), roadMat);
      h.rotation.x = -Math.PI / 2;
      h.position.set(0, 0.01, g);
      S.add(h);
    }
    // Road center dashes.
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5d76e });
    for (let g = -half; g <= half; g += T.roadStep) {
      for (let d = -half + 13; d < half; d += 26) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 3), dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(g, 0.02, d);
        S.add(dash);
      }
    }
    // Buildings.
    for (const b of this.world.city.buildings) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), this._mat(b.color));
      box.position.set(b.x, b.h / 2, b.z);
      S.add(box);
      if (b.lit) {
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(b.w + 0.6, 0.8, b.d + 0.6),
          new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
        );
        roof.position.set(b.x, b.h + 0.4, b.z);
        S.add(roof);
      }
    }
    // Palms.
    const trunkMat = this._mat(0x8a5a2b);
    const leafMat = this._mat(0x2f9e44);
    for (const p of this.world.city.palms) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 7, 6), trunkMat);
      trunk.position.set(p.x, 3.5, p.z);
      S.add(trunk);
      const leaves = new THREE.Mesh(new THREE.SphereGeometry(2.6, 6, 4), leafMat);
      leaves.position.set(p.x, 7.6, p.z);
      leaves.scale.y = 0.55;
      S.add(leaves);
    }
    // Landmark markers: pier deck, casino sign, clock tower, safehouse.
    const pier = new THREE.Mesh(new THREE.BoxGeometry(24, 1, 10), this._mat(0x9c6644));
    pier.position.set(-60, 0.5, 302);
    S.add(pier);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(8, 46, 8), this._mat(0xe8dcc8));
    tower.position.set(-130, 23, 26);
    S.add(tower);
    const casino = new THREE.Mesh(new THREE.BoxGeometry(26, 14, 18), this._mat(0x7b2fbe));
    casino.position.set(78, 7, -10);
    S.add(casino);
    const house = new THREE.Mesh(new THREE.BoxGeometry(16, 9, 12), this._mat(0xffd166));
    house.position.set(26, 4.5, 182);
    S.add(house);
  }
  _makeCarMesh(car) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.85, 4.4), this._mat(car.color));
    body.position.y = 0.65;
    g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 2.2), this._mat(0x1c2733));
    cabin.position.set(0, 1.35, -0.2);
    g.add(cabin);
    const wheelMat = this._mat(0x111111);
    for (const [wx, wz] of [[-1, 1.5], [1, 1.5], [-1, -1.5], [1, -1.5]]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.35, 8), wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.42, wz);
      g.add(wheel);
    }
    if (car.isPolice) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      bar.position.set(0, 1.85, -0.2);
      g.add(bar);
    }
    return g;
  }
  _makePlayer() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 1.5, 8), this._mat(0x2f9e44));
    body.position.y = 1.1;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 8, 6), this._mat(0xe8b98a));
    head.position.y = 2.15;
    g.add(head);
    return g;
  }
  _makeHeli() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 5.2), this._mat(0x223344));
    body.position.y = 0;
    g.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 3.4), this._mat(0x223344));
    tail.position.set(0, 0.3, -4);
    g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.5), this._mat(0x111111));
    rotor.position.y = 1.1;
    g.add(rotor);
    this._rotor = rotor;
    const lamp = new THREE.Mesh(
      new THREE.ConeGeometry(3.2, 14, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff6b0, transparent: true, opacity: 0.28, side: THREE.DoubleSide }),
    );
    lamp.position.y = -7;
    lamp.rotation.x = Math.PI;
    g.add(lamp);
    this._spotCone = lamp;
    const light = new THREE.PointLight(0xfff2a8, 60, 60);
    light.position.y = -2;
    g.add(light);
    this._spotLight = light;
    return g;
  }
  _syncCar(car) {
    let m = this._carMeshes.get(car.id);
    if (!m) { m = this._makeCarMesh(car); this._carMeshes.set(car.id, m); this.scene.add(m); }
    m.position.set(car.pos.x, 0, car.pos.z);
    m.rotation.y = car.heading;
    m.visible = car.alive;
    return m;
  }
  _syncPed(p, i) {
    let m = this._pedMeshes.get(i);
    if (!m) {
      m = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 1.3, 6), this._mat(p.color));
      body.position.y = 0.95;
      m.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 5), this._mat(0xe8b98a));
      head.position.y = 1.85;
      m.add(head);
      this._pedMeshes.set(i, m);
      this.scene.add(m);
    }
    m.position.set(p.x, 0, p.z);
    m.rotation.y = p.heading;
  }
  render(dt) {
    const w = this.world;
    const p = w.player;
    const focus = p.inCar ? p.inCar.pos : p.pos;
    const heading = p.inCar ? p.inCar.heading : p.heading;
    // Chase camera.
    const camDist = 15, camH = 8.5;
    const bx = focus.x - Math.sin(heading) * camDist;
    const bz = focus.z - Math.cos(heading) * camDist;
    this.camera.position.set(bx, camH, bz);
    this.camera.lookAt(focus.x + Math.sin(heading) * 6, 1.5, focus.z + Math.cos(heading) * 6);
    // Day/night lighting.
    const night = w.city.nightness();
    const day = 1 - night;
    this.sun.intensity = 0.35 + day * 1.9;
    this.hemi.intensity = 0.35 + day * 0.55;
    const skyDay = new THREE.Color(0x87ceeb);
    const skyNight = new THREE.Color(0x0b1026);
    this.scene.background.lerpColors(skyNight, skyDay, day);
    this.scene.fog.color.copy(this.scene.background);
    // Sun position follows the day fraction.
    const ang = w.city.dayFrac() * Math.PI * 2;
    this.sun.position.set(Math.cos(ang) * 160, Math.max(20, Math.sin(ang) * 160), 60);
    // Player.
    this._playerMesh.position.set(p.pos.x, 0, p.pos.z);
    this._playerMesh.rotation.y = p.heading;
    this._playerMesh.visible = !p.inCar;
    // Cars (traffic + player + police + crime).
    for (const car of w.allCars) this._syncCar(car);
    // Peds.
    w.traffic.peds.forEach((ped, i) => this._syncPed(ped, i));
    // Enemies.
    for (const e of w.combat.enemies) {
      let m = this._enemyMeshes.get(e.id);
      if (!m) {
        m = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.5, 6), this._mat(0xb03030));
        body.position.y = 1.05;
        m.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 6, 5), this._mat(0xe8b98a));
        head.position.y = 2.05;
        m.add(head);
        this._enemyMeshes.set(e.id, m);
        this.scene.add(m);
      }
      m.position.set(e.pos.x, 0, e.pos.z);
      m.rotation.y = e.heading;
      m.visible = e.hp > 0;
    }
    // Helicopter.
    const heli = w.heli;
    this._heliGroup.visible = heli.active;
    if (heli.active) {
      this._heliGroup.position.set(heli.pos.x, heli.pos.y, heli.pos.z);
      this._heliGroup.rotation.y = heli.heading;
      this._rotor.rotation.y += dt * 30;
      this._spotCone.visible = heli.lit;
      this._spotLight.visible = heli.lit;
    }
    // Effects: muzzle flashes as small bright sprites.
    for (const m of this._effectMeshes) this.scene.remove(m);
    this._effectMeshes = [];
    for (const fx of w.effects.snapshot()) {
      const s = fx.kind === 'explosion' ? 6 : 1.6;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(s * fx.a, 6, 4),
        new THREE.MeshBasicMaterial({ color: fx.kind === 'explosion' ? 0xff7722 : 0xfff2a8, transparent: true, opacity: fx.a }),
      );
      mesh.position.set(fx.x, 1.2, fx.z);
      this.scene.add(mesh);
      this._effectMeshes.push(mesh);
    }
    this.renderer.render(this.scene, this.camera);
  }
}
