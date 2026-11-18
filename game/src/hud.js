// HUD v2: cash, wanted stars, health and stamina, the current weapon,
// speed, the mission objective, a mission tracker (M lists every job with
// its status), and a bigger minimap with district names, collectible dots
// and side-activity markers — all DOM + one 2D canvas, drawn every frame
// from the live game state. Also owns the start / pause / busted screens.
import { CFG, STREET_LINES, districtAt } from './config.js';

export class HUD {
  constructor() {
    this.el = {};
    for (const id of ['cash', 'stars', 'health-fill', 'health-num', 'stamina-fill', 'stamina-num',
      'ammo', 'weapon', 'speed', 'district', 'objective', 'objective-text', 'objective-dist',
      'prompt', 'message', 'banner', 'banner-title', 'banner-sub', 'menu', 'pause', 'end',
      'end-title', 'end-sub', 'minimap', 'mission-list', 'timer', 'save-note', 'btn-continue']) {
      this.el[id] = document.getElementById(id);
    }
    this.minimap = this.el.minimap.getContext('2d');
    this.messageTimer = 0;
    this.bannerTimer = 0;
    this.promptText = '';
    this.trackerOpen = false;
    document.getElementById('btn-start').addEventListener('click', () => this.onStart && this.onStart(false));
    document.getElementById('btn-continue').addEventListener('click', () => this.onStart && this.onStart(true));
    document.getElementById('btn-resume').addEventListener('click', () => this.onResume && this.onResume());
    document.getElementById('btn-restart').addEventListener('click', () => this.onRestart && this.onRestart());
    document.getElementById('btn-menu').addEventListener('click', () => this.onMenu && this.onMenu());
    document.getElementById('btn-end-continue').addEventListener('click', () => this.onResume && this.onResume());
  }

  showMenu(hasSave) {
    this.el.menu.style.display = 'flex';
    this.el['btn-continue'].style.display = hasSave ? 'inline-block' : 'none';
    this.el.pause.style.display = 'none';
    this.el.end.style.display = 'none';
  }

  hideMenu() {
    this.el.menu.style.display = 'none';
  }

  showPause() {
    this.el.pause.style.display = 'flex';
  }

  hidePause() {
    this.el.pause.style.display = 'none';
  }

  showEnd(title, sub) {
    this.el['end-title'].textContent = title;
    this.el['end-sub'].textContent = sub;
    this.el.end.style.display = 'flex';
  }

  hideEnd() {
    this.el.end.style.display = 'none';
  }

  flashMessage(text) {
    this.el.message.textContent = text;
    this.el.message.style.opacity = '1';
    this.messageTimer = 3.5;
  }

  showBanner(title, sub) {
    this.el['banner-title'].textContent = title;
    this.el['banner-sub'].textContent = sub || '';
    this.el.banner.style.opacity = '1';
    this.bannerTimer = 3.2;
  }

  setPrompt(text) {
    this.promptText = text;
  }

  showSaveNote(text) {
    this.el['save-note'].textContent = text;
    setTimeout(() => { this.el['save-note'].textContent = ''; }, 2500);
  }

  toggleTracker(world) {
    this.trackerOpen = !this.trackerOpen;
    if (!this.trackerOpen) {
      this.el['mission-list'].style.display = 'none';
      return;
    }
    const m = world.missions;
    const rows = m.defs.map((d, i) => {
      const mark = m.done || i < m.index ? '✓' : i === m.index ? '▶' : '🔒';
      const cls = m.done || i < m.index ? 'done' : i === m.index ? 'active' : 'locked';
      return `<div class="${cls}">${mark} ${d.title} — $${d.reward}</div>`;
    }).join('');
    const side = world.side;
    const coins = `Solmar coins ${side.collected.size}/${CFG.collectibleCount}`;
    const taxi = side.taxiBest ? `Taxi best ${Math.round(side.taxiBest)}s (${side.taxiRuns} runs)` : 'Taxi — not run yet';
    const race = side.raceBest ? `Race best ${Math.round(side.raceBest)}s (${side.raceRuns} runs)` : 'Street race — not run yet';
    this.el['mission-list'].innerHTML = `<b>STORY</b>${rows}<b>SIDE JOBS</b><div>${coins}</div><div>${taxi}</div><div>${race}</div>`;
    this.el['mission-list'].style.display = 'block';
  }

