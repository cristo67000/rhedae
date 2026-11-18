/*
 * Vérifie en ligne les liens « Pour aller plus loin ».
 *
 *     node build/verifier_liens.mjs
 *
 * Lit data/dossier.json (donc après « node build/construire.mjs »), interroge
 * chaque adresse — quatre à la fois, sans se presser — et échoue au moindre
 * lien mort. Pour Wikipédia, la question est posée à l'API : la page doit
 * exister et ne pas être une page d'homonymie. À relancer avant chaque version.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dossier = JSON.parse(fs.readFileSync(path.join(RACINE, 'data', 'dossier.json'), 'utf8'));
const AGENT = { 'User-Agent': 'verification-de-liens/1.0 (script de construction ; usage ponctuel)' };

const liens = [];
for (const a of dossier.articles) for (const l of a.lk || []) liens.push({ id: a.id, u: l.u, l: l.l });
const uniques = Array.from(new Map(liens.map((l) => [l.u, l])).values());

async function essayer(url, options) {
  const controle = new AbortController();
  const minuterie = setTimeout(() => controle.abort(), 25000);
  try {
    return await fetch(url, Object.assign({ headers: AGENT, signal: controle.signal, redirect: 'follow' }, options || {}));
  } finally {
    clearTimeout(minuterie);
  }
}

async function verifier(lien) {
  const wiki = /^https:\/\/(fr|en)\.wikipedia\.org\/wiki\/(.+)$/.exec(lien.u);
  try {
    if (wiki) {
      const titre = decodeURIComponent(wiki[2]).replace(/_/g, ' ');
      const api = 'https://' + wiki[1] + '.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=pageprops&ppprop=disambiguation&titles=' + encodeURIComponent(titre);
      const r = await essayer(api);
      if (r.status === 429) return 'débit limité (429) : à vérifier à la main';
      if (!r.ok) return 'API ' + r.status;
      const page = Object.values((await r.json()).query.pages)[0];
      if (page.missing !== undefined) return 'page absente';
      if (page.pageprops && page.pageprops.disambiguation !== undefined) return 'page d’homonymie';
      return null;
    }
    let r = await essayer(lien.u, { method: 'HEAD' });
    if (r.status === 405 || r.status === 403 || r.status === 404) r = await essayer(lien.u);
    if (r.status === 403 || r.status === 429) return 'refuse les robots (' + r.status + ') : à vérifier à la main';
    return r.ok ? null : 'réponse ' + r.status;
  } catch (e) {
    return 'sans réponse (' + (e && e.name === 'AbortError' ? 'délai dépassé' : (e && e.message) || e) + ')';
  }
}

const defauts = [];
const avertissements = [];
let rang = 0;
async function ouvrier() {
  while (rang < uniques.length) {
    const lien = uniques[rang];
    rang += 1;
    const defaut = await verifier(lien);
    if (defaut && defaut.includes('à vérifier à la main')) avertissements.push(lien.id + ' : ' + lien.u + ' — ' + defaut);
    else if (defaut) defauts.push(lien.id + ' : ' + lien.u + ' — ' + defaut);
    await new Promise((r) => setTimeout(r, 250));
  }
}
await Promise.all([ouvrier(), ouvrier(), ouvrier(), ouvrier()]);

console.log(uniques.length + ' adresses, ' + liens.length + ' liens dans ' + new Set(liens.map((l) => l.id)).size + ' fiches.');
if (avertissements.length) console.log('\nÀ vérifier à la main :\n' + avertissements.join('\n'));
if (defauts.length) {
  console.error('\n' + defauts.join('\n'));
  console.error('\n' + defauts.length + ' lien(s) mort(s).');
  process.exit(1);
}
console.log('Tous les liens répondent.');
