import { describe, expect, it } from 'vitest';
import { codifica, decodifica } from '../src/strumento/collegamento';
import { statoIniziale, type Stato } from '../src/strumento/stato';

const pieno = (): Stato => {
  const s = statoIniziale();
  Object.assign(s, {
    cm: 'advanced', identita: 'combinata', icona: 'no', tasso: '57,5', precisione: 'preciso', misura: 'banner', ignora: 'escluso', quotaIgnora: '12',
    esperti: true, usaConteggi: true, accettati: '12000', nonAccettati: '9000', pubblico: 'tecnico', metrica: 'transazioni', valuta: '$',
    ordiniAttivi: true, ordini: '1186', entrate: '99774', ordiniDal: '2026-09-01', ordiniAl: '2026-09-30', utenti: 'utente', utentiPeriodo: '21000',
  });
  s.device.mobile = { tasso: '50', quota: '60' };
  s.device.desktop = { tasso: '75', quota: '40' };
  s.periodi[0] = { dal: '2026-09-16', tasso: '35' };
  s.valori = { rFreq: 0.9, rConv: 0.55, rAov: null };
  s.sicurezza = { rFreq: '0.5', rConv: '1', rAov: '1.5' };
  return s;
};

describe('link con le ipotesi', () => {
  it('andata e ritorno: lo stato decodificato è quello di partenza', () => {
    const s = pieno();
    const d = decodifica(codifica(s)) as Partial<Stato>;
    for (const k of ['cm', 'identita', 'icona', 'tasso', 'precisione', 'misura', 'ignora', 'quotaIgnora', 'esperti', 'usaConteggi', 'accettati', 'nonAccettati', 'pubblico', 'metrica', 'valuta', 'device', 'periodi', 'valori', 'sicurezza'] as const) {
      expect(d[k], k).toEqual(s[k]);
    }
  });
  it('non contiene mai ordini, entrate, periodo degli ordini o utenti', () => {
    const f = codifica(pieno());
    for (const vietato of ['1186', '99774', '21000', '2026-09-01', '2026-09-30']) expect(f).not.toContain(vietato);
    const d = decodifica(f) as Record<string, unknown>;
    for (const k of ['ordini', 'entrate', 'ordiniDal', 'ordiniAl', 'utentiPeriodo', 'file']) expect(k in d).toBe(false);
  });
  it('uno stato vuoto produce solo la versione', () => expect(codifica(statoIniziale())).toBe('v=1'));
  it('ignora ciò che non è un link con ipotesi e segnala le versioni sconosciute', () => {
    expect(decodifica('')).toBeNull();
    expect(decodifica('#real-orders')).toBeNull();
    expect(decodifica('#v=99&t=60')).toBe('ignoto');
  });
  it('scarta valori non ammessi', () => {
    const d = decodifica('#v=1&cm=<script>&t=abc&ta=boh&rConv=99&c.Email=x') as Partial<Stato>;
    expect(d.cm).toBeUndefined();
    expect(d.tasso).toBeUndefined();
    expect(d.precisione).toBeUndefined();
    expect(d.valori!.rConv).toBeNull();
    expect(d.canaliIgnorati).toBe(true);
  });
  it('i tassi per canale non sono più nel link; un link vecchio che li contiene funziona, ignorandoli con un avviso', () => {
    expect(codifica(pieno())).not.toMatch(/(^|&)c\./);
    const vecchio = codifica(pieno()) + '&c.Email=80&c.Paid%20Social=40';
    const d = decodifica('#' + vecchio) as Partial<Stato>;
    expect(d.canaliIgnorati).toBe(true);
    expect(d.tasso).toBe('57,5');
    expect(d.device).toEqual(pieno().device);
    expect('canali' in d).toBe(false);
    expect((decodifica('#' + codifica(pieno())) as Partial<Stato>).canaliIgnorati).toBeUndefined();
  });
});

describe('lettura dei numeri scritti a mano', () => {
  it('migliaia italiane e inglesi, decimali, simboli', async () => {
    const { numero } = await import('../src/strumento/stato');
    expect(numero('1.186')).toBe(1186);
    expect(numero('1186')).toBe(1186);
    expect(numero('99.774,50')).toBe(99774.5);
    expect(numero('99,774.50')).toBe(99774.5);
    expect(numero('0,45')).toBe(0.45);
    expect(numero('0.45')).toBe(0.45);
    expect(numero('45,5')).toBe(45.5);
    expect(numero('€ 1.250')).toBe(1250);
  });
  it('il tasso accetta «45%» e «45 %» e chiede conferma per «0,45»', async () => {
    const { percento, forseFrazione } = await import('../src/strumento/stato');
    expect(percento('45%')).toBe(0.45);
    expect(percento('45 %')).toBe(0.45);
    expect(percento('45 %')).toBe(0.45);
    expect(percento('0,45')).toBeUndefined();
    expect(forseFrazione('0,45')).toBe(45);
    expect(forseFrazione('45')).toBeUndefined();
    expect(percento('120')).toBeUndefined();
  });
});
