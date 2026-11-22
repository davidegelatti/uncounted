// Sito statico. Vincoli: nessuno script o stile in linea (CSP), nessuna risorsa di terze parti.
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { readFileSync } from 'node:fs';

const sito = JSON.parse(readFileSync(new URL('./sito.config.json', import.meta.url), 'utf8'));

export default defineConfig({
  site: sito.url,
  trailingSlash: 'always',
  build: { inlineStylesheets: 'never', assets: 'assets' },
  integrations: [mdx(), sitemap({ filter: (pagina) => new URL(pagina).pathname !== '/' })],
  devToolbar: { enabled: false },
  // Le icone SVG finiscono dentro il CSS come data: (ammesso da img-src nella CSP): così ci sono già all'apertura
  // della pagina e lo Stimatore funziona anche offline. Caratteri e worker restano file separati.
  vite: { build: { assetsInlineLimit: (file) => file.endsWith('.svg') }, worker: { format: 'es' } },
});
