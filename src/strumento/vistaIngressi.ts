// Viste di ingresso: i tre passi dell'avvio e la colonna «risposte e ipotesi» del banco di lavoro.
// Tutti i testi vengono dai file di lingua tramite ctx.t.
import type { Avviso, Risultato } from '../motore/modello';
import type { Conflitto } from './esito';
import { esc, plurale, type Lingua, type Traduci } from '../i18n/indice';
import type { Formati } from '../i18n/formato';
import { collegamento, type Ancora } from '../i18n/ancore';
import type { ErroreCsv } from '../parser';
import { ALTRE_PERDITE_PUBBLICO, margine95, type Pubblico } from './pubblico';
import { scartiDaiTotali } from './totali';
import {
  IPOTESI,
  LIMITI_CURSORE,
  espertiAttive,
  esitoCM,
  ipotesi,
  mancantiTasso,
  margine,
  nPredefinite,
  numero,
  forseFrazione,
  percento,
  ordiniSuTuttoIlFile,
  passoCorrente,
  predefinito,
  completo,
  conteggiValidi,
  tassoDaDevice,
  type ChiaveIpotesi,
  type Stato,
  utentiEffettivi,
} from './stato';

export interface Contesto {
  s: Stato;
  t: Traduci;
  f: Formati;
  lingua: Lingua;
  ris: Risultato | null;
  /** Stima senza ordini reali, calcolata insieme a quella con gli ordini per mostrare cosa cambia */
  risSenzaOrdini: Risultato | null;
  /** Valorizzato quando ordini reali e ipotesi non stanno insieme: in quel caso `ris` è la stima senza ordini */
  conflitto: Conflitto | null;
  avvisiOrdini: Avviso[];
  inCalcolo: boolean;
  /** Il calcolo in corso dura da più di ~300 ms: barra ben visibile, testo, numeri attenuati */
  calcoloLungo?: boolean;
  erroreCalcolo: string;
  aiutiAperti: Set<string>;
  esempio: { ordini: number; entrate: number } | null;
  linkGenerato: string;
  linkCopiato: boolean;
}

// ---------------------------------------------------------------- mattoni
export function fuori(c: Contesto, ancora: Ancora, testo: string): string {
  return `<a href="${collegamento(c.lingua, ancora)}" target="_blank" rel="noopener">${testo} ↗<span class="nascosto-vis"> (${c.t('comune.nuovaScheda')})</span></a>`;
}
/** Spiegazione aperta dal pulsante «?»: collegamento al Metodo o alla Guida e, se c'è, ai consigli d'uso nella Guida. */
function aiuto(c: Contesto, id: string, testo: string, ancora?: Ancora, consigli?: Ancora): { bottone: string; pannello: string } {
  const aperto = c.aiutiAperti.has(id);
  return {
    bottone: `<button type="button" class="aiuto-btn" data-a="aiuto" data-v="${id}" aria-expanded="${aperto}" aria-controls="aiuto-${id}" aria-label="${c.t('comune.spiegazione')}">?</button>`,
    pannello: `<p class="nota spiega" id="aiuto-${id}"${aperto ? '' : ' hidden'}>${testo}${ancora ? ' ' + fuori(c, ancora, c.t('comune.approfondisci')) : ''}${consigli ? ' · ' + fuori(c, consigli, c.t('comune.comeUsarla')) : ''}</p>`,
  };
}
function scelta(c: Contesto, campo: keyof Stato, valore: string, titolo: string, nota = ''): string {
  const id = `c-${campo}-${valore}`;
  return `<label class="scelta" for="${id}"><input type="radio" id="${id}" name="${campo}" value="${valore}" data-c="${campo}"${c.s[campo] === valore ? ' checked' : ''}><span>${titolo}${nota ? `<br><span class="nota">${nota}</span>` : ''}</span></label>`;
}
function campo(c: Contesto, percorso: string, etichetta: string, valore: string, opz: { tipo?: string; min?: string; max?: string; passo?: string; nota?: string; modo?: string; facoltativo?: boolean } = {}): string {
  const id = `c-${percorso}`;
  return `<div class="campo"><label class="et-campo" for="${id}">${etichetta}${opz.facoltativo ? ` <span class="facolt">${c.t('comune.facoltativo')}</span>` : ''}</label>
    <input id="${id}" data-c="${percorso}" type="${opz.tipo ?? 'text'}" inputmode="${opz.modo ?? 'decimal'}" value="${esc(valore)}"${opz.min ? ` min="${opz.min}"` : ''}${opz.max ? ` max="${opz.max}"` : ''}${opz.nota ? ` aria-describedby="${id}-n"` : ''} autocomplete="off">
    ${opz.nota ? `<p class="nota" id="${id}-n">${opz.nota}</p>` : ''}</div>`;
}
const etichetta = (classe: string, testo: string): string => `<span class="et ${classe}">${testo}</span>`;

function sommaFile(c: Contesto): { sessioni: number; eventi: number; transazioni: number; entrate: number } {
  const out = { sessioni: 0, eventi: 0, transazioni: 0, entrate: 0 };
  for (const r of c.s.file?.dati.righe ?? []) {
    out.sessioni += r.sessioni;
    out.eventi += r.eventi;
    out.transazioni += r.transazioni;
    out.entrate += r.entrate;
  }
  return out;
}
/** Simbolo di valuta: in italiano prima dell'importo con uno spazio non separabile («€ 95.800»), in inglese attaccato («€95,800»). */
export const conValuta = (c: Contesto, testo: string): string => (c.s.valuta ? `${c.s.valuta}${c.lingua === 'it' ? '\u00a0' : ''}${testo}` : testo);

export function statoLink(c: Contesto, dove: string): string {
  if (!c.linkGenerato) return '';
  return c.linkCopiato
    ? `<p class="nota sopra">${c.t('esporta.linkCopiato')}</p>`
    : `<label class="et-campo sopra" for="link-${dove}">${c.t('esporta.linkManuale')}</label><input id="link-${dove}" type="text" readonly value="${esc(c.linkGenerato)}">`;
}

