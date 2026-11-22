import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { stima } from '../src/motore/modello';
import { configurazioniGolden, datiGolden, senzaEcommerce } from './golden/configurazioni';

// Il motore statistico non deve cambiare: stessi dati, stesse ipotesi, stesso seme → stessi numeri, cifra per cifra.
const golden = JSON.parse(readFileSync(new URL('./golden/motore.json', import.meta.url), 'utf8')) as Record<string, { numeri: unknown; nAvvisi: number }>;
const { dati, ordini, entrate } = datiGolden();

describe('regressione del motore (uguaglianza esatta con l’istantanea)', () => {
  for (const [nome, { cfg, senzaEcommerce: se }] of Object.entries(configurazioniGolden(ordini, entrate))) {
    it(nome, () => {
      const r = stima(se ? senzaEcommerce(dati) : dati, cfg) as unknown as Record<string, unknown>;
      const { avvisi, ...numeri } = r;
      expect(JSON.parse(JSON.stringify(numeri))).toEqual(golden[nome].numeri);
      expect((avvisi as unknown[]).length).toBe(golden[nome].nAvvisi);
    });
  }
});
