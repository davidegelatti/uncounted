// Controlli sul sito costruito (cartella dist/): eseguire prima `npm run build` (lo fa `npm test`).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ANCORE } from '../src/i18n/ancore';
import { LINGUE } from '../src/i18n/indice';
import { PAGINE, PERCORSI, indirizzo } from '../src/i18n/percorsi';

const DIST = 'dist';
const tutti = (dir: string, out: string[] = []): string[] => {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) tutti(p, out);
    else out.push(p);
  }
  return out;
};
const pagina = (lingua: 'it' | 'en', chiave: (typeof PAGINE)[number]): string => readFileSync(join(DIST, lingua, PERCORSI[lingua][chiave], 'index.html'), 'utf8');

describe.skipIf(!existsSync(DIST))('sito costruito', () => {
  const html = existsSync(DIST) ? tutti(DIST).filter((p) => p.endsWith('.html')) : [];

  it('ogni pagina esiste in italiano e in inglese', () => {
    for (const l of LINGUE) for (const p of PAGINE) expect(existsSync(join(DIST, l, PERCORSI[l][p], 'index.html')), `${l}/${p}`).toBe(true);
    expect(existsSync(join(DIST, 'index.html'))).toBe(true);
    expect(existsSync(join(DIST, '404.html'))).toBe(true);
    expect(existsSync(join(DIST, '_headers'))).toBe(true);
  });

  it('CSP: nessuno script o stile in linea, nessun attributo style', () => {
    for (const p of html) {
      const t = readFileSync(p, 'utf8');
      const script = [...t.matchAll(/<script\b([^>]*)>/g)].filter((m) => !/\bsrc=/.test(m[1]) && !/application\/ld\+json/.test(m[1]));
      expect(script.length, `${p}: script in linea`).toBe(0);
      expect(/<style\b/.test(t), `${p}: <style>`).toBe(false);
      expect(/\sstyle=/.test(t), `${p}: attributo style`).toBe(false);
      expect(/\son[a-z]+=/.test(t), `${p}: gestore di eventi in linea`).toBe(false);
    }
  });

  it('nessuna risorsa caricata da altri siti', () => {
    for (const p of html) {
      const t = readFileSync(p, 'utf8');
      const risorse = [...t.matchAll(/<(?:script|img|iframe|source|video|audio)\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
      for (const m of t.matchAll(/<link\b([^>]*)>/g)) {
        if (/rel="(stylesheet|icon|preload|modulepreload|manifest)"/.test(m[1])) risorse.push(/href="([^"]+)"/.exec(m[1])![1]);
      }
      for (const r of risorse) expect(/^(https?:)?\/\//.test(r), `${p}: ${r}`).toBe(false);
    }
    for (const p of tutti(DIST).filter((x) => x.endsWith('.css'))) {
      for (const m of readFileSync(p, 'utf8').matchAll(/url\(([^)]+)\)/g)) expect(/^['"]?(https?:)?\/\//.test(m[1]), `${p}: ${m[1]}`).toBe(false);
    }
    for (const p of tutti(DIST).filter((x) => x.endsWith('.js'))) {
      const t = readFileSync(p, 'utf8');
      for (const vietato of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket(', 'EventSource(']) expect(t.includes(vietato), `${p}: ${vietato}`).toBe(false);
    }
  });

  it('lingua, canonical e hreflang reciproci su ogni pagina', () => {
    for (const l of LINGUE) {
      for (const p of PAGINE) {
        const t = pagina(l, p);
        expect(t).toContain(`<html lang="${l}"`);
        expect(t).toMatch(new RegExp(`<link rel="canonical" href="[^"]*${indirizzo(l, p)}"`));
        for (const altra of LINGUE) expect(t, `${l}/${p} → ${altra}`).toMatch(new RegExp(`<link rel="alternate" hreflang="${altra}" href="[^"]*${indirizzo(altra, p)}"`));
        expect(t).toMatch(/hreflang="x-default"/);
        expect(t).toMatch(/<title>[^<]{5,}<\/title>/);
        expect(t).toMatch(/<meta name="description" content="[^"]{20,}"/);
      }
    }
  });

  it('ogni ancora del registro esiste nella sua pagina, in entrambe le lingue', () => {
    for (const [nome, [p, id]] of Object.entries(ANCORE)) {
      for (const l of LINGUE) expect(pagina(l, p).includes(`id="${id}"`), `${nome}: #${id} in ${l}/${p}`).toBe(true);
    }
  });

  it('lo Stimatore sta in /it/stimatore/ e /en/estimator/, con hreflang e mappa del sito coerenti', () => {
    expect(indirizzo('it', 'strumento')).toBe('/it/stimatore/');
    expect(indirizzo('en', 'strumento')).toBe('/en/estimator/');
    const it_ = pagina('it', 'strumento');
    expect(it_).toContain('hreflang="en" href="https://uncounted.davidegelatti.com/en/estimator/"');
    expect(it_).toContain('rel="canonical" href="https://uncounted.davidegelatti.com/it/stimatore/"');
    const mappa = readFileSync(join(DIST, 'sitemap-0.xml'), 'utf8');
    expect(mappa).toContain('/it/stimatore/');
    expect(mappa).toContain('/en/estimator/');
    // nessun collegamento ai vecchi indirizzi
    for (const p of html) expect(/\/it\/strumento\/|\/en\/tool\//.test(readFileSync(p, 'utf8')), p).toBe(false);
  });

  it('gli header di sicurezza vietano le connessioni esterne', () => {
    const h = readFileSync(join(DIST, '_headers'), 'utf8');
    expect(h).toContain("default-src 'none'");
    expect(h).toContain("connect-src 'none'");
    expect(h).toContain("script-src 'self'");
    expect(h).toContain("style-src 'self'");
  });
});
