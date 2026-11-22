// Risposte e ipotesi nel frammento # dell'indirizzo (che non viene inviato al server).
// Non contiene MAI dati dell'azienda: niente file, ordini o entrate reali, periodo degli ordini, utenti del periodo.
import type { Metrica } from '../motore/modello';
import { IPOTESI, type Stato } from './stato';

export const VERSIONE = '1';

const SEMPLICI: [string, keyof Stato][] = [
  ['cm', 'cm'],
  ['id', 'identita'],
  ['ic', 'icona'],
  ['t', 'tasso'],
  ['ta', 'precisione'],
  ['tm', 'misura'],
  ['ti', 'ignora'],
  ['tq', 'quotaIgnora'],
  ['ac', 'accettati'],
  ['na', 'nonAccettati'],
  ['pb', 'pubblico'],
  ['av', 'altreValore'],
  ['m', 'metrica'],
  ['val', 'valuta'],
];
const AMMESSI: Partial<Record<keyof Stato, string[]>> = {
  cm: ['basic', 'advanced', 'nonso'],
  identita: ['combinata', 'osservata', 'nonso'],
  icona: ['inclusi', 'no', 'nonso'],
  precisione: ['preciso', 'stima', 'massima'],
  misura: ['utente', 'banner', 'nonso'],
  ignora: ['incluso', 'escluso', 'nonso'],
  pubblico: ['consumo', 'tecnico', 'misto', 'server', 'valore'],
  metrica: ['sessioni', 'utentiGiorno', 'eventi', 'transazioni', 'entrate'] satisfies Metrica[],
  valuta: ['€', '$', '£', ''],
};
const DISPOSITIVI = ['mobile', 'desktop', 'tablet'] as const;
const numerico = (v: string): boolean => /^[0-9]{1,9}([.,][0-9]{1,4})?$/.test(v);

/** Costruisce il frammento (senza #) con le sole risposte e ipotesi. */
export function codifica(s: Stato): string {
  const p = new URLSearchParams();
  p.set('v', VERSIONE);
  for (const [k, campo] of SEMPLICI) {
    const v = s[campo] as string;
    if (v !== '' && !(campo === 'metrica' && v === 'sessioni') && !(campo === 'valuta' && v === '€')) p.set(k, v);
  }
  if (s.usaConteggi) p.set('uc', '1');
  if (s.esperti) p.set('e', '1');
  for (const d of DISPOSITIVI) {
    if (s.device[d].tasso) p.set(`d${d[0]}`, s.device[d].tasso);
    if (s.device[d].quota) p.set(`d${d[0]}q`, s.device[d].quota);
  }
  s.periodi.forEach((x, i) => {
    if (x.dal && x.tasso) {
      p.set(`p${i + 1}`, x.dal);
      p.set(`p${i + 1}t`, x.tasso);
    }
  });
  for (const k of IPOTESI) {
    if (s.valori[k] !== null) p.set(k, String(s.valori[k]));
    if (s.sicurezza[k] !== '1') p.set(`s${k}`, s.sicurezza[k]);
  }
  return p.toString();
}

/** Legge un frammento. Restituisce null se non contiene ipotesi, 'ignoto' se la versione non è riconosciuta. */
export function decodifica(frammento: string): Partial<Stato> | null | 'ignoto' {
  const p = new URLSearchParams(frammento.replace(/^#/, ''));
  if (!p.has('v')) return null;
  if (p.get('v') !== VERSIONE) return 'ignoto';
  const out: Record<string, unknown> = {};
  for (const [k, campo] of SEMPLICI) {
    const v = p.get(k);
    if (v === null) continue;
    const ammessi = AMMESSI[campo];
    if (ammessi ? ammessi.includes(v) : numerico(v)) out[campo] = v;
  }
  if (p.get('uc') === '1') out.usaConteggi = true;
  if (p.get('e') === '1') out.esperti = true;
  const device = { mobile: { tasso: '', quota: '' }, desktop: { tasso: '', quota: '' }, tablet: { tasso: '', quota: '' } };
  for (const d of DISPOSITIVI) {
    const t = p.get(`d${d[0]}`);
    const q = p.get(`d${d[0]}q`);
    if (t && numerico(t)) device[d].tasso = t;
    if (q && numerico(q)) device[d].quota = q;
  }
  out.device = device;
  out.periodi = [1, 2].map((i) => {
    const dal = p.get(`p${i}`) ?? '';
    const tasso = p.get(`p${i}t`) ?? '';
    return /^\d{4}-\d{2}-\d{2}$/.test(dal) && numerico(tasso) ? { dal, tasso } : { dal: '', tasso: '' };
  });
  // Link di prima del 18/11/2026: potevano contenere tassi per canale («c.<canale>»), che non si usano più.
  if ([...p.keys()].some((k) => k.startsWith('c.'))) out.canaliIgnorati = true;
  const valori: Record<string, number | null> = { rFreq: null, rConv: null, rAov: null };
  const sicurezza: Record<string, string> = { rFreq: '1', rConv: '1', rAov: '1' };
  for (const k of IPOTESI) {
    const v = Number(p.get(k));
    if (p.has(k) && Number.isFinite(v) && v >= 0.05 && v <= 2) valori[k] = v;
    const sic = p.get(`s${k}`);
    if (sic && ['0.5', '1', '1.5'].includes(sic)) sicurezza[k] = sic;
  }
  out.valori = valori;
  out.sicurezza = sicurezza;
  return out as Partial<Stato>;
}
