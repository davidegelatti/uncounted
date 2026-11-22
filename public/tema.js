// Applica il tema scelto (chiaro o scuro) prima che la pagina venga disegnata, per evitare il lampo all'apertura.
// È l'unica cosa che il sito legge da localStorage senza che tu l'abbia chiesto: solo la preferenza del tema.
// Script esterno e sincrono: la CSP (script-src 'self') non cambia.
(function () {
  try {
    var t = localStorage.getItem('uncounted-tema');
    if (t === 'chiaro' || t === 'scuro') document.documentElement.setAttribute('data-tema', t);
  } catch (e) {
    /* archivio non disponibile: si segue il sistema */
  }
})();
