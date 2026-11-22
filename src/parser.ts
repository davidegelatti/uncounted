// Lettura dell'export CSV di un'esplorazione GA4 in formato libero.
import type { Dati, Riga } from './motore/modello';

export interface ErroreCsv {
  riga?: number;
  colonna?: string;
  codice: CodiceErrore;
  parametri: Record<string, string | number>;
}

export type CodiceErrore =
  | 'file_vuoto' | 'file_binario' | 'solo_commenti' | 'colonna_mancante' | 'data_non_valida'
  | 'numero_non_valido' | 'numero_negativo' | 'nessuna_riga' | 'sessioni_zero' | 'altri_errori';

/** Avviso del parser: il testo sta nei file di lingua. */
export interface AvvisoCsv {
  codice: 'utenti_attivi' | 'colonne_mancanti' | 'numeri_misti' | 'duplicati' | 'ambigui' | 'canale_not_set';
  parametri: Record<string, string | number>;
}

export interface InfoCsv {
  separatore: string;
  righeLette: number;
  righeTotaleScartate: number;
  dal: string;
  al: string;
  canali: string[];
  /** Intestazione originale usata per ogni campo */
  colonne: Partial<Record<Campo, string>>;
  /** Tutte le colonne di eventi chiave trovate (per la scelta dell'utente) */
  colonneEventi: string[];
  stileNumeri: 'it' | 'en' | 'ignoto';
  /**
   * Valori della riga dei totali di GA4, se presente (per esempio «,,15898,11924,…,Totale complessivo»).
   * Gli utenti della riga dei totali sono già deduplicati da GA4 sull'intero periodo.
   */
  totali?: Partial<Record<'sessioni' | 'utenti' | 'eventi' | 'transazioni' | 'entrate', number>>;
}

export interface EsitoCsv {
  ok: boolean;
  dati?: Dati;
  errori: ErroreCsv[];
  avvisi: AvvisoCsv[];
  info?: InfoCsv;
}

export type Campo = 'data' | 'canale' | 'sessioni' | 'utenti' | 'eventi' | 'transazioni' | 'entrate';

const ALIAS: Record<Campo, string[]> = {
  data: ['data', 'date', 'giorno', 'day'],
  canale: [
    'gruppo di canali predefinito della sessione',
    'gruppo di canali principale della sessione',
    'gruppo di canali principale della sessione (gruppo di canali predefinito)',
    'gruppo di canali predefinito',
    'session default channel group',
    'session default channel grouping',
    'session primary channel group',
    'session primary channel group (default channel group)',
    'default channel group',
  ],
  sessioni: ['sessioni', 'sessions'],
  utenti: ['totale utenti', 'utenti totali', 'total users', 'utenti', 'users', 'utenti attivi', 'active users'],
  eventi: ['eventi chiave', 'key events', 'conversioni', 'conversions'],
  transazioni: ['transazioni', 'transactions', 'acquisti e-commerce', 'acquisti ecommerce', 'ecommerce purchases'],
  entrate: [
    'entrate totali',
    'total revenue',
    'entrate da acquisti',
    'entrate generate dagli acquisti',
    'purchase revenue',
    'entrate lorde da acquisti',
    'gross purchase revenue',
    'entrate',
    'revenue',
  ],
};
const PREFISSI_EVENTI = ['eventi chiave', 'key events', 'conversioni', 'conversions'];

export function normalizza(s: string): string {
  return s
    .replace(/^﻿/, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[ \s]+/g, ' ')
    .trim();
}

interface Record_ {
  riga: number;
  celle: string[];
}

function contaFuoriVirgolette(linea: string, sep: string): number {
  let n = 0;
  let dentro = false;
  for (const ch of linea) {
    if (ch === '"') dentro = !dentro;
    else if (ch === sep && !dentro) n++;
  }
  return n;
}

function suddividi(testo: string, sep: string): Record_[] {
  const out: Record_[] = [];
  let celle: string[] = [];
  let cella = '';
  let dentro = false;
  let riga = 1;
  let rigaInizio = 1;
  const chiudi = (): void => {
    celle.push(cella);
    out.push({ riga: rigaInizio, celle });
    celle = [];
    cella = '';
  };
  for (let i = 0; i < testo.length; i++) {
    const ch = testo[i];
    if (dentro) {
      if (ch === '"') {
        if (testo[i + 1] === '"') {
          cella += '"';
          i++;
        } else dentro = false;
      } else {
        if (ch === '\n') riga++;
        cella += ch;
      }
    } else if (ch === '"') dentro = true;
    else if (ch === sep) {
      celle.push(cella);
      cella = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && testo[i + 1] === '\n') i++;
      chiudi();
      riga++;
      rigaInizio = riga;
    } else cella += ch;
  }
  if (cella !== '' || celle.length) chiudi();
  return out;
}

