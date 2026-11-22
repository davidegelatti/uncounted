import { describe, expect, it } from 'vitest';
import { ALTRE_PERDITE_PREDEFINITO, configPredefinita, stima, tassoNominale, type Config, type Dati } from '../src/motore/modello';
import { Rng } from '../src/motore/rng';
import { genera, scenarioBase } from '../src/motore/sintetico';
import { SCENARI, eseguiScenario } from '../src/motore/validazione';

const esempio = genera(scenarioBase(), new Rng(42));
const cfg = (extra: Partial<Config> = {}): Config => ({ ...configPredefinita(), nSim: 1500, ...extra });

describe('campionatori', () => {
  it('Poisson e Gamma hanno media e varianza corrette', () => {
    const g = new Rng(1);
    for (const mu of [0.3, 4, 25, 400, 50000]) {
      let s = 0;
      let s2 = 0;
      const n = 40000;
      for (let i = 0; i < n; i++) {
        const x = g.poisson(mu);
        s += x;
        s2 += x * x;
      }
      const m = s / n;
      expect(m / mu).toBeCloseTo(1, 1);
      expect((s2 / n - m * m) / mu).toBeGreaterThan(0.9);
      expect((s2 / n - m * m) / mu).toBeLessThan(1.1);
    }
    for (const k of [0.4, 1, 7.5, 300]) {
      let s = 0;
      for (let i = 0; i < 40000; i++) s += g.gamma(k);
      expect(s / 40000 / k).toBeCloseTo(1, 1);
    }
  });
});

