// Esportazione dei risultati in CSV, generata nel browser.
import type { Metrica, Quantili } from '../motore/modello';
import { perCsv } from '../i18n/formato';
import { IPOTESI, ipotesi, margine, metricheDisponibili, nPredefinite, datiDaStimare, utentiEffettivi } from './stato';
import { calibrate, riepilogoCM, type Contesto } from './vistaIngressi';

export function scarica(nome: string, contenuto: string): void {
  const url = URL.createObjectURL(new Blob(['﻿' + contenuto], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function csvRisultati(c: Contesto): string {
  const r = c.ris!;
  const s = c.s;
  const d = datiDaStimare(s)!;
  const ms = metricheDisponibili(d);
  const n = (x: number, dec: number): string => perCsv(x, dec, c.lingua);
  const cella = (x: string): string => `"${x.replace(/<[^>]+>/g, '').replace(/"/g, '""')}"`;
  const nome = (m: Metrica): string => cella(c.t(`metrica.${m}`));
  const q = (m: Metrica, x: { osservato: number; totale: Quantili }): string => {
    const dec = m === 'entrate' ? 2 : 1;
    return [n(x.osservato, m === 'entrate' ? 2 : 0), n(x.totale.p50, dec), n(x.totale.p10, dec), n(x.totale.p90, dec), n(x.totale.p2_5, dec), n(x.totale.p97_5, dec)].join(';');
  };
  const out: string[] = [c.t('esporta.csvIntestazione')];
  for (const m of ms) out.push(`${c.t('esporta.csvRiepilogo')};${cella(c.t('esporta.csvTotale'))};${nome(m)};${q(m, r.metriche[m])}`);
  if (r.utentiPeriodo) out.push(`${c.t('esporta.csvRiepilogo')};${cella(c.t('esporta.csvTotale'))};${cella(c.t('metrica.utentiPeriodo'))};${q('sessioni', r.utentiPeriodo)}`);
  for (const can of r.canali) for (const m of ms) out.push(`${c.t('esporta.csvCanale')};${cella(can.canale)};${nome(m)};${q(m, can.metriche[m])}`);
  for (const g of r.giorni) for (const m of ms) out.push(`${c.t('esporta.csvGiorno')};${g.data};${nome(m)};${q(m, g.metriche[m])}`);

  out.push('', c.t('esporta.csvIpotesi'));
  const p = r.parametri;
  out.push(`${cella(c.t('esporta.csvTasso'))};${n(p.tassoEffettivo.p50, 3)};${n(p.tassoEffettivo.p2_5, 3)};${n(p.tassoEffettivo.p97_5, 3)};`);
  const cal = calibrate(c);
  for (const k of IPOTESI) {
    const st = cal.includes(k) ? 'calibrata' : s.statoIpotesi[k] === 'pred' ? 'predefinita' : s.statoIpotesi[k] === 'conf' ? 'confermata' : 'modificata';
    if (cal.includes(k)) {
      const x = k === 'rConv' ? p.rConv : p.rAov;
      out.push(`${cella(c.t(`ip.${k}`))};${n(x.p50, 3)};${n(x.p2_5, 3)};${n(x.p97_5, 3)};${cella(c.t(`stato.${st}`))}`);
    } else {
      const ip = ipotesi(s, k);
      const [a, b] = margine(ip);
      out.push(`${cella(c.t(`ip.${k}`))};${n(ip.mediana, 3)};${n(a, 3)};${n(b, 3)};${cella(c.t(`stato.${st}`))}`);
    }
  }
  const riga = (chiave: string, valore: string): void => void out.push(`${cella(c.t(chiave))};${cella(valore)};;;`);
  riga('esporta.csvPredefinite', String(nPredefinite(s, cal)));
  riga('esporta.csvConsentMode', riepilogoCM(c));
  riga('esporta.csvMisura', c.t(`tasso.riepMisura${s.misura === 'utente' ? 'Utente' : s.misura === 'banner' ? 'Banner' : 'Nonso'}`));
  riga('esporta.csvIgnora', c.t(`tasso.riepIgnora${s.ignora === 'incluso' ? 'Incluso' : s.ignora === 'escluso' ? 'Escluso' : 'Nonso'}`));
  riga('esporta.csvOrdini', c.t(c.conflitto ? (c.conflitto.direzione === 'pochi' ? 'esporta.noPochi' : 'esporta.noTroppi') : r.ancora?.attivo ? 'esporta.si' : 'esporta.no'));
  const u = utentiEffettivi(s);
  if (u.valore) riga('utenti.csv', c.t(u.fonte === 'export' ? 'utenti.csvExport' : 'utenti.csvUtente', { v: c.f.intero(u.valore) }));
  else if (u.fonte === 'no') riga('utenti.csv', c.t('utenti.csvNo'));
  if (r.ancora?.attivo) riga('esporta.csvPubblico', s.pubblico === 'valore' ? `${s.altreValore}%` : c.t(`ordini.${s.pubblico}`));
  riga('esporta.csvSimulazioni', String(r.diagnostica.nSim));
  riga('esporta.csvNota', c.t('esporta.csvNotaTesto'));
  return out.join('\r\n');
}
