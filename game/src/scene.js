// Three.js scene: renderer, chase camera, day/night sky, ground texture, buildings,
// landmarks, and one mesh group per entity (player, cars, peds, enemies, heli).
// The simulation is 2D (x/z); this file only draws it. No network, no external assets.
import * as THREE from 'three';
import { DAY_LENGTH, WORLD_HALF, CAR } from './tuning.js';
import { districtAt } from './city.js';

function groundTexture(city) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const g = c.getContext('2d');
  const toPx = (v) => ((v + WORLD_HALF) / (WORLD_HALF * 2)) * 1024;
  g.fillStyle = '#3a3f46'; g.fillRect(0, 0, 1024, 1024);
  // District ground tints.
  for (const d of city.districts) {
    g.fillStyle = d.ground;
    g.fillRect(toPx(d.x0), toPx(d.z0), toPx(d.x1) - toPx(d.x0), toPx(d.z1) - toPx(d.z0));
  }
  // Beach sand (Vice Beach east edge) + marina water (north-west corner).
  g.fillStyle = '#d8c08a'; g.fillRect(toPx(330), toPx(-400), toPx(400) - toPx(330), toPx(0) - toPx(-400));
  g.fillStyle = '#1e5a7a'; g.fillRect(toPx(-400), toPx(-400), toPx(-330) - toPx(-400), toPx(-260) - toPx(-400));
  // Roads: dark asphalt with centre dashes.
  g.fillStyle = '#22242a';
  for (let i = -4; i <= 4; i += 1) {
    g.fillRect(toPx(i * 100 - 7), 0, toPx(14) - toPx(0), 1024);
    g.fillRect(0, toPx(i * 100 - 7), 1024, toPx(14) - toPx(0));
  }
  g.fillStyle = '#d8d8a0';
  for (let i = -4; i <= 4; i += 1) {
    for (let d = -380; d < 400; d += 40) {
      g.fillRect(toPx(i * 100) - 2, toPx(d), 4, 12);
      g.fillRect(toPx(d), toPx(i * 100) - 2, 12, 4);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeCarMesh(color, kind) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 4.4), bodyMat);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.6, 2.2),
    new THREE.MeshLambertMaterial({ color: 0x18202a }),
  );
  cabin.position.set(0, 1.15, -0.3);
  group.add(cabin);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  for (const [x, z] of [[-1.05, 1.5], [1.05, 1.5], [-1.05, -1.5], [1.05, -1.5]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.38, z);
    group.add(w);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 0.5), new THREE.MeshLambertMaterial({ color: 0x2233ff, emissive: 0x2233ff, emissiveIntensity: 0.7 }));
    bar.position.set(0, 1.55, -0.3);
    group.add(bar);
    group.userData.lightBar = bar;
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.25, 0.4), new THREE.MeshLambertMaterial({ color: 0xffe040, emissive: 0xaa8800 }));
    sign.position.set(0, 1.55, -0.3);
    group.add(sign);
  }
  return group;
}

function makePedMesh(color) {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 1.1, 8), mat);
  body.position.y = 0.85;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 8), new THREE.MeshLambertMaterial({ color: 0xd8a880 }));
  head.position.y = 1.65;
  group.add(head);
  return group;
}

