# Commis — repas & courses

Outil personnel pour planifier les repas de la semaine avec les promotions de **Migros, Coop et Lidl**, générer la liste de courses et suivre le budget. Usage privé : pas de compte, pas d'abonnement.

## Ouvrir Commis

- **En ligne (ordinateur et téléphone)** : **https://lucasdominguescoelho-byte.github.io/commis/** (sur iPhone : Safari › Partager › Sur l'écran d'accueil).
- **Sur le téléphone** : ouvrir l'adresse dans Safari, puis *Partager → Sur l'écran d'accueil*. Commis s'ouvre alors comme une app et fonctionne aussi hors ligne (la liste de courses reste disponible au magasin).
- **En local** : double-cliquer sur `Ouvrir Commis.command` (serveur sur `http://localhost:8765`). Ouvrir `index.html` directement fonctionne aussi, mais sans les promotions.

Chaque appareil et chaque adresse a **ses propres données** (recettes, plannings, réglages). Pour passer de l'un à l'autre : *Réglages → Exporter une sauvegarde*, puis *Restaurer* sur l'autre appareil.

## Où sont les données

Dans le navigateur de chaque appareil (IndexedDB). Rien de personnel n'est envoyé sur Internet, sauf les codes-barres cherchés dans Open Food Facts : le site publié ne contient que le code, les recettes d'exemple et les promotions. Vider les données de navigation efface aussi Commis : exportez une sauvegarde de temps en temps.

## Les promotions

Mises à jour chaque matin par GitHub Actions (`.github/workflows/promotions.yml`), qui lance `outils/promotions.py` et publie le résultat dans `data/promotions.json`. L'app relit ce fichier à l'ouverture.

