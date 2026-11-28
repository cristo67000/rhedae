'use strict';
/*
 * La visite : le village et l'église en maquette, en plein écran, par-dessus
 * le reste.
 *
 * Les maquettes (js/village.js, js/eglise.js) et de quoi les montrer
 * (js/maquette.js) sont communes à Rhedae et à Terribilis ; ce module est ce
 * que Rhedae en fait. On survole le village, on y marche, on entre dans
 * l'église ; on choisit l'époque ; chaque repère mène à sa fiche. Une fiche
 * dont le lieu ou la pièce est dans une maquette y renvoie.
 */
(function (racine) {

  const { element, bouton } = Outils;
  let ouverte = false;
  let maquette = null;
  let courante = null;

  const zone = () => document.getElementById('visite');

  const MAQUETTES = {
    village: {
      nom: 'Le village',
      titre: 'Rennes-le-Château',
      objet: () => racine.Village,
      note: 'Une maquette, pas un relevé : les emprises sont celles du cadastre d’aujourd’hui, à toutes les époques, sauf ce qui est daté — le domaine de l’abbé, de 1901 à 1906. Les hauteurs des maisons sont données au jugé. Glissez pour regarder autour de vous ; les flèches de l’écran ou du clavier font avancer, reculer et tourner.',
    },
    eglise: {
      nom: 'L’église',
      titre: 'L’église Sainte-Marie-Madeleine',
      objet: () => racine.Eglise,
      note: 'Une maquette, pas un relevé : le plan suit le cadastre et le relevé de Michel Verrot (1995) ; les hauteurs, que personne n’a publiées, sont estimées d’après des photographies. Les statues, les stations, l’autel, les vitraux et le Sermon sont ceux des photographies prises sur place en août 2024, plaquées sur des volumes : justes de face, sommaires de profil. Glissez pour regarder autour de vous ; les flèches de l’écran ou du clavier font avancer, reculer et tourner.',
    },
  };

  /* Les fiches que les maquettes montrent : laquelle, et le repère où l'on arrive. */
  const ENTREES = {
    'eglise-sainte-marie-madeleine': ['eglise', null],
    'asmodee': ['eglise', 'diable'],
    'par-ce-signe-tu-le-vaincras': ['eglise', 'diable'],
    'terribilis-est-locus-iste': ['eglise', 'porche'],
    'chemin-de-croix': ['eglise', 'stations'],
    'bas-relief-du-sermon': ['eglise', 'sermon'],
    'statues-de-l-eglise': ['eglise', 'madeleine'],
    'autel-de-marie-madeleine': ['eglise', 'autel'],
    'dallage-en-damier': ['eglise', 'damier'],
    'piece-secrete': ['eglise', 'sacristie'],
    'crypte-des-seigneurs': ['eglise', 'crypte'],
    'dalle-des-chevaliers': ['eglise', 'dalle'],
    'pommes-bleues': ['eglise', 'pommes'],
    'jardin-du-calvaire': ['eglise', 'calvaire'],
    'cimetiere': ['eglise', 'cimetiere'],
    'presbytere': ['eglise', 'presbytere'],
    'rennes-le-chateau': ['village', null],
    'tour-magdala': ['village', 'tour'],
    'villa-bethanie': ['village', 'villa'],
    'belvedere-et-orangerie': ['village', 'belvedere'],
    'chateau-des-hautpoul': ['village', 'chateau'],
  };

  function concerne(id) { return Object.prototype.hasOwnProperty.call(ENTREES, id); }

  function ecrireChoix() {
    const choix = document.getElementById('visite-choix');
    choix.textContent = '';
    for (const id of Object.keys(MAQUETTES)) {
      const b = bouton(null, MAQUETTES[id].nom, () => { if (id !== courante) montrer(id, null); });
      b.setAttribute('aria-pressed', id === courante ? 'true' : 'false');
      choix.appendChild(b);
    }
  }

  /* Pose une des deux maquettes dans le cadre ; `cle` : le repère où arriver. */
  function montrer(quoi, cle) {
    if (maquette) { maquette.detruire(); maquette = null; }
    courante = quoi;
    const m = MAQUETTES[quoi];
    const objet = m.objet();
    document.getElementById('visite-titre').textContent = m.titre;
    document.getElementById('visite-note').textContent = m.note;
    ecrireChoix();
    const modele = objet.construire(2026);
    const repere = cle ? modele.reperes.find((r) => r.id === cle) : null;
    let vue = 'ensemble';
    if (repere) vue = repere.vue || (repere.ou === 'dedans' ? 'coupe' : 'ensemble');
    maquette = Maquette.poser(document.getElementById('visite-cadre'), {
      titre: m.titre + ', en maquette',
      construire: objet.construire,
      epoques: objet.EPOQUES,
      annee: 2026,
      vue,
      ambiance: document.documentElement.getAttribute('data-theme') === 'sombre' ? 'soir' : 'jour',
      surFiche: (id) => { if (Dossier.parId(id)) fermer(() => Fiche.ouvrir(id)); },
      surMaquette: (nom) => { if (MAQUETTES[nom]) montrer(nom, null); },
    });
  }

  function fermerSansHistorique() {
    if (!ouverte) return;
    if (maquette) { maquette.detruire(); maquette = null; }
    zone().hidden = true;
    document.body.classList.remove('visite-ouverte');
    ouverte = false;
    courante = null;
  }

  /* `puis` : ce qu'on fait une fois l'historique revenu à sa place (ouvrir une
   * fiche, par exemple — elle y ajoute sa propre entrée). */
  function fermer(puis) {
    if (!ouverte) return;
    fermerSansHistorique();
    if (puis) {
      let fait = false;
      const suite = () => {
        if (fait) return;
        fait = true;
        racine.removeEventListener('popstate', suite);
        puis();
      };
      racine.addEventListener('popstate', suite);
      setTimeout(suite, 500);
    }
    Outils.reculer(1);
  }

  /* `idFiche` : la fiche d'où l'on vient ; à défaut, `quoi` : village ou eglise. */
  function ouvrir(idFiche, quoi) {
    if (ouverte) return;
    zone().hidden = false;
    document.body.classList.add('visite-ouverte');
    ouverte = true;
    try { racine.history.pushState({ visite: true }, '', racine.location.pathname); } catch (e) { /* rien */ }
    const entree = idFiche && ENTREES[idFiche];
    montrer(entree ? entree[0] : (MAQUETTES[quoi] ? quoi : 'village'), entree ? entree[1] : null);
  }

  /* Le bouton qu'une fiche porte quand son lieu ou sa pièce est dans une maquette. */
  function boutonPour(id) {
    if (!concerne(id)) return null;
    const bloc = element('div', 'vers-maquette');
    const b = bouton('bouton-discret', null, () => ouvrir(id));
    b.appendChild(element('span', 'vers-maquette-signe', '◇'));
    const libelles = {
      'eglise-sainte-marie-madeleine': 'Visiter l’église en maquette',
      'rennes-le-chateau': 'Parcourir le village en maquette',
    };
    b.appendChild(document.createTextNode(libelles[id]
      || (ENTREES[id][0] === 'village' ? 'Voir dans la maquette du village' : 'Voir dans la maquette de l’église')));
    bloc.appendChild(b);
    return bloc;
  }

  function brancher() {
    document.getElementById('visite-fermer').addEventListener('click', () => fermer());
    const b = document.getElementById('b-visite');
    if (b) b.addEventListener('click', () => ouvrir(null, 'village'));
  }

  racine.Visite = {
    brancher, ouvrir, fermer, fermerSansHistorique, concerne, boutonPour, ENTREES,
    get ouverte() { return ouverte; },
  };

})(window);
