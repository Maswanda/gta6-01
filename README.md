# Solmar Bay: Heatwave — Make GTA 6 (gta6-01)

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Maswanda/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Maswanda/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game in one self-contained web app: drive, fight, rob, and survive
12 story missions across 4 districts of Solmar Bay. No CDN, no network requests —
three.js is vendored under `game/vendor/three/`, all audio is procedural Web Audio.
Play it: `node serve.ts`, then open http://localhost:8080. See the bounty at
https://make.fun/bounty/gta6-01.

## The game

- **12 story missions** (`game/src/missions.js`, chained by explicit `nextIndex`;
  mission 12 `nextIndex: null` ends the story): Meet Mara, Hot Wheels, First Blood,
  Cash Run, The Getaway, Rico's Ride, Bay Kings Turf, Midnight Delivery, Heat Wave,
  The Marina Heist, **Air Support** (mission 11), **The Last Run** (mission 12).
- **Helicopter AI** (`game/src/helicopter.js`): spawns at 4–5 wanted stars, orbits with
  a searchlight cone; escape at the safehouse or by breaking line of sight. Its
  spotlight pins you: no hidden wanted decay while it is lit.
- **Radio** (`game/src/radio.js`): 3 procedural stations (SOLMAR 88.5, BAY 101,
  VICE FM 99.9), switchable with R, station name in the HUD every frame.
- **Garage + safehouse** (`game/src/garage.js`): buy/sell 4 vehicle types with cash,
  owned vehicles persist in the save; the safehouse heals and clears a wanted star.
- **Dynamic Crime System + ATM rob** (`game/src/crime.js`): street crimes to answer
  (carjacking, ATM robbery, pursuit), ATM robbery (range 3, 60 s cooldown per ATM,
  robAtm skips ATMs on cooldown).
- **Police Chase 2.0** (`game/src/police.js`): wanted 0–5, pursuit cars that ram,
  roadblocks at 4+ stars, bust/wasted respawn (missions never fail). Hidden decay
  (14 s crouched and far away) vs normal decay (26 s).
- **City** (`game/src/city.js`): 4 districts (Marina, Vice Beach, Downtown,
  Little Havana), road grid, seeded buildings, landmarks, 8 ATMs, day/night cycle
  (240 s/day, `game/src/scene.js`).
- **Combat** (`game/src/combat.js`): pistol / shotgun / SMG, 2 enemy types
  (Bay King, Bay King Enforcer). Enemy bullets damage the *car* when the player
  is inside one — never the player.
- **Traffic + peds** (`game/src/traffic.js`): 12 ambient cars, 28 wandering peds.
- **Save** (`game/src/persist.js`): localStorage — cash, mission, weapons, owned
  vehicles, side results.
- **Side activities** (`game/src/side.js`): taxi fares (T), time trial (Y),
  8 collectible packages.
- **Diegetic HUD** (`game/src/hud.js`): minimap with objective/police/heli markers,
  wanted stars, cash, HP/armor, district, radio station, objective, keybinds.
- **Autopilot** (`game/src/main.js`): `?autopilot=1&timescale=8` drives the full
  12-mission story by itself and reports `window.__PLAYTEST__`.

## Screenshots (each proves a different system)

| Shot | What it proves | Code behind it |
| --- | --- | --- |
| 1-showcase.jpg | World showcase: Marina daytime, mission 1, full HUD | `scene.js` buildStatic, `hud.js` |
| 2-heli.jpg | 5-star helicopter pursuit at night, Vice Beach | `helicopter.js` Helicopter |
| 3-combat.jpg | Mission + combat: vault guards, shotgun | `combat.js` fire, `missions.js` |
| 4-garage.jpg | Garage / progression: Rico's Garage, 3 rides to pick | `garage.js` buyVehicle / selectVehicle |

## Controls

WASD drive/walk · Space drift · F enter/exit car / punch · E talk/rob ATM · G fire ·
R reload (empty mag) or radio cycle · 1/2/3 weapons · T taxi · Y time trial · P pause

## Architecture

2D simulation on the x/z plane (`tuning.js` constants, `city.js` geometry,
`drive.js` arcade car physics, `onfoot.js`), drawn in 3D by `scene.js`
(three.js, chase camera, day/night sun + sky). `main.js` boots the world, runs the
fixed 1/60 s loop, and hosts the autopilot (`?autopilot=1&timescale=8`) used by the
playtest harness — it drives to objectives, fights, robs, and recovers (teleports
near the objective) when stuck, so all 12 missions complete with 0 console errors.
`shots.js` stages the four `?shot=` scenes from real game state.
