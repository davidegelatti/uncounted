# Metodo statistico — stimatore del traffico GA4 perso per mancato consenso

**Stato: metodo implementato e validato. Ultima revisione: definizione e valori degli «ordini persi per altre cause» (§12). La revisione non ha cambiato il motore di calcolo: lo garantisce il test di regressione.**

Questo documento descrive come lo strumento passa dai numeri che GA4 mostra (solo chi ha
dato il consenso) a una stima dei numeri totali, e quanto ci si può fidare del risultato.
È scritto per chi conosce medie, percentuali e intervalli di confidenza, non per statistici.

---

## 0. Il messaggio principale, prima di tutto

L'export di GA4 **non contiene nessuna informazione su chi ha rifiutato**. Non dice quanti
erano, né come si sono comportati. Tutto ciò che lo strumento aggiunge all'osservato viene
da tre fonti esterne ai dati:

1. il tasso di consenso che inserisce l'utente (dalla CMP);
2. alcune **ipotesi** su quanto chi rifiuta si comporta diversamente da chi accetta;
3. facoltativamente, gli ordini reali del gestionale.

Ne segue che, senza il punto 3, l'ampiezza degli intervalli **riflette quanto sono incerte
le ipotesi, non quanto sono rumorosi i dati**. Caricare più giorni di dati non restringe
l'intervallo sulle sessioni totali; migliorare la conoscenza del tasso di consenso o
inserire gli ordini reali sì. Lo strumento deve dirlo chiaramente, sempre.

---

## 1. Il modello dei dati

### 1.1 Cosa osserviamo

Per ogni giorno `t` e canale `c` l'export contiene, **solo per le sessioni con consenso**:

| Simbolo | Significato |
|---|---|
| `S` | Sessioni osservate |
| `U` | Utenti totali osservati (del giorno, in quel canale) |
| `K` | Eventi chiave osservati |
| `T` | Transazioni osservate |
| `R` | Entrate osservate |

### 1.2 Cosa manca

Le stesse grandezze per le sessioni senza consenso: `S_persi`, `U_persi`, `K_persi`,
`T_persi`, `R_persi`. Il totale è sempre `osservato + perso`. L'osservato **non viene mai
ricampionato o modificato**: è un dato; l'incertezza riguarda solo la parte persa.

### 1.3 La formula di base

Chiamiamo `p` la quota di utenti che accetta e `odds = (1 − p) / p` il rapporto
"non accettano / accettano" (con `p` = 60%, `odds` = 0,67: per ogni 3 che accettano, 2 no).

```
Sessioni perse     = S × odds × r_freq
Conversioni perse  = Sessioni perse × (tasso di conversione osservato) × r_conv
Entrate perse      = Transazioni perse × (scontrino medio osservato) × r_aov
```

I tre `r` sono i **rapporti comportamentali**: quanto vale, per chi non accetta, una certa
grandezza rispetto a chi accetta (1 = uguale, 0,5 = la metà).

| Parametro | Significato | Identificabile dai dati GA4? |
|---|---|---|
| `p` | quota di utenti che accetta | **No.** Serve la CMP |
| `r_freq` | sessioni per utente di chi non accetta ÷ di chi accetta | **No.** Ipotesi |
| `r_conv` | tasso di conversione per sessione di chi non accetta ÷ di chi accetta | **No**, salvo ancoraggio (§5) |
| `r_aov` | scontrino medio di chi non accetta ÷ di chi accetta | **No**, salvo ancoraggio (§5) |
| variazione del consenso per canale | | **No.** Ipotesi o dato della CMP |
| tasso di conversione e scontrino medio di chi accetta, per canale | | **Sì**, con rumore se i conteggi sono piccoli |

Solo l'ultima riga è stimata dai dati. Tutto il resto è ipotesi esplicita con un intervallo
plausibile. Questa tabella va riprodotta, semplificata, nella sezione "ipotesi usate".

### 1.4 Cosa lo strumento NON stima

Il traffico che GA4 perde per ragioni **diverse dal consenso**: ad blocker, browser che
bloccano Google Analytics, errori di tracciamento, redirect dei gateway di pagamento.
"Totale stimato" significa "osservato + perso per mancato consenso", non "tutto il traffico
reale del sito".

---

## 2. Chi accetta e chi rifiuta non si comportano allo stesso modo

### 2.1 Il tasso della CMP non è un tasso per sessione

Dividere le sessioni per il tasso di consenso (`S / p`) è corretto solo se chi accetta e
chi rifiuta fanno lo stesso numero di sessioni. Di solito non è così: chi accetta e torna
dieci volte produce dieci sessioni osservate con una sola accettazione. Per questo la
formula usa `r_freq`.

Inoltre "tasso di consenso" significa cose diverse a seconda della CMP. Lo strumento chiede
all'utente **come è misurato il suo tasso** e adatta di conseguenza l'ipotesi su `r_freq`:

| Come misura la CMP | Cosa significa `r_freq` | Valore predefinito (mediana, intervallo 95%) |
|---|---|---|
| **Per utente** (visitatori unici che hanno accettato ÷ visitatori unici) | sessioni per utente di chi non accetta ÷ di chi accetta | 0,80 (0,45 – 1,45) |
| **Per visualizzazione del banner** (accettazioni ÷ banner mostrati) | sessioni generate per ogni banner non accettato ÷ sessioni generate per ogni accettazione | 0,60 (0,27 – 1,30) |
| **Non lo so** | — | 0,70 (0,27 – 1,80) |

Motivazione. *Per utente*: chi non accetta comprende molti visitatori di passaggio (una
visita e via), quindi in media meno sessioni a testa; ma l'effetto può invertirsi, da cui
un intervallo che supera 1. *Per banner*: chi accetta non rivede più il banner e accumula
sessioni osservate, mentre chi lo ignora lo rivede a ogni visita e gonfia il denominatore;
il rapporto è quindi più basso e più incerto. **Non esistono fonti pubbliche solide su
questi valori: sono giudizi ragionati**, da trattare come tali.

La forma della formula è la stessa nei tre casi (`S × odds × r_freq`): cambia solo il
prior. Questo tiene il modello semplice.

### 2.2 Chi ignora il banner

Chi non clicca né "accetta" né "rifiuta" non ha dato il consenso: in Basic non viene
tracciato, esattamente come chi rifiuta. Molte CMP però calcolano il tasso come
`accetta ÷ (accetta + rifiuta)`, **escludendo chi ignora**, e questo sovrastima `p`.

Lo strumento chiede: *"Il tuo tasso tiene conto di chi non fa nessuna scelta?"*