| Magasin | Source | Langue |
| --- | --- | --- |
| Lidl | site officiel lidl.ch, « Promotions de la semaine » | français |
| Migros | aktionis.ch (agrégateur suisse d'actions) | allemand, traduit |
| Coop | aktionis.ch | allemand, traduit |

Migros et Coop bloquent l'accès automatisé à leurs propres sites ; Commis ne contourne pas ce blocage et passe par l'agrégateur.

- **Traduction** : un dictionnaire (`DICO` dans `outils/promotions.py`) reconnaît ~180 produits courants (viande, poisson, légumes, fromages, épicerie…) et leur donne un nom français, un rayon et un mot-clé qui les relie aux ingrédients des recettes. Un produit non reconnu garde son nom allemand et n'est relié à aucune recette.
- **Dates** : Lidl et Migros donnent les dates exactes. Coop souvent pas : la fin est alors estimée au dimanche (« env. » dans l'app).
- **Limites** : les actions Migros varient selon les coopératives régionales ; les prix « dès 2 articles » ou « exemple » sont signalés.
- **Ajouter un produit au dictionnaire** : ajouter une ligne `E('Libellé', 'rayon', 'mot-clé', [motifs allemands], [motifs français])` avant les entrées plus générales.

Les promotions saisies à la main ou importées (*Promotions → ↑*) ne sont jamais écrasées par la mise à jour. Format d'import : voir l'en-tête de `js/sources.js`.

Lancer la mise à jour à la main :

```
python3 outils/promotions.py
```

## Recettes : validées, à tester, générées

- **Mes recettes** ne montre que les recettes **testées et validées**. Une recette écrite à la main est validée par défaut (case à décocher dans l'éditeur).
- **À tester** ne contient que les recettes qu'on y met soi-même : *Ajouter à « À tester »* sur une fiche, une idée générée gardée, ou une nouvelle recette non validée. Après les avoir cuisinées : *Testée, je valide*.
- **Cuisiner** (fiche recette ou prochain repas sur l'Accueil) ouvre le mode cuisine : ingrédients à cocher, puis une étape par écran en grand avec les quantités utiles, écran maintenu allumé (flèches, balayage ou clavier).
- **Toutes** montre toute la bibliothèque (recettes d'exemple, importées, validées ou non).
- **Générer** compose des recettes sur le moment avec les promotions de la semaine et, si on le demande, les aliments du frigo (voir « Génération de recettes »).
- **Importer** (en haut de Recettes) ajoute des recettes depuis un fichier `.json` (format `commis-recettes` ou une sauvegarde Commis) sans rien effacer : les recettes déjà présentes ne reçoivent que leur nouvelle photo (validations, favoris et modifications conservés), les nouvelles arrivent dans « Toutes ». Les recettes tirées d'un livre du commerce restent dans ce fichier privé et ne sont jamais publiées dans ce dépôt public.

## Frigo

Ce qu'il reste à la maison, ajouté de trois façons :

- **Scanner** un code-barres avec la caméra (ZXing, ou le détecteur natif du navigateur). Le produit est cherché dans [Open Food Facts](https://world.openfoodfacts.org), base collaborative et gratuite : nom, marque, quantité, photo.
- **Ticket de caisse** photographié : le texte est lu sur l'appareil par [Tesseract.js](https://tesseract.projectnaptha.com) (gratuit, sans compte), les articles alimentaires sont reconnus et proposés, on vérifie avant d'ajouter. Le module de lecture (quelques Mo) se télécharge à la première utilisation.
- **Saisie** à la main, avec une date « à consommer avant » facultative.

Les aliments servent à la génération de recettes **uniquement quand on coche « Mon frigo »**. Dans la liste de courses, ce qui est déjà au frigo est signalé et n'est pas compté dans le total (case « Déduire le frigo »).

La caméra demande que Commis soit ouvert en HTTPS (l'adresse GitHub Pages) et l'autorisation du navigateur.

## Génération de recettes (gratuite, sans IA)

`js/generateur.js` compose les recettes sur l'appareil, sans rien envoyer sur Internet et sans clé :

- une base d'environ 60 ingrédients courants (portion par personne, prix habituel, cuisson) ;
- 14 modèles de plats : poêlée, pâtes, gratin, risotto, curry, soupe, salade, plaque au four, papillote, quiche, omelette, wok, air fryer, mijoté ;
- vos **ustensiles** (Réglages) : seuls les plats faisables sont proposés, et les étapes s'adaptent (air fryer au lieu du four, velouté mixé ou soupe en morceaux sans mixeur, mijoteuse ou cocotte-minute, cuiseur à riz…) ;
- une **photo d'illustration** par type de plat (Unsplash, voir `assets/img/recettes/CREDITS.md`) ;
- pour chaque idée, Commis essaie des centaines de combinaisons et garde celles qui utilisent le plus de produits en promotion (gros rabais d'abord) et d'aliments du frigo cochés, en respectant régime, allergies et aliments évités. « Autres idées » change de plat et de protéine principale.

C'est fiable et simple, mais moins inventif qu'un chef : pour élargir le répertoire, ajouter des ingrédients (tableaux `P`, `L`, `F`) ou des modèles (tableau `T`).

## Ce qui reste une estimation

- **Prix des recettes** : coût indiqué pour chaque ingrédient (prix habituel), auquel on applique le rabais de la promotion correspondante.
- **Proposition de planning** : calcul local par règles et score (économies, réutilisation des produits frais, favoris, budget), sans intelligence artificielle.
- **Allergies et régimes** : détection par mots-clés dans le nom des ingrédients. Utile, mais pas infaillible.

## Photos

Recettes d'exemple : photos Unsplash (licence libre), détail dans `assets/img/recettes/CREDITS.md`. Promotions : photos des produits publiées par les sources.

## Organisation du code

Aucune dépendance, aucune compilation : HTML, CSS et JavaScript simples ; Python (bibliothèque standard) pour la récupération des promotions.

| Fichier | Rôle |
| --- | --- |
| `index.html`, `manifest.webmanifest`, `sw.js` | Page, installation sur téléphone, fonctionnement hors ligne |
| `css/app.css` | Identité visuelle, mise en page, responsive, impression |
| `js/core.js` | Constantes (magasins, rayons), dates, stockage IndexedDB, sauvegarde |
| `js/seed.js` | Recettes d'exemple et leurs photos |
| `js/engine.js` | Préférences, promotions ↔ ingrédients, coûts, planning, liste de courses, budget |
| `js/sources.js` | Lecture de `data/promotions.json`, import JSON |
| `js/generateur.js` | Générateur de recettes local (ingrédients, modèles de plats) |
| `js/ui.js`, `js/app.js` | Composants, navigation |
| `js/views/*.js` | Une page par fichier |
| `outils/promotions.py` | Récupération et traduction des promotions |
| `.github/workflows/promotions.yml` | Mise à jour quotidienne et publication |
