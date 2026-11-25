/*
 * La maquette de l'église, hors de l'application.
 *
 *     node build/maquette.mjs            # éprouve la maquette, puis l'exporte
 *     node build/maquette.mjs --essai    # éprouve seulement
 *
 * La maquette elle-même est dans js/eglise.js, bâtie avec js/maquette.js : ce
 * script les charge tels quels (ils ne touchent pas à l'écran tant qu'on ne
 * pose rien), vérifie que chaque état tient debout — pas de nombre manquant,
 * rien hors des bornes, chaque repère vers une fiche qui existe —, puis écrit
 * un fichier glTF binaire par état dans build/maquette/ :
 *
 *     eglise-1885.glb · eglise-1892.glb · eglise-2026.glb
 *
 * Ces fichiers s'ouvrent dans Blender, dans three.js, dans la visionneuse 3D
 * de Windows… Un maillage par groupe (abords, ext, int, mobilier), les
 * couleurs aux sommets. Les matières dessinées par l'application (moellon,
 * tuiles, damier, vitrail) n'y sont pas : elles vivent dans son nuanceur.
 * Repère du fichier : celui de glTF, y vers le haut, en mètres ; x vers l'est,
 * z vers le sud.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
require(path.join(RACINE, 'js/maquette.js'));
require(path.join(RACINE, 'js/eglise.js'));
const { Eglise } = globalThis;

const echecs = [];
let reussies = 0;
function epreuve(nom, condition, detail) {
  if (condition) reussies += 1;
  else echecs.push(nom + (detail ? ' — ' + detail : ''));
}

const dossier = JSON.parse(fs.readFileSync(path.join(RACINE, 'data/dossier.json'), 'utf8'));
const fiches = new Set(dossier.articles.map((a) => a.id));
const visite = fs.readFileSync(path.join(RACINE, 'js/visite.js'), 'utf8');
const entrees = Array.from(/const ENTREES = \{([\s\S]*?)\};/.exec(visite)[1].matchAll(/'([^']+)':\s*\['(\w+)',\s*(?:null|'([^']+)')\]/g)).map((m) => [m[1], m[3] || null, m[2]]);
require(path.join(RACINE, 'js/village-plan.js'));
require(path.join(RACINE, 'js/village.js'));
const { Village, VillagePlan } = globalThis;

const etats = {};
for (const { annee } of Eglise.EPOQUES) {
  const m = Eglise.construire(annee);
  etats[annee] = m;
  let triangles = 0;
  for (const [nom, g] of Object.entries(m.groupes)) {
    triangles += g.triangles();
    epreuve(annee + ' · ' + nom + ' : des triangles', g.triangles() > 0);
    epreuve(annee + ' · ' + nom + ' : des nombres partout', g.pos.every(Number.isFinite) && g.nor.every(Number.isFinite));
    epreuve(annee + ' · ' + nom + ' : autant de normales et de couleurs que de sommets', g.nor.length === g.pos.length && g.cou.length === g.pos.length / 3 * 4);
    let dehors = 0;
    for (let i = 0; i < g.pos.length; i += 3) {
      if (g.pos[i] < -32 || g.pos[i] > 46 || g.pos[i + 1] < (nom === 'crypte' ? -3.5 : -0.1) || g.pos[i + 1] > 16 || g.pos[i + 2] < -26 || g.pos[i + 2] > 32) dehors += 1;
    }
    epreuve(annee + ' · ' + nom + ' : tout tient dans le terrain', dehors === 0, dehors + ' sommet(s) dehors');
  }
  epreuve(annee + ' : une maquette légère', triangles < 40000, triangles + ' triangles');
  const ids = new Set();
  for (const r of m.reperes) {
    epreuve(annee + ' · repère ' + r.id + ' : unique', !ids.has(r.id));
    ids.add(r.id);
    epreuve(annee + ' · repère ' + r.id + ' : sa fiche existe', !r.fiche || fiches.has(r.fiche), r.fiche);
    epreuve(annee + ' · repère ' + r.id + ' : sa vue existe', !r.vue || !!m.vues[r.vue], r.vue);
    epreuve(annee + ' · repère ' + r.id + ' : dehors, dedans ou partout', ['dehors', 'dedans', 'partout'].includes(r.ou));
    epreuve(annee + ' · repère ' + r.id + ' : un nom et un texte', !!r.nom && !!r.texte);
  }
  for (const [nom, v] of Object.entries(m.vues)) {
    epreuve(annee + ' · vue ' + nom + ' : complète', v.cible.length === 3 && ['dehors', 'dedans'].includes(v.mode) && v.dist > 0);
  }
  epreuve(annee + ' : les vues d\'arrivée', !!m.vues.ensemble && !!m.vues.coupe);
  console.log(annee + ' : ' + triangles + ' triangles, ' + m.reperes.length + ' repères');
}
// ce que la légende date : le décor de 1897 n'est pas dans l'église de 1885
epreuve('1885 : pas de diable', !etats[1885].reperes.some((r) => r.id === 'diable'));
epreuve('1885 : la dalle des Chevaliers devant l\'autel', etats[1885].reperes.some((r) => r.id === 'dalle'));
epreuve('1892 : le dallage, pas encore le chemin de croix', etats[1892].reperes.some((r) => r.id === 'damier') && !etats[1892].reperes.some((r) => r.id === 'stations'));
epreuve('2026 : le diable, le chemin de croix, le calvaire', ['diable', 'stations', 'calvaire'].every((id) => etats[2026].reperes.some((r) => r.id === id)));
/* ── Le village ──────────────────────────────────────────────────────────── */

