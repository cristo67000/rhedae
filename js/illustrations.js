'use strict';
/*
 * Les illustrations : portraits, cartes postales anciennes, tableaux.
 *
 * Toutes viennent de Wikimedia Commons et sont dans le domaine public (ou sous
 * CC0) ; build/illustrations.txt dit d'où vient chacune, build/illustrer.py les
 * réduit et les range dans img/. Une fiche en porte en tête (`im`).
 *
 * Une image touchée s'ouvre en grand par-dessus la fiche, avec sa légende, son
 * crédit et un lien vers sa source. Le geste « retour » du téléphone la
 * referme sans fermer la fiche (voir `App`).
 */
(function (racine) {

  const { element, bouton } = Outils;
  let ouverte = false;

  function adresse(im) { return 'img/' + im.id + '.webp?v=' + im.v; }

  function image(im, classe) {
    const img = element('img', classe || null);
    img.width = im.w;
    img.height = im.h;
    img.alt = Dossier.nu(im.l);
    img.decoding = 'async';
    img.loading = 'lazy';
    img.addEventListener('error', () => {
      const cadre = img.closest('.illustration, #visionneuse');
      if (cadre) cadre.classList.add('absente');
      else img.hidden = true;
    }, { once: true });
    img.src = adresse(im);
    return img;
  }

  function legende(im, balise) {
    const leg = element(balise);
    leg.appendChild(element('span', 'illustration-legende')).appendChild(Rendu.fragment(im.l));
    leg.appendChild(element('span', 'illustration-credit', im.c));
    return leg;
  }

  /* Les images d'une fiche, en tête : une, deux ou trois côte à côte. */
  function bandeau(ids) {
    const images = (ids || []).map((id) => Dossier.image(id)).filter(Boolean).slice(0, 3);
    if (!images.length) return null;
    const bloc = element('div', 'illustrations n' + images.length);
    for (const im of images) {
      const figure = element('figure', 'illustration');
      const b = bouton('illustration-bouton', null, () => ouvrir(im));
      b.setAttribute('aria-label', 'Agrandir : ' + Dossier.nu(im.l));
      b.appendChild(image(im));
      figure.appendChild(b);
      figure.appendChild(legende(im, 'figcaption'));
      bloc.appendChild(figure);
    }
    return bloc;
  }

  /* Une vignette, pour les listes et l'accueil. */
  function vignette(id, classe) {
    const im = Dossier.image(id);
    return im ? image(im, classe || 'vignette-image') : null;
  }

  function ouvrir(im) {
    const zone = document.getElementById('visionneuse');
    zone.textContent = '';
    zone.classList.remove('absente');
    const fermerBouton = bouton('visionneuse-fermer', '✕', fermer);
    fermerBouton.setAttribute('aria-label', 'Fermer');
    zone.appendChild(fermerBouton);
    const cadre = element('div', 'visionneuse-cadre');
    const img = image(im, 'visionneuse-image');
    img.loading = 'eager';
    img.addEventListener('click', fermer);
    cadre.appendChild(img);
    zone.appendChild(cadre);
    const leg = legende(im, 'div');
    leg.className = 'visionneuse-legende';
    if (im.s) {
      const a = element('a', 'visionneuse-source', 'Voir la source sur Wikimedia Commons');
      a.href = im.s;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      leg.appendChild(a);
    }
    zone.appendChild(leg);
    zone.hidden = false;
    document.body.classList.add('visionneuse-ouverte');
    ouverte = true;
    try { racine.history.pushState({ visionneuse: true }, ''); } catch (e) { /* rien */ }
    fermerBouton.focus();
  }

  function fermerSansHistorique() {
    const zone = document.getElementById('visionneuse');
    zone.hidden = true;
    zone.textContent = '';
    document.body.classList.remove('visionneuse-ouverte');
    ouverte = false;
  }

  function fermer() {
    if (!ouverte) return;
    fermerSansHistorique();
    Outils.reculer(1);
  }

  function brancher() {
    document.getElementById('visionneuse').addEventListener('click', (e) => {
      if (e.target.id === 'visionneuse' || e.target.classList.contains('visionneuse-cadre')) fermer();
    });
  }

  racine.Illustrations = {
    bandeau, vignette, ouvrir, fermer, fermerSansHistorique, brancher,
    get ouverte() { return ouverte; },
  };

})(window);
