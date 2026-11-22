// Generatore di numeri casuali con seme (sfc32) e campionatori di base.
// Tutto deterministico: stesso seme → stessi risultati.

function mescola(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

const COEF_LANCZOS = [
  76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155,
  0.1208650973866179e-2, -0.5395239384953e-5,
];

/** Logaritmo della funzione gamma (approssimazione di Lanczos). */
export function lgamma(x: number): number {
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += COEF_LANCZOS[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;
  private riserva: number | null = null;

  /** `flusso` e `fase` danno sequenze indipendenti a partire dallo stesso seme. */
  constructor(seme: number, flusso = 0, fase = 0) {
    this.a = mescola((seme >>> 0) + 0x9e3779b9);
    this.b = mescola(this.a ^ Math.imul(flusso + 1, 0x27d4eb2f));
    this.c = mescola(this.b ^ Math.imul(fase + 1, 0x165667b1));
    this.d = 1;
    for (let i = 0; i < 12; i++) this.grezzo();
  }

  private grezzo(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** Uniforme in (0, 1), estremi esclusi. */
  u(): number {
    return (this.grezzo() + 0.5) / 4294967296;
  }

  normale(): number {
    if (this.riserva !== null) {
      const r = this.riserva;
      this.riserva = null;
      return r;
    }
    let x: number, y: number, s: number;
    do {
      x = 2 * this.u() - 1;
      y = 2 * this.u() - 1;
      s = x * x + y * y;
    } while (s >= 1 || s === 0);
    const f = Math.sqrt((-2 * Math.log(s)) / s);
    this.riserva = y * f;
    return x * f;
  }

  /** Gamma(forma, scala = 1), Marsaglia–Tsang. */
  gamma(forma: number): number {
    if (forma <= 0) return 0;
    if (forma < 1) return this.gamma(forma + 1) * Math.pow(this.u(), 1 / forma);
    const d = forma - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x: number, v: number;
      do {
        x = this.normale();
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const u = this.u();
      if (u < 1 - 0.0331 * x * x * x * x) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }

  poisson(mu: number): number {
    if (!(mu > 0)) return 0;
    if (mu < 10) {
      const L = Math.exp(-mu);
      let k = 0;
      let p = this.u();
      while (p > L) {
        k++;
        p *= this.u();
      }
      return k;
    }
    if (mu > 1e7) return Math.max(0, Math.round(mu + Math.sqrt(mu) * this.normale()));
    // PTRS (Hörmann 1993)
    const slam = Math.sqrt(mu);
    const loglam = Math.log(mu);
    const b = 0.931 + 2.53 * slam;
    const a = -0.059 + 0.02483 * b;
    const invalpha = 1.1239 + 1.1328 / (b - 3.4);
    const vr = 0.9277 - 3.6224 / (b - 2);
    for (;;) {
      const U = this.u() - 0.5;
      const V = this.u();
      const us = 0.5 - Math.abs(U);
      const k = Math.floor(((2 * a) / us + b) * U + mu + 0.43);
      if (us >= 0.07 && V <= vr) return k;
      if (k < 0 || (us < 0.013 && V > us)) continue;
      if (Math.log(V) + Math.log(invalpha) - Math.log(a / (us * us) + b) <= -mu + k * loglam - lgamma(k + 1)) {
        return k;
      }
    }
  }
}

export const logit = (p: number): number => Math.log(p / (1 - p));
export const logistica = (x: number): number => 1 / (1 + Math.exp(-x));
