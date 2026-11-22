// Mette in pausa le animazioni dello sfondo quando la sezione non è sullo schermo.
const sfondi = document.querySelectorAll<HTMLElement>('.gradiente');
if (sfondi.length && 'IntersectionObserver' in window) {
  const osserva = new IntersectionObserver((voci) => {
    for (const v of voci) v.target.classList.toggle('fermo', !v.isIntersecting);
  });
  sfondi.forEach((s) => osserva.observe(s));
}
