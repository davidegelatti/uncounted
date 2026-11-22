import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { leggiCsv, leggiNumero } from '../src/parser';
import { Rng } from '../src/motore/rng';
import { genera, scenarioBase, versoCsvGa4 } from '../src/motore/sintetico';

const IT = `# ----------------------------------------
# Account: Demo
# Formato libero 1
# 20260301-20260302
# ----------------------------------------

Data,Gruppo di canali predefinito della sessione,Sessioni,Utenti totali,Eventi chiave,Transazioni,Entrate totali
,Totale generale,"3.700","3.100",120,30,"2.345,60"
20260301,Organic Search,"1.200","1.000",40,10,"800,50"
20260301,Direct,500,400,20,5,"345,10"
20260302,Organic Search,"1.500","1.300",50,12,"1.000,00"
20260302,(not set),500,400,10,3,"200,00"
`;

describe('parser: export italiano', () => {
  const r = leggiCsv(IT);
  it('legge il file saltando commenti e riga di totale', () => {
    expect(r.ok).toBe(true);
    expect(r.info!.righeLette).toBe(4);
    expect(r.info!.righeTotaleScartate).toBe(1);
    expect(r.info!.stileNumeri).toBe('it');
  });
  it('converte date AAAAMMGG e numeri italiani', () => {
    const prima = r.dati!.righe.find((x) => x.data === '2026-03-01' && x.canale === 'Organic Search')!;
    expect(prima.sessioni).toBe(1200);
    expect(prima.utenti).toBe(1000);
    expect(prima.entrate).toBeCloseTo(800.5, 6);
    const terza = r.dati!.righe.find((x) => x.data === '2026-03-02' && x.canale === 'Organic Search')!;
    expect(terza.entrate).toBe(1000);
  });
  it('tiene (not set) come canale e lo segnala', () => {
    expect(r.info!.canali).toContain('(not set)');
    expect(r.avvisi.map((a) => a.codice)).toContain('canale_not_set');
  });
});

describe('parser: varianti', () => {
  it('intestazioni inglesi, numeri inglesi, BOM e CRLF', () => {
    const en =
      '﻿# comment\r\nDate,Session default channel group,Sessions,Total users,Key events,Transactions,Total revenue\r\n20260301,Paid Search,"1,200",1000,40,10,1234.56\r\n20260302,Paid Search,900,800,30,8,"2,100.5"\r\nGrand total,,2100,1800,70,18,3335.06\r\n';
    const r = leggiCsv(en);
    expect(r.ok).toBe(true);
    expect(r.info!.stileNumeri).toBe('en');
    expect(r.dati!.righe).toHaveLength(2);
    expect(r.dati!.righe[0].sessioni).toBe(1200);
    expect(r.dati!.righe[0].entrate).toBeCloseTo(1234.56, 6);
    expect(r.dati!.righe[1].entrate).toBeCloseTo(2100.5, 6);
    expect(r.info!.righeTotaleScartate).toBe(1);
  });

  it('separatore punto e virgola, valori vuoti e simbolo di valuta', () => {
    const csv = 'Data;Gruppo di canali predefinito della sessione;Sessioni;Utenti totali;Eventi chiave;Transazioni;Entrate totali\n20260301;Email;100;90;;;\n20260302;Email;120;100;3;1;€ 1.250,00\n';
    const r = leggiCsv(csv);
    expect(r.ok).toBe(true);
    expect(r.info!.separatore).toBe(';');
    expect(r.dati!.righe[0].eventi).toBe(0);
    expect(r.dati!.righe[0].entrate).toBe(0);
    expect(r.dati!.righe[1].entrate).toBe(1250);
  });

  it('funziona senza colonne ecommerce e lo dice', () => {
    const r = leggiCsv('Data,Gruppo di canali predefinito della sessione,Sessioni,Eventi chiave\n20260301,Direct,100,5\n');
    expect(r.ok).toBe(true);
    expect(r.dati!.haTransazioni).toBe(false);
    expect(r.dati!.haEntrate).toBe(false);
    expect(r.dati!.haEventi).toBe(true);
    expect(r.avvisi.find((a) => a.codice === 'colonne_mancanti')!.parametri.campi).toMatch(/transazioni/);
  });

  it('più colonne di eventi chiave: scelta dell’utente', () => {
    const csv = 'Data,Gruppo di canali predefinito della sessione,Sessioni,Eventi chiave,Eventi chiave:purchase,Eventi chiave:generate_lead\n20260301,Direct,100,9,4,5\n';
    const a = leggiCsv(csv);
    expect(a.info!.colonneEventi).toEqual(['Eventi chiave', 'Eventi chiave:purchase', 'Eventi chiave:generate_lead']);
    expect(a.dati!.righe[0].eventi).toBe(9);
    const b = leggiCsv(csv, { colonnaEventi: 'Eventi chiave:generate_lead' });
    expect(b.dati!.righe[0].eventi).toBe(5);
  });

  it('somma le righe duplicate e avvisa', () => {
    const r = leggiCsv('Data,Gruppo di canali predefinito della sessione,Sessioni\n20260301,Direct,100\n20260301,Direct,50\n');
    expect(r.dati!.righe).toHaveLength(1);
    expect(r.dati!.righe[0].sessioni).toBe(150);
    expect(r.avvisi.map((a) => a.codice)).toContain('duplicati');
  });

  it('campi tra virgolette con virgole e a capo', () => {
    const r = leggiCsv('Data,Gruppo di canali predefinito della sessione,Sessioni\n20260301,"Canale, con virgola",10\n');
    expect(r.dati!.righe[0].canale).toBe('Canale, con virgola');
  });

  it('rilegge il CSV di esempio generato dallo strumento', () => {
    const e = genera({ ...scenarioBase(), sessioniAttese: 6000 }, new Rng(5));
    const r = leggiCsv(versoCsvGa4(e.dati));
    expect(r.ok).toBe(true);
    expect(r.dati!.righe).toHaveLength(e.dati.righe.length);
    const s = (x: { sessioni: number }[]): number => x.reduce((a, b) => a + b.sessioni, 0);
    expect(s(r.dati!.righe)).toBe(s(e.dati.righe));
    const en = (x: { entrate: number }[]): number => x.reduce((a, b) => a + b.entrate, 0);
    expect(en(r.dati!.righe)).toBeCloseTo(en(e.dati.righe), 2);
  });
});

