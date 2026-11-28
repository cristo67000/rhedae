"""
Le décor de l'église, d'après les photographies : l'atlas de la maquette.

    python build/decor_eglise.py            écrit img/eglise-decor.webp et js/eglise-decor.js
    python build/decor_eglise.py --planche  écrit aussi build/maquette/decor-planche.jpg (l'atlas, les contours dessus)

La maquette (js/eglise.js) plaque sur ses volumes ce que les photographies
montrent : les quatorze stations, le Sermon sur la montagne, le devant de
l'autel, les vitraux, le tympan du porche — et les statues, dont le volume est
tiré de leur silhouette. Ce script découpe chaque morceau dans sa photographie,
le redresse, le range dans une seule image (l'« atlas ») et écrit, pour
js/eglise.js, où chacun se trouve.

Les originaux sont les photographies et les films pris sur place en août 2024
par Cristo6772 (tous droits réservés), rangés dans build/.sources-images/eglise/,
hors du dépôt. L'image tirée d'un film s'appelle VID_<film>_<nom>.jpg :

    ffmpeg -ss 28 -i PXL_20240831_073321583.mp4 -frames:v 1 -q:v 2 VID_073321583_christ.jpg

L'atlas ne garde aucune métadonnée. Il faut Python avec numpy, scipy et Pillow.

Chaque entrée de MORCEAUX : le nom, la photographie (un bout de son nom), le
cadre dans l'original redressé (x0, y0, x1, y1, en pixels), la taille dans
l'atlas, et selon les cas :
  forme   — une statue : sa silhouette, ligne par ligne (y, x gauche, x droite),
            en pixels de l'original. Le volume de la statue en sort, et ce qui
            dépasse de la silhouette est repeint de la couleur du bord ;
  miroir  — un vitrail dont le bas est caché par une statue : sous cette
            hauteur, on répète en miroir ce qui est au-dessus.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageOps
from scipy import ndimage

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
ORIGINAUX = os.path.join(ICI, '.sources-images', 'eglise')
IMAGE = os.path.join(RACINE, 'img', 'eglise-decor.webp')
TABLE = os.path.join(RACINE, 'js', 'eglise-decor.js')
COTE = 2048          # l'atlas est carré, d'un côté puissance de deux (WebGL en tire ses réductions)
MARGE = 4            # autour de chaque morceau, son bord répété : rien ne bave sur le voisin

MORCEAUX = [
    # ── les tableaux et les reliefs ──
    dict(nom='sermon', photo='161008503', cadre=(444, 222, 3185, 1580), taille=(896, 444)),
    dict(nom='autel-bas', photo='161257190', cadre=(880, 1185, 2645, 2105), taille=(640, 334)),
    dict(nom='autel-retable', photo='161257190', cadre=(935, 532, 2600, 1190), taille=(640, 253)),
    dict(nom='rose', photo='142401411', cadre=(1066, 703, 2678, 2177), taille=(320, 320)),
    dict(nom='vitrail', photo='161152723', cadre=(820, 755, 1235, 1600), taille=(160, 326), miroir=1215),
    dict(nom='vitrail-histoire', photo='161233340', cadre=(918, 292, 1317, 1282), taille=(160, 397)),
    dict(nom='tympan', photo='161604925', cadre=(113, 791, 2188, 1970), taille=(480, 273)),
    dict(nom='niche', photo='073127236', cadre=(827, 625, 1581, 2400), taille=(144, 339)),
    dict(nom='pilier', photo='073127236', cadre=(919, 2440, 1403, 3367), taille=(112, 215)),
    # ── le chemin de croix (la première station n'est sur aucune photographie) ──
    dict(nom='station-2', photo='161310975', cadre=(1508, 1567, 2154, 2803), taille=(144, 276)),
    dict(nom='station-3', photo='161310975', cadre=(63, 1578, 680, 2735), taille=(144, 270)),
    dict(nom='station-4', photo='160846730', cadre=(1075, 1180, 1400, 1850), taille=(144, 297)),
    dict(nom='station-5', photo='160846730', cadre=(135, 1035, 620, 1845), taille=(144, 240)),
    # (les VI et VIII dépassent un peu du bas de la prise : leur dernier rang est répété)
    dict(nom='station-6', photo='161008503', cadre=(2908, 1686, 3238, 2330), taille=(144, 281)),
    dict(nom='station-7', photo='161008503', cadre=(2556, 1644, 2870, 2262), taille=(144, 283)),
    dict(nom='station-8', photo='161008503', cadre=(736, 1602, 1158, 2425), taille=(144, 281)),
    dict(nom='station-9', photo='160905522', cadre=(1619, 504, 2200, 1680), taille=(144, 291)),
    dict(nom='station-10', photo='161152723', cadre=(1422, 1647, 1856, 2540), taille=(144, 296)),
    dict(nom='station-11', photo='161152723', cadre=(248, 1543, 775, 2545), taille=(144, 274)),
    dict(nom='station-12', photo='161159025', cadre=(1403, 1490, 1910, 2500), taille=(144, 287)),
    dict(nom='station-13', photo='161159025', cadre=(242, 1532, 716, 2458), taille=(144, 281)),
    dict(nom='station-14', photo='161233340', cadre=(1517, 1020, 2160, 2214), taille=(144, 267)),
    # ── les statues ──
    dict(nom='germaine', photo='160846730', taille=(192, 0), forme=[
        (865, 960, 1010), (900, 945, 1025), (950, 940, 1030), (990, 900, 1050), (1060, 850, 1060), (1150, 835, 1060),
        (1250, 815, 1035), (1350, 715, 1045), (1450, 705, 1045), (1540, 720, 1045), (1568, 725, 1040)]),
    dict(nom='antoine-ermite', photo='161310975', taille=(192, 0), forme=[
        (1113, 1066, 1161), (1204, 1048, 1179), (1295, 998, 1236), (1408, 918, 1315), (1522, 896, 1327), (1658, 884, 1293),
        (1816, 896, 1247), (1975, 873, 1236), (2134, 850, 1236), (2259, 816, 1224)]),
    dict(nom='roch', photo='161152723', taille=(192, 0), forme=[
        (1244, 1112, 1196), (1323, 1084, 1238), (1407, 985, 1281), (1520, 971, 1309), (1632, 980, 1323), (1745, 1000, 1317),
        (1857, 971, 1300), (1970, 923, 1295), (2083, 929, 1290), (2160, 971, 1281)]),
    dict(nom='madeleine', photo='161159025', taille=(192, 0), forme=[
        (1145, 1039, 1155), (1242, 1006, 1187), (1355, 919, 1265), (1484, 903, 1290), (1613, 919, 1284), (1774, 935, 1265),
        (1935, 929, 1242), (2080, 919, 1219)]),
    dict(nom='antoine-padoue', photo='161233340', taille=(192, 0), forme=[
        (832, 769, 877), (918, 742, 985), (1026, 661, 993), (1161, 580, 999), (1242, 567, 993), (1350, 648, 931),
        (1512, 642, 931), (1674, 634, 931), (1795, 626, 923)]),
    dict(nom='anges-padoue', photo='161233340', taille=(208, 0), forme=[
        (1997, 458, 1055), (2125, 469, 1044), (2272, 495, 989), (2492, 506, 982), (2712, 513, 960), (2803, 513, 960)]),
    dict(nom='joseph', photo='142436647', taille=(192, 0), forme=[
        (1195, 1335, 1470), (1297, 1281, 1511), (1405, 1200, 1646), (1541, 1146, 1673), (1649, 1132, 1700), (1811, 1146, 1605),
        (2027, 1186, 1605), (2243, 1173, 1605), (2459, 1105, 1565), (2622, 1078, 1524), (2738, 1073, 1511)]),
    dict(nom='marie', photo='142443816', taille=(176, 0), forme=[
        (1073, 1331, 1472), (1210, 1298, 1552), (1371, 1190, 1653), (1532, 1210, 1685), (1734, 1250, 1685), (2016, 1282, 1673),
        (2298, 1282, 1645), (2540, 1290, 1613)]),
    dict(nom='bapteme', photo='161109189', taille=(336, 0), forme=[
        (615, 1010, 1235), (810, 986, 1304), (990, 965, 1565), (1200, 905, 1634), (1335, 530, 1640), (1500, 815, 1610),
        (1620, 545, 1604), (1860, 440, 1595), (2100, 350, 1565), (2400, 320, 1535), (2700, 350, 1520), (2970, 410, 1490)]),
    dict(nom='anges-benitier', photo='160905522', taille=(320, 0), forme=[
        (661, 751, 930), (735, 667, 993), (840, 646, 1224), (945, 468, 1308), (1092, 426, 1350), (1260, 422, 1350),
        (1470, 426, 1350), (1680, 430, 1350), (1911, 415, 1350)]),
    dict(nom='croix-benitier', photo='160905522', taille=(144, 0), forme=[
        (95, 888, 993), (189, 856, 1024), (252, 751, 1140), (346, 709, 1182), (441, 751, 1140), (525, 856, 1024), (620, 898, 982)]),
    dict(nom='diable', photo='160913449', taille=(256, 0), forme=[
        (645, 1069, 1694), (1008, 968, 1734), (1331, 605, 1895), (1694, 524, 1996), (2016, 403, 1976), (2419, 605, 1815),
        (2823, 726, 1694), (3226, 766, 1613), (3629, 1008, 1573), (3851, 1089, 1573)]),
    dict(nom='lourdes', photo='073127236', taille=(128, 0), forme=[
        (960, 1161, 1258), (1069, 1129, 1298), (1210, 1056, 1363), (1371, 1016, 1391), (1613, 1008, 1391), (1855, 1016, 1379),
        (2056, 1040, 1363), (2169, 1008, 1371)]),
    dict(nom='christ', photo='VID_073321583_christ', taille=(128, 0), forme=[
        (490, 557, 672), (576, 547, 691), (653, 518, 768), (768, 538, 778), (883, 576, 806), (998, 528, 816),
        (1152, 528, 787), (1306, 614, 749), (1459, 614, 720), (1559, 605, 710)]),
]


def ouvrir(bout, cache={}):
    if bout not in cache:
        noms = [f for f in os.listdir(ORIGINAUX) if bout in f]
        if len(noms) != 1:
            sys.exit('photographie introuvable ou ambiguë : ' + bout + ' — ' + ORIGINAUX)
        cache[bout] = ImageOps.exif_transpose(Image.open(os.path.join(ORIGINAUX, noms[0]))).convert('RGB')
    return cache[bout]


def eclaircir(a):
    """Les prises sombres remontent vers les autres : jamais plus de 1,7 fois."""
    lum = a.mean(axis=2)
    haut = np.percentile(lum, 97)
    gain = min(1.7, max(1.0, 205.0 / max(haut, 1.0)))
    return np.clip(a * gain, 0, 255)


def decouper(m):
    im = ouvrir(m['photo'])
    forme = m.get('forme')
    if forme:
        x0 = min(f[1] for f in forme); x1 = max(f[2] for f in forme)
        y0 = forme[0][0]; y1 = forme[-1][0]
        l = m['taille'][0]
        m['taille'] = (l, max(8, round(l * (y1 - y0) / (x1 - x0))))
        m['cadre'] = (x0, y0, x1, y1)
    x0, y0, x1, y1 = m['cadre']
    l, h = m['taille']
    brut = im.crop((x0, y0, x1, min(y1, im.height)))
    if y1 > im.height:
        brut = Image.fromarray(np.pad(np.asarray(brut), ((0, y1 - im.height), (0, 0), (0, 0)), mode='edge'))
    if m.get('miroir'):
        a = np.asarray(brut).copy()
        coupe = m['miroir'] - y0
        reste = a.shape[0] - coupe
        a[coupe:] = a[coupe - 1::-1][:reste]
        brut = Image.fromarray(a)
    a = eclaircir(np.asarray(brut.resize((l, h), Image.LANCZOS)).astype(np.float32))
    table = None
    m['brut'] = Image.fromarray(a.astype(np.uint8))
    if forme:
        # la silhouette, en coordonnées du morceau (0 à 1), légèrement resserrée pour le masque
        table = [[round((y - y0) / (y1 - y0), 4), round((g - x0) / (x1 - x0), 4), round((d - x0) / (x1 - x0), 4)] for y, g, d in forme]
        masque = Image.new('L', (l, h), 0)
        gauche = [((u0 + (u1 - u0) * 0.07) * l, v * h) for v, u0, u1 in table]
        droite = [((u1 - (u1 - u0) * 0.07) * l, v * h) for v, u0, u1 in table]
        ImageDraw.Draw(masque).polygon(gauche + droite[::-1], fill=255)
        dedans = np.asarray(masque) > 0
        # hors de la silhouette : la couleur du point de la statue le plus proche
        _, (iy, ix) = ndimage.distance_transform_edt(~dedans, return_indices=True)
        a = a[iy, ix]
        a = ndimage.gaussian_filter(a, sigma=(0.6, 0.6, 0)) * (~dedans)[..., None] + a * dedans[..., None]
    return Image.fromarray(a.astype(np.uint8)), table


def ranger(morceaux):
    """Des étagères : les plus hauts d'abord, de gauche à droite."""
    places = {}
    x = y = etage = 0
    for m in sorted(morceaux, key=lambda m: -m['taille'][1]):
        l, h = m['taille'][0] + 2 * MARGE, m['taille'][1] + 2 * MARGE
        if x + l > COTE:
            x = 0; y += etage; etage = 0
        places[m['nom']] = (x + MARGE, y + MARGE)
        x += l; etage = max(etage, h)
    if y + etage > COTE:
        sys.exit('l\'atlas déborde : %d lignes pour %d' % (y + etage, COTE))
    return places, y + etage


