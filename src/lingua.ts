// Il cambio di lingua porta alla stessa pagina e conserva il frammento # (ancore e link con le ipotesi).
document.getElementById('cambia-lingua')?.addEventListener('click', (ev) => {
  const a = ev.currentTarget as HTMLAnchorElement;
  if (location.hash) a.href = a.href.split('#')[0] + location.hash;
});

// Su schermi stretti la navigazione scorre in orizzontale: una sfumatura a destra lo segnala e sparisce in fondo.
const nav = document.querySelector<HTMLElement>('.testata nav');
if (nav) {
  const aggiorna = (): void => void nav.classList.toggle('alla-fine', nav.scrollLeft + nav.clientWidth >= nav.scrollWidth - 4);
  nav.addEventListener('scroll', aggiorna, { passive: true });
  window.addEventListener('resize', aggiorna);
  aggiorna();
}