// ---------------------------------------------------------------- file
function erroriFile(c: Contesto): string {
  const e = c.s.erroreFile;
  if (!e) return '';
  const voce = (x: ErroreCsv): string => {
    const p = { ...x.parametri } as Record<string, string | number>;
    let rimedio = `erroreFile.${x.codice === 'numero_negativo' ? 'numero_non_valido' : x.codice}_r`;
    if (x.codice === 'colonna_mancante') {
      rimedio = p.campo === 'sessioni' ? 'erroreFile.colonna_mancante_r_metrica' : 'erroreFile.colonna_mancante_r_dimensione';
      p.campo = c.t(`campo.${p.campo}`);
    }
    return `<li>${c.t(`erroreFile.${x.codice}`, p)}<span class="rimedio"><strong>${c.t('erroreFile.comeCorreggere')}</strong> ${c.t(rimedio, p)}</span></li>`;
  };
  return `<div class="fascia rosso" role="alert" tabindex="-1" id="errore-file">
    <p><strong>${c.t('erroreFile.titolo', { nome: e.nome })}</strong></p>
    <ul>${e.errori.map(voce).join('')}</ul>
    <div class="azioni">${fuori(c, 'creaEsplorazione', c.t('file.comeCrearlo'))}${fuori(c, 'erroriFile', c.t('erroreFile.erroriGuida'))}</div>
  </div>`;
}

function passoFileVuoto(c: Contesto): string {
  const a = aiuto(c, 'quale-file', c.t('file.qualeFileTesto'), 'creaEsplorazione');
  return `<section class="scheda" aria-labelledby="p1">
    <div class="passo-titolo"><span class="num" aria-hidden="true">1</span><h2 id="p1">${c.t('file.titolo')}</h2>${a.bottone}</div>
    ${a.pannello}
    <div class="rilascio" id="zona-file">
      <button type="button" class="btn primo" data-a="scegli-file">${c.t('file.scegli')}</button>
      <span class="nota">${c.t('file.trascina')}</span>
    </div>
    ${erroriFile(c)}
    <p class="nota sopra">${c.t('file.senzaFile')}</p>
    <div class="azioni">
      <button type="button" class="btn" data-a="esempio">${c.t('file.esempio')}</button>
      <button type="button" class="btn testo" data-a="scarica-esempio">${c.t('file.scaricaEsempio')}</button>
    </div>
    <p class="nota sopra ic-prima ic-lock">${c.t('file.privacy')} ${fuori(c, 'verificaPrivacy', c.t('file.comeVerificare'))}</p>
  </section>`;
}

function avvisiFile(c: Contesto): string {
  const av = c.s.file?.avvisi ?? [];
  // Controllo di coerenza con la riga dei totali: si avvisa (in ambra, «da controllare») solo oltre la soglia.
  const scarti = c.s.file ? scartiDaiTotali(c.s.file.dati, c.s.file.info.totali) : [];
  const fmt = (g: string, x: number): string => (g === 'entrate' ? conValuta(c, c.f.decimale(x)) : c.f.intero(x));
  const coerenza = scarti.length
    ? `<div class="fascia ambra" role="status"><p>${c.t('avvisoFile.totaliDiversi', { elenco: scarti.map((x) => c.t('avvisoFile.totaliVoce', { m: c.t(`metrica.${x.grandezza}`), a: fmt(x.grandezza, x.righe), b: fmt(x.grandezza, x.totale) })).join('; ') })}</p></div>`
    : '';
  if (!av.length) return coerenza;
  const voce = (a: (typeof av)[number]): string => {
    const p = { ...a.parametri };
    if (a.codice === 'colonne_mancanti') p.campi = String(p.campi).split(',').map((x) => c.t(`campo.${x}`)).join(', ');
    return `<li>${c.t(`avvisoFile.${a.codice}`, p)}</li>`;
  };
  return `${coerenza}<details class="note-file"><summary>${plurale(c.t, 'file.avvisi', av.length)}</summary><ul>${av.map(voce).join('')}</ul></details>`;
}

function rigaFile(c: Contesto): string {
  const i = c.s.file!.info;
  let r = c.t('file.riepilogo', { dal: c.f.dataLunga(i.dal), al: c.f.dataLunga(i.al), righe: c.f.intero(i.righeLette), canali: i.canali.length });
  if (i.righeTotaleScartate) r += ' · ' + plurale(c.t, 'file.totaleIgnorato', i.righeTotaleScartate);
  return r;
}

function opzioniFile(c: Contesto): string {
  const i = c.s.file!.info;
  const d = c.s.file!.dati;
  let out = '';
  if (i.colonneEventi.length >= 2) {
    out += `<div class="campo"><label class="et-campo" for="c-colonnaEventi">${c.t('file.colonnaEventi')}</label><select id="c-colonnaEventi" data-c="colonnaEventi">${i.colonneEventi
      .map((x) => `<option${x === (c.s.colonnaEventi || i.colonne.eventi) ? ' selected' : ''}>${esc(x)}</option>`)
      .join('')}</select></div>`;
  }
  if (d.haEntrate) {
    out += `<div class="campo"><label class="et-campo" for="c-valuta">${c.t('file.valuta')}</label><select id="c-valuta" data-c="valuta">${['€', '$', '£', '']
      .map((v) => `<option value="${v}"${v === c.s.valuta ? ' selected' : ''}>${v || c.t('file.valutaNessuna')}</option>`)
      .join('')}</select></div>`;
  }
  return out;
}

function totaliFile(c: Contesto, blocco: boolean): string {
  const d = c.s.file!.dati;
  const tot = sommaFile(c);
  const cella = (v: string, nome: string): string => `<div><b>${v}</b><span>${nome}</span></div>`;
  return `<h3>${blocco ? `${c.t('file.totaliExport')} <span class="nota">(${c.t('file.totaliExportNota')})</span>` : c.t('file.cosaVede')}</h3>
    <div class="totali">
      ${cella(c.f.intero(tot.sessioni), c.t('metrica.sessioni').toLowerCase())}
      ${d.haEventi ? cella(c.f.intero(tot.eventi), c.t('metrica.eventi').toLowerCase()) : ''}
      ${d.haTransazioni ? cella(c.f.intero(tot.transazioni), c.t('metrica.transazioni').toLowerCase()) : ''}
      ${d.haEntrate ? cella(conValuta(c, c.f.intero(tot.entrate)), c.t('metrica.entrate').toLowerCase()) : ''}
      ${blocco ? '' : `<div class="manca"><b>?</b><span>${c.t('file.quanteMancano')}</span></div>`}
    </div>`;
}

