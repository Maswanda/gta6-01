// Solmar Bay v4: a sun-soaked coastal city with four districts, each with
// its own look — Downtown's towers, Old Town's brick rows, Northside's glass
// and the Marina's beachfront — plus a pier, a lighthouse, a ferris wheel
// and a marina. One painted ground texture carries the roads; buildings are
// textured boxes; the sky is a gradient dome with drifting clouds. v4 puts
// a sign on Rico's garage and a porch light on the safehouse, so the two
// places the new systems live are easy to find after dark.
import { CFG, STREET_LINES, districtAt } from './config.js';

const WORLD = CFG.worldHalf * 2;

function makeGroundTexture() {
  const S = 2048;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const g = cv.getContext('2d');
  const toPx = (v) => ((v + CFG.worldHalf) / WORLD) * S;
  g.fillStyle = '#8d8578';
  g.fillRect(0, 0, S, S);
  // District tints, painted under the blocks.
  const half = CFG.streetWidth / 2;
  const tint = (x0, z0, w, color) => {
    g.fillStyle = color;
    g.fillRect(toPx(x0), toPx(z0), (w / WORLD) * S, (w / WORLD) * S);
  };
  for (let i = 0; i < STREET_LINES.length - 1; i++) {
    for (let j = 0; j < STREET_LINES.length - 1; j++) {
      const x0 = STREET_LINES[i] + half;
      const z0 = STREET_LINES[j] + half;
      const w = CFG.blockPitch - CFG.streetWidth;
      const cx = x0 + w / 2;
      const cz = z0 + w / 2;
      const d = districtAt(cx, cz);
      if (d === 'Old Town') tint(x0, z0, w, '#a89a86');
      else if (d === 'Northside') tint(x0, z0, w, '#8f9aa5');
      else if (d === 'Marina' || d === 'Beachfront') tint(x0, z0, w, '#a89a7c');
      else tint(x0, z0, w, (i + j) % 2 === 0 ? '#9a917f' : '#948b7a');
    }
  }
  // Roads: dark asphalt ribbons along every street line.
  g.fillStyle = '#3c3f45';
  for (const line of STREET_LINES) {
    g.fillRect(toPx(line - half), 0, (CFG.streetWidth / WORLD) * S, S);
    g.fillRect(0, toPx(line - half), S, (CFG.streetWidth / WORLD) * S);
  }
  // Sidewalk edges.
  g.strokeStyle = '#b9b2a2';
  g.lineWidth = 3;
  for (const line of STREET_LINES) {
    g.strokeRect(toPx(line - half), 0, (CFG.streetWidth / WORLD) * S, S);
    g.strokeRect(0, toPx(line - half), S, (CFG.streetWidth / WORLD) * S);
  }
  // Lane dashes.
  g.fillStyle = '#d8c95a';
  for (const line of STREET_LINES) {
    for (let v = -CFG.cityHalf; v < CFG.cityHalf; v += 10) {
      g.fillRect(toPx(line) - 2, toPx(v), 4, 14);
      g.fillRect(toPx(v), toPx(line) - 2, 14, 4);
    }
  }
  // Crosswalks at intersections.
  g.fillStyle = '#e8e6df';
  for (const a of STREET_LINES) {
    for (const b of STREET_LINES) {
      for (let k = -2; k <= 2; k++) {
        g.fillRect(toPx(a + k * 2.4) - 3, toPx(b - half + 1.5), 6, 11);
        g.fillRect(toPx(a - half + 1.5), toPx(b + k * 2.4) - 3, 11, 6);
      }
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeFacadeTexture(base, litRatio, rng) {
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  for (let y = 10; y < 248; y += 18) {
    for (let x = 8; x < 120; x += 16) {
      const lit = rng.next() < litRatio;
      g.fillStyle = lit ? '#ffd98a' : '#20242c';
      g.fillRect(x, y, 10, 12);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSkyTexture() {
  const cv = document.createElement('canvas');
  cv.width = 16;
  cv.height = 256;
  const g = cv.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#2f6fb4');
  grad.addColorStop(0.45, '#7fb2dd');
  grad.addColorStop(0.72, '#f2c98f');
  grad.addColorStop(1, '#f7b96a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A billboard face with real lettering, so a screenshot can read the city.
function makeBillboardTexture(text, fg, bg) {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 160;
  const g = cv.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 160);
  g.strokeStyle = fg;
  g.lineWidth = 6;
  g.strokeRect(8, 8, 496, 144);
  g.fillStyle = fg;
  g.font = '900 64px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 84);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Night sky: a deep blue gradient the day texture fades into after dusk.
function makeNightSkyTexture() {
  const cv = document.createElement('canvas');
  cv.width = 16;
  cv.height = 256;
  const g = cv.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#050a18');
  grad.addColorStop(0.5, '#0e1e3a');
  grad.addColorStop(0.8, '#1a2a4a');
  grad.addColorStop(1, '#2a3a5a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// How much of the night is in the sky at a day fraction (0 = dawn, 0.25 =
// noon, 0.5 = dusk, 0.75 = midnight): dark from just after dusk until just
// before dawn, with a smooth ramp either side.
function nightnessAt(frac) {
  const f = ((frac % 1) + 1) % 1;
  const up = smoothstep(0.5, 0.62, f);
  const down = 1 - smoothstep(0.86, 0.96, f);
  return up * down;
}

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function lerpColor(a, b, t) {
  return new THREE.Color(a).lerp(new THREE.Color(b), t);
}

export function buildCity(scene, rng) {
  const colliders = [];
  const group = new THREE.Group();
  group.name = 'city';
  const animated = [];
  // Night-glow materials the day/night cycle turns up after dusk.
  const facadeMats = [];
  const nightGlow = { beacons: [], lamps: null, neon: [] };

  // Golden-hour lighting: warm sun, soft sky bounce, hazy distance. The
  // day/night cycle below re-aims and re-colours these as the day turns.
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2b0, 1.7);
  sun.position.set(140, 190, 70);
  scene.add(sun);
  const moon = new THREE.DirectionalLight(0x8aa8ff, 0);
  moon.position.set(-120, 200, -80);
  scene.add(moon);
  scene.fog = new THREE.Fog(0xf2c98f, 150, 520);
  // Sky dome: a gradient shell so the horizon glows at golden hour. The
  // night texture is swapped in as the day fraction crosses dusk.
  const skyMat = new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(680, 24, 16), skyMat);
  scene.add(sky);
  const nightSkyTex = makeNightSkyTexture();
  const daySkyTex = skyMat.map;
  scene.background = new THREE.Color(0x9fc4e8);
  // The moon itself: a pale disc that fades in at night.
  const moonDisc = new THREE.Mesh(
    new THREE.CircleGeometry(18, 24),
    new THREE.MeshBasicMaterial({ color: 0xf2f2d8, transparent: true, opacity: 0, fog: false }),
  );
  moonDisc.position.set(-320, 300, -420);
  moonDisc.lookAt(0, 0, 0);
  scene.add(moonDisc);
  // Drifting clouds.
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 9; i++) {
    const cl = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(rng.range(6, 13), 8, 6), cloudMat);
      puff.position.set(k * 9 - 9 + rng.range(-3, 3), rng.range(-1, 1.5), rng.range(-3, 3));
      puff.scale.y = 0.45;
      cl.add(puff);
    }
    cl.position.set(rng.range(-320, 320), rng.range(90, 150), rng.range(-320, 320));
    scene.add(cl);
    animated.push({ obj: cl, kind: 'cloud', speed: rng.range(0.6, 1.6) });
  }

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD, WORLD),
    new THREE.MeshLambertMaterial({ map: makeGroundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  // The sea south of the city, shinier in v3 — a Phong surface so the sun
  // and the marina lights glitter on it — and a sand strip.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD, 190),
    new THREE.MeshPhongMaterial({ color: 0x2e7fa8, shininess: 90, specular: 0x99ccff }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.06, CFG.worldHalf + 88);
  group.add(sea);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD, 16),
    new THREE.MeshLambertMaterial({ color: 0xd9c28f }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.05, CFG.worldHalf - 2);
  group.add(sand);

  // Facades: one palette per district mood.
  const downtownFacades = ['#c9a184', '#b8b0a0', '#a8b8c4', '#c4b49a', '#9fb0a8', '#c08a7a']
    .map((c) => makeFacadeTexture(c, 0.28, rng));
  const oldTownFacades = ['#a85a44', '#8a5a3a', '#b07a4a', '#7a4a3a']
    .map((c) => makeFacadeTexture(c, 0.22, rng));
  const northFacades = ['#7a94a8', '#6a8aa0', '#8aa8b8', '#5a7a90']
    .map((c) => makeFacadeTexture(c, 0.42, rng));
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x5a5148 });

  const half = CFG.streetWidth / 2;
  const parkBlocks = new Set(['2,6', '6,2']);
  const clearBlocks = new Set(['4,4', '3,6', '6,5', '1,3', '5,1', '7,7', '4,1', '3,4', '5,3', '1,4']);
  // clearBlocks reserves room for: bank(4,4), garage(3,6), warehouse(6,5),
  // docks(1,3), safehouse(5,1), bar(7,7), pier approach(4,1), Solmar Tower(3,4),
  // casino(5,3) and the Old Town clock tower(1,4).
  for (let i = 0; i < STREET_LINES.length - 1; i++) {
    for (let j = 0; j < STREET_LINES.length - 1; j++) {
      const x0 = STREET_LINES[i] + half;
      const z0 = STREET_LINES[j] + half;
      const w = CFG.blockPitch - CFG.streetWidth;
      const cx = x0 + w / 2;
      const cz = z0 + w / 2;
      const key = `${i},${j}`;
      const d = districtAt(cx, cz);
      const downtown = Math.abs(i - 4) <= 1 && Math.abs(j - 4) <= 1;
      if (parkBlocks.has(key)) {
        const lawn = new THREE.Mesh(
          new THREE.PlaneGeometry(w, w),
          new THREE.MeshLambertMaterial({ color: 0x5d8a4a }),
        );
        lawn.rotation.x = -Math.PI / 2;
        lawn.position.set(cx, 0.08, cz);
        group.add(lawn);
        for (let t = 0; t < 7; t++) {
          group.add(makeTree(x0 + 4 + rng.range(0, w - 8), z0 + 4 + rng.range(0, w - 8), rng));
        }
        // A bench in each park.
        const bench = new THREE.Mesh(
          new THREE.BoxGeometry(3, 0.5, 1),
          new THREE.MeshLambertMaterial({ color: 0x6a4a2a }),
        );
        bench.position.set(cx, 0.35, cz);
        group.add(bench);
        continue;
      }
      if (clearBlocks.has(key)) continue;
      const facades = d === 'Old Town' ? oldTownFacades : d === 'Northside' ? northFacades : downtownFacades;
      const count = d === 'Old Town' ? 3 : 2;
      for (let s = 0; s < count; s++) {
        const bw = w / count - 4;
        const bd = w - 6;
        const bx = x0 + 2 + s * (w / count) + bw / 2;
        let h;
        if (d === 'Northside') h = rng.range(30, 58);
        else if (downtown) h = rng.range(34, 66); // v3: taller Downtown towers
        else if (d === 'Old Town') h = rng.range(7, 15);
        else h = rng.range(8, 26);
        const mat = new THREE.MeshLambertMaterial({ map: facades[rng.int(0, facades.length - 1)] });
        facadeMats.push(mat);
        const b = new THREE.Mesh(new THREE.BoxGeometry(bw, h, bd), mat);
        b.position.set(bx, h / 2, cz);
        group.add(b);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.6, 0.8, bd + 0.6), roofMat);
        roof.position.set(bx, h + 0.4, cz);
        group.add(roof);
        // A rooftop box on the taller towers, for skyline variety.
        if (h > 30 && rng.chance(0.5)) {
          const cap = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.4, 3, bd * 0.4), roofMat);
          cap.position.set(bx, h + 2.2, cz);
          group.add(cap);
        }
        // v3: a red rooftop beacon on every tall tower, blinking at night.
        if (h > 30) {
          const beacon = new THREE.Mesh(
            new THREE.SphereGeometry(0.7, 8, 6),
            new THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.9 }),
          );
          beacon.position.set(bx, h + 1.2, cz);
          group.add(beacon);
          nightGlow.beacons.push(beacon);
        }
        colliders.push({
          minX: bx - bw / 2, maxX: bx + bw / 2,
          minZ: cz - bd / 2, maxZ: cz + bd / 2,
        });
      }
    }
  }

  // Landmark buildings, each with its own look and collider.
  const landmarks = {};
  function landmarkBuilding(x, z, w, d, h, color, name, facadeSet) {
    const set = facadeSet || downtownFacades;
    const mat = new THREE.MeshLambertMaterial({ map: set[rng.int(0, set.length - 1)], color });
    facadeMats.push(mat);
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(x, h / 2, z);
    group.add(b);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6), roofMat);
    roof.position.set(x, h + 0.4, z);
    group.add(roof);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    landmarks[name] = new THREE.Vector3(x, 0, z);
    return b;
  }
  landmarkBuilding(26, -26, 30, 30, 46, 0xd8cba8, 'bank');
  landmarkBuilding(156, 104, 26, 20, 12, 0xc49a7a, 'garage');
  landmarkBuilding(-156, -104, 30, 22, 14, 0x9ab0b8, 'warehouse');
  landmarkBuilding(-208, 52, 22, 18, 10, 0xb8a88a, 'docksOffice');
  landmarkBuilding(104, -156, 24, 18, 20, 0xd8a8b0, 'bar');
  landmarkBuilding(26, 182, 16, 14, 9, 0xa8c4a0, 'safehouse');
  // Solmar Tower — the tallest building in the city, Downtown's crown.
  landmarkBuilding(-26, 26, 26, 26, 74, 0xe8d8b0, 'tower');
  // The Meridian Casino, Northside's neon block.
  landmarkBuilding(78, -26, 30, 24, 22, 0xd8a0c0, 'casino', northFacades);
  // v3: the casino's face. A neon MERIDIAN sign over the entrance, a canopy
  // on two columns, and a red carpet to the street — the heist walks in here.
  const neonTex = makeBillboardTexture('MERIDIAN', '#ff5ad0', '#1a0a22');
  const neon = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 6.2),
    new THREE.MeshBasicMaterial({ map: neonTex }),
  );
  neon.position.set(78, 25, -13.4);
  group.add(neon);
  nightGlow.neon.push(neon.material);
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(14, 0.6, 7),
    new THREE.MeshLambertMaterial({ color: 0x8a1a4a }),
  );
  canopy.position.set(78, 5.4, -11);
  group.add(canopy);
  for (const cx of [72, 84]) {
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 5.4, 10),
      new THREE.MeshLambertMaterial({ color: 0xe8d8b0 }),
    );
    column.position.set(cx, 2.7, -8.5);
    group.add(column);
  }
  const carpet = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 9),
    new THREE.MeshLambertMaterial({ color: 0xa01828 }),
  );
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(78, 0.07, -9.5);
  group.add(carpet);
  landmarks.casinoEntrance = new THREE.Vector3(78, 0, -10);
  // v4: Rico's garage gets its own sign on the south face, and the
  // safehouse gets a green porch light — the two places the new systems
  // live should be easy to find, day or night.
  const garageTex = makeBillboardTexture("RICO'S GARAGE", '#ffb23a', '#1a1208');
  const garageSign = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 4),
    new THREE.MeshBasicMaterial({ map: garageTex }),
  );
  garageSign.position.set(156, 9, 114.4);
  group.add(garageSign);
  const porch = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.5, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x7ddb8a, emissive: 0x3a8a4a }),
  );
  porch.position.set(26, 4, 189.2);
  group.add(porch);
  // Old Town clock tower.
  const clock = landmarkBuilding(-130, 26, 14, 14, 34, 0xc0a080, 'clockTower', oldTownFacades);
  const clockFace = new THREE.Mesh(
    new THREE.CylinderGeometry(4.4, 4.4, 1, 16),
    new THREE.MeshLambertMaterial({ color: 0xf2ead8, emissive: 0x554411 }),
  );
  clockFace.rotation.x = Math.PI / 2;
  clockFace.position.set(-130, 30, 26 + 7.2);
  group.add(clockFace);
  void clock;

  // Ferris wheel on the Marina beachfront — it turns, slowly.
  const wheel = new THREE.Group();
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0xd83a5a });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(11, 0.5, 8, 28), wheelMat);
  wheel.add(rim);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 22, 6), wheelMat);
    spoke.rotation.z = a;
    wheel.add(spoke);
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 2.2, 2.2),
      new THREE.MeshLambertMaterial({ color: [0x39d0ff, 0xffc23a, 0x7ddb8a, 0xff8a5a][k % 4] }),
    );
    cab.position.set(Math.sin(a) * 11, Math.cos(a) * 11, 0);
    wheel.add(cab);
  }
  const legMat = new THREE.MeshLambertMaterial({ color: 0x3a3d42 });
  for (const sx of [-6, 6]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 14, 6), legMat);
    leg.position.set(sx, 7, 0);
    leg.rotation.z = sx > 0 ? 0.42 : -0.42;
    group.add(leg);
  }
  wheel.position.set(80, 13, 232);
  group.add(wheel);
  animated.push({ obj: wheel, kind: 'wheel' });
  landmarks.ferrisWheel = new THREE.Vector3(80, 0, 232);
  landmarks.marina = new THREE.Vector3(30, 0, 236);

  // Marina boats bobbing in the sea near the pier.
  const boatHull = new THREE.MeshLambertMaterial({ color: 0xe8e4da });
  for (let i = 0; i < 5; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 7), boatHull);
    hull.position.y = 0.4;
    boat.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), legMat);
    mast.position.y = 3.4;
    boat.add(mast);
    const sail = new THREE.Mesh(
      new THREE.ConeGeometry(1.6, 4.4, 4),
      new THREE.MeshLambertMaterial({ color: [0xffffff, 0xffc23a, 0x39d0ff][i % 3] }),
    );
    sail.position.y = 3.2;
    boat.add(sail);
    boat.position.set(-140 + i * 32, 0.1, 296 + (i % 2) * 18);
    boat.rotation.y = rng.range(-0.4, 0.4);
    group.add(boat);
    animated.push({ obj: boat, kind: 'boat', phase: i * 1.3 });
  }

  // A yacht at the Marina, bigger than the day boats, with a navigation
  // light on its mast that blinks after dark.
  const yacht = new THREE.Group();
  const yachtHull = new THREE.Mesh(
    new THREE.BoxGeometry(4.5, 1.4, 11),
    new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }),
  );
  yachtHull.position.y = 0.7;
  yacht.add(yachtHull);
  const yachtCabin = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 1.6, 5),
    new THREE.MeshLambertMaterial({ color: 0xd8e8f2 }),
  );
  yachtCabin.position.set(0, 2.2, -0.5);
  yacht.add(yachtCabin);
  const yachtMast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0x3a3d42 }),
  );
  yachtMast.position.set(0, 6, 1);
  yacht.add(yachtMast);
  const navLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.9 }),
  );
  navLight.position.set(0, 10.2, 1);
  yacht.add(navLight);
  nightGlow.beacons.push(navLight);
  yacht.position.set(60, 0.1, 296);
  yacht.rotation.y = 0.3;
  group.add(yacht);
  animated.push({ obj: yacht, kind: 'boat', phase: 2.6 });

  // Dock lights along the Marina walk, so the waterfront glows at night.
  const dockLampMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffd76a });
  nightGlow.lamps = dockLampMat;
  for (let x = -40; x <= 120; x += 40) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, 4.5, 6),
      new THREE.MeshLambertMaterial({ color: 0x3a3d42 }),
    );
    post.position.set(x, 2.2, 244);
    group.add(post);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), dockLampMat);
    bulb.position.set(x, 4.6, 244);
    group.add(bulb);
  }

  // Pier: a low wooden deck reaching into the sea, where Mara waits.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a48 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 0.16, 60), pierMat);
  pier.position.set(-60, 0.08, CFG.worldHalf + 22);
  group.add(pier);
  for (let k = 0; k < 5; k++) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 3, 6),
      new THREE.MeshLambertMaterial({ color: 0x5a4630 }),
    );
    post.position.set(-64, 0.4, CFG.worldHalf + 4 + k * 12);
    group.add(post);
    const post2 = post.clone();
    post2.position.x = -56;
    group.add(post2);
  }
  landmarks.pier = new THREE.Vector3(-60, 0, CFG.worldHalf + 38);
  landmarks.docks = new THREE.Vector3(-208, 0, 52);
  landmarks.spawn = new THREE.Vector3(26, 0, 164);
  landmarks.parkA = new THREE.Vector3(-130, 0, 130);
  landmarks.parkB = new THREE.Vector3(130, 0, -130);

  // Lighthouse at the pier's end, with a beam that sweeps the water.
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xf2ead8 });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3, 16, 10), lightMat);
  tower.position.set(-60, 8, CFG.worldHalf + 50);
  group.add(tower);
  const lampRoom = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 2.4, 10),
    new THREE.MeshLambertMaterial({ color: 0x22242a, emissive: 0xffd76a }),
  );
  lampRoom.position.set(-60, 17, CFG.worldHalf + 50);
  group.add(lampRoom);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(4, 34, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe98a, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }),
  );
  beam.rotation.z = Math.PI / 2;
  beam.position.set(-60, 17, CFG.worldHalf + 50);
  group.add(beam);
  animated.push({ obj: beam, kind: 'beam' });
  landmarks.lighthouse = new THREE.Vector3(-60, 0, CFG.worldHalf + 50);

  // Street lamps along the avenues. Their bulbs brighten after dark.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3d42 });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffd76a });
  nightGlow.streetLampMat = lampMat;
  for (const line of STREET_LINES) {
    for (let v = -182; v <= 182; v += 52) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), poleMat);
      pole.position.set(line + half + 1, 3, v);
      group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampMat);
      bulb.position.set(line + half + 1, 6.2, v);
      group.add(bulb);
    }
  }

  // Billboards on the beachfront avenue, with real lettering in v3, plus
  // two more on the Downtown avenues so the name reads from across town.
  const billboards = [
    { x: -52, z: 208, text: 'SOLMAR', color: '#d83a5a' },
    { x: 52, z: 208, text: 'HEATWAVE', color: '#2e6fc2' },
    { x: -104, z: -52, text: 'SOLMAR BAY', color: '#ffd23a', face: 'x' },
    { x: 104, z: 52, text: 'HEATWAVE', color: '#39d0ff', face: 'x' },
  ];
  for (const b of billboards) {
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(14, 5, 0.6),
      new THREE.MeshLambertMaterial({ color: 0x22242a }),
    );
    board.position.set(b.x, 9, b.z);
    if (b.face === 'x') board.rotation.y = Math.PI / 2;
    group.add(board);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(13, 4.4),
      new THREE.MeshBasicMaterial({ map: makeBillboardTexture(b.text, b.color, '#14161c') }),
    );
    face.position.set(b.x, 9, b.z + 0.35);
    if (b.face === 'x') {
      face.rotation.y = Math.PI / 2;
      face.position.set(b.x + 0.35, 9, b.z);
    }
    group.add(face);
    nightGlow.neon.push(face.material);
    colliders.push({ minX: b.x - 7, maxX: b.x + 7, minZ: b.z - 0.5, maxZ: b.z + 0.5 });
  }

  // Scattered palms along the beachfront avenue.
  for (let x = -200; x <= 200; x += 26) {
    if (rng.chance(0.6)) group.add(makeTree(x + rng.range(-4, 4), 224, rng));
  }

  scene.add(group);

  // --- Day / night ----------------------------------------------------------
  // The cycle runs on game time: a full day is CFG.dayLength seconds. The
  // game starts in the morning (frac 0.12); dusk falls near frac 0.5 and
  // midnight sits at 0.75. setDayFrac jumps the clock (screenshots and the
  // play-test use it) and returns the nightness, 0 by day and 1 at night.
  let dayFrac = 0.12;
  let lastNightness = 0;

  function applyDayNight(n) {
    lastNightness = n;
    sun.intensity = 1.7 - n * 1.45;
    sun.color.copy(lerpColor(0xffe2b0, 0x8aa8ff, n));
    moon.intensity = n * 0.5;
    hemi.intensity = 0.95 - n * 0.6;
    scene.fog.color.copy(lerpColor(0xf2c98f, 0x0e1626, n));
    scene.background.copy(lerpColor(0x9fc4e8, 0x0a1220, n));
    skyMat.map = n > 0.5 ? nightSkyTex : daySkyTex;
    skyMat.needsUpdate = true;
    moonDisc.material.opacity = n;
    // Windows glow warm after dark; street and dock lamps burn brighter.
    for (const m of facadeMats) {
      m.emissive.setHex(0xffd98a);
      m.emissiveIntensity = n * 0.38;
    }
    if (nightGlow.streetLampMat) nightGlow.streetLampMat.emissiveIntensity = 0.5 + n * 1.6;
    if (nightGlow.lamps) nightGlow.lamps.emissiveIntensity = 0.5 + n * 1.6;
  }

  function nightness() {
    return nightnessAt(dayFrac);
  }

  function setDayFrac(f) {
    dayFrac = ((f % 1) + 1) % 1;
    applyDayNight(nightnessAt(dayFrac));
    return lastNightness;
  }

  function animate(dt, t) {
    dayFrac = (dayFrac + dt / CFG.dayLength) % 1;
    applyDayNight(nightnessAt(dayFrac));
    // Rooftop beacons and the yacht's navigation light blink.
    const blink = Math.sin(t * 3) > 0 ? 1 : 0.25;
    for (const b of nightGlow.beacons) b.material.opacity = 0.25 + 0.75 * blink * (0.35 + 0.65 * lastNightness);
    for (const a of animated) {
      if (a.kind === 'wheel') a.obj.rotation.z += dt * 0.12;
      else if (a.kind === 'beam') a.obj.rotation.y = t * 0.5;
      else if (a.kind === 'boat') {
        a.obj.position.y = 0.1 + Math.sin(t * 0.9 + a.phase) * 0.18;
        a.obj.rotation.z = Math.sin(t * 0.7 + a.phase) * 0.03;
      } else if (a.kind === 'cloud') {
        a.obj.position.x += a.speed * dt;
        if (a.obj.position.x > 360) a.obj.position.x = -360;
      }
    }
  }

  applyDayNight(nightnessAt(dayFrac));

  return { colliders, landmarks, group, animate, setDayFrac, nightness, dayFrac: () => dayFrac };
}