describe('motore di stima', () => {
  it('è riproducibile a parità di seme', () => {
    const a = stima(esempio.dati, cfg());
    const b = stima(esempio.dati, cfg());
    expect(a.metriche.sessioni.totale).toEqual(b.metriche.sessioni.totale);
    expect(a.metriche.entrate.totale).toEqual(b.metriche.entrate.totale);
  });

  it('la stima centrale delle sessioni segue la formula S × odds × r_freq', () => {
    const r = stima(esempio.dati, cfg());
    const atteso = r.metriche.sessioni.osservato * (0.4 / 0.6) * 0.8;
    expect(r.metriche.sessioni.perso.p50 / atteso).toBeGreaterThan(0.93);
    expect(r.metriche.sessioni.perso.p50 / atteso).toBeLessThan(1.07);
  });

  it('gli intervalli sono ordinati e l’osservato non viene toccato', () => {
    const r = stima(esempio.dati, cfg());
    for (const m of Object.values(r.metriche)) {
      const t = m.totale;
      expect(t.p2_5).toBeLessThanOrEqual(t.p10);
      expect(t.p10).toBeLessThanOrEqual(t.p50);
      expect(t.p50).toBeLessThanOrEqual(t.p90);
      expect(t.p90).toBeLessThanOrEqual(t.p97_5);
      expect(t.p2_5).toBeGreaterThanOrEqual(m.osservato);
    }
    const somma = esempio.dati.righe.reduce((s, x) => s + x.sessioni, 0);
    expect(r.metriche.sessioni.osservato).toBe(somma);
  });

  it('le conversioni crescono meno delle sessioni (r_conv < 1)', () => {
    const r = stima(esempio.dati, cfg());
    expect(r.metriche.transazioni.quotaPersa.p50).toBeLessThan(r.metriche.sessioni.quotaPersa.p50);
  });

  it('un tasso più incerto allarga l’intervallo', () => {
    const preciso = stima(esempio.dati, cfg({ tasso: { tipo: 'percentuale', valore: 0.6, precisione: 'preciso' } }));
    const vago = stima(esempio.dati, cfg({ tasso: { tipo: 'percentuale', valore: 0.6, precisione: 'massima' } }));
    const amp = (x: typeof preciso): number => x.metriche.sessioni.totale.p97_5 - x.metriche.sessioni.totale.p2_5;
    expect(amp(vago)).toBeGreaterThan(amp(preciso) * 1.2);
  });

  it('gli intervalli dei canali sono relativamente più larghi di quello del totale', () => {
    const r = stima(esempio.dati, cfg());
    const rel = (m: { perso: { p2_5: number; p50: number; p97_5: number } }): number => (m.perso.p97_5 - m.perso.p2_5) / m.perso.p50;
    const totale = rel(r.metriche.sessioni);
    for (const c of r.canali) expect(rel(c.metriche.sessioni)).toBeGreaterThan(totale);
  });

  it('la somma dei canali torna con il totale (in media)', () => {
    const r = stima(esempio.dati, cfg());
    const somma = r.canali.reduce((s, c) => s + c.metriche.transazioni.perso.media, 0);
    expect(somma / r.metriche.transazioni.perso.media).toBeCloseTo(1, 3);
  });

  it('canali con zero conversioni ricevono una stima piccola ma non nulla', () => {
    const dati: Dati = {
      ...esempio.dati,
      righe: esempio.dati.righe.map((x) => (x.canale === 'Display' ? { ...x, transazioni: 0, entrate: 0 } : x)),
    };
    const r = stima(dati, cfg());
    const d = r.canali.find((c) => c.canale === 'Display')!.metriche.transazioni;
    expect(d.osservato).toBe(0);
    expect(d.perso.media).toBeGreaterThan(0);
    expect(d.perso.p97_5).toBeLessThan(20);
  });

  it('funziona senza colonne ecommerce', () => {
    const dati: Dati = {
      righe: esempio.dati.righe.map((x) => ({ ...x, transazioni: 0, entrate: 0 })),
      haUtenti: true,
      haEventi: true,
      haTransazioni: false,
      haEntrate: false,
    };
    const r = stima(dati, cfg());
    expect(r.metriche.transazioni.totale.p97_5).toBe(0);
    expect(r.metriche.eventi.perso.p50).toBeGreaterThan(0);
  });

  it('tasso per device: equivale alla media armonica pesata', () => {
    const c = cfg({
      device: [
        { nome: 'mobile', tasso: 0.5, quota: 60 },
        { nome: 'desktop', tasso: 0.75, quota: 40 },
      ],
    });
    const odds = 0.6 * 1 + 0.4 * (1 / 3);
    expect(tassoNominale(c)).toBeCloseTo(1 / (1 + odds), 6);
    const r = stima(esempio.dati, c);
    expect(r.scalaSemplice.sessioni / r.metriche.sessioni.osservato).toBeCloseTo(1 + odds, 6);
  });

  it('tasso per periodo: i giorni dopo il cambio usano il nuovo tasso', () => {
    const r = stima(esempio.dati, cfg({ periodi: [{ dal: '2026-09-16', tasso: 0.3 }] }));
    const f = (d: (typeof r.giorni)[number]): number => d.metriche.sessioni.totale.p50 / d.metriche.sessioni.osservato;
    expect(f(r.giorni[20])).toBeGreaterThan(f(r.giorni[5]) * 1.5);
  });

  it('accettazioni e rifiuti assoluti danno un tasso preciso', () => {
    const r = stima(esempio.dati, cfg({ tasso: { tipo: 'conteggi', accettati: 60000, nonAccettati: 40000 } }));
    expect(r.parametri.tassoEffettivo.p50).toBeCloseTo(0.6, 1);
    expect(r.parametri.tassoEffettivo.p97_5 - r.parametri.tassoEffettivo.p2_5).toBeLessThan(0.06);
  });

  it('chi ignora il banner, se escluso dal tasso, aumenta il traffico perso', () => {
    const a = stima(esempio.dati, cfg());
    const b = stima(esempio.dati, cfg({ ignora: { modo: 'escluso', quota: 0.2 } }));
    expect(b.metriche.sessioni.perso.p50).toBeGreaterThan(a.metriche.sessioni.perso.p50 * 1.2);
    expect(b.parametri.tassoEffettivo.p50).toBeCloseTo(0.48, 1);
  });

  it('utenti del periodo: stimati solo se forniti', () => {
    expect(stima(esempio.dati, cfg()).utentiPeriodo).toBeNull();
    const r = stima(esempio.dati, cfg({ utentiPeriodo: 10000 }));
    expect(r.utentiPeriodo!.perso.p50 / (10000 * (0.4 / 0.6))).toBeCloseTo(1, 1);
  });
});

