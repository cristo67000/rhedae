'use strict';
/*
 * La mise en forme des textes du dossier.
 *
 * Deux balises seulement : [[id]] ou [[id|libellé]] devient un lien vers la
 * fiche, *mots* devient de l'italique. Tout le reste est du texte, posé par
 * `textContent` : rien n'est jamais interprété comme du HTML.
 *
 * Un lien est un vrai lien (`?fiche=…`), que la fiche intercepte pour ouvrir
 * la suivante sans quitter la page ; il reste lisible par un lecteur d'écran
 * et ouvrable dans un autre onglet sur un ordinateur.
 */
(function (racine) {

  const { element } = Outils;
  const MOTIF = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|\*([^*]+)\*/g;

  function fragment(texte, surligne) {
    const sortie = document.createDocumentFragment();
    const source = String(texte || '');
    let pos = 0;
    let m;
    const motif = new RegExp(MOTIF.source, 'g');
    const poserTexte = (parent, t) => {
      if (!t) return;
      if (surligne) parent.appendChild(Outils.surligner(t, surligne));
      else parent.appendChild(document.createTextNode(t));
    };
    while ((m = motif.exec(source)) !== null) {
      poserTexte(sortie, source.slice(pos, m.index));
      if (m[1]) {
        const id = m[1];
        const libelle = m[2] || Dossier.nom(id) || id;
        if (Dossier.parId(id)) sortie.appendChild(lien(id, libelle));
        else poserTexte(sortie, libelle);
      } else {
        // l'italique peut contenir un renvoi : « *[[l-or-de-rennes|L'Or de Rennes]]* »
        const i = element('i');
        i.appendChild(fragment(m[3], surligne));
        sortie.appendChild(i);
      }
      pos = m.index + m[0].length;
    }
    poserTexte(sortie, source.slice(pos));
    return sortie;
  }

  function lien(id, libelle) {
    const a = element('a', 'renvoi', libelle);
    a.href = '?fiche=' + encodeURIComponent(id);
    a.setAttribute('data-ref', id);
    const cible = Dossier.parId(id);
    if (cible) a.classList.add('cat-' + cible.c);
    return a;
  }

  function paragraphe(texte, classe, surligne) {
    const p = element('p', classe || null);
    p.appendChild(fragment(texte, surligne));
    return p;
  }

  /* Ce que vaut une hypothèse, une pièce, une date : le mot et sa classe. */
  const STATUTS = {
    etabli: 'Établi', plausible: 'Plausible', fragile: 'Fragile', legende: 'Légende', mystification: 'Mystification',
    authentique: 'Authentique', discute: 'Discuté', disparu: 'Disparu', faux: 'Faux',
    atteste: 'Attesté', fabrique: 'Fabriqué',
  };
  const EXPLICATIONS = {
    etabli: 'Prouvé par des documents d’époque.',
    plausible: 'Compatible avec les documents, sans preuve directe.',
    fragile: 'Des indices minces, ou discutés.',
    legende: 'Aucun document : un récit tardif.',
    mystification: 'Une fabrication reconnue comme telle.',
    authentique: 'L’objet existe et son origine est connue.',
    discute: 'Son existence ou son sens sont discutés.',
    disparu: 'Décrit par des témoins, aujourd’hui perdu.',
    faux: 'Un faux, reconnu par son auteur ou démontré.',
    atteste: 'Attesté par un document d’époque.',
    fabrique: 'Inventé après coup : un faux, une mystification.',
  };
  /* Les statuts des pièces et des dates empruntent les couleurs des hypothèses. */
  const TEINTE = { authentique: 'etabli', discute: 'fragile', disparu: 'legende', faux: 'mystification', atteste: 'etabli', fabrique: 'mystification' };

  function pastilleStatut(statut, classe) {
    const p = element('span', 'statut statut-' + (TEINTE[statut] || statut) + (classe ? ' ' + classe : ''), STATUTS[statut] || statut);
    p.title = EXPLICATIONS[statut] || '';
    return p;
  }

  racine.Rendu = { fragment, paragraphe, lien, pastilleStatut, STATUTS, EXPLICATIONS, TEINTE };

})(window);
