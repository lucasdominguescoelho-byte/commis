/* Commis — « Mes envies » : on écrit ce qu'on a envie de manger dans la semaine,
   Commis place ces plats aux bons jours puis complète le reste du planning.

   Tout se passe sur l'appareil, sans intelligence artificielle ni service payant :
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

  // Confusions fréquentes de la dictée du clavier (« je dis midi » pour « jeudi midi », « pattes » pour « pâtes »)
  const DICTEE = [
    [/\bje dis (?=midi|soir|matin|a midi)/g, 'jeudi '],
    [/\bpattes?\b/g, 'pates'],
    [/\b(mardis|mars di)\b/g, 'mardi'],
    [/\bmer credi\b/g, 'mercredi'],
    [/\bven dredi\b/g, 'vendredi'],
    [/\bsa medi\b/g, 'samedi'],
    [/\bdi manche\b/g, 'dimanche'],
    [/\blundis\b/g, 'lundi'],
  ];
  const normaliser = (t) =>
    DICTEE.reduce(
      (s, [re, v]) => s.replace(re, v),
      String(t || '')
        .toLowerCase()
        .replace(/œ/g, 'oe')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[,;.!?\n:]+/g, ' , ')
        .replace(/[^a-z0-9, ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    );

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
  function choisir(souhaits, deja, wid, filtre) {
    const promos = E.activePromos(wid);
    const people = C.S.settings.household || 2;
    const pool = E.compatible().filter((r) => r.ingredients.length && E.pourRepas(r) && (!filtre || filtre(r)) && convient(r, souhaits) && !deja.has(r.id));
    if (!pool.length) return null;
    const score = (r) => {
      const c = E.recipeCost(r, people, promos);
      return 2 * c.savings + (r.validated ? 1.2 : 0) + (r.favorite ? 0.8 : 0) - (souhaits.includes('eco') ? c.cost / 4 : 0) + Math.random() * 0.8;
    };
    return pool.map((r) => ({ r, s: score(r) })).sort((a, b) => b.s - a.s)[0].r;
  }

  /* ---------- De la phrase au planning ---------- */
  function preparer(texte, wid, filtre) {
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
        const r = choisir(tous, utilisees, wid, filtre) || choisir(e.souhaits, utilisees, wid, filtre);
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

  /* ---------- Photo d'un plat, trouvée sur Wikipédia (gratuit, sans clé) ----------
     Pour une recette créée à partir d'une envie (« raclette ») : on cherche l'article du plat et on prend
     sa photo, seulement si le titre de l'article reprend bien le nom du plat (jamais de logo ni de dessin). */
  const GENERIQUES = new Set(['maison', 'grand', 'grande', 'petit', 'petite', 'filet', 'facon', 'recette', 'cuisine', 'vapeur', 'pomme', 'legume', 'herbe', 'plat', 'simple', 'rapide', 'lait', 'sauce']);
  const photos = new Map();
  // une requête à la fois, espacées : Wikipédia limite les appels anonymes
  let file = Promise.resolve();
  const pause = () => new Promise((r) => setTimeout(r, 1200));
  const enFile = (f) => {
    const p = file.then(f, f);
    file = p.then(pause, pause);
    return p;
  };
  function photoPlat(nom) {
    const cle = C.norm(nom);
    if (!cle) return Promise.resolve(null);
    if (photos.has(cle)) return photos.get(cle);
    const p = (async () => {
      const toks = C.tokens(nom).filter((t) => t.length > 2 && !GENERIQUES.has(t));
      if (!toks.length) return null;
      const url = `https://fr.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=0&gsrlimit=6&gsrsearch=${encodeURIComponent(nom)}&prop=pageimages&piprop=thumbnail&pithumbsize=800`;
      const appel = () =>
        fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer' }).then((r) => {
          if (!r.ok) throw new Error(`Wikipédia ${r.status}`);
          return r.json();
        });
      // un refus passager (trop de demandes) : on réessaie une fois un peu plus tard
      const d = await enFile(() => appel().catch(() => new Promise((r) => setTimeout(r, 4000)).then(appel)));
      const pages = Object.values((d.query && d.query.pages) || {}).sort((a, b) => a.index - b.index);
      const proche = (t, x) => t === x || (t.length > 4 && x.length > 4 && (t.includes(x) || x.includes(t)));
      let best = null;
      pages.forEach((pg, i) => {
        if (!pg.thumbnail || /\.svg/i.test(pg.thumbnail.source) || /homonymie|film|liste/i.test(pg.title)) return;
        const tt = C.tokens(pg.title.replace(/\(.*?\)/g, ' ')).filter((t) => t.length > 2);
        const communs = toks.filter((t) => tt.some((x) => proche(t, x)));
        if (!communs.length) return;
        const sc = communs.length * 2 - i * 0.8; // mots du plat retrouvés, puis rang dans Wikipédia
        if (!best || sc > best.sc) best = { pg, sc };
      });
      if (!best) return null;
      return { src: best.pg.thumbnail.source.replace(/\?utm_.*$/, ''), page: `https://fr.wikipedia.org/wiki/${encodeURIComponent(best.pg.title.replace(/ /g, '_'))}`, titre: best.pg.title };
    })().catch(() => {
      photos.delete(cle); // échec réseau : on pourra réessayer plus tard
      return null;
    });
    photos.set(cle, p);
    return p;
  }
  C.photoPlat = photoPlat;

  // Donne une photo à une recette qui n'en a pas (et met à jour la vignette affichée)
  async function illustrer(r) {
    if (!r || r.photo) return r;
    const ph = await photoPlat(r.name);
    if (!ph || r.photo) return r;
    r.photo = ph.src;
    r.photoSource = ph.page;
    const saved = C.recipe(r.id);
    if (saved && !saved.photo) await C.save.recipe({ ...saved, photo: ph.src, photoSource: ph.page });
    document.querySelectorAll(`[data-rid="${CSS.escape(r.id)}"] .thumb`).forEach((el) => (el.innerHTML = C.recipeVisual(r, 'ph--sm')));
    return r;
  }
  // Recettes d'envies déjà enregistrées sans photo : une tentative par visite
  const tentees = new Set();
  let illuEnCours = false;
  async function illustrerEnvies() {
    if (illuEnCours) return;
    const sans = C.S.recipes.filter((r) => r.source === 'envie' && !r.photo && !tentees.has(r.id));
    if (!sans.length) return;
    illuEnCours = true;
    try {
      for (const r of sans.slice(0, 6)) {
        tentees.add(r.id);
        await illustrer({ ...r });
      }
    } finally {
      illuEnCours = false;
    }
  }

  /* ---------- Assistant « Préparer ma semaine » ----------
     Une seule fenêtre : vos envies (dites ou écrites), un style pour le reste de la semaine et les repas
     à prévoir ; puis une proposition repas par repas, avec d'autres choix pour chaque case.
     Rien n'est enregistré avant « Valider la semaine ». */
  const CONTRAIRE = { leger: 'plus copieux', rapide: 'plus long', vege: 'avec viande', poisson: 'sans poisson', eco: 'plus cher', copieux: 'plus léger' };
  const STYLES = [
    ['leger', 'Léger'],
    ['rapide', 'Rapide'],
    ['vege', 'Sans viande'],
    ['poisson', 'Poisson'],
    ['eco', 'Pas cher'],
    ['copieux', 'Copieux'],
  ];
  // Restes : ce qui se réchauffe bien le lendemain… et ce qui ne se ressert pas
  const BON_RESTE = /gratin|soupe|veloute|potage|curry|chili|lasagne|hachis|parmentier|mijot|ragout|risotto|dahl|dhal|tajine|bolognaise|papet|quiche|tarte|goulash|blanquette|boeuf|couscous|ratatouille/;
  const MAUVAIS_RESTE = /raclette|fondue|salade|burger|steak|frites|crepe|omelette|sushi|tartare|carpaccio|pizza|croute au fromage|tacos/;
  const seRechauffe = (r) => BON_RESTE.test(C.norm(`${r.name} ${r.category}`)) || ['Gratin & four', 'Soupe'].includes(r.category);
  const seRessertMal = (r) => MAUVAIS_RESTE.test(C.norm(r.name));
  // Frigo : aliments du frigo utilisés par une recette (ceux à consommer bientôt comptent double)
  const frigoDe = (r) => (C.S.fridge && C.S.fridge.length ? [...new Set(r.ingredients.map((i) => E.fridgeFor(i.name)).filter(Boolean))] : []);
  const bientot = (f) => {
    const j = E.expiresIn(f);
    return j != null && j <= 3;
  };
  const scoreFrigo = (r) => {
    const f = frigoDe(r);
    return Math.min(3, f.length) * 3 + f.filter(bientot).length * 2;
  };
  const MEMO = 'commis-semaine'; // derniers réglages choisis (style, recettes), sur cet appareil
  const memo = () => {
    try {
      return JSON.parse(localStorage.getItem(MEMO)) || {};
    } catch (e) {
      return {};
    }
  };
  const retenir = (st) => {
    try {
      localStorage.setItem(MEMO, JSON.stringify({ styles: [...st.styles], restes: st.restes, frigo: st.frigo }));
    } catch (e) {
      /* stockage indisponible */
    }
  };


  function proposer(st) {
    const wid = st.wid;
    const people = C.S.settings.household || 2;
    const prep = preparer(st.texte, wid);
    const premier = prep.premier;
    const plan = C.plan(wid);
    const base = {};
    const statut = {}; // 'garde' (déjà prévu), 'envie', 'choix' (choisi ici), 'vide'
    Object.entries(plan.slots).forEach(([k, v]) => {
      if (!C.recipe(v.recipeId)) return;
      if (Number(k[0]) < premier) base[k] = { ...v };
      else if (st.garder && !v.auto) {
        // les repas choisis à la main restent ; ceux proposés automatiquement sont refaits
        base[k] = { ...v };
        statut[k] = 'garde';
      }
    });
    const nouvelles = new Map();
    prep.lignes.forEach((l) => {
      if (!l.res) return;
      base[l.key] = { recipeId: l.res.r.id, servings: people, why: ['votre envie'], auto: false, wish: true };
      statut[l.key] = 'envie';
      if (l.res.nouvelle && !C.recipe(l.res.r.id)) nouvelles.set(l.res.r.id, l.res.r);
    });
    const skip = new Set();
    // « Relancer » garde ce que vous avez choisi ou vidé à la main
    if (st.prop)
      Object.entries(st.prop.statut).forEach(([k, s]) => {
        if (s === 'choix' && st.prop.slots[k]) {
          base[k] = { ...st.prop.slots[k] };
          statut[k] = 'choix';
          const r = st.prop.nouvelles.get(st.prop.slots[k].recipeId);
          if (r) nouvelles.set(r.id, r);
        } else if (s === 'vide') {
          delete base[k];
          statut[k] = 'vide';
          skip.add(k);
        }
      });
    const general = [...new Set([...prep.general, ...st.styles])];
    const promos = E.activePromos(wid);
    const cout = new Map();
    const prix = (r) => {
      if (!cout.has(r.id)) cout.set(r.id, E.recipeCost(r, people, promos).cost);
      return cout.get(r.id);
    };
    const frigo = st.frigo && C.S.fridge.length > 0;
    const fr = new Map();
    const bonus = (r, key) => {
      let b = 0;
      if (general.length) b += (convient(r, general) ? 6 : -8) - (general.includes('eco') ? prix(r) / 3 : 0);
      if (frigo) {
        if (!fr.has(r.id)) fr.set(r.id, scoreFrigo(r));
        b += fr.get(r.id);
      }
      // restes : le soir, un plat qui se réchauffe bien (il sera resservi le lendemain midi)
      if (st.restes && key && key.endsWith('soir')) b += seRechauffe(r) ? 3 : seRessertMal(r) ? -4 : 0;
      return b;
    };
    // Restes : les midis qui suivent un soir sont gardés pour les restes (sauf envie ou repas déjà choisi)
    const pourRestes = new Set();
    if (st.restes)
      for (let d = premier + 1; d < 7; d++) {
        const k = `${d}-midi`;
        if (!statut[k] && !skip.has(k)) pourRestes.add(k);
      }
    let res = E.generate(wid, { dry: true, base, skip: new Set([...skip, ...pourRestes]), bonus, extra: nouvelles, maxUses: 2 });
    let restes = 0;
    if (!res.error && pourRestes.size) {
      pourRestes.forEach((k) => {
        const soir = res.slots[`${Number(k[0]) - 1}-soir`];
        const r = soir && (C.recipe(soir.recipeId) || nouvelles.get(soir.recipeId));
        if (!r || seRessertMal(r)) return; // une raclette ne se ressert pas : ce midi-là sera proposé normalement
        res.slots[k] = { recipeId: r.id, servings: soir.servings, why: ['restes du soir d’avant'], auto: true, reste: true };
        statut[k] = 'reste';
        restes++;
      });
      // les midis restés libres (pas de soir la veille, ou plat qui ne se ressert pas) : proposition normale
      res = E.generate(wid, { dry: true, base: res.slots, skip, bonus, extra: nouvelles, maxUses: 2 });
    }
    if (res.error) {
      st.erreur = res.error;
      return false;
    }
    st.prop = { slots: res.slots, statut, nouvelles, general, ko: prep.lignes.filter((l) => !l.res), premier, skip, manque: res.manque || 0, restes, frigo };
    nouvelles.forEach((r) => !r.photo && !r.idee && illustrer(r)); // une vraie photo du plat, trouvée sur Wikipédia
    st.alts = {};
    st.ouvert = null;
    st.erreur = '';
    return true;
  }

  // D'autres idées pour une case : vos recettes compatibles, variées, selon le style choisi
  function suggestions(st, key) {
    const promos = E.activePromos(st.wid);
    const people = C.S.settings.household || 2;
    const slot = key.slice(2);
    const autre = st.prop.slots[`${key[0]}-${slot === 'midi' ? 'soir' : 'midi'}`];
    const autreR = autre && C.recipe(autre.recipeId);
    const cur = st.prop.slots[key];
    const prises = new Set(Object.entries(st.prop.slots).filter(([k]) => k !== key).map(([, v]) => v.recipeId));
    const gen = st.prop.general;
    const liste = E.compatible()
      .filter((r) => r.ingredients.length && E.pourRepas(r) && !prises.has(r.id) && (!cur || r.id !== cur.recipeId))
      .map((r) => {
        const c = E.recipeCost(r, people, promos);
        let sc = 2 * c.savings + c.promoIngs.length + (r.favorite ? 1 : 0) + (r.validated ? 1 : 0) + (slot === 'midi' && r.prepTime <= 30 ? 0.6 : 0) + Math.random() * 0.8;
        if (gen.length) sc += convient(r, gen) ? 6 : -8;
        if (gen.includes('eco')) sc -= c.cost / 3;
        if (autreR && autreR.category === r.category) sc -= 1;
        if (st.prop.frigo) sc += scoreFrigo(r);
        return { r, sc };
      })
      .sort((a, b) => b.sc - a.sc);
    const out = [];
    const cats = {};
    for (const x of liste) {
      if (out.length >= 8) break;
      if ((cats[x.r.category] || 0) >= 2) continue; // de la variété
      cats[x.r.category] = (cats[x.r.category] || 0) + 1;
      out.push(x.r);
    }
    const ok = gen.length ? out.filter((r) => convient(r, gen)) : out;
    const ko = gen.length ? out.filter((r) => !convient(r, gen)) : [];
    return [...ok, ...ko].slice(0, 6).map((r) => r.id);
  }

  function assistant() {
    const wid = C.ui.week;
    const premier = wid === C.weekId() ? (new Date().getDay() + 6) % 7 : 0;
    const plan = C.plan(wid);
    const prevus = Object.keys(plan.slots).filter((k) => Number(k[0]) >= premier && C.recipe(plan.slots[k].recipeId) && !plan.slots[k].auto).length;
    const m = memo();
    const st = {
      wid,
      premier,
      prevus,
      texte: '',
      styles: new Set((m.styles || []).filter((x) => STYLES.some(([id]) => id === x))),
      restes: !!m.restes,
      frigo: m.frigo !== false, // par défaut, le frigo d'abord (sans effet s'il est vide)
      garder: true, // les repas choisis à la main restent ; ceux proposés automatiquement sont refaits
      etape: 'envies',
      prop: null,
      alts: {},
      ouvert: null,
      erreur: '',
    };
    const people = C.S.settings.household || 2;
    const rec = (id) => C.recipe(id) || (st.prop && st.prop.nouvelles.get(id));

    const vueEnvies = () => {
      const chip = (on, label, attrs) => `<button class="chip ${on ? 'is-on' : ''}" type="button" aria-pressed="${on}" ${attrs}>${label}</button>`;
      return `<p class="pw-intro">Écrivez ce dont vous avez envie, ou laissez Commis choisir. Vous pourrez changer chaque repas avant de valider.</p>
        <section class="pw-sec">
          <h3 class="pw-h">Des envies précises ? <span>facultatif</span></h3>
          <div class="env-in">
            <textarea class="inp" id="env-text" rows="3" placeholder="Ex. Mardi soir une raclette, jeudi midi des pâtes bolognaise, et un repas léger ce midi-là.">${esc(st.texte)}</textarea>
          </div>
        </section>
        <section class="pw-sec">
          <h3 class="pw-h">Pour le reste de la semaine</h3>
          <div class="chips">${STYLES.map(([id, label]) => chip(st.styles.has(id), label, `data-act="pw.style" data-v="${id}"`)).join('')}</div>
          <p class="small muted" style="margin-top:8px">Rien de coché : Commis mélange, en privilégiant les promotions et vos favoris.</p>
        </section>
        <section class="pw-sec">
          <h3 class="pw-h">Restes</h3>
          <div class="chips">${chip(st.restes, 'Cuisiner pour deux repas', 'data-act="pw.restes"')}</div>
          <p class="small muted" style="margin-top:8px">Le repas du soir est cuisiné en double et resservi le lendemain midi. Commis choisit alors le soir des plats qui se réchauffent bien.</p>
        </section>
        <section class="pw-sec">
          <h3 class="pw-h">Frigo</h3>
          ${(() => {
            const n = (C.S.fridge || []).length;
            const vite = (C.S.fridge || []).filter(bientot).length;
            if (!n) return `<div class="chips"><span class="chip is-past" aria-disabled="true">Utiliser d’abord ce qu’il y a au frigo</span></div><p class="small muted" style="margin-top:8px">Votre frigo est vide : notez ce qu’il vous reste dans l’onglet Frigo pour que Commis s’en serve.</p>`;
            return `<div class="chips">${chip(st.frigo, `Utiliser d’abord ce qu’il y a au frigo <span class="pw-nb">${n}</span>`, 'data-act="pw.frigo"')}</div><p class="small muted" style="margin-top:8px">Les recettes qui reprennent vos aliments passent devant${vite ? `, en commençant par ${vite > 1 ? `les ${vite} à consommer bientôt` : 'celui à consommer bientôt'}` : ''}.</p>`;
          })()}
        </section>
        ${st.erreur ? `<p class="vid-err" role="alert">${esc(st.erreur)}</p>` : ''}`;
    };

    const ligne = (key) => {
      const p = st.prop;
      const s = p.slots[key];
      const r = s && rec(s.recipeId);
      const slot = C.SLOT_LABEL[key.slice(2)];
      const ouvert = st.ouvert === key;
      const tag = (s && s.reste && s.why && s.why[0]) || { envie: 'votre envie', garde: 'déjà prévu', choix: 'votre choix', reste: 'restes du soir d’avant' }[p.statut[key]] || (r && p.general.length && convient(r, p.general) ? p.general.map((g) => NOM_SOUHAIT[g]).join(', ') : '');
      let html;
      if (!r)
        html = `<div class="pw-row is-libre"><span class="thumb pw-vide">${icon('plus', 18)}</span><span class="row-b"><span class="pw-k">${slot}</span><span class="row-t muted">Libre</span></span><button class="btn btn--ghost btn--sm" data-act="pw.ouvrir" data-key="${key}" aria-expanded="${ouvert}">Choisir</button></div>`;
      else {
        const c = E.recipeCost(r, s.servings, E.activePromos(st.wid));
        html = `<div class="pw-row ${ouvert ? 'is-open' : ''}" data-rid="${esc(r.id)}"><span class="thumb">${C.recipeVisual(r, 'ph--sm')}</span>
          <span class="row-b"><span class="pw-k">${slot}${tag ? ` · <em>${esc(tag)}</em>` : ''}</span><span class="row-t">${esc(r.name)}</span><span class="row-s">${C.chf(c.cost)} · ${r.prepTime} min${c.promoIngs.length ? ` · ${c.promoIngs.length} promo${c.promoIngs.length > 1 ? 's' : ''}` : ''}${p.frigo && p.statut[key] !== 'reste' && frigoDe(r).length ? ` · frigo : ${esc(frigoDe(r).slice(0, 2).map((f) => f.name.split(/\s+/)[0].toLowerCase()).join(', '))}` : ''}</span></span>
          <button class="btn btn--ghost btn--sm" data-act="pw.ouvrir" data-key="${key}" aria-expanded="${ouvert}">${ouvert ? 'Fermer' : 'Changer'}</button></div>`;
      }
      if (ouvert) {
        if (!st.alts[key]) st.alts[key] = suggestions(st, key);
        const promos = E.activePromos(st.wid);
        html += `<div class="pw-alts" role="group" aria-label="Autres choix"><div class="pw-alt-l">${st.alts[key]
          .map((id) => {
            const a = rec(id);
            if (!a) return '';
            const c = E.recipeCost(a, people, promos);
            const gen = st.prop.general;
            const hors = gen.length && !convient(a, gen);
            const marque = [hors ? gen.filter((g) => !VERIFS[g](a)).map((g) => CONTRAIRE[g]).join(', ') : gen.length ? gen.map((g) => NOM_SOUHAIT[g]).join(', ') : c.promoIngs.length ? `${c.promoIngs.length} promo${c.promoIngs.length > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
            return `<button class="pw-alt" type="button" data-act="pw.prendre" data-key="${key}" data-id="${a.id}"><span class="pw-alt-v">${C.recipeVisual(a, 'ph--sm')}</span><span class="pw-alt-t">${esc(a.name)}</span><span class="pw-alt-s">${C.chf(c.cost)} · ${a.prepTime} min${marque ? ` · ${esc(marque)}` : ''}</span></button>`;
          })
          .join('') || '<p class="small muted">Pas d’autre recette compatible : cherchez dans toutes vos recettes.</p>'}</div>
          <span class="pw-alt-a"><button class="btn btn--ghost btn--sm" type="button" data-act="pw.autre" data-key="${key}">${icon('search', 16)} Toutes mes recettes</button>${r ? `<button class="btn btn--ghost btn--sm" type="button" data-act="pw.vider" data-key="${key}">Laisser vide</button>` : ''}</span></div>`;
      }
      return html;
    };

    const vueChoix = () => {
      const p = st.prop;
      const promos = E.activePromos(st.wid);
      let cout = 0;
      let eco = 0;
      let n = 0;
      Object.entries(p.slots).forEach(([k, s]) => {
        if (Number(k[0]) < p.premier) return;
        const r = rec(s.recipeId);
        if (!r) return;
        const c = E.recipeCost(r, s.servings, promos);
        cout += c.cost;
        eco += c.savings;
        n++;
      });
      const jours = [];
      for (let d = p.premier; d < 7; d++) {
        // repas proposés, cases vidées à la main (pour pouvoir y remettre quelque chose), cases voulues restées libres
        const visibles = C.SLOTS.map((sl) => `${d}-${sl}`).filter((k) => p.slots[k] || p.statut[k] === 'vide' || !p.skip.has(k));
        if (!visibles.length) continue;
        jours.push(`<div class="pw-day"><h4 class="pw-dh">${C.DAYS[d]} <span>${C.parse(C.dayIso(st.wid, d)).getDate()}</span></h4>${visibles.map(ligne).join('')}</div>`);
      }
      return `<div class="pw-sum"><span><b>${n}</b> repas</span><span><b>${C.chf(cout)}</b> estimés</span>${eco >= 0.05 ? `<span>${C.chf(eco)} économisés</span>` : ''}${p.general.length ? `<span>plutôt ${esc(p.general.map((g) => NOM_SOUHAIT[g]).join(', '))}</span>` : ''}${p.restes ? `<span>${p.restes} midi${p.restes > 1 ? 's' : ''} avec les restes</span>` : ''}</div>
        ${p.manque ? `<div class="note note--soft" style="margin-bottom:12px">${icon('info', 18)}<span>Pas assez de recettes différentes pour toute la semaine : ${p.manque} repas reste${p.manque > 1 ? 'nt' : ''} libre${p.manque > 1 ? 's' : ''}. Touchez « Choisir » pour en mettre un, ou ajoutez une recette.</span></div>` : ''}
        ${p.ko.length ? `<div class="note note--soft" style="margin-bottom:12px">${icon('info', 18)}<span>Pas pu placer : ${esc(p.ko.map((l) => `${LABEL_J[l.d] || ''}${l.slot ? ` ${l.slot}` : ''} (${l.ko})`).join(', '))}.</span></div>` : ''}
        ${jours.join('') || '<p class="muted">Aucun repas à prévoir avec ces réglages.</p>'}
        <p class="small muted" style="margin-top:14px">Touchez « Changer » pour voir d’autres idées. Rien n’est enregistré avant de valider.</p>`;
    };

    const body = () => (st.etape === 'choix' ? vueChoix() : vueEnvies());
    const foot = () =>
      st.etape === 'choix'
        ? `<div class="pw-f"><button class="btn btn--ghost" data-act="pw.retour" aria-label="Revenir aux envies">${icon('left', 16)}<span class="pw-lbl"> Envies</span></button><button class="btn btn--ghost" data-act="pw.relancer" aria-label="Relancer la proposition">${icon('wand', 16)}<span class="pw-lbl"> Relancer</span></button><button class="btn btn--citron pw-ok" data-act="pw.valider">Valider la semaine</button></div>`
        : `<button class="btn btn--ghost" data-close>Annuler</button><button class="btn btn--citron" data-act="pw.proposer">${icon('wand', 18)} Proposer ma semaine</button>`;
    const sheet = C.sheet({
      title: 'Préparer ma semaine',
      sub: `Semaine ${C.weekNo(wid)} · ${C.weekLabel(wid)}`,
      body,
      foot,
      size: 'wide',
    });
    st.refresh = () => {
      lireTexte();
      sheet.refresh();
    };
    st.sheet = sheet;
    C.ui.env = st;
  }

  const lireTexte = () => {
    const ta = document.getElementById('env-text');
    if (ta && C.ui.env) C.ui.env.texte = ta.value;
  };
  const toggleDom = (el, on) => {
    el.classList.toggle('is-on', on);
    el.setAttribute('aria-pressed', on);
  };

  Object.assign(C.acts, {
    'env.open': () => assistant(),
    'pw.style': (el) => {
      const st = C.ui.env;
      const v = el.dataset.v;
      if (st.styles.has(v)) st.styles.delete(v);
      else st.styles.add(v);
      toggleDom(el, st.styles.has(v));
    },
    'pw.restes': (el) => {
      const st = C.ui.env;
      st.restes = !st.restes;
      toggleDom(el, st.restes);
    },
    'pw.frigo': (el) => {
      const st = C.ui.env;
      st.frigo = !st.frigo;
      toggleDom(el, st.frigo);
    },
    'pw.proposer': () => {
      const st = C.ui.env;
      lireTexte();
      retenir(st);
      st.prop = null;
      if (proposer(st)) st.etape = 'choix';
      st.refresh();
      st.sheet.body.scrollTop = 0;
    },
    'pw.retour': () => {
      const st = C.ui.env;
      st.etape = 'envies';
      st.prop = null;
      st.refresh();
    },
    'pw.relancer': () => {
      const st = C.ui.env;
      proposer(st);
      st.refresh();
      C.toast('Nouvelle proposition — vos envies et vos choix sont gardés');
    },
    'pw.ouvrir': (el) => {
      const st = C.ui.env;
      const key = el.dataset.key;
      st.ouvert = st.ouvert === key ? null : key;
      st.refresh();
      const alts = st.sheet.body.querySelector('.pw-alts');
      if (alts) alts.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    },
    'pw.prendre': (el) => {
      const st = C.ui.env;
      const key = el.dataset.key;
      st.prop.slots[key] = { recipeId: el.dataset.id, servings: C.S.settings.household || 2, why: ['votre choix'], auto: false };
      st.prop.statut[key] = 'choix';
      st.ouvert = null;
      st.alts = {};
      st.refresh();
    },
    'pw.autre': (el) => {
      const st = C.ui.env;
      const key = el.dataset.key;
      C.pickRecipe(
        'Choisir un repas',
        `${C.DAYS[Number(key[0])]} ${key.slice(2)}`,
        (id, o) => {
          st.prop.slots[key] = o && o.reste ? { recipeId: id, servings: o.servings, why: [`restes de ${o.label}`], auto: false, reste: true } : { recipeId: id, servings: C.S.settings.household || 2, why: ['votre choix'], auto: false };
          st.prop.statut[key] = 'choix'; // gardé si on relance
          st.ouvert = null;
          st.alts = {};
          st.refresh();
        },
        { reste: C.restePour(st.prop.slots, key) }
      );
    },
    'pw.vider': (el) => {
      const st = C.ui.env;
      const key = el.dataset.key;
      delete st.prop.slots[key];
      st.prop.statut[key] = 'vide';
      st.ouvert = null;
      st.alts = {};
      st.refresh();
    },
    'pw.valider': () => {
      const st = C.ui.env;
      const p = st.prop;
      const utilisees = new Set(Object.values(p.slots).map((s) => s.recipeId));
      let nouv = 0;
      p.nouvelles.forEach((r, id) => {
        if (utilisees.has(id) && !C.recipe(id)) {
          C.save.recipe(r);
          nouv++;
        }
      });
      let n = 0;
      C.save.plan(st.wid, (slots) => {
        Object.keys(slots).forEach((k) => {
          if (Number(k[0]) >= p.premier) delete slots[k];
        });
        Object.entries(p.slots).forEach(([k, v]) => {
          if (Number(k[0]) < p.premier) return;
          slots[k] = v;
          n++;
        });
      });
      C.closeSheet();
      C.toast(`Semaine prête : ${n} repas${nouv ? ` · ${nouv} nouvelle${nouv > 1 ? 's' : ''} recette${nouv > 1 ? 's' : ''} ajoutée${nouv > 1 ? 's' : ''}` : ''}`);
    },
  });
  C.acts['plan.generate'] = () => assistant(); // ancien bouton (accueil, bienvenue)

  // Un classique reconnu dans un texte (titre de vidéo…) : sa recette de base, ou null
  const classique = (texte) => {
    const cl = CLASSIQUES.find((d) => d.cle.test(normaliser(texte)));
    return cl ? { name: cl.name, category: cl.category, prepTime: cl.prepTime, ingredients: cl.ingredients.map((x) => ({ ...x })), steps: cl.steps.slice() } : null;
  };
  // Recette à partir d'un nom tapé (« raclette ») : la vôtre si elle existe, sinon une recette de base ou à compléter
  async function depuisNom(nom) {
    const res = recettePour(nom);
    if (res.nouvelle && !C.recipe(res.r.id)) {
      await C.save.recipe({ ...res.r, toTest: true });
      illustrer({ ...res.r }); // la photo du plat arrive dans la foulée
    }
    return C.recipe(res.r.id) || res.r;
  }
  C.envies = { comprendre, preparer, classique, proposer, illustrerEnvies, photoPlat, depuisNom }; // aussi pour vérifier depuis la console
})();
