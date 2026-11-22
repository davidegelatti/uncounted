// Vista dei risultati: sintesi, dato principale, schede, grafici, solidità, esportazione.
import type { Metrica, Quantili, StimaMetrica } from '../motore/modello';
import { esc } from '../i18n/indice';
import { barraImpilata, barraIntervallo, passoIncertezza, barraOrdini, barraQuota, graficoCanali, graficoGiorni, graficoSensibilita } from './grafici';
import { altreCause, previstiDalleRisposte } from './esito';
import { ALTRE_PERDITE_PUBBLICO, type Pubblico } from './pubblico';
import { IPOTESI, altrePerdite, utentiEffettivi, completo, configurazione, esitoCM, ipotesi, margine, metricheDisponibili, numero, ordiniSuTuttoIlFile, percento } from './stato';
import { calibrate, conValuta, etichettaPredefinite, fraseIpotesi, fuori, plausibileIpotesi, riepilogoCM, riepilogoTasso, statoLink, type Contesto } from './vistaIngressi';

const nomeMetrica = (c: Contesto, m: Metrica): string => (m === 'eventi' && c.s.file?.info.colonne.eventi && c.s.file.info.colonneEventi.length >= 2 ? c.s.file.info.colonne.eventi : c.t(`metrica.${m}`));
const fmtS = (c: Contesto, m: Metrica, x: number): string => (m === 'entrate' ? conValuta(c, c.f.stimato(x)) : c.f.stimato(x));
const fmtO = (c: Contesto, m: Metrica, x: number): string => (m === 'entrate' ? conValuta(c, c.f.intero(x)) : c.f.intero(x));
const circa = (c: Contesto, v: string): string => c.t('comune.circa', { v });

/** Vero se gli ordini reali sono usati e coprono tutto il file (si può mostrare la divisione in tre parti). */
function ordiniCompleti(c: Contesto): boolean {
  return Boolean(c.ris?.ancora?.attivo) && ordiniSuTuttoIlFile(c.s);
}

export function legenda(c: Contesto): string {
  return `<ul class="legenda" aria-hidden="true"><li><i class="l-oss-q"></i> ${c.t('graf.osservato')}</li><li><i class="l-med-q"></i> ${c.t('graf.stimato')}</li><li><i class="l-80-q"></i> ${c.t('graf.otto')}</li><li><i class="l-95-q"></i> ${c.t('graf.diciannove')}</li></ul>`;
}

function schedaMetrica(c: Contesto, m: Metrica, s: StimaMetrica, titolo: string, extra = ''): string {
  return `<article class="scheda metrica"><div class="sm-a"><h3>${titolo}</h3>
    <p class="grande">${circa(c, fmtS(c, m, s.totale.p50))}</p>
    <p>${c.t('ris.probabilmente', { a: fmtS(c, m, s.totale.p10), b: fmtS(c, m, s.totale.p90) })}</p></div>
    <div class="sm-b"><dl><dt class="ic-prima ic-eye">${c.t('ris.osservato')}</dt><dd>${fmtO(c, m, s.osservato)}</dd>
      <dt class="ic-prima ic-eye-off">${c.t('ris.perso')}</dt><dd>${circa(c, fmtS(c, m, s.perso.p50))}</dd>
      <dt>${c.t('ris.quasiCertamente')}</dt><dd><span class="nw">${fmtS(c, m, s.totale.p2_5)} –</span> <span class="nw">${fmtS(c, m, s.totale.p97_5)}</span></dd>
      ${extra}</dl></div></article>`;
}

/** Scheda «I tuoi ordini reali: N»: il numero inserito resta in evidenza, diviso in tre parti. */
function schedaReali(c: Contesto, m: 'transazioni' | 'entrate', reale: number, s: StimaMetrica): string {
  const titolo = m === 'transazioni' ? c.t('ris.ordiniTitolo', { n: c.f.intero(reale) }) : c.t('ris.entrateOrdiniTitolo', { v: conValuta(c, c.f.intero(reale)) });
  const altre = altreCause(reale, s.totale);
  return `<article class="scheda"><h3>${titolo} <span class="et cal">${c.t('ris.dagliOrdini')}</span></h3>
    <dl class="tre-parti">
      <dt><i class="l-oss-q"></i> ${c.t('ris.ordiniVisti')}</dt><dd>${fmtO(c, m, s.osservato)}</dd>
      <dt><i class="l-med-q"></i> ${c.t('ris.ordiniConsenso')}</dt><dd>${circa(c, fmtS(c, m, s.perso.p50))} <span class="nota nw">(${fmtS(c, m, s.perso.p10)} – ${fmtS(c, m, s.perso.p90)})</span></dd>
      <dt><i class="l-altre-q"></i> ${c.t('ris.ordiniAltre')}</dt><dd>${circa(c, fmtS(c, m, altre.centrale))} <span class="nota nw">(${fmtS(c, m, altre.min)} – ${fmtS(c, m, altre.max)})</span></dd>
      <dt class="somma">${c.t('ris.ordiniSomma')}</dt><dd class="somma">${circa(c, fmtS(c, m, s.totale.p50))}</dd>
    </dl></article>`;
}

