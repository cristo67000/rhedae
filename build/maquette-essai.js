'use strict';
(function () {
  const p = new URLSearchParams(location.search);
  const quoi = p.get('maquette') === 'village' ? Village : Eglise;
  window.essai = Maquette.poser(document.getElementById('cadre'), {
    construire: quoi.construire,
    epoques: quoi.EPOQUES,
    annee: Number(p.get('annee')) || 2026,
    vue: p.get('vue') || 'ensemble',
    ambiance: p.get('ambiance') || 'jour',
    surFiche: (id) => { document.title = 'fiche : ' + id; },
    surMaquette: (nom) => { location.search = '?maquette=' + nom; },
  });
})();
