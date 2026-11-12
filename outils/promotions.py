#!/usr/bin/env python3
"""Commis — récupère les vraies promotions de la semaine et écrit data/promotions.json.

Sources (pages publiques, lues une fois par jour) :
  - Lidl   : site officiel lidl.ch, en français (« Promotions de la semaine »)
  - Migros : aktionis.ch, agrégateur suisse d'actions, en allemand
  - Coop   : aktionis.ch, idem
Migros et Coop refusent l'accès automatisé à leur propre site : on ne le contourne pas.

Les noms allemands sont reconnus grâce au dictionnaire DICO ci-dessous, qui donne
un libellé français, un rayon et le mot-clé reliant la promotion aux ingrédients
des recettes. Un produit non reconnu garde son nom d'origine et n'est relié à
aucune recette (mieux vaut ne rien relier que relier faux).

Uniquement la bibliothèque standard de Python 3.9+. Utilisation :
    python3 outils/promotions.py                 # écrit data/promotions.json
    python3 outils/promotions.py --cache /tmp/x  # réutilise les pages déjà téléchargées (tests)
"""
import argparse
import datetime as dt
import html
import json
import os
import re
import sys
import time
import unicodedata
import urllib.request

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SORTIE = os.path.join(RACINE, 'data', 'promotions.json')
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
PAUSE = 1.5  # secondes entre deux pages d'un même site
AUJOURDHUI = dt.date.today()

LIDL_URL = 'https://www.lidl.ch/c/fr-CH/store/promotions-de-la-semaine/a10106737'
AKTIONIS = 'https://www.aktionis.ch'
# Rayons alimentaires d'aktionis.ch → rayons de Commis
AK_RAYONS = {
    '7-33': 'vp',       # Fleisch / Wurstwaren
    '7-228112': 'vp',   # Fisch / Meeresfrüchte
    '7-34': 'fl',       # Früchte / Gemüse
    '7-36': 'lait',     # Milchprodukte / Eier
    '7-29': 'boul',     # Backwaren / Patisserie
    '7-31': 'epi',      # Vorräte
    '7-32': 'epi',      # Fertiggerichte
    '7-30': 'epi',      # Cerealien
    '7-38': 'surg',     # Tiefkühlprodukte
}


# --------------------------------------------------------------------------- texte

def norm(s):
    """minuscules, sans accents ni ponctuation : « Rüebli-Torte » → « ruebli torte »."""
    s = str(s or '').lower().replace('ß', 'ss').replace('œ', 'oe').replace('æ', 'ae')
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()


def propre(s):
    return re.sub(r'\s+', ' ', html.unescape(str(s or ''))).strip()


