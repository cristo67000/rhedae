'use strict';
/*
 * Le dossier : les fiches, la chronologie, les parcours, tels que les a
 * compilés build/construire.mjs dans data/dossier.json.
 *
 * Une fiche : { id, c (rubrique), g (sous-rubrique), n (nom), df (définition),
 * tx (paragraphes), al (alias), d (dates), an, r (rôle), rp (repères), oe
 * (œuvres), at (attention), vo (voir), lk (liens), im (images) } ; un lieu
 * ajoute geo, li, ty, ec, vs ; une hypothèse st, og, po, co, ve.
 */
(function (racine) {

  const { normaliser } = Outils;
  let donnees = null;
  const parId = new Map();
  const citePar = new Map();
  const index = [];       // { a, nom, alias[], def, texte } normalisés, pour la recherche

  const RENVOI = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

  /* Le texte sans balises : « [[id|libellé]] » → libellé, « *titre* » → titre. */
  function nu(texte) {
    return String(texte || '')
      .replace(RENVOI, (tout, id, libelle) => libelle || nom(id) || id)
      .replace(/\*([^*]+)\*/g, '$1');
  }

  function nom(id) { const a = parId.get(id); return a ? a.n : null; }

  function textesDe(a) {
    return [a.df, ...(a.tx || []), ...(a.po || []), ...(a.co || []), a.ve || '', a.og || '', a.at || '', a.vs || '',
      ...(a.rp || []).map((r) => r[1])];
  }

  async function charger() {
    const reponse = await fetch('data/dossier.json');
    if (!reponse.ok) throw new Error('dossier : ' + reponse.status);
    donnees = await reponse.json();
    for (const a of donnees.articles) parId.set(a.id, a);
    for (const a of donnees.articles) {
      const cites = new Set(a.vo || []);
      for (const t of textesDe(a)) for (const m of t.matchAll(RENVOI)) cites.add(m[1]);
      cites.delete(a.id);
      a._cites = cites;
      for (const id of cites) {
        if (!citePar.has(id)) citePar.set(id, new Set());
        citePar.get(id).add(a.id);
      }
      index.push({
        a,
        nom: normaliser(a.n),
        alias: (a.al || []).map(normaliser),
        def: normaliser(nu(a.df) + ' ' + (a.r ? nu(a.r) : '')),
        texte: normaliser(textesDe(a).map(nu).join(' ')),
      });
    }
    // la chronologie cite aussi : une fiche sait à quelles dates elle paraît
    for (const e of donnees.epoques) {
      for (const ev of e.ev) {
        ev._cites = new Set();
        for (const m of ev.t.matchAll(RENVOI)) ev._cites.add(m[1]);
      }
    }
    return donnees;
  }

  /* La recherche : le nom d'abord, puis les alias, la définition, le texte. */
  function chercher(requete, categorie) {
    const q = normaliser(requete);
    const mots = q.split(' ').filter(Boolean);
    const sortie = [];
    for (const e of index) {
      if (categorie && e.a.c !== categorie) continue;
      if (!q) { sortie.push({ a: e.a, score: 0 }); continue; }
      let score = 0;
      let via = null;
      if (e.nom === q) score = 100;
      else if (e.nom.startsWith(q)) score = 90;
      else if (e.nom.includes(q)) score = 80;
      else {
        const alias = e.alias.findIndex((al) => al.includes(q));
        if (alias !== -1) { score = 70; via = e.a.al[alias]; }
        else if (mots.every((m) => e.nom.includes(m) || e.alias.some((al) => al.includes(m)))) score = 60;
        else if (e.def.includes(q)) score = 40;
        else if (mots.every((m) => e.def.includes(m) || e.nom.includes(m))) score = 30;
        else if (e.texte.includes(q)) score = 20;
        else if (mots.length > 1 && mots.every((m) => e.texte.includes(m) || e.nom.includes(m))) score = 10;
      }
      if (score) sortie.push({ a: e.a, score, via });
    }
    if (q) sortie.sort((x, y) => y.score - x.score || x.a.n.localeCompare(y.a.n, 'fr'));
    return sortie;
  }

  /* Les dates de la chronologie où paraît une fiche. */
  function datesDe(id) {
    const sortie = [];
    for (const e of donnees.epoques) for (const ev of e.ev) if (ev._cites.has(id)) sortie.push(ev);
    return sortie;
  }

  const comparer = (x, y) => x.n.localeCompare(y.n, 'fr', { sensitivity: 'base' });

  racine.Dossier = {
    charger, nu, nom, chercher, datesDe, comparer,
    parId: (id) => parId.get(id) || null,
    citePar: (id) => Array.from(citePar.get(id) || []).map((x) => parId.get(x)).filter(Boolean).sort(comparer),
    categorie: (id) => donnees.categories.find((c) => c.id === id),
    groupe: (cat, id) => (donnees.groupes[cat] || []).find((g) => g.id === id),
    image: (id) => (donnees.images[id] ? Object.assign({ id }, donnees.images[id]) : null),
    de: (cat) => donnees.articles.filter((a) => a.c === cat),
    get categories() { return donnees.categories; },
    get groupes() { return donnees.groupes; },
    get articles() { return donnees.articles; },
    get epoques() { return donnees.epoques; },
    get parcours() { return donnees.parcours; },
  };

})(window);
