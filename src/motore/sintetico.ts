// Generatore di dati sintetici con "verità" nota. Simula ogni singolo visitatore:
// volutamente NON usa le formule aggregate dello stimatore, così la validazione non è circolare.
import type { Dati, Metrica, Riga } from './modello';
import { Rng, logistica, logit } from './rng';

export interface CanaleSint {
  nome: string;
  /** Quota dei visitatori */
  quota: number;
  /** Probabilità di acquisto per sessione di chi accetta */
  cr: number;
  /** Eventi chiave (non acquisto) per sessione di chi accetta */
  tassoEventi: number;
  /** Scontrino medio di chi accetta */
  aov: number;
  /** Scostamento (logit) del consenso del canale rispetto al globale */
  delta: number;
}

export interface ScenarioSint {
  inizio: string;
  giorni: number;
  /** Sessioni totali attese (con e senza consenso) */
  sessioniAttese: number;
  canali: CanaleSint[];
  /** Quota di visitatori che accetta */
  pAccetta: number;
  /** Tra chi non accetta, quota che ignora il banner senza scegliere */
  quotaIgnora: number;
  /** Sessioni medie per visitatore di chi accetta */
  fA: number;
  rFreq: number;
  rConv: number;
  rConvEventi: number;
  rAov: number;
  cvOrdine: number;
  /** Dimensione dei grappoli di eventi chiave (1 = Poisson puro) */
  grappolo: number;
  /** Quota di ordini non tracciati per cause diverse dal consenso */
  altrePerdite: number;
  giorniPromo?: number[];
  /** Quota di visitatori a cui un ad blocker impedisce il tracciamento di GA (0 = nessuno) */
  bloccoGA?: number;
  /** Tra chi blocca GA, moltiplicatore degli odds di accettazione (1 = come gli altri; <1 = rifiuta di più) */
  bloccoRapportoConsenso?: number;
  /** Tra chi blocca GA, quota a cui il blocker nasconde anche il banner (la CMP non li vede) */
  bloccoBanner?: number;
  cambioBanner?: { giorno: number; pAccetta: number };
  /**
   * Dispositivi (facoltativi). Ogni visitatore riceve un dispositivo con probabilità `quota`; il suo consenso si sposta
   * di `delta` sulla scala logit e le sue visite si moltiplicano per `moltVisite` (per chi accetta e per chi no, così il
   * rapporto `rFreq` resta lo stesso dentro ogni dispositivo). Senza questo campo non si estrae nessun numero in più:
   * gli scenari esistenti, i dati di esempio e i test golden restano identici.
   */
  dispositivi?: { nome: string; quota: number; delta: number; moltVisite: number }[];
}

export interface EsitoSint {
  dati: Dati;
  verita: Record<Metrica, number> & { utentiPeriodo: number };
  veritaCanale: Record<string, Record<Metrica, number>>;
  cmp: {
    perUtente: number;
    perUtenteSenzaIgnora: number;
    perBanner: number;
    accettati: number;
    rifiutati: number;
    ignorati: number;
    /** Tasso per utente prima e dopo l'eventuale cambio di banner */
    perUtentePrima: number;
    perUtenteDopo: number;
    /** Solo con `dispositivi`: tasso per visitatore della CMP e quota delle sessioni osservate in GA4, per dispositivo */
    perDispositivo?: { nome: string; perUtente: number; quotaSessioniOss: number }[];
  };
  gestionale: { ordini: number; entrate: number };
  utentiPeriodoOsservati: number;
  /** Quota realizzata di ordini reali che non sono né osservati né di visitatori senza consenso */
  quotaAltreVera: number;
}

export const CANALI_BASE: CanaleSint[] = [
  { nome: 'Organic Search', quota: 0.34, cr: 0.022, tassoEventi: 0.05, aov: 82, delta: 0 },
  { nome: 'Direct', quota: 0.2, cr: 0.03, tassoEventi: 0.06, aov: 90, delta: 0 },
  { nome: 'Paid Search', quota: 0.16, cr: 0.028, tassoEventi: 0.07, aov: 76, delta: 0 },
  { nome: 'Paid Social', quota: 0.12, cr: 0.008, tassoEventi: 0.03, aov: 64, delta: 0 },
  { nome: 'Email', quota: 0.08, cr: 0.045, tassoEventi: 0.09, aov: 98, delta: 0 },
  { nome: 'Referral', quota: 0.05, cr: 0.015, tassoEventi: 0.04, aov: 85, delta: 0 },
  { nome: 'Organic Social', quota: 0.04, cr: 0.006, tassoEventi: 0.025, aov: 60, delta: 0 },
  { nome: 'Display', quota: 0.01, cr: 0.003, tassoEventi: 0.015, aov: 70, delta: 0 },
];

