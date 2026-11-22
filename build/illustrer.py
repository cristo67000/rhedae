"""
Prépare les illustrations de l'application.

    python build/illustrer.py            télécharge ce qui manque, convertit, écrit l'index
    python build/illustrer.py --verifier ne télécharge rien : vérifie que tout est là

Lit build/illustrations.txt (le format est décrit en tête de ce fichier), va
chercher chaque image sur Wikimedia Commons, vérifie qu'elle est dans le
domaine public (ou sous CC0), la recadre s'il le faut, la réduit et l'écrit en
WebP dans img/. Écrit enfin build/illustrations.json, que lit
build/construire.mjs pour rattacher chaque image à ses fiches.

Les originaux sont gardés dans build/.sources-images/ (hors du dépôt) : une
seconde passe ne télécharge plus rien et ne réencode que ce qui a changé.

Le script échoue à la moindre incohérence : licence qui n'est pas libre de tout
droit, fichier introuvable, identifiant en double, champ inconnu. Repris
d'Arcanes, sans les planches ni les gravures coloriées.
"""
import hashlib
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

from PIL import Image, ImageOps

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
SOURCE = os.path.join(ICI, 'illustrations.txt')
SORTIE = os.path.join(ICI, 'illustrations.json')
ORIGINAUX = os.path.join(ICI, '.sources-images')
# Les photographies personnelles (champ « photo: ») : les originaux, hors du dépôt eux aussi.
PHOTOS = os.path.join(ORIGINAUX, 'photos')
LICENCE_PHOTO = 'Tous droits réservés'
DOSSIER_IMG = os.path.join(RACINE, 'img')

AGENT = {'User-Agent': 'illustrations/1.0 (script de construction ; usage ponctuel)'}
API = 'https://commons.wikimedia.org/w/api.php'
LARGEUR_DEFAUT = 440
QUALITE = 76
# Au-delà, on demande à Commons une vignette de cette largeur plutôt que
# l'original (souvent plusieurs mégaoctets) : c'est assez pour réduire ensuite.
LARGEUR_SOURCE = 1280
# Les fichiers d'img/ qui ne sont pas des illustrations : le relief de la carte.
RESERVES = ('relief-',)

CHAMPS = {'commons', 'photo', 'legende', 'credit', 'pour', 'largeur', 'recadrer', 'qualite', 'page'}

sys.stdout.reconfigure(encoding='utf-8')
erreurs = []


def erreur(lieu, message):
    erreurs.append(lieu + ' — ' + message)


def fin():
    print('\n'.join(erreurs))
    print('\n' + str(len(erreurs)) + ' défaut(s).')
    sys.exit(1)


# ── Lecture de build/illustrations.txt ───────────────────────────────────────

def lire():
    images = []
    courant = None
    for n, ligne in enumerate(io.open(SOURCE, encoding='utf-8').read().lstrip('﻿').splitlines(), 1):
        lieu = 'illustrations.txt:' + str(n)
        if not ligne.strip() or ligne.startswith('#'):
            continue
        if ligne.startswith('= '):
            ident = ligne[2:].strip()
            if not re.fullmatch(r'[a-z0-9][a-z0-9-]*', ident):
                erreur(lieu, 'identifiant invalide « ' + ident + ' »')
            courant = {'id': ident, 'lieu': lieu}
            images.append(courant)
            continue
        m = re.match(r'^([a-z]+):\s?(.*)$', ligne)
        if not m or courant is None:
            erreur(lieu, 'ligne incomprise : « ' + ligne[:60] + ' »')
            continue
        cle, valeur = m.group(1), m.group(2).strip()
        if cle not in CHAMPS:
            erreur(lieu, 'champ inconnu « ' + cle + ' »')
            continue
        courant[cle] = valeur
    return images


# ── Wikimedia Commons ────────────────────────────────────────────────────────

def obtenir(url, essais=5):
    for essai in range(essais):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=AGENT), timeout=90) as r:
                return r.read()
        except Exception:  # réseau capricieux, limite de débit : on réessaie
            if essai == essais - 1:
                raise
            time.sleep(3 + 5 * essai)


def nettoyer(html):
    texte = re.sub(r'<[^>]+>', ' ', str(html or ''))
    texte = texte.replace('&amp;', '&').replace('&quot;', '"').replace('&#39;', "'").replace('&nbsp;', ' ')
    return re.sub(r'\s+', ' ', texte).strip()