function passoFileFatto(c: Contesto): string {
  const blocco = esitoCM(c.s) === 'blocco';
  return `<section class="scheda" aria-labelledby="p1">
    <div class="passo-titolo"><span class="num fatto" aria-hidden="true">✓</span><h2 id="p1">${esc(c.s.file!.nome)}</h2><button type="button" class="btn piccolo" data-a="scegli-file">${c.t('comune.cambia')}</button></div>
    <p class="nota">${rigaFile(c)}</p>
    ${avvisiFile(c)}
    ${opzioniFile(c)}
    ${totaliFile(c, blocco)}
  </section>`;
}

// ---------------------------------------------------------------- Consent Mode
export function campiCM(c: Contesto): string {
  const s = c.s;
  const a1 = aiuto(c, 'cm1', c.t('cm.d1Aiuto'), 'verificaConsentMode');
  let out = `<fieldset><legend>${c.t('cm.d1')} ${a1.bottone}</legend>${a1.pannello}<div class="scelte">
    ${scelta(c, 'cm', 'basic', c.t('cm.basic'), c.t('cm.basicNota'))}
    ${scelta(c, 'cm', 'advanced', c.t('cm.advanced'), c.t('cm.advancedNota'))}
    ${scelta(c, 'cm', 'nonso', `<strong>${c.t('comune.nonLoSo')}</strong>`, c.t('cm.nonsoNota'))}
  </div></fieldset>`;
  if (s.cm === 'advanced') {
    const a2 = aiuto(c, 'cm2', c.t('cm.d2Aiuto'), 'identitaReport');
    out += `<fieldset><legend>${c.t('cm.d2')} ${a2.bottone}</legend>${a2.pannello}<div class="scelte">
      ${scelta(c, 'identita', 'combinata', c.t('cm.combinata'))}
      ${scelta(c, 'identita', 'osservata', c.t('cm.osservata'))}
      ${scelta(c, 'identita', 'nonso', `<strong>${c.t('comune.nonLoSo')}</strong>`)}
    </div></fieldset>`;
    if (s.identita === 'combinata') {
      const a3 = aiuto(c, 'cm3', c.t('cm.d3Aiuto'), 'iconaQualita');
      out += `<fieldset><legend>${c.t('cm.d3')} ${a3.bottone}</legend>${a3.pannello}<div class="scelte">
        ${scelta(c, 'icona', 'inclusi', c.t('cm.inclusi'))}
        ${scelta(c, 'icona', 'no', c.t('cm.nonInclusi'))}
        ${scelta(c, 'icona', 'nonso', `<strong>${c.t('cm.nonTrovo')}</strong>`)}
      </div></fieldset>`;
    }
  }
  const e = esitoCM(s);
  if (e === 'stima') out += `<div class="fascia verde" role="status"><p>${c.t('cm.esitoStima')}</p></div>`;
  else if (e === 'incerto') out += `<div class="fascia ambra" role="status"><p>${c.t('cm.esitoIncerto')}</p></div>`;
  else if (e === 'blocco') {
    out += `<div class="fascia rosso" role="status"><p><strong>${c.t('cm.esitoBloccoTitolo')}</strong></p><p>${c.t('cm.esitoBlocco')}</p><p class="nota">${c.t('cm.esitoBloccoNota')} ${fuori(c, 'consentMode', c.t('cm.perche'))}</p></div>
      <div class="scheda interna"><h3>${c.t('cm.confrontoTitolo')}</h3><p class="nota">${c.t('cm.confrontoTesto')}</p>
      <div class="azioni"><button type="button" class="btn" data-a="scegli-file2">${c.t('cm.confrontoCarica')}</button>${fuori(c, 'confrontoGoogle', c.t('cm.confrontoGuida'))}</div>
      ${s.file && s.erroreFile ? erroriFile(c) : ''}
      ${s.file2 ? `<p class="nota sopra" role="status">${c.t('cm.confrontoLetto', { nome: s.file2.nome, righe: c.f.intero(s.file2.righe), sessioni: c.f.intero(s.file2.dati.righe.reduce((x, r) => x + r.sessioni, 0)) })}</p>` : ''}</div>`;
  }
  return out;
}

export function riepilogoCM(c: Contesto): string {
  const s = c.s;
  const e = esitoCM(s);
  if (e === 'blocco') return c.t('cm.riepBlocco');
  if (e === 'incerto' || e === 'daRispondere') return c.t('cm.riepIncerto');
  if (s.cm === 'basic') return c.t('cm.riepBasic');
  return c.t(s.identita === 'osservata' ? 'cm.riepAdvancedOsservata' : 'cm.riepAdvancedNo');
}

// ---------------------------------------------------------------- tasso
type SchedaEsperti = 'conteggi' | 'device' | 'periodi';
/** Vero se la scheda per esperti ha già qualcosa di inserito (allora resta aperta anche senza «Usa»). */
function espertiCompilata(s: Stato, k: SchedaEsperti): boolean {
  if (k === 'conteggi') return s.usaConteggi;
  if (k === 'device') return Object.values(s.device).some((d) => d.tasso || d.quota);
  return s.periodi.some((p) => p.dal || p.tasso);
}
export const espertiAperta = (s: Stato, k: SchedaEsperti): boolean => s.espertiInUso.includes(k) || espertiCompilata(s, k);

