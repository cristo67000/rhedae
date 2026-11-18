'use strict';
/*
 * La carte : de la région au village, d'un seul tenant.
 *
 * Elle ne charge aucune tuile. Son fond a été préparé une fois pour toutes par
 * build/fond_de_carte.py : un relief estompé (trois images, de la plus large à
 * la plus serrée) et des tracés tirés d'OpenStreetMap (data/carte.json). Tout
 * est dessiné ici, en SVG, et fonctionne donc hors ligne.
 *
 * ── Les coordonnées ────────────────────────────────────────────────────────
 *
 * Le « monde » est en degrés, projeté en Mercator comme les tuiles du relief,
 * et compté depuis Rennes-le-Château : de près, les nombres restent petits et
 * le dessin ne tremble pas. L'échelle `k` est en pixels par degré de longitude.
 * Le groupe « monde » reçoit une transformation ; les traits gardent leur
 * épaisseur à l'écran (`vector-effect`, dans carte.css).
 *
 * ── Le détail suit l'échelle ───────────────────────────────────────────────
 *
 * Trois paliers, posés en classes sur le dessin : `n-razes` fait paraître les
 * routes et les ruisseaux du Haut-Razès, `n-detail` les chemins et les hameaux,
 * `n-village` les maisons et les ruelles de Rennes-le-Château.
 *
 * ── Les noms ───────────────────────────────────────────────────────────────
 *
 * Les points et leurs noms ne sont pas dans le monde : ils sont posés à
 * l'écran, à chaque mouvement, par ordre d'importance, et un nom qui en
 * recouvrirait un autre est tu. Les lieux du dossier passent toujours devant.
 */
