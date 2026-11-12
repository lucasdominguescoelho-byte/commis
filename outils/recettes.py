#!/usr/bin/env python3
"""Commis — importe le « Livre de cuisine » de Wikilivres (fr.wikibooks.org) dans data/recettes.json.

Source libre : contributeurs de Wikilivres, licence CC BY-SA 4.0
(https://creativecommons.org/licenses/by-sa/4.0/deed.fr). Chaque recette garde le
lien vers sa page d'origine ; le fichier produit est sous la même licence.

On garde les plats salés (plats principaux, soupes, salades, gratins, pâtes…) et on
écarte desserts, boissons, pains, confitures, sauces de base et cuisine historique.
Les quantités sont lues dans le texte, les prix sont estimés (prix habituels suisses
approximatifs) pour que Commis puisse calculer coûts et rabais.

Lecture via l'API officielle de MediaWiki, par paquets de 50 pages, avec une pause.
Bibliothèque standard uniquement. Utilisation : python3 outils/recettes.py
"""
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from promotions import norm, reconnaitre  # même dictionnaire que pour les promotions

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SORTIE = os.path.join(RACINE, 'data', 'recettes.json')
API = 'https://fr.wikibooks.org/w/api.php'
UA = 'Commis/1.0 (planificateur de repas personnel; https://github.com/lucasdominguescoelho-byte/cabas)'
PREFIXE = 'Livre de cuisine/'


def api(params):
    params = {**params, 'format': 'json', 'formatversion': '2'}
    req = urllib.request.Request(API + '?' + urllib.parse.urlencode(params), headers={'User-Agent': UA})
    for essai in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception:  # réseau capricieux : on réessaie calmement
            time.sleep(3 * (essai + 1))
    raise RuntimeError('API Wikilivres injoignable')


def titres():
    out, cont = [], {}
    while True:
        d = api({'action': 'query', 'list': 'allpages', 'apprefix': PREFIXE, 'apnamespace': 0, 'aplimit': 500, 'apfilterredir': 'nonredirects', **cont})
        out += [p['title'] for p in d['query']['allpages']]
        if 'continue' not in d:
            return out
        cont = d['continue']
        time.sleep(1)


def pages(liste):
    for i in range(0, len(liste), 50):
        d = api({'action': 'query', 'prop': 'revisions|categories', 'rvprop': 'content', 'rvslots': 'main', 'cllimit': 'max', 'titles': '|'.join(liste[i:i + 50])})
        for p in d['query']['pages']:
            rev = (p.get('revisions') or [{}])[0]
            texte = ((rev.get('slots') or {}).get('main') or {}).get('content', '')
            cats = [c['title'].split(':', 1)[1] for c in p.get('categories', [])]
            yield p['pageid'], p['title'], texte, cats
        time.sleep(1)


# --------------------------------------------------------------------------- nettoyage du wikitexte

def tpl_i(m):
    """{{i|pomme de terre|pommes de terre}} → « pommes de terre » ; {{i|'=oui|ail}} → « ail »."""
    parts = [p for p in m.group(1).split('|') if '=' not in p]
    return parts[-1] if parts else ''


def propre(t):
    t = re.sub(r'<ref[^>]*?/>|<ref[^>]*>.*?</ref>', '', t, flags=re.S)
    t = re.sub(r'<!--.*?-->', '', t, flags=re.S)
    t = re.sub(r'\{\{\s*i\s*\|([^{}]*)\}\}', tpl_i, t)
    t = re.sub(r'\{\{\s*(?:Ustensile|lien|w|nobr)\s*\|([^{}|]*)\|?([^{}|]*)[^{}]*\}\}', lambda m: m.group(2) or m.group(1), t, flags=re.I)
    t = re.sub(r'\{\{[^{}]*\}\}', '', t)
    t = re.sub(r'\[\[(?:Image|Fichier|File):[^\]]*\]\]', '', t, flags=re.I)
    t = re.sub(r'\[\[[^\]|]*\|([^\]]*)\]\]', r'\1', t)
    t = re.sub(r'\[\[([^\]]*)\]\]', lambda m: m.group(1).split('/')[-1], t)
    t = re.sub(r'\[https?://\S+ ([^\]]*)\]', r'\1', t)
    t = re.sub(r"'{2,}", '', t)
    t = re.sub(r'<[^>]+>', ' ', t)
    return re.sub(r'\s+', ' ', t).strip(' ,;.')


