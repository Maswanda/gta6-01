// hud.js — Solmar Bay: every pixel of interface, DOM over the canvas.
// The minimap is a 2D canvas; the bars, stars, cash and objective are
// plain DOM. Nothing here decides game logic — main.js hands it a
// snapshot each frame and the panel shows it.
export class HudPanel {
  constructor(root, callbacks = {}) {
    this.cb = callbacks;
    this.root = root;
    this.root.innerHTML = `
      <div class="hud-tl">
        <div id="hud-district">Marina</div>
        <div id="hud-radio">SOLMAR 88.5</div>
        <div id="hud-clock">17:30</div>
      </div>
      <div class="hud-tr">
        <div id="hud-stars"></div>
        <div id="hud-cash">$0</div>
      </div>
      <div id="hud-objective"></div>
      <div class="hud-bl">
        <canvas id="hud-minimap" width="190" height="190"></canvas>
        <div id="hud-speed"></div>
      </div>
      <div class="hud-br">
        <div class="hud-bar"><div id="hud-health"></div><span>HP</span></div>
        <div class="hud-bar"><div id="hud-armor"></div><span>ARMOR</span></div>
        <div id="hud-weapon"></div>
      </div>
      <div id="hud-hints"></div>
      <div id="hud-toast"></div>
      <div id="hud-banner"><div id="hud-banner-title"></div><div id="hud-banner-sub"></div></div>
      <div id="hud-menu" class="hud-overlay">
        <div class="hud-card">
          <h1>SOLMAR BAY</h1>
          <p class="hud-sub">Heatwave — an open-world crime story</p>
          <p>Twelve missions. Four districts. One bay that never sleeps.</p>
          <p class="hud-keys">WASD move &nbsp;·&nbsp; Shift run &nbsp;·&nbsp; E enter car &nbsp;·&nbsp; Mouse aim &nbsp;·&nbsp; Click / F shoot<br>
          V radio &nbsp;·&nbsp; M mute &nbsp;·&nbsp; G garage &nbsp;·&nbsp; H safehouse &nbsp;·&nbsp; P pause &nbsp;·&nbsp; Space handbrake</p>
          <button id="hud-start">START THE STORY</button>
          <p class="hud-foot">100% self-contained — no network, no downloads.</p>
        </div>
      </div>
      <div id="hud-pause" class="hud-overlay" hidden>
        <div class="hud-card"><h1>PAUSED</h1><p>Press P to keep playing.</p></div>
      </div>
      <div id="hud-end" class="hud-overlay" hidden>
        <div class="hud-card"><h1 id="hud-end-title">BUSTED</h1><p id="hud-end-text"></p><button id="hud-restart">BACK ON THE STREETS</button></div>
      </div>
      <div id="hud-garage" class="hud-overlay" hidden>
        <div class="hud-card hud-garage-card">
          <h1 id="hud-garage-title">RICO'S GARAGE</h1>
          <p id="hud-garage-deal"></p>
          <div id="hud-garage-list"></div>
          <button id="hud-garage-close">CLOSE [G]</button>
        </div>
      </div>`;
    this.el = {};
    for (const id of ['district', 'radio', 'clock', 'stars', 'cash', 'objective', 'minimap', 'speed', 'health', 'armor', 'weapon', 'hints', 'toast', 'banner', 'banner-title', 'banner-sub', 'menu', 'pause', 'end', 'end-title', 'end-text', 'garage', 'garage-title', 'garage-deal', 'garage-list']) {
      this.el[id] = this.root.querySelector(`#hud-${id}`);
    }
    this.mm = this.el.minimap.getContext('2d');
    this.toastTimer = null;
    this.bannerTimer = null;
    const startBtn = this.root.querySelector('#hud-start');
    if (startBtn) startBtn.addEventListener('click', () => this.cb.onStart && this.cb.onStart());
    const restartBtn = this.root.querySelector('#hud-restart');
    if (restartBtn) restartBtn.addEventListener('click', () => this.cb.onRestart && this.cb.onRestart());
    const closeBtn = this.root.querySelector('#hud-garage-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.cb.onGarageClose && this.cb.onGarageClose());
  }
  update(s) {
    this.el.district.textContent = s.district || '';
    this.el.radio.textContent = s.radio || '';
    this.el.clock.textContent = s.clock || '';
    this.el.cash.textContent = `$${Math.floor(s.cash || 0).toLocaleString('en-US')}`;
    // Wanted stars.
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < (s.wanted || 0) ? '★' : '☆';
    this.el.stars.textContent = stars;
    this.el.stars.className = (s.wanted || 0) >= 4 ? 'hot' : '';
    this.el.objective.textContent = s.objective || '';
    this.el.health.style.width = `${Math.max(0, Math.min(100, s.health || 0))}%`;
    this.el.armor.style.width = `${Math.max(0, Math.min(100, s.armor || 0))}%`;
    this.el.weapon.textContent = s.weapon ? `${s.weapon}  ·  ${s.ammo ?? '∞'}` : '';
    this.el.speed.textContent = s.inCar ? `${Math.round(s.speed || 0)} km/h` : '';
    this.el.hints.textContent = s.hint || '';
  }
  drawMinimap(m) {
    const ctx = this.mm;
    const W = 190;
    const H = 190;
    const half = m.layout.half;
    const toX = (x) => ((x + half) / (half * 2)) * W;
    const toY = (z) => ((z + half) / (half * 2)) * H;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(8, 18, 26, 0.85)';
    ctx.fillRect(0, 0, W, H);
    // District tint.
    for (const d of m.layout.districts) {
      ctx.fillStyle = `rgba(${(d.color >> 16) & 255},${(d.color >> 8) & 255},${d.color & 255},0.18)`;
      ctx.beginPath();
      ctx.arc(toX(d.cx), toY(d.cz), 34, 0, Math.PI * 2);
      ctx.fill();
    }
    // Roads.
    ctx.strokeStyle = 'rgba(220, 220, 200, 0.55)';
    ctx.lineWidth = 1.4;
    for (const c of m.layout.roadAt) {
      ctx.beginPath();
      ctx.moveTo(toX(c), 0);
      ctx.lineTo(toX(c), H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, toY(c));
      ctx.lineTo(W, toY(c));
      ctx.stroke();
    }
    // Landmarks.
    ctx.fillStyle = '#ffd76a';
    for (const l of m.layout.landmarks) {
      ctx.fillRect(toX(l.x) - 2, toY(l.z) - 2, 4, 4);
    }
    // Garage + safehouse.
    ctx.fillStyle = '#39d0c0';
    ctx.fillRect(toX(m.layout.places.garage.x) - 3, toY(m.layout.places.garage.z) - 3, 6, 6);
    ctx.fillStyle = '#7ad03a';
    ctx.fillRect(toX(m.layout.places.safehouse.x) - 3, toY(m.layout.places.safehouse.z) - 3, 6, 6);
    // Objective.
    if (m.objective) {
      const ox = toX(m.objective.x);
      const oy = toY(m.objective.z);
      ctx.fillStyle = '#ff5a3a';
      ctx.beginPath();
      ctx.arc(ox, oy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ox, oy, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Cops.
    ctx.fillStyle = '#2a5aff';
    for (const c of m.cops || []) {
      ctx.beginPath();
      ctx.arc(toX(c.x), toY(c.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Helicopter.
    if (m.heli) {
      ctx.fillStyle = '#ff2a2a';
      ctx.beginPath();
      ctx.arc(toX(m.heli.x), toY(m.heli.z), 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    const px = toX(m.player.x);
    const py = toY(m.player.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-m.player.heading + Math.PI);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // North tick.
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('N', 4, 12);
  }
  toast(msg) {
    this.el.toast.textContent = msg;
    this.el.toast.classList.add('show');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.el.toast.classList.remove('show'), 2600);
  }
  banner(title, sub = '') {
    this.el['banner-title'].textContent = title;
    this.el['banner-sub'].textContent = sub;
    this.el.banner.classList.add('show');
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.el.banner.classList.remove('show'), 3400);
  }
  setObjective(text) {
    this.el.objective.textContent = text;
  }
  showMenu(show) {
    this.el.menu.hidden = !show;
  }
  showPause(show) {
    this.el.pause.hidden = !show;
  }
  showEnd(kind, text) {
    this.el['end-title'].textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
    this.el['end-text'].textContent = text;
    this.el.end.hidden = false;
  }
  hideEnd() {
    this.el.end.hidden = true;
  }
  showGarage(show, data) {
    this.el.garage.hidden = !show;
    if (!show || !data) return;
    this.el['garage-deal'].textContent = data.deal
      ? `TODAY'S DEAL: ${data.deal.label} −20% — $${Math.floor(data.deal.price * 0.8).toLocaleString('en-US')}`
      : '';
    const list = this.el['garage-list'];
    list.innerHTML = '';
    for (const car of data.cars) {
      const row = document.createElement('div');
      row.className = 'hud-garage-row';
      const owned = data.owned.includes(car.type);
      const selected = data.selected === car.type;
      row.innerHTML = `<span>${car.label} — $${car.price.toLocaleString('en-US')}${owned ? ' · OWNED' : ''}${selected ? ' · SELECTED' : ''}</span>`;
      const btn = document.createElement('button');
      if (selected) {
        btn.textContent = 'SELECTED';
        btn.disabled = true;
      } else if (owned) {
        btn.textContent = 'SELECT';
        btn.addEventListener('click', () => this.cb.onGarageSelect && this.cb.onGarageSelect(car.type));
      } else {
        btn.textContent = 'BUY';
        btn.addEventListener('click', () => this.cb.onGarageBuy && this.cb.onGarageBuy(car.type));
      }
      row.appendChild(btn);
      if (owned && !selected) {
        const sell = document.createElement('button');
        sell.textContent = 'SELL';
        sell.addEventListener('click', () => this.cb.onGarageSell && this.cb.onGarageSell(car.type));
        row.appendChild(sell);
      }
      list.appendChild(row);
    }
  }
}
