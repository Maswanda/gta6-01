// HUD: diegetic, in every frame — minimap, wanted stars, cash, district,
// radio station, objective, keybinds. The minimap is a 2D canvas the
// smoke test looks for (#hud-minimap).
import { T } from './tuning.js';

export class Hud {
  constructor(world) {
    this.world = world;
    this.el = {};
    this.mapCtx = null;
    this.lastUpdate = 0;
  }

  init() {
    const doc = document;
    const root = doc.getElementById('hud');
    if (!root) return;
    root.innerHTML = '';
    const mk = (id, cls) => {
      const d = doc.createElement('div');
      d.id = id;
      d.className = cls;
      root.appendChild(d);
      this.el[id] = d;
      return d;
    };
    mk('hud-stars', 'hud-box');
    mk('hud-cash', 'hud-box');
    mk('hud-district', 'hud-box');
    mk('hud-radio', 'hud-box');
    mk('hud-objective', 'hud-box');
    mk('hud-keys', 'hud-box');
    const map = doc.createElement('canvas');
    map.id = 'hud-minimap';
    map.width = 150;
    map.height = 150;
    root.appendChild(map);
    this.el['hud-minimap'] = map;
    this.mapCtx = map.getContext('2d');
  }

  stars(n) {
    return '★'.repeat(n) + '☆'.repeat(Math.max(0, T.maxWanted - n));
  }

  drawMinimap() {
    const ctx = this.mapCtx;
    if (!ctx) return;
    const w = this.world;
    const S = 150;
    const half = T.mapHalf;
    const toMap = (x, z) => [((x + half) / (half * 2)) * S, ((z + half) / (half * 2)) * S];
    ctx.fillStyle = '#1d2b1d';
    ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    for (let v = -half; v <= half; v += T.roadStep) {
      const [x1, y1] = toMap(v, -half);
      const [x2, y2] = toMap(v, half);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      const [x3, y3] = toMap(-half, v);
      const [x4, y4] = toMap(half, v);
      ctx.beginPath();
      ctx.moveTo(x3, y3);
      ctx.lineTo(x4, y4);
      ctx.stroke();
    }
    // Buildings.
    ctx.fillStyle = '#555';
    for (const b of w.city.buildings) {
      const [x, y] = toMap(b.minX, b.minZ);
      const [x2, y2] = toMap(b.maxX, b.maxZ);
      ctx.fillRect(x, y, x2 - x, y2 - y);
    }
    // Mission target.
    const target = w.missions.currentTarget();
    if (target) {
      const [x, y] = toMap(target.x, target.z);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player.
    const [px, py] = toMap(w.player.pos.x, w.player.pos.z);
    ctx.fillStyle = '#2e8b57';
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.sin(w.player.heading) * 8, py + Math.cos(w.player.heading) * 8);
    ctx.stroke();
    // Helicopter.
    if (w.heli.active) {
      const [hx, hy] = toMap(w.heli.pos.x, w.heli.pos.z);
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(hx, hy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  update(now) {
    if (!this.el['hud-stars']) return;
    if (now - this.lastUpdate < 120) return;
    this.lastUpdate = now;
    const w = this.world;
    this.el['hud-stars'].textContent = this.stars(w.wanted);
    this.el['hud-cash'].textContent = '$' + Math.round(w.player.cash);
    this.el['hud-district'].textContent = w.city.district(w.player.pos.x, w.player.pos.z);
    this.el['hud-radio'].textContent = '♪ ' + w.radio.station;
    const m = w.missions;
    this.el['hud-objective'].textContent = m.done
      ? 'STORY COMPLETE'
      : `M${m.index + 1}/12 ${m.title} — ${m.current.text}`;
    this.el['hud-keys'].textContent = 'WASD move/drive · E talk/enter · F punch · G shoot · R reload · 1-3 radio · C crouch';
    this.drawMinimap();
  }
}
