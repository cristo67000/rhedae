'use strict';
/*
 * L'onglet « Carte » : la carte, ses trois cadres, le lieu choisi, la liste.
 *
 * La carte elle-même est dans js/carte.js. Ici : les boutons des cadres (la
 * région, le Haut-Razès, le village), le filtre par genre de lieu, la carte de
 * visite du point touché — son nom, sa définition, « Lire la fiche » —, et la
 * liste de tous les lieux, rangés du village vers le lointain. « Me situer »,
 * facultatif, pose un point bleu : la position reste dans l'appareil.
 */
(function (racine) {

  const { element, bouton } = Outils;
  let carte = null;
  let type = null;
  let surveillance = null;

  function lieux() { return Dossier.de('lieux'); }

  function dessinerCadres(actif) {
    const zone = document.getElementById('carte-cadres');
    zone.textContent = '';
    for (const id of ['region', 'razes', 'village']) {
      const b = bouton(null, Carte.CADRES[id].nom, () => { carte.choisir(null); carte.cadrer(id, true); });
      b.setAttribute('aria-pressed', id === actif ? 'true' : 'false');
      b.setAttribute('data-cadre', id);
      zone.appendChild(b);
    }
    const moi = bouton('bouton-situer', '◎', situer);
    moi.setAttribute('aria-label', 'Me situer sur la carte');
    moi.title = 'Me situer';
    zone.appendChild(moi);
  }

  function allumerCadre(actif) {
    for (const b of document.querySelectorAll('#carte-cadres [data-cadre]')) {
      b.setAttribute('aria-pressed', b.getAttribute('data-cadre') === actif ? 'true' : 'false');
    }
  }

  function dessinerTypes() {
    const zone = document.getElementById('carte-types');
    zone.textContent = '';
    const presents = new Map();
    for (const a of lieux()) presents.set(a.ty, (presents.get(a.ty) || 0) + 1);
    zone.appendChild(bouton('filtre' + (type ? '' : ' actif'), 'Tous les lieux', () => choisirType(null)));
    for (const [t, n] of Array.from(presents).sort((x, y) => y[1] - x[1])) {
      const f = bouton('filtre cat-lieux' + (type === t ? ' actif' : ''), null, () => choisirType(type === t ? null : t));
      f.appendChild(Carte.signe(t, 'signe-filtre'));
      f.appendChild(document.createTextNode(Carte.NOMS_TYPES[t] || t));
      f.appendChild(element('span', 'nombre-filtre', String(n)));
      zone.appendChild(f);
    }
  }

  function choisirType(t) {
    type = t;
    carte.filtrer(t ? (a) => a.ty === t : null);
    dessinerTypes();
    dessinerListe();
  }

  /* La carte de visite du lieu touché. */
  function dessinerChoix(a) {
    const zone = document.getElementById('carte-choix');
    zone.textContent = '';
    zone.hidden = !a;
    if (!a) return;
    const tete = element('div', 'choix-tete');
    tete.appendChild(Carte.signe(a.ty, 'signe-choix'));
    const titre = element('div', 'choix-titre');
    titre.appendChild(element('p', 'choix-nom', a.n));
    titre.appendChild(element('p', 'choix-lieu', a.li));
    tete.appendChild(titre);
    const fermer = bouton('bouton-rond', '✕', () => carte.choisir(null));
    fermer.setAttribute('aria-label', 'Fermer');
    tete.appendChild(fermer);
    zone.appendChild(tete);
    zone.appendChild(Rendu.paragraphe(a.df, 'choix-def'));
    const boutons = element('div', 'ligne-boutons');
    boutons.appendChild(bouton('bouton-principal', 'Lire la fiche', () => Fiche.ouvrir(a.id)));
    const itineraire = element('a', 'bouton-discret', 'Itinéraire');
    itineraire.href = 'https://www.google.com/maps/dir/?api=1&destination=' + a.geo[0] + ',' + a.geo[1];
    itineraire.target = '_blank';
    itineraire.rel = 'noopener noreferrer';
    boutons.appendChild(itineraire);
    zone.appendChild(boutons);
  }

  function dessinerListe() {
    const zone = document.getElementById('carte-liste');
    zone.textContent = '';
    const tous = lieux().filter((a) => !type || a.ty === type);
    document.getElementById('carte-compte').textContent = Outils.pluriel(tous.length, 'lieu', 'lieux') + (type ? '' : ', du village vers le lointain');
    for (const g of Dossier.groupes.lieux) {
      const membres = tous.filter((a) => a.g === g.id).sort(Dossier.comparer);
      if (!membres.length) continue;
      zone.appendChild(element('h4', 'lettre', g.nom));
      const groupe = element('div', 'groupe');
      for (const a of membres) {
        const l = bouton('article-ligne cat-lieux', null, () => {
          if (a.ec === 'ailleurs') { Fiche.ouvrir(a.id); return; }
          montrer(a.id);
          document.getElementById('carte-cadres').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        const tete = element('span', 'article-ligne-tete');
        tete.appendChild(Carte.signe(a.ty, 'signe-ligne'));
        tete.appendChild(element('span', 'article-mot', a.n));
        l.appendChild(tete);
        l.appendChild(element('span', 'apercu', Dossier.nu(a.df)));
        groupe.appendChild(l);
      }
      zone.appendChild(groupe);
    }
  }

  function montrer(id) {
    const a = Dossier.parId(id);
    if (!a || !carte) return;
    if (type && a.ty !== type) choisirType(null);
    carte.montrer(a, true);
  }

  /* « Me situer » : un point bleu, tant que l'onglet est ouvert. Rien ne quitte l'appareil. */
  function situer() {
    if (!('geolocation' in racine.navigator)) { Outils.annoncer('Cet appareil ne donne pas sa position.'); return; }
    if (surveillance !== null) { arreterPosition(); Outils.annoncer('Position masquée.'); return; }
    let premiere = true;
    surveillance = racine.navigator.geolocation.watchPosition((p) => {
      const ici = { lon: p.coords.longitude, lat: p.coords.latitude };
      const dans = ici.lon > 1.5 && ici.lon < 3.12 && ici.lat > 42.52 && ici.lat < 43.36;
      if (!dans) {
        arreterPosition();
        const rennes = Dossier.parId('rennes-le-chateau');
        const km = rennes ? Math.round(Carte.distance(rennes.geo, [ici.lat, ici.lon])) : null;
        Outils.annoncer('Vous êtes hors de la carte' + (km ? ' : à ' + km.toLocaleString('fr-FR') + ' km de Rennes-le-Château.' : '.'));
        return;
      }
      carte.situer(ici);
      if (premiere) { premiere = false; carte.allerA({ lon: ici.lon, lat: ici.lat, k: 9000 }, true); }
    }, () => {
      arreterPosition();
      Outils.annoncer('La position n’a pas été donnée.');
    }, { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 });
    document.querySelector('.bouton-situer').classList.add('actif');
  }

  function arreterPosition() {
    if (surveillance !== null) racine.navigator.geolocation.clearWatch(surveillance);
    surveillance = null;
    if (carte) carte.situer(null);
    const b = document.querySelector('.bouton-situer');
    if (b) b.classList.remove('actif');
  }

  function creer() {
    if (carte) { carte.redessiner(); return; }
    dessinerCadres('razes');
    carte = Carte.creer(document.getElementById('carte-cadre'), {
      cadre: 'razes',
      surChoix: dessinerChoix,
      surMouvement: allumerCadre,
    });
    dessinerTypes();
    dessinerListe();
  }

  function brancher() {
    document.addEventListener('vue-changee', () => { if (App.vue !== 'carte') arreterPosition(); });
  }

  racine.Lieux = { brancher, creer, montrer };

})(window);