# --------------------------------------------------------------------------- dictionnaire
# (libellé FR, rayon, mot-clé recette, motifs allemands, motifs français)
# Les motifs sont des expressions régulières appliquées au texte normalisé.
# Le premier motif qui correspond l'emporte : les cas particuliers passent avant les généraux.
# Mot-clé recette : alternatives séparées par « | » (jamais « pate » seul : « Pâte brisée ») ; chaque alternative doit apparaître
# entièrement dans le nom d'un ingrédient (« emince poulet » → « Émincé de poulet »).
# Mot-clé vide : produit affiché, mais relié à aucune recette.
E = lambda label, cat, match, de=(), fr=(): (label, cat, match, tuple(de), tuple(fr))
DICO = [
    # Produits transformés : à reconnaître avant leurs ingrédients
    E('Épices et assaisonnements', 'epi', '', [r'gewurz', r'wurzmischung', r'salat mix', r'krauter', r'marinade', r'chili mix', r'bratensauce'], [r'epice', r'assaisonnement', r'marinade']),
    E('Pâte à tartiner', 'epi', '', [r'aufstrich', r'parfait mit leber'], [r'a tartiner']),
    E('Jus', 'bois', '', [r'saft\b', r'safte\b', r'nektar'], [r'\bjus\b', r'nectar']),
    E('Compote', 'epi', '', [r'fruchtmus', r'apfelmus', r'\bmus\b'], [r'compote']),
    E('Chocolat', 'epi', '', [r'schokolade', r'schoggi', r'kakao', r'cailler', r'mikado', r'minor\b'], [r'chocolat', r'cacao']),
    E('Glaces', 'surg', '', [r'ice cream', r'\bglace\b', r'solero', r'\beis\b', r'roulade'], [r'\bglace', r'cornet glace']),
    E('Pizza', 'epi', '', [r'pizza', r'piccolinis'], [r'pizza']),
    E('Nuggets de poulet', 'vp', '', [r'nuggets', r'crispy'], [r'nuggets']),
    E('Cordon-bleu', 'vp', 'cordon bleu', [r'cordon ?bleu'], [r'cordon ?bleu']),
    E('Frites', 'surg', '', [r'pommes frites', r'\bfrites\b'], [r'\bfrites\b']),
    E('Rösti', 'epi', '', [r'rosti'], [r'\brosti']),
    E('Purée de pommes de terre', 'epi', '', [r'kartoffelstock'], [r'puree de pommes de terre']),
    E('Fondue au fromage', 'lait', 'fondue', [r'fondue'], [r'fondue']),
    E('Fromage à raclette', 'lait', 'raclette', [r'raclette'], [r'raclette']),
    E('Fromage en tranches', 'lait', '', [r'schmelzkase'], [r'fromage fondu']),
    E('Épinards à la crème', 'surg', '', [r'rahmspinat'], [r'epinards a la creme', r'epinards haches']),
    E('Lait de coco', 'epi', 'lait coco', [r'kokosmilch'], [r'lait de coco']),
    E('Noix de coco', 'epi', '', [r'kokos(?!ol|fett|milch)'], [r'noix de coco', r'coco rape']),
    E('Boisson lactée', 'lait', '', [r'bifidus', r'\bdrinks?\b', r'trinkjo', r'benecol'], [r'boisson lactee', r'\bdrink']),
    E('Yogourts', 'lait', 'yogourt', [r'joghurt', r'jogurt', r'petit suisse'], [r'yogo?urt', r'yaourt', r'oikos', r'activia']),
    E('Desserts', 'lait', '', [r'pudding', r'creme dessert', r'tiramisu'], [r'pudding', r'dessert']),
    E('Raviolis et pâtes farcies', 'epi', '', [r'ravioli', r'tortelloni', r'tortellini', r'mezzelune', r'cappelletti'], [r'ravioli', r'tortell', r'pates fraiches farcies']),
    E('Fruits séchés', 'epi', '', [r'getrocknet', r'dorr'], [r'seche', r'seches', r'sechee']),
    E('Pâtisserie', 'boul', '', [r'torte\b', r'kuchen', r'schnitten', r'muffin', r'donut', r'berliner', r'guetzli', r'biberli', r'gipfeli', r'croissant', r'nussrolle', r'russenzopf', r'patisserie'],
      [r'croissant', r'\btarte', r'gateau', r'muffin', r'biscuit', r'brioche', r'cheese twist', r'couronne']),
    # Épicerie
    E('Farine', 'epi', 'farine', [r'mehl\b', r'weissmehl', r'halbweissmehl', r'zopfmehl'], [r'farine']),
    E('Pain', 'boul', 'pain', [r'\bbrot\b', r'nussbrot', r'baguette', r'weggli', r'\bzopf\b', r'sandwich hell', r'toastbrot'], [r'\bpain\b', r'baguette', r'tresse']),
    E('Spaghetti', 'epi', 'spaghetti', [r'spaghetti'], [r'spaghetti']),
    E('Penne', 'epi', 'penne', [r'penne'], [r'penne']),
    E('Cornettes', 'epi', 'cornette', [r'hornli'], [r'cornette']),
    E('Macaronis', 'epi', 'macaroni', [r'magronen', r'macaroni'], [r'macaroni']),
    E('Lasagnes', 'epi', '', [r'lasagne'], [r'lasagne']),
    E('Gnocchi', 'epi', 'gnocchi', [r'gnocchi'], [r'gnocchi']),
    E('Knöpfli', 'epi', 'knopfli|spatzli', [r'knopfli', r'spatzli'], [r'knopfli', r'spatzli']),
    E('Pâtes (autres formes)', 'epi', '', [r'spiralen', r'muscheli', r'fusilli', r'farfalle', r'fiori', r'girandole'], [r'fusilli', r'farfalle', r'spirales', r'coquillettes']),
    E('Tagliatelles', 'epi', 'tagliatelle|nouille', [r'tagliatelle', r'nudeln'], [r'tagliatelle', r'nouilles']),
    E('Pâtes (assortiment)', 'epi', 'spaghetti|penne|cornette|nouille|tagliatelle|macaroni', [r'teigwaren'], [r'\bpates\b']),
    E('Riz', 'epi', 'riz', [r'\breis\b', r'risotto'], [r'\briz\b', r'risotto']),
    E('Sucre', 'epi', 'sucre', [r'zucker'], [r'\bsucre\b']),
    E('Huile de coco', 'epi', '', [r'kokosol', r'kokosfett'], [r'huile de coco']),
    E("Huile d'olive", 'epi', 'huile olive', [r'olivenol'], [r'huile d olive']),
    E('Huile', 'epi', 'huile colza|huile tournesol', [r'sonnenblumenol', r'rapsol', r'speiseol', r'friture', r'kokosol', r'kokosfett'], [r'huile']),
    E('Graisse de cuisson', 'lait', '', [r'speisefett', r'pflanzenol creme'], [r'graisse']),
    E('Bouillon de légumes', 'epi', 'bouillon legume|bouillon', [r'gemuse ?bouillon', r'bouillon vegetal', r'gemuse bouillon'], [r'bouillon de legumes', r'bouillon vegetal']),
    E('Bouillon de viande', 'epi', 'bouillon boeuf|bouillon poulet|bouillon viande', [r'ochsen ?bouillon', r'rinds ?bouillon', r'huhner ?bouillon', r'fleisch ?bouillon'], [r'bouillon de boeuf', r'bouillon de poule', r'bouillon de viande']),
    E('Bouillon', 'epi', 'bouillon', [r'bouillon'], [r'bouillon']),
    E('Concentré de tomates', 'epi', 'concentre tomate', [r'tomatenpuree', r'tomatenmark'], [r'concentre de tomate', r'puree de tomate']),
    E('Tomates en conserve', 'epi', 'tomate pelee|tomate concassee|tomate hachee',
      [r'tomaten gehackt', r'gehackte tomaten', r'pelati', r'geschalte tomaten', r'passata'], [r'tomates concassees', r'tomates pelees', r'tomates hachees', r'passata', r'pulpe de tomate']),
    E('Pesto', 'epi', 'pesto', [r'pesto', r'pesti'], [r'pesto']),
    E('Moutarde', 'epi', 'moutarde', [r'\bsenf\b'], [r'moutarde']),
    E('Mayonnaise', 'epi', 'mayonnaise', [r'mayonnaise'], [r'mayonnaise']),
    E('Vinaigre', 'epi', 'vinaigre', [r'essig'], [r'vinaigre']),
    E('Pois chiches', 'epi', 'pois chiche', [r'kichererbsen'], [r'pois chiches']),
    E('Lentilles', 'epi', 'lentille', [r'linsen'], [r'lentilles']),
    E('Haricots verts', 'fl', 'haricot vert', [r'bohnen grun', r'grune bohnen', r'buschbohnen'], [r'haricots verts']),
    E('Haricots', 'epi', 'haricot', [r'bohnen', r'kidney'], [r'haricots']),
    E('Maïs', 'epi', 'mais', [r'sussmais', r'\bmais\b'], [r'\bmais\b']),
    E('Olives', 'epi', 'olive', [r'oliven'], [r'\bolives\b']),
    E('Thon', 'vp', 'thon', [r'thunfisch', r'rio mare'], [r'\bthon\b']),
    E('Tofu', 'epi', 'tofu', [r'tofu'], [r'tofu']),
    E('Sauce soja', 'epi', 'soja', [r'sojasauce'], [r'sauce soja']),
    E('Amandes', 'epi', 'amande', [r'mandeln'], [r'amandes']),
    E('Noisettes', 'epi', 'noisette', [r'haselnuss'], [r'noisettes']),
    E('Fruits à coque', 'epi', '', [r'erdnuss', r'nusse\b', r'cashew', r'pistazien'], [r'cacahuete', r'\bnoix\b', r'cajou', r'pistache']),
    E('Châtaignes', 'fl', 'chataigne', [r'marroni', r'kastanien'], [r'chataigne', r'marron']),
    E('Dattes', 'fl', 'datte', [r'datteln\b', r'datteln medjool'], [r'dattes']),
    # Poisson
    E('Saumon fumé', 'vp', 'saumon fume', [r'rauchlachs', r'lachs.*gerauchert', r'gerauchert.*lachs'], [r'saumon fume']),
    E('Saumon', 'vp', 'saumon', [r'lachs'], [r'saumon']),
    E('Truite fumée', 'vp', '', [r'forelle.*gerauchert'], [r'truite fumee']),
    E('Truite', 'vp', 'truite', [r'forelle'], [r'truite']),
    E('Dorade', 'vp', 'dorade', [r'dorade'], [r'dorade']),
    E('Cabillaud', 'vp', 'cabillaud', [r'dorsch', r'kabeljau', r'bacalao', r'skrei'], [r'cabillaud']),
    E('Pangasius', 'vp', 'pangasius', [r'pangasius'], [r'pangasius']),
    E('Filets de perche', 'vp', 'perche', [r'egli'], [r'perche']),
    E('Sole', 'vp', 'sole', [r'rotzunge', r'seezunge'], [r'\bsole\b']),
    E('Lotte', 'vp', 'lotte', [r'seeteufel'], [r'\blotte\b']),
    E('Crevettes', 'vp', 'crevette', [r'crevet', r'garnelen', r'scampi'], [r'crevette', r'scampi']),
    E('Moules', 'vp', 'moule', [r'miesmuscheln', r'\bmuscheln\b'], [r'\bmoules\b']),
    E('Caviar', 'vp', '', [r'caviar', r'kaviar'], [r'caviar']),
    # Viande
    E('Paupiettes', 'vp', '', [r'fleischvogel'], [r'paupiette']),
    E('Viande hachée', 'vp', 'viande hachee', [r'hackfleisch', r'gehacktes'], [r'viande hachee', r'hache de boeuf', r'hache mixte']),
    E('Boulettes de viande', 'vp', '', [r'fleischkugel', r'hackballchen', r'meatballs'], [r'boulettes']),
    E('Burgers', 'vp', '', [r'\bburger'], [r'\bburger']),
    E('Émincé de poulet', 'vp', 'emince poulet|poitrine poulet', [r'poulet ?geschnetzelt', r'geschnetzeltes poulet'], [r'emince de poulet', r'emince de poitrine de poulet']),
    E('Poitrine de poulet', 'vp', 'poitrine poulet|emince poulet|filet poulet', [r'pouletbrust', r'poulet ?schnitzel', r'poulet ?brust', r'poulet mini delice', r'pouletfilet'], [r'poitrine de poulet', r'filet de poulet', r'escalope de poulet']),
    E('Cuisses de poulet', 'vp', 'cuisse poulet', [r'poulet ?schenkel', r'poulet ?flugel', r'poulet ?unterschenkel'], [r'cuisses? de poulet', r'pilons', r'ailes de poulet']),
    E('Poulet entier', 'vp', 'poulet entier', [r'poulets? ganz', r'ganzes poulet'], [r'poulet entier']),
    E('Poulet', 'vp', '', [r'poulet', r'huhn', r'hahnchen', r'chicken', r'truthahn', r'trute'], [r'poulet', r'volaille', r'dinde']),
    E('Émincé de bœuf', 'vp', 'emince boeuf', [r'rinds?geschnetzelt'], [r'emince de boeuf']),
    E('Entrecôte de bœuf', 'vp', 'entrecote', [r'entrecote'], [r'entrecote']),
    E('Filet de bœuf', 'vp', 'filet boeuf', [r'rinds?filet'], [r'filet de boeuf']),
    E('Steak de bœuf', 'vp', 'steak boeuf|steak', [r'huftsteak', r'rinds?huft', r'rumpsteak', r'rinds?steak'], [r'steak de boeuf', r'rumsteck', r'rumsteak']),
    E('Ragoût de bœuf', 'vp', 'ragout', [r'rinds?ragout', r'\bragout\b'], [r'ragout']),
    E('Rôti de bœuf', 'vp', 'roti boeuf', [r'rinds?r?braten'], [r'roti de boeuf']),
    E('Bouilli', 'vp', 'bouilli', [r'siedfleisch'], [r'bouilli']),
    E('Viande séchée', 'vp', '', [r'trockenfleisch', r'mostbrockli', r'bundnerfleisch'], [r'viande sechee']),
    E('Émincé de veau', 'vp', 'emince veau', [r'kalbs?geschnetzelt'], [r'emince de veau']),
    E('Veau', 'vp', 'veau', [r'\bkalbs?', r'veal'], [r'\bveau\b']),
    E('Filet mignon de porc', 'vp', 'filet porc', [r'schweins?filet'], [r'filet mignon', r'filet de porc']),
    E('Saucisses à rôtir', 'vp', 'saucisse rotir', [r'bratwurst'], [r'saucisses? a rotir']),
    E('Chipolatas', 'vp', 'chipolata', [r'cipollata', r'chipolata'], [r'chipolata']),
    E('Wienerli', 'vp', 'wienerli', [r'wienerli'], [r'wienerli', r'saucisses de vienne']),
    E('Cervelas', 'vp', 'cervela', [r'cervelat'], [r'cervelas']),
    E('Saucisson', 'vp', 'saucisson', [r'saucisson'], [r'saucisson']),
    E('Landjäger', 'vp', '', [r'landjager'], [r'landjager']),
    E('Salami', 'vp', 'salami', [r'salami', r'salametti'], [r'salami']),
    E('Jambon cru', 'vp', 'jambon cru', [r'rohschinken', r'prosciutto', r'coppa'], [r'jambon cru', r'prosciutto']),
    E('Jambon', 'vp', 'jambon', [r'schinken', r'schinkli', r'\bhamme\b'], [r'jambon']),
    E('Lard', 'vp', 'lardon|lard', [r'speck', r'bacon', r'rippli'], [r'\blard\b', r'lardons?', r'bacon']),
    E("Fromage d'Italie", 'vp', '', [r'fleischkase', r'lyoner'], [r'fromage d italie']),
    E('Lapin', 'vp', 'lapin', [r'kaninchen'], [r'lapin']),
    E('Sanglier', 'vp', 'sanglier', [r'wildschwein'], [r'sanglier']),
    E('Cabri', 'vp', '', [r'gitzi'], [r'cabri']),
    E('Agneau', 'vp', 'agneau', [r'lamm'], [r'agneau']),
    E('Porc', 'vp', 'porc', [r'schweins?', r'schufeli', r'costine'], [r'\bporc\b', r'quasi']),
    E('Bœuf', 'vp', '', [r'\brinds?', r'beef'], [r'\bboeuf\b']),
    # Produits laitiers
    E('Gruyère', 'lait', 'gruyere', [r'gruyere', r'greyerzer'], [r'gruyere']),
    E('Parmesan', 'lait', 'parmesan', [r'parmigiano', r'parmesan', r'grana padano'], [r'parmesan', r'parmigiano', r'grana padano']),
    E('Mozzarella', 'lait', 'mozzarella', [r'mozzarella'], [r'mozzarella']),
    E('Feta', 'lait', 'feta', [r'\bfeta\b'], [r'\bfeta\b']),
    E('Mascarpone', 'lait', 'mascarpone', [r'mascarpone'], [r'mascarpone']),
    E('Ricotta', 'lait', 'ricotta', [r'ricotta'], [r'ricotta']),
    E('Emmental', 'lait', 'emmental', [r'emmentaler'], [r'emmental']),
    E('Fromage de chèvre', 'lait', 'chevre', [r'ziegen', r'chavroux'], [r'chevre']),
    E('Cottage cheese', 'lait', 'cottage', [r'huttenkase'], [r'cottage']),
    E('Fromage frais', 'lait', '', [r'frischkase', r'tartare'], [r'fromage frais', r'tartare']),
    E('Fromage', 'lait', '', [r'kase\b', r'appenzeller', r'tilsiter', r'sbrinz', r'cheddar', r'gouda', r'vacherin', r'\btomme\b', r'etivaz', r'leerdammer', r'babybel', r'caprice des dieux', r'gorgonzola', r'mont vully', r'epoisses', r'fol epi', r'marechal', r'kaltbach', r'blochon'],
      [r'fromage', r'\btomme\b', r'vacherin', r'horloger', r'gorgonzola', r'gouda', r'emmental']),
    E('Beurre', 'lait', 'beurre', [r'\bbutter\b', r'butter modeli'], [r'\bbeurre\b']),
    E('Margarine', 'lait', '', [r'margarine'], [r'margarine']),
    E('Crème à café', 'lait', '', [r'kaffeerahm'], [r'creme a cafe']),
    E('Crème acidulée', 'lait', 'creme acidulee', [r'sauerrahm'], [r'creme acidulee']),
    E('Crème', 'lait', 'creme', [r'vollrahm', r'halbrahm', r'schlagrahm', r'\brahm\b'], [r'\bcreme\b']),
    E('Lait', 'lait', 'lait', [r'\bmilch\b', r'vollmilch', r'milchdrink'], [r'\blait\b']),
    E('Œufs', 'lait', 'oeuf', [r'\beier\b'], [r'\boeufs?\b']),
    # Fruits et légumes
    E('Patates douces', 'fl', 'patate douce', [r'susskartoffel', r'batati'], [r'patates? douces?']),
    E('Pommes de terre', 'fl', 'pomme terre', [r'kartoffel', r'erdapfel'], [r'pommes? de terre']),
    E('Carottes', 'fl', 'carotte', [r'karotte', r'r[u]e?bli\b'], [r'carotte']),
    E('Oignons', 'fl', 'oignon', [r'zwiebel'], [r'\boignons?\b']),
    E('Ail', 'fl', 'ail', [r'knoblauch'], [r'\bail\b']),
    E('Brocoli', 'fl', 'brocoli', [r'broccoli', r'brokkoli'], [r'brocoli']),
    E('Chou-fleur', 'fl', 'chou fleur', [r'blumenkohl'], [r'chou fleur']),
    E('Chou chinois', 'fl', 'chou chinois', [r'chinakohl'], [r'chou chinois']),
    E('Choux de Bruxelles', 'fl', 'chou bruxelle', [r'rosenkohl'], [r'choux de bruxelles']),
    E('Chou blanc ou rouge', 'fl', 'chou', [r'kabis', r'weisskohl', r'rotkohl'], [r'chou blanc', r'chou rouge']),
    E('Choucroute', 'fl', 'choucroute', [r'sauerkraut'], [r'choucroute']),
    E('Poireau', 'fl', 'poireau', [r'lauch'], [r'poireau']),
    E('Champignons', 'fl', 'champignon', [r'champignon', r'pilze'], [r'champignon']),
    E('Tomates cerises', 'fl', 'tomate cerise', [r'datteltomaten', r'cherrytomaten', r'cherry tomaten', r'rispentomaten'], [r'tomates? cerises?', r'tomates? cocktail']),
    E('Tomates', 'fl', 'tomate', [r'tomaten'], [r'\btomates?\b']),
    E('Poivrons', 'fl', 'poivron', [r'peperoni\b'], [r'poivron']),
    E('Courgettes', 'fl', 'courgette', [r'zucchetti', r'zucchini'], [r'courgette']),
    E('Aubergines', 'fl', 'aubergine', [r'auberginen'], [r'aubergine']),
    E('Courge', 'fl', 'courge', [r'kurbis', r'butternut'], [r'courge', r'butternut', r'potiron']),
    E('Épinards', 'fl', 'epinard', [r'spinat'], [r'epinard']),
    E('Mâche', 'fl', 'mache', [r'nusslisalat', r'feldsalat'], [r'\bmache\b']),
    E('Salade', 'fl', 'salade', [r'salat\b', r'jungblatt', r'kopfsalat', r'eisberg', r'lattich'], [r'salade', r'laitue', r'roquette']),
    E('Concombre', 'fl', 'concombre', [r'gurke'], [r'concombre']),
    E('Céleri', 'fl', 'celeri', [r'sellerie'], [r'celeri']),
    E('Betteraves', 'fl', 'betterave', [r'randen'], [r'betterave']),
    E('Fenouil', 'fl', 'fenouil', [r'fenchel'], [r'fenouil']),
    E('Asperges', 'fl', 'asperge', [r'spargel'], [r'asperge']),
    E('Herbes aromatiques', 'fl', '', [r'basilikum', r'petersilie', r'schnittlauch', r'koriander'], [r'basilic', r'persil', r'ciboulette', r'coriandre']),
    E('Citrons', 'fl', 'citron', [r'zitrone'], [r'citrons?\b']),
    E('Pommes', 'fl', 'pomme', [r'\bapfel\b', r'apfel\b', r'aepfel', r'\bapfel'], [r'\bpommes?\b']),
    E('Poires', 'fl', 'poire', [r'birne'], [r'\bpoires?\b']),
    E('Bananes', 'fl', 'banane', [r'banane'], [r'banane']),
    E('Clémentines', 'fl', 'clementine', [r'clementine', r'mandarine'], [r'clementine', r'mandarine']),
    E('Oranges', 'fl', 'orange', [r'orangen'], [r'\boranges?\b']),
    E('Raisin', 'fl', 'raisin', [r'trauben'], [r'\braisins?\b']),
    E('Kiwis', 'fl', 'kiwi', [r'kiwi'], [r'kiwi']),
    E('Mangues', 'fl', 'mangue', [r'mango'], [r'mangue']),
    E('Ananas', 'fl', 'ananas', [r'ananas'], [r'ananas']),
    E('Grenades', 'fl', 'grenade', [r'granatapfel', r'granatapfel'], [r'grenade']),
    E('Kakis', 'fl', 'kaki', [r'\bkaki'], [r'\bkaki']),
    E('Prunes', 'fl', 'prune', [r'pflaumen', r'zwetschgen'], [r'\bprunes?\b']),
    E('Petits fruits', 'fl', '', [r'beeren', r'himbeer', r'erdbeer', r'heidelbeer'], [r'framboise', r'fraise', r'myrtille', r'groseille']),
]
DICO = [(l, c, m, [re.compile(p) for p in de], [re.compile(p) for p in fr]) for (l, c, m, de, fr) in DICO]
LACHE = ({'epi', 'surg', 'fl', 'autre'}, {'epi', 'boul', 'bois', 'autre'}, {'vp', 'surg'})