def informations(titre, page=None):
    """Une requête par fichier, avec redirects=1. `page` : le numéro de page
    d'un livre numérisé (PDF ou DjVu), dont Commons fournit le rendu en image."""
    p = {'action': 'query', 'titles': 'File:' + titre, 'prop': 'imageinfo', 'redirects': '1',
         'iiprop': 'url|size|extmetadata|sha1|mime', 'iiurlwidth': str(LARGEUR_SOURCE), 'format': 'json'}
    if page:
        p['iiurlparam'] = 'page%d-%dpx' % (int(page), LARGEUR_SOURCE)
    r = json.loads(obtenir(API + '?' + urllib.parse.urlencode(p)))
    fiche = list(r['query']['pages'].values())[0]
    if 'imageinfo' not in fiche:
        return None
    ii = fiche['imageinfo'][0]
    em = ii.get('extmetadata', {})
    return {
        'titre': fiche['title'][len('File:'):],
        'url': ii['url'], 'vignette': ii.get('thumburl'), 'w': ii['width'], 'h': ii['height'], 'sha1': ii.get('sha1'),
        'page': ii.get('descriptionurl'), 'mime': ii.get('mime', ''),
        'licence': nettoyer(em.get('LicenseShortName', {}).get('value')),
        'licence_code': nettoyer(em.get('License', {}).get('value')).lower(),
        'feuillet': int(page) if page else None,
    }


def libre(info):
    """Domaine public ou CC0, rien d'autre : pas de CC BY ni de BY-SA, dont les
    obligations ne suivraient pas une image recadrée dans une application."""
    lic = info['licence'].lower()
    code = info['licence_code']
    if code in ('cc0', 'pd') or code.startswith('pd-'):
        return True
    return lic.startswith('public domain') or lic.startswith('pd') or lic == 'cc0' or 'domaine public' in lic


def original(info):
    os.makedirs(ORIGINAUX, exist_ok=True)
    cle = info['sha1'] or hashlib.sha1(info['titre'].encode('utf-8')).hexdigest()
    if info.get('feuillet'):
        cle += '-p' + str(info['feuillet'])
    chemin = os.path.join(ORIGINAUX, cle + '.bin')
    if os.path.exists(chemin):
        return chemin, False
    rendu = info.get('feuillet') or info.get('mime') in ('image/svg+xml', 'image/tiff')
    url = info['vignette'] if (info['w'] > LARGEUR_SOURCE or rendu) and info.get('vignette') else info['url']
    donnees = obtenir(url)
    with open(chemin, 'wb') as f:
        f.write(donnees)
    time.sleep(4)        # un téléchargement à la fois, sans se presser
    return chemin, True


# ── Conversion ───────────────────────────────────────────────────────────────

def convertir(chemin, image, sortie):
    with Image.open(chemin) as im:
        im.load()
        im = ImageOps.exif_transpose(im)      # une photo de téléphone dit son sens dans ses métadonnées
        if im.mode in ('P', 'LA', 'RGBA') or 'transparency' in im.info:
            fond = Image.new('RGB', im.size, (255, 255, 255))
            im = im.convert('RGBA')
            fond.paste(im, mask=im.split()[3])
            im = fond
        else:
            im = im.convert('RGB')
        if image.get('recadrer'):
            g, h, d, b = [float(x) for x in image['recadrer'].split()]
            W, H = im.size
            im = im.crop((round(g * W), round(h * H), round(d * W), round(b * H)))
        largeur = int(image.get('largeur') or LARGEUR_DEFAUT)
        if im.width > largeur:
            im = im.resize((largeur, round(im.height * largeur / im.width)), Image.LANCZOS)
        im.save(sortie, 'WEBP', quality=int(image.get('qualite') or QUALITE), method=6)
        return im.width, im.height