const pulisciNumero = (s: string): string => s.replace(/[\s  €$£%]|EUR|USD|GBP|CHF/gi, '');
const VUOTI = new Set(['', '-', '–', '—', '(not set)', '(non impostato)', 'n/a', 'na', 'null']);

function indizioStile(v: string): 'it' | 'en' | null {
  if (/\.\d{3},\d/.test(v) || /^-?\d+,\d{1,2}$/.test(v) || /^-?\d+,\d{4,}$/.test(v) || /^-?\d{1,3}(\.\d{3}){2,}$/.test(v)) return 'it';
  if (/,\d{3}\.\d/.test(v) || /^-?\d+\.\d{1,2}$/.test(v) || /^-?\d+\.\d{4,}$/.test(v) || /^-?\d{1,3}(,\d{3}){2,}$/.test(v)) return 'en';
  return null;
}

/** Interpreta un numero con separatori italiani o inglesi. Restituisce NaN se non è un numero. */
export function leggiNumero(grezzo: string, stile: 'it' | 'en' | 'ignoto' = 'ignoto'): { valore: number; ambiguo: boolean } {
  if (VUOTI.has(grezzo.trim().toLowerCase())) return { valore: 0, ambiguo: false };
  let v = pulisciNumero(grezzo);
  if (VUOTI.has(v.toLowerCase())) return { valore: 0, ambiguo: false };
  if (!/^-?[\d.,]+$/.test(v) || !/\d/.test(v)) return { valore: NaN, ambiguo: false };
  let ambiguo = false;
  const haP = v.includes('.');
  const haV = v.includes(',');
  if (haP && haV) {
    if (v.lastIndexOf(',') > v.lastIndexOf('.')) v = v.replace(/\./g, '').replace(',', '.');
    else v = v.replace(/,/g, '');
  } else if (haV) {
    const gruppi = /^-?\d{1,3}(,\d{3})+$/.test(v);
    if (stile === 'en' && gruppi) v = v.replace(/,/g, '');
    else if (stile === 'ignoto' && gruppi) {
      ambiguo = /^-?\d{1,3},\d{3}$/.test(v);
      v = v.replace(/,/g, '');
    } else if ((v.match(/,/g) ?? []).length > 1) return { valore: NaN, ambiguo: false };
    else v = v.replace(',', '.');
  } else if (haP) {
    const gruppi = /^-?\d{1,3}(\.\d{3})+$/.test(v);
    if (stile === 'it' && gruppi) v = v.replace(/\./g, '');
    else if (stile === 'ignoto' && gruppi) {
      ambiguo = /^-?\d{1,3}\.\d{3}$/.test(v);
      v = v.replace(/\./g, '');
    } else if ((v.match(/\./g) ?? []).length > 1) return { valore: NaN, ambiguo: false };
  }
  const x = Number(v);
  return { valore: Number.isFinite(x) ? x : NaN, ambiguo };
}