def compatible(cat_dico, cat_source):
    """Le rayon du dictionnaire doit rester plausible avec celui de la source
    (« Tartare ail et fines herbes » est un fromage, pas de l'ail)."""
    if cat_dico == cat_source or cat_source == 'autre':
        return True
    return any(cat_dico in g and cat_source in g for g in LACHE)


def reconnaitre(texte, langue, cat_source):
    t = norm(texte)
    for label, cat, match, de, fr in DICO:
        motifs = de if langue == 'de' else fr
        if any(p.search(t) for p in motifs) and compatible(cat, cat_source):
            if cat == 'lait' and re.search(r'reibkase|gerieben|\brape', t) and 'râpé' not in label:
                label += ' râpé'
            return label, cat, match
    return None


# --------------------------------------------------------------------------- utilitaires

def telecharger(url, cache=None):
    if cache:
        f = os.path.join(cache, re.sub(r'[^a-zA-Z0-9]+', '_', url)[-150:] + '.html')
        if os.path.exists(f):
            with open(f, encoding='utf-8') as h:
                return h.read()
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'fr-CH,fr;q=0.9,de;q=0.6'})
    with urllib.request.urlopen(req, timeout=30) as r:
        texte = r.read().decode('utf-8', errors='replace')
    if cache:
        os.makedirs(cache, exist_ok=True)
        with open(f, 'w', encoding='utf-8') as h:
            h.write(texte)
    time.sleep(PAUSE)  # politesse : pas de rafale de requêtes
    return texte


