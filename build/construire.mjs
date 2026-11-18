/*
 * Construit data/dossier.json à partir des sources de build/.
 *
 *     node build/construire.mjs                 tout le dossier
 *     node build/construire.mjs --verifier build/articles/20-lieux.txt
 *                                               un seul fichier, les renvois étant
 *                                               vérifiés contre build/plan.txt
 *
 * ── Le format d'un article (build/articles/*.txt) ───────────────────────────
 *
 * Une ligne « clé: valeur » par champ ; une ligne qui commence par deux espaces
 * continue le champ précédent ; « # » ouvre un commentaire.
 *
 *     @ berenger-sauniere           l'identifiant (minuscules, chiffres, tirets)
 *     cat: personnages              la rubrique (voir CATEGORIES)
 *     groupe: pretres               la sous-rubrique (voir GROUPES)
 *     nom: Bérenger Saunière        la vedette
 *     alias: abbé Saunière, …       autres noms que trouve la recherche
 *     dates: 1852 – 1917            (facultatif) ce qu'on lit sous la vedette
 *     an: 1852                      (facultatif) une année, pour ranger par date
 *     role: Curé de Rennes-le-…     (personnages) qui c'est, en une ligne
 *     def: Une phrase.              la définition courte
 *     texte: Un paragraphe…         le corps ; un « texte: » par paragraphe
 *     repere: 1885 — Un fait.       (facultatif) une date ; dans l'ordre
 *     oeuvres: Titre (1967) ; …     (facultatif) livres, films
 *     attention: …                  (facultatif) « à ne pas confondre »
 *     voir: id, id                  les fiches voisines
 *
 *   un lieu porte en plus :
 *     geo: 42.9280, 2.2628          latitude, longitude (degrés décimaux)
 *     lieu: Rennes-le-Château, Aude où il se trouve, en clair
 *     type: eglise                  voir TYPES_DE_LIEU : le signe sur la carte
 *     echelle: village              village | razes | region | ailleurs : à partir
 *                                   de quel cadre de la carte le point se montre
 *                                   (« ailleurs » : hors de la carte, Paris, Stenay…)
 *     voir-sur-place: …             (facultatif) ce qu'on y voit aujourd'hui
 *
 *   une hypothèse porte en plus :
 *     statut: etabli                etabli | plausible | fragile | legende | mystification
 *     origine: Qui, quand.          d'où vient l'idée
 *     pour: Un argument.            un « pour: » par argument
 *     contre: Une objection.        un « contre: » par objection
 *     verdict: La conclusion.       ce qu'en retient l'histoire
 *
 *   une pièce du dossier peut porter :
 *     statut: authentique           authentique | discute | disparu | faux
 *
 * Dans « def », « texte », « repere », « attention », « pour », « contre »,
 * « verdict », « origine », « voir-sur-place » :
 *
 *     [[id]]           renvoi, affiché sous le nom de la fiche
 *     [[id|texte]]     renvoi affiché sous un autre texte
 *     *titre*          italique : titres d'œuvres, mots étrangers
 *
 * ── La chronologie (build/chronologie.txt) : format en tête du fichier ──────
 * ── Les liens extérieurs (build/liens.txt) : format en tête du fichier ──────
 * ── Les parcours (build/parcours.txt) : format en tête du fichier ───────────
 *
 * Le script échoue à la moindre incohérence — identifiant en double, renvoi
 * vers une fiche qui n'existe pas, italique mal fermée, lieu sans coordonnées,
 * repères dans le désordre : une erreur de contenu ne doit pas arriver dans le
 * téléphone de quelqu'un.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.dirname(ICI);

export const CATEGORIES = [
  { id: 'personnages', nom: 'Personnages', un: 'Personnage' },
  { id: 'lieux',       nom: 'Lieux', un: 'Lieu' },
  { id: 'hypotheses',  nom: 'Hypothèses', un: 'Hypothèse' },
  { id: 'pieces',      nom: 'Pièces du dossier', un: 'Pièce du dossier' },
  { id: 'contexte',    nom: 'Contexte historique', un: 'Contexte' },
  { id: 'oeuvres',     nom: 'Livres et films', un: 'Livre ou film' },
];

/* Les sous-rubriques : l'ordre est celui de l'affichage. */
export const GROUPES = {
  personnages: [
    { id: 'pretres',    nom: 'Les prêtres du Razès' },
    { id: 'entourage',  nom: 'L’entourage de Saunière' },
    { id: 'eglise',     nom: 'Les évêques et l’Église' },
    { id: 'seigneurs',  nom: 'Seigneurs et dames du lieu' },
    { id: 'histoire',   nom: 'Figures de l’histoire et de la légende' },
    { id: 'artistes',   nom: 'Peintres, écrivains, artistes' },
    { id: 'inventeurs', nom: 'Les fabricants du mythe' },
    { id: 'auteurs',    nom: 'Auteurs et chercheurs de trésor' },
    { id: 'critiques',  nom: 'Historiens et enquêteurs' },
    { id: 'politique',  nom: 'Ombres portées du XXe siècle' },
  ],
  lieux: [
    { id: 'village',  nom: 'Dans le village' },
    { id: 'razes',    nom: 'Le Haut-Razès' },
    { id: 'region',   nom: 'Du pays cathare à la mer' },
    { id: 'ailleurs', nom: 'Ailleurs' },
  ],
  hypotheses: [
    { id: 'argent',   nom: 'D’où venait l’argent ?' },
    { id: 'tresors',  nom: 'Les trésors' },
    { id: 'secrets',  nom: 'Les secrets' },
    { id: 'paysage',  nom: 'Le paysage et les signes' },
    { id: 'marges',   nom: 'Aux marges' },
  ],
  pieces: [
    { id: 'eglise',    nom: 'L’église et son décor' },
    { id: 'pierres',   nom: 'Pierres et tombes' },
    { id: 'papiers',   nom: 'Papiers, comptes et parchemins' },
    { id: 'signes',    nom: 'Dates, devises et signes' },
  ],
  contexte: [
    { id: 'ancien',   nom: 'Des Wisigoths aux Hautpoul' },
    { id: 'siecle',   nom: 'Le siècle de Saunière' },
    { id: 'mythe',    nom: 'La fabrique d’un mythe' },
  ],
  oeuvres: [
    { id: 'sources',  nom: 'Avant le mythe' },
    { id: 'mythe',    nom: 'Les livres du mythe' },
    { id: 'critique', nom: 'Les enquêtes critiques' },
    { id: 'fiction',  nom: 'Romans et films' },
  ],
};

