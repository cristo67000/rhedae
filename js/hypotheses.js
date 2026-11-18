'use strict';
/*
 * L'onglet « Hypothèses » : toutes les pistes, pesées.
 *
 * En tête, la balance d'ensemble : combien de pistes sont établies, plausibles,
 * fragiles, légendaires, ou relèvent d'une mystification. Dessous, les pistes
 * elles-mêmes, par grandes questions (d'où venait l'argent, les trésors, les
 * secrets…) ou de la plus solide à la plus fragile. Chaque carte donne le
 * verdict en clair ; la fiche détaille les arguments.
 */
(function (racine) {

  const { element, bouton } = Outils;
  const ORDRE = ['etabli', 'plausible', 'fragile', 'legende', 'mystification'];
  let tri = 'question';
  let seul = null;
  let pret = false;

  function carteHypothese(a) {
    const c = bouton('carte-hypothese statut-bord-' + a.st, null, () => Fiche.ouvrir(a.id));
    const tete = element('span', 'hypothese-tete');
    tete.appendChild(element('span', 'hypothese-nom', a.n));
    tete.appendChild(Rendu.pastilleStatut(a.st));
    c.appendChild(tete);
    c.appendChild(element('span', 'hypothese-def', Dossier.nu(a.df)));
    const poids = element('span', 'hypothese-poids');
    poids.appendChild(element('span', 'poids pour', '+ ' + (a.po || []).length));
    poids.appendChild(element('span', 'poids contre', '− ' + (a.co || []).length));
    if (a.ve) poids.appendChild(element('span', 'hypothese-verdict', Dossier.nu(a.ve)));
    c.appendChild(poids);
    return c;
  }

  function dessiner() {
    const zone = document.getElementById('hypotheses-contenu');
    zone.textContent = '';
    const toutes = Dossier.de('hypotheses');

    // la balance d'ensemble : une barre, un segment par statut
    const bilan = element('section', 'bilan');
    const barre = element('div', 'bilan-barre');
    barre.setAttribute('role', 'img');
    const legende = element('div', 'bilan-legende');
    const libelles = [];
    for (const s of ORDRE) {
      const n = toutes.filter((a) => a.st === s).length;
      if (!n) continue;
      for (let i = 0; i < n; i += 1) barre.appendChild(element('span', 'bilan-grain statut-plein-' + s));
      const b = bouton('bilan-statut' + (seul === s ? ' actif' : ''), null, () => { seul = seul === s ? null : s; dessiner(); });
      b.setAttribute('aria-pressed', seul === s ? 'true' : 'false');
      b.appendChild(Rendu.pastilleStatut(s));
      b.appendChild(element('span', 'bilan-nombre', String(n)));
      b.appendChild(element('span', 'bilan-explication', Rendu.EXPLICATIONS[s]));
      legende.appendChild(b);
      libelles.push(n + ' ' + Rendu.STATUTS[s].toLowerCase());
    }
    barre.setAttribute('aria-label', 'Les ' + toutes.length + ' hypothèses : ' + libelles.join(', '));
    bilan.appendChild(barre);
    bilan.appendChild(legende);
    zone.appendChild(bilan);

    const segments = element('div', 'segments');
    for (const [id, nom] of [['question', 'Par grandes questions'], ['solidite', 'De la plus solide à la plus fragile']]) {
      const b = bouton(null, nom, () => { tri = id; dessiner(); });
      b.setAttribute('aria-pressed', tri === id ? 'true' : 'false');
      segments.appendChild(b);
    }
    zone.appendChild(segments);

    const retenues = toutes.filter((a) => !seul || a.st === seul);
    const rang = (a) => ORDRE.indexOf(a.st);
    if (tri === 'solidite') {
      const grille = element('div', 'grille-hypotheses');
      for (const a of retenues.slice().sort((x, y) => rang(x) - rang(y) || Dossier.comparer(x, y))) grille.appendChild(carteHypothese(a));
      zone.appendChild(grille);
    } else {
      for (const g of Dossier.groupes.hypotheses) {
        const membres = retenues.filter((a) => a.g === g.id).sort((x, y) => rang(x) - rang(y) || Dossier.comparer(x, y));
        if (!membres.length) continue;
        zone.appendChild(element('h3', 'epoque-titre', g.nom));
        const grille = element('div', 'grille-hypotheses');
        for (const a of membres) grille.appendChild(carteHypothese(a));
        zone.appendChild(grille);
      }
    }
    if (!retenues.length) zone.appendChild(element('p', 'discret', 'Aucune hypothèse de ce statut.'));
  }

  function montrer() {
    if (pret) return;
    pret = true;
    dessiner();
  }

  racine.Hypotheses = { montrer, brancher() {} };

})(window);