def prix(s):
    """« 5.95 », « 6.– », « –.92 », « 2.- » → nombre (ou None)."""
    s = str(s or '').replace('–', '-').replace('—', '-').strip()
    m = re.search(r'(\d+|-)\.(\d{2}|-)', s) or re.search(r'(\d+)', s)
    if not m:
        return None
    if m.lastindex == 1:
        return float(m.group(1))
    ent = 0 if m.group(1) == '-' else int(m.group(1))
    dec = 0 if m.group(2) == '-' else int(m.group(2))
    v = ent + dec / 100
    return round(v, 2) if v > 0 else None


def conditionnement(*textes):
    for t in textes:
        t = propre(re.sub(r'<[^>]+>', ' ', t or ''))
        t = re.sub(r'\b\d+\s*(kg|g|ml|cl|dl|l)\s*=\s*[\d.,–-]+', ' ', t, flags=re.I)  # prix au kilo
        if re.search(r'\bper kg\b', t, re.I):
            return 'le kg'
        if re.search(r'\bper 100 ?g\b', t, re.I):
            return 'les 100 g'
        m = re.search(r'\b(\d+\s*[x×]\s*)?\d+(?:[.,]\d+)?\s*(kg|g|ml|cl|dl|l)\b', t, re.I)
        if m:
            q = re.sub(r'\s*[x×]\s*', ' × ', m.group(0)).replace('.', ',')
            return re.sub(r'(\d)(kg|g|ml|cl|dl|l)\b', r'\1 \2', q, flags=re.I)
        if re.search(r'\bper kg\b|\ble kg\b', t, re.I):
            return 'le kg'
        if re.search(r'\bper 100 ?g\b', t, re.I):
            return 'les 100 g'
        m = re.search(r'\b(\d+)\s*(st[uü]ck|pi[eè]ces?)\b', t, re.I)
        if m:
            return f'{m.group(1)} pièces'
    return ''


