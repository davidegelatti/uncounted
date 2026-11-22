import { describe, expect, it } from 'vitest';
import { configPredefinita, stima, type Config } from '../src/motore/modello';
import { altreCause, componiEsito } from '../src/strumento/esito';
import { ALTRE_PERDITE_PUBBLICO } from '../src/strumento/pubblico';
import { datiGolden } from './golden/configurazioni';

const { dati, ordini } = datiGolden();
const Toss = dati.righe.reduce((s, r) => s + r.transazioni, 0);
const cfg = (o?: number): Config => ({
  ...configPredefinita(),
  nSim: 600,
  ancora: o ? { dal: '0000-00-00', al: '9999-99-99', ordini: o, altrePerdite: ALTRE_PERDITE_PUBBLICO.misto } : undefined,
});
const senza = stima(dati, cfg());
const rConv = configPredefinita().rConv;

describe('quale stima mostrare con gli ordini reali', () => {
  it('ordini compatibili: si usa la stima calibrata e si tiene quella senza ordini per il confronto', () => {
    const con = stima(dati, cfg(ordini));
    const e = componiEsito(con, senza, rConv);
    expect(e.conflitto).toBeNull();
    expect(e.ris).toBe(con);
    expect(e.risSenzaOrdini).toBe(senza);
  });

  it('troppi ordini mancanti: conflitto, gli ordini non vengono usati per NESSUNA grandezza', () => {
    const con = stima(dati, cfg(Toss * 3));
    expect(con.ancora!.conflitto).toBe(true);
    // senza questa regola la calibrazione fuori scala gonfierebbe anche eventi chiave ed entrate
    expect(con.metriche.eventi.totale.p50).toBeGreaterThan(senza.metriche.eventi.totale.p50 * 1.3);
    const e = componiEsito(con, senza, rConv);
    expect(e.conflitto!.direzione).toBe('troppi');
    expect(e.conflitto!.mancanti).toBe(Toss * 2);
    expect(e.conflitto!.rConvNecessario).toBeGreaterThan(1.07);
    expect(e.ris).toBe(senza);
    expect(e.ris.ancora).toBeNull();
    for (const m of ['eventi', 'transazioni', 'entrate', 'sessioni'] as const) expect(e.ris.metriche[m]).toEqual(senza.metriche[m]);
    expect(e.risSenzaOrdini).toBeNull();
  });

  it('troppo pochi ordini mancanti: conflitto nella direzione opposta', () => {
    const con = stima(dati, cfg(Math.round(Toss * 1.03)));
    expect(con.ancora!.conflitto).toBe(true);
    const e = componiEsito(con, senza, rConv);
    expect(e.conflitto!.direzione).toBe('pochi');
    expect(e.conflitto!.rConvNecessario).toBeLessThan(0.15);
    expect(e.ris).toBe(senza);
  });

  it('gli avvisi sugli ordini non applicati restano disponibili', () => {
    const con = stima(dati, cfg(Math.round(Toss * 0.5)));
    const e = componiEsito(con, senza, rConv);
    expect(e.avvisiOrdini.map((a) => a.codice)).toEqual(['ordini_inferiori']);
    expect(e.conflitto).toBeNull();
    expect(e.risSenzaOrdini).toBeNull();
  });

  it('«persi per altre cause» ha un intervallo, con gli estremi scambiati', () => {
    expect(altreCause(1186, { p10: 1055, p50: 1090, p90: 1140 })).toEqual({ centrale: 96, min: 46, max: 131 });
    expect(altreCause(1000, { p10: 990, p50: 1005, p90: 1020 })).toEqual({ centrale: 0, min: 0, max: 10 });
  });
});
