"""
Dessine les icônes de l'application : la tour, et une pomme bleue à sa fenêtre.

    python build/generer-icones.py

Écrit icons/icon-192.png, icon-512.png, icon-maskable-512.png (le motif plus
petit, pour le masque des téléphones) et apercu-1200x630.png (le lien partagé).
"""
import os
from PIL import Image, ImageDraw, ImageFont

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(os.path.dirname(ICI), 'icons')
NUIT, OR, BLEU, VELIN = (20, 26, 46), (225, 189, 98), (127, 160, 232), (245, 239, 226)

# la tour, dans un carré de 48 : les mêmes tracés que la marque de index.html
TOUR = [[(11, 42), (11, 19), (14.5, 19), (14.5, 15), (18.5, 15), (18.5, 19), (22.5, 19), (22.5, 15), (26.5, 15), (26.5, 19), (30, 19)],
        [(30, 42), (30, 11), (28.5, 11), (28.5, 7), (31.5, 7), (31.5, 9.5), (34.5, 9.5), (34.5, 7), (37.5, 7), (37.5, 11), (36, 11), (36, 42)],
        [(7, 42), (41, 42)]]


def motif(dessin, x0, y0, cote):
    e = cote / 48.0
    for ligne in TOUR:
        pts = [(x0 + x * e, y0 + y * e) for x, y in ligne]
        dessin.line(pts, fill=OR, width=max(2, int(round(2.7 * e))), joint='curve')
        r = 1.35 * e
        for (x, y) in pts:
            dessin.ellipse([x - r, y - r, x + r, y + r], fill=OR)
    cx, cy, r = x0 + 20.5 * e, y0 + 30 * e, 3.3 * e
    dessin.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BLEU)


def icone(taille, part, nom, arrondi=True):
    sur = 4
    im = Image.new('RGBA', (taille * sur, taille * sur), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if arrondi:
        d.rounded_rectangle([0, 0, taille * sur - 1, taille * sur - 1], radius=int(taille * sur * 0.2), fill=NUIT)
    else:
        d.rectangle([0, 0, taille * sur, taille * sur], fill=NUIT)
    cote = taille * sur * part
    motif(d, (taille * sur - cote) / 2, (taille * sur - cote) / 2 - cote * 0.02, cote)
    im.resize((taille, taille), Image.LANCZOS).save(os.path.join(SORTIE, nom))


def apercu():
    sur = 2
    l, h = 1200 * sur, 630 * sur
    im = Image.new('RGB', (l, h), NUIT)
    d = ImageDraw.Draw(im)
    motif(d, 110 * sur, 150 * sur, 330 * sur)
    def police(noms, taille):
        for n in noms:
            try:
                return ImageFont.truetype(n, taille)
            except OSError:
                continue
        return ImageFont.load_default()
    serif = police(['georgiab.ttf', 'timesbd.ttf', 'DejaVuSerif-Bold.ttf'], 120 * sur)
    petit = police(['georgiai.ttf', 'timesi.ttf', 'DejaVuSerif-Italic.ttf'], 44 * sur)
    d.text((500 * sur, 210 * sur), 'Rhedae', font=serif, fill=VELIN)
    d.text((504 * sur, 360 * sur), 'les mystères de', font=petit, fill=OR)
    d.text((504 * sur, 415 * sur), 'Rennes-le-Château', font=petit, fill=OR)
    im.resize((1200, 630), Image.LANCZOS).save(os.path.join(SORTIE, 'apercu-1200x630.png'))


os.makedirs(SORTIE, exist_ok=True)
icone(192, 0.70, 'icon-192.png')
icone(512, 0.70, 'icon-512.png')
icone(512, 0.52, 'icon-maskable-512.png', arrondi=False)
apercu()
print('icônes écrites dans icons/')
