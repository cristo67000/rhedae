'use strict';
(function () {
  const p = new URLSearchParams(location.search);
  window.essai = Maquette.poser(document.getElementById('cadre'), {
    construire: Eglise.construire,
    epoques: Eglise.EPOQUES,
    annee: Number(p.get('annee')) || 2026,
    vue: p.get('vue') || 'ensemble',
    ambiance: p.get('ambiance') || 'jour',
    surFiche: (id) => { document.title = 'fiche : ' + id; },
  });
})();
