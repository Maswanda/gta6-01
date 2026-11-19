// Cheap visual effects: muzzle flashes, skid puffs, pickup sparkles.
// Each effect is a small mesh that fades and removes itself.
import * as THREE from 'three';

export class Effects {
  constructor(world) {
    this.world = world;
    this.items = [];
  }

  muzzle(pos, heading) {
    const s = this.world.scene;
    if (!s || !s.group) return;
    const geo = new THREE.SphereGeometry(0.5, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(
      pos.x + Math.sin(heading) * 2,
      1.2,
      pos.z + Math.cos(heading) * 2,
    );
    s.group.add(m);
    this.items.push({ mesh: m, life: 0.08 });
  }

  puff(x, z, color = 0xaaaaaa) {
    const s = this.world.scene;
    if (!s || !s.group) return;
    const geo = new THREE.SphereGeometry(0.6, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, 0.5, z);
    s.group.add(m);
    this.items.push({ mesh: m, life: 0.5 });
  }

  step(dt) {
    for (const it of this.items) {
      it.life -= dt;
      if (it.life <= 0 && it.mesh.parent) it.mesh.parent.remove(it.mesh);
    }
    this.items = this.items.filter((it) => it.life > 0);
  }
}