- **Sì** (o l'utente inserisce accettazioni e banner mostrati): si usa così com'è.
- **No**: `p = tasso × (1 − quota_ignora)`, dove `quota_ignora` è chiesta all'utente; se non
  la conosce, valore predefinito 15% (intervallo 95%: 4% – 43%), dichiarato come ipotesi
  debole.
- **Non lo so**: come "No", ma con metà peso (miscela dei due casi) e avviso.

Chi ignora il banner spesso abbandona subito la pagina. Queste sono sessioni reali ma di
scarso valore: è uno dei motivi per cui `r_conv` predefinito è sotto 1.

### 2.3 Tasso di conversione e scontrino medio: i rapporti comportamentali

**`r_conv` — predefinito: mediana 0,40, intervallo 95% 0,15 – 1,05.**

- Fonte: la guida di Google Ads sulla modellazione delle conversioni in Consent Mode
  afferma che gli utenti con consenso hanno "tipicamente da 2 a 5 volte" più probabilità
  di convertire di quelli senza, e che il divario "varia molto" per settore, tasso di
  consenso e tipo di conversione
  ([Google Ads Help](https://support.google.com/google-ads/answer/10548233)).
  "Da 2 a 5 volte" equivale a `r_conv` tra 0,2 e 0,5.
- Limiti della fonte: è un'affermazione di Google non accompagnata da dati pubblici,
  è detta nel contesto della modellazione delle conversioni di Google Ads (la pagina non dice
  su quale popolazione) ed è un valore "tipico". Per
  questo l'intervallo è più largo di 0,2–0,5 e arriva fino alla parità (1,0).
- Coerenza qualitativa con la ricerca accademica: gli studi sul GDPR mostrano che chi
  resta tracciabile dopo l'opt-in è un gruppo selezionato e di maggior valore medio
  (Aridor, Che, Salz, *RAND Journal of Economics* 2023,
  [doi:10.1111/1756-2171.12455](https://doi.org/10.1111/1756-2171.12455)) e che il modo
  in cui si chiede il consenso crea distorsione da selezione nei dati
  (Lin, Strulov-Shlain, [arXiv:2308.13496](https://arxiv.org/abs/2308.13496)).
  Questi lavori confermano la **direzione** dell'effetto, **non forniscono un valore** di
  `r_conv` per un ecommerce.
- Non ho trovato studi pubblici indipendenti che misurino direttamente la quota di ordini
  tracciati per chi accetta rispetto a chi rifiuta. I numeri che circolano nei blog dei
  fornitori di CMP non sono verificabili e non vengono usati.

**`r_aov` — predefinito: mediana 1,00, intervallo 95% 0,75 – 1,35.** Nessuna fonte:
non c'è una ragione forte per aspettarsi uno scontrino diverso, quindi si parte dalla
parità con un'incertezza moderata.

Per gli **eventi chiave diversi dall'acquisto** (es. iscrizione, lead) si usa lo stesso
`r_conv` con intervallo allargato del 25%, perché la fonte parla di conversioni
pubblicitarie in generale e non c'è modo di calibrarlo.

Tutti i rapporti sono modificabili con cursori. Il cursore sposta la mediana; un secondo
controllo ("quanto ne sei sicuro") stringe o allarga l'intervallo. Non è possibile
impostare incertezza zero: il minimo è ±10%.

### 2.4 Il consenso varia per canale, device e periodo

**Per canale.** La CMP di solito dà un solo tasso globale, ma chi arriva da email o
traffico diretto (clienti abituali) accetta in genere più di chi arriva da display o
social a pagamento. Senza dati per canale questa differenza non è stimabile. Scelta:

- ogni canale ha un proprio tasso `p_c` che si discosta da quello globale in modo casuale
  (sulla scala logit, deviazione standard predefinita 0,30: con `p` = 60% significa
  canali tipicamente tra 45% e 73%);
- a ogni simulazione gli scostamenti vengono ricentrati in modo che **la media dei canali
  torni al tasso globale** inserito dall'utente.

Effetto pratico: il totale del sito non cambia, ma **gli intervalli dei singoli canali
sono più larghi di quello del totale**. È il comportamento corretto: sul singolo canale ne
sappiamo meno. Non imposto scostamenti predefiniti "email alto, display basso" perché non
ho fonti quantitative: l'utente che conosce i tassi per canale li può inserire, e in quel
caso sostituiscono l'ipotesi casuale.

> **Nota.** L'interfaccia non chiede i tassi per canale, perché quasi nessuno ne dispone. La funzione resta nel motore (`Config.canali`) ma non è raggiungibile; un link con le ipotesi che li contiene viene accettato ignorandoli, con un avviso.

**Per device.** L'export fisso non contiene il device, quindi un tasso per device non può
essere applicato riga per riga. L'utente inserisce
tasso e quota di sessioni osservate per ciascun device; lo strumento ne ricava il tasso
globale effettivo e la sua incertezza. Il dettaglio per device non compare nei risultati.

**Per periodo.** Se il banner è cambiato a una certa data, l'utente inserisce più
intervalli di date, ognuno con il suo tasso. I rapporti comportamentali restano comuni a
tutti i periodi (un banner diverso cambia quanti accettano, e in linea di principio anche
*chi*: lo si segnala come limite).

### 2.5 Gli utenti non si sommano come le sessioni

Tre problemi distinti:

1. **Somma degli utenti giornalieri ≠ utenti del periodo.** Chi torna in tre giorni diversi
   è contato tre volte nelle righe giornaliere. L'export per data **non contiene** gli
   utenti unici del periodo.
2. **Lo stesso vale tra canali**: un utente può comparire in due canali nello stesso giorno.
3. **Per chi rifiuta, "utente" non è mai stato misurato.** Senza identificatore non esiste
   deduplicazione tra giorni: il numero di persone distinte che hanno rifiutato è una
   grandezza che nessun sistema ha contato, non un dato andato perso.

Cosa fa lo strumento:

- **Utenti-giorno** (somma degli utenti giornalieri): stimati come le sessioni, con lo
  stesso fattore. Vengono sempre etichettati "utenti-giorno", mai "utenti", con una nota
  che spiega la differenza. Ipotesi aggiuntiva: sessioni per utente *nello stesso giorno*
  uguali tra i due gruppi.
- **Utenti unici del periodo**: stimati **solo se** l'utente inserisce a mano il numero di
  utenti totali del periodo letto da GA4 (un campo facoltativo). In quel caso
  `utenti persi = utenti osservati × odds × r_utenti`, dove `r_utenti` vale 1 se il tasso
  CMP è per utente (mediana 1,00, intervallo 0,75 – 1,35 per tenere conto di cookie
  cancellati e scadenze che fanno contare due volte la stessa persona), ed è più incerto
  negli altri casi. Senza quel campo, la casella "utenti del periodo" mostra
  "non stimabile da questo export" con la spiegazione.
- Nessuna stima di utenti unici per canale sul periodo.

---

## 3. La struttura di stima

### 3.1 Alternative considerate

| Approccio | Perché no / perché sì |
|---|---|
| **Scala semplice** (`S / p`) | Un numero solo, nessuna incertezza, ignora i comportamenti diversi. È esattamente la falsa precisione da evitare. Resta utile come riga di confronto nel pannello di sensibilità. |
| **Propagazione analitica dell'errore** (metodo delta) | Funziona male con conteggi piccoli, distribuzioni asimmetriche e somme di canali con parametri in comune; l'ancoraggio diventa complicato. |
| **Bayesiano completo con MCMC** | Flessibile, ma pesante nel browser e richiede di controllare la convergenza, cosa che uno strumento senza supervisione non può garantire. Soprattutto non serve: quasi tutti i parametri non sono informati dai dati, quindi la loro distribuzione a posteriori coincide con il prior e si può campionare direttamente. |
| **Bayesiano con simulazione Monte Carlo diretta** ✅ | Si estraggono i parametri dalle loro distribuzioni, si calcola il risultato, si ripete migliaia di volte. Esatto, veloce, riproducibile, senza problemi di convergenza. L'ancoraggio si aggiunge aggiornando `r_conv` dentro ogni simulazione (§5). |

### 3.2 Il modello, passo per passo

Per ognuna di `N` simulazioni (predefinito 4.000, in un Web Worker):

1. **Tasso di consenso.** Si estrae `p` da una distribuzione costruita dall'input (logit-normale: vedi §10):

   | Input dell'utente | Incertezza su `p` (dev. standard) |
   |---|---|
   | Accettazioni e rifiuti assoluti | quella dei conteggi, con un minimo di 1 punto percentuale |
   | "Lo conosco con precisione" | 1,5 punti |
   | "È una stima" | 5 punti |
   | "È un'ipotesi di massima" | 10 punti |

   Il minimo di 1 punto esiste perché anche un conteggio enorme misura la definizione
   della CMP, non esattamente la grandezza che serve al modello.
   Poi si applica la correzione per chi ignora il banner (§2.2).

2. **Rapporti comportamentali.** Si estraggono `r_freq`, `r_conv`, `r_aov` da
   distribuzioni log-normali (sempre positive, simmetriche in termini di rapporto:
   "il doppio" e "la metà" sono ugualmente lontani da 1).

3. **Tassi per canale.** Si estraggono gli scostamenti e si ricentrano (§2.4).

4. **Sessioni perse**, per giorno e canale. Se le visite arrivano in modo casuale e ognuna
   è "con consenso" con una certa probabilità, sessioni osservate e sessioni perse sono
   due conteggi di Poisson indipendenti. Le perse si estraggono quindi da una Poisson con
   media `S × odds_c × r_freq` (con una piccola correzione per `S` molto bassi). Con
   migliaia di sessioni questo rumore è trascurabile; conta per i canali minuscoli.

5. **Tasso di conversione di chi accetta**, per canale, con **shrinkage**. Un canale con
   3 conversioni su 200 sessioni non ha "un tasso dell'1,5%": ha un tasso incerto. Si usa
   un modello Gamma–Poisson gerarchico:
   - il tasso di ogni canale è "tirato" verso il tasso medio del sito, tanto più quanto
     meno dati ha il canale;
   - la forza di questo effetto è stimata dai dati stessi (quanto differiscono tra loro i
     canali grandi);
   - un secondo livello fa lo stesso tra i giorni di un canale, così un giorno di
     promozione conserva il suo tasso alto senza che un giorno con 0 conversioni su 12
     sessioni venga letto come "tasso zero".

   Canali con zero conversioni ottengono quindi una stima piccola ma non nulla, con un
   intervallo ampio.

6. **Conversioni perse**: Poisson con media
   `sessioni perse × tasso del canale × r_conv`. Lo stesso per le transazioni.

7. **Entrate perse**: `transazioni perse × scontrino`, dove lo scontrino medio del canale
   è stimato con shrinkage verso quello del sito e la variabilità del singolo ordine è
   ricavata dai dati (le righe con una sola transazione rivelano il valore di ordini
   singoli). Poi si moltiplica per `r_aov`.

8. **Totali**: osservato + perso, per giorno, canale e complessivo.

Dalle `N` simulazioni si leggono **mediana** (stima centrale), **intervallo 80%**
(10°–90° percentile) e **intervallo 95%** (2,5°–97,5°). I totali sono calcolati
sommando *dentro* ogni simulazione, non sommando gli intervalli dei canali: così la
correlazione tra canali (stesso `p`, stessi rapporti) è rispettata.

### 3.3 Presentazione senza falsa precisione

- Ogni numero stimato appare come stima centrale **e** intervallo; mai da solo.
- Arrotondamento a 2–3 cifre significative ("circa 41.000", non "41.237").
- Il seme casuale è fisso: gli stessi input danno gli stessi risultati.
- **Scomposizione dell'incertezza**: per ogni risultato si mostra quanta parte
  dell'intervallo dipende dal tasso di consenso, quanta dai rapporti comportamentali e
  quanta dal rumore dei conteggi. Serve a dire all'utente dove conviene procurarsi un
  dato migliore.
- Pannello di sensibilità: stesso risultato ricalcolato con ogni ipotesi ai due estremi
  del suo intervallo, più la riga "scala semplice" come confronto.

---

## 4. Il caso Consent Mode

### 4.1 Perché conta

| Situazione | Cosa contengono i report | Cosa fa lo strumento |
|---|---|---|
| Nessun Consent Mode, tag bloccati fino al consenso | solo dati con consenso | **stima** il mancante |
| Consent Mode **Basic** | solo dati con consenso | **stima** il mancante |
| **Advanced**, modellazione comportamentale **non attiva** | solo dati con consenso (i ping senza cookie sono raccolti ma non compaiono nei report) | **stima** il mancante |
| **Advanced**, modellazione **attiva**, identità report **«Combinato»** (Blended) | osservato **+ già modellato da Google** | **non scala**: vedi §4.3 |

"Advanced" **non** implica "modellazione attiva". Servono tutte queste condizioni
([Analytics Help](https://support.google.com/analytics/answer/11161109)):

- Consent Mode su tutte le pagine, con i tag Google che si caricano **prima** del banner;
- almeno 1.000 eventi al giorno con `analytics_storage='denied'` per almeno 7 giorni;
- almeno 1.000 utenti al giorno con `analytics_storage='granted'` in almeno 7 dei 28
  giorni precedenti;
- identità per i report impostata su **«Combinato» (Blended)**.

Google precisa che rispettare le soglie non garantisce l'attivazione. Molti siti medi e
piccoli in Advanced non le raggiungono.

**Punto verificato e importante per questo progetto:** le esplorazioni **in formato
libero**, cioè il formato da cui proviene il nostro CSV, **includono** i dati modellati
(la maggior parte delle altre tecniche di esplorazione no). Quindi il rischio di doppio
conteggio è reale proprio per l'export che usiamo.

### 4.2 Come lo strumento guida l'utente

Un breve percorso a domande, prima di mostrare qualunque risultato:

1. **"Come è installato il Consent Mode?"** — Basic / Advanced / Nessuno / Non lo so.
   Aiuto: *in Basic i tag Google non partono finché l'utente non accetta; in Advanced
   partono subito e inviano ping senza cookie*. Come controllare: Tag Assistant, oppure
   chiedere a chi ha installato la CMP.
2. Se Advanced: **"Qual è l'identità per i report?"** — dove guardare:
   *Amministrazione → Visualizzazione dei dati → Identità report*. Se è "In osservazione" o
   "Basato sul dispositivo", i report non contengono dati modellati → si stima.
3. Se «Combinato»: **"La modellazione è attiva?"** — dove guardare: nello stesso riquadro
   dell'identità report e nell'**icona di qualità dei dati** in alto nei report e
   nell'esplorazione. Se dice *"Inclusi i dati utente stimati"* la modellazione è attiva;
   se dice *"Dati utente stimati non disponibili"* o *"Esclusi…"* non lo è.
   (Le diciture possono variare con la versione e la lingua dell'interfaccia di GA4.)
4. **"Non lo so"** a uno qualsiasi dei passaggi → lo strumento calcola comunque, ma con un
   avviso ben visibile che il risultato è valido solo se i report non contengono già dati
   modellati.

### 4.3 Cosa fa lo strumento se la modellazione è attiva

- **Nessuna correzione.** I totali mostrati coincidono con quelli del CSV. Avviso:
  *"Il tuo export contiene già la stima di Google del traffico senza consenso.
  Aggiungerne un'altra significherebbe contarlo due volte."*
- **Confronto di coerenza, facoltativo.** L'utente può caricare un secondo export dello
  stesso periodo fatto con identità report "Basato sul dispositivo" (solo dati osservati).
  Lo strumento allora:
  - calcola quanto ha aggiunto Google (`modellato − osservato`), per metrica e canale;
  - calcola la propria stima a partire dai soli dati osservati;
  - mostra se l'aggiunta di Google cade dentro o fuori l'intervallo dello strumento,
    senza dichiarare quale dei due abbia ragione.

  Google dichiara che cambiare identità report non altera la raccolta né l'elaborazione
  e che si può tornare indietro in qualsiasi momento. È però un'impostazione della
  proprietà: per il tempo in cui resta cambiata, la vedono tutti. La guida lo dice e
  ricorda di ripristinarla.
- **Attenzione alla modellazione parziale.** Se la modellazione si è attivata a metà del
  periodo, l'export mescola giorni modellati e non. Lo strumento non può accorgersene da
  solo con certezza: chiede la data di attivazione, se nota, e in ogni caso segnala salti
  bruschi nelle sessioni giornaliere come possibile indizio.

---

## 5. Ancoraggio ai dati reali

### 5.1 L'idea

Se l'utente inserisce, per un intervallo di date, gli **ordini reali** (e facoltativamente
le **entrate reali**) dal gestionale, la differenza `ordini reali − transazioni GA4` è
una misura diretta di ciò che è andato perso. Il modello prevede quella differenza come

```
transazioni perse attese = Σ_canali (sessioni perse × tasso di conversione) × r_conv
```

quindi il dato reale dice quanto deve valere il prodotto `odds × r_freq × r_conv`.

### 5.2 Come viene usato

Ogni simulazione ha una sua combinazione di `p`, `r_freq`, tassi per canale. Per ognuna:

1. si calcola quante transazioni perse prevede quella combinazione se `r_conv` valesse 1;
2. si confronta la previsione con gli ordini mancanti reali (verosimiglianza di Poisson) e si
   ottiene la distribuzione aggiornata di `r_conv` per quella simulazione;
3. `r_conv` viene estratto da questa distribuzione aggiornata, non più dal prior.

Le entrate reali, se presenti, aggiornano allo stesso modo `r_aov`.

**Gli ordini reali aggiornano solo `r_conv` e `r_aov`.** Le altre ipotesi (tasso di consenso,
`r_freq`, variazione tra canali) restano quelle di partenza: le simulazioni non vengono ripesate.
È una scelta deliberata, fatta dopo la validazione (§11.3): un aggiornamento bayesiano completo
userebbe gli ordini anche per correggere il numero di sessioni perse, ma così trasferirebbe sulle
sessioni l'errore dell'ipotesi più debole, quella su `r_conv`.

Lo strumento segnala un **conflitto** quando `r_conv` calibrato esce dal margine plausibile
dell'ipotesi di partenza: significa che il dato reale e le ipotesi non stanno insieme, e che
conviene ricontrollare tasso, periodo e perimetro degli ordini.

**In conflitto gli ordini reali non vengono usati per nessuna grandezza.** Un `r_conv` fuori scala
non riguarda solo le transazioni: entra anche nelle entrate e negli eventi chiave (che ereditano lo
stesso rapporto). L'interfaccia mostra quindi, ovunque (schede, sintesi, grafici, stampa, CSV), la
stima fatta con le sole ipotesi, marcata «senza gli ordini reali», e dice in quale direzione va il
conflitto: mancano **troppi** ordini (servirebbe un `r_conv` sopra il margine) oppure **troppo pochi**
(sotto). È una regola dell'interfaccia (`src/strumento/esito.ts`): il motore non cambia.

### 5.3 Cosa restringe e cosa no

| Grandezza | Effetto dell'ancoraggio |
|---|---|
| Transazioni ed entrate totali, nel periodo ancorato | **Molto forte**: sono quasi misurate direttamente |
| Transazioni ed entrate fuori dal periodo ancorato | **Forte**: si usa `r_conv` calibrato, assumendo che resti stabile |
| Ripartizione per canale delle transazioni perse | **Moderato**: il totale è noto, la divisione tra canali resta ipotesi |
| Altri eventi chiave | **Debole**: si eredita `r_conv` calibrato ma con intervallo allargato |
| **Sessioni e utenti** | **Nessuno, per costruzione.** Gli ordini reali fissano il *prodotto* `odds × r_freq × r_conv`, non i singoli fattori: molte sessioni perse che convertono poco e poche sessioni perse che convertono molto spiegano ugualmente bene gli stessi ordini |

L'ultima riga va spiegata nell'interfaccia, altrimenti l'utente si aspetta che inserire
gli ordini "sistemi tutto".

### 5.4 Precauzioni

- **Perdite non dovute al consenso.** Gli ordini reali superano quelli di GA4 anche per ad blocker
  ed errori tecnici. Il parametro «altre perdite» è definito e discusso al §12: non ha più un valore
  preimpostato, ma dipende dal tipo di pubblico indicato dall'utente. **Con gli ordini reali il totale
  di ordini ed entrate dipende quasi solo da questa risposta.**
- **Confrontabilità.** L'interfaccia chiede di inserire ordini confrontabili con GA4:
  solo canale web, esclusi ordini telefonici, in negozio, rinnovi automatici, ordini di
  test; entrate con la stessa definizione di GA4 (IVA, spedizione, resi).
- **Controlli automatici.** Avviso se gli ordini reali sono *meno* delle transazioni GA4
  (probabili duplicati in GA4 o perimetro diverso), o se lo scontrino medio reale e
  quello di GA4 differiscono di oltre il 25% (definizioni di entrata diverse: in quel
  caso `r_aov` non viene calibrato).
- **Periodo minimo.** Con meno di circa 30 ordini mancanti l'ancoraggio informa poco; lo
  strumento lo usa comunque ma mostra che il prior pesa ancora molto.

---

## 6. Piano di validazione

### 6.1 Generatore di dati sintetici

Simula un sito a livello di **singolo visitatore**, in modo che la "verità" sia nota per
costruzione e non derivata dalle stesse formule dello stimatore:

- visitatori per giorno e canale, con stagionalità settimanale e giorni di promozione;
- ogni visitatore accetta, rifiuta o ignora, con probabilità diverse per canale;
- numero di visite di ritorno estratto da distribuzioni diverse per gruppo;
- conversione e valore dell'ordine con parametri diversi per gruppo; valori d'ordine
  log-normali; più eventi chiave possibili nella stessa sessione (sovradispersione);
- una **CMP simulata** che riporta il tasso nei due modi (per utente, per banner
  mostrato, con o senza chi ignora);
- un **gestionale simulato** con gli ordini reali, più una quota persa per altre cause;
- output: un CSV identico a quello di GA4 (solo sessioni con consenso) e un file con i
  veri totali.

Il fatto che il generatore lavori per visitatore e lo stimatore per aggregati è
voluto: se usassero le stesse formule, la validazione sarebbe circolare.

### 6.2 Cosa si misura

Per ogni scenario, almeno 500 repliche. Per sessioni, utenti-giorno, conversioni,
transazioni, entrate, sul totale e per canale:

- **errore** della stima centrale (mediano e distribuzione);
- **copertura**: in quale percentuale di repliche il valore vero cade nell'intervallo
  80% e 95%;
- **ampiezza** media degli intervalli (un intervallo che copre sempre perché è enorme
  non è un successo).

### 6.3 Due tipi di verifica, con aspettative diverse

**A. Calibrazione (deve passare).** In ogni replica i parametri veri sono estratti dagli
stessi intervalli che lo strumento assume. Qui la copertura *deve* corrispondere a quella
dichiarata: criterio di accettazione 80% → tra 76% e 84%; 95% → tra 93% e 97% (margini
dell'errore di simulazione con 500 repliche). Se non passa, c'è un errore nel metodo o
nel codice.

**B. Robustezza (si misura e si documenta).** I parametri veri sono fissati su valori
"scomodi". Qui la copertura può legittimamente scendere: un intervallo bayesiano non può
proteggere da un'ipotesi sbagliata. L'obiettivo è **quantificare il danno** e riportarlo
nel README e, in sintesi, tra le avvertenze dell'interfaccia.

| # | Scenario | Cosa ci si aspetta |
|---|---|---|
| 1 | Base: 50.000 sessioni/mese, consenso 60%, parametri veri al centro dei prior | Copertura nominale |
| 2 | Canali minuscoli: 0–5 conversioni nel periodo | Intervalli larghi, nessuna stima a zero, copertura nominale grazie allo shrinkage |
| 3 | Sito piccolo: 2.000 sessioni/mese | Come sopra; il rumore dei conteggi diventa visibile |
| 4 | Consenso molto basso (15–25%) | Moltiplicatore grande, intervalli molto larghi; verificare che restino calibrati e non esplodano |
| 5 | Consenso molto alto (90%+) | Poco da stimare; verificare che l'intervallo non sia inutilmente largo |
| 6 | `r_conv` vero = 1,0 (prior centrato su 0,4) | Conversioni sottostimate; copertura sotto il nominale: **misurare di quanto** |
| 7 | `r_conv` vero = 0,15 | Conversioni sovrastimate; idem |
| 8 | Scenari 6 e 7 **con ancoraggio** | La copertura su transazioni ed entrate deve tornare vicina al nominale |
| 9 | Consenso molto diverso tra canali (30% – 85%) | Totale corretto; copertura per canale da misurare |
| 10 | Tasso CMP per banner dichiarato come "per utente" | Errore sistematico sulle sessioni: misurare |
| 11 | Chi ignora il banner non incluso nel tasso, e l'utente non lo sa | Idem |
| 12 | Cambio di banner a metà periodo | Corretto se dichiarato; misurare l'errore se non dichiarato |
| 13 | Ancoraggio con 20% di ordini persi per altre cause (prior 5%) | `r_conv` sovrastimato: misurare |
| 14 | Eventi chiave molto sovradispersi | Verificare che l'intervallo Poisson non sia troppo stretto |

**Soglia d'arresto:** se una verifica di tipo A non passa, oppure se in
tipo B il danno è molto peggiore di quanto questo documento lasci intendere (per esempio
copertura del 95% sotto il 50% negli scenari 6–7), il metodo va
rivisto prima dell'uso.

---

## 7. Limiti e avvertenze da mostrare nell'interfaccia

Sempre visibili, vicino ai risultati:

1. **È una stima, non una misura.** I numeri aggiunti all'osservato dipendono dalle
   ipotesi elencate qui sotto. Cambiando le ipotesi cambiano i risultati.
2. **L'intervallo dice quanto sono incerte le ipotesi.** Se un'ipotesi è sbagliata oltre
   l'intervallo indicato, il valore vero può cadere fuori.
3. **Più dati GA4 non rendono la stima più precisa.** Un tasso di consenso più affidabile
   o gli ordini reali sì.
4. **Riguarda solo il consenso.** Ad blocker, browser che bloccano il tracciamento ed
   errori tecnici non sono inclusi.
5. **Se GA4 sta già modellando, non usare questi totali.** (Con il percorso guidato del §4.)
6. **I canali piccoli hanno intervalli larghi**, ed è corretto così. La ripartizione per
   canale del traffico perso è più incerta del totale.
7. **Gli "utenti-giorno" non sono utenti unici.** Le persone distinte che hanno rifiutato
   non sono mai state contate da nessuno.
8. **Il traffico perso non è traffico uguale a quello osservato.** In media converte meno:
   per questo le conversioni stimate crescono meno delle sessioni.
9. **Non adatto a decisioni di dettaglio**: non usare per confrontare due campagne, per
   test A/B o per attribuire budget a un singolo canale minore.
10. **Con l'ancoraggio**: migliora molto ordini ed entrate, quasi per nulla sessioni e
    utenti.
11. **Valori predefiniti**: `r_conv` si appoggia a un'indicazione generica di Google;
    `r_freq`, `r_aov`, la quota di chi ignora il banner e la variazione tra canali sono
    giudizi ragionati senza fonte pubblica solida.

---

## 8. Riepilogo dei valori predefiniti

| Parametro | Mediana | Intervallo 95% | Base |
|---|---|---|---|
| `r_freq` (tasso CMP per utente) | 0,80 | 0,45 – 1,45 | giudizio |
| `r_freq` (per banner mostrato) | 0,60 | 0,27 – 1,30 | giudizio |
| `r_freq` (non so) | 0,70 | 0,27 – 1,80 | giudizio |
| `r_conv` | 0,40 | 0,15 – 1,05 | Google Ads Help ("2–5 volte"), allargato |
| `r_aov` | 1,00 | 0,75 – 1,35 | giudizio |
| `r_utenti` (tasso per utente) | 1,00 | 0,75 – 1,35 | giudizio |
| Quota che ignora il banner (se non inclusa e ignota) | 15% | 4% – 43% | giudizio |
| Variazione del consenso tra canali (dev. std. logit) | 0,30 | — | giudizio |
| Ordini persi per cause diverse dal consenso (solo con ordini reali) | secondo il pubblico: 7% · 20% · 9% · 2% | vedi §12 | misure pubbliche indicative |
| Incertezza su `p` | vedi §3.2 | | |

---

## 9. Scelte di progetto

**Utenti del periodo.** Gli utenti unici del periodo non si ottengono sommando gli utenti-giorno
(§2.5). Lo strumento li legge dalla riga dei totali dell'export, se c'è, oppure li fa inserire a mano.

**Device.** L'export non contiene il device. Chi conosce tassi diversi per device inserisce tasso e
quota di sessioni per ciascuno: servono solo a calcolare il tasso globale effettivo (§2.4). Così il
formato dell'export resta unico.

**Valore predefinito di `r_conv`.** 0,40 (0,15 – 1,05), dall'indicazione di Google (§2.3). È più
"pessimista" sul traffico perso di quanto molti si aspettino: con consenso al 60% le conversioni
stimate salgono di circa il 20%, non del 67%.

**Sito senza ecommerce.** Transazioni ed Entrate sono colonne facoltative: senza, lo strumento lavora
con i soli eventi chiave.

**Evento chiave.** Di solito l'export ha una sola colonna "Eventi chiave" (il totale), e l'utente
dichiara a parole cosa rappresenta. Se l'esplorazione ha più colonne di eventi chiave, l'utente sceglie
quale usare.

**Modellazione attiva.** Lo strumento non corregge i dati e offre il confronto di coerenza facoltativo
del §4.3: è l'unico uso utile dello strumento per chi ha la modellazione.

**Tassi di consenso per canale.** Il motore sa usarli (§10), ma l'interfaccia non li chiede, perché
quasi nessuno ne dispone (§2.4).

**Livelli degli intervalli.** 80% e 95%. In evidenza l'80% (più leggibile), con il 95% come banda più
chiara.

**Ancoraggio sulle sessioni.** Chi ha un conteggio di visite indipendente dal consenso (log del
server, analytics senza cookie) potrebbe ancorare anche le sessioni, che è il punto dove il metodo è più
debole. Non è incluso; è citato tra i limiti come modo per migliorare la stima.

**Diciture di GA4 in italiano.** Sono quelle della documentazione di Google; la pagina riporta anche
l'originale inglese e avverte che la dicitura può variare (§10).

---

## 10. Note di implementazione

Scelte di dettaglio fatte scrivendo il codice. Nessuna cambia la struttura del metodo.

- **Distribuzione del tasso di consenso.** Logit-normale invece di Beta: stessa media e stessa
  deviazione standard, ma permette di usare un unico "errore comune" per device e periodi (se il
  tasso dichiarato è troppo alto, lo è per tutti), che è l'ipotesi più prudente.
- **Chi ignora il banner, opzione "non lo so".** In metà delle simulazioni la correzione è applicata,
  nell'altra metà no.
- **Tassi per canale inseriti dall'utente.** I canali indicati usano il loro tasso; gli altri vengono
  ricentrati perché la media torni al tasso globale. Se i tassi inseriti sono incompatibili con il
  globale, il ricentraggio è sospeso e compare un avviso.
- **Tassi per periodo e per canale insieme.** I tassi per canale valgono per tutti i periodi.
- I due punti precedenti descrivono il motore: l'interfaccia non chiede i tassi per canale (vedi la nota al §2.4).
- **Gerarchia dei tassi di conversione.** Stimata dai dati con il metodo dei momenti (Bayes empirico)
  su due livelli: canale e giorno. Il livello "giorno" assorbe anche la sovradispersione degli eventi
  chiave (scenario B14).
- **Scontrino medio.** La variabilità del singolo ordine è stimata dalla dispersione degli scontrini
  medi giornalieri (pesata per numero di ordini), non solo dalle righe con un ordine.
- **Ancoraggio, dentro il periodo ancorato.** Le transazioni perse simulate vengono riproporzionate
  perché la loro somma coincida con gli ordini mancanti (al netto delle altre perdite): il totale è
  quasi misurato, l'incertezza residua è la ripartizione tra giorni e canali e la quota di altre perdite.
- **Ancoraggio, scontrino.** `r_aov` è calibrato confrontando lo scontrino degli ordini mancanti con
  quello atteso per il traffico perso, tenendo conto del mix di canali.
- **Sensibilità.** Calcolata in forma chiusa (una ipotesi alla volta ai due estremi del suo intervallo
  95%, le altre alla mediana), non con nuove simulazioni.
- **Scomposizione dell'incertezza.** Quote della varianza (su scala logaritmica) del perso; non
  disponibile con l'ancoraggio, perché le fonti non sono più indipendenti.
- **Diciture GA4 in italiano.** Non verificate sull'interfaccia: la pagina riporta anche
  l'originale inglese e avvisa che la dicitura può variare.

## 11. Esito della validazione

Tabelle complete in [VALIDAZIONE.md](VALIDAZIONE.md): 500 repliche per scenario, 1.000 simulazioni
per stima. Margine d'errore sulla copertura: circa ±4 punti sull'80%, ±2 sul 95%.

### 11.1 Calibrazione (tipo A)

| Scenario | Esito |
|---|---|
| A1 base, A2 canali minuscoli, A4 consenso 20%, A5 consenso 92% | **Passano** su tutte le grandezze (80%: 78–82%; 95%: 94–97%) |
| A3 sito da 2.000 sessioni | Passa, al limite: entrate 75% / 93%; per singolo canale le sessioni scendono a 73% / 91% |
| A6 con ordini reali (pubblico «misto / non lo so», §12) | **Passa**: transazioni 79% / 95%, entrate 80% / 94%, sessioni 77% / 95% |

Errore mediano della stima centrale: tra 0% e +3% in tutti gli scenari A.
Gli utenti unici del periodo sono sovra-coperti (circa 89% / 98%): l'intervallo è più largo del
necessario, per prudenza.

### 11.2 Robustezza (tipo B): quanto costa un'ipotesi sbagliata

| Ipotesi violata | Effetto misurato |
|---|---|
| `r_conv` vero 1,0 invece di 0,4 (B6) | Transazioni sottostimate del 20%; copertura 41% / 79% |
| `r_conv` vero 0,15 (B7) | Transazioni sovrastimate del 13%; copertura 34% / 72% |
| Gli stessi, con ancoraggio (B8) | Transazioni ed entrate corrette (errore ≤ 1%); sessioni invariate (79% / 95%) |
| Consenso molto diverso tra canali, 30%–85% (B9) | Totali corretti. **Sessioni per canale: copertura 30% / 44%** |
| Tasso per banner dichiarato "per utente" (B10a) | Sessioni sovrastimate del 19%; utenti del periodo: copertura 24% / 62% |
| Tasso per banner dichiarato correttamente (B10b) | Prudente: sessioni +6%, intervalli più larghi del necessario |
| Tasso che esclude chi ignora, dichiarato completo (B11a) | Sessioni sottostimate del 12%; copertura 58% / 83% |
| Lo stesso, dichiarato correttamente (B11b) | Corretto e prudente |
| Cambio di banner, dichiarato o no (B12) | Totali corretti in entrambi i casi (cambia la ripartizione tra i giorni) |
| Consenso diverso tra mobile e desktop (50% / 75%), desktop con 1,5 volte le visite, solo tasso globale (B16a) | Sessioni sovrastimate del 4%; copertura 76% / 94% |
| Lo stesso, tasso globale dichiarato «preciso» (B16d) | Sessioni sovrastimate del 4%; copertura 77% / 94% |
| Lo stesso, con i tassi per dispositivo (B16b) | Corretto: sessioni +0%, copertura 80% / 96% |
| Consenso diverso, stesse visite tra dispositivi (B16c) | Corretto con il solo tasso globale: sessioni +1%, copertura 79% / 95% |
| Ordini reali con 20% di altre perdite (B13, B13b; §12) | Pubblico «misto / non lo so»: transazioni +14%, copertura 66% / 100%. **Pubblico dichiarato «largo consumo»: +16%, copertura 0% / 32%** |
| Eventi chiave a grappoli (B14) | Nessun danno |

Sui dispositivi: il solo tasso globale sbaglia quando i dispositivi differiscono sia nel consenso sia nel numero di
visite per visitatore (il tasso conta visitatori, GA4 conta sessioni). Con le differenze provate l'errore è del 4% e la
copertura cambia poco, perché l'intervallo è dominato da «quante volte ritorna»; con differenze maggiori l'errore cresce.
I tassi per dispositivo, pesati con le quote di sessioni osservate, lo eliminano.

Le righe in grassetto sono i punti deboli reali e sono riportate tra le avvertenze della pagina:

1. **Per canale** il risultato è affidabile solo se il consenso non varia molto tra canali (entro circa
   15 punti dal tasso globale, come assume lo stimatore). Se un canale probabilmente accetta molto meno
   degli altri, il suo dato va letto come indicativo.
2. **Con l'ancoraggio** l'intervallo di ordini ed entrate diventa molto stretto (±4% circa) e dipende
   quasi solo dalla quota di ordini persi per altre cause: se quella è sbagliata, il totale è fuori.
   È un limite del dato, non del calcolo: gli ordini reali dicono quanti ordini mancano, non perché.

Nessuno scenario 6–7 scende sotto la soglia di arresto fissata al §6.3 (copertura 95% sotto il 50%).

### 11.3 Decisione presa dopo la validazione: ancoraggio senza ripesatura

Il metodo iniziale prevedeva di pesare le simulazioni in base a quanto spiegano gli ordini reali
(aggiornamento bayesiano completo) e affermava che l'effetto su sessioni e utenti sarebbe stato
"quasi nullo". **Sui dati sintetici questo non reggeva** quando l'ipotesi su `r_conv` era sbagliata:
per giustificare "troppi" ordini mancanti il metodo sceglieva anche le simulazioni con più sessioni
perse, e viceversa.

| | Metodo iniziale (con ripesatura) | Metodo adottato (senza ripesatura) |
|---|---|---|
| A6 — transazioni / entrate | 75% / 92% · 75% / 91% | 78% / 94% · 77% / 94% |
| B8 — sessioni con `r_conv` sbagliato | 64–66% / 85–88%, errore +12% / −8% | 79% / 95%, errore +1% |
| B13 — sessioni con altre perdite al 20% | 67% / 87%, errore +9% | 79% / 95%, errore +1% |
| B13 — transazioni | 0% / 19% | 0% / 0% (stesso errore, intervallo più stretto) |

Il metodo adottato è più robusto e fa passare la calibrazione. Il prezzo è rinunciare a quel poco
che gli ordini reali direbbero sulle sessioni se tutte le ipotesi fossero giuste. Il metodo è stato modificato
dopo che la validazione ha mostrato questo problema, e la versione adottata è stata verificata con la
stessa validazione.

---

## 12. Revisione: ordini che GA4 perde per altre cause

Revisione successiva alla prima validazione. Cambiano la **definizione**, i **valori** e l'**interfaccia**
del parametro; il motore lo usa esattamente come prima.

### 12.1 Come lo usa il motore

Con gli ordini reali `O` e la quota `g`, il motore calcola gli ordini persi per il consenso come
`O × (1 − g) − transazioni GA4`. Gli ordini reali sono quindi divisi in tre parti che non si
sovrappongono: visti da GA4, persi per il consenso, persi per altre cause (`O × g`).

### 12.2 Definizione

Le fonti misurano la quota di **visitatori** che bloccano Google Analytics. Il parametro è un'altra
cosa: una quota di **ordini**, e non di tutti quelli di chi blocca GA.

> `g` = quota degli ordini reali che GA4 non registra e che **non** vengono da visitatori senza consenso.

Comprende:

1. ordini di chi **ha accettato** i cookie ma ha GA bloccato (ad blocker, browser) o è incappato in
   un errore tecnico;
2. ordini di chi **non ha mai visto il banner** perché il blocker nasconde anche quello: la CMP non
   li conta né tra chi accetta né tra chi rifiuta.

Non comprende gli ordini di chi blocca GA **e** rifiuta o ignora il banner: quelli sono «persi per il
consenso» e sono contati una volta sola.

Perché questa definizione e non «tutti gli ordini di chi blocca GA»: è l'unica coerente con il modo in
cui il modello stima le sessioni. Le sessioni perse sono `S × rifiuti/accettazioni × r_freq`, dove il
rapporto viene dal tasso della CMP, che conta **tutti** i visitatori che vedono il banner, anche quelli
con GA bloccato. Quindi chi rifiuta è già «perso per il consenso», che blocchi GA oppure no. Usare
l'altra definizione conterebbe due volte gli ordini di chi blocca e rifiuta.

Conseguenza numerica: `g` è **più bassa** della quota di visitatori che bloccano GA. Se questi
accettano meno degli altri (per esempio il 40% invece del 60%), circa il 60% dei loro ordini viene
da chi ha accettato: `g ≈ quota di blocco × 0,6`, più uno o due punti di errori tecnici.

### 12.3 Effetto sulle sessioni (anche senza ordini reali)

Le sessioni osservate sono quelle di chi accetta **e** non blocca GA. Il modello le moltiplica per il
rapporto rifiuti/accettazioni: se una quota `b` di chi accetta blocca GA, anche la stima delle sessioni
senza consenso risulta ridotta di `b`. Quindi:

> totale stimato ≈ traffico reale × (1 − quota di chi accetta e blocca GA), esclusi inoltre i visitatori
> a cui il blocker nasconde il banner.

Lo strumento non corregge questo effetto (servirebbe un'ipotesi in più e riguarda una grandezza che
dichiara di non stimare), ma lo dichiara nel Metodo e lo misura (scenari B15).

### 12.4 Banner nascosto

I visitatori a cui il blocker nasconde il banner non entrano nel tasso della CMP. Il tasso resta
corretto per chi il banner lo vede; quei visitatori restano fuori sia dall'osservato sia dalla stima.
I loro ordini rientrano nelle «altre cause». È spiegato nella domanda sul pubblico e nel Metodo.

### 12.5 Valori

Nessun valore preimpostato: l'utente sceglie il tipo di pubblico quando inserisce gli ordini reali.

| Pubblico | Mediana | Intervallo 95% | Sigma (log) |
|---|---|---|---|
| Largo consumo, soprattutto mobile | 7% | 2,5% – 19% | 0,52 |
| Tecnico o professionale, soprattutto desktop | 20% | 8% – 50% | 0,47 |
| Misto / non lo so | 9% | 2,5% – 32% | 0,65 |
| Tagging lato server o proxy proprio | 2% | 0,6% – 6,5% | 0,60 |
| Valore inserito (esperti) | inserito | × 0,55 – × 1,8 | 0,30 |

Derivazione: quota di visitatori che bloccano GA dalle misure pubbliche (6–15% sui siti generalisti,
25–58% su quelli tecnici; fonti vecchie, su singoli siti e di parte: **da riverificare**), moltiplicata
per circa 0,5–0,7 per la sovrapposizione con chi rifiuta, più 1–3 punti di errori tecnici.
Rispetto alla prima stima (6% · 20% · 8% · 2%) i valori cambiano poco: la riduzione per la
sovrapposizione e l'aggiunta degli errori tecnici quasi si compensano. Cambia la definizione.

### 12.6 Validazione

Il generatore sintetico ora simula visitatori con GA bloccato, che accettano meno degli altri e a cui
in parte il banner è nascosto; la «verità» segue la definizione del §12.2.

| Scenario | Sessioni | Transazioni |
|---|---|---|
| A6 — quota vera estratta dal margine «misto» | 77% / 95%, errore +1% | 79% / 95%, errore 0% |
| B13 — quota vera 20%, dichiarato «misto / non lo so» | 79% / 95% | 66% / 100%, errore +14% |
| B13b — quota vera 20%, dichiarato «largo consumo» | 79% / 95% | 0% / 32%, errore +16% |
| B15a — 12% di visitatori con GA bloccato, senza ordini reali | 86% / 97%, errore −2% | 85% / 96%, errore −1% |
| B15b — lo stesso, con ordini reali | 85% / 97%, errore −2% | 100% / 100%, errore −1% |
| B15c — pubblico tecnico (35% con GA bloccato), dichiarato tale, con ordini reali | 76% / 95%, errore −9% | 100% / 100%, errore +1% |

Lettura: con la risposta giusta, o con «non lo so», l'intervallo «quasi certamente» contiene sempre
il valore vero; con la risposta sbagliata no. La stima delle sessioni resta sotto il traffico reale
della quota prevista al §12.3. Con gli ordini reali le transazioni sono corrette anche quando chi
blocca GA rifiuta di più: è la verifica che non c'è doppio conteggio.

### 12.7 Limite che resta

Se il gestionale registrasse lo stato del consenso di ogni ordine, `g` si potrebbe misurare invece di
ipotizzare. Non è previsto dallo strumento.
