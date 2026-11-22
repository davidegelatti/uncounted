# Uncounted

**Estimate the traffic GA4 doesn’t count because cookie consent is missing.**

🇮🇹 [Leggi in italiano](README.it.md)

Site: **https://uncounted.davidegelatti.com** (Italian and English)

Visitors who decline or ignore the cookie banner don’t show up in Google Analytics 4. Uncounted takes a GA4
export and your banner’s consent rate, and estimates the **total** sessions, users, key events,
transactions and revenue, each with a central estimate and two ranges (“likely”, 8 times out of 10; “almost
certainly”, 19 times out of 20). Everything runs in your browser: no data leaves it.

Google Analytics is a trademark of Google LLC. Uncounted is an independent project, not affiliated with Google.

## How it works, in short

1. **Upload a CSV** exported from a GA4 free-form exploration (Date × Session default channel group;
   Sessions, Total users, Key events, Transactions, Total revenue).
2. **Answer a few questions**: how Consent Mode is set up (if Google is already modeling the missing
   traffic, the Estimator stops so nothing is counted twice) and what your consent rate is, how it’s
   measured and whether it includes visitors who ignore the banner. “I don’t know” is a valid answer: it
   widens the range.
3. **Read the estimate.** Visitors who don’t accept are not like those who do: they come back less often
   and convert less. The Estimator states these assumptions, lets you change them, and propagates their
   uncertainty with a Bayesian model and Monte Carlo simulation (4,000 runs). If you have real orders from
   your order system, they calibrate orders and revenue.

