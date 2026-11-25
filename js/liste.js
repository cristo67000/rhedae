'use strict';
/*
 * L'onglet « Dossier » : l'accueil, la recherche, toutes les fiches.
 *
 * Sans requête, l'accueil dit l'affaire en quelques lignes, propose les
 * parcours guidés et les six rubriques, puis déroule toutes les fiches, rangées
 * par rubrique et sous-rubrique. Dès qu'on écrit, il s'efface devant les
 * résultats, classés du plus sûr au plus lointain : le nom, un autre nom, la
 * définition, le texte.
 */
(function (racine) {

  const { element, bouton } = Outils;
  let categorie = null;
  let requete = '';
  let minuterie = null;

  /* ── Une ligne de la liste ───────────────────────────────────────────────── */

  function ligne(a, options) {
    const o = options || {};
    const b = bouton('article-ligne cat-' + a.c, null, () => Fiche.ouvrir(a.id));
    const tete = element('span', 'article-ligne-tete');
    if (a.c === 'lieux') tete.appendChild(Carte.signe(a.ty, 'signe-ligne'));
    const mot = element('span', 'article-mot');
    if (o.requete) mot.appendChild(Outils.surligner(a.n, o.requete));
    else mot.textContent = a.n;
    tete.appendChild(mot);
    if (a.d) tete.appendChild(element('span', 'ligne-dates', a.d));
    if (a.st) tete.appendChild(Rendu.pastilleStatut(a.st, 'petit'));
    if (o.via) tete.appendChild(element('span', 'via-alias', o.via));
    if (Memoire.favoris.a(a.id)) tete.appendChild(element('span', 'marque-favori', '★'));
    b.appendChild(tete);
    const apercu = element('span', 'apercu');
    const texte = a.c === 'personnages' && a.r && !o.requete ? Dossier.nu(a.r) : Dossier.nu(a.df);
    if (o.requete) apercu.appendChild(Outils.surligner(texte, o.requete));
    else apercu.textContent = texte;
    b.appendChild(apercu);
    if (o.rubrique) b.appendChild(element('span', 'via', Dossier.categorie(a.c).un));
    return b;
  }

  /* L'ordre dans une sous-rubrique : par date quand la fiche en porte, sinon par nom. */
  function ranger(articles, cat) {
    const parDate = cat === 'contexte' || cat === 'oeuvres';
    return articles.slice().sort((x, y) => {
      if (parDate && x.an !== undefined && y.an !== undefined && x.an !== y.an) return x.an - y.an;
      return Dossier.comparer(x, y);
    });
  }

  /* ── L'accueil ───────────────────────────────────────────────────────────── */

  /* Les pictogrammes de l'accueil : un trait, sur une grille de 24. */
  const PICTOS = {
    personnages: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6',
    lieux: 'M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11zM12 12.3a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6z',
    hypotheses: 'M12 4v16M6 20h12M4.5 7.5h15M4.5 7.5 2.5 13a2.6 2.6 0 0 0 4 0zM19.5 7.5l-2 5.5a2.6 2.6 0 0 0 4 0z',
    pieces: 'M6.5 3.5h8l4 4v13h-12zM14.5 3.5v4h4M9 12h6M9 15.5h6',
    contexte: 'M4 9.5 12 4l8 5.5M5.5 9.5h13M7 9.5v8M12 9.5v8M17 9.5v8M5.5 17.5h13M4.5 20h15',
    oeuvres: 'M12 6.5c-2-1.5-4.5-2-7.5-1.5v13c3-.5 5.5 0 7.5 1.5 2-1.5 4.5-2 7.5-1.5v-13c-3-.5-5.5 0-7.5 1.5zM12 6.5v13',
    frise: 'M12 3v18M14.5 7H20M4 13h5.5M14.5 19H19M12 8.6a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2zM12 14.6a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2zM12 20.6a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2z',
    carte: 'M3.5 6.5 9 4l6 2.5 5.5-2.5v13.5L15 20l-6-2.5-5.5 2.5zM9 4v13.5M15 6.5V20',
    maquette: 'M3.5 20.5V13l5-3.5v11M8.5 12h9l3 3v5.5M2.5 20.5h19M14 12V6.5l2-2 2 2V12M16 2.5v2M6 16v2.5M12.5 16.5v4',
  };
  function picto(nom) {
    const s = Outils.svg('svg', { class: 'picto', viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' });
    s.appendChild(Outils.svg('path', { d: PICTOS[nom] }));
    return s;
  }

  /*
   * Le frontispice : le village sur sa butte, tel qu'on le voit du sud — la tour
   * Magdala et l'orangerie au bout du belvédère, la villa, l'église et son
   * clocher, les maisons, le château — devant le Bugarach. Un dessin au trait
   * plein, sans image à charger : ses couleurs sont dans theme.css, et la nuit
   * allume les fenêtres.
   */
  function frontispice() {
    const { svg } = Outils;
    const s = svg('svg', { class: 'frontispice', viewBox: '0 0 720 240', preserveAspectRatio: 'xMidYMax slice', role: 'img', 'aria-label': 'Rennes-le-Château sur sa butte : la tour Magdala, l’église, le château, devant le Bugarach' });
    const defs = svg('defs');
    const ciel = svg('linearGradient', { id: 'fr-ciel', x1: '0', y1: '0', x2: '0', y2: '1' });
    ciel.appendChild(svg('stop', { offset: '0', class: 'fr-ciel-haut' }));
    ciel.appendChild(svg('stop', { offset: '1', class: 'fr-ciel-bas' }));
    defs.appendChild(ciel);
    s.appendChild(defs);
    s.appendChild(svg('rect', { x: 0, y: 0, width: 720, height: 240, fill: 'url(#fr-ciel)' }));
    for (const [x, y, r] of [[60, 34, 1.4], [118, 70, 1], [190, 28, 1.2], [262, 58, 1], [318, 22, 1.5], [402, 48, 1], [456, 20, 1.2], [520, 86, 1], [612, 30, 1.4], [668, 72, 1], [690, 18, 1.1], [30, 96, 1], [232, 100, .9], [580, 118, .9]]) {
      s.appendChild(svg('circle', { class: 'fr-etoile', cx: x, cy: y, r }));
    }
    s.appendChild(svg('circle', { class: 'fr-halo', cx: 566, cy: 66, r: 44 }));
    s.appendChild(svg('circle', { class: 'fr-astre', cx: 566, cy: 66, r: 22 }));
    // le Bugarach et les Corbières, au loin ; puis les collines de la vallée
    s.appendChild(svg('path', { class: 'fr-lointain', d: 'M0 176l56-18 62 8 70-28 60 10 62-40 36-24 26 8 28-12 32 26 68 32 82 15 78-15 60 10V240H0z' }));
    s.appendChild(svg('path', { class: 'fr-colline', d: 'M0 200c80-25 160-10 240-17 90-8 180 12 280-2 80-10 140 4 200-6V240H0z' }));
    // la butte, et ce qui s'y découpe
    const butte = [
      'M0 240v-22c60-6 108-18 146-36 22-10 38-13 62-14l352-4c40 2 82 20 160 50v26z',
      // la tour Magdala, ses créneaux, son échauguette
      'M172 170v-50h4v-5h4v5h4v-5h4v5h4v-5h4v5h4v50zM163 150l3-8v-30h3v-4h3v4h3v-4h3v4 38z',
      // le belvédère en arc, et l'orangerie au bout
      'M172 160c-22 2-44 9-62 22v10l62-14zM100 190v-16l12-8 12 8v16z',
      // deux cyprès
      'M210 170c-6-18-3-36 0-46 3 10 6 28 0 46zM221 170c-5-14-2-28 0-36 2 8 5 22 0 36z',
      // la villa Béthanie
      'M234 168v-28l-4 0 22-18 22 18-4 0v28z',
      // le presbytère, l'église, son clocher, son abside
      'M292 166v-22l4-8h30l4 8v22zM330 166v-26l6-10h82l6 10v26zM356 132v-30l-4 0 14-14 14 14-4 0v30zM424 166v-18a13 13 0 0 1 13 13v5z',
      // des maisons
      'M452 166v-16l10-8 10 8v16zM474 166v-22l12-9 12 9v22zM500 166v-14l9-7 9 7v14zM520 166v-20l11-8 11 8v20z',
      // le château des Hautpoul : deux tours carrées, une tour ronde
      'M552 164v-34l-2 0 11-7 11 7-2 0v34zM570 164v-24h60v24zM590 164v-42l-2 0 13-12 13 12-2 0v42zM628 164v-30l-2 0 10-7 10 7-2 0v30z',
    ];
    s.appendChild(svg('path', { class: 'fr-butte', d: butte.join('') }));
    // les fenêtres, que la nuit allume ; et la pomme bleue à celle de la tour
    for (const [x, y, w, h] of [[246, 146, 4, 6], [258, 146, 4, 6], [344, 146, 3, 7], [372, 146, 3, 7], [400, 146, 3, 7], [364, 110, 4, 6], [484, 150, 4, 5], [528, 150, 4, 5], [598, 132, 4, 6], [598, 146, 4, 6], [582, 148, 4, 5], [616, 148, 4, 5], [559, 140, 3, 5]]) {
      s.appendChild(svg('rect', { class: 'fr-fenetre', x, y, width: w, height: h, rx: 1 }));
    }
    s.appendChild(svg('circle', { class: 'fr-pomme', cx: 184, cy: 140, r: 3.4 }));
    return s;
  }

  const ROMAINS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

  function carteParcours(p, rang) {
    const fait = Memoire.lire('parcours:' + p.id, -1);
    const c = bouton('carte-parcours', null, () => {
      const reprise = fait >= 0 && fait < p.etapes.length - 1 ? fait : 0;
      Fiche.ouvrir(p.etapes[reprise], { parcours: p });
    });
    if (ROMAINS[rang]) c.appendChild(element('span', 'parcours-rang', ROMAINS[rang]));
    c.appendChild(element('span', 'parcours-nom', p.nom));
    c.appendChild(element('span', 'parcours-def', p.def));
    const pied = element('span', 'parcours-pied');
    const jauge = element('span', 'fil-jauge');
    for (let i = 0; i < p.etapes.length; i += 1) jauge.appendChild(element('span', i <= fait ? 'fait' : null));
    pied.appendChild(jauge);
    pied.appendChild(element('span', 'parcours-etat', fait < 0 ? p.etapes.length + ' étapes' : fait >= p.etapes.length - 1 ? 'Achevé' : 'Reprendre à l’étape ' + (fait + 1)));
    c.appendChild(pied);
    return c;
  }

  function dessinerAccueil() {
    const zone = document.getElementById('accueil');
    zone.textContent = '';

    const bref = element('section', 'en-bref');
    bref.appendChild(frontispice());
    bref.appendChild(element('p', 'en-bref-titre', 'L’affaire en bref'));
    bref.appendChild(Rendu.paragraphe('En 1885, un curé de trente-trois ans, [[berenger-sauniere|Bérenger Saunière]], arrive dans un village perché de l’Aude, [[rennes-le-chateau|Rennes-le-Château]]. En vingt ans, il restaure son église, bâtit une villa et une tour, et dépense bien plus que ne gagne un prêtre de campagne. Son évêque le condamne pour [[trafic-de-messes|trafic de messes]] ; il meurt en 1917 sans s’être expliqué.', 'en-bref-texte'));
    bref.appendChild(Rendu.paragraphe('Quarante ans plus tard, un hôtelier, [[noel-corbu|Noël Corbu]], raconte l’histoire d’un trésor. Puis viennent de faux [[parchemins|parchemins]], un [[prieure-de-sion|prieuré de Sion]] inventé, une [[lignee-de-jesus|descendance du Christ]], et un roman lu dans le monde entier. Ce dossier démêle ce qui est attesté, ce qui est discuté, et ce qui a été fabriqué.', 'en-bref-texte'));
    zone.appendChild(bref);

    if (Dossier.parcours.length) {
      zone.appendChild(element('h3', 'rubrique', 'Parcours guidés'));
      const grille = element('div', 'grille-parcours');
      Dossier.parcours.forEach((p, rang) => grille.appendChild(carteParcours(p, rang)));
      zone.appendChild(grille);
    }

    zone.appendChild(element('h3', 'rubrique', 'Les six rubriques'));
    const portes = element('div', 'portes');
    for (const cat of Dossier.categories) {
      const n = Dossier.de(cat.id).length;
      const p = bouton('porte cat-' + cat.id, null, () => {
        if (cat.id === 'hypotheses') { App.aller('hypotheses'); return; }
        choisirCategorie(cat.id);
        document.getElementById('filtres').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      if (PICTOS[cat.id]) {
        const medaille = element('span', 'porte-picto');
        medaille.appendChild(picto(cat.id));
        p.appendChild(medaille);
      }
      p.appendChild(element('span', 'porte-nom', cat.nom));
      p.appendChild(element('span', 'porte-nombre', String(n)));
      portes.appendChild(p);
    }
    zone.appendChild(portes);

    const acces = element('div', 'acces');
    const versAilleurs = (nom, titre, texte, action, classe) => {
      const b = bouton('acces-bouton' + (classe ? ' ' + classe : ''), null, action);
      const medaille = element('span', 'acces-picto');
      medaille.appendChild(picto(nom));
      b.appendChild(medaille);
      const mots = element('span', 'acces-mots');
      mots.appendChild(element('span', 'acces-titre', titre));
      mots.appendChild(element('span', 'acces-texte', texte));
      b.appendChild(mots);
      acces.appendChild(b);
    };
    versAilleurs('frise', 'La chronologie', Dossier.epoques.reduce((s, e) => s + e.ev.length, 0) + ' dates, de l’Antiquité à aujourd’hui', () => App.aller('frise'));
    versAilleurs('carte', 'La carte', Dossier.de('lieux').filter((a) => a.ec !== 'ailleurs').length + ' lieux, du village à la région', () => App.aller('carte'));
    versAilleurs('maquette', 'Le village et l’église en maquette', 'En trois dimensions : survolez la butte, marchez dans les rues, entrez dans l’église, changez d’époque', () => Visite.ouvrir(null, 'village'), 'large');
    zone.appendChild(acces);

    const gardees = Memoire.favoris.tous().map((id) => Dossier.parId(id)).filter(Boolean);
    if (gardees.length) {
      zone.appendChild(element('h3', 'rubrique', 'Fiches gardées'));
      const voisins = element('div', 'voisins');
      for (const a of gardees.sort(Dossier.comparer)) voisins.appendChild(bouton('voisin cat-' + a.c, a.n, () => Fiche.ouvrir(a.id)));
      zone.appendChild(voisins);
    }
  }

  /* ── La liste ────────────────────────────────────────────────────────────── */

  function dessinerFiltres() {
    const zone = document.getElementById('filtres');
    zone.textContent = '';
    const tout = bouton('filtre' + (categorie ? '' : ' actif'), 'Tout', () => choisirCategorie(null));
    zone.appendChild(tout);
    for (const cat of Dossier.categories) {
      const f = bouton('filtre cat-' + cat.id + (categorie === cat.id ? ' actif' : ''), null, () => choisirCategorie(categorie === cat.id ? null : cat.id));
      f.appendChild(element('span', 'point-cat'));
      f.appendChild(document.createTextNode(cat.nom));
      zone.appendChild(f);
    }
  }

  function dessinerListe() {
    const zone = document.getElementById('liste');
    const rien = document.getElementById('rien');
    const compte = document.getElementById('compte');
    zone.textContent = '';
    const resultats = Dossier.chercher(requete, categorie);
    document.getElementById('accueil').hidden = !!requete || !!categorie;
    rien.hidden = resultats.length > 0;
    if (requete) {
      compte.textContent = Outils.pluriel(resultats.length, 'fiche trouvée', 'fiches trouvées');
      const groupe = element('div', 'groupe');
      for (const r of resultats) groupe.appendChild(ligne(r.a, { requete, via: r.via, rubrique: !categorie }));
      zone.appendChild(groupe);
      return;
    }
    compte.textContent = Outils.pluriel(resultats.length, 'fiche', 'fiches') + (categorie ? '' : ' dans le dossier');
    for (const cat of Dossier.categories) {
      if (categorie && cat.id !== categorie) continue;
      const dans = resultats.map((r) => r.a).filter((a) => a.c === cat.id);
      if (!dans.length) continue;
      if (!categorie) zone.appendChild(element('h3', 'titre-rubrique cat-' + cat.id, cat.nom));
      for (const g of Dossier.groupes[cat.id]) {
        const membres = ranger(dans.filter((a) => a.g === g.id), cat.id);
        if (!membres.length) continue;
        zone.appendChild(element('h4', 'lettre', g.nom));
        const groupe = element('div', 'groupe');
        for (const a of membres) groupe.appendChild(ligne(a));
        zone.appendChild(groupe);
      }
    }
  }

  function choisirCategorie(id) {
    categorie = id;
    dessinerFiltres();
    dessinerListe();
  }

  function focaliser() {
    const q = document.getElementById('q');
    q.focus();
    q.select();
  }

  function brancher() {
    const q = document.getElementById('q');
    const vider = document.getElementById('q-vider');
    const raccourci = document.getElementById('q-raccourci');
    const bloc = document.getElementById('bloc-recherche');
    q.addEventListener('input', () => {
      vider.hidden = !q.value;
      raccourci.hidden = !!q.value;
      if (minuterie) clearTimeout(minuterie);
      minuterie = setTimeout(() => { requete = q.value.trim(); dessinerListe(); }, 90);
    });
    q.addEventListener('focus', () => { raccourci.hidden = true; });
    q.addEventListener('blur', () => { raccourci.hidden = !!q.value; });
    q.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const premiere = document.querySelector('#liste .article-ligne');
        if (premiere && requete) premiere.click();
      } else if (e.key === 'Escape' && q.value) {
        e.stopPropagation();
        q.value = '';
        q.dispatchEvent(new Event('input'));
      }
    });
    vider.addEventListener('click', () => { q.value = ''; q.dispatchEvent(new Event('input')); q.focus(); });
    document.getElementById('b-hasard').addEventListener('click', () => {
      const lot = categorie ? Dossier.de(categorie) : Dossier.articles;
      Fiche.ouvrir(lot[Math.floor(Math.random() * lot.length)].id);
    });
    racine.addEventListener('scroll', () => {
      bloc.classList.toggle('colle', bloc.getBoundingClientRect().top <= 0 && racine.scrollY > 40);
    }, { passive: true });
    document.addEventListener('favoris-changes', () => { dessinerAccueil(); dessinerListe(); });
    document.addEventListener('fiche-fermee', dessinerAccueil);
    dessinerFiltres();
    dessinerAccueil();
    dessinerListe();
  }

  racine.Liste = { brancher, focaliser, ligne, choisirCategorie };

})(window);