function schede(c: Contesto): string {
  const r = c.ris!;
  const d = c.s.file2 && esitoCM(c.s) === 'blocco' ? c.s.file2.dati : c.s.file!.dati;
  let out = schedaMetrica(c, 'sessioni', r.metriche.sessioni, c.t('ris.totali', { m: c.t('metrica.sessioni') }));
  const senza = c.conflitto ? ` <span class="et avv">${c.t('stato.senzaOrdini')}</span>` : '';
  if (d.haTransazioni) {
    const anc = r.ancora?.attivo;
    if (anc && ordiniCompleti(c)) out += schedaReali(c, 'transazioni', numero(c.s.ordini)!, r.metriche.transazioni);
    else out += schedaMetrica(c, 'transazioni', r.metriche.transazioni, anc ? `${c.t('ris.transazioniConsenso')} <span class="et cal">${c.t('ris.dagliOrdini')}</span>` : c.t('ris.totali', { m: c.t('metrica.transazioni') }) + senza);
  }
  if (d.haEntrate) {
    const anc = r.ancora?.attivo;
    const reali = numero(c.s.entrate);
    if (anc && r.ancora!.rAovCalibrato && ordiniCompleti(c) && reali) out += schedaReali(c, 'entrate', reali, r.metriche.entrate);
    else out += schedaMetrica(c, 'entrate', r.metriche.entrate, anc ? `${c.t('ris.entrateConsenso')} <span class="et cal">${c.t('ris.dagliOrdini')}</span>` : c.t('ris.totali', { m: c.t('metrica.entrate') }) + senza);
  }
  if (d.haEventi) out += schedaMetrica(c, 'eventi', r.metriche.eventi, c.t('ris.totali', { m: esc(nomeMetrica(c, 'eventi')) }) + senza);
  if (d.haUtenti) {
    const ug = `<dt>${c.t('ris.utentiGiornoRiga')}</dt><dd>${circa(c, c.f.stimato(r.metriche.utentiGiorno.totale.p50))}</dd>`;
    const nota = `<p class="nota sopra">${c.t('ris.utentiGiornoNota')} ${fuori(c, 'utenti', c.t('comune.approfondisci'))}</p>`;
    const u = utentiEffettivi(c.s);
    // provenienza del valore e collegamento alla scheda a sinistra (che la mette a fuoco)
    const vai = `<button type="button" class="btn testo non-stampare" data-a="vai-ipotesi" data-v="utenti">${c.t('comune.modifica')}</button>`;
    const fonte = u.fonte === 'export' ? c.t('utenti.notaExport') : u.fonte === 'utente' ? c.t('utenti.notaUtente') : '';
    out += r.utentiPeriodo
      ? schedaMetrica(c, 'sessioni', r.utentiPeriodo, c.t('metrica.utentiPeriodo'), ug).replace(/<\/div><\/article>$/, `<p class="nota sopra fonte-utenti">${fonte} ${vai}</p>${nota}</div></article>`)
      : `<article class="scheda metrica"><div class="sm-a"><h3>${c.t('ris.utentiTitolo')}</h3><p><strong>${c.t('ris.utentiNo')}</strong></p><p class="nota">${c.t(u.fonte === 'no' ? 'ris.utentiNoNotaTotali' : 'ris.utentiNoNota')} ${vai}</p></div><div class="sm-b"><dl>${ug}</dl>${nota}</div></article>`;
  }
  return `<div class="metriche">${out}</div>`;
}

/** Quota di sessioni che GA4 mostra (stima centrale del dato principale). */
export function quotaMostrata(c: Contesto): number {
  const s = c.ris!.metriche.sessioni;
  return s.totale.p50 > 0 ? s.osservato / s.totale.p50 : 1;
}

/**
 * Perché la quota di sessioni non coincide con il tasso: con un solo tasso, quota ≈ p / (p + (1 − p) × r),
 * con p = tasso effettivamente usato (dopo le correzioni) e r = mediana di «quante volte ritorna».
 * null se la differenza è sotto un punto; `generico` se intervengono tassi per dispositivo o per periodo.
 */
export function spiegaQuota(c: Contesto): { quota: number; tasso: number; rFreq: number; formula: number; generico: boolean } | null {
  const r = c.ris!;
  const quota = quotaMostrata(c);
  const tasso = r.parametri.tassoEffettivo.p50;
  if (Math.abs(quota - tasso) < 0.01) return null;
  const cfg = configurazione(c.s);
  const rFreq = ipotesi(c.s, 'rFreq').mediana;
  const formula = tasso / (tasso + (1 - tasso) * rFreq);
  return { quota, tasso, rFreq, formula, generico: Boolean(cfg.device || cfg.periodi) };
}

function rigaPerche(c: Contesto): string {
  const sp = spiegaQuota(c);
  if (!sp) return '';
  const link = `<button type="button" class="btn testo piccolo" data-a="vai-ipotesi" data-v="rFreq">${c.t('ris.percheCambia')}</button>`;
  if (sp.generico) return `<p class="perche">${c.t('ris.percheGenerico')} ${link}</p>`;
  const inserito = c.s.tasso && !c.s.accettati ? percento(c.s.tasso) : undefined;
  const corretto = inserito !== undefined && Math.abs(inserito - sp.tasso) >= 0.01 ? c.t('ris.percheCorretto') : '';
  const P = c.f.pctArt(sp.tasso);
  return `<p class="perche"><strong>${c.t('ris.percheTitolo', { q: c.f.pctArt(sp.quota), p: c.f.pctArt(sp.tasso) })}</strong> ${c.t(sp.rFreq < 1 ? 'ris.perchePiu' : 'ris.percheMeno', { P: P.charAt(0).toUpperCase() + P.slice(1), r: c.f.rapporto(sp.rFreq), corretto })} ${link}</p>`;
}