/** Pannello per esperti: tre schede con quando servono, cosa migliorano, stato e Usa / Togli. */
function campiEsperti(c: Contesto): string {
  const s = c.s;
  const riga = (d: 'mobile' | 'desktop' | 'tablet'): string =>
    `<tr><th scope="row">${c.t(`esperti.${d}`)}</th>
      <td><input data-c="device.${d}.tasso" id="c-device.${d}.tasso" type="text" inputmode="decimal" value="${esc(s.device[d].tasso)}" aria-label="${c.t(`esperti.${d}`)}: ${c.t('esperti.tassoPct')}"></td>
      <td><input data-c="device.${d}.quota" id="c-device.${d}.quota" type="text" inputmode="decimal" value="${esc(s.device[d].quota)}" aria-label="${c.t(`esperti.${d}`)}: ${c.t('esperti.quotaPct')}"></td></tr>`;
  const moduli: Record<SchedaEsperti, string> = {
    conteggi: `<div class="due">${campo(c, 'accettati', c.t('esperti.accettati'), s.accettati, { modo: 'numeric' })}${campo(c, 'nonAccettati', c.t('esperti.nonAccettatiBreve'), s.nonAccettati, { modo: 'numeric', nota: c.t('esperti.nonAccettatiNota') })}</div>`,
    device: `<p class="nota">${c.t('esperti.deviceNota')} ${fuori(c, 'dispositivi', c.t('comune.comeUsarla'))}</p>
      <table class="tabella-input"><thead><tr><th scope="col">${c.t('esperti.dispositivo')}</th><th scope="col">${c.t('esperti.tassoPct')}</th><th scope="col">${c.t('esperti.quotaPct')}</th></tr></thead>
      <tbody>${riga('mobile')}${riga('desktop')}${riga('tablet')}</tbody></table>`,
    periodi: `<p class="nota">${c.t('esperti.periodiNota')} ${fuori(c, 'cambioBanner', c.t('comune.comeUsarla'))}</p>
      ${s.periodi.map((p, i) => `<div class="due">${campo(c, `periodi.${i}.dal`, c.t('esperti.dalGiorno'), p.dal, { tipo: 'date', min: s.file?.info.dal, max: s.file?.info.al, modo: 'none' })}${campo(c, `periodi.${i}.tasso`, c.t('esperti.nuovoTasso'), p.tasso)}</div>`).join('')}`,
  };
  const attiva: Record<SchedaEsperti, boolean> = { conteggi: conteggiValidi(s), device: tassoDaDevice(s), periodi: s.periodi.some((p) => p.dal && percento(p.tasso) !== undefined) };
  const titoli: Record<SchedaEsperti, string> = { conteggi: 'conteggiTitolo', device: 'deviceTitolo', periodi: 'periodiTitolo' };
  const scheda = (k: SchedaEsperti): string => {
    const aperta = espertiAperta(s, k);
    const stato = attiva[k] ? etichetta('mod', c.t('esperti.attiva')) : `<span class="et neutro">${c.t('esperti.nonUsata')}</span>`;
    const bottone = `<button type="button" class="btn piccolo" id="esperti-btn-${k}" data-a="${aperta ? 'esperti-togli' : 'esperti-usa'}" data-v="${k}" aria-describedby="esperti-tit-${k}">${c.t(aperta ? 'comune.togli' : 'esperti.usa')}</button>`;
    return `<div class="scheda-esperti${aperta ? ' aperta' : ''}${attiva[k] ? ' attiva' : ''}" id="esperti-${k}">
      <div class="riga-tit"><h4 id="esperti-tit-${k}">${c.t(`esperti.${titoli[k]}`)}</h4>${stato}</div>
      <dl class="esperti-info"><dt>${c.t('esperti.quandoServe')}</dt><dd>${c.t(`esperti.${k}Quando`)}</dd><dt>${c.t('esperti.cosaMigliora')}</dt><dd>${c.t(`esperti.${k}Migliora`)}</dd></dl>
      ${aperta ? `<div class="modulo-esperti">${moduli[k]}</div>` : ''}<div class="azioni">${bottone}</div></div>`;
  };
  return `<div class="blocco-esperti">${scheda('conteggi')}${scheda('device')}${scheda('periodi')}</div>`;
}

/**
 * Accesso alle impostazioni per esperti: una scheda riconoscibile, facoltativa ma visibile.
 * Il pulsante cambia testo (Apri / Chiudi) e tiene lo stesso id, così il fuoco resta lì dopo la resa.
 */
export function schedaAccessoEsperti(c: Contesto, dove: 'passo' | 'colonna'): string {
  const s = c.s;
  const nEsp = espertiAttive(s);
  const id = `esperti-interr-${dove}`;
  const bottone = `<button type="button" class="btn piccolo" id="${id}" data-a="${s.esperti ? 'chiudi-esperti' : 'apri-esperti'}" aria-expanded="${s.esperti}">${c.t(s.esperti ? 'esperti.chiudi' : 'esperti.apri')}</button>`;
  const stato = s.esperti ? etichetta('mod', c.t('esperti.aperte')) : nEsp ? etichetta('mod', plurale(c.t, 'esperti.attive', nEsp)) : `<span class="facolt">${c.t('esperti.facoltative')}</span>`;
  const corpo = s.esperti
    ? dove === 'colonna' ? `<p class="nota">${c.t('esperti.aperteNota')}</p>` : ''
    : `<ul class="domande-esperti">${['d1', 'd2', 'd3'].map((k) => `<li>${c.t(`esperti.${k}`)}</li>`).join('')}</ul>`;
  return `<div class="scheda accesso-esperti${s.esperti ? ' aperta' : ''}"><div class="riga-tit"><h3 class="ic-prima ic-sliders-horizontal">${c.t('esperti.accessoTitolo')}</h3>${bottone}</div><p class="stato-esperti">${stato}</p>${corpo}</div>`;
}

