/* Commis — « Mes envies » : on dit (ou écrit) ce qu'on a envie de manger dans la semaine,
   Commis place ces plats aux bons jours puis complète le reste du planning.

   Tout se passe sur l'appareil, sans intelligence artificielle ni service payant :
     - la dictée utilise la reconnaissance vocale du navigateur (Safari, Chrome), quand elle existe ;
     - la phrase est comprise par des règles : jours (« mardi soir », « demain », « ce midi-là »),
       repas (« midi », « dîner » au sens suisse, « soir », « souper »), plats nommés, et souhaits
       (« léger », « rapide », « sans viande », « poisson », « pas cher », « copieux ») ;
     - un plat est cherché d'abord dans vos recettes, puis dans une petite base de classiques ;
       à défaut, il est noté comme recette « à compléter ». */
(function () {
  'use strict';
  const C = window.C;
  const { esc, icon } = C;
  const E = C.eng;

  /* ---------- Base de classiques (quand le plat n'est pas encore dans vos recettes) ----------
     Prix estimés en CHF au prix habituel, pour 4 personnes ; les promotions s'y appliquent ensuite. */
  const i = (name, qty, unit, cat, price) => ({ name, qty, unit, cat, price });
  const CLASSIQUES = [
    { cle: /\braclette\b/, name: 'Raclette', category: 'Gratin & four', prepTime: 30, lourd: true,
      ingredients: [i('Fromage à raclette', 800, 'g', 'lait', 16), i('Pommes de terre', 1200, 'g', 'fl', 3), i('Cornichons', 1, 'bocal', 'epi', 2.5), i('Petits oignons au vinaigre', 1, 'bocal', 'epi', 2.5), i('Viande séchée', 150, 'g', 'vp', 8)],
      steps: ['Cuire les pommes de terre en robe des champs 20 à 25 minutes.', 'Allumer l’appareil à raclette et trancher le fromage.', 'Servir avec les cornichons, les petits oignons et la viande séchée.'] },
    { cle: /\bfondue chinoise\b/, name: 'Fondue chinoise', category: 'Viande', prepTime: 30, lourd: true,
      ingredients: [i('Viande pour fondue chinoise', 600, 'g', 'vp', 24), i('Bouillon de bœuf', 1, 'l', 'epi', 1.5), i('Sauces pour fondue', 1, 'assortiment', 'epi', 5), i('Riz long grain', 300, 'g', 'epi', 1.1)],
      steps: ['Porter le bouillon à frémissement dans le caquelon.', 'Cuire le riz.', 'Chacun cuit sa viande dans le bouillon ; servir avec les sauces.'] },
    { cle: /\bfondue\b/, name: 'Fondue moitié-moitié', category: 'Gratin & four', prepTime: 25, lourd: true,
      ingredients: [i('Fondue moitié-moitié', 800, 'g', 'lait', 18), i('Pain mi-blanc', 600, 'g', 'boul', 3.5), i('Vin blanc', 2, 'dl', 'bois', 2.5), i('Ail', 1, 'gousse', 'fl', 0.2), i('Maïzena', 1, 'c. à soupe', 'epi', 0.1)],
      steps: ['Frotter le caquelon avec l’ail, verser le vin et chauffer.', 'Ajouter le fromage et remuer en huit jusqu’à ce qu’il soit fondu et lisse.', 'Lier avec la maïzena délayée, servir avec le pain coupé en dés.'] },
    { cle: /\bbolo(gnaise)?s?\b/, name: 'Spaghetti bolognaise', category: 'Pâtes & riz', prepTime: 40,
      ingredients: [i('Viande hachée de bœuf', 400, 'g', 'vp', 7.5), i('Spaghetti', 500, 'g', 'epi', 1.6), i('Tomates pelées', 800, 'g', 'epi', 2.2), i('Oignon', 1, 'pièce', 'fl', 0.4), i('Carottes', 2, 'pièce', 'fl', 0.6), i('Parmesan râpé', 60, 'g', 'lait', 2.2)],
      steps: ['Hacher l’oignon, couper les carottes en dés et les faire revenir 5 minutes.', 'Ajouter la viande et la dorer, puis les tomates ; mijoter 25 minutes.', 'Cuire les spaghetti al dente et servir avec la sauce et le parmesan.'] },
    { cle: /\bcarbonara\b/, name: 'Pâtes à la carbonara', category: 'Pâtes & riz', prepTime: 20,
      ingredients: [i('Spaghetti', 500, 'g', 'epi', 1.6), i('Lardons', 200, 'g', 'vp', 3.9), i('Œufs', 4, 'pièce', 'lait', 2.4), i('Parmesan râpé', 80, 'g', 'lait', 2.9)],
      steps: ['Cuire les spaghetti.', 'Dorer les lardons à sec.', 'Hors du feu, mêler pâtes, lardons, œufs battus et parmesan ; poivrer.'] },
    { cle: /\blasagnes?\b/, name: 'Lasagnes à la bolognaise', category: 'Gratin & four', prepTime: 60, lourd: true,
      ingredients: [i('Feuilles de lasagne', 250, 'g', 'epi', 2), i('Viande hachée de bœuf', 500, 'g', 'vp', 9.5), i('Tomates pelées', 800, 'g', 'epi', 2.2), i('Lait', 5, 'dl', 'lait', 0.9), i('Beurre', 40, 'g', 'lait', 0.6), i('Farine', 40, 'g', 'epi', 0.1), i('Gruyère râpé', 120, 'g', 'lait', 3)],
      steps: ['Préparer une sauce bolognaise (viande, tomates) et une béchamel (beurre, farine, lait).', 'Alterner pâtes, bolognaise et béchamel dans un plat ; finir par le fromage.', 'Cuire 35 minutes à 200 °C.'] },
    { cle: /\bpizzas?\b/, name: 'Pizza maison', category: 'Gratin & four', prepTime: 35,
      ingredients: [i('Pâte à pizza', 2, 'pièce', 'epi', 4), i('Sauce tomate', 200, 'g', 'epi', 1.2), i('Mozzarella', 2, 'pièce', 'lait', 3), i('Jambon', 150, 'g', 'vp', 3.5), i('Champignons de Paris', 200, 'g', 'fl', 2.2)],
      steps: ['Étaler la pâte et la napper de sauce tomate.', 'Garnir de mozzarella, jambon et champignons.', 'Cuire 12 à 15 minutes à 230 °C.'] },
    { cle: /\b(ham)?burgers?\b/, name: 'Burgers maison', category: 'Viande', prepTime: 30, lourd: true,
      ingredients: [i('Pains à burger', 4, 'pièce', 'boul', 3), i('Viande hachée de bœuf', 500, 'g', 'vp', 9.5), i('Cheddar', 4, 'tranche', 'lait', 2.5), i('Salade', 1, 'pièce', 'fl', 1.5), i('Tomates', 2, 'pièce', 'fl', 1), i('Frites au four', 750, 'g', 'surg', 3.5)],
      steps: ['Former 4 steaks et les saisir 3 minutes par face.', 'Cuire les frites au four.', 'Monter les burgers avec fromage, salade et tomate.'] },
    { cle: /\b(tacos|fajitas?|burritos?)\b/, name: 'Tacos au bœuf', category: 'Viande', prepTime: 30,
      ingredients: [i('Tortillas', 8, 'pièce', 'boul', 3.5), i('Viande hachée de bœuf', 400, 'g', 'vp', 7.5), i('Poivron', 2, 'pièce', 'fl', 2), i('Haricots rouges', 400, 'g', 'epi', 1.2), i('Crème acidulée', 2, 'dl', 'lait', 1.8), i('Fromage râpé', 100, 'g', 'lait', 2)],
      steps: ['Faire revenir la viande avec les poivrons en lamelles et les épices.', 'Ajouter les haricots égouttés et réchauffer.', 'Garnir les tortillas chaudes ; servir avec la crème et le fromage.'] },
    { cle: /\bchili\b/, name: 'Chili con carne', category: 'Viande', prepTime: 45, lourd: true,
      ingredients: [i('Viande hachée de bœuf', 400, 'g', 'vp', 7.5), i('Haricots rouges', 800, 'g', 'epi', 2.4), i('Tomates pelées', 800, 'g', 'epi', 2.2), i('Oignon', 1, 'pièce', 'fl', 0.4), i('Riz long grain', 300, 'g', 'epi', 1.1)],
      steps: ['Faire revenir l’oignon et la viande.', 'Ajouter tomates, haricots, épices ; mijoter 30 minutes.', 'Servir avec le riz.'] },
    { cle: /\bpapet\b/, name: 'Papet vaudois', category: 'Viande', prepTime: 50, lourd: true,
      ingredients: [i('Saucisson vaudois', 1, 'pièce', 'vp', 9), i('Poireaux', 1000, 'g', 'fl', 4), i('Pommes de terre', 800, 'g', 'fl', 2), i('Crème entière', 1, 'dl', 'lait', 1)],
      steps: ['Émincer les poireaux et les faire revenir ; ajouter les pommes de terre en dés et un peu d’eau.', 'Poser le saucisson dessus et cuire à couvert 40 minutes.', 'Lier à la crème et servir avec le saucisson tranché.'] },
    { cle: /\bcroute\b/, name: 'Croûte au fromage', category: 'Gratin & four', prepTime: 25, lourd: true,
      ingredients: [i('Pain rassis', 8, 'tranche', 'boul', 2), i('Gruyère', 300, 'g', 'lait', 7.5), i('Vin blanc', 1, 'dl', 'bois', 1.2), i('Œufs', 4, 'pièce', 'lait', 2.4)],
      steps: ['Arroser les tranches de pain de vin blanc.', 'Couvrir de fromage et gratiner 10 minutes à 220 °C.', 'Servir avec un œuf au plat sur chaque croûte.'] },
    { cle: /\brosti\b/, name: 'Rösti et œufs au plat', category: 'Végétarien', prepTime: 35,
      ingredients: [i('Pommes de terre', 1000, 'g', 'fl', 2.5), i('Beurre', 40, 'g', 'lait', 0.6), i('Œufs', 4, 'pièce', 'lait', 2.4), i('Salade', 1, 'pièce', 'fl', 1.5)],
      steps: ['Râper les pommes de terre cuites la veille.', 'Les dorer au beurre 10 minutes par face.', 'Servir avec un œuf au plat et la salade.'] },
    { cle: /\bcurry\b/, name: 'Curry de poulet au lait de coco', category: 'Viande', prepTime: 35,
      ingredients: [i('Émincé de poulet', 500, 'g', 'vp', 9.9), i('Lait de coco', 4, 'dl', 'epi', 2.2), i('Pâte de curry', 2, 'c. à soupe', 'epi', 1), i('Poivron', 1, 'pièce', 'fl', 1), i('Riz basmati', 300, 'g', 'epi', 1.5)],
      steps: ['Saisir le poulet, ajouter la pâte de curry et le poivron.', 'Verser le lait de coco et mijoter 15 minutes.', 'Servir avec le riz.'] },
    { cle: /\bpoulet roti\b/, name: 'Poulet rôti et légumes', category: 'Viande', prepTime: 75, lourd: true,
      ingredients: [i('Poulet entier', 1, 'pièce', 'vp', 12), i('Pommes de terre', 800, 'g', 'fl', 2), i('Carottes', 4, 'pièce', 'fl', 1.2), i('Oignon', 2, 'pièce', 'fl', 0.8)],
      steps: ['Disposer le poulet et les légumes coupés dans un plat, huiler, saler.', 'Rôtir 1 heure à 200 °C en arrosant.', 'Découper et servir.'] },
    { cle: /\bsaumon\b/, name: 'Saumon, riz et légumes', category: 'Poisson', prepTime: 25,
      ingredients: [i('Filets de saumon', 4, 'pièce', 'vp', 14), i('Riz long grain', 300, 'g', 'epi', 1.1), i('Brocoli', 500, 'g', 'fl', 3), i('Citron', 1, 'pièce', 'fl', 0.5)],
      steps: ['Cuire le riz et le brocoli à la vapeur.', 'Saisir le saumon 4 minutes par face.', 'Servir avec un filet de citron.'] },
    { cle: /\bpoisson\b/, name: 'Filets de poisson, pommes vapeur', category: 'Poisson', prepTime: 25,
      ingredients: [i('Filets de cabillaud', 4, 'pièce', 'vp', 13), i('Pommes de terre', 800, 'g', 'fl', 2), i('Épinards', 400, 'g', 'fl', 3), i('Citron', 1, 'pièce', 'fl', 0.5)],
      steps: ['Cuire les pommes de terre à la vapeur.', 'Poêler le poisson 3 minutes par face.', 'Servir avec les épinards et le citron.'] },
    { cle: /\bsalades?\b/, name: 'Grande salade composée', category: 'Végétarien', prepTime: 15, leger: true,
      ingredients: [i('Salade', 1, 'pièce', 'fl', 1.5), i('Tomates', 3, 'pièce', 'fl', 1.5), i('Concombre', 1, 'pièce', 'fl', 1), i('Œufs', 4, 'pièce', 'lait', 2.4), i('Feta', 200, 'g', 'lait', 3.5)],
      steps: ['Laver et couper les légumes.', 'Cuire les œufs durs 9 minutes.', 'Assembler avec la feta et une vinaigrette.'] },
    { cle: /\b(soupe|veloute)s?\b/, name: 'Soupe de légumes', category: 'Végétarien', prepTime: 35, leger: true,
      ingredients: [i('Poireaux', 2, 'pièce', 'fl', 2), i('Carottes', 4, 'pièce', 'fl', 1.2), i('Pommes de terre', 400, 'g', 'fl', 1), i('Bouillon de légumes', 1, 'l', 'epi', 1), i('Pain mi-blanc', 400, 'g', 'boul', 2.5)],
      steps: ['Couper les légumes et les faire suer.', 'Couvrir de bouillon et cuire 25 minutes.', 'Mixer et servir avec du pain.'] },
    { cle: /\bomelettes?\b/, name: 'Omelette aux herbes et salade', category: 'Végétarien', prepTime: 15, leger: true,
      ingredients: [i('Œufs', 8, 'pièce', 'lait', 4.8), i('Fines herbes', 1, 'bouquet', 'fl', 1.5), i('Salade', 1, 'pièce', 'fl', 1.5)],
      steps: ['Battre les œufs avec les herbes ciselées.', 'Cuire à feu moyen en ramenant les bords.', 'Servir avec la salade.'] },
    { cle: /\bcrepes?\b/, name: 'Crêpes jambon-fromage', category: 'Gratin & four', prepTime: 35,
      ingredients: [i('Farine', 250, 'g', 'epi', 0.4), i('Lait', 5, 'dl', 'lait', 0.9), i('Œufs', 3, 'pièce', 'lait', 1.8), i('Jambon', 200, 'g', 'vp', 4.5), i('Gruyère râpé', 150, 'g', 'lait', 3.5)],
      steps: ['Préparer la pâte et la laisser reposer 15 minutes.', 'Cuire les crêpes.', 'Garnir de jambon et de fromage, plier et réchauffer.'] },
    { cle: /\b(hachis|parmentier)\b/, name: 'Hachis parmentier', category: 'Gratin & four', prepTime: 50, lourd: true,
      ingredients: [i('Viande hachée de bœuf', 500, 'g', 'vp', 9.5), i('Pommes de terre', 1000, 'g', 'fl', 2.5), i('Lait', 2, 'dl', 'lait', 0.4), i('Beurre', 40, 'g', 'lait', 0.6), i('Gruyère râpé', 80, 'g', 'lait', 2)],
      steps: ['Préparer une purée avec les pommes de terre, le lait et le beurre.', 'Faire revenir la viande hachée assaisonnée.', 'Monter viande puis purée dans un plat, parsemer de fromage et gratiner 20 minutes.'] },
    { cle: /\bsteak\b/, name: 'Steak frites et salade', category: 'Viande', prepTime: 30,
      ingredients: [i('Steaks de bœuf', 4, 'pièce', 'vp', 18), i('Frites au four', 750, 'g', 'surg', 3.5), i('Salade', 1, 'pièce', 'fl', 1.5)],
      steps: ['Cuire les frites au four.', 'Saisir les steaks selon la cuisson souhaitée.', 'Servir avec la salade.'] },
    { cle: /\bgratin\b/, name: 'Gratin dauphinois', category: 'Gratin & four', prepTime: 70, lourd: true,
      ingredients: [i('Pommes de terre', 1200, 'g', 'fl', 3), i('Crème entière', 3, 'dl', 'lait', 2.8), i('Lait', 3, 'dl', 'lait', 0.6), i('Ail', 1, 'gousse', 'fl', 0.2), i('Gruyère râpé', 100, 'g', 'lait', 2.5)],
      steps: ['Trancher finement les pommes de terre.', 'Les disposer dans un plat frotté d’ail, couvrir de lait et de crème.', 'Parsemer de fromage et cuire 1 heure à 180 °C.'] },
  ];

  /* ---------- Comprendre la phrase ---------- */
  const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const LABEL_J = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  // Mots qui ne disent rien du plat (« je vais faire une… », « mets-moi un… »)
  const VIDES = new Set(
    ('je j ai a veux voudrais aimerais vais va irai faire fais fait ferai manger mange mangerai mangeons mangera on nous vous envie envies ' +
      'de d des du une un le la les l au aux mets met mettre moi me m te propose proposer proposes plutot quelque chose repas plat plats peu ' +
      'avoir bien prendre cuisiner cuisine prevoir prevois avec et puis ensuite alors aussi pour ca cela ce cet cette semaine jour jours ' +
      'genre style truc typiquement exemple donc y il faut qu que bon peut etre trop tres sinon voila ok oui pas mal envoie ajoute rajoute ' +
      'choisis choisir mettrais ferais serait sera est soit en a la fois deux trois chez soi maison bonne idee par').split(' ')
  );
  const SOUHAITS = [
    ['leger', /\b(leger|legere|legers|light|sain|saine|healthy|equilibre)\b/],
    ['rapide', /\b(rapide|rapides|vite|express|simple)\b/],
    ['vege', /\b(vegetarien|vegetarienne|vege|veggie|sans viande)\b/],
    ['poisson', /\b(poisson|poissons)\b/],
    ['eco', /\b(pas cher|economique|petit budget|bon marche)\b/],
    ['copieux', /\b(copieux|copieuse|consistant|reconfortant|gourmand)\b/],
  ];
  const NOM_SOUHAIT = { leger: 'léger', rapide: 'rapide', vege: 'sans viande', poisson: 'poisson', eco: 'pas cher', copieux: 'copieux' };

  const normaliser = (t) =>
    String(t || '')
      .toLowerCase()
      .replace(/œ/g, 'oe')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[,;.!?\n:]+/g, ' , ')
      .replace(/[^a-z0-9, ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  // Découpe la phrase en envies : { jour (0–6 ou null), repas ('midi', 'soir' ou null), texte, souhaits }
  function comprendre(texte, aujourdhui) {
    const mots = normaliser(texte).split(' ');
    const envies = [];
    let cur = null;
    let dernierJour = null;
    const nouvelle = (jour) => {
      cur = { jour, repas: null, mots: [] };
      envies.push(cur);
      if (jour != null) dernierJour = jour;
    };
    nouvelle(null);
    for (let k = 0; k < mots.length; k++) {
      const m = mots[k];
      const suiv = mots[k + 1];
      if (m === 'semaine' && ['cette', 'la', 'toute'].includes(mots[k - 1])) {
        nouvelle(null); // « cette semaine plutôt… » : un souhait pour toute la semaine
        continue;
      }
      const jour = JOURS.indexOf(m);
      if (jour >= 0) {
        nouvelle(jour);
        continue;
      }
      if (m === 'aujourd' || (m === 'aujourdhui')) {
        nouvelle(aujourdhui);
        if (suiv === 'hui') k++;
        continue;
      }
      if (m === 'apres' && suiv === 'demain') {
        nouvelle(aujourdhui == null ? null : aujourdhui + 2);
        k++;
        continue;
      }
      if (m === 'demain') {
        nouvelle(aujourdhui == null ? null : aujourdhui + 1);
        continue;
      }
      const repas = m === 'midi' || m === 'diner' || m === 'dejeuner' ? 'midi' : m === 'soir' || m === 'souper' || m === 'soiree' ? 'soir' : null;
      if (repas) {
        // « ce midi-là » : le jour dont on vient de parler ; « ce soir » : aujourd'hui ; sinon le jour en cours
        if (mots[k - 1] === 'ce' && suiv === 'la') {
          // « … mets-moi un repas léger ce midi-là » : ce qui précède (depuis la dernière virgule ou « et »)
          // décrit ce repas-là, pas le plat d'avant
          const prev = cur;
          let cut = prev.mots.length;
          while (cut > 0 && prev.mots[cut - 1] !== ',' && prev.mots[cut - 1] !== 'et') cut--;
          const repris = prev.mots.splice(cut);
          // le dernier jour cité dont ce repas est encore libre (« mardi soir raclette, jeudi midi
          // bolognaise, et un repas léger ce midi-là » → mardi midi, jeudi midi étant déjà pris)
          const jours = [];
          envies.slice().reverse().forEach((e) => e.jour != null && !jours.includes(e.jour) && jours.push(e.jour));
          const libre = jours.find((d) => !envies.some((e) => e.jour === d && e.repas === repas && e.mots.some((x) => x !== ',' && x !== 'et')));
          nouvelle(libre != null ? libre : dernierJour);
          cur.mots.push(...repris);
          k++;
        } else if (mots[k - 1] === 'ce') {
          nouvelle(aujourdhui);
        } else if (cur.repas && cur.mots.length) {
          nouvelle(cur.jour);
        }
        cur.repas = repas;
        continue;
      }
      if (m === ',') {
        // une virgule sans jour : une autre envie (« une fondue, des tacos ») ; sinon on reste sur le même repas
        if (cur.jour == null && cur.mots.length) nouvelle(null);
        else cur.mots.push(',');
        continue;
      }
      if (m === 'et' && cur.jour == null && cur.mots.length && mots.slice(k + 1).some((x) => !VIDES.has(x))) {
        nouvelle(null);
        continue;
      }
      cur.mots.push(m);
    }
    return envies
      .map((e) => {
        const brut = e.mots.join(' ');
        const souhaits = SOUHAITS.filter(([, re]) => re.test(brut)).map(([id]) => id);
        let plat = brut;
        SOUHAITS.forEach(([id, re]) => id !== 'poisson' && (plat = plat.replace(re, ' ')));
        plat = plat
          .split(' ')
          .filter((w) => w && w !== ',' && !VIDES.has(w))
          .join(' ')
          .trim();
        return { jour: e.jour, repas: e.repas, plat, souhaits };
      })
      .filter((e) => e.plat || e.souhaits.length);
  }

  /* ---------- Trouver la recette ---------- */
  const SYNONYMES = {
    pate: ['spaghetti', 'penne', 'tagliatelle', 'cornette', 'macaroni', 'fusilli', 'linguine', 'pate', 'nouille', 'tortellini', 'ravioli'],
    bolo: ['bolognaise'],
    burger: ['hamburger', 'burger'],
    patate: ['pomme', 'terre'],
  };
  const etendre = (t) => [t, ...(SYNONYMES[t] || [])];
  function chercherRecette(plat, exclure) {
    const q = C.tokens(plat);
    if (!q.length) return null;
    let best = null;
    C.S.recipes.forEach((r) => {
      if (exclure && exclure.has(r.id)) return;
      const rt = new Set(C.tokens(`${r.name} ${r.category || ''}`));
      const hits = q.filter((t) => etendre(t).some((x) => rt.has(x))).length;
      const sc = hits / q.length + (r.validated ? 0.05 : 0) + (r.favorite ? 0.05 : 0) - (E.conflicts(r).length ? 0.3 : 0);
      if (hits && sc >= 0.6 && (!best || sc > best.sc)) best = { r, sc };
    });
    return best && best.r;
  }
  const slug = (s) => C.norm(s).replace(/ /g, '-').slice(0, 40);
  // Recette d'un plat : vos recettes, sinon un classique (créé une fois), sinon « à compléter »
  function recettePour(plat) {
    const r = chercherRecette(plat);
    if (r) return { r, origine: 'vos recettes' };
    const n = normaliser(plat);
    const cl = CLASSIQUES.find((d) => d.cle.test(n));
    if (cl) {
      const id = `envie-${slug(cl.name)}`;
      const deja = C.recipe(id);
      if (deja) return { r: deja, origine: 'vos recettes' };
      return {
        r: { id, name: cl.name, category: cl.category, prepTime: cl.prepTime, servings: 4, description: 'Recette de base proposée par Commis à partir de votre envie. Ajustez-la à votre goût.', ingredients: cl.ingredients.map((x) => ({ ...x })), steps: cl.steps.slice(), favorite: false, validated: false, toTest: false, demo: false, source: 'envie', photo: '', createdAt: Date.now() },
        nouvelle: true,
        origine: 'nouvelle recette de base',
      };
    }
    const nom = plat.charAt(0).toUpperCase() + plat.slice(1);
    const id = `envie-${slug(plat)}`;
    const deja = C.recipe(id);
    if (deja) return { r: deja, origine: 'vos recettes' };
    return {
      r: { id, name: nom, category: 'Autre', prepTime: 30, servings: 4, description: 'Envie notée depuis le planning : ajoutez les ingrédients pour le coût et la liste de courses.', ingredients: [], steps: [], favorite: false, validated: false, toTest: false, demo: false, source: 'envie', photo: '', createdAt: Date.now() },
      nouvelle: true,
      origine: 'à compléter (ingrédients à ajouter)',
    };
  }

  /* ---------- Souhaits sans plat précis (« un repas léger ») ---------- */
  const POISSONS = /\b(saumon|thon|cabillaud|poisson|truite|colin|dorade|merlu|morue|crevette|lieu|perche|sardine|maquereau)/;
  const aPoisson = (r) => r.ingredients.some((x) => POISSONS.test(C.norm(x.name))) || /poisson/i.test(r.category || '');
  const LOURD = /\b(creme|fromage|gruyere|raclette|lardon|beurre|mascarpone|frite)/;
  const kcal = (r) => (C.nutri && C.nutri(r) ? C.nutri(r).kcal : null);
  const VERIFS = {
    leger: (r) => (kcal(r) != null ? kcal(r) <= 550 : /salade|soupe|veloute|legume|bowl|poke|vapeur|omelette/i.test(C.norm(r.name)) || r.ingredients.filter((x) => LOURD.test(C.norm(x.name))).length <= 1),
    rapide: (r) => (r.prepTime || 99) <= 25,
    vege: (r) => !E.hasRealMeat(r) && !aPoisson(r),
    poisson: (r) => aPoisson(r),
    eco: () => true,
    copieux: (r) => (kcal(r) != null ? kcal(r) >= 650 : E.hasRealMeat(r) || /gratin|four/i.test(r.category || '')),
  };
  const convient = (r, souhaits) => souhaits.every((s) => VERIFS[s](r));
  function choisir(souhaits, deja, wid) {
    const promos = E.activePromos(wid);
    const people = C.S.settings.household || 2;
    const pool = E.compatible().filter((r) => r.ingredients.length && convient(r, souhaits) && !deja.has(r.id));
    if (!pool.length) return null;
    const score = (r) => {
      const c = E.recipeCost(r, people, promos);
      return 2 * c.savings + (r.validated ? 1.2 : 0) + (r.favorite ? 0.8 : 0) - (souhaits.includes('eco') ? c.cost / 4 : 0) + Math.random() * 0.8;
    };
    return pool.map((r) => ({ r, s: score(r) })).sort((a, b) => b.s - a.s)[0].r;
  }

  /* ---------- De la phrase au planning ---------- */
  function preparer(texte, wid) {
    const today = wid === C.weekId() ? (new Date().getDay() + 6) % 7 : null;
    const premier = today == null ? 0 : today;
    const plan = C.plan(wid);
    const envies = comprendre(texte, today);
    const lignes = [];
    const pris = {}; // cases déjà attribuées par vos envies
    const utilisees = new Set();
    const general = []; // souhaits sans jour ni plat : appliqués au reste de la semaine
    const libre = (key) => !pris[key];

    // 1. envies avec jour ; 2. plats sans jour, placés dans les cases libres ;
    // les souhaits pour toute la semaine (« plutôt sans viande ») valent aussi pour « un repas léger »
    const avecJour = envies.filter((e) => e.jour != null);
    const sansJour = envies.filter((e) => e.jour == null);
    sansJour.filter((e) => !e.plat).forEach((e) => general.push(...e.souhaits));
    const placer = (e, key) => {
      const d = Number(key[0]);
      const slot = key.slice(2);
      let res;
      if (e.plat) res = recettePour(e.plat);
      else {
        const tous = [...new Set([...e.souhaits, ...general])];
        const r = choisir(tous, utilisees, wid) || choisir(e.souhaits, utilisees, wid);
        res = r ? { r, origine: `repas ${e.souhaits.map((s) => NOM_SOUHAIT[s]).join(', ')}` } : null;
      }
      const avant = plan.slots[key] && C.recipe(plan.slots[key].recipeId);
      if (!res) {
        lignes.push({ key, d, slot, ko: `aucune recette ${e.souhaits.map((s) => NOM_SOUHAIT[s]).join(', ')} trouvée` });
        return;
      }
      pris[key] = res;
      utilisees.add(res.r.id);
      lignes.push({ key, d, slot, res, avant: avant && avant.id !== res.r.id ? avant : null, souhaits: e.souhaits });
    };
    avecJour.forEach((e) => {
      if (e.jour > 6) return lignes.push({ ko: 'au-delà de cette semaine', d: e.jour });
      if (today != null && e.jour < today) return lignes.push({ d: e.jour, slot: e.repas, ko: 'jour déjà passé' });
      const lourd = e.plat && CLASSIQUES.some((c) => c.lourd && c.cle.test(normaliser(e.plat)));
      const slot = e.repas || (e.souhaits.includes('leger') ? 'midi' : lourd ? 'soir' : 'soir');
      placer(e, `${e.jour}-${slot}`);
    });
    sansJour.forEach((e) => {
      if (!e.plat) return;
      const lourd = CLASSIQUES.some((c) => c.lourd && c.cle.test(normaliser(e.plat)));
      const ordre = [];
      for (let d = premier; d < 7; d++) (lourd ? ['soir', 'midi'] : ['soir', 'midi']).forEach((s) => ordre.push(`${d}-${s}`));
      const key = ordre.find((k) => libre(k) && !plan.slots[k]) || ordre.find((k) => libre(k));
      if (key) placer(e, key);
    });
    return { lignes: lignes.sort((a, b) => (a.d ?? 9) - (b.d ?? 9) || (a.slot === 'soir') - (b.slot === 'soir')), general: [...new Set(general)], premier };
  }

  function appliquer(wid, prep, completer) {
    const people = C.S.settings.household || 2;
    const nouvelles = [];
    let places = 0;
    C.save.plan(wid, (slots) => {
      prep.lignes.forEach((l) => {
        if (!l.res) return;
        if (l.res.nouvelle && !C.recipe(l.res.r.id)) nouvelles.push(l.res.r);
        slots[l.key] = { recipeId: l.res.r.id, servings: people, why: ['votre envie'], auto: false, wish: true };
        places++;
      });
    });
    nouvelles.forEach((r) => C.save.recipe(r));
    let complete = 0;
    if (completer) {
      const bonus = prep.general.length ? (r) => (convient(r, prep.general) ? 6 : -8) : null; // net, sans être absolu
      const res = E.generate(wid, { bonus });
      complete = res.filled || 0;
    }
    return { places, complete, nouvelles: nouvelles.length };
  }

  /* ---------- Fenêtre « Mes envies » ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const EXEMPLES = ['Mardi soir une raclette', 'Jeudi midi des pâtes bolognaise', 'Un repas léger vendredi midi', 'Du poisson mercredi', 'Cette semaine plutôt sans viande'];
  let ecoute = null;

  function fenetre() {
    const wid = C.ui.week;
    const st = { texte: '', prep: null, completer: true };
    const nomCase = (l) => `${LABEL_J[l.d] || ''}${l.slot ? ` ${l.slot}` : ''}`;
    const body = () => {
      if (!st.prep)
        return `<p style="color:var(--ink-2)">Dites ou écrivez ce dont vous avez envie cette semaine : des plats à certains jours, ou juste « un repas léger », « du poisson », « rapide »… Commis les place, puis complète le reste avec vos recettes et les promotions.</p>
          <div class="env-in">
            <textarea class="inp" id="env-text" rows="4" placeholder="Ex. Mardi soir je fais une raclette, jeudi midi des pâtes bolognaise, et mets-moi un repas léger ce midi-là.">${esc(st.texte)}</textarea>
            ${SR ? `<button class="env-mic ${ecoute ? 'is-on' : ''}" data-act="env.mic" type="button" aria-label="${ecoute ? 'Arrêter la dictée' : 'Dicter'}">${icon('mic', 22)}</button>` : ''}
          </div>
          <p class="small muted env-etat">${SR ? (ecoute ? 'J’écoute… parlez naturellement, touchez le micro pour arrêter.' : 'Touchez le micro pour parler.') : 'Astuce : utilisez la dictée du clavier (le micro) pour parler.'}</p>
          <div class="chips env-ex">${EXEMPLES.map((x) => `<button class="chip" type="button" data-act="env.ex" data-v="${esc(x)}">${esc(x)}</button>`).join('')}</div>
          <label class="env-chk"><input type="checkbox" data-change="env.fill" ${st.completer ? 'checked' : ''}> Compléter les autres repas de la semaine</label>`;
      const p = st.prep;
      const ok = p.lignes.filter((l) => l.res);
      return `<p style="color:var(--ink-2)">Voici ce que Commis a compris. Rien n’est encore enregistré.</p>
        <div class="rows env-rows">${
          p.lignes.length
            ? p.lignes
                .map((l) =>
                  l.res
                    ? `<div class="row"><span class="row-b"><span class="row-t">${esc(nomCase(l))} · ${esc(l.res.r.name)}</span><span class="row-s">${esc(l.res.origine)}${l.avant ? ` · remplace « ${esc(l.avant.name)} »` : ''}</span></span>${icon('check', 18)}</div>`
                    : `<div class="row is-off"><span class="row-b"><span class="row-t">${esc(nomCase(l))}</span><span class="row-s">${esc(l.ko)}</span></span></div>`
                )
                .join('')
            : '<p class="muted small">Aucun jour ni plat reconnu. Essayez par exemple « mardi soir raclette ».</p>'
        }${p.general.length ? `<div class="row"><span class="row-b"><span class="row-t">Reste de la semaine · plutôt ${esc(p.general.map((s) => NOM_SOUHAIT[s]).join(', '))}</span><span class="row-s">appliqué aux repas complétés</span></span>${icon('check', 18)}</div>` : ''}</div>
        <p class="small muted" style="margin-top:12px">${ok.length} envie${ok.length > 1 ? 's' : ''} placée${ok.length > 1 ? 's' : ''}${st.completer ? ', puis les autres cases libres sont complétées.' : '. Les autres cases restent libres.'}</p>`;
    };
    const foot = () =>
      st.prep
        ? `<button class="btn btn--ghost sp" data-act="env.back">Modifier</button><button class="btn btn--citron" data-act="env.apply" ${st.prep.lignes.some((l) => l.res) || (st.completer && st.prep.general.length) ? '' : 'disabled'}>Remplir le planning</button>`
        : `<button class="btn btn--ghost" data-close>Annuler</button><button class="btn btn--citron" data-act="env.read">Voir ce que ça donne</button>`;
    C.ui.env = st;
    const sheet = C.sheet({ title: 'Mes envies de la semaine', sub: `Semaine ${C.weekNo(wid)} · ${C.weekLabel(wid)}`, body, foot, onClose: () => ecoute && ecoute.stop() });
    st.refresh = () => sheet.refresh();
    st.wid = wid;
  }

  const lireTexte = () => {
    const ta = document.getElementById('env-text');
    if (ta) C.ui.env.texte = ta.value;
  };

  Object.assign(C.acts, {
    'env.open': () => fenetre(),
    'env.ex': (el) => {
      const ta = document.getElementById('env-text');
      if (!ta) return;
      ta.value = (ta.value.trim() ? ta.value.trim().replace(/[.,;]?$/, ', ') : '') + el.dataset.v;
      C.ui.env.texte = ta.value;
    },
    'env.fill': (el) => (C.ui.env.completer = el.checked),
    'env.mic': () => {
      if (ecoute) return ecoute.stop();
      const ta = document.getElementById('env-text');
      const base = ta ? ta.value.trim() : '';
      try {
        ecoute = new SR();
      } catch (e) {
        return C.toast('Dictée indisponible sur ce navigateur.');
      }
      ecoute.lang = 'fr-CH';
      ecoute.interimResults = true;
      ecoute.continuous = true;
      ecoute.onresult = (e) => {
        let dit = '';
        for (let k = 0; k < e.results.length; k++) dit += e.results[k][0].transcript;
        const t = document.getElementById('env-text');
        if (t) t.value = (base ? `${base} ` : '') + dit.trim();
        C.ui.env.texte = t ? t.value : C.ui.env.texte;
      };
      ecoute.onerror = (e) => C.toast(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Micro refusé : autorisez-le dans les réglages du navigateur, ou utilisez la dictée du clavier.' : 'La dictée s’est arrêtée.');
      ecoute.onend = () => {
        ecoute = null;
        lireTexte();
        C.ui.env.refresh();
      };
      ecoute.start();
      lireTexte();
      C.ui.env.refresh();
    },
    'env.read': () => {
      if (ecoute) ecoute.stop();
      lireTexte();
      const st = C.ui.env;
      if (!st.texte.trim()) return C.toast('Dites ou écrivez au moins une envie.');
      st.prep = preparer(st.texte, st.wid);
      st.refresh();
    },
    'env.back': () => {
      C.ui.env.prep = null;
      C.ui.env.refresh();
    },
    'env.apply': () => {
      const st = C.ui.env;
      const res = appliquer(st.wid, st.prep, st.completer);
      C.closeSheet();
      C.toast(`${res.places} envie${res.places > 1 ? 's' : ''} au planning${res.complete ? `, ${res.complete} repas complété${res.complete > 1 ? 's' : ''}` : ''}${res.nouvelles ? ` · ${res.nouvelles} recette${res.nouvelles > 1 ? 's' : ''} ajoutée${res.nouvelles > 1 ? 's' : ''}` : ''}`);
    },
  });

  // Un classique reconnu dans un texte (titre de vidéo…) : sa recette de base, ou null
  const classique = (texte) => {
    const cl = CLASSIQUES.find((d) => d.cle.test(normaliser(texte)));
    return cl ? { name: cl.name, category: cl.category, prepTime: cl.prepTime, ingredients: cl.ingredients.map((x) => ({ ...x })), steps: cl.steps.slice() } : null;
  };
  C.envies = { comprendre, preparer, classique }; // aussi pour vérifier depuis la console
})();
