"""
Fabrique le fond de la carte : le relief et les tracés.

    python build/fond_de_carte.py            télécharge ce qui manque, puis écrit
                                             img/relief-*.webp et data/carte.json
    python build/fond_de_carte.py --relief   ne refait que le relief
    python build/fond_de_carte.py --traces   ne refait que les tracés

La carte de l'application ne charge aucune tuile : elle se dessine elle-même,
hors ligne, à partir de deux matières préparées ici une fois pour toutes.

  1. LE RELIEF. Les altitudes viennent des « Terrain Tiles » (Mapzen, hébergées
     par Amazon dans le programme Open Data), tuiles « terrarium » : chaque
     pixel code une altitude. On en tire un estompage (la lumière vient du
     nord-ouest), une teinte selon l'altitude et, de près, des courbes de
     niveau. Trois cadres, du plus large au plus serré : la région (de
     Montségur à la mer), le Haut-Razès, les abords du village. Chacun en deux
     ambiances, « vélin » et « nuit », comme le reste de l'application.

  2. LES TRACÉS. Rivières, routes, voie ferrée, villages, sommets et, pour le
     village, les maisons et les ruelles : ce sont des données d'OpenStreetMap
     (© les contributeurs d'OpenStreetMap, licence ODbL), demandées à l'API
     Overpass, simplifiées et rangées dans data/carte.json.

Les téléchargements sont gardés dans build/.sources-carte/ (hors du dépôt) :
une seconde passe ne redemande rien au réseau.
"""
import io
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request

import numpy as np
from PIL import Image, ImageFilter

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
SOURCES = os.path.join(ICI, '.sources-carte')
DOSSIER_IMG = os.path.join(RACINE, 'img')
SORTIE = os.path.join(RACINE, 'data', 'carte.json')

AGENT = {'User-Agent': 'fond-de-carte/1.0 (script de construction ; usage ponctuel)'}
TUILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']

sys.stdout.reconfigure(encoding='utf-8')

# Les trois cadres : ouest, sud, est, nord (degrés), le zoom des tuiles
# d'altitude, l'exagération du relief et l'équidistance des courbes (0 : aucune).
CADRES = {
    'region':  {'boite': (1.50, 42.52, 3.12, 43.36), 'zoom': 10, 'exag': 1.6, 'courbes': 0,   'maitresses': 0},
    'razes':   {'boite': (2.08, 42.79, 2.52, 43.08), 'zoom': 12, 'exag': 1.25, 'courbes': 100, 'maitresses': 500},
    'village': {'boite': (2.225, 42.900, 2.305, 42.952), 'zoom': 14, 'exag': 1.1, 'courbes': 0, 'maitresses': 0},
}

# Les teintes selon l'altitude (mètres → couleur), par ambiance.
TEINTES = {
    'clair': {
        'mer': (205, 220, 221),
        'rampe': [(0, (228, 232, 208)), (150, (236, 233, 209)), (350, (243, 235, 212)), (600, (240, 226, 196)),
                  (900, (231, 212, 176)), (1300, (220, 197, 160)), (2000, (207, 184, 150)), (2900, (228, 220, 205))],
        'ombre': 0.95, 'lumiere': 0.42, 'courbe': (146, 118, 78), 'force_courbe': 0.20, 'force_maitresse': 0.36,
    },
    'nuit': {
        'mer': (13, 20, 34),
        'rampe': [(0, (27, 29, 46)), (150, (30, 30, 49)), (350, (34, 31, 52)), (600, (40, 35, 58)),
                  (900, (48, 41, 66)), (1300, (58, 49, 75)), (2000, (70, 59, 86)), (2900, (92, 82, 108))],
        'ombre': 0.80, 'lumiere': 1.25, 'courbe': (150, 130, 190), 'force_courbe': 0.14, 'force_maitresse': 0.26,
    },
}


# ── Outils ───────────────────────────────────────────────────────────────────

def telecharger(url, donnees=None, essais=4):
    derniere = None
    for essai in range(essais):
        try:
            requete = urllib.request.Request(url, data=donnees, headers=AGENT)
            with urllib.request.urlopen(requete, timeout=180) as reponse:
                return reponse.read()
        except Exception as erreur:  # réseau capricieux : on insiste un peu
            derniere = erreur
            time.sleep(3 + 5 * essai)
    raise RuntimeError('téléchargement impossible : ' + url + ' — ' + str(derniere))


def tuile_x(lon, z):
    return (lon + 180.0) / 360.0 * (2 ** z)