describe('parser: errori spiegati', () => {
  it('colonna mancante: dice quale e cosa ha trovato', () => {
    const r = leggiCsv('Data,Sorgente,Sessioni\n20260301,google,10\n');
    expect(r.ok).toBe(false);
    expect(r.errori[0].codice).toBe('colonna_mancante');
    expect(r.errori[0].parametri.campo).toBe('canale');
    expect(r.errori[0].parametri.trovate).toMatch(/«Sorgente»/);
  });
  it('data non valida: indica la riga', () => {
    const r = leggiCsv('Data,Gruppo di canali predefinito della sessione,Sessioni\n20260301,Direct,10\n2026-W10,Direct,10\n20261340,Direct,5\n');
    expect(r.ok).toBe(false);
    expect(r.errori.map((e) => e.riga)).toEqual([3, 4]);
    expect(r.errori[0].codice).toBe('data_non_valida');
    expect(r.errori[0].parametri.valore).toBe('2026-W10');
  });
  it('numero non valido: indica riga e colonna', () => {
    const r = leggiCsv('# x\nData,Gruppo di canali predefinito della sessione,Sessioni,Transazioni\n20260301,Direct,abc,2\n');
    expect(r.ok).toBe(false);
    expect(r.errori[0].riga).toBe(3);
    expect(r.errori[0].colonna).toBe('Sessioni');
  });
  it('file vuoto, solo commenti, solo intestazioni', () => {
    expect(leggiCsv('  ').ok).toBe(false);
    expect(leggiCsv('# a\n# b\n').ok).toBe(false);
    expect(leggiCsv('Data,Gruppo di canali predefinito della sessione,Sessioni\n').ok).toBe(false);
  });
  it('limita il numero di errori elencati', () => {
    const righe = Array.from({ length: 40 }, () => 'xx,Direct,10').join('\n');
    const r = leggiCsv('Data,Gruppo di canali predefinito della sessione,Sessioni\n' + righe);
    expect(r.errori.length).toBeLessThanOrEqual(16);
    expect(r.errori[r.errori.length - 1]).toMatchObject({ codice: 'altri_errori', parametri: { n: 25 } });
  });
});

