// HelicopterAI: spawns at 4-5 stars, circles the player with a searchlight cone,
// rotor audio. Escape: reach the safehouse (or break line of sight for 10 s) and it leaves.
// It never shoots — it is a pressure system, not a death sentence.
import { POLICE } from './tuning.js';
import { sfx } from './audio.js';

export function stepHelicopter(world, dt) {
  const p = world.player;
  const h = world.heli;
  const want = p.wanted >= POLICE.heliAt;
  if (want && !h.active) {
    h.active = true;
    h.x = p.x + 60; h.z = p.z - 60; h.y = 55;
    h.heading = 0; h.losTimer = 0; h.orbit = 0;
    world.feed.push('Police helicopter overhead — break line of sight or reach the safehouse.');
  }
  if (!h.active) return;
  if (!want) {
    h.active = false;
    return;
  }
  // Orbit the player at ~45 units, 55 up.
  h.orbit += dt * 0.35;
  const tx = p.x + Math.sin(h.orbit) * 45;
  const tz = p.z + Math.cos(h.orbit) * 45;
  h.x += (tx - h.x) * Math.min(1, dt * 1.2);
  h.z += (tz - h.z) * Math.min(1, dt * 1.2);
  h.heading = Math.atan2(p.x - h.x, p.z - h.z);
  if (Math.random() < dt * 0.5) sfx.sirenBlip();
  // Safehouse = escape.
  const sh = world.city.landmarks.safehouse;
  const dSafe = Math.hypot(p.x - sh.x, p.z - sh.z);
  if (dSafe < 30) {
    h.active = false;
    p.heat = Math.max(0, p.heat - 1);
    world.feed.push('You lost the helicopter at the safehouse.');
    return;
  }
  // Line-of-sight break: inside a building shadow is approximated by being far
  // from roads and slow — simpler: if the player stays in one district block
  // (no movement) the heli loses them after 10 s. (Moving keeps it on you.)
  const moved = Math.hypot(p.x - (h.lastX ?? p.x), p.z - (h.lastZ ?? p.z));
  if (moved < 0.5) h.losTimer += dt; else h.losTimer = 0;
  h.lastX = p.x; h.lastZ = p.z;
  if (h.losTimer > 10) {
    h.active = false;
    world.feed.push('You broke the helicopter spotlight.');
  }
}