def date_iso(j, m, a):
    try:
        return dt.date(int(a), int(m), int(j)).isoformat()
    except ValueError:
        return ''


def jour(horodatage):
    """Horodatage Unix → date suisse (UTC+1, à un jour près ça suffit)."""
    if not horodatage:
        return ''
    return dt.datetime.fromtimestamp(int(horodatage) + 3600, dt.timezone.utc).date().isoformat()


def dimanche_prochain(d):
    return d + dt.timedelta(days=(6 - d.weekday()) % 7)


# --------------------------------------------------------------------------- Lidl

LIDL_RAYONS = [
    (r'fruits & legumes', 'fl'), (r'viande et volaille|poissons et fruits de mer', 'vp'),
    (r'fromages, produits laitiers', 'lait'), (r'boulangerie', 'boul'), (r'surgel', 'surg'),
    (r'boissons|vin, biere|cafe, the', 'bois'),
    (r'reserves alimentaires|huiles, epices|plats cuisines|bonbons et snacks|petit[- ]dejeuner', 'epi'),
]
LIDL_EXCLUS = r'parapharmacie|nettoyage|papier|animaux|caches|hygiene|lessive|droguerie'


def lidl(cache=None):
    page = telecharger(LIDL_URL, cache)
    vus, sortie = set(), []
    for brut in re.findall(r'data-grid-data="([^"]*)"', page):
        try:
            it = json.loads(html.unescape(brut))
        except ValueError:
            continue
        kf = it.get('keyfacts') or {}
        chemin = unicodedata.normalize('NFD', (kf.get('wonCategoryPrimary') or '').lower())
        chemin = ''.join(c for c in chemin if unicodedata.category(c) != 'Mn')
        if it.get('category') != 'Food' or re.search(LIDL_EXCLUS, chemin):
            continue
        rayon = next((c for p, c in LIDL_RAYONS if re.search(p, chemin)), 'epi')
        titre = propre(it.get('title') or it.get('fullTitle'))
        complet = propre(it.get('fullTitle'))
        marque = propre(complet[:len(complet) - len(titre)]) if complet.endswith(titre) and complet != titre else ''
        if not titre or re.search(r'tessin', titre, re.I):
            continue  # actions réservées au Tessin
        p = it.get('price') or {}
        promo = p.get('price')
        if not promo or it.get('productId') in vus:
            continue
        vus.add(it.get('productId'))
        ancien = p.get('oldPrice') or (p.get('discount') or {}).get('deletedPrice') or None
        note = []
        m = re.search(r'\((?:action )?valable uniquement en ([^)]*)\)', titre, re.I)
        if m:
            note.append(f'{m.group(1)} uniquement'.capitalize())
            titre = propre(titre[:m.start()] + titre[m.end():])
        debut = fin = ''
        for b in (it.get('stockAvailability') or {}).get('badgeInfoV2') or []:
            if b.get('validFrom'):
                debut = jour(b['validFrom'])
                fin = jour(b.get('validUntil'))
                break
        debut = debut or jour(it.get('storeStartDate'))
        fin = fin or jour(it.get('storeEndDate'))
        if debut and not fin:  # les actions Lidl courent du jeudi au mercredi
            fin = (dt.date.fromisoformat(debut) + dt.timedelta(days=6)).isoformat()
        imgs = it.get('imageList_V1') or []
        r = reconnaitre(titre, 'fr', rayon)
        sortie.append({
            'externalId': f"lidl-{it.get('productId')}",
            'name': titre,
            'brand': marque.title() if marque.isupper() else marque,
            'store': 'lidl',
            'category': r[1] if r else rayon,
            'promoPrice': round(float(promo), 2),
            'regularPrice': round(float(ancien), 2) if ancien and float(ancien) > float(promo) else None,
            'unitLabel': conditionnement(kf.get('description')),
            'validFrom': debut,
            'validTo': fin,
            'match': r[2] if r else '',
            'photo': (imgs[0].get('image') if imgs else '') or it.get('image') or '',
            'url': 'https://www.lidl.ch' + (it.get('canonicalUrl') or ''),
            'note': ', '.join(note),
        })
    return sortie


