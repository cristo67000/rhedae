# Rhedae — les mystères de Rennes-le-Château

Une application web progressive (PWA), hors ligne, sur le modèle d'[Arcanes](https://cristo67000.github.io/arcanes/) :
l'affaire de Rennes-le-Château, pièce par pièce. En 1885, un curé de trente-trois
ans arrive dans un village perché de l'Aude ; en vingt ans il restaure son église,
bâtit une villa et une tour, et dépense bien plus que ne gagne un prêtre de
campagne. Quarante ans après sa mort, un hôtelier raconte l'histoire d'un trésor ;
puis viennent de faux parchemins, une société secrète inventée, une descendance du
Christ et un roman lu dans le monde entier. Le dossier démêle ce qui est attesté,
ce qui est discuté et ce qui a été fabriqué.

- **253 fiches** en six rubriques : les **personnages** (les prêtres du Razès,
  l'entourage de Saunière, les évêques, les seigneurs du lieu, les figures que la
  légende a enrôlées, les fabricants du mythe, ceux qui l'ont démonté), les
  **lieux**, les **hypothèses**, les **pièces du dossier** (le décor de l'église,
  les pierres, les papiers, les signes), le **contexte historique** et les **livres
  et films** ;
- des **hypothèses pesées** : pour chacune, qui l'a lancée et quand, ce qui plaide
  pour elle, ce qui s'y oppose, et un verdict en clair — *établi*, *plausible*,
  *fragile*, *légende* ou *mystification*. L'onglet « Hypothèses » en dresse la
  balance d'ensemble ;
- une **chronologie** d'une centaine de dates, de l'oppidum à l'église fermée pour
  sondages en novembre 2026, où chaque date dit ce qu'elle vaut : *attestée* par
  un document d'époque, *discutée*, *légendaire*, ou *fabriquée*. Quatre pastilles
  filtrent la frise : ne garder que l'attesté, c'est lire l'histoire ; n'y ajouter
  que le fabriqué, c'est voir la mystification se monter pièce à pièce ;
- une **carte détaillée**, dessinée par l'application elle-même et donc hors
  ligne : relief estompé, courbes de niveau, rivières, routes, voie ferrée,
  villages, sommets, et le plan du village maison par maison. Trois cadres d'un
  seul tenant — la région (de Montségur à la mer), le Haut-Razès, le village — entre
  lesquels on zoome continûment ; on touche un point, on lit sa fiche ; « Me
  situer », facultatif, pose un point bleu ; chaque fiche de lieu a son plan de
  situation, ses coordonnées et son itinéraire ;
- des **parcours guidés** : l'affaire en seize étapes, d'où venait l'argent, une
  journée sur place, lire l'église, la fabrique d'un faux, les trésors du Razès,
  Poussin et l'Arcadie, l'abbé Boudet, ceux qui ont enquêté ;
- des **illustrations** : des images anciennes du domaine public (portraits,
  cartes postales, tableaux), avec leur crédit et leur source, et une trentaine
  de photographies des lieux tels qu'ils sont, prises sur place en août 2024
  par Cristo6772 (tous droits réservés) ;
- des renvois partout : chaque fiche mène aux autres et dit qui la cite ; les
  dates de la chronologie où elle paraît ; des liens « Pour aller plus loin » ;
- deux thèmes, « vélin » et « nuit », quatre tailles de texte, une police à
  empattements ou non ; les fiches gardées et l'avancement de la lecture.

Rien n'est envoyé nulle part : pas de compte, pas de serveur, pas de mesure
d'audience, `connect-src 'self'`. La carte ne charge aucune tuile ; la position,
si on la demande, ne quitte jamais l'appareil. Voir `confidentialite.html`.

## L'esprit du dossier

On raconte l'affaire comme un historien : pour chaque fait, on dit d'où on le
tient. Ce que les documents établissent — les archives de l'évêché de Carcassonne,
les carnets et les comptes de l'abbé Saunière, les actes notariés, la presse
d'époque — se dit à l'indicatif. Ce qui est tradition ou légende est rendu à son
auteur et à sa date (« selon Noël Corbu, en 1956… »). Ce qui est une fabrication
est nommé comme tel, avec qui l'a faite et comment on le sait. Pas de
sensationnel, pas de mépris non plus pour ceux qui cherchent : on montre.

Les textes sont **originaux**. Ils s'appuient sur les travaux de René
Descadeillas, Jacques Rivière, Bruno de Monts, Pierre Jarnac, Claire Corbu et
Antoine Captier, Jean-Jacques Bedu, Laurent Buchholtzer, Christian Doumergue, Bill
Putnam et John Edwin Wood, Paul Smith, et sur les pièces publiées par
l'association RLCdoc. Ce que les sources laissent incertain est dit incertain.

## Structure

```
index.html  manifest.webmanifest  sw.js  confidentialite.html
css/        theme.css (couleurs, polices) · app.css · carte.css
js/         un module par écran ou par rôle — voir l'en-tête de chacun
js/carte.js     la carte : le monde, les paliers de détail, les noms, les gestes
js/fiche.js     la fiche, et ce que chaque rubrique y ajoute
data/       dossier.json, manifeste.json — produits par build/construire.mjs ;
            carte.json, les tracés de la carte — produit par build/fond_de_carte.py
img/        relief-*.webp, le relief de la carte (build/fond_de_carte.py) ;
            les illustrations en WebP (build/illustrer.py)
icons/      icônes, image d'aperçu (build/generer-icones.py)
build/      les sources du dossier et les outils
build/articles/*.txt   les fiches
build/plan.txt         le plan : toutes les fiches, avec leur identifiant
build/chronologie.txt  la chronologie
build/parcours.txt     les parcours guidés
build/liens*.txt       les liens « Pour aller plus loin »
build/illustrations.txt  les illustrations, et d'où elles viennent
```

Zéro build à l'exécution : des fichiers statiques, servis tels quels. Le seul
« build » est celui des données.

## Écrire une fiche

Le format est décrit en tête de `build/construire.mjs` :

```
@ tour-magdala
cat: lieux
groupe: village
nom: Tour Magdala
alias: tour de l'abbé Saunière, bibliothèque de Saunière
geo: 42.92783, 2.26198
lieu: Rennes-le-Château, Aude
type: tour
echelle: village
def: La tour néogothique que l'abbé Saunière fit bâtir au bord du plateau…
texte: Un paragraphe, avec des renvois comme [[berenger-sauniere|Saunière]] et de l'*italique*.
texte: Un second paragraphe.
voir-sur-place: Ce qu'on y voit aujourd'hui.
repere: 1901 — Début du chantier.
voir: villa-bethanie, belvedere-et-orangerie
```

Une hypothèse porte en plus `statut:`, `origine:`, des `pour:`, des `contre:` et
un `verdict:` ; une pièce du dossier un `statut:` (authentique, discuté, disparu,
faux). `[[id|libellé]]` renvoie à une fiche. La chronologie, les parcours et les
liens ont chacun leur fichier, dont l'en-tête donne le format.

`node build/construire.mjs` compile le tout en `data/dossier.json` et échoue au
moindre défaut : identifiant en double, renvoi vers une fiche qui n'existe pas,
italique mal fermée, lieu sans coordonnées, repères dans le désordre. Il écrit un
rapport dans `build/rapport.txt` (fiches que personne ne cite, fiches sans lien,
fiches prévues au plan et pas encore écrites).

## La carte

`python build/fond_de_carte.py` fabrique le fond une fois pour toutes :

- le **relief**, à partir des « Terrain Tiles » (Mapzen, programme Open Data
  d'Amazon) : estompage, teinte selon l'altitude, courbes de niveau, en trois
  cadres et deux ambiances — six images WebP dans `img/` ;
- les **tracés**, à partir d'OpenStreetMap (© les contributeurs d'OpenStreetMap,
  licence ODbL) : rivières, routes, voie ferrée, villages, sommets, et le bâti du
  village — simplifiés et rangés dans `data/carte.json`.

Les téléchargements restent dans `build/.sources-carte/` (hors du dépôt). Il faut
Python avec `numpy` et `Pillow`.

## Les illustrations

`python build/illustrer.py` lit `build/illustrations.txt`, télécharge chaque
fichier depuis Wikimedia Commons, **refuse toute licence qui n'est pas le domaine
public ou CC0**, recadre, réduit, convertit en WebP et écrit
`build/illustrations.json`, que `construire.mjs` rattache aux fiches. Le service
worker range les illustrations dans un cache à part, `rhedae-images`, où chacune
entre la première fois qu'on la voit.

Une entrée peut porter `photo:` au lieu de `commons:` : c'est alors une
photographie personnelle, prise sur place en août 2024 par Cristo6772 et
créditée « Photographie : Cristo6772 · tous droits réservés ». Les originaux
sont dans `build/.sources-images/photos/`, hors du dépôt ; l'image publiée est
réduite, convertie en WebP et ne garde aucune métadonnée (ni lieu, ni appareil).
Ces photographies ne sont pas sous licence libre : on ne les réutilise pas sans
l'accord de leur auteur.

## Épreuves

```
node build/construire.mjs          # le dossier, et build/rapport.txt
node build/essais_statiques.mjs    # coquille, version, scripts, renvois, lieux dans leur cadre, images, parcours, carte
node build/verifier_liens.mjs      # chaque lien répond (en ligne)
python build/illustrer.py --verifier
```

Pour développer sans que le service worker serve les anciens fichiers :
`index.html?sans-sw`. Le serveur local : `node -e "import('./build/serveur_local.mjs').then((m) => m.demarrerServeur(8231))"`.

Toute retouche de l'application : incrémenter `VERSION` dans `sw.js` **et**
`application-version` dans `index.html` (une épreuve statique le vérifie).
