// Esegue gli scenari di validazione e scrive VALIDAZIONE.md.
// Uso: npm run validazione -- [repliche] [nSim] [idScenario...]
// I risultati di ogni scenario sono salvati in scripts/.cache, così si può procedere a blocchi.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SCENARI, eseguiScenario, type Riepilogo } from '../src/motore/validazione';

const repliche = Number(process.argv[2] ?? 500);
const nSim = Number(process.argv[3] ?? 1000);
const filtro = process.argv.slice(4);
const cache = new URL('./.cache/', import.meta.url);
mkdirSync(cache, { recursive: true });
const fileDi = (id: string): URL => new URL(`${id}-${repliche}-${nSim}.json`, cache);
const pc = (x: number): string => (Number.isFinite(x) ? `${Math.round(x * 100)}%` : '—');
const pcs = (x: number): string => (Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${Math.round(x * 100)}%` : '—');

for (const def of SCENARI) {
  if (filtro.length ? !filtro.includes(def.id) : existsSync(fileDi(def.id))) continue;
  const t0 = Date.now();
  const r = eseguiScenario(def, repliche, nSim, 1);
  writeFileSync(fileDi(def.id), JSON.stringify(r));
  const m = r.metriche;
  console.log(
    `${r.id.padEnd(5)} ${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s  sess ${pc(m.sessioni.cop80)}/${pc(m.sessioni.cop95)} (${pcs(m.sessioni.errore)})  eventi ${pc(m.eventi.cop80)}/${pc(m.eventi.cop95)}  trans ${pc(m.transazioni.cop80)}/${pc(m.transazioni.cop95)} (${pcs(m.transazioni.errore)})  entrate ${pc(m.entrate.cop80)}/${pc(m.entrate.cop95)}  utenti ${pc(m.utentiPeriodo.cop80)}/${pc(m.utentiPeriodo.cop95)}`,
  );
}

const esiti: Riepilogo[] = SCENARI.filter((d) => existsSync(fileDi(d.id))).map((d) => JSON.parse(readFileSync(fileDi(d.id), 'utf8')));
const riga = (r: Riepilogo): string => {
  const m = r.metriche;
  const c = (k: keyof typeof m): string => `${pc(m[k].cop80)} / ${pc(m[k].cop95)}`;
  return `| ${r.id} | ${r.nome} | ${c('sessioni')} | ${c('utentiGiorno')} | ${c('eventi')} | ${c('transazioni')} | ${c('entrate')} | ${c('utentiPeriodo')} | ${pc(r.canali.sessioni.cop80)} / ${pc(r.canali.sessioni.cop95)} | ${pc(r.canali.transazioni.cop80)} / ${pc(r.canali.transazioni.cop95)} |`;
};
const rigaErr = (r: Riepilogo): string => {
  const m = r.metriche;
  const c = (k: keyof typeof m): string => `${pcs(m[k].errore)} (±${pc(m[k].ampiezza95 / 2)})`;
  return `| ${r.id} | ${c('sessioni')} | ${c('eventi')} | ${c('transazioni')} | ${c('entrate')} |`;
};
const intest =
  '| # | Scenario | Sessioni | Utenti-giorno | Eventi chiave | Transazioni | Entrate | Utenti periodo | Canali: sessioni | Canali: transazioni |\n|---|---|---|---|---|---|---|---|---|---|';
const tab = (tipo: string): string => esiti.filter((r) => r.tipo === tipo).map(riga).join('\n');
const md = `# Risultati della validazione

Generato da \`npm run validazione\` — ${repliche} repliche per scenario, ${nSim} simulazioni per stima.
Ogni cella riporta la **copertura degli intervalli 80% / 95%**: la percentuale di repliche in cui il
valore vero (noto, perché i dati sono sintetici) cade dentro l'intervallo. Con ${repliche} repliche il margine
d'errore è circa ±${Math.round(196 * Math.sqrt((0.8 * 0.2) / repliche))} punti sull'80% e ±${Math.round(196 * Math.sqrt((0.95 * 0.05) / repliche))} sul 95%.

## A — Calibrazione: i parametri veri seguono le ipotesi (la copertura deve tornare)

${intest}
${tab('A')}

## B — Robustezza: ipotesi violate (si misura il danno)

${intest}
${tab('B')}

## Errore della stima centrale

Errore relativo mediano della stima centrale sul totale; tra parentesi la semi-ampiezza relativa mediana dell'intervallo 95%.

| # | Sessioni | Eventi chiave | Transazioni | Entrate |
|---|---|---|---|---|
${esiti.map(rigaErr).join('\n')}
`;
writeFileSync(new URL('../VALIDAZIONE.md', import.meta.url), md);
// Gli stessi risultati, in forma di dati, per la pagina Validazione del sito.
writeFileSync(new URL('../src/data/validazione.json', import.meta.url), JSON.stringify({ repliche, nSim, scenari: esiti.map(({ nome, ...r }) => r) }, null, 1) + '\n');
console.log(`Scritto VALIDAZIONE.md (${esiti.length} scenari su ${SCENARI.length})`);
