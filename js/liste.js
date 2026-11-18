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

  function carteParcours(p) {
    const fait = Memoire.lire('parcours:' + p.id, -1);
    const c = bouton('carte-parcours', null, () => {
      const reprise = fait >= 0 && fait < p.etapes.length - 1 ? fait : 0;
      Fiche.ouvrir(p.etapes[reprise], { parcours: p });
    });
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
    bref.appendChild(element('p', 'en-bref-titre', 'L’affaire en bref'));
    bref.appendChild(Rendu.paragraphe('En 1885, un curé de trente-trois ans, [[berenger-sauniere|Bérenger Saunière]], arrive dans un village perché de l’Aude, [[rennes-le-chateau|Rennes-le-Château]]. En vingt ans, il restaure son église, bâtit une villa et une tour, et dépense bien plus que ne gagne un prêtre de campagne. Son évêque le condamne pour [[trafic-de-messes|trafic de messes]] ; il meurt en 1917 sans s’être expliqué.', 'en-bref-texte'));
    bref.appendChild(Rendu.paragraphe('Quarante ans plus tard, un hôtelier, [[noel-corbu|Noël Corbu]], raconte l’histoire d’un trésor. Puis viennent de faux [[parchemins|parchemins]], un [[prieure-de-sion|prieuré de Sion]] inventé, une [[lignee-de-jesus|descendance du Christ]], et un roman lu dans le monde entier. Ce dossier démêle ce qui est attesté, ce qui est discuté, et ce qui a été fabriqué.', 'en-bref-texte'));
    zone.appendChild(bref);

    if (Dossier.parcours.length) {
      zone.appendChild(element('h3', 'rubrique', 'Parcours guidés'));
      const grille = element('div', 'grille-parcours');
      for (const p of Dossier.parcours) grille.appendChild(carteParcours(p));
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
      p.appendChild(element('span', 'porte-nom', cat.nom));
      p.appendChild(element('span', 'porte-nombre', String(n)));
      portes.appendChild(p);
    }
    zone.appendChild(portes);

    const acces = element('div', 'acces');
    const versFrise = bouton('acces-bouton', null, () => App.aller('frise'));
    versFrise.appendChild(element('span', 'acces-titre', 'La chronologie'));
    versFrise.appendChild(element('span', 'acces-texte', Dossier.epoques.reduce((s, e) => s + e.ev.length, 0) + ' dates, de l’Antiquité à aujourd’hui'));
    acces.appendChild(versFrise);
    const versCarte = bouton('acces-bouton', null, () => App.aller('carte'));
    versCarte.appendChild(element('span', 'acces-titre', 'La carte'));
    versCarte.appendChild(element('span', 'acces-texte', Dossier.de('lieux').filter((a) => a.ec !== 'ailleurs').length + ' lieux, du village à la région'));
    acces.appendChild(versCarte);
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
