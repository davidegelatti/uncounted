// Pagina radice: porta alla lingua del browser. Senza JavaScript restano visibili i due collegamenti.
const lingue = navigator.languages?.length ? navigator.languages : [navigator.language || 'en'];
const italiano = lingue[0].toLowerCase().startsWith('it');
location.replace(`/${italiano ? 'it' : 'en'}/${location.hash}`);
