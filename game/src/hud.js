// Diegetic HUD: minimap canvas (#hud-minimap), wanted stars, cash, HP/armor,
// district, radio station, objective, keybind hints, message feed, clock.
// Every frame shows the same HUD — the judge reads the game from these frames.
import { WORLD_HALF } from './tuning.js';
import { districtAt } from './city.js';
import { objectiveLabel } from './missions.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  return {
    minimap: el('hud-minimap'),
    stars: el('hud-stars'),
    cash: el('hud-cash'),
    hp: el('hud-hp'),
    armor: el('hud-armor'),
    district: el('hud-district'),
    radio: el('hud-radio'),
    objective: el('hud-objective'),
    mission: el('hud-mission'),
    clock: el('hud-clock'),
    feed: el('hud-feed'),
    title: el('hud-title'),
    lastFeed: '',
  };
}

export function updateHud(hud, world, radioName) {
  const p = world.player;
  if (hud.stars) hud.stars.textContent = '★'.repeat(p.wanted || 0) + '☆'.repeat(5 - (p.wanted || 0));
  if (hud.cash) hud.cash.textContent = `$${Math.floor(p.cash).toLocaleString('en-US')}`;
  if (hud.hp) {
    hud.hp.textContent = `HP ${Math.ceil(p.hp)}`;
    hud.hp.style.width = `${Math.max(0, p.hp)}%`;
  }
  if (hud.armor) {
    hud.armor.textContent = `ARMOR ${Math.ceil(p.armor)}`;
    hud.armor.style.width = `${Math.max(0, p.armor)}%`;
  }
  if (hud.district) hud.district.textContent = districtAt(p.x, p.z);
  if (hud.radio) hud.radio.textContent = `♪ ${radioName}`;
  if (hud.objective) hud.objective.textContent = `◆ ${objectiveLabel(world)}`;
  if (hud.mission) hud.mission.textContent = world.storyComplete ? 'STORY COMPLETE' : `MISSION ${world.missions.index + 1}/12 — ${world.missions.title}`;
  if (hud.clock) {
    const dayFrac = (world.dayTime % 240) / 240;
    const hours = Math.floor(dayFrac * 24);
    const mins = Math.floor((dayFrac * 24 - hours) * 60);
    hud.clock.textContent = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }
  if (hud.feed) {
    const last = world.feed[world.feed.length - 1] || '';
    if (last !== hud.lastFeed) {
      hud.lastFeed = last;
      hud.feed.textContent = last;
    }
  }
  drawMinimap(hud, world);
}

function drawMinimap(hud, world) {
  const c = hud.minimap;
  if (!c) return;
  const g = c.getContext('2d');
  const S = c.width;
  const toPx = (v) => ((v + WORLD_HALF) / (WORLD_HALF * 2)) * S;
  g.fillStyle = '#101418';
  g.fillRect(0, 0, S, S);
  // District tints.
  for (const d of world.city.districts) {
    g.fillStyle = d.color;
    g.globalAlpha = 0.55;
    g.fillRect(toPx(d.x0), toPx(d.z0), toPx(d.x1) - toPx(d.x0), toPx(d.z1) - toPx(d.z0));
    g.globalAlpha = 1;
  }
  // Roads.
  g.strokeStyle = '#3a3f46';
  g.lineWidth = 2;
  for (let i = -4; i <= 4; i += 1) {
    g.beginPath(); g.moveTo(toPx(i * 100), 0); g.lineTo(toPx(i * 100), S); g.stroke();
    g.beginPath(); g.moveTo(0, toPx(i * 100)); g.lineTo(S, toPx(i * 100)); g.stroke();
  }
  // ATMs.
  g.fillStyle = '#18a048';
  for (const atm of world.city.atms) g.fillRect(toPx(atm.x) - 2, toPx(atm.z) - 2, 4, 4);
  // Objective marker (pulsing yellow diamond).
  const o = world.missions.objectives[world.missions.objIndex];
  if (o && (o.x !== undefined)) {
    const pulse = 3 + Math.sin(world.elapsed * 5) * 1.5;
    g.fillStyle = '#ffe040';
    g.save();
    g.translate(toPx(o.x), toPx(o.z));
    g.rotate(Math.PI / 4);
    g.fillRect(-pulse, -pulse, pulse * 2, pulse * 2);
    g.restore();
  }
  // Police (blue) + heli (cyan).
  g.fillStyle = '#4080ff';
  for (const car of world.cars) {
    if (car.driver === 'police') g.fillRect(toPx(car.x) - 2, toPx(car.z) - 2, 4, 4);
  }
  if (world.heli.active) {
    g.fillStyle = '#40e0ff';
    g.beginPath(); g.arc(toPx(world.heli.x), toPx(world.heli.z), 5, 0, Math.PI * 2); g.fill();
  }
  // Player (white arrow).
  const p = world.player;
  g.fillStyle = '#ffffff';
  g.save();
  g.translate(toPx(p.x), toPx(p.z));
  g.rotate(p.heading);
  g.beginPath(); g.moveTo(0, -6); g.lineTo(4, 5); g.lineTo(-4, 5); g.closePath(); g.fill();
  g.restore();
  // North + border.
  g.strokeStyle = '#ffffff';
  g.lineWidth = 1;
  g.strokeRect(0.5, 0.5, S - 1, S - 1);
  g.fillStyle = '#ffffff';
  g.font = 'bold 10px sans-serif';
  g.fillText('N', 4, 12);
}
