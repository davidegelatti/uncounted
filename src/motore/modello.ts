// Motore di stima: vedi METODO.md. Nessuna dipendenza dal DOM, usabile in Web Worker e in Node.
import { Rng, lgamma, logit } from './rng';

export interface Riga {
  /** Data in formato AAAA-MM-GG */
  data: string;
  canale: string;
  sessioni: number;
  utenti: number;
  eventi: number;
  transazioni: number;
  entrate: number;
}

export interface Dati {
  righe: Riga[];
  haUtenti: boolean;
  haEventi: boolean;
  haTransazioni: boolean;
  haEntrate: boolean;
}

export type Metrica = 'sessioni' | 'utentiGiorno' | 'eventi' | 'transazioni' | 'entrate';
export const METRICHE: Metrica[] = ['sessioni', 'utentiGiorno', 'eventi', 'transazioni', 'entrate'];

export interface PriorLN {
  mediana: number;
  /** Deviazione standard sulla scala logaritmica */
  sigma: number;
}

export type Precisione = 'preciso' | 'stima' | 'massima';
export const SD_PRECISIONE: Record<Precisione, number> = { preciso: 0.015, stima: 0.05, massima: 0.1 };

export type TassoInput =
  | { tipo: 'percentuale'; valore: number; precisione: Precisione }
  | { tipo: 'conteggi'; accettati: number; nonAccettati: number };

export type Misura = 'utente' | 'banner' | 'nonso';

export interface Config {
  tasso: TassoInput;
  misura: Misura;
  ignora: { modo: 'incluso' | 'escluso' | 'nonso'; quota?: number };
  /** Se presente sostituisce il valore globale: tasso e quota di sessioni osservate per device. */
  device?: { nome: string; tasso: number; quota: number }[];
  /** Tassi diversi a partire da una data (AAAA-MM-GG). */
  periodi?: { dal: string; tasso: number }[];
  /** Tassi noti per canale. */
  canali?: Record<string, number>;
  /** Dev. standard (logit) della variazione del consenso tra canali. */
  tauCanali: number;
  rFreq: PriorLN;
  rConv: PriorLN;
  rAov: PriorLN;
  rUtenti: PriorLN;
  utentiPeriodo?: number;
  ancora?: { dal: string; al: string; ordini: number; entrate?: number; altrePerdite: PriorLN };
  nSim: number;
  seme: number;
}

export const R_FREQ_PREDEFINITI: Record<Misura, PriorLN> = {
  utente: { mediana: 0.8, sigma: 0.3 },
  banner: { mediana: 0.6, sigma: 0.4 },
  nonso: { mediana: 0.7, sigma: 0.48 },
};
export const R_UTENTI_PREDEFINITI: Record<Misura, PriorLN> = {
  utente: { mediana: 1, sigma: 0.15 },
  banner: { mediana: 0.8, sigma: 0.4 },
  nonso: { mediana: 0.9, sigma: 0.4 },
};
export const SIGMA_MINIMA = 0.05;
export const IGNORA_PREDEFINITO = { mediana: 0.15, sigmaLogit: 0.75 };
export const ALTRE_PERDITE_PREDEFINITO: PriorLN = { mediana: 0.05, sigma: 0.55 };

export function configPredefinita(): Config {
  return {
    tasso: { tipo: 'percentuale', valore: 0.6, precisione: 'stima' },
    misura: 'utente',
    ignora: { modo: 'incluso' },
    tauCanali: 0.3,
    rFreq: { ...R_FREQ_PREDEFINITI.utente },
    rConv: { mediana: 0.4, sigma: 0.5 },
    rAov: { mediana: 1, sigma: 0.15 },
    rUtenti: { ...R_UTENTI_PREDEFINITI.utente },
    nSim: 4000,
    seme: 20261113,
  };
}

export interface Quantili {
  p2_5: number;
  p10: number;
  p50: number;
  p90: number;
  p97_5: number;
  media: number;
}

export interface StimaMetrica {
  osservato: number;
  totale: Quantili;
  perso: Quantili;
  /** Quota persa sul totale stimato (0–1) */
  quotaPersa: Quantili;
}

export interface StimaGiorno {
  data: string;
  metriche: Record<Metrica, { osservato: number; totale: Quantili }>;
}

export interface VoceSensibilita {
  chiave: 'consenso' | 'rFreq' | 'rConv' | 'rAov';
  basso: { valore: number; totali: Record<Metrica, number> };
  alto: { valore: number; totali: Record<Metrica, number> };
}

/** Avviso del motore: il testo sta nei file di lingua, qui c'è solo il codice. */
export interface Avviso {
  codice: 'ordini_senza_transazioni' | 'ordini_inferiori' | 'scontrino_diverso' | 'canali_incompatibili' | 'conflitto';
  parametri: Record<string, number>;
}