# --------------------------------------------------------------------------- aktionis (Migros, Coop)

def validite(desc):
    d = norm(desc).replace(' ', '.')  # « vom 12.11. bis 18.11.2026 » → « vom.12.11.bis.18.11.2026 »
    m = re.search(r'vom\.(\d{1,2})\.(\d{1,2})\.(?:(\d{4})\.)?bis\.(\d{1,2})\.(\d{1,2})\.(\d{4})', d)
    if m:
        j1, m1, a1, j2, m2, a2 = m.groups()
        a1 = a1 or (int(a2) - 1 if int(m1) > int(m2) else a2)
        return date_iso(j1, m1, a1), date_iso(j2, m2, a2), False
    m = re.search(r'bis\.(\d{1,2})\.(\d{1,2})\.(\d{4})', d)
    if m:
        return AUJOURDHUI.isoformat(), date_iso(*m.groups()), False
    # Coop ne donne souvent pas de dates : ses actions courent en général jusqu'au dimanche.
    return AUJOURDHUI.isoformat(), dimanche_prochain(AUJOURDHUI).isoformat(), True


def note_aktionis(titre, desc):
    t, d = norm(titre), norm(desc)
    notes = []
    m = re.search(r'\bab (\d+) stuck', d)
    if m:
        notes.append(f'dès {m.group(1)} articles')
    if re.match(r'(alle|gesamtes?)\b', t) or 'sortiment' in t:
        notes.append("tout l'assortiment")
    m = re.search(r'\b(duo|(\d)er) pack', t)
    if m:
        notes.append('lot de ' + (m.group(2) or '2'))
    if re.search(r'\bz b\b', d):
        notes.append('prix pour un exemple')
    return ', '.join(notes)


