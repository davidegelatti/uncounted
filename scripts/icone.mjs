// Genera src/styles/icone.css dalle icone SVG in src/icone/ (Lucide, licenza ISC).
// Ogni icona diventa una classe .ic-<nome>, da usare insieme a .ic: <span class="ic ic-eye"></span>,
// oppure su un elemento che ha già testo (l'icona compare prima del testo).
// Le icone sono maschere CSS: prendono il colore del testo (currentColor) e non hanno stili in linea.
// Uso: node scripts/icone.mjs
import { readdirSync, writeFileSync } from 'node:fs';

const nomi = readdirSync(new URL('../src/icone/', import.meta.url)).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)).sort();
const css = `/* Generato da scripts/icone.mjs: non modificare a mano. Icone Lucide (ISC), file in src/icone/. */
.ic::before, .ic-prima::before {
  content: '';
  display: inline-block;
  flex: none;
  width: var(--ic-dim, 1em);
  height: var(--ic-dim, 1em);
  background-color: currentColor;
  -webkit-mask: var(--ic) center / contain no-repeat;
  mask: var(--ic) center / contain no-repeat;
  vertical-align: -0.14em;
}
.ic-prima::before { margin-right: 0.45em; }
${nomi.map((n) => `.ic-${n} { --ic: url('../icone/${n}.svg'); }`).join('\n')}
`;
writeFileSync(new URL('../src/styles/icone.css', import.meta.url), css);
console.log(`icone.css: ${nomi.length} icone`);
