# Risultati della validazione

Generato da `npm run validazione` — 500 repliche per scenario, 1000 simulazioni per stima.
Ogni cella riporta la **copertura degli intervalli 80% / 95%**: la percentuale di repliche in cui il
valore vero (noto, perché i dati sono sintetici) cade dentro l'intervallo. Con 500 repliche il margine
d'errore è circa ±4 punti sull'80% e ±2 sul 95%.

## A — Calibrazione: i parametri veri seguono le ipotesi (la copertura deve tornare)

| # | Scenario | Sessioni | Utenti-giorno | Eventi chiave | Transazioni | Entrate | Utenti periodo | Canali: sessioni | Canali: transazioni |
|---|---|---|---|---|---|---|---|---|---|
| A1 | Base: 50.000 sessioni, consenso 60% ("è una stima") | 79% / 95% | 80% / 96% | 79% / 94% | 81% / 96% | 81% / 95% | 89% / 98% | 79% / 95% | 86% / 97% |
| A2 | Canali minuscoli: 8.000 sessioni, canali con 0–5 conversioni | 78% / 95% | 79% / 97% | 80% / 95% | 82% / 97% | 79% / 96% | 90% / 98% | 77% / 93% | 90% / 98% |
| A3 | Sito piccolo: 2.000 sessioni | 76% / 95% | 79% / 96% | 81% / 94% | 81% / 97% | 75% / 93% | 88% / 98% | 73% / 91% | 93% / 98% |
| A4 | Consenso molto basso: 20% ("è una stima") | 78% / 95% | 79% / 96% | 79% / 95% | 80% / 94% | 79% / 94% | 85% / 97% | 78% / 94% | 83% / 96% |
| A5 | Consenso molto alto: 92% ("lo conosco con precisione") | 80% / 95% | 80% / 96% | 79% / 95% | 81% / 96% | 81% / 95% | 90% / 99% | 77% / 94% | 91% / 98% |
| A6 | Base con ordini reali (pubblico «misto / non lo so») | 77% / 95% | 79% / 95% | 78% / 93% | 79% / 95% | 80% / 94% | 89% / 98% | 78% / 95% | 83% / 96% |

## B — Robustezza: ipotesi violate (si misura il danno)

| # | Scenario | Sessioni | Utenti-giorno | Eventi chiave | Transazioni | Entrate | Utenti periodo | Canali: sessioni | Canali: transazioni |
|---|---|---|---|---|---|---|---|---|---|
| B6 | r_conv vero = 1,0 (ipotesi: 0,4) | 78% / 95% | 80% / 96% | 54% / 89% | 41% / 79% | 44% / 82% | 89% / 99% | 79% / 95% | 60% / 85% |
| B7 | r_conv vero = 0,15 (ipotesi: 0,4) | 79% / 95% | 80% / 96% | 44% / 88% | 34% / 72% | 35% / 74% | 89% / 99% | 79% / 95% | 68% / 90% |
| B8a | r_conv vero = 1,0 CON ordini reali | 78% / 95% | 80% / 96% | 100% / 100% | 100% / 100% | 100% / 100% | 89% / 99% | 79% / 94% | 87% / 98% |
| B8b | r_conv vero = 0,15 CON ordini reali | 79% / 95% | 80% / 96% | 100% / 100% | 100% / 100% | 100% / 100% | 89% / 99% | 79% / 95% | 96% / 100% |
| B9 | Consenso molto diverso tra canali (circa 30%–85%) | 79% / 94% | 81% / 96% | 77% / 94% | 76% / 94% | 72% / 91% | 100% / 100% | 30% / 44% | 67% / 86% |
| B10a | Tasso CMP per banner mostrato, dichiarato come "per utente" | 57% / 96% | 61% / 97% | 75% / 93% | 71% / 93% | 72% / 93% | 24% / 62% | 71% / 93% | 82% / 96% |
| B10b | Tasso CMP per banner mostrato, dichiarato correttamente | 99% / 100% | 100% / 100% | 85% / 97% | 89% / 98% | 88% / 98% | 98% / 100% | 95% / 100% | 90% / 99% |
| B11a | Tasso che esclude chi ignora il banner, dichiarato come completo | 58% / 83% | 57% / 84% | 77% / 93% | 74% / 92% | 75% / 92% | 0% / 100% | 64% / 87% | 80% / 94% |
| B11b | Tasso che esclude chi ignora il banner, dichiarato tale (quota ignota) | 94% / 99% | 95% / 99% | 84% / 97% | 88% / 97% | 86% / 97% | 100% / 100% | 90% / 99% | 89% / 98% |
| B12a | Cambio di banner a metà periodo (60% → 35%), dichiarato | 89% / 98% | 92% / 99% | 82% / 96% | 85% / 96% | 83% / 96% | 100% / 100% | 85% / 97% | 87% / 97% |
| B12b | Cambio di banner a metà periodo, NON dichiarato (tasso medio) | 87% / 98% | 91% / 99% | 82% / 96% | 85% / 96% | 83% / 96% | 100% / 100% | 85% / 98% | 87% / 97% |
| B13 | Ordini reali, altre perdite vere 20%, pubblico dichiarato «misto / non lo so» | 79% / 95% | 80% / 96% | 49% / 96% | 66% / 100% | 62% / 100% | 89% / 98% | 79% / 95% | 81% / 99% |
| B13b | Ordini reali, altre perdite vere 20%, pubblico dichiarato «largo consumo» (sbagliato) | 79% / 95% | 80% / 96% | 23% / 56% | 0% / 32% | 0% / 33% | 89% / 98% | 79% / 95% | 60% / 86% |
| B15a | Ad blocker al 12% che rifiutano di più e in parte nascondono il banner, SENZA ordini reali | 86% / 97% | 87% / 98% | 82% / 96% | 85% / 96% | 84% / 95% | 100% / 100% | 84% / 97% | 87% / 97% |
| B15b | Lo stesso, CON ordini reali (pubblico «misto / non lo so») | 85% / 97% | 87% / 98% | 91% / 99% | 100% / 100% | 100% / 100% | 100% / 100% | 84% / 97% | 90% / 98% |
| B15c | Pubblico tecnico: ad blocker al 35%, dichiarato «tecnico», CON ordini reali | 76% / 95% | 76% / 96% | 95% / 100% | 100% / 100% | 100% / 100% | 100% / 100% | 77% / 95% | 95% / 99% |
| B16a | Consenso diverso tra mobile e desktop, solo tasso globale | 76% / 94% | 80% / 96% | 78% / 94% | 80% / 95% | 80% / 94% | 92% / 99% | 80% / 95% | 87% / 97% |
| B16b | Come B16a, con i tassi per dispositivo | 80% / 96% | 81% / 96% | 80% / 95% | 80% / 95% | 80% / 94% | 87% / 97% | 81% / 96% | 87% / 97% |
| B16c | Consenso diverso, stesse visite tra dispositivi (controllo) | 79% / 95% | 81% / 96% | 79% / 95% | 81% / 95% | 81% / 95% | 92% / 99% | 80% / 95% | 86% / 97% |
| B16d | Come B16a, tasso globale dichiarato preciso | 77% / 94% | 80% / 95% | 78% / 95% | 81% / 94% | 80% / 94% | 100% / 100% | 80% / 95% | 86% / 97% |
| B14 | Eventi chiave molto sovradispersi (a grappoli di 5) | 78% / 95% | 80% / 96% | 77% / 94% | 81% / 95% | 81% / 95% | 88% / 99% | 78% / 95% | 86% / 97% |