export const TYPES_DE_LIEU = ['village', 'ville', 'eglise', 'chateau', 'ruine', 'tour', 'maison', 'sommet', 'source',
  'rocher', 'tombeau', 'abbaye', 'cimetiere', 'jardin', 'grotte', 'pont', 'site', 'musee'];
const ECHELLES = ['village', 'razes', 'region', 'ailleurs'];
const STATUTS = {
  hypotheses: ['etabli', 'plausible', 'fragile', 'legende', 'mystification'],
  pieces: ['authentique', 'discute', 'disparu', 'faux'],
};
export const NATURES = ['atteste', 'discute', 'legende', 'fabrique'];

const CHAMPS = new Set(['cat', 'groupe', 'nom', 'alias', 'dates', 'an', 'role', 'def', 'texte', 'repere', 'oeuvres', 'attention',
  'voir', 'geo', 'lieu', 'type', 'echelle', 'voir-sur-place', 'statut', 'origine', 'pour', 'contre', 'verdict']);
const MULTIPLES = new Set(['texte', 'repere', 'pour', 'contre']);
const AVEC_BALISES = ['def', 'texte', 'repere', 'attention', 'pour', 'contre', 'verdict', 'origine', 'voir-sur-place', 'role'];

const erreurs = [];
const erreur = (ou, quoi) => erreurs.push(ou + ' — ' + quoi);