export function scenarioBase(): ScenarioSint {
  return {
    inizio: '2026-09-01',
    giorni: 30,
    sessioniAttese: 50000,
    canali: CANALI_BASE.map((c) => ({ ...c })),
    pAccetta: 0.6,
    quotaIgnora: 0.35,
    fA: 2.4,
    rFreq: 0.8,
    rConv: 0.4,
    rConvEventi: 0.4,
    rAov: 1,
    cvOrdine: 0.7,
    grappolo: 1,
    altrePerdite: 0,
  };
}

function aggiungiGiorni(iso: string, k: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + k);
  return d.toISOString().slice(0, 10);
}

/** Trova lo spostamento comune che riporta la media pesata dei tassi di canale al tasso globale. */
function tassiCanale(canali: CanaleSint[], p: number): number[] {
  const tot = canali.reduce((s, c) => s + c.quota, 0);
  const media = (x: number): number => canali.reduce((s, c) => s + (c.quota / tot) * logistica(logit(p) + c.delta - x), 0);
  let lo = -10;
  let hi = 10;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (media(mid) > p) lo = mid;
    else hi = mid;
  }
  const x = (lo + hi) / 2;
  return canali.map((c) => logistica(logit(p) + c.delta - x));
}

const SETTIMANA = [1, 1.05, 1, 1, 0.95, 0.8, 0.75];

