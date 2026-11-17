// HUD: cash, wanted stars, health, ammo, speed, mission objective, the
// minimap, prompts and banners — all DOM + one 2D canvas, drawn every frame
// from the live game state. Also owns the start / pause / busted screens.
import { CFG, STREET_LINES } from './config.js';

export class HUD {
  constructor() {
    this.el = {};
    for (const id of ['cash', 'stars', 'health-fill', 'health-num', 'ammo', 'speed',
      'objective', 'objective-text', 'objective-dist', 'prompt', 'message', 'banner', 'banner-title',
      'banner-sub', 'menu', 'pause', 'end', 'end-title', 'end-sub', 'minimap',
      'mission-list', 'timer', 'save-note', 'btn-continue']) {
      this.el[id] = document.getElementById(id);
    }
    this.minimap = this.el.minimap.getContext('2d');
    this.messageTimer = 0;
    this.bannerTimer = 0;
    this.promptText = '';
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

  update(dt, world) {
    const p = world.player;
    this.el.cash.textContent = `$${p.cash.toLocaleString('en-US')}`;
    // Wanted stars: filled ★ for heat, empty ☆ for the rest.
    let stars = '';
    for (let i = 0; i < CFG.maxWanted; i++) stars += i < world.police.wanted ? '★' : '☆';
    this.el.stars.textContent = stars;
    this.el.stars.style.color = world.police.wanted > 0 ? '#ffcf3a' : '#8a8f98';
    this.el['health-fill'].style.width = `${Math.max(0, p.health)}%`;
    this.el['health-fill'].style.background = p.health > 50 ? '#58c96b' : p.health > 25 ? '#e8a33a' : '#d83a3a';
    this.el['health-num'].textContent = `${Math.ceil(Math.max(0, p.health))}`;
    this.el.ammo.textContent = p.inCar ? '—' : `🔫 ${world.combat.ammo} / ${world.combat.reserve}`;
    const speed = p.inCar ? Math.abs(p.inCar.speed) * 3.6 : Math.abs(p.speed) * 3.6;
    this.el.speed.textContent = `${Math.round(speed)} km/h`;
    // Objective + distance.
    const m = world.missions;
    this.el['objective-text'].textContent = m.objectiveText();
    const target = m.targetPoint();
    if (target) {
      const pp = p.inCar ? p.inCar.pos : p.pos;
      const d = Math.hypot(pp.x - target.x, pp.z - target.z);
      this.el['objective-dist'].textContent = `${Math.round(d)} m`;
    } else {
      this.el['objective-dist'].textContent = '';
    }
    // Timer on timed steps.
    const s = m.currentStep();
    this.el.timer.textContent = s && s.type === 'deliver' && m.timer > 0
      ? `⏱ ${Math.ceil(m.timer)}s` : '';
    // Prompt (E to talk / enter car), set fresh each frame.
    this.el.prompt.textContent = this.promptText;
    this.promptText = '';
    // Message + banner fade.
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
    const S = 190;
    const scale = S / (CFG.worldHalf * 2 + 40);
    const toX = (x) => (x + CFG.worldHalf + 20) * scale;
    const toZ = (z) => (z + CFG.worldHalf + 20) * scale;
    c.fillStyle = 'rgba(12, 16, 22, 0.85)';
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
    // North marker.
    c.fillStyle = '#ffffff';
    c.font = 'bold 11px sans-serif';
    c.fillText('N', 4, 12);
  }
}
