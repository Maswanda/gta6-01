// serve.ts — Solmar Bay: Heatwave v4, the local static server.
//
// Serves game/ over HTTP so the game can be played and playtested in
// a browser. Usage:
//   node serve.ts --port 8321
// then open http://127.0.0.1:8321/ (or /?shot=showcase&seed=11 for a
// staged screenshot scene). Node's standard library only; the game
// itself makes no network requests of its own.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const gameDir = join(repoRoot, 'game');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
};

const args = process.argv.slice(2);
const portFlag = args.indexOf('--port');
const port = portFlag >= 0 ? Number(args[portFlag + 1]) : 8321;
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error('serve.ts: --port must be a port number');
  process.exit(1);
}

const server = createServer((req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    let path = decodeURIComponent(url.pathname);
    if (path === '/') path = '/index.html';
    const file = join(gameDir, path);
    if (!file.startsWith(gameDir) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('server error');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Solmar Bay serving game/ at http://127.0.0.1:${port}/`);
});
