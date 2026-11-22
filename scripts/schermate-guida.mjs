// Genera le schermate dello Stimatore usate nella Guida (tema chiaro, dati di esempio), in italiano e in inglese:
//   src/assets/guida/stimatore-menu-it.png e stimatore-menu-en.png (la colonna di sinistra con le quattro sezioni).
// Serve Google Chrome installato e il sito costruito servito in locale:
//   npm run build && node scripts/servi-dist.mjs     (in un altro terminale)
//   node scripts/schermate-guida.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE ?? 'http://127.0.0.1:4188';
const PORTA = 9361;
const attendi = (ms) => new Promise((r) => setTimeout(r, ms));
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORTA}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cdp-'))}`, 'about:blank'], { stdio: 'ignore' });
let info;
for (let i = 0; i < 50 && !info?.length; i++) {
  try { info = await (await fetch(`http://127.0.0.1:${PORTA}/json/list`)).json(); } catch { await attendi(200); }
}
const ws = new WebSocket(info.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const attese = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && attese.has(m.id)) { attese.get(m.id)(m); attese.delete(m.id); } });
const cmd = (method, params = {}) => new Promise((r) => { const n = ++id; attese.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const valuta = async (expr) => (await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.result.value;

await cmd('Page.enable');
await cmd('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
// finestra alta: la colonna di sinistra (alta quanto la finestra) mostra tutte e quattro le sezioni senza scorrere
await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 2600, deviceScaleFactor: 1.5, mobile: false });
for (const [lingua, pagina] of [['it', 'stimatore'], ['en', 'estimator']]) {
  await cmd('Page.navigate', { url: `${BASE}/${lingua}/${pagina}/#tour` });
  await attendi(5000);
  await valuta(`document.querySelector('[data-a=tour-esci]')?.click(); true`);
  await attendi(1500);
  const r = await valuta(`(() => { const c = document.getElementById('st-colonna'); c.scrollTop = 0; const b = c.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: Math.min(c.scrollHeight, b.height) }; })()`);
  const foto = await cmd('Page.captureScreenshot', { format: 'png', clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 } });
  writeFileSync(`src/assets/guida/stimatore-menu-${lingua}.png`, Buffer.from(foto.result.data, 'base64'));
  console.log(`src/assets/guida/stimatore-menu-${lingua}.png  ${Math.round(r.w)}×${Math.round(r.h)} px (×1,5)`);
}
ws.close();
proc.kill();
process.exit(0);
