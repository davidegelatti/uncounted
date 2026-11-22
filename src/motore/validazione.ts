// Banco di validazione: scenari sintetici e misura di errore e copertura degli intervalli.
import { configPredefinita, R_FREQ_PREDEFINITI, R_UTENTI_PREDEFINITI, stima, type Config, type Metrica } from './modello';
import { Rng, logistica, logit } from './rng';
import { ALTRE_PERDITE_PUBBLICO, type Pubblico } from '../strumento/pubblico';
import { genera, scenarioBase, type EsitoSint, type ScenarioSint } from './sintetico';

export interface DefScenario {
  id: string;
  nome: string;
  /** A = i parametri veri seguono le ipotesi (la copertura DEVE tornare); B = ipotesi violate (si misura il danno). */
  tipo: 'A' | 'B';
  prepara(rng: Rng): { sc: ScenarioSint; config(e: EsitoSint): Config };
}

type Chiave = Metrica | 'utentiPeriodo';
export interface Misura {
  cop80: number;
  cop95: number;
  /** Errore relativo mediano della stima centrale */
  errore: number;
  /** Ampiezza relativa mediana dell'intervallo 95% */
  ampiezza95: number;
}
export interface Riepilogo {
  id: string;
  nome: string;
  tipo: 'A' | 'B';
  repliche: number;
  metriche: Record<Chiave, Misura>;
  canali: { sessioni: { cop80: number; cop95: number }; transazioni: { cop80: number; cop95: number } };
}

const ln = (rng: Rng, med: number, sigma: number): number => med * Math.exp(sigma * rng.normale());

/** Estrae i parametri veri dalle stesse distribuzioni che lo strumento assume. */
function daIpotesi(rng: Rng, pDichiarato: number, sd: number, fisso: Partial<ScenarioSint> = {}): ScenarioSint {
  const pred = configPredefinita();
  const sc = scenarioBase();
  sc.fA = 3.2;
  sc.pAccetta = logistica(logit(pDichiarato) + (sd / (pDichiarato * (1 - pDichiarato))) * rng.normale());
  sc.rFreq = ln(rng, R_FREQ_PREDEFINITI.utente.mediana, R_FREQ_PREDEFINITI.utente.sigma);
  sc.rConv = ln(rng, pred.rConv.mediana, pred.rConv.sigma);
  sc.rConvEventi = sc.rConv * Math.exp(0.75 * pred.rConv.sigma * rng.normale());
  sc.rAov = ln(rng, pred.rAov.mediana, pred.rAov.sigma);
  for (const c of sc.canali) c.delta = pred.tauCanali * rng.normale();
  return Object.assign(sc, fisso);
}

function cfg(valore: number, precisione: 'preciso' | 'stima' | 'massima', e: EsitoSint, extra: Partial<Config> = {}): Config {
  return {
    ...configPredefinita(),
    tasso: { tipo: 'percentuale', valore, precisione },
    utentiPeriodo: e.utentiPeriodoOsservati,
    ...extra,
  };
}

const ancoraTotale = (e: EsitoSint, pubblico: Pubblico = 'misto'): Config['ancora'] => ({
  dal: '0000-00-00',
  al: '9999-99-99',
  ordini: e.gestionale.ordini,
  entrate: e.gestionale.entrate,
  altrePerdite: ALTRE_PERDITE_PUBBLICO[pubblico],
});

/**
 * Imposta nel generatore la perdita tecnica tra chi accetta in modo che la quota di ordini reali persi
 * per altre cause (sul totale degli ordini) sia quella voluta.
 */
function conAltrePerdite(sc: ScenarioSint, quota: number): ScenarioSint {
  const fN = Math.max(1, sc.fA * sc.rFreq);
  const quotaOrdiniAccetta = (sc.pAccetta * sc.fA) / (sc.pAccetta * sc.fA + (1 - sc.pAccetta) * fN * sc.rConv);
  sc.altrePerdite = Math.min(0.9, quota / quotaOrdiniAccetta);
  return sc;
}

/**
 * Dispositivi per gli scenari B16: mobile 60% dei visitatori con consenso più basso, desktop 40% con consenso più alto
 * (circa 50% e 75% quando il tasso globale è 60%). `rapportoVisite` = visite di chi usa il desktop ÷ visite di chi usa
 * il mobile; i moltiplicatori sono normalizzati perché la media delle visite resti quella dello scenario.
 */
function conDispositivi(sc: ScenarioSint, rapportoVisite: number): ScenarioSint {
  const m = 1 / (0.6 + 0.4 * rapportoVisite);
  sc.dispositivi = [
    { nome: 'mobile', quota: 0.6, delta: -0.4, moltVisite: m },
    { nome: 'desktop', quota: 0.4, delta: 0.7, moltVisite: m * rapportoVisite },
  ];
  return sc;
}

