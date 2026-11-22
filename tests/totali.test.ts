// Riga dei totali dell'export GA4: utenti del periodo e controllo di coerenza. Fixture sintetica, mai dati veri.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { leggiCsv } from '../src/parser';
import { scartiDaiTotali, utentiDaTotali } from '../src/strumento/totali';

const testo = readFileSync('tests/fixture/export-ga4-formato-reale.csv', 'utf8');
const leggi = (t: string) => {
  const r = leggiCsv(t);
  return { dati: r.dati!, info: r.info! };
};

describe('riga dei totali', () => {
  it('file coerente: nessuno scarto, si propongono gli utenti deduplicati della riga dei totali', () => {
    const f = leggi(testo);
    expect(scartiDaiTotali(f.dati, f.info.totali)).toEqual([]);
    expect(utentiDaTotali(f)).toBe(763);
  });

  it('senza riga dei totali: comportamento di prima, nessuna proposta', () => {
    const f = leggi(testo.split('\n').filter((l) => !l.startsWith(',,')).join('\n'));
    expect(f.info.totali).toBeUndefined();
    expect(utentiDaTotali(f)).toBeUndefined();
  });

  it('file filtrato (righe tolte a mano): segnala lo scarto e non propone gli utenti', () => {
    const f = leggi(testo.split('\n').filter((l) => !l.includes('Paid Social')).join('\n'));
    const scarti = scartiDaiTotali(f.dati, f.info.totali);
    expect(scarti.map((x) => x.grandezza)).toEqual(['sessioni', 'eventi', 'transazioni', 'entrate']);
    expect(scarti[0]).toEqual({ grandezza: 'sessioni', righe: 568, totale: 909 });
    expect(utentiDaTotali(f)).toBeUndefined();
  });

  it('piccole differenze, normali in GA4, non vengono segnalate', () => {
    const f = leggi(testo.replace(',,909,763,601,40,5991.6,', ',,915,763,605,41,5992.4,'));
    expect(scartiDaiTotali(f.dati, f.info.totali)).toEqual([]);
  });
});

describe('dati di esempio nel formato reale dell’export GA4', () => {
  for (const lingua of ['it', 'en'] as const) {
    it(`${lingua}: struttura identica all’export reale e riga dei totali coerente`, async () => {
      const { traduttore } = await import('../src/i18n/indice');
      const { esempioCsv } = await import('../src/strumento/esempio');
      const t = traduttore(lingua);
      const { testo } = esempioCsv(t, lingua);
      const righe = testo.split('\n');
      expect(righe.slice(0, 6)).toEqual(['# ----------------------------------------', `# ${t('csvEsempio.titolo')}`, `# ${t('csvEsempio.esplorazione')}`, expect.stringMatching(/^# \d{8}-\d{8}$/), '# ----------------------------------------', '']);
      expect(righe[6]).toBe(t('csvEsempio.intestazioni'));
      expect(righe[7]).toMatch(new RegExp(`^,,\\d+,\\d+,\\d+,\\d+,\\d+(\\.\\d{1,2})?,${t('csvEsempio.totale')}$`));
      expect(testo).not.toContain('"'); // nessuna virgoletta
      expect(righe.slice(8).filter(Boolean).every((l) => /^\d{8},[^,]+,\d+,\d+,\d+,\d+,\d+(\.\d{1,2})?$/.test(l))).toBe(true); // punto decimale, niente migliaia
      const f = leggi(testo);
      expect(f.info.colonne.utenti).toBe(t('csvEsempio.intestazioni').split(',')[3]);
      expect(scartiDaiTotali(f.dati, f.info.totali)).toEqual([]);
      expect(utentiDaTotali(f)).toBe(Number(righe[7].split(',')[3]));
      expect(f.info.canali).toEqual(expect.arrayContaining(['Organic Shopping', 'Unassigned']));
      expect(f.dati.righe.every((r) => r.sessioni > 0)).toBe(true); // righe assenti nei giorni senza traffico
    });
  }
});