def aktionis(magasin, cache=None):
    sortie, vus = [], set()
    for code, rayon in AK_RAYONS.items():
        page_no, pages = 1, 1
        while page_no <= pages and page_no <= 10:
            page = telecharger(f'{AKTIONIS}/vendors/{magasin}?c={code}&page={page_no}', cache)
            m = re.search(r'name="max_page" value="(\d+)"', page)
            pages = int(m.group(1)) if m else 1
            for carte in re.split(r'<div data-upox-id=', page)[1:]:
                ident = re.match(r'"(\d+)"', carte)
                titre = re.search(r'<h3 class="card-title[^>]*>(.*?)</h3>', carte, re.S)
                if not ident or not titre or ident.group(1) in vus:
                    continue
                vus.add(ident.group(1))
                titre = propre(titre.group(1))
                desc = re.search(r'<p class="card-description[^>]*>(.*?)</p>', carte, re.S)
                desc = propre(desc.group(1)) if desc else ''
                neuf = re.search(r'class="price-new">([^<]*)<', carte)
                vieux = re.search(r'class="price-old">([^<]*)<', carte)
                rabais = re.search(r'class="price-discount"[^>]*>\s*-?(\d+)\s*%', carte)
                promo, ancien = prix(neuf.group(1)) if neuf else None, prix(vieux.group(1)) if vieux else None
                if not promo:  # « z.B. … 1.64 statt 2.– »
                    ex = re.search(r'([\d–-]+\.[\d–-]+)\s*statt\s*([\d–-]+\.[\d–-]+)', desc)
                    if ex:
                        promo, ancien = prix(ex.group(1)), prix(ex.group(2))
                pct = int(rabais.group(1)) if rabais else None
                if not promo and not pct:
                    continue
                debut, fin, approx = validite(desc)
                if fin and fin < AUJOURDHUI.isoformat():
                    continue
                img = re.search(r'<div class="card-image">\s*<img src="([^"]+)"', carte)
                lien = re.search(r'<a href="(/deals/[^"]+)"', carte)
                r = reconnaitre(titre, 'de', rayon)
                sortie.append({
                    'externalId': f'ak-{ident.group(1)}',
                    'name': r[0] if r else titre,
                    'origName': titre,
                    'store': magasin,
                    'category': r[1] if r else rayon,
                    'promoPrice': promo,
                    'regularPrice': ancien if ancien and promo and ancien > promo else None,
                    'discountPct': pct,
                    'unitLabel': conditionnement(desc, titre),
                    'validFrom': debut,
                    'validTo': fin,
                    'approxDates': approx,
                    'match': r[2] if r else '',
                    'photo': img.group(1) if img else '',
                    'url': AKTIONIS + lien.group(1) if lien else '',
                    'note': note_aktionis(titre, desc),
                })
            page_no += 1
    return sortie