describe('leggiNumero', () => {
  const casi: [string, 'it' | 'en' | 'ignoto', number][] = [
    ['1.234,56', 'ignoto', 1234.56],
    ['1,234.56', 'ignoto', 1234.56],
    ['1.234', 'it', 1234],
    ['1.234', 'en', 1.234],
    ['1,5', 'it', 1.5],
    ['12.50', 'it', 12.5],
    ['1.234.567', 'ignoto', 1234567],
    ['€ 99,90', 'it', 99.9],
    ['1 234,5', 'it', 1234.5],
    ['', 'it', 0],
    ['(not set)', 'it', 0],
    ['0', 'ignoto', 0],
  ];
  for (const [s, stile, atteso] of casi) {
    it(`«${s}» (${stile}) → ${atteso}`, () => expect(leggiNumero(s, stile).valore).toBeCloseTo(atteso, 6));
  }
  it('rifiuta testo', () => expect(leggiNumero('abc').valore).toBeNaN());
  it('segnala i casi ambigui', () => expect(leggiNumero('1.234', 'ignoto').ambiguo).toBe(true));
});

// Formato reale dell'export GA4 (interfaccia in italiano), con una fixture SINTETICA: numeri inventati, mai dati veri.
describe('parser: formato reale dell’export GA4', () => {
  const testo = readFileSync('tests/fixture/export-ga4-formato-reale.csv', 'utf8');
  const r = leggiCsv(testo);

  it('riconosce tutte le colonne, compreso «Totale utenti»', () => {
    expect(r.ok).toBe(true);
    expect(r.info!.colonne).toEqual({
      data: 'Data',
      canale: 'Gruppo di canali predefinito della sessione',
      sessioni: 'Sessioni',
      utenti: 'Totale utenti',
      eventi: 'Eventi chiave',
      transazioni: 'Transazioni',
      entrate: 'Entrate totali',
    });
    expect(r.avvisi.map((a) => a.codice)).not.toContain('colonne_mancanti');
  });

  it('la riga dei totali (data e canale vuoti, etichetta in una colonna in più) non viene mai sommata ai dati', () => {
    const somma = (k: 'sessioni' | 'utenti' | 'eventi' | 'transazioni' | 'entrate'): number => r.dati!.righe.reduce((s, x) => s + x[k], 0);
    expect(r.info!.righeTotaleScartate).toBe(1);
    expect(r.dati!.righe).toHaveLength(12);
    expect(somma('sessioni')).toBe(909);
    expect(somma('utenti')).toBe(814);
    expect(somma('transazioni')).toBe(40);
    expect(somma('entrate')).toBeCloseTo(5991.6, 6);
    expect(r.dati!.righe.some((x) => x.canale === '' || x.canale === '(not set)')).toBe(false);
  });

  it('legge i valori della riga dei totali, con gli utenti già deduplicati da GA4', () => {
    expect(r.info!.totali).toEqual({ sessioni: 909, utenti: 763, eventi: 601, transazioni: 40, entrate: 5991.6 });
  });

  it('numeri con il punto decimale e senza separatore delle migliaia: nessuna ambiguità', () => {
    expect(r.info!.stileNumeri).toBe('en');
    expect(r.avvisi.map((a) => a.codice)).not.toContain('ambigui');
    expect(r.avvisi.map((a) => a.codice)).not.toContain('numeri_misti');
    expect(leggiNumero('1.5', 'en')).toEqual({ valore: 1.5, ambiguo: false });
    expect(leggiNumero('41', 'en')).toEqual({ valore: 41, ambiguo: false });
    expect(leggiNumero('2177.6', 'en')).toEqual({ valore: 2177.6, ambiguo: false });
    expect(leggiNumero('90168.8', 'en')).toEqual({ valore: 90168.8, ambiguo: false });
    expect(leggiNumero('0', 'en')).toEqual({ valore: 0, ambiguo: false });
  });

  it('canali aggiuntivi di GA4 (Organic Shopping, Paid Other, AI Assistant, Unassigned) e righe mancanti', () => {
    expect(r.info!.canali).toEqual(expect.arrayContaining(['Organic Shopping', 'Paid Other', 'AI Assistant', 'Unassigned']));
    expect(r.info!.dal).toBe('2026-10-18');
    expect(r.info!.al).toBe('2026-10-20');
  });

  it('la riga dei totali può stare anche in fondo, e senza etichetta', () => {
    const righe = testo.split('\n');
    const i = righe.findIndex((l) => l.startsWith(',,'));
    const totale = righe.splice(i, 1)[0].replace(/,Totale complessivo$/, '');
    const r2 = leggiCsv([...righe.filter((l) => l !== ''), totale].join('\n') + '\n');
    expect(r2.ok).toBe(true);
    expect(r2.dati!.righe).toHaveLength(12);
    expect(r2.info!.totali?.sessioni).toBe(909);
  });
});
