// Numeri e date per lingua, senza falsa precisione.
import type { Lingua } from './indice';

const LOCALE: Record<Lingua, string> = { it: 'it-IT', en: 'en-GB' };

export interface Formati {
  /** Valore esatto (dati osservati) */
  intero(x: number): string;
  /** Valore stimato: al massimo tre cifre significative */
  stimato(x: number): string;
  pct(x: number): string;
  /** Percentuale preceduta dall'articolo dove la lingua lo richiede: «il 51%», «l’82%»; in inglese solo «51%» */
  pctArt(x: number): string;
  rapporto(x: number): string;
  /** Numero con al massimo un decimale, senza zeri inutili («45», «45,5») */
  decimale(x: number): string;
  dataBreve(iso: string): string;
  dataLunga(iso: string): string;
}

export function formati(lingua: Lingua): Formati {
  const loc = LOCALE[lingua];
  const sempre = { useGrouping: 'always' } as unknown as Intl.NumberFormatOptions;
  const nf0 = new Intl.NumberFormat(loc, { maximumFractionDigits: 0, ...sempre });
  const nf1 = new Intl.NumberFormat(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat(loc, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  const breve = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const lunga = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const data = (iso: string): Date => new Date(iso + 'T00:00:00Z');
  // Alcune versioni di ICU scrivono «Sept» in en-GB: lo stile del sito è «12 Sep 2026».
  const mese = (s: string): string => s.replace('Sept', 'Sep');
  const pct = (x: number): string => {
    const v = x * 100;
    return (Math.abs(v) < 10 && v !== 0 ? nf1.format(v) : nf0.format(Math.round(v))) + '%';
  };
  return {
    intero: (x) => nf0.format(Math.round(x)),
    stimato(x) {
      const a = Math.abs(x);
      if (a === 0) return '0';
      if (a < 10) return nf1.format(x);
      if (a < 1000) return nf0.format(Math.round(x));
      const p = Math.pow(10, Math.floor(Math.log10(a)) - 2);
      return nf0.format(Math.round(x / p) * p);
    },
    pct,
    pctArt(x) {
      const p = pct(x);
      if (lingua !== 'it') return p;
      return /^(8|11(?!\d)|1(?!\d))/.test(p) ? `l’${p}` : `il ${p}`; // l’1%, l’1,8%, l’8%, l’11%, l’80%; il 18%, il 100%
    },
    rapporto: (x) => nf2.format(x),
    decimale: (x) => new Intl.NumberFormat(loc, { maximumFractionDigits: 1 }).format(x),
    dataBreve: (iso) => mese(breve.format(data(iso))),
    dataLunga: (iso) => mese(lunga.format(data(iso))),
  };
}

/** Numero per i CSV esportati: virgola decimale in italiano, punto in inglese; nessun separatore delle migliaia. */
export const perCsv = (x: number, decimali: number, lingua: Lingua): string => (lingua === 'it' ? x.toFixed(decimali).replace('.', ',') : x.toFixed(decimali));
