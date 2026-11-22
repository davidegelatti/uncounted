// Dati di esempio (finti) dello Stimatore: lo stesso export usato dal tour, dal CSV scaricabile e dalla vetrina della home.
// Il CSV imita esattamente il formato reale di un export GA4 in formato libero (interfaccia in italiano: intestazioni,
// righe di commento, riga dei totali con l'etichetta in una colonna in più, numeri con il punto decimale e senza
// separatore delle migliaia, nessuna virgoletta, righe assenti quando un canale non ha traffico in un giorno).
import type { Dati } from '../motore/modello';
import type { Lingua, Traduci } from '../i18n/indice';
import { Rng } from '../motore/rng';
import { genera, scenarioBase } from '../motore/sintetico';

/** Numero come lo scrive GA4 nell'export: punto decimale, al più due decimali, niente zeri finali né separatori. */
const numeroGa4 = (x: number): string => String(Number(x.toFixed(2)));

export function csvFormatoGa4(
  dati: Dati,
  testi: { proprieta: string; esplorazione: string; intestazioni: string; totale: string },
  utentiTotali: number,
): string {
  const righe = dati.righe.filter((r) => r.sessioni > 0);
  const d0 = righe[0]?.data.replaceAll('-', '') ?? '';
  const d1 = righe[righe.length - 1]?.data.replaceAll('-', '') ?? '';
  const tot = righe.reduce((a, r) => [a[0] + r.sessioni, a[1] + r.eventi, a[2] + r.transazioni, a[3] + r.entrate], [0, 0, 0, 0]);
  const out = [
    '# ----------------------------------------',
    `# ${testi.proprieta}`,
    `# ${testi.esplorazione}`,
    `# ${d0}-${d1}`,
    '# ----------------------------------------',
    '',
    testi.intestazioni,
    `,,${tot[0]},${utentiTotali},${tot[1]},${tot[2]},${numeroGa4(tot[3])},${testi.totale}`,
  ];
  for (const r of righe) out.push([r.data.replaceAll('-', ''), r.canale, r.sessioni, r.utenti, r.eventi, r.transazioni, numeroGa4(r.entrate)].join(','));
  return out.join('\n') + '\n';
}

export function esempioCsv(t: Traduci, _lingua: Lingua): { testo: string; ordini: number; entrate: number } {
  const sc = { ...scenarioBase(), giorni: 35, sessioniAttese: 60000, giorniPromo: [19, 20], altrePerdite: 0.09 };
  sc.canali.forEach((can, i) => (can.delta = [0.1, 0.5, -0.1, -0.5, 0.6, 0.2, -0.3, -0.6][i]));
  // canali che GA4 riporta anche in esportazioni reali, con poco traffico (righe assenti nei giorni senza visite)
  sc.canali.push(
    { nome: 'Organic Shopping', quota: 0.012, cr: 0.02, tassoEventi: 0.04, aov: 74, delta: 0 },
    { nome: 'Unassigned', quota: 0.004, cr: 0.004, tassoEventi: 0.01, aov: 60, delta: 0 },
  );
  const e = genera(sc, new Rng(2026));
  const testo = csvFormatoGa4(
    e.dati,
    { proprieta: t('csvEsempio.titolo'), esplorazione: t('csvEsempio.esplorazione'), intestazioni: t('csvEsempio.intestazioni'), totale: t('csvEsempio.totale') },
    e.utentiPeriodoOsservati,
  );
  return { testo, ordini: e.gestionale.ordini, entrate: Math.round(e.gestionale.entrate) };
}

/** Le risposte che il tour dichiara «dell'esempio». */
export const RISPOSTE_ESEMPIO = { origine: 'esempio', cm: 'basic', tasso: '60', precisione: 'stima', misura: 'utente', ignora: 'incluso' } as const;