/** Ciò che l'utente inserirebbe: tasso nominale per dispositivo (come il 60% di A1) e quota di sessioni letta in GA4. */
function tassiDichiarati(e: EsitoSint): NonNullable<Config['device']> {
  const nominale = { mobile: logistica(logit(0.6) - 0.4), desktop: logistica(logit(0.6) + 0.7) } as Record<string, number>;
  return e.cmp.perDispositivo!.map((d) => ({ nome: d.nome, tasso: nominale[d.nome], quota: d.quotaSessioniOss }));
}

export const SCENARI: DefScenario[] = [
  {
    id: 'A1',
    nome: 'Base: 50.000 sessioni, consenso 60% ("è una stima")',
    tipo: 'A',
    prepara: (rng) => ({ sc: daIpotesi(rng, 0.6, 0.05), config: (e) => cfg(0.6, 'stima', e) }),
  },
  {
    id: 'A2',
    nome: 'Canali minuscoli: 8.000 sessioni, canali con 0–5 conversioni',
    tipo: 'A',
    prepara: (rng) => ({ sc: daIpotesi(rng, 0.6, 0.05, { sessioniAttese: 8000 }), config: (e) => cfg(0.6, 'stima', e) }),
  },
  {
    id: 'A3',
    nome: 'Sito piccolo: 2.000 sessioni',
    tipo: 'A',
    prepara: (rng) => ({ sc: daIpotesi(rng, 0.6, 0.05, { sessioniAttese: 2000 }), config: (e) => cfg(0.6, 'stima', e) }),
  },
  {
    id: 'A4',
    nome: 'Consenso molto basso: 20% ("è una stima")',
    tipo: 'A',
    prepara: (rng) => ({ sc: daIpotesi(rng, 0.2, 0.05), config: (e) => cfg(0.2, 'stima', e) }),
  },
  {
    id: 'A5',
    nome: 'Consenso molto alto: 92% ("lo conosco con precisione")',
    tipo: 'A',
    prepara: (rng) => ({ sc: daIpotesi(rng, 0.92, 0.015), config: (e) => cfg(0.92, 'preciso', e) }),
  },
  {
    id: 'A6',
    nome: 'Base con ordini reali (pubblico «misto / non lo so»)',
    tipo: 'A',
    prepara: (rng) => {
      const quota = Math.min(0.6, ln(rng, ALTRE_PERDITE_PUBBLICO.misto.mediana, ALTRE_PERDITE_PUBBLICO.misto.sigma));
      return { sc: conAltrePerdite(daIpotesi(rng, 0.6, 0.05), quota), config: (e) => cfg(0.6, 'stima', e, { ancora: ancoraTotale(e) }) };
    },
  },
  {
    id: 'B6',
    nome: 'r_conv vero = 1,0 (ipotesi: 0,4)',
    tipo: 'B',
    prepara: (rng) => ({ sc: daIpotesi(rng, 0.6, 0.05, { rConv: 1, rConvEventi: 1 }), config: (e) => cfg(0.6, 'stima', e) }),
  },
  {
    id: 'B7',
    nome: 'r_conv vero = 0,15 (ipotesi: 0,4)',
    tipo: 'B',
    prepara: (rng) => ({ sc: daIpotesi(rng, 0.6, 0.05, { rConv: 0.15, rConvEventi: 0.15 }), config: (e) => cfg(0.6, 'stima', e) }),
  },
  {
    id: 'B8a',
    nome: 'r_conv vero = 1,0 CON ordini reali',
    tipo: 'B',
    prepara: (rng) => ({
      sc: conAltrePerdite(daIpotesi(rng, 0.6, 0.05, { rConv: 1, rConvEventi: 1 }), 0.09),
      config: (e) => cfg(0.6, 'stima', e, { ancora: ancoraTotale(e) }),
    }),
  },
  {
    id: 'B8b',
    nome: 'r_conv vero = 0,15 CON ordini reali',
    tipo: 'B',
    prepara: (rng) => ({
      sc: conAltrePerdite(daIpotesi(rng, 0.6, 0.05, { rConv: 0.15, rConvEventi: 0.15 }), 0.09),
      config: (e) => cfg(0.6, 'stima', e, { ancora: ancoraTotale(e) }),
    }),
  },
  {
    id: 'B9',
    nome: 'Consenso molto diverso tra canali (circa 30%–85%)',
    tipo: 'B',
    prepara: (rng) => {
      const sc = daIpotesi(rng, 0.6, 0.015);
      const d = [0.2, 1.1, -0.3, -1.3, 1.4, 0.5, -0.9, -1.5];
      sc.canali.forEach((c, i) => (c.delta = d[i]));
      return { sc, config: (e) => cfg(0.6, 'preciso', e) };
    },
  },
  {
    id: 'B10a',
    nome: 'Tasso CMP per banner mostrato, dichiarato come "per utente"',
    tipo: 'B',
    prepara: (rng) => ({ sc: daIpotesi(rng, 0.6, 0), config: (e) => cfg(e.cmp.perBanner, 'stima', e) }),
  },
  {
    id: 'B10b',
    nome: 'Tasso CMP per banner mostrato, dichiarato correttamente',
    tipo: 'B',
    prepara: (rng) => ({
      sc: daIpotesi(rng, 0.6, 0),
      config: (e) => cfg(e.cmp.perBanner, 'stima', e, { misura: 'banner', rFreq: R_FREQ_PREDEFINITI.banner, rUtenti: R_UTENTI_PREDEFINITI.banner }),
    }),
  },
  {
    id: 'B11a',
    nome: 'Tasso che esclude chi ignora il banner, dichiarato come completo',
    tipo: 'B',
    prepara: (rng) => ({ sc: daIpotesi(rng, 0.6, 0), config: (e) => cfg(e.cmp.perUtenteSenzaIgnora, 'stima', e) }),
  },
  {
    id: 'B11b',
    nome: 'Tasso che esclude chi ignora il banner, dichiarato tale (quota ignota)',
    tipo: 'B',
    prepara: (rng) => ({
      sc: daIpotesi(rng, 0.6, 0),
      config: (e) => cfg(e.cmp.perUtenteSenzaIgnora, 'stima', e, { ignora: { modo: 'escluso' } }),
    }),
  },
  {
    id: 'B12a',
    nome: 'Cambio di banner a metà periodo (60% → 35%), dichiarato',
    tipo: 'B',
    prepara: (rng) => ({
      sc: daIpotesi(rng, 0.6, 0, { cambioBanner: { giorno: 15, pAccetta: 0.35 } }),
      config: (e) => cfg(e.cmp.perUtentePrima, 'stima', e, { periodi: [{ dal: '2026-09-16', tasso: e.cmp.perUtenteDopo }] }),
    }),
  },
  {
    id: 'B12b',
    nome: 'Cambio di banner a metà periodo, NON dichiarato (tasso medio)',
    tipo: 'B',
    prepara: (rng) => ({
      sc: daIpotesi(rng, 0.6, 0, { cambioBanner: { giorno: 15, pAccetta: 0.35 } }),
      config: (e) => cfg(e.cmp.perUtente, 'stima', e),
    }),
  },
  {
    id: 'B13',
    nome: 'Ordini reali, altre perdite vere 20%, pubblico dichiarato «misto / non lo so»',
    tipo: 'B',
    prepara: (rng) => ({
      sc: conAltrePerdite(daIpotesi(rng, 0.6, 0.05), 0.2),
      config: (e) => cfg(0.6, 'stima', e, { ancora: ancoraTotale(e) }),
    }),
  },
  {
    id: 'B13b',
    nome: 'Ordini reali, altre perdite vere 20%, pubblico dichiarato «largo consumo» (sbagliato)',
    tipo: 'B',
    prepara: (rng) => ({
      sc: conAltrePerdite(daIpotesi(rng, 0.6, 0.05), 0.2),
      config: (e) => cfg(0.6, 'stima', e, { ancora: ancoraTotale(e, 'consumo') }),
    }),
  },
  {
    id: 'B15a',
    nome: 'Ad blocker al 12% che rifiutano di più e in parte nascondono il banner, SENZA ordini reali',
    tipo: 'B',
    prepara: (rng) => ({
      sc: daIpotesi(rng, 0.6, 0, { bloccoGA: 0.12, bloccoRapportoConsenso: 0.4, bloccoBanner: 0.25, altrePerdite: 0.02 }),
      config: (e) => cfg(e.cmp.perUtente, 'stima', e),
    }),
  },
  {
    id: 'B15b',
    nome: 'Lo stesso, CON ordini reali (pubblico «misto / non lo so»)',
    tipo: 'B',
    prepara: (rng) => ({
      sc: daIpotesi(rng, 0.6, 0, { bloccoGA: 0.12, bloccoRapportoConsenso: 0.4, bloccoBanner: 0.25, altrePerdite: 0.02 }),
      config: (e) => cfg(e.cmp.perUtente, 'stima', e, { ancora: ancoraTotale(e) }),
    }),
  },
  {
    id: 'B15c',
    nome: 'Pubblico tecnico: ad blocker al 35%, dichiarato «tecnico», CON ordini reali',
    tipo: 'B',
    prepara: (rng) => ({
      sc: daIpotesi(rng, 0.6, 0, { bloccoGA: 0.35, bloccoRapportoConsenso: 0.4, bloccoBanner: 0.25, altrePerdite: 0.02 }),
      config: (e) => cfg(e.cmp.perUtente, 'stima', e, { ancora: ancoraTotale(e, 'tecnico') }),
    }),
  },
  {
    id: 'B16a',
    nome: 'Consenso diverso tra mobile e desktop, solo tasso globale',
    tipo: 'B',
    prepara: (rng) => ({ sc: conDispositivi(daIpotesi(rng, 0.6, 0.05), 1.5), config: (e) => cfg(0.6, 'stima', e) }),
  },
  {
    id: 'B16b',
    nome: 'Come B16a, con i tassi per dispositivo',
    tipo: 'B',
    prepara: (rng) => ({ sc: conDispositivi(daIpotesi(rng, 0.6, 0.05), 1.5), config: (e) => cfg(0.6, 'stima', e, { device: tassiDichiarati(e) }) }),
  },
  {
    id: 'B16c',
    nome: 'Consenso diverso, stesse visite tra dispositivi (controllo)',
    tipo: 'B',
    prepara: (rng) => ({ sc: conDispositivi(daIpotesi(rng, 0.6, 0.05), 1), config: (e) => cfg(0.6, 'stima', e) }),
  },
  {
    id: 'B16d',
    nome: 'Come B16a, tasso globale dichiarato preciso',
    tipo: 'B',
    prepara: (rng) => ({ sc: conDispositivi(daIpotesi(rng, 0.6, 0.015), 1.5), config: (e) => cfg(0.6, 'preciso', e) }),
  },
  {
    id: 'B14',
    nome: 'Eventi chiave molto sovradispersi (a grappoli di 5)',
    tipo: 'B',
    prepara: (rng) => ({ sc: daIpotesi(rng, 0.6, 0.05, { grappolo: 5 }), config: (e) => cfg(0.6, 'stima', e) }),
  },
];

