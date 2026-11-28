'use strict';
/*
 * La maquette : de quoi bâtir un volume en triangles, et de quoi le montrer.
 *
 * Deux parties, sans aucune dépendance :
 *
 * — `Maquette.Maillage`, un petit atelier de géométrie (boîtes, parois percées
 *   de baies, voûtes, culs-de-four, pièces tournées). Il ne touche pas à
 *   l'écran : `build/maquette.mjs` s'en sert sous Node pour les épreuves et
 *   pour exporter un fichier .glb ;
 * — `Maquette.poser(cadre, options)`, la visionneuse WebGL : on tourne autour
 *   du volume, on y entre, on touche un repère pour le nommer.
 *
 * Le repère : x vers l'est (l'axe de la nef, du fond vers le chœur), y vers le
 * haut, z vers le sud. Les longueurs sont en mètres.
 *
 * Ce fichier est le même dans Rhedae et dans Terribilis (une épreuve de
 * Terribilis le vérifie) : on le retouche dans Rhedae, puis on le recopie.
 */
(function (racine) {

  /* D'où ce fichier est servi : l'image du décor se cherche à partir de là. */
  const ICI = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';

  /* ══════════════ L'atelier de géométrie ══════════════ */

  const MATIERES = {
    uni: 0, moellon: 1, tuile: 2, damier: 3, appareil: 4, ciel: 5,
    bois: 6, vitrail: 7, sol: 8, decor: 9, dalles: 10,
    image: 11,           // un morceau de photographie, plaqué (voir `tableau`, `plaque`, `silhouette`)
    verreImage: 12,      // le même, lumineux : un vitrail
  };

  const teintes = {};
  function teinte(c) {
    if (Array.isArray(c)) return c;
    if (!teintes[c]) {
      const n = parseInt(c.slice(1), 16);
      teintes[c] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    return teintes[c];
  }

  function Maillage() {
    this.pos = [];
    this.nor = [];
    this.cou = [];       // r, v, b, matière — un octet chacun
    this.uv = [];        // où l'on est dans l'image du décor (0, 0 hors des matières 11 et 12)
    this.pile = [];
    this.t = { c: 1, s: 0, e: 1, x: 0, y: 0, z: 0 };
  }

  const M = Maillage.prototype;

  /* Pose ce que dessine `f` en (x, y, z), tourné de `angle` degrés autour de la
   * verticale (sens des aiguilles vu de dessus, comme une boussole) et grossi. */
  M.placer = function (x, y, z, angle, echelle, f) {
    const a = (angle || 0) * Math.PI / 180;
    const t = this.t;
    const o = this._p([x, y, z]);
    this.pile.push(t);
    const c = Math.cos(a), s = Math.sin(a);
    this.t = { c: t.c * c - t.s * s, s: t.s * c + t.c * s, e: t.e * (echelle || 1), x: o[0], y: o[1], z: o[2] };
    f();
    this.t = this.pile.pop();
  };

  M._p = function (p) {
    const t = this.t;
    const x = p[0] * t.e, z = p[2] * t.e;
    return [t.x + x * t.c - z * t.s, t.y + p[1] * t.e, t.z + x * t.s + z * t.c];
  };

  /* `uv` : pour les matières à image, les trois points de l'image [[u, v] × 3]. */
  M.tri = function (a, b, c, couleur, matiere, uv) {
    a = this._p(a); b = this._p(b); c = this._p(c);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-9) return;
    nx /= l; ny /= l; nz /= l;
    const k = teinte(couleur);
    const m = typeof matiere === 'number' ? matiere : (MATIERES[matiere] || 0);
    const pts = [a, b, c];
    for (let i = 0; i < 3; i += 1) {
      const p = pts[i];
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(nx, ny, nz);
      this.cou.push(k[0], k[1], k[2], m);
      if (uv) this.uv.push(uv[i][0], uv[i][1]); else this.uv.push(0, 0);
    }
  };

  /*
   * ── Les images ──
   * Une « case » est un morceau de l'image du décor : [u0, v0, u1, v1, r, v, b]
   * (les coins, puis la couleur moyenne — c'est elle qu'on voit tant que
   * l'image n'est pas arrivée, et dans les fichiers exportés).
   */

  /* Un tableau : quatre points, vus de face — bas gauche, bas droit, haut
   * droit, haut gauche. */
  M.tableau = function (a, b, c, d, cas, matiere) {
    const m = matiere === undefined ? 11 : matiere;
    const k = [cas[4], cas[5], cas[6]];
    const A = [cas[0], cas[3]], B = [cas[2], cas[3]], C = [cas[2], cas[1]], D = [cas[0], cas[1]];
    this.tri(a, b, c, k, m, [A, B, C]);
    this.tri(a, c, d, k, m, [A, C, D]);
  };

  /*
   * Une plaque découpée, debout, tournée vers z+ : `contour` est son pourtour
   * dans l'image ([[u, v], …] de 0 à 1, v vers le bas), `l` et `h` sa taille,
   * `ep` son épaisseur. Elle est posée sur y = 0, centrée sur x = 0, adossée à z = 0.
   */
  M.plaque = function (contour, cas, l, h, ep, matiere) {
    const mat = matiere === undefined ? 11 : matiere;
    const k = [cas[4], cas[5], cas[6]];
    let pts = contour.map(([u, v]) => [(u - 0.5) * l, (1 - v) * h, u, v]);
    let aire = 0;
    for (let i = 0; i < pts.length; i += 1) { const a = pts[i], b = pts[(i + 1) % pts.length]; aire += a[0] * b[1] - b[0] * a[1]; }
    if (aire < 0) pts = pts.reverse();
    const uv = (p) => [cas[0] + (cas[2] - cas[0]) * p[2], cas[1] + (cas[3] - cas[1]) * p[3]];
    for (const [a, b, c] of trianguler(pts)) {
      const A = pts[a], B = pts[b], C = pts[c];
      const sens = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
      const [P, Q, R] = sens >= 0 ? [A, B, C] : [A, C, B];
      this.tri([P[0], P[1], ep], [Q[0], Q[1], ep], [R[0], R[1], ep], k, mat, [uv(P), uv(Q), uv(R)]);
    }
    for (let i = 0; i < pts.length; i += 1) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      this.tri([a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], ep], k, mat, [uv(a), uv(b), uv(b)]);
      this.tri([a[0], a[1], 0], [b[0], b[1], ep], [a[0], a[1], ep], k, mat, [uv(a), uv(b), uv(a)]);
    }
  };

  /*
   * Une statue tirée de sa silhouette : `forme` est [[v, gauche, droite], …],
   * du haut vers le bas, dans sa case. À chaque hauteur, une section en
   * ellipse, large comme la silhouette et profonde à proportion (`prof`, jamais
   * plus que `epais` mètres) ; la photographie est projetée de face. Debout sur
   * y = 0, haute de `h`, tournée vers z+. Rend sa largeur.
   */
  M.silhouette = function (forme, cas, h, options) {
    const o = options || {};
    const N = o.segments || 10;
    const prof = o.prof === undefined ? 0.62 : o.prof;
    const du = cas[2] - cas[0], dv = cas[3] - cas[1];
    const l = h * du / dv;                 // l'image du décor est carrée
    const epais = o.epais === undefined ? 0.2 * h : o.epais;
    const k = [cas[4], cas[5], cas[6]];
    const rangs = forme.map(([v, g, d]) => {
      const a = (d - g) / 2 * l;
      return { y: (1 - v) * h, cx: ((g + d) / 2 - 0.5) * l, a, b: Math.max(0.01, Math.min(a * prof, epais)) };
    });
    /* Un point de la section, et où il prend sa couleur : la photographie est
     * en partie projetée de face (le cosinus), en partie enroulée (l'angle) —
     * de face elle reste juste, et les flancs ne sont pas une seule colonne
     * de pixels étirée. Le dos reprend le devant, en miroir. */
    const point = (r, t) => {
      const devant = t <= Math.PI ? t : 2 * Math.PI - t;
      const x = r.cx + r.a * (0.55 * Math.cos(devant) + 0.45 * (1 - 2 * devant / Math.PI));
      return [r.cx + r.a * Math.cos(t), r.y, r.b * Math.sin(t), x];
    };
    const dans = (t) => Math.max(0, Math.min(1, t));          // la calotte dépasse la case : elle en prend le bord
    const uv = (p) => [cas[0] + du * dans((p.length > 3 ? p[3] : p[0]) / l + 0.5), cas[1] + dv * dans(1 - p[1] / h)];
    const dehors = (a, b, c, centre) => {
      // on tourne le triangle pour qu'il regarde hors de la statue
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const gx = (a[0] + b[0] + c[0]) / 3 - centre[0], gy = (a[1] + b[1] + c[1]) / 3 - centre[1], gz = (a[2] + b[2] + c[2]) / 3;
      if (nx * gx + ny * gy + nz * gz >= 0) this.tri(a, b, c, k, 11, [uv(a), uv(b), uv(c)]);
      else this.tri(a, c, b, k, 11, [uv(a), uv(c), uv(b)]);
    };
    for (let i = 0; i < rangs.length - 1; i += 1) {
      const r0 = rangs[i], r1 = rangs[i + 1];
      const centre = [(r0.cx + r1.cx) / 2, (r0.y + r1.y) / 2];
      for (let j = 0; j < N; j += 1) {
        const t0 = 2 * Math.PI * j / N, t1 = 2 * Math.PI * (j + 1) / N;
        const A = point(r0, t0), B = point(r0, t1), C = point(r1, t1), D = point(r1, t0);
        dehors(A, B, C, centre); dehors(A, C, D, centre);
      }
    }
    // le dessus : une calotte basse
    const r = rangs[0];
    const sommet = [r.cx, r.y + Math.min(r.a, r.b) * 0.6, 0, r.cx];
    for (let j = 0; j < N; j += 1) {
      dehors(sommet, point(r, 2 * Math.PI * j / N), point(r, 2 * Math.PI * (j + 1) / N), [r.cx, r.y - 1]);
    }
    return l;
  };

  /* Quatre points, dans le sens inverse des aiguilles vus de face. */
  M.quad = function (a, b, c, d, couleur, matiere, deuxFaces, uv) {
    this.tri(a, b, c, couleur, matiere, uv && [uv[0], uv[1], uv[2]]);
    this.tri(a, c, d, couleur, matiere, uv && [uv[0], uv[2], uv[3]]);
    if (deuxFaces) { this.tri(c, b, a, couleur, matiere); this.tri(d, c, a, couleur, matiere); }
  };

  /* `sans` : les faces à ne pas dessiner, parmi x+ x- y+ y- z+ z-. */
  M.boite = function (x0, y0, z0, x1, y1, z1, couleur, matiere, sans) {
    const s = sans || '';
    const q = (a, b, c, d) => this.quad(a, b, c, d, couleur, matiere);
    if (s.indexOf('x+') < 0) q([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]);
    if (s.indexOf('x-') < 0) q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
    if (s.indexOf('y+') < 0) q([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]);
    if (s.indexOf('y-') < 0) q([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
    if (s.indexOf('z+') < 0) q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
    if (s.indexOf('z-') < 0) q([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]);
  };

  /*
   * Une paroi verticale de A vers B (deux points [x, z] du plan), de y0 à y1,
   * visible du côté droit de qui marche de A vers B. `baies` la percent :
   *   { u, l, bas, haut, cintre, prof, fond, fondMatiere, joue, joueMatiere }
   * u : le milieu de la baie, en mètres depuis A ; l : sa largeur ; `prof` : la
   * profondeur de l'ébrasement ; `fond` : la couleur de ce qui la ferme (rien si
   * absent : on voit au travers) ; `image` : une case de l'image du décor, à
   * plaquer sur ce fond.
   */
  M.paroi = function (A, B, y0, y1, couleur, matiere, baies, toit) {
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const dx = (B[0] - A[0]) / L, dz = (B[1] - A[1]) / L;
    const nx = -dz, nz = dx;
    const pt = (u, y, prof) => [A[0] + dx * u - nx * (prof || 0), y, A[1] + dz * u - nz * (prof || 0)];
    /* `toit(u)` : la hauteur du haut de la paroi à l'abscisse u, quand elle
     * n'est pas droite (un mur qui monte sous une voûte). */
    const sommet = (u) => (toit ? toit(u) : y1);
    const face = (u0, ya, u1, yb) => {
      if (u1 - u0 < 1e-6) return;
      const plein = yb === y1 && toit;
      const n = plein ? Math.max(1, Math.ceil((u1 - u0) / 0.3)) : 1;
      for (let k = 0; k < n; k += 1) {
        const a = u0 + (u1 - u0) * k / n, b = u0 + (u1 - u0) * (k + 1) / n;
        const ha = plein ? sommet(a) : yb, hb = plein ? sommet(b) : yb;
        if (Math.max(ha, hb) - ya < 1e-6) continue;
        this.quad(pt(a, ya), pt(b, ya), pt(b, Math.max(hb, ya)), pt(a, Math.max(ha, ya)), couleur, matiere);
      }
    };
    const liste = (baies || []).slice().sort((a, b) => a.u - b.u);
    let u = 0;
    for (const b of liste) {
      const uG = b.u - b.l / 2, uD = b.u + b.l / 2;
      const r = b.l / 2;
      const haut = Math.min(b.haut, y1);
      const naissance = b.cintre ? haut - r : haut;
      const prof = b.prof || 0;
      const cj = b.joue || couleur, mj = b.joueMatiere === undefined ? matiere : b.joueMatiere;
      face(u, y0, uG, y1);
      face(uG, y0, uD, b.bas);
      const N = b.cintre ? 10 : 1;
      const arc = [];
      for (let k = 0; k <= N; k += 1) {
        const a = Math.PI * (1 - k / N);
        arc.push(b.cintre ? [b.u + r * Math.cos(a), naissance + r * Math.sin(a)] : [k === 0 ? uG : uD, haut]);
      }
      // l'écoinçon, au-dessus de la baie
      for (let k = 0; k < N; k += 1) {
        const ha = Math.max(sommet(arc[k][0]), arc[k][1]), hb = Math.max(sommet(arc[k + 1][0]), arc[k + 1][1]);
        this.quad(pt(arc[k][0], arc[k][1]), pt(arc[k + 1][0], arc[k + 1][1]), pt(arc[k + 1][0], hb), pt(arc[k][0], ha), couleur, matiere);
      }
      if (prof > 0) {
        this.quad(pt(uG, b.bas), pt(uG, b.bas, prof), pt(uG, naissance, prof), pt(uG, naissance), cj, mj);
        this.quad(pt(uD, b.bas, prof), pt(uD, b.bas), pt(uD, naissance), pt(uD, naissance, prof), cj, mj);
        if (b.bas > y0 + 1e-6) this.quad(pt(uG, b.bas), pt(uD, b.bas), pt(uD, b.bas, prof), pt(uG, b.bas, prof), cj, mj);
        for (let k = 0; k < N; k += 1) {
          this.quad(pt(arc[k + 1][0], arc[k + 1][1]), pt(arc[k][0], arc[k][1]), pt(arc[k][0], arc[k][1], prof), pt(arc[k + 1][0], arc[k + 1][1], prof), cj, mj);
        }
      }
      if (b.fond) {
        const m = b.fondMatiere || 0;
        const im = b.image;
        const uv = im ? (x, y) => [im[0] + (im[2] - im[0]) * (x - uG) / (uD - uG), im[1] + (im[3] - im[1]) * (haut - y) / (haut - b.bas)] : null;
        this.quad(pt(uG, b.bas, prof), pt(uD, b.bas, prof), pt(uD, naissance, prof), pt(uG, naissance, prof), b.fond, m, false,
          uv && [uv(uG, b.bas), uv(uD, b.bas), uv(uD, naissance), uv(uG, naissance)]);
        if (b.cintre) {
          for (let k = 0; k < N; k += 1) {
            this.tri(pt(b.u, naissance, prof), pt(arc[k + 1][0], arc[k + 1][1], prof), pt(arc[k][0], arc[k][1], prof), b.fond, m,
              uv && [uv(b.u, naissance), uv(arc[k + 1][0], arc[k + 1][1]), uv(arc[k][0], arc[k][1])]);
          }
        }
      }
      u = uD;
    }
    face(u, y0, L, y1);
  };

  /*
   * Un berceau le long de x, de x0 à x1 : demi-ellipse de demi-largeur `a` et de
   * flèche `b`, née à la hauteur `y`, d'axe z = `z`. `dedans` : on la voit du
   * dessous (une voûte) ; sinon du dessus (un extrados).
   */
  M.berceau = function (x0, x1, y, z, a, b, couleur, matiere, dedans, segments) {
    const N = segments || 14;
    for (let k = 0; k < N; k += 1) {
      const t0 = Math.PI * k / N, t1 = Math.PI * (k + 1) / N;
      const p0 = [z + a * Math.cos(t0), y + b * Math.sin(t0)];
      const p1 = [z + a * Math.cos(t1), y + b * Math.sin(t1)];
      const q = [[x0, p0[1], p0[0]], [x1, p0[1], p0[0]], [x1, p1[1], p1[0]], [x0, p1[1], p1[0]]];
      if (dedans) this.quad(q[3], q[2], q[1], q[0], couleur, matiere);
      else this.quad(q[0], q[1], q[2], q[3], couleur, matiere);
    }
  };

  /* Un arc doubleau : une bande d'épaisseur `ep` sous un berceau, de x0 à x1. */
  M.doubleau = function (x0, x1, y, z, a, b, ep, couleur, matiere, segments) {
    const N = segments || 14;
    this.berceau(x0, x1, y, z, a - ep, b - ep, couleur, matiere, true, N);
    for (let k = 0; k < N; k += 1) {
      const t0 = Math.PI * k / N, t1 = Math.PI * (k + 1) / N;
      const i0 = [z + (a - ep) * Math.cos(t0), y + (b - ep) * Math.sin(t0)], i1 = [z + (a - ep) * Math.cos(t1), y + (b - ep) * Math.sin(t1)];
      const e0 = [z + a * Math.cos(t0), y + b * Math.sin(t0)], e1 = [z + a * Math.cos(t1), y + b * Math.sin(t1)];
      this.quad([x0, i0[1], i0[0]], [x0, i1[1], i1[0]], [x0, e1[1], e1[0]], [x0, e0[1], e0[0]], couleur, matiere);
      this.quad([x1, i1[1], i1[0]], [x1, i0[1], i0[0]], [x1, e0[1], e0[0]], [x1, e1[1], e1[0]], couleur, matiere);
    }
  };

  /* Un demi-disque vertical, dans le plan x = `x` : le tympan d'un berceau.
   * `versEst` : visible depuis l'est. */
  M.lunette = function (x, y, z, a, b, couleur, matiere, versEst, segments) {
    const N = segments || 14;
    for (let k = 0; k < N; k += 1) {
      const t0 = Math.PI * k / N, t1 = Math.PI * (k + 1) / N;
      const p0 = [x, y + b * Math.sin(t0), z + a * Math.cos(t0)], p1 = [x, y + b * Math.sin(t1), z + a * Math.cos(t1)];
      if (versEst) this.tri([x, y, z], p0, p1, couleur, matiere);
      else this.tri([x, y, z], p1, p0, couleur, matiere);
    }
  };

  /*
   * Une pièce tournée autour de la verticale : `profil` est une suite de
   * [rayon, hauteur], du bas vers le haut. De l'angle a0 à a1 (degrés, 0 = est,
   * 90 = sud). `dedans` : vue de l'intérieur. `couleurs` : une par tronçon, ou
   * une seule.
   */
  M.tour = function (cx, cz, profil, couleurs, matiere, options) {
    const o = options || {};
    const N = o.segments || 12;
    const a0 = (o.a0 === undefined ? 0 : o.a0) * Math.PI / 180;
    const a1 = (o.a1 === undefined ? 360 : o.a1) * Math.PI / 180;
    const ex = o.ex || 1, ez = o.ez || 1;
    for (let i = 0; i < profil.length - 1; i += 1) {
      const [r0, y0] = profil[i], [r1, y1] = profil[i + 1];
      const c = Array.isArray(couleurs) && typeof couleurs[0] !== 'number' ? couleurs[Math.min(i, couleurs.length - 1)] : couleurs;
      for (let k = 0; k < N; k += 1) {
        const t0 = a0 + (a1 - a0) * k / N, t1 = a0 + (a1 - a0) * (k + 1) / N;
        const A = [cx + r0 * ex * Math.cos(t0), y0, cz + r0 * ez * Math.sin(t0)];
        const B = [cx + r0 * ex * Math.cos(t1), y0, cz + r0 * ez * Math.sin(t1)];
        const C = [cx + r1 * ex * Math.cos(t1), y1, cz + r1 * ez * Math.sin(t1)];
        const D = [cx + r1 * ex * Math.cos(t0), y1, cz + r1 * ez * Math.sin(t0)];
        if (o.dedans) { this.tri(A, B, C, c, matiere); this.tri(A, C, D, c, matiere); }
        else { this.tri(B, A, D, c, matiere); this.tri(B, D, C, c, matiere); }
      }
    }
  };

  /* Un disque horizontal (vu de dessus), ou une portion. */
  M.disque = function (cx, y, cz, r, couleur, matiere, options) {
    const o = options || {};
    const N = o.segments || 12;
    const a0 = (o.a0 === undefined ? 0 : o.a0) * Math.PI / 180;
    const a1 = (o.a1 === undefined ? 360 : o.a1) * Math.PI / 180;
    for (let k = 0; k < N; k += 1) {
      const t0 = a0 + (a1 - a0) * k / N, t1 = a0 + (a1 - a0) * (k + 1) / N;
      const A = [cx + r * Math.cos(t0), y, cz + r * Math.sin(t0)], B = [cx + r * Math.cos(t1), y, cz + r * Math.sin(t1)];
      if (o.dessous) this.tri([cx, y, cz], A, B, couleur, matiere);
      else this.tri([cx, y, cz], B, A, couleur, matiere);
    }
  };

  /* Un disque vertical posé sur un mur : centre, rayon, et la direction (dans
   * le plan) d'où on le voit. */
  M.medaillon = function (c, r, vers, couleur, matiere, segments) {
    const N = segments || 16;
    const l = Math.hypot(vers[0], vers[1]);
    const nx = vers[0] / l, nz = vers[1] / l;
    const tx = nz, tz = -nx;          // la tangente horizontale
    for (let k = 0; k < N; k += 1) {
      const t0 = 2 * Math.PI * k / N, t1 = 2 * Math.PI * (k + 1) / N;
      const A = [c[0] + tx * r * Math.cos(t0), c[1] + r * Math.sin(t0), c[2] + tz * r * Math.cos(t0)];
      const B = [c[0] + tx * r * Math.cos(t1), c[1] + r * Math.sin(t1), c[2] + tz * r * Math.cos(t1)];
      this.tri(c, A, B, couleur, matiere);
      this.tri(c, B, A, couleur, matiere);
    }
  };

  /* Découpe un polygone du plan ([[x, z], …], sans croisement) en triangles :
   * rend des triplets d'indices. On coupe les « oreilles » une à une. */
  function trianguler(pts) {
    const n = pts.length;
    const aire = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    let total = 0;
    for (let i = 0; i < n; i += 1) total += pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1];
    const sens = total >= 0 ? 1 : -1;
    const reste = pts.map((p, i) => i);
    const tris = [];
    let garde = 0;
    while (reste.length > 3 && garde < 4 * n) {
      let coupe = false;
      for (let k = 0; k < reste.length; k += 1) {
        const ia = reste[(k + reste.length - 1) % reste.length], ib = reste[k], ic = reste[(k + 1) % reste.length];
        const a = pts[ia], b = pts[ib], c = pts[ic];
        if (aire(a, b, c) * sens <= 1e-9) continue;          // un angle rentrant : pas une oreille
        let libre = true;
        for (const j of reste) {
          if (j === ia || j === ib || j === ic) continue;
          const p = pts[j];
          if (aire(a, b, p) * sens >= 0 && aire(b, c, p) * sens >= 0 && aire(c, a, p) * sens >= 0) { libre = false; break; }
        }
        if (!libre) continue;
        tris.push([ia, ib, ic]);
        reste.splice(k, 1);
        coupe = true;
        break;
      }
      if (!coupe) reste.splice(0, 1);                         // polygone tordu : on avance quand même
      garde += 1;
    }
    if (reste.length === 3) tris.push([reste[0], reste[1], reste[2]]);
    return tris;
  }

  /* Un triangle à peu près horizontal, toujours vu du dessus. */
  M.triDessus = function (a, b, c, couleur, matiere) {
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    if (ny * this.t.e >= 0) this.tri(a, b, c, couleur, matiere);
    else this.tri(a, c, b, couleur, matiere);
  };

  /*
   * Un volume dressé sur une emprise quelconque : `emprise` est [[x, z], …].
   * Des murs de y0 à y1, puis un toit : plat, ou en croupe si `toit.h` — le
   * faîte est l'emprise resserrée vers son centre (`toit.retrait`, de 0 à 1).
   */
  M.prisme = function (emprise, y0, y1, couleur, matiere, toit) {
    let pts = emprise.slice();
    let aire = 0;
    for (let i = 0; i < pts.length; i += 1) aire += pts[i][0] * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * pts[i][1];
    if (aire > 0) pts = pts.reverse();      // les murs regardent dehors (voir `paroi`)
    const n = pts.length;
    for (let i = 0; i < n; i += 1) {
      const a = pts[i], b = pts[(i + 1) % n];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.02) this.paroi(a, b, y0, y1, couleur, matiere);
    }
    const o = toit || {};
    const ct = o.couleur || couleur, mt = o.matiere === undefined ? matiere : o.matiere;
    let cx = 0, cz = 0;
    for (const p of pts) { cx += p[0] / n; cz += p[1] / n; }
    const k = o.h ? 1 - (o.retrait === undefined ? 0.62 : o.retrait) : 1;
    const haut = pts.map((p) => [cx + (p[0] - cx) * k, cz + (p[1] - cz) * k]);
    const yh = y1 + (o.h || 0);
    if (o.h) {
      const d = o.debord || 0;
      for (let i = 0; i < n; i += 1) {
        const a = pts[i], b = pts[(i + 1) % n], ha = haut[i], hb = haut[(i + 1) % n];
        const ea = [a[0] + (a[0] - cx) * d, a[1] + (a[1] - cz) * d], eb = [b[0] + (b[0] - cx) * d, b[1] + (b[1] - cz) * d];
        this.quad([ea[0], y1, ea[1]], [eb[0], y1, eb[1]], [hb[0], yh, hb[1]], [ha[0], yh, ha[1]], ct, mt);
      }
    }
    for (const [a, b, c] of trianguler(haut)) {
      this.triDessus([haut[a][0], yh, haut[a][1]], [haut[b][0], yh, haut[b][1]], [haut[c][0], yh, haut[c][1]], ct, mt);
    }
  };

  /* Verse un autre maillage dans celui-ci, là où l'on est placé (voir `placer`). */
  M.verser = function (autre) {
    const p = autre.pos, c = autre.cou, t = autre.uv;
    for (let i = 0; i < p.length; i += 9) {
      const k = (i / 3) * 4, j = (i / 3) * 2;
      this.tri([p[i], p[i + 1], p[i + 2]], [p[i + 3], p[i + 4], p[i + 5]], [p[i + 6], p[i + 7], p[i + 8]], [c[k], c[k + 1], c[k + 2]], c[k + 3],
        [[t[j], t[j + 1]], [t[j + 2], t[j + 3]], [t[j + 4], t[j + 5]]]);
    }
  };

  M.triangles = function () { return this.pos.length / 9; };

  /* ══════════════ Un peu d'algèbre ══════════════ */

  function perspective(ouverture, rapport, pres, loin) {
    const f = 1 / Math.tan(ouverture / 2);
    const m = new Float32Array(16);
    m[0] = f / rapport; m[5] = f; m[10] = (loin + pres) / (pres - loin); m[11] = -1; m[14] = 2 * loin * pres / (pres - loin);
    return m;
  }

  function regarder(oeil, dir) {
    // dir : unitaire. Le haut est la verticale.
    let sx = -dir[2], sz = dir[0];                       // dir × haut
    const sl = Math.hypot(sx, sz) || 1;
    sx /= sl; sz /= sl;
    const ux = -sz * dir[1], uy = sz * dir[0] - sx * dir[2], uz = sx * dir[1];   // s × dir
    const m = new Float32Array(16);
    m[0] = sx; m[4] = 0; m[8] = sz;
    m[1] = ux; m[5] = uy; m[9] = uz;
    m[2] = -dir[0]; m[6] = -dir[1]; m[10] = -dir[2];
    m[12] = -(sx * oeil[0] + sz * oeil[2]);
    m[13] = -(ux * oeil[0] + uy * oeil[1] + uz * oeil[2]);
    m[14] = dir[0] * oeil[0] + dir[1] * oeil[1] + dir[2] * oeil[2];
    m[15] = 1;
    return m;
  }

  function produit(a, b) {
    const m = new Float32Array(16);
    for (let c = 0; c < 4; c += 1) {
      for (let l = 0; l < 4; l += 1) {
        m[c * 4 + l] = a[l] * b[c * 4] + a[4 + l] * b[c * 4 + 1] + a[8 + l] * b[c * 4 + 2] + a[12 + l] * b[c * 4 + 3];
      }
    }
    return m;
  }

  /* ══════════════ La visionneuse ══════════════ */

  const SOMMETS = [
    'attribute vec3 aPos; attribute vec3 aNor; attribute vec4 aCou; attribute vec2 aUV;',
    'uniform mat4 uVue;',
    'varying vec3 vPos; varying vec3 vNor; varying vec3 vCou; varying float vMat; varying float vLoin; varying vec2 vUV;',
    'void main() {',
    '  vPos = aPos; vNor = aNor; vCou = aCou.rgb; vMat = aCou.a * 255.0; vUV = aUV;',
    '  gl_Position = uVue * vec4(aPos, 1.0);',
    '  vLoin = gl_Position.w;',
    '}',
  ].join('\n');

  const FRAGMENTS = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec3 uSoleil; uniform vec3 uLum; uniform vec3 uAmb; uniform vec3 uFond; uniform float uBrume; uniform float uVerre;',
    'uniform sampler2D uDecor; uniform float uImage;',
    'varying vec3 vPos; varying vec3 vNor; varying vec3 vCou; varying float vMat; varying float vLoin; varying vec2 vUV;',
    'float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float bruit(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }',
    'bool est(float m) { return abs(vMat - m) < 0.5; }',
    'void main() {',
    '  vec3 n = normalize(vNor);',
    '  vec3 an = abs(n);',
    '  vec2 uv = an.y > 0.7 ? vPos.xz : (an.x > an.z ? vPos.zy : vPos.xy);',
    '  vec3 c = vCou;',
    '  float eclaire = 1.0;',
    '  if (est(1.0)) {',                                   // moellon
    '    vec2 q = uv * vec2(2.4, 4.2); q.x += 0.5 * mod(floor(q.y), 2.0);',
    '    vec2 f = fract(q);',
    '    c *= 0.80 + 0.34 * h(floor(q));',
    '    c *= 1.0 - 0.22 * (1.0 - smoothstep(0.0, 0.10, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y))));',
    '  } else if (est(2.0)) {',                            // tuile canal
    '    vec3 t = normalize(cross(n, vec3(0.0, 1.0, 0.0)) + vec3(1e-4, 0.0, 0.0));',
    '    float s = dot(vPos, t) * 5.2;',
    '    float pente = length(vPos.xz) * 0.0 + vPos.y * 3.2;',
    '    c *= 0.74 + 0.26 * abs(sin(s * 3.14159)) ;',
    '    c *= 0.90 + 0.14 * h(vec2(floor(s), floor(pente)));',
    '  } else if (est(3.0)) {',                            // damier noir et blanc
    '    vec2 q = vec2(vPos.x + vPos.z, vPos.x - vPos.z) / 0.47;',
    '    float k = mod(floor(q.x) + floor(q.y), 2.0);',
    '    c = mix(vec3(0.13, 0.13, 0.15), vec3(0.86, 0.85, 0.80), k);',
    '  } else if (est(4.0)) {',                            // faux appareil peint
    '    vec2 q = uv * vec2(1.7, 3.2); q.x += 0.5 * mod(floor(q.y), 2.0);',
    '    vec2 f = fract(q);',
    '    float joint = 1.0 - smoothstep(0.0, 0.035, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));',
    '    c = mix(c * (0.95 + 0.08 * h(floor(q))), vec3(0.62, 0.33, 0.27), 0.55 * joint);',
    '  } else if (est(5.0)) {',                            // ciel semé d\'étoiles
    '    vec2 q = vec2(atan(vPos.z, vPos.x - 15.6) * 2.5, vPos.y) * 3.4;',
    '    vec2 f = fract(q) - 0.5;',
    '    float o = h(floor(q));',
    '    c = mix(c, vec3(0.95, 0.80, 0.36), step(0.55, o) * (1.0 - smoothstep(0.05, 0.10, length(f))));',
    '  } else if (est(6.0)) {',                            // bois : des lames
    '    float lame = fract((an.y > 0.7 ? vPos.x : (an.x > an.z ? vPos.z : vPos.x)) * 7.0);',
    '    c *= 0.86 + 0.14 * bruit(uv * vec2(9.0, 1.5));',
    '    c *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.08, min(lame, 1.0 - lame)));',
    '  } else if (est(7.0)) {',                            // vitrail
    '    vec2 q = uv * 7.0; vec2 f = fract(q); float o = h(floor(q));',
    '    vec3 v = o < 0.34 ? vec3(0.20, 0.42, 0.85) : (o < 0.58 ? vec3(0.80, 0.22, 0.20) : (o < 0.80 ? vec3(0.93, 0.76, 0.28) : vec3(0.25, 0.62, 0.42)));',
    '    v = mix(v, vCou, 0.35);',
    '    v *= 1.0 - 0.75 * (1.0 - smoothstep(0.0, 0.09, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y))));',
    '    c = v * uVerre; eclaire = 0.0;',
    '  } else if (est(8.0)) {',                            // le sol du dehors
    '    c *= 0.82 + 0.30 * bruit(vPos.xz * 1.3) + 0.08 * bruit(vPos.xz * 7.0);',
    '  } else if (est(9.0)) {',                            // bandes peintes à médaillons
    '    vec2 q = (an.y > 0.7 ? vPos.xz : vec2(vPos.y, an.x > an.z ? vPos.z : vPos.x)) * 2.1;',
    '    float d = length(fract(q) - 0.5);',
    '    float rond = 1.0 - smoothstep(0.26, 0.31, d);',
    '    float coeur = 1.0 - smoothstep(0.08, 0.12, d);',
    '    c = mix(c, vec3(0.33, 0.40, 0.66), 0.75 * rond);',
    '    c = mix(c, vec3(0.86, 0.72, 0.36), coeur);',
    '  } else if (est(10.0)) {',                           // dalles de pierre
    '    vec2 q = vPos.xz * vec2(1.5, 2.1); q.x += 0.5 * mod(floor(q.y), 2.0); vec2 f = fract(q);',
    '    c *= 0.88 + 0.18 * h(floor(q));',
    '    c *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.04, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y))));',
    '  } else if (est(11.0)) {',                           // une photographie : elle porte déjà sa lumière
    '    if (uImage > 0.5) c = texture2D(uDecor, vUV).rgb;',
    '    eclaire = 0.45;',
    '  } else if (est(12.0)) {',                           // un vitrail photographié
    '    if (uImage > 0.5) c = texture2D(uDecor, vUV).rgb * 1.2;',
    '    c *= uVerre; eclaire = 0.0;',
    '  }',
    '  float d = max(dot(n, uSoleil), 0.0);',
    '  vec3 ciel = uAmb * (0.72 + 0.28 * n.y);',
    '  vec3 lum = ciel + uLum * d;',
    '  vec3 couleur = mix(c, c * lum, eclaire);',
    '  float brume = 1.0 - exp(-vLoin * uBrume);',
    '  gl_FragColor = vec4(mix(couleur, uFond, brume), 1.0);',
    '}',
  ].join('\n');

  const AMBIANCES = {
    jour: { soleil: [0.45, 0.78, 0.44], lum: [0.62, 0.58, 0.50], amb: [0.62, 0.64, 0.68], fond: [0.78, 0.86, 0.93], verre: 1.15 },
    aube: { soleil: [0.80, 0.30, 0.52], lum: [0.66, 0.48, 0.36], amb: [0.52, 0.50, 0.56], fond: [0.90, 0.80, 0.74], verre: 1.0 },
    soir: { soleil: [-0.78, 0.30, 0.55], lum: [0.72, 0.44, 0.26], amb: [0.48, 0.44, 0.50], fond: [0.88, 0.66, 0.52], verre: 0.9 },
    nuit: { soleil: [-0.30, 0.80, 0.52], lum: [0.16, 0.19, 0.30], amb: [0.22, 0.25, 0.36], fond: [0.05, 0.07, 0.14], verre: 0.45 },
  };

  function el(balise, classe, texte) {
    const n = document.createElement(balise);
    if (classe) n.className = classe;
    if (texte !== undefined && texte !== null) n.textContent = texte;
    return n;
  }

  function mouvementReduit() {
    return !!(racine.matchMedia && racine.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /*
   * Pose la maquette dans `cadre`. Options :
   *   modele    — ce que rend `Eglise.construire(annee)` (ou tout objet de même forme ;
   *               son champ `image`, s'il en a un, est l'image du décor, cherchée
   *               depuis la racine du site) ;
   *   construire(annee) — à défaut de `modele`, de quoi le rebâtir quand l'époque change ;
   *   annee, epoques [{ annee, nom }] — l'état montré, et ceux qu'on peut choisir ;
   *   vue       — le nom d'un point de vue du modèle ;
   *   ambiance  — jour, aube, soir, nuit ;
   *   textes: false — ne montrer que le nom des repères, pas leur notice ;
   *   surMaquette(nom) — si présent, un repère qui mène à une autre maquette le propose ;
   *   surFiche(id) — si présent, la carte d'un repère propose d'ouvrir sa fiche ;
   *   libelleFiche — le texte de ce bouton.
   * Rend { detruire, regler({ annee, vue, ambiance }), voir(nomDeVue) }.
   */
  function poser(cadre, options) {
    const o = options || {};
    cadre.textContent = '';
    cadre.classList.add('mq');
    const toile = el('canvas', 'mq-toile');
    toile.setAttribute('role', 'img');
    toile.setAttribute('aria-label', o.titre || 'Maquette en trois dimensions');
    toile.tabIndex = 0;
    cadre.appendChild(toile);
    const calque = el('div', 'mq-calque');
    cadre.appendChild(calque);
    const barre = el('div', 'mq-barre');
    cadre.appendChild(barre);
    const carte = el('div', 'mq-carte');
    carte.hidden = true;
    cadre.appendChild(carte);

    const gl = toile.getContext('webgl', { antialias: true, alpha: false }) || toile.getContext('experimental-webgl');
    if (!gl) {
      cadre.appendChild(el('p', 'mq-sans', 'Cet appareil ne sait pas dessiner en trois dimensions (WebGL absent).'));
      return { detruire() { cadre.textContent = ''; cadre.classList.remove('mq'); }, regler() {}, voir() {} };
    }

    function compiler(type, source) {
      const s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, compiler(gl.VERTEX_SHADER, SOMMETS));
    gl.attachShader(prog, compiler(gl.FRAGMENT_SHADER, FRAGMENTS));
    gl.bindAttribLocation(prog, 0, 'aPos');
    gl.bindAttribLocation(prog, 1, 'aNor');
    gl.bindAttribLocation(prog, 2, 'aCou');
    gl.bindAttribLocation(prog, 3, 'aUV');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const U = {};
    for (const nom of ['uVue', 'uSoleil', 'uLum', 'uAmb', 'uFond', 'uBrume', 'uVerre', 'uDecor', 'uImage']) U[nom] = gl.getUniformLocation(prog, nom);
    gl.uniform1i(U.uDecor, 0);
    gl.uniform1f(U.uImage, 0);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    let modele = null;
    let tampons = {};
    let annee = o.annee || 2026;
    let ambiance = AMBIANCES[o.ambiance] ? o.ambiance : 'jour';
    let mode = 'dehors';
    let creuse = false;   // le sol est ôté : on voit ce qu'il y a dessous
    let detruit = false;
    let sale = true;
    let choisi = null;
    const cam = { cible: [8, 3, 0], lacet: 0, tangage: 20, dist: 40, ouverture: 48 };
    let vol = null;       // un déplacement de caméra en cours
    let matrice = null;
    let reperes = [];

    /* L'échelle de ce qu'on montre : une église ou un village n'ont ni le même
     * recul, ni le même lointain, ni la même brume. */
    let ech = { distMax: 90, loin: 400, brume: 0.0035, vitesse: 2.4 };

    /* À pied, les yeux suivent le sol quand la maquette a du relief. */
    function poserLesPieds() {
      if (cam.dist < 1 && modele.sol && mode === 'dehors') cam.cible[1] = modele.sol(cam.cible[0], cam.cible[2]) + 1.65;
    }

    /* L'image du décor (les photographies plaquées) : elle arrive quand elle
     * peut ; d'ici là, et si elle manque, chaque morceau garde sa couleur moyenne. */
    let decor = null;
    function chargerDecor(adresse) {
      if (!adresse || decor === adresse) return;
      decor = adresse;
      const image = new Image();
      image.onload = () => {
        if (detruit || decor !== adresse) return;
        const t = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, t);
        try {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
        } catch (erreur) { return; }
        const deux = (n) => (n & (n - 1)) === 0;
        if (deux(image.width) && deux(image.height)) {
          gl.generateMipmap(gl.TEXTURE_2D);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        } else {
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.uniform1f(U.uImage, 1);
        sale = true;
      };
      image.src = ICI ? new URL(adresse, new URL('..', ICI)).href : adresse;
    }

    function charger(m) {
      ech = Object.assign({ distMax: 90, loin: 400, brume: 0.0035, vitesse: 2.4 }, m.echelle || {});
      chargerDecor(m.image);
      for (const nom of Object.keys(tampons)) {
        gl.deleteBuffer(tampons[nom].pos); gl.deleteBuffer(tampons[nom].nor); gl.deleteBuffer(tampons[nom].cou); gl.deleteBuffer(tampons[nom].uv);
      }
      tampons = {};
      modele = m;
      for (const nom of Object.keys(m.groupes)) {
        const g = m.groupes[nom];
        const t = { n: g.pos.length / 3 };
        t.pos = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, t.pos); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(g.pos), gl.STATIC_DRAW);
        t.nor = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, t.nor); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(g.nor), gl.STATIC_DRAW);
        t.cou = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, t.cou); gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(g.cou), gl.STATIC_DRAW);
        t.uv = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, t.uv); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(g.uv), gl.STATIC_DRAW);
        tampons[nom] = t;
      }
      poserReperes();
      sale = true;
    }

    /* ── les repères : des boutons posés sur la toile ── */

    function poserReperes() {
      calque.textContent = '';
      reperes = [];
      for (const r of modele.reperes) {
        const b = el('button', 'mq-repere');
        b.type = 'button';
        b.appendChild(el('span', 'mq-point'));
        b.appendChild(el('span', 'mq-nom', r.nom));
        b.addEventListener('click', () => choisir(r));
        calque.appendChild(b);
        reperes.push({ r, b });
      }
      fermerCarte();
    }

    function fermerCarte() {
      choisi = null;
      carte.hidden = true;
      cadre.classList.remove('mq-carte-ouverte');
      carte.textContent = '';
      for (const x of reperes) x.b.classList.remove('choisi');
    }

    function choisir(r) {
      choisi = r;
      for (const x of reperes) x.b.classList.toggle('choisi', x.r === r);
      carte.textContent = '';
      const tete = el('div', 'mq-carte-tete');
      tete.appendChild(el('p', 'mq-carte-nom', r.nom));
      const fermer = el('button', 'mq-fermer', '✕');
      fermer.type = 'button';
      fermer.setAttribute('aria-label', 'Fermer');
      fermer.addEventListener('click', fermerCarte);
      tete.appendChild(fermer);
      carte.appendChild(tete);
      if (r.texte && o.textes !== false) carte.appendChild(el('p', 'mq-carte-texte', r.texte));
      const boutons = el('div', 'mq-carte-boutons');
      if (r.vue) {
        const b = el('button', 'mq-bouton', 'S’en approcher');
        b.type = 'button';
        b.addEventListener('click', () => voler(r.vue));
        boutons.appendChild(b);
      }
      if (r.maquette && o.surMaquette) {
        const b = el('button', 'mq-bouton', r.libelleMaquette || 'Y entrer');
        b.type = 'button';
        b.addEventListener('click', () => o.surMaquette(r.maquette));
        boutons.appendChild(b);
      }
      if (r.fiche && o.surFiche) {
        const b = el('button', 'mq-bouton fort', o.libelleFiche || 'Lire la fiche');
        b.type = 'button';
        b.addEventListener('click', () => o.surFiche(r.fiche));
        boutons.appendChild(b);
      }
      if (boutons.childNodes.length) carte.appendChild(boutons);
      carte.hidden = false;
      cadre.classList.add('mq-carte-ouverte');
    }

    /* ── la barre : dehors ou dedans, les points de vue, les époques ── */

    const bMode = {};
    const groupeMode = el('div', 'mq-groupe');
    for (const [id, nom] of [['dehors', 'Dehors'], ['dedans', 'Dedans']]) {
      const b = el('button', 'mq-pastille', nom);
      b.type = 'button';
      b.addEventListener('click', () => voler(id === 'dehors' ? 'ensemble' : 'coupe'));
      bMode[id] = b;
      groupeMode.appendChild(b);
    }
    barre.appendChild(groupeMode);
    const groupeVues = el('div', 'mq-groupe mq-vues');
    barre.appendChild(groupeVues);
    const groupeEpoques = el('div', 'mq-groupe mq-epoques');
    barre.appendChild(groupeEpoques);

    function ecrireBarre() {
      for (const id of Object.keys(bMode)) bMode[id].setAttribute('aria-pressed', id === mode ? 'true' : 'false');
      groupeMode.hidden = !modele.vues.coupe;       // une maquette sans dedans n'a pas à le proposer
      groupeVues.textContent = '';
      for (const nom of Object.keys(modele.vues)) {
        const v = modele.vues[nom];
        if (!v.nom || v.mode !== mode) continue;
        const b = el('button', 'mq-pastille fine', v.nom);
        b.type = 'button';
        b.addEventListener('click', () => voler(nom));
        groupeVues.appendChild(b);
      }
      groupeEpoques.textContent = '';
      if (o.epoques && o.epoques.length > 1 && o.construire) {
        for (const e of o.epoques) {
          const b = el('button', 'mq-pastille fine', e.nom);
          b.type = 'button';
          b.setAttribute('aria-pressed', e.annee === annee ? 'true' : 'false');
          b.addEventListener('click', () => regler({ annee: e.annee }));
          groupeEpoques.appendChild(b);
        }
      }
    }

    /* ── la caméra ── */

    function direction(lacet, tangage) {
      const a = lacet * Math.PI / 180, t = tangage * Math.PI / 180;
      return [Math.cos(t) * Math.cos(a), -Math.sin(t), Math.cos(t) * Math.sin(a)];
    }

    function appliquerVue(v) {
      cam.cible = v.cible.slice(); cam.lacet = v.lacet; cam.tangage = v.tangage; cam.dist = v.dist; cam.ouverture = v.ouverture || 48;
      if (v.mode && v.mode !== mode) { mode = v.mode; ecrireBarre(); }
      creuse = Boolean(v.creuse);
      sale = true;
    }

    function voler(nom) {
      const v = modele.vues[nom];
      if (!v) return;
      if (mouvementReduit()) { vol = null; appliquerVue(v); return; }
      // au plus court : on ne fait pas trois quarts de tour pour un quart
      let lacet = v.lacet;
      while (lacet - cam.lacet > 180) lacet -= 360;
      while (lacet - cam.lacet < -180) lacet += 360;
      const changeDeMode = v.mode && v.mode !== mode;
      vol = {
        de: { cible: cam.cible.slice(), lacet: cam.lacet, tangage: cam.tangage, dist: cam.dist, ouverture: cam.ouverture },
        a: { cible: v.cible, lacet, tangage: v.tangage, dist: v.dist, ouverture: v.ouverture || 48 },
        t0: performance.now(), duree: 1100, mode: changeDeMode ? v.mode : null, creuse: Boolean(v.creuse),
      };
      if (!vol.creuse) creuse = false;      // le sol revient tout de suite ; il ne s'ôte qu'à mi-chemin
      sale = true;
    }

    function avancerVol(maintenant) {
      if (!vol) return;
      let k = Math.min(1, (maintenant - vol.t0) / vol.duree);
      if (vol.mode && k > 0.5) { mode = vol.mode; vol.mode = null; ecrireBarre(); }
      if (vol.creuse && k > 0.5) creuse = true;
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const m = (a, b) => a + (b - a) * e;
      cam.cible = [0, 1, 2].map((i) => m(vol.de.cible[i], vol.a.cible[i]));
      cam.lacet = m(vol.de.lacet, vol.a.lacet);
      cam.tangage = m(vol.de.tangage, vol.a.tangage);
      cam.dist = m(vol.de.dist, vol.a.dist);
      cam.ouverture = m(vol.de.ouverture, vol.a.ouverture);
      if (k >= 1) vol = null;
      sale = true;
    }

    function borner() {
      cam.tangage = Math.max(-35, Math.min(89, cam.tangage));
      cam.dist = Math.max(0.02, Math.min(ech.distMax, cam.dist));
      const b = modele.bornes;
      cam.cible[0] = Math.max(b[0], Math.min(b[3], cam.cible[0]));
      cam.cible[1] = Math.max(creuse || modele.sol ? b[1] : 0.3, Math.min(b[4], cam.cible[1]));
      cam.cible[2] = Math.max(b[2], Math.min(b[5], cam.cible[2]));
    }

    /* ── le dessin ── */

    function dessiner() {
      const l = Math.max(1, Math.round(cadre.clientWidth)), h = Math.max(1, Math.round(cadre.clientHeight));
      const dpr = Math.min(2, racine.devicePixelRatio || 1);
      if (toile.width !== Math.round(l * dpr) || toile.height !== Math.round(h * dpr)) {
        toile.width = Math.round(l * dpr); toile.height = Math.round(h * dpr);
      }
      gl.viewport(0, 0, toile.width, toile.height);
      const A = AMBIANCES[ambiance];
      const dedans = mode === 'dedans';
      const fond = dedans ? [A.fond[0] * 0.35, A.fond[1] * 0.35, A.fond[2] * 0.38] : A.fond;
      gl.clearColor(fond[0], fond[1], fond[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      borner();
      const dir = direction(cam.lacet, cam.tangage);
      const oeil = [cam.cible[0] - dir[0] * cam.dist, cam.cible[1] - dir[1] * cam.dist, cam.cible[2] - dir[2] * cam.dist];
      const pres = Math.max(0.05, Math.min(ech.loin / 400, cam.dist * 0.05));
      matrice = produit(perspective(cam.ouverture * Math.PI / 180, l / h, pres, ech.loin), regarder(oeil, dir));
      gl.uniformMatrix4fv(U.uVue, false, matrice);
      const sl = Math.hypot(A.soleil[0], A.soleil[1], A.soleil[2]);
      gl.uniform3f(U.uSoleil, A.soleil[0] / sl, A.soleil[1] / sl, A.soleil[2] / sl);
      gl.uniform3fv(U.uFond, fond);
      gl.uniform1f(U.uVerre, A.verre);
      gl.uniform1f(U.uBrume, dedans ? 0.0 : ech.brume);

      for (const nom of Object.keys(tampons)) {
        const g = modele.groupes[nom];
        if (dedans ? !g.dedans : g.dedans === 'seul') continue;
        // un groupe peut ne paraître que le sol ôté (`si`), ou disparaître avec lui (`sauf`)
        if ((g.si === 'creuse' && !creuse) || (g.sauf === 'creuse' && creuse)) continue;
        // dedans, la lumière vient de partout : on y voit comme sous des lampes
        if (g.interieur) { gl.uniform3f(U.uLum, 0.30, 0.28, 0.24); gl.uniform3f(U.uAmb, A.amb[0] * 1.25 + 0.12, A.amb[1] * 1.22 + 0.10, A.amb[2] * 1.12 + 0.06); }
        else { gl.uniform3fv(U.uLum, A.lum); gl.uniform3fv(U.uAmb, A.amb); }
        const t = tampons[nom];
        gl.bindBuffer(gl.ARRAY_BUFFER, t.pos); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, t.nor); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, t.cou); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, t.uv); gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, t.n);
      }

      // les repères suivent
      for (const x of reperes) {
        const p = x.r.p;
        const w = matrice[3] * p[0] + matrice[7] * p[1] + matrice[11] * p[2] + matrice[15];
        let visible = w > 0.15 && (x.r.ou === 'partout' || x.r.ou === mode)
          // le sol ôté, on ne nomme que ce qui est dessous (et ce qui s'y rapporte)
          && (creuse ? Boolean(x.r.si || x.r.aussiCreuse) : !x.r.si);
        let sx = 0, sy = 0;
        if (visible) {
          sx = (matrice[0] * p[0] + matrice[4] * p[1] + matrice[8] * p[2] + matrice[12]) / w;
          sy = (matrice[1] * p[0] + matrice[5] * p[1] + matrice[9] * p[2] + matrice[13]) / w;
          visible = Math.abs(sx) < 0.97 && sy > -0.80 && sy < 0.84;
          // un repère tourné de l'autre côté du mur ne se montre pas
          if (visible && x.r.n) visible = (x.r.n[0] * (oeil[0] - p[0]) + x.r.n[1] * (oeil[2] - p[2])) > 0;
        }
        x.b.hidden = !visible;
        if (visible) {
          x.b.style.transform = 'translate(' + ((sx * 0.5 + 0.5) * l).toFixed(1) + 'px,' + ((0.5 - sy * 0.5) * h).toFixed(1) + 'px)';
          x.b.classList.toggle('loin', w > (dedans ? 26 : ech.distMax * 0.67));
        }
      }
    }

    /* ── marcher : avancer, reculer, tourner, tant qu'on tient la touche ou le bouton ── */

    const pas = { av: 0, rot: 0 };       // −1, 0 ou 1 chacun
    let avant = 0;

    function marcher(dt) {
      if (!pas.av && !pas.rot) return;
      vol = null;
      const aPied = cam.dist < 1;
      cam.lacet += pas.rot * (aPied ? 75 : 60) * dt;
      if (pas.av) {
        if (aPied) {
          const a = cam.lacet * Math.PI / 180;
          let x = cam.cible[0] + Math.cos(a) * pas.av * ech.vitesse * dt;
          let z = cam.cible[2] + Math.sin(a) * pas.av * ech.vitesse * dt;
          // dedans, les murs arrêtent : la maquette dit où l'on peut poser le pied
          if (mode === 'dedans' && modele.marche) [x, z] = modele.marche(x, z, cam.cible[0], cam.cible[2]);
          cam.cible[0] = x; cam.cible[2] = z;
          poserLesPieds();
        } else {
          cam.dist *= Math.exp(-pas.av * 1.1 * dt);
        }
      }
      sale = true;
    }

    const manette = el('div', 'mq-manette');
    const touches = [
      ['mq-gauche', '↶', 'Tourner à gauche', 0, -1], ['mq-avant', '▲', 'Avancer', 1, 0],
      ['mq-droite', '↷', 'Tourner à droite', 0, 1], ['mq-arriere', '▼', 'Reculer', -1, 0],
    ];
    for (const [classe, signe, nom, av, rot] of touches) {
      const b = el('button', 'mq-touche ' + classe, signe);
      b.type = 'button';
      b.setAttribute('aria-label', nom);
      b.title = nom;
      const tenir = (e) => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (erreur) { /* pas de pointeur à retenir */ } pas.av = av; pas.rot = rot; b.classList.add('tenue'); };
      const lacherTouche = () => { if (pas.av === av && pas.rot === rot) { pas.av = 0; pas.rot = 0; } b.classList.remove('tenue'); };
      b.addEventListener('pointerdown', tenir);
      b.addEventListener('pointerup', lacherTouche);
      b.addEventListener('pointercancel', lacherTouche);
      b.addEventListener('lostpointercapture', lacherTouche);
      // au clavier (Entrée, Espace) : un pas à la fois
      b.addEventListener('click', (e) => { if (e.detail === 0) { pas.av = av; pas.rot = rot; marcher(0.25); pas.av = 0; pas.rot = 0; } });
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      manette.appendChild(b);
    }
    cadre.appendChild(manette);

    let image = 0;
    function boucle(maintenant) {
      if (detruit) return;
      marcher(Math.min(0.05, Math.max(0, (maintenant - avant) / 1000)));
      avant = maintenant;
      avancerVol(maintenant);
      if (sale) { sale = false; dessiner(); }
      image = racine.requestAnimationFrame(boucle);
    }

    /* ── les gestes ── */

    const doigts = new Map();
    let ecart = 0;
    let bouge = false;

    function tourner(dx, dy) {
      const k = cam.dist < 1 ? 0.16 : 0.32;      // au milieu de la nef, on tourne la tête : plus doux
      cam.lacet += (cam.dist < 1 ? -dx : dx) * k;
      cam.tangage += (cam.dist < 1 ? -dy : dy) * k;
      sale = true;
    }

    function glisser(dx, dy) {
      const a = cam.lacet * Math.PI / 180;
      const k = Math.max(0.004, cam.dist * 0.0016);
      cam.cible[0] += (Math.sin(a) * dx - Math.cos(a) * dy * 0) * k;
      cam.cible[2] += (-Math.cos(a) * dx) * k;
      cam.cible[1] += dy * k;
      sale = true;
    }

    function zoomer(facteur) {
      if (cam.dist < 1) {
        // dedans, à hauteur d'homme : on avance ou on recule
        const a = cam.lacet * Math.PI / 180;
        const pas = (1 - facteur) * 6;
        let x = cam.cible[0] + Math.cos(a) * pas, z = cam.cible[2] + Math.sin(a) * pas;
        if (mode === 'dedans' && modele.marche) [x, z] = modele.marche(x, z, cam.cible[0], cam.cible[2]);
        cam.cible[0] = x; cam.cible[2] = z;
        poserLesPieds();
      } else {
        cam.dist *= facteur;
      }
      sale = true;
    }

    toile.addEventListener('pointerdown', (e) => {
      toile.setPointerCapture(e.pointerId);
      doigts.set(e.pointerId, [e.clientX, e.clientY]);
      bouge = false;
      vol = null;
      if (doigts.size === 2) { const p = Array.from(doigts.values()); ecart = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]); }
    });
    toile.addEventListener('pointermove', (e) => {
      const avant = doigts.get(e.pointerId);
      if (!avant) return;
      const dx = e.clientX - avant[0], dy = e.clientY - avant[1];
      doigts.set(e.pointerId, [e.clientX, e.clientY]);
      if (Math.abs(dx) + Math.abs(dy) > 2) bouge = true;
      if (doigts.size === 1) {
        if (e.shiftKey || e.buttons === 2) glisser(dx, dy); else tourner(dx, dy);
      } else if (doigts.size === 2) {
        const p = Array.from(doigts.values());
        const d = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]);
        if (ecart > 0 && d > 0) zoomer(ecart / d);
        ecart = d;
        glisser(dx / 2, dy / 2);
      }
    });
    const lacher = (e) => {
      doigts.delete(e.pointerId);
      ecart = 0;
      if (!bouge && e.type === 'pointerup' && choisi) fermerCarte();
    };
    toile.addEventListener('pointerup', lacher);
    toile.addEventListener('pointercancel', lacher);
    toile.addEventListener('contextmenu', (e) => e.preventDefault());
    toile.addEventListener('wheel', (e) => {
      e.preventDefault();
      vol = null;
      zoomer(Math.exp(Math.max(-1, Math.min(1, e.deltaY / 240)) * 0.35));
    }, { passive: false });
    /* Au clavier : les flèches (ou ZQSD, WASD) font avancer, reculer et tourner
     * tant qu'on les tient ; PagePréc. et PageSuiv. lèvent et baissent les yeux. */
    const CLAVIER = {
      ArrowUp: [1, 0], z: [1, 0], w: [1, 0], ArrowDown: [-1, 0], s: [-1, 0],
      ArrowLeft: [0, -1], q: [0, -1], a: [0, -1], ArrowRight: [0, 1], d: [0, 1],
    };
    const tenues = new Set();
    const relire = () => {
      pas.av = 0; pas.rot = 0;
      for (const k of tenues) { pas.av += CLAVIER[k][0]; pas.rot += CLAVIER[k][1]; }
      pas.av = Math.sign(pas.av); pas.rot = Math.sign(pas.rot);
    };
    toile.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (CLAVIER[k]) { tenues.add(k); relire(); }
      else if (k === 'PageUp') { cam.tangage -= 6; sale = true; }
      else if (k === 'PageDown') { cam.tangage += 6; sale = true; }
      else if (k === '+' || k === '=') zoomer(0.85);
      else if (k === '-') zoomer(1.18);
      else return;
      vol = null;
      e.preventDefault();
    });
    toile.addEventListener('keyup', (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (tenues.delete(k)) relire();
    });
    toile.addEventListener('blur', () => { tenues.clear(); relire(); });

    const surTaille = () => { sale = true; };
    let observateur = null;
    if (racine.ResizeObserver) { observateur = new ResizeObserver(surTaille); observateur.observe(cadre); }
    racine.addEventListener('resize', surTaille);
    toile.addEventListener('webglcontextlost', (e) => e.preventDefault());

    function regler(r) {
      if (r.ambiance && AMBIANCES[r.ambiance]) { ambiance = r.ambiance; sale = true; }
      if (r.annee && r.annee !== annee && o.construire) {
        annee = r.annee;
        charger(o.construire(annee));
        ecrireBarre();
      }
      if (r.vue) voler(r.vue);
    }

    charger(o.modele || o.construire(annee));
    appliquerVue(modele.vues[o.vue] || modele.vues.ensemble);
    ecrireBarre();
    image = racine.requestAnimationFrame(boucle);

    return {
      regler,
      voir: voler,
      detruire() {
        detruit = true;
        racine.cancelAnimationFrame(image);
        racine.removeEventListener('resize', surTaille);
        if (observateur) observateur.disconnect();
        const perte = gl.getExtension('WEBGL_lose_context');
        if (perte) perte.loseContext();
        cadre.textContent = '';
        cadre.classList.remove('mq');
      },
    };
  }

  racine.Maquette = { Maillage, MATIERES, AMBIANCES, poser, teinte };

})(typeof window !== 'undefined' ? window : globalThis);