export function eroe(c: Contesto): string {
  const r = c.ris!;
  const s = r.metriche.sessioni;
  const v = (q: number): number => (q > 0 ? s.osservato / q : 1);
  const q = [v(s.totale.p97_5), v(s.totale.p90), v(s.totale.p50), v(s.totale.p10), v(s.totale.p2_5)];
  const aperto = c.aiutiAperti.has('eroe');
  let seconda = '';
  if (c.s.file!.dati.haTransazioni && esitoCM(c.s) !== 'blocco') {
    const tr = r.metriche.transazioni;
    if (r.ancora?.attivo && ordiniCompleti(c)) seconda = c.t('ris.eroeTransazioniOrdini', { pct: c.f.pctArt(tr.osservato / numero(c.s.ordini)!) });
    else seconda = c.t('ris.eroeTransazioni', { pct: c.f.pctArt(1 - tr.quotaPersa.p50), a: c.f.pctArt(1 - tr.quotaPersa.p90), b: c.f.pctArt(1 - tr.quotaPersa.p10) });
  }
  return `<div class="scheda eroe" id="dato-principale" tabindex="-1">
    <p class="titolo">${c.t('ris.eroe', { pct: c.f.pctArt(q[2]) })}</p>
    <p>${c.t('ris.eroeIntervallo', { a: c.f.pctArt(q[1]), b: c.f.pctArt(q[3]) })} <button type="button" class="aiuto-btn" data-a="aiuto" data-v="eroe" aria-expanded="${aperto}" aria-controls="aiuto-eroe" aria-label="${c.t('comune.spiegazione')}">?</button></p>
    ${esitoCM(c.s) === 'blocco' ? '' : rigaPerche(c)}
    <p class="nota spiega" id="aiuto-eroe"${aperto ? '' : ' hidden'}>${c.t('ris.eroeAiuto', { a: c.f.pctArt(q[0]), b: c.f.pctArt(q[4]) })} ${fuori(c, 'leggereIntervalli', c.t('comune.approfondisci'))}</p>
    <div class="visib">${barraQuota(q, c.t('ris.eroeAria', { pct: c.f.pct(q[2]), a: c.f.pct(q[1]), b: c.f.pct(q[3]) }))}</div>
    <div class="visib-leg"><span><i class="l-oss-q"></i><span class="ic ic-eye" aria-hidden="true"></span> ${c.t('ris.vede', { v: c.f.intero(s.osservato) })}</span><span><i class="l-med-q"></i><span class="ic ic-eye-off" aria-hidden="true"></span> ${c.t('ris.nonVede', { v: c.f.stimato(s.perso.p50) })}</span></div>
    ${seconda ? `<p class="sopra">${seconda}</p>` : ''}
  </div>`;
}

function treParti(c: Contesto): string {
  const r = c.ris!;
  if (!ordiniCompleti(c)) return '';
  const o = numero(c.s.ordini)!;
  const t = r.metriche.transazioni;
  const q = [t.totale.p2_5, t.totale.p10, t.totale.p50, t.totale.p90, t.totale.p97_5].map((x) => x / o);
  const pubblico = c.s.pubblico === 'valore' ? `${c.s.altreValore}%` : c.t(`ordini.${c.s.pubblico}`);
  return `<div class="scheda sez"><h2>${c.t('ris.ordiniTitolo', { n: c.f.intero(o) })}</h2>
    <div class="visib">${barraOrdini(t.osservato / o, q, c.t('ris.ordiniAria'))}</div>
    <ul class="legenda"><li><i class="l-oss-q"></i> ${c.t('ris.ordiniVisti')}: ${c.f.intero(t.osservato)}</li>
      <li><i class="l-med-q"></i> ${c.t('ris.ordiniConsenso')}: ${circa(c, c.f.stimato(t.perso.p50))} (${c.t('comune.tra', { a: c.f.stimato(t.perso.p10), b: c.f.stimato(t.perso.p90) })})</li>
      <li><i class="l-altre-q"></i> ${c.t('ris.ordiniAltre')}: ${circa(c, c.f.stimato(altreCause(o, t.totale).centrale))} (${c.t('comune.tra', { a: c.f.stimato(altreCause(o, t.totale).min), b: c.f.stimato(altreCause(o, t.totale).max) })})</li></ul>
    <p class="nota">${c.t('ris.ordiniNota', { pubblico })} ${fuori(c, 'altrePerdite', c.t('comune.approfondisci'))}</p></div>`;
}

function cambiato(c: Contesto): string {
  const r = c.ris!;
  const p = c.risSenzaOrdini;
  if (!r.ancora?.attivo || !p) return '';
  const coppia = (m: Metrica): string => {
    const a = p.metriche[m];
    const b = r.metriche[m];
    const min = a.osservato * 0.9;
    const max = Math.max(a.totale.p97_5, b.totale.p97_5) * 1.03;
    return `<p class="nota">${c.t('cambiato.prima')}: ${fmtS(c, m, a.totale.p10)} – ${fmtS(c, m, a.totale.p90)}</p>${barraIntervallo(a.osservato, a.totale, min, max, c.t('cambiato.prima'))}
      <p class="nota">${c.t('cambiato.dopo')}: ${fmtS(c, m, b.totale.p10)} – ${fmtS(c, m, b.totale.p90)}</p>${barraIntervallo(b.osservato, b.totale, min, max, c.t('cambiato.dopo'))}`;
  };
  return `<div class="scheda sez"><h2>${c.t('cambiato.titolo')}</h2><div class="prima-dopo">
    <div><h3>${c.t('cambiato.transazioni')}</h3>${coppia('transazioni')}</div>
    <div><h3>${c.t('cambiato.sessioni')}</h3>${coppia('sessioni')}</div></div>
    <p class="nota sopra">${c.t('cambiato.nota')}</p></div>`;
}

function confronto(c: Contesto, ms: Metrica[]): string {
  const r = c.ris!;
  const chiave: Record<Metrica, 'sessioni' | 'utenti' | 'eventi' | 'transazioni' | 'entrate'> = { sessioni: 'sessioni', utentiGiorno: 'utenti', eventi: 'eventi', transazioni: 'transazioni', entrate: 'entrate' };
  const righe = ms
    .map((m) => {
      const s = r.metriche[m];
      const google = c.s.file!.dati.righe.reduce((x, riga) => x + riga[chiave[m]], 0);
      const agg = google - s.osservato;
      const dentro = agg >= s.perso.p2_5 && agg <= s.perso.p97_5;
      return `<tr><th scope="row">${esc(nomeMetrica(c, m))}</th><td>${fmtO(c, m, s.osservato)}</td><td>${fmtO(c, m, google)}</td><td>${fmtO(c, m, agg)}</td><td><span class="nw">${fmtS(c, m, s.perso.p2_5)} –</span> <span class="nw">${fmtS(c, m, s.perso.p97_5)}</span></td><td class="${dentro ? 'dentro' : 'fuori'}">${c.t(dentro ? 'confronto.dentro' : agg < s.perso.p2_5 ? 'confronto.meno' : 'confronto.piu')}</td></tr>`;
    })
    .join('');
  return `<div class="scheda sez"><h2>${c.t('confronto.titolo')}</h2><p class="nota">${c.t('confronto.nota')}</p><div class="scorri"><table>
    <thead><tr><th scope="col">${c.t('confronto.colGrandezza')}</th><th scope="col">${c.t('confronto.colOsservato')}</th><th scope="col">${c.t('confronto.colGoogle')}</th><th scope="col">${c.t('confronto.colAggiunto')}</th><th scope="col">${c.t('confronto.colStrumento')}</th><th scope="col">${c.t('confronto.colEsito')}</th></tr></thead>
    <tbody>${righe}</tbody></table></div><p class="nota sopra">${c.t('confronto.avvertenza')}</p></div>`;
}

