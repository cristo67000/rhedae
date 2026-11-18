/*
 * Les épreuves statiques : ce qu'on peut vérifier sans ouvrir de navigateur.
 *
 *     node build/essais_statiques.mjs
 *
 * — la coquille du service worker est exactement ce que la page charge, et
 *   tous ses fichiers existent ;
 * — la version est la même dans sw.js, index.html et data/manifeste.json ;
 * — la page ne porte ni style ni script en ligne (sa politique de sécurité les
 *   refuserait) ;
 * — chaque script est du JavaScript valide ;
 * — le dossier compilé tient debout : renvois, lieux dans le cadre de leur
 *   échelle, images présentes, parcours, chronologie dans l'ordre ;
 * — la carte a ses trois cadres, ses tracés et ses six images de relief.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
const existe = (f) => fs.existsSync(path.join(RACINE, f));

let reussies = 0;
const echecs = [];
function epreuve(nom, condition, detail) {
  if (condition) reussies += 1;
  else echecs.push(nom + (detail ? ' — ' + detail : ''));
}

/* ── La coquille ─────────────────────────────────────────────────────────── */

const html = lire('index.html');
const sw = lire('sw.js');
const version = /const VERSION = '([^']+)'/.exec(sw)[1];
epreuve('version identique dans sw.js et index.html', html.includes('name="application-version" content="' + version + '"'));

const coquille = new Set(Array.from(/const FICHIERS = \[([\s\S]*?)\];/.exec(sw)[1].matchAll(/'([^']+)'/g)).map((m) => m[1]));
const charges = new Set(['./', 'index.html', 'confidentialite.html', 'manifest.webmanifest']);
for (const m of html.matchAll(/<script src="([^"]+)"/g)) charges.add(m[1]);
for (const m of html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)) charges.add(m[1]);
for (const f of ['data/manifeste.json', 'data/dossier.json', 'data/carte.json']) charges.add(f);
const manifesteWeb = JSON.parse(lire('manifest.webmanifest'));
for (const icone of manifesteWeb.icons) charges.add(icone.src);
for (const cadre of ['region', 'razes', 'village']) for (const a of ['clair', 'nuit']) charges.add('img/relief-' + cadre + '-' + a + '.webp');
for (const f of charges) epreuve('coquille : ' + f + ' est dans sw.js', coquille.has(f));
for (const f of coquille) {
  epreuve('coquille : ' + f + ' est chargé par la page', charges.has(f));
  if (f !== './') epreuve('coquille : ' + f + ' existe', existe(f));
}

