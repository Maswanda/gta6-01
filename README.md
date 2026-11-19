# Solmar Bay: Heatwave

[![Make.fun GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Maswanda/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Maswanda/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game built for the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01) on make.fun.

## The game (v4)

Solmar Bay: Heatwave is a 3D open-world crime game (three.js) set in the sun-soaked coastal city of Solmar Bay. Drive and steal cars, dodge traffic and pedestrians, climb the wanted ladder as the police respond — at four stars a helicopter lifts off and pins you in its searchlight — and run a chain of twelve missions to make your name, ending with the Last Run at the pier.

- Four districts — Downtown, Old Town, Northside and the Marina — with a pier, lighthouse, ferris wheel, Solmar Tower and clock tower
- A full day/night cycle (240s): the sun sets, street lamps and neon come on, windows glow, and the Marina and casino read differently after dark
- Dynamic crime: carjackings, police pursuits and ATM robberies break out on their own; stop them for cash, or rob the ATM yourself (+$250, +2 wanted)
- Open world on foot and by car, with AI traffic (20 cars) and 28 pedestrians who scatter when a crime breaks out
- Four drivable vehicle types — sedan, sports car, van, truck — all stealable, each with its own handling, plus drift on hard turns and a police chase that loses your trail when you hide (crouch with C)
- Wanted level 0–5 with police that escalate: faster interceptors and roadblocks laid ahead of your escape route at 4 stars
- Twelve chained story missions, plus three side activities: taxi fares (night-shift bonus, +$25 in a garage car), 10 hidden Solmar coins, and a checkpoint street race
- A PD helicopter at 4–5 stars: it orbits, pins you in a searchlight cone (hiding stops working under the beam), kicks up rotor wash and scatters pedestrians — lose it by breaking the beam, reaching the safehouse, or shooting it down
- Three procedural radio stations (V to cycle) — Sunset Drive, Heatwave Rock and Night Jazz — all synthesized live with the Web Audio API, station name in the HUD
- Rico's garage (B at the garage): buy, sell and choose five cars including the garage-only Sunset GT muscle car, with a daily deal; owned cars persist in the save, and the safehouse next door heals you and cools one wanted star every ten seconds
- Three weapons (pistol, shotgun, SMG) and two enemy kinds (brawlers and shooters)
- HUD with a bigger minimap (district names, collectible and race markers, red crime blips), a mission tracker (M), stamina, a district readout, a day/night clock and a crime indicator
- Synthesized audio (engine, sirens, horn, skid, cash register, ambient pad); no network requests — everything runs from static files

## Play

Open `game/index.html` in a desktop browser (or run `node serve.ts` and visit http://localhost:8080). Keyboard + mouse.

## Entry

Built for [make.fun — Make GTA 6 (gta6-01)](https://make.fun/bounty/gta6-01).