function tabella(c: Contesto, m: Metrica, righe: { nome: string; osservato: number; totale: Quantili; quota?: number }[], prima: string): string {
  const conQuota = righe.some((r) => r.quota !== undefined);
  return `<div class="scorri"><table><thead><tr><th scope="col">${prima}</th><th scope="col">${c.t('graf.colOsservato')}</th><th scope="col">${c.t('graf.colStimato')}</th><th scope="col">${c.t('graf.col80')}</th><th scope="col">${c.t('graf.col95')}</th>${conQuota ? `<th scope="col">${c.t('graf.colQuota')}</th>` : ''}</tr></thead><tbody>${righe
    .map(
      (r) =>
        `<tr><th scope="row">${esc(r.nome)}</th><td>${fmtO(c, m, r.osservato)}</td><td>${circa(c, fmtS(c, m, r.totale.p50))}</td><td><span class="nw">${fmtS(c, m, r.totale.p10)} –</span> <span class="nw">${fmtS(c, m, r.totale.p90)}</span></td><td><span class="nw">${fmtS(c, m, r.totale.p2_5)} –</span> <span class="nw">${fmtS(c, m, r.totale.p97_5)}</span></td>${conQuota ? `<td>${c.f.pct(r.quota ?? 0)}</td>` : ''}</tr>`,
    )
    .join('')}</tbody></table></div>`;
}

/** Fonti di incertezza di una grandezza, dalla più pesante (solo quelle sopra lo 0,5%). */
function fontiIncertezza(c: Contesto, m: Metrica): [string, number][] | null {
  const sc = c.ris!.scomposizione;
  if (!sc) return null;
  const q = sc[m];
  const voci: [string, number][] = [['consenso', q.consenso], ['frequenza', q.frequenza], ['conversione', q.conversione], ['scontrino', q.scontrino], ['rumore', q.rumore]];
  return voci;
}

/** Barra «Da dove viene l'incertezza» con la sua legenda, nella scala dedicata (stessi colori dei badge). */
export function barraIncertezza(c: Contesto, m: Metrica): string {
  const voci = fontiIncertezza(c, m);
  if (!voci) return '';
  const nome = (v: [string, number]): string => c.t('solid.voce', { nome: c.t(`solid.${v[0]}`), pct: c.f.pct(v[1]) });
  const visibili = voci.filter((v) => v[1] >= 0.005);
  return `${barraImpilata(voci.map((v) => v[1]), visibili.map(nome).join(', '))}
    <ul class="legenda">${visibili.map((v) => `<li><i class="inc-${passoIncertezza(v[1])}-q"></i> ${nome(v)}</li>`).join('')}</ul>`;
}