function makeHeliMesh() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 5.2), new THREE.MeshLambertMaterial({ color: 0x224488 }));
  body.position.y = 0;
  group.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 3.4), new THREE.MeshLambertMaterial({ color: 0x224488 }));
  tail.position.set(0, 0.2, -4);
  group.add(tail);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  rotor.position.y = 1.0;
  group.add(rotor);
  group.userData.rotor = rotor;
  const coneGeo = new THREE.ConeGeometry(6, 30, 16, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.y = -15;
  cone.rotation.x = Math.PI;
  group.add(cone);
  group.userData.cone = cone;
  const spot = new THREE.SpotLight(0xfff2b0, 60, 60, 0.35, 0.5, 1.2);
  spot.position.set(0, 0, 0);
  group.add(spot);
  group.add(spot.target);
  spot.target.position.set(0, -30, 0);
  group.userData.spot = spot;
  return group;
}

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5d6);
  scene.fog = new THREE.Fog(0x87b5d6, 220, 620);
  const camera = new THREE.PerspectiveCamera(62, 800 / 450, 0.1, 1200);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a3f46, 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe8c0, 2.2);
  sun.position.set(120, 200, 60);
  scene.add(sun);
  const moon = new THREE.DirectionalLight(0x8aa8ff, 0.35);
  moon.position.set(-80, 150, -100);
  scene.add(moon);

  let city = null;
  const meshes = new Map(); // id -> THREE.Group
  const camPos = new THREE.Vector3(0, 40, 60);
  const camLook = new THREE.Vector3(0, 0, 0);

  function buildCity(c) {
    city = c;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_HALF * 2, WORLD_HALF * 2),
      new THREE.MeshLambertMaterial({ map: groundTexture(c) }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    for (const b of c.buildings) {
      const m = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: b.color }));
      m.scale.set(b.w, b.h, b.d);
      m.position.set(b.x, b.h / 2, b.z);
      scene.add(m);
    }
    // Landmarks: taller, coloured blocks with a floating label colour.
    const lmColors = { garage: 0xd8a020, safehouse: 0x20a060, hospital: 0xe8e8e8, policeHq: 0x2040c0, marina: 0x2080c0, beach: 0xe0c080, plaza: 0xc06040, tower: 0x404860 };
    for (const key of Object.keys(c.landmarks)) {
      const lm = c.landmarks[key];
      const h = key === 'tower' ? 85 : 14;
      const m = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: lmColors[key] ?? 0x888888 }));
      m.scale.set(22, h, 22);
      m.position.set(lm.x, h / 2, lm.z);
      scene.add(m);
    }
    // ATMs: small green kiosks.
    for (const atm of c.atms) {
      const m = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x18a048, emissive: 0x0a5a28, emissiveIntensity: 0.5 }));
      m.scale.set(2, 3, 1.4);
      m.position.set(atm.x, 1.5, atm.z);
      scene.add(m);
    }
  }

  function getMesh(id, make) {
    let m = meshes.get(id);
    if (!m) {
      m = make();
      meshes.set(id, m);
      scene.add(m);
    }
    return m;
  }

  function sync(world, dt) {
    // Day/night: sun angle from dayTime, sky + light lerp.
    const dayFrac = (world.dayTime % DAY_LENGTH) / DAY_LENGTH; // 0=dawn, 0.25=noon, 0.5=dusk, 0.75=midnight
    const sunH = Math.sin(dayFrac * Math.PI * 2);
    const isDay = sunH > -0.08;
    const skyDay = new THREE.Color(0x87b5d6);
    const skyNight = new THREE.Color(0x0c1226);
    const skyDusk = new THREE.Color(0xe08a4a);
    let sky;
    if (sunH > 0.25) sky = skyDay;
    else if (sunH < -0.25) sky = skyNight;
    else sky = skyDusk;
    scene.background = sky;
    scene.fog.color = sky;
    sun.intensity = isDay ? 2.2 : 0.12;
    moon.intensity = isDay ? 0.05 : 0.5;
    sun.position.set(Math.cos(dayFrac * Math.PI * 2) * 200, Math.max(20, sunH * 220), 80);
    hemi.intensity = isDay ? 1.1 : 0.45;

    // Player.
    const p = world.player;
    if (p.inCar) {
      const car = world.cars.find((c) => c.id === p.inCar);
      if (car) {
        const m = getMesh('player-car', () => makeCarMesh(CAR.kinds[car.kind].color, car.kind));
        m.position.set(car.x, 0, car.z);
        m.rotation.y = car.heading;
      }
    } else {
      const m = getMesh('player', () => makePedMesh(0x2a9a5a));
      m.position.set(p.x, 0, p.z);
      m.rotation.y = p.heading;
    }
    // Cars.
    const seen = new Set(['player', 'player-car']);
    for (const car of world.cars) {
      if (car.id === p.inCar) { seen.add('player-car'); continue; }
      const id = `car-${car.id}`;
      seen.add(id);
      const kind = car.driver === 'police' ? 'police' : car.kind;
      const m = getMesh(id, () => makeCarMesh(CAR.kinds[car.kind].color, kind));
      m.position.set(car.x, 0, car.z);
      m.rotation.y = car.heading;
      if (m.userData.lightBar) m.userData.lightBar.material.emissiveIntensity = (world.elapsed % 0.6 < 0.3) ? 1.2 : 0.1;
    }
    // Peds.
    for (const ped of world.peds) {
      const id = `ped-${ped.id}`;
      seen.add(id);
      const m = getMesh(id, () => makePedMesh(ped.color));
      m.position.set(ped.x, 0, ped.z);
      m.rotation.y = ped.heading;
    }
    // Enemies.
    for (const e of world.enemies) {
      const id = `enemy-${e.id}`;
      seen.add(id);
      const m = getMesh(id, () => makePedMesh(e.kind === 'king' ? 0x8a1020 : 0x303030));
      m.position.set(e.x, 0, e.z);
      m.rotation.y = e.heading;
      m.scale.setScalar(e.kind === 'king' ? 1.25 : 1);
    }
    // Bullets (tracers).
    for (const b of world.bullets) {
      const id = `bullet-${b.id}`;
      seen.add(id);
      const m = getMesh(id, () => {
        const g = new THREE.Group();
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffe040 }));
        g.add(s);
        return g;
      });
      m.position.set(b.x, 1.2, b.z);
    }
    // Helicopter.
    if (world.heli.active) {
      const m = getMesh('heli', makeHeliMesh);
      m.position.set(world.heli.x, world.heli.y, world.heli.z);
      m.rotation.y = world.heli.heading;
      if (m.userData.rotor) m.userData.rotor.rotation.y += dt * 22;
      seen.add('heli');
    }
    // Particles.
    for (const pt of world.particles) {
      const id = `pt-${pt.id}`;
      seen.add(id);
      const m = getMesh(id, () => {
        const g = new THREE.Group();
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 6), new THREE.MeshBasicMaterial({ color: pt.color, transparent: true, opacity: 0.9 }));
        g.add(s);
        return g;
      });
      m.position.set(pt.x, pt.y, pt.z);
      m.scale.setScalar(Math.max(0.1, pt.life));
    }
    // Drop meshes for entities that no longer exist.
    for (const [id, m] of [...meshes]) {
      if (!seen.has(id) && !id.startsWith('player')) {
        scene.remove(m);
        meshes.delete(id);
      }
    }
    // Camera: cinematic shot camera wins, else chase cam.
    let tx, tz, theading;
    if (world.shotCam) {
      camera.position.set(world.shotCam.x, world.shotCam.y, world.shotCam.z);
      camera.lookAt(world.shotCam.lx, world.shotCam.ly, world.shotCam.lz);
    } else {
      const focus = p.inCar ? world.cars.find((c) => c.id === p.inCar) : p;
      tx = focus ? focus.x : p.x;
      tz = focus ? focus.z : p.z;
      theading = focus ? focus.heading : p.heading;
      const dist = p.inCar ? 26 : 16;
      const height = p.inCar ? 13 : 10;
      const bx = tx - Math.sin(theading) * dist;
      const bz = tz - Math.cos(theading) * dist;
      camPos.x += (bx - camPos.x) * Math.min(1, dt * 4);
      camPos.z += (bz - camPos.z) * Math.min(1, dt * 4);
      camPos.y += (height - camPos.y) * Math.min(1, dt * 4);
      camLook.x += (tx - camLook.x) * Math.min(1, dt * 6);
      camLook.z += (tz - camLook.z) * Math.min(1, dt * 6);
      camLook.y = 1.5;
      camera.position.copy(camPos);
      camera.lookAt(camLook);
    }
    renderer.render(scene, camera);
  }

  function resize(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  return { renderer, scene, camera, buildCity, sync, resize, districtAt };
}
