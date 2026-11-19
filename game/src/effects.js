// Particles + screen shake. Pure data on the world object; scene.js draws them.
// Particles are cheap fading dots: muzzle sparks, explosion puffs, cash glints.
export function spawnParticles(world, x, y, z, color, count, life = 0.6) {
  for (let i = 0; i < count; i += 1) {
    world.particles.push({
      id: world.particleId++,
      x: x + (Math.random() - 0.5) * 1.5,
      y: y + (Math.random() - 0.5) * 1,
      z: z + (Math.random() - 0.5) * 1.5,
      life, color,
    });
  }
}

export function stepParticles(world, dt) {
  for (const pt of world.particles) {
    pt.life -= dt;
    pt.y += dt * 1.5;
  }
  world.particles = world.particles.filter((pt) => pt.life > 0);
}

export function shake(world, amount) {
  world.shake = Math.max(world.shake || 0, amount);
}