def principal():
    images, formes = {}, {}
    for m in MORCEAUX:
        images[m['nom']], f = decouper(m)
        if f:
            formes[m['nom']] = f
    places, hauteur = ranger(MORCEAUX)
    atlas = Image.new('RGB', (COTE, COTE), (128, 120, 108))
    cases = {}
    for m in MORCEAUX:
        im = images[m['nom']]
        x, y = places[m['nom']]
        l, h = im.size
        bord = np.pad(np.asarray(im), ((MARGE, MARGE), (MARGE, MARGE), (0, 0)), mode='edge')
        atlas.paste(Image.fromarray(bord), (x - MARGE, y - MARGE))
        moyenne = np.asarray(im).reshape(-1, 3).mean(axis=0)
        # un demi-pixel en dedans : le bord ne va jamais chercher la marge
        cases[m['nom']] = [round((x + 0.5) / COTE, 5), round((y + 0.5) / COTE, 5), round((x + l - 0.5) / COTE, 5), round((y + h - 0.5) / COTE, 5),
                           int(moyenne[0]), int(moyenne[1]), int(moyenne[2])]
    atlas.save(IMAGE, 'WEBP', quality=80, method=6)
    with open(TABLE, 'w', encoding='utf-8', newline='\n') as f:
        f.write("'use strict';\n/*\n * Le décor de l'église d'après les photographies : où chaque morceau se trouve\n"
                " * dans img/eglise-decor.webp (u0, v0, u1, v1, puis sa couleur moyenne), et la\n"
                " * silhouette des statues (hauteur, bord gauche, bord droit, de 0 à 1).\n"
                " * Écrit par build/decor_eglise.py : ne pas retoucher à la main.\n"
                " * Photographies : Cristo6772, août 2024 — tous droits réservés.\n */\n"
                "(function (racine) {\n  racine.EgliseDecor = {\n    image: 'img/eglise-decor.webp',\n    cases: {\n")
        for nom, c in cases.items():
            f.write("      '%s': %s,\n" % (nom, json.dumps(c)))
        f.write("    },\n    formes: {\n")
        for nom, t in formes.items():
            f.write("      '%s': %s,\n" % (nom, json.dumps(t)))
        f.write("    },\n  };\n})(typeof window !== 'undefined' ? window : globalThis);\n")
    print('%d morceaux, %d lignes sur %d — %s : %d Ko' % (len(MORCEAUX), hauteur, COTE, os.path.relpath(IMAGE, RACINE), os.path.getsize(IMAGE) // 1024))
    if '--planche' in sys.argv:
        pl = atlas.copy()
        d = ImageDraw.Draw(pl)
        for m in MORCEAUX:
            x, y = places[m['nom']]
            l, h = m['taille']
            pl.paste(m['brut'], (x, y))      # la planche montre la prise telle quelle, le contour dessus
            d.rectangle((x, y, x + l, y + h), outline=(255, 255, 0))
            d.text((x + 3, y + 2), m['nom'], fill=(255, 255, 0))
            if m['nom'] in formes:
                t = formes[m['nom']]
                d.line([(x + u0 * l, y + v * h) for v, u0, u1 in t] + [(x + u1 * l, y + v * h) for v, u0, u1 in t[::-1]], fill=(0, 255, 255), width=1)
        os.makedirs(os.path.join(ICI, 'maquette'), exist_ok=True)
        pl.crop((0, 0, COTE, hauteur)).save(os.path.join(ICI, 'maquette', 'decor-planche.jpg'), quality=85)


if __name__ == '__main__':
    principal()
