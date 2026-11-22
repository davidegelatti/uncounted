// Menu della testata su schermi stretti: il pulsante «Menu» apre le voci a tutta larghezza sotto la testata.
// Senza JavaScript il pulsante resta nascosto e le voci restano in una striscia che scorre.
const testata = document.querySelector<HTMLElement>('.testata');
const btn = document.getElementById('apri-menu') as HTMLButtonElement | null;
const nav = document.getElementById('menu-principale');
if (testata && btn && nav) {
  const stretto = window.matchMedia('(max-width: 860px)');
  const apri = (si: boolean): void => {
    testata.classList.toggle('menu-aperto', si);
    btn.setAttribute('aria-expanded', String(si));
  };
  btn.addEventListener('click', () => {
    const si = btn.getAttribute('aria-expanded') !== 'true';
    apri(si);
    if (si) nav.querySelector<HTMLElement>('a')?.focus();
  });
  // Esc chiude e riporta il fuoco sul pulsante
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape' || btn.getAttribute('aria-expanded') !== 'true') return;
    apri(false);
    btn.focus();
  });
  // clic fuori dalla testata: chiude
  document.addEventListener('click', (ev) => {
    if (btn.getAttribute('aria-expanded') === 'true' && !testata.contains(ev.target as Node)) apri(false);
  });
  // il fuoco esce dalla testata (per esempio con Tab dopo l'ultima voce): chiude
  testata.addEventListener('focusout', (ev) => {
    if (btn.getAttribute('aria-expanded') === 'true' && !testata.contains(ev.relatedTarget as Node | null) && ev.relatedTarget) apri(false);
  });
  // tornando a una finestra larga il menu non serve più
  stretto.addEventListener('change', () => apri(false));
  testata.classList.add('con-menu');
  btn.hidden = false;
}

export {};