export function campiTasso(c: Contesto, dove: 'passo' | 'colonna' = 'colonna'): string {
  const s = c.s;
  const sostituito = conteggiValidi(s) || tassoDaDevice(s);
  const aM = aiuto(c, 'misura', c.t('tasso.misuraAiuto'), 'tassoNonSessione');
  const aI = aiuto(c, 'ignora', c.t('tasso.ignoraAiuto'), 'chiIgnora');
  const frazione = forseFrazione(s.tasso);
  const errato = s.tasso.trim() !== '' && percento(s.tasso) === undefined && frazione === undefined;
  return `<p class="nota">${c.t('tasso.intro')} ${fuori(c, 'trovaTasso', c.t('tasso.doveTrovarlo'))}</p>
    ${
      sostituito
        ? `<p class="nota">${c.t(conteggiValidi(s) ? 'esperti.conteggiUsa' : 'tasso.riepDevice')}</p>`
        : `<div class="campo stretto"><label class="et-campo" for="c-tasso">${c.t('tasso.valore')}</label>
          <input id="c-tasso" data-c="tasso" type="text" inputmode="decimal" value="${esc(s.tasso)}" autocomplete="off"${errato || frazione !== undefined ? ' aria-invalid="true" aria-describedby="c-tasso-e"' : ''}>
          ${errato ? `<p class="errore-campo" id="c-tasso-e">${c.t('tasso.valoreErrore')}</p>` : ''}
          ${frazione !== undefined ? `<p class="conferma-campo" id="c-tasso-e" role="status">${c.t('tasso.intendi', { v: c.f.decimale(frazione) })} <button type="button" class="btn piccolo" data-a="conferma-tasso" data-v="${frazione}">${c.t('tasso.intendiSi', { v: c.f.decimale(frazione) })}</button></p>` : ''}</div>
        <fieldset><legend>${c.t('tasso.precisione')}</legend><div class="scelte riga">
          ${scelta(c, 'precisione', 'preciso', c.t('tasso.preciso'), c.t('tasso.precisoNota'))}
          ${scelta(c, 'precisione', 'stima', c.t('tasso.stima'), c.t('tasso.stimaNota'))}
          ${scelta(c, 'precisione', 'massima', c.t('tasso.massima'), c.t('tasso.massimaNota'))}
        </div></fieldset>`
    }
    <fieldset><legend>${c.t('tasso.misura')} ${aM.bottone}</legend>${aM.pannello}<div class="scelte riga">
      ${scelta(c, 'misura', 'utente', c.t('tasso.utente'), c.t('tasso.utenteNota'))}
      ${scelta(c, 'misura', 'banner', c.t('tasso.banner'), c.t('tasso.bannerNota'))}
      ${scelta(c, 'misura', 'nonso', c.t('comune.nonLoSo'), c.t('tasso.nonsoNota'))}
    </div></fieldset>
    <fieldset><legend>${c.t('tasso.ignora')} ${aI.bottone}</legend>${aI.pannello}<div class="scelte riga">
      ${scelta(c, 'ignora', 'incluso', c.t('tasso.incluso'), c.t('tasso.inclusoNota'))}
      ${scelta(c, 'ignora', 'escluso', c.t('tasso.escluso'), c.t('tasso.esclusoNota'))}
      ${scelta(c, 'ignora', 'nonso', c.t('comune.nonLoSo'), c.t('tasso.nonsoNota'))}
    </div></fieldset>
    ${s.ignora === 'escluso' || s.ignora === 'nonso' ? campo(c, 'quotaIgnora', c.t('tasso.quotaIgnora'), s.quotaIgnora, { nota: c.t('tasso.quotaIgnoraNota'), facoltativo: true }) : ''}
    ${dove === 'passo' ? schedaAccessoEsperti(c, 'passo') : ''}
    ${s.esperti ? campiEsperti(c) : ''}`;
}

export function riepilogoTasso(c: Contesto): string {
  const s = c.s;
  const p1 = conteggiValidi(s)
    ? c.t('tasso.riepConteggi', { a: c.f.intero(numero(s.accettati)!), b: c.f.intero(numero(s.nonAccettati)!) })
    : tassoDaDevice(s)
      ? c.t('tasso.riepDevice')
      : c.t('tasso.riepValore', { v: `${s.tasso.trim()}%`, precisione: c.t(`tasso.riep${s.precisione === 'preciso' ? 'Preciso' : s.precisione === 'massima' ? 'Massima' : 'Stima'}`) });
  const mis = c.t(`tasso.riepMisura${s.misura === 'utente' ? 'Utente' : s.misura === 'banner' ? 'Banner' : 'Nonso'}`);
  const ign = c.t(`tasso.riepIgnora${s.ignora === 'incluso' ? 'Incluso' : s.ignora === 'escluso' ? 'Escluso' : 'Nonso'}`);
  const usato = c.ris ? `<p class="nota">${c.t('tasso.usato', { v: c.f.pct(c.ris.parametri.tassoEffettivo.p50), a: c.f.pct(c.ris.parametri.tassoEffettivo.p2_5), b: c.f.pct(c.ris.parametri.tassoEffettivo.p97_5) })}</p>` : '';
  return `<p class="valore">${p1}</p><p class="nota">${mis} · ${ign}</p>${usato}`;
}

// ---------------------------------------------------------------- avvio
export function rendiAvvio(c: Contesto): string {
  const s = c.s;
  const passo = passoCorrente(s);
  const e = esitoCM(s);
  const li = (n: 1 | 2 | 3, nome: string): string =>
    `<li class="${n < passo ? 'fatto' : n === passo ? 'ora' : ''}"${n === passo ? ' aria-current="step"' : ''}>${n} · ${nome}${n < passo ? ' ✓' : ''}</li>`;
  const mancanti = mancantiTasso(s).length;
  let out = `<div class="avvio">
    <h1>${c.t('avvio.titolo')}</h1>
    <p class="nota">${c.t('avvio.sottotitolo')}</p>
    <p class="passo-di"><strong>${c.t('avvio.passoDi', { n: passo })}</strong></p>
    <ol class="passi" aria-label="${c.t('avvio.avanzamento')}">${li(1, c.t('avvio.passo1'))}${li(2, c.t('avvio.passo2'))}${li(3, c.t('avvio.passo3'))}</ol>
    ${s.linkIgnorato ? `<div class="fascia ambra"><p>${c.t('ris.linkIgnorato')}</p></div>` : ''}
    ${s.canaliIgnorati ? `<div class="fascia ambra"><p>${c.t('ris.canaliIgnorati')}</p></div>` : ''}
    ${s.origine === 'link' ? `<div class="fascia blu"><p>${c.t('ris.daLink')}</p></div>` : ''}
    ${s.file ? passoFileFatto(c) : passoFileVuoto(c)}`;
  if (!s.file) {
    out += `<section class="scheda dopo"><div class="passo-titolo"><span class="num dopo" aria-hidden="true">2</span><h2>${c.t('avvio.poi2Titolo')}</h2></div><p class="nota">${c.t('avvio.poi2Testo')}</p></section>`;
  } else {
    out += `<section class="scheda" aria-labelledby="p2"><div class="passo-titolo"><span class="num${passo > 2 ? ' fatto' : ''}" aria-hidden="true">${passo > 2 ? '✓' : '2'}</span><h2 id="p2">${c.t('cm.titolo')}</h2></div>
      <p class="nota">${c.t('cm.intro')}</p>${campiCM(c)}</section>`;
  }
  if (passo < 3) {
    out +=
      s.file && e === 'blocco'
        ? `<section class="scheda dopo"><div class="passo-titolo"><span class="num dopo" aria-hidden="true">3</span><h2>${c.t('tasso.scheda')}</h2></div><p class="nota">${c.t('cm.tassoNonServe')}</p></section>`
        : `<section class="scheda dopo"><div class="passo-titolo"><span class="num dopo" aria-hidden="true">3</span><h2>${c.t('avvio.poi3Titolo')}</h2></div><p class="nota">${c.t('avvio.poi3Testo')}</p></section>`;
  } else {
    out += `<section class="scheda" aria-labelledby="p3"><div class="passo-titolo"><span class="num" aria-hidden="true">3</span><h2 id="p3">${c.t('tasso.titolo')}</h2></div>
      ${campiTasso(c, 'passo')}
      <div class="azioni fine-passo">
        <button type="button" class="btn primo" data-a="vedi-stima" id="vedi-stima"${completo(s) ? '' : ' disabled'}>${c.t(e === 'blocco' ? 'avvio.vediConfronto' : 'avvio.vediStima')}</button>
        <span class="nota" role="status" id="mancano">${mancanti ? plurale(c.t, 'avvio.mancano', mancanti) : ''}</span>
      </div></section>`;
  }
  return out + '</div>';
}

