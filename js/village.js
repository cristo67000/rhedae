'use strict';
/*
 * Le village de Rennes-le-Château, en volume, d'une époque à l'autre.
 *
 * `Village.construire(annee)` rend la butte, les maisons, les rues, le château,
 * l'église (celle de js/eglise.js, dans son état de la même année) et, quand
 * ils sont bâtis, la villa Béthanie (1905), la tour Magdala, le belvédère et
 * l'orangerie (1906).
 *
 * Ce que la maquette sait, et ce qu'elle ne sait pas :
 * — les emprises viennent du cadastre d'aujourd'hui (OpenStreetMap), le relief
 *   des « Terrain Tiles » (un point tous les trente mètres : la butte et ses
 *   pentes, pas ses rochers) — voir build/village.py ;
 * — les HAUTEURS des maisons ne sont publiées nulle part : elles sont données
 *   au jugé, deux ou trois niveaux, et varient d'une maison à l'autre pour que
 *   le village ne soit pas une caserne ;
 * — les MAISONS d'autrefois ne sont pas documentées une à une. On montre donc
 *   à toutes les époques celles du cadastre actuel, sauf ce qui est daté : le
 *   domaine de l'abbé (1901-1906), et le réservoir, qu'on ne montre
 *   qu'aujourd'hui faute de connaître sa date. Le village de 1781 comptait
 *   sans doute moins de maisons, ou d'autres : la maquette ne le dit pas ;
 * — le château et la tour Magdala sont dessinés d'après les photographies
 *   d'août 2024 (Cristo6772), sans relevé.
 *
 * Le repère : x vers l'est, y vers le haut, z vers le sud, en mètres ; l'origine
 * est à l'église, y = 0 à son sol. Ce fichier est le même dans Rhedae et dans
 * Terribilis.
 */
