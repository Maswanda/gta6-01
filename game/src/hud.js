// HUD: cash, wanted stars, health and stamina, the current weapon, speed,
// the mission objective, a mission tracker (M lists every job with its
// status), and a bigger minimap with district names, collectible dots,
// side-activity markers and red crime blips — all DOM + one 2D canvas,
// drawn every frame from the live game state. Also owns the start / pause /
// busted screens. The radio readout (current station, every frame), a
// helicopter warning while the air unit is up, the garage's owned cars in
// the tracker, and the chopper + safehouse markers on the minimap.
import { CFG, STREET_LINES, districtAt } from './config.js';

const HUD_IDS = [
  'cash', 'stars', 'health-fill', 'health-num', 'stamina-fill', 'stamina-num',
  'ammo', 'weapon', 'speed', 'district', 'objective', 'objective-text', 'objective-dist',
  'prompt', 'message', 'banner', 'banner-title', 'banner-sub', 'menu', 'pause', 'end',
  'end-title', 'end-sub', 'minimap', 'mission-list', 'timer', 'save-note', 'btn-continue',
  'crime-indicator', 'daynight', 'cash-popup', 'radio', 'heli-indicator',
];

export class HUD {
  constructor() {
    this.el = {};
    for (const id of HUD_IDS) {
      this.el[id] = document.getElementById(id);
    }
    this.minimap = this.el.minimap.getContext('2d');
    this.messageTimer = 0;
    this.bannerTimer = 0;
    this.promptText = '';
    this.trackerOpen = false;
    this.lastCash = 0;
    this.lastWanted = 0;
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
    // Pop-in: restart the banner animation so it scales in every time.
    this.el.banner.style.animation = 'none';
    void this.el.banner.offsetWidth;
    this.el.banner.style.animation = '';
  }

