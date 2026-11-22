// Sceglie quale stima mostrare. Regola: se gli ordini reali e le ipotesi non stanno insieme («i numeri non
// tornano»), gli ordini NON vengono usati per nessuna grandezza: si mostra la stima fatta con le sole ipotesi.
// Così un valore calibrato fuori scala non finisce in transazioni, entrate ed eventi chiave.
import { stima, type Avviso, type Config, type Dati, type PriorLN, type Risultato } from '../motore/modello';

export interface Conflitto {
  /** Ordini reali meno transazioni GA4 nel periodo */
  mancanti: number;
  /** Valore di «quanto converte» che servirebbe per spiegare gli ordini mancanti */
  rConvNecessario: number;
  /** 'troppi' = mancano più ordini di quanti le ipotesi possano spiegare; 'pochi' = ne mancano meno */
  direzione: 'troppi' | 'pochi';
  /**
   * Per ogni altra risposta sul tipo di pubblico: vero se con quella risposta il motore non segnalerebbe il
   * conflitto (stesso criterio, stessa configurazione). null se non calcolato.
   */
  compatibili: Record<string, boolean> | null;
}

export interface Esito {
  /** Stima da mostrare ovunque: schede, sintesi, grafici, stampa, CSV */
  ris: Risultato;
  /** Stima senza ordini reali, per «cosa hanno cambiato»; null se gli ordini non sono usati */
  risSenzaOrdini: Risultato | null;
  conflitto: Conflitto | null;
  /** Avvisi del motore che riguardano gli ordini reali (non applicati, scontrino diverso) */
  avvisiOrdini: Avviso[];
}

const CODICI_ORDINI = ['ordini_senza_transazioni', 'ordini_inferiori', 'scontrino_diverso'];

export function componiEsito(calcolato: Risultato, senzaOrdini: Risultato | null, rConvIpotesi: PriorLN, compatibili: Record<string, boolean> | null = null): Esito {
  const avvisiOrdini = calcolato.avvisi.filter((a) => CODICI_ORDINI.includes(a.codice));
  const a = calcolato.ancora;
  if (a?.attivo && a.conflitto && senzaOrdini) {
    const necessario = calcolato.parametri.rConv.p50;
    return {
      ris: senzaOrdini,
      risSenzaOrdini: null,
      conflitto: { mancanti: a.ordiniMancanti, rConvNecessario: necessario, direzione: necessario > rConvIpotesi.mediana ? 'troppi' : 'pochi', compatibili },
      avvisiOrdini,
    };
  }
  return { ris: calcolato, risSenzaOrdini: a?.attivo ? senzaOrdini : null, conflitto: null, avvisiOrdini };
}

/**
 * Intervallo di ciò che resta degli ordini reali dopo «visti + persi per il consenso»:
 * gli estremi si scambiano (più consenso = meno altre cause).
 */
export function altreCause(reale: number, totale: { p10: number; p50: number; p90: number }): { centrale: number; min: number; max: number } {
  const z = (x: number): number => Math.max(0, reale - x);
  return { centrale: z(totale.p50), min: z(totale.p90), max: z(totale.p10) };
}

/**
 * Ordini mancanti che le risposte prevedono, nel periodo degli ordini reali, divisi come li divide il motore:
 * persi per il consenso (stima senza ordini reali, valore centrale) e persi per altre cause
 * (quota «altre cause» del tipo di pubblico, valore centrale, applicata agli ordini reali).
 * `finestra` null = tutto il file.
 */
export function previstiDalleRisposte(senza: Risultato, ordini: number, altrePerdite: PriorLN, finestra: { dal: string; al: string } | null): { consenso: number; altre: number; totale: number } {
  const consenso = finestra
    ? senza.giorni.filter((g) => g.data >= finestra.dal && g.data <= finestra.al).reduce((x, g) => x + g.metriche.transazioni.totale.p50 - g.metriche.transazioni.osservato, 0)
    : senza.metriche.transazioni.perso.p50;
  const altre = ordini * Math.min(0.6, altrePerdite.mediana);
  return { consenso, altre, totale: consenso + altre };
}

/**
 * Se ordini reali e risposte non tornano: per ogni altra risposta sul tipo di pubblico, i conti tornerebbero?
 * Si rifà la stessa stima cambiando solo la quota «altre cause»; il criterio è quello del motore (ancora.conflitto).
 */
export function compatibiliPubblico(dati: Dati, config: Config, calcolato: Risultato, alternative: Record<string, PriorLN> | undefined): Record<string, boolean> | null {
  if (!calcolato.ancora?.conflitto || !config.ancora || !alternative) return null;
  const esiti: Record<string, boolean> = {};
  for (const [k, p] of Object.entries(alternative)) {
    const r = stima(dati, { ...config, ancora: { ...config.ancora, altrePerdite: p } });
    esiti[k] = Boolean(r.ancora?.attivo && !r.ancora.conflitto);
  }
  return esiti;
}