## Errore della stima centrale

Errore relativo mediano della stima centrale sul totale; tra parentesi la semi-ampiezza relativa mediana dell'intervallo 95%.

| # | Sessioni | Eventi chiave | Transazioni | Entrate |
|---|---|---|---|---|
| A1 | +1% (±27%) | +1% (±34%) | +1% (±27%) | +1% (±28%) |
| A2 | +0% (±27%) | +1% (±34%) | +1% (±29%) | +0% (±30%) |
| A3 | +1% (±27%) | +0% (±36%) | +0% (±31%) | +1% (±34%) |
| A4 | +2% (±74%) | +3% (±121%) | +3% (±98%) | +3% (±102%) |
| A5 | +0% (±5%) | +0% (±5%) | +0% (±4%) | +0% (±5%) |
| A6 | +1% (±27%) | +2% (±23%) | +0% (±14%) | +0% (±14%) |
| B6 | +1% (±27%) | -20% (±27%) | -20% (±22%) | -20% (±23%) |
| B7 | +1% (±27%) | +12% (±38%) | +13% (±30%) | +13% (±32%) |
| B8a | +1% (±27%) | +3% (±36%) | 0% (±16%) | 0% (±16%) |
| B8b | +1% (±27%) | +0% (±12%) | +0% (±8%) | +0% (±8%) |
| B9 | +0% (±22%) | +3% (±33%) | +5% (±26%) | +6% (±28%) |
| B10a | +19% (±41%) | +10% (±52%) | +10% (±41%) | +11% (±43%) |
| B10b | +6% (±40%) | +3% (±43%) | +4% (±35%) | +4% (±37%) |
| B11a | -12% (±18%) | -6% (±23%) | -5% (±18%) | -5% (±19%) |
| B11b | +3% (±41%) | +2% (±43%) | +2% (±35%) | +3% (±37%) |
| B12a | +0% (±37%) | +0% (±52%) | +1% (±41%) | +1% (±43%) |
| B12b | +1% (±36%) | +0% (±51%) | +1% (±41%) | +1% (±43%) |
| B13 | +1% (±27%) | +17% (±37%) | +14% (±18%) | +14% (±18%) |
| B13b | +1% (±27%) | +21% (±34%) | +16% (±10%) | +16% (±10%) |
| B15a | -2% (±28%) | -1% (±36%) | -1% (±28%) | -1% (±30%) |
| B15b | -2% (±28%) | -2% (±21%) | -1% (±13%) | -1% (±13%) |
| B15c | -9% (±28%) | +0% (±32%) | +1% (±21%) | +1% (±21%) |
| B16a | +4% (±28%) | +3% (±35%) | +3% (±28%) | +3% (±29%) |
| B16b | +0% (±26%) | +1% (±31%) | +1% (±25%) | +1% (±26%) |
| B16c | +1% (±27%) | +1% (±34%) | +1% (±27%) | +0% (±29%) |
| B16d | +4% (±23%) | +2% (±33%) | +2% (±26%) | +3% (±27%) |
| B14 | +1% (±27%) | +2% (±34%) | +0% (±27%) | +0% (±29%) |
