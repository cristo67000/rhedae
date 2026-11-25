'use strict';
/*
 * Service worker.
 *
 * Tout ce qu'il faut à l'application — pages, feuilles de style, scripts,
 * icônes, le dossier lui-même, les tracés de la carte et ses six images de
 * relief — est rangé d'un seul bloc, dans un cache propre à la version :
 * « cache d'abord », et hors ligne dès le premier lancement. Les illustrations
 * ont leur cache à part, qui survit aux versions : chacune y entre la première
 * fois qu'on la voit.
 *
 * Une version suivante se prépare dans un autre cache et ne prend la main
 * qu'au feu vert du bandeau (js/demarrage.js) : une page ne reçoit jamais
 * qu'un jeu complet d'une seule version.
 *
 * ⚠ La liste ci-dessous doit rester celle des fichiers que la page charge :
 * `build/essais_statiques.mjs` compare les deux et échoue à la moindre différence.
 */

const VERSION = 'v1.1.0';
const COQUILLE = 'rhedae-coquille-' + VERSION;

const FICHIERS = [
  './',
  'index.html',
  'confidentialite.html',
  'manifest.webmanifest',
  'css/theme.css',
  'css/app.css',
  'css/carte.css',
  'css/maquette.css',
  'js/outils.js',
  'js/memoire.js',
  'js/dossier.js',
  'js/rendu.js',
  'js/illustrations.js',
  'js/carte.js',
  'js/maquette.js',
  'js/eglise.js',
  'js/visite.js',
  'js/fiche.js',
  'js/liste.js',
  'js/frise.js',
  'js/lieux.js',
  'js/hypotheses.js',
  'js/reglages.js',
  'js/app.js',
  'js/demarrage.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'data/manifeste.json',
  'data/dossier.json',
  'data/carte.json',
  'img/relief-region-clair.webp',
  'img/relief-region-nuit.webp',
  'img/relief-razes-clair.webp',
  'img/relief-razes-nuit.webp',
  'img/relief-village-clair.webp',
  'img/relief-village-nuit.webp',
];

/* La marque des requêtes d'installation : une adresse que personne n'a
 * demandée est fraîche, même derrière le relais de GitHub Pages. */
const MARQUE = '?coquille=' + encodeURIComponent(VERSION);

async function installerLaCoquille(cache) {
  const manques = [];
  await Promise.all(FICHIERS.map(async (url) => {
    try {
      const reponse = await fetch(new Request(url + MARQUE, { cache: 'reload' }));
      if (!reponse.ok) { manques.push(url + ' : ' + reponse.status); return; }
      await cache.put(url, reponse);
    } catch (erreur) {
      manques.push(url + ' : ' + (erreur && erreur.message ? erreur.message : erreur));
    }
  }));
  if (manques.length) throw new Error('coquille incomplète — ' + manques.join(', '));
  const page = await cache.match('index.html');
  const html = page ? await page.text() : '';
  if (html.indexOf('name="application-version" content="' + VERSION + '"') === -1) {
    throw new Error('index.html n’est pas de la version ' + VERSION);
  }
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(COQUILLE);
    try {
      await installerLaCoquille(cache);
    } catch (erreur) {
      await caches.delete(COQUILLE);
      throw erreur;
    }
    /* Pas de `skipWaiting()` ici : la nouvelle version attend le feu vert. */
  })());
});

self.addEventListener('message', (e) => {
  const message = e.data || {};
  if (message.type === 'passer-devant') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const nom of await caches.keys()) {
      if (nom.startsWith('rhedae-coquille-') && nom !== COQUILLE) await caches.delete(nom);
    }
    await self.clients.claim();
  })());
});

/* Les illustrations : leur propre cache, qui survit aux versions. L'adresse
 * porte l'empreinte du fichier (`?v=…`) et se compare telle quelle. */
const IMAGES = 'rhedae-images';

async function servirImage(requete) {
  const cache = await caches.open(IMAGES);
  const enCache = await cache.match(requete, { ignoreVary: true });
  if (enCache) return enCache;
  const reponse = await fetch(requete);
  if (reponse.ok) await cache.put(requete, reponse.clone());
  return reponse;
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  e.respondWith((async () => {
    const coquille = await caches.open(COQUILLE);
    const enCache = await coquille.match(e.request, { ignoreSearch: true, ignoreVary: true });
    if (enCache) return enCache;
    if (url.pathname.includes('/img/')) return servirImage(e.request);
    try {
      const reponse = await fetch(e.request);
      if (!reponse.ok && e.request.mode === 'navigate') {
        const accueil = await coquille.match('index.html');
        if (accueil) return accueil;
      }
      return reponse;
    } catch (erreur) {
      if (e.request.mode === 'navigate') {
        const accueil = await coquille.match('index.html');
        if (accueil) return accueil;
      }
      throw erreur;
    }
  })());
});
