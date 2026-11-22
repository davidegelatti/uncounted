// Contrasto dei colori del tema (WCAG AA: almeno 4,5:1 per il testo), in chiaro e in scuro.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/sito.css', 'utf8');
const gettoni = (blocco: string): Record<string, string> =>
  Object.fromEntries([...blocco.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,6})\b/g)].map((m) => [m[1], m[2].length === 4 ? '#' + [...m[2].slice(1)].map((c) => c + c).join('') : m[2]]));
const inizioScuro = css.indexOf('@media (prefers-color-scheme: dark)');
it('i colori di base dati dall’autore sono quelli previsti', () => {
  expect(gettoni(css.slice(0, css.indexOf('@media (prefers-color-scheme: dark)')))).toMatchObject({ sfondo: '#F1EEE7', testo: '#232323' });
});
const chiaro = gettoni(css.slice(0, inizioScuro));
const scuro = { ...chiaro, ...gettoni(css.slice(inizioScuro, css.indexOf('* { box-sizing'))) };

const luminanza = (h: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrasto = (a: string, b: string): number => {
  const [x, y] = [luminanza(a), luminanza(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
// testo → sfondo su cui compare
const COPPIE: [string, string][] = [
  ['testo', 'sfondo'], ['testo', 'sup'], ['testo', 'sup-2'], ['testo-2', 'sfondo'], ['testo-2', 'sup'], ['testo-2', 'sup-2'],
  ['blu', 'sup'], ['blu', 'sup-2'], ['blu', 'sfondo'], ['blu-testo', 'blu'],
  ['ambra', 'ambra-sf'], ['rosso', 'rosso-sf'], ['verde', 'verde-sf'], ['viola', 'viola-sf'], ['blu', 'blu-sf'], ['rosso', 'sup'],
  ['azione-testo', 'azione'], ['oss-testo', 'sfondo'], ['oss-testo', 'sup'], ['blu', 'sup-2'], ['rosso', 'sup-2'], ['ambra', 'sup'], ['viola', 'sup'], ['verde', 'sup'],
  ['testo', 'ambra-sf'], ['testo', 'rosso-sf'], ['testo', 'blu-sf'], ['testo', 'verde-sf'], ['testo', 'viola-sf'], ['testo-2', 'ambra-sf'], ['testo-2', 'rosso-sf'], ['testo-2', 'blu-sf'],
];

// elementi grafici (barre, segni) contro lo sfondo: WCAG 1.4.11, almeno 3:1
const GRAFICI: [string, string][] = [['oss', 'sfondo'], ['oss', 'sup'], ['serie', 'sfondo'], ['serie', 'sup'], ['testo-2', 'sfondo']];

describe('contrasto dei colori', () => {
  for (const [nome, tema] of [['chiaro', chiaro], ['scuro', scuro]] as const) {
    it(`tema ${nome}: barre e segni dei grafici almeno 3:1`, () => {
      const sotto = GRAFICI.map(([a, b]) => [a, b, contrasto(tema[a], tema[b])] as const).filter((x) => x[2] < 3).map((x) => `${x[0]} su ${x[1]}: ${x[2].toFixed(2)}`);
      expect(sotto).toEqual([]);
    });
    it(`tema ${nome}: tutte le coppie testo/sfondo almeno 4,5:1`, () => {
      const sotto = COPPIE.map(([a, b]) => [a, b, contrasto(tema[a], tema[b])] as const).filter((x) => x[2] < 4.5).map((x) => `${x[0]} su ${x[1]}: ${x[2].toFixed(2)}`);
      expect(sotto).toEqual([]);
    });
  }
});