  update(dt, world) {
    const p = world.player;
    this.el.cash.textContent = `$${p.cash.toLocaleString('en-US')}`;
    let stars = '';
    for (let i = 0; i < CFG.maxWanted; i++) stars += i < world.police.wanted ? '★' : '☆';
    this.el.stars.textContent = stars;
    this.el.stars.style.color = world.police.wanted > 0 ? '#ffcf3a' : '#8a8f98';
    this.el['health-fill'].style.width = `${Math.max(0, p.health)}%`;
    this.el['health-fill'].style.background = p.health > 50 ? '#58c96b' : p.health > 25 ? '#e8a33a' : '#d83a3a';
    this.el['health-num'].textContent = `${Math.ceil(Math.max(0, p.health))}`;
    this.el['stamina-fill'].style.width = `${Math.max(0, p.stamina)}%`;
    this.el['stamina-num'].textContent = p.sprinting ? 'SPRINT' : '';
    const w = world.combat;
    this.el.weapon.textContent = p.inCar
      ? (p.inCar.label || 'Car')
      : `${w.def.name}  ${w.ammo[w.weapon]} / ${w.reserve[w.weapon]}`;
    this.el.ammo.textContent = p.inCar ? '—' : `🔫 ${w.ammo[w.weapon]} / ${w.reserve[w.weapon]}`;
    const speed = p.inCar ? Math.abs(p.inCar.speed) * 3.6 : Math.abs(p.speed) * 3.6;
    this.el.speed.textContent = `${Math.round(speed)} km/h`;
    const pp = p.inCar ? p.inCar.pos : p.pos;
    this.el.district.textContent = districtAt(pp.x, pp.z);
    // Objective + distance.
    const m = world.missions;
    this.el['objective-text'].textContent = m.objectiveText();
    const target = m.targetPoint();
    if (target) {
      const d = Math.hypot(pp.x - target.x, pp.z - target.z);
      this.el['objective-dist'].textContent = `${Math.round(d)} m`;
    } else {
      this.el['objective-dist'].textContent = '';
    }
    // Timer on timed steps, the taxi and the race.
    const s = m.currentStep();
    let timerText = '';
    if (s && (s.type === 'deliver' || s.type === 'race') && m.timer > 0) timerText = `⏱ ${Math.ceil(m.timer)}s`;
    else if (world.side.taxi.state === 'deliver') timerText = `🚕 ${Math.ceil(world.side.taxi.timer)}s`;
    else if (world.side.race.state === 'racing') timerText = `🏁 ${Math.ceil(world.side.race.timer)}s`;
    this.el.timer.textContent = timerText;
    this.el.prompt.textContent = this.promptText;
    this.promptText = '';
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.el.message.style.opacity = '0';
    }
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.el.banner.style.opacity = '0';
    }
    this.drawMinimap(world);
  }

  drawMinimap(world) {
    const c = this.minimap;
    const S = 220;
    const scale = S / (CFG.worldHalf * 2 + 40);
    const toX = (x) => (x + CFG.worldHalf + 20) * scale;
    const toZ = (z) => (z + CFG.worldHalf + 20) * scale;
    c.fillStyle = 'rgba(12, 16, 22, 0.88)';
    c.fillRect(0, 0, S, S);
    // Blocks.
    c.fillStyle = '#3a3f47';
    const half = CFG.streetWidth / 2;
    for (let i = 0; i < STREET_LINES.length - 1; i++) {
      for (let j = 0; j < STREET_LINES.length - 1; j++) {
        c.fillRect(toX(STREET_LINES[i] + half), toZ(STREET_LINES[j] + half),
          (CFG.blockPitch - CFG.streetWidth) * scale, (CFG.blockPitch - CFG.streetWidth) * scale);
      }
    }
    // Sea.
    c.fillStyle = '#1e5a7a';
    c.fillRect(0, toZ(CFG.worldHalf), S, S - toZ(CFG.worldHalf));
    // District names.
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.font = 'bold 10px sans-serif';
    c.fillText('NORTHSIDE', toX(-60), toZ(-190));
    c.fillText('OLD TOWN', toX(-200), toZ(-40));
    c.fillText('DOWNTOWN', toX(-40), toZ(-20));
    c.fillText('MARINA', toX(-30), toZ(210));
    // Collectible coins not yet found.
    c.fillStyle = '#ffc23a';
    for (const [id, g] of world.side.collectibleMeshes) {
      if (world.side.collected.has(id)) continue;
      c.beginPath();
      c.arc(toX(g.position.x), toZ(g.position.z), 2.5, 0, Math.PI * 2);
      c.fill();
    }
    // Taxi passenger / destination.
    if (world.side.taxi.state === 'pickup' && world.side.taxi.passenger) {
      c.fillStyle = '#39d0ff';
      c.beginPath();
      c.arc(toX(world.side.taxi.passenger.x), toZ(world.side.taxi.passenger.z), 4, 0, Math.PI * 2);
      c.fill();
    }
    if (world.side.taxi.state === 'deliver' && world.side.taxi.dest) {
      c.fillStyle = '#39d0ff';
      c.beginPath();
      c.arc(toX(world.side.taxi.dest.x), toZ(world.side.taxi.dest.z), 4, 0, Math.PI * 2);
      c.fill();
    }
    // Race checkpoints.
    if (world.side.race.state === 'racing') {
      c.fillStyle = '#ff5a4a';
      world.side.raceRings.forEach((r, i) => {
        if (i < world.side.race.index) return;
        c.beginPath();
        c.arc(toX(r.pt.x), toZ(r.pt.z), 4, 0, Math.PI * 2);
        c.fill();
      });
    }
    // Mission target.
    const target = world.missions.targetPoint();
    if (target) {
      const pulse = 6 + Math.sin(performance.now() / 200) * 2;
      c.fillStyle = '#ffd23a';
      c.beginPath();
      c.arc(toX(target.x), toZ(target.z), pulse, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#7a5a00';
      c.stroke();
    }
    // Traffic (grey), police (red/blue flash), player (white arrow).
    c.fillStyle = '#9aa2ad';
    for (const car of world.allCars) {
      if (!car.alive || car.isPlayer) continue;
      c.fillRect(toX(car.pos.x) - 1.5, toZ(car.pos.z) - 1.5, 3, 3);
    }
    for (const pc of world.police.cars) {
      c.fillStyle = Math.floor(performance.now() / 260) % 2 === 0 ? '#ff3333' : '#3388ff';
      c.beginPath();
      c.arc(toX(pc.pos.x), toZ(pc.pos.z), 4, 0, Math.PI * 2);
      c.fill();
    }
    const pp = world.player.inCar ? world.player.inCar.pos : world.player.pos;
    const heading = world.player.inCar ? world.player.inCar.heading : world.player.heading;
    c.save();
    c.translate(toX(pp.x), toZ(pp.z));
    c.rotate(-heading + Math.PI);
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(0, -6);
    c.lineTo(4.5, 5);
    c.lineTo(-4.5, 5);
    c.closePath();
    c.fill();
    c.restore();
    c.fillStyle = '#ffffff';
    c.font = 'bold 11px sans-serif';
    c.fillText('N', 4, 12);
  }
}
