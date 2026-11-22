// «Cosa ottieni» su schermi larghi: una voce attiva alla volta, il suo pannello a destra.
// I pannelli inattivi restano nel flusso con visibility: hidden, così l'altezza non cambia e la pagina non salta.
// Su schermi stretti (o senza JavaScript) tutto resta visibile in sequenza.
const largo = window.matchMedia('(min-width: 861px)');

for (const radice of document.querySelectorAll<HTMLElement>('[data-vetrina]')) {
  const pulsanti = [...radice.querySelectorAll<HTMLButtonElement>('.voce-btn')];
  const pannelli = pulsanti.map((b) => document.getElementById(b.getAttribute('aria-controls')!)!);
  let attiva = 0;

  const aggiorna = (): void => {
    const on = largo.matches;
    radice.classList.toggle('attiva', on);
    pulsanti.forEach((b, i) => {
      const aperta = !on || i === attiva;
      b.setAttribute('aria-expanded', String(aperta));
      pannelli[i].classList.toggle('spento', !aperta);
      pannelli[i].toggleAttribute('inert', !aperta);
    });
  };
  pulsanti.forEach((b, i) =>
    b.addEventListener('click', () => {
      if (!largo.matches) return;
      attiva = i;
      aggiorna();
    }),
  );
  // frecce su e giù tra le voci, come in un elenco
  radice.addEventListener('keydown', (ev) => {
    const i = pulsanti.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0 || !largo.matches || (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp')) return;
    ev.preventDefault();
    const j = (i + (ev.key === 'ArrowDown' ? 1 : pulsanti.length - 1)) % pulsanti.length;
    pulsanti[j].focus();
    attiva = j;
    aggiorna();
  });
  largo.addEventListener('change', aggiorna);
  aggiorna();
}
