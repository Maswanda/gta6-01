# Solmar Bay: Heatwave — a GTA 6 fan game (v4)

An open-world crime game set in **Solmar Bay**, a 640×640 coastal city with
four districts — Marina, Downtown, Vice Beach, The Hills — built with
three.js (vendored, no CDN, no external assets) and the Web Audio API.
Everything runs offline from `game/`.

## Play

```
node serve.ts            # http://localhost:8080
```

## The story — 12 missions

1. **Welcome to Solmar** — reach the pier.
2. **First Wheels** — steal a sedan.
3. **The Drop** — pick up the package.
4. **Bay Kings** — clear the gang block.
5. **Getaway Driver** — deliver the goods in a car.
6. **Night Shift** — rob an ATM after dark.
7. **The Informant** — reach the informant.
8. **Hot Wheels** — steal a muscle car.
9. **The Vault** — hold the plaza for 60 seconds.
10. **Heatwave** — deliver under 4-star heat.
11. **Air Support** — shoot down the police helicopter.
12. **The Last Run** — the final delivery. $2,500.

Missions chain automatically. Getting busted or wasted restarts the
current mission from the safehouse (cash −10%).

## Systems

- **Wanted system** — 0–5 stars. Police cars, roadblocks (≥4 stars), foot
  cops (≥3 stars), and a helicopter with a spotlight (≥4 stars, retreats
  after 100 damage). A bust takes 3 seconds of continuous contact with an
  officer — break away and the timer resets.
- **Police Chase 2.0** — cop cars ram and PIT; spikes are avoided by
  drifting (Space = handbrake, grip ×0.35).
- **Helicopter AI** — cruises at 55 m, follows with a spotlight that
  freezes wanted decay, retreats at 100 damage (20 s cooldown).
- **Procedural radio** — 3 WebAudio stations (SOLMAR 88.5 chill 92 BPM,
  BAY 101 drive 128 BPM, MARINA 94.3 night 104 BPM). V switches station,
  M mutes.
- **Rico's Garage** — buy, sell and select cars (sedan / muscle / sport /
  van), a daily deal, and a safehouse that heals and clears wanted.
- **Dynamic Crime System** — random muggings, carjackings and shootouts;
  clear them for $150–$400. ATM robbery: 3 s channel, $250, +2 wanted,
  60 s cooldown per ATM.
- **Day/night cycle** — a 4-minute day; sun, sky, lamps and building
  windows follow the clock. Landmarks: Mercy Point Lighthouse, Solmar
  Tower, Vice Pier, Hills Observatory.
- **Traffic & pedestrians** — 14 traffic cars on the road grid, 28
  pedestrians on the sidewalks; clipping one at speed adds wanted.
- **Weapons** — pistol, SMG, shotgun; two enemy types (gang, guard);
  health/armor pickups and cash drops.
- **Save** — progress, cash, cars and weapons persist in localStorage
  (`solmar-bay-save-v4`).

## Controls

| Key | Action |
| --- | --- |
| WASD | move / drive |
| Shift | run |
| Space | handbrake (drift) / jump |
| E | enter car · exit car · rob ATM |
| F / click | shoot |
| V | next radio station |
| M | mute radio |
| G | garage (near it) · H safehouse (near it) |
| P / Esc | pause |
| Enter | start |

## Files

```
game/
  index.html            the page (importmap -> vendored three.js)
  index.css             HUD styling
  src/
    rng.js              seeded dice (mulberry32)
    tuning.js           every number the game runs on
    input.js            keyboard + mouse + touch
    audio.js            procedural WebAudio SFX
    radio.js            3 procedural music stations
    city.js             the 640x640 layout: roads, districts, ATMs
    scene.js            three.js world, lighting, day/night, camera
    hud.js              diegetic HUD: minimap, stars, cash, objective
    effects.js          muzzle flash, smoke, sparks, cash burst
    drive.js            arcade car physics, collisions, enter/exit
    traffic.js          14 traffic cars + 28 pedestrians
    onfoot.js           the player on foot
    combat.js           hitscan shooting, enemies, pickups
    police.js           wanted, cops, roadblocks, sirens
    helicopter.js       the police helicopter + spotlight
    garage.js           Rico's garage + safehouse
    crime.js            dynamic crime events + ATM robbery
    missions.js         the 12-mission story arc
    side.js             street races + courier jobs
    persist.js          localStorage save/load
    shots.js            the 4 staged screenshots (?shot=)
    main.js             bootstrap, game loop, autopilot
  vendor/three/         three.js r160 (vendored)
main.ts                 builds /output + dossier.json
serve.ts                local static server
shots.json              the 4 screenshot queries
screenshots/            1-showcase, 2-heli, 3-combat, 4-garage
```

## Playtest

Load with `?autopilot=1&timescale=4` — an autopilot drives the whole
story (all 12 missions) and reports progress in `window.__PLAYTEST__`.
Screenshots: `?shot=showcase|heli|combat|garage&seed=11`.

## License

MIT — see `LICENSE`. A fan-made game, not affiliated with Rockstar Games.
