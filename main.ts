// Solmar Bay: Heatwave v4 — the entry program (Node 22, standard library only).
// The game is this directory's game/ folder: plain static files a desktop
// browser loads offline (game/index.html, its ES modules and the vendored
// three.js build — no network request anywhere), plus 4 screenshots of the
// game itself. This program hands it in: it copies game/ and screenshots/
// from beside this file to /output and writes /output/dossier.json, the
// summary the judge reads, with the vendored make.fun library. v4's game is
// bigger — twelve story missions including the Marina Heist and the Last
// Run, a PD helicopter, a procedural radio, Rico's garage and the safehouse,
// a dynamic crime system, a day/night cycle, drift and a police chase that
// loses the trail, three side activities, five vehicle types, three weapons
// and four districts — but the hand-in is the same shape.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// A quick sanity pass before copying: the entry is a playable game only if
// its page, its modules and its screenshots are all really there.
const index = join(here, 'game', 'index.html');
if (!existsSync(index) || statSync(index).size === 0) throw new Error('game/index.html is missing');
const shots = existsSync(join(here, 'screenshots')) ? readdirSync(join(here, 'screenshots')) : [];
if (shots.length < 3 || shots.length > 4) throw new Error(`expected 3 or 4 screenshots, found ${shots.length}`);

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`Solmar Bay v4 handed in: ${shots.length} screenshots, dossier written to ${join(out, 'dossier.json')}`);