export interface Risultato {
  metriche: Record<Metrica, StimaMetrica>;
  utentiPeriodo: StimaMetrica | null;
  canali: { canale: string; metriche: Record<Metrica, StimaMetrica> }[];
  giorni: StimaGiorno[];
  parametri: {
    tassoEffettivo: Quantili;
    rFreq: Quantili;
    rConv: Quantili;
    rAov: Quantili;
    moltiplicatoreSessioni: Quantili;
  };
  /** Quote (0–1) dell'incertezza sul perso attribuibili a ciascuna fonte; null con ancoraggio. */
  scomposizione: Record<Metrica, { consenso: number; frequenza: number; conversione: number; scontrino: number; rumore: number }> | null;
  sensibilita: { centrale: Record<Metrica, number>; voci: VoceSensibilita[] };
  scalaSemplice: Record<Metrica, number>;
  ancora: {
    attivo: boolean;
    /** Vero se r_conv calibrato esce dal margine plausibile dell'ipotesi di partenza. */
    conflitto: boolean;
    ordiniMancanti: number;
    transazioniOsservate: number;
    rConvPrior: PriorLN;
    rAovCalibrato: boolean;
  } | null;
  avvisi: Avviso[];
  diagnostica: { nSim: number; canali: number; giorni: number; cvOrdine: number; kappaEventi: number; kappaTransazioni: number };
}

const limita = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

export function quantili(v: ArrayLike<number>): Quantili {
  const a = Float64Array.from(v as ArrayLike<number>).sort();
  const n = a.length;
  const q = (p: number): number => {
    if (n === 0) return 0;
    const h = (n - 1) * p;
    const i = Math.floor(h);
    const j = Math.min(n - 1, i + 1);
    return a[i] + (a[j] - a[i]) * (h - i);
  };
  let s = 0;
  for (let i = 0; i < n; i++) s += a[i];
  return { p2_5: q(0.025), p10: q(0.1), p50: q(0.5), p90: q(0.9), p97_5: q(0.975), media: n ? s / n : 0 };
}

function varianza(v: Float64Array): number {
  let m = 0;
  for (let i = 0; i < v.length; i++) m += v[i];
  m /= v.length;
  let s = 0;
  for (let i = 0; i < v.length; i++) s += (v[i] - m) * (v[i] - m);
  return s / Math.max(1, v.length - 1);
}

/** Stima empirica dei parametri del modello Gamma–Poisson a due livelli (canale, giorno). */
function stimaGerarchiaTassi(
  conteggi: Float64Array,
  sess: Float64Array,
  canaleDi: Int32Array,
  C: number,
): { lam0: number; a: number; kappa: number; Kc: Float64Array; Sc: Float64Array } {
  const Kc = new Float64Array(C);
  const Sc = new Float64Array(C);
  for (let i = 0; i < conteggi.length; i++) {
    Kc[canaleDi[i]] += conteggi[i];
    Sc[canaleDi[i]] += sess[i];
  }
  let K = 0;
  let S = 0;
  let nC = 0;
  let sumS2 = 0;
  for (let c = 0; c < C; c++) {
    K += Kc[c];
    S += Sc[c];
    sumS2 += Sc[c] * Sc[c];
    if (Sc[c] > 0) nC++;
  }
  const lam0 = S > 0 ? K / S : 0;
  let a = 2;
  if (nC >= 3 && lam0 > 0) {
    let num = 0;
    for (let c = 0; c < C; c++) if (Sc[c] > 0) num += Sc[c] * (Kc[c] / Sc[c] - lam0) ** 2;
    const v = (num - (nC - 1) * lam0) / (S - sumS2 / S);
    a = v > 0 ? limita((lam0 * lam0) / v, 0.5, 200) : 200;
  }
  let num = 0;
  let den = 0;
  for (let i = 0; i < conteggi.length; i++) {
    const c = canaleDi[i];
    if (Sc[c] <= 0) continue;
    const e = (sess[i] * Kc[c]) / Sc[c];
    num += e * e;
    den += (conteggi[i] - e) ** 2 - e;
  }
  const kappa = den > 0 && num > 0 ? limita(num / den, 0.3, 1e4) : 1e4;
  return { lam0, a, kappa, Kc, Sc };
}

function sigmaLogitDaSd(m: number, sd: number): number {
  const mm = limita(m, 0.02, 0.98);
  return sd / (mm * (1 - mm));
}

const tassoSicuro = (p: number): number => limita(p, 0.005, 0.995);

/** Aggiunge chi ignora il banner: p → p × (1 − q). */
function conIgnora(odds: number, q: number): number {
  if (q <= 0) return odds;
  const p = (1 / (1 + odds)) * (1 - q);
  return (1 - p) / p;
}

export function tassoNominale(cfg: Config): number {
  if (cfg.device && cfg.device.length) {
    let w = 0;
    let o = 0;
    for (const d of cfg.device) {
      const t = tassoSicuro(d.tasso);
      w += d.quota;
      o += (d.quota * (1 - t)) / t;
    }
    return w > 0 ? 1 / (1 + o / w) : 0.5;
  }
  if (cfg.tasso.tipo === 'percentuale') return tassoSicuro(cfg.tasso.valore);
  const n = cfg.tasso.accettati + cfg.tasso.nonAccettati;
  return tassoSicuro((cfg.tasso.accettati + 0.5) / (n + 1));
}

const GRIGLIA = 240;
const LN_R_MIN = Math.log(0.005);
const LN_R_MAX = Math.log(8);
const PASSO = (LN_R_MAX - LN_R_MIN) / (GRIGLIA - 1);

