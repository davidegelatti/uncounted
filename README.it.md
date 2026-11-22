# Uncounted

**Stima il traffico che GA4 non conta perché manca il consenso ai cookie.**

🇬🇧 [Read in English](README.md)

Sito: **https://uncounted.davidegelatti.com** (in italiano e in inglese)

Chi rifiuta o ignora il banner dei cookie non compare in Google Analytics 4. Uncounted parte da un export di
GA4 e dal tasso di accettazione del banner e stima i **totali** di sessioni, utenti, eventi chiave,
transazioni ed entrate, ognuno con una stima centrale e due intervalli («probabilmente», 8 volte su 10;
«quasi certamente», 19 volte su 20). Tutto avviene nel browser: nessun dato ne esce.

Google Analytics è un marchio di Google LLC. Uncounted è un progetto indipendente, non affiliato a Google.

## Come funziona, in breve

1. **Carichi un CSV** esportato da un’esplorazione GA4 in formato libero (Data × Gruppo di canali
   predefinito della sessione; Sessioni, Totale utenti, Eventi chiave, Transazioni, Entrate totali).
2. **Rispondi a poche domande**: come è installato il Consent Mode (se Google sta già modellando il
   traffico mancante, lo Stimatore si ferma per non contarlo due volte) e qual è il tasso di accettazione,
   come è misurato e se comprende chi ignora il banner. «Non lo so» è una risposta ammessa: allarga
   l’intervallo.
3. **Leggi la stima.** Chi non accetta non si comporta come chi accetta: ritorna meno spesso e converte
   meno. Lo Stimatore dichiara queste ipotesi, ti lascia cambiarle e ne propaga l’incertezza con un modello
   bayesiano e una simulazione Monte Carlo (4.000 ripetizioni). Se hai gli ordini reali del gestionale,
   calibrano ordini ed entrate.

