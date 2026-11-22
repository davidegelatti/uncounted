// Web Worker: esegue la simulazione fuori dal thread dell'interfaccia.
import { stima, type Config, type Dati, type PriorLN } from './motore/modello';
import { compatibiliPubblico } from './strumento/esito';

interface Richiesta {
  id: number;
  dati: Dati;
  config: Config;
  /** Altre risposte sul tipo di pubblico da provare se ordini reali e risposte non tornano */
  alternative?: Record<string, PriorLN>;
}

self.onmessage = (ev: MessageEvent<Richiesta>): void => {
  const { id, dati, config, alternative } = ev.data;
  try {
    const doppio = Boolean(config.ancora);
    let ultimo = 0;
    const avanza = (da: number, peso: number) => (f: number): void => {
      const tot = da + f * peso;
      if (tot - ultimo >= 0.04 || tot >= 1) {
        ultimo = tot;
        self.postMessage({ id, tipo: 'progresso', frazione: tot });
      }
    };
    const risultato = stima(dati, config, avanza(0, doppio ? 0.5 : 1));
    // Con gli ordini reali si calcola anche la stima senza, per mostrare che cosa cambia.
    const senzaOrdini = doppio ? stima(dati, { ...config, ancora: undefined }, avanza(0.5, 0.5)) : null;
    // Se i conti non tornano: con quale altra risposta sul pubblico tornerebbero? Stesso motore, stesso criterio.
    const compatibili = compatibiliPubblico(dati, config, risultato, alternative);
    self.postMessage({ id, tipo: 'fine', risultato, senzaOrdini, compatibili });
  } catch (e) {
    self.postMessage({ id, tipo: 'errore', codice: e instanceof Error ? e.message : 'nessuna_riga' });
  }
};
