// Indirizzi delle pagine nelle due lingue.
import type { Lingua } from './indice';

export type Pagina = 'home' | 'strumento' | 'guida' | 'metodo' | 'validazione' | 'privacy' | 'comeFatto';
export const PAGINE: Pagina[] = ['home', 'strumento', 'guida', 'metodo', 'validazione', 'privacy', 'comeFatto'];

export const PERCORSI: Record<Lingua, Record<Pagina, string>> = {
  it: { home: '', strumento: 'stimatore', guida: 'guida', metodo: 'metodo', validazione: 'validazione', privacy: 'privacy', comeFatto: 'come-e-stato-fatto' },
  en: { home: '', strumento: 'estimator', guida: 'guide', metodo: 'method', validazione: 'validation', privacy: 'privacy', comeFatto: 'how-it-was-made' },
};

export function indirizzo(lingua: Lingua, pagina: Pagina, ancora?: string): string {
  const s = PERCORSI[lingua][pagina];
  return `/${lingua}/${s ? s + '/' : ''}${ancora ? '#' + ancora : ''}`;
}
