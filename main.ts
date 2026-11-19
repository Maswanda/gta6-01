// main.ts — Solmar Bay: Heatwave v4, the entrypoint.
//
// What it does: copies game/ and screenshots/ into the bundle
// directory, then writes dossier.json from the kit's buildDossier.
// Run it with MAKEFUN_OUTPUT_DIR set (or it writes to ./out):
//   MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The dossier is the entry the scorer reads: the Game block, the
// source files in import order (index.html, then the module scripts
// depth-first), and the four screenshots, the first by name the cover.
// Nothing here reads the network; the game itself is fully offline.
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR
  ? join(repoRoot, process.env.MAKEFUN_OUTPUT_DIR)
  : join(repoRoot, 'out');

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  }),
);
console.log(`dossier written: ${join(outDir, 'dossier.json')}`);
