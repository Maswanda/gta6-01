// Solmar Bay itself: a sun-soaked coastal grid city built from one seed.
// A painted canvas texture carries the roads, sidewalks, lane dashes and
// crosswalks on a single ground plane; buildings are textured boxes with
// per-block heights, plus parks, lamps, trees, a pier and the sea.
import { CFG, STREET_LINES } from './config.js';

const WORLD = CFG.worldHalf * 2;

function makeGroundTexture() {
  const S = 2048;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const g = cv.getContext('2d');
  const toPx = (v) => ((v + CFG.worldHalf) / WORLD) * S;
  // Base: warm concrete.
  g.fillStyle = '#8d8578';
  g.fillRect(0, 0, S, S);
  // City blocks: slightly varied pavement.
  const half = CFG.streetWidth / 2;
  for (let i = 0; i < STREET_LINES.length - 1; i++) {
    for (let j = 0; j < STREET_LINES.length - 1; j++) {
      const x0 = STREET_LINES[i] + half;
      const z0 = STREET_LINES[j] + half;
      const w = CFG.blockPitch - CFG.streetWidth;
      g.fillStyle = (i + j) % 2 === 0 ? '#9a917f' : '#948b7a';
      g.fillRect(toPx(x0), toPx(z0), (w / WORLD) * S, (w / WORLD) * S);
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

export function buildCity(scene, rng) {
  const colliders = [];
  const group = new THREE.Group();
  group.name = 'city';

  // Lighting: warm late-afternoon sun over a hazy sky.
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2b0, 1.7);
  sun.position.set(140, 190, 70);
  scene.add(sun);
  scene.fog = new THREE.Fog(0xf2c98f, 150, 520);
  scene.background = new THREE.Color(0x9fc4e8);

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD, WORLD),
    new THREE.MeshLambertMaterial({ map: makeGroundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  group.add(ground);

  // The sea south of the city, and a sand strip.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD, 190),
    new THREE.MeshLambertMaterial({ color: 0x2e7fa8 }),
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

  // Building facades.
  const palettes = ['#c9a184', '#b8b0a0', '#a8b8c4', '#c4b49a', '#9fb0a8', '#c08a7a'];
  const facades = palettes.map((c) => makeFacadeTexture(c, 0.28, rng));
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x5a5148 });

  const half = CFG.streetWidth / 2;
  const parkBlocks = new Set(['2,6', '6,2']);
  const clearBlocks = new Set(['4,4', '3,6', '6,5', '1,3', '5,1', '7,7', '4,1']);
  // clearBlocks reserves room for: bank(4,4) plaza, garage(3,6), warehouse(6,5),
  // docks(1,3), safehouse(5,1), bar(7,7), pier approach(4,1) is a park strip.
  for (let i = 0; i < STREET_LINES.length - 1; i++) {
    for (let j = 0; j < STREET_LINES.length - 1; j++) {
      const x0 = STREET_LINES[i] + half;
      const z0 = STREET_LINES[j] + half;
      const w = CFG.blockPitch - CFG.streetWidth;
      const cx = x0 + w / 2;
      const cz = z0 + w / 2;
      const key = `${i},${j}`;
      const downtown = Math.abs(i - 4) <= 1 && Math.abs(j - 4) <= 1;
      if (parkBlocks.has(key)) {
        // Park: green lawn, trees, a path.
        const lawn = new THREE.Mesh(
          new THREE.PlaneGeometry(w, w),
          new THREE.MeshLambertMaterial({ color: 0x5d8a4a }),
        );
        lawn.rotation.x = -Math.PI / 2;
        lawn.position.set(cx, 0.08, cz);
        group.add(lawn);
        for (let t = 0; t < 7; t++) {
          const tx = x0 + 4 + rng.range(0, w - 8);
          const tz = z0 + 4 + rng.range(0, w - 8);
          group.add(makeTree(tx, tz, rng));
        }
        continue;
      }
      if (clearBlocks.has(key)) continue;
      // Two buildings per block, split along x.
      for (let s = 0; s < 2; s++) {
        const bw = w / 2 - 5;
        const bd = w - 6;
        const bx = x0 + 2.5 + s * (w / 2) + bw / 2;
        const h = downtown ? rng.range(26, 52) : rng.range(8, 26);
        const mat = new THREE.MeshLambertMaterial({ map: facades[rng.int(0, facades.length - 1)] });
        const b = new THREE.Mesh(new THREE.BoxGeometry(bw, h, bd), mat);
        b.position.set(bx, h / 2, cz);
        group.add(b);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.6, 0.8, bd + 0.6), roofMat);
        roof.position.set(bx, h + 0.4, cz);
        group.add(roof);
        colliders.push({
          minX: bx - bw / 2, maxX: bx + bw / 2,
          minZ: cz - bd / 2, maxZ: cz + bd / 2,
        });
      }
    }
  }

  // Landmark buildings, each with its own look and collider.
  const landmarks = {};
  function landmarkBuilding(x, z, w, d, h, color, name) {
    const mat = new THREE.MeshLambertMaterial({ map: facades[rng.int(0, facades.length - 1)], color });
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
  landmarkBuilding(26, -26, 30, 30, 46, 0xd8cba8, 'bank'); // Solmar Bank, downtown
  landmarkBuilding(156, 104, 26, 20, 12, 0xc49a7a, 'garage'); // Rico's garage
  landmarkBuilding(-156, -104, 30, 22, 14, 0x9ab0b8, 'warehouse');
  landmarkBuilding(-208, 52, 22, 18, 10, 0xb8a88a, 'docksOffice');
  landmarkBuilding(104, -156, 24, 18, 20, 0xd8a8b0, 'bar'); // rooftop bar
  landmarkBuilding(26, 182, 16, 14, 9, 0xa8c4a0, 'safehouse'); // Jax's safehouse

  // Pier: a low wooden deck reaching into the sea, where Mara waits.
  // Kept almost flush with the ground so the player walks onto it cleanly.
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

  // Street lamps along the avenues.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3d42 });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffd76a });
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

  // Scattered palms along the beachfront avenue.
  for (let x = -200; x <= 200; x += 26) {
    if (rng.chance(0.6)) group.add(makeTree(x + rng.range(-4, 4), 224, rng));
  }

  scene.add(group);
  return { colliders, landmarks, group };
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
        // Centre inside the box: push out along the smallest penetration.
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
  // World bounds.
  const B = CFG.worldHalf - 2;
  if (pos.x < -B) { pos.x = -B; hit = true; }
  if (pos.x > B) { pos.x = B; hit = true; }
  if (pos.z < -B) { pos.z = -B; hit = true; }
  if (pos.z > CFG.worldHalf + 46) { pos.z = CFG.worldHalf + 46; hit = true; }
  return hit;
}
