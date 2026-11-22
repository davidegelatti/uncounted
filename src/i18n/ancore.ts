// Registro dei collegamenti dallo strumento alle pagine. Gli identificatori sono uguali nelle due lingue:
// ogni ancora elencata qui DEVE esistere nella pagina indicata, in italiano e in inglese (lo verifica un test).
import type { Lingua } from './indice';
import { indirizzo, type Pagina } from './percorsi';

export const ANCORE = {
  creaEsplorazione: ['guida', 'create-exploration'],
  erroriFile: ['guida', 'file-errors'],
  trovaTasso: ['guida', 'find-consent-rate'],
  verificaConsentMode: ['guida', 'consent-mode-check'],
  identitaReport: ['guida', 'reporting-identity'],
  iconaQualita: ['guida', 'data-quality-icon'],
  confrontoGoogle: ['guida', 'compare-with-google'],
  leggereRisultati: ['guida', 'read-results'],
  usareOrdini: ['guida', 'use-real-orders'],
  usoMeglio: ['guida', 'best-use'],
  intervalloStretto: ['guida', 'narrower-range'],
  cambioBanner: ['guida', 'banner-change'],
  dispositivi: ['guida', 'mobile-desktop'],
  canaleBasso: ['guida', 'channel-low-consent'],
  ipotesiPredefinite: ['guida', 'default-assumptions'],
  presentare: ['guida', 'client-report'],
  inBreve: ['metodo', 'in-short'],
  cosaManca: ['metodo', 'what-is-missing'],
  tassoNonSessione: ['metodo', 'rate-not-per-session'],
  chiIgnora: ['metodo', 'banner-ignored'],
  rFreq: ['metodo', 'return-ratio'],
  rConv: ['metodo', 'conversion-ratio'],
  rAov: ['metodo', 'order-value-ratio'],
  canali: ['metodo', 'channels'],
  utenti: ['metodo', 'users'],
  simulazione: ['metodo', 'simulation'],
  leggereIntervalli: ['metodo', 'reading-ranges'],
  consentMode: ['metodo', 'consent-mode'],
  ordiniReali: ['metodo', 'real-orders'],
  altrePerdite: ['metodo', 'other-losses'],
  limiti: ['metodo', 'limits'],
  fonti: ['metodo', 'sources'],
  calibrazione: ['validazione', 'calibration'],
  robustezza: ['validazione', 'robustness'],
  verificaPrivacy: ['privacy', 'verify'],
} as const satisfies Record<string, readonly [Pagina, string]>;

export type Ancora = keyof typeof ANCORE;

export function collegamento(lingua: Lingua, ancora: Ancora): string {
  const [pagina, id] = ANCORE[ancora];
  return indirizzo(lingua, pagina, id);
}
