'use strict';
/*
 * L'onglet « Réglages » : l'apparence, la mémoire, et ce qu'il faut savoir du
 * dossier — sa méthode, ses sources, ce qu'il ne fait pas.
 */
(function (racine) {

  const { element, bouton } = Outils;
  let manifeste = null;

  function segments(cle, choix, apres) {
    const groupe = element('div', 'segments');
    groupe.setAttribute('role', 'group');
    for (const [valeur, nom] of choix) {
      const b = bouton(null, nom, () => {
        App.ecrireReglage(cle, valeur);
        App.appliquerReglages();
        dessiner();
        if (apres) apres();
      });
      b.setAttribute('aria-pressed', App.reglages[cle] === valeur ? 'true' : 'false');
      groupe.appendChild(b);
    }
    return groupe;
  }

  function bloc(titre) {
    const b = element('section', 'bloc');
    b.appendChild(element('h3', null, titre));
    return b;
  }

  function dessiner() {
    const zone = document.getElementById('reglages-contenu');
    zone.textContent = '';
    zone.appendChild(element('h2', null, 'Réglages'));

    const apparence = bloc('Apparence');
    apparence.appendChild(element('h4', null, 'Ambiance'));
    apparence.appendChild(segments('theme', [['auto', 'Automatique'], ['clair', 'Vélin'], ['sombre', 'Nuit']]));
    apparence.appendChild(element('h4', null, 'Taille du texte'));
    apparence.appendChild(segments('taille', [[0, 'Petit'], [1, 'Normal'], [2, 'Grand'], [3, 'Très grand']]));
    apparence.appendChild(element('h4', null, 'Police des fiches'));
    apparence.appendChild(segments('police', [['serif', 'À empattements'], ['sans', 'Sans empattements']]));
    zone.appendChild(apparence);

    const memoire = bloc('Votre lecture');
    const lues = Memoire.lus.nombre();
    const total = Dossier.articles.length;
    memoire.appendChild(element('p', null, Outils.pluriel(lues, 'fiche ouverte', 'fiches ouvertes') + ' sur ' + total + ', '
      + Outils.pluriel(Memoire.favoris.nombre(), 'gardée', 'gardées') + '.'));
    const jauge = element('div', 'jauge');
    const plein = element('div', 'jauge-pleine');
    plein.style.width = Math.round(100 * lues / Math.max(1, total)) + '%';
    jauge.appendChild(plein);
    memoire.appendChild(jauge);
    for (const cat of Dossier.categories) {
      const dans = Dossier.de(cat.id);
      const n = dans.filter((a) => Memoire.lus.a(a.id)).length;
      const ligne = element('p', 'progression cat-' + cat.id);
      ligne.appendChild(element('span', 'point-cat'));
      ligne.appendChild(document.createTextNode(' ' + cat.nom + ' : ' + n + ' sur ' + dans.length));
      memoire.appendChild(ligne);
    }
    memoire.appendChild(bouton('bouton-discret espace-haut', 'Tout oublier', () => {
      if (!racine.confirm('Oublier les fiches lues, les fiches gardées et l’avancement des parcours ? Les réglages d’apparence sont remis à zéro.')) return;
      Memoire.toutEffacer();
      App.rechargerReglages();
      document.dispatchEvent(new CustomEvent('favoris-changes'));
      dessiner();
      Outils.annoncer('Mémoire effacée.');
    }));
    memoire.appendChild(element('p', 'discret petit', 'Tout cela reste dans cet appareil : rien n’est envoyé nulle part.'));
    zone.appendChild(memoire);

    const methode = bloc('La méthode du dossier');
    methode.appendChild(element('p', null, 'Rhedae raconte l’affaire de Rennes-le-Château comme le font les historiens : en disant, pour chaque fait, d’où on le tient. Les archives de l’évêché de Carcassonne, les carnets et les comptes de l’abbé Saunière, les actes notariés et la presse d’époque disent une histoire ; les récits apparus à partir de 1956 en disent une autre. Le dossier ne tranche pas par principe : il montre sur quoi repose chaque affirmation.'));
    const legende = element('div', 'legende-statuts');
    for (const s of ['etabli', 'plausible', 'fragile', 'legende', 'mystification']) {
      const l = element('p', 'ligne-statut');
      l.appendChild(Rendu.pastilleStatut(s));
      l.appendChild(document.createTextNode(' ' + Rendu.EXPLICATIONS[s]));
      legende.appendChild(l);
    }
    methode.appendChild(legende);
    methode.appendChild(element('p', null, 'Les textes sont originaux. Ils s’appuient sur les travaux de René Descadeillas, Jean-Jacques Bedu, Pierre Jarnac, Claire Corbu et Antoine Captier, Laurent Buchholtzer, Christian Doumergue, Bill Putnam et John Edwin Wood, Paul Smith, et sur les documents qu’ils ont publiés. Les dates anciennes sont souvent approximatives, et le disent.'));
    zone.appendChild(methode);

    const sources = bloc('Sources et crédits');
    sources.appendChild(element('p', null, 'La carte est dessinée par l’application elle-même et ne charge aucune tuile. Le relief vient des « Terrain Tiles » (Mapzen, programme Open Data d’Amazon), qui assemblent des modèles numériques de terrain ouverts ; les rivières, les routes, les villages et le bâti du village viennent d’OpenStreetMap (© les contributeurs d’OpenStreetMap, licence ODbL).'));
    sources.appendChild(element('p', null, 'Les illustrations anciennes — portraits, tableaux, gravures, cartes postales — viennent de Wikimedia Commons et sont dans le domaine public ; chacune porte son crédit et un lien vers sa source. Les photographies des lieux tels qu’ils sont aujourd’hui ont été prises sur place en août 2024 par Cristo6772 : tous droits réservés.'));
    sources.appendChild(element('p', null, 'Rhedae est le nom que portait, dit-on, la cité du haut Moyen Âge qui a donné son nom au Razès.'));
    zone.appendChild(sources);

    const prive = bloc('Vie privée');
    prive.appendChild(element('p', null, 'Pas de compte, pas de publicité, pas de mesure d’audience. L’application fonctionne hors ligne et ne contacte aucun serveur. « Me situer », sur la carte, est facultatif : la position n’est lue que pendant que la carte est ouverte et ne quitte jamais l’appareil. Les liens « Pour aller plus loin » et « Itinéraire » ouvrent d’autres sites, qui ont leurs propres règles.'));
    const lien = element('a', null, 'Lire la page de confidentialité');
    lien.href = 'confidentialite.html';
    prive.appendChild(element('p', null)).appendChild(lien);
    zone.appendChild(prive);

    const version = bloc('Version');
    version.appendChild(element('p', null, 'Rhedae ' + (manifeste ? manifeste.version : '')
      + (manifeste ? ' — ' + manifeste.articles + ' fiches, dossier du ' + Outils.dateLisible(manifeste.construit) : '') + '.'));
    version.appendChild(element('p', 'discret petit', 'Sur le modèle d’Arcanes, dictionnaire encyclopédique de l’ésotérisme.'));
    zone.appendChild(version);
  }

  racine.Reglages = {
    dessiner,
    brancher(donnees) { manifeste = donnees.manifeste; },
  };

})(window);