def tuile_y(lat, z):
    phi = math.radians(lat)
    return (1.0 - math.asinh(math.tan(phi)) / math.pi) / 2.0 * (2 ** z)


# ── Le relief ────────────────────────────────────────────────────────────────

def altitudes(nom, cadre):
    """Le tableau des altitudes du cadre, recousu à partir des tuiles."""
    ouest, sud, est, nord = cadre['boite']
    z = cadre['zoom']
    x0, x1 = tuile_x(ouest, z), tuile_x(est, z)
    y0, y1 = tuile_y(nord, z), tuile_y(sud, z)
    # une tuile de marge : l'estompage a besoin des voisins du bord
    tx0, tx1 = int(math.floor(x0)) - 1, int(math.floor(x1)) + 1
    ty0, ty1 = int(math.floor(y0)) - 1, int(math.floor(y1)) + 1
    largeur, hauteur = (tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256
    mosaique = np.zeros((hauteur, largeur), dtype=np.float32)
    dossier = os.path.join(SOURCES, 'terrarium', str(z))
    os.makedirs(dossier, exist_ok=True)
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            fichier = os.path.join(dossier, f'{tx}-{ty}.png')
            if not os.path.exists(fichier):
                with open(fichier, 'wb') as f:
                    f.write(telecharger(TUILES.format(z=z, x=tx, y=ty)))
            pixels = np.asarray(Image.open(fichier).convert('RGB'), dtype=np.float32)
            alt = pixels[:, :, 0] * 256.0 + pixels[:, :, 1] + pixels[:, :, 2] / 256.0 - 32768.0
            mosaique[(ty - ty0) * 256:(ty - ty0 + 1) * 256, (tx - tx0) * 256:(tx - tx0 + 1) * 256] = alt
    # le rectangle du cadre, en pixels de la mosaïque
    gauche, droite = (x0 - tx0) * 256, (x1 - tx0) * 256
    haut, bas = (y0 - ty0) * 256, (y1 - ty0) * 256
    return mosaique, (gauche, haut, droite, bas)


def rampe(alt, etapes):
    """La teinte de chaque pixel d'après son altitude."""
    seuils = np.array([e[0] for e in etapes], dtype=np.float32)
    sortie = np.zeros(alt.shape + (3,), dtype=np.float32)
    for canal in range(3):
        valeurs = np.array([e[1][canal] for e in etapes], dtype=np.float32)
        sortie[:, :, canal] = np.interp(alt, seuils, valeurs)
    return sortie


def flou(tableau, sigma):
    """Flou gaussien séparable sur un tableau de réels (Pillow ne floute pas le mode « F »)."""
    rayon = max(1, int(math.ceil(sigma * 3)))
    x = np.arange(-rayon, rayon + 1, dtype=np.float32)
    noyau = np.exp(-(x * x) / (2 * sigma * sigma))
    noyau /= noyau.sum()
    borde = np.pad(tableau, rayon, mode='edge')
    lignes = sum(noyau[i] * borde[:, i:i + tableau.shape[1]] for i in range(2 * rayon + 1))
    return sum(noyau[i] * lignes[i:i + tableau.shape[0], :] for i in range(2 * rayon + 1)).astype(np.float32)


def courbes(alt, pas):
    """Vrai là où passe une courbe de niveau (un pixel d'épaisseur)."""
    palier = np.floor(alt / pas)
    trait = np.zeros(alt.shape, dtype=bool)
    trait[:-1, :] |= palier[:-1, :] != palier[1:, :]
    trait[:, :-1] |= palier[:, :-1] != palier[:, 1:]
    return trait


def dessiner_relief(nom, cadre):
    alt, (gauche, haut, droite, bas) = altitudes(nom, cadre)
    ouest, sud, est, nord = cadre['boite']
    z = cadre['zoom']
    metres = 156543.03392 * math.cos(math.radians((sud + nord) / 2)) / (2 ** z)

    lisse = flou(alt, 0.8)
    dzdy, dzdx = np.gradient(lisse, metres)
    ex = cadre['exag']
    nx, ny, nz = -dzdx * ex, dzdy * ex, 1.0            # « ny » vers le nord
    norme = np.sqrt(nx * nx + ny * ny + nz * nz)

    def eclairage(azimut, hauteur):
        a, h = math.radians(azimut), math.radians(hauteur)
        lx, ly, lz = math.cos(h) * math.sin(a), math.cos(h) * math.cos(a), math.sin(h)
        return np.clip((nx * lx + ny * ly + nz * lz) / norme, 0, 1), lz

    # la lumière principale du nord-ouest, adoucie par deux lumières d'appoint
    principal, plat = eclairage(315, 45)
    appoint1, _ = eclairage(270, 50)
    appoint2, _ = eclairage(0, 50)
    ombre = 0.62 * principal + 0.19 * appoint1 + 0.19 * appoint2
    ecart = ombre - (0.62 * plat + 0.38 * math.sin(math.radians(50)))   # 0 sur le plat

    boite = (int(round(gauche)), int(round(haut)), int(round(droite)), int(round(bas)))
    for ambiance, t in TEINTES.items():
        couleur = rampe(alt, t['rampe'])
        facteur = np.where(ecart < 0, 1 + t['ombre'] * ecart, 1 + t['lumiere'] * ecart)
        image = couleur * facteur[:, :, None]
        if cadre['courbes']:
            for pas, force in ((cadre['courbes'], t['force_courbe']), (cadre['maitresses'], t['force_maitresse'])):
                trait = courbes(lisse, pas)
                doux = np.clip(flou(trait.astype(np.float32), 0.5) * 1.6, 0, 1) * force
                image = image * (1 - doux[:, :, None]) + np.array(t['courbe'], dtype=np.float32) * doux[:, :, None]
        mer = alt <= 0.3
        if mer.any():
            image[mer] = t['mer']
        sortie = Image.fromarray(np.clip(image, 0, 255).astype(np.uint8), 'RGB').crop(boite)
        fichier = os.path.join(DOSSIER_IMG, f'relief-{nom}-{ambiance}.webp')
        sortie.save(fichier, 'WEBP', quality=82, method=6)
        print(f'  relief-{nom}-{ambiance}.webp  {sortie.width}×{sortie.height}  {os.path.getsize(fichier) // 1024} Ko')
    return {'l': boite[2] - boite[0], 'h': boite[3] - boite[1]}


# ── Les tracés ───────────────────────────────────────────────────────────────

def overpass(nom, requete):
    fichier = os.path.join(SOURCES, f'osm-{nom}.json')
    if os.path.exists(fichier):
        with open(fichier, encoding='utf-8') as f:
            return json.load(f)
    corps = urllib.parse.urlencode({'data': requete}).encode('utf-8')
    derniere = None
    for serveur in OVERPASS:
        try:
            brut = telecharger(serveur, corps, essais=2)
            donnees = json.loads(brut)
            with open(fichier, 'w', encoding='utf-8') as f:
                json.dump(donnees, f)
            return donnees
        except Exception as erreur:
            derniere = erreur
    raise RuntimeError(f'Overpass ne répond pas pour « {nom} » : {derniere}')


def simplifier(points, tolerance):
    """Douglas-Peucker, sans récursion."""
    if len(points) < 3:
        return points
    garder = [False] * len(points)
    garder[0] = garder[-1] = True
    pile = [(0, len(points) - 1)]
    while pile:
        debut, fin = pile.pop()
        ax, ay = points[debut]
        bx, by = points[fin]
        dx, dy = bx - ax, by - ay
        longueur2 = dx * dx + dy * dy
        pire, rang = 0.0, -1
        for i in range(debut + 1, fin):
            px, py = points[i]
            if longueur2 == 0:
                d = math.hypot(px - ax, py - ay)
            else:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / longueur2))
                d = math.hypot(px - (ax + t * dx), py - (ay + t * dy))
            if d > pire:
                pire, rang = d, i
        if pire > tolerance and rang > 0:
            garder[rang] = True
            pile.append((debut, rang))
            pile.append((rang, fin))
    return [p for p, g in zip(points, garder) if g]