export function genera(sc: ScenarioSint, rng: Rng): EsitoSint {
  const G = sc.giorni;
  const C = sc.canali.length;
  const promo = new Set(sc.giorniPromo ?? []);
  const taglio = sc.cambioBanner?.giorno ?? G;

  // pesi dei giorni (cumulati) per le due epoche
  const pesi = new Float64Array(G);
  for (let d = 0; d < G; d++) pesi[d] = SETTIMANA[d % 7] * (promo.has(d) ? 1.8 : 1);
  const cumula = (da: number, a: number): { cum: Float64Array; da: number } => {
    const cum = new Float64Array(a - da);
    let s = 0;
    for (let d = da; d < a; d++) {
      s += pesi[d];
      cum[d - da] = s;
    }
    return { cum, da };
  };
  const epoche = [cumula(0, taglio), ...(taglio < G ? [cumula(taglio, G)] : [])];
  const pesoEpoca = epoche.map((e) => e.cum[e.cum.length - 1]);
  const estraiGiorno = (e: number): number => {
    const { cum, da } = epoche[e];
    const u = rng.u() * cum[cum.length - 1];
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < u) lo = mid + 1;
      else hi = mid;
    }
    return da + lo;
  };

  const pEpoca = [sc.pAccetta, ...(taglio < G ? [sc.cambioBanner!.pAccetta] : [])];
  const pCanale = pEpoca.map((p) => tassiCanale(sc.canali, p));
  const fN = Math.max(1, sc.fA * sc.rFreq);
  const totQuote = sc.canali.reduce((s, c) => s + c.quota, 0);
  const sigma2 = Math.log(1 + sc.cvOrdine * sc.cvOrdine);
  const sigma = Math.sqrt(sigma2);

  // osservato (solo chi accetta): [giorno][canale]
  const oS = new Float64Array(G * C);
  const oU = new Float64Array(G * C);
  const oK = new Float64Array(G * C);
  const oT = new Float64Array(G * C);
  const oR = new Float64Array(G * C);
  const nomi: Metrica[] = ['sessioni', 'utentiGiorno', 'eventi', 'transazioni', 'entrate'];
  const vC = sc.canali.map(() => ({ sessioni: 0, utentiGiorno: 0, eventi: 0, transazioni: 0, entrate: 0 }) as Record<Metrica, number>);
  let ordini = 0;
  let entrateGest = 0;
  let nA = 0;
  let nR = 0;
  let nI = 0;
  let impressioni = 0;
  const visEpoca = [0, 0];
  const accEpoca = [0, 0];
  const giorniVisti: number[] = [];
  const blocco = sc.bloccoGA ?? 0;
  let nVerita = 0;
  let nOss = 0;
  const disp = sc.dispositivi;
  const totDisp = disp ? disp.reduce((x, d) => x + d.quota, 0) : 0;
  const dVis = disp ? disp.map(() => 0) : [];
  const dAcc = disp ? disp.map(() => 0) : [];
  const dSessOss = disp ? disp.map(() => 0) : [];

  for (let c = 0; c < C; c++) {
    const can = sc.canali[c];
    for (let e = 0; e < epoche.length; e++) {
      const pe = pEpoca[e];
      const mediaSess = pe * sc.fA + (1 - pe) * fN;
      const quotaEpoca = pesoEpoca[e] / pesoEpoca.reduce((x, y) => x + y, 0);
      const nVis = rng.poisson(((sc.sessioniAttese * quotaEpoca) / mediaSess) * (can.quota / totQuote));
      const pc = pCanale[e][c];
      for (let v = 0; v < nVis; v++) {
        // Ad blocker: i numeri casuali in più si estraggono solo se lo scenario li prevede,
        // così gli scenari esistenti restano identici.
        let bloccato = false;
        let nascosto = false;
        let pv = pc;
        if (blocco > 0) {
          bloccato = rng.u() < blocco;
          if (bloccato) {
            nascosto = rng.u() < (sc.bloccoBanner ?? 0);
            pv = logistica(logit(pc) + Math.log(sc.bloccoRapportoConsenso ?? 1));
          }
        }
        // Dispositivo: si estrae solo se lo scenario lo prevede (vedi ScenarioSint.dispositivi).
        let id = -1;
        let molt = 1;
        if (disp) {
          let u = rng.u() * totDisp;
          id = 0;
          while (id < disp.length - 1 && u >= disp[id].quota) u -= disp[id++].quota;
          pv = logistica(logit(pv) + disp[id].delta);
          molt = disp[id].moltVisite;
        }
        const accetta = rng.u() < pv && !nascosto;
        const ignora = !accetta && rng.u() < sc.quotaIgnora;
        const nSess = 1 + rng.poisson(disp ? Math.max(0, (accetta ? sc.fA : fN) * molt - 1) : (accetta ? sc.fA : fN) - 1);
        const osservato = accetta && !bloccato;
        if (id >= 0 && !nascosto) {
          dVis[id]++;
          if (accetta) dAcc[id]++;
          if (osservato) dSessOss[id] += nSess;
        }
        // «Verità»: ciò che GA4 vede + tutto ciò che viene da visitatori senza consenso che la CMP ha visto.
        const inVerita = osservato || (!accetta && !nascosto);
        if (inVerita) nVerita++;
        if (osservato) nOss++;
        if (nascosto) {
          // la CMP non lo vede affatto
        } else {
          visEpoca[e]++;
        }
        if (nascosto) {
          // nessun conteggio CMP
        } else if (accetta) {
          nA++;
          accEpoca[e]++;
          impressioni += 1;
        } else if (ignora) {
          nI++;
          impressioni += nSess;
        } else {
          nR++;
          impressioni += 1;
        }
        giorniVisti.length = 0;
        for (let s = 0; s < nSess; s++) {
          const d = estraiGiorno(e);
          const nuovoGiorno = !giorniVisti.includes(d);
          if (nuovoGiorno) giorniVisti.push(d);
          const mP = promo.has(d) ? 1.5 : 1;
          const k = rng.poisson(((can.tassoEventi * (accetta ? 1 : sc.rConvEventi)) / sc.grappolo) * mP) * sc.grappolo;
          let t = 0;
          let r = 0;
          if (rng.u() < can.cr * mP * (accetta ? 1 : sc.rConv)) {
            const media = can.aov * (accetta ? 1 : sc.rAov);
            const valore = Math.exp(Math.log(media) - sigma2 / 2 + sigma * rng.normale());
            ordini++;
            entrateGest += valore;
            // Le perdite tecniche contano solo per chi ha dato il consenso: un ordine senza consenso
            // è già «perso per il consenso» e non va contato due volte.
            const persoTecnico = rng.u() < sc.altrePerdite;
            if (!accetta || !persoTecnico) {
              t = 1;
              r = valore;
            }
          }
          if (inVerita) {
            vC[c].sessioni++;
            if (nuovoGiorno) vC[c].utentiGiorno++;
            vC[c].eventi += k;
            vC[c].transazioni += t;
            vC[c].entrate += r;
          }
          if (osservato) {
            const j = d * C + c;
            oS[j]++;
            if (nuovoGiorno) oU[j]++;
            oK[j] += k;
            oT[j] += t;
            oR[j] += r;
          }
        }
      }
    }
  }

  const righe: Riga[] = [];
  for (let d = 0; d < G; d++) {
    const data = aggiungiGiorni(sc.inizio, d);
    for (let c = 0; c < C; c++) {
      const j = d * C + c;
      if (oS[j] <= 0) continue;
      righe.push({
        data,
        canale: sc.canali[c].nome,
        sessioni: oS[j],
        utenti: oU[j],
        eventi: oK[j],
        transazioni: oT[j],
        entrate: Math.round(oR[j] * 100) / 100,
      });
    }
  }

  const verita = { sessioni: 0, utentiGiorno: 0, eventi: 0, transazioni: 0, entrate: 0, utentiPeriodo: nVerita };
  const veritaCanale: Record<string, Record<Metrica, number>> = {};
  sc.canali.forEach((can, c) => {
    veritaCanale[can.nome] = vC[c];
    for (const k of nomi) verita[k] += vC[c][k];
  });
  const vis = nA + nR + nI;
  return {
    dati: { righe, haUtenti: true, haEventi: true, haTransazioni: true, haEntrate: true },
    verita,
    veritaCanale,
    cmp: {
      perUtente: nA / vis,
      perUtenteSenzaIgnora: nA / Math.max(1, nA + nR),
      perBanner: nA / impressioni,
      accettati: nA,
      rifiutati: nR,
      ignorati: nI,
      perUtentePrima: accEpoca[0] / Math.max(1, visEpoca[0]),
      perUtenteDopo: epoche.length > 1 ? accEpoca[1] / Math.max(1, visEpoca[1]) : accEpoca[0] / Math.max(1, visEpoca[0]),
      ...(disp
        ? {
            perDispositivo: disp.map((d, i) => ({
              nome: d.nome,
              perUtente: dAcc[i] / Math.max(1, dVis[i]),
              quotaSessioniOss: dSessOss[i] / Math.max(1, dSessOss.reduce((x, y) => x + y, 0)),
            })),
          }
        : {}),
    },
    gestionale: { ordini, entrate: entrateGest },
    utentiPeriodoOsservati: nOss,
    quotaAltreVera: ordini > 0 ? 1 - verita.transazioni / ordini : 0,
  };
}

