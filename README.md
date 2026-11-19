# Solmar Bay: Heatwave

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Maswanda/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Maswanda/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A GTA-style open-world crime game set in Solmar Bay — built for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). Drive, fight, hide, and run the full 12-mission story from street nobody to the last run that owns the bay.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

100% self-contained: three.js is vendored under `game/vendor`, all audio is synthesized with WebAudio, no network requests, no CDN. Node 22, standard library only for the tooling.

## The story (12 missions)

1. **Meet Mara** — say hello at the pier
2. **Wheels** — get a car, drive to the garage
3. **The Pickup** — warehouse package to the bar
4. **Dockside Trouble** — clear the dockside crew (unlocks the shotgun)
5. **The Clock Tower** — meet Ivy, then the marina
6. **The Sports Car** — take the sports car to the garage
7. **Street Race** — four checkpoints across the city
8. **Warehouse War** — take back the warehouse (unlocks the SMG)
9. **The Bank Job** — rob the bank with Rico, lay low at the safehouse
10. **The Marina Heist** — the casino vault, then get home
11. **Air Support** — lose the helicopter, lose the heat
12. **The Last Run** — the ledger to the pier, then home

## Systems

- **Helicopter AI** (`game/src/helicopter.js`) — lifts off at 4 stars, hunts your last known spot with a spotlight; while the light is on you, the heat never cools. Gunfire brings it down.
- **Radio** (`game/src/radio.js`) — three procedural WebAudio stations (SOLMAR 88.5, BAY 101, PALM 96.3); the station name is on the HUD in every frame.
- **Garage** (`game/src/garage.js`) — buy, sell and select vehicles with cash; owned cars persist in the save.
- **Safehouse** — rest there to heal and cool one star at a time.
- **Dynamic crime** (`game/src/crime.js`) — carjackings, ATM robberies and pursuits happen around you; ramming the stolen car or punching the thief pays.
- **ATM robbery, day/night cycle, drift physics, 5-star wanted with roadblocks, hidden wanted decay** (crouch out of sight and the heat fades faster).
- **Side activities** — taxi fares, street races, hidden packages.
- **Save system** — cash, mission progress, weapons, garage and side results persist in localStorage.

## Controls

WASD move / drive · E talk / enter / exit · F punch · G shoot · R reload · 1-3 radio stations · Q cycle radio · C crouch

## Screenshots (dossier: shot → proof)

- `1-showcase.jpg` — the world: marina road, sedan, radio SOLMAR 88.5, minimap + objective (`game/src/scene.js`, `game/src/hud.js`)
- `2-heli.jpg` — 5-star helicopter pursuit, spotlight on the sports car (`game/src/helicopter.js` `spawn`, `game/src/police.js` roadblocks)
- `3-combat.jpg` — Dockside Trouble firefight, pistol out (`game/src/combat.js` `shoot`)
- `4-garage.jpg` — garage progression: owned sedan + muscle, cash + save (`game/src/garage.js` `buy`/`select`)

## Layout

- `game/index.html` — page, import map, HUD shell
- `game/src/main.js` — orchestrator, game loop, `window.__solmar` test API, autopilot
- `game/src/city.js` — roads, buildings, collision, day/night
- `game/src/scene.js` — three.js rendering
- `game/src/missions.js` — the 12-mission state machine
- `game/src/police.js` — wanted response, rams, decay
- `game/src/combat.js` — weapons, enemies
- `game/src/crime.js` — dynamic crime events
- `game/src/drive.js` — car physics, drift
- `game/src/onfoot.js` — on-foot movement
- `game/src/side.js` — taxi, race, collectibles
- `game/src/traffic.js` — ambient traffic
- `game/src/radio.js` / `game/src/audio.js` — stations + procedural sound
- `game/src/persist.js` — save / load
- `game/src/shots.js` — `?shot=` screenshot setups
- `game/src/hud.js` — minimap, stars, cash, radio, objective
- `game/src/effects.js` — muzzle flashes, puffs
- `game/src/tuning.js` — every balance number in one place
- `game/src/rng.js` — seeded RNG (`?seed=11` is deterministic)
- `main.ts` — copies `game/` + `screenshots/` to `/output` with `dossier.json`
- `serve.ts` — tiny static server for local play

## License

MIT — see `LICENSE`.