// ---------------------------------------------------------------- ipotesi
/** Testo del cursore per i lettori di schermo: il valore detto a parole, con il margine plausibile. */
export function testoCursore(c: Contesto, k: ChiaveIpotesi, v: number): string {
  const [a, b] = margine({ ...ipotesi(c.s, k), mediana: v });
  return c.t(`ip.${k}Cursore`, { v: c.f.rapporto(v), a: c.f.rapporto(a), b: c.f.rapporto(b) });
}
export function fraseIpotesi(c: Contesto, k: ChiaveIpotesi): string {
  return c.t(`ip.${k}Frase`, { v: c.f.rapporto(ipotesi(c.s, k).mediana) });
}
export function plausibileIpotesi(c: Contesto, k: ChiaveIpotesi): string {
  const [a, b] = margine(ipotesi(c.s, k));
  return c.t('ip.plausibile', { a: c.f.rapporto(a), b: c.f.rapporto(b) });
}
export function calibrate(c: Contesto): ChiaveIpotesi[] {
  const a = c.ris?.ancora;
  if (!a?.attivo) return [];
  return a.rAovCalibrato ? ['rConv', 'rAov'] : ['rConv'];
}

function schedaIpotesi(c: Contesto, k: ChiaveIpotesi): string {
  const s = c.s;
  const ancoraK: Ancora = k === 'rFreq' ? 'rFreq' : k === 'rConv' ? 'rConv' : 'rAov';
  const p = c.ris?.parametri;
  if (calibrate(c).includes(k) && p) {
    const q = k === 'rConv' ? p.rConv : p.rAov;
    return `<div class="scheda"><div class="riga-tit"><h3>${c.t(`ip.${k}`)}</h3>${etichetta('cal', c.t('stato.calibrata'))}</div>
      <p class="valore">${c.t(`ip.${k}Calibrata`, { v: c.f.rapporto(q.p50), a: c.f.rapporto(q.p2_5), b: c.f.rapporto(q.p97_5) })}</p>
      <p class="nota">${k === 'rConv' ? c.t('ip.rConvPartenza', { v: c.f.rapporto(ipotesi(s, 'rConv').mediana) }) + ' ' : ''}${fuori(c, 'ordiniReali', c.t('comune.approfondisci'))}</p></div>`;
  }
  const st = s.statoIpotesi[k];
  const daLink = s.origine === 'link' && st === 'mod';
  const chip = daLink ? etichetta('grigio da-link', c.t('stato.daLink')) : etichetta(st, c.t(`stato.${st === 'pred' ? 'predefinita' : st === 'conf' ? 'confermata' : 'modificata'}`));
  const a = aiuto(c, `ip-${k}`, c.t(`ip.${k}Aiuto`), ancoraK, 'ipotesiPredefinite');
  const inConflitto = k === 'rConv' && c.conflitto !== null;
  const [mLo, mHi] = margine(ipotesi(s, k));
  const notaConflitto = inConflitto
    ? `<div class="fascia ambra"><p><strong>${c.t('stato.conflitto')}.</strong> ${c.t('ip.rConvConflitto', { v: c.f.rapporto(c.conflitto!.rConvNecessario) })} ${c.t('ip.rConvConflittoNota', { a: c.f.rapporto(mLo), b: c.f.rapporto(mHi) })}</p></div>`
    : '';
  const [min, max] = LIMITI_CURSORE[k];
  const val = ipotesi(s, k).mediana;
  return `<div class="scheda${inConflitto ? ' conflitto' : ''}" data-ip="${k}"><div class="riga-tit"><h3 id="ip-${k}-t">${c.t(`ip.${k}`)}</h3><span data-chip>${chip}</span>${a.bottone}</div>
    ${notaConflitto}
    <p class="valore" data-frase>${fraseIpotesi(c, k)}</p>
    ${a.pannello}
    <input type="range" id="c-valori.${k}" data-c="valori.${k}" min="${min}" max="${max}" step="0.05" value="${val}" aria-labelledby="ip-${k}-t" aria-valuetext="${esc(testoCursore(c, k, val))}">
    <p class="nota" data-plausibile>${plausibileIpotesi(c, k)}</p>
    ${s.esperti ? `<div class="campo"><label class="et-campo" for="c-sicurezza.${k}">${c.t('esperti.sicurezza')}</label><select id="c-sicurezza.${k}" data-c="sicurezza.${k}">${[['1.5', 'poco'], ['1', 'abbastanza'], ['0.5', 'molto']].map(([v, n]) => `<option value="${v}"${s.sicurezza[k] === v ? ' selected' : ''}>${c.t(`esperti.${n}`)}</option>`).join('')}</select></div>` : ''}
    <div class="azioni" data-azioni>${azioniIpotesi(c, k)}</div></div>`;
}
export function azioniIpotesi(c: Contesto, k: ChiaveIpotesi): string {
  const st = c.s.statoIpotesi[k];
  const daLink = c.s.origine === 'link' && st === 'mod';
  return `${st === 'pred' || daLink ? `<button type="button" class="btn piccolo" data-a="conferma" data-v="${k}">${c.t('ip.vaBene')}</button>` : ''}
    ${c.s.valori[k] !== null ? `<button type="button" class="btn piccolo testo" data-a="predefinito" data-v="${k}">${c.t('ip.tornaPredefinito')} (${c.f.rapporto(predefinito(c.s, k).mediana)})</button>` : ''}`;
}
export function chipIpotesi(c: Contesto, k: ChiaveIpotesi): string {
  const st = c.s.statoIpotesi[k];
  return etichetta(st, c.t(`stato.${st === 'pred' ? 'predefinita' : st === 'conf' ? 'confermata' : 'modificata'}`));
}
export function etichettaPredefinite(c: Contesto): string {
  const n = nPredefinite(c.s, calibrate(c));
  return etichetta(n ? 'pred' : 'conf', plurale(c.t, 'stato.predefinite', n));
}

