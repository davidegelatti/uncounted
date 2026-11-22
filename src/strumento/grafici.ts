// Grafici SVG scritti a mano. Nessun attributo style in linea (CSP): solo classi e attributi di presentazione.
import type { Metrica, Quantili, Risultato, StimaGiorno } from '../motore/modello';
import { esc } from '../i18n/indice';

const svg = (w: number, h: number, dentro: string, aria: string, extra = ''): string =>
  `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(aria)}" ${extra}>${dentro}</svg>`;
const n1 = (x: number): string => x.toFixed(1);

function passoBello(max: number, n: number): number {
  const grezzo = max / n;
  const p = Math.pow(10, Math.floor(Math.log10(grezzo)));
  const f = grezzo / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

/**
 * Barra «quota visibile»: l'intera barra è il totale stimato (100%); il confine tra visto e non visto
 * cade sulla quota centrale ed è sfumato sull'intervallo. `q` sono quote 0–1 in ordine crescente:
 * [quasi certo min, probabile min, centrale, probabile max, quasi certo max].
 */
export function barraQuota(q: number[], aria: string): string {
  const W = 600;
  const x = (v: number): string => n1(Math.max(0, Math.min(1, v)) * W);
  const larg = (a: number, b: number): string => n1(Math.max(0, Math.min(1, b) - Math.max(0, a)) * W);
  return svg(
    W,
    44,
    `<rect class="c-non" x="0" y="12" width="${W}" height="20" rx="4"/>
     <rect class="c-oss" x="0" y="12" width="${x(q[2])}" height="20" rx="4"/>
     <rect class="c-b95" x="${x(q[0])}" y="8" width="${larg(q[0], q[4])}" height="28" rx="4"/>
     <rect class="c-b80" x="${x(q[1])}" y="8" width="${larg(q[1], q[3])}" height="28" rx="4"/>
     <rect class="c-med" x="${n1(Math.max(0, Math.min(1, q[2])) * W - 1.5)}" y="4" width="3" height="36" rx="1"/>`,
    aria,
    'preserveAspectRatio="none" class="barra-larga"',
  );
}

/**
 * Barra degli ordini reali (100% = ordini reali): visti da GA4, persi per il consenso, persi per altre cause.
 * `visti` e `q` (confine tra consenso e altre cause, con il suo intervallo) sono quote 0–1.
 */
export function barraOrdini(visti: number, q: number[], aria: string): string {
  const W = 600;
  const x = (v: number): number => Math.max(0, Math.min(1, v)) * W;
  return svg(
    W,
    44,
    `<rect class="c-altre" x="0" y="12" width="${W}" height="20" rx="4"/>
     <rect class="c-med" x="0" y="12" width="${n1(x(q[2]))}" height="20" rx="4"/>
     <rect class="c-oss" x="0" y="12" width="${n1(x(visti))}" height="20" rx="4"/>
     <rect class="c-sup" x="${n1(x(visti) - 1)}" y="12" width="2" height="20"/>
     <rect class="c-b95" x="${n1(x(q[0]))}" y="8" width="${n1(x(q[4]) - x(q[0]))}" height="28" rx="4"/>
     <rect class="c-b80" x="${n1(x(q[1]))}" y="8" width="${n1(x(q[3]) - x(q[1]))}" height="28" rx="4"/>
     <rect class="c-med" x="${n1(x(q[2]) - 1.5)}" y="4" width="3" height="36" rx="1"/>`,
    aria,
    'preserveAspectRatio="none" class="barra-larga"',
  );
}

/** Barra con intervallo su una scala comune (per «prima / dopo»). */
export function barraIntervallo(oss: number, t: Quantili, min: number, max: number, aria: string): string {
  const W = 600;
  const x = (v: number): number => (W * (Math.max(min, Math.min(max, v)) - min)) / (max - min || 1);
  return svg(
    W,
    44,
    `<rect class="c-non" x="0" y="12" width="${W}" height="20" rx="4"/>
     <rect class="c-oss" x="0" y="12" width="${n1(x(oss))}" height="20" rx="4"/>
     <rect class="c-b95" x="${n1(x(t.p2_5))}" y="8" width="${n1(x(t.p97_5) - x(t.p2_5))}" height="28" rx="4"/>
     <rect class="c-b80" x="${n1(x(t.p10))}" y="8" width="${n1(x(t.p90) - x(t.p10))}" height="28" rx="4"/>
     <rect class="c-med" x="${n1(x(t.p50) - 1.5)}" y="4" width="3" height="36" rx="1"/>`,
    aria,
    'preserveAspectRatio="none" class="barra-larga"',
  );
}

/** Scomposizione dell'incertezza: barra impilata 0–100%. */
/**
 * Scala delle fonti di incertezza: un solo tono (verde petrolio, non usato per altri significati), più intenso quanto
 * più la fonte pesa. Stessi passi nella barra «Da dove viene l'incertezza», nella legenda e nei badge «pesa per…».
 */
export const passoIncertezza = (peso: number): 1 | 2 | 3 | 4 | 5 => (peso >= 0.5 ? 5 : peso >= 0.3 ? 4 : peso >= 0.15 ? 3 : peso >= 0.05 ? 2 : 1);

export function barraImpilata(quote: number[], aria: string): string {
  const W = 600;
  let x = 0;
  let out = '';
  quote.forEach((q, i) => {
    const w = Math.max(0, q) * W;
    if (w > 1) out += `<rect class="inc-${passoIncertezza(q)}" x="${n1(x + 1)}" y="3" width="${n1(Math.max(0, w - 2))}" height="16" rx="3"/>`;
    x += w;
  });
  return svg(W, 22, out, aria, 'preserveAspectRatio="none" class="barra-larga bassa"');
}

/** Per canale: osservato, totale stimato e intervalli, una riga per canale. */
export function graficoCanali(
  largo: number,
  canali: Risultato['canali'],
  m: Metrica,
  fmt: (x: number) => string,
  aria: string,
): string {
  const W = Math.max(300, Math.min(860, largo || 700));
  const stretto = W < 520;
  const sx = stretto ? 8 : 140;
  const dx = 84;
  const alt = stretto ? 44 : 30;
  const max = Math.max(1e-9, ...canali.map((c) => c.metriche[m].totale.p97_5)) * 1.02;
  const passo = passoBello(max, stretto ? 2 : 4);
  const x = (v: number): number => sx + ((W - sx - dx) * v) / max;
  const H = canali.length * alt + 34;
  let out = '';
  for (let v = 0; v <= max; v += passo) {
    out += `<line class="l-gr" x1="${n1(x(v))}" x2="${n1(x(v))}" y1="8" y2="${H - 24}"/><text x="${n1(x(v))}" y="${H - 8}" text-anchor="middle">${esc(fmt(v))}</text>`;
  }
  canali.forEach((c, i) => {
    const s = c.metriche[m];
    const y = 12 + i * alt + (stretto ? 14 : 0);
    const nome = c.canale.length > 22 ? c.canale.slice(0, 21) + '…' : c.canale;
    out += stretto
      ? `<text class="forte" x="${sx}" y="${y - 4}">${esc(nome)}</text>`
      : `<text class="forte" x="${sx - 10}" y="${y + 13}" text-anchor="end">${esc(nome)}</text>`;
    out += `<rect class="c-oss" x="${n1(x(0))}" y="${y + 3}" width="${n1(x(s.osservato) - x(0))}" height="12" rx="2"/>
      <rect class="c-b95" x="${n1(x(s.totale.p2_5))}" y="${y}" width="${n1(x(s.totale.p97_5) - x(s.totale.p2_5))}" height="18" rx="3"/>
      <rect class="c-b80" x="${n1(x(s.totale.p10))}" y="${y}" width="${n1(x(s.totale.p90) - x(s.totale.p10))}" height="18" rx="3"/>
      <rect class="c-med" x="${n1(x(s.totale.p50) - 1.5)}" y="${y - 2}" width="3" height="22" rx="1"/>
      <text x="${W - dx + 8}" y="${y + 13}">≈ ${esc(fmt(s.totale.p50))}</text>`;
  });
  return svg(W, H, out, aria);
}

/** «E se un'ipotesi fosse sbagliata?»: una barra per ipotesi, dal totale più basso al più alto. */
export function graficoSensibilita(
  largo: number,
  righe: { nome: string; da: string; basso: number; alto: number }[],
  centrale: number,
  fmt: (x: number) => string,
  testi: { nonCambia: string; stima: string; stimaNota: string; aria: string },
): string {
  const W = Math.max(300, Math.min(860, largo || 700));
  const stretto = W < 520;
  const sx = stretto ? 8 : 210;
  const alt = stretto ? 58 : 44;
  const tutti = righe.flatMap((r) => [r.basso, r.alto]).concat(centrale);
  const lo = Math.min(...tutti);
  const hi = Math.max(...tutti);
  const pad = (hi - lo) * 0.12 || centrale * 0.1 || 1;
  const min = lo - pad;
  const max = hi + pad;
  const x = (v: number): number => sx + ((W - sx - 16) * (v - min)) / (max - min);
  const H = righe.length * alt + 48;
  let out = `<line class="l-asse" x1="${n1(x(centrale))}" x2="${n1(x(centrale))}" y1="4" y2="${H - 40}"/>`;
  righe.forEach((r, i) => {
    const y = 10 + i * alt + (stretto ? 20 : 0);
    out += stretto
      ? `<text class="forte" x="${sx}" y="${y - 6}">${esc(r.nome)} · ${esc(r.da)}</text>`
      : `<text class="forte" x="${sx - 10}" y="${y + 9}" text-anchor="end">${esc(r.nome)}</text><text x="${sx - 10}" y="${y + 24}" text-anchor="end">${esc(r.da)}</text>`;
    const a = Math.min(r.basso, r.alto);
    const b = Math.max(r.basso, r.alto);
    if (Math.abs(b - a) / (centrale || 1) < 0.002) out += `<text x="${n1(x(centrale) + 8)}" y="${y + 14}">${esc(testi.nonCambia)}</text>`;
    else {
      out += `<rect class="c-b80" x="${n1(x(a))}" y="${y}" width="${n1(x(b) - x(a))}" height="18" rx="3"/>
        <text x="${n1(x(a))}" y="${y + 33}" text-anchor="middle">${esc(fmt(a))}</text><text x="${n1(x(b))}" y="${y + 33}" text-anchor="middle">${esc(fmt(b))}</text>`;
    }
  });
  // riferimento su due righe, centrato sulla linea ma sempre dentro il grafico (larghezza stimata dei caratteri)
  const meta = Math.max(testi.stima.length * 6.6, testi.stimaNota.length * 6.9) / 2;
  const cx = Math.min(Math.max(x(centrale), meta + 4), W - meta - 4);
  out += `<text class="forte" x="${n1(cx)}" y="${H - 22}" text-anchor="middle">${esc(testi.stima)}</text><text x="${n1(cx)}" y="${H - 6}" text-anchor="middle">${esc(testi.stimaNota)}</text>`;
  return svg(W, H, out, testi.aria);
}

/** Andamento giornaliero con bande, mirino e suggerimento (mouse, tocco, frecce). */
export function graficoGiorni(
  contenitore: HTMLElement,
  giorni: StimaGiorno[],
  m: Metrica,
  fmt: (x: number) => string,
  fmtOss: (x: number) => string,
  date: { breve(iso: string): string; lunga(iso: string): string },
  testi: { aria: string; osservato(v: string): string; stimato(v: string): string; otto: string; diciannove: string },
): void {
  const W = Math.max(300, Math.min(860, Math.round(contenitore.clientWidth) || 700));
  const stretto = W < 520;
  const H = stretto ? 230 : 280;
  const mg = { l: stretto ? 50 : 62, r: 12, t: 10, b: 28 };
  const n = giorni.length;
  const q = giorni.map((g) => g.metriche[m]);
  const max = Math.max(1e-9, ...q.map((v) => v.totale.p97_5)) * 1.05;
  const x = (i: number): number => (n === 1 ? (mg.l + W - mg.r) / 2 : mg.l + ((W - mg.l - mg.r) * i) / (n - 1));
  const y = (v: number): number => H - mg.b - ((H - mg.t - mg.b) * v) / max;
  const linea = (f: (v: (typeof q)[number]) => number): string => q.map((v, i) => `${i ? 'L' : 'M'}${n1(x(i))},${n1(y(f(v)))}`).join('');
  const banda = (lo: keyof Quantili, hi: keyof Quantili): string =>
    q.map((v, i) => `${i ? 'L' : 'M'}${n1(x(i))},${n1(y(v.totale[hi]))}`).join('') +
    q.map((_, k) => `L${n1(x(n - 1 - k))},${n1(y(q[n - 1 - k].totale[lo]))}`).join('') +
    'Z';
  let out = '';
  const passo = passoBello(max, 4);
  for (let v = 0; v <= max; v += passo) {
    out += `<line class="l-gr" x1="${mg.l}" x2="${W - mg.r}" y1="${n1(y(v))}" y2="${n1(y(v))}"/><text x="${mg.l - 8}" y="${n1(y(v) + 4)}" text-anchor="end">${esc(fmt(v))}</text>`;
  }
  const ogni = Math.max(1, Math.ceil(n / (stretto ? 4 : 7)));
  for (let i = 0; i < n; i += ogni) out += `<text x="${n1(x(i))}" y="${H - 8}" text-anchor="middle">${esc(date.breve(giorni[i].data))}</text>`;
  out += `<path class="c-b95" d="${banda('p2_5', 'p97_5')}"/><path class="c-b80" d="${banda('p10', 'p90')}"/><path class="l-oss" d="${linea((v) => v.osservato)}"/><path class="l-med" d="${linea((v) => v.totale.p50)}"/>`;
  if (n === 1) out += `<circle class="c-med" cx="${x(0)}" cy="${y(q[0].totale.p50)}" r="5"/><circle class="c-oss" cx="${x(0)}" cy="${y(q[0].osservato)}" r="5"/>`;
  out += `<line class="l-mirino" y1="${mg.t}" y2="${H - mg.b}" x1="0" x2="0" visibility="hidden"/>`;
  contenitore.innerHTML = svg(W, H, out, testi.aria, 'tabindex="0"') + '<div class="suggerimento" hidden></div>';

  const el = contenitore.querySelector('svg')!;
  const mirino = el.querySelector('.l-mirino')!;
  const sugg = contenitore.querySelector('.suggerimento') as HTMLElement;
  let corrente = -1;
  const mostra = (i: number): void => {
    corrente = Math.max(0, Math.min(n - 1, i));
    const v = q[corrente];
    mirino.setAttribute('x1', String(x(corrente)));
    mirino.setAttribute('x2', String(x(corrente)));
    mirino.setAttribute('visibility', 'visible');
    sugg.innerHTML = `<strong>${esc(date.lunga(giorni[corrente].data))}</strong>${testi.osservato(esc(fmtOss(v.osservato)))}<br>${testi.stimato(esc(fmt(v.totale.p50)))}<br>${esc(testi.otto)}: ${esc(fmt(v.totale.p10))} – ${esc(fmt(v.totale.p90))}<br>${esc(testi.diciannove)}: ${esc(fmt(v.totale.p2_5))} – ${esc(fmt(v.totale.p97_5))}`;
    sugg.hidden = false;
    const r = el.getBoundingClientRect();
    const px = (x(corrente) / W) * r.width;
    const larg = sugg.offsetWidth;
    sugg.style.transform = `translate(${Math.max(0, px + 14 + larg > r.width ? px - 14 - larg : px + 14)}px, 8px)`;
  };
  const nascondi = (): void => {
    mirino.setAttribute('visibility', 'hidden');
    sugg.hidden = true;
  };
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * W;
    mostra(n === 1 ? 0 : Math.round(((vx - mg.l) / (W - mg.l - mg.r)) * (n - 1)));
  });
  el.addEventListener('pointerleave', nascondi);
  el.addEventListener('blur', nascondi);
  el.addEventListener('focus', () => mostra(corrente < 0 ? n - 1 : corrente));
  el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') mostra(corrente - 1);
    else if (e.key === 'ArrowRight') mostra(corrente + 1);
    else if (e.key === 'Home') mostra(0);
    else if (e.key === 'End') mostra(n - 1);
    else if (e.key === 'Escape') nascondi();
    else return;
    e.preventDefault();
  });
}
