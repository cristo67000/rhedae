'use strict';
/*
 * Le chef d'orchestre : les réglages, les onglets, l'historique.
 *
 * Cinq onglets (Dossier, Chronologie, Carte, Hypothèses, Réglages) et une fiche
 * qui s'ouvre par-dessus. Ce module tient les réglages en mémoire, les applique
 * au document — thème, taille du texte, police —, aiguille le geste « retour »
 * du téléphone et les raccourcis du clavier, et branche chaque écran une fois.
 */
(function (racine) {

  let reglages = Memoire.reglages();
  let vue = 'dossier';
  const VUES = ['dossier', 'frise', 'carte', 'hypotheses', 'reglages'];
  const TAILLES = [14.5, 16, 18, 20.5];

  /* Le thème « automatique » retire l'attribut : c'est alors la préférence du
   * téléphone qui décide. La taille se règle sur la racine ; toute la feuille de
   * style est en rem. Ces écritures passent par le DOM et le CSSOM, pas par un
   * attribut « style » : la politique de sécurité de la page les accepte. */
  function appliquerReglages() {
    const html = document.documentElement;
    if (reglages.theme === 'clair' || reglages.theme === 'sombre') html.setAttribute('data-theme', reglages.theme);
    else html.removeAttribute('data-theme');
    html.setAttribute('data-police', reglages.police === 'sans' ? 'sans' : 'serif');
    html.style.fontSize = (TAILLES[reglages.taille] || 16) + 'px';
    document.dispatchEvent(new CustomEvent('reglages-changes'));
  }

  function ecrireReglage(cle, valeur) {
    reglages = Memoire.ecrireReglage(cle, valeur);
    return valeur;
  }

  function rechargerReglages() {
    reglages = Memoire.reglages();
    appliquerReglages();
  }

  function aller(nom) {
    if (!VUES.includes(nom)) return;
    vue = nom;
    for (const v of VUES) document.getElementById('vue-' + v).hidden = v !== nom;
    for (const b of document.querySelectorAll('#onglets button')) {
      if (b.getAttribute('data-vue') === nom) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    }
    if (nom === 'frise') Frise.montrer();
    if (nom === 'carte') Lieux.creer();
    if (nom === 'hypotheses') Hypotheses.montrer();
    if (nom === 'reglages') Reglages.dessiner();
    racine.scrollTo(0, 0);
    document.dispatchEvent(new CustomEvent('vue-changee'));
  }

  function surRetour(e) {
    /* Un recul que nous avons nous-mêmes provoqué, l'écran étant déjà fermé :
     * rien à défaire (voir Outils.reculer). */
    if (racine.reculsAttendus > 0) { racine.reculsAttendus -= 1; return; }
    const s = e.state || {};
    // la visionneuse d'abord : « retour » referme l'image, pas la fiche dessous
    if (Illustrations.ouverte) { Illustrations.fermerSansHistorique(); return; }
    // puis la maquette : elle est par-dessus la fiche d'où l'on vient
    if (Visite.ouverte) { Visite.fermerSansHistorique(); return; }
    if (Fiche.ouverte) {
      if (s.fiche) Fiche.revenirA(s);
      else Fiche.fermerSansHistorique();
    }
  }

  /* Sur un ordinateur : « / » ou Ctrl+K pour chercher, Échap pour refermer. */
  function surTouche(e) {
    if (e.defaultPrevented || e.altKey) return;
    if (e.key === 'Escape') {
      if (Illustrations.ouverte) { e.preventDefault(); Illustrations.fermer(); return; }
      if (Visite.ouverte) { e.preventDefault(); Visite.fermer(); return; }
      if (Fiche.ouverte) { e.preventDefault(); Fiche.fermer(); }
      return;
    }
    if (Visite.ouverte) return;
    const chercher = ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')
      || (e.key === '/' && !e.ctrlKey && !e.metaKey && !Outils.saisieEnCours(e));
    if (!chercher) return;
    e.preventDefault();
    if (Fiche.ouverte) Fiche.fermer();
    if (vue !== 'dossier') aller('dossier');
    Liste.focaliser();
  }

  function brancher(donnees) {
    appliquerReglages();

    Fiche.brancher();
    Illustrations.brancher();
    Frise.brancher();
    Lieux.brancher();
    Visite.brancher();
    Hypotheses.brancher();
    Reglages.brancher({ manifeste: donnees.manifeste });
    Liste.brancher();

    for (const b of document.querySelectorAll('#onglets button')) {
      b.addEventListener('click', () => {
        if (b.getAttribute('data-vue') === vue) racine.scrollTo({ top: 0, behavior: 'smooth' });
        else aller(b.getAttribute('data-vue'));
      });
    }
    racine.addEventListener('popstate', surRetour);
    document.addEventListener('keydown', surTouche);

    // « ?fiche=berenger-sauniere » ouvre directement la fiche : c'est le lien partagé
    const parametres = new URLSearchParams(racine.location.search);
    const demande = parametres.get('fiche');
    const vueDemandee = parametres.get('vue');
    try { racine.history.replaceState(null, '', racine.location.pathname + (parametres.has('sans-sw') ? '?sans-sw' : '')); } catch (e) { /* rien */ }
    if (vueDemandee && VUES.includes(vueDemandee)) aller(vueDemandee);
    if (demande && Dossier.parId(demande)) Fiche.ouvrir(demande);
  }

  racine.App = {
    brancher, aller, appliquerReglages, ecrireReglage, rechargerReglages,
    get reglages() { return reglages; },
    get vue() { return vue; },
  };

})(window);