function leggiData(s: string): string | null {
  const v = s.trim();
  let a: number, m: number, g: number;
  let r: RegExpMatchArray | null;
  if ((r = v.match(/^(\d{4})(\d{2})(\d{2})$/))) [a, m, g] = [+r[1], +r[2], +r[3]];
  else if ((r = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) [a, m, g] = [+r[1], +r[2], +r[3]];
  else if ((r = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) [a, m, g] = [+r[3], +r[2], +r[1]];
  else return null;
  const d = new Date(Date.UTC(a, m - 1, g));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== m - 1 || d.getUTCDate() !== g || a < 2000 || a > 2100) return null;
  return d.toISOString().slice(0, 10);
}

const MAX_ERRORI = 15;

export function leggiCsv(testoGrezzo: string, opzioni: { colonnaEventi?: string } = {}): EsitoCsv {
  const errori: ErroreCsv[] = [];
  const avvisi: AvvisoCsv[] = [];
  const testo = testoGrezzo.replace(/^﻿/, '');
  if (!testo.trim()) {
    return { ok: false, errori: [{ codice: 'file_vuoto', parametri: {} }], avvisi };
  }
  if (testo.includes('\u0000')) {
    return {
      ok: false,
      errori: [{ codice: 'file_binario', parametri: {} }],
      avvisi,
    };
  }

  // Separatore: lo si deduce dalla prima riga utile.
  const linee = testo.split(/\r\n|\n|\r/);
  const primaUtile = linee.find((l) => l.trim() !== '' && !l.trim().startsWith('#')) ?? '';
  let sep = ',';
  let max = -1;
  for (const s of [',', ';', '\t']) {
    const k = contaFuoriVirgolette(primaUtile, s);
    if (k > max) {
      max = k;
      sep = s;
    }
  }

  const record = suddividi(testo, sep).filter((r) => {
    const prima = (r.celle[0] ?? '').trim();
    return !prima.startsWith('#') && r.celle.some((c) => c.trim() !== '');
  });
  if (record.length === 0) {
    return { ok: false, errori: [{ codice: 'solo_commenti', parametri: {} }], avvisi };
  }

  // ---------- Intestazioni ----------
  const testata = record[0];
  const norm = testata.celle.map(normalizza);
  const col: Partial<Record<Campo, number>> = {};
  for (const campo of Object.keys(ALIAS) as Campo[]) {
    for (const alias of ALIAS[campo]) {
      const i = norm.indexOf(alias);
      if (i >= 0 && !Object.values(col).includes(i)) {
        col[campo] = i;
        break;
      }
    }
  }
  if (col.canale === undefined) {
    const i = norm.findIndex((h) => /canal|channel/.test(h));
    if (i >= 0) col.canale = i;
  }
  const idxEventi = norm.map((h, i) => (PREFISSI_EVENTI.some((p) => h === p || h.startsWith(p + ':') || h.startsWith(p + ' ')) ? i : -1)).filter((i) => i >= 0);
  const colonneEventi = idxEventi.map((i) => testata.celle[i].trim());
  if (opzioni.colonnaEventi) {
    const i = testata.celle.findIndex((c) => c.trim() === opzioni.colonnaEventi);
    if (i >= 0) col.eventi = i;
  } else if (col.eventi === undefined && idxEventi.length) col.eventi = idxEventi[0];

  const trovate = testata.celle.map((c) => `«${c.trim()}»`).join(', ');
  for (const campo of ['data', 'canale', 'sessioni'] as Campo[]) {
    if (col[campo] === undefined) {
      errori.push({
        riga: testata.riga,
        colonna: campo,
        codice: 'colonna_mancante', parametri: { campo, riga: testata.riga, trovate },
      });
    }
  }
  if (errori.length) return { ok: false, errori, avvisi };

  if (col.utenti !== undefined && /attivi|active/.test(norm[col.utenti])) {
    avvisi.push({ codice: 'utenti_attivi', parametri: {} });
  }
  const mancanti: string[] = [];
  if (col.utenti === undefined) mancanti.push('utenti');
  if (col.eventi === undefined) mancanti.push('eventi');
  if (col.transazioni === undefined) mancanti.push('transazioni');
  if (col.entrate === undefined) mancanti.push('entrate');
  if (mancanti.length) avvisi.push({ codice: 'colonne_mancanti', parametri: { campi: mancanti.join(',') } });

  // ---------- Stile dei numeri ----------
  const numeriche = (['sessioni', 'utenti', 'eventi', 'transazioni', 'entrate'] as Campo[]).filter((c) => col[c] !== undefined);
  let it = 0;
  let en = 0;
  for (let r = 1; r < record.length; r++) {
    for (const c of numeriche) {
      const s = indizioStile(pulisciNumero(record[r].celle[col[c]!] ?? ''));
      if (s === 'it') it++;
      else if (s === 'en') en++;
    }
  }
  const stile: InfoCsv['stileNumeri'] = it > 0 && en === 0 ? 'it' : en > 0 && it === 0 ? 'en' : 'ignoto';
  if (it > 0 && en > 0) {
    avvisi.push({ codice: 'numeri_misti', parametri: {} });
  }

  // ---------- Righe ----------
  const mappa = new Map<string, Riga>();
  let totali: InfoCsv['totali'];
  let scartateTotale = 0;
  let duplicati = 0;
  let ambigui = 0;
  let erroriExtra = 0;
  const aggiungiErrore = (e: ErroreCsv): void => {
    if (errori.length < MAX_ERRORI) errori.push(e);
    else erroriExtra++;
  };
  for (let r = 1; r < record.length; r++) {
    const { riga, celle } = record[r];
    const dataGrezza = (celle[col.data!] ?? '').trim();
    const canaleGrezzo = (celle[col.canale!] ?? '').trim();
    const nd = normalizza(dataGrezza);
    const nc = normalizza(canaleGrezzo);
    // Riga dei totali: data vuota (in GA4 anche il canale è vuoto e l'etichetta «Totale complessivo» / «Grand total»
    // sta in una colonna in più alla fine), oppure un'etichetta di totale al posto della data o del canale.
    // Non viene mai sommata ai dati: se ne leggono solo i valori, per gli utenti del periodo e il controllo di coerenza.
    if (dataGrezza === '' || /total/.test(nd) || /^(totale|totali|total|totals|grand total|totale generale|totale complessivo)$/.test(nc)) {
      scartateTotale++;
      if (!totali && (canaleGrezzo === '' || /^(totale|totali|total|totals|grand total|totale generale|totale complessivo)$/.test(nc))) {
        totali = {};
        for (const c of numeriche) {
          const { valore } = leggiNumero(celle[col[c]!] ?? '', stile);
          if (Number.isFinite(valore) && valore >= 0) totali[c as keyof NonNullable<InfoCsv['totali']>] = valore;
        }
      }
      continue;
    }
    if (norm.every((h, i) => normalizza(celle[i] ?? '') === h)) continue; // intestazione ripetuta
    const data = leggiData(dataGrezza);
    if (!data) {
      aggiungiErrore({
        riga,
        colonna: testata.celle[col.data!].trim(),
        codice: 'data_non_valida', parametri: { riga, valore: dataGrezza },
      });
      continue;
    }
    const valori: Record<string, number> = {};
    let rigaOk = true;
    for (const c of numeriche) {
      const grezzo = celle[col[c]!] ?? '';
      const { valore, ambiguo } = leggiNumero(grezzo, stile);
      if (Number.isNaN(valore) || valore < 0) {
        aggiungiErrore({
          riga,
          colonna: testata.celle[col[c]!].trim(),
          codice: valore < 0 ? 'numero_negativo' : 'numero_non_valido', parametri: { riga, colonna: testata.celle[col[c]!].trim(), valore: grezzo.trim() },
        });
        rigaOk = false;
        continue;
      }
      if (ambiguo) ambigui++;
      valori[c] = valore;
    }
    if (!rigaOk) continue;
    const canale = canaleGrezzo === '' ? '(not set)' : canaleGrezzo;
    const chiave = data + '\u0001' + canale;
    const esistente = mappa.get(chiave);
    if (esistente) {
      duplicati++;
      esistente.sessioni += valori.sessioni ?? 0;
      esistente.utenti += valori.utenti ?? 0;
      esistente.eventi += valori.eventi ?? 0;
      esistente.transazioni += valori.transazioni ?? 0;
      esistente.entrate += valori.entrate ?? 0;
    } else {
      mappa.set(chiave, {
        data,
        canale,
        sessioni: valori.sessioni ?? 0,
        utenti: valori.utenti ?? 0,
        eventi: valori.eventi ?? 0,
        transazioni: valori.transazioni ?? 0,
        entrate: valori.entrate ?? 0,
      });
    }
  }
  if (erroriExtra) aggiungiUltimo(errori, erroriExtra);
  if (errori.length) return { ok: false, errori, avvisi };

  const righe = [...mappa.values()].sort((a, b) => (a.data === b.data ? a.canale.localeCompare(b.canale) : a.data < b.data ? -1 : 1));
  if (righe.length === 0) {
    return {
      ok: false,
      errori: [{ codice: 'nessuna_riga', parametri: {} }],
      avvisi,
    };
  }
  if (righe.reduce((s, r) => s + r.sessioni, 0) <= 0) {
    return { ok: false, errori: [{ colonna: 'sessioni', codice: 'sessioni_zero', parametri: {} }], avvisi };
  }
  if (duplicati) avvisi.push({ codice: 'duplicati', parametri: { n: duplicati } });
  if (ambigui) avvisi.push({ codice: 'ambigui', parametri: { n: ambigui } });
  if (righe.some((r) => r.canale === '(not set)')) avvisi.push({ codice: 'canale_not_set', parametri: {} });

  const somma = (k: keyof Riga): number => righe.reduce((s, r) => s + (r[k] as number), 0);
  const dati: Dati = {
    righe,
    haUtenti: col.utenti !== undefined && somma('utenti') > 0,
    haEventi: col.eventi !== undefined && somma('eventi') > 0,
    haTransazioni: col.transazioni !== undefined && somma('transazioni') > 0,
    haEntrate: col.entrate !== undefined && somma('entrate') > 0,
  };
  const colonne: Partial<Record<Campo, string>> = {};
  for (const c of Object.keys(col) as Campo[]) colonne[c] = testata.celle[col[c]!].trim();
  return {
    ok: true,
    dati,
    errori,
    avvisi,
    info: {
      separatore: sep === '\t' ? 'tab' : sep,
      righeLette: righe.length,
      righeTotaleScartate: scartateTotale,
      dal: righe[0].data,
      al: righe[righe.length - 1].data,
      canali: [...new Set(righe.map((r) => r.canale))],
      colonne,
      colonneEventi,
      stileNumeri: stile,
      ...(totali && Object.keys(totali).length ? { totali } : {}),
    },
  };
}

function aggiungiUltimo(errori: ErroreCsv[], n: number): void {
  errori.push({ codice: 'altri_errori', parametri: { n } });
}