epreuve('index.html sans attribut style', !/\sstyle="/.test(html));
epreuve('index.html sans script en ligne', !/<script(?![^>]*\ssrc=)[^>]*>/.test(html));
epreuve('index.html sans gestionnaire en ligne', !/\son[a-z]+="/.test(html));
epreuve('politique de sécurité : connect-src \'self\'', html.includes("connect-src 'self'"));

for (const f of fs.readdirSync(path.join(RACINE, 'js')).filter((x) => x.endsWith('.js')).map((x) => 'js/' + x).concat(['sw.js'])) {
  let valide = true;
  try { execFileSync(process.execPath, ['--check', path.join(RACINE, f)], { stdio: 'pipe' }); } catch (e) { valide = false; }
  epreuve(f + ' est du JavaScript valide', valide);
  if (f !== 'sw.js') {
    const source = lire(f);
    epreuve(f + ' n\'écrit pas de HTML', !/\.innerHTML\s*=|insertAdjacentHTML|document\.write/.test(source));
  }
}

/* ── Le dossier ──────────────────────────────────────────────────────────── */

const dossier = JSON.parse(lire('data/dossier.json'));
const manifeste = JSON.parse(lire('data/manifeste.json'));
epreuve('manifeste de la même version', manifeste.version === version, manifeste.version + ' ≠ ' + version);
epreuve('manifeste : le compte des fiches', manifeste.articles === dossier.articles.length);

const ids = new Set(dossier.articles.map((a) => a.id));
epreuve('identifiants uniques', ids.size === dossier.articles.length);
const RENVOI = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
const CADRES = { village: [2.2585, 42.9245, 2.2685, 42.9305], razes: [2.08, 42.79, 2.52, 43.08], region: [1.50, 42.52, 3.12, 43.36] };
for (const a of dossier.articles) {
  const textes = [a.df, ...(a.tx || []), ...(a.po || []), ...(a.co || []), a.ve || '', a.og || '', a.at || '', a.vs || '', a.r || '',
    ...(a.rp || []).map((r) => r[1])];
  for (const t of textes) for (const m of t.matchAll(RENVOI)) epreuve(a.id + ' : renvoi vers ' + m[1], ids.has(m[1]));
  for (const v of a.vo || []) epreuve(a.id + ' : voir ' + v, ids.has(v));
  epreuve(a.id + ' : la définition ne contient pas de renvoi', !/\[\[/.test(a.df));
  epreuve(a.id + ' : au moins un paragraphe', (a.tx || []).length > 0);
  if (a.c === 'lieux') {
    const [lat, lon] = a.geo;
    const c = CADRES[a.ec];
    if (c) epreuve(a.id + ' : dans le cadre « ' + a.ec + ' »', lon >= c[0] && lon <= c[2] && lat >= c[1] && lat <= c[3], lat + ', ' + lon);
    else epreuve(a.id + ' : hors carte, des coordonnées plausibles', Math.abs(lat) <= 90 && Math.abs(lon) <= 180);
  }
  for (const im of a.im || []) epreuve(a.id + ' : image ' + im, !!dossier.images[im] && existe('img/' + im + '.webp'));
  for (const l of a.lk || []) epreuve(a.id + ' : lien en https', /^https:\/\//.test(l.u), l.u);
}
for (const cat of dossier.categories) {
  epreuve('rubrique « ' + cat.nom + ' » non vide', dossier.articles.some((a) => a.c === cat.id));
}
epreuve('des parcours', dossier.parcours.length > 0);
for (const p of dossier.parcours) {
  for (const e of p.etapes) epreuve('parcours ' + p.id + ' : étape ' + e, ids.has(e));
}
epreuve('une chronologie', dossier.epoques.length >= 4);
for (const e of dossier.epoques) {
  let avant = -Infinity;
  for (const ev of e.ev) {
    epreuve('chronologie « ' + e.nom + ' » : ' + ev.d + ' à sa place', ev.a >= avant);
    avant = ev.a;
    for (const m of ev.t.matchAll(RENVOI)) epreuve('chronologie : renvoi vers ' + m[1], ids.has(m[1]));
  }
}
// l'accueil cite quelques fiches en dur : elles doivent exister
for (const m of lire('js/liste.js').matchAll(RENVOI)) epreuve('accueil : renvoi vers ' + m[1], ids.has(m[1]));
epreuve('la fiche « rennes-le-chateau » existe (la carte s\'y repère)', ids.has('rennes-le-chateau'));

/* ── La carte ────────────────────────────────────────────────────────────── */

const carte = JSON.parse(lire('data/carte.json'));
for (const cadre of ['region', 'razes', 'village']) {
  epreuve('carte : cadre « ' + cadre + ' »', !!carte.cadres[cadre] && carte.cadres[cadre].boite.length === 4);
  epreuve('carte : tracés « ' + cadre + ' »', !!carte[cadre]);
}
epreuve('carte : des rivières et des routes', carte.razes.eaux.length > 50 && carte.razes.routes.length > 100);
epreuve('carte : le bâti du village', carte.village.batis.length > 50);

/* ── Bilan ───────────────────────────────────────────────────────────────── */

if (echecs.length) {
  console.error(echecs.join('\n'));
  console.error('\n' + echecs.length + ' épreuve(s) manquée(s), ' + reussies + ' réussies.');
  process.exit(1);
}
console.log(reussies + ' épreuves réussies.');