def recoudre(lignes):
    """Met bout à bout les tronçons qui se suivent : moins de lignes, plus longues."""
    lignes = [list(l) for l in lignes if len(l) >= 2]
    change = True
    while change:
        change = False
        par_bout = {}
        for i, l in enumerate(lignes):
            if l is None:
                continue
            for bout in (l[0], l[-1]):
                par_bout.setdefault(bout, []).append(i)
        for bout, rangs in par_bout.items():
            vivants = [i for i in rangs if lignes[i] is not None]
            if len(vivants) == 2 and vivants[0] != vivants[1]:
                a, b = vivants
                la, lb = lignes[a], lignes[b]
                if la[-1] != bout:
                    la.reverse()
                if lb[0] != bout:
                    lb.reverse()
                if la[-1] == bout and lb[0] == bout:
                    lignes[a] = la + lb[1:]
                    lignes[b] = None
                    change = True
        lignes = [l for l in lignes if l is not None]
    return lignes


def plat(points, decimales):
    sortie = []
    for lon, lat in points:
        sortie.append(round(lon, decimales))
        sortie.append(round(lat, decimales))
    return sortie


def lignes_de(elements, filtre, tolerance, decimales=5, par_nom=True):
    """Les chemins OSM retenus par `filtre(tags)` → {classe, nom, lignes}."""
    groupes = {}
    for e in elements:
        if e.get('type') != 'way' or 'geometry' not in e:
            continue
        tags = e.get('tags', {})
        classe = filtre(tags)
        if not classe:
            continue
        nom = tags.get('name', '') if par_nom else ''
        points = tuple((round(p['lon'], 7), round(p['lat'], 7)) for p in e['geometry'])
        groupes.setdefault((classe, nom), []).append(points)
    sortie = []
    for (classe, nom), lignes in groupes.items():
        for ligne in recoudre(lignes):
            ligne = simplifier(ligne, tolerance)
            if len(ligne) >= 2:
                objet = {'c': classe, 'p': plat(ligne, decimales)}
                if nom:
                    objet['n'] = nom
                sortie.append(objet)
    return sortie