const villages = {};
for (const { annee } of Village.EPOQUES) {
  const m = Village.construire(annee);
  villages[annee] = m;
  let triangles = 0;
  for (const [nom, g] of Object.entries(m.groupes)) {
    triangles += g.triangles();
    epreuve('village ' + annee + ' · ' + nom + ' : des triangles, des nombres partout', g.triangles() > 0 && g.pos.every(Number.isFinite) && g.nor.every(Number.isFinite));
    let dehors = 0;
    for (let i = 0; i < g.pos.length; i += 3) {
      if (g.pos[i] < -190 || g.pos[i] > 290 || g.pos[i + 1] < -75 || g.pos[i + 1] > 40 || g.pos[i + 2] < -120 || g.pos[i + 2] > 210) dehors += 1;
    }
    epreuve('village ' + annee + ' · ' + nom + ' : tout tient dans le cadre', dehors === 0, dehors + ' sommet(s) dehors');
  }
  epreuve('village ' + annee + ' : une maquette légère', triangles < 60000, triangles + ' triangles');
  const ids = new Set();
  for (const r of m.reperes) {
    epreuve('village ' + annee + ' · repère ' + r.id + ' : unique', !ids.has(r.id));
    ids.add(r.id);
    epreuve('village ' + annee + ' · repère ' + r.id + ' : sa fiche existe', !r.fiche || fiches.has(r.fiche), r.fiche);
    epreuve('village ' + annee + ' · repère ' + r.id + ' : sa vue existe', !r.vue || !!m.vues[r.vue], r.vue);
    epreuve('village ' + annee + ' · repère ' + r.id + ' : posé au-dessus du sol', r.p[1] > m.sol(r.p[0], r.p[2]), r.p.join(' '));
    epreuve('village ' + annee + ' · repère ' + r.id + ' : un nom et un texte', !!r.nom && !!r.texte);
  }
  epreuve('village ' + annee + ' : le sol est à zéro sous l\'église', Math.abs(m.sol(8, 0)) < 0.3 && Math.abs(m.sol(0, 6)) < 0.3);
  epreuve('village ' + annee + ' : une vue d\'ensemble et une vue à pied', !!m.vues.ensemble && m.vues.rues.dist < 1);
  console.log('village ' + annee + ' : ' + triangles + ' triangles, ' + m.reperes.length + ' repères');
}
// ce qui est daté ne paraît qu'à sa date
const a = (annee, id) => villages[annee].reperes.some((r) => r.id === id);
epreuve('village 1781 et 1897 : ni villa ni tour', !a(1781, 'villa') && !a(1781, 'tour') && !a(1897, 'villa') && !a(1897, 'tour'));
epreuve('village 1910 : la villa, la tour, le belvédère', a(1910, 'villa') && a(1910, 'tour') && a(1910, 'belvedere'));
epreuve('village : le calvaire dès 1897, pas avant', !a(1781, 'calvaire') && a(1897, 'calvaire'));
epreuve('village : le réservoir seulement aujourd\'hui', !a(1910, 'reservoir') && a(2026, 'reservoir'));
epreuve('village : le domaine ajoute du bâti', villages[1910].groupes.bati.triangles() > villages[1897].groupes.bati.triangles());
epreuve('le plan du village : du bâti, des voies, un relief', VillagePlan.batis.length > 80 && VillagePlan.voies.length > 30 && VillagePlan.relief.h.length === VillagePlan.relief.nx * VillagePlan.relief.nz);

for (const [fiche, repere, quoi] of entrees) {
  epreuve('visite : la fiche ' + fiche + ' existe', fiches.has(fiche));
  const m = quoi === 'village' ? villages[2026] : etats[2026];
  epreuve('visite : une maquette pour ' + fiche, quoi === 'village' || quoi === 'eglise', quoi);
  epreuve('visite : le repère ' + repere + ' existe en 2026', !repere || m.reperes.some((r) => r.id === repere));
}
epreuve('visite : des entrées', entrees.length > 5);
// le caveau : sous le sol, à part, et montré seulement le sol ôté
for (const [annee, m] of Object.entries(etats)) {
  const c = m.groupes.crypte;
  epreuve(annee + ' : le caveau ne paraît que le sol ôté', c.si === 'creuse' && m.groupes.sol.sauf === 'creuse' && !!m.vues.soussol && m.vues.soussol.creuse === true);
  let dessus = 0;
  for (let i = 1; i < c.pos.length; i += 3) if (c.pos[i] > 0.001) dessus += 1;
  epreuve(annee + ' : le caveau est tout entier sous le sol', dessus === 0, dessus + ' sommet(s) au-dessus');
  epreuve(annee + ' : le caveau et sa descente sont dits « restitution »', m.reperes.filter((r) => r.si === 'creuse').every((r) => /restitution/.test(r.nom)));
  epreuve(annee + ' : la dalle des Chevaliers a son repère', m.reperes.some((r) => r.id === 'dalle' && r.fiche === 'dalle-des-chevaliers'));
}