# --------------------------------------------------------------------------- principal

def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--sortie', default=SORTIE)
    ap.add_argument('--cache', help='dossier où garder les pages (tests, évite de re-télécharger)')
    a = ap.parse_args()

    ancien = {}
    if os.path.exists(a.sortie):
        try:
            with open(a.sortie, encoding='utf-8') as h:
                ancien = json.load(h)
        except ValueError:
            ancien = {}

    promos, sources = [], {}
    for magasin, fn, origine in [('lidl', lambda: lidl(a.cache), 'lidl.ch'),
                                 ('migros', lambda: aktionis('migros', a.cache), 'aktionis.ch'),
                                 ('coop', lambda: aktionis('coop', a.cache), 'aktionis.ch')]:
        try:
            lot = fn()
            if not lot:
                raise RuntimeError('aucune promotion trouvée (la page a peut-être changé)')
            promos += lot
            sources[magasin] = {'ok': True, 'count': len(lot), 'origine': origine, 'updatedAt': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')}
            print(f'{magasin}: {len(lot)} promotions', file=sys.stderr)
        except Exception as e:  # une source en panne ne doit pas effacer les autres
            garde = [p for p in ancien.get('promotions', []) if p.get('store') == magasin and (p.get('validTo') or '9') >= AUJOURDHUI.isoformat()]
            promos += garde
            prev = (ancien.get('sources') or {}).get(magasin, {})
            sources[magasin] = {'ok': False, 'error': str(e)[:200], 'count': len(garde), 'origine': origine, 'updatedAt': prev.get('updatedAt')}
            print(f'{magasin}: ÉCHEC ({e}) — {len(garde)} promotions précédentes conservées', file=sys.stderr)

    os.makedirs(os.path.dirname(a.sortie), exist_ok=True)
    with open(a.sortie, 'w', encoding='utf-8') as h:
        json.dump({'app': 'cabas', 'version': 1, 'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
                   'sources': sources, 'promotions': promos}, h, ensure_ascii=False, indent=1)
    lies = sum(1 for p in promos if p.get('match'))
    print(f'→ {a.sortie} : {len(promos)} promotions, dont {lies} reliées à des ingrédients', file=sys.stderr)
    return 0 if any(s['ok'] for s in sources.values()) else 1


if __name__ == '__main__':
    sys.exit(main())