(function (racine) {

  const { element, bouton, svg, normaliser } = Outils;

  const LON0 = 2.2628;
  const LAT0 = 42.9280;
  const RAD = Math.PI / 180;
  const mercator = (lat) => -Math.log(Math.tan(Math.PI / 4 + lat * RAD / 2)) / RAD;
  const Y0 = mercator(LAT0);
  const X = (lon) => lon - LON0;
  const Y = (lat) => mercator(lat) - Y0;
  const latDe = (y) => (2 * Math.atan(Math.exp(-(y + Y0) * RAD)) - Math.PI / 2) / RAD;

  const K_MOYEN = 650;
  const K_RAZES = 1100;
  const K_DETAIL = 2600;
  const K_PROCHE = 7000;
  const K_VILLAGE = 22000;
  const K_MAX = 300000;

  /* Les trois cadres proposés : le centre, et la largeur à montrer (en degrés). */
  const CADRES = {
    region:  { nom: 'La région', lon: 2.31, lat: 42.945, largeur: 1.60 },
    razes:   { nom: 'Le Haut-Razès', lon: 2.295, lat: 42.925, largeur: 0.40 },
    village: { nom: 'Le village', lon: 2.26305, lat: 42.92775, largeur: 0.0060 },
  };

  /* Les signes des lieux, dessinés dans un carré de 12 de côté, centré. */
  const SIGNES = {
    village: 'M-3.4 0A3.4 3.4 0 1 0 3.4 0A3.4 3.4 0 1 0 -3.4 0Z',
    ville: 'M-4.4 0A4.4 4.4 0 1 0 4.4 0A4.4 4.4 0 1 0 -4.4 0ZM-1.5 0A1.5 1.5 0 1 0 1.5 0A1.5 1.5 0 1 0 -1.5 0Z',
    eglise: 'M0 -5.2V5.2M-3.3 -1.9H3.3',
    chateau: 'M-4.6 4.6V-3.8h2v1.9h1.6v-1.9h2v1.9h1.6v-1.9h2V4.6Z',
    ruine: 'M-4.6 4.6V-1.6l1.9-2.2 1.5 2.4L.9 -4l1.6 2.9 2.1-1V4.6',
    tour: 'M-2.6 4.8V-2.4h-1.2V-5h1.7v1.3h1.3V-5h1.6v1.3h1.3V-5h1.7v2.6H2.6V4.8Z',
    maison: 'M-4.8 .2L0 -4.6 4.8 .2M-3.3 -1V4.6H3.3V-1',
    sommet: 'M-5 4L0 -4.6 5 4Z',
    source: 'M0 -5C3 -1 4 1 4 2.2A4 4 0 0 1 -4 2.2C-4 1 -3 -1 0 -5Z',
    rocher: 'M-5 3.5L-2.5 -3 2 -4.2 5 .5 3.2 4H-4Z',
    tombeau: 'M-3.6 5V-1.4A3.6 3.6 0 0 1 3.6 -1.4V5ZM-5 5H5',
    abbaye: 'M0 -5.2V5.2M-3.2 -2.2H3.2M-4.6 5.2H4.6',
    cimetiere: 'M0 -5V4.2M-2.8 -2.2H2.8M-4.6 4.8H4.6',
    jardin: 'M0 5.2V0M0 0C-4.5 0 -4.8 -4.6 0 -5.2 4.8 -4.6 4.5 0 0 0Z',
    grotte: 'M-5 4.6V0A5 5 0 0 1 5 0V4.6M-2 4.6V1.6A2 2 0 0 1 2 1.6V4.6',
    pont: 'M-5.4 -1.4H5.4M-5.4 3.6V-1.4M5.4 3.6V-1.4M-3 3.6A3 3 0 0 1 3 3.6',
    site: 'M0 -5.2L1.5 -1.6 5.2 -1.6 2.2 .8 3.3 4.6 0 2.4 -3.3 4.6 -2.2 .8 -5.2 -1.6 -1.5 -1.6Z',
    musee: 'M-5 -1.5L0 -5 5 -1.5ZM-3.6 -1.5V3.6M0 -1.5V3.6M3.6 -1.5V3.6M-5 4.6H5',
  };
  const NOMS_TYPES = {
    village: 'Villages', ville: 'Villes', eglise: 'Églises', chateau: 'Châteaux', ruine: 'Ruines', tour: 'Tours',
    maison: 'Maisons', sommet: 'Sommets', source: 'Sources', rocher: 'Rochers', tombeau: 'Tombeaux', abbaye: 'Abbayes',
    cimetiere: 'Cimetières', jardin: 'Jardins', grotte: 'Grottes', pont: 'Ponts', site: 'Sites', musee: 'Musées',
  };

  /* Les villes de la région qu'on nomme (OpenStreetMap en connaît trop autour de Perpignan). */
  const VILLES = new Set(['Foix', 'Carcassonne', 'Castelnaudary', 'Prades', 'Limoux', 'Lézignan-Corbières', 'Rivesaltes',
    'Quillan', 'Perpignan', 'Narbonne', 'Pamiers']);
  const VILLES_AJOUTEES = [
    { n: 'Mirepoix', g: [1.8744, 43.0883] }, { n: 'Lavelanet', g: [1.8483, 42.9322] }, { n: 'Axat', g: [2.2356, 42.8039] },
    { n: 'Lagrasse', g: [2.6194, 43.0903] }, { n: 'Leucate', g: [3.0286, 42.9106] }, { n: 'Tuchan', g: [2.7192, 42.8889] },
  ];

  let fond = null;
  let attente = null;
  function charger() {
    if (!attente) {
      attente = fetch('data/carte.json').then((r) => {
        if (!r.ok) throw new Error('carte : ' + r.status);
        return r.json();
      }).then((d) => { fond = d; return d; });
    }
    return attente;
  }

  /* Le tracé SVG de plusieurs lignes [lon, lat, lon, lat…], dans le monde. */
  function trace(lignes, decimales, fermer) {
    const morceaux = [];
    for (const l of lignes) {
      const p = l.p;
      let d = '';
      for (let i = 0; i < p.length; i += 2) {
        d += (i ? 'L' : 'M') + X(p[i]).toFixed(decimales) + ' ' + Y(p[i + 1]).toFixed(decimales);
      }
      morceaux.push(d + (fermer ? 'Z' : ''));
    }
    return morceaux.join('');
  }

  /* La mesure des noms, pour savoir s'ils se recouvrent : un canevas hors écran. */
  const mesureur = document.createElement('canvas').getContext('2d');
  const POLICES = {
    lieu: '600 12.5px Georgia, serif', bourg: '11px system-ui, sans-serif', ville: '600 12px system-ui, sans-serif',
    sommet: 'italic 10.5px Georgia, serif', eau: 'italic 11px Georgia, serif', hameau: '10px system-ui, sans-serif',
    rue: '10px system-ui, sans-serif',
  };
  const largeurs = new Map();
  function largeur(texte, genre) {
    const cle = genre + '|' + texte;
    if (!largeurs.has(cle)) {
      mesureur.font = POLICES[genre] || POLICES.bourg;
      largeurs.set(cle, mesureur.measureText(texte).width + 2);
    }
    return largeurs.get(cle);
  }

  function themeSombre() {
    const force = document.documentElement.getAttribute('data-theme');
    if (force === 'sombre') return true;
    if (force === 'clair') return false;
    return racine.matchMedia && racine.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /* ── Une carte ───────────────────────────────────────────────────────────── */

  function creer(conteneur, options) {
    const opt = Object.assign({ interactif: true, cadre: 'razes', seul: null, hauteur: null }, options || {});
    let L = 600;
    let H = 420;
    let cx = X(CADRES.razes.lon);
    let cy = Y(CADRES.razes.lat);
    let k = 1500;
    let choisi = opt.seul;
    let filtre = null;
    let position = null;
    let surChoix = opt.surChoix || null;
    let animation = null;
    let trame = null;
    let detruit = false;

    conteneur.textContent = '';
    conteneur.classList.add('carte-vivante');
    const dessin = svg('svg', { class: 'carte-svg', role: 'img', 'aria-label': 'Carte du Haut-Razès' });
    if (opt.interactif) dessin.setAttribute('tabindex', '0');
    const monde = svg('g', { class: 'monde' });
    const reliefs = {};
    for (const nom of ['region', 'razes', 'village']) {
      reliefs[nom] = svg('image', { class: 'relief relief-' + nom, preserveAspectRatio: 'none' });
      monde.appendChild(reliefs[nom]);
    }
    const couches = {};
    for (const nom of ['region', 'razes', 'village']) {
      couches[nom] = svg('g', { class: 'couche couche-' + nom });
      monde.appendChild(couches[nom]);
    }
    const cadreRazes = svg('rect', { class: 'cadre-razes' });
    monde.appendChild(cadreRazes);
    dessin.appendChild(monde);
    const noms = svg('g', { class: 'noms' });
    dessin.appendChild(noms);
    const moi = svg('g', { class: 'moi', display: 'none' });
    moi.appendChild(svg('circle', { class: 'moi-halo', r: 13 }));
    moi.appendChild(svg('circle', { class: 'moi-point', r: 5.5 }));
    dessin.appendChild(moi);
    const echelle = svg('g', { class: 'echelle' });
    const echelleTrait = svg('path', { class: 'echelle-trait' });
    const echelleTexte = svg('text', { class: 'echelle-texte', y: -5 });
    echelle.appendChild(echelleTrait);
    echelle.appendChild(echelleTexte);
    dessin.appendChild(echelle);
    conteneur.appendChild(dessin);

    /* ── Le fond ───────────────────────────────────────────────────────────── */

    function poserReliefs() {
      if (!fond) return;
      const ambiance = themeSombre() ? 'nuit' : 'clair';
      for (const nom of Object.keys(reliefs)) {
        const c = fond.cadres[nom];
        const [ouest, sud, est, nord] = c.boite;
        const im = reliefs[nom];
        im.setAttribute('x', X(ouest));
        im.setAttribute('y', Y(nord));
        im.setAttribute('width', est - ouest);
        im.setAttribute('height', Y(sud) - Y(nord));
        const adresse = 'img/relief-' + nom + '-' + ambiance + '.webp';
        if (im.getAttribute('href') !== adresse) im.setAttribute('href', adresse);
      }
      const [o, s, e, n] = fond.cadres.razes.boite;
      cadreRazes.setAttribute('x', X(o));
      cadreRazes.setAttribute('y', Y(n));
      cadreRazes.setAttribute('width', e - o);
      cadreRazes.setAttribute('height', Y(s) - Y(n));
    }

    function chemin(parent, classe, d) {
      if (d) parent.appendChild(svg('path', { class: classe, d }));
    }

    function poserTraces() {
      const de = (liste, c) => liste.filter((x) => x.c === c);
      // la région : rivières et grandes routes
      const r = fond.region;
      chemin(couches.region, 't-eau t-riviere', trace(r.eaux, 4));
      chemin(couches.region, 't-bord t-nationale', trace(r.routes, 4));
      chemin(couches.region, 't-route t-nationale', trace(r.routes, 4));
      // le Haut-Razès
      const z = fond.razes;
      chemin(couches.razes, 't-lac', trace(z.lacs, 5, true));
      chemin(couches.razes, 't-eau t-ruisseau', trace(de(z.eaux, 'ruisseau'), 5));
      chemin(couches.razes, 't-eau t-riviere', trace(de(z.eaux, 'riviere'), 5));
      chemin(couches.razes, 't-route t-chemin', trace(de(z.routes, 'chemin'), 5));
      chemin(couches.razes, 't-rail', trace(z.rail, 5));
      for (const c of ['locale', 'departementale', 'nationale']) chemin(couches.razes, 't-bord t-' + c, trace(de(z.routes, c), 5));
      for (const c of ['locale', 'departementale', 'nationale']) chemin(couches.razes, 't-route t-' + c, trace(de(z.routes, c), 5));
      // le village
      const v = fond.village;
      chemin(couches.village, 't-jardin', trace(de(v.enclos, 'jardin'), 6, true));
      chemin(couches.village, 't-cimetiere', trace(de(v.enclos, 'cimetiere'), 6, true));
      chemin(couches.village, 't-sentier', trace(de(v.voies, 'sentier'), 6));
      for (const c of ['ruelle', 'rue', 'locale', 'departementale']) chemin(couches.village, 't-bord-rue t-' + c, trace(de(v.voies, c), 6));
      for (const c of ['ruelle', 'rue', 'locale', 'departementale']) chemin(couches.village, 't-rue t-' + c, trace(de(v.voies, c), 6));
      chemin(couches.village, 't-mur', trace(v.murs, 6));
      chemin(couches.village, 't-bati', trace(v.batis.filter((b) => !b.n), 6, true));
      chemin(couches.village, 't-bati t-bati-fort', trace(v.batis.filter((b) => b.n), 6, true));
    }

    /* ── Les points et les noms ────────────────────────────────────────────── */

    let candidats = [];

    function preparerCandidats() {
      candidats = [];
      const nomsDossier = new Set();
      const lieux = Dossier.de('lieux').filter((a) => a.ec !== 'ailleurs');
      for (const a of lieux) {
        nomsDossier.add(normaliser(a.n));
        for (const al of a.al || []) nomsDossier.add(normaliser(al));
        const rennes = a.id === 'rennes-le-chateau';
        candidats.push({
          lieu: a, x: X(a.geo[1]), y: Y(a.geo[0]), texte: a.n, genre: 'lieu',
          prio: (rennes ? 420 : a.ec === 'region' ? 300 : a.ec === 'razes' ? 250 : 200) + (a.ty === 'village' || a.ty === 'ville' ? 15 : 0),
          kmin: a.ec === 'village' ? 14000 : (a.ec === 'razes' && !rennes ? 900 : 0),
          kmax: rennes ? 14000 : Infinity,
        });
      }
      if (opt.seul) return;      // un plan de situation : le lieu, et le fond
      const dejaLa = (nom) => nomsDossier.has(normaliser(nom));
      for (const b of fond.region.bourgs.filter((x) => VILLES.has(x.n)).concat(VILLES_AJOUTEES)) {
        if (dejaLa(b.n)) continue;
        candidats.push({ x: X(b.g[0]), y: Y(b.g[1]), texte: b.n, genre: 'ville', prio: 150 + Math.min(40, (b.h || 0) / 3000), kmin: 0, kmax: K_RAZES, point: 2.6 });
      }
      for (const b of fond.razes.bourgs) {
        if (dejaLa(b.n)) continue;
        const hameau = b.t === 'hamlet';
        candidats.push({
          x: X(b.g[0]), y: Y(b.g[1]), texte: b.n, genre: hameau ? 'hameau' : (b.t === 'town' ? 'ville' : 'bourg'),
          prio: b.t === 'town' ? 140 : hameau ? 20 : 80, kmin: b.t === 'town' ? K_RAZES : hameau ? 5200 : 1500, kmax: Infinity,
          point: hameau ? 1.4 : 2.1,
        });
      }
      const sommets = fond.razes.sommets.slice().sort((a, b) => b.a - a.a);
      sommets.forEach((s, rang) => {
        if (dejaLa(s.n)) return;
        candidats.push({
          x: X(s.g[0]), y: Y(s.g[1]), texte: s.n + (s.a ? ' ' + s.a : ''), genre: 'sommet',
          prio: 60 + s.a / 100, kmin: rang < 14 ? 2000 : rang < 45 ? 3600 : 6000, kmax: Infinity, triangle: true,
        });
      });
      // le nom d'un cours d'eau : au milieu de son plus long tronçon
      const poserEaux = (eaux, kmin, kmax, seuil, base) => {
        const parNom = new Map();
        for (const e of eaux) {
          if (!e.n) continue;
          const actuel = parNom.get(e.n);
          if (!actuel || e.p.length > actuel.p.length) parNom.set(e.n, e);
        }
        for (const [nom, e] of parNom) {
          if (e.p.length < seuil) continue;
          const milieu = Math.floor(e.p.length / 4) * 2;
          candidats.push({ x: X(e.p[milieu]), y: Y(e.p[milieu + 1]), texte: nom, genre: 'eau', prio: base + Math.min(30, e.p.length / 20), kmin, kmax });
        }
      };
      poserEaux(fond.region.eaux, 430, 1300, 120, 50);
      poserEaux(fond.razes.eaux.filter((e) => e.c === 'riviere'), 1300, Infinity, 16, 95);
      poserEaux(fond.razes.eaux.filter((e) => e.c === 'ruisseau'), 4200, Infinity, 20, 30);
      // les rues du village, de tout près : le nom au milieu du plus long tronçon
      const rues = new Map();
      for (const v of fond.village.voies) {
        if (!v.n) continue;
        const actuelle = rues.get(v.n);
        if (!actuelle || v.p.length > actuelle.p.length) rues.set(v.n, v);
      }
      for (const [nom, v] of rues) {
        const milieu = Math.floor(v.p.length / 4) * 2;
        candidats.push({ x: X(v.p[milieu]), y: Y(v.p[milieu + 1]), texte: nom, genre: 'rue', prio: 15, kmin: 70000, kmax: Infinity });
      }
      for (const c of candidats) c.noeud = null;
    }

    function noeudDe(c) {
      if (c.noeud) return c.noeud;
      const g = svg('g', { class: 'nom nom-' + c.genre });
      if (c.lieu) {
        g.classList.add('point-lieu', 'type-' + c.lieu.ty);
        g.appendChild(svg('circle', { class: 'point-fond', r: 9.5 }));
        g.appendChild(svg('path', { class: 'point-signe', d: SIGNES[c.lieu.ty] || SIGNES.site }));
        g.appendChild(svg('circle', { class: 'point-mini', r: 2.6 }));
      } else if (c.triangle) {
        g.appendChild(svg('path', { class: 'nom-triangle', d: 'M-3.4 2.6L0 -3.2 3.4 2.6Z' }));
      } else if (c.point) {
        g.appendChild(svg('circle', { class: 'nom-point', r: c.point }));
      }
      c.etiquette = svg('text', { class: 'nom-texte' }, c.texte);
      g.appendChild(c.etiquette);
      c.noeud = g;
      c.dansLeDessin = false;
      return g;
    }

    let poses = [];      // les lieux visibles, pour le toucher : { c, sx, sy }

    function poserNoms() {
      if (!fond) return;
      const boites = [];
      const libre = (b) => {
        for (const o of boites) if (b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]) return false;
        return true;
      };
      poses = [];
      const visibles = [];
      for (const c of candidats) {
        let montre = k >= c.kmin && k < c.kmax;
        let mini = false;
        if (c.lieu) {
          if (filtre && !filtre(c.lieu)) montre = false;
          else if (!montre && c.lieu.ec === 'razes' && k < c.kmin) { montre = true; mini = true; }   // de loin : un grain
          if (choisi === c.lieu.id) { montre = true; mini = false; }
        }
        if (!montre) continue;
        const sx = (c.x - cx) * k + L / 2;
        const sy = (c.y - cy) * k + H / 2;
        if (sx < -60 || sx > L + 60 || sy < -30 || sy > H + 30) continue;
        visibles.push({ c, sx, sy, mini, prio: c.prio + (c.lieu && choisi === c.lieu.id ? 1000 : 0) });
      }
      visibles.sort((a, b) => b.prio - a.prio);
      const gardes = new Set();
      for (const v of visibles) {
        const { c, sx, sy, mini } = v;
        const g = noeudDe(c);
        const rayon = c.lieu ? (mini ? 3 : 10) : (c.triangle ? 4 : (c.point || 0) + 1);
        const l = largeur(c.texte, c.genre);
        const h = 14;
        let place = null;
        if (!mini) {
          // les marques ne se cachent jamais ; seuls les noms cèdent la place
          const essais = c.genre === 'eau' || c.genre === 'rue'
            ? [[-l / 2, -h / 2]]
            : [[rayon + 3, -h / 2], [-rayon - 3 - l, -h / 2], [-l / 2, -rayon - h - 1], [-l / 2, rayon + 2]];
          for (const [dx, dy] of essais) {
            const b = [sx + dx - 1, sy + dy - 1, sx + dx + l + 1, sy + dy + h + 1];
            if (b[0] < 2 || b[2] > L - 2) continue;
            if (libre(b)) { place = [dx, dy]; boites.push(b); break; }
          }
          if (!place && !c.lieu) continue;      // ni nom ni marque : on tait ce point
        }
        if (c.lieu || c.point || c.triangle) boites.push([sx - rayon, sy - rayon, sx + rayon, sy + rayon]);
        g.setAttribute('transform', 'translate(' + sx.toFixed(1) + ' ' + sy.toFixed(1) + ')');
        g.classList.toggle('mini', mini);
        g.classList.toggle('choisi', !!c.lieu && choisi === c.lieu.id);
        if (place) {
          c.etiquette.setAttribute('x', place[0].toFixed(1));
          c.etiquette.setAttribute('y', (place[1] + 10.5).toFixed(1));
          c.etiquette.removeAttribute('display');
        } else {
          c.etiquette.setAttribute('display', 'none');
        }
        gardes.add(c);
        if (c.lieu && !mini) poses.push({ c, sx, sy });
      }
      // l'ordre du dessin : les moins importants d'abord, les lieux par-dessus
      for (const c of candidats) {
        if (!c.noeud) continue;
        if (gardes.has(c)) {
          if (!c.dansLeDessin) { noms.appendChild(c.noeud); c.dansLeDessin = true; }
        } else if (c.dansLeDessin) {
          noms.removeChild(c.noeud); c.dansLeDessin = false;
        }
      }
      const dessus = visibles.filter((v) => v.c.lieu && gardes.has(v.c)).reverse();
      for (const v of dessus) noms.appendChild(v.c.noeud);
    }

    /* ── Le dessin ─────────────────────────────────────────────────────────── */

    function borner() {
      const kMin = L / 1.75;
      k = Math.max(kMin, Math.min(K_MAX, k));
      if (!fond) return;
      const [o, s, e, n] = fond.cadres.region.boite;
      const demiL = L / 2 / k;
      const demiH = H / 2 / k;
      const gauche = X(o) + demiL;
      const droite = X(e) - demiL;
      const haut = Y(n) + demiH;
      const bas = Y(s) - demiH;
      cx = gauche > droite ? (X(o) + X(e)) / 2 : Math.max(gauche, Math.min(droite, cx));
      cy = haut > bas ? (Y(n) + Y(s)) / 2 : Math.max(haut, Math.min(bas, cy));
    }

    function dessiner() {
      if (trame) { trame.annuler(); trame = null; }
      if (detruit) return;
      borner();
      monde.setAttribute('transform', 'translate(' + (L / 2).toFixed(2) + ' ' + (H / 2).toFixed(2) + ') scale(' + k.toFixed(3) + ') translate(' + (-cx).toFixed(7) + ' ' + (-cy).toFixed(7) + ')');
      dessin.classList.toggle('n-moyen', k >= K_MOYEN);
      dessin.classList.toggle('n-razes', k >= K_RAZES);
      dessin.classList.toggle('n-detail', k >= K_DETAIL);
      dessin.classList.toggle('n-proche', k >= K_PROCHE);
      dessin.classList.toggle('n-village', k >= K_VILLAGE);
      poserNoms();
      // l'échelle : une longueur ronde, proche de 90 pixels
      const metresParPixel = 111320 * Math.cos(latDe(cy) * RAD) / k;
      const rondes = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
      let longueur = rondes[0];
      for (const r of rondes) if (r <= 96 * metresParPixel) longueur = r;
      const px = longueur / metresParPixel;
      echelle.setAttribute('transform', 'translate(12 ' + (H - 12) + ')');
      echelleTrait.setAttribute('d', 'M0 -4V0H' + px.toFixed(1) + 'V-4');
      echelleTexte.setAttribute('x', (px / 2).toFixed(1));
      echelleTexte.textContent = longueur >= 1000 ? (longueur / 1000) + ' km' : longueur + ' m';
      if (position) {
        const sx = (X(position.lon) - cx) * k + L / 2;
        const sy = (Y(position.lat) - cy) * k + H / 2;
        moi.setAttribute('transform', 'translate(' + sx.toFixed(1) + ' ' + sy.toFixed(1) + ')');
        moi.removeAttribute('display');
      } else {
        moi.setAttribute('display', 'none');
      }
      if (opt.surMouvement) opt.surMouvement(cadreCourant());
    }

    /* Une image à la prochaine occasion. Dans une page à l'arrière-plan, le
     * navigateur suspend `requestAnimationFrame` : une minuterie prend le relais,
     * pour que la carte soit juste quand on y revient. */
    function prochaineImage(f) {
      let fait = false;
      let idA = 0;
      let idT = 0;
      const une = (t) => {
        if (fait) return;
        fait = true;
        cancelAnimationFrame(idA);
        clearTimeout(idT);
        f(typeof t === 'number' ? t : performance.now());
      };
      idA = requestAnimationFrame(une);
      idT = setTimeout(une, 140);
      return { annuler() { fait = true; cancelAnimationFrame(idA); clearTimeout(idT); } };
    }
    function arreterAnimation() { if (animation) { animation.annuler(); animation = null; } }
    function demander() { if (!trame) trame = prochaineImage(dessiner); }

    function mesurer() {
      const boite = conteneur.getBoundingClientRect();
      const l = Math.max(240, Math.round(boite.width));
      const h = opt.hauteur || Math.round(Math.max(300, Math.min(l * 0.82, racine.innerHeight * 0.62)));
      if (l === L && h === H) return false;
      const facteur = L ? l / L : 1;
      L = l; H = h;
      if (premierCadrage) k *= facteur;
      dessin.setAttribute('viewBox', '0 0 ' + L + ' ' + H);
      dessin.setAttribute('width', L);
      dessin.setAttribute('height', H);
      return true;
    }

    /* Quel cadre regarde-t-on ? Sert à allumer le bon bouton. */
    function cadreCourant() {
      if (k >= 14000) return 'village';
      if (k >= K_RAZES) return 'razes';
      return 'region';
    }

    /* ── Se déplacer ───────────────────────────────────────────────────────── */

    function allerA(cible, anime) {
      const but = { cx: X(cible.lon), cy: Y(cible.lat), k: cible.k || (cible.largeur ? L / cible.largeur : k) };
      arreterAnimation();
      const reduit = racine.matchMedia && racine.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!anime || reduit) { cx = but.cx; cy = but.cy; k = but.k; demander(); return; }
      const depart = { cx, cy, k };
      const debut = performance.now();
      const duree = 620;
      const pas = (t) => {
        const u = Math.min(1, (t - debut) / duree);
        const e = u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
        // l'échelle varie en logarithme : le mouvement paraît régulier
        k = Math.exp(Math.log(depart.k) + (Math.log(but.k) - Math.log(depart.k)) * e);
        cx = depart.cx + (but.cx - depart.cx) * e;
        cy = depart.cy + (but.cy - depart.cy) * e;
        dessiner();
        animation = u < 1 ? prochaineImage(pas) : null;
      };
      animation = prochaineImage(pas);
    }

    function cadrer(nom, anime) { if (CADRES[nom]) allerA(CADRES[nom], anime); }

    function zoomer(facteur, sx, sy) {
      arreterAnimation();
      const ax = sx === undefined ? L / 2 : sx;
      const ay = sy === undefined ? H / 2 : sy;
      const mx = cx + (ax - L / 2) / k;
      const my = cy + (ay - H / 2) / k;
      k = Math.max(L / 1.75, Math.min(K_MAX, k * facteur));
      cx = mx - (ax - L / 2) / k;
      cy = my - (ay - H / 2) / k;
      demander();
    }

    function choisir(id, silencieux) {
      choisi = id || null;
      demander();
      if (surChoix && !silencieux) surChoix(choisi ? Dossier.parId(choisi) : null);
    }

    /* Montrer un lieu : on s'en approche assez pour qu'il paraisse. */
    function montrer(a, anime) {
      const kVoulu = a.ec === 'village' ? Math.max(k, 60000) : a.ec === 'razes' ? Math.max(k, 3200) : Math.max(Math.min(k, 900), L / 1.6);
      choisi = a.id;
      allerA({ lon: a.geo[1], lat: a.geo[0], k: a.ec === 'region' ? kVoulu : Math.min(kVoulu, a.ec === 'village' ? 120000 : 9000) }, anime);
      if (surChoix) surChoix(a);
    }

    /* ── Les gestes ────────────────────────────────────────────────────────── */

    if (opt.interactif) {
      const doigts = new Map();
      let depart = null;
      let pince = null;
      let bouge = false;
      const localiser = (e) => {
        const b = dessin.getBoundingClientRect();
        return [(e.clientX - b.left) * (L / b.width), (e.clientY - b.top) * (H / b.height)];
      };
      dessin.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        arreterAnimation();
        doigts.set(e.pointerId, localiser(e));
        try { dessin.setPointerCapture(e.pointerId); } catch (x) { /* rien */ }
        if (doigts.size === 1) {
          depart = { p: localiser(e), cx, cy, t: performance.now() };
          bouge = false;
        } else if (doigts.size === 2) {
          const [a, b] = Array.from(doigts.values());
          pince = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), k, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2, cx, cy };
          bouge = true;
        }
      });
      dessin.addEventListener('pointermove', (e) => {
        if (!doigts.has(e.pointerId)) return;
        doigts.set(e.pointerId, localiser(e));
        if (doigts.size === 1 && depart) {
          const p = doigts.get(e.pointerId);
          const dx = p[0] - depart.p[0];
          const dy = p[1] - depart.p[1];
          if (!bouge && Math.hypot(dx, dy) < 6) return;
          bouge = true;
          dessin.classList.add('saisie');
          cx = depart.cx - dx / k;
          cy = depart.cy - dy / k;
          demander();
        } else if (doigts.size === 2 && pince) {
          const [a, b] = Array.from(doigts.values());
          const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
          const mx = (a[0] + b[0]) / 2;
          const my = (a[1] + b[1]) / 2;
          const kNouveau = Math.max(L / 1.75, Math.min(K_MAX, pince.k * d / Math.max(1, pince.d)));
          // le point du monde qui était sous le milieu des doigts y reste
          const wx = pince.cx + (pince.mx - L / 2) / pince.k;
          const wy = pince.cy + (pince.my - H / 2) / pince.k;
          k = kNouveau;
          cx = wx - (mx - L / 2) / k;
          cy = wy - (my - H / 2) / k;
          demander();
        }
      });
      const lacher = (e) => {
        if (!doigts.has(e.pointerId)) return;
        const p = doigts.get(e.pointerId);
        doigts.delete(e.pointerId);
        try { dessin.releasePointerCapture(e.pointerId); } catch (x) { /* rien */ }
        dessin.classList.remove('saisie');
        if (doigts.size === 1) {
          // la pince finit : le doigt qui reste reprend le déplacement
          const reste = Array.from(doigts.values())[0];
          depart = { p: reste, cx, cy, t: 0 };
          pince = null;
          return;
        }
        pince = null;
        if (!bouge && depart && e.type === 'pointerup') {
          // un toucher : le lieu le plus proche, s'il est sous le doigt
          let proche = null;
          let distance = e.pointerType === 'mouse' ? 14 : 24;
          for (const q of poses) {
            const d = Math.hypot(q.sx - p[0], q.sy - p[1]);
            if (d < distance) { distance = d; proche = q.c.lieu; }
          }
          choisir(proche ? proche.id : null);
        }
        depart = null;
      };
      dessin.addEventListener('pointerup', lacher);
      dessin.addEventListener('pointercancel', lacher);
      dessin.addEventListener('wheel', (e) => {
        e.preventDefault();
        const [sx, sy] = localiser(e);
        const pasDeMolette = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
        zoomer(Math.exp(-pasDeMolette * 0.0016), sx, sy);
      }, { passive: false });
      dessin.addEventListener('dblclick', (e) => {
        e.preventDefault();
        const [sx, sy] = localiser(e);
        const mx = cx + (sx - L / 2) / k;
        const my = cy + (sy - H / 2) / k;
        allerA({ lon: mx + LON0, lat: latDe(my), k: Math.min(K_MAX, k * 2.2) }, true);
      });
      dessin.addEventListener('keydown', (e) => {
        const pas = 60 / k;
        if (e.key === 'ArrowLeft') cx -= pas;
        else if (e.key === 'ArrowRight') cx += pas;
        else if (e.key === 'ArrowUp') cy -= pas;
        else if (e.key === 'ArrowDown') cy += pas;
        else if (e.key === '+' || e.key === '=') { zoomer(1.5); e.preventDefault(); return; }
        else if (e.key === '-') { zoomer(1 / 1.5); e.preventDefault(); return; }
        else return;
        e.preventDefault();
        demander();
      });

      const commandes = element('div', 'carte-commandes');
      const plus = bouton('carte-bouton', '+', () => zoomer(1.8));
      plus.setAttribute('aria-label', 'Zoomer');
      const moins = bouton('carte-bouton', '−', () => zoomer(1 / 1.8));
      moins.setAttribute('aria-label', 'Dézoomer');
      commandes.appendChild(plus);
      commandes.appendChild(moins);
      conteneur.appendChild(commandes);
    }

    /* ── Mise en route ─────────────────────────────────────────────────────── */

    let premierCadrage = false;
    function cadrageInitial() {
      if (opt.centre) allerA(opt.centre, false);
      else cadrer(opt.cadre, false);
      premierCadrage = true;
    }

    mesurer();
    cadrageInitial();
    const observateur = 'ResizeObserver' in racine ? new ResizeObserver(() => {
      if (!conteneur.isConnected) return;
      const avant = premierCadrage;
      if (mesurer()) { if (!avant) cadrageInitial(); demander(); }
    }) : null;
    if (observateur) observateur.observe(conteneur);

    const surTheme = () => { poserReliefs(); };
    document.addEventListener('reglages-changes', surTheme);
    const media = racine.matchMedia ? racine.matchMedia('(prefers-color-scheme: dark)') : null;
    if (media && media.addEventListener) media.addEventListener('change', surTheme);

    charger().then(() => {
      if (detruit) return;
      poserReliefs();
      poserTraces();
      preparerCandidats();
      conteneur.classList.add('prete');
      demander();
    }).catch((erreur) => {
      conteneur.appendChild(element('p', 'discret carte-panne', 'La carte n’a pas pu se dessiner : ' + (erreur && erreur.message ? erreur.message : erreur)));
    });

    return {
      cadrer, allerA, zoomer, choisir, montrer, redessiner: () => { mesurer(); demander(); },
      filtrer(f) { filtre = f || null; demander(); },
      situer(p) { position = p || null; demander(); },
      surChoix(f) { surChoix = f; },
      get choisi() { return choisi; },
      detruire() {
        detruit = true;
        arreterAnimation();
        if (trame) { trame.annuler(); trame = null; }
        if (observateur) observateur.disconnect();
        document.removeEventListener('reglages-changes', surTheme);
        if (media && media.removeEventListener) media.removeEventListener('change', surTheme);
      },
    };
  }

  /* Le plan de situation d'une fiche de lieu : la même carte, immobile, centrée. */
  function plan(conteneur, a) {
    const k = a.ec === 'village' ? 90000 : a.ec === 'razes' ? 3000 : 520;
    return creer(conteneur, { interactif: false, seul: a.id, hauteur: 210, centre: { lon: a.geo[1], lat: a.geo[0], k } });
  }

  /* Le signe d'un type de lieu, seul : pour les listes et la légende. */
  function signe(type, classe) {
    const s = svg('svg', { class: 'signe-lieu ' + (classe || ''), viewBox: '-7 -7 14 14', 'aria-hidden': 'true', focusable: 'false' });
    s.appendChild(svg('path', { d: SIGNES[type] || SIGNES.site }));
    return s;
  }

  /* À vol d'oiseau, en kilomètres. */
  function distance(a, b) {
    const dLat = (b[0] - a[0]) * RAD;
    const dLon = (b[1] - a[1]) * RAD;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * RAD) * Math.cos(b[0] * RAD) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(h));
  }

  racine.Carte = { creer, plan, signe, distance, charger, CADRES, NOMS_TYPES };

})(window);
