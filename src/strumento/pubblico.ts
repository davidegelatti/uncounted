// Ordini che GA4 perde per cause diverse dal consenso: ipotesi per tipo di pubblico (METODO.md §5.4).
// Definizione: quota degli ordini reali che GA4 non registra e che NON vengono da visitatori senza consenso.
import type { PriorLN } from '../motore/modello';

export type Pubblico = 'consumo' | 'tecnico' | 'misto' | 'server';

export const ALTRE_PERDITE_PUBBLICO: Record<Pubblico, PriorLN> = {
  consumo: { mediana: 0.07, sigma: 0.52 }, // 95%: 2,5% – 19%
  tecnico: { mediana: 0.2, sigma: 0.47 }, // 95%: 8% – 50%
  misto: { mediana: 0.09, sigma: 0.65 }, // 95%: 2,5% – 32%
  server: { mediana: 0.02, sigma: 0.6 }, // 95%: 0,6% – 6,5%
};

/** Estremi del margine 95% di un'ipotesi log-normale. */
export const margine95 = (p: PriorLN): [number, number] => [p.mediana * Math.exp(-1.96 * p.sigma), p.mediana * Math.exp(1.96 * p.sigma)];

/** Le altre risposte sul tipo di pubblico (tutte, se la risposta attuale è un valore scritto a mano). */
export const alternativePubblico = (attuale: string): Record<string, PriorLN> =>
  Object.fromEntries(Object.entries(ALTRE_PERDITE_PUBBLICO).filter(([k]) => k !== attuale));