export function stima(dati: Dati, cfg: Config, progresso?: (frazione: number) => void): Risultato {
  const avvisi: Avviso[] = [];
  const righe = dati.righe;
  const n = righe.length;
  const N = Math.max(200, Math.floor(cfg.nSim));
  if (n === 0) throw new Error('nessuna_riga');

  // ---------- Indici ----------
  const nomiCanali = [...new Set(righe.map((r) => r.canale))];
  const sessPerCanale = new Map<string, number>();
  for (const r of righe) sessPerCanale.set(r.canale, (sessPerCanale.get(r.canale) ?? 0) + r.sessioni);
  nomiCanali.sort((x, y) => (sessPerCanale.get(y) ?? 0) - (sessPerCanale.get(x) ?? 0));
  const idxCanale = new Map(nomiCanali.map((c, i) => [c, i]));
  const date = [...new Set(righe.map((r) => r.data))].sort();
  const idxData = new Map(date.map((d, i) => [d, i]));
  const C = nomiCanali.length;
  const D = date.length;

  const periodi = [...(cfg.periodi ?? [])].filter((p) => p.dal).sort((x, y) => (x.dal < y.dal ? -1 : 1));
  const nSeg = periodi.length + 1;
  const segDi = (data: string): number => {
    let s = 0;
    for (let k = 0; k < periodi.length; k++) if (data >= periodi[k].dal) s = k + 1;
    return s;
  };

  const cDi = new Int32Array(n);
  const dDi = new Int32Array(n);
  const sDi = new Int32Array(n);
  const S = new Float64Array(n);
  const U = new Float64Array(n);
  const K = new Float64Array(n);
  const T = new Float64Array(n);
  const R = new Float64Array(n);
  const Ssc = new Float64Array(nSeg * C);
  const Sseg = new Float64Array(nSeg);
  const oss: Record<Metrica, number> = { sessioni: 0, utentiGiorno: 0, eventi: 0, transazioni: 0, entrate: 0 };
  for (let i = 0; i < n; i++) {
    const r = righe[i];
    cDi[i] = idxCanale.get(r.canale)!;
    dDi[i] = idxData.get(r.data)!;
    sDi[i] = segDi(r.data);
    S[i] = Math.max(0, r.sessioni);
    U[i] = Math.max(0, r.utenti);
    K[i] = Math.max(0, r.eventi);
    T[i] = Math.max(0, r.transazioni);
    R[i] = Math.max(0, r.entrate);
    Ssc[sDi[i] * C + cDi[i]] += S[i];
    Sseg[sDi[i]] += S[i];
    oss.sessioni += S[i];
    oss.utentiGiorno += U[i];
    oss.eventi += K[i];
    oss.transazioni += T[i];
    oss.entrate += R[i];
  }
  if (oss.sessioni <= 0) throw new Error('nessuna_sessione');

  // ---------- Gerarchie empiriche ----------
  const gK = stimaGerarchiaTassi(K, S, cDi, C);
  const gT = stimaGerarchiaTassi(T, S, cDi, C);

  // Scontrino medio: variabilità del singolo ordine e shrinkage tra canali.
  const Rc = new Float64Array(C);
  const Tc = gT.Kc;
  for (let i = 0; i < n; i++) Rc[cDi[i]] += R[i];
  const mu0 = oss.transazioni > 0 ? oss.entrate / oss.transazioni : 0;
  let cv = 0.8;
  let n0 = 5;
  {
    let somma = 0;
    let nRighe = 0;
    const canaliConOrdini = new Set<number>();
    for (let i = 0; i < n; i++) {
      const c = cDi[i];
      if (T[i] > 0 && Tc[c] > 0 && Rc[c] > 0) {
        const mc = Rc[c] / Tc[c];
        somma += (T[i] * (R[i] / T[i] - mc) ** 2) / (mc * mc);
        nRighe++;
        canaliConOrdini.add(c);
      }
    }
    const gdl = nRighe - canaliConOrdini.size;
    if (gdl >= 5) cv = limita(Math.sqrt(somma / gdl), 0.15, 3);
    const nC = canaliConOrdini.size;
    if (nC >= 3 && mu0 > 0) {
      let num = 0;
      let sumT2 = 0;
      for (const c of canaliConOrdini) {
        num += Tc[c] * (Rc[c] / Tc[c] - mu0) ** 2;
        sumT2 += Tc[c] * Tc[c];
      }
      const tau2 = (num - (nC - 1) * cv * cv * mu0 * mu0) / (oss.transazioni - sumT2 / oss.transazioni);
      n0 = tau2 > 0 ? limita((cv * cv * mu0 * mu0) / tau2, 1, 500) : 500;
    }
  }

  // ---------- Tasso di consenso: componenti ----------
  const sdBase =
    cfg.tasso.tipo === 'percentuale'
      ? SD_PRECISIONE[cfg.tasso.precisione]
      : (() => {
          const nn = Math.max(1, cfg.tasso.accettati + cfg.tasso.nonAccettati);
          const m = tassoNominale({ ...cfg, device: undefined });
          return Math.sqrt((m * (1 - m)) / nn + 0.01 * 0.01);
        })();
  const sdAltri = cfg.tasso.tipo === 'percentuale' ? sdBase : SD_PRECISIONE.stima;

  type Componente = { lp: number; s: number; w: number };
  const compSeg: Componente[][] = [];
  if (cfg.device && cfg.device.length) {
    const tot = cfg.device.reduce((x, d) => x + d.quota, 0) || 1;
    compSeg.push(
      cfg.device.map((d) => {
        const t = tassoSicuro(d.tasso);
        return { lp: logit(t), s: sigmaLogitDaSd(t, sdAltri), w: d.quota / tot };
      }),
    );
  } else {
    const m = tassoNominale(cfg);
    compSeg.push([{ lp: logit(m), s: sigmaLogitDaSd(m, sdBase), w: 1 }]);
  }
  for (const p of periodi) {
    const t = tassoSicuro(p.tasso);
    compSeg.push([{ lp: logit(t), s: sigmaLogitDaSd(t, sdAltri), w: 1 }]);
  }
  const oddsSeg = (s: number, z: number): number => {
    let o = 0;
    for (const k of compSeg[s]) o += k.w * Math.exp(-(k.lp + k.s * z));
    return o;
  };

  const fisso = new Float64Array(C).fill(NaN);
  const sFisso = new Float64Array(C);
  let haFissi = false;
  for (const [nome, t0] of Object.entries(cfg.canali ?? {})) {
    const c = idxCanale.get(nome);
    if (c === undefined || !(t0 > 0 && t0 < 1)) continue;
    const t = tassoSicuro(t0);
    fisso[c] = logit(t);
    sFisso[c] = sigmaLogitDaSd(t, sdAltri);
    haFissi = true;
  }

  // ---------- Ancoraggio: preparazione ----------
  let ancoraAttiva = false;
  let ancoraEntrate = false;
  let inAncora: Uint8Array | null = null;
  let TossAncora = 0;
  let RossAncora = 0;
  const anc = cfg.ancora;
  if (anc && anc.ordini > 0) {
    inAncora = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      if (righe[i].data >= anc.dal && righe[i].data <= anc.al) {
        inAncora[i] = 1;
        TossAncora += T[i];
        RossAncora += R[i];
      }
    }
    if (!dati.haTransazioni || TossAncora <= 0) {
      avvisi.push({ codice: 'ordini_senza_transazioni', parametri: {} });
    } else if (anc.ordini < TossAncora) {
      avvisi.push({ codice: 'ordini_inferiori', parametri: { ordini: anc.ordini, transazioni: Math.round(TossAncora) } });
    } else {
      ancoraAttiva = true;
      if (anc.entrate && anc.entrate > 0 && RossAncora > 0) {
        const rapporto = anc.entrate / anc.ordini / (RossAncora / TossAncora);
        if (Math.abs(rapporto - 1) > 0.25) {
          avvisi.push({ codice: 'scontrino_diverso', parametri: { percento: Math.round(Math.abs(rapporto - 1) * 100) } });
        } else if (anc.entrate > RossAncora) {
          ancoraEntrate = true;
        }
      }
    }
  }

  // ---------- Fase parametri (riproducibile per indice di simulazione) ----------
  const P = {
    odds: new Float64Array(nSeg * C),
    rFreq: 1,
    rConv: 1,
    zK: 0,
    rAov: 1,
    rUt: 1,
    g: 0,
    lamK: new Float64Array(C),
    lamT: new Float64Array(C),
    mu: new Float64Array(C),
    oddsGlob: 0,
  };
  let nonRicentrati = 0;
  const delta = new Float64Array(C);

  const estraiParametri = (i: number, conta: boolean): void => {
    const g = new Rng(cfg.seme, i, 0);
    const z = g.normale();
    // chi ignora il banner
    let q = 0;
    const zq = g.normale();
    const uq = g.u();
    if (cfg.ignora.modo !== 'incluso' && !(cfg.ignora.modo === 'nonso' && uq < 0.5)) {
      const quota = cfg.ignora.quota;
      if (quota !== undefined && quota > 0 && quota < 1) {
        q = 1 / (1 + Math.exp(-(logit(quota) + sigmaLogitDaSd(quota, 0.03) * zq)));
      } else if (quota === undefined) {
        q = 1 / (1 + Math.exp(-(logit(IGNORA_PREDEFINITO.mediana) + IGNORA_PREDEFINITO.sigmaLogit * zq)));
      }
    }
    P.rFreq = cfg.rFreq.mediana * Math.exp(cfg.rFreq.sigma * g.normale());
    P.rConv = cfg.rConv.mediana * Math.exp(cfg.rConv.sigma * g.normale());
    P.zK = g.normale();
    P.rAov = cfg.rAov.mediana * Math.exp(cfg.rAov.sigma * g.normale());
    P.rUt = cfg.rUtenti.mediana * Math.exp(cfg.rUtenti.sigma * g.normale());
    const zg = g.normale();
    P.g = anc ? Math.min(0.6, anc.altrePerdite.mediana * Math.exp(anc.altrePerdite.sigma * zg)) : 0;
    for (let c = 0; c < C; c++) delta[c] = cfg.tauCanali > 0 ? cfg.tauCanali * g.normale() : 0;

    let sommaOdds = 0;
    for (let s = 0; s < nSeg; s++) {
      const o = conIgnora(oddsSeg(s, z), q);
      let fissi = 0;
      let den = 0;
      for (let c = 0; c < C; c++) {
        const Sc = Ssc[s * C + c];
        if (!Number.isNaN(fisso[c])) {
          const oc = conIgnora(Math.exp(-(fisso[c] + sFisso[c] * z)), q);
          P.odds[s * C + c] = oc;
          fissi += Sc * oc;
        } else {
          den += Sc * Math.exp(-delta[c]);
        }
      }
      let k = o;
      const bersaglio = Sseg[s] * o - fissi;
      if (den > 0) {
        const kk = bersaglio / den;
        if (kk > 0.2 * o && kk < 5 * o) k = kk;
        else if (haFissi && conta) nonRicentrati++;
      }
      for (let c = 0; c < C; c++) {
        if (Number.isNaN(fisso[c])) P.odds[s * C + c] = k * Math.exp(-delta[c]);
        sommaOdds += Ssc[s * C + c] * P.odds[s * C + c];
      }
    }
    P.oddsGlob = sommaOdds / oss.sessioni;

    for (let c = 0; c < C; c++) {
      P.lamK[c] = gK.lam0 > 0 ? g.gamma(gK.a + gK.Kc[c]) / (gK.a / gK.lam0 + gK.Sc[c]) : 0;
      P.lamT[c] = gT.lam0 > 0 ? g.gamma(gT.a + gT.Kc[c]) / (gT.a / gT.lam0 + gT.Sc[c]) : 0;
      if (mu0 > 0) {
        const mc = (Rc[c] + n0 * mu0) / (Tc[c] + n0);
        const s = cv / Math.sqrt(Tc[c] + n0);
        P.mu[c] = mc * Math.exp(s * g.normale() - (s * s) / 2);
      } else P.mu[c] = 0;
    }
  };

  /** Transazioni perse attese nel periodo di ancoraggio con r_conv = 1. */
  let scontrinoAtteso = 0;
  const attesePerseAncora = (): number => {
    let M = 0;
    let MR = 0;
    for (let i = 0; i < n; i++) {
      if (!inAncora![i]) continue;
      const c = cDi[i];
      const lam = (gT.kappa + T[i]) / (gT.kappa / P.lamT[c] + S[i]);
      const e = S[i] * P.odds[sDi[i] * C + c] * P.rFreq * lam;
      M += e;
      MR += e * P.mu[c];
    }
    // scontrino medio atteso degli ordini persi con r_aov = 1 (tiene conto del diverso mix di canali)
    scontrinoAtteso = M > 0 ? MR / M : RossAncora / TossAncora;
    return M;
  };

  const logw = new Float64Array(GRIGLIA);
  const lnMedConv = Math.log(cfg.rConv.mediana);
  /** Riempie la griglia della distribuzione di r_conv dato il dato reale; restituisce log della verosimiglianza marginale. */
  const grigliaConv = (M: number, Dm: number): number => {
    let mx = -Infinity;
    const lnM = Math.log(M);
    const lg = lgamma(Dm + 1);
    for (let j = 0; j < GRIGLIA; j++) {
      const x = LN_R_MIN + j * PASSO;
      const zz = (x - lnMedConv) / cfg.rConv.sigma;
      const v = -0.5 * zz * zz + Dm * (lnM + x) - M * Math.exp(x) - lg;
      logw[j] = v;
      if (v > mx) mx = v;
    }
    let s = 0;
    for (let j = 0; j < GRIGLIA; j++) s += Math.exp(logw[j] - mx);
    return mx + Math.log(s);
  };
  const estraiDaGriglia = (g: Rng): number => {
    let mx = -Infinity;
    for (let j = 0; j < GRIGLIA; j++) if (logw[j] > mx) mx = logw[j];
    let s = 0;
    for (let j = 0; j < GRIGLIA; j++) s += Math.exp(logw[j] - mx);
    let u = g.u() * s;
    let j = 0;
    for (; j < GRIGLIA - 1; j++) {
      u -= Math.exp(logw[j] - mx);
      if (u <= 0) break;
    }
    return Math.exp(LN_R_MIN + (j + g.u() - 0.5) * PASSO);
  };
  /** Osservazione (su scala log) di r_aov ricavata dalle entrate reali, con la sua varianza. */
  const ossAov = (Dm: number): { y: number; v: number } | null => {
    if (!ancoraEntrate || Dm < 3) return null;
    const DR = anc!.entrate! * (1 - P.g) - RossAncora;
    if (DR <= 0) return null;
    const y = Math.log(DR / Dm / scontrinoAtteso);
    return { y, v: (cv * cv) / Dm + (cv * cv) / TossAncora };
  };


  // ---------- Simulazione ----------
  const tot: Record<Metrica, Float64Array> = {
    sessioni: new Float64Array(N),
    utentiGiorno: new Float64Array(N),
    eventi: new Float64Array(N),
    transazioni: new Float64Array(N),
    entrate: new Float64Array(N),
  };
  const perCanale: Record<Metrica, Float32Array> = {
    sessioni: new Float32Array(C * N),
    utentiGiorno: new Float32Array(C * N),
    eventi: new Float32Array(C * N),
    transazioni: new Float32Array(C * N),
    entrate: new Float32Array(C * N),
  };
  const perGiorno: Record<Metrica, Float32Array> = {
    sessioni: new Float32Array(D * N),
    utentiGiorno: new Float32Array(D * N),
    eventi: new Float32Array(D * N),
    transazioni: new Float32Array(D * N),
    entrate: new Float32Array(D * N),
  };
  const lnOdds = new Float64Array(N);
  const lnRf = new Float64Array(N);
  const lnRc = new Float64Array(N);
  const lnRck = new Float64Array(N);
  const lnRa = new Float64Array(N);
  const utPeriodo = new Float64Array(N);
  const Lt = new Float64Array(n);
  const Lr = new Float64Array(n);
  const mediaT = new Float64Array(n);
  const base = 0;

  for (let m = 0; m < N; m++) {
    const i = m;
    estraiParametri(i, true);
    const g = new Rng(cfg.seme, m, 1);
    let bersaglioT = -1;
    let bersaglioR = -1;
    if (ancoraAttiva) {
      const M = attesePerseAncora();
      const Dm = Math.max(0, anc!.ordini * (1 - P.g) - TossAncora);
      grigliaConv(M, Dm);
      P.rConv = estraiDaGriglia(g);
      bersaglioT = Dm;
      const oa = ossAov(Dm);
      if (oa) {
        const v0 = cfg.rAov.sigma ** 2;
        const vp = 1 / (1 / v0 + 1 / oa.v);
        const mp = vp * (Math.log(cfg.rAov.mediana) / v0 + oa.y / oa.v);
        P.rAov = Math.exp(mp + Math.sqrt(vp) * g.normale());
        bersaglioR = anc!.entrate! * (1 - P.g) - RossAncora;
      }
    }
    const rConvK = P.rConv * Math.exp(0.75 * cfg.rConv.sigma * P.zK);
    lnOdds[m] = Math.log(P.oddsGlob);
    lnRf[m] = Math.log(P.rFreq);
    lnRc[m] = Math.log(P.rConv);
    lnRck[m] = Math.log(rConvK);
    lnRa[m] = Math.log(P.rAov);
    if (cfg.utentiPeriodo) utPeriodo[m] = cfg.utentiPeriodo * P.oddsGlob * P.rUt;

    let sommaAncT = 0;
    let sommaAncMedia = 0;
    let sommaAncR = 0;
    for (let r = 0; r < n; r++) {
      const c = cDi[r];
      const d = dDi[r];
      const s = S[r];
      if (s <= 0) {
        Lt[r] = 0;
        Lr[r] = 0;
        mediaT[r] = 0;
        continue;
      }
      const molt = P.odds[sDi[r] * C + c] * P.rFreq;
      const L = g.poisson(molt * (s < 50 ? g.gamma(s) : s));
      const Ul = (L * U[r]) / s;
      let Kl = 0;
      if (P.lamK[c] > 0) {
        const lam =
          gK.kappa >= 1000
            ? (gK.kappa + K[r]) / (gK.kappa / P.lamK[c] + s)
            : g.gamma(gK.kappa + K[r]) / (gK.kappa / P.lamK[c] + s);
        Kl = g.poisson(L * lam * rConvK);
      }
      let Tl = 0;
      let Rl = 0;
      let mT = 0;
      if (P.lamT[c] > 0) {
        const lam =
          gT.kappa >= 1000
            ? (gT.kappa + T[r]) / (gT.kappa / P.lamT[c] + s)
            : g.gamma(gT.kappa + T[r]) / (gT.kappa / P.lamT[c] + s);
        mT = L * lam * P.rConv;
        Tl = g.poisson(mT);
        if (Tl > 0 && P.mu[c] > 0) Rl = g.gamma(Tl / (cv * cv)) * P.mu[c] * P.rAov * cv * cv;
      }
      if (ancoraAttiva && inAncora![r]) {
        Lt[r] = Tl;
        Lr[r] = Rl;
        mediaT[r] = mT;
        sommaAncT += Tl;
        sommaAncMedia += mT;
        sommaAncR += Rl;
      } else {
        tot.transazioni[m] += Tl;
        tot.entrate[m] += Rl;
        perCanale.transazioni[c * N + m] += Tl;
        perCanale.entrate[c * N + m] += Rl;
        perGiorno.transazioni[d * N + m] += Tl;
        perGiorno.entrate[d * N + m] += Rl;
      }
      tot.sessioni[m] += L;
      tot.utentiGiorno[m] += Ul;
      tot.eventi[m] += Kl;
      perCanale.sessioni[c * N + m] += L;
      perCanale.utentiGiorno[c * N + m] += Ul;
      perCanale.eventi[c * N + m] += Kl;
      perGiorno.sessioni[d * N + m] += L;
      perGiorno.utentiGiorno[d * N + m] += Ul;
      perGiorno.eventi[d * N + m] += Kl;
    }
    if (ancoraAttiva) {
      // Nel periodo ancorato il totale delle transazioni perse è (quasi) noto: si ripartisce tra le righe.
      const usaMedie = sommaAncT <= 0;
      const fT = usaMedie ? (sommaAncMedia > 0 ? bersaglioT / sommaAncMedia : 0) : bersaglioT / sommaAncT;
      const scontrino = scontrinoAtteso * P.rAov;
      let sommaR2 = 0;
      for (let r = 0; r < n; r++) {
        if (!inAncora![r]) continue;
        const t = (usaMedie ? mediaT[r] : Lt[r]) * fT;
        if (usaMedie || Lr[r] <= 0) Lr[r] = t * scontrino;
        else Lr[r] *= fT;
        Lt[r] = t;
        sommaR2 += Lr[r];
      }
      void sommaAncR;
      const fR = bersaglioR > 0 && sommaR2 > 0 ? bersaglioR / sommaR2 : 1;
      for (let r = 0; r < n; r++) {
        if (!inAncora![r]) continue;
        const c = cDi[r];
        const d = dDi[r];
        const rl = Lr[r] * fR;
        tot.transazioni[m] += Lt[r];
        tot.entrate[m] += rl;
        perCanale.transazioni[c * N + m] += Lt[r];
        perCanale.entrate[c * N + m] += rl;
        perGiorno.transazioni[d * N + m] += Lt[r];
        perGiorno.entrate[d * N + m] += rl;
      }
    }
    if (progresso && m % 100 === 0) progresso(base + ((1 - base) * m) / N);
  }

  if (nonRicentrati > N / 10) {
    avvisi.push({ codice: 'canali_incompatibili', parametri: {} });
  }

  // ---------- Riepiloghi ----------
  const riepiloga = (osservato: number, perso: ArrayLike<number>): StimaMetrica => {
    const m = perso.length;
    const t = new Float64Array(m);
    const q = new Float64Array(m);
    for (let i = 0; i < m; i++) {
      t[i] = osservato + perso[i];
      q[i] = t[i] > 0 ? perso[i] / t[i] : 0;
    }
    return { osservato, totale: quantili(t), perso: quantili(perso), quotaPersa: quantili(q) };
  };

  const metriche = {} as Record<Metrica, StimaMetrica>;
  for (const k of METRICHE) metriche[k] = riepiloga(oss[k], tot[k]);

  const ossCanale: Record<Metrica, Float64Array> = {
    sessioni: new Float64Array(C),
    utentiGiorno: new Float64Array(C),
    eventi: new Float64Array(C),
    transazioni: new Float64Array(C),
    entrate: new Float64Array(C),
  };
  const ossGiorno: Record<Metrica, Float64Array> = {
    sessioni: new Float64Array(D),
    utentiGiorno: new Float64Array(D),
    eventi: new Float64Array(D),
    transazioni: new Float64Array(D),
    entrate: new Float64Array(D),
  };
  for (let i = 0; i < n; i++) {
    const v: Record<Metrica, number> = { sessioni: S[i], utentiGiorno: U[i], eventi: K[i], transazioni: T[i], entrate: R[i] };
    for (const k of METRICHE) {
      ossCanale[k][cDi[i]] += v[k];
      ossGiorno[k][dDi[i]] += v[k];
    }
  }
  const canali = nomiCanali.map((canale, c) => {
    const m = {} as Record<Metrica, StimaMetrica>;
    for (const k of METRICHE) m[k] = riepiloga(ossCanale[k][c], perCanale[k].subarray(c * N, (c + 1) * N));
    return { canale, metriche: m };
  });
  const giorni: StimaGiorno[] = date.map((data, d) => {
    const m = {} as StimaGiorno['metriche'];
    for (const k of METRICHE) {
      const o = ossGiorno[k][d];
      const q = quantili(perGiorno[k].subarray(d * N, (d + 1) * N));
      m[k] = {
        osservato: o,
        totale: { p2_5: o + q.p2_5, p10: o + q.p10, p50: o + q.p50, p90: o + q.p90, p97_5: o + q.p97_5, media: o + q.media },
      };
    }
    return { data, metriche: m };
  });

  const esp = (v: Float64Array, f: (x: number) => number): Float64Array => v.map(f);
  const qOdds = quantili(esp(lnOdds, Math.exp));
  const qRf = quantili(esp(lnRf, Math.exp));
  const qRc = quantili(esp(lnRc, Math.exp));
  const qRck = quantili(esp(lnRck, Math.exp));
  const qRa = quantili(esp(lnRa, Math.exp));
  const molt = new Float64Array(N);
  for (let i = 0; i < N; i++) molt[i] = 1 + tot.sessioni[i] / oss.sessioni;

  // Ancoraggio: gli ordini reali aggiornano r_conv e r_aov, non le altre ipotesi (vedi METODO.md §5.2).
  let conflitto = false;
  if (ancoraAttiva) {
    const lo = cfg.rConv.mediana * Math.exp(-1.96 * cfg.rConv.sigma);
    const hi = cfg.rConv.mediana * Math.exp(1.96 * cfg.rConv.sigma);
    conflitto = qRc.p50 < lo || qRc.p50 > hi;
    if (conflitto) {
      avvisi.push({ codice: 'conflitto', parametri: {} });
    }
  }

  let scomposizione: Risultato['scomposizione'] = null;
  if (!ancoraAttiva) {
    const vO = varianza(lnOdds);
    const vF = varianza(lnRf);
    const vC = varianza(lnRc);
    const vCk = varianza(lnRck);
    const vA = varianza(lnRa);
    const quote = (perso: Float64Array, parti: number[]): { consenso: number; frequenza: number; conversione: number; scontrino: number; rumore: number } => {
      const vt = varianza(perso.map((x) => Math.log(Math.max(x, 0.5))));
      const somma = parti.reduce((x, y) => x + y, 0);
      const denom = Math.max(vt, somma, 1e-12);
      return {
        consenso: parti[0] / denom,
        frequenza: parti[1] / denom,
        conversione: parti[2] / denom,
        scontrino: parti[3] / denom,
        rumore: Math.max(0, 1 - somma / denom),
      };
    };
    scomposizione = {
      sessioni: quote(tot.sessioni, [vO, vF, 0, 0]),
      utentiGiorno: quote(tot.utentiGiorno, [vO, vF, 0, 0]),
      eventi: quote(tot.eventi, [vO, vF, vCk, 0]),
      transazioni: quote(tot.transazioni, [vO, vF, vC, 0]),
      entrate: quote(tot.entrate, [vO, vF, vC, vA]),
    };
  }

  const puntuale = (o: number, rf: number, rc: number, rck: number, ra: number): Record<Metrica, number> => ({
    sessioni: oss.sessioni * (1 + o * rf),
    utentiGiorno: oss.utentiGiorno * (1 + o * rf),
    eventi: oss.eventi * (1 + o * rf * rck),
    transazioni: oss.transazioni * (1 + o * rf * rc),
    entrate: oss.entrate * (1 + o * rf * rc * ra),
  });
  const pDi = (o: number): number => 1 / (1 + o);
  const sensibilita: Risultato['sensibilita'] = {
    centrale: puntuale(qOdds.p50, qRf.p50, qRc.p50, qRck.p50, qRa.p50),
    voci: [
      {
        chiave: 'consenso',
        basso: { valore: pDi(qOdds.p97_5), totali: puntuale(qOdds.p97_5, qRf.p50, qRc.p50, qRck.p50, qRa.p50) },
        alto: { valore: pDi(qOdds.p2_5), totali: puntuale(qOdds.p2_5, qRf.p50, qRc.p50, qRck.p50, qRa.p50) },
      },
      {
        chiave: 'rFreq',
        basso: { valore: qRf.p2_5, totali: puntuale(qOdds.p50, qRf.p2_5, qRc.p50, qRck.p50, qRa.p50) },
        alto: { valore: qRf.p97_5, totali: puntuale(qOdds.p50, qRf.p97_5, qRc.p50, qRck.p50, qRa.p50) },
      },
      {
        chiave: 'rConv',
        basso: { valore: qRc.p2_5, totali: puntuale(qOdds.p50, qRf.p50, qRc.p2_5, qRck.p2_5, qRa.p50) },
        alto: { valore: qRc.p97_5, totali: puntuale(qOdds.p50, qRf.p50, qRc.p97_5, qRck.p97_5, qRa.p50) },
      },
      {
        chiave: 'rAov',
        basso: { valore: qRa.p2_5, totali: puntuale(qOdds.p50, qRf.p50, qRc.p50, qRck.p50, qRa.p2_5) },
        alto: { valore: qRa.p97_5, totali: puntuale(qOdds.p50, qRf.p50, qRc.p50, qRck.p50, qRa.p97_5) },
      },
    ],
  };

  // Scala semplice: osservato ÷ tasso dichiarato, senza altre ipotesi.
  let oddsNom = 0;
  for (let s = 0; s < nSeg; s++) oddsNom += Sseg[s] * oddsSeg(s, 0);
  oddsNom /= oss.sessioni;
  const scalaSemplice = {} as Record<Metrica, number>;
  for (const k of METRICHE) scalaSemplice[k] = oss[k] * (1 + oddsNom);

  if (progresso) progresso(1);
  return {
    metriche,
    utentiPeriodo: cfg.utentiPeriodo ? riepiloga(cfg.utentiPeriodo, utPeriodo) : null,
    canali,
    giorni,
    parametri: {
      tassoEffettivo: quantili(esp(lnOdds, (x) => 1 / (1 + Math.exp(x)))),
      rFreq: qRf,
      rConv: qRc,
      rAov: qRa,
      moltiplicatoreSessioni: quantili(molt),
    },
    scomposizione,
    sensibilita,
    scalaSemplice,
    ancora: anc
      ? {
          attivo: ancoraAttiva,
          conflitto,
          ordiniMancanti: anc.ordini - TossAncora,
          transazioniOsservate: TossAncora,
          rConvPrior: cfg.rConv,
          rAovCalibrato: ancoraEntrate && ancoraAttiva,
        }
      : null,
    avvisi,
    diagnostica: { nSim: N, canali: C, giorni: D, cvOrdine: cv, kappaEventi: gK.kappa, kappaTransazioni: gT.kappa },
  };
}
