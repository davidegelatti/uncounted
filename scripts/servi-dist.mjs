// Serve dist/ applicando gli header di public/_headers: serve a provare in locale la CSP di produzione.
// Uso: npm run build && node scripts/servi-dist.mjs  → http://127.0.0.1:4188
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
// Blocchi «percorso + header rientrati», come in Cloudflare Pages; il percorso ammette un * finale.
const blocchi = [];
for (const l of readFileSync(join(dist, '_headers'), 'utf8').split('\n')) {
  if (!l.trim()) continue;
  if (!/^\s/.test(l)) blocchi.push({ percorso: l.trim(), header: {} });
  else {
    const i = l.indexOf(':');
    // upgrade-insecure-requests non ha senso su http://127.0.0.1
    blocchi.at(-1).header[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace('; upgrade-insecure-requests', '');
  }
}
const headerPer = (url) => Object.assign({}, ...blocchi.filter((b) => (b.percorso.endsWith('*') ? url.startsWith(b.percorso.slice(0, -1)) : url === b.percorso)).map((b) => b.header));
const tipi = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.xml': 'application/xml', '.json': 'application/json', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8' };
createServer((req, res) => {
  try {
    servi(req, res);
  } catch {
    // durante una nuova costruzione dist/ è vuota per un attimo: si risponde 503 invece di fermare il server
    if (!res.headersSent) res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '2' });
    res.end('Sito in costruzione: ricarica tra un attimo.');
  }
}).listen(4188, '127.0.0.1', () => console.log('http://127.0.0.1:4188'));

function servi(req, res) {
  let p = join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) {
    res.writeHead(404, { ...headerPer('/404'), 'Content-Type': tipi['.html'] });
    return res.end(readFileSync(join(dist, '404.html')));
  }
  res.writeHead(200, { ...headerPer(new URL(req.url, 'http://x').pathname), 'Content-Type': tipi[extname(p)] ?? 'application/octet-stream' });
  res.end(readFileSync(p));
}
