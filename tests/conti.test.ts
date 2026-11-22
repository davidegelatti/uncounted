// Ordini reali e risposte che non tornano: il blocco «da controllare» usa i valori e la soglia del motore.
import { describe, expect, it } from 'vitest';
import { traduttore } from '../src/i18n/indice';
import { formati } from '../src/i18n/formato';
import { stima } from '../src/motore/modello';
import { leggiCsv } from '../src/parser';
import { compatibiliPubblico, componiEsito, previstiDalleRisposte } from '../src/strumento/esito';
import { alternativePubblico } from '../src/strumento/pubblico';
import { configurazione, datiDaStimare, ipotesi, statoIniziale, type Stato } from '../src/strumento/stato';
import type { Contesto } from '../src/strumento/vistaIngressi';
import { contiDaControllare } from '../src/strumento/vistaRisultati';
import { csvRisultati } from '../src/strumento/esporta';

// Export sintetico: 30 giorni, 2 canali, 781 transazioni in tutto.
function csv(transazioni: number): string {
  const righe = ['Data,Gruppo di canali predefinito della sessione,Sessioni,Totale utenti,Eventi chiave,Transazioni,Entrate totali'];
  let resto = transazioni;
  for (let d = 1; d <= 30; d++)
    for (const canale of ['Organic Search', 'Direct']) {
      const n = d === 30 && canale === 'Direct' ? resto : Math.round(transazioni / 60);
      resto -= n;
      righe.push(`202609${String(d).padStart(2, '0')},${canale},700,600,50,${n},${n * 80}`);
    }
  return righe.join('\n');
}

function contesto(lingua: 'it' | 'en', ordini: number, pubblico: Stato['pubblico']): Contesto {
  const testo = csv(781);
  const letto = leggiCsv(testo);
  const s = statoIniziale();
  s.file = { nome: 'prova', testo, dati: letto.dati!, info: letto.info!, avvisi: letto.avvisi };
  Object.assign(s, { cm: 'basic', tasso: '84', precisione: 'stima', misura: 'utente', ignora: 'incluso', fase: 'banco', ordiniAttivi: true, ordini: String(ordini), pubblico });
  const dati = datiDaStimare(s)!;
  const cfg = configurazione(s);
  const con = stima(dati, cfg);
  const senza = stima(dati, { ...cfg, ancora: undefined });
  const t = traduttore(lingua);
  const c: Contesto = { s, t, f: formati(lingua), lingua, ris: null, risSenzaOrdini: null, conflitto: null, avvisiOrdini: [], inCalcolo: false, erroreCalcolo: '', aiutiAperti: new Set(), esempio: null, linkGenerato: '', linkCopiato: false };
  Object.assign(c, componiEsito(con, senza, ipotesi(s, 'rConv'), compatibiliPubblico(dati, cfg, con, alternativePubblico(s.pubblico))));
  return c;
}

describe('ordini reali e risposte che non tornano', () => {
  it('meno ordini del previsto: 839 reali, 781 in GA4, tasso 84%, pubblico misto', () => {
    const c = contesto('it', 839, 'misto');
    expect(c.ris!.parametri.tassoEffettivo.p50).toBeCloseTo(0.84, 2);
    expect(c.conflitto).not.toBeNull();
    expect(c.conflitto!.direzione).toBe('pochi');
    expect(c.conflitto!.mancanti).toBe(58);
    // figura: consenso dalla stima senza ordini, altre cause = quota del pubblico × ordini reali
    const p = previstiDalleRisposte(c.ris!, 839, { mediana: 0.09, sigma: 0.65 }, null);
    expect(p.consenso).toBe(c.ris!.metriche.transazioni.perso.p50);
    expect(Math.round(p.consenso)).toBeGreaterThanOrEqual(40);
    expect(Math.round(p.consenso)).toBeLessThanOrEqual(50);
    expect(p.altre).toBeCloseTo(75.5, 1);
    // solo il tagging lato server fa tornare i conti
    expect(c.conflitto!.compatibili).toEqual({ consumo: false, tecnico: false, server: true });
    const html = contiDaControllare(c);
    expect(html).toContain('class="fascia ambra conti-blocco"');
    expect(html).not.toContain('rosso');
    expect(html).toContain('Mancano meno ordini di quanto prevedono le tue risposte');
    expect(html).toContain('Ordini mancanti davvero: <strong>58</strong>');
    expect(html).toContain('(839 nel gestionale − 781 in GA4)');
    expect(html).toContain(`per il consenso ≈ ${Math.round(p.consenso)}`);
    expect(html).toContain('per altre cause ≈ 76');
    expect(html).toContain(`Previsti dalle tue risposte: <strong>≈ ${Math.round(p.totale)}</strong>`);
    expect(html.match(/data-a="scegli-pubblico"/g)).toHaveLength(1);
    expect(html).toContain('data-v="server"');
    expect(html).toContain('Transazioni contate due volte');
    expect(html).not.toContain('Il tipo di pubblico da solo non basta');
    // il valore tecnico di «quanto converte» sta solo nei Dettagli, chiusi
    const principale = html.slice(0, html.indexOf('<details'));
    expect(principale).not.toMatch(/quanto converte|conflitto|non stanno insieme/);
    expect(html).toMatch(/<details class="conti-dettagli"><summary>/);
    expect(csvRisultati(c)).toContain('no: mancano meno ordini di quanto prevedono le risposte');
  });

  it('scegliendo «tagging lato server» i conti tornano', () => {
    const c = contesto('it', 839, 'server');
    expect(c.conflitto).toBeNull();
    expect(c.ris!.ancora?.attivo).toBe(true);
    expect(contiDaControllare(c)).toBe('');
  });

  it('più ordini del previsto: caso simmetrico, in inglese', () => {
    const c = contesto('en', 1100, 'misto');
    expect(c.conflitto!.direzione).toBe('troppi');
    expect(c.conflitto!.compatibili).toEqual({ consumo: false, tecnico: true, server: false });
    const html = contiDaControllare(c);
    expect(html).toContain('More orders are missing than your answers predict');
    expect(html).toContain('Orders actually missing: <strong>319</strong>');
    expect(html).toContain('data-v="tecnico"');
    expect(html).not.toContain('counted twice');
    expect(contesto('en', 1100, 'tecnico').conflitto).toBeNull();
  });

  it('se nessuna risposta sul pubblico basta, lo dice', () => {
    const c = contesto('it', 800, 'server');
    expect(c.conflitto!.direzione).toBe('pochi');
    expect(Object.values(c.conflitto!.compatibili!).every((x) => !x)).toBe(true);
    const html = contiDaControllare(c);
    expect(html).toContain('Il tipo di pubblico da solo non basta a spiegarlo: controlla i punti qui sotto.');
    expect(html).not.toContain('data-a="scegli-pubblico"');
  });
});
