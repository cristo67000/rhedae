'use strict';
/*
 * L'église Sainte-Marie-Madeleine de Rennes-le-Château, en volume.
 *
 * `Eglise.construire(annee)` rend la maquette telle qu'elle était cette
 * année-là : avant 1887, une église romane nue ; puis l'autel (1887), le
 * dallage et la chaire (1891), le pilier de la Vierge dans le jardin (1891),
 * enfin le décor de la maison Giscard, le porche et le calvaire (1897).
 *
 * D'où viennent les mesures :
 * — le plan : le contour du cadastre (OpenStreetMap, way 287034825) et le relevé
 *   de Michel Verrot (1995) — nef de trois travées et d'une travée trapézoïdale,
 *   5,3 m entre piliers, 6,2 m au fond des arcades, travée de chœur, abside de
 *   4,96 m d'ouverture, clocher de 4,74 × 3,80 m contre le mur nord ;
 * — la place de chaque statue, de chaque station, du mobilier : les
 *   photographies et les films pris sur place en août 2024 par Cristo6772, et
 *   le plan du mobilier publié par rennes-le-chateau-archive.com ;
 * — l'aspect des statues, des stations, de l'autel, des vitraux, du Sermon sur
 *   la montagne et du tympan : ces mêmes photographies, découpées et rangées
 *   dans img/eglise-decor.webp par build/decor_eglise.py (js/eglise-decor.js
 *   dit où chaque morceau se trouve, et donne la silhouette des statues) ;
 * — les hauteurs : AUCUNE n'est publiée. Elles sont estimées sur ces mêmes
 *   photographies (un banc fait 0,95 m, une porte 2,9 m) : à ± 0,5 m près.
 *
 * C'est une maquette, pas un relevé. Une statue y est un volume tiré de sa
 * silhouette — une section en ellipse à chaque hauteur — sur lequel sa
 * photographie est projetée de face : juste vue de devant, sommaire de profil,
 * et sans dos. Les stations sont des plaques découpées ; la première, qu'aucune
 * photographie ne montre, reste nue. La sacristie n'a pas d'intérieur. Le repère : x vers
 * l'est (le chœur), y vers le haut, z vers le sud ; l'origine est au pied du
 * mur du fond, dans l'axe de la nef. Les longueurs sont en mètres.
 *
 * Ce fichier est le même dans Rhedae et dans Terribilis, comme
 * js/eglise-decor.js et img/eglise-decor.webp, qu'il lui faut.
 */
