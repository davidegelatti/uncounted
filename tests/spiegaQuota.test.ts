// La riga «Perché il 65% e non il 60%?» sotto il dato principale deve raccontare lo stesso numero del dato principale.
import { describe, expect, it } from 'vitest';
import { traduttore } from '../src/i18n/indice';
import { formati } from '../src/i18n/formato';
import { stima } from '../src/motore/modello';
import { leggiCsv } from '../src/parser';
import { RISPOSTE_ESEMPIO, esempioCsv } from '../src/strumento/esempio';
import { componiEsito } from '../src/strumento/esito';
import { configurazione, datiDaStimare, ipotesi, statoIniziale, type Stato } from '../src/strumento/stato';
import type { Contesto } from '../src/strumento/vistaIngressi';
import { eroe, quotaMostrata, spiegaQuota } from '../src/strumento/vistaRisultati';

const t = traduttore('it');
const csv = esempioCsv(t, 'it');
const letto = leggiCsv(csv.testo);

function contesto(modifica: (s: Stato) => void): Contesto {
  const s = statoIniziale();
  s.file = { nome: 'esempio', testo: csv.testo, dati: letto.dati!, info: letto.info!, avvisi: letto.avvisi };
  Object.assign(s, { ...RISPOSTE_ESEMPIO, fase: 'banco' });
  modifica(s);
  const c: Contesto = { s, t, f: formati('it'), lingua: 'it', ris: null, risSenzaOrdini: null, conflitto: null, avvisiOrdini: [], inCalcolo: false, erroreCalcolo: '', aiutiAperti: new Set(), esempio: null, linkGenerato: '', linkCopiato: false };
  Object.assign(c, componiEsito(stima(datiDaStimare(s)!, configurazione(s)), null, ipotesi(s, 'rConv')));
  return c;
}

describe('riga che spiega la quota di sessioni', () => {
  const casi: [string, (s: Stato) => void][] = [
    ['esempio del tour', () => {}],
    ['tasso per banner mostrato', (s) => (s.misura = 'banner')],
    ['tasso senza chi ignora il banner', (s) => (s.ignora = 'escluso')],
    ['tasso basso', (s) => (s.tasso = '30')],
    ['chi non accetta ritorna di più', (s) => ((s.valori.rFreq = 1.6), (s.statoIpotesi.rFreq = 'mod'))],
  ];
  for (const [nome, modifica] of casi) {
    it(`${nome}: la formula torna con il dato principale e la frase usa lo stesso numero`, () => {
      const c = contesto(modifica);
      const sp = spiegaQuota(c)!;
      expect(sp).not.toBeNull();
      expect(sp.generico).toBe(false);
      expect(Math.abs(sp.formula - sp.quota)).toBeLessThan(0.01);
      expect(sp.quota).toBe(quotaMostrata(c));
      const html = eroe(c);
      const pct = c.f.pctArt(sp.quota);
      expect(html).toContain(`<em>${pct}</em>`); // dato principale
      expect(html).toContain(`Perché ${pct} e non ${c.f.pctArt(sp.tasso)}?`); // riga di spiegazione
    });
  }

  it('non compare se tasso e quota differiscono meno di un punto', () => {
    const c = contesto((s) => ((s.valori.rFreq = 1), (s.statoIpotesi.rFreq = 'mod')));
    expect(spiegaQuota(c)).toBeNull();
    expect(eroe(c)).not.toContain('class="perche"');
  });

  it('con tassi per dispositivo la frase è generica, senza numeri', () => {
    const c = contesto((s) => ((s.device.mobile = { tasso: '50', quota: '60' }), (s.device.desktop = { tasso: '75', quota: '40' })));
    const sp = spiegaQuota(c)!;
    expect(sp.generico).toBe(true);
    expect(eroe(c)).toContain('un solo numero non basta');
    expect(eroe(c)).not.toContain('Perché il');
  });
});
