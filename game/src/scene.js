// scene.js — Solmar Bay: the Three.js stage.
// Owns the renderer, the camera, the lights, the sky and every mesh the
// city is made of. Other modules ask it for car/ped/heli meshes and move
// them; the stage never decides game logic, it only shows it.
import * as THREE from 'three';
import { TUNE } from './tuning.js';

const DAY_SKY = new THREE.Color(0x7ec8e8);
const GOLD_SKY = new THREE.Color(0xe8956a);
const NIGHT_SKY = new THREE.Color(0x0a1226);
const DAY_SUN = new THREE.Color(0xfff2d8);
const GOLD_SUN = new THREE.Color(0xff9a4a);

export class Stage3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7ec8e8);
    this.scene.fog = new THREE.Fog(0x7ec8e8, 120, 700);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.set(0, 40, 60);
    this.sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
    this.sun.position.set(100, 160, 60);
    this.scene.add(this.sun);
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3a3a2a, 0.9);
    this.scene.add(this.hemi);
    this.moon = new THREE.DirectionalLight(0x8fa8ff, 0.0);
    this.moon.position.set(-80, 120, -40);
    this.scene.add(this.moon);
    this.buildingMats = [];
    this.nightFactor = 0;
    this.shake = 0;
    this.camPos = new THREE.Vector3(0, 40, 60);
    this.camLook = new THREE.Vector3(0, 0, 0);
    addEventListener('resize', () => this.resize());
  }
  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  // --- city meshes -------------------------------------------------------
  buildCity(layout) {
    const S = this.scene;
    const half = layout.half;
    // Water around the island city, so the bay reads from the edges.
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(2400, 2400),
      new THREE.MeshLambertMaterial({ color: 0x1a5a7a }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.4;
    S.add(water);
    // Ground.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(layout.size + 40, layout.size + 40),
      new THREE.MeshLambertMaterial({ color: 0x3d4a3a }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    S.add(ground);
    // Roads: dark strips with a pale centre line.
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8c95a });
    for (const c of layout.roadAt) {
      const h = new THREE.Mesh(new THREE.PlaneGeometry(layout.size, TUNE.city.roadWidth), roadMat);
      h.rotation.x = -Math.PI / 2;
      h.position.set(0, 0.03, c);
      S.add(h);
      const v = new THREE.Mesh(new THREE.PlaneGeometry(TUNE.city.roadWidth, layout.size), roadMat);
      v.rotation.x = -Math.PI / 2;
      v.position.set(c, 0.03, 0);
      S.add(v);
      const hl = new THREE.Mesh(new THREE.PlaneGeometry(layout.size, 0.5), lineMat);
      hl.rotation.x = -Math.PI / 2;
      hl.position.set(0, 0.05, c);
      S.add(hl);
      const vl = new THREE.Mesh(new THREE.PlaneGeometry(0.5, layout.size), lineMat);
      vl.rotation.x = -Math.PI / 2;
      vl.position.set(c, 0.05, 0);
      S.add(vl);
    }
    // Parks.
    const parkMat = new THREE.MeshLambertMaterial({ color: 0x2e6b34 });
    for (const p of layout.parks) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.d), parkMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(p.x, 0.04, p.z);
      S.add(m);
    }
    // Buildings.
    for (const b of layout.buildings) {
      const mat = new THREE.MeshLambertMaterial({ color: b.color, emissive: 0xffc860, emissiveIntensity: 0 });
      this.buildingMats.push(mat);
      const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mat);
      m.position.set(b.x, b.h / 2, b.z);
      S.add(m);
      // A flat roof cap, slightly lighter.
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(b.w + 0.4, 0.6, b.d + 0.4),
        new THREE.MeshLambertMaterial({ color: 0x222222 }),
      );
      cap.position.set(b.x, b.h + 0.3, b.z);
      S.add(cap);
    }
    // Landmarks.
    for (const l of layout.landmarks) {
      this.buildLandmark(l);
    }
    // ATMs: dark kiosks with a glowing screen.
    const atmMat = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x39d0c0 });
    for (const a of layout.atms) {
      const kiosk = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.6, 1.2), atmMat);
      kiosk.position.set(a.x, 1.3, a.z);
      S.add(kiosk);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), screenMat);
      screen.position.set(a.x, 1.7, a.z + 0.65);
      S.add(screen);
    }
    // Garage forecourt + safehouse marker are placed by their modules;
    // the stage only marks the ground here.
    const mark = (x, z, color) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(16, 16),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.06, z);
      S.add(m);
    };
    mark(layout.places.garage.x, layout.places.garage.z, 0x39d0c0);
    mark(layout.places.safehouse.x, layout.places.safehouse.z, 0x7ad03a);
  }
  buildLandmark(l) {
    const S = this.scene;
    if (l.kind === 'lighthouse') {
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(4, 6, 42, 12),
        new THREE.MeshLambertMaterial({ color: 0xf2ead8 }),
      );
      base.position.set(l.x, 21, l.z);
      S.add(base);
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(4.2, 4.2, 6, 12),
        new THREE.MeshLambertMaterial({ color: 0xd83a3a }),
      );
      band.position.set(l.x, 30, l.z);
      S.add(band);
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(2.2, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xffe9a0 }),
      );
      lamp.position.set(l.x, 43, l.z);
      S.add(lamp);
    } else if (l.kind === 'tower') {
      const mat = new THREE.MeshLambertMaterial({ color: 0x2a3a4a, emissive: 0xffc860, emissiveIntensity: 0 });
      this.buildingMats.push(mat);
      const m = new THREE.Mesh(new THREE.BoxGeometry(26, 120, 26), mat);
      m.position.set(l.x, 60, l.z);
      S.add(m);
      const tip = new THREE.Mesh(
        new THREE.BoxGeometry(6, 10, 6),
        new THREE.MeshBasicMaterial({ color: 0xff5a3a }),
      );
      tip.position.set(l.x, 125, l.z);
      S.add(tip);
    } else if (l.kind === 'pier') {
      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(10, 1.2, 90),
        new THREE.MeshLambertMaterial({ color: 0x8a6a4a }),
      );
      deck.position.set(l.x, 1.2, l.z);
      S.add(deck);
      for (let i = 0; i < 5; i++) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.5, 0.5, 3, 6),
          new THREE.MeshLambertMaterial({ color: 0x5a4a3a }),
        );
        post.position.set(l.x - 4, 0.5, l.z - 36 + i * 18);
        S.add(post);
        const post2 = post.clone();
        post2.position.x = l.x + 4;
        S.add(post2);
      }
    } else if (l.kind === 'observatory') {
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(9, 11, 12, 12),
        new THREE.MeshLambertMaterial({ color: 0xe8e2d0 }),
      );
      base.position.set(l.x, 6, l.z);
      S.add(base);
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(8, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshLambertMaterial({ color: 0xd8d2c0 }),
      );
      dome.position.set(l.x, 12, l.z);
      S.add(dome);
    }
  }
  // --- vehicle / character meshes ----------------------------------------
  makeCar(color, kind = 'sedan') {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.4), bodyMat);
    body.position.y = 0.65;
    g.add(body);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.65, 2.2),
      new THREE.MeshLambertMaterial({ color: 0x1a2530 }),
    );
    cabin.position.set(0, 1.3, -0.2);
    g.add(cabin);
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const wheels = [];
    for (const [wx, wz] of [[-1.05, 1.45], [1.05, 1.45], [-1.05, -1.45], [1.05, -1.45]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.42, wz);
      g.add(w);
      wheels.push(w);
    }
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    for (const hx of [-0.7, 0.7]) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), headMat);
      h.position.set(hx, 0.7, 2.22);
      g.add(h);
    }
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    for (const hx of [-0.7, 0.7]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), tailMat);
      t.position.set(hx, 0.7, -2.22);
      g.add(t);
    }
    if (kind === 'truck') {
      const bed = new THREE.Mesh(
        new THREE.BoxGeometry(2.0, 1.1, 2.4),
        new THREE.MeshLambertMaterial({ color: 0x4a5a6a }),
      );
      bed.position.set(0, 1.4, -1.0);
      g.add(bed);
    }
    g.userData.wheels = wheels;
    g.userData.bodyMat = bodyMat;
    this.scene.add(g);
    return g;
  }
  makeCopCar() {
    const g = this.makeCar(0x1a2a3a, 'sedan');
    const barMat = new THREE.MeshBasicMaterial({ color: 0x2a5aff });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 0.5), barMat);
    bar.position.set(0, 1.75, -0.2);
    g.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    bar2.position.set(0, 1.75, -0.2);
    bar2.visible = false;
    g.add(bar2);
    g.userData.lightBarA = bar;
    g.userData.lightBarB = bar2;
    return g;
  }
  makePed(color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.5, 1.1, 8),
      new THREE.MeshLambertMaterial({ color }),
    );
    body.position.y = 0.95;
    g.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xd8a880 }),
    );
    head.position.y = 1.75;
    g.add(head);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
    const legs = [];
    for (const lx of [-0.2, 0.2]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), legMat);
      leg.position.set(lx, 0.35, 0);
      g.add(leg);
      legs.push(leg);
    }
    g.userData.legs = legs;
    this.scene.add(g);
    return g;
  }
  makeHeli() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 1.8, 5.2),
      new THREE.MeshLambertMaterial({ color: 0x1a2a3a }),
    );
    body.position.y = 0;
    g.add(body);
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.9, 1.4),
      new THREE.MeshLambertMaterial({ color: 0x2a4a6a }),
    );
    glass.position.set(0, 0.3, 2.2);
    g.add(glass);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.7, 4.6),
      new THREE.MeshLambertMaterial({ color: 0x1a2a3a }),
    );
    tail.position.set(0, 0.2, -4.4);
    g.add(tail);
    const rotor = new THREE.Mesh(
      new THREE.BoxGeometry(11, 0.12, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x111111 }),
    );
    rotor.position.y = 1.15;
    g.add(rotor);
    const skidMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    for (const sx of [-1.1, 1.1]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 3.4), skidMat);
      skid.position.set(sx, -1.05, 0.4);
      g.add(skid);
    }
    // Spotlight: a real SpotLight plus a visible cone so the beam reads.
    const spot = new THREE.SpotLight(0xfff2b0, 0, 120, 0.32, 0.45, 1.2);
    const spotTarget = new THREE.Object3D();
    this.scene.add(spotTarget);
    spot.target = spotTarget;
    g.add(spot);
    spot.position.set(0, -0.8, 0);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(9, 55, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }),
    );
    cone.rotation.x = Math.PI; // apex up, base down
    cone.position.y = -27.5;
    cone.visible = false;
    g.add(cone);
    g.userData.rotor = rotor;
    g.userData.spot = spot;
    g.userData.spotTarget = spotTarget;
    g.userData.cone = cone;
    this.scene.add(g);
    return g;
  }
  // --- time of day -------------------------------------------------------
  setTimeOfDay(hour) {
    // hour 0..24; sun peaks at noon, sets ~18:30, rises ~5:30.
    const sunAngle = ((hour - 6) / 12) * Math.PI;
    const elev = Math.sin(sunAngle);
    const dayF = Math.max(0, Math.min(1, elev * 2.2));
    const goldF = Math.max(0, 1 - Math.abs(elev) * 3.2) * (elev > -0.08 ? 1 : 0);
    this.nightFactor = 1 - dayF;
    const sky = new THREE.Color().copy(NIGHT_SKY).lerp(DAY_SKY, dayF).lerp(GOLD_SKY, goldF * 0.55);
    this.scene.background = sky;
    this.scene.fog.color.copy(sky);
    const sunColor = new THREE.Color().copy(DAY_SUN).lerp(GOLD_SUN, goldF);
    this.sun.color.copy(sunColor);
    this.sun.intensity = 0.15 + dayF * 2.1;
    this.sun.position.set(Math.cos(sunAngle) * 180, Math.max(12, elev * 190), 70);
    this.moon.intensity = this.nightFactor * 0.55;
    this.hemi.intensity = 0.25 + dayF * 0.65;
    for (const m of this.buildingMats) m.emissiveIntensity = this.nightFactor * 0.55;
    return this.nightFactor;
  }
  // --- camera ------------------------------------------------------------
  follow(px, pz, heading, dt, inCar, speed01) {
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const dist = inCar ? 13 : 10;
    const height = inCar ? 5.2 : 4.4;
    const tx = px - fx * dist;
    const tz = pz - fz * dist;
    const k = 1 - Math.exp(-dt * 5);
    this.camPos.x += (tx - this.camPos.x) * k;
    this.camPos.z += (tz - this.camPos.z) * k;
    this.camPos.y += (height - this.camPos.y) * k;
    const lx = px + fx * 8;
    const lz = pz + fz * 8;
    this.camLook.x += (lx - this.camLook.x) * k;
    this.camLook.z += (lz - this.camLook.z) * k;
    this.camLook.y += (1.6 - this.camLook.y) * k;
    let sx = 0;
    let sy = 0;
    if (this.shake > 0.01) {
      sx = (Math.random() - 0.5) * this.shake;
      sy = (Math.random() - 0.5) * this.shake;
      this.shake *= Math.exp(-dt * 6);
    }
    this.camera.position.set(this.camPos.x + sx, this.camPos.y + sy, this.camPos.z);
    this.camera.lookAt(this.camLook.x, this.camLook.y, this.camLook.z);
  }
  setCamera(px, py, pz, lx, ly, lz) {
    this.camera.position.set(px, py, pz);
    this.camera.lookAt(lx, ly, lz);
    this.camPos.set(px, py, pz);
    this.camLook.set(lx, ly, lz);
  }
  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
