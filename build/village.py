"""
Le plan du village en volume : ce dont js/village.js a besoin pour bâtir la
maquette de Rennes-le-Château.

    python build/village.py

Il lit ce que build/fond_de_carte.py a déjà téléchargé dans
build/.sources-carte/ — le bâti, les voies et les murs d'OpenStreetMap
(© les contributeurs d'OpenStreetMap, licence ODbL), le relief des « Terrain
Tiles » (Mapzen, AWS Open Data) — et écrit js/village-plan.js :

    VillagePlan = { origine, altitude, relief, batis, voies, murs }

Le repère est celui de la maquette de l'église, à une rotation près : x vers
l'est, z vers le sud, en mètres, l'origine au point de la fiche de l'église ;
les hauteurs du relief se comptent depuis le sol de l'église.

Le relief est lissé : la source n'a qu'un point tous les trente mètres environ.
Il donne la butte et ses pentes, pas les rochers ni les murs de soutènement.
Il faut Python avec numpy et Pillow.
"""
import json
import math
import os

import numpy as np
from PIL import Image

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCES = os.path.join(RACINE, 'build', '.sources-carte')

LAT0, LON0 = 42.92807, 2.26269            # l'église, comme dans sa fiche
KX = 111320 * math.cos(math.radians(LAT0))
KZ = 110950
# le cadre : le village sur sa butte, du domaine de l'abbé au château et au-delà
X0, X1, Z0, Z1 = -180.0, 280.0, -110.0, 200.0
PAS = 10.0
ZOOM = 14


def xz(lon, lat):
    return ((lon - LON0) * KX, -(lat - LAT0) * KZ)


def lonlat(x, z):
    return (LON0 + x / KX, LAT0 - z / KZ)


_tuiles = {}


def tuile(tx, ty):
    if (tx, ty) not in _tuiles:
        chemin = os.path.join(SOURCES, 'terrarium', str(ZOOM), '%d-%d.png' % (tx, ty))
        a = np.asarray(Image.open(chemin).convert('RGB'), dtype=np.float64)
        _tuiles[(tx, ty)] = a[:, :, 0] * 256 + a[:, :, 1] + a[:, :, 2] / 256 - 32768
    return _tuiles[(tx, ty)]


def altitude(lon, lat):
    """L'altitude en un point, interpolée entre les quatre points voisins."""
    n = 2 ** ZOOM
    fx = (lon + 180) / 360 * n * 256 - 0.5
    r = math.radians(lat)
    fy = (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n * 256 - 0.5
    x0, y0 = int(math.floor(fx)), int(math.floor(fy))
    ax, ay = fx - x0, fy - y0

    def point(px, py):
        return tuile(px // 256, py // 256)[py % 256, px % 256]

    return ((point(x0, y0) * (1 - ax) + point(x0 + 1, y0) * ax) * (1 - ay)
            + (point(x0, y0 + 1) * (1 - ax) + point(x0 + 1, y0 + 1) * ax) * ay)


def lisser(g, tours):
    for _ in range(tours):
        p = np.pad(g, 1, mode='edge')
        g = (p[1:-1, 1:-1] * 4 + p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]) / 8
    return g


def main():
    with open(os.path.join(SOURCES, 'osm-village.json'), encoding='utf-8') as f:
        osm = json.load(f)

    nx = int(round((X1 - X0) / PAS)) + 1
    nz = int(round((Z1 - Z0) / PAS)) + 1
    grille = np.zeros((nz, nx))
    for j in range(nz):
        for i in range(nx):
            grille[j, i] = altitude(*lonlat(X0 + i * PAS, Z0 + j * PAS))
    grille = lisser(grille, 2)
    alt0 = float(altitude(LON0, LAT0))
    # on cale le zéro sur la grille lissée, là où est l'église
    i0, j0 = int(round((0 - X0) / PAS)), int(round((0 - Z0) / PAS))
    base = float(grille[j0, i0])
    relief = [round(float(v) - base, 1) for v in grille.flatten()]

    batis, voies, murs = [], [], []
    dedans = lambda pts: any(X0 + 5 < p[0] < X1 - 5 and Z0 + 5 < p[1] < Z1 - 5 for p in pts)
    for e in osm['elements']:
        if e['type'] != 'way' or not e.get('geometry'):
            continue
        t = e.get('tags') or {}
        pts = [xz(g['lon'], g['lat']) for g in e['geometry']]
        if not dedans(pts):
            continue
        plat = [round(v, 1) for p in pts for v in p]
        if 'building' in t:
            if pts[0] == pts[-1]:
                plat = plat[:-2]
            genre = ('eglise' if t.get('building') == 'church' else 'chateau' if t.get('historic') == 'castle'
                     else 'tour' if t.get('historic') == 'tower' else 'reservoir' if t.get('man_made') == 'water_tower' else '')
            b = {'i': e['id'], 'p': plat}
            if t.get('name'):
                b['n'] = t['name']
            if genre:
                b['t'] = genre
            batis.append(b)
        elif 'highway' in t:
            h = t['highway']
            genre = 'route' if h in ('tertiary', 'residential', 'unclassified', 'service') else 'rue' if h in ('pedestrian', 'footway', 'steps') else 'chemin'
            v = {'t': genre, 'p': plat}
            if t.get('name'):
                v['n'] = t['name']
            voies.append(v)
        elif t.get('barrier') == 'wall':
            murs.append({'i': e['id'], 'p': plat})

    plan = {
        'origine': [LAT0, LON0],
        'altitude': round(alt0),
        'relief': {'x0': X0, 'z0': Z0, 'pas': PAS, 'nx': nx, 'nz': nz, 'h': relief},
        'batis': batis, 'voies': voies, 'murs': murs,
    }
    sortie = os.path.join(RACINE, 'js', 'village-plan.js')
    with open(sortie, 'w', encoding='utf-8', newline='\n') as f:
        f.write("'use strict';\n/*\n * Le plan du village en volume : le bâti, les voies et les murs d'OpenStreetMap\n"
                " * (© les contributeurs d'OpenStreetMap, licence ODbL), le relief des « Terrain\n"
                " * Tiles » (Mapzen, AWS Open Data). Écrit par build/village.py : ne pas le\n"
                " * retoucher à la main. Le même fichier sert à Rhedae et à Terribilis.\n */\n"
                "(function (racine) {\n  racine.VillagePlan = ")
        f.write(json.dumps(plan, ensure_ascii=False, separators=(',', ':')))
        f.write(";\n})(typeof window !== 'undefined' ? window : globalThis);\n")
    print('js/village-plan.js — %d Ko : %d bâtiments, %d voies, %d murs, relief %d × %d (de %.0f à %+.0f m autour de l\'église, à %d m)'
          % (os.path.getsize(sortie) // 1024, len(batis), len(voies), len(murs), nx, nz, min(relief), max(relief), round(alt0)))


if __name__ == '__main__':
    main()