/** Converte i dati in un CSV con la forma dell'export di GA4. Intestazioni e formato dei numeri dipendono dalla lingua. */
export function versoCsvGa4(
  dati: Dati,
  titolo = 'Esempio (dati finti)',
  intestazioni = 'Data,Gruppo di canali predefinito della sessione,Sessioni,Utenti totali,Eventi chiave,Transazioni,Entrate totali',
  totale = 'Totale generale',
  locale = 'it-IT',
): string {
  const d0 = dati.righe[0]?.data.replaceAll('-', '') ?? '';
  const d1 = dati.righe[dati.righe.length - 1]?.data.replaceAll('-', '') ?? '';
  const num = (x: number): string => `"${x.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })}"`;
  const out = ['# ----------------------------------------', `# ${titolo}`, '# Free form 1', `# ${d0}-${d1}`, '# ----------------------------------------', '', intestazioni];
  const tot = dati.righe.reduce((a, r) => [a[0] + r.sessioni, a[1] + r.utenti, a[2] + r.eventi, a[3] + r.transazioni, a[4] + r.entrate], [0, 0, 0, 0, 0]);
  out.push(`,${totale},${tot[0]},${tot[1]},${tot[2]},${tot[3]},${num(tot[4])}`);
  for (const r of dati.righe) out.push(`${r.data.replaceAll('-', '')},${r.canale},${r.sessioni},${r.utenti},${r.eventi},${r.transazioni},${num(r.entrate)}`);
  return out.join('\n') + '\n';
}