/* ── Lecture d'un fichier d'articles ─────────────────────────────────────── */

function lireArticles(fichier) {
  const nomFichier = path.basename(fichier);
  const lignes = fs.readFileSync(fichier, 'utf8').replace(/^﻿/, '').split(/\r?\n/);
  const articles = [];
  let courant = null;
  let dernier = null;       // { cle, rang } : le champ que prolonge une ligne indentée
  lignes.forEach((ligne, i) => {
    const ou = nomFichier + ':' + (i + 1);
    if (/^\s*#/.test(ligne) || !ligne.trim()) { if (!ligne.trim()) dernier = null; return; }
    if (ligne.startsWith('@')) {
      const id = ligne.slice(1).trim();
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) erreur(ou, 'identifiant mal formé : « ' + id + ' »');
      courant = { id, _ou: ou, _champs: {} };
      articles.push(courant);
      dernier = null;
      return;
    }
    if (!courant) { erreur(ou, 'ligne hors de tout article'); return; }
    if (/^ {2,}\S/.test(ligne)) {
      if (!dernier) { erreur(ou, 'ligne de suite sans champ à continuer'); return; }
      const c = courant._champs[dernier.cle];
      if (MULTIPLES.has(dernier.cle)) c[dernier.rang] += ' ' + ligne.trim();
      else courant._champs[dernier.cle] = c + ' ' + ligne.trim();
      return;
    }
    const m = /^([a-z-]+):\s*(.*)$/.exec(ligne);
    if (!m) { erreur(ou, 'ligne illisible : « ' + ligne.slice(0, 60) + ' »'); return; }
    const [, cle, valeur] = m;
    if (!CHAMPS.has(cle)) { erreur(ou, 'champ inconnu : « ' + cle + ' »'); return; }
    if (MULTIPLES.has(cle)) {
      (courant._champs[cle] = courant._champs[cle] || []).push(valeur.trim());
      dernier = { cle, rang: courant._champs[cle].length - 1 };
    } else {
      if (courant._champs[cle] !== undefined) erreur(ou, 'champ en double : « ' + cle + ' »');
      courant._champs[cle] = valeur.trim();
      dernier = { cle };
    }
  });
  return articles;
}

/* ── Vérifications ───────────────────────────────────────────────────────── */

const RENVOI = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

function verifierBalises(ou, champ, texte, connus) {
  const sansRenvois = texte.replace(RENVOI, (tout, id, libelle) => {
    if (!connus.has(id.trim())) erreur(ou, champ + ' : renvoi vers une fiche inconnue, « ' + id + ' »');
    if (id !== id.trim()) erreur(ou, champ + ' : espace dans le renvoi « ' + id + ' »');
    return libelle || 'x';
  });
  if (/\[\[|\]\]/.test(sansRenvois)) erreur(ou, champ + ' : crochets mal fermés');
  if ((sansRenvois.match(/\*/g) || []).length % 2) erreur(ou, champ + ' : italique mal fermée');
  if (/\s{2,}/.test(texte)) erreur(ou, champ + ' : espaces doubles');
  if (/[<>]/.test(texte)) erreur(ou, champ + ' : chevron interdit');
}

/* L'année d'un repère : « 1885 », « vers 1244 », « 1er juin 1885 », « 17 janvier 1781 »,
 * « VIe siècle », « 410 », « 1901-1906 ». Sert à vérifier l'ordre. */