**Input format:** the CSV exactly as GA4 exports it from a free-form exploration (comment lines, headers,
the “Grand total” row, decimal point), in Italian or English; the total row is used to check the file and to
suggest unique users for the period. How to create it: [Guide](https://uncounted.davidegelatti.com/en/guide/#create-exploration).

The method is documented in full (in Italian) in [METODO.md](METODO.md), and on the site’s
[Method](https://uncounted.davidegelatti.com/en/method/) page.

## Privacy, and how to check it

- No backend, no analytics, no cookies, no third-party resources: fonts, icons and scripts are served by the
  site itself.
- The file is read and processed in the browser, in a Web Worker. The Content Security Policy
  (`public/_headers`) includes `connect-src 'none'`: the page cannot open network connections at all.
- Nothing is stored unless you turn on “Remember the assumptions” (answers and assumptions only, in
  `localStorage`, never the file, orders or revenue). Choosing a light or dark theme stores only that
  preference.
- The link with assumptions keeps them after `#`, which is never sent to the server.

How to check it yourself:

1. **Network tab** in the developer tools: after the page has loaded, uploading a file and calculating
   makes no new requests.
2. **Offline**: open the Estimator page, disconnect from the network (it works with “Disable cache” on
   too), upload your file. The estimate, printing and the CSV download all work.
3. **CSP**: in the console, `fetch('https://example.com')` is refused.
4. **Tests**: `tests/sito.test.ts` fails if the built site contains an inline script or style, an external
   resource or a network call.

## Run it locally

Requires Node.js 20 or later.

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:4321. The Estimator is at `/en/estimator/` (`/it/stimatore/` in Italian);
`/en/estimator/#tour` loads the sample data with a guided tour.

To try the production build with the real security headers:

```bash
npm run build && node scripts/servi-dist.mjs
```

Then open http://127.0.0.1:4188.

| Command | What it does |
|---|---|
| `npm test` | Builds the site and runs all tests (about a minute) |
| `npm run test:veloce` | Tests only, without rebuilding |
| `npm run build` | Type check and static site in `dist/` |
| `node scripts/servi-dist.mjs` | Serves `dist/` with the production headers (CSP included) |
| `npm run i18n` | Realigns `src/i18n/en.json` with the keys of `it.json` |
| `npm run validazione` | Reruns the validation and regenerates `VALIDAZIONE.md` and the Validation page data (about 30 minutes) |

## Tests and validation

**Tests** (`tests/`, Vitest):

| File | What it checks |
|---|---|
| `parser.test.ts` | Reading the CSV, including messy cases |
| `motore.test.ts` | The estimation engine, with a quick coverage check |
| `regressione.test.ts` | The engine returns **the same numbers, digit for digit**, as the snapshot in `tests/golden/` on 12 configurations |
| `esito.test.ts` | How real orders and assumptions are combined, including conflicts |
| `spiegaQuota.test.ts` | The sentence explaining the share of sessions matches the main figure |
| `i18n.test.ts` | Same keys and placeholders in both languages, no empty English text, no hard-coded sentences |
| `collegamento.test.ts` | The link with assumptions round-trips and never contains orders, revenue or users |
| `contrasto.test.ts` | Colour contrast (WCAG AA) in light and dark themes |
| `sito.test.ts` | On the built site: every page in both languages, no inline scripts or styles, no external resources, hreflang, anchors, routes, headers |

**Validation.** The method was tested on synthetic data: a generator simulates every visitor, produces a
GA4-like export and keeps the right answer. Each scenario runs 500 times and the coverage of the ranges is
measured: about 80 out of 100 for “likely” and 95 for “almost certainly” when the assumptions are reasonable,
and how much a deliberately wrong assumption costs. Results: [VALIDAZIONE.md](VALIDAZIONE.md) (Italian) and
the site’s [Validation](https://uncounted.davidegelatti.com/en/validation/) page.

## Project structure

```
sito.config.json             site name, author, URL, repository, license, contact
src/i18n/                    texts per language (it.json, en.json), routes, anchors, number and date formats
src/content/it|en/           page content (MDX)
src/layouts/, src/components/  layout, logo, SVG diagrams, tables, Home showcase
src/pages/                   routes: /it/…, /en/…, language root, 404
src/strumento/               the Estimator’s interface (inputs, results, charts, export)
src/motore/                  estimation engine, synthetic data generator, validation scenarios
src/home/                    Home: interactive grid and showcase built from the real Estimator output
src/parser.ts, src/worker.ts CSV reader; Web Worker for the calculation
src/styles/, src/icone/      styles (light and dark themes) and Lucide icons
src/assets/                  self-hosted fonts and logo
public/                      _headers (CSP), favicons, social preview images, theme script
tests/                       automated tests; tests/golden/ is the engine’s regression snapshot
scripts/                     validation, regression, text alignment, icons, local production server
```

Project documents: [METODO.md](METODO.md) (method, in Italian), [VALIDAZIONE.md](VALIDAZIONE.md)
(validation, in Italian), [LICENSE.md](LICENSE.md) (license, in Italian and English).

**Stack:** Astro (static site, pages and languages) and TypeScript with no runtime framework. No library
runs in the user’s browser; charts are hand-written SVG. Hosted on Cloudflare Pages.

## How it was made

Uncounted was designed and written with Claude, Anthropic’s AI model, in Claude Code:

- **Claude Fable 5.2** developed the statistical method, the engine, the validation and the interface design;
- **Claude Opus 5.5** handled the visual system, the page content, the English translation and the
  preparation for publishing.

The work went in phases, each closed by a document or a prototype and started only after the author’s
explicit approval, often with corrections. The decisions that shaped the method and the interface were the
author’s: using real orders without reweighting the other assumptions, asking about the site’s audience
for the orders GA4 misses for other reasons, no value preset without the user knowing, and no data outside
the browser. More on the site’s [How it was made](https://uncounted.davidegelatti.com/en/how-it-was-made/) page.

## Author

**Davide Gelatti**, Digital Analyst. https://davidegelatti.com

## License

Copyright © 2026 Davide Gelatti. All rights reserved.

The source code is publicly available so that anyone can read it and run it locally, for the sole purpose of
verifying how it works, its method and its privacy promises. It may not be copied, modified, redistributed,
hosted or reused in other projects without written permission. The full text is in [LICENSE.md](LICENSE.md),
together with the licenses of third-party fonts and icons.

To use Uncounted, there is the website: https://uncounted.davidegelatti.com. For requests:
uncounted@davidegelatti.com
