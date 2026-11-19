// hud.js — The diegetic HUD: minimap, wanted stars, cash, health,
// district name, radio station, objective, key hints, toasts and the
// start / pause / busted / dead screens. All DOM, updated every frame.
import { TUNE, districtAt } from './tuning.js';

export class Hud {
  constructor() {
    this.root = document.getElementById('hud');
    this._build();
    this.toastTimer = null;
    this.lastDistrict = '';
  }
  _el(tag, cls, parent, text = '') {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    parent.appendChild(e);
    return e;
  }
  _build() {
    // Top-left: minimap + district.
    const tl = this._el('div', 'hud-tl', this.root);
    this.map = this._el('canvas', 'hud-map', tl);
    this.map.width = 190;
    this.map.height = 190;
    this.districtEl = this._el('div', 'hud-district', tl, 'Marina');
    // Top-right: wanted stars + cash.
    const tr = this._el('div', 'hud-tr', this.root);
    this.starsEl = this._el('div', 'hud-stars', tr, '');
    this.cashEl = this._el('div', 'hud-cash', tr, '$500');
    this.radioEl = this._el('div', 'hud-radio', tr, 'SOLMAR 88.5');
    // Bottom-left: health + armor + weapon.
    const bl = this._el('div', 'hud-bl', this.root);
    this.healthEl = this._el('div', 'hud-health', bl);
    this.healthBar = this._el('div', 'hud-health-bar', this.healthEl);
    this.armorEl = this._el('div', 'hud-armor', bl);
    this.armorBar = this._el('div', 'hud-armor-bar', this.armorEl);
    this.weaponEl = this._el('div', 'hud-weapon', bl, 'Pistol');
    // Bottom-center: objective.
    this.objectiveEl = this._el('div', 'hud-objective', this.root, '');
    // Bottom-right: speed + hints.
    const br = this._el('div', 'hud-br', this.root);
    this.speedEl = this._el('div', 'hud-speed', br, '');
    this.hintEl = this._el('div', 'hud-hint', br, '');
    // Center: toast + wanted flash.
    this.toastEl = this._el('div', 'hud-toast', this.root, '');
    this.centerEl = this._el('div', 'hud-center', this.root, '');
    // Overlays: menu / pause / busted / dead / garage.
    this.menuEl = this._el('div', 'hud-overlay', this.root);
    this.menuEl.id = 'menu';
    this.menuEl.innerHTML = '<div class="hud-title">SOLMAR BAY</div><div class="hud-sub">HEATWAVE</div>' +
      '<div class="hud-menu-text">Twelve jobs. One city. Don\'t get caught.</div>' +
      '<button class="hud-btn" id="btn-start">START STORY</button>' +
      '<div class="hud-controls">WASD move / drive &nbsp;·&nbsp; Shift sprint &nbsp;·&nbsp; C crouch<br>' +
      'E talk &nbsp;·&nbsp; F enter car / punch &nbsp;·&nbsp; G shoot &nbsp;·&nbsp; R reload<br>' +
      'T taxi &nbsp;·&nbsp; 1-3 weapons &nbsp;·&nbsp; Q radio &nbsp;·&nbsp; Esc pause</div>';
    this.pauseEl = this._el('div', 'hud-overlay hud-hidden', this.root);
    this.pauseEl.id = 'pause';
    this.pauseEl.innerHTML = '<div class="hud-title">PAUSED</div><button class="hud-btn" id="btn-resume">RESUME</button>';
    this.bustedEl = this._el('div', 'hud-overlay hud-hidden', this.root);
    this.bustedEl.id = 'busted';
    this.bustedEl.innerHTML = '<div class="hud-title hud-red">BUSTED</div><div class="hud-menu-text">The Solmar PD caught up with you.</div><button class="hud-btn" id="btn-busted">KEEP GOING</button>';
    this.deadEl = this._el('div', 'hud-overlay hud-hidden', this.root);
    this.deadEl.id = 'dead';
    this.deadEl.innerHTML = '<div class="hud-title hud-red">WASTED</div><div class="hud-menu-text">Solmar Bay is unforgiving.</div><button class="hud-btn" id="btn-dead">TRY AGAIN</button>';
    this.garageEl = this._el('div', 'hud-overlay hud-hidden', this.root);
    this.garageEl.id = 'garage';
    this.garageEl.innerHTML = '<div class="hud-title">RICO\u2019S GARAGE</div><div id="garage-list"></div><button class="hud-btn" id="btn-garage-close">CLOSE</button>';
    this.mapCtx = this.map.getContext('2d');
  }
  showMenu(v) { this.menuEl.classList.toggle('hud-hidden', !v); }
  showPause(v) { this.pauseEl.classList.toggle('hud-hidden', !v); }
  showBusted(v) { this.bustedEl.classList.toggle('hud-hidden', !v); }
  showDead(v) { this.deadEl.classList.toggle('hud-hidden', !v); }
  showGarage(v) { this.garageEl.classList.toggle('hud-hidden', !v); }
  toast(text, ms = 2600) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('hud-toast-show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('hud-toast-show'), ms);
  }
  flash(text, ms = 1600) {
    this.centerEl.textContent = text;
    this.centerEl.classList.add('hud-center-show');
    setTimeout(() => this.centerEl.classList.remove('hud-center-show'), ms);
  }
  update(world) {
    const p = world.player;
    const w = world.police.wanted;
    this.starsEl.textContent = w > 0 ? '\u2605'.repeat(w) + '\u2606'.repeat(5 - w) : '';
    this.starsEl.classList.toggle('hud-stars-on', w > 0);
    this.cashEl.textContent = '$' + Math.floor(p.cash).toLocaleString('en-US');
    this.radioEl.textContent = (world.radio.on ? '\u266B ' : '\u266B muted · ') + world.radio.name;
    this.healthBar.style.width = Math.max(0, p.health) + '%';
    this.armorBar.style.width = Math.max(0, p.armor) + '%';
    this.healthEl.title = 'Health ' + Math.round(p.health);
    this.armorEl.title = 'Armor ' + Math.round(p.armor);
    const wp = TUNE.weapons[p.weapon];
    const ammo = world.combat.ammo[p.weapon];
    this.weaponEl.textContent = wp.label + '  ' + ammo + ' / ' + wp.mag + (p.weapon === 'pistol' ? ' ∞' : '');
    const d = districtAt(p.pos.x, p.pos.z);
    if (d.name !== this.lastDistrict) {
      this.lastDistrict = d.name;
      this.districtEl.textContent = d.name;
    }
    const obj = world.missions.currentObjective();
    this.objectiveEl.textContent = obj ? obj : '';
    const speedKmh = p.inCar ? Math.round(Math.abs(p.inCar.speed) * 3.6) : 0;
    this.speedEl.textContent = p.inCar ? speedKmh + ' km/h' + (world.drifting ? '  ·  DRIFT!' : '') : '';
    this.hintEl.textContent = world.hint || '';
    this._drawMap(world);
  }
  _drawMap(world) {
    const g = this.mapCtx;
    const S = 190;
    const scale = S / (TUNE.cityHalf * 2 + 20);
    const X = (x) => (x + TUNE.cityHalf + 10) * scale;
    const Z = (z) => (z + TUNE.cityHalf + 10) * scale;
    g.clearRect(0, 0, S, S);
    g.fillStyle = 'rgba(10, 16, 24, 0.82)';
    g.fillRect(0, 0, S, S);
    // District tints.
    for (const d of TUNE.districts) {
      g.fillStyle = '#' + d.tint.toString(16).padStart(6, '0');
      g.globalAlpha = 0.35;
      g.fillRect(X(d.x0), Z(d.z0), (d.x1 - d.x0) * scale, (d.z1 - d.z0) * scale);
    }
    g.globalAlpha = 1;
    // Water.
    g.fillStyle = '#1f6f8b';
    g.fillRect(0, Z(296), S, S - Z(296));
    // Roads.
    g.strokeStyle = 'rgba(220,220,210,0.5)';
    g.lineWidth = 1.2;
    for (const r of world.city.roads) {
      g.beginPath();
      if (r.axis === 'x') { g.moveTo(0, Z(r.at)); g.lineTo(S, Z(r.at)); }
      else { g.moveTo(X(r.at), 0); g.lineTo(X(r.at), S); }
      g.stroke();
    }
    // Landmarks.
    for (const lm of Object.values(TUNE.landmarks)) {
      g.fillStyle = '#ffd34d';
      g.beginPath();
      g.arc(X(lm.x), Z(lm.z), 2.5, 0, Math.PI * 2);
      g.fill();
    }
    // Objective marker (pulsing yellow diamond).
    const obj = world.missions.currentTarget();
    if (obj) {
      const t = performance.now() / 300;
      const r = 5 + Math.sin(t) * 2;
      g.fillStyle = '#ffe14d';
      g.save();
      g.translate(X(obj.x), Z(obj.z));
      g.rotate(Math.PI / 4);
      g.fillRect(-r / 2, -r / 2, r, r);
      g.restore();
    }
    // Crime event.
    if (world.crime.event) {
      const pos = world.crime.eventPos();
      if (pos) {
        g.fillStyle = '#ff4d4d';
        g.beginPath();
        g.arc(X(pos.x), Z(pos.z), 4, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Police cars.
    for (const car of world.allCars) {
      if (!car.isPolice) continue;
      g.fillStyle = '#4d9fff';
      g.fillRect(X(car.pos.x) - 2, Z(car.pos.z) - 2, 4, 4);
    }
    // Heli.
    if (world.heli.active) {
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(X(world.heli.pos.x), Z(world.heli.pos.z), 3.5, 0, Math.PI * 2);
      g.fill();
    }
    // Player arrow.
    const p = world.player;
    g.save();
    g.translate(X(p.pos.x), Z(p.pos.z));
    g.rotate(Math.atan2(Math.sin(p.heading), Math.cos(p.heading)));
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(0, -6);
    g.lineTo(4.5, 5);
    g.lineTo(-4.5, 5);
    g.closePath();
    g.fill();
    g.restore();
  }
}