// ---------------------------------------------------------------- ordini e utenti
function schedaOrdini(c: Contesto): string {
  const s = c.s;
  if (!s.ordiniAttivi) {
    return `<div class="scheda"><div class="riga-tit"><h3 class="ic-prima ic-receipt">${c.t('ordini.titolo')}</h3><button type="button" class="btn piccolo" data-a="ordini-on">${c.t('comune.aggiungi')}</button></div><p class="nota valore">${c.t('ordini.invito')}</p></div>`;
  }
  const info = s.file?.info;
  const dal = s.ordiniDal || info?.dal || '';
  const al = s.ordiniAl || info?.al || '';
  const tGa = (s.file?.dati.righe ?? []).filter((r) => r.data >= dal && r.data <= al).reduce((x, r) => x + r.transazioni, 0);
  const o = numero(s.ordini) ?? 0;
  const a = aiuto(c, 'pubblico', c.t('ordini.pubblicoAiuto'), 'altrePerdite');
  const opz = (p: Pubblico): string => {
    const pr = ALTRE_PERDITE_PUBBLICO[p];
    const [lo, hi] = margine95(pr);
    return scelta(c, 'pubblico', p, c.t(`ordini.${p}`), `${c.t('ordini.circaPct', { v: c.f.pct(pr.mediana) })} · ${c.t('comune.intervallo', { a: c.f.pct(lo), b: c.f.pct(hi) })}`);
  };
  const avvisi = c.avvisiOrdini;
  return `<div class="scheda${c.conflitto ? ' conflitto' : ''}"><div class="riga-tit"><h3 class="ic-prima ic-receipt">${c.t('ordini.titolo')}</h3><button type="button" class="btn piccolo" data-a="ordini-off">${c.t('comune.togli')}</button></div>
    <div class="due">${campo(c, 'ordini', c.t('ordini.ordini'), s.ordini, { modo: 'numeric' })}${campo(c, 'entrate', c.t('ordini.entrate'), s.entrate, { facoltativo: true })}</div>
    ${
      s.esperti
        ? `<p class="nota">${c.t('ordini.periodoPersonale')}</p><div class="due">${campo(c, 'ordiniDal', c.t('ordini.dal'), s.ordiniDal, { tipo: 'date', min: info?.dal, max: info?.al, modo: 'none' })}${campo(c, 'ordiniAl', c.t('ordini.al'), s.ordiniAl, { tipo: 'date', min: info?.dal, max: info?.al, modo: 'none' })}</div>`
        : info
          ? `<p class="nota">${ordiniSuTuttoIlFile(s) ? c.t('ordini.periodo', { dal: c.f.dataLunga(info.dal), al: c.f.dataLunga(info.al) }) : c.t('ordini.usati', { n: c.f.intero(o), dal: c.f.dataLunga(dal), al: c.f.dataLunga(al) })}</p>`
          : ''
    }
    ${o > 0 && tGa > 0 && o >= tGa ? `<p class="valore" role="status">${c.t('ordini.riscontro', { t: c.f.intero(tGa), n: c.f.intero(o - tGa), pct: c.f.pct((o - tGa) / o) })}</p>` : ''}
    ${avvisi.map((x) => `<div class="fascia ambra" role="status"><p><strong>${c.t('ordini.nonApplicati')}.</strong> ${c.t(`ordini.${x.codice}`, x.parametri)}</p></div>`).join('')}
    <fieldset><legend>${c.t('ordini.pubblico')} ${s.pubblico === '' ? etichetta('daind', c.t('stato.daIndicare')) : ''} ${a.bottone}</legend>${a.pannello}
      <div class="scelte">${opz('consumo')}${opz('tecnico')}${opz('misto')}${opz('server')}${s.esperti || s.pubblico === 'valore' ? scelta(c, 'pubblico', 'valore', c.t('ordini.valore')) : ''}</div>
      ${s.pubblico === 'valore' ? campo(c, 'altreValore', c.t('ordini.valoreCampo'), s.altreValore) : ''}
      ${s.pubblico === '' && o > 0 ? `<p class="errore-campo" role="status">${c.t('ordini.pubblicoManca')}</p>` : ''}
    </fieldset>
    <p class="nota">${c.t('ordini.confrontabili')} ${fuori(c, 'usareOrdini', c.t('comune.approfondisci'))}</p></div>`;
}

/**
 * Utenti del periodo. Il totale della riga dei totali è un dato del file: si usa da solo, se coerente.
 * Quattro stati: letto dall'export, inserito da te, non disponibile, non usato (scelta dell'utente).
 */