def main():
    verifier = '--verifier' in sys.argv
    images = lire()
    precedent = {}
    if os.path.exists(SORTIE):
        precedent = {im['id']: im for im in json.load(io.open(SORTIE, encoding='utf-8')).get('images', [])}

    vus = set()
    for image in images:
        if image['id'] in vus:
            erreur(image['lieu'], 'identifiant « ' + image['id'] + ' » déjà pris')
        if image['id'].startswith(RESERVES):
            erreur(image['lieu'], 'identifiant réservé au relief de la carte : ' + image['id'])
        vus.add(image['id'])
        for champ in ('legende', 'credit', 'pour'):
            if not image.get(champ):
                erreur(image['lieu'], 'pas de « ' + champ + ': » pour « ' + image['id'] + ' »')
        if bool(image.get('commons')) == bool(image.get('photo')):
            erreur(image['lieu'], 'il faut « commons: » ou « photo: », un seul des deux, pour « ' + image['id'] + ' »')
        if image.get('recadrer') and not re.fullmatch(r'[\d.]+ [\d.]+ [\d.]+ [\d.]+', image['recadrer']):
            erreur(image['lieu'], 'recadrage illisible « ' + image['recadrer'] + ' »')
    if erreurs:
        fin()

    os.makedirs(DOSSIER_IMG, exist_ok=True)
    resultat = []
    telecharges = convertis = 0
    for image in images:
        sortie = os.path.join(DOSSIER_IMG, image['id'] + '.webp')
        signature = '|'.join([image.get('commons') or 'photo:' + image['photo'], image.get('recadrer', ''), str(image.get('largeur') or LARGEUR_DEFAUT),
                              str(image.get('qualite') or QUALITE)] + (['p' + image['page']] if image.get('page') else []))
        ancien = precedent.get(image['id'])
        if ancien and ancien.get('sig') == signature and os.path.exists(sortie):
            licence, source, w, h = ancien['licence'], ancien['source'], ancien['largeur'], ancien['hauteur']
        else:
            if verifier:
                erreur(image['lieu'], 'image à (re)faire : ' + image['id'])
                continue
            if image.get('photo'):
                # Une photographie personnelle : rien à télécharger, pas de page d'origine.
                # Le WebP est écrit sans métadonnées (ni lieu, ni appareil).
                chemin = os.path.join(PHOTOS, image['photo'])
                if not os.path.exists(chemin):
                    erreur(image['lieu'], 'photographie absente de build/.sources-images/photos/ : ' + image['photo'])
                    continue
                try:
                    w, h = convertir(chemin, image, sortie)
                except Exception as e:
                    erreur(image['lieu'], 'image illisible, ' + image['photo'] + ' : ' + str(e))
                    continue
                convertis += 1
                licence, source = LICENCE_PHOTO, ''
                print('  ✓', image['id'], w, '×', h, round(os.path.getsize(sortie) / 1024), 'Ko', '(photographie personnelle)')
                with open(sortie, 'rb') as f:
                    empreinte = hashlib.sha1(f.read()).hexdigest()[:10]
                resultat.append({
                    'id': image['id'], 'legende': image['legende'], 'credit': image['credit'] + ' · tous droits réservés',
                    'licence': licence, 'source': source, 'largeur': w, 'hauteur': h, 'empreinte': empreinte,
                    'pour': [x.strip() for x in image.get('pour', '').split(',') if x.strip()], 'sig': signature,
                })
                continue
            try:
                info = informations(image['commons'], image.get('page'))
            except Exception as e:
                erreur(image['lieu'], 'Commons ne répond pas pour ' + image['commons'] + ' : ' + str(e))
                continue
            if not info:
                erreur(image['lieu'], 'fichier introuvable sur Commons : ' + image['commons'])
                continue
            if not libre(info):
                erreur(image['lieu'], 'licence refusée (' + info['licence'] + ') : ' + image['commons'])
                continue
            try:
                chemin, neuf = original(info)
                w, h = convertir(chemin, image, sortie)
            except Exception as e:
                erreur(image['lieu'], 'image illisible, ' + image['commons'] + ' : ' + str(e))
                continue
            telecharges += neuf
            convertis += 1
            licence, source = info['licence'], info['page']
            print('  ✓', image['id'], w, '×', h, round(os.path.getsize(sortie) / 1024), 'Ko', '(' + licence + ')')
        with open(sortie, 'rb') as f:
            empreinte = hashlib.sha1(f.read()).hexdigest()[:10]
        resultat.append({
            'id': image['id'], 'legende': image['legende'],
            'credit': image['credit'] + ' · ' + ('domaine public' if licence.lower().startswith(('public', 'pd')) else 'tous droits réservés' if licence == LICENCE_PHOTO else licence),
            'licence': licence, 'source': source, 'largeur': w, 'hauteur': h, 'empreinte': empreinte,
            'pour': [x.strip() for x in image.get('pour', '').split(',') if x.strip()],
            'sig': signature,
        })

    # Les fichiers d'img/ que plus rien ne réclame (le relief de la carte n'est pas des leurs)
    gardes = {im['id'] for im in resultat}
    for f in os.listdir(DOSSIER_IMG):
        if not f.endswith('.webp') or f.startswith(RESERVES) or f[:-5] in gardes:
            continue
        if verifier:
            erreur('img/', 'fichier orphelin : ' + f)
        elif not erreurs:
            os.remove(os.path.join(DOSSIER_IMG, f))

    with io.open(SORTIE, 'w', encoding='utf-8') as f:
        json.dump({'images': resultat}, f, ensure_ascii=False, indent=1)
    poids = sum(os.path.getsize(os.path.join(DOSSIER_IMG, im['id'] + '.webp')) for im in resultat)
    print(len(resultat), 'illustrations,', round(poids / 1024), 'Ko ;', telecharges, 'téléchargées,', convertis, 'converties.')
    if erreurs:
        fin()


if __name__ == '__main__':
    main()
