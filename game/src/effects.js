// effects.js — cheap transient effects: muzzle flashes, explosions and
// drift smoke. All 2D data; scene.js draws them as sprites/points.
export class Effects {
  constructor() {
    this.items = []; // {kind, x, z, t, life}
  }
  muzzle(x, z) { this.items.push({ kind: 'muzzle', x, z, t: 0, life: 0.12 }); }
  explosion(x, z) { this.items.push({ kind: 'explosion', x, z, t: 0, life: 0.9 }); }
  smoke(x, z) { this.items.push({ kind: 'smoke', x, z, t: 0, life: 0.7 }); }
  update(dt) {
    for (const it of this.items) it.t += dt;
    this.items = this.items.filter((it) => it.t < it.life);
  }
  // Snapshot for the renderer: [{kind, x, z, a}] with a = 0..1 alpha.
  snapshot() {
    return this.items.map((it) => ({ kind: it.kind, x: it.x, z: it.z, a: 1 - it.t / it.life }));
  }
}
