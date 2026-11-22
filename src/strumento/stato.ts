// Stato dello strumento e regole derivate (esito del Consent Mode, completezza, configurazione del motore).
// Nessun valore che l'utente può conoscere è preimpostato: i campi partono vuoti.
import {
  configPredefinita,
  R_FREQ_PREDEFINITI,
  R_UTENTI_PREDEFINITI,
  SIGMA_MINIMA,
  type Config,
  type Dati,
  type Metrica,
  type Misura,
  type Precisione,
  type PriorLN,
} from '../motore/modello';
import type { AvvisoCsv, ErroreCsv, InfoCsv } from '../parser';
import { ALTRE_PERDITE_PUBBLICO, type Pubblico } from './pubblico';
import { utentiDaTotali } from './totali';

export type ChiaveIpotesi = 'rFreq' | 'rConv' | 'rAov';
export const IPOTESI: ChiaveIpotesi[] = ['rFreq', 'rConv', 'rAov'];
export type StatoIpotesi = 'pred' | 'conf' | 'mod';
export type Esito = 'daRispondere' | 'stima' | 'incerto' | 'blocco';
export type Origine = 'utente' | 'esempio' | 'link';

export interface FileCaricato {
  nome: string;
  testo: string;
  dati: Dati;
  info: InfoCsv;
  avvisi: AvvisoCsv[];
}

export interface Stato {
  fase: 'avvio' | 'banco';
  origine: Origine;
  file: FileCaricato | null;
  erroreFile: { nome: string; errori: ErroreCsv[] } | null;
  /** Secondo export (soli dati osservati) per il confronto con la modellazione di Google */
  file2: { nome: string; dati: Dati; righe: number } | null;
  colonnaEventi: string;
  valuta: string;

  cm: '' | 'basic' | 'advanced' | 'nonso';
  identita: '' | 'combinata' | 'osservata' | 'nonso';
  icona: '' | 'inclusi' | 'no' | 'nonso';

  tasso: string;
  precisione: '' | Precisione;
  misura: '' | Misura;
  ignora: '' | 'incluso' | 'escluso' | 'nonso';
  quotaIgnora: string;

  // impostazioni per esperti
  esperti: boolean;
  usaConteggi: boolean;
  /** Schede per esperti aperte con «Usa» (solo interfaccia: non va nel link né nella memoria) */
  espertiInUso: ('conteggi' | 'device' | 'periodi')[];
  accettati: string;
  nonAccettati: string;
  device: Record<'mobile' | 'desktop' | 'tablet', { tasso: string; quota: string }>;
  periodi: { dal: string; tasso: string }[];
  /** Un link o una memoria di prima del 18/11/2026 conteneva tassi per canale: ignorati, se ne dà avviso. */
  canaliIgnorati: boolean;
  sicurezza: Record<ChiaveIpotesi, string>;

  // ipotesi comportamentali: null = valore predefinito
  valori: Record<ChiaveIpotesi, number | null>;
  statoIpotesi: Record<ChiaveIpotesi, StatoIpotesi>;

  ordiniAttivi: boolean;
  ordini: string;
  entrate: string;
  ordiniDal: string;
  ordiniAl: string;
  pubblico: '' | Pubblico | 'valore';
  altreValore: string;
  /**
   * Utenti unici del periodo. 'auto' = il valore della riga dei totali dell'export, se c'è ed è coerente (è un dato
   * del file, come sessioni e transazioni); 'utente' = il valore scritto qui; 'no' = l'utente ha scelto di non usarlo.
   */
  utenti: 'auto' | 'utente' | 'no';
  /** La scheda «Utenti del periodo» mostra la casella (solo interfaccia) */
  utentiModifica: boolean;
  utentiPeriodo: string;

  ricorda: boolean;
  metrica: Metrica;
  tabelle: { canali: boolean; giorni: boolean };
  aperta: '' | 'file' | 'cm' | 'tasso';
  vista: 'risultati' | 'ipotesi';
  tour: number;
  linkIgnorato: boolean;
}