if (echecs.length) {
  console.error(echecs.join('\n'));
  console.error('\n' + echecs.length + ' épreuve(s) manquée(s), ' + reussies + ' réussies.');
  process.exit(1);
}
console.log(reussies + ' épreuves réussies.');
if (process.argv.includes('--essai')) process.exit(0);

/* ── L'export glTF ───────────────────────────────────────────────────────── */

function glb(modele) {
  const morceaux = [];
  let decalage = 0;
  const vues = [], acces = [], maillages = [], noeuds = [];
  const ajouter = (tableau, cible) => {
    const octets = Buffer.from(tableau.buffer, tableau.byteOffset, tableau.byteLength);
    const bourre = (4 - (octets.length % 4)) % 4;
    vues.push({ buffer: 0, byteOffset: decalage, byteLength: octets.length, target: cible });
    morceaux.push(octets, Buffer.alloc(bourre));
    decalage += octets.length + bourre;
    return vues.length - 1;
  };
  for (const [nom, g] of Object.entries(modele.groupes)) {
    const n = g.pos.length / 3;
    const pos = new Float32Array(g.pos), nor = new Float32Array(g.nor);
    const cou = new Uint8Array(n * 4);
    for (let i = 0; i < n; i += 1) { cou[i * 4] = g.cou[i * 4]; cou[i * 4 + 1] = g.cou[i * 4 + 1]; cou[i * 4 + 2] = g.cou[i * 4 + 2]; cou[i * 4 + 3] = 255; }
    const mini = [Infinity, Infinity, Infinity], maxi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k += 1) { mini[k] = Math.min(mini[k], pos[i + k]); maxi[k] = Math.max(maxi[k], pos[i + k]); }
    const a = acces.length;
    acces.push({ bufferView: ajouter(pos, 34962), componentType: 5126, count: n, type: 'VEC3', min: mini, max: maxi });
    acces.push({ bufferView: ajouter(nor, 34962), componentType: 5126, count: n, type: 'VEC3' });
    acces.push({ bufferView: ajouter(cou, 34962), componentType: 5121, normalized: true, count: n, type: 'VEC4' });
    maillages.push({ name: nom, primitives: [{ attributes: { POSITION: a, NORMAL: a + 1, COLOR_0: a + 2 }, material: 0, mode: 4 }] });
    noeuds.push({ name: nom, mesh: maillages.length - 1 });
  }
  const json = {
    asset: { version: '2.0', generator: 'Rhedae — build/maquette.mjs' },
    extras: { titre: 'Église Sainte-Marie-Madeleine de Rennes-le-Château', annee: modele.annee, unites: 'mètres', axes: 'x est, y haut, z sud' },
    scene: 0,
    scenes: [{ name: 'maquette-' + modele.annee, nodes: noeuds.map((x, i) => i) }],
    nodes: noeuds, meshes: maillages, accessors: acces, bufferViews: vues,
    materials: [{ name: 'couleurs-aux-sommets', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.9 }, doubleSided: true }],
    buffers: [{ byteLength: decalage }],
  };
  let texte = Buffer.from(JSON.stringify(json), 'utf8');
  texte = Buffer.concat([texte, Buffer.alloc((4 - (texte.length % 4)) % 4, 0x20)]);
  const binaire = Buffer.concat(morceaux);
  const tete = Buffer.alloc(12);
  tete.writeUInt32LE(0x46546c67, 0); tete.writeUInt32LE(2, 4); tete.writeUInt32LE(12 + 8 + texte.length + 8 + binaire.length, 8);
  const t1 = Buffer.alloc(8); t1.writeUInt32LE(texte.length, 0); t1.writeUInt32LE(0x4e4f534a, 4);
  const t2 = Buffer.alloc(8); t2.writeUInt32LE(binaire.length, 0); t2.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([tete, t1, texte, t2, binaire]);
}

const sortie = path.join(RACINE, 'build/maquette');
fs.mkdirSync(sortie, { recursive: true });
for (const [annee, m] of Object.entries(etats)) {
  const fichier = path.join(sortie, 'eglise-' + annee + '.glb');
  const contenu = glb(m);
  fs.writeFileSync(fichier, contenu);
  console.log('build/maquette/eglise-' + annee + '.glb — ' + Math.round(contenu.length / 1024) + ' Ko');
}
for (const [annee, m] of Object.entries(villages)) {
  const contenu = glb(m);
  fs.writeFileSync(path.join(sortie, 'village-' + annee + '.glb'), contenu);
  console.log('build/maquette/village-' + annee + '.glb — ' + Math.round(contenu.length / 1024) + ' Ko');
}
