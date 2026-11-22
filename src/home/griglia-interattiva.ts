// Sezione iniziale della home: il cursore del tasso di accettazione aggiorna griglia, confronto e descrizione.
import { esito, testi, unita } from './modello-griglia';

for (const radice of document.querySelectorAll<HTMLElement>('[data-griglia]')) {
  const cursore = radice.querySelector<HTMLInputElement>('input[type=range]')!;
  const uscita = radice.querySelector<HTMLOutputElement>('output')!;
  // una disposizione per schermi larghi e una per mobile: si aggiornano entrambe
  const figure = [...radice.querySelectorAll<SVGSVGElement>('svg')].map((svg) => [...svg.querySelectorAll<SVGCircleElement>('circle')]);
  const campi = {
    semplice: radice.querySelector<HTMLElement>('[data-campo=semplice]')!,
    stima: radice.querySelector<HTMLElement>('[data-campo=stima]')!,
    descrizione: radice.querySelector<HTMLElement>('[data-campo=descrizione]')!,
  };
  const annuncio = radice.querySelector<HTMLElement>('[data-campo=annuncio]')!;
  const modelli = { semplice: radice.dataset.semplice!, stima: radice.dataset.stima!, descrizione: radice.dataset.descrizione!, cursore: radice.dataset.cursore! };
  let timer = 0;

  const disegna = (annuncia: boolean): void => {
    const e = esito(Number(cursore.value));
    for (const celle of figure)
      celle.forEach((c, i) => {
        const u = unita(i + 1, e);
        c.setAttribute('class', u.tipo);
        if (u.peso === undefined) c.removeAttribute('fill-opacity');
        else c.setAttribute('fill-opacity', u.peso.toFixed(2));
      });
    const t = testi(e, modelli);
    uscita.textContent = `${Math.round(e.p)}%`;
    cursore.setAttribute('aria-valuetext', t.cursore);
    campi.semplice.textContent = t.semplice;
    campi.stima.textContent = t.stima;
    campi.descrizione.textContent = t.descrizione;
    if (annuncia) {
      window.clearTimeout(timer);
      // si annuncia solo quando il cursore si ferma, per non sommergere il lettore di schermo
      timer = window.setTimeout(() => (annuncio.textContent = t.descrizione), 450);
    }
  };
  cursore.addEventListener('input', () => disegna(true));
  radice.querySelector<HTMLElement>('.griglia-controllo')!.hidden = false;
  disegna(false);
}
