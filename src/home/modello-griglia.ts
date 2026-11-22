// Modello dell'esempio della home, usato sia nella pagina costruita sia nel browser.
// Chi accetta torna in media 3 volte, chi non accetta 2 (rapporto 2/3, dentro il margine di «quante volte ritorna»).
// Margine «8 volte su 10» sul rapporto: × e^(±1,28 · 0,3) → circa 0,455 – 0,98.
export const R = 2 / 3;
export const R_MIN = R * Math.exp(-1.28 * 0.3);
export const R_MAX = R * Math.exp(1.28 * 0.3);
export const TASSO_INIZIALE = 60;
/** Disposizioni della griglia: 20×5 su schermi larghi, 10×10 su mobile. Unità circolari. */
export const DISPOSIZIONI = { larga: { colonne: 20, righe: 5 }, stretta: { colonne: 10, righe: 10 } } as const;
export const PASSO = 28;
export const RAGGIO = 11.5;

/** Visite contate su 100, dato il tasso di accettazione p (0–1) e il rapporto r. */
export const contate = (p: number, r: number): number => (100 * p) / (p + (1 - p) * r);

export interface Esito {
  p: number;
  centrale: number;
  min: number;
  max: number;
}
export function esito(percento: number): Esito {
  const p = percento / 100;
  // chi non accetta che torna di più (R_MAX) lascia meno visite contate
  return { p: percento, centrale: contate(p, R), min: contate(p, R_MAX), max: contate(p, R_MIN) };
}

/** Tipo e riempimento della n-esima unità (1–100). */
export function unita(n: number, e: Esito): { tipo: 'contata' | 'incerta' | 'persa'; peso?: number } {
  if (n <= Math.floor(e.min)) return { tipo: 'contata' };
  if (n > Math.ceil(e.max)) return { tipo: 'persa' };
  // riempimento parziale tra 40% e 85%: sempre distinguibile sia dal pieno sia dal vuoto
  return { tipo: 'incerta', peso: 0.4 + 0.45 * Math.max(0, Math.min(1, 0.5 - (n - e.centrale) / (e.max - e.min + 2))) };
}

/** Testi della figura: i modelli arrivano dai file di lingua, qui si riempiono solo i numeri. */
type Chiave = 'semplice' | 'stima' | 'descrizione' | 'cursore';
export function testi(e: Esito, modelli: Record<Chiave, string>): Record<Chiave, string> {
  const v: Record<string, number> = { p: Math.round(e.p), m0: 100 - Math.round(e.p), c: Math.round(e.centrale), a: Math.round(e.min), b: Math.round(e.max), m: 100 - Math.round(e.centrale) };
  const riempi = (s: string): string => s.replace(/\{(\w+)\}/g, (t, k: string) => (k in v ? String(v[k]) : t));
  return { semplice: riempi(modelli.semplice), stima: riempi(modelli.stima), descrizione: riempi(modelli.descrizione), cursore: riempi(modelli.cursore) };
}
