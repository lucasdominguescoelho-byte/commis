/* Commis — recette depuis une vidéo YouTube ou TikTok.

   Gratuit et sans clé : Commis demande à YouTube ou TikTok la fiche publique de la vidéo (oEmbed).
   YouTube donne le titre, l'auteur et l'image ; TikTok ne donne plus que le lecteur (ni légende ni image).
   La description ou la légende peut donc être collée à la main. Ensuite, tout se passe sur l'appareil :
     - si la légende écrit les ingrédients (« 200 g de pâtes, 2 œufs… »), ils sont lus et reconnus
       avec la base d'aliments de Commis (rayon, prix estimé) ; les étapes numérotées aussi ;
     - sinon, si le titre nomme un classique (carbonara, raclette, curry…), sa recette de base est proposée ;
     - sinon, la recette est créée avec le lien de la vidéo, à compléter.
   Les playlists et les descriptions YouTube ne sont pas lisibles sans clé d'API : une vidéo à la fois. */
(function () {
  'use strict';
  const C = window.C;
  const { esc, icon } = C;

  /* ---------- Adresse de la vidéo ---------- */
  function lireLien(texte) {
    const brut = String(texte || '').trim().match(/https?:\/\/\S+|(?:www\.|m\.)?(?:youtube\.com|youtu\.be|tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)\/\S*/i);
    if (!brut) return { erreur: 'Collez l’adresse d’une vidéo YouTube ou TikTok.' };
    let u;
    try {
      u = new URL(/^https?:/i.test(brut[0]) ? brut[0] : `https://${brut[0]}`);
    } catch (e) {
      return { erreur: 'Cette adresse n’est pas valable.' };
    }
    const h = u.hostname.replace(/^(www|m|music)\./, '');
    if (h === 'youtu.be' || h === 'youtube.com' || h === 'youtube-nocookie.com') {
      let id = h === 'youtu.be' ? u.pathname.slice(1).split('/')[0] : u.searchParams.get('v');
      const m = u.pathname.match(/^\/(shorts|embed|live|v)\/([\w-]{6,})/);
      if (!id && m) id = m[2];
      if (!id && u.searchParams.get('list'))
        return { erreur: 'C’est une playlist. Sans clé d’API payante, YouTube ne donne pas la liste de ses vidéos : ouvrez une vidéo de la playlist et collez son adresse.', playlist: true };
      if (!id || !/^[\w-]{6,}$/.test(id)) return { erreur: 'Commis ne trouve pas de vidéo dans cette adresse YouTube.' };
      return { site: 'youtube', id, url: `https://www.youtube.com/watch?v=${id}`, dansPlaylist: !!u.searchParams.get('list') };
    }
    if (h === 'tiktok.com' || h.endsWith('.tiktok.com')) {
      const m = u.pathname.match(/\/(video|photo)\/(\d{6,})/);
      if (m) return { site: 'tiktok', id: m[2], url: `https://www.tiktok.com${u.pathname.replace(/\/$/, '')}` };
      if (/^\/@[\w.-]+\/?$/.test(u.pathname)) return { erreur: 'C’est la page d’un compte TikTok. Ouvrez une vidéo, touchez « Partager › Copier le lien » et collez-le ici.' };
      if (/playlist|collection/.test(u.pathname)) return { erreur: 'Les collections TikTok ne sont pas lisibles sans clé : collez le lien d’une vidéo à la fois.', playlist: true };
      return { site: 'tiktok', id: '', url: `https://${u.hostname}${u.pathname}`, court: true }; // lien court (vm.tiktok.com/…)
    }
    return { erreur: 'Commis sait lire les vidéos YouTube et TikTok.' };
  }

  /* ---------- Fiche publique de la vidéo (oEmbed, gratuit) ---------- */
  async function fiche(lien) {
    const api = lien.site === 'youtube' ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(lien.url)}` : `https://www.tiktok.com/oembed?url=${encodeURIComponent(lien.url)}`;
    let res;
    try {
      res = await fetch(api, { credentials: 'omit', referrerPolicy: 'no-referrer' });
    } catch (e) {
      throw new Error('Pas de connexion, ou la vidéo n’a pas pu être lue. Réessayez dans un instant.');
    }
    if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? 'Cette vidéo est privée ou ne peut pas être partagée.' : lien.court ? 'Ce lien court n’a pas pu être lu : ouvrez la vidéo dans TikTok et copiez son lien complet.' : 'Vidéo introuvable : vérifiez l’adresse.');
    const d = await res.json().catch(() => ({}));
    let id = lien.id;
    if (lien.site === 'tiktok' && !id) id = String(d.embed_product_id || (String(d.html || '').match(/data-video-id="(\d+)"/) || [])[1] || '');
    if (!id) id = C.uid();
    const photo = lien.site === 'youtube' ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : d.thumbnail_url || '';
    const pseudo = (lien.url.match(/\/@([\w.-]+)/) || [])[1];
    return { site: lien.site, id, url: lien.site === 'tiktok' && lien.court && d.author_unique_id && id ? `https://www.tiktok.com/@${d.author_unique_id}/video/${id}` : lien.url, titre: String(d.title || '').trim(), auteur: String(d.author_name || '').trim() || (pseudo ? `@${pseudo}` : ''), photo };
  }

  /* ---------- Lecture du titre ou de la légende ---------- */
  const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]+/gu;
  const nettoyer = (t) =>
    String(t || '')
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/[#@][\p{L}\p{N}_.]+/gu, ' ')
      .replace(EMOJI, '\n') // les émojis servent souvent de puces
      .replace(/[ \t]+/g, ' ');
  const decouper = (t) =>
    nettoyer(t)
      .replace(/\s*[•·▪►➤]\s*/g, '\n')
      .replace(/(^|\s)-\s+(?=\S)/g, '\n') // « - 200 g de pâtes »
      .replace(/(^|\s)((?:les\s)?ingr[ée]dients?\s*(?:\([^)]*\)|pour [^:\n]{1,30})?\s*:)/gi, '\n$2\n')
      .replace(/(^|\s)((?:la\s)?(?:recette|pr[ée]paration|instructions?|[ée]tapes?|m[ée]thode|d[ée]roulement)\s*:)/gi, '\n$2\n')
      .replace(/([.!?])\s+(\d{1,2}[.)])\s/g, '$1\n$2 ');

  const UNITES = [
    [/^(kg|kilos?|kilogrammes?)$/, 'kg'],
    [/^(g|gr|grs|grammes?)$/, 'g'],
    [/^(mg)$/, 'mg'],
    [/^(ml|millilitres?)$/, 'ml'],
    [/^(cl|centilitres?)$/, 'cl'],
    [/^(dl|decilitres?)$/, 'dl'],
    [/^(l|litres?)$/, 'l'],
    [/^(cs|cas|c a s|c a soupe|cuil a soupe|cuilleres? a soupe|c soupe|tbsp)$/, 'c. à soupe'],
    [/^(cc|cac|c a c|c a cafe|cuil a cafe|cuilleres? a cafe|c cafe|tsp)$/, 'c. à café'],
    [/^(pincees?)$/, 'pincée'],
    [/^(tranches?)$/, 'tranche'],
    [/^(gousses?)$/, 'gousse'],
    [/^(boites?|conserves?)$/, 'boîte'],
    [/^(sachets?)$/, 'sachet'],
    [/^(pots?)$/, 'pot'],
    [/^(verres?)$/, 'verre'],
    [/^(tasses?)$/, 'tasse'],
    [/^(bottes?)$/, 'botte'],
    [/^(brins?)$/, 'brin'],
    [/^(feuilles?)$/, 'feuille'],
    [/^(pieces?|pcs?)$/, 'pièce'],
    [/^(poignees?)$/, 'poignée'],
    [/^(filet)$/, 'filet'],
    [/^(bouquets?)$/, 'bouquet'],
    [/^(paquets?)$/, 'paquet'],
    [/^(blocs?)$/, 'bloc'],
    [/^(morceaux?)$/, 'morceau'],
    [/^(louches?)$/, 'louche'],
    [/^(cubes?)$/, 'cube'],
    [/^(barquettes?)$/, 'barquette'],
    [/^(boules?)$/, 'boule'],
  ];
  // Mots d'unité (sans accents) en tête d'une ligne, jusqu'à quatre mots (« cuillère à soupe »)
  const lireUnite = (mots) => {
    for (let n = Math.min(4, mots.length); n >= 1; n--) {
      const k = mots.slice(0, n).join(' ');
      const u = UNITES.find(([re]) => re.test(k));
      if (u) return { unite: u[1], n };
    }
    return null;
  };
  const sansAccent = (s) => C.norm(s);
  const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 0.33, '⅔': 0.67 };
  const lireNombre = (s) => {
    if (FRACTIONS[s]) return FRACTIONS[s];
    const f = s.match(/^(\d+)\/(\d+)$/);
    if (f) return Number(f[1]) / Number(f[2]);
    return C.toNum(s.replace(/[½¼¾⅓⅔]/, (x) => String(FRACTIONS[x]).slice(1)));
  };
  const MOTS_NOMBRES = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, dix: 10, douze: 12 };

  // « 200 g de pâtes », « 2 oeufs », « 1 c. à soupe d'huile d'olive », « sel, poivre »
  function lireIngredient(ligne) {
    let t = ligne.replace(/^[\s\-–•*·>✓✔︎]+/, '').replace(/\s*\([^)]*\)\s*/g, ' ').trim();
    t = t.replace(/[.;:!]+$/, '').trim();
    if (!t || t.length > 70) return null;
    // quantité en tête (« 200g », « 1,5 kg », « ½ », « 2-3 »), ou à la fin (« pâtes 200 g »)
    let qty = 0;
    let unite = '';
    let reste = t;
    const tete = t.match(/^(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?|[½¼¾⅓⅔]|\d+[½¼¾])(?:\s*(?:-|à)\s*\d+(?:[.,]\d+)?)?\s*(.*)$/);
    const fin = !tete && t.match(/^(.+?)\s*[:\-–]?\s*(\d+(?:[.,]\d+)?)\s*([a-zA-Z.]{1,6})?$/);
    if (tete) {
      qty = lireNombre(tete[1].replace(/\s/g, ''));
      reste = tete[2];
    } else if (fin && (!fin[3] || lireUnite([sansAccent(fin[3])]))) {
      qty = C.toNum(fin[2]);
      reste = fin[3] ? `${fin[3]} ${fin[1]}` : fin[1];
    } else {
      const peu = sansAccent(t).match(/^(un peu|un filet|une pincee|quelques)\b/);
      if (peu) reste = t.replace(/^(un peu|un filet|une pinc[ée]e|quelques)\s*/i, '');
      const env = !peu && sansAccent(t).match(/^(?:une? )?(demi|dizaine|douzaine|quinzaine|vingtaine|trentaine)\b/);
      if (env) {
        qty = { demi: 0.5, dizaine: 10, douzaine: 12, quinzaine: 15, vingtaine: 20, trentaine: 30 }[env[1]];
        reste = t.replace(/^(?:une?\s+)?\S+\s*/i, '');
      }
      const m = !peu && !env && sansAccent(t).match(/^(un|une|deux|trois|quatre|cinq|six|sept|huit|dix|douze)\b/);
      if (m) {
        qty = MOTS_NOMBRES[m[1]];
        reste = t.replace(/^\S+\s*/, '');
      }
    }
    // unité collée au nombre (« 200g ») ou en mot(s)
    const colle = reste.match(/^([a-zA-Z]{1,3})\b\.?\s*(.*)$/);
    const mots = reste.split(/\s+/).map(sansAccent);
    const u = lireUnite(mots);
    if (u) {
      unite = u.unite;
      reste = reste.split(/\s+/).slice(u.n).join(' ');
    } else if (colle && lireUnite([colle[1].toLowerCase()])) {
      unite = lireUnite([colle[1].toLowerCase()]).unite;
      reste = colle[2];
    }
    reste = reste.replace(/^(de la|de l['’]|des|du|de|d['’])\s*/i, '').replace(/^d['’]/i, '').trim();
    if (!/\p{L}{2}/u.test(reste)) return null;
    if (!qty && reste.split(/\s+/).length > 5) return null; // une phrase, pas un ingrédient
    if (unite === 'kg') {
      qty = Math.round(qty * 1000);
      unite = 'g';
    } else if (unite === 'cl' || unite === 'dl' || (unite === 'l' && qty)) {
      qty = Math.round(qty * { cl: 10, dl: 100, l: 1000 }[unite]);
      unite = 'ml';
    }
    const nom = reste.charAt(0).toUpperCase() + reste.slice(1);
    return { nom, qty: qty || 0, unite: unite || (qty ? 'pièce' : '') };
  }

  // Rayon et prix estimé grâce à la base d'aliments (prix habituel par portion)
  const PATES = /\b(pates|pasta|pennes?|paccheri|fusilli|tagliatelles?|macaronis?|coquillettes|farfalles?|linguine|rigatoni|spaghettis?|orecchiette|busiate)\b/;
  const COUPE = new Set(['blanc', 'filet', 'cuisse', 'pave', 'escalope', 'morceau', 'dos', 'emince', 'tranche', 'jus', 'zeste']);
  const pareil = (t, x) => t === x || (t.length > 3 && x.length > 3 && (t.startsWith(x) || x.startsWith(t)));
  function reconnaitre(ing, portions) {
    const n = C.norm(ing.nom);
    const toks = C.tokens(ing.nom);
    const tete = toks.find((t) => !COUPE.has(t)) || toks[0]; // « Blanc de poulet » → poulet
    let best = PATES.test(n) && !/\bpate (feuilletee|brisee|sablee|a pizza)\b/.test(n) ? C.cuisine.foods.find((f) => f.n === 'Spaghetti') : null;
    let bestSc = best ? 1 : 0;
    if (!best)
      C.cuisine.foods.forEach((f) => {
        const ft = C.tokens(f.court || f.n);
        if (!ft.some((x) => pareil(tete, x))) return; // le mot principal doit correspondre
        const hit = ft.filter((x) => toks.some((t) => pareil(t, x))).length;
        const sc = hit / Math.max(ft.length, toks.length * 0.7);
        if (sc >= 0.5 && sc > bestSc) {
          best = f;
          bestSc = sc;
        }
      });
    const epice = /\b(sel|poivre|epices?|paprika|cumin|curry|origan|thym|basilic|persil|ciboulette|muscade|piment|herbes?)\b/.test(C.norm(ing.nom));
    let price = 0;
    if (best && !epice && !ing.qty && !ing.unite) {
      ing = { ...ing, qty: Math.round(best.q * portions * 100) / 100, unite: best.u };
    }
    if (best && !epice) {
      const memeUnite = ing.qty && ing.unite && ing.unite === best.u;
      price = memeUnite ? (best.p * ing.qty) / best.q : best.p * portions;
      price = Math.round(Math.min(price, 40) * 20) / 20;
    }
    return {
      name: ing.nom,
      qty: ing.qty || 1,
      unit: ing.unite || (epice ? 'pincée' : best && best.u !== 'g' && best.u !== 'ml' ? best.u : 'pièce'),
      cat: epice ? 'epi' : best ? best.c : 'autre',
      price,
    };
  }

  const ENTETE_ING = /^(les )?(ingredients?|il (vous )?faut|liste de courses|pour (\d+|deux|quatre) (personnes|pers|portions))\b/;
  const ENTETE_ETAPES = /^(la )?(preparation|etapes?|recette|instructions?|methode|deroulement|realisation)$/;
  const BRUIT = /\b(bon appetit|abonne|abonnez|like|partage|commente|en bio|lien|te donne envie|vous donne envie|enjoy|bisous|merci|domcooks|recette complete|rendez vous sur)\b/;
  const GENERIQUE = /\b(recettes?( (facile|rapide|simple|maison|express|du jour|inratable|parfaite|ultime|de ma grand mere|de grand mere))*|facile|faciles|rapide|rapides|simple|inratable|delicieu(x|se)|trop bon(ne)?|la meilleure|le meilleur|les meilleur(e)?s|meilleur(e)?s?|ultime|maison|en \d+ ?(min|minutes|mn)|tuto(riel)?|pas a pas|episode \d+|ep \d+|partie \d+|shorts?|asmr|vlog|food|cooking|healthy|best|easy|quick|recipe|how to make|the|virale?s?|de tiktok|tiktok|sur tiktok|youtube)\b/g;
  const ARTICLE = /^(la|le|les|l|ma|mon|mes|ta|ton|tes|notre|nos|votre|vos|ce|cet|cette|ces|une?|des|de|du|d)$/;

  function nommer(titre) {
    let t = decouper(titre).split('\n').map((x) => x.trim()).filter(Boolean)[0] || '';
    t = t.split(/\s[|•–—]\s|\s-\s|\|/)[0];
    t = t.replace(/\s*[([].*?[)\]]\s*/g, ' ').replace(/^r[ée]ponse [àa]\s*/i, '').trim();
    const phrase = t.match(/^(.*?\p{L}{3})\s?[.!?:](?:\s|$)/u);
    if (phrase) t = phrase[1];
    if (ENTETE_ING.test(C.norm(t))) return '';
    t = t
      .replace(/^(d[ée]couvre[zs]?|voici|je (te |vous )?(teste|fais|propose|partage)|j['’]ai (test[ée]|fait)|aujourd['’]hui( on fait| je fais)?|on (fait|teste)|testons|petite?s?)\s+/i, '')
      .replace(/\s(que|qui|quand|parce que|comme jamais|a tester|a faire|un plat|une recette|parfaite?s? pour)\s.*$/i, '');
    // repère les mots génériques sur le texte sans accents, puis les retire du texte d'origine
    const mots = t.split(/\s+/).filter(Boolean);
    const norm = mots.map((w) => C.norm(w));
    const debut = [];
    let pos = 0;
    norm.forEach((w) => {
      debut.push(pos);
      pos += w.length + 1;
    });
    const joint = norm.join(' ');
    const ote = new Set();
    for (const m of joint.matchAll(GENERIQUE)) {
      const a = m.index;
      const b = a + m[0].length;
      debut.forEach((d, k) => {
        if (norm[k] && d < b && d + norm[k].length > a) ote.add(k);
      });
    }
    let garde = mots.filter((w, k) => !ote.has(k) && (norm[k] || w === '&'));
    while (garde.length > 1 && ARTICLE.test(C.norm(garde[0]))) garde.shift();
    while (garde.length > 1 && /^(de|du|des|d|a|au|aux|avec|et|en|pour)$/.test(C.norm(garde[garde.length - 1]))) garde.pop();
    let propre = garde.join(' ');
    if (propre.length > 60) propre = propre.slice(0, 60).replace(/\s+\S*$/, '');
    propre = propre.replace(/^[\s,:;\-–']+|[\s,:;\-–&]+$/g, '').replace(/^d['’]/i, '').trim();
    if (propre.length < 3) propre = t.trim();
    if (propre === propre.toUpperCase()) propre = propre.toLowerCase();
    return propre.charAt(0).toUpperCase() + propre.slice(1);
  }

  function lireTexte(texte) {
    const lignes = decouper(texte).split('\n').map((x) => x.trim()).filter(Boolean);
    const ingredients = [];
    const etapes = [];
    let zone = '';
    let portions = 0;
    lignes.forEach((l) => {
      const n = C.norm(l);
      if (!n || (BRUIT.test(n) && n.length < 90)) return;
      const p = n.match(/pour (\d+) (personnes|pers|portions|parts)/);
      if (p) portions = Number(p[1]);
      if (ENTETE_ING.test(n)) {
        zone = 'ing';
        l = l.replace(/^[^:]*:\s*/, ''); // « Ingrédients : 200 g de pâtes, … »
        if (!l || ENTETE_ING.test(C.norm(l))) return;
      } else if (ENTETE_ETAPES.test(n)) {
        zone = 'etapes';
        return;
      }
      const num = l.match(/^(?:etape\s*)?(\d{1,2})\s*[.)\-–:]\s*(.{6,})$/i);
      if (num && (zone === 'etapes' || l.length > 30)) {
        zone = 'etapes';
        etapes.push(num[2].trim());
        return;
      }
      if (zone === 'etapes') {
        if (l.length > 12) etapes.push(l);
        return;
      }
      // une ligne d'ingrédients peut en contenir plusieurs, séparés par des virgules
      let morceaux = l.split(/,|;|\s\+\s/).map((x) => x.trim()).filter(Boolean);
      if (zone === 'ing' && morceaux.length === 1 && l.length > 45) morceaux = l.split(/\s+(?=\d|[A-ZÀ-ÖØ-Ý])/).map((x) => x.trim()).filter(Boolean);
      // « Sel et poivre » : deux ingrédients courts
      if (zone === 'ing') morceaux = morceaux.flatMap((x) => (/^\D+$/.test(x) && x.split(/\s+et\s+/).every((y) => y.split(/\s+/).length <= 2) ? x.split(/\s+et\s+/) : [x]));
      const lus = morceaux.map(lireIngredient);
      const avecQte = lus.filter((x) => x && x.qty).length;
      if (zone === 'ing' ? lus.some(Boolean) : avecQte >= 1 && avecQte >= morceaux.length / 2) lus.forEach((x) => x && ingredients.push(x));
    });
    return { ingredients, etapes, portions };
  }

  /* ---------- Recette ---------- */
  const CATEGORIES = [
    ['Petit-déjeuner', /\b(pancakes?|crepes?|porridge|granola|petit dej|brunch|muffins?|gaufres?)\b/],
    ['Soupe', /\b(soupe|veloute|potage|bouillon|minestrone|gaspacho|ramen|pho)\b/],
    ['Salade', /\b(salade|bowl|poke|taboule)\b/],
    ['Burgers & wraps', /\b(burgers?|wraps?|tacos?|burritos?|kebab|sandwich|quesadillas?|hot dog)\b/],
    ['Pâtes & riz', /\b(pates|spaghetti|penne|tagliatelles?|lasagnes?|risotto|riz|nouilles|gnocchis?|carbonara|bolognaise|paella|pasta|ravioles?|ravioli)\b/],
    ['Gratin & four', /\b(gratin|tarte|quiche|pizza|four|lasagnes?|raclette|fondue|clafoutis|cake)\b/],
    ['Poisson', /\b(poisson|saumon|thon|cabillaud|crevettes?|moules|truite|colin|merlu|dorade|bar|sushis?|fruits de mer)\b/],
    ['Viande', /\b(poulet|boeuf|porc|veau|agneau|dinde|canard|steak|viande|saucisses?|lardons|jambon|chorizo|boulettes|cordon bleu|filet mignon|cote)\b/],
    ['Végétarien', /\b(vegetarien(ne)?|vegan|vege|tofu|lentilles|pois chiches|falafels?|legumes|curry de legumes|dhal)\b/],
  ];
  const categorie = (texte) => {
    const n = C.norm(texte).replace(/\b(c|cuil|cuilleres?) a (soupe|cafe)\b/g, ' '); // « c. à soupe » n'est pas une soupe
    return (CATEGORIES.find(([, re]) => re.test(n)) || [null])[0];
  };
  const duree = (texte) => {
    const m = C.norm(texte).match(/\b(\d{1,3}) ?(min|minutes|mn)\b/);
    const h = C.norm(texte).match(/\b(\d) ?(h|heures?)\b/);
    return m ? Math.min(180, Number(m[1])) : h ? Number(h[1]) * 60 : 0;
  };

  function composer(f, desc) {
    desc = String(desc || '').trim();
    const source = [f.titre, desc].filter(Boolean).join('\n');
    const plat = nommer(f.titre) || nommer(desc) || (f.site === 'tiktok' ? 'Recette TikTok' : 'Recette YouTube');
    const lu = lireTexte(source);
    const portions = lu.portions || 4;
    const base = C.envies && C.envies.classique ? C.envies.classique(plat) || (f.titre && C.envies.classique(f.titre)) : null;
    let ingredients = lu.ingredients.map((x) => reconnaitre(x, portions));
    let steps = lu.etapes.slice(0, 14);
    let origine;
    if (ingredients.length >= 2) {
      origine = `${ingredients.length} ingrédients lus dans ${desc ? 'le texte collé' : 'le titre de la vidéo'}${steps.length ? `, ${steps.length} étape${steps.length > 1 ? 's' : ''} aussi` : ''}. Prix estimés : vérifiez les quantités.`;
    } else if (base) {
      ingredients = base.ingredients;
      if (!steps.length) steps = base.steps;
      origine = `${desc ? 'Aucun ingrédient trouvé dans le texte collé' : 'Le titre ne donne pas les ingrédients'} : Commis propose sa recette de base « ${base.name} ». Ajustez-la en regardant la vidéo.`;
    } else {
      ingredients = [];
      origine = desc
        ? 'Aucun ingrédient trouvé dans le texte collé, et Commis ne connaît pas ce plat : la recette est créée avec le lien, à compléter.'
        : f.site === 'tiktok'
          ? 'TikTok ne transmet pas la légende de ses vidéos. Touchez « Modifier » et collez la légende dans « Texte de la vidéo » : Commis y lira les ingrédients. Sinon, la recette est créée avec le lien, à compléter.'
          : 'Le titre ne donne pas les ingrédients et Commis ne connaît pas ce plat. Touchez « Modifier » et collez la description de la vidéo : Commis y lira les ingrédients. Sinon, la recette est créée avec le lien, à compléter.';
    }
    if (!steps.length) steps = ['Regarder la vidéo et noter les étapes.'];
    const texte = `${plat} ${source}`;
    return {
      origine,
      lus: lu.ingredients.length,
      r: {
        id: `video-${f.site === 'youtube' ? 'yt' : 'tt'}-${f.id}`,
        name: plat,
        category: base && ingredients === base.ingredients ? base.category : categorie(plat) || categorie(texte) || 'Autre',
        prepTime: duree(`${f.titre} ${desc.split('\n')[0]}`) || (base ? base.prepTime : 30),
        servings: base && ingredients === base.ingredients ? 4 : portions,
        description: `Recette tirée d’une vidéo ${f.site === 'youtube' ? 'YouTube' : 'TikTok'}${f.auteur ? ` de ${f.auteur}` : ''}.`,
        ingredients,
        steps,
        favorite: false,
        validated: false,
        toTest: true,
        demo: false,
        source: 'video',
        videoUrl: f.url,
        videoSite: f.site,
        videoAuthor: f.auteur,
        photo: f.photo,
        createdAt: Date.now(),
      },
    };
  }

  /* ---------- Image du plat ----------
     En plus de la miniature (souvent un visage et du texte), YouTube publie trois captures de la vidéo,
     à 25, 50 et 75 % : la préparation puis, souvent, le plat fini. Commis retire les bandes noires et
     garde la plus appétissante (la plus colorée, ni trop sombre ni délavée). Les autres restent proposées,
     avec une illustration du même type de plat et votre propre photo. TikTok ne donne aucune image. */
  const ytid = (r) => (r.videoSite === 'youtube' ? lireLien(r.videoUrl || '').id || '' : '');
  const chargerImg = (url) =>
    new Promise((ok) => {
      const im = new Image();
      im.crossOrigin = 'anonymous';
      im.referrerPolicy = 'no-referrer';
      im.onload = () => ok(im.naturalWidth > 200 ? im : null); // image absente : YouTube renvoie une vignette grise de 120 px
      im.onerror = () => ok(null);
      im.src = url;
    });
  const premiere = async (urls) => {
    for (const u of urls) {
      const im = await chargerImg(u);
      if (im) return im;
    }
    return null;
  };
  function analyser(im) {
    const W = 120;
    const H = Math.max(1, Math.round((W * im.naturalHeight) / im.naturalWidth));
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(im, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H).data;
    const lum = (x, y) => {
      const i = (y * W + x) * 4;
      return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    };
    const sombre = (n, f) => {
      let s = 0;
      let mx = 0;
      for (let k = 0; k < n; k++) {
        const l = f(k);
        s += l;
        if (l > mx) mx = l;
      }
      return s / n < 22 && mx < 70;
    };
    let t = 0;
    let b = H - 1;
    let l = 0;
    let r = W - 1;
    while (t < H / 3 && sombre(W, (x) => lum(x, t))) t++;
    while (b > (2 * H) / 3 && sombre(W, (x) => lum(x, b))) b--;
    while (l < W / 3 && sombre(H, (y) => lum(l, y))) l++;
    while (r > (2 * W) / 3 && sombre(H, (y) => lum(r, y))) r--;
    // Vidéo verticale (Short) dans une image 16:9 : les côtés sont une copie floue. On repère la netteté
    // par colonne ; si les côtés sont flous et que la coupure tombe au bord d'une bande 9:16, on garde le centre.
    if (r - l > (b - t) * 1.4) {
      const net = [];
      for (let x = 1; x < W; x++) {
        let e = 0;
        for (let y = t + 1; y <= b; y++) e += Math.abs(lum(x, y) - lum(x - 1, y)) + Math.abs(lum(x, y) - lum(x, y - 1));
        net[x] = e / (b - t);
      }
      const moy = (a, z) => {
        let s = 0;
        let n = 0;
        for (let x = Math.max(1, Math.round(a)); x <= Math.min(W - 1, Math.round(z)); x++) {
          s += net[x];
          n++;
        }
        return n ? s / n : 0;
      };
      const larg = ((b - t + 1) * 9) / 16;
      const g0 = l + (r - l + 1 - larg) / 2;
      const g1 = g0 + larg;
      const centre = moy(g0 + 3, g1 - 3);
      const cotes = (moy(l, g0 - 3) + moy(g1 + 3, r)) / 2;
      if (centre > 0 && cotes < centre * 0.45) {
        l = Math.round(g0);
        r = Math.round(g1) - 1;
      }
    }
    let n = 0;
    let a1 = 0;
    let a2 = 0;
    let q1 = 0;
    let q2 = 0;
    let sl = 0;
    for (let y = t; y <= b; y++)
      for (let x = l; x <= r; x++) {
        const i = (y * W + x) * 4;
        const rg = d[i] - d[i + 1];
        const yb = 0.5 * (d[i] + d[i + 1]) - d[i + 2];
        a1 += rg;
        a2 += yb;
        q1 += rg * rg;
        q2 += yb * yb;
        sl += lum(x, y);
        n++;
      }
    const m1 = a1 / n;
    const m2 = a2 / n;
    const couleur = Math.sqrt(Math.max(0, q1 / n - m1 * m1) + Math.max(0, q2 / n - m2 * m2)) + 0.3 * Math.sqrt(m1 * m1 + m2 * m2);
    const L = sl / n;
    const score = couleur + (m2 > 0 ? 6 : 0) - Math.max(0, 60 - L) - Math.max(0, L - 210); // tons chauds bienvenus
    const kx = im.naturalWidth / W;
    const ky = im.naturalHeight / H;
    return { score, crop: { x: l * kx, y: t * ky, w: (r - l + 1) * kx, h: (b - t + 1) * ky } };
  }
  function recadrer(im, c, max = 900) {
    const k = Math.min(1, max / c.w);
    const cv = document.createElement('canvas');
    cv.width = Math.round(c.w * k);
    cv.height = Math.round(c.h * k);
    cv.getContext('2d').drawImage(im, c.x, c.y, c.w, c.h, 0, 0, cv.width, cv.height);
    return cv.toDataURL('image/jpeg', 0.82);
  }
  const ILLU = [
    [/bolo/, 'spaghetti-bolognaise'],
    [/\b(carbonara|alfredo)\b|pates? (a la )?creme|cremeu/, 'plat-pates-creme'],
    [/\b(pates|pasta|spaghettis?|pennes?|tagliatelles?|lasagnes?|orzo|macaronis?|gnocchis?|paccheri)\b/, 'penne-thon-tomates-olives'],
    [/risotto/, 'risotto-champignons'],
    [/curry|dhal|pois chiches?/, 'curry-pois-chiches-epinards'],
    [/soupe|veloute|potage|minestrone/, 'soupe-courge-croutons'],
    [/lentille/, 'salade-lentilles-feta-courge'],
    [/salade|bowl|poke|taboule/, 'plat-salade-composee'],
    [/quiche|tarte salee|tarte aux poireaux/, 'quiche-poireaux-lardons'],
    [/gratin/, 'gratin-cornettes-jambon'],
    [/rosti/, 'rosti-oeufs-salade'],
    [/omelette|\boeufs?\b|frittata|shakshuka/, 'plat-omelette'],
    [/wok|nouilles|tofu|ramen|pad thai/, 'wok-tofu-nouilles'],
    [/saumon|poisson|cabillaud|truite|colin/, 'saumon-pommes-de-terre-brocoli'],
    [/saucisses?/, 'saucisses-puree-carottes'],
    [/poulet.*(creme|riz)|emince/, 'emince-poulet-creme-riz'],
    [/poulet|cuisses?/, 'cuisses-poulet-legumes-hiver'],
    [/mijot|ragout|bourguignon|pot au feu|daube/, 'plat-mijote'],
    [/papillote/, 'plat-papillote'],
    [/poelee/, 'plat-poelee'],
  ];
  const illustration = (r) => {
    const n = C.norm(`${r.name} ${r.category}`);
    const hit = ILLU.find(([re]) => re.test(n));
    return hit ? `assets/img/recettes/${hit[1]}.webp` : '';
  };
  // Images possibles pour une recette, la plus appétissante d'abord
  async function imagesPour(r) {
    const out = [];
    const id = ytid(r);
    if (id) {
      const base = `https://i.ytimg.com/vi/${id}/`;
      const noms = { 3: 'Fin de la vidéo', 2: 'Milieu', 1: 'Début' };
      const prises = await Promise.all(
        [3, 2, 1].map(async (n) => {
          const im = await premiere([`${base}maxres${n}.jpg`, `${base}sd${n}.jpg`, `${base}hq${n}.jpg`]);
          if (!im) return null;
          try {
            const a = analyser(im);
            return { id: `f${n}`, label: noms[n], src: recadrer(im, a.crop), score: a.score };
          } catch (e) {
            return null;
          }
        })
      );
      prises.filter(Boolean).sort((a, b) => b.score - a.score).forEach((x) => out.push(x));
      const mini = await premiere([`${base}maxresdefault.jpg`, `${base}hqdefault.jpg`]);
      if (mini)
        try {
          out.push({ id: 'mini', label: 'Miniature', src: recadrer(mini, analyser(mini).crop) });
        } catch (e) {
          /* image protégée : on s'en passe */
        }
    }
    const web = C.photoPlat ? await C.photoPlat(r.name) : null;
    if (web) out.push({ id: 'web', label: 'Photo du plat', src: web.src, page: web.page });
    const illu = illustration(r);
    if (illu) out.push({ id: 'illu', label: 'Illustration', src: illu });
    return out;
  }
  const grille = (images, photo, act) =>
    `<div class="vid-imgs" role="radiogroup" aria-label="Image de la recette">${images
      .map((x, i) => `<button type="button" class="vid-im ${photo === x.src ? 'is-on' : ''}" role="radio" aria-checked="${photo === x.src}" data-act="${act}" data-i="${i}"><img src="${esc(x.src)}" alt="" referrerpolicy="no-referrer"><span>${esc(x.label)}</span></button>`)
      .join('')}<button type="button" class="vid-im vid-im--plus" data-act="${act}" data-i="photo"><span class="vid-im-ic">${icon('upload', 20)}</span><span>Votre photo</span></button></div>`;
  const votrePhoto = async () => {
    const file = await C.pickFile('image/*');
    if (!file) return null;
    try {
      return await C.readImage(file, 1100);
    } catch (e) {
      C.toast('Image illisible.');
      return null;
    }
  };

  // Changer l'image d'une recette déjà importée (depuis sa fiche)
  async function changerImage(id) {
    const r = C.recipe(id);
    if (!r) return;
    const st = { images: null, photo: r.photo };
    const sheet = C.sheet({
      title: 'Image de la recette',
      sub: esc(r.name),
      body: () => (st.images ? `<p class="small muted" style="margin-bottom:12px">${ytid(r) ? 'Captures de la vidéo (bandes noires retirées), illustration ou votre photo.' : 'TikTok ne fournit pas d’image : choisissez une illustration ou votre photo.'}</p>${grille(st.images, st.photo, 'vid.imgFiche')}` : '<p class="muted">Recherche des plus belles images…</p>'),
    });
    C.ui.vidImg = { st, r, sheet };
    st.images = await imagesPour(r);
    sheet.refresh && sheet.refresh();
  }

  // Recettes importées avant : remplace la miniature YouTube par la capture la plus appétissante (une fois)
  let enCours = false;
  const essayees = new Set(); // une seule tentative par recette et par visite
  async function ameliorerAnciennes() {
    if (enCours) return;
    const vieilles = C.S.recipes.filter((r) => r.source === 'video' && !essayees.has(r.id) && ((r.videoSite === 'youtube' && /^https:\/\/i\.ytimg\.com\//.test(r.photo || '')) || (r.videoSite === 'tiktok' && !/^(data:|assets\/)/.test(r.photo || ''))));
    if (!vieilles.length) return;
    enCours = true;
    try {
      for (const r of vieilles.slice(0, 12)) {
        essayees.add(r.id);
        const imgs = await imagesPour(r);
        const best = imgs.find((x) => x.id[0] === 'f') || imgs.find((x) => x.id === 'web') || imgs.find((x) => x.id === 'illu');
        const cur = C.recipe(r.id);
        if (best && cur && cur.photo === r.photo) await C.save.recipe({ ...cur, photo: best.src, photoSource: best.page || '' });
      }
    } finally {
      enCours = false;
    }
  }

  /* ---------- Fenêtre ---------- */
  function fenetre() {
    const st = { lien: '', desc: '', etat: '', erreur: '', prop: null };
    const body = () => {
      if (st.prop) {
        const r = st.prop.r;
        return `<div class="vid-card">
            ${r.photo ? `<img class="vid-img" src="${esc(r.photo)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : `<span class="vid-img vid-img--vide">${icon('play', 28)}</span>`}
            <div class="vid-b"><p class="eyebrow">${r.videoSite === 'youtube' ? 'YouTube' : 'TikTok'}${r.videoAuthor ? ` · ${esc(r.videoAuthor)}` : ''}</p>
              ${C.field('Nom de la recette', `<input class="inp" id="vid-nom" value="${esc(r.name)}" maxlength="90">`)}</div>
          </div>
          <p class="vid-lab">Image de la recette</p>
          ${grille(st.images || [], r.photo, 'vid.img')}
          <div class="note note--soft" style="margin-top:14px">${icon('info', 18)}<span>${esc(st.prop.origine)}</span></div>
          <div class="vid-sum"><span><b>${r.ingredients.length}</b> ingrédient${r.ingredients.length > 1 ? 's' : ''}</span><span><b>${r.steps.length}</b> étape${r.steps.length > 1 ? 's' : ''}</span><span><b>${r.prepTime}</b> min</span><span>${esc(r.category)}</span></div>
          ${r.ingredients.length ? `<ul class="vid-ing">${r.ingredients.map((x) => `<li>${x.qty && x.unit !== 'pièce' ? `${esc(C.fmtQty ? C.fmtQty(x.qty, x.unit) : `${x.qty} ${x.unit}`)} · ` : x.qty > 1 ? `${x.qty} · ` : ''}${esc(x.name)}</li>`).join('')}</ul>` : ''}
          <p class="small muted" style="margin-top:12px">Elle arrive dans « À tester », avec le lien de la vidéo sur sa fiche.</p>`;
      }
      return `<p style="color:var(--ink-2)">Collez le lien d’une vidéo de recette : Commis en fait une fiche, avec ingrédients, étapes et prix estimé.</p>
        <div class="vid-in">
          <input class="inp" id="vid-url" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://www.youtube.com/watch?v=… ou https://www.tiktok.com/@…/video/…" value="${esc(st.lien)}" ${st.etat ? 'disabled' : ''}>
          ${navigator.clipboard && navigator.clipboard.readText ? `<button class="btn btn--ghost btn--sm" type="button" data-act="vid.coller" ${st.etat ? 'disabled' : ''}>Coller</button>` : ''}
        </div>
        ${st.erreur ? `<p class="vid-err" role="alert">${esc(st.erreur)}</p>` : st.etat ? `<p class="small muted" style="margin-top:10px">${esc(st.etat)}</p>` : ''}
        <label class="field vid-desc"><span>Texte de la vidéo <em>(facultatif)</em></span>
          <textarea class="inp" id="vid-desc" rows="4" placeholder="Collez ici la légende TikTok ou la description YouTube, avec la liste des ingrédients." ${st.etat ? 'disabled' : ''}>${esc(st.desc)}</textarea>
          <small>TikTok et YouTube ne donnent pas ce texte gratuitement : copiez-le depuis la vidéo. Sans lui, Commis se fie au titre et à ses recettes de base.</small></label>
        <p class="small muted" style="margin-top:14px">Une vidéo à la fois : les playlists ne sont pas lisibles gratuitement.</p>`;
    };
    const foot = () =>
      st.prop
        ? `<button class="btn btn--ghost sp" data-act="vid.retour">Modifier</button><button class="btn btn--citron" data-act="vid.ajouter">${icon('plus', 18)} Ajouter la recette</button>`
        : `<button class="btn btn--ghost" data-close>Annuler</button><button class="btn btn--citron" data-act="vid.lire" ${st.etat ? 'disabled' : ''}>Lire la vidéo</button>`;
    const sheet = C.sheet({
      title: 'Recette depuis une vidéo',
      sub: 'YouTube ou TikTok',
      body,
      foot,
    });
    st.refresh = () => sheet.refresh();
    st.close = () => sheet.close();
    C.ui.vid = st;
    const inp = document.getElementById('vid-url');
    if (inp && !matchMedia('(pointer: coarse)').matches) setTimeout(() => inp.focus(), 250);
  }

  async function lire() {
    const st = C.ui.vid;
    const inp = document.getElementById('vid-url');
    if (inp) st.lien = inp.value.trim();
    const ds = document.getElementById('vid-desc');
    if (ds) st.desc = ds.value;
    st.erreur = '';
    const lien = lireLien(st.lien);
    if (lien.erreur) {
      st.erreur = lien.erreur;
      return st.refresh();
    }
    st.etat = lien.site === 'youtube' ? 'Lecture de la vidéo YouTube…' : 'Lecture de la vidéo TikTok…';
    st.refresh();
    try {
      const f = await fiche(lien);
      const deja = C.recipe(`video-${f.site === 'youtube' ? 'yt' : 'tt'}-${f.id}`);
      if (deja) {
        st.close();
        C.go(`#/recettes/${deja.id}`);
        return C.toast('Cette vidéo est déjà dans vos recettes.');
      }
      const prop = composer(f, st.desc);
      st.etat = 'Recherche de la plus belle image…';
      st.refresh();
      st.images = await imagesPour(prop.r);
      prop.r.photo = (st.images[0] && st.images[0].src) || '';
      prop.r.photoSource = (st.images[0] && st.images[0].page) || '';
      st.prop = prop;
      if (lien.dansPlaylist) st.prop.origine += ' (Seule cette vidéo de la playlist est importée.)';
    } catch (e) {
      st.erreur = e.message;
    }
    st.etat = '';
    st.refresh();
  }

  Object.assign(C.acts, {
    'rec.video': () => fenetre(),
    'vid.lire': () => lire(),
    'vid.coller': async () => {
      try {
        const t = await navigator.clipboard.readText();
        const inp = document.getElementById('vid-url');
        if (inp && t) {
          inp.value = t.trim();
          lire();
        }
      } catch (e) {
        C.toast('Collez le lien dans le champ (appui long › Coller).');
      }
    },
    'vid.img': async (el) => {
      const st = C.ui.vid;
      const nom = document.getElementById('vid-nom');
      if (nom) st.prop.r.name = nom.value;
      if (el.dataset.i === 'photo') {
        const src = await votrePhoto();
        if (!src) return;
        st.images.unshift({ id: 'perso', label: 'Votre photo', src });
        st.prop.r.photo = src;
        st.prop.r.photoSource = '';
      } else {
        const x = st.images[Number(el.dataset.i)];
        st.prop.r.photo = x.src;
        st.prop.r.photoSource = x.page || '';
      }
      st.refresh();
    },
    'vid.image': (el) => changerImage(el.dataset.id),
    'vid.imgFiche': async (el) => {
      const { st, r, sheet } = C.ui.vidImg;
      let src;
      let page = '';
      if (el.dataset.i === 'photo') src = await votrePhoto();
      else ({ src, page = '' } = st.images[Number(el.dataset.i)]);
      if (!src) return;
      const cur = C.recipe(r.id);
      if (cur) await C.save.recipe({ ...cur, photo: src, photoSource: page });
      sheet.close();
      C.toast('Image mise à jour');
    },
    'vid.retour': () => {
      C.ui.vid.prop = null;
      C.ui.vid.refresh();
    },
    'vid.ajouter': async () => {
      const st = C.ui.vid;
      const r = { ...st.prop.r };
      const nom = document.getElementById('vid-nom');
      if (nom && nom.value.trim()) r.name = nom.value.trim();
      await C.save.recipe(r);
      st.close();
      C.ui.rtab = 'tester';
      C.go(`#/recettes/${r.id}`);
      C.toast('Recette ajoutée dans « À tester ».');
    },
  });
  // Entrée au clavier dans le champ du lien
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target && e.target.id === 'vid-url') {
      e.preventDefault();
      lire();
    }
  });

  C.video = { lireLien, lireTexte, nommer, composer, imagesPour, ameliorerAnciennes, illustration }; // aussi pour vérifier depuis la console
})();