function makeTree(x, z, rng) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.4, 3.4, 6),
    new THREE.MeshLambertMaterial({ color: 0x7a5a38 }),
  );
  trunk.position.y = 1.7;
  g.add(trunk);
  const top = new THREE.Mesh(
    new THREE.ConeGeometry(2.4, 4.6, 8),
    new THREE.MeshLambertMaterial({ color: 0x3f7a3a }),
  );
  top.position.y = 5.4;
  g.add(top);
  g.position.set(x, 0, z);
  g.rotation.y = rng.range(0, Math.PI * 2);
  return g;
}

// Circle (x,z,r) vs axis-aligned building colliders: push the circle out.
// Returns the corrected position; also reports whether a hit happened.
export function collideCircle(pos, radius, colliders) {
  let hit = false;
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        const pl = pos.x - c.minX;
        const pr = c.maxX - pos.x;
        const pt = pos.z - c.minZ;
        const pb = c.maxZ - pos.z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) pos.x = c.minX - radius;
        else if (m === pr) pos.x = c.maxX + radius;
        else if (m === pt) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
      }
    }
  }
  const B = CFG.worldHalf - 2;
  if (pos.x < -B) { pos.x = -B; hit = true; }
  if (pos.x > B) { pos.x = B; hit = true; }
  if (pos.z < -B) { pos.z = -B; hit = true; }
  if (pos.z > CFG.worldHalf + 46) { pos.z = CFG.worldHalf + 46; hit = true; }
  return hit;
}