const ROMAINS = { I: 1, V: 5, X: 10, L: 50 };
function romain(s) {
  let total = 0;
  for (let i = 0; i < s.length; i += 1) {
    const v = ROMAINS[s[i]]; const suivant = ROMAINS[s[i + 1]] || 0;
    total += v < suivant ? -v : v;
  }
  return total;
}
function anneeDe(date) {
  const avant = /av\.\s*J\.-C\./.test(date);
  const siecle = /([IVXL]+)(?:e|ᵉ|er)\s+siècle/.exec(date);
  if (siecle) { const n = romain(siecle[1]); return avant ? -(n * 100) + 50 : (n - 1) * 100 + 50; }
  const annees = date.match(/\d{3,4}/g) || date.match(/\d{1,4}/g);
  if (!annees) return null;
  // « 22 janvier 1917 » : l'année est le nombre de trois ou quatre chiffres
  const an = Number((date.match(/\d{3,4}/) || annees)[0]);
  return avant ? -an : an;
}

function verifierArticle(a, connus) {
  const c = a._champs;
  const ou = a._ou + ' (' + a.id + ')';
  for (const cle of ['cat', 'nom', 'def']) if (!c[cle]) erreur(ou, 'champ manquant : ' + cle);
  if (!c.texte || !c.texte.length) erreur(ou, 'aucun paragraphe « texte: »');
  const cat = c.cat;
  if (cat && !CATEGORIES.some((x) => x.id === cat)) { erreur(ou, 'rubrique inconnue : ' + cat); return; }
  if (cat) {
    if (!c.groupe) erreur(ou, 'champ manquant : groupe');
    else if (!GROUPES[cat].some((g) => g.id === c.groupe)) erreur(ou, 'groupe inconnu pour ' + cat + ' : ' + c.groupe);
  }
  if (c.def && !/[.!?…»]$/.test(c.def)) erreur(ou, 'la définition ne finit pas par un point');
  if (c.an !== undefined && !/^-?\d{1,4}$/.test(c.an)) erreur(ou, '« an » n’est pas une année : ' + c.an);

  if (cat === 'lieux') {
    if (!c.geo || !/^-?\d+\.\d{3,},\s*-?\d+\.\d{3,}$/.test(c.geo)) erreur(ou, 'un lieu demande « geo: latitude, longitude » (trois décimales au moins)');
    if (!c.lieu) erreur(ou, 'un lieu demande « lieu: »');
    if (!TYPES_DE_LIEU.includes(c.type)) erreur(ou, 'type de lieu inconnu : ' + c.type);
    if (!ECHELLES.includes(c.echelle)) erreur(ou, 'échelle inconnue : ' + c.echelle);
    if (c.echelle !== c.groupe) erreur(ou, 'pour un lieu, « groupe » et « echelle » doivent être identiques');
  } else {
    for (const cle of ['geo', 'lieu', 'type', 'echelle', 'voir-sur-place']) if (c[cle] !== undefined) erreur(ou, '« ' + cle + ' » est réservé aux lieux');
  }
  if (cat === 'hypotheses') {
    if (!STATUTS.hypotheses.includes(c.statut)) erreur(ou, 'statut d’hypothèse inconnu : ' + c.statut);
    if (!c.origine) erreur(ou, 'une hypothèse demande « origine: »');
    if (!c.verdict) erreur(ou, 'une hypothèse demande « verdict: »');
    if (!c.pour || !c.pour.length) erreur(ou, 'une hypothèse demande au moins un « pour: »');
    if (!c.contre || !c.contre.length) erreur(ou, 'une hypothèse demande au moins un « contre: »');
  } else {
    for (const cle of ['origine', 'pour', 'contre', 'verdict']) if (c[cle] !== undefined) erreur(ou, '« ' + cle + ' » est réservé aux hypothèses');
    if (c.statut !== undefined && cat !== 'pieces') erreur(ou, '« statut » est réservé aux hypothèses et aux pièces');
  }
  if (cat === 'pieces' && c.statut !== undefined && !STATUTS.pieces.includes(c.statut)) erreur(ou, 'statut de pièce inconnu : ' + c.statut);
  if (cat === 'personnages' && !c.role) erreur(ou, 'un personnage demande « role: »');

  for (const champ of AVEC_BALISES) {
    const v = c[champ];
    if (v === undefined) continue;
    for (const t of Array.isArray(v) ? v : [v]) verifierBalises(ou, champ, t, connus);
  }
  let precedent = -Infinity;
  for (const r of c.repere || []) {
    const m = /^(.+?) — (.+)$/.exec(r);
    if (!m) { erreur(ou, 'repère mal formé (« date — fait. ») : ' + r.slice(0, 50)); continue; }
    if (!/[.!?»]$/.test(m[2])) erreur(ou, 'repère sans point final : ' + r.slice(0, 50));
    const an = anneeDe(m[1]);
    if (an === null) erreur(ou, 'repère sans année lisible : ' + m[1]);
    else if (an < precedent) erreur(ou, 'repères dans le désordre : ' + m[1]);
    else precedent = an;
  }
  for (const id of (c.voir || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    if (!connus.has(id)) erreur(ou, 'voir : fiche inconnue, « ' + id + ' »');
    if (id === a.id) erreur(ou, 'voir : la fiche se cite elle-même');
  }
}

/* ── Mode « --verifier » : un fichier, contre le plan ────────────────────── */

function idsDuPlan() {
  const fichier = path.join(ICI, 'plan.txt');
  const ids = new Set();
  if (!fs.existsSync(fichier)) return ids;
  for (const ligne of fs.readFileSync(fichier, 'utf8').split(/\r?\n/)) {
    const m = /^([a-z0-9-]+)\s*\|/.exec(ligne);
    if (m) ids.add(m[1]);
  }
  return ids;
}

const iVerif = process.argv.indexOf('--verifier');
if (iVerif !== -1) {
  const connus = idsDuPlan();
  for (const fichier of process.argv.slice(iVerif + 1)) {
    const articles = lireArticles(path.resolve(fichier));
    const vus = new Set();
    for (const a of articles) {
      if (vus.has(a.id)) erreur(a._ou, 'identifiant en double : ' + a.id);
      vus.add(a.id);
      if (!connus.has(a.id)) erreur(a._ou, 'identifiant absent de build/plan.txt : ' + a.id);
      verifierArticle(a, connus);
    }
    console.log(path.basename(fichier) + ' : ' + articles.length + ' fiches');
  }
  if (erreurs.length) { console.error(erreurs.join('\n')); console.error('\n' + erreurs.length + ' défaut(s).'); process.exit(1); }
  console.log('Rien à redire.');
  process.exit(0);
}

/* ── Le dossier entier ───────────────────────────────────────────────────── */

const dossierArticles = path.join(ICI, 'articles');
const bruts = [];
for (const nom of fs.readdirSync(dossierArticles).filter((f) => f.endsWith('.txt')).sort()) {
  bruts.push(...lireArticles(path.join(dossierArticles, nom)));
}
const connus = new Set();
for (const a of bruts) {
  if (connus.has(a.id)) erreur(a._ou, 'identifiant en double : ' + a.id);
  connus.add(a.id);
}
for (const a of bruts) verifierArticle(a, connus);

/* Les liens extérieurs. */
const liens = {};
/* build/liens.txt, et tout fichier build/liens-*.txt : même format. */
for (const nomLiens of fs.readdirSync(ICI).filter((f) => /^liens(-[a-z0-9-]+)?\.txt$/.test(f)).sort()) {
  fs.readFileSync(path.join(ICI, nomLiens), 'utf8').replace(/^﻿/, '').split(/\r?\n/).forEach((ligne, i) => {
    if (!ligne.trim() || ligne.startsWith('#')) return;
    const ou = nomLiens + ':' + (i + 1);
    const m = /^([a-z0-9-]+):\s*(.+)$/.exec(ligne);
    if (!m) { erreur(ou, 'ligne illisible'); return; }
    if (!connus.has(m[1])) { erreur(ou, 'fiche inconnue : ' + m[1]); return; }
    if (m[2].trim() === '-') return;
    if (liens[m[1]]) { erreur(ou, 'liens en double pour ' + m[1]); return; }
    liens[m[1]] = m[2].split(' | ').map((brut) => {
      const [gauche, libelle] = brut.split(' = ').map((s) => s.trim());
      const esp = gauche.indexOf(' ');
      const genre = esp === -1 ? gauche : gauche.slice(0, esp);
      const cible = esp === -1 ? '' : gauche.slice(esp + 1).trim();
      const wiki = (langue, titre) => 'https://' + langue + '.wikipedia.org/wiki/' + encodeURIComponent(titre.replace(/ /g, '_'));
      switch (genre) {
        case 'wp': return { u: wiki('fr', cible), l: libelle || 'Wikipédia : ' + cible };
        case 'en': return { u: wiki('en', cible), l: libelle || 'Wikipedia (en anglais) : ' + cible };
        case 'ws': return { u: 'https://fr.wikisource.org/wiki/' + encodeURIComponent(cible.replace(/ /g, '_')), l: libelle || 'Wikisource : ' + cible };
        case 'gallica': return { u: 'https://gallica.bnf.fr/ark:/12148/' + cible, l: libelle || 'Gallica (BnF)' };
        case 'ia': return { u: 'https://archive.org/details/' + cible, l: libelle || 'Internet Archive' };
        case 'commons': return { u: 'https://commons.wikimedia.org/wiki/' + encodeURIComponent(cible.replace(/ /g, '_')), l: libelle || 'Wikimedia Commons : ' + cible };
        case 'url':
          if (!/^https:\/\//.test(cible)) erreur(ou, 'adresse sans https : ' + cible);
          if (!libelle) erreur(ou, 'un lien « url » demande un libellé (« = … »)');
          return { u: cible, l: libelle || cible };
        default: erreur(ou, 'genre de lien inconnu : ' + genre); return null;
      }
    }).filter(Boolean);
  });
}

/* Les illustrations (build/illustrations.json, écrit par build/illustrer.py). */
const images = {};
const imagesPar = {};
const fichierImages = path.join(ICI, 'illustrations.json');
if (fs.existsSync(fichierImages)) {
  const index = JSON.parse(fs.readFileSync(fichierImages, 'utf8'));
  for (const im of index.images || []) {
    if (!fs.existsSync(path.join(RACINE, 'img', im.id + '.webp'))) { erreur('illustrations.json', 'fichier absent : img/' + im.id + '.webp'); continue; }
    images[im.id] = { l: im.legende, c: im.credit, w: im.largeur, h: im.hauteur, v: im.empreinte, s: im.source };
    for (const id of im.pour || []) {
      if (!connus.has(id)) { erreur('illustrations.txt', im.id + ' : fiche inconnue, « ' + id + ' »'); continue; }
      (imagesPar[id] = imagesPar[id] || []).push(im.id);
    }
  }
}

/* La chronologie. */
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
function libelleDate(brut) {
  const vers = brut.startsWith('~');
  const d = vers ? brut.slice(1) : brut;
  const m = /^(-?\d{1,4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(d);
  if (!m) return null;
  const an = Number(m[1]);
  let texte = an < 0 ? Math.abs(an) + ' av. J.-C.' : String(an);
  if (m[2]) texte = MOIS[Number(m[2]) - 1] + ' ' + texte;
  if (m[3]) texte = (Number(m[3]) === 1 ? '1er' : String(Number(m[3]))) + ' ' + texte;
  // une année seule se range après les jours datés de la même année
  return { an, tri: an * 10000 + (m[2] ? Number(m[2]) * 100 + Number(m[3] || 0) : 9999), texte: (vers ? 'vers ' : '') + texte };
}
const epoques = [];
const fichierChrono = path.join(ICI, 'chronologie.txt');
if (fs.existsSync(fichierChrono)) {
  let epoque = null;
  fs.readFileSync(fichierChrono, 'utf8').split(/\r?\n/).forEach((ligne, i) => {
    if (!ligne.trim() || ligne.startsWith('#')) return;
    const ou = 'chronologie.txt:' + (i + 1);
    if (ligne.startsWith('=')) {
      const [id, nom, def] = ligne.slice(1).split('|').map((s) => s.trim());
      if (!id || !nom || !def) { erreur(ou, 'époque mal formée (« = id | nom | une phrase »)'); return; }
      epoque = { id, nom, def, ev: [] };
      epoques.push(epoque);
      return;
    }
    if (!epoque) { erreur(ou, 'événement avant toute époque'); return; }
    const parts = ligne.split(' | ');
    if (parts.length < 3) { erreur(ou, 'événement mal formé (« date | nature | texte »)'); return; }
    let [date, nature] = parts.map((s) => s.trim());
    const texte = parts.slice(2).join(' | ').trim();
    let libelle = null;
    if (date.includes(' = ')) { [date, libelle] = date.split(' = ').map((s) => s.trim()); }
    const d = libelleDate(date);
    if (!d) { erreur(ou, 'date illisible : ' + date); return; }
    if (!NATURES.includes(nature)) erreur(ou, 'nature inconnue : ' + nature);
    if (!/[.!?»]$/.test(texte)) erreur(ou, 'événement sans point final');
    verifierBalises(ou, 'événement', texte, connus);
    const dernier = epoque.ev[epoque.ev.length - 1];
    if (dernier && d.tri < dernier._tri) erreur(ou, 'événements dans le désordre : ' + date);
    epoque.ev.push({ a: d.an, d: libelle || d.texte, n: nature, t: texte, _tri: d.tri });
  });
  for (const e of epoques) for (const ev of e.ev) delete ev._tri;
}

/* Les parcours guidés. */
const parcours = [];
const fichierParcours = path.join(ICI, 'parcours.txt');
if (fs.existsSync(fichierParcours)) {
  let courant = null;
  let dernier = null;
  fs.readFileSync(fichierParcours, 'utf8').split(/\r?\n/).forEach((ligne, i) => {
    if (!ligne.trim() || ligne.startsWith('#')) return;
    const ou = 'parcours.txt:' + (i + 1);
    if (ligne.startsWith('=')) { courant = { id: ligne.slice(1).trim(), nom: '', def: '', etapes: '' }; parcours.push(courant); dernier = null; return; }
    if (!courant) { erreur(ou, 'ligne hors de tout parcours'); return; }
    if (/^ {2,}\S/.test(ligne) && dernier) { courant[dernier] += ' ' + ligne.trim(); return; }
    const m = /^(nom|def|etapes):\s*(.*)$/.exec(ligne);
    if (!m) { erreur(ou, 'ligne illisible'); return; }
    courant[m[1]] = m[2].trim(); dernier = m[1];
  });
  for (const p of parcours) {
    p.etapes = p.etapes.split(',').map((s) => s.trim()).filter(Boolean);
    if (!p.nom || !p.def || p.etapes.length < 4) erreur('parcours.txt', p.id + ' : nom, def et au moins quatre étapes');
    for (const id of p.etapes) if (!connus.has(id)) erreur('parcours.txt', p.id + ' : étape inconnue, « ' + id + ' »');
    if (new Set(p.etapes).size !== p.etapes.length) erreur('parcours.txt', p.id + ' : une étape revient deux fois');
  }
}

if (erreurs.length) {
  console.error(erreurs.join('\n'));
  console.error('\n' + erreurs.length + ' défaut(s) : rien n’a été écrit.');
  process.exit(1);
}

/* ── Écriture ────────────────────────────────────────────────────────────── */

const liste = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);
const articles = bruts.map((a) => {
  const c = a._champs;
  const o = { id: a.id, c: c.cat, g: c.groupe, n: c.nom, df: c.def, tx: c.texte };
  if (c.alias) o.al = liste(c.alias);
  if (c.dates) o.d = c.dates;
  if (c.an !== undefined) o.an = Number(c.an);
  if (c.role) o.r = c.role;
  if (c.repere) o.rp = c.repere.map((r) => { const m = /^(.+?) — (.+)$/.exec(r); return [m[1], m[2]]; });
  if (c.oeuvres) o.oe = c.oeuvres.split(' ; ').map((s) => s.trim()).filter(Boolean);
  if (c.attention) o.at = c.attention;
  if (c.geo) { o.geo = c.geo.split(',').map((s) => Number(s.trim())); o.li = c.lieu; o.ty = c.type; o.ec = c.echelle; }
  if (c['voir-sur-place']) o.vs = c['voir-sur-place'];
  if (c.statut) o.st = c.statut;
  if (c.origine) o.og = c.origine;
  if (c.pour) o.po = c.pour;
  if (c.contre) o.co = c.contre;
  if (c.verdict) o.ve = c.verdict;
  if (c.voir) o.vo = liste(c.voir);
  if (liens[a.id]) o.lk = liens[a.id];
  if (imagesPar[a.id]) o.im = imagesPar[a.id];
  return o;
});

const dossier = { categories: CATEGORIES, groupes: GROUPES, articles, epoques, parcours, images };
const json = JSON.stringify(dossier);
const empreinte = crypto.createHash('sha256').update(json).digest('hex').slice(0, 12);
fs.mkdirSync(path.join(RACINE, 'data'), { recursive: true });
fs.writeFileSync(path.join(RACINE, 'data', 'dossier.json'), json);
const version = /const VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(RACINE, 'sw.js'), 'utf8'));
fs.writeFileSync(path.join(RACINE, 'data', 'manifeste.json'), JSON.stringify({
  version: version ? version[1] : '?', articles: articles.length, empreinte, construit: new Date().toISOString().slice(0, 10),
}));

/* Le rapport : ce que contient le dossier, et ce qui lui manque encore. */
const mots = (o) => [o.df, ...(o.tx || []), ...(o.po || []), ...(o.co || []), o.ve || ''].join(' ').split(/\s+/).length;
const rapport = [];
rapport.push('Rhedae — rapport de construction du ' + new Date().toISOString().slice(0, 10));
rapport.push('');
rapport.push(articles.length + ' fiches, ' + articles.reduce((s, o) => s + mots(o), 0).toLocaleString('fr-FR') + ' mots, '
  + epoques.reduce((s, e) => s + e.ev.length, 0) + ' dates dans la chronologie, ' + Object.keys(images).length + ' illustrations.');
for (const cat of CATEGORIES) {
  const n = articles.filter((o) => o.c === cat.id);
  rapport.push('  ' + cat.nom + ' : ' + n.length + ' (' + GROUPES[cat.id].map((g) => g.nom + ' ' + n.filter((o) => o.g === g.id).length).join(' ; ') + ')');
}
const cites = new Set();
for (const o of articles) {
  for (const id of o.vo || []) cites.add(id);
  for (const t of [o.df, ...(o.tx || [])]) for (const m of t.matchAll(RENVOI)) cites.add(m[1]);
}
const orphelins = articles.filter((o) => !cites.has(o.id)).map((o) => o.id);
rapport.push('');
rapport.push('Fiches que personne ne cite (' + orphelins.length + ') : ' + (orphelins.join(', ') || '—'));
rapport.push('Fiches sans lien extérieur : ' + (articles.filter((o) => !o.lk).map((o) => o.id).join(', ') || '—'));
rapport.push('Fiches sans illustration : ' + articles.filter((o) => !o.im).length);
const planIds = idsDuPlan();
if (planIds.size) {
  const manquent = [...planIds].filter((id) => !connus.has(id));
  rapport.push('Prévues au plan et pas encore écrites (' + manquent.length + ') : ' + (manquent.join(', ') || '—'));
}
fs.writeFileSync(path.join(ICI, 'rapport.txt'), rapport.join('\n') + '\n');
console.log(rapport.slice(2, 3 + CATEGORIES.length).join('\n'));
console.log('data/dossier.json  ' + Math.round(json.length / 1024) + ' Ko  (' + empreinte + ')');