(function (racine) {

  /* Où poser la maquette de l'église dans le village : son origine (le pied du
   * mur du fond, dans l'axe) et l'angle de sa nef, relevés sur le cadastre. */
  const EGLISE = { x: -0.8, z: -0.4, angle: -5.1 };
  // ce que la maquette de l'église dessine déjà autour d'elle (dans son repère)
  const ENCLOS = { x0: -14.5, x1: 41, z0: -18, z1: 21 };

  const IDS = {
    tour: 287034811, belvedere: 287034822, orangerie: 287034816, pavillon: 287034917,
    villa: 287034975, chateau: 287034824, reservoir: 287034812, mairie: 287034823,
  };
  const DOMAINE = [IDS.tour, IDS.belvedere, IDS.orangerie, IDS.pavillon];

  const T = {
    herbe: '#8f9a62', pente: '#74874f', plateau: '#b3a678', route: '#b9b3a4', rue: '#cdc4ae', chemin: '#c4ad82',
    murs: ['#c9a66b', '#c2a070', '#d0b07c', '#bb9862', '#c8ab7a'], enduit: '#bdb5a2', pierre: '#d6c4a0',
    tuile: '#b9683f', tuileSombre: '#a85c38', chateau: '#b99866', verre: '#9cc4c6', fer: '#3f6f6a', gris: '#a9a79f',
    magdala: '#c8ad7a', cypres: '#2f4a33', tronc: '#5a4630',
  };

  function hasard(n) {
    const x = Math.sin(n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  function construire(annee) {
    const an = annee || 2026;
    const P = racine.VillagePlan;
    const Maillage = racine.Maquette.Maillage;
    const terrain = new Maillage(), bati = new Maillage(), eglise = new Maillage();
    for (const g of [terrain, bati, eglise]) g.dedans = false;

    /* ── le relief ── */

    const R = P.relief;
    const h = R.h.slice();
    const a = EGLISE.angle * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    // du village vers le repère de l'église
    const versEglise = (x, z) => {
      const dx = x - EGLISE.x, dz = z - EGLISE.z;
      return [dx * ca + dz * sa, -dx * sa + dz * ca];
    };
    // l'église et son enclos tiennent sur un replat : on aplanit dessous, en douceur autour
    for (let j = 0; j < R.nz; j += 1) {
      for (let i = 0; i < R.nx; i += 1) {
        const [ex, ez] = versEglise(R.x0 + i * R.pas, R.z0 + j * R.pas);
        const dehors = Math.max(ENCLOS.x0 - ex, ex - ENCLOS.x1, ENCLOS.z0 - ez, ez - ENCLOS.z1, 0);
        const k = Math.min(1, dehors / 22);
        h[j * R.nx + i] *= k * k * (3 - 2 * k);
      }
    }
    const sol = (x, z) => {
      const fx = Math.max(0, Math.min(R.nx - 1.001, (x - R.x0) / R.pas)), fz = Math.max(0, Math.min(R.nz - 1.001, (z - R.z0) / R.pas));
      const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
      const q = (ii, jj) => h[jj * R.nx + ii];
      return (q(i, j) * (1 - u) + q(i + 1, j) * u) * (1 - v) + (q(i, j + 1) * (1 - u) + q(i + 1, j + 1) * u) * v;
    };
    for (let j = 0; j < R.nz - 1; j += 1) {
      for (let i = 0; i < R.nx - 1; i += 1) {
        const x0 = R.x0 + i * R.pas, z0 = R.z0 + j * R.pas, x1 = x0 + R.pas, z1 = z0 + R.pas;
        const A = [x0, h[j * R.nx + i], z0], B = [x1, h[j * R.nx + i + 1], z0];
        const C = [x1, h[(j + 1) * R.nx + i + 1], z1], D = [x0, h[(j + 1) * R.nx + i], z1];
        const pente = Math.max(Math.abs(A[1] - C[1]), Math.abs(B[1] - D[1])) / (R.pas * 1.414);
        const c = pente > 0.28 ? T.pente : (pente > 0.1 ? T.herbe : T.plateau);
        terrain.triDessus(A, B, C, c, 8);
        terrain.triDessus(A, C, D, c, 8);
      }
    }

    /* ── les voies : des rubans posés sur le terrain ── */

    const LARGEURS = { route: 2.0, rue: 1.3, chemin: 0.7 };
    for (const v of P.voies) {
      const l = LARGEURS[v.t] || 1;
      // les allées du domaine ne sont pas tracées avant lui
      let mx = 0, mz = 0;
      for (let i = 0; i < v.p.length; i += 2) { mx += v.p[i] / (v.p.length / 2); mz += v.p[i + 1] / (v.p.length / 2); }
      if (an < 1906 && v.t !== 'route' && mx > -72 && mx < -16 && mz > -16 && mz < 42) continue;
      const pts = [];
      for (let i = 0; i < v.p.length - 2; i += 2) {
        const ax = v.p[i], az = v.p[i + 1], bx = v.p[i + 2], bz = v.p[i + 3];
        const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 5));
        for (let k = 0; k < n; k += 1) pts.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
      }
      pts.push([v.p[v.p.length - 2], v.p[v.p.length - 1]]);
      const bords = pts.map((p, i) => {
        const q0 = pts[Math.max(0, i - 1)], q1 = pts[Math.min(pts.length - 1, i + 1)];
        const d = Math.hypot(q1[0] - q0[0], q1[1] - q0[1]) || 1;
        const nx = -(q1[1] - q0[1]) / d * l, nz = (q1[0] - q0[0]) / d * l;
        const g = [p[0] + nx, p[1] + nz], dr = [p[0] - nx, p[1] - nz];
        const y = Math.max(sol(g[0], g[1]), sol(dr[0], dr[1]), sol(p[0], p[1])) + 0.18;
        return [[g[0], y, g[1]], [dr[0], y, dr[1]]];
      });
      const xMax = R.x0 + (R.nx - 1) * R.pas, zMax = R.z0 + (R.nz - 1) * R.pas;
      const dansLeCadre = (p) => p[0] > R.x0 + l && p[0] < xMax - l && p[1] > R.z0 + l && p[1] < zMax - l;
      for (let i = 0; i < bords.length - 1; i += 1) {
        if (!dansLeCadre(pts[i]) || !dansLeCadre(pts[i + 1])) continue;      // la voie sort du terrain : on la coupe là
        terrain.quad(bords[i][0], bords[i][1], bords[i + 1][1], bords[i + 1][0], T[v.t] || T.chemin, 0, true);
      }
    }

    /* ── le bâti ── */

    const emprise = (b) => { const e = []; for (let i = 0; i < b.p.length; i += 2) e.push([b.p[i], b.p[i + 1]]); return e; };
    const assise = (e) => { let bas = Infinity, haut = -Infinity; for (const p of e) { const y = sol(p[0], p[1]); bas = Math.min(bas, y); haut = Math.max(haut, y); } return [bas, haut]; };
    const centre = (e) => { let x = 0, z = 0; for (const p of e) { x += p[0] / e.length; z += p[1] / e.length; } return [x, z]; };
    const reperes = [];
    const lieux = {};

    for (const b of P.batis) {
      const e = emprise(b);
      const [cx, cz] = centre(e);
      const [bas, haut] = assise(e);
      lieux[b.i] = [cx, haut, cz];
      const [ex, ez] = versEglise(cx, cz);
      const dansEnclos = ex > ENCLOS.x0 && ex < ENCLOS.x1 - 13 && ez > -9.5 && ez < ENCLOS.z1;
      if (b.t === 'eglise' || (dansEnclos && b.i !== IDS.villa)) continue;     // la maquette de l'église s'en charge
      if (DOMAINE.indexOf(b.i) !== -1 && an < 1906) continue;
      if (b.i === IDS.villa && an < 1905) continue;
      if (b.i === IDS.reservoir && an < 2026) continue;

      if (b.i === IDS.tour) {
        // la tour Magdala : un corps carré crénelé, une échauguette ronde à l'angle
        const xs = e.map((p) => p[0]), zs = e.map((p) => p[1]);
        const x0 = Math.min(...xs) + 0.6, x1 = Math.max(...xs) - 1.6, z0 = Math.min(...zs) + 0.8, z1 = Math.max(...zs) - 0.8;
        const y0 = bas - 0.5, y1 = haut + 9.2;
        bati.boite(x0, y0, z0, x1, y1, z1, T.magdala, 1, 'y-');
        const dents = (xa, za, xb, zb) => {
          const n = Math.max(3, Math.round(Math.hypot(xb - xa, zb - za) / 0.9));
          for (let k = 0; k < n; k += 2) {
            const u0 = k / n, u1 = (k + 1) / n;
            bati.boite(Math.min(xa + (xb - xa) * u0, xa + (xb - xa) * u1) - (za === zb ? 0 : 0.22), y1, Math.min(za + (zb - za) * u0, za + (zb - za) * u1) - (xa === xb ? 0 : 0.22),
              Math.max(xa + (xb - xa) * u0, xa + (xb - xa) * u1) + (za === zb ? 0 : 0.22), y1 + 0.75, Math.max(za + (zb - za) * u0, za + (zb - za) * u1) + (xa === xb ? 0 : 0.22), T.magdala, 1, 'y-');
          }
        };
        dents(x0, z0, x1, z0); dents(x0, z1, x1, z1); dents(x0, z0, x0, z1); dents(x1, z0, x1, z1);
        // l'échauguette, côté vallée : sa place exacte se lit mal sur les photographies
        bati.tour(x0, z1, [[0.5, y1 - 6.5], [1.25, y1 - 5.2], [1.25, y1 + 1.6], [1.4, y1 + 1.6], [1.4, y1 + 2.4]], T.magdala, 1, { segments: 10 });
        bati.disque(x0, y1 + 1.6, z1, 1.25, T.pierre, 0, { segments: 10 });
        for (const [fx, fz, lx, lz] of [[(x0 + x1) / 2, z1 + 0.02, 0.45, 0], [x1 + 0.02, (z0 + z1) / 2, 0, 0.45]]) {
          bati.boite(fx - lx - 0.02, y1 - 5, fz - lz - 0.02, fx + lx + 0.02, y1 - 3, fz + lz + 0.02, '#2b3556', 0);
        }
        continue;
      }
      if (b.i === IDS.chateau) {
        // le château des Hautpoul : le logis, une tour ronde, deux tours carrées
        const y0 = bas - 0.5;
        bati.prisme(e, y0, haut + 9, T.chateau, 1, { h: 1.6, couleur: T.tuileSombre, matiere: 2, retrait: 0.5, debord: 0.03 });
        const nord = e.reduce((m, p) => (p[1] < m[1] ? p : m));
        const est = e.reduce((m, p) => (p[0] > m[0] ? p : m));
        const ouest = e.reduce((m, p) => (p[0] < m[0] ? p : m));
        bati.tour(cx - 2, nord[1] + 4, [[4.1, y0], [4.1, haut + 13], [4.4, haut + 13], [4.4, haut + 13.4], [0.3, haut + 15]], [T.chateau, T.pierre, T.pierre, T.tuileSombre], 1, { segments: 12 });
        for (const p of [est, ouest]) {
          const tx = p[0] + (p === est ? -3 : 3), tz = p[1];
          bati.boite(tx - 3, y0, tz - 3, tx + 3, haut + 12, tz + 3, T.chateau, 1, 'y-');
          bati.prisme([[tx - 3.2, tz - 3.2], [tx + 3.2, tz - 3.2], [tx + 3.2, tz + 3.2], [tx - 3.2, tz + 3.2]], haut + 12, haut + 12.01, T.tuileSombre, 2, { h: 1.4, retrait: 0.9 });
        }
        continue;
      }
      if (b.i === IDS.belvedere) {
        // le belvédère : un chemin de ronde en arc, de la tour à l'orangerie
        bati.prisme(e, bas - 0.5, haut + 3.2, T.magdala, 1);
        continue;
      }
      if (b.i === IDS.orangerie) {
        bati.prisme(e, bas - 0.5, haut + 3.2, T.magdala, 1);
        bati.prisme(e.map((p) => [cx + (p[0] - cx) * 0.8, cz + (p[1] - cz) * 0.8]), haut + 3.2, haut + 6, T.verre, 0, { h: 1.8, couleur: T.verre, matiere: 0, retrait: 0.85 });
        continue;
      }
      if (b.i === IDS.reservoir) {
        bati.tour(cx, cz, [[3.2, bas - 0.5], [3.2, haut + 9], [3.6, haut + 9.4], [3.6, haut + 12], [0, haut + 12.3]], T.gris, 0, { segments: 14 });
        continue;
      }
      // une maison : deux ou trois niveaux, un toit de tuiles à faible pente
      let surface = 0;
      for (let i = 0; i < e.length; i += 1) surface += e[i][0] * e[(i + 1) % e.length][1] - e[(i + 1) % e.length][0] * e[i][1];
      surface = Math.abs(surface) / 2;
      const petit = surface < 28;
      const hauteur = b.i === IDS.villa ? 8.6 : (b.i === IDS.mairie ? 7.2 : (petit ? 2.8 + hasard(b.i) * 1.2 : 5 + hasard(b.i) * 3));
      const mur = b.i === IDS.villa ? T.enduit : T.murs[Math.floor(hasard(b.i + 7) * T.murs.length)];
      bati.prisme(e, bas - 0.5, haut + hauteur, mur, b.i === IDS.villa ? 4 : 1,
        { h: b.i === IDS.villa ? 2.2 : (petit ? 0.8 : 1.3 + hasard(b.i + 3) * 0.7), couleur: hasard(b.i + 5) > 0.5 ? T.tuile : T.tuileSombre, matiere: 2, retrait: 0.6, debord: 0.04 });
    }

    // le mur du château
    for (const m of P.murs) {
      const [ex, ez] = versEglise(m.p[0], m.p[1]);
      if (ex > ENCLOS.x0 && ex < ENCLOS.x1 && ez > ENCLOS.z0 && ez < ENCLOS.z1 + 12) continue;
      for (let i = 0; i < m.p.length - 2; i += 2) {
        const A = [m.p[i], m.p[i + 1]], B = [m.p[i + 2], m.p[i + 3]];
        const y = Math.min(sol(A[0], A[1]), sol(B[0], B[1]));
        bati.paroi(A, B, y - 0.3, y + 2.2, T.chateau, 1);
        bati.paroi(B, A, y - 0.3, y + 2.2, T.chateau, 1);
      }
    }
    // quelques cyprès, là où les photographies en montrent : dans le domaine
    if (an >= 1906) {
      for (const [x, z, ht] of [[-40, 14, 9], [-36, 20, 8], [-44, 22, 10], [-30, 8, 7]]) {
        const y = sol(x, z);
        bati.tour(x, z, [[0.15, y], [0.15, y + 0.6]], T.tronc, 0, { segments: 6 });
        bati.tour(x, z, [[0.6, y + 0.6], [1.0, y + ht * 0.3], [0.7, y + ht * 0.7], [0.05, y + ht]], T.cypres, 8, { segments: 7 });
      }
    }

    /* ── l'église, dans son état de la même année ── */

    const E = racine.Eglise.construire(an, { sol: false });
    eglise.placer(EGLISE.x, 0, EGLISE.z, EGLISE.angle, 1, () => {
      for (const nom of ['abords', 'ext', 'int', 'sol']) eglise.verser(E.groupes[nom]);
    });
    const depuisEglise = (x, y, z) => [EGLISE.x + x * ca - z * sa, y, EGLISE.z + x * sa + z * ca];

    /* ── les repères ── */

    const repere = (de, jusqu, r) => { if (an >= de && an < jusqu) reperes.push(Object.assign({ ou: 'dehors' }, r)); };
    const au = (id, dy) => [lieux[id][0], lieux[id][1] + dy, lieux[id][2]];
    repere(-9999, 9999, { id: 'eglise', nom: 'L’église', p: depuisEglise(8, 13.8, -6), fiche: 'eglise-sainte-marie-madeleine', vue: 'eglise',
      maquette: 'eglise', libelleMaquette: 'Visiter l’église',
      texte: 'Sainte-Marie-Madeleine, en haut du village : romane, restaurée par Saunière de 1887 à 1897. Elle a sa propre maquette, où l’on entre.' });
    repere(-9999, 9999, { id: 'presbytere', nom: 'Le presbytère', p: depuisEglise(-7, 8, 0.6), fiche: 'presbytere',
      texte: 'La maison du curé, accolée à l’ouest de l’église : un bien de la commune.' });
    repere(-9999, 9999, { id: 'cimetiere', nom: 'Le cimetière', p: depuisEglise(24, 2, -9), fiche: 'cimetiere',
      texte: 'Au nord et à l’est de l’église.' });
    repere(1897, 9999, { id: 'calvaire', nom: 'Le jardin du calvaire', p: depuisEglise(12.6, 6.5, 13.6), fiche: 'jardin-du-calvaire',
      texte: 'Le petit enclos devant le porche : la Vierge sur le pilier (1891), le calvaire et la grotte (1897).' });
    repere(-9999, 9999, { id: 'chateau', nom: 'Le château des Hautpoul', p: au(IDS.chateau, 16), fiche: 'chateau-des-hautpoul', vue: 'chateau',
      texte: 'Le château des seigneurs, à l’est du village. Son plan vient du cadastre ; ses tours sont placées d’après des photographies.' });
    repere(1905, 9999, { id: 'villa', nom: 'La villa Béthanie', p: au(IDS.villa, 11.5), fiche: 'villa-bethanie', vue: 'domaine',
      texte: 'Première pierre le 3 juin 1901, achevée en mai 1905 : au nom de Marie Dénarnaud.' });
    repere(1906, 9999, { id: 'tour', nom: 'La tour Magdala', p: au(IDS.tour, 12.5), fiche: 'tour-magdala', vue: 'domaine',
      texte: 'La bibliothèque de l’abbé, au bord du plateau : achevée en 1906 avec le belvédère et l’orangerie.' });
    repere(1906, 9999, { id: 'belvedere', nom: 'Le belvédère et l’orangerie', p: au(IDS.orangerie, 7.5), fiche: 'belvedere-et-orangerie', vue: 'domaine',
      texte: 'Un chemin de ronde en arc, de la tour à la serre : la promenade de l’abbé, face aux Pyrénées.' });
    repere(-9999, 1901, { id: 'terrains', nom: 'Les terrains du futur domaine', p: [-40, sol(-40, 12) + 3, 12],
      fiche: an >= 1898 ? 'villa-bethanie' : 'rennes-le-chateau',
      texte: an >= 1898 ? 'Six parcelles achetées en décembre 1898 au nom de Marie Dénarnaud : rien n’y est encore bâti.' : 'Le bord ouest du plateau : des jardins et des parcelles, rien de ce que l’abbé y bâtira.' });
    repere(1901, 1906, { id: 'terrains', nom: 'Le chantier du domaine', p: [-40, sol(-40, 12) + 3, 12], fiche: 'tour-magdala',
      texte: 'Depuis 1901, on bâtit ici la villa (finie en 1905), puis la tour, le belvédère et l’orangerie (1906).' });
    repere(-9999, 9999, { id: 'village', nom: 'Le village', p: [lieux[IDS.mairie][0], lieux[IDS.mairie][1] + 10, lieux[IDS.mairie][2]], fiche: 'rennes-le-chateau', vue: 'rues',
      texte: 'Les maisons sont celles du cadastre d’aujourd’hui, à toutes les époques : celles d’autrefois ne sont pas documentées une à une. Leurs hauteurs sont données au jugé.' });
    repere(2026, 9999, { id: 'reservoir', nom: 'Le réservoir', p: au(IDS.reservoir, 13.5),
      texte: 'Le château d’eau du village. Sa date n’est pas établie : la maquette ne le montre qu’aujourd’hui.' });

    /* ── les points de vue ── */

    const d = lieux[IDS.tour], c = lieux[IDS.chateau];
    const vues = {
      ensemble: { nom: 'Ensemble', mode: 'dehors', cible: [35, 0, 30], lacet: -120, tangage: 32, dist: 270 },
      plan: { nom: 'En plan', mode: 'dehors', cible: [45, 0, 35], lacet: -90, tangage: 88, dist: 380 },
      eglise: { nom: 'L’église', mode: 'dehors', cible: [8, 4, 4], lacet: -120, tangage: 24, dist: 62 },
      domaine: { nom: an >= 1906 ? 'Le domaine' : 'Le bord du plateau', mode: 'dehors', cible: [-38, d[1] + 3, 14], lacet: -35, tangage: 24, dist: 95 },
      chateau: { nom: 'Le château', mode: 'dehors', cible: [c[0], c[1] + 5, c[2]], lacet: -110, tangage: 22, dist: 85 },
      rues: { nom: 'À pied', mode: 'dehors', cible: [27, sol(27, 41) + 1.65, 41], lacet: -125, tangage: -5, dist: 0.02, ouverture: 64 },
    };

    return {
      annee: an,
      image: E.image,           // le décor de l'église, pour ce qu'on en voit du dehors
      groupes: { terrain, bati, eglise },
      reperes,
      vues,
      bornes: [R.x0 + 5, -70, R.z0 + 5, R.x0 + (R.nx - 1) * R.pas - 5, 90, R.z0 + (R.nz - 1) * R.pas - 5],
      echelle: { distMax: 700, loin: 3200, brume: 0.0007, vitesse: 6 },
      sol,
    };
  }

  const EPOQUES = [
    { annee: 1781, nom: 'Vers 1781' },
    { annee: 1897, nom: 'En 1897' },
    { annee: 1910, nom: 'En 1910' },
    { annee: 2026, nom: 'Aujourd’hui' },
  ];

  racine.Village = { construire, EPOQUES, EGLISE };

})(typeof window !== 'undefined' ? window : globalThis);