def boite_overpass(cadre):
    ouest, sud, est, nord = cadre['boite']
    return f'{sud},{ouest},{nord},{est}'


def traces_region():
    b = boite_overpass(CADRES['region'])
    donnees = overpass('region', f'''[out:json][timeout:180];
(
  way["waterway"="river"]({b});
  way["highway"~"^(motorway|trunk|primary)$"]({b});
  node["place"~"^(city|town)$"]({b});
);
out geom;''')
    el = donnees['elements']
    eaux = lignes_de(el, lambda t: 'riviere' if t.get('waterway') == 'river' else None, 0.0012, 4)
    routes = lignes_de(el, lambda t: {'motorway': 'autoroute', 'trunk': 'nationale', 'primary': 'nationale'}.get(t.get('highway')),
                       0.0010, 4, par_nom=False)
    villes = [{'n': e['tags']['name'], 'g': [round(e['lon'], 4), round(e['lat'], 4)], 't': e['tags'].get('place'),
               'h': int(e['tags'].get('population', '0') or 0) if str(e['tags'].get('population', '0')).isdigit() else 0}
              for e in el if e.get('type') == 'node' and e.get('tags', {}).get('name')]
    return {'eaux': eaux, 'routes': routes, 'bourgs': villes}


def traces_razes():
    b = boite_overpass(CADRES['razes'])
    donnees = overpass('razes', f'''[out:json][timeout:180];
(
  way["waterway"~"^(river|stream)$"]["name"]({b});
  way["highway"~"^(primary|secondary|tertiary|unclassified)$"]({b});
  way["railway"="rail"]({b});
  way["natural"="water"]["name"]({b});
  node["place"~"^(town|village|hamlet)$"]({b});
  node["natural"="peak"]["name"]({b});
  node["mountain_pass"="yes"]["name"]({b});
);
out geom;''')
    el = donnees['elements']
    eaux = lignes_de(el, lambda t: {'river': 'riviere', 'stream': 'ruisseau'}.get(t.get('waterway')), 0.00022, 5)
    routes = lignes_de(el, lambda t: {'primary': 'nationale', 'secondary': 'departementale', 'tertiary': 'locale',
                                      'unclassified': 'chemin'}.get(t.get('highway')), 0.00018, 5, par_nom=False)
    rail = lignes_de(el, lambda t: 'rail' if t.get('railway') == 'rail' and not t.get('service') else None, 0.00018, 5, par_nom=False)
    lacs = []
    for e in el:
        if e.get('type') == 'way' and e.get('tags', {}).get('natural') == 'water' and 'geometry' in e:
            pts = simplifier([(p['lon'], p['lat']) for p in e['geometry']], 0.00015)
            if len(pts) >= 4:
                lacs.append({'n': e['tags'].get('name', ''), 'p': plat(pts, 5)})
    bourgs, sommets, cols = [], [], []
    for e in el:
        if e.get('type') != 'node':
            continue
        t = e.get('tags', {})
        if not t.get('name'):
            continue
        g = [round(e['lon'], 5), round(e['lat'], 5)]
        if t.get('place'):
            bourgs.append({'n': t['name'], 'g': g, 't': t['place']})
        elif t.get('natural') == 'peak':
            alt = t.get('ele', '')
            try:
                alt = int(round(float(str(alt).replace(',', '.').replace('m', '').strip())))
            except ValueError:
                alt = 0
            sommets.append({'n': t['name'], 'g': g, 'a': alt})
        elif t.get('mountain_pass') == 'yes':
            cols.append({'n': t['name'], 'g': g})
    return {'eaux': eaux, 'routes': routes, 'rail': rail, 'lacs': lacs, 'bourgs': bourgs, 'sommets': sommets, 'cols': cols}