def section(texte, noms):
    """Contenu de la première section dont le titre commence par un des noms."""
    m = re.search(r'^(=+)\s*(?:' + '|'.join(noms) + r')[^=\n]*\1\s*$', texte, flags=re.M | re.I)
    if not m:
        return ''
    niveau = len(m.group(1))
    fin = re.search(r'^={1,%d}[^=].*?=+\s*$' % niveau, texte[m.end():], flags=re.M)
    return texte[m.end(): m.end() + fin.start()] if fin else texte[m.end():]


# --------------------------------------------------------------------------- ingrédients

NOMBRES = {'un': 1, 'une': 1, 'deux': 2, 'trois': 3, 'quatre': 4, 'cinq': 5, 'six': 6, 'sept': 7, 'huit': 8, 'dix': 10, 'douze': 12, 'demi': 0.5, 'quelques': 3}
FRACTIONS = {'½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3}
UNITES = [  # (motif, unité de Commis, facteur)
    (r'kg|kilos?|kilogrammes?', 'kg', 1), (r'g|gr|grs|grammes?', 'g', 1), (r'mg', 'g', 0.001),
    (r'l|litres?|de l', 'l', 1), (r'dl|décilitres?', 'dl', 1), (r'cl|centilitres?', 'ml', 10), (r'ml|millilitres?', 'ml', 1),
    (r'c\.?\s*à\s*(?:s|table)\.?|cuill(?:è|e)r(?:é|e)?e?s?\s*à\s*(?:soupe|table)|cuill?\.?\s*à\s*(?:soupe|table)|c\.s|cs|càs', 'c. à soupe', 1),
    (r'c\.?\s*à\s*(?:c|th(?:é|e))\.?|cuill(?:è|e)r(?:é|e)?e?s?\s*à\s*(?:caf(?:é|e)|th(?:é|e))|cuill?\.?\s*à\s*caf(?:é|e)|c\.c|cc|càc', 'c. à café', 1),
    (r'gousses?', 'gousse', 1), (r'petites?\s+cuill(?:è|e)res?|gouttes?', 'c. à café', 1), (r'pinc(?:é|e)es?', 'pincée', 1), (r'tranches?', 'tranche', 1), (r'bottes?', 'botte', 1),
    (r'bo(?:î|i)tes?', 'boîte', 1), (r'sachets?', 'sachet', 1), (r'verres?', 'dl', 2), (r'tasses?', 'dl', 2.5), (r'bols?', 'dl', 3),
    (r'brins?|branches?|feuilles?|tiges?|pots?|morceaux|morceau|bouquets?|t(?:ê|e)tes?|poign(?:é|e)es?|parts?', 'pièce', 1),
]
UNIT_RE = re.compile(r'^(' + '|'.join('(?:%s)' % u for u, _, _ in UNITES) + r')(?=[\s.,]|$)\.?\s*', re.I)
BANAL = re.compile(r'^(sel|poivre|eau|sel et poivre|sel poivre|poivre du moulin|sel fin|gros sel|eau froide|eau chaude|glace)$')


def nombre(s):
    s = s.strip().lower().replace(',', '.')
    for k, v in FRACTIONS.items():
        s = s.replace(k, ' %s' % v)
    s = s.strip()
    m = re.match(r'^(\d+(?:\.\d+)?)\s*(?:/\s*(\d+))?(?:\s*(?:à|-|ou)\s*(\d+(?:\.\d+)?))?\s*(?:\+?\s*(0\.\d+))?', s)
    if m:
        a = float(m.group(1)) / (float(m.group(2)) if m.group(2) else 1)
        if m.group(3):
            a = (a + float(m.group(3))) / 2
        if m.group(4):
            a += float(m.group(4))
        return a, s[m.end():]
    m = re.match(r'^(%s)\b\s*' % '|'.join(NOMBRES), s)
    if m:
        return NOMBRES[m.group(1)], s[m.end():]
    return None, s


def ingredient(ligne):
    brut = propre(ligne)
    if not brut or len(brut) > 140:
        return None
    qty, reste = nombre(brut)
    unit, facteur = 'pièce', 1
    m = UNIT_RE.match(reste.strip())
    if m and qty is not None:
        mot = m.group(1).lower()
        for motif, u, f in UNITES:
            if re.fullmatch(motif, mot, flags=re.I):
                unit, facteur = u, f
                break
        reste = reste.strip()[m.end():]
    reste = re.sub(r"^(?:de |d'|d’|du |des |de la |de l'|de l’)", '', reste.strip(), flags=re.I)
    nom = re.split(r'[,;(:]|\.\s| pour | ou | selon | environ| et du | et de la ', reste)[0].strip(' .')
    nom = re.sub(r"^(?:la |le |les |l'|l’|un |une |du |des |de |d'|d’|quelques |belles? |beaux? |gros(?:se)? |petite? |grande? )+", '', nom, flags=re.I).strip()
    nom = re.sub(r'\s+(?:coup|épluch|émin|hach|râp|finement|en |bien |frais|fraîche|moyen|gros|petit|cuit|égoutt|lav|dénoyaut|trempé|décongel)\S*.*$', '', nom, flags=re.I).strip()
    if not nom or len(nom) > 50 or BANAL.match(norm(nom)):
        return None
    nom = nom[0].upper() + nom[1:]
    if qty is None:
        qty = 0
    qty = round(qty * facteur, 2)
    return {'name': nom, 'qty': qty, 'unit': unit}


# Prix habituels approximatifs (CHF) : au kilo/litre par rayon, à la pièce, plus quelques exceptions.
PRIX_KG = {'vp': 24, 'lait': 12, 'fl': 4, 'epi': 5, 'boul': 6, 'surg': 9, 'bois': 4, 'autre': 6}
PRIX_PIECE = {'vp': 2.5, 'lait': 0.5, 'fl': 0.6, 'epi': 1.5, 'boul': 2, 'surg': 3, 'bois': 2, 'autre': 1}
PRIX_SPECIAUX = {'Pommes de terre': 2.4, 'Carottes': 2.0, 'Oignons': 2.5, 'Riz': 3.5, 'Pâtes (assortiment)': 3, 'Spaghetti': 3, 'Farine': 1.8, 'Sucre': 1.8, 'Lait': 1.8,
                 'Crème': 9, 'Beurre': 14, 'Saumon': 35, 'Crevettes': 30, 'Bœuf': 38, 'Entrecôte de bœuf': 60, 'Lard': 18, 'Jambon': 30, 'Gruyère': 22, 'Parmesan': 30,
                 'Œufs': 0.45, 'Tomates en conserve': 3, 'Lentilles': 4.5, 'Pois chiches': 4.5, 'Huile': 5, "Huile d'olive": 12, 'Bouillon': 10, 'Chou blanc ou rouge': 2.5}
PIECE_UNITAIRE = {'Œufs': 0.45, 'Oignons': 0.25, 'Citrons': 0.6, 'Ail': 0.5, 'Poivrons': 1.0, 'Courgettes': 0.9, 'Aubergines': 1.4, 'Tomates': 0.6, 'Concombre': 1.0, 'Salade': 1.6, 'Pommes': 0.5}


PORTION_KG = {'vp': 0.13, 'lait': 0.04, 'fl': 0.1, 'epi': 0.02, 'boul': 0.05, 'surg': 0.08, 'bois': 0.05, 'autre': 0.03}


LEGUMES = re.compile(r'echalote|poireau|celeri|navet|radis|chou|potiron|potimarron|haricot|petits? pois|epinard|blette|endive|artichaut|asperge|fenouil|betterave|panais|herbe|persil|basilic|ciboulette|coriandre|menthe|aneth|thym|laurier|romarin|gingembre|citron|pomme|poire|orange|avocat|mangue|olive')
FROMAGE = re.compile(r'fromage|pecorino|comte|emmental|beaufort|reblochon|tomme|cantal|chevre|brebis|ricotta|roquefort|bleu|yaourt|yogourt|creme|lait')


def rayon_libre(nom):
    t = norm(nom)
    if VIANDE.search(t) or POISSON.search(t) or re.search(r'mouton|guanciale|pancetta|lardon|gibier|chevreuil|foie|rognon|caille|pintade|langoustine|merlu|coquille', t):
        return 'vp'
    if FROMAGE.search(t):
        return 'lait'
    if LEGUMES.search(t):
        return 'fl'
    return 'epi'


def estimer(ing, portions=4):
    r = reconnaitre(ing['name'], 'fr', 'autre')
    label, cat, match = r if r else (None, rayon_libre(ing['name']), '')
    ing['cat'] = cat
    q, u = ing['qty'], ing['unit']
    if u in ('kg', 'l'):
        kg = q
    elif u in ('g', 'ml'):
        kg = q / 1000
    elif u == 'dl':
        kg = q / 10
    else:
        kg = None
    if not q:
        prix = PORTION_KG.get(cat, 0.03) * portions * PRIX_SPECIAUX.get(label, PRIX_KG.get(cat, 6)) if cat in ('vp', 'fl', 'lait') else 0.1
    elif kg is not None:
        prix = kg * PRIX_SPECIAUX.get(label, PRIX_KG.get(cat, 6))
    elif u in ('c. à soupe', 'c. à café', 'pincée'):
        prix = 0.08 * (q or 1)
    elif u == 'gousse':
        prix = 0.1 * (q or 1)
    else:
        prix = (q or 1) * PIECE_UNITAIRE.get(label, PRIX_PIECE.get(cat, 1))
    ing['price'] = round(min(prix, 40) * 20) / 20
    return ing


# --------------------------------------------------------------------------- recette complète

EXCLURE = re.compile(r'dessert|g(?:â|a)teau|biscuit|confiture|confiserie|sucrerie|boisson|cocktail|sirop|liqueur|pain|brioche|viennoiserie|glace|sorbet|'
                     r'petit.d(?:é|e)jeuner|galette des rois|cuisine historique|^sauces?$|vinaigrette|marinade|cr(?:ê|e)pes? sucr|tarte sucr|chocolat|'
                     r'p(?:â|a)tisserie|amuse|ap(?:é|e)ritif|condiment|conserve|lacto|fermentation|recettes de f(?:ê|e)tes', re.I)
BASE = re.compile(r'^bases?$', re.I)
INGREDIENT_CAT = re.compile(r'^Recettes de cuisine à base', re.I)  # classement par ingrédient : ne dit rien du type de plat
GARDER = re.compile(r'plat principal|viande|poissons?|soupes?|salades?|p(?:â|a)tes alimentaires|recettes de tous les jours|l(?:é|e)gumes|accompagnements|entr(?:é|e)es|'
                    r'gratins?|tartes|pizzas|ragoût|fondues?|galettes|sandwiches|v(?:é|e)g(?:é|e)tari|cuisine', re.I)
VIANDE = re.compile(r'poulet|boeuf|bœuf|porc|veau|agneau|lard|jambon|saucisse|canard|dinde|lapin|viande|chorizo|merguez|steak|escalope|côtelette|rôti')
POISSON = re.compile(r'saumon|thon|cabillaud|morue|poisson|crevette|moule|calamar|sardine|truite|colin|merlu|maquereau|lotte|dorade|anchois|cr(?:a|â)be|homard|seiche|poulpe')


def categorie(titre, cats, ings):
    t = norm(titre)
    c = ' '.join(norm(x) for x in cats)
    noms = ' '.join(norm(i['name']) for i in ings)
    if 'soupe' in c or re.match(r'(soupe|veloute|potage|bouillon|minestrone|gaspacho)', t):
        return 'Soupe'
    if 'salade' in c or t.startswith('salade'):
        return 'Salade'
    if re.search(r'gratin|quiche|tarte|lasagne|clafoutis|cake|four|tian|parmentier|moussaka', t):
        return 'Gratin & four'
    if 'pates alimentaires' in c or re.search(r'pates|spaghetti|tagliatelle|penne|macaroni|risotto|riz|gnocchi|nouilles|ravioli|lasagne', t):
        return 'Pâtes & riz'
    if 'poisson' in c or POISSON.search(t + ' ' + noms):
        return 'Poisson'
    if 'viande' in c or VIANDE.search(t + ' ' + noms):
        return 'Viande'
    return 'Végétarien'


def duree(etapes):
    minutes = 0
    for e in etapes:
        for n, u in re.findall(r'(\d+)\s*(min|minutes?|h|heures?)\b', e.lower()):
            minutes += int(n) * (60 if u.startswith('h') else 1)
    return max(15, min(180, 10 + minutes)) if minutes else 40


def photo(texte):
    m = re.search(r'\[\[(?:Image|Fichier|File):([^|\]]+)', texte, flags=re.I)
    if not m:
        m = re.search(r'photo\s*=\s*\[\[(?:Image|Fichier|File):([^|\]]+)', texte, flags=re.I)
    if not m:
        return ''
    nom = m.group(1).strip().replace(' ', '_')
    return 'https://commons.wikimedia.org/wiki/Special:FilePath/' + urllib.parse.quote(nom) + '?width=640'


def recette(pageid, titre, texte, cats):
    nom = titre[len(PREFIXE):].strip()
    if '/' in nom or not texte or re.match(r'(Recettes?|Cuisine|Index|Liste|Intersection|Glossaire|Ingr)', nom):
        return None
    types = [c for c in cats if not INGREDIENT_CAT.match(c)]
    if any(EXCLURE.search(c) or BASE.match(c) for c in types) or EXCLURE.search(nom):
        return None
    if types and not any(GARDER.search(c) for c in types):
        return None
    ing_txt = section(texte, ['Ingr'])
    prep_txt = section(texte, ['Pr(?:é|e)paration', 'Recette', '(?:É|E)tapes', 'R(?:é|e)alisation', 'Instructions'])
    lignes_ing = re.findall(r'^\*+\s*(.+)$', ing_txt, flags=re.M)
    etapes = [propre(x) for x in re.findall(r'^#+\s*(.+)$', prep_txt, flags=re.M)]
    etapes = [e for e in etapes if len(e) > 8]
    if not etapes:  # parfois en paragraphes ou en liste à puces
        etapes = [propre(x) for x in re.findall(r'^\*+\s*(.+)$', prep_txt, flags=re.M)] or [propre(x) for x in prep_txt.split('\n\n') if len(propre(x)) > 30]
    ings = [i for i in (ingredient(l) for l in lignes_ing) if i]
    if len(ings) < 3 or len(etapes) < 2:
        return None
    if sum(1 for i in ings if i['qty']) < len(ings) / 2:
        return None  # trop imprécise pour estimer coûts et courses
    sucre = sum(i['qty'] for i in ings if norm(i['name']).startswith('sucre') and i['unit'] == 'g')
    if sucre >= 80 and not (VIANDE.search(norm(nom)) or POISSON.search(norm(nom))):
        return None  # dessert non classé
    m = re.search(r'pour\s+(\d+|%s)(?:\s*(?:à|-)\s*\w+)?\s*(?:personnes?|pers|convives|parts?|portions?)' % '|'.join(NOMBRES), propre(ing_txt + ' ' + texte[:600]), flags=re.I)
    n = (int(m.group(1)) if m.group(1).isdigit() else NOMBRES.get(m.group(1).lower(), 4)) if m else 4
    portions = n if 0 < n <= 20 else 4
    intro = propre(re.split(r'^=', texte, maxsplit=1, flags=re.M)[0])
    intro = re.sub(r'^Livre de cuisine\s*', '', intro)
    return {
        'id': f'wk-{pageid}',
        'name': nom,
        'description': (intro[:220].rsplit(' ', 1)[0] + '…') if len(intro) > 220 else intro,
        'category': categorie(nom, cats, ings),
        'prepTime': duree(etapes),
        'servings': portions,
        'ingredients': [estimer(i, portions) for i in ings],
        'steps': [e[:600] for e in etapes[:14]],
        'photo': photo(texte),
        'tags': [c for c in cats if re.search(r'cuisine |recettes v', c, flags=re.I)][:4],
        'url': 'https://fr.wikibooks.org/wiki/' + urllib.parse.quote(titre.replace(' ', '_')),
    }


def main():
    tous = titres()
    print(f'{len(tous)} pages dans le Livre de cuisine', file=sys.stderr)
    out = []
    for pageid, titre, texte, cats in pages(tous):
        try:
            r = recette(pageid, titre, texte, cats)
        except Exception as e:
            print(f'  ignorée : {titre} ({e})', file=sys.stderr)
            continue
        if r:
            out.append(r)
    out.sort(key=lambda r: norm(r['name']))
    os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
    with open(SORTIE, 'w', encoding='utf-8') as h:
        json.dump({
            'source': 'Wikilivres, « Livre de cuisine » (https://fr.wikibooks.org/wiki/Livre_de_cuisine)',
            'licence': 'CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0/deed.fr',
            'auteurs': 'Contributeurs de Wikilivres (historique de chaque page)',
            'modifications': 'Texte simplifié, quantités extraites, prix estimés par Commis',
            'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
            'recettes': out,
        }, h, ensure_ascii=False, separators=(',', ':'))
    print(f'→ {SORTIE} : {len(out)} recettes', file=sys.stderr)


if __name__ == '__main__':
    main()