export function solidita(c: Contesto, m: Metrica): string {
  const r = c.ris!;
  const nome = esc(nomeMetrica(c, m));
  const tot = r.metriche[m].totale;
  const fmt = (x: number): string => fmtS(c, m, x);
  const maiuscola = (x: string): string => x.charAt(0).toUpperCase() + x.slice(1);
  /** Riquadro «da sapere»: il testo arriva con un titolo in grassetto all'inizio, che diventa il titolo del riquadro. */
  const daSapere = (html: string): string => {
    const t = html.match(/^<strong>(.*?):?<\/strong>\s*(.*)$/s);
    return `<div class="da-sapere"><p class="da-sapere-tit">${t ? t[1].replace(/:$/, '') : c.t('solid.rimedioTitolo')}</p><p>${maiuscola(t ? t[2] : html)}</p></div>`;
  };

  // 1. Quanto fidarsi: margine relativo dell'intervallo «8 volte su 10»
  const lo = tot.p50 > 0 ? (tot.p50 - tot.p10) / tot.p50 : 0;
  const hi = tot.p50 > 0 ? (tot.p90 - tot.p50) / tot.p50 : 0;
  const pctTondo = (x: number): string => `${Math.round(x * 100)}%`;
  const fidarsi = Math.abs(lo - hi) < 0.04
    ? c.t('solid.fidarsiSim', { m: nome, v: pctTondo((lo + hi) / 2), a: fmt(tot.p10), b: fmt(tot.p90) })
    : c.t('solid.fidarsiAsim', { m: nome, lo: pctTondo(lo), hi: pctTondo(hi), a: fmt(tot.p10), b: fmt(tot.p90) });

  // 2. Da cosa dipende: fonti in ordine di peso, badge nella scala dedicata, collegamento alla scheda da rivedere
  let dipende: string;
  let rimedio: string;
  const voci = fontiIncertezza(c, m);
  if (!voci) {
    dipende = `<p class="nota">${c.t('solid.nonDisponibile')}</p>`;
    rimedio = daSapere(c.t('solid.rimedio_ordini'));
  } else {
    const destinazione: Record<string, string> = { consenso: 'tasso', frequenza: 'rFreq', conversione: 'rConv', scontrino: 'rAov' };
    const ordinate = voci.filter((v) => v[1] >= 0.005).sort((x, y) => y[1] - x[1]);
    const riga = ([k, peso]: [string, number]): string => {
      const dest = destinazione[k];
      const btn = dest ? `<button type="button" class="btn piccolo" data-a="vai-ipotesi" data-v="${dest}">${c.t(dest === 'tasso' ? 'solid.rivediTasso' : 'solid.rivedi')}</button>` : '';
      return `<li><div><span class="fonte-tit"><strong>${maiuscola(c.t(`solid.${k}`))}</strong><span class="peso inc-${passoIncertezza(peso)}">${c.t('solid.peso', { pct: c.f.pctArt(peso) })}</span></span><span class="nota">${c.t(`solid.spiega_${k}`)}</span></div>${btn}</li>`;
    };
    dipende = `<h4>${c.t('solid.daDove', { m: nome })}</h4>${barraIncertezza(c, m)}<ol class="fonti">${ordinate.map(riga).join('')}</ol>`;
    rimedio = ordinate[0] ? daSapere(c.t(ordinate[0][0] === 'consenso' ? 'solid.consiglioConsenso' : `solid.rimedio_${ordinate[0][0]}`)) : '';
  }

  // 3. E se un'ipotesi fosse sbagliata: un riquadro per ciascuna delle due ipotesi più influenti
  const nomiIpotesi: Record<string, string> = { consenso: c.t('solid.consenso'), rFreq: c.t('ip.rFreq'), rConv: c.t('ip.rConv'), rAov: c.t('ip.rAov') };
  const centrale = (k: string): string => (k === 'consenso' ? c.f.pct(r.parametri.tassoEffettivo.p50) : c.f.rapporto(ipotesi(c.s, k as 'rFreq' | 'rConv' | 'rAov').mediana));
  const fv = (k: string, v: number): string => (k === 'consenso' ? c.f.pct(v) : c.f.rapporto(v));
  const influenti = r.sensibilita.voci
    .filter((v) => (v.chiave === 'rConv' ? m !== 'sessioni' && m !== 'utentiGiorno' : v.chiave === 'rAov' ? m === 'entrate' : true))
    .map((v) => ({ v, ampiezza: Math.abs(v.alto.totali[m] - v.basso.totali[m]) }))
    .filter((x) => x.ampiezza > 0)
    .sort((x, y) => y.ampiezza - x.ampiezza)
    .slice(0, 2);
  const eSe = influenti
    .map(({ v }) => `<div class="riquadro-chiaro ese"><h4>${maiuscola(nomiIpotesi[v.chiave])}</h4><p class="nota">${c.t('solid.eseUsato', { c: centrale(v.chiave) })}</p>
      <dl><dt class="ese-testa"><span class="nascosto-vis">${c.t('ip.gruppoIpotesi')}</span></dt><dd class="ese-testa">${c.t('solid.eseTotale', { m: nome })}</dd>
        <dt>${c.t('solid.eseSe', { v: fv(v.chiave, v.basso.valore) })}</dt><dd>≈ <strong>${fmt(v.basso.totali[m])}</strong></dd>
        <dt>${c.t('solid.eseSe', { v: fv(v.chiave, v.alto.valore) })}</dt><dd>≈ <strong>${fmt(v.alto.totali[m])}</strong></dd></dl></div>`)
    .join('');

  return `<div class="scheda sez solidita"><h2 class="ic-prima ic-scale">${c.t('solid.titolo')}</h2>
    <div class="riquadri-due fid-dip">
      <div class="colonna-riquadri"><div class="riquadro-chiaro"><h3>${c.t('solid.fidarsi')}</h3><p>${fidarsi}</p></div>${rimedio}</div>
      <div class="riquadro-chiaro"><h3>${c.t('solid.dipende')}</h3>${dipende}</div>
    </div>
    <h3 class="sopra">${c.t('solid.eSe')}</h3>
    ${eSe ? `<div class="riquadri-due">${eSe}</div>` : ''}
    <p class="nota sopra">${c.t('solid.eSeCentrale', { v: fmt(tot.p50) })}</p>
    ${r.ancora?.attivo ? `<p class="nota">${c.t('solid.eSeOrdini')}</p>` : ''}
    <div class="graf" id="g-sens"></div>
    <p class="nota sopra">${c.t('solid.semplice', { v: `${fmt(r.scalaSemplice[m])} (${nome.toLowerCase()})` })}</p></div>`;
}

function tappaTour(c: Contesto): string {
  const n = c.s.tour;
  if (n < 1 || n > 5) return '';
  const azione = n === 4 ? `<button type="button" class="btn piccolo" data-a="tour-ordini">${c.t('tour.t4Azione')}</button>` : n === 5 ? `<button type="button" class="btn piccolo" data-a="scegli-file">${c.t('tour.t5Azione')}</button>` : '';
  return `<section class="tappa" id="tappa-tour" tabindex="-1" aria-label="${c.t('tour.tappa', { n })}">
    <p><strong>${c.t('tour.tappa', { n })} — ${c.t(`tour.t${n}Titolo`)}</strong> ${c.t(`tour.t${n}`)}</p>
    <div class="azioni"><button type="button" class="btn piccolo testo" data-a="tour-esci">${c.t('tour.esci')}</button>${azione}<span class="sp"></span>
    ${n > 1 ? `<button type="button" class="btn piccolo" data-a="tour-indietro">${c.t('tour.indietro')}</button>` : ''}
    <button type="button" class="btn piccolo primo" data-a="${n === 5 ? 'tour-esci' : 'tour-avanti'}">${c.t(n === 5 ? 'tour.fine' : 'tour.avanti')}</button></div></section>`;
}