function schedaUtenti(c: Contesto): string {
  const s = c.s;
  const u = utentiEffettivi(s);
  const btn = (azione: string, testo: string, primo = false): string => `<button type="button" class="btn piccolo${primo ? '' : ' testo'}" data-a="${azione}">${testo}</button>`;
  const chip: Record<typeof u.fonte, string> = {
    export: etichetta('dato', c.t('utenti.statoExport')),
    utente: etichetta('mod', c.t('utenti.statoUtente')),
    nonDisponibile: `<span class="et neutro">${c.t('utenti.statoNonDisp')}</span>`,
    no: `<span class="et neutro">${c.t('utenti.statoNo')}</span>`,
  };
  const testa = `<div class="riga-tit"><h3 class="ic-prima ic-users" id="utenti-tit">${c.t('utenti.titolo')}</h3>${chip[u.fonte]}</div>`;
  const valore = (v: number): string => `<p class="valore">${c.t('utenti.valore', { v: c.f.intero(v) })}</p>`;
  let corpo: string;
  if (u.fonte === 'export') {
    corpo = `${valore(u.valore!)}<p class="nota">${c.t('utenti.notaExport')}</p><div class="azioni">${btn('utenti-modifica', c.t('comune.modifica'), true)}${btn('utenti-no', c.t('utenti.nonUsarlo'))}</div>`;
  } else if (u.fonte === 'utente' && (s.utentiModifica || !u.valore)) {
    corpo = `${campo(c, 'utentiPeriodo', c.t('utenti.campo'), s.utentiPeriodo, { modo: 'numeric', nota: `${c.t('utenti.nota')} ${fuori(c, 'utenti', c.t('comune.approfondisci'))}` })}
      <div class="azioni">${btn('utenti-fatto', c.t('utenti.fatto'), true)}${btn('utenti-togli', c.t('comune.togli'))}</div>`;
  } else if (u.fonte === 'utente') {
    corpo = `${valore(u.valore!)}<p class="nota">${c.t('utenti.notaUtente')}</p><div class="azioni">${btn('utenti-modifica', c.t('comune.modifica'), true)}${btn('utenti-togli', c.t('comune.togli'))}</div>`;
  } else if (u.fonte === 'no') {
    corpo = `<p class="nota valore">${c.t('utenti.notaNo', { v: c.f.intero(u.export!) })}</p><div class="azioni">${btn('utenti-auto', c.t('utenti.usaExport'), true)}${btn('utenti-inserisci', c.t('utenti.inserisci'))}</div>`;
  } else {
    corpo = `<p class="nota valore">${c.t('utenti.invito')}</p><div class="azioni">${btn('utenti-inserisci', c.t('utenti.inserisci'), true)}</div>`;
  }
  return `<div class="scheda scheda-utenti" data-ip="utenti" aria-labelledby="utenti-tit" role="group">${testa}${corpo}</div>`;
}

// ---------------------------------------------------------------- colonna del banco di lavoro
export function rendiColonna(c: Contesto): string {
  const s = c.s;
  const origine = s.origine === 'esempio' ? etichetta('grigio', c.t('stato.esempio')) : s.origine === 'link' ? etichetta('grigio da-link', c.t('stato.daLink')) : '';
  const schedaRisposta = (chiave: 'cm' | 'tasso', titolo: string, riepilogo: string, campi: string): string =>
    `<div class="scheda" data-ip="${chiave}"><div class="riga-tit"><h3>${titolo}</h3>${origine}<button type="button" class="btn piccolo" data-a="apri" data-v="${chiave}" aria-expanded="${s.aperta === chiave}">${c.t(s.aperta === chiave ? 'comune.fatto' : 'comune.modifica')}</button></div>
      ${s.aperta === chiave ? campi : riepilogo}</div>`;
  // Gruppi numerati come nella home; l'intestazione resta fissa in alto mentre si scorre il suo gruppo.
  const apri = (n: number, titolo: string, extra = ''): string =>
    `<section class="gruppo-sez" aria-labelledby="gruppo-${n}"><div class="gruppo"><h2 id="gruppo-${n}"><span class="gruppo-num">${String(n).padStart(2, '0')}</span> ${titolo}</h2>${extra}</div>`;
  return `${apri(1, c.t('ip.gruppoRisposte'))}
    <div class="scheda"><div class="riga-tit"><h3>${c.t('file.scheda')}</h3>${s.origine === 'esempio' ? etichetta('grigio', c.t('stato.esempio')) : ''}<button type="button" class="btn piccolo" data-a="scegli-file">${c.t('comune.cambia')}</button></div>
      <p class="nota valore"><strong>${esc(s.file!.nome)}</strong><br>${rigaFile(c)}</p>${avvisiFile(c)}${opzioniFile(c)}</div>
    ${schedaRisposta('cm', c.t('cm.scheda'), `<p class="nota valore">${riepilogoCM(c)}</p>`, campiCM(c))}
    ${schedaRisposta('tasso', c.t('tasso.scheda'), riepilogoTasso(c), campiTasso(c))}</section>

    ${apri(2, c.t('ip.gruppoIpotesi'), `<span data-conta>${etichettaPredefinite(c)}</span>`)}
    <p class="nota">${c.t('ip.gruppoIpotesiNota')}</p>
    ${IPOTESI.map((k) => schedaIpotesi(c, k)).join('')}</section>

    ${apri(3, c.t('ip.gruppoMigliora'))}
    ${s.file!.dati.haTransazioni ? schedaOrdini(c) : ''}
    ${s.file!.dati.haUtenti ? schedaUtenti(c) : ''}</section>

    ${apri(4, c.t('ip.gruppoAltro'))}
    ${schedaAccessoEsperti(c, 'colonna')}
    <div class="azioni sopra">
      <button type="button" class="btn piccolo" data-a="ripristina">${c.t('ip.ripristina')}</button>
      <button type="button" class="btn piccolo ic-prima ic-link" data-a="copia-link">${c.t('esporta.link')}</button>
    </div>
    <div role="status" aria-live="polite">${statoLink(c, 'col')}</div>
    <label class="interruttore leggero sopra" for="c-ricorda"><input type="checkbox" id="c-ricorda" data-c="ricorda"${s.ricorda ? ' checked' : ''}> ${c.t('ip.ricorda')}</label>
    <p class="nota">${c.t('ip.ricordaNota')}</p></section>`;
}
