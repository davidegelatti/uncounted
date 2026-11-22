// Interruttore del tema nella testata: Sistema → Chiaro → Scuro. Salva solo la preferenza del tema.
// Il tema è applicato prima del rendering da public/tema.js; qui si gestisce solo il cambio.
type Tema = 'sistema' | 'chiaro' | 'scuro';
const CHIAVE = 'uncounted-tema';
const ORDINE: Tema[] = ['sistema', 'chiaro', 'scuro'];

const btn = document.getElementById('cambia-tema') as HTMLButtonElement | null;
if (btn) {
  const nomi = JSON.parse(btn.dataset.nomi ?? '{}') as Record<Tema, string>;
  const modello = btn.dataset.etichetta ?? '{v}';
  const annuncio = document.getElementById('annuncio-tema');
  const testo = btn.querySelector<HTMLElement>('.tema-testo');
  const attuale = (): Tema => {
    const v = document.documentElement.getAttribute('data-tema');
    return v === 'chiaro' || v === 'scuro' ? v : 'sistema';
  };
  const mostra = (t: Tema): void => {
    btn.dataset.stato = t;
    if (testo) testo.textContent = nomi[t];
    btn.setAttribute('aria-label', modello.replace('{v}', nomi[t]));
  };
  btn.addEventListener('click', () => {
    const t = ORDINE[(ORDINE.indexOf(attuale()) + 1) % ORDINE.length];
    if (t === 'sistema') document.documentElement.removeAttribute('data-tema');
    else document.documentElement.setAttribute('data-tema', t);
    try {
      if (t === 'sistema') localStorage.removeItem(CHIAVE);
      else localStorage.setItem(CHIAVE, t);
    } catch {
      /* archivio non disponibile: il tema vale solo per questa pagina */
    }
    mostra(t);
    if (annuncio) annuncio.textContent = modello.replace('{v}', nomi[t]);
  });
  mostra(attuale());
  btn.hidden = false;
}