**Formato di ingresso:** il CSV così come lo esporta GA4 da un’esplorazione in formato libero (righe di
commento, intestazioni, riga «Totale complessivo», punto decimale), in italiano o in inglese; la riga dei totali
serve a controllare il file e a proporre gli utenti unici del periodo. Come crearlo:
[Guida](https://uncounted.davidegelatti.com/it/guida/#create-exploration).

Il metodo è descritto per intero in [METODO.md](METODO.md) e nella pagina
[Metodo](https://uncounted.davidegelatti.com/it/metodo/) del sito.

## Privacy, e come verificarla

- Niente backend, analytics, cookie o risorse di terze parti: caratteri, icone e script sono serviti dal
  sito stesso.
- Il file è letto e calcolato nel browser, in un Web Worker. La Content Security Policy (`public/_headers`)
  contiene `connect-src 'none'`: la pagina non può aprire connessioni di rete.
- Non resta nulla sul dispositivo, a meno di attivare «Ricorda le ipotesi» (solo risposte e ipotesi, in
  `localStorage`, mai il file, gli ordini o le entrate). Scegliendo il tema chiaro o scuro si salva solo
  quella preferenza.
- Il link con le ipotesi le tiene dopo il `#`, che non viene mai inviato al server.

Come verificarlo da soli:

1. **Scheda Rete** degli strumenti per sviluppatori: dopo il caricamento della pagina, caricando un file e
   calcolando non compare nessuna nuova richiesta.
2. **Offline**: apri la pagina dello Stimatore, scollega la rete (funziona anche con «Disattiva cache») e
   carica il file. Stima, stampa e CSV funzionano.
3. **CSP**: in console, `fetch('https://example.com')` viene rifiutata.
4. **Test**: `tests/sito.test.ts` fallisce se nel sito costruito compare uno script o uno stile in linea, una
   risorsa esterna o una chiamata di rete.

## Avvio in locale

Serve Node.js 20 o successivo.

```bash
npm install
```

```bash
npm run dev
```

Apri http://localhost:4321. Lo Stimatore è in `/it/stimatore/` (`/en/estimator/` in inglese);
`/it/stimatore/#tour` carica i dati di esempio con il tour guidato.

Per provare il sito costruito con gli header di sicurezza veri:

```bash
npm run build && node scripts/servi-dist.mjs
```

Poi apri http://127.0.0.1:4188.

| Comando | Cosa fa |
|---|---|
| `npm test` | Costruisce il sito ed esegue tutti i test (circa un minuto) |
| `npm run test:veloce` | Solo i test, senza ricostruire |
| `npm run build` | Controllo dei tipi e sito statico in `dist/` |
| `node scripts/servi-dist.mjs` | Serve `dist/` con gli header di produzione (CSP compresa) |
| `npm run i18n` | Riallinea `src/i18n/en.json` alle chiavi di `it.json` |
| `npm run validazione` | Rifà la validazione e rigenera `VALIDAZIONE.md` e i dati della pagina Validazione (circa 30 minuti) |

## Test e validazione

**Test** (`tests/`, Vitest):

| File | Cosa verifica |
|---|---|
| `parser.test.ts` | Lettura del CSV, compresi i casi sporchi |
| `motore.test.ts` | Il motore di stima, con una verifica rapida di copertura |
| `regressione.test.ts` | Il motore dà **gli stessi numeri, cifra per cifra**, dell’istantanea in `tests/golden/` su 12 configurazioni |
| `esito.test.ts` | Come si combinano ordini reali e ipotesi, compresi i conflitti |
| `spiegaQuota.test.ts` | La frase che spiega la quota di sessioni corrisponde al dato principale |
| `i18n.test.ts` | Stesse chiavi e segnaposto nelle due lingue, nessun testo inglese vuoto, nessuna frase nel codice |
| `collegamento.test.ts` | Il link con le ipotesi si legge e si scrive senza perdite e non contiene mai ordini, entrate o utenti |
| `contrasto.test.ts` | Contrasto dei colori (WCAG AA) nei temi chiaro e scuro |
| `sito.test.ts` | Sul sito costruito: tutte le pagine nelle due lingue, nessuno script o stile in linea, nessuna risorsa esterna, hreflang, ancore, indirizzi, header |

**Validazione.** Il metodo è stato provato su dati sintetici: un generatore simula ogni visitatore, produce un
export come quello di GA4 e conserva la risposta giusta. Ogni scenario è ripetuto 500 volte e si misura la
copertura degli intervalli: circa 80 volte su 100 per «probabilmente» e 95 per «quasi certamente» quando le
ipotesi sono ragionevoli, e quanto costa un’ipotesi volutamente sbagliata. Risultati in
[VALIDAZIONE.md](VALIDAZIONE.md) e nella pagina [Validazione](https://uncounted.davidegelatti.com/it/validazione/)
del sito.

## Struttura del progetto

```
sito.config.json             nome del sito, autore, URL, repository, licenza, recapito
src/i18n/                    testi per lingua (it.json, en.json), indirizzi, ancore, formati di numeri e date
src/content/it|en/           contenuti delle pagine (MDX)
src/layouts/, src/components/  impaginazione, logo, schemi SVG, tabelle, vetrina della Home
src/pages/                   rotte: /it/…, /en/…, radice di scelta della lingua, 404
src/strumento/               interfaccia dello Stimatore (risposte, risultati, grafici, esportazione)
src/motore/                  motore di stima, generatore di dati sintetici, scenari di validazione
src/home/                    Home: griglia interattiva e vetrina costruita con i risultati veri dello Stimatore
src/parser.ts, src/worker.ts lettura del CSV; Web Worker per il calcolo
src/styles/, src/icone/      stili (temi chiaro e scuro) e icone Lucide
src/assets/                  caratteri e logo ospitati dal sito
public/                      _headers (CSP), favicon, immagini di anteprima social, script del tema
tests/                       test automatici; tests/golden/ è l’istantanea di regressione del motore
scripts/                     validazione, regressione, allineamento dei testi, icone, server di prova
```

Documenti del progetto: [METODO.md](METODO.md) (metodo), [VALIDAZIONE.md](VALIDAZIONE.md) (validazione),
[LICENSE.md](LICENSE.md) (licenza).

**Stack:** Astro (sito statico, pagine e lingue) e TypeScript senza framework. Nessuna libreria gira nel
browser dell’utente; i grafici sono SVG scritti a mano. Ospitato su Cloudflare Pages.

## Come è stato fatto

Uncounted è stato progettato e scritto con Claude, il modello di intelligenza artificiale di Anthropic, in
Claude Code:

- **Claude Fable 5.2** ha sviluppato il metodo statistico, il motore, la validazione e il progetto dell’interfaccia;
- **Claude Opus 5.5** ha curato il sistema visivo, i contenuti delle pagine, la traduzione inglese e la
  preparazione alla pubblicazione.

Il lavoro è andato per fasi: ognuna si chiudeva con un documento o un prototipo e la successiva partiva solo
dopo l’approvazione esplicita dell’autore, spesso con correzioni. Le decisioni che hanno dato forma al metodo
e all’interfaccia sono dell’autore: ordini reali senza ripesatura delle altre ipotesi, la domanda sul pubblico
del sito per gli ordini che GA4 perde per altre cause, nessun valore preimpostato all’insaputa dell’utente,
nessun dato fuori dal browser. Altro nella pagina
[Come è stato fatto](https://uncounted.davidegelatti.com/it/come-e-stato-fatto/) del sito.

## Autore

**Davide Gelatti**, Digital Analyst. https://davidegelatti.com

## Licenza

Copyright © 2026 Davide Gelatti. Tutti i diritti riservati.

Il codice è pubblico e consultabile perché chiunque possa leggerlo ed eseguirlo in locale, al solo scopo di
verificarne il funzionamento, il metodo e le promesse sulla privacy. Non può essere copiato, modificato,
ridistribuito, ospitato o riutilizzato in altri progetti senza autorizzazione scritta. Il testo completo è in
[LICENSE.md](LICENSE.md), insieme alle licenze di font e icone di terzi.

Per usare Uncounted c'è il sito: https://uncounted.davidegelatti.com. Per richieste:
uncounted@davidegelatti.com
