// effects.js — Cheap visual feedback: muzzle flashes, hit sparks,
// smoke puffs, skid marks, explosion flashes and screen shake.
// All pooled and time-based; nothing allocates per frame in steady state.
import * as THREE from 'three';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.skids = [];
    this.shake = 0;
    this.flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.flashMat);
    this.flash.position.z = -0.5;
    this.flash.visible = false;
    // Attach the flash to the camera so it covers the screen.
    this.flashOnCamera = false;
  }
  _spawn(pos, color, count, speed, life, size, gravity = -6) {
    const geo = new THREE.BoxGeometry(size, size, size);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(pos);
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.8 + 0.2;
      this.particles.push({
        mesh: m,
        vel: new THREE.Vector3(Math.cos(a) * speed * Math.random(), up * speed, Math.sin(a) * speed * Math.random()),
        life,
        maxLife: life,
        gravity,
      });
      this.scene.dynamic.add(m);
    }
  }
  muzzle(pos, heading) {
    this._spawn(pos, 0xffd34d, 4, 6, 0.12, 0.09, 0);
  }
  hitSpark(pos) {
    this._spawn(pos, 0xff6b4d, 6, 5, 0.3, 0.08, -4);
  }
  blood(pos) {
    this._spawn(pos, 0xa02020, 8, 4, 0.4, 0.1, -6);
  }
  smoke(pos) {
    this._spawn(pos, 0x555555, 3, 1.5, 0.9, 0.3, 1.5);
  }
  explosion(pos) {
    this._spawn(pos, 0xff8a2a, 22, 10, 0.6, 0.22, -2);
    this._spawn(pos, 0x333333, 10, 4, 1.2, 0.4, 2);
    this.shake = Math.max(this.shake, 0.7);
  }
  skid(x, z, heading) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.55 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 1.4), mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -heading;
    m.position.set(x, 0.03, z);
    this.scene.dynamic.add(m);
    this.skids.push({ mesh: m, life: 6 });
    if (this.skids.length > 120) {
      const old = this.skids.shift();
      this.scene.dynamic.remove(old.mesh);
    }
  }
  screenFlash(color, opacity) {
    this.flashMat.color.setHex(color);
    this.flashMat.opacity = opacity;
    this.flash.visible = true;
    this.flashOnCamera = true;
  }
  update(dt, camera) {
    // Particles.
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.dynamic.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      p.vel.y += p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.material.opacity = p.life / p.maxLife;
    }
    // Skid fade.
    for (let i = this.skids.length - 1; i >= 0; i--) {
      const s = this.skids[i];
      s.life -= dt;
      if (s.life <= 0) {
        this.scene.dynamic.remove(s.mesh);
        this.skids.splice(i, 1);
      } else if (s.life < 2) {
        s.mesh.material.opacity = 0.55 * (s.life / 2);
      }
    }
    // Screen flash decay.
    if (this.flash.visible) {
      this.flashMat.opacity -= dt * 2.2;
      if (this.flashMat.opacity <= 0) this.flash.visible = false;
    }
    if (this.flash.visible && camera) {
      // Keep the flash plane glued in front of the camera.
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      this.flash.position.copy(camera.position).addScaledVector(dir, 0.6);
      this.flash.lookAt(camera.position);
      if (!this.flash.parent) camera.add(this.flash);
    }
    // Shake decay.
    this.shake = Math.max(0, this.shake - dt * 1.4);
  }
  shakeOffset() {
    if (this.shake <= 0) return { x: 0, y: 0 };
    const s = this.shake * 0.25;
    return { x: (Math.random() - 0.5) * s, y: (Math.random() - 0.5) * s };
  }
}
