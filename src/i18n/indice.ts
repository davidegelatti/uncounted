// Testi per lingua. Tutte le stringhe del sito e dello strumento stanno in it.json / en.json.
import it from './it.json';
import en from './en.json';

export type Lingua = 'it' | 'en';
export const LINGUE: Lingua[] = ['it', 'en'];
export type Parametri = Record<string, string | number>;
export type Traduci = (chiave: string, parametri?: Parametri) => string;

export function appiattisci(o: unknown, prefisso = '', out: Record<string, string> = {}): Record<string, string> {
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    if (typeof v === 'string') out[prefisso + k] = v;
    else appiattisci(v, prefisso + k + '.', out);
  }
  return out;
}

export const DIZIONARI: Record<Lingua, Record<string, string>> = { it: appiattisci(it), en: appiattisci(en) };

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ESC[c]);

/**
 * Restituisce la funzione di traduzione per una lingua. I valori dei file di lingua possono contenere
 * marcatura semplice (<strong>, <em>); i parametri vengono sempre resi innocui.
 * Se una chiave inglese è ancora vuota si usa l'italiano, così il sito resta utilizzabile durante la traduzione.
 */
export function traduttore(lingua: Lingua): Traduci {
  const d = DIZIONARI[lingua];
  return (chiave, parametri) => {
    const grezzo = d[chiave] || DIZIONARI.it[chiave];
    if (grezzo === undefined) return `⟦${chiave}⟧`;
    if (!parametri) return grezzo;
    return grezzo.replace(/\{(\w+)\}/g, (tutto, nome: string) => (nome in parametri ? esc(String(parametri[nome])) : tutto));
  };
}

/** Sceglie la forma _zero / _uno / _altri di una chiave in base al numero. */
export function plurale(t: Traduci, base: string, n: number, parametri: Parametri = {}): string {
  const p = { ...parametri, n };
  if (n === 0 && DIZIONARI.it[base + '_zero'] !== undefined) return t(base + '_zero', p);
  return t(base + (n === 1 ? '_uno' : '_altri'), p);
}