/** Riepilogo testuale delle ipotesi: visibile solo in stampa (sullo schermo c'è la colonna delle ipotesi). */
function perStampa(c: Contesto): string {
  const i = c.s.file!.info;
  const cal = calibrate(c);
  const u = utentiEffettivi(c.s);
  const utenti = u.valore ? [`${c.t('utenti.csv')}: ${c.t(u.fonte === 'export' ? 'utenti.csvExport' : 'utenti.csvUtente', { v: c.f.intero(u.valore) })}`] : u.fonte === 'no' ? [`${c.t('utenti.csv')}: ${c.t('utenti.csvNo')}`] : [];
  const voci = [riepilogoCM(c), riepilogoTasso(c), ...utenti].concat(
    IPOTESI.map((k) => {
      if (cal.includes(k)) return `${c.t(`ip.${k}`)}: ${c.t('stato.calibrata')}`;
      const st = c.s.statoIpotesi[k];
      return `${fraseIpotesi(c, k)} ${plausibileIpotesi(c, k)} — ${c.t(`stato.${st === 'pred' ? 'predefinita' : st === 'conf' ? 'confermata' : 'modificata'}`)}`;
    }),
  );
  const oggi = new Date();
  const data = `${c.f.dataLunga(oggi.toISOString().slice(0, 10))}, ${oggi.toLocaleTimeString(c.lingua === 'it' ? 'it-IT' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  const radice = typeof document === 'undefined' ? null : document.getElementById('strumento');
  return `<div class="solo-stampa intestazione-stampa"><p class="stampa-sito">${c.t('ris.stampaIntestazione', { sito: radice?.dataset.sito ?? '', indirizzo: radice?.dataset.indirizzo ?? '', data })}</p>
    <p class="nota">${c.t('ris.stampaNota')}</p><p>${c.t('ris.stampaFile', { nome: c.s.file!.nome, dal: c.f.dataLunga(i.dal), al: c.f.dataLunga(i.al) })}</p>
    <h2>${c.t('ris.ipotesiUsate')}</h2><ul>${voci.map((v) => `<li>${inLinea(v)}</li>`).join('')}</ul></div>`;
}

/**
 * In stampa ogni ipotesi sta su una riga: i paragrafi diventano frasi di seguito. Se un paragrafo non finisce
 * con la punteggiatura e il successivo comincia con la maiuscola, si aggiunge il punto («… compreso. Valore usato…»).
 */
function inLinea(html: string): string {
  const parti = html.split(/<\/p>/).map((x) => x.replace(/<p[^>]*>/g, '').trim()).filter(Boolean);
  return parti.reduce((acc, x) => (!acc ? x : /[.!?:;]$/.test(acc) || !/^\p{Lu}/u.test(x) ? `${acc} ${x}` : `${acc}. ${x}`), '');
}

/**
 * Barra di calcolo: invisibile per i calcoli brevi; oltre ~300 ms (avvio.ts) diventa spessa, animata e con
 * «Sto ricalcolando…». Il testo sta in una regione di stato già presente, così viene annunciato una volta sola.
 */
export function barraCalcolo(c: Contesto): string {
  const lungo = Boolean(c.inCalcolo && c.calcoloLungo);
  return `<div class="calcolo" id="calcolo"${lungo ? ' data-lungo' : ''}><progress class="avanzamento" id="barra-calcolo" max="1" value="0" aria-hidden="true"></progress><span class="calcolo-testo" id="calcolo-testo" role="status">${lungo ? c.t('ris.ricalcolo') : ''}</span></div>`;
}

export function sintesi(c: Contesto): string {
  const r = c.ris;
  if (!r) return `<div class="sintesi"><span></span></div>`;
  const s = r.metriche.sessioni;
  return `<div class="sintesi" role="status" aria-live="polite">
    <span><span class="ic ic-equal-approximately stima-t" aria-hidden="true"></span>${c.t('ris.sintesiSessioni', { v: c.f.stimato(s.totale.p50) })}</span>
    <span><span class="ic ic-eye" aria-hidden="true"></span>${c.t('ris.sintesiQuota', { v: c.f.pct(s.totale.p50 > 0 ? s.osservato / s.totale.p50 : 1) })}</span>
    ${c.s.file!.dati.haTransazioni ? `<span><span class="ic ic-equal-approximately stima-t" aria-hidden="true"></span>${c.t('ris.sintesiTransazioni', { v: c.f.stimato(r.metriche.transazioni.totale.p50) })}</span>` : ''}
    <span class="sp"></span><span data-conta>${etichettaPredefinite(c)}</span></div>`;
}

/** Scelta della grandezza per «Per canale», «Giorno per giorno» e «Quanto è solida»: pulsanti affiancati (radio nativi, frecce da tastiera). */
/** Icona del pulsante tabella/grafico: mostra la vista a cui porta. Nascosta ai lettori di schermo. */
const iconaVista = (tabella: boolean): string => `<span class="ic ${tabella ? 'ic-chart-no-axes-column' : 'ic-sheet'}" aria-hidden="true"></span>`;

function staiGuardando(c: Contesto, ms: Metrica[], m: Metrica): string {
  return `<fieldset class="stai-guardando non-stampare"><legend>${c.t('graf.staiGuardando')}</legend><div class="segmenti">${ms
    .map((x) => `<label class="segmento" for="m-${x}"><input type="radio" name="metrica" id="m-${x}" data-c="metrica" value="${x}"${x === m ? ' checked' : ''}><span>${esc(nomeMetrica(c, x))}</span></label>`)
    .join('')}</div></fieldset>`;
}

/**
 * Ordini reali e risposte non tornano: non è un errore ma un'informazione sul sito («da controllare», ambra).
 * Confronta gli ordini mancanti davvero con quelli previsti dalle risposte e dice cosa può spiegare la differenza.
 * Valori e soglia sono quelli del motore (esito.ts, worker.ts): qui non si ricalcola niente di nuovo.
 */
/** Una risposta sul tipo di pubblico nel blocco «Cosa può spiegarlo»: compatibile o no, e il pulsante solo se lo è. */
function vocePubblico(c: Contesto, x: Pubblico, ok: boolean): string {
  const segno = `<span aria-hidden="true">${ok ? '✓' : '✗'} </span>`;
  const esito = `<span class="conti-esito ${ok ? 'ok' : 'no'}">${segno}${c.t(ok ? 'conti.compatibile' : 'conti.nonAncora')}</span>`;
  const azione = ok ? `<span class="conti-sceglila">${c.t('conti.sceglila')}</span><button type="button" class="btn piccolo testo non-stampare" data-a="scegli-pubblico" data-v="${x}">${c.t('conti.scegli')}</button>` : '';
  const quota = c.t('ordini.circaPct', { v: c.f.pct(ALTRE_PERDITE_PUBBLICO[x].mediana) });
  return `<li><span class="conti-nome">${c.t(`ordini.${x}`)} <span class="nota nw">(${quota})</span></span>${esito}${azione}</li>`;
}

export function contiDaControllare(c: Contesto): string {
  const k = c.conflitto;
  const s = c.s;
  const g = altrePerdite(s);
  if (!k || !c.ris || !g) return '';
  const o = numero(s.ordini) ?? 0;
  const tGa = o - k.mancanti;
  const finestra = ordiniSuTuttoIlFile(s) ? null : { dal: s.ordiniDal || s.file!.info.dal, al: s.ordiniAl || s.file!.info.al };
  const p = previstiDalleRisposte(c.ris, o, g, finestra);
  const n = { reali: c.f.intero(k.mancanti), o: c.f.intero(o), t: c.f.intero(tGa), prev: c.f.intero(Math.round(p.totale)), cons: c.f.intero(Math.round(p.consenso)), altre: c.f.intero(Math.round(p.altre)) };
  const scala = 1000 / Math.max(k.mancanti, p.totale, 1);
  const wC = p.consenso * scala;
  const wA = p.altre * scala;
  const barra = (dentro: string): string => `<svg class="conti-barra" viewBox="0 0 1000 22" preserveAspectRatio="none" focusable="false">${dentro}</svg>`;
  const figura = `<div class="conti" role="img" aria-label="${esc(c.t('conti.aria', { n: n.reali, o: n.o, t: n.t, p: n.prev, c: n.cons, a: n.altre }))}">
      <div class="conti-riga" aria-hidden="true"><p class="conti-et">${c.t('conti.reali', { n: n.reali })} <span class="conti-da">${c.t('conti.realiDa', { o: n.o, t: n.t })}</span></p>
        ${barra(`<rect class="conti-reale" x="0" y="0" width="${(k.mancanti * scala).toFixed(1)}" height="22"/>`)}</div>
      <div class="conti-riga" aria-hidden="true"><p class="conti-et">${c.t('conti.previsti', { n: n.prev })}</p>
        ${barra(`<rect class="conti-consenso" x="0" y="1" width="${Math.max(0, wC - 3).toFixed(1)}" height="20"/><rect class="conti-altre" x="${(wC + 3).toFixed(1)}" y="1" width="${Math.max(0, wA - 3).toFixed(1)}" height="20"/>`)}
        <ul class="legenda conti-parti"><li><i class="seg-perso"></i>${c.t('conti.perConsenso', { n: n.cons })}</li><li><i class="seg-altre"></i>${c.t('conti.perAltre', { n: n.altre })}</li></ul></div>
    </div>
    <p class="nota">${c.t('conti.altreSpiega')}</p>`;
  const ordine: Pubblico[] = ['consumo', 'tecnico', 'misto', 'server'];
  const voci = k.compatibili ? ordine.filter((x) => x !== s.pubblico && x in k.compatibili!) : [];
  const nessuna = voci.length > 0 && voci.every((x) => !k.compatibili![x]);
  const pubblico = voci.length
    ? `<p>${c.t('conti.pubblico')}</p><ul class="conti-pubblico">${voci.map((x) => vocePubblico(c, x, k.compatibili![x])).join('')}</ul>${nessuna ? `<p><strong>${c.t('conti.nessuna')}</strong></p>` : ''}`
    : '';
  const pochi = k.direzione === 'pochi';
  const punti = [c.t('conti.periodo'), c.t('conti.perimetro'), c.t(pochi ? 'conti.tassoPochi' : 'conti.tassoTroppi'), ...(pochi ? [c.t('conti.doppie')] : [])];
  const [mLo, mHi] = margine(ipotesi(s, 'rConv'));
  const v = c.f.rapporto(k.rConvNecessario);
  return `<section class="fascia ambra conti-blocco" role="status" aria-labelledby="conti-titolo">
      <h2 class="conti-titolo" id="conti-titolo">${c.t(pochi ? 'conti.titoloPochi' : 'conti.titoloTroppi')}</h2>
      <p>${c.t('conti.intro')}</p>
      ${figura}
      <h3>${c.t('conti.spiega')}</h3>
      ${pubblico}
      <p>${c.t('conti.altriPunti')}</p><ul class="conti-punti">${punti.map((x) => `<li>${x}</li>`).join('')}</ul>
      <p class="conti-stato">${c.t('conti.stato')}</p>
      <details class="conti-dettagli"><summary>${c.t('conti.dettagli')}</summary><p>${c.t('conti.tecnico', { v, a: c.f.rapporto(mLo), b: c.f.rapporto(mHi) })} ${fuori(c, 'ordiniReali', c.t('comune.approfondisci'))}</p></details>
    </section>`;
}

export function rendiRisultati(c: Contesto): string {
  const s = c.s;
  const r = c.ris;
  const e = esitoCM(s);
  if (c.erroreCalcolo) return `${sintesi(c)}<div class="fascia rosso" role="alert"><p><strong>${c.t('ris.erroreCalcolo')}</strong> ${c.t(`ris.errore_${c.erroreCalcolo}`)}</p></div>`;
  if (!completo(s)) return `${sintesi(c)}<div class="fascia ambra" role="status"><p>${c.t('ris.incompleto')}</p></div>`;
  if (!r) return `${sintesi(c)}${barraCalcolo(c)}`;
  const d = e === 'blocco' && s.file2 ? s.file2.dati : s.file!.dati;
  const ms = metricheDisponibili(d);
  const m = ms.includes(s.metrica) ? s.metrica : 'sessioni';
  const nome = esc(nomeMetrica(c, m));
  const o = numero(s.ordini) ?? 0;
  const conflitto = contiDaControllare(c);
  return `${sintesi(c)}
    ${barraCalcolo(c)}
    ${perStampa(c)}
    ${tappaTour(c)}
    ${s.origine === 'esempio' && !s.tour ? `<div class="fascia blu"><p>${c.t('ris.esempio')}</p></div>` : ''}
    ${s.origine === 'link' ? `<div class="fascia blu"><p>${c.t('ris.daLink')}</p></div>` : ''}
    ${s.canaliIgnorati ? `<div class="fascia ambra"><p>${c.t('ris.canaliIgnorati')}</p></div>` : ''}
    ${e === 'incerto' ? `<div class="fascia ambra" role="status"><p>${c.t('ris.cautela')} ${fuori(c, 'verificaConsentMode', c.t('cm.comeControllare'))}</p></div>` : ''}
    ${e === 'blocco' ? `<div class="fascia ambra" role="status"><p>${c.t('ris.soloConfronto')}</p></div>` : ''}
    ${conflitto}
    ${eroe(c)}
    ${e === 'blocco' ? confronto(c, ms) : ''}
    ${treParti(c)}
    ${schede(c)}
    ${!ordiniCompleti(c) && r.ancora?.attivo ? `<p class="nota">${c.t('ris.ordiniParziali', { dal: c.f.dataLunga(s.ordiniDal || s.file!.info.dal), al: c.f.dataLunga(s.ordiniAl || s.file!.info.al), n: c.f.intero(o) })}</p>` : ''}
    ${cambiato(c)}
    ${ms.length > 1 ? staiGuardando(c, ms, m) : ''}
    <div class="scheda sez blocco-grafico"><div class="sez-tit"><h2 class="ic-prima ic-chart-no-axes-column">${c.t('graf.canali')} · ${nome}</h2>
        <button type="button" class="btn piccolo" data-a="tabella" data-v="canali" aria-pressed="${s.tabelle.canali}">${iconaVista(s.tabelle.canali)}${c.t(s.tabelle.canali ? 'graf.comeGrafico' : 'graf.comeTabella')}</button></div>
      ${s.tabelle.canali ? tabella(c, m, r.canali.map((x) => ({ nome: x.canale, osservato: x.metriche[m].osservato, totale: x.metriche[m].totale, quota: x.metriche[m].quotaPersa.p50 })), c.t('graf.colCanale')) : `${legenda(c)}<div class="graf" id="g-canali"></div>`}
      <div class="fascia ambra sopra"><p>${c.t('graf.canaliAvviso')} ${fuori(c, 'canali', c.t('cm.perche'))}</p></div></div>
    <div class="scheda sez blocco-grafico"><div class="sez-tit"><h2 class="ic-prima ic-calendar-days">${c.t('graf.giorni')} · ${nome}</h2>
        <button type="button" class="btn piccolo" data-a="tabella" data-v="giorni" aria-pressed="${s.tabelle.giorni}">${iconaVista(s.tabelle.giorni)}${c.t(s.tabelle.giorni ? 'graf.comeGrafico' : 'graf.comeTabella')}</button></div>
      ${s.tabelle.giorni ? tabella(c, m, r.giorni.map((g) => ({ nome: c.f.dataLunga(g.data), osservato: g.metriche[m].osservato, totale: g.metriche[m].totale })), c.t('graf.colGiorno')) : `${legenda(c)}<div class="graf" id="g-giorni"></div>`}</div>
    ${solidita(c, m)}
    <div class="scheda sez non-stampare"><h2>${c.t('esporta.titolo')}</h2>
      <div class="azioni"><button type="button" class="btn primo ic-prima ic-sheet" data-a="csv">${c.t('esporta.csv')}</button><button type="button" class="btn ic-prima ic-printer" data-a="stampa">${c.t('esporta.stampa')}</button><button type="button" class="btn ic-prima ic-link" data-a="copia-link">${c.t('esporta.link')}</button></div>
      <div id="link-uscita" role="status" aria-live="polite">${statoLink(c, 'ris')}</div>
      <p class="nota sopra">${c.t('esporta.nota')}</p></div>
    <p class="nota sez">${c.t('ris.limiti')}<span class="non-stampare"> · ${fuori(c, 'limiti', c.t('ris.tuttiLimiti'))}</span></p>`;
}

/** Disegna i grafici che hanno bisogno della larghezza reale del contenitore. */
export function disegnaGrafici(c: Contesto, radice: HTMLElement): void {
  const r = c.ris;
  if (!r) return;
  const e = esitoCM(c.s);
  const d = e === 'blocco' && c.s.file2 ? c.s.file2.dati : c.s.file!.dati;
  const ms = metricheDisponibili(d);
  const m = ms.includes(c.s.metrica) ? c.s.metrica : 'sessioni';
  const nome = nomeMetrica(c, m);
  const gc = radice.querySelector<HTMLElement>('#g-canali');
  if (gc) gc.innerHTML = graficoCanali(gc.clientWidth, r.canali, m, (x) => fmtS(c, m, x), c.t('graf.canaliAria', { m: nome }));
  const gg = radice.querySelector<HTMLElement>('#g-giorni');
  if (gg) {
    graficoGiorni(gg, r.giorni, m, (x) => fmtS(c, m, x), (x) => fmtO(c, m, x), { breve: c.f.dataBreve, lunga: c.f.dataLunga }, {
      aria: c.t('graf.giorniAria', { m: nome }),
      osservato: (v) => c.t('graf.tipOsservato', { v }),
      stimato: (v) => c.t('graf.tipStimato', { v }),
      otto: c.t('graf.otto'),
      diciannove: c.t('graf.diciannove'),
    });
  }
  const gs = radice.querySelector<HTMLElement>('#g-sens');
  if (gs) gs.innerHTML = graficoSolidita(c, m, gs.clientWidth);
}


/** Grafico «E se un'ipotesi fosse sbagliata?» per la grandezza m, largo `largo` pixel. */
export function graficoSolidita(c: Contesto, m: Metrica, largo: number): string {
  const r = c.ris!;
  const nome = nomeMetrica(c, m);
  const fv = (k: string, v: number): string => (k === 'consenso' ? c.f.pct(v) : c.f.rapporto(v));
  const nomi: Record<string, string> = { consenso: 'solid.consenso', rFreq: 'solid.frequenza', rConv: 'solid.conversione', rAov: 'solid.scontrino' };
  const righe = r.sensibilita.voci
    .filter((v) => (v.chiave === 'rConv' ? m !== 'sessioni' && m !== 'utentiGiorno' : v.chiave === 'rAov' ? m === 'entrate' : true))
    .map((v) => ({ nome: c.t(nomi[v.chiave]), da: c.t('solid.da', { a: fv(v.chiave, v.basso.valore), b: fv(v.chiave, v.alto.valore) }), basso: v.basso.totali[m], alto: v.alto.totali[m] }));
  return graficoSensibilita(largo, righe, r.sensibilita.centrale[m], (x) => fmtS(c, m, x), {
    nonCambia: c.t('solid.nonCambia'),
    stima: c.t('solid.stima', { v: fmtS(c, m, r.sensibilita.centrale[m]) }),
    stimaNota: c.t('solid.stimaNota'),
    aria: c.t('solid.aria', { m: nome }),
  });
}