describe('ancoraggio agli ordini reali', () => {
  const ancora = (ordini: number, entrate?: number): Config['ancora'] => ({ dal: '2026-09-01', al: '2026-09-30', ordini, entrate, altrePerdite: ALTRE_PERDITE_PREDEFINITO });
  const Toss = esempio.dati.righe.reduce((s, x) => s + x.transazioni, 0);

  it('restringe molto le transazioni e quasi per nulla le sessioni', () => {
    const senza = stima(esempio.dati, cfg());
    const con = stima(esempio.dati, cfg({ ancora: ancora(esempio.gestionale.ordini, esempio.gestionale.entrate) }));
    const amp = (m: { totale: { p2_5: number; p97_5: number } }): number => m.totale.p97_5 - m.totale.p2_5;
    expect(con.ancora!.attivo).toBe(true);
    expect(amp(con.metriche.transazioni)).toBeLessThan(amp(senza.metriche.transazioni) * 0.5);
    expect(amp(con.metriche.sessioni)).toBeGreaterThan(amp(senza.metriche.sessioni) * 0.7);
    expect(con.scomposizione).toBeNull();
  });

  it('il totale ancorato è coerente con gli ordini reali', () => {
    const con = stima(esempio.dati, cfg({ ancora: ancora(esempio.gestionale.ordini) }));
    const t = con.metriche.transazioni.totale;
    expect(t.p97_5).toBeLessThanOrEqual(esempio.gestionale.ordini + 1);
    expect(t.p50).toBeGreaterThan(esempio.gestionale.ordini * 0.85);
  });

  it('sposta r_conv verso il valore vero quando l’ipotesi è sbagliata', () => {
    // r_conv non è identificato da solo (lo è il prodotto odds × r_freq × r_conv): si sposta, ma non fino a 1.
    const e = genera({ ...scenarioBase(), rConv: 1, altrePerdite: 0.05 }, new Rng(9));
    const r = stima(e.dati, cfg({ ancora: ancora(e.gestionale.ordini) }));
    expect(r.parametri.rConv.p50).toBeGreaterThan(0.5);
    const vero = e.verita.transazioni;
    expect(r.metriche.transazioni.totale.p2_5).toBeLessThanOrEqual(vero);
    expect(r.metriche.transazioni.totale.p97_5).toBeGreaterThanOrEqual(vero);
  });

  it('rifiuta ordini reali inferiori alle transazioni GA4, spiegando perché', () => {
    const r = stima(esempio.dati, cfg({ ancora: ancora(Math.round(Toss * 0.8)) }));
    expect(r.ancora!.attivo).toBe(false);
    expect(r.avvisi.map((a) => a.codice)).toContain('ordini_inferiori');
  });

  it('non calibra lo scontrino se le entrate sono definite in modo diverso', () => {
    const r = stima(esempio.dati, cfg({ ancora: ancora(esempio.gestionale.ordini, esempio.gestionale.entrate * 1.5) }));
    expect(r.ancora!.rAovCalibrato).toBe(false);
    expect(r.avvisi.map((a) => a.codice)).toContain('scontrino_diverso');
  });

  it('segnala il conflitto forte tra dati reali e ipotesi', () => {
    const r = stima(esempio.dati, cfg({ ancora: ancora(Toss * 6) }));
    expect(r.avvisi.map((a) => a.codice)).toContain('conflitto');
  });
});

describe('copertura degli intervalli (versione rapida; quella completa è in VALIDAZIONE.md)', () => {
  const def = (id: string) => SCENARI.find((s) => s.id === id)!;
  it('A1 — calibrazione di base', () => {
    const r = eseguiScenario(def('A1'), 150, 600, 11);
    for (const k of ['sessioni', 'eventi', 'transazioni', 'entrate'] as const) {
      expect(r.metriche[k].cop80, `${k} 80%`).toBeGreaterThan(0.69);
      expect(r.metriche[k].cop80, `${k} 80%`).toBeLessThan(0.91);
      expect(r.metriche[k].cop95, `${k} 95%`).toBeGreaterThan(0.89);
      expect(Math.abs(r.metriche[k].errore), `${k} errore`).toBeLessThan(0.06);
    }
  });
  it('A6 — calibrazione con ancoraggio', () => {
    const r = eseguiScenario(def('A6'), 150, 600, 12);
    expect(r.metriche.transazioni.cop80).toBeGreaterThan(0.69);
    expect(r.metriche.transazioni.cop95).toBeGreaterThan(0.89);
    expect(r.metriche.sessioni.cop95).toBeGreaterThan(0.89);
  });
});
