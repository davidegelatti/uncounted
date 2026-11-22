// Riga dei totali dell'export GA4: confronto con la somma delle righe e utenti del periodo.
import type { Dati } from '../motore/modello';
import type { InfoCsv } from '../parser';

export type GrandezzaTotale = 'sessioni' | 'eventi' | 'transazioni' | 'entrate';
export const GRANDEZZE_TOTALE: GrandezzaTotale[] = ['sessioni', 'eventi', 'transazioni', 'entrate'];

export interface Scarto {
  grandezza: GrandezzaTotale;
  righe: number;
  totale: number;
}

/**
 * Grandezze per cui la somma delle righe si discosta dalla riga dei totali oltre una soglia ragionevole.
 * Piccole differenze sono normali in GA4 (arrotondamenti, stime di cardinalità): si segnala solo uno scarto
 * di oltre il 2% e di almeno 3 unità (1 per le entrate). Gli utenti non si confrontano: nel totale sono deduplicati.
 */
export function scartiDaiTotali(dati: Dati, totali: InfoCsv['totali']): Scarto[] {
  if (!totali) return [];
  const out: Scarto[] = [];
  for (const g of GRANDEZZE_TOTALE) {
    const totale = totali[g];
    if (totale === undefined) continue;
    const righe = dati.righe.reduce((s, r) => s + r[g], 0);
    const soglia = Math.max(g === 'entrate' ? 1 : 2, 0.02 * totale);
    if (Math.abs(righe - totale) > soglia) out.push({ grandezza: g, righe, totale });
  }
  return out;
}

/**
 * Utenti unici del periodo letti dalla riga dei totali (già deduplicati da GA4), se la riga c'è e il file è coerente
 * con essa: se le sessioni delle righe non tornano con il totale (file filtrato o incompleto), non si propone nulla.
 */
export function utentiDaTotali(file: { dati: Dati; info: InfoCsv } | null): number | undefined {
  const u = file?.info.totali?.utenti;
  if (!file || !u || u <= 0) return undefined;
  if (scartiDaiTotali(file.dati, file.info.totali).some((x) => x.grandezza === 'sessioni')) return undefined;
  return u;
}