export function statoIniziale(): Stato {
  return {
    fase: 'avvio',
    origine: 'utente',
    file: null,
    erroreFile: null,
    file2: null,
    colonnaEventi: '',
    valuta: '€',
    cm: '',
    identita: '',
    icona: '',
    tasso: '',
    precisione: '',
    misura: '',
    ignora: '',
    quotaIgnora: '',
    esperti: false,
    usaConteggi: false,
    espertiInUso: [],
    accettati: '',
    nonAccettati: '',
    device: { mobile: { tasso: '', quota: '' }, desktop: { tasso: '', quota: '' }, tablet: { tasso: '', quota: '' } },
    periodi: [
      { dal: '', tasso: '' },
      { dal: '', tasso: '' },
    ],
    canaliIgnorati: false,
    sicurezza: { rFreq: '1', rConv: '1', rAov: '1' },
    valori: { rFreq: null, rConv: null, rAov: null },
    statoIpotesi: { rFreq: 'pred', rConv: 'pred', rAov: 'pred' },
    ordiniAttivi: false,
    ordini: '',
    entrate: '',
    ordiniDal: '',
    ordiniAl: '',
    pubblico: '',
    altreValore: '',
    utenti: 'auto',
    utentiModifica: false,
    utentiPeriodo: '',
    ricorda: false,
    metrica: 'sessioni',
    tabelle: { canali: false, giorni: false },
    aperta: '',
    vista: 'risultati',
    tour: 0,
    linkIgnorato: false,
  };
}

/**
 * Legge un numero scritto a mano: accetta «1.186», «1186», «99.774,50», «99,774.50», «45%», «45 %».
 * Un punto seguito da gruppi di tre cifre è il separatore delle migliaia («1.186» = 1186).
 */
export const numero = (s: string): number | undefined => {
  let v = s.trim().replace(/[\s\u00a0\u202f%€$£]/g, '');
  if (v === '') return undefined;
  if (v.includes(',') && v.includes('.')) v = v.lastIndexOf(',') > v.lastIndexOf('.') ? v.replace(/\./g, '').replace(',', '.') : v.replace(/,/g, '');
  else if (v.includes(',')) v = /^-?\d{1,3}(,\d{3})+$/.test(v) && !/^0,/.test(v) && v.split(',').length > 2 ? v.replace(/,/g, '') : v.replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(v) && !/^-?0\./.test(v)) v = v.replace(/\./g, '');
  const x = Number(v);
  return Number.isFinite(x) ? x : undefined;
};
/** Percentuale tra 1 e 99 (restituita come frazione). Valori sotto 1, come «0,45», non sono accettati: si chiede conferma. */
export const percento = (s: string): number | undefined => {
  const x = numero(s);
  return x !== undefined && x >= 1 && x < 100 ? x / 100 : undefined;
};
/** Se l'utente ha scritto una frazione («0,45») restituisce la percentuale che probabilmente intendeva (45). */
export const forseFrazione = (s: string): number | undefined => {
  const x = numero(s);
  return x !== undefined && x > 0 && x < 1 ? Math.round(x * 1000) / 10 : undefined;
};

// ---------------------------------------------------------------- Consent Mode
export function esitoCM(s: Stato): Esito {
  if (s.cm === '') return 'daRispondere';
  if (s.cm === 'basic') return 'stima';
  if (s.cm === 'nonso') return 'incerto';
  if (s.identita === '') return 'daRispondere';
  if (s.identita === 'osservata') return 'stima';
  if (s.identita === 'nonso') return 'incerto';
  if (s.icona === '') return 'daRispondere';
  return s.icona === 'inclusi' ? 'blocco' : s.icona === 'no' ? 'stima' : 'incerto';
}

