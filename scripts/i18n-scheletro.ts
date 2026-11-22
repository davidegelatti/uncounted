// Allinea en.json a it.json: stesse chiavi, valori vuoti dove manca la traduzione, traduzioni esistenti conservate.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const it = JSON.parse(readFileSync(new URL('../src/i18n/it.json', import.meta.url), 'utf8'));
const percorso = new URL('../src/i18n/en.json', import.meta.url);
const en = existsSync(percorso) ? JSON.parse(readFileSync(percorso, 'utf8')) : {};
let vuote = 0;
const allinea = (a: Record<string, unknown>, b: Record<string, unknown> | undefined): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(a)) {
    if (typeof v === 'string') {
      const esistente = b && typeof b[k] === 'string' ? (b[k] as string) : '';
      if (!esistente) vuote++;
      out[k] = esistente;
    } else out[k] = allinea(v as Record<string, unknown>, b?.[k] as Record<string, unknown> | undefined);
  }
  return out;
};
writeFileSync(percorso, JSON.stringify(allinea(it, en), null, 2) + '\n');
console.log(`en.json allineato: ${vuote} chiavi ancora da tradurre.`);