  // A floating "+$X" over the cash readout, for every payout.
  showCashPopup(amount) {
    if (!this.el['cash-popup'] || amount <= 0) return;
    const el = this.el['cash-popup'];
    el.textContent = `+$${amount.toLocaleString('en-US')}`;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; }, 1400);
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
    const crime = world.crime ? `Crimes stopped ${world.crime.interventions} (seen ${world.crime.eventsSeen})` : '';
    // The garage's cars and the radio station, so the tracker shows the
    // whole run — story, side jobs, rides and music.
    const garage = world.garage
      ? (world.garage.owned.length
        ? `Rico's garage: ${world.garage.owned.map((id) => world.garage.item(id).name).join(', ')}${world.garage.activeId ? ` — driving ${world.garage.item(world.garage.activeId).name}` : ''}`
        : "Rico's garage: no cars yet — buy one at the garage (B)")
      : '';
    const radio = world.radio ? `Radio: ${world.radio.stationName()}` : '';
    this.el['mission-list'].innerHTML = `<b>STORY</b>${rows}<b>SIDE JOBS</b><div>${coins}</div><div>${taxi}</div><div>${race}</div><div>${crime}</div><b>GARAGE & RADIO</b><div>${garage}</div><div>${radio}</div>`;
    this.el['mission-list'].style.display = 'block';
  }

  update(dt, world) {
    const p = world.player;
    this.el.cash.textContent = `$${p.cash.toLocaleString('en-US')}`;
    // A payout floats up as a cash popup; the first frame seeds the baseline.
    if (this.lastCash === 0 && p.cash === 0) this.lastCash = 0;
    else if (p.cash > this.lastCash) this.showCashPopup(p.cash - this.lastCash);
    this.lastCash = p.cash;
    this.drawStars(world);
    this.drawStatus(world, p);
    this.drawMission(world, p);
    this.drawTimers(dt, world);
    this.drawMinimap(world);
  }

  drawStars(world) {
    let stars = '';
    for (let i = 0; i < CFG.maxWanted; i += 1) stars += i < world.police.wanted ? '★' : '☆';
    this.el.stars.textContent = stars;
    this.el.stars.style.color = world.police.wanted > 0 ? '#ffcf3a' : '#8a8f98';
    // The stars pulse when the wanted level changes.
    if (world.police.wanted !== this.lastWanted) {
      this.el.stars.style.animation = 'none';
      void this.el.stars.offsetWidth;
      this.el.stars.style.animation = '';
      this.lastWanted = world.police.wanted;
    }
  }

  drawStatus(world, p) {
    // Crime indicator: a red line while an ambient event is live.
    if (this.el['crime-indicator']) {
      const crime = world.crime && world.crime.event;
      if (crime) {
        const label = crime.type === 'carjacking' ? 'CARJACKING' : crime.type === 'pursuit' ? 'POLICE PURSUIT' : 'ATM ROBBERY';
        this.el['crime-indicator'].textContent = `🚨 ${label} — stop it for cash!`;
        this.el['crime-indicator'].style.display = 'block';
      } else {
        this.el['crime-indicator'].style.display = 'none';
      }
    }
    // Day / night readout: sun or moon plus the time of day.
    if (this.el.daynight && world.city) {
      const n = world.city.nightness();
      const dayFrac = world.city.dayFrac ? world.city.dayFrac() : 0.12;
      const hour = Math.floor(((dayFrac + 0.25) % 1) * 24);
      const mm = Math.floor((((dayFrac + 0.25) % 1) * 24 % 1) * 60);
      const hh = String(hour).padStart(2, '0');
      const mn = String(mm).padStart(2, '0');
      this.el.daynight.textContent = n > 0.5 ? `🌙 NIGHT ${hh}:${mn}` : `☀️ DAY ${hh}:${mn}`;
    }
    // The radio readout — the current station, in every frame — and the
    // helicopter warning while the air unit is up.
    if (this.el.radio && world.radio) {
      this.el.radio.textContent = world.radio.on ? `♪ ${world.radio.stationName()}` : '♪ RADIO OFF — press V';
    }
    if (this.el['heli-indicator'] && world.heli) {
      if (world.heli.active) {
        this.el['heli-indicator'].textContent = world.heli.spotlightOnPlayer()
          ? '🚁 IN THE SPOTLIGHT — break the beam!'
          : '🚁 PD AIR UNIT OVERHEAD';
        this.el['heli-indicator'].style.display = 'block';
      } else {
        this.el['heli-indicator'].style.display = 'none';
      }
    }
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
  }

  drawMission(world, p) {
    const m = world.missions;
    this.el['objective-text'].textContent = m.objectiveText();
    const pp = p.inCar ? p.inCar.pos : p.pos;
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
  }

  drawTimers(dt, world) {
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.el.message.style.opacity = '0';
    }
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.el.banner.style.opacity = '0';
    }
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
    for (let i = 0; i < STREET_LINES.length - 1; i += 1) {
      for (let j = 0; j < STREET_LINES.length - 1; j += 1) {
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
    this.drawMapDots(c, world, toX, toZ);
    this.drawMapUnits(c, world, toX, toZ);
    // Player: a white arrow.
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

  // Coins, taxi, race rings, mission target, crime blip, safehouse, chopper.
  drawMapDots(c, world, toX, toZ) {
    const dot = (x, z, r, color, stroke) => {
      c.fillStyle = color;
      c.beginPath();
      c.arc(toX(x), toZ(z), r, 0, Math.PI * 2);
      c.fill();
      if (stroke) {
        c.strokeStyle = stroke;
        c.stroke();
      }
    };
    // Collectible coins not yet found.
    for (const [id, g] of world.side.collectibleMeshes) {
      if (world.side.collected.has(id)) continue;
      dot(g.position.x, g.position.z, 2.5, '#ffc23a');
    }
    // Taxi passenger / destination.
    if (world.side.taxi.state === 'pickup' && world.side.taxi.passenger) {
      dot(world.side.taxi.passenger.x, world.side.taxi.passenger.z, 4, '#39d0ff');
    }
    if (world.side.taxi.state === 'deliver' && world.side.taxi.dest) {
      dot(world.side.taxi.dest.x, world.side.taxi.dest.z, 4, '#39d0ff');
    }
    // Race checkpoints.
    if (world.side.race.state === 'racing') {
      world.side.raceRings.forEach((r, i) => {
        if (i < world.side.race.index) return;
        dot(r.pt.x, r.pt.z, 4, '#ff5a4a');
      });
    }
    // Mission target.
    const target = world.missions.targetPoint();
    if (target) {
      const pulse = 6 + Math.sin(performance.now() / 200) * 2;
      dot(target.x, target.z, pulse, '#ffd23a', '#7a5a00');
    }
    // Active crime event: a red blip that pulses.
    if (world.crime && world.crime.event) {
      const pos = world.crime.eventPos();
      if (pos) {
        const pulse = 6 + Math.sin(performance.now() / 150) * 2.5;
        dot(pos.x, pos.z, pulse, '#ff3333', '#7a0000');
      }
    }
    // The safehouse is a green square on the map — the place to rest the
    // heat — and the chopper is a pulsing orange dot while it is up.
    const sh = world.city.landmarks.safehouse;
    if (sh) {
      c.fillStyle = '#58c96b';
      c.fillRect(toX(sh.x) - 4, toZ(sh.z) - 4, 8, 8);
      c.strokeStyle = '#1e5a2a';
      c.strokeRect(toX(sh.x) - 4, toZ(sh.z) - 4, 8, 8);
    }
    if (world.heli && world.heli.active) {
      const pulse = 5 + Math.sin(performance.now() / 150) * 2;
      dot(world.heli.pos.x, world.heli.pos.z, pulse, '#ff8a2a', '#7a3a00');
    }
  }

  // Traffic (grey), police (red/blue flash).
  drawMapUnits(c, world, toX, toZ) {
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
  }
}