const mediana = (v: number[]): number => {
  const a = [...v].sort((x, y) => x - y);
  return a.length ? a[Math.floor(a.length / 2)] : NaN;
};

export function eseguiScenario(def: DefScenario, repliche: number, nSim: number, seme = 1): Riepilogo {
  const chiavi: Chiave[] = ['sessioni', 'utentiGiorno', 'eventi', 'transazioni', 'entrate', 'utentiPeriodo'];
  const acc = Object.fromEntries(chiavi.map((k) => [k, { in80: 0, in95: 0, err: [] as number[], amp: [] as number[], n: 0 }])) as Record<
    Chiave,
    { in80: number; in95: number; err: number[]; amp: number[]; n: number }
  >;
  const can = { sessioni: { in80: 0, in95: 0, n: 0 }, transazioni: { in80: 0, in95: 0, n: 0 } };
  for (let r = 0; r < repliche; r++) {
    const rng = new Rng(seme, r, 3);
    const { sc, config } = def.prepara(rng);
    const e = genera(sc, rng);
    const c = { ...config(e), nSim, seme: seme * 1000 + r };
    const ris = stima(e.dati, c);
    for (const k of chiavi) {
      const s = k === 'utentiPeriodo' ? ris.utentiPeriodo! : ris.metriche[k];
      const v = e.verita[k];
      if (!(v > 0)) continue;
      const a = acc[k];
      a.n++;
      if (v >= s.totale.p10 && v <= s.totale.p90) a.in80++;
      if (v >= s.totale.p2_5 && v <= s.totale.p97_5) a.in95++;
      a.err.push((s.totale.p50 - v) / v);
      a.amp.push((s.totale.p97_5 - s.totale.p2_5) / v);
    }
    for (const cs of ris.canali) {
      const v = e.veritaCanale[cs.canale];
      for (const k of ['sessioni', 'transazioni'] as const) {
        const t = cs.metriche[k].totale;
        can[k].n++;
        if (v[k] >= t.p10 && v[k] <= t.p90) can[k].in80++;
        if (v[k] >= t.p2_5 && v[k] <= t.p97_5) can[k].in95++;
      }
    }
  }
  const metriche = {} as Record<Chiave, Misura>;
  for (const k of chiavi) {
    const a = acc[k];
    metriche[k] = { cop80: a.in80 / a.n, cop95: a.in95 / a.n, errore: mediana(a.err), ampiezza95: mediana(a.amp) };
  }
  return {
    id: def.id,
    nome: def.nome,
    tipo: def.tipo,
    repliche,
    metriche,
    canali: {
      sessioni: { cop80: can.sessioni.in80 / can.sessioni.n, cop95: can.sessioni.in95 / can.sessioni.n },
      transazioni: { cop80: can.transazioni.in80 / can.transazioni.n, cop95: can.transazioni.in95 / can.transazioni.n },
    },
  };
}
