// Controllore dello strumento: stato, eventi, calcolo nel worker, resa delle viste.
import { traduttore, plurale, type Lingua } from '../i18n/indice';
import { formati } from '../i18n/formato';
import type { PriorLN, Risultato } from '../motore/modello';
import { ALTRE_PERDITE_PUBBLICO, alternativePubblico, type Pubblico } from './pubblico';
import { RISPOSTE_ESEMPIO, esempioCsv as creaEsempio } from './esempio';
import { leggiCsv } from '../parser';
import { codifica, decodifica } from './collegamento';
import { componiEsito } from './esito';
import { csvRisultati, scarica } from './esporta';
import { IPOTESI, utentiEffettivi, completo, configurazione, datiDaStimare, ipotesi, mancantiTasso, nPredefinite, statoIniziale, type ChiaveIpotesi, type Stato } from './stato';
import { azioniIpotesi, calibrate, chipIpotesi, etichettaPredefinite, fraseIpotesi, plausibileIpotesi, rendiAvvio, rendiColonna, testoCursore, type Contesto } from './vistaIngressi';
import { disegnaGrafici, rendiRisultati } from './vistaRisultati';

const radice = document.getElementById('strumento') as HTMLElement | null;
if (radice) avvia(radice);

function avvia(radice: HTMLElement): void {
  const lingua = (radice.dataset.lingua === 'en' ? 'en' : 'it') as Lingua;
  const t = traduttore(lingua);
  const CHIAVE_MEMORIA = 'stimatore-ga4-ipotesi';
  let s: Stato = statoIniziale();
  const c: Contesto = { s, t, f: formati(lingua), lingua, ris: null, risSenzaOrdini: null, conflitto: null, avvisiOrdini: [], inCalcolo: false, erroreCalcolo: '', aiutiAperti: new Set(), esempio: null, linkGenerato: '', linkCopiato: false };

  radice.innerHTML = `
    <input class="nascosto-vis" type="file" id="file" accept=".csv,.tsv,.txt,text/csv,text/plain" tabindex="-1" aria-hidden="true">
    <input class="nascosto-vis" type="file" id="file2" accept=".csv,.tsv,.txt,text/csv,text/plain" tabindex="-1" aria-hidden="true">
    <div id="st-avvio"></div>
    <div id="st-banco" hidden>
      <div class="schede-mob" role="tablist" aria-label="${t('ris.regione')}">
        <button type="button" role="tab" id="tab-ris" data-a="vista" data-v="risultati">${t('ris.vistaRisultati')}</button>
        <button type="button" role="tab" id="tab-ip" data-a="vista" data-v="ipotesi"></button>
      </div>
      <div class="banco">
        <aside class="riquadro riq-ipotesi" id="st-colonna" aria-label="${t('ip.regione')}"></aside>
        <section class="riquadro riq-risultati" id="st-risultati" aria-label="${t('ris.regione')}"></section>
      </div>
    </div>`;
  const el = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;
  const elAvvio = el('st-avvio');
  const elBanco = el('st-banco');
  const elColonna = el('st-colonna');
  const elRisultati = el('st-risultati');

  // ---------------------------------------------------------------- resa
  function conFuoco(fn: () => void): void {
    const attivo = document.activeElement as HTMLElement | null;
    const id = attivo && radice.contains(attivo) ? attivo.id : '';
    const [a, b] = id && attivo instanceof HTMLInputElement && attivo.type === 'text' ? [attivo.selectionStart, attivo.selectionEnd] : [null, null];
    fn();
    if (!id) return;
    const nuovo = document.getElementById(id) as HTMLInputElement | null;
    if (!nuovo || nuovo === document.activeElement) return;
    nuovo.focus({ preventScroll: true });
    if (a !== null && nuovo.type === 'text') nuovo.setSelectionRange(a, b);
  }
  function rendiSchedeMobile(): void {
    document.body.dataset.vista = s.vista;
    el('tab-ris').setAttribute('aria-selected', String(s.vista === 'risultati'));
    el('tab-ip').setAttribute('aria-selected', String(s.vista === 'ipotesi'));
    el('tab-ip').textContent = t('ris.vistaIpotesi', { n: nPredefinite(s, calibrate(c)) });
  }
  function rendiRis(): void {
    conFuoco(() => {
      elRisultati.innerHTML = rendiRisultati(c);
      disegnaGrafici(c, elRisultati);
    });
  }
  function rendiCol(): void {
    conFuoco(() => (elColonna.innerHTML = rendiColonna(c)));
    rendiSchedeMobile();
  }
  function rendi(): void {
    c.s = s;
    const banco = s.fase === 'banco' && s.file !== null;
    elAvvio.hidden = banco;
    elBanco.hidden = !banco;
    document.body.classList.toggle('strumento-banco', banco);
    if (banco) {
      elAvvio.innerHTML = '';
      rendiCol();
      rendiRis();
    } else conFuoco(() => (elAvvio.innerHTML = rendiAvvio(c)));
  }
  let resaInCoda = false;
  function chiediResa(): void {
    if (resaInCoda) return;
    resaInCoda = true;
    window.setTimeout(() => {
      resaInCoda = false;
      rendi();
    }, 0);
  }
  /** Aggiorna solo i conteggi delle ipotesi predefinite, senza ridisegnare. */
  function aggiornaConteggi(): void {
    radice.querySelectorAll('[data-conta]').forEach((x) => (x.innerHTML = etichettaPredefinite(c)));
    rendiSchedeMobile();
  }

  // ---------------------------------------------------------------- calcolo
  // Il worker di calcolo si crea una sola volta, all'apertura della pagina, e si riusa per ogni stima:
  // così il suo codice è già scaricato e lo Stimatore funziona anche se ci si scollega subito dopo
  // (e anche con la cache del browser disattivata). Se arrivano richieste mentre calcola, si tiene solo l'ultima.
  let worker: Worker | null = null;
  let workerOk = true;
  let occupato = false;
  let inAttesa: { id: number; dati: NonNullable<ReturnType<typeof datiDaStimare>>; config: ReturnType<typeof configurazione>; alternative: Record<string, PriorLN> } | null = null;
  let richiesta = 0;
  let timer = 0;
  let primoRisultato = false;
  const firma = (r: Risultato | null): string => (r ? JSON.stringify([r.ancora?.attivo, c.conflitto?.direzione, c.conflitto && Math.round(c.conflitto.rConvNecessario * 20), r.ancora?.rAovCalibrato, c.avvisiOrdini.map((a) => a.codice), r.avvisi.map((a) => a.codice)]) : '');

  function invia(): void {
    if (!worker || occupato || !inAttesa) return;
    occupato = true;
    worker.postMessage(inAttesa);
    inAttesa = null;
  }
  function creaWorker(): void {
    try {
      worker = new Worker(new URL('../worker.ts', import.meta.url), { type: 'module' });
    } catch {
      workerOk = false;
      return;
    }
    worker.onmessage = (ev) => {
      const m = ev.data;
      if (m.tipo !== 'progresso') {
        occupato = false;
        if (inAttesa) return invia(); // nel frattempo è arrivata una richiesta più recente: questa si scarta
      }
      if (m.id !== richiesta) return;
      if (m.tipo === 'progresso') {
        const b = document.getElementById('barra-calcolo') as HTMLProgressElement | null;
        if (b) b.value = m.frazione;
        return;
      }
      fineCalcolo();
      const prima = firma(c.ris);
      if (m.tipo === 'fine') {
        // In conflitto gli ordini reali non vengono usati per nessuna grandezza (vedi esito.ts).
        Object.assign(c, componiEsito(m.risultato, m.senzaOrdini, ipotesi(s, 'rConv'), m.compatibili ?? null));
      } else {
        Object.assign(c, { ris: null, risSenzaOrdini: null, conflitto: null, avvisiOrdini: [] });
        c.erroreCalcolo = m.codice === 'nessuna_sessione' ? 'nessuna_sessione' : 'nessuna_riga';
      }
      // La colonna si ridisegna solo se cambia qualcosa che la riguarda (ordini reali usati, conflitto, avvisi):
      // così non si interrompe chi sta trascinando un cursore o scrivendo.
      if (firma(c.ris) !== prima || !elColonna.contains(document.activeElement)) rendiCol();
      const valoriPrima = istantanea();
      rendiRis();
      evidenziaCambiati(valoriPrima);
      if (primoRisultato) {
        primoRisultato = false;
        document.getElementById(s.tour ? 'tappa-tour' : 'dato-principale')?.focus();
      }
    };
    // Il codice del worker non si è potuto caricare (per esempio pagina aperta senza rete): lo si dice com'è.
    worker.onerror = () => {
      occupato = false;
      workerOk = false;
      worker = null;
      if (s.fase === 'banco') {
        fineCalcolo();
        c.erroreCalcolo = 'worker';
        rendiRis();
      }
    };
  }
  creaWorker();

  let timerLungo = 0;
  function segnaLungo(): void {
    if (!c.inCalcolo) return;
    c.calcoloLungo = true;
    elRisultati.classList.add('in-calcolo');
    const box = document.getElementById('calcolo');
    if (box) box.dataset.lungo = '';
    const testo = document.getElementById('calcolo-testo');
    if (testo) testo.textContent = t('ris.ricalcolo');
  }
  function fineCalcolo(): void {
    window.clearTimeout(timerLungo);
    c.inCalcolo = false;
    c.calcoloLungo = false;
    elRisultati.classList.remove('in-calcolo');
  }

  function pianifica(): void {
    salvaMemoria();
    window.clearTimeout(timer);
    if (s.fase !== 'banco') return;
    timer = window.setTimeout(calcola, 250);
  }
  function calcola(): void {
    const dati = datiDaStimare(s);
    if (!dati || !completo(s)) {
      richiesta++; // eventuali risultati in arrivo non valgono più
      inAttesa = null;
      fineCalcolo();
      rendiRis();
      return;
    }
    if (!worker && workerOk) creaWorker();
    if (!worker) {
      fineCalcolo();
      c.erroreCalcolo = 'worker';
      rendiRis();
      return;
    }
    const id = ++richiesta;
    c.erroreCalcolo = '';
    if (!c.inCalcolo) {
      c.inCalcolo = true;
      const barra = document.getElementById('barra-calcolo') as HTMLProgressElement | null;
      if (barra) barra.value = 0;
      // Solo i calcoli lunghi si fanno vedere (e sentire): niente lampeggi né annunci a ogni cursore.
      window.clearTimeout(timerLungo);
      timerLungo = window.setTimeout(segnaLungo, 300);
    }
    inAttesa = { id, dati, config: configurazione(s), alternative: alternativePubblico(s.pubblico) };
    invia();
  }

  // ---------------------------------------------------------------- numeri cambiati in evidenza
  // Dopo un nuovo calcolo si evidenziano per un attimo i valori che sono cambiati. Solo un cambio di stile:
  // nessun annuncio in più ai lettori di schermo; con prefers-reduced-motion l'evidenza è fissa, senza animazione.
  const NUMERI = '.sintesi b, .eroe .titolo em, .eroe p strong, .perche strong, .visib-leg > span, .metriche .grande, .metriche p strong, .metriche dd, .tre-parti dd';
  let timerEvidenza = 0;
  const istantanea = (): string[] => [...elRisultati.querySelectorAll(NUMERI)].map((e) => e.textContent ?? '');
  function evidenziaCambiati(prima: string[]): void {
    const ora = [...elRisultati.querySelectorAll<HTMLElement>(NUMERI)];
    if (!prima.length || ora.length !== prima.length) return; // primo risultato o struttura cambiata: niente da confrontare
    window.clearTimeout(timerEvidenza);
    ora.forEach((e, i) => e.textContent !== prima[i] && e.classList.add('cambiato'));
    timerEvidenza = window.setTimeout(() => elRisultati.querySelectorAll('.cambiato').forEach((e) => e.classList.remove('cambiato')), 1800);
  }

  // ---------------------------------------------------------------- memoria locale (solo su richiesta) e link
  function salvaMemoria(): void {
    try {
      if (s.ricorda) localStorage.setItem(CHIAVE_MEMORIA, codifica(s));
    } catch {
      /* memoria non disponibile: si prosegue senza salvare */
    }
  }
  function applica(parziale: Partial<Stato>): void {
    Object.assign(s, parziale);
    for (const k of IPOTESI) s.statoIpotesi[k] = s.valori[k] === null ? 'pred' : 'mod';
  }
  function leggiAvvio(): void {
    const h = location.hash;
    if (h === '#tour') {
      caricaEsempio();
      return;
    }
    const daLink = decodifica(h);
    if (daLink === 'ignoto') s.linkIgnorato = true;
    else if (daLink) {
      applica(daLink);
      s.origine = 'link';
      return;
    }
    try {
      const m = localStorage.getItem(CHIAVE_MEMORIA);
      const dec = m ? decodifica(m) : null;
      if (dec && dec !== 'ignoto') {
        applica(dec);
        s.ricorda = true;
      }
    } catch {
      /* memoria non disponibile */
    }
  }
  async function copiaLink(): Promise<void> {
    c.linkGenerato = `${location.origin}${location.pathname}#${codifica(s)}`;
    try {
      await navigator.clipboard.writeText(c.linkGenerato);
      c.linkCopiato = true;
    } catch {
      c.linkCopiato = false;
    }
    rendi();
  }

  // ---------------------------------------------------------------- file
  async function leggiFile(f: File): Promise<string> {
    const buf = new Uint8Array(await f.arrayBuffer());
    if (buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf);
    if (buf[0] === 0xfe && buf[1] === 0xff) return new TextDecoder('utf-16be').decode(buf);
    return new TextDecoder('utf-8').decode(buf);
  }
  function applicaFile(testo: string, nome: string, colonnaEventi = ''): boolean {
    const r = leggiCsv(testo, { colonnaEventi: colonnaEventi || undefined });
    if (!r.ok || !r.dati || !r.info) {
      s.erroreFile = { nome, errori: r.errori };
      rendi();
      document.getElementById('errore-file')?.focus();
      return false;
    }
    s.erroreFile = null;
    s.file = { nome, testo, dati: r.dati, info: r.info, avvisi: r.avvisi };
    s.colonnaEventi = colonnaEventi;
    return true;
  }
  /** Un file nuovo azzera ciò che apparteneva al file precedente; se prima c'era l'esempio, anche le risposte. */
  function nuovoFile(testo: string, nome: string): void {
    if (s.origine === 'esempio') {
      const esperti = s.esperti;
      s = statoIniziale();
      s.esperti = esperti;
      c.s = s;
      c.esempio = null;
    }
    s.file = null;
    s.file2 = null;
    Object.assign(s, { ordiniAttivi: false, ordini: '', entrate: '', ordiniDal: '', ordiniAl: '', utenti: 'auto', utentiPeriodo: '', utentiModifica: false, tour: 0 });
    Object.assign(c, { ris: null, risSenzaOrdini: null, conflitto: null, avvisiOrdini: [] });
    if (!applicaFile(testo, nome)) return; // l'errore è mostrato nel passo 1
    if (!completo(s)) s.fase = 'avvio';
    rendi();
    pianifica();
  }
  const esempioCsv = (): { testo: string; ordini: number; entrate: number } => creaEsempio(t, lingua);
  function caricaEsempio(): void {
    const e = esempioCsv();
    const esperti = s.esperti;
    s = statoIniziale();
    c.s = s;
    s.esperti = esperti;
    applicaFile(e.testo, t('csvEsempio.titolo'));
    Object.assign(s, { ...RISPOSTE_ESEMPIO, fase: 'banco', tour: 1 });
    c.esempio = { ordini: e.ordini, entrate: e.entrate };
    Object.assign(c, { ris: null, risSenzaOrdini: null, conflitto: null, avvisiOrdini: [] });
    primoRisultato = true;
    rendi();
    calcola();
  }

  // ---------------------------------------------------------------- stato: scrittura per percorso
  function scrivi(percorso: string, valore: string | boolean): void {
    const parti = percorso.split('.');
    let o = s as unknown as Record<string, unknown>;
    for (let i = 0; i < parti.length - 1; i++) o = o[parti[i]] as Record<string, unknown>;
    o[parti[parti.length - 1]] = valore;
  }
  function aggiornaSchedaIpotesi(k: ChiaveIpotesi): void {
    const scheda = radice.querySelector<HTMLElement>(`[data-ip="${k}"]`);
    if (!scheda) return;
    scheda.querySelector('[data-frase]')!.innerHTML = fraseIpotesi(c, k);
    scheda.querySelector('[data-plausibile]')!.innerHTML = plausibileIpotesi(c, k);
    scheda.querySelector('[data-chip]')!.innerHTML = chipIpotesi(c, k);
    scheda.querySelector('[data-azioni]')!.innerHTML = azioniIpotesi(c, k);
    scheda.querySelector('input[type=range]')?.setAttribute('aria-valuetext', testoCursore(c, k, Number(s.valori[k] ?? 0)));
    aggiornaConteggi();
  }

  // ---------------------------------------------------------------- eventi
  radice.addEventListener('input', (ev) => {
    const x = ev.target as HTMLInputElement;
    const p = x.dataset.c;
    if (!p || x.type === 'radio' || x.type === 'checkbox' || x.tagName === 'SELECT') return;
    if (x.type === 'range') {
      const k = p.split('.')[1] as ChiaveIpotesi;
      s.valori[k] = Number(x.value);
      s.statoIpotesi[k] = 'mod';
      aggiornaSchedaIpotesi(k);
      pianifica();
      return;
    }
    scrivi(p, x.value);
    if (s.fase === 'avvio') {
      const b = document.getElementById('vedi-stima') as HTMLButtonElement | null;
      if (b) b.disabled = !completo(s);
      const m = document.getElementById('mancano');
      const n = mancantiTasso(s).length;
      if (m) m.textContent = n ? plurale(t, 'avvio.mancano', n) : '';
    }
    pianifica();
  });

  radice.addEventListener('change', async (ev) => {
    const x = ev.target as HTMLInputElement;
    if (x.id === 'file' || x.id === 'file2') {
      const f = x.files?.[0];
      x.value = '';
      if (!f) return;
      const testo = await leggiFile(f);
      if (x.id === 'file') nuovoFile(testo, f.name);
      else {
        const r = leggiCsv(testo, { colonnaEventi: s.colonnaEventi || undefined });
        if (r.ok && r.dati && r.info) {
          s.file2 = { nome: f.name, dati: r.dati, righe: r.info.righeLette };
          s.erroreFile = null;
        } else {
          s.erroreFile = { nome: f.name, errori: r.errori };
          s.aperta = 'cm';
        }
        rendi();
        pianifica();
      }
      return;
    }
    const p = x.dataset.c;
    if (!p || x.type === 'range') return;
    scrivi(p, x.type === 'checkbox' ? x.checked : x.value);
    if (p === 'cm') Object.assign(s, { identita: '', icona: '' });
    if (p === 'identita') s.icona = '';
    if (p === 'colonnaEventi' && s.file) applicaFile(s.file.testo, s.file.nome, x.value);
    if (p === 'ricorda') {
      try {
        if (!s.ricorda) localStorage.removeItem(CHIAVE_MEMORIA);
      } catch {
        /* memoria non disponibile */
      }
    }
    if (p === 'metrica') {
      rendiRis();
      return;
    }
    chiediResa();
    pianifica();
  });

  radice.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-a]');
    if (!b) return;
    const v = b.dataset.v ?? '';
    switch (b.dataset.a) {
      case 'scegli-file':
        el('file').click();
        return;
      case 'scegli-file2':
        el('file2').click();
        return;
      case 'esempio':
        caricaEsempio();
        return;
      case 'scarica-esempio':
        scarica(t('csvEsempio.nomeFile'), esempioCsv().testo);
        return;
      case 'aiuto': {
        const pannello = document.getElementById(`aiuto-${v}`);
        const apri = !c.aiutiAperti.has(v);
        if (apri) c.aiutiAperti.add(v);
        else c.aiutiAperti.delete(v);
        if (pannello) pannello.hidden = !apri;
        b.setAttribute('aria-expanded', String(apri));
        return;
      }
      case 'apri':
        s.aperta = s.aperta === v ? '' : (v as Stato['aperta']);
        break;
      case 'conferma-tasso':
        s.tasso = String(v).replace('.', lingua === 'it' ? ',' : '.');
        break;
      case 'apri-esperti':
        s.esperti = true;
        // nella colonna i campi per esperti stanno nella scheda del tasso: la si apre
        if (elColonna.contains(b)) s.aperta = 'tasso';
        break;
      case 'esperti-usa': {
        // apre il modulo nella scheda e porta il fuoco sul primo campo
        const k = v as Stato['espertiInUso'][number];
        if (!s.espertiInUso.includes(k)) s.espertiInUso.push(k);
        if (k === 'conteggi') s.usaConteggi = true;
        rendi();
        pianifica();
        document.querySelector<HTMLElement>(`#${b.closest('#st-colonna') ? 'st-colonna' : 'st-avvio'} #esperti-${k} input`)?.focus();
        return;
      }
      case 'esperti-togli': {
        const k = v as Stato['espertiInUso'][number];
        s.espertiInUso = s.espertiInUso.filter((x) => x !== k);
        if (k === 'conteggi') Object.assign(s, { usaConteggi: false, accettati: '', nonAccettati: '' });
        if (k === 'device') for (const d of Object.values(s.device)) Object.assign(d, { tasso: '', quota: '' });
        if (k === 'periodi') s.periodi = s.periodi.map(() => ({ dal: '', tasso: '' }));
        break;
      }
      case 'chiudi-esperti':
        s.esperti = false;
        break;
      case 'vedi-stima':
        if (!completo(s)) return;
        s.fase = 'banco';
        primoRisultato = true;
        window.scrollTo(0, 0);
        break;
      case 'conferma':
        s.statoIpotesi[v as ChiaveIpotesi] = 'conf';
        if (s.origine === 'link' && IPOTESI.every((k) => s.statoIpotesi[k] !== 'mod')) s.origine = 'utente';
        aggiornaSchedaIpotesi(v as ChiaveIpotesi);
        salvaMemoria();
        return;
      case 'predefinito':
        s.valori[v as ChiaveIpotesi] = null;
        s.statoIpotesi[v as ChiaveIpotesi] = 'pred';
        break;
      case 'ordini-on':
        s.ordiniAttivi = true;
        break;
      case 'ordini-off':
        Object.assign(s, { ordiniAttivi: false, ordini: '', entrate: '', ordiniDal: '', ordiniAl: '' });
        break;
      case 'utenti-modifica':
      case 'utenti-inserisci': {
        // si passa al valore scritto a mano; partendo dal valore dell'export lo si propone già nella casella
        const daExport = utentiEffettivi(s).export;
        if (s.utenti !== 'utente' && !s.utentiPeriodo && daExport) s.utentiPeriodo = String(daExport);
        Object.assign(s, { utenti: 'utente', utentiModifica: true });
        rendi();
        pianifica();
        document.getElementById('c-utentiPeriodo')?.focus();
        return;
      }
      case 'utenti-fatto':
        s.utentiModifica = false;
        if (!utentiEffettivi(s).valore) Object.assign(s, { utenti: 'auto', utentiPeriodo: '' });
        break;
      case 'utenti-togli':
        Object.assign(s, { utenti: 'auto', utentiPeriodo: '', utentiModifica: false });
        break;
      case 'utenti-no':
        Object.assign(s, { utenti: 'no', utentiModifica: false });
        break;
      case 'utenti-auto':
        Object.assign(s, { utenti: 'auto', utentiPeriodo: '', utentiModifica: false });
        break;
      case 'ripristina':
        s.valori = { rFreq: null, rConv: null, rAov: null };
        s.statoIpotesi = { rFreq: 'pred', rConv: 'pred', rAov: 'pred' };
        s.sicurezza = { rFreq: '1', rConv: '1', rAov: '1' };
        break;
      case 'copia-link':
        void copiaLink();
        return;
      case 'tabella':
        s.tabelle[v as 'canali' | 'giorni'] = !s.tabelle[v as 'canali' | 'giorni'];
        rendiRis();
        return;
      case 'csv':
        if (c.ris) scarica(t('esporta.nomeFile'), csvRisultati(c));
        return;
      case 'stampa':
        window.print();
        return;
      case 'vai-ipotesi': {
        // porta alla scheda dell'ipotesi nella colonna di sinistra (su mobile, alla scheda «Ipotesi») e la mette a fuoco
        if (window.matchMedia('(max-width: 860px)').matches && s.vista !== 'ipotesi') {
          s.vista = 'ipotesi';
          rendiSchedeMobile();
        }
        if (v === 'tasso' && s.aperta !== 'tasso') {
          s.aperta = 'tasso';
          rendiCol();
        }
        const scheda = elColonna.querySelector<HTMLElement>(`[data-ip="${v}"]`);
        if (scheda) {
          scheda.tabIndex = -1;
          const ridotto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          scheda.scrollIntoView({ block: 'center', behavior: ridotto ? 'auto' : 'smooth' });
          scheda.focus({ preventScroll: true });
          scheda.classList.add('richiamata');
          window.setTimeout(() => scheda.classList.remove('richiamata'), 1800);
        }
        return;
      }
      case 'vista':
        s.vista = v as Stato['vista'];
        rendiSchedeMobile();
        if (s.vista === 'risultati') disegnaGrafici(c, elRisultati);
        window.scrollTo(0, 0);
        return;
      case 'tour-avanti':
      case 'tour-indietro':
        s.tour += b.dataset.a === 'tour-avanti' ? 1 : -1;
        rendiRis();
        document.getElementById('tappa-tour')?.focus();
        return;
      case 'tour-esci':
        s.tour = 0;
        rendiRis();
        document.getElementById('dato-principale')?.focus();
        return;
      case 'scegli-pubblico':
        // dal blocco «Cosa può spiegarlo»: solo per le risposte con cui i conti tornerebbero
        if (v in ALTRE_PERDITE_PUBBLICO) s.pubblico = v as Pubblico;
        break;
      case 'tour-ordini':
        if (c.esempio) Object.assign(s, { ordiniAttivi: true, ordini: String(c.esempio.ordini), entrate: String(c.esempio.entrate), pubblico: 'misto' });
        break;
      default:
        return;
    }
    rendi();
    pianifica();
    // dopo un'azione sulla scheda «Utenti del periodo» il fuoco torna sulla scheda (i pulsanti cambiano)
    if (b.dataset.a?.startsWith('utenti-')) {
      const sch = elColonna.querySelector<HTMLElement>('[data-ip="utenti"]');
      if (sch) {
        sch.tabIndex = -1;
        sch.focus({ preventScroll: true });
      }
    }
  });

  // trascinamento del file
  radice.addEventListener('dragover', (ev) => {
    const z = (ev.target as HTMLElement).closest('.rilascio');
    if (!z) return;
    ev.preventDefault();
    z.classList.add('sopra');
  });
  radice.addEventListener('dragleave', (ev) => (ev.target as HTMLElement).closest('.rilascio')?.classList.remove('sopra'));
  radice.addEventListener('drop', async (ev) => {
    const z = (ev.target as HTMLElement).closest('.rilascio');
    if (!z) return;
    ev.preventDefault();
    z.classList.remove('sopra');
    const f = ev.dataTransfer?.files?.[0];
    if (f) nuovoFile(await leggiFile(f), f.name);
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && s.tour) {
      s.tour = 0;
      rendiRis();
    }
  });

  // i grafici seguono la larghezza disponibile
  let larghezza = window.innerWidth;
  window.addEventListener('resize', () => {
    if (Math.abs(window.innerWidth - larghezza) < 40) return;
    larghezza = window.innerWidth;
    if (s.fase === 'banco') disegnaGrafici(c, elRisultati);
  });
  // chi ha caricato un proprio file viene avvisato prima di perderlo
  window.addEventListener('beforeunload', (ev) => {
    if (s.file && s.origine !== 'esempio') ev.preventDefault();
  });
  // i collegamenti della testata si aprono in una nuova scheda quando c'è un file caricato
  document.addEventListener('click', (ev) => {
    const a = (ev.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
    if (!a || radice.contains(a) || !s.file || s.origine === 'esempio' || a.target) return;
    a.target = '_blank';
    a.rel = 'noopener';
  });

  // «Guarda un esempio» può arrivare anche a pagina già aperta
  window.addEventListener('hashchange', () => {
    if (location.hash === '#tour') caricaEsempio();
  });

  leggiAvvio();
  if (!s.file) rendi();
}