// ---------------------------------------------------------------- tasso
export function deviceValidi(s: Stato): { nome: string; tasso: number; quota: number }[] {
  return (['mobile', 'desktop', 'tablet'] as const)
    .map((d) => ({ nome: d, tasso: percento(s.device[d].tasso) ?? 0, quota: numero(s.device[d].quota) ?? 0 }))
    .filter((d) => d.tasso > 0 && d.quota > 0);
}
export function conteggiValidi(s: Stato): boolean {
  return s.usaConteggi && (numero(s.accettati) ?? 0) > 0 && (numero(s.nonAccettati) ?? 0) > 0;
}
export const tassoDaDevice = (s: Stato): boolean => deviceValidi(s).length >= 2;

/** Risposte obbligatorie ancora mancanti nel passo del tasso. */
export function mancantiTasso(s: Stato): string[] {
  const m: string[] = [];
  if (!conteggiValidi(s) && !tassoDaDevice(s)) {
    if (percento(s.tasso) === undefined) m.push('tasso');
    if (s.precisione === '') m.push('precisione');
  }
  if (s.misura === '') m.push('misura');
  if (s.ignora === '') m.push('ignora');
  return m;
}

/** Vero quando ci sono tutte le risposte per calcolare. */
export function completo(s: Stato): boolean {
  if (!s.file) return false;
  const e = esitoCM(s);
  if (e === 'daRispondere') return false;
  if (e === 'blocco' && !s.file2) return false;
  return mancantiTasso(s).length === 0;
}

export function passoCorrente(s: Stato): 1 | 2 | 3 {
  if (!s.file) return 1;
  const e = esitoCM(s);
  if (e === 'daRispondere' || (e === 'blocco' && !s.file2)) return 2;
  return 3;
}

// ---------------------------------------------------------------- ipotesi
export function misuraEffettiva(s: Stato): Misura {
  return s.misura === '' ? 'nonso' : s.misura;
}
export function predefinito(s: Stato, k: ChiaveIpotesi): PriorLN {
  const p = configPredefinita();
  return k === 'rFreq' ? R_FREQ_PREDEFINITI[misuraEffettiva(s)] : k === 'rConv' ? p.rConv : p.rAov;
}
export function ipotesi(s: Stato, k: ChiaveIpotesi): PriorLN {
  const base = predefinito(s, k);
  return { mediana: s.valori[k] ?? base.mediana, sigma: Math.max(SIGMA_MINIMA, base.sigma * (Number(s.sicurezza[k]) || 1)) };
}
export const margine = (p: PriorLN): [number, number] => [p.mediana * Math.exp(-1.96 * p.sigma), p.mediana * Math.exp(1.96 * p.sigma)];
export const LIMITI_CURSORE: Record<ChiaveIpotesi, [number, number]> = { rFreq: [0.2, 2], rConv: [0.05, 1.5], rAov: [0.5, 1.5] };

export function nPredefinite(s: Stato, calibrate: ChiaveIpotesi[] = []): number {
  return IPOTESI.filter((k) => s.statoIpotesi[k] === 'pred' && !calibrate.includes(k)).length;
}

// ---------------------------------------------------------------- ordini reali
export function altrePerdite(s: Stato): PriorLN | null {
  if (s.pubblico === '') return null;
  if (s.pubblico === 'valore') {
    const v = percento(s.altreValore);
    return v === undefined ? null : { mediana: Math.min(0.5, v), sigma: 0.3 };
  }
  return ALTRE_PERDITE_PUBBLICO[s.pubblico];
}
export function ordiniPronti(s: Stato): boolean {
  return s.ordiniAttivi && (numero(s.ordini) ?? 0) > 0 && altrePerdite(s) !== null;
}
/** Vero se il periodo degli ordini coincide con tutto il file. */
export function ordiniSuTuttoIlFile(s: Stato): boolean {
  if (!s.file) return false;
  return (!s.ordiniDal || s.ordiniDal <= s.file.info.dal) && (!s.ordiniAl || s.ordiniAl >= s.file.info.al);
}