def traces_village():
    # le village même, un peu plus serré que le cadre du relief
    b = '42.9225,2.2555,42.9325,2.2715'
    donnees = overpass('village', f'''[out:json][timeout:120];
(
  way["building"]({b});
  way["highway"]({b});
  way["landuse"="cemetery"]({b});
  way["amenity"="grave_yard"]({b});
  way["leisure"~"^(park|garden)$"]({b});
  way["historic"]({b});
  way["barrier"~"^(wall|city_wall|retaining_wall)$"]({b});
  node["name"]({b});
);
out geom;''')
    el = donnees['elements']
    batis, enclos, murs, nommes = [], [], [], []
    for e in el:
        t = e.get('tags', {})
        if e.get('type') == 'way' and 'geometry' in e:
            pts = [(p['lon'], p['lat']) for p in e['geometry']]
            if t.get('building'):
                objet = {'p': plat(pts, 6)}
                if t.get('name'):
                    objet['n'] = t['name']
                genre = t.get('amenity') or t.get('historic') or t.get('building')
                if genre and genre != 'yes':
                    objet['t'] = genre
                batis.append(objet)
            elif t.get('landuse') == 'cemetery' or t.get('amenity') == 'grave_yard':
                enclos.append({'c': 'cimetiere', 'p': plat(pts, 6), 'n': t.get('name', '')})
            elif t.get('leisure') in ('park', 'garden'):
                enclos.append({'c': 'jardin', 'p': plat(pts, 6), 'n': t.get('name', '')})
            elif t.get('barrier'):
                murs.append({'p': plat(pts, 6)})
            if t.get('name') and not t.get('highway'):
                lon = sum(p[0] for p in pts) / len(pts)
                lat = sum(p[1] for p in pts) / len(pts)
                nommes.append({'n': t['name'], 'g': [round(lon, 6), round(lat, 6)],
                               't': t.get('historic') or t.get('amenity') or t.get('tourism') or t.get('building') or ''})
        elif e.get('type') == 'node' and t.get('name'):
            nommes.append({'n': t['name'], 'g': [round(e['lon'], 6), round(e['lat'], 6)],
                           't': t.get('historic') or t.get('amenity') or t.get('tourism') or t.get('place') or t.get('shop') or ''})
    classes = {'primary': 'departementale', 'secondary': 'departementale', 'tertiary': 'locale', 'unclassified': 'rue',
               'residential': 'rue', 'living_street': 'rue', 'service': 'ruelle', 'pedestrian': 'ruelle',
               'track': 'sentier', 'path': 'sentier', 'footway': 'sentier', 'steps': 'sentier'}
    voies = lignes_de(el, lambda t: classes.get(t.get('highway')), 0.000012, 6)
    return {'batis': batis, 'enclos': enclos, 'murs': murs, 'voies': voies, 'nommes': nommes}


# ── Tout assembler ───────────────────────────────────────────────────────────

def principal():
    os.makedirs(SOURCES, exist_ok=True)
    os.makedirs(DOSSIER_IMG, exist_ok=True)
    seulement = [a for a in sys.argv[1:] if a.startswith('--')]
    carte = {}
    if os.path.exists(SORTIE):
        with open(SORTIE, encoding='utf-8') as f:
            carte = json.load(f)

    if not seulement or '--relief' in seulement:
        print('Relief :')
        cadres = {}
        for nom, cadre in CADRES.items():
            taille = dessiner_relief(nom, cadre)
            cadres[nom] = {'boite': list(cadre['boite']), 'l': taille['l'], 'h': taille['h']}
        carte['cadres'] = cadres

    if not seulement or '--traces' in seulement:
        print('Tracés :')
        for nom, fabrique in (('region', traces_region), ('razes', traces_razes), ('village', traces_village)):
            carte[nom] = fabrique()
            print('  ' + nom + ' : ' + ', '.join(f'{len(v)} {k}' for k, v in carte[nom].items()))

    carte['sources'] = {
        'relief': 'Terrain Tiles (Mapzen, AWS Open Data) : SRTM, EU-DEM et autres modèles numériques de terrain ouverts',
        'traces': '© les contributeurs d’OpenStreetMap, licence ODbL',
    }
    with open(SORTIE, 'w', encoding='utf-8') as f:
        json.dump(carte, f, ensure_ascii=False, separators=(',', ':'))
    print(f'data/carte.json  {os.path.getsize(SORTIE) // 1024} Ko')


if __name__ == '__main__':
    principal()
