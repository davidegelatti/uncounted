// Utenti unici del periodo: il totale della riga dei totali è un dato del file e si usa da solo, se coerente.
// Fixture sintetica, mai dati veri.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { traduttore } from '../src/i18n/indice';
import { formati } from '../src/i18n/formato';
import { stima } from '../src/motore/modello';
import { leggiCsv } from '../src/parser';
import { codifica } from '../src/strumento/collegamento';
import { csvRisultati } from '../src/strumento/esporta';
import { componiEsito } from '../src/strumento/esito';
import { configurazione, datiDaStimare, ipotesi, statoIniziale, utentiEffettivi, type Stato } from '../src/strumento/stato';
import { rendiColonna, type Contesto } from '../src/strumento/vistaIngressi';
import { rendiRisultati } from '../src/strumento/vistaRisultati';

const testo = readFileSync('tests/fixture/export-ga4-formato-reale.csv', 'utf8');
const senzaTotali = testo.split('\n').filter((l) => !l.startsWith(',,')).join('\n');
const filtrato = testo.split('\n').filter((l) => !l.includes('Paid Social')).join('\n');

function stato(csv: string, modifica: Partial<Stato> = {}): Stato {
  const r = leggiCsv(csv);
  const s = statoIniziale();
  s.file = { nome: 'prova.csv', testo: csv, dati: r.dati!, info: r.info!, avvisi: r.avvisi };
  Object.assign(s, { cm: 'basic', tasso: '60', precisione: 'stima', misura: 'utente', ignora: 'incluso', fase: 'banco' }, modifica);
  return s;
}
function contesto(s: Stato, conRisultati = false): Contesto {
  const t = traduttore('it');
  const c: Contesto = { s, t, f: formati('it'), lingua: 'it', ris: null, risSenzaOrdini: null, conflitto: null, avvisiOrdini: [], inCalcolo: false, erroreCalcolo: '', aiutiAperti: new Set(), esempio: null, linkGenerato: '', linkCopiato: false };
  if (conRisultati) Object.assign(c, componiEsito(stima(datiDaStimare(s)!, { ...configurazione(s), nSim: 400 }), null, ipotesi(s, 'rConv')));
  return c;
}
const scheda = (c: Contesto): string => {
  const html = rendiColonna(c);
  const i = html.indexOf('data-ip="utenti"');
  return html.slice(i, html.indexOf('</div></div>', i));
};

describe('utenti del periodo', () => {
  it('«Letto dal tuo export»: si usa da solo, con Modifica e Non usarlo', () => {
    const s = stato(testo);
    expect(utentiEffettivi(s)).toEqual({ fonte: 'export', valore: 763, export: 763 });
    expect(configurazione(s).utentiPeriodo).toBe(763);
    const h = scheda(contesto(s));
    expect(h).toContain('Letto dal tuo export');
    expect(h).toContain('<strong>763</strong> utenti unici nel periodo');
    expect(h).toContain('data-a="utenti-modifica"');
    expect(h).toContain('data-a="utenti-no"');
    expect(h).not.toMatch(/Aggiungi|Usa questo valore/);
  });

  it('«Inserito da te»: il valore scritto vince su quello dell’export, con Modifica e Togli', () => {
    const s = stato(testo, { utenti: 'utente', utentiPeriodo: '900' });
    expect(utentiEffettivi(s).fonte).toBe('utente');
    expect(configurazione(s).utentiPeriodo).toBe(900);
    const h = scheda(contesto(s));
    expect(h).toContain('Inserito da te');
    expect(h).toContain('data-a="utenti-modifica"');
    expect(h).toContain('data-a="utenti-togli"');
    // in modifica compare la casella
    s.utentiModifica = true;
    expect(scheda(contesto(s))).toContain('id="c-utentiPeriodo"');
  });

  it('«Non disponibile»: senza riga dei totali, o con un file incompleto', () => {
    for (const csv of [senzaTotali, filtrato]) {
      const s = stato(csv);
      expect(utentiEffettivi(s).fonte).toBe('nonDisponibile');
      expect(configurazione(s).utentiPeriodo).toBeUndefined();
      const h = scheda(contesto(s));
      expect(h).toContain('Non disponibile');
      expect(h).toContain('data-a="utenti-inserisci"');
    }
  });

  it('«Non usarlo» resta tale anche dopo un ricalcolo', () => {
    const s = stato(testo, { utenti: 'no' });
    for (let i = 0; i < 2; i++) {
      const c = contesto(s, true);
      expect(configurazione(s).utentiPeriodo).toBeUndefined();
      expect(c.ris!.utentiPeriodo).toBeNull();
      expect(scheda(c)).toContain('Non usato');
      expect(scheda(c)).toContain('data-a="utenti-auto"');
      expect(rendiRisultati(c)).toContain('Hai scelto di non usare il totale utenti');
      expect(csvRisultati(c)).toContain('"Utenti del periodo";"non usati"');
    }
  });

  it('risultati, CSV e link: la provenienza c’è, il valore non va nel link', () => {
    const c = contesto(stato(testo), true);
    expect(c.ris!.utentiPeriodo).not.toBeNull();
    const ris = rendiRisultati(c);
    expect(ris).toContain('Letto dalla riga dei totali del tuo export');
    expect(ris).toContain('data-a="vai-ipotesi" data-v="utenti"');
    expect(csvRisultati(c)).toContain('"Utenti del periodo";"763, letto dalla riga dei totali dell’export"');
    const link = codifica(stato(testo, { utenti: 'utente', utentiPeriodo: '900' }));
    expect(link).not.toMatch(/900|763|utenti/);
  });
});
