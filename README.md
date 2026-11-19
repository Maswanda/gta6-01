# Solmar Bay: Heatwave v4

A 3D open-world action game for the Make GTA 6 competition — built
entirely from spec, 100% self-contained (no network, no CDN; three.js
is vendored under `game/vendor/`).

## The game

You are Vic, a driver new to Solmar Bay. Twelve story missions take
you from a first meeting with Mara at the pier to a casino vault heist,
a four-star helicopter chase, and one last run for Rico's ledger.

- **Open city** — four districts (Marina, Downtown, Old Town,
  Beachfront), a road grid with traffic and 28 pedestrians, a bay
  with a pier and marina, landmarks with real signage.
- **Drive** — four vehicle types, drift handling, police chases,
  roadblocks at four stars, a helicopter air unit with a searchlight.
- **Fight** — pistol, shotgun and SMG (unlocked through the story),
  enemy crews, hitscan shooting, reloads.
- **Live** — a three-station procedural radio (all synthesized),
  a Dynamic Crime System (carjacking, ATM robbery, pursuit) with
  interventions, taxi fares, street races, hidden packages.
- **Systems** — day/night cycle (240s), wanted heat with hidden
  decay and safehouse cooldown, garage (buy/sell/select), localStorage
  saves, a diegetic HUD with a live minimap.

## Play

```sh
node serve.ts --port 8321
# open http://127.0.0.1:8321/
```

Controls: WASD move/drive, Shift sprint, C crouch, E talk, F enter
car / punch, G shoot, R reload, T taxi, 1/2/3 weapons, Q radio,
Esc pause.

## Screenshots

Four staged scenes via `?shot=` (seed 11): `showcase`, `heli`,
`combat`, `garage`. See `shots.json`.

## Dossier

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Files

| File | What it is |
| --- | --- |
| `game/src/main.js` | Boot, game loop, `window.__solmar` API |
| `game/src/tuning.js` | Constants: city, landmarks, vehicles, weapons, missions |
| `game/src/city.js` | City layout, collision, day/night clock |
| `game/src/scene.js` | three.js renderer, landmarks, sky |
| `game/src/hud.js` | HUD, minimap, menus |
| `game/src/onfoot.js` | On-foot movement, enter/exit, talk |
| `game/src/drive.js` | Vehicle physics |
| `game/src/traffic.js` | Ambient traffic + pedestrians |
| `game/src/police.js` | Wanted stars, pursuit, roadblocks, bust |
| `game/src/helicopter.js` | Air unit + searchlight |
| `game/src/radio.js` | Procedural radio stations |
| `game/src/garage.js` | Buy/sell/select, safehouse |
| `game/src/crime.js` | Dynamic Crime System |
| `game/src/combat.js` | Weapons, enemies, shooting |
| `game/src/missions.js` | 12-mission story state machine |
| `game/src/side.js` | Taxi, races, collectibles |
| `game/src/persist.js` | localStorage save/load |
| `game/src/effects.js` | Particles, flashes, skid marks |
| `game/src/shots.js` | `?shot=` scene staging |
| `game/src/rng.js` | Seeded RNG |
| `game/src/input.js` | Keyboard/mouse state |
| `game/src/audio.js` | Synthesized SFX + engine |
