// scene.js — The three.js renderer for Solmar Bay.
// Builds the whole visible city from City data: instanced buildings,
// canvas-textured ground, water, palms, lamps, landmarks with real
// signage, day/night sky and the follow camera. No shadows (headless
// speed), two lights, cheap materials.
import * as THREE from 'three';
import { TUNE, districtAt, clamp, lerp } from './tuning.js';

function makeLabelTexture(text, opts = {}) {
  const { font = 'bold 64px system-ui, sans-serif', fg = '#ffd34d', bg = '#14100c', w = 512, h = 128 } = opts;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = fg;
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Scene3D {
  constructor(city) {
    this.city = city;
    const canvas = document.querySelector('#game');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87b5d6);
    this.scene.fog = new THREE.Fog(0x87b5d6, 120, 620);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
    this.camera.position.set(0, 12, -18);
    this.sun = new THREE.DirectionalLight(0xffe0b3, 1.6);
    this.sun.position.set(120, 180, 60);
    this.scene.add(this.sun);
    this.hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a2f28, 0.9);
    this.scene.add(this.hemi);
    this._buildGround();
    this._buildWater();
    this._buildBuildings();
    this._buildPalms();
    this._buildLamps();
    this._buildContainers();
    this._buildLandmarks();
    this._buildSky();
    this.dynamic = new THREE.Group();
    this.scene.add(this.dynamic);
    window.addEventListener('resize', () => this._onResize());
  }
  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  _buildGround() {
    const S = 1024;
    const scale = S / (TUNE.cityHalf * 2);
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const g = c.getContext('2d');
    const X = (x) => (x + TUNE.cityHalf) * scale;
    const Z = (z) => (z + TUNE.cityHalf) * scale;
    // Base sidewalk concrete.
    g.fillStyle = '#8f8a80';
    g.fillRect(0, 0, S, S);
    // District block fills.
    for (let bx = -5; bx <= 5; bx++) {
      for (let bz = -5; bz <= 5; bz++) {
        const cx = bx * TUNE.roadSpacing + TUNE.roadSpacing / 2;
        const cz = bz * TUNE.roadSpacing + TUNE.roadSpacing / 2;
        const d = districtAt(cx, cz);
        g.fillStyle = '#' + d.tint.toString(16).padStart(6, '0');
        g.globalAlpha = 0.55;
        g.fillRect(X(cx - 20), Z(cz - 20), 40 * scale, 40 * scale);
        g.globalAlpha = 1;
      }
    }
    // Marina basin.
    g.fillStyle = '#2a7d8c';
    g.fillRect(X(-40), Z(200), 180 * scale, 96 * scale);
    // Beach sand strip along the south edge.
    g.fillStyle = '#d9c48f';
    g.fillRect(0, Z(272), S, (TUNE.cityHalf - 272) * scale);
    // Roads: dark asphalt with center dashes.
    g.fillStyle = '#2e2e33';
    for (const r of this.city.roads) {
      if (r.axis === 'x') g.fillRect(0, Z(r.at - TUNE.roadWidth / 2), S, TUNE.roadWidth * scale);
      else g.fillRect(X(r.at - TUNE.roadWidth / 2), 0, TUNE.roadWidth * scale, S);
    }
    g.strokeStyle = '#d8c95a';
    g.lineWidth = 1.5;
    g.setLineDash([10, 12]);
    for (const r of this.city.roads) {
      g.beginPath();
      if (r.axis === 'x') { g.moveTo(0, Z(r.at)); g.lineTo(S, Z(r.at)); }
      else { g.moveTo(X(r.at), 0); g.lineTo(X(r.at), S); }
      g.stroke();
    }
    g.setLineDash([]);
    // Crosswalks at every intersection.
    g.fillStyle = 'rgba(240,240,230,0.85)';
    for (let i = -6; i <= 6; i++) {
      for (let j = -6; j <= 6; j++) {
        const x = i * TUNE.roadSpacing;
        const z = j * TUNE.roadSpacing;
        for (let k = -2; k <= 2; k++) {
          g.fillRect(X(x + k * 3 - 1), Z(z - 8), 2 * scale, 3 * scale);
        }
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(TUNE.cityHalf * 2, TUNE.cityHalf * 2),
      new THREE.MeshLambertMaterial({ map: tex }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 0);
    this.scene.add(ground);
  }
  _buildWater() {
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 160),
      new THREE.MeshLambertMaterial({ color: 0x1f6f8b, transparent: true, opacity: 0.92 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.4, TUNE.cityHalf + 72);
    this.scene.add(water);
    this.water = water;
  }
  _buildBuildings() {
    const list = this.city.buildings;
    // Facade texture: a light face with a window grid. The instance
    // color tints it per building, so the skyline reads as windows
    // instead of flat slabs.
    const facade = document.createElement('canvas');
    facade.width = 64;
    facade.height = 256;
    const g = facade.getContext('2d');
    g.fillStyle = '#e8e4da';
    g.fillRect(0, 0, 64, 256);
    g.fillStyle = '#2a3242';
    for (let r = 0; r < 12; r++) {
      for (let c = 0; c < 4; c++) {
        g.fillRect(6 + c * 14, 8 + r * 20, 9, 12);
      }
    }
    const facadeTex = new THREE.CanvasTexture(facade);
    facadeTex.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: facadeTex });
    const inst = new THREE.InstancedMesh(geo, mat, list.length);
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    list.forEach((b, i) => {
      m.makeScale(b.w, b.h, b.d);
      m.setPosition(b.x, b.h / 2, b.z);
      inst.setMatrixAt(i, m);
      col.setHex(b.color);
      inst.setColorAt(i, col);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    this.scene.add(inst);
    // Rooftop rims: a thin lighter box per tall building would cost a
    // draw call each, so skip — the ground texture carries the detail.
  }
  _buildPalms() {
    const list = this.city.palms;
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.3, 1, 5);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, list.length);
    const leafGeo = new THREE.ConeGeometry(1.9, 2.6, 6);
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8f4e });
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, list.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    list.forEach((pl, i) => {
      e.set(pl.lean, 0, pl.lean * 0.6);
      q.setFromEuler(e);
      s.set(1, pl.h, 1);
      p.set(pl.x, pl.h / 2, pl.z);
      m.compose(p, q, s);
      trunks.setMatrixAt(i, m);
      s.set(1, 1, 1);
      p.set(pl.x, pl.h + 0.9, pl.z);
      m.compose(p, q, s);
      leaves.setMatrixAt(i, m);
    });
    trunks.instanceMatrix.needsUpdate = true;
    leaves.instanceMatrix.needsUpdate = true;
    this.scene.add(trunks);
    this.scene.add(leaves);
  }
  _buildLamps() {
    const list = this.city.lamps;
    const geo = new THREE.CylinderGeometry(0.08, 0.12, 5, 5);
    const mat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
    const inst = new THREE.InstancedMesh(geo, mat, list.length);
    const m = new THREE.Matrix4();
    list.forEach((l, i) => {
      m.makeTranslation(l.x, 2.5, l.z);
      inst.setMatrixAt(i, m);
    });
    inst.instanceMatrix.needsUpdate = true;
    this.scene.add(inst);
    // Lamp heads glow at night — one shared emissive material, toggled
    // by updating its color in the day/night pass.
    this.lampGlowMat = new THREE.MeshBasicMaterial({ color: 0x332200 });
    const headGeo = new THREE.SphereGeometry(0.35, 6, 5);
    const heads = new THREE.InstancedMesh(headGeo, this.lampGlowMat, list.length);
    list.forEach((l, i) => {
      m.makeTranslation(l.x, 5, l.z);
      heads.setMatrixAt(i, m);
    });
    heads.instanceMatrix.needsUpdate = true;
    this.scene.add(heads);
  }
  _buildContainers() {
    const list = this.city.containers;
    const geo = new THREE.BoxGeometry(12, 2.6, 5);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const inst = new THREE.InstancedMesh(geo, mat, list.length);
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    list.forEach((c, i) => {
      m.makeRotationY(c.rot);
      m.setPosition(c.x, 1.3, c.z);
      inst.setMatrixAt(i, m);
      col.setHex(c.color);
      inst.setColorAt(i, col);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    this.scene.add(inst);
  }
  _box(w, h, d, color, x, y, z, parent = this.scene) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color }),
    );
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  _cyl(rt, rb, h, color, x, y, z, seg = 10, parent = this.scene) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(rt, rb, h, seg),
      new THREE.MeshLambertMaterial({ color }),
    );
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  _sign(text, w, h, x, y, z, rotY = 0, fg = '#ffd34d', bg = '#14100c') {
    const tex = makeLabelTexture(text, { fg, bg, w: 512, h: Math.round(512 * h / w) });
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex }),
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    this.scene.add(mesh);
    return mesh;
  }
  _buildLandmarks() {
    const L = TUNE.landmarks;
    // Pier: boardwalk into the bay, posts, hut, string lights.
    const pier = new THREE.Group();
    this._box(14, 0.5, 26, 0x8a6b45, L.pier.x, 0.2, L.pier.z + 12, pier);
    for (let i = 0; i < 5; i++) {
      this._cyl(0.25, 0.25, 3, 0x5d4630, L.pier.x - 6 + (i % 2) * 12, 0.5, L.pier.z + 4 + i * 5, 6, pier);
    }
    this._box(10, 4, 8, 0x6b4f2e, L.pier.x, 2, L.pier.z - 6, pier);
    this._box(11, 0.6, 9, 0x3a2a1a, L.pier.x, 4.3, L.pier.z - 6, pier);
    this.scene.add(pier);
    this._sign('SOLMAR PIER', 16, 2, L.pier.x, 7, L.pier.z - 2, 0);
    // Marina: floating docks + boats.
    for (const b of this.city.boats) {
      const boat = new THREE.Group();
      this._box(2.4, 1.2, b.len, b.color, 0, 0.4, 0, boat);
      this._cyl(0.08, 0.08, 5, 0x8a7a5a, 0, 3, 0, 5, boat);
      this._box(0.1, 3, 2.4, 0xffffff, 0, 3, 0.6, boat);
      boat.position.set(b.x, 0, b.z);
      boat.rotation.y = 0.3;
      this.scene.add(boat);
    }
    this._box(20, 0.4, 4, 0x9a7b52, 40, 0.2, 216);
    this._sign('MARINA', 14, 1.8, 40, 6, 214, 0, '#7fd4e8', '#0d2a33');
    // Garage: low block, big door, forecourt, sign.
    this._box(26, 7, 14, 0x9a8a7a, L.garage.x, 3.5, L.garage.z - 12);
    this._box(16, 5, 0.4, 0x2a2a2e, L.garage.x, 2.5, L.garage.z - 4.8);
    this._sign('RICO\u2019S GARAGE', 22, 2.6, L.garage.x, 8.6, L.garage.z - 4.6, 0);
    // Warehouse: big shed + sawtooth roof blocks.
    this._box(30, 10, 18, 0x7a6a58, L.warehouse.x, 5, L.warehouse.z - 14);
    this._box(30, 2, 6, 0x5d4f42, L.warehouse.x, 11, L.warehouse.z - 18);
    this._box(30, 2, 6, 0x5d4f42, L.warehouse.x, 11, L.warehouse.z - 10);
    // Bar: small corner building + neon sign.
    this._box(14, 6, 10, 0x6b3a2e, L.bar.x, 3, L.bar.z - 8);
    this._sign('THE RUSTY ANCHOR', 16, 2, L.bar.x, 7.4, L.bar.z - 2.6, 0, '#ff7a6b', '#1a0d0d');
    // Bank: tall block, columns, steps.
    this._box(22, 26, 16, 0xb8b0a0, L.bank.x, 13, L.bank.z - 10);
    for (let i = -1; i <= 1; i++) {
      this._cyl(0.8, 0.9, 12, 0xd8d0c0, L.bank.x + i * 7, 6, L.bank.z - 1.5, 8);
    }
    this._box(24, 1, 8, 0x8a8078, L.bank.x, 0.5, L.bank.z + 1);
    this._sign('BAY NATIONAL BANK', 20, 2, L.bank.x, 27.5, L.bank.z - 1.6, 0, '#e8e0c8', '#2a2a33');
    // Safehouse: small house, pitched roof, porch light.
    this._box(12, 5, 10, 0xa89a80, L.safehouse.x, 2.5, L.safehouse.z - 8);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(9, 3.5, 4), new THREE.MeshLambertMaterial({ color: 0x8a3a2e }));
    roof.position.set(L.safehouse.x, 6.7, L.safehouse.z - 8);
    roof.rotation.y = Math.PI / 4;
    this.scene.add(roof);
    this._box(3, 4, 0.3, 0x4a3226, L.safehouse.x, 2, L.safehouse.z - 2.8);
    // Casino: wide block, neon, fountain.
    this._box(30, 16, 18, 0x4a2a5a, L.casino.x, 8, L.casino.z - 12);
    this._box(32, 1.5, 20, 0x6b3a7a, L.casino.x, 16.7, L.casino.z - 12);
    this._sign('CASINO ROYALE BAY', 26, 3, L.casino.x, 19.5, L.casino.z - 2.6, 0, '#ff4dd2', '#1a0d1a');
    this._cyl(3, 3.5, 1, 0x8a8a92, L.casino.x, 0.5, L.casino.z + 8, 12);
    this._cyl(2.2, 2.2, 0.4, 0x2a7d8c, L.casino.x, 1.1, L.casino.z + 8, 12);
    // Clock tower: tall shaft, clock face, spire.
    this._box(10, 42, 10, 0xb0a890, L.clockTower.x, 21, L.clockTower.z - 6);
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(3.4, 24),
      new THREE.MeshBasicMaterial({ color: 0xf5efdc }),
    );
    face.position.set(L.clockTower.x, 36, L.clockTower.z - 0.9);
    this.scene.add(face);
    const hand = this._box(0.3, 2.6, 0.1, 0x222222, L.clockTower.x, 36.6, L.clockTower.z - 0.8);
    hand.rotation.z = -0.6;
    const hand2 = this._box(0.3, 2, 0.1, 0x222222, L.clockTower.x + 0.6, 36, L.clockTower.z - 0.8);
    hand2.rotation.z = -1.8;
    const spire = new THREE.Mesh(new THREE.ConeGeometry(5.5, 8, 4), new THREE.MeshLambertMaterial({ color: 0x3a5a3a }));
    spire.position.set(L.clockTower.x, 46, L.clockTower.z - 6);
    spire.rotation.y = Math.PI / 4;
    this.scene.add(spire);
    // Docks: gantry cranes.
    for (const cr of this.city.cranes) {
      this._box(2, 22, 2, 0xd4ac0d, cr.x - 8, 11, cr.z);
      this._box(2, 22, 2, 0xd4ac0d, cr.x + 8, 11, cr.z);
      this._box(20, 2, 2, 0xd4ac0d, cr.x, 22, cr.z);
      this._box(6, 2, 2, 0x8a6d0d, cr.x + 4, 20, cr.z);
    }
    this._sign('SOLMAR DOCKS', 18, 2.2, -230, 24, 46, 0, '#ffd34d', '#1a1a1a');
  }
  _buildSky() {
    // Sun disc + moon disc, positioned by the day clock each frame.
    this.sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(14, 24),
      new THREE.MeshBasicMaterial({ color: 0xffdf8a, fog: false }),
    );
    this.scene.add(this.sunDisc);
    this.moonDisc = new THREE.Mesh(
      new THREE.CircleGeometry(9, 24),
      new THREE.MeshBasicMaterial({ color: 0xe8ecf5, fog: false }),
    );
    this.scene.add(this.moonDisc);
    // Stars: a static point cloud, faded in at night.
    const n = 400;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * Math.PI * 0.45 + 0.08;
      const r = 800;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
      pos[i * 3 + 1] = Math.sin(e) * r;
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0 }));
    this.scene.add(this.stars);
  }
  // ---- per-frame ----
  updateDayNight(night) {
    const day = 1 - night;
    const sky = new THREE.Color().setRGB(
      lerp(0.14, 0.53, day),
      lerp(0.16, 0.68, day),
      lerp(0.30, 0.85, day),
    );
    // Golden-hour tint near dusk/dawn (dayFrac ~0.5).
    const f = this.city._dayFrac;
    const golden = (f > 0.42 && f < 0.58) ? 1 - Math.abs(f - 0.5) / 0.08 : 0;
    sky.r = clamp(sky.r + golden * 0.35, 0, 1);
    sky.g = clamp(sky.g + golden * 0.08, 0, 1);
    this.scene.background.copy(sky);
    this.scene.fog.color.copy(sky);
    this.sun.intensity = 0.45 + day * 1.35;
    this.hemi.intensity = 0.5 + day * 0.5;
    const ang = this.city._dayFrac * Math.PI * 2;
    this.sun.position.set(Math.cos(ang) * 180, Math.sin(ang) * 160 + 20, 80);
    this.sunDisc.position.set(Math.cos(ang) * 500, Math.sin(ang) * 380 + 30, -350);
    this.sunDisc.lookAt(this.camera.position);
    this.moonDisc.position.set(-Math.cos(ang) * 500, -Math.sin(ang) * 380 + 60, -350);
    this.moonDisc.lookAt(this.camera.position);
    this.stars.material.opacity = night * 0.9;
    this.lampGlowMat.color.setHex(night > 0.5 ? 0xffd27a : 0x332200);
  }
  updateCamera(px, pz, heading, inCar, dt) {
    const back = inCar ? 13 : 9.5;
    const height = inCar ? 5.5 : 4.6;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const tx = px - fx * back;
    const tz = pz - fz * back;
    const k = 1 - Math.pow(0.0001, dt);
    this.camera.position.x += (tx - this.camera.position.x) * k;
    this.camera.position.y += (height - this.camera.position.y) * k;
    this.camera.position.z += (tz - this.camera.position.z) * k;
    this.camera.lookAt(px + fx * 6, 1.6, pz + fz * 6);
  }
  snapCamera(px, pz, heading, inCar) {
    const back = inCar ? 13 : 9.5;
    const height = inCar ? 5.5 : 4.6;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    this.camera.position.set(px - fx * back, height, pz - fz * back);
    this.camera.lookAt(px + fx * 6, 1.6, pz + fz * 6);
  }
  setCamera(x, y, z, lx, ly, lz) {
    this.camera.position.set(x, y, z);
    this.camera.lookAt(lx, ly, lz);
  }
  render() {
    this.renderer.render(this.scene, this.camera);
  }
  // Car mesh factory: body + cabin + wheel slab, one group.
  makeCarMesh(colorHex, kind = 'sedan') {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex });
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
    const len = kind === 'truck' ? 5.4 : kind === 'sports' ? 4.6 : 4.4;
    const wid = kind === 'truck' ? 2.2 : 1.9;
    const body = new THREE.Mesh(new THREE.BoxGeometry(wid, 0.75, len), bodyMat);
    body.position.y = 0.62;
    g.add(body);
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(wid * 0.85, 0.6, kind === 'truck' ? 1.6 : len * 0.45),
      glassMat,
    );
    cab.position.set(0, 1.28, kind === 'truck' ? 0.9 : -0.2);
    g.add(cab);
    if (kind === 'truck') {
      const bed = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.95, 0.7, 2.4), bodyMat);
      bed.position.set(0, 1.1, -1.2);
      g.add(bed);
    }
    const wheels = new THREE.Mesh(new THREE.BoxGeometry(wid + 0.15, 0.5, len * 0.62), wheelMat);
    wheels.position.y = 0.28;
    g.add(wheels);
    // Headlights.
    const hl = new THREE.Mesh(
      new THREE.BoxGeometry(wid * 0.7, 0.18, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0 }),
    );
    hl.position.set(0, 0.62, len / 2 + 0.02);
    g.add(hl);
    return g;
  }
  // Simple pedestrian figure: torso + head, jacket color varies.
  makePedMesh(jacket) {
    const g = new THREE.Group();
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.85, 0.32),
      new THREE.MeshLambertMaterial({ color: jacket }),
    );
    torso.position.y = 0.95;
    g.add(torso);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xd8a077 }),
    );
    head.position.y = 1.6;
    g.add(head);
    const legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.55, 0.28),
      new THREE.MeshLambertMaterial({ color: 0x2a2a33 }),
    );
    legs.position.y = 0.28;
    g.add(legs);
    return g;
  }
  // Player figure: jacket + cap, slightly taller than peds.
  makePlayerMesh() {
    const g = new THREE.Group();
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.9, 0.34),
      new THREE.MeshLambertMaterial({ color: 0x2e86c1 }),
    );
    torso.position.y = 1.0;
    g.add(torso);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xd8a077 }),
    );
    head.position.y = 1.68;
    g.add(head);
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.26, 0.1, 10),
      new THREE.MeshLambertMaterial({ color: 0xc0392b }),
    );
    cap.position.y = 1.86;
    g.add(cap);
    const legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.6, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x1e2a38 }),
    );
    legs.position.y = 0.3;
    g.add(legs);
    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.55),
      new THREE.MeshLambertMaterial({ color: 0x181818 }),
    );
    gun.position.set(0.32, 1.05, 0.3);
    g.add(gun);
    return g;
  }
  // Enemy figure: dark jacket, red bandana.
  makeEnemyMesh() {
    const g = new THREE.Group();
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.9, 0.34),
      new THREE.MeshLambertMaterial({ color: 0x3a3a3a }),
    );
    torso.position.y = 1.0;
    g.add(torso);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xc89878 }),
    );
    head.position.y = 1.68;
    g.add(head);
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.12, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xc0392b }),
    );
    band.position.y = 1.78;
    g.add(band);
    const legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.6, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x222222 }),
    );
    legs.position.y = 0.3;
    g.add(legs);
    return g;
  }
}
