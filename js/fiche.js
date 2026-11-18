'use strict';
/*
 * La fiche : un personnage, un lieu, une hypothèse, une pièce, un contexte,
 * un livre — en plein écran, par-dessus l'onglet d'où l'on vient.
 *
 * Toutes les fiches ont la même charpente (la rubrique, le nom, la définition,
 * les images, le texte, les repères, les fiches voisines, les liens) ; chaque
 * rubrique y ajoute le sien : un lieu son plan de situation et son itinéraire,
 * une hypothèse sa balance — pour, contre, verdict —, une pièce son statut.
 *
 * D'une fiche à l'autre, on suit les renvois ; le geste « retour » du
 * téléphone remonte le fil, puis referme. Si un parcours guidé est en cours,
 * la fiche en montre le fil et propose l'étape suivante.
 */
(function (racine) {

  const { element, bouton } = Outils;
  let ouverte = false;
  let courante = null;
  let profondeur = 0;
  let parcours = null;        // { p (le parcours), rang }
  let planCourant = null;

  const zone = () => document.getElementById('fiche');
  const contenu = () => document.getElementById('fiche-contenu');

  function titreBloc(texte) { return element('h3', 'rubrique', texte); }

  function listeVoisins(articles) {
    const bloc = element('div', 'voisins');
    for (const a of articles) {
      const b = bouton('voisin cat-' + a.c, a.n, () => ouvrir(a.id));
      bloc.appendChild(b);
    }
    return bloc;
  }

  /* ── Ce que chaque rubrique ajoute ───────────────────────────────────────── */

  function blocHypothese(a) {
    const bloc = element('section', 'balance');
    const tete = element('div', 'balance-tete');
    tete.appendChild(Rendu.pastilleStatut(a.st, 'grand'));
    tete.appendChild(element('span', 'balance-explication', Rendu.EXPLICATIONS[a.st] || ''));
    bloc.appendChild(tete);
    if (a.og) {
      const origine = element('div', 'balance-origine');
      origine.appendChild(element('span', 'etiquette', 'D’où vient l’idée'));
      origine.appendChild(Rendu.paragraphe(a.og));
      bloc.appendChild(origine);
    }
    const plateaux = element('div', 'plateaux');
    const plateau = (classe, titre, items, signe) => {
      const p = element('div', 'plateau ' + classe);
      p.appendChild(element('h3', null, titre));
      const ul = element('ul');
      for (const t of items || []) {
        const li = element('li');
        li.appendChild(element('span', 'plateau-signe', signe));
        li.appendChild(Rendu.paragraphe(t));
        ul.appendChild(li);
      }
      p.appendChild(ul);
      return p;
    };
    plateaux.appendChild(plateau('pour', 'Ce qui plaide pour', a.po, '+'));
    plateaux.appendChild(plateau('contre', 'Ce qui s’y oppose', a.co, '−'));
    bloc.appendChild(plateaux);
    if (a.ve) {
      const verdict = element('div', 'verdict statut-' + a.st);
      verdict.appendChild(element('span', 'etiquette', 'Ce qu’en retient l’histoire'));
      verdict.appendChild(Rendu.paragraphe(a.ve));
      bloc.appendChild(verdict);
    }
    return bloc;
  }

  function blocLieu(a) {
    const bloc = element('section', 'situation');
    const cadre = element('div', 'plan-cadre');
    bloc.appendChild(cadre);
    if (a.ec !== 'ailleurs') {
      // le plan se dessine une fois la fiche à l'écran : il lui faut sa largeur
      setTimeout(() => { if (courante === a && cadre.isConnected) planCourant = Carte.plan(cadre, a); }, 30);
    } else {
      cadre.classList.add('hors-carte');
      cadre.appendChild(element('p', 'discret', 'Ce lieu est hors de la carte du Razès.'));
    }
    const pied = element('div', 'situation-pied');
    const coord = a.geo[0].toFixed(4).replace('.', ',') + '° N, ' + a.geo[1].toFixed(4).replace('.', ',') + '° E';
    const rennes = Dossier.parId('rennes-le-chateau');
    let loin = '';
    if (rennes && a.id !== 'rennes-le-chateau' && a.ec !== 'village') {
      const km = Carte.distance(rennes.geo, a.geo);
      loin = ' · à ' + (km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km).toLocaleString('fr-FR')) + ' km de Rennes-le-Château à vol d’oiseau';
    }
    pied.appendChild(element('p', 'discret', coord + loin));
    const boutons = element('div', 'ligne-boutons');
    if (a.ec !== 'ailleurs') {
      boutons.appendChild(bouton('bouton-discret', 'Voir sur la carte', () => {
        fermer();
        App.aller('carte');
        Lieux.montrer(a.id);
      }));
    }
    const itineraire = element('a', 'bouton-discret', 'Itinéraire');
    itineraire.href = 'https://www.google.com/maps/dir/?api=1&destination=' + a.geo[0] + ',' + a.geo[1];
    itineraire.target = '_blank';
    itineraire.rel = 'noopener noreferrer';
    boutons.appendChild(itineraire);
    const osm = element('a', 'bouton-discret', 'OpenStreetMap');
    osm.href = 'https://www.openstreetmap.org/?mlat=' + a.geo[0] + '&mlon=' + a.geo[1] + '#map=' + (a.ec === 'village' ? 18 : 14) + '/' + a.geo[0] + '/' + a.geo[1];
    osm.target = '_blank';
    osm.rel = 'noopener noreferrer';
    boutons.appendChild(osm);
    pied.appendChild(boutons);
    bloc.appendChild(pied);
    if (a.vs) {
      const voir = element('div', 'sur-place');
      voir.appendChild(element('span', 'etiquette', 'Sur place aujourd’hui'));
      voir.appendChild(Rendu.paragraphe(a.vs));
      bloc.appendChild(voir);
    }
    return bloc;
  }

  function blocReperes(a) {
    const bloc = element('section', 'reperes');
    bloc.appendChild(titreBloc('Repères'));
    const ul = element('ul', 'reperes-liste');
    for (const [date, fait] of a.rp) {
      const li = element('li');
      li.appendChild(element('span', 'repere-date', date));
      li.appendChild(Rendu.paragraphe(fait, 'repere-fait'));
      ul.appendChild(li);
    }
    bloc.appendChild(ul);
    return bloc;
  }

  /* Les dates de la grande chronologie où la fiche est citée. */
  function blocDates(a) {
    const dates = Dossier.datesDe(a.id);
    if (!dates.length || (a.rp && a.rp.length)) return null;
    const bloc = element('section', 'reperes');
    bloc.appendChild(titreBloc('Dans la chronologie'));
    const ul = element('ul', 'reperes-liste');
    for (const ev of dates.slice(0, 12)) {
      const li = element('li', 'nature-' + ev.n);
      li.appendChild(element('span', 'repere-date', ev.d));
      li.appendChild(Rendu.paragraphe(ev.t, 'repere-fait'));
      ul.appendChild(li);
    }
    bloc.appendChild(ul);
    return bloc;
  }

  function blocParcours(a) {
    if (!parcours) return null;
    const rang = parcours.p.etapes.indexOf(a.id);
    if (rang === -1) { parcours = null; return null; }
    parcours.rang = rang;
    Memoire.ecrire('parcours:' + parcours.p.id, Math.max(rang, Memoire.lire('parcours:' + parcours.p.id, 0)));
    const fil = element('div', 'fil-parcours');
    fil.appendChild(element('span', 'fil-nom', parcours.p.nom));
    fil.appendChild(element('span', 'fil-rang', 'étape ' + (rang + 1) + ' sur ' + parcours.p.etapes.length));
    const jauge = element('div', 'fil-jauge');
    for (let i = 0; i < parcours.p.etapes.length; i += 1) jauge.appendChild(element('span', i <= rang ? 'fait' : null));
    fil.appendChild(jauge);
    return fil;
  }

  function piedParcours(a) {
    if (!parcours) return null;
    const rang = parcours.p.etapes.indexOf(a.id);
    const suivante = parcours.p.etapes[rang + 1];
    const pied = element('div', 'pied-parcours');
    if (suivante) {
      const cible = Dossier.parId(suivante);
      const b = bouton('bouton-principal', 'Étape suivante : ' + cible.n, () => ouvrir(suivante));
      pied.appendChild(b);
    } else {
      pied.appendChild(element('p', 'fin-parcours', 'Fin du parcours « ' + parcours.p.nom + ' ».'));
    }
    return pied;
  }

  /* ── La fiche entière ────────────────────────────────────────────────────── */

  function construire(a) {
    const cat = Dossier.categorie(a.c);
    const groupe = Dossier.groupe(a.c, a.g);
    const racineFiche = document.createDocumentFragment();

    const tete = element('div', 'fiche-tete');
    const retour = bouton('fiche-fermer', profondeur > 1 ? '← Retour' : '✕ Fermer', () => {
      if (profondeur > 1) racine.history.back();
      else fermer();
    });
    tete.appendChild(retour);
    tete.appendChild(element('span', 'espace'));
    const garder = bouton('bouton-etat' + (Memoire.favoris.a(a.id) ? ' actif' : ''), Memoire.favoris.a(a.id) ? '★ Gardée' : '☆ Garder', () => {
      const oui = Memoire.favoris.basculer(a.id);
      garder.textContent = oui ? '★ Gardée' : '☆ Garder';
      garder.classList.toggle('actif', oui);
      garder.classList.add('pop');
      setTimeout(() => garder.classList.remove('pop'), 350);
      document.dispatchEvent(new CustomEvent('favoris-changes'));
    });
    tete.appendChild(garder);
    const partager = bouton('bouton-rond', '⤴', async () => {
      const url = racine.location.origin + racine.location.pathname + '?fiche=' + encodeURIComponent(a.id);
      if (racine.navigator.share) {
        try { await racine.navigator.share({ title: a.n + ' — Rhedae', url }); return; } catch (e) { /* refusé : on copie */ }
      }
      if (await Outils.copier(url)) Outils.annoncer('Lien copié.');
    });
    partager.setAttribute('aria-label', 'Partager cette fiche');
    tete.appendChild(partager);
    racineFiche.appendChild(tete);

    const fil = blocParcours(a);
    if (fil) racineFiche.appendChild(fil);

    const corps = element('article', 'fiche-corps cat-' + a.c);
    const infos = element('div', 'fiche-infos');
    const pastille = element('span', 'pastille-cat');
    pastille.appendChild(element('span', 'point'));
    pastille.appendChild(document.createTextNode(cat.un + (groupe ? ' · ' + groupe.nom : '')));
    infos.appendChild(pastille);
    if (a.c === 'pieces' && a.st) infos.appendChild(Rendu.pastilleStatut(a.st));
    corps.appendChild(infos);

    corps.appendChild(element('h2', 'article-nom', a.n));
    if (a.d) corps.appendChild(element('p', 'article-dates', a.d));
    if (a.r) corps.appendChild(Rendu.paragraphe(a.r, 'article-role'));
    if (a.li) corps.appendChild(element('p', 'article-lieu', a.li));

    const def = element('div', 'definition');
    def.appendChild(Rendu.paragraphe(a.df, 'definition-texte'));
    corps.appendChild(def);

    const images = Illustrations.bandeau(a.im);
    if (images) corps.appendChild(images);

    if (a.c === 'hypotheses') corps.appendChild(blocHypothese(a));

    const texte = element('div', 'article-texte');
    for (const t of a.tx) texte.appendChild(Rendu.paragraphe(t));
    corps.appendChild(texte);

    if (a.at) {
      const attention = element('div', 'attention');
      attention.appendChild(element('span', 'etiquette', 'À ne pas confondre'));
      attention.appendChild(Rendu.paragraphe(a.at));
      corps.appendChild(attention);
    }

    if (a.c === 'lieux') corps.appendChild(blocLieu(a));
    if (a.rp && a.rp.length) corps.appendChild(blocReperes(a));
    const dates = blocDates(a);
    if (dates) corps.appendChild(dates);

    if (a.oe && a.oe.length) {
      corps.appendChild(titreBloc(a.c === 'oeuvres' ? 'Éditions' : 'Livres et travaux'));
      const ul = element('ul', 'oeuvres');
      for (const o of a.oe) ul.appendChild(element('li', null, o));
      corps.appendChild(ul);
    }

    const voisins = (a.vo || []).map((id) => Dossier.parId(id)).filter(Boolean);
    if (voisins.length) {
      corps.appendChild(titreBloc('Voir aussi'));
      corps.appendChild(listeVoisins(voisins));
    }
    const deja = new Set((a.vo || []).concat([a.id]));
    const citants = Dossier.citePar(a.id).filter((x) => !deja.has(x.id));
    if (citants.length) {
      corps.appendChild(titreBloc('Cité dans'));
      corps.appendChild(listeVoisins(citants));
    }

    if (a.lk && a.lk.length) {
      corps.appendChild(titreBloc('Pour aller plus loin'));
      const ul = element('ul', 'liens');
      for (const l of a.lk) {
        const li = element('li');
        const lien = element('a', null, l.l);
        lien.href = l.u;
        lien.target = '_blank';
        lien.rel = 'noopener noreferrer';
        li.appendChild(lien);
        ul.appendChild(li);
      }
      corps.appendChild(ul);
      corps.appendChild(element('p', 'discret petit', 'Ces liens ouvrent d’autres sites et demandent une connexion.'));
    }

    racineFiche.appendChild(corps);
    const pied = piedParcours(a);
    if (pied) racineFiche.appendChild(pied);
    return racineFiche;
  }

  function afficher(id) {
    const a = Dossier.parId(id);
    if (!a) return false;
    if (planCourant) { planCourant.detruire(); planCourant = null; }
    courante = a;
    const c = contenu();
    c.textContent = '';
    c.appendChild(construire(a));
    c.classList.remove('change');
    void c.offsetWidth;
    c.classList.add('change');
    zone().scrollTop = 0;
    Memoire.lus.ajouter(id);
    document.title = a.n + ' — Rhedae';
    return true;
  }

  function ouvrir(id, options) {
    if (!Dossier.parId(id)) return;
    if (options && options.parcours) parcours = { p: options.parcours, rang: 0 };
    else if (parcours && !parcours.p.etapes.includes(id)) parcours = null;
    profondeur += 1;
    try { racine.history.pushState({ fiche: id, profondeur }, '', '?fiche=' + encodeURIComponent(id)); } catch (e) { /* rien */ }
    if (!ouverte) {
      zone().hidden = false;
      zone().classList.add('entree');
      setTimeout(() => zone().classList.remove('entree'), 300);
      document.body.classList.add('fiche-ouverte');
      ouverte = true;
    }
    afficher(id);
  }

  /* Le geste « retour » a ramené à une fiche précédente. */
  function revenirA(etat) {
    profondeur = etat.profondeur || 1;
    if (!afficher(etat.fiche)) fermerSansHistorique();
  }

  function fermerSansHistorique() {
    if (planCourant) { planCourant.detruire(); planCourant = null; }
    zone().hidden = true;
    contenu().textContent = '';
    document.body.classList.remove('fiche-ouverte');
    ouverte = false;
    courante = null;
    profondeur = 0;
    document.title = 'Rhedae — les mystères de Rennes-le-Château';
    document.dispatchEvent(new CustomEvent('fiche-fermee'));
  }

  function fermer() {
    if (!ouverte) return;
    const n = profondeur;
    fermerSansHistorique();
    try { racine.history.replaceState(racine.history.state, '', racine.location.pathname); } catch (e) { /* rien */ }
    Outils.reculer(n);
  }

  function brancher() {
    // tout renvoi, où qu'il soit dans la page, ouvre sa fiche sans quitter l'application
    document.addEventListener('click', (e) => {
      const lien = e.target.closest && e.target.closest('a.renvoi');
      if (!lien || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      ouvrir(lien.getAttribute('data-ref'));
    });
  }

  racine.Fiche = {
    brancher, ouvrir, fermer, fermerSansHistorique, revenirA,
    get ouverte() { return ouverte; },
    get parcours() { return parcours; },
  };

})(window);