(function (racine) {

  /* ── Les cotes ───────────────────────────────────────────────────────────── */

  const C = {
    trav: [0, 3.1, 6.2, 9.3, 12.3],   // les quatre travées de la nef, d'ouest en est
    zp: 2.65,            // demi-largeur entre piliers
    zf: 3.1,             // demi-largeur au fond des arcades
    zx: 4.2,             // demi-largeur hors œuvre
    xo: -1.0,            // le nu extérieur du mur ouest
    imposte: 4.6,        // naissance de la voûte de la nef
    fleche: 2.3,         // sa flèche : une anse de panier
    arc: [12.3, 13.2],   // l'arc qui sépare la nef du chœur
    xa: 15.6,            // le centre de l'abside
    ra: 2.5,             // son rayon intérieur
    rx: 3.5,             // son rayon extérieur
    murAbside: 4.9, calotte: 1.5,
    egout: 7.5, faite: 8.9,
    lambris: 1.6,
    clocher: [5.6, 10.3, -8.0, 12.4, 13.6],   // x0, x1, z (face nord), égout, pointe
  };

  const T = {
    moellon: '#c9a66b', moellonSombre: '#b8935a', pierre: '#d6c4a0', tuile: '#b9683f',
    sol: '#b7a57c', jardin: '#7f9460', gravier: '#cfc3a6', enduit: '#a59d8d',
    chaux: '#d8d1c0', voutePale: '#cfc8b8',
    appareil: '#e8d59c', voute: '#b4c2cb', bleu: '#27418f', rose: '#c79a94', bande: '#c9a9b4',
    bois: '#6b4527', boisClair: '#9a6a3c', or: '#c9a03c', creme: '#e6dcc4',
    fer: '#3a3d42', noir: '#22232a', peau: '#e2b99a', verre: '#3355a0', verreDehors: '#2b3556',
    jaune: '#e3b730', vert: '#3f7f76', cypres: '#2f4a33', roche: '#a8926c', marbre: '#e9e6dc',
  };

  /* ── Les pièces qui reviennent ───────────────────────────────────────────── */

  /* Une figurine tournée, pour ce qui est trop petit pour une photographie
   * (l'ange qui coiffe la chaire). */
  function statue(m, h, robe, manteau, cheveux) {
    const k = h / 1.5;
    m.tour(0, 0, [[0.22 * k, 0], [0.24 * k, 0.05 * k], [0.16 * k, 0.6 * k], [0.19 * k, 0.98 * k], [0.2 * k, 1.17 * k],
      [0.08 * k, 1.25 * k], [0.105 * k, 1.32 * k], [0.11 * k, 1.41 * k], [0.06 * k, 1.5 * k], [0, 1.5 * k]],
    [robe, robe, manteau || robe, manteau || robe, manteau || robe, T.peau, T.peau, cheveux || '#5a3b24', cheveux || '#5a3b24'], 0,
    { segments: 9, ez: 0.78 });
  }

  /* La console d'une statue : un cul-de-lampe peint, un socle noir, le nom en
   * lettres d'or dessus ; `dais` : à cette hauteur, le petit clocheton doré. */
  function console3(m, dais) {
    m.tour(0, 0.02, [[0.03, -0.66], [0.1, -0.56], [0.13, -0.42], [0.22, -0.3], [0.27, -0.2], [0.31, -0.17]],
      ['#6f8a7a', '#8a4a3a', '#b9914a', '#7a3b3b', T.or], 0, { segments: 8, ez: 0.78 });
    m.boite(-0.35, -0.17, -0.24, 0.35, -0.11, 0.31, '#3b5f8a', 0);
    m.boite(-0.31, -0.11, -0.21, 0.31, 0, 0.27, T.noir, 0);
    m.boite(-0.19, -0.09, 0.27, 0.19, -0.02, 0.285, T.or, 0, 'z-');
    if (dais) {
      m.tour(0, 0.06, [[0.24, dais], [0.33, dais + 0.05], [0.33, dais + 0.17], [0.27, dais + 0.2], [0.2, dais + 0.4], [0.1, dais + 0.47],
        [0.055, dais + 0.6], [0.09, dais + 0.64], [0, dais + 0.76]],
      [T.or, '#2f5a55', T.or, '#b9914a', T.or, '#3f7f76', T.or, T.or], 0, { segments: 6, ez: 0.85 });
      for (let k = 0; k < 6; k += 1) {
        const a = (k * 60 + 30) * Math.PI / 180;
        m.tour(0.31 * Math.cos(a), 0.06 + 0.26 * Math.sin(a), [[0.035, dais - 0.07], [0.04, dais + 0.2], [0, dais + 0.33]], T.or, 0, { segments: 4 });
      }
    }
  }

  /* Le pourtour d'une station du chemin de croix, dans sa photographie : la
   * croix, le gâble entre deux pinacles, le cadre, le cul-de-lampe au chiffre. */
  const DEMI_STATION = [[0.465, 0], [0.465, 0.035], [0.385, 0.035], [0.385, 0.09], [0.465, 0.09], [0.465, 0.15], [0.17, 0.265],
    [0.14, 0.265], [0.14, 0.2], [0.085, 0.17], [0.03, 0.2], [0.03, 0.78], [0, 0.79], [0, 0.85], [0.1, 0.86], [0.14, 0.93], [0.3, 0.96], [0.42, 1]];
  const CONTOUR_STATION = DEMI_STATION.concat(DEMI_STATION.slice().reverse().map(([u, v]) => [1 - u, v]));

  /* Une station : 0,74 m sur 1,44, épaisse d'une main. Sans photographie, le
   * cadre reste nu autour d'un panneau sombre. */
  function station(m, cas) {
    if (cas) { m.plaque(CONTOUR_STATION, cas, 0.74, 1.44, 0.09); return; }
    m.plaque(CONTOUR_STATION, [0, 0, 0, 0, 216, 204, 178], 0.74, 1.44, 0.09, 0);
    m.boite(-0.2, 0.36, 0.09, 0.2, 0.98, 0.1, '#8d8674', 0, 'z-');
  }

  function cypres(m, x, z, h) {
    m.tour(x, z, [[0.12, 0], [0.12, 0.5]], '#5a4630', 0, { segments: 6 });
    m.tour(x, z, [[0.5, 0.5], [0.85, h * 0.3], [0.6, h * 0.7], [0.05, h]], T.cypres, 8, { segments: 7 });
  }

  function croix(m, h, l, e, couleur) {
    m.boite(-e / 2, 0, -e / 2, e / 2, h, e / 2, couleur, 0);
    m.boite(-l / 2, h * 0.68, -e / 2, l / 2, h * 0.68 + e, e / 2, couleur, 0);
  }

  /* ── La maquette ─────────────────────────────────────────────────────────── */

  /* `options.sol: false` : sans le terrain alentour — la maquette du village
   * pose l'église sur le sien. */
  function construire(annee, options) {
    const avecSol = !(options && options.sol === false);
    const an = annee || 2026;
    const Maillage = racine.Maquette.Maillage;
    const DEC = racine.EgliseDecor;
    if (!DEC) throw new Error('js/eglise-decor.js doit être chargé avant js/eglise.js');
    const cas = (nom) => DEC.cases[nom];
    /* Une statue, debout là où l'on est placé : sa silhouette, sa photographie. */
    const figure = (m, nom, h, o) => m.silhouette(DEC.formes[nom], DEC.cases[nom], h, o);
    const abords = new Maillage(), ext = new Maillage(), int = new Maillage(), mob = new Maillage();
    ext.dedans = false; abords.dedans = false;
    int.dedans = true; int.interieur = true;
    mob.dedans = true; mob.interieur = true;
    /* Le sol et les bancs s'ôtent pour montrer le caveau ; les traces sont ce
     * qu'on marque au sol sans que cela y soit (l'emplacement d'une dalle partie). */
    const sol = new Maillage(), crypte = new Maillage(), traces = new Maillage();
    sol.dedans = true; sol.interieur = true; sol.sauf = 'creuse';
    crypte.dedans = 'seul'; crypte.interieur = true; crypte.si = 'creuse';
    traces.dedans = 'seul'; traces.interieur = true;

    const autel1887 = an >= 1887;
    const dallage1891 = an >= 1891;
    const decor1897 = an >= 1897;

    const centres = [0, 1, 2, 3].map((i) => (C.trav[i] + C.trav[i + 1]) / 2);
    const mur = decor1897 ? T.appareil : T.chaux;
    const matMur = decor1897 ? 4 : 0;
    const verre = autel1887 ? T.verre : '#cfd8da';
    const matVerre = 7;
    const voute = (z) => C.imposte + C.fleche * Math.sqrt(Math.max(0, 1 - (z / C.zp) * (z / C.zp)));

    /* ═════════ Le dehors ═════════ */

    // le sol, le jardin, les allées
    if (avecSol) abords.quad([-30, -0.03, 30], [44, -0.03, 30], [44, -0.03, -24], [-30, -0.03, -24], T.sol, 8);
    if (an >= 1891) {
      abords.quad([1.5, 0, 8.4], [19, 0, 8.4], [19, 0, 7.2], [1.5, 0, 6.6], T.gravier, 0);
      abords.tri([3, 0.0, 8.4], [12, 0.0, 22], [19.5, 0.0, 8.4], T.jardin, 8);
    }

    // les murs gouttereaux, vus du dehors
    const baieDehors = (x, bas, haut, l) => ({ u: x, l: l || 0.9, bas, haut, cintre: true, prof: 0.5, fond: T.verreDehors, fondMatiere: 0, joue: T.pierre, joueMatiere: 0 });
    const xE = C.xa, xO = C.xo;
    ext.paroi([xO, C.zx], [xE, C.zx], 0, C.egout, T.moellon, 1, [
      { u: centres[0] - xO, l: 1.5, bas: 0, haut: 2.9, cintre: true, prof: 0.55, joue: T.pierre, joueMatiere: 0 },
      baieDehors(centres[1] - xO, 2.8, 4.3),
      baieDehors(centres[2] - xO, 2.8, 4.3),
      baieDehors(centres[3] - xO, 3.45, 4.3, 0.8),
    ]);
    ext.paroi([xE, -C.zx], [xO, -C.zx], 0, C.egout, T.moellon, 1, [baieDehors(xE - centres[1], 2.8, 4.3)]);
    ext.paroi([xO, -C.zx], [xO, C.zx], 0, C.egout, T.moellon, 1);
    ext.paroi([xE, C.zx], [xE, -C.zx], 0, C.egout, T.moellon, 1);
    // les deux pignons
    ext.tri([xO, C.egout, -C.zx], [xO, C.egout, C.zx], [xO, C.faite, 0], T.moellon, 1);
    ext.tri([xE, C.egout, C.zx], [xE, C.egout, -C.zx], [xE, C.faite, 0], T.moellon, 1);
    // le toit : deux versants de tuiles canal
    const dz = C.zx + 0.35, yb = C.egout - 0.1;
    ext.quad([xO - 0.3, yb, dz], [xE + 0.3, yb, dz], [xE + 0.3, C.faite + 0.05, 0], [xO - 0.3, C.faite + 0.05, 0], T.tuile, 2, true);
    ext.quad([xE + 0.3, yb, -dz], [xO - 0.3, yb, -dz], [xO - 0.3, C.faite + 0.05, 0], [xE + 0.3, C.faite + 0.05, 0], T.tuile, 2, true);

    // l'abside : un demi-cylindre, son toit en demi-cône, la rose de l'axe
    ext.tour(C.xa, 0, [[C.rx, 0], [C.rx, 6.0]], T.moellonSombre, 1, { a0: -90, a1: 90, segments: 14 });
    ext.tour(C.xa, 0, [[C.rx + 0.25, 5.95], [0.3, 7.3]], T.tuile, 2, { a0: -90, a1: 90, segments: 14 });
    ext.tour(C.xa, 0, [[C.rx + 0.25, 5.95], [C.rx + 0.25, 5.85], [C.rx, 5.85]], T.pierre, 0, { a0: -90, a1: 90, segments: 14 });
    if (autel1887) {
      ext.medaillon([C.xa + C.rx + 0.03, 4.3, 0], 0.82, [1, 0], T.pierre, 0);
      ext.medaillon([C.xa + C.rx + 0.05, 4.3, 0], 0.62, [1, 0], T.verreDehors, 0);
    } else {
      ext.boite(C.xa + C.rx - 0.05, 3.2, -0.2, C.xa + C.rx + 0.04, 4.2, 0.2, T.noir, 0);
    }

    // le clocher, contre le mur nord
    const [cx0, cx1, cz0, cEgout, cPointe] = C.clocher;
    ext.boite(cx0, 0, cz0, cx1, cEgout, -C.zx, T.moellon, 1, 'y- z+');
    ext.boite(cx0, C.egout - 0.6, -C.zx, cx1, cEgout, -C.zx + 1.1, T.moellon, 1, 'y-');
    ext.boite(cx0 - 0.12, cEgout - 0.18, cz0 - 0.12, cx1 + 0.12, cEgout, -C.zx + 1.22, T.pierre, 0);
    const cmx = (cx0 + cx1) / 2, cmz = (cz0 - C.zx + 1.1) / 2;
    const debord = 0.35;
    const coins = [[cx0 - debord, cz0 - debord], [cx1 + debord, cz0 - debord], [cx1 + debord, -C.zx + 1.1 + debord], [cx0 - debord, -C.zx + 1.1 + debord]];
    for (let i = 0; i < 4; i += 1) {
      const a = coins[i], b = coins[(i + 1) % 4];
      ext.tri([b[0], cEgout, b[1]], [a[0], cEgout, a[1]], [cmx, cPointe, cmz], T.tuile, 2);
    }
    ext.tour(cmx, cmz, [[0.07, cPointe - 0.05], [0.07, cPointe + 0.35], [0, cPointe + 0.45]], T.tuile, 0, { segments: 6 });
    // les abat-son : deux baies cintrées par face
    for (const dx of [-1.0, 1.0]) {
      ext.boite(cmx + dx - 0.4, 10.3, cz0 - 0.03, cmx + dx + 0.4, 11.5, cz0 + 0.1, '#4b4037', 6);
      ext.boite(cmx + dx - 0.4, 10.3, -C.zx + 1.0, cmx + dx + 0.4, 11.5, -C.zx + 1.13, '#4b4037', 6);
      ext.medaillon([cmx + dx, 11.5, cz0 - 0.035], 0.4, [0, -1], '#4b4037', 6, 12);
      ext.medaillon([cmx + dx, 11.5, -C.zx + 1.135], 0.4, [0, 1], '#4b4037', 6, 12);
    }
    for (const dzz of [-0.95, 0.95]) {
      ext.boite(cx0 - 0.03, 10.3, cmz + dzz - 0.4, cx0 + 0.1, 11.5, cmz + dzz + 0.4, '#4b4037', 6);
      ext.boite(cx1 - 0.1, 10.3, cmz + dzz - 0.4, cx1 + 0.03, 11.5, cmz + dzz + 0.4, '#4b4037', 6);
      ext.medaillon([cx0 - 0.035, 11.5, cmz + dzz], 0.4, [-1, 0], '#4b4037', 6, 12);
      ext.medaillon([cx1 + 0.035, 11.5, cmz + dzz], 0.4, [1, 0], '#4b4037', 6, 12);
    }

    // les trois contreforts du sud, coiffés de tuiles
    for (const x of [C.trav[1], C.trav[2], C.trav[3]]) {
      ext.boite(x - 0.55, 0, C.zx, x + 0.55, 4.7, C.zx + 2.0, T.moellon, 1, 'y- z-');
      ext.quad([x - 0.7, 4.65, C.zx + 2.2], [x + 0.7, 4.65, C.zx + 2.2], [x + 0.7, 5.5, C.zx], [x - 0.7, 5.5, C.zx], T.tuile, 2, true);
      ext.tri([x + 0.55, 4.7, C.zx + 2.0], [x + 0.55, 4.7, C.zx], [x + 0.55, 5.45, C.zx], T.moellon, 1);
      ext.tri([x - 0.55, 4.7, C.zx], [x - 0.55, 4.7, C.zx + 2.0], [x - 0.55, 5.45, C.zx], T.moellon, 1);
    }

    // la sacristie, en appentis contre la dernière travée et le chœur
    const sx0 = C.trav[3] + 0.55, sx1 = 15.0, sz1 = C.zx + 3.7;
    ext.boite(sx0, 0, C.zx, sx1, 2.65, sz1, T.moellon, 1, 'y- y+ z-');
    ext.quad([sx0 - 0.2, 2.55, sz1 + 0.3], [sx1 + 0.2, 2.55, sz1 + 0.3], [sx1 + 0.2, 3.35, C.zx], [sx0 - 0.2, 3.35, C.zx], T.tuile, 2, true);
    ext.tri([sx1, 2.65, sz1], [sx1, 2.65, C.zx], [sx1, 3.3, C.zx], T.moellon, 1);
    ext.tri([sx0, 2.65, C.zx], [sx0, 2.65, sz1], [sx0, 3.3, C.zx], T.moellon, 1);
    ext.boite(12.0, 0.8, sz1, 13.4, 2.3, sz1 + 0.06, T.pierre, 0);
    ext.boite(12.15, 0.95, sz1 + 0.05, 13.25, 2.15, sz1 + 0.09, T.noir, 0);
    // la « pièce secrète » : un réduit arrondi entre la sacristie et l'abside
    if (decor1897) {
      ext.tour(sx1, 6.0, [[1.9, 0], [1.9, 2.45]], T.moellon, 1, { a0: -90, a1: 90, segments: 9 });
      ext.tour(sx1, 6.0, [[2.1, 2.4], [0.1, 3.2]], T.tuile, 2, { a0: -90, a1: 90, segments: 9 });
      ext.medaillon([sx1 + 1.36, 1.9, 6.0 + 1.36], 0.32, [1, 1], T.pierre, 0);
      ext.medaillon([sx1 + 1.38, 1.9, 6.0 + 1.38], 0.2, [1, 1], T.noir, 0);
    }

    // le porche
    const px = centres[0], pz = C.zx + 2.2;
    if (decor1897) {
      for (const dx of [-1.25, 1.25]) {
        ext.boite(px + dx - 0.22, 0, pz - 0.44, px + dx + 0.22, 3.0, pz, T.pierre, 0);
        ext.boite(px + dx - 0.2, 0, C.zx, px + dx + 0.2, 3.0, pz - 0.44, T.moellon, 1, 'z-');
      }
      // le toit à deux pans raides, bordé d'antéfixes de céramique jaune
      ext.quad([px - 1.75, 2.85, pz + 0.2], [px - 1.75, 2.85, C.zx], [px, 5.1, C.zx], [px, 5.1, pz + 0.2], T.tuile, 2, true);
      ext.quad([px + 1.75, 2.85, C.zx], [px + 1.75, 2.85, pz + 0.2], [px, 5.1, pz + 0.2], [px, 5.1, C.zx], T.tuile, 2, true);
      ext.quad([px - 1.82, 2.7, pz + 0.22], [px - 1.5, 2.7, pz + 0.22], [px, 4.72, pz + 0.22], [px, 5.18, pz + 0.22], T.jaune, 0, true);
      ext.quad([px + 1.5, 2.7, pz + 0.22], [px + 1.82, 2.7, pz + 0.22], [px, 5.18, pz + 0.22], [px, 4.72, pz + 0.22], T.jaune, 0, true);
      ext.tour(px, pz + 0.22, [[0.12, 5.1], [0.16, 5.3], [0.03, 5.55]], T.marbre, 0, { segments: 6 });
      // le tympan : Marie-Madeleine, et « Terribilis est locus iste » dessous
      const ty = cas('tympan');
      ext.tri([px - 1.45, 3.05, C.zx + 0.06], [px + 1.45, 3.05, C.zx + 0.06], [px, 4.85, C.zx + 0.06], [ty[4], ty[5], ty[6]], 11,
        [[ty[0], ty[3]], [ty[2], ty[3]], [ty[0] + (ty[2] - ty[0]) * 0.483, ty[1]]]);
      // le linteau et sa clef, au-dessus de l'arc de la porte
      ext.boite(px - 1.5, 2.9, C.zx, px + 1.5, 3.07, C.zx + 0.12, T.pierre, 0, 'z-');
      ext.boite(px - 0.42, 2.72, C.zx, px + 0.42, 2.9, C.zx + 0.16, T.marbre, 0, 'z-');
      ext.boite(px - 0.2, 2.5, C.zx, px + 0.2, 2.72, C.zx + 0.14, T.pierre, 0, 'z-');
    } else {
      // avant Saunière : un simple auvent
      for (const dx of [-1.1, 1.1]) ext.boite(px + dx - 0.15, 0, pz - 0.3, px + dx + 0.15, 2.9, pz, T.pierre, 0);
      ext.quad([px - 1.5, 2.9, pz + 0.2], [px + 1.5, 2.9, pz + 0.2], [px + 1.5, 3.7, C.zx], [px - 1.5, 3.7, C.zx], T.tuile, 2, true);
    }

    // le presbytère, accolé à l'ouest ; l'annexe d'en face
    abords.boite(-13.5, 0, -4.4, xO, 6.2, 5.6, T.enduit, 1, 'y-');
    abords.quad([-13.8, 6.1, 5.9], [xO + 0.05, 6.1, 5.9], [xO + 0.05, 7.6, 0.6], [-13.8, 7.6, 0.6], T.tuile, 2, true);
    abords.quad([xO + 0.05, 6.1, -4.7], [-13.8, 6.1, -4.7], [-13.8, 7.6, 0.6], [xO + 0.05, 7.6, 0.6], T.tuile, 2, true);
    abords.tri([-13.5, 6.2, -4.4], [-13.5, 6.2, 5.6], [-13.5, 7.55, 0.6], T.enduit, 1);
    if (an >= 1901) {
      abords.boite(-3.2, 0, 12.2, 1.4, 3.6, 19, T.enduit, 1, 'y-');
      abords.quad([-3.4, 3.5, 12.0], [-3.4, 3.5, 19.2], [-0.9, 4.5, 19.2], [-0.9, 4.5, 12.0], T.tuile, 2, true);
      abords.quad([1.6, 3.5, 19.2], [1.6, 3.5, 12.0], [-0.9, 4.5, 12.0], [-0.9, 4.5, 19.2], T.tuile, 2, true);
      abords.tri([-3.2, 3.6, 12.2], [1.4, 3.6, 12.2], [-0.9, 4.45, 12.2], T.enduit, 1);
    }

    // le jardin du calvaire : la Vierge sur le pilier, le calvaire, la grotte
    if (an >= 1891) {
      const vz = an >= 1901 ? 11.95 : 10.5;
      abords.placer(-0.8, 0, vz, 180, 1, () => {
        abords.boite(-0.5, 0, -0.1, 0.5, 0.25, 0.6, T.pierre, 0);
        // le pilier, posé à l'envers : sa face sculptée, « MISSION 1891 »
        abords.boite(-0.22, 0.25, 0, 0.22, 1.05, 0.42, '#cdbb97', 0, 'z+');
        abords.tableau([-0.22, 0.25, 0.42], [0.22, 0.25, 0.42], [0.22, 1.05, 0.42], [-0.22, 1.05, 0.42], cas('pilier'));
        abords.boite(-0.32, 1.05, -0.04, 0.32, 1.2, 0.5, T.pierre, 0);
        // la niche, la Vierge dedans, son dais
        abords.boite(-0.36, 1.2, -0.06, 0.36, 2.86, 0.03, '#8fa3a3', 0, 'z+');
        abords.tableau([-0.36, 1.2, 0.03], [0.36, 1.2, 0.03], [0.36, 2.86, 0.03], [-0.36, 2.86, 0.03], cas('niche'));
        abords.placer(0, 1.22, 0.22, 0, 1, () => figure(abords, 'lourdes', 1.12, { epais: 0.13 }));
        abords.tour(0, 0.08, [[0.3, 2.62], [0.36, 2.66], [0.36, 2.86], [0.3, 2.9], [0.22, 3.08], [0.12, 3.1], [0, 3.3]],
          ['#6a6f66', '#7d8478', '#6a6f66', '#7d8478', '#6a6f66', '#6a6f66'], 0, { segments: 8, a0: 0, a1: 180 });
        // les deux vases de faïence, sur leurs consoles
        for (const dx of [-0.85, 0.85]) {
          abords.tour(dx, 0.06, [[0.03, 0.7], [0.17, 0.9], [0.17, 0.98]], ['#8f7d5a', '#a8926c'], 0, { segments: 7, a0: 0, a1: 180 });
          abords.tour(dx, 0.14, [[0.09, 0.98], [0.07, 1.04], [0.13, 1.16], [0.07, 1.26], [0.16, 1.52], [0.14, 1.52]],
            ['#dfe3e6', '#3f5f8a', '#3f5f8a', '#dfe3e6', '#c9d0d6'], 0, { segments: 9 });
        }
      });
    }
    if (decor1897) {
      abords.placer(12.6, 0, 13.6, 0, 1, () => {
        abords.tour(0, 0, [[3.1, 0], [3.1, 0.25], [0, 0.25]], T.jardin, 8, { segments: 14 });
        abords.boite(-1.5, 0, -1.5, 1.5, 0.3, 1.5, T.pierre, 10);
        abords.boite(-1.15, 0.3, -1.15, 1.15, 0.6, 1.15, T.pierre, 10);
        abords.boite(-0.8, 0.6, -0.8, 0.8, 0.9, 0.8, T.pierre, 10);
        abords.boite(-0.5, 0.9, -0.5, 0.5, 2.6, 0.5, T.pierre, 0);
        abords.boite(-0.62, 2.6, -0.62, 0.62, 2.8, 0.62, T.pierre, 0);
        abords.boite(-0.38, 1.2, 0.5, 0.38, 2.3, 0.53, T.marbre, 0);
        abords.placer(0, 2.8, 0, 0, 1, () => croix(abords, 3.6, 1.5, 0.2, '#7a5b46'));
        // la gloire de terre cuite : des rayons autour de la tête
        for (let k = 0; k < 18; k += 1) {
          const a = k * Math.PI / 9, r = k % 2 ? 0.62 : 0.8;
          const ca = Math.cos(a), sa = Math.sin(a), ta = 0.09;
          abords.quad([0.16 * ca + ta * sa, 5.32 + 0.16 * sa - ta * ca, 0.11], [r * ca + 0.03 * sa, 5.32 + r * sa - 0.03 * ca, 0.11],
            [r * ca - 0.03 * sa, 5.32 + r * sa + 0.03 * ca, 0.11], [0.16 * ca - ta * sa, 5.32 + 0.16 * sa + ta * ca, 0.11], '#a8563c', 0, true);
        }
        abords.boite(-0.11, 5.62, 0.1, 0.11, 5.86, 0.14, '#8a6a4a', 0);                 // INRI
        // le Christ : le corps d'après sa photographie, les bras tendus
        abords.placer(0, 4.32, 0.14, 0, 1, () => figure(abords, 'christ', 1.12, { epais: 0.09 }));
        for (const sx of [-1, 1]) {
          abords.quad([sx * 0.1, 5.1, 0.17], [sx * 0.66, 5.27, 0.13], [sx * 0.66, 5.34, 0.13], [sx * 0.1, 5.2, 0.17], '#9aa6ad', 0, true);
        }
        // les volutes de fer, de part et d'autre du socle
        for (const sx of [-1, 1]) {
          abords.quad([sx * 1.2, 0.9, 0.2], [sx * 1.27, 0.9, 0.2], [sx * 0.6, 2.3, 0.2], [sx * 0.53, 2.3, 0.2], T.fer, 0, true);
          abords.quad([sx * 0.85, 0.9, 0.2], [sx * 0.91, 0.9, 0.2], [sx * 0.58, 1.7, 0.2], [sx * 0.53, 1.7, 0.2], T.fer, 0, true);
        }
      });
      // la grotte de rocaille
      abords.tour(6.2, 15.4, [[1.9, 0], [2.0, 0.9], [1.5, 2.1], [0.8, 2.8], [0, 3.0]], T.roche, 8, { segments: 9, ex: 1.2 });
      abords.boite(5.5, 0, 13.4, 6.9, 1.5, 13.75, T.noir, 0);
      // le reposoir, à l'est du jardin, et le portail du cimetière
      abords.boite(21.4, 0, 2.6, 26.4, 2.7, 7.2, T.moellon, 1, 'y-');
      abords.tour(23.9, 4.9, [[3.9, 2.6], [0.1, 4.2]], T.tuile, 2, { segments: 4, a0: 45, a1: 405 });
      abords.boite(21.37, 0.6, 3.9, 21.42, 2.2, 5.9, T.boisClair, 6);
    }
    // le mur et le portail du cimetière, entre le chevet et le reposoir
    abords.boite(16.6, 0, 7.3, 18.6, 2.3, 7.7, T.moellon, 1, 'y-');
    abords.boite(20.2, 0, 7.3, 21.4, 2.3, 7.7, T.moellon, 1, 'y-');
    abords.boite(18.6, 0, 7.25, 18.9, 2.9, 7.75, T.pierre, 0);
    abords.boite(19.9, 0, 7.25, 20.2, 2.9, 7.75, T.pierre, 0);
    abords.boite(18.9, 0, 7.45, 19.9, 2.5, 7.55, T.vert, 0);
    abords.boite(18.6, 2.9, 7.25, 20.2, 3.1, 7.75, T.pierre, 0);
    abords.tri([18.75, 3.1, 7.76], [20.05, 3.1, 7.76], [19.4, 3.6, 7.76], T.pierre, 0);
    abords.tri([20.05, 3.1, 7.24], [18.75, 3.1, 7.24], [19.4, 3.6, 7.24], T.pierre, 0);
    abords.quad([18.75, 3.1, 7.76], [19.4, 3.6, 7.76], [19.4, 3.6, 7.24], [18.75, 3.1, 7.24], T.pierre, 0, true);
    abords.quad([19.4, 3.6, 7.76], [20.05, 3.1, 7.76], [20.05, 3.1, 7.24], [19.4, 3.6, 7.24], T.pierre, 0, true);
    abords.tour(19.4, 7.78, [[0.07, 3.16], [0.1, 3.24], [0.09, 3.34], [0, 3.38]], T.marbre, 0, { segments: 7, a0: 0, a1: 180 });   // le crâne
    for (const x of [18.75, 20.05]) abords.tour(x, 7.5, [[0.08, 3.1], [0.05, 3.16], [0.14, 3.3], [0.12, 3.42], [0.04, 3.46], [0, 3.52]], T.pierre, 0, { segments: 7 });
    abords.placer(19.4, 3.6, 7.5, 0, 1, () => croix(abords, 0.7, 0.4, 0.1, T.pierre));
    // le cimetière : son mur au nord et à l'est, des tombes, des cyprès
    abords.boite(-8, 0, -16.4, 39.6, 1.9, -16.0, T.moellon, 1, 'y-');
    abords.boite(39.2, 0, -16, 39.6, 1.9, 7.7, T.moellon, 1, 'y-');
    abords.boite(26.4, 0, 7.3, 39.6, 1.9, 7.7, T.moellon, 1, 'y-');
    const tombes = [[13, -11], [16.5, -12.5], [20, -9], [23.5, -12], [27, -6], [30.5, -11], [24, -3], [29, 1.5], [33.5, -4], [34, 3.5], [20.5, -4.5], [12, -13.5], [2, -12], [-3, -10]];
    tombes.forEach(([x, z], i) => {
      abords.boite(x - 0.5, 0, z - 1.0, x + 0.5, 0.3, z + 1.0, i % 3 ? T.pierre : T.marbre, 0, 'y-');
      abords.placer(x, 0.3, z - 0.85, 0, 1, () => croix(abords, 1.1, 0.6, 0.12, i % 2 ? T.pierre : T.fer));
    });
    cypres(abords, 22.5, 9.6, 7.5);
    cypres(abords, 31, -13, 6.5);
    cypres(abords, 36, -9, 7);
    cypres(abords, 8, -13.5, 6);

    /* ═════════ Le dedans ═════════ */

    // le sol : le damier de 1891, ou les dalles d'avant
    sol.quad([0, 0, C.zf], [C.arc[0], 0, C.zf], [C.arc[0], 0, -C.zf], [0, 0, -C.zf], T.creme, dallage1891 ? 3 : 10);
    sol.quad([C.arc[0], 0.15, C.ra + 0.1], [C.xa, 0.15, C.ra + 0.1], [C.xa, 0.15, -C.ra - 0.1], [C.arc[0], 0.15, -C.ra - 0.1], '#b9ab94', dallage1891 ? 3 : 10);
    sol.disque(C.xa, 0.15, 0, C.ra, '#b9ab94', dallage1891 ? 3 : 10, { a0: -90, a1: 90, segments: 14 });
    sol.quad([C.arc[0], 0, -C.ra], [C.arc[0], 0, C.ra], [C.arc[0], 0.15, C.ra], [C.arc[0], 0.15, -C.ra], T.pierre, 0);

    /*
     * Le tombeau des seigneurs. Ce qui est attesté : un caveau dans l'église,
     * « auprès du balustre » (registres de 1694 à 1726), et une anomalie de
     * géoradar sous le chœur, à plus de trois mètres (2001). Sa forme, sa taille
     * et son accès ne sont PAS connus : personne ne l'a vu depuis Saunière. Ce
     * qu'on dessine ici est une restitution — une salle voûtée sous l'entrée du
     * chœur, une descente depuis la nef, au pied du balustre — et la couleur le
     * dit : c'est la seule partie de la maquette qui ne soit pas de pierre blonde.
     */
    const K = { x0: 12.6, x1: 15.4, z: 1.45, bas: -3.2, naissance: -1.7, fleche: 0.8, ex: 9.6, ez: 0.5 };
    const ombre = '#7c86a6', ombreSol = '#646d8c', ombreMarche = '#8e97b4';
    crypte.quad([K.x0, K.bas, K.z], [K.x1, K.bas, K.z], [K.x1, K.bas, -K.z], [K.x0, K.bas, -K.z], ombreSol, 10);
    crypte.paroi([K.x0, -K.z], [K.x1, -K.z], K.bas, K.naissance, ombre, 1);
    crypte.paroi([K.x1, K.z], [K.x0, K.z], K.bas, K.naissance, ombre, 1);
    const cintre = (u) => K.naissance + K.fleche * Math.sqrt(Math.max(0, 1 - Math.pow((u - K.z) / K.z, 2)));
    crypte.paroi([K.x1, -K.z], [K.x1, K.z], K.bas, 0, ombre, 1, [], cintre);
    crypte.paroi([K.x0, K.z], [K.x0, -K.z], K.bas, 0, ombre, 1,
      [{ u: K.z, l: 2 * K.ez, bas: K.bas, haut: K.bas + 1.9, cintre: true, prof: 0 }], cintre);
    crypte.berceau(K.x0, K.x1, K.naissance, 0, K.z, K.fleche, ombre, 1, true, 10);
    // la descente : dix marches depuis la nef, entre deux murs
    const pas = (K.x0 - K.ex) / 10, hauteur = -K.bas / 10;
    for (let i = 0; i < 10; i += 1) {
      const x = K.ex + i * pas;
      crypte.boite(x, K.bas, -K.ez, x + pas, -(i + 1) * hauteur, K.ez, ombreMarche, 0, 'y- z+ z-');
    }
    crypte.paroi([K.ex, -K.ez], [K.x0, -K.ez], K.bas, 0, ombre, 1);
    crypte.paroi([K.x0, K.ez], [K.ex, K.ez], K.bas, 0, ombre, 1);
    crypte.paroi([K.ex, K.ez], [K.ex, -K.ez], K.bas, 0, ombre, 1);
    // deux cercueils de pierre, pour l'échelle
    for (const z of [-0.75, 0.75]) crypte.boite(13.4, K.bas, z - 0.33, 15.1, K.bas + 0.5, z + 0.33, '#9aa2bd', 0, 'y-');
    // au sol de l'église, le contour de ce qui est dessous
    for (const [xa, za, xb, zb] of [[K.ex, -K.ez, K.x0, -K.ez + 0.05], [K.ex, K.ez - 0.05, K.x0, K.ez], [K.ex, -K.ez, K.ex + 0.05, K.ez]]) {
      traces.boite(xa, 0.005, za, xb, 0.02, zb, ombre, 0, 'y-');
    }

    // l'emplacement de la dalle des Chevaliers, une fois la dalle partie au jardin puis au musée
    const D = { x0: 13.5, x1: 14.22, z: 0.65 };     // 0,72 m sur 1,30 m, devant l'autel
    if (autel1887) {
      for (const [xa, za, xb, zb] of [[D.x0, -D.z, D.x1, -D.z + 0.05], [D.x0, D.z - 0.05, D.x1, D.z], [D.x0, -D.z, D.x0 + 0.05, D.z], [D.x1 - 0.05, -D.z, D.x1, D.z]]) {
        traces.boite(xa, 0.155, za, xb, 0.175, zb, T.or, 0, 'y-');
      }
    }

    // les murs de la nef : des arcades entre piliers, une baie au fond de chacune
    const baieDedans = (u, bas, haut, l, aveugle, vitrail) => ({
      u, l: l || 0.8, bas, haut, cintre: true, prof: 0.55,
      fond: aveugle ? '#2b2c34' : verre, fondMatiere: aveugle ? 0 : (autel1887 ? 12 : matVerre),
      image: aveugle || !autel1887 ? null : cas(vitrail || 'vitrail'),
      joue: decor1897 ? T.bande : T.chaux, joueMatiere: decor1897 ? 9 : 0,
    });
    for (let i = 0; i < 4; i += 1) {
      const x0 = C.trav[i], x1 = C.trav[i + 1], l = x1 - x0;
      const arcade = [{ u: l / 2, l: l - 0.95, bas: 0, haut: 4.35, cintre: true, prof: C.zf - C.zp, joue: mur, joueMatiere: matMur }];
      // le sud (on le voit en regardant vers le sud : la paroi regarde le nord)
      int.paroi([x1, C.zp], [x0, C.zp], 0, C.imposte, mur, matMur, arcade);
      const sud = i === 0 ? [{ u: l / 2, l: 1.5, bas: 0, haut: 2.9, cintre: true, prof: 0.55, joue: T.pierre, joueMatiere: 0 }]
        : [i === 3 ? baieDedans(l / 2, 3.05, 4.3, 0.6, false, 'vitrail-histoire') : baieDedans(l / 2, 2.75, 4.3)];
      int.paroi([x1, C.zf], [x0, C.zf], 0, C.imposte, mur, matMur, sud);
      // le nord
      int.paroi([x0, -C.zp], [x1, -C.zp], 0, C.imposte, mur, matMur, arcade);
      const nord = i === 1 ? [baieDedans(l / 2, 2.75, 4.3)] : (i === 2 ? [baieDedans(l / 2, 2.75, 4.3, 0.8, true)] : []);
      int.paroi([x0, -C.zf], [x1, -C.zf], 0, C.imposte, i === 0 && decor1897 ? '#9fc0c9' : mur, i === 0 && decor1897 ? 0 : matMur, nord);
      // le lambris
      for (const s of [-1, 1]) {
        const a = s * (C.zf - 0.03), b = s * C.zf;
        if (!(i === 0 && s === 1)) int.boite(x0 + 0.48, 0, Math.min(a, b), x1 - 0.48, C.lambris, Math.max(a, b), T.bois, 6, 'y-');
      }
    }
    // les piliers : lambris en bas, bandes peintes au-dessus, un chapiteau
    for (let i = 0; i <= 4; i += 1) {
      const x = C.trav[i];
      const g = i === 0 ? x : x - 0.475, d = i === 4 ? x : x + 0.475;
      for (const s of [-1, 1]) {
        const z0 = s === 1 ? C.zp - 0.05 : -C.zp, z1 = s === 1 ? C.zp : -C.zp + 0.05;
        int.boite(g, 0, z0, d, C.lambris, z1, T.bois, 6, 'y-');
        if (decor1897) int.boite(g + 0.08, C.lambris, z0 + (s === 1 ? 0.02 : 0), d - 0.08, C.imposte - 0.2, z1 - (s === 1 ? 0 : 0.02), T.bande, 9, 'y- y+');
        int.boite(g - 0.05, C.imposte - 0.22, s === 1 ? C.zp - 0.12 : -C.zp, d + 0.05, C.imposte, s === 1 ? C.zp : -C.zp + 0.12, decor1897 ? '#c98f7c' : T.pierre, 0);
      }
    }
    // la frise, à la naissance de la voûte
    if (decor1897) {
      // un bandeau rouge et or, des créneaux peints dessus
      for (const s of [-1, 1]) {
        const z0 = s === 1 ? C.zp - 0.06 : -C.zp, z1 = s === 1 ? C.zp : -C.zp + 0.06;
        int.boite(0, C.imposte - 0.1, z0, C.arc[0], C.imposte + 0.04, z1, '#b9624a', 0);
        int.boite(0, C.imposte - 0.03, s === 1 ? z0 - 0.005 : z0, C.arc[0], C.imposte, s === 1 ? z1 : z1 + 0.005, T.or, 0);
        for (let x = 0.12; x < C.arc[0] - 0.2; x += 0.34) int.boite(x, C.imposte + 0.04, z0, x + 0.17, C.imposte + 0.15, z1, T.creme, 0, 'y-');
      }
    }
    // la voûte en anse de panier et ses doubleaux
    int.berceau(0, C.arc[0], C.imposte, 0, C.zp, C.fleche, decor1897 ? T.voute : T.voutePale, 0, true, 18);
    for (const x of [C.trav[1], C.trav[2], C.trav[3]]) {
      int.doubleau(x - 0.475, x + 0.475, C.imposte, 0, C.zp, C.fleche, 0.22, decor1897 ? T.bande : T.chaux, decor1897 ? 9 : 0, 18);
    }

    // le mur du fond (ouest) : la grande arcade du Sermon sur la montagne
    int.paroi([0, C.zp], [0, -C.zp], 0, C.faite, mur, matMur, decor1897
      ? [{ u: C.zp, l: 4.7, bas: 3.5, haut: 6.15, cintre: true, prof: 0.3, fond: '#9db6bd', fondMatiere: 11, image: cas('sermon'), joue: T.bande, joueMatiere: 9 }] : [], (u) => voute(u - C.zp));
    int.boite(0, 0, -C.zp, 0.04, C.lambris, C.zp, T.bois, 6, 'y- x-');

    // l'arc qui ouvre sur le chœur
    int.paroi([C.arc[0], -C.zp], [C.arc[0], C.zp], 0, C.faite, mur, matMur,
      [{ u: C.zp, l: 2 * C.ra, bas: 0, haut: 6.4, cintre: true, prof: C.arc[1] - C.arc[0], joue: decor1897 ? T.bande : T.chaux, joueMatiere: decor1897 ? 9 : 0 }],
      (u) => voute(u - C.zp));
    int.paroi([C.arc[1], C.ra], [C.arc[1], -C.ra], 0.15, C.faite, mur, matMur,
      [{ u: C.ra, l: 2 * C.ra, bas: 0.15, haut: 6.4, cintre: true, prof: 0 }],
      (u) => C.murAbside + C.calotte * Math.sqrt(Math.max(0, 1 - Math.pow((u - C.ra) / C.ra, 2))));
    // la travée de chœur
    const murChoeur = decor1897 ? T.rose : T.chaux;
    int.paroi([C.arc[1], -C.ra], [C.xa, -C.ra], 0.15, C.murAbside, murChoeur, 0);
    int.paroi([C.xa, C.ra], [C.arc[1], C.ra], 0.15, C.murAbside, murChoeur, 0);
    int.berceau(C.arc[1], C.xa, C.murAbside, 0, C.ra, C.calotte, decor1897 ? T.bleu : T.voutePale, decor1897 ? 5 : 0, true, 14);
    // l'abside : lambris, tenture peinte, ciel bleu semé d'étoiles
    int.tour(C.xa, 0, [[C.ra, 0.15], [C.ra, 1.5], [C.ra, 3.3], [C.ra, 3.45], [C.ra, C.murAbside]],
      decor1897 ? [T.bois, T.rose, T.or, T.bleu] : [T.chaux, T.chaux, T.chaux, T.chaux], 0, { dedans: true, a0: -90, a1: 90, segments: 16 });
    const calotte = [];
    for (let k = 0; k <= 6; k += 1) {
      const a = (Math.PI / 2) * k / 6;
      calotte.push([C.ra * Math.cos(a), C.murAbside + C.calotte * Math.sin(a)]);
    }
    int.tour(C.xa, 0, calotte, decor1897 ? T.bleu : T.voutePale, decor1897 ? 5 : 0, { dedans: true, a0: -90, a1: 90, segments: 16 });
    if (decor1897) int.tour(C.xa, 0, [[C.ra - 0.01, 3.45], [C.ra - 0.01, C.murAbside]], T.bleu, 5, { dedans: true, a0: -90, a1: 90, segments: 16 });
    if (autel1887) {
      // la rose de l'axe (Marie-Madeleine aux pieds du Christ) et les deux baies de 1889
      int.medaillon([C.xa + C.ra - 0.04, 4.2, 0], 0.78, [-1, 0], T.or, 0);
      // la rose : Marie-Madeleine aux pieds du Christ, chez Simon — le vitrail lui-même
      const ro = cas('rose'), xr = C.xa + C.ra - 0.09, rr = 0.68;
      const ru = (a) => [(ro[0] + ro[2]) / 2 + (ro[2] - ro[0]) / 2 * Math.cos(a), (ro[1] + ro[3]) / 2 - (ro[3] - ro[1]) / 2 * Math.sin(a)];
      for (let k = 0; k < 24; k += 1) {
        const a0 = k * Math.PI / 12, a1 = (k + 1) * Math.PI / 12;
        // vue depuis la nef : le sud est à droite
        int.tri([xr, 4.2, 0], [xr, 4.2 + rr * Math.sin(a0), rr * Math.cos(a0)], [xr, 4.2 + rr * Math.sin(a1), rr * Math.cos(a1)], [ro[4], ro[5], ro[6]], 12,
          [[(ro[0] + ro[2]) / 2, (ro[1] + ro[3]) / 2], ru(a0), ru(a1)]);
      }
      if (an >= 1889) {
        for (const s of [-1, 1]) {
          int.placer(C.xa + (C.ra - 0.05) * Math.cos(0.6), 3.6, s * (C.ra - 0.05) * Math.sin(0.6), s * 34.4 + 90, 1, () => {
            int.boite(-0.22, 0, 0, 0.22, 1.0, 0.03, verre, 7, 'z-');
          });
        }
      }
    } else {
      int.medaillon([C.xa + C.ra - 0.05, 3.7, 0], 0.3, [-1, 0], '#cfd8da', 7);
    }

    /* ═════════ Le mobilier ═════════ */

    const auMur = (x, y, z, angle, f) => mob.placer(x, y, z, angle, 1, f);
    const NORD = 0, SUD = 180, OUEST = -90, EST = 90;   // de quel mur l'objet se détache… et vers où il regarde
    const yStation = 2.4, yStatue = 2.55;
    const scenes = ['#7a8fb0', '#a86a55', '#8a9a6a', '#b08a5a', '#6a7fa0', '#9a6a7a', '#7f9a8a', '#a8905a', '#7a6a9a', '#a87a5a', '#6a8a9a', '#8a7a5a', '#9a8a7a', '#6a6a8a'];

    // les bancs
    for (let k = 0; k < 9; k += 1) {
      const x = 3.2 + k * 0.88;
      for (const s of [-1, 1]) {
        const z0 = s === 1 ? 0.65 : -2.55, z1 = s === 1 ? 2.55 : -0.65;
        sol.boite(x, 0.4, z0, x + 0.42, 0.46, z1, T.boisClair, 6);
        sol.boite(x + 0.42, 0, z0, x + 0.47, 0.95, z1, T.boisClair, 6, 'y-');
        sol.boite(x, 0, z0, x + 0.42, 0.4, z0 + 0.04, T.boisClair, 6, 'y-');
        sol.boite(x, 0, z1 - 0.04, x + 0.42, 0.4, z1, T.boisClair, 6, 'y-');
      }
    }

    if (decor1897) {
      // les statues des murs, chacune sur sa console, entre deux stations
      const saints = [
        [centres[1], -1, 'germaine', 1.3],
        [centres[2], -1, 'antoine-ermite', 1.42],
        [centres[1], 1, 'roch', 1.36],
        [centres[2], 1, 'madeleine', 1.38],
      ];
      for (const [x, s, nom, h] of saints) {
        auMur(x, yStatue, s * (C.zf - 0.3), s === 1 ? SUD : NORD, () => { console3(mob); figure(mob, nom, h, { prof: 0.55, epais: 0.13 }); });
      }
      // le chemin de croix : il part de la chaire et tourne à l'envers des aiguilles
      const stations = [
        [10.2, -C.zf, NORD], [centres[2] + 0.92, -C.zf, NORD], [centres[2] - 0.92, -C.zf, NORD],
        [centres[1] + 0.92, -C.zf, NORD], [centres[1] - 0.92, -C.zf, NORD],
        [0.04, -2.0, OUEST], [0.04, -1.2, OUEST], [0.04, 1.2, OUEST], [0.04, 2.0, OUEST],
        [centres[1] - 0.92, C.zf, SUD], [centres[1] + 0.92, C.zf, SUD],
        [centres[2] - 0.92, C.zf, SUD], [centres[2] + 0.92, C.zf, SUD], [10.0, C.zf, SUD],
      ];
      stations.forEach(([x, z, face], i) => auMur(x, yStation - 0.62, z, face, () => station(mob, cas('station-' + (i + 1)))));

      // saint Antoine de Padoue, sur son socle que portent quatre anges, face à la chaire
      auMur(11.55, 0, 2.2, SUD, () => {
        mob.tour(0, 0, [[0.4, 0], [0.4, 0.12], [0.3, 0.2], [0.3, 0.34], [0.2, 0.42]], [T.pierre, T.creme, '#d9a87a', T.or], 0, { segments: 6 });
        mob.tour(0, 0, [[0.13, 0.42], [0.13, 1.08]], '#e6c9a0', 0, { segments: 6 });
        for (const a of [30, 150, 270]) {
          const ra = a * Math.PI / 180;
          mob.tour(0.2 * Math.cos(ra), 0.2 * Math.sin(ra), [[0.05, 0.42], [0.04, 0.5], [0.04, 1.0], [0.06, 1.08]], [T.or, '#e6dcc4', T.or], 0, { segments: 5 });
        }
        mob.tour(0, 0, [[0.2, 1.08], [0.3, 1.16], [0.32, 1.3], [0.22, 1.36]], [T.or, '#d9a87a', T.creme], 0, { segments: 6 });
        // les anges, bras levés, qui portent le plateau
        mob.placer(0, 1.34, 0, 0, 1, () => figure(mob, 'anges-padoue', 0.86, { prof: 0.9, epais: 0.27 }));
        mob.tour(0, 0, [[0.3, 2.16], [0.4, 2.22], [0.4, 2.3], [0.3, 2.36], [0.24, 2.4]], [T.or, '#3f5f8a', T.or, T.noir], 0, { segments: 10 });
        mob.disque(0, 2.4, 0, 0.24, T.noir, 0, { segments: 10 });
        mob.placer(0, 2.4, 0, 0, 1, () => figure(mob, 'antoine-padoue', 1.34, { prof: 0.55, epais: 0.13 }));
      });

      // le diable du bénitier, les quatre anges au-dessus : à gauche en entrant
      auMur(0.55, 0, 2.15, -135, () => {
        // le démon ployé sous la vasque
        mob.placer(0, 0, 0.02, 0, 1, () => figure(mob, 'diable', 1.16, { prof: 0.8, epais: 0.3 }));
        // la vasque : une coquille
        mob.tour(0, 0.06, [[0.12, 1.08], [0.4, 1.14], [0.46, 1.22], [0.44, 1.24], [0, 1.18]], ['#8d8f8a', '#b9bbb5', '#d6d4cc', '#9db6c9'], 0, { segments: 10, ez: 0.8 });
        // les deux basilics et le cartouche « BS »
        mob.boite(-0.42, 1.26, -0.3, 0.42, 1.46, 0.26, '#cfc6b0', 0);
        for (const sx of [-1, 1]) mob.tour(sx * 0.2, 0.28, [[0.03, 1.27], [0.1, 1.31], [0.1, 1.39], [0.03, 1.44]], ['#c9a03c', '#5d8a6a', '#c9a03c'], 0, { segments: 6, ex: 1.6 });
        mob.medaillon([0, 1.37, 0.33], 0.075, [0, 1], '#a8322a', 0, 10);
        // « Par ce signe tu le vaincras »
        mob.boite(-0.48, 1.46, -0.3, 0.48, 1.52, 0.3, T.or, 0);
        mob.boite(-0.44, 1.52, -0.28, 0.44, 1.66, 0.28, '#d6cfbd', 0);
        // les quatre anges qui font le signe de croix, et la croix qui les domine
        mob.placer(0, 1.66, 0.02, 0, 1, () => figure(mob, 'anges-benitier', 1.08, { prof: 0.8, epais: 0.26 }));
        mob.placer(0.04, 2.66, -0.12, 0, 1, () => figure(mob, 'croix-benitier', 0.56, { prof: 0.3, epais: 0.035 }));
      });

      // les fonts baptismaux : Jean baptise le Christ, face au diable
      auMur(1.35, 0, -2.35, NORD, () => {
        mob.boite(-0.62, 0, -0.5, 0.62, 0.78, 0.3, '#d9d2bf', 0, 'y-');
        mob.boite(-0.68, 0.78, -0.5, 0.68, 0.88, 0.36, T.creme, 0);
        mob.boite(-0.5, 0.88, -0.45, 0.5, 0.98, 0.22, '#cfc9b8', 0);
        mob.boite(-0.17, 0.12, 0.3, 0.17, 0.66, 0.31, '#3a3226', 0, 'z-');          // la porte de la cuve
        for (const sx of [-1, 1]) mob.boite(sx * 0.4 - 0.08, 0.3, 0.3, sx * 0.4 + 0.08, 0.5, 0.31, T.or, 0, 'z-');   // l'alpha et l'oméga
        mob.placer(0, 0.98, -0.12, 0, 1, () => figure(mob, 'bapteme', 1.5, { prof: 0.7, epais: 0.3 }));
        for (const x of [-1.1, -0.55, 0, 0.55, 1.1]) mob.boite(x - 0.02, 0, 1.0, x + 0.02, 1.0, 1.04, '#5f9aa0', 0);
        mob.boite(-1.12, 0.96, 1.0, 1.12, 1.02, 1.04, '#5f9aa0', 0);
      });

      // le confessionnal, au milieu du mur du fond ; au-dessus, le Sermon sur la montagne
      auMur(0.04, 0, 0, OUEST, () => {
        // le corps du milieu, sa porte à deux jours ovales, et les deux loges plus basses
        mob.boite(-0.55, 0, 0, 0.55, 2.45, 0.9, T.bois, 6, 'y- z-');
        mob.boite(-0.4, 0.12, 0.9, 0.4, 2.2, 0.93, '#4f3219', 6, 'z-');
        for (const sx of [-1, 1]) {
          mob.medaillon([sx * 0.18, 1.6, 0.94], 0.11, [0, 1], '#cfc6b0', 0, 10);
          mob.boite(sx * 0.55, 0, 0, sx * 1.15, 2.0, 0.75, T.bois, 6, 'y- z-');
          mob.boite(sx * 0.62 + (sx === 1 ? 0 : -0.46), 0.1, 0.75, sx * 0.62 + (sx === 1 ? 0.46 : 0), 1.8, 0.76, '#2f1f12', 0, 'z-');
          for (let k = 0; k < 3; k += 1) {
            const x0 = sx === 1 ? 0.58 + k * 0.2 : -1.12 + k * 0.2;
            mob.boite(x0, 2.0, 0.6, x0 + 0.12, 2.12, 0.75, T.bois, 6, 'y-');
          }
        }
        // le gâble et ses fleurons
        mob.tri([-0.72, 2.45, 0.92], [0.72, 2.45, 0.92], [0, 3.2, 0.92], T.bois, 6);
        mob.tri([0.72, 2.45, 0.0], [-0.72, 2.45, 0.0], [0, 3.2, 0.0], T.bois, 6);
        mob.quad([-0.72, 2.45, 0.92], [0, 3.2, 0.92], [0, 3.2, 0], [-0.72, 2.45, 0], T.bois, 6, true);
        mob.quad([0, 3.2, 0.92], [0.72, 2.45, 0.92], [0.72, 2.45, 0], [0, 3.2, 0], T.bois, 6, true);
        mob.medaillon([0, 2.68, 0.93], 0.2, [0, 1], '#4f3219', 6, 12);
        for (const x of [-0.72, 0, 0.72]) {
          const y = x === 0 ? 3.2 : 2.45;
          mob.tour(x, 0.86, [[0.04, y], [0.03, y + 0.14], [0.07, y + 0.2], [0, y + 0.3]], T.bois, 0, { segments: 5 });
        }
        // le relief du Sermon : le tertre et ses figures sortent du mur
        const se = cas('sermon');
        const creux = -0.34 + 0.012;                                   // le fond de l'arcade, vu d'ici
        const bosse = (u, v) => {
          const f = (t) => (Math.abs(t) >= 1 ? 0 : (1 - t * t) * (1 - t * t));
          return creux + 0.4 * f((u - 0.51) / 0.33) * f((v - 0.48) / 0.48);
        };
        const pt = (u, v) => [(u - 0.5) * 4.7, 3.5 + (1 - v) * 2.65, bosse(u, v)];
        const im = (u, v) => [se[0] + (se[2] - se[0]) * u, se[1] + (se[3] - se[1]) * v];
        const NU = 12, NV = 9;
        for (let i = 0; i < NU; i += 1) {
          for (let j = 0; j < NV; j += 1) {
            const u0 = 0.18 + 0.66 * i / NU, u1 = 0.18 + 0.66 * (i + 1) / NU, v0 = 0.96 * j / NV, v1 = 0.96 * (j + 1) / NV;
            mob.quad(pt(u0, v1), pt(u1, v1), pt(u1, v0), pt(u0, v0), [se[4], se[5], se[6]], 11, false, [im(u0, v1), im(u1, v1), im(u1, v0), im(u0, v0)]);
          }
        }
      });
    }

    // la chaire : la neuve en 1891, l'ancienne (et son balustre) avant
    auMur(11.45, 0, -2.0, NORD, () => {
      if (dallage1891) {
        // le pied, la cuve à six pans et ses figures sur fond d'or, le dorsal, l'abat-voix
        mob.tour(0, 0, [[0.36, 0], [0.32, 0.2], [0.2, 0.35], [0.17, 0.75], [0.24, 0.82], [0.22, 1.3], [0.78, 1.75], [0.82, 1.85]],
          [T.creme, T.or, '#c98f7c', T.or, '#d9a87a', T.or, '#7a3b3b'], 0, { segments: 6 });
        mob.tour(0, 0, [[0.82, 1.85], [0.8, 1.93], [0.8, 2.72], [0.85, 2.8], [0.72, 2.8]], [T.or, '#b9cdd0', T.or, '#7a3b3b'], 0, { segments: 6 });
        mob.disque(0, 1.86, 0, 0.78, T.bois, 6, { segments: 6 });
        for (const a of [-120, -60, 0, 60, 120]) {
          mob.placer(0, 0, 0, a, 1, () => {
            mob.boite(-0.24, 2.0, 0.693, 0.24, 2.5, 0.705, T.or, 0, 'z-');
            mob.medaillon([0, 2.5, 0.705], 0.24, [0, 1], T.or, 0, 10);
            mob.tour(0, 0.71, [[0.1, 2.02], [0.07, 2.3], [0.08, 2.42], [0.05, 2.52], [0, 2.6]], ['#8a4a3a', '#3f5f8a', T.peau, '#5a3b24'], 0, { segments: 5, a0: 0, a1: 180, ez: 0.5 });
          });
        }
        mob.boite(-0.5, 2.8, -0.68, 0.5, 4.2, -0.6, '#7a8fb0', 0);
        mob.boite(-0.24, 3.0, -0.6, 0.24, 3.95, -0.59, T.or, 0, 'z-');
        mob.tour(0, -0.1, [[0, 4.2], [0.85, 4.2], [0.88, 4.42], [0.5, 4.7], [0.25, 5.3], [0.03, 5.75]], [T.bois, T.or, '#c98f7c', T.or, T.or], 0, { segments: 6 });
        for (let k = 0; k < 6; k += 1) {
          const a = k * Math.PI / 3;
          mob.tour(0.82 * Math.cos(a), -0.1 + 0.82 * Math.sin(a), [[0.05, 4.05], [0.06, 4.45], [0, 4.75]], T.or, 0, { segments: 4 });
        }
        mob.placer(0, 5.75, -0.1, 0, 1, () => statue(mob, 0.5, T.or, T.or, T.or));
      } else {
        mob.tour(0, 0, [[0.16, 0], [0.1, 0.25], [0.14, 0.7], [0.09, 1.05], [0.6, 1.5], [0.6, 2.5]], [T.bois, T.bois, T.bois, T.boisClair, T.boisClair], 6, { segments: 6 });
        mob.disque(0, 1.51, 0, 0.58, T.bois, 6, { segments: 6 });
      }
    });

    // la clôture du chœur : le « balustre » des registres, puis la grille
    for (const s of [-1, 1]) {
      const z0 = s === 1 ? 0.6 : -C.zp, z1 = s === 1 ? C.zp : -0.6;
      mob.boite(12.05, 0.82, z0, 12.12, 0.9, z1, dallage1891 ? T.fer : T.bois, 0);
      for (let z = z0 + 0.1; z < z1; z += 0.2) mob.boite(12.07, 0, z - 0.015, 12.1, 0.82, z + 0.015, dallage1891 ? T.fer : T.bois, 0);
    }

    // l'autel
    if (autel1887) {
      auMur(C.xa + 1.55, 0.15, 0, EST, () => {
        mob.boite(-1.5, 0, -0.5, 1.5, 0.16, 0.9, T.pierre, 0, 'y-');
        // le tombeau : la Madeleine en prière dans sa grotte, entre deux arcades d'or
        mob.boite(-1.15, 0.16, -0.35, 1.15, 1.37, 0.45, '#d6d2c6', 0, 'y- z+');
        mob.tableau([-1.15, 0.16, 0.45], [1.15, 0.16, 0.45], [1.15, 1.37, 0.45], [-1.15, 1.37, 0.45], cas('autel-bas'));
        // le retable : ses gradins peints, le tabernacle au milieu
        mob.boite(-1.1, 1.37, -0.4, 1.1, 2.24, -0.02, '#cfc6b0', 0, 'y- z+');
        mob.tableau([-1.1, 1.37, -0.02], [1.1, 1.37, -0.02], [1.1, 2.24, -0.02], [-1.1, 2.24, -0.02], cas('autel-retable'));
        // le gâble du tabernacle, sa flèche, la croix
        mob.boite(-0.27, 2.24, -0.36, 0.27, 2.36, -0.04, T.creme, 0, 'y-');
        mob.tri([-0.33, 2.36, -0.04], [0.33, 2.36, -0.04], [0, 2.72, -0.04], T.or, 0);
        mob.tri([0.33, 2.36, -0.36], [-0.33, 2.36, -0.36], [0, 2.72, -0.36], T.or, 0);
        mob.quad([-0.33, 2.36, -0.04], [0, 2.72, -0.04], [0, 2.72, -0.36], [-0.33, 2.36, -0.36], '#b9914a', 0, true);
        mob.quad([0, 2.72, -0.04], [0.33, 2.36, -0.04], [0.33, 2.36, -0.36], [0, 2.72, -0.36], '#b9914a', 0, true);
        mob.tour(0, -0.2, [[0.1, 2.6], [0.11, 2.86], [0.14, 2.9], [0.05, 3.2], [0, 3.34]], [T.creme, T.or, '#b9914a', T.or], 0, { segments: 6 });
        mob.placer(0, 3.3, -0.2, 0, 1, () => croix(mob, 0.4, 0.2, 0.04, T.or));
        // les six chandeliers
        for (const dx of [-0.98, -0.72, -0.46, 0.46, 0.72, 0.98]) {
          mob.tour(dx, -0.2, [[0.07, 2.24], [0.03, 2.32], [0.045, 2.4], [0.02, 2.46], [0.02, 2.74], [0.05, 2.76], [0.012, 2.78], [0.012, 3.0]],
            [T.or, T.or, T.or, T.or, T.or, T.or, T.creme], 0, { segments: 5 });
        }
      });
    } else {
      // l'ancien autel : une table sur deux piliers, dont le pilier sculpté
      auMur(C.xa + 1.6, 0.15, 0, EST, () => {
        mob.boite(-0.75, 0, -0.2, -0.35, 0.75, 0.2, '#cdbb97', 10, 'y-');
        mob.boite(0.35, 0, -0.2, 0.75, 0.75, 0.2, '#cdbb97', 0, 'y-');
        mob.boite(-0.95, 0.75, -0.4, 0.95, 0.9, 0.4, T.pierre, 0);
      });
      // la dalle des Chevaliers, face contre terre, devant l'autel
      sol.boite(D.x0, 0.15, -D.z, D.x1, 0.2, D.z, '#a89a82', 0, 'y-');
    }
    if (decor1897) {
      // saint Joseph au nord, la Vierge au sud : chacun porte un Enfant
      for (const s of [-1, 1]) {
        const a = s * 62 * Math.PI / 180;
        // tournés vers les fidèles plus que vers l'autel
        auMur(C.xa + (C.ra - 0.3) * Math.cos(a), 2.3, (C.ra - 0.3) * Math.sin(a), s * 22 + 90, () => {
          console3(mob, 1.62);
          figure(mob, s === 1 ? 'marie' : 'joseph', s === 1 ? 1.34 : 1.38, { prof: 0.55, epais: 0.13 });
        });
      }
    }
    // la porte de la sacristie
    mob.boite(10.75, 0, C.zf - 0.05, 11.55, 2.05, C.zf - 0.02, '#4f3219', 6);

    /* ═════════ Les repères ═════════ */

    const R = [];
    const repere = (de, a, r) => { if (an >= de && an < a) R.push(r); };
    const TOUJOURS = [-9999, 9999];

    repere(...TOUJOURS, { id: 'clocher', nom: 'Le clocher', p: [cmx, 11.0, cmz], ou: 'dehors', fiche: 'eglise-sainte-marie-madeleine',
      texte: 'Contre le mur nord, sur une souche romane. Sa hauteur n’est publiée nulle part : elle est ici estimée d’après les photographies.' });
    repere(...TOUJOURS, { id: 'abside', nom: 'L’abside', p: [C.xa + C.rx, 5.2, 0], ou: 'dehors', fiche: 'eglise-sainte-marie-madeleine',
      texte: 'Le chevet semi-circulaire, la partie la plus ancienne de l’église, sans doute du XIe siècle.' });
    repere(1897, 9999, { id: 'porche', nom: 'Le porche', p: [px, 3.6, pz + 0.3], ou: 'dehors', fiche: 'terribilis-est-locus-iste', vue: 'porche',
      texte: '« Terribilis est locus iste » : au tympan, Marie-Madeleine, les armes de Léon XIII, et le toit bordé de céramique jaune.' });
    repere(-9999, 1897, { id: 'porche', nom: 'L’entrée', p: [px, 3.2, pz], ou: 'dehors', fiche: 'eglise-sainte-marie-madeleine', vue: 'porche',
      texte: 'L’entrée, au sud, avant que Saunière n’y bâtisse son porche.' });
    repere(...TOUJOURS, { id: 'sacristie', nom: decor1897 ? 'La sacristie et la pièce secrète' : 'La sacristie', p: [13.4, 3.2, sz1 + 0.2], ou: 'dehors', fiche: 'piece-secrete',
      texte: decor1897 ? 'La sacristie, en appentis ; derrière elle, côté chevet, le réduit arrondi qu’on appelle « la pièce secrète ».' : 'La sacristie, en appentis contre le chœur.' });
    repere(...TOUJOURS, { id: 'presbytere', nom: 'Le presbytère', p: [-7, 6.6, 5.6], ou: 'dehors', fiche: 'presbytere',
      texte: 'La maison du curé, accolée à l’ouest : elle cache l’ancienne façade de l’église.' });
    repere(...TOUJOURS, { id: 'cimetiere', nom: 'Le cimetière', p: [24, 1.6, -8], ou: 'dehors', fiche: 'cimetiere',
      texte: 'Au nord et à l’est de l’église ; on y entre par le portail, entre le chevet et le reposoir.' });
    repere(1891, 9999, { id: 'vierge', nom: 'La Vierge sur le pilier', p: [-0.8, 2.6, an >= 1901 ? 11.6 : 10.2], ou: 'dehors', fiche: 'pilier-sculpte',
      texte: 'Le pilier carolingien de l’ancien autel, posé à l’envers en 1891 pour porter Notre-Dame de Lourdes. L’original est au musée ; c’est une copie qui est au jardin.' });
    repere(1897, 9999, { id: 'calvaire', nom: 'Le calvaire', p: [12.6, 5.6, 13.6], ou: 'dehors', fiche: 'jardin-du-calvaire',
      texte: 'Au milieu du jardin, sur son emmarchement : inauguré en 1897.' });

    repere(1897, 9999, { id: 'diable', nom: 'Le diable du bénitier', p: [0.75, 1.5, 1.9], ou: 'dedans', fiche: 'asmodee', vue: 'diable',
      texte: 'À gauche en entrant : le démon ployé sous la vasque, quatre anges au-dessus, « Par ce signe tu le vaincras ».' });
    repere(1897, 9999, { id: 'fonts', nom: 'Les fonts baptismaux', p: [1.35, 2.0, -2.1], ou: 'dedans', fiche: 'statues-de-l-eglise',
      texte: 'Saint Jean baptise le Christ, face au diable, de l’autre côté de la nef.' });
    repere(1897, 9999, { id: 'sermon', nom: 'Le Sermon sur la montagne', p: [0.5, 4.6, 0], ou: 'dedans', fiche: 'bas-relief-du-sermon', vue: 'fond',
      texte: '« Venez à moi… » : le grand relief peint du mur du fond, au-dessus du confessionnal.' });
    repere(1897, 9999, { id: 'stations', nom: 'Le chemin de croix', p: [centres[1] - 0.92, 3.1, -C.zf + 0.2], ou: 'dedans', fiche: 'chemin-de-croix',
      texte: 'Quatorze stations. Elles partent de la chaire, longent le mur nord vers le fond, et reviennent par le sud : à l’envers des aiguilles d’une montre. La première, près de la chaire, n’est sur aucune des photographies dont la maquette est tirée : son cadre y reste nu.' });
    repere(1897, 9999, { id: 'germaine', nom: 'Sainte Germaine', p: [centres[1], 4.1, -C.zf + 0.4], ou: 'dedans', fiche: 'statues-de-l-eglise',
      texte: 'Sainte Germaine de Pibrac, les roses dans son tablier et l’agneau contre elle, face à saint Roch.' });
    repere(1897, 9999, { id: 'antoine-ermite', nom: 'Saint Antoine ermite', p: [centres[2], 4.1, -C.zf + 0.4], ou: 'dedans', fiche: 'statues-de-l-eglise',
      texte: 'Fêté le 17 janvier. Sa fenêtre est aveugle : le clocher est derrière.' });
    repere(1897, 9999, { id: 'roch', nom: 'Saint Roch', p: [centres[1], 4.1, C.zf - 0.4], ou: 'dedans', fiche: 'statues-de-l-eglise',
      texte: 'Saint Roch, son chien à ses pieds, entre les stations X et XI.' });
    repere(1897, 9999, { id: 'madeleine', nom: 'Sainte Marie-Madeleine', p: [centres[2], 4.1, C.zf - 0.4], ou: 'dedans', fiche: 'statues-de-l-eglise',
      texte: 'La patronne de l’église, la croix dans les bras, un crâne à ses pieds.' });
    repere(1897, 9999, { id: 'antoine-padoue', nom: 'Saint Antoine de Padoue', p: [11.55, 3.7, 2.2], ou: 'dedans', fiche: 'statues-de-l-eglise',
      texte: 'Sur un socle que portent quatre anges, face à la chaire.' });
    repere(1891, 9999, { id: 'chaire', nom: 'La chaire', p: [11.45, 3.0, -1.9], ou: 'dedans', fiche: 'eglise-sainte-marie-madeleine',
      texte: 'Au nord, à l’entrée du chœur. C’est de là que partent les fouilles de 1959.' });
    repere(-9999, 1891, { id: 'chaire', nom: 'L’ancienne chaire', p: [11.45, 2.6, -1.9], ou: 'dedans', fiche: 'balustre-et-fiole',
      texte: 'La chaire de bois que Saunière remplace : son balustre est aujourd’hui au musée.' });
    repere(1891, 9999, { id: 'damier', nom: 'Le dallage en damier', p: [7.0, 0.1, 0], ou: 'dedans', fiche: 'dallage-en-damier',
      texte: 'Noir et blanc, posé à partir de 1891. La légende y compte soixante-quatre cases.' });
    repere(...TOUJOURS, { id: 'crypte', nom: 'Le tombeau des seigneurs', p: [12.9, 0.3, 0], ou: 'dedans', fiche: 'crypte-des-seigneurs', vue: 'soussol',
      texte: '« Auprès du balustre », disent les registres de 1694 à 1726 ; en 2001, un géoradar relève une anomalie sous le chœur, à plus de trois mètres. Personne n’a vu le caveau depuis Saunière : la salle et la descente que montre la maquette, en bleu, sont une restitution, non un relevé.' });
    repere(...TOUJOURS, { id: 'caveau', nom: 'Le caveau (restitution)', p: [14.0, -2.4, 0], ou: 'dedans', si: 'creuse', fiche: 'crypte-des-seigneurs',
      texte: 'Une salle voûtée sous l’entrée du chœur : c’est une hypothèse. Sa place suit les registres et le géoradar ; sa forme, sa taille et ses cercueils sont là pour donner l’échelle.' });
    repere(...TOUJOURS, { id: 'descente', nom: 'La descente (restitution)', p: [10.6, -0.9, 0], ou: 'dedans', si: 'creuse', fiche: 'crypte-des-seigneurs',
      texte: 'L’accès n’est pas connu. On le place ici dans la nef, au pied du balustre, là où Saunière fait lever le dallage en septembre 1891 ; d’autres le cherchent derrière le chevet ou sous la sacristie.' });
    repere(1887, 9999, { id: 'dalle', nom: 'L’emplacement de la dalle des Chevaliers', p: [(D.x0 + D.x1) / 2, 0.35, 0], ou: 'dedans', aussiCreuse: true, fiche: 'dalle-des-chevaliers', vue: 'dalle',
      texte: 'C’est ici, devant l’autel, que Saunière la trouve, face sculptée contre terre — en 1887 ou en 1891, selon les sources. Elle mesure 1,30 m sur 0,72. Remployée comme marche du calvaire, elle est aujourd’hui au musée du presbytère.' });
    repere(1887, 9999, { id: 'autel', nom: 'L’autel de Marie-Madeleine', p: [C.xa + 0.9, 1.3, 0], ou: 'dedans', fiche: 'autel-de-marie-madeleine', vue: 'choeur',
      texte: 'Posé le 27 juillet 1887. Sur le devant, la Madeleine en prière dans sa grotte.' });
    repere(-9999, 1887, { id: 'autel', nom: 'L’ancien autel', p: [C.xa + 1.3, 1.3, 0], ou: 'dedans', fiche: 'pilier-sculpte', vue: 'choeur',
      texte: 'Une table sur deux piliers, dont le pilier sculpté ; devant, la dalle des Chevaliers, face contre terre.' });
    repere(-9999, 1887, { id: 'dalle', nom: 'La dalle des Chevaliers', p: [(D.x0 + D.x1) / 2, 0.4, 0], ou: 'dedans', fiche: 'dalle-des-chevaliers', vue: 'dalle',
      texte: 'Face sculptée contre le sol, devant l’autel : 1,30 m sur 0,72. Saunière la retourne pendant les travaux.' });
    repere(1897, 9999, { id: 'enfants', nom: 'Saint Joseph et la Vierge', p: [C.xa + 1.2, 4.1, -1.9], ou: 'dedans', fiche: 'statues-de-l-eglise',
      texte: 'De part et d’autre de l’autel, chacun avec un Enfant : les « deux enfants Jésus » de la légende.' });
    repere(1887, 9999, { id: 'rose', nom: 'La rose du chœur', p: [C.xa + C.ra - 0.2, 4.2, 0], ou: 'dedans', fiche: 'eglise-sainte-marie-madeleine',
      texte: 'Marie-Madeleine aux pieds du Christ : un vitrail de l’atelier Feur, de Bordeaux.' });
    repere(1887, 9999, { id: 'pommes', nom: 'Les vitraux du sud', p: [centres[2], 3.6, C.zf + 0.3], ou: 'dedans', fiche: 'pommes-bleues',
      texte: 'Autour du 17 janvier, le soleil bas y passe et pose des taches de couleur sur le mur d’en face : les « pommes bleues ».' });

    /* ═════════ Les points de vue ═════════ */

    const vues = {
      ensemble: { nom: 'Ensemble', mode: 'dehors', cible: [7, 3.5, 2], lacet: -125, tangage: 24, dist: 44 },
      sud: { nom: 'Le côté sud', mode: 'dehors', cible: [7, 3.5, 2], lacet: -90, tangage: 12, dist: 34 },
      porche: { nom: 'Le porche', mode: 'dehors', cible: [px, 2.6, pz], lacet: -110, tangage: 6, dist: 11 },
      parvis: { nom: 'À pied', mode: 'dehors', cible: [px + 0.4, 1.6, pz + 7], lacet: -92, tangage: -6, dist: 0.02, ouverture: 62 },
      chevet: { nom: 'Le chevet', mode: 'dehors', cible: [14, 3.5, 0], lacet: 205, tangage: 16, dist: 30 },
      nord: { nom: 'Le clocher', mode: 'dehors', cible: [8, 5, -4], lacet: 115, tangage: 18, dist: 34 },
      coupe: { nom: 'En coupe', mode: 'dedans', cible: [8.5, 2.2, 0], lacet: -62, tangage: 38, dist: 27 },
      plan: { nom: 'En plan', mode: 'dedans', cible: [8.6, 0, 0], lacet: -90, tangage: 88, dist: 30 },
      soussol: { nom: 'Le sous-sol', mode: 'dedans', creuse: true, cible: [12.4, -1.2, 0], lacet: -80, tangage: 74, dist: 14 },
      dalle: { mode: 'dedans', cible: [13.86, 0.3, 0], lacet: 12, tangage: 42, dist: 5.5 },
      entree: { nom: 'Depuis la porte', mode: 'dedans', cible: [centres[0], 1.6, 2.7], lacet: -52, tangage: -4, dist: 0.02, ouverture: 68 },
      diable: { nom: 'Le bénitier', mode: 'dedans', cible: [3.6, 1.7, -0.6], lacet: 138, tangage: -3, dist: 0.02, ouverture: 58 },
      nef: { nom: 'La nef', mode: 'dedans', cible: [1.4, 1.6, 0], lacet: 0, tangage: -6, dist: 0.02, ouverture: 68 },
      choeur: { nom: 'Le chœur', mode: 'dedans', cible: [10.6, 1.6, 0], lacet: 0, tangage: -8, dist: 0.02, ouverture: 62 },
      fond: { nom: 'Le fond', mode: 'dedans', cible: [8.2, 1.6, 0], lacet: 180, tangage: -10, dist: 0.02, ouverture: 68 },
    };

    return {
      annee: an,
      image: DEC.image,
      groupes: { abords, ext, int, sol, mobilier: mob, traces, crypte },
      reperes: R,
      vues,
      bornes: [-26, -3, -22, 42, 16, 28],
      /* Où l'on peut poser le pied, dedans : la nef entre ses piliers, le chœur,
       * l'abside. On rend le point le plus proche de (x, z) qui soit permis — on
       * glisse donc le long des murs. Les bancs, eux, ne retiennent personne. */
      marche(x, z) {
        const nx = Math.max(0.35, Math.min(C.xa + 0.45, x));      // on s'arrête au pied de l'autel
        const limite = nx <= C.arc[0] ? C.zp - 0.3 : (nx <= C.xa ? C.ra - 0.3 : Math.sqrt(Math.max(0, 2.2 * 2.2 - (nx - C.xa) * (nx - C.xa))));
        return [nx, Math.max(-limite, Math.min(limite, z))];
      },
      cotes: C,
    };
  }

  /* Les états qu'on peut montrer, et ce qui les distingue. */
  const EPOQUES = [
    { annee: 1885, nom: 'En 1885' },
    { annee: 1892, nom: 'En 1892' },
    { annee: 2026, nom: 'Aujourd’hui' },
  ];

  racine.Eglise = { construire, EPOQUES, COTES: C };

})(typeof window !== 'undefined' ? window : globalThis);
