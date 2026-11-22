// Vetrina della home: i veri componenti dei risultati, calcolati al momento della costruzione del sito
// sui dati di esempio dello strumento (stesse risposte del tour). Niente schermate: HTML nitido, nel tema
// corrente, tradotto. Gli elementi interattivi dello strumento (pulsanti d'aiuto, menu) sono tolti.
import { traduttore, type Lingua } from '../i18n/indice';
import { formati } from '../i18n/formato';
import { stima } from '../motore/modello';
import { leggiCsv } from '../parser';
import { RISPOSTE_ESEMPIO, esempioCsv } from '../strumento/esempio';
import { csvRisultati } from '../strumento/esporta';
import { componiEsito } from '../strumento/esito';
import { graficoCanali } from '../strumento/grafici';
import { configurazione, datiDaStimare, ipotesi, statoIniziale } from '../strumento/stato';
import type { Contesto } from '../strumento/vistaIngressi';
import { barraIncertezza, eroe, graficoSolidita, legenda } from '../strumento/vistaRisultati';

export interface Vetrina {
  eroe: string;
  canali: string;
  solidita: string;
  csv: string[];
}

const cache = new Map<Lingua, Vetrina>();

/** Abbassa di un livello i titoli (nella home i componenti stanno sotto un h3) e toglie gli id duplicabili. */
const adatta = (html: string): string =>
  html
    .replace(/<(\/?)h3\b/g, '<$1h4')
    .replace(/<(\/?)h2\b/g, '<$1h4')
    .replace(/<button[^>]*class="aiuto-btn"[^>]*>.*?<\/button>/gs, '')
    .replace(/\s*<button[^>]*data-a="vai-ipotesi"[^>]*>.*?<\/button>/gs, '')
    .replace(/<p class="nota spiega"[^>]*hidden>.*?<\/p>/gs, '')
    .replace(/\s(id|tabindex)="[^"]*"/g, '');

export function vetrina(lingua: Lingua): Vetrina {
  const pronta = cache.get(lingua);
  if (pronta) return pronta;
  const t = traduttore(lingua);
  const e = esempioCsv(t, lingua);
  const letto = leggiCsv(e.testo);
  if (!letto.ok || !letto.dati || !letto.info) throw new Error('vetrina: dati di esempio non leggibili');
  const s = statoIniziale();
  s.file = { nome: t('csvEsempio.titolo'), testo: e.testo, dati: letto.dati, info: letto.info, avvisi: letto.avvisi };
  Object.assign(s, { ...RISPOSTE_ESEMPIO, fase: 'banco' });
  const c: Contesto = { s, t, f: formati(lingua), lingua, ris: null, risSenzaOrdini: null, conflitto: null, avvisiOrdini: [], inCalcolo: false, erroreCalcolo: '', aiutiAperti: new Set(), esempio: null, linkGenerato: '', linkCopiato: false };
  Object.assign(c, componiEsito(stima(datiDaStimare(s)!, configurazione(s)), null, ipotesi(s, 'rConv')));
  const r = c.ris!;
  const canali = `<div class="scheda sez"><h4 class="ic-prima ic-chart-no-axes-column">${t('graf.canali')} · ${t('metrica.sessioni')}</h4>${legenda(c)}<div class="graf">${graficoCanali(620, r.canali, 'sessioni', (x) => c.f.stimato(x), t('graf.canaliAria', { m: t('metrica.sessioni') }))}</div></div>`; // l’avvertenza sui canali resta solo nello Stimatore
  // «Quanto è solida»: nell'anteprima solo i grafici, con una riga che dice cosa guardare; la spiegazione resta nello strumento
  const sol = `<div class="anteprima-solida"><p class="vetrina-cosa">${t('vetrina.v3Cosa')}</p>
    <h4 class="ic-prima ic-scale">${t('solid.daDove', { m: t('metrica.sessioni') })}</h4>${barraIncertezza(c, 'sessioni')}
    <h4 class="sopra">${t('solid.eSe')}</h4><div class="graf">${graficoSolidita(c, 'sessioni', 620)}</div></div>`;
  const v: Vetrina = {
    eroe: adatta(eroe(c)),
    canali: adatta(canali),
    solidita: adatta(sol),
    csv: csvRisultati(c).split('\r\n'),
  };
  cache.set(lingua, v);
  return v;
}
