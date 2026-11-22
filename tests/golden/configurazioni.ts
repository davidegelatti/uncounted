// Configurazioni usate per la regressione del motore. NON MODIFICARE: l'istantanea in motore.json
// è stata generata con queste, prima di qualunque modifica della Fase B.
import { configPredefinita, type Config, type Dati } from '../../src/motore/modello';
import { Rng } from '../../src/motore/rng';
import { genera, scenarioBase } from '../../src/motore/sintetico';

export function datiGolden(): { dati: Dati; ordini: number; entrate: number } {
  const e = genera({ ...scenarioBase(), altrePerdite: 0.05, giorniPromo: [12, 13] }, new Rng(42));
  return { dati: e.dati, ordini: e.gestionale.ordini, entrate: e.gestionale.entrate };
}

export function configurazioniGolden(ordini: number, entrate: number): Record<string, { cfg: Config; senzaEcommerce?: boolean }> {
  const base = (extra: Partial<Config> = {}): Config => ({ ...configPredefinita(), nSim: 800, seme: 12345, ...extra });
  const ancora = (o: number, r?: number): Config['ancora'] => ({ dal: '2026-09-01', al: '2026-09-30', ordini: o, entrate: r, altrePerdite: { mediana: 0.05, sigma: 0.55 } });
  return {
    predefinita: { cfg: base({ utentiPeriodo: 15000 }) },
    dispositivo: { cfg: base({ device: [{ nome: 'mobile', tasso: 0.5, quota: 60 }, { nome: 'desktop', tasso: 0.75, quota: 40 }] }) },
    periodi: { cfg: base({ periodi: [{ dal: '2026-09-16', tasso: 0.35 }] }) },
    canali: { cfg: base({ canali: { Email: 0.8, 'Paid Social': 0.4 } }) },
    ignora: { cfg: base({ ignora: { modo: 'escluso' }, misura: 'banner', rFreq: { mediana: 0.6, sigma: 0.4 } }) },
    ignoraNonSo: { cfg: base({ ignora: { modo: 'nonso', quota: 0.2 }, tasso: { tipo: 'percentuale', valore: 0.45, precisione: 'massima' } }) },
    conteggi: { cfg: base({ tasso: { tipo: 'conteggi', accettati: 12000, nonAccettati: 9000 } }) },
    senzaEcommerce: { cfg: base(), senzaEcommerce: true },
    ordini: { cfg: base({ ancora: ancora(ordini) }) },
    ordiniEntrate: { cfg: base({ ancora: ancora(ordini, entrate) }) },
    conflitto: { cfg: base({ ancora: ancora(ordini * 3) }) },
    ordiniPeriodoParziale: { cfg: base({ ancora: { ...ancora(Math.round(ordini * 0.45))!, dal: '2026-09-01', al: '2026-09-14' } }) },
  };
}

export function senzaEcommerce(d: Dati): Dati {
  return { ...d, righe: d.righe.map((r) => ({ ...r, transazioni: 0, entrate: 0 })), haTransazioni: false, haEntrate: false };
}
