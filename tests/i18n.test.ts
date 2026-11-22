import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DIZIONARI } from '../src/i18n/indice';

const file = (dir: string, est: RegExp, out: string[] = []): string[] => {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) file(p, est, out);
    else if (est.test(n)) out.push(p);
  }
  return out;
};
const segnaposto = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('testi per lingua', () => {
  const it_ = DIZIONARI.it;
  const en = DIZIONARI.en;

  it('ogni chiave italiana esiste in inglese e viceversa', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(it_).sort());
  });
  it('nessun testo italiano è vuoto', () => {
    expect(Object.entries(it_).filter(([, v]) => v.trim() === '').map(([k]) => k)).toEqual([]);
  });
  it('le traduzioni inglesi presenti hanno gli stessi segnaposto dell’italiano', () => {
    const diversi = Object.keys(it_).filter((k) => en[k] && segnaposto(en[k]).join() !== segnaposto(it_[k]).join());
    expect(diversi).toEqual([]);
  });
  it('nessun testo inglese è vuoto', () => {
    expect(Object.entries(en).filter(([, v]) => v.trim() === '').map(([k]) => k)).toEqual([]);
  });

  it('ogni chiave usata nel codice esiste nel file italiano', () => {
    const mancanti = new Set<string>();
    for (const p of file('src', /\.(ts|astro|mdx)$/)) {
      const testo = readFileSync(p, 'utf8');
      // chiavi scritte per intero: t('a.b'), c.t('a.b'), plurale(t, 'a.b', …)
      for (const m of testo.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) if (!(m[1] in it_)) mancanti.add(`${p}: ${m[1]}`);
      for (const m of testo.matchAll(/plurale\([\w.]+,\s*'([a-zA-Z0-9_.]+)'/g)) {
        if (!(`${m[1]}_uno` in it_ && `${m[1]}_altri` in it_)) mancanti.add(`${p}: ${m[1]}_uno/_altri`);
      }
      // chiavi composte: t(`a.${x}`) → deve esistere almeno una chiave con quel prefisso
      for (const m of testo.matchAll(/\bt\(\s*`([a-zA-Z0-9_.]+)\$\{/g)) {
        if (!Object.keys(it_).some((k) => k.startsWith(m[1]))) mancanti.add(`${p}: ${m[1]}…`);
      }
    }
    expect([...mancanti]).toEqual([]);
  });

  it('nessuna frase scritta direttamente nel codice dello strumento', () => {
    const sospette: string[] = [];
    for (const p of file('src/strumento', /\.ts$/).concat(file('src/layouts', /\.astro$/), file('src/components', /\.astro$/))) {
      const sorgente = readFileSync(p, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
        .replace(/\s\/\/ .*$/gm, '');
      const parti = p.endsWith('.astro') ? [sorgente.replace(/^---[\s\S]*?---/, '')] : [...sorgente.matchAll(/`((?:[^`\\]|\\.)*)`/g)].map((m) => m[1]);
      for (const grezzo of parti) {
        const testo = grezzo
          .replace(/\$\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/g, ' ')
          .replace(/\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/g, ' ')
          .replace(/<script[\s\S]*?<\/script>/g, ' ')
          .replace(/<[^>]*>/g, ' ')
          // pezzi di marcatura rimasti spezzati dai modelli annidati
          .replace(/<[a-z][^>]*$/g, ' ')
          .replace(/^[^<>]*>/g, ' ')
          .replace(/&\w+;/g, ' ');
        // due parole di fila di almeno tre lettere = una frase
        const m = testo.match(/[A-Za-zÀ-ÿ]{3,}\s+[A-Za-zÀ-ÿ]{3,}/);
        if (m) sospette.push(`${p}: «${m[0]}»`);
      }
    }
    expect(sospette).toEqual([]);
  });
});
