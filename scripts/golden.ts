// Rigenera l'istantanea di regressione. Da usare SOLO se si decide consapevolmente di cambiare il motore.
import { writeFileSync } from 'node:fs';
import { stima } from '../src/motore/modello';
import { configurazioniGolden, datiGolden, senzaEcommerce } from '../tests/golden/configurazioni';

const { dati, ordini, entrate } = datiGolden();
const out: Record<string, unknown> = {};
for (const [nome, { cfg, senzaEcommerce: se }] of Object.entries(configurazioniGolden(ordini, entrate))) {
  const r = stima(se ? senzaEcommerce(dati) : dati, cfg) as unknown as Record<string, unknown>;
  const { avvisi, ...numeri } = r;
  out[nome] = { numeri, nAvvisi: (avvisi as unknown[]).length };
}
writeFileSync(new URL('../tests/golden/motore.json', import.meta.url), JSON.stringify(out));
console.log('Istantanea scritta:', Object.keys(out).join(', '));
