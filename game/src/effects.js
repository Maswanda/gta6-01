// effects.js — Solmar Bay: particles, skid marks and screen shake.
// A fixed pool of small meshes is recycled, so bursts never allocate
// mid-frame. The stage owns the camera shake; this pool only asks for it.
import * as THREE from 'three';

const POOL = 140;
const SKIDS = 40;

export class FxPool {
  constructor(world) {
    this.world = world;
    this.parts = [];
    const geo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
    for (let i = 0; i < POOL; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      world.stage.scene.add(m);
      this.parts.push({ mesh: m, vx: 0, vy: 0, vz: 0, life: 0, max: 1, grav: 0 });
    }
    this.skids = [];
    const skidGeo = new THREE.PlaneGeometry(1.6, 0.5);
    for (let i = 0; i < SKIDS; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0 });
      const m = new THREE.Mesh(skidGeo, mat);
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.07;
      m.visible = false;
      world.stage.scene.add(m);
      this.skids.push({ mesh: m, life: 0 });
    }
    this.skidIdx = 0;
    this.skidTimer = 0;
  }
  burst(x, y, z, color, n, speed, life, grav = 6, size = 1) {
    let placed = 0;
    for (const p of this.parts) {
      if (placed >= n) break;
      if (p.life > 0) continue;
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.9 + 0.3;
      const sp = speed * (0.4 + Math.random() * 0.8);
      p.mesh.visible = true;
      p.mesh.material.color.setHex(color);
      p.mesh.position.set(x, y, z);
      p.mesh.scale.setScalar(size * (0.6 + Math.random() * 0.8));
      p.vx = Math.cos(a) * sp;
      p.vz = Math.sin(a) * sp;
      p.vy = up * sp;
      p.life = life * (0.6 + Math.random() * 0.7);
      p.max = p.life;
      p.grav = grav;
      placed++;
    }
  }
  muzzle(x, y, z, heading) {
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    this.burst(x + fx * 1.2, y, z + fz * 1.2, 0xffd76a, 5, 9, 0.16, 0, 0.8);
  }
  explosion(x, y, z) {
    this.burst(x, y + 1, z, 0xff7a2a, 26, 16, 0.9, 8, 1.6);
    this.burst(x, y + 1, z, 0x3a3a3a, 14, 7, 1.6, -1, 2.2);
    this.burst(x, y + 1, z, 0xffd76a, 10, 22, 0.4, 4, 1.2);
    this.shake(1.6);
  }
  smoke(x, y, z) {
    this.burst(x, y + 1, z, 0x555555, 3, 2, 1.4, -2, 1.8);
  }
  skid(x, z, heading) {
    const s = this.skids[this.skidIdx];
    this.skidIdx = (this.skidIdx + 1) % SKIDS;
    s.mesh.visible = true;
    s.mesh.position.set(x, 0.07, z);
    s.mesh.rotation.z = -heading;
    s.mesh.material.opacity = 0.55;
    s.life = 6;
  }
  shake(amount) {
    const st = this.world.stage;
    st.shake = Math.min(2.5, st.shake + amount);
  }
  update(dt) {
    for (const p of this.parts) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        continue;
      }
      p.vy -= p.grav * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.mesh.position.y < 0.05) {
        p.mesh.position.y = 0.05;
        p.vy = 0;
      }
      const f = p.life / p.max;
      p.mesh.scale.setScalar(Math.max(0.05, f));
    }
    for (const s of this.skids) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.mesh.material.opacity = Math.max(0, (s.life / 6) * 0.55);
      if (s.life <= 0) s.mesh.visible = false;
    }
  }
}