/** Quante impostazioni per esperti hanno un effetto sul calcolo. */
export function espertiAttive(s: Stato): number {
  let n = 0;
  if (conteggiValidi(s)) n++;
  if (tassoDaDevice(s)) n++;
  n += s.periodi.filter((p) => p.dal && percento(p.tasso) !== undefined).length ? 1 : 0;
  if (IPOTESI.some((k) => s.sicurezza[k] !== '1')) n++;
  if (s.ordiniAttivi && s.pubblico === 'valore') n++;
  if (s.ordiniAttivi && !ordiniSuTuttoIlFile(s)) n++;
  return n;
}

// ---------------------------------------------------------------- configurazione del motore
/** Da dove vengono gli utenti unici del periodo usati nella stima, e il valore (se c'è). */
export function utentiEffettivi(s: Stato): { fonte: 'export' | 'utente' | 'nonDisponibile' | 'no'; valore?: number; export?: number } {
  const daExport = utentiDaTotali(s.file);
  if (s.utenti === 'utente') {
    const v = numero(s.utentiPeriodo);
    return { fonte: 'utente', valore: v && v > 0 ? v : undefined, export: daExport };
  }
  if (s.utenti === 'no') return { fonte: daExport ? 'no' : 'nonDisponibile', export: daExport };
  return daExport ? { fonte: 'export', valore: daExport, export: daExport } : { fonte: 'nonDisponibile' };
}

export function datiDaStimare(s: Stato): Dati | null {
  if (!s.file) return null;
  return esitoCM(s) === 'blocco' ? (s.file2?.dati ?? null) : s.file.dati;
}

export function configurazione(s: Stato): Config {
  const misura = misuraEffettiva(s);
  const cfg: Config = {
    ...configPredefinita(),
    misura,
    tasso: conteggiValidi(s)
      ? { tipo: 'conteggi', accettati: numero(s.accettati)!, nonAccettati: numero(s.nonAccettati)! }
      : { tipo: 'percentuale', valore: percento(s.tasso) ?? 0.5, precisione: s.precisione || 'stima' },
    ignora: { modo: s.ignora || 'nonso', quota: percento(s.quotaIgnora) },
    rFreq: ipotesi(s, 'rFreq'),
    rConv: ipotesi(s, 'rConv'),
    rAov: ipotesi(s, 'rAov'),
    rUtenti: R_UTENTI_PREDEFINITI[misura],
  };
  const dev = deviceValidi(s);
  if (dev.length >= 2) cfg.device = dev;
  const periodi = s.periodi.map((p) => ({ dal: p.dal, tasso: percento(p.tasso) ?? 0 })).filter((p) => p.dal && p.tasso > 0);
  if (periodi.length) cfg.periodi = periodi;
  // I tassi per canale non si chiedono più (decisione dell'autore, 18/11/2026): il motore conserva la funzione
  // (Config.canali) ma l'interfaccia non la usa.
  const ue = utentiEffettivi(s);
  if (ue.valore) cfg.utentiPeriodo = ue.valore;
  const ap = altrePerdite(s);
  if (ordiniPronti(s) && ap && s.file) {
    cfg.ancora = {
      dal: s.ordiniDal || s.file.info.dal,
      al: s.ordiniAl || s.file.info.al,
      ordini: numero(s.ordini)!,
      entrate: numero(s.entrate),
      altrePerdite: ap,
    };
  }
  return cfg;
}

export function metricheDisponibili(d: Dati): Metrica[] {
  const out: Metrica[] = ['sessioni'];
  if (d.haUtenti) out.push('utentiGiorno');
  if (d.haEventi) out.push('eventi');
  if (d.haTransazioni) out.push('transazioni');
  if (d.haEntrate) out.push('entrate');
  return out;
}
