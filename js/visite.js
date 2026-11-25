'use strict';
/*
 * La visite : l'église en maquette, en plein écran, par-dessus le reste.
 *
 * La maquette (js/eglise.js) et de quoi la montrer (js/maquette.js) sont
 * communs à Rhedae et à Terribilis ; ce module est ce que Rhedae en fait. On
 * tourne autour de l'église, on y entre, on choisit l'état — avant Saunière,
 * pendant les travaux, aujourd'hui —, et chaque repère mène à sa fiche. Une
 * fiche dont la pièce est dans la maquette y renvoie : « Voir dans la maquette ».
 */
(function (racine) {

  const { element, bouton } = Outils;
  let ouverte = false;
  let maquette = null;

  const zone = () => document.getElementById('visite');

  /* Les fiches que la maquette montre, et le repère où l'on arrive pour chacune. */
  const ENTREES = {
    'eglise-sainte-marie-madeleine': null,
    'asmodee': 'diable',
    'par-ce-signe-tu-le-vaincras': 'diable',
    'terribilis-est-locus-iste': 'porche',
    'chemin-de-croix': 'stations',
    'bas-relief-du-sermon': 'sermon',
    'statues-de-l-eglise': 'madeleine',
    'autel-de-marie-madeleine': 'autel',
    'dallage-en-damier': 'damier',
    'piece-secrete': 'sacristie',
    'crypte-des-seigneurs': 'crypte',
    'dalle-des-chevaliers': 'dalle',
    'pommes-bleues': 'pommes',
    'jardin-du-calvaire': 'calvaire',
    'cimetiere': 'cimetiere',
    'presbytere': 'presbytere',
  };

  function concerne(id) { return Object.prototype.hasOwnProperty.call(ENTREES, id); }

  function fermerSansHistorique() {
    if (!ouverte) return;
    if (maquette) { maquette.detruire(); maquette = null; }
    zone().hidden = true;
    document.body.classList.remove('visite-ouverte');
    ouverte = false;
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

  function ouvrir(idFiche) {
    if (ouverte) return;
    const z = zone();
    z.hidden = false;
    document.body.classList.add('visite-ouverte');
    ouverte = true;
    try { racine.history.pushState({ visite: true }, '', racine.location.pathname); } catch (e) { /* rien */ }
    const cle = idFiche && ENTREES[idFiche];
    const modele = Eglise.construire(2026);
    const repere = cle ? modele.reperes.find((r) => r.id === cle) : null;
    let vue = 'ensemble';
    if (repere) vue = repere.vue || (repere.ou === 'dedans' ? 'coupe' : 'ensemble');
    maquette = Maquette.poser(document.getElementById('visite-cadre'), {
      titre: 'L’église Sainte-Marie-Madeleine, en maquette',
      construire: Eglise.construire,
      epoques: Eglise.EPOQUES,
      annee: 2026,
      vue,
      ambiance: document.documentElement.getAttribute('data-theme') === 'sombre' ? 'soir' : 'jour',
      surFiche: (id) => { if (Dossier.parId(id)) fermer(() => Fiche.ouvrir(id)); },
    });
  }

  /* Le bouton qu'une fiche porte quand sa pièce est dans la maquette. */
  function boutonPour(id) {
    if (!concerne(id)) return null;
    const bloc = element('div', 'vers-maquette');
    const b = bouton('bouton-discret', null, () => ouvrir(id));
    b.appendChild(element('span', 'vers-maquette-signe', '◇'));
    b.appendChild(document.createTextNode(id === 'eglise-sainte-marie-madeleine' ? 'Visiter l’église en maquette' : 'Voir dans la maquette de l’église'));
    bloc.appendChild(b);
    return bloc;
  }

  function brancher() {
    document.getElementById('visite-fermer').addEventListener('click', () => fermer());
    const b = document.getElementById('b-visite');
    if (b) b.addEventListener('click', () => ouvrir(null));
  }

  racine.Visite = {
    brancher, ouvrir, fermer, fermerSansHistorique, concerne, boutonPour, ENTREES,
    get ouverte() { return ouverte; },
  };

})(window);
