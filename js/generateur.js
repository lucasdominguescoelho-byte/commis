/* Commis — générateur de recettes local (gratuit, hors ligne, sans IA).

   Principe : une base d'ingrédients courants (portion par personne, prix habituel,
   façon de les cuire) et une douzaine de modèles de plats (poêlée, gratin, risotto,
   curry, soupe, salade, plaque au four, papillote, quiche, omelette, wok, pâtes).
   Pour chaque idée, Commis essaie de nombreuses combinaisons et garde celles qui
   utilisent le plus de produits en promotion (gros rabais d'abord) et d'aliments
   du frigo cochés, en respectant régime, allergies et aliments évités.
   Les recettes sont donc composées par règles : fiables et simples, mais moins
   inventives qu'un chef. */
(function () {
  'use strict';
  const C = window.C;
  const E = C.eng;

  /* ---------- Base d'ingrédients ----------
     n : nom (comme sur une liste de courses) · c : rayon · q/u : portion par personne · p : prix habituel de la portion (CHF)
     de / au / court : formes pour composer le nom du plat · k : cuisson · t : plats où l'ingrédient a sa place · g : genre de protéine */
  const P = [
    { n: 'Émincé de poulet', c: 'vp', q: 125, u: 'g', p: 2.5, de: 'de poulet', au: 'au poulet', court: 'poulet', g: 'viande', k: 'à feu vif 5 à 6 minutes, jusqu’à ce qu’il soit doré', t: ['poele', 'curry', 'wok', 'pates', 'salade'] },
    { n: 'Poitrine de poulet', c: 'vp', q: 140, u: 'g', p: 3.2, de: 'de poulet', au: 'au poulet', court: 'poulet', plat: 'Poulet', g: 'viande', k: '6 minutes de chaque côté', t: ['airfryer', 'four', 'papillote', 'salade', 'poele'] },
    { n: 'Cuisses de poulet', c: 'vp', q: 220, u: 'g', p: 2.4, de: 'de poulet', au: 'au poulet', court: 'poulet', plat: 'Cuisses de poulet', g: 'viande', k: '', t: ['airfryer', 'mijote', 'four'] },
    { n: 'Viande hachée de bœuf', c: 'vp', q: 110, u: 'g', p: 2.0, de: 'de bœuf haché', au: 'à la viande hachée', court: 'viande hachée', g: 'viande', k: 'en l’émiettant, 5 minutes', t: ['pates', 'poele', 'gratin'] },
    { n: 'Émincé de bœuf', c: 'vp', q: 120, u: 'g', p: 4.0, de: 'de bœuf', au: 'au bœuf', court: 'bœuf', g: 'viande', k: 'à feu très vif 2 à 3 minutes', t: ['wok', 'poele'] },
    { n: 'Ragoût de bœuf', c: 'vp', q: 150, u: 'g', p: 3.6, de: 'de bœuf', au: 'au bœuf', court: 'bœuf', g: 'viande', k: '', t: ['mijote'] },
    { n: 'Émincé de porc', c: 'vp', q: 120, u: 'g', p: 2.4, de: 'de porc', au: 'au porc', court: 'porc', g: 'viande', k: 'à feu vif 4 à 5 minutes', t: ['mijote', 'poele', 'wok', 'curry'] },
    { n: 'Saucisses à rôtir', c: 'vp', q: 1, u: 'pièce', p: 1.9, de: 'de saucisses', au: 'aux saucisses', court: 'saucisses', plat: 'Saucisses', g: 'viande', k: 'à feu moyen 12 minutes en les retournant', t: ['airfryer', 'four', 'poele'] },
    { n: 'Lardons', c: 'vp', q: 50, u: 'g', p: 1.0, de: 'de lardons', au: 'aux lardons', court: 'lardons', g: 'viande', k: 'à sec jusqu’à ce qu’ils soient dorés', t: ['pates', 'gratin', 'quiche', 'salade', 'omelette'] },
    { n: 'Jambon', c: 'vp', q: 60, u: 'g', p: 1.3, de: 'de jambon', au: 'au jambon', court: 'jambon', g: 'viande', k: '', t: ['pates', 'gratin', 'quiche', 'salade', 'omelette'] },
    { n: 'Filet de saumon', c: 'vp', q: 125, u: 'g', p: 3.5, de: 'de saumon', au: 'au saumon', court: 'saumon', plat: 'Saumon', g: 'poisson', k: '4 minutes de chaque côté', t: ['airfryer', 'four', 'papillote', 'pates'] },
    { n: 'Saumon fumé', c: 'vp', q: 50, u: 'g', p: 2.5, de: 'de saumon fumé', au: 'au saumon fumé', court: 'saumon fumé', g: 'poisson', k: '', t: ['pates', 'salade', 'quiche'] },
    { n: 'Filet de cabillaud', c: 'vp', q: 140, u: 'g', p: 3.8, de: 'de cabillaud', au: 'au cabillaud', court: 'cabillaud', plat: 'Cabillaud', g: 'poisson', k: '4 minutes de chaque côté', t: ['four', 'papillote'] },
    { n: 'Filets de pangasius', c: 'vp', q: 140, u: 'g', p: 1.4, de: 'de poisson', au: 'au poisson', court: 'poisson', plat: 'Poisson blanc', g: 'poisson', k: '3 minutes de chaque côté', t: ['airfryer', 'four', 'papillote', 'curry'] },
    { n: 'Crevettes', c: 'vp', q: 100, u: 'g', p: 3.0, de: 'de crevettes', au: 'aux crevettes', court: 'crevettes', g: 'poisson', k: '2 à 3 minutes, jusqu’à ce qu’elles soient roses', t: ['wok', 'curry', 'pates'] },
    { n: 'Thon en boîte', c: 'vp', q: 60, u: 'g', p: 1.2, de: 'de thon', au: 'au thon', court: 'thon', g: 'poisson', k: '', t: ['pates', 'salade'] },
    { n: 'Œufs', c: 'lait', q: 2, u: 'pièce', p: 0.9, de: 'd’œufs', au: 'aux œufs', court: 'œufs', g: 'vege', k: '', t: ['omelette', 'salade'] },
    { n: 'Tofu nature', c: 'epi', q: 100, u: 'g', p: 1.4, de: 'de tofu', au: 'au tofu', court: 'tofu', g: 'vege', k: 'en dés, jusqu’à ce qu’il soit doré', t: ['airfryer', 'wok', 'curry', 'poele'] },
    { n: 'Pois chiches en boîte', c: 'epi', q: 120, u: 'g', p: 0.55, de: 'de pois chiches', au: 'aux pois chiches', court: 'pois chiches', g: 'vege', k: 'égouttés, 5 minutes', t: ['mijote', 'curry', 'salade'] },
    { n: 'Lentilles vertes', c: 'epi', q: 70, u: 'g', p: 0.4, de: 'de lentilles', au: 'aux lentilles', court: 'lentilles', g: 'vege', k: '', t: ['salade', 'curry'] },
    { n: 'Feta', c: 'lait', q: 50, u: 'g', p: 0.8, de: 'de feta', au: 'à la feta', court: 'feta', g: 'vege', k: '', t: ['salade', 'four', 'pates', 'omelette'] },
    { n: 'Mozzarella', c: 'lait', q: 60, u: 'g', p: 1.0, de: 'de mozzarella', au: 'à la mozzarella', court: 'mozzarella', g: 'vege', k: '', t: ['salade', 'gratin', 'pates'] },
  ];
  const L = [
    { n: 'Courgettes', c: 'fl', q: 150, u: 'g', p: 0.6, aux: 'aux courgettes', court: 'courgettes', prep: 'en rondelles', t: ['airfryer', 'poele', 'wok', 'curry', 'gratin', 'four', 'pates', 'quiche', 'omelette', 'papillote', 'risotto'] },
    { n: 'Poivrons', c: 'fl', q: 120, u: 'g', p: 0.6, aux: 'aux poivrons', court: 'poivrons', prep: 'en lanières', t: ['airfryer', 'poele', 'wok', 'curry', 'four', 'salade', 'pates', 'omelette'] },
    { n: 'Brocoli', c: 'fl', q: 150, u: 'g', p: 0.7, aux: 'au brocoli', court: 'brocoli', prep: 'en petits bouquets', t: ['airfryer', 'poele', 'wok', 'curry', 'gratin', 'four', 'pates', 'quiche', 'soupe'] },
    { n: 'Carottes', c: 'fl', q: 120, u: 'g', p: 0.25, aux: 'aux carottes', court: 'carottes', prep: 'en rondelles', t: ['airfryer', 'mijote', 'poele', 'wok', 'curry', 'soupe', 'four', 'salade', 'papillote'] },
    { n: 'Champignons de Paris', c: 'fl', q: 100, u: 'g', p: 1.1, aux: 'aux champignons', court: 'champignons', prep: 'émincés', t: ['mijote', 'poele', 'wok', 'pates', 'risotto', 'quiche', 'gratin', 'omelette'] },
    { n: 'Épinards frais', c: 'fl', q: 80, u: 'g', p: 0.9, aux: 'aux épinards', court: 'épinards', prep: 'grossièrement hachés', t: ['curry', 'pates', 'quiche', 'gratin', 'risotto', 'omelette'] },
    { n: 'Courge', c: 'fl', q: 200, u: 'g', p: 0.65, aux: 'à la courge', court: 'courge', prep: 'en cubes', t: ['mijote', 'soupe', 'four', 'risotto', 'curry', 'gratin', 'salade'] },
    { n: 'Poireaux', c: 'fl', q: 120, u: 'g', p: 0.55, aux: 'aux poireaux', court: 'poireaux', prep: 'émincés', t: ['mijote', 'soupe', 'quiche', 'gratin', 'risotto', 'pates', 'papillote'] },
    { n: 'Tomates', c: 'fl', q: 150, u: 'g', p: 0.6, aux: 'aux tomates', court: 'tomates', prep: 'en dés', t: ['salade', 'pates', 'four', 'omelette'] },
    { n: 'Tomates cerises', c: 'fl', q: 100, u: 'g', p: 0.7, aux: 'aux tomates cerises', court: 'tomates cerises', prep: 'coupées en deux', t: ['salade', 'pates', 'four', 'papillote'] },
    { n: 'Aubergines', c: 'fl', q: 150, u: 'g', p: 0.75, aux: 'aux aubergines', court: 'aubergines', prep: 'en dés', t: ['four', 'curry', 'poele', 'pates'] },
    { n: 'Chou-fleur', c: 'fl', q: 150, u: 'g', p: 0.6, aux: 'au chou-fleur', court: 'chou-fleur', prep: 'en petits bouquets', t: ['airfryer', 'curry', 'gratin', 'four', 'soupe'] },
    { n: 'Haricots verts', c: 'fl', q: 120, u: 'g', p: 0.9, aux: 'aux haricots verts', court: 'haricots verts', prep: 'équeutés', t: ['airfryer', 'mijote', 'poele', 'salade', 'four', 'papillote'] },
    { n: 'Patates douces', c: 'fl', q: 150, u: 'g', p: 0.6, aux: 'aux patates douces', court: 'patates douces', prep: 'en cubes', t: ['mijote', 'four', 'curry', 'soupe'] },
    { n: 'Chou blanc', c: 'fl', q: 120, u: 'g', p: 0.3, aux: 'au chou', court: 'chou', prep: 'émincé finement', t: ['wok', 'poele'] },
    { n: 'Asperges vertes', c: 'fl', q: 100, u: 'g', p: 1.5, aux: 'aux asperges', court: 'asperges', prep: 'en tronçons', t: ['risotto', 'pates', 'quiche', 'papillote'] },
    { n: 'Petits pois surgelés', c: 'surg', q: 80, u: 'g', p: 0.35, aux: 'aux petits pois', court: 'petits pois', prep: '', t: ['risotto', 'pates', 'curry', 'omelette'] },
    { n: 'Concombre', c: 'fl', q: 100, u: 'g', p: 0.4, aux: 'au concombre', court: 'concombre', prep: 'en dés', t: ['salade'] },
    { n: 'Betteraves cuites', c: 'fl', q: 100, u: 'g', p: 0.5, aux: 'aux betteraves', court: 'betteraves', prep: 'en dés', t: ['salade'] },
    { n: 'Fenouil', c: 'fl', q: 120, u: 'g', p: 0.6, aux: 'au fenouil', court: 'fenouil', prep: 'émincé', t: ['airfryer', 'four', 'papillote', 'salade'] },
    { n: 'Maïs en boîte', c: 'epi', q: 60, u: 'g', p: 0.3, aux: 'au maïs', court: 'maïs', prep: 'égoutté', t: ['salade'] },
  ];
  const F = [
    { n: 'Riz long grain', c: 'epi', q: 75, u: 'g', p: 0.3, court: 'riz', k: 'Cuire le riz selon les indications du paquet.', t: ['poele', 'curry', 'papillote'] },
    { n: 'Riz pour risotto', c: 'epi', q: 80, u: 'g', p: 0.55, court: 'riz', k: '', t: ['risotto'] },
    { n: 'Spaghetti', c: 'epi', q: 100, u: 'g', p: 0.3, court: 'spaghetti', k: 'Cuire les spaghetti al dente.', t: ['pates'] },
    { n: 'Penne', c: 'epi', q: 100, u: 'g', p: 0.3, court: 'penne', k: 'Cuire les penne al dente.', t: ['pates', 'gratin', 'salade'] },
    { n: 'Cornettes', c: 'epi', q: 100, u: 'g', p: 0.35, court: 'cornettes', k: 'Cuire les cornettes 2 minutes de moins que le temps indiqué.', t: ['gratin'] },
    { n: 'Tagliatelles', c: 'epi', q: 100, u: 'g', p: 0.45, court: 'tagliatelles', k: 'Cuire les tagliatelles al dente.', t: ['pates'] },
    { n: 'Nouilles de blé', c: 'epi', q: 80, u: 'g', p: 0.6, court: 'nouilles', k: 'Cuire les nouilles, égoutter.', t: ['wok'] },
    { n: 'Pommes de terre', c: 'fl', q: 250, u: 'g', p: 0.6, court: 'pommes de terre', k: '', t: ['airfryer', 'mijote', 'four', 'gratin', 'soupe', 'salade', 'poele'] },
    { n: 'Gnocchi', c: 'epi', q: 150, u: 'g', p: 0.8, court: 'gnocchi', k: 'Cuire les gnocchi dans l’eau bouillante jusqu’à ce qu’ils remontent.', t: ['gratin', 'poele'] },
    { n: 'Lentilles vertes', c: 'epi', q: 70, u: 'g', p: 0.4, court: 'lentilles', k: 'Cuire les lentilles 20 minutes dans l’eau non salée, égoutter.', t: ['salade'] },
    { n: 'Pain', c: 'boul', q: 1, u: 'tranche', p: 0.25, court: 'pain', k: '', t: ['soupe', 'omelette'] },
  ];
  const X = {
    oignon: { n: 'Oignon', c: 'fl', q: 0.5, u: 'pièce', p: 0.2 },
    ail: { n: 'Ail', c: 'fl', q: 0.5, u: 'gousse', p: 0.08 },
    huile: { n: 'Huile de colza', c: 'epi', q: 0.5, u: 'c. à soupe', p: 0.05 },
    olive: { n: 'Huile d’olive', c: 'epi', q: 0.5, u: 'c. à soupe', p: 0.08 },
    creme: { n: 'Crème entière', c: 'lait', q: 0.5, u: 'dl', p: 0.5 },
    gruyere: { n: 'Gruyère râpé', c: 'lait', q: 30, u: 'g', p: 0.65 },
    parmesan: { n: 'Parmesan', c: 'lait', q: 15, u: 'g', p: 0.55 },
    coco: { n: 'Lait de coco', c: 'epi', q: 1, u: 'dl', p: 0.65 },
    curry: { n: 'Curry en poudre', c: 'epi', q: 0.5, u: 'c. à café', p: 0.05 },
    pelees: { n: 'Tomates pelées', c: 'epi', q: 100, u: 'g', p: 0.3 },
    bouillon: { n: 'Bouillon de légumes', c: 'epi', q: 2.5, u: 'dl', p: 0.15 },
    soja: { n: 'Sauce soja', c: 'epi', q: 1, u: 'c. à soupe', p: 0.15 },
    vin: { n: 'Vin blanc', c: 'bois', q: 0.25, u: 'dl', p: 0.2 },
    citron: { n: 'Citron', c: 'fl', q: 0.25, u: 'pièce', p: 0.18 },
    beurre: { n: 'Beurre', c: 'lait', q: 10, u: 'g', p: 0.15 },
    vinaigrette: { n: 'Vinaigrette', c: 'epi', q: 1, u: 'c. à soupe', p: 0.12 },
    brisee: { n: 'Pâte brisée', c: 'epi', q: 0.25, u: 'pièce', p: 0.55 },
    oeufs: { n: 'Œufs', c: 'lait', q: 0.75, u: 'pièce', p: 0.35 },
    herbes: { n: 'Herbes de Provence', c: 'epi', q: 0.25, u: 'c. à café', p: 0.03 },
  };
  const ART = {"poulet": "le poulet", "viande hachée": "la viande hachée", "bœuf": "le bœuf", "porc": "le porc", "saucisses": "les saucisses", "lardons": "les lardons", "jambon": "le jambon", "saumon": "le saumon", "saumon fumé": "le saumon fumé", "cabillaud": "le cabillaud", "poisson": "le poisson", "crevettes": "les crevettes", "thon": "le thon", "œufs": "les œufs", "tofu": "le tofu", "pois chiches": "les pois chiches", "lentilles": "les lentilles", "feta": "la feta", "mozzarella": "la mozzarella"};
  P.forEach((x) => {
    x.r = 'P';
    x.art = ART[x.court] || 'le ' + x.court;
  });
  const LART = {"brocoli": "le brocoli", "courge": "la courge", "chou-fleur": "le chou-fleur", "chou": "le chou", "concombre": "le concombre", "fenouil": "le fenouil", "maïs": "le maïs"};
  L.forEach((x) => {
    x.r = 'L';
    x.art = LART[x.court] || 'les ' + x.court;
  });
  F.forEach((x) => (x.r = 'F'));

  /* ---------- Modèles de plats ---------- */
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const et = (arr) => (arr.length < 2 ? arr.join('') : arr.slice(0, -1).join(', ') + ' et ' + arr[arr.length - 1]);
  const legs = (ls) => et(ls.map((l) => l.court));
  const auxLegs = (ls) => (ls.length === 1 ? ls[0].aux : ls[0].aux + ' et ' + ls.slice(1).map((l) => l.court).join(', '));
  const prep = (ls) => et(ls.map((l) => (l.prep ? `${l.art} ${l.prep}` : l.art)));
  const catOf = (p) => (!p ? 'Végétarien' : p.g === 'poisson' ? 'Poisson' : p.g === 'vege' ? 'Végétarien' : 'Viande');

  const T = [
    {
      id: 'poele', time: 30, mots: ['poelee', 'rapide', 'poele'], P: 1, L: 2, F: 1, X: ['oignon', 'ail', 'huile'],
      cat: (r) => catOf(r.P),
      name: (r) => `Poêlée ${r.P.de} ${auxLegs(r.L)}, ${r.F.court}`,
      steps: (r) => [
        r.F.k || `Cuire les ${r.F.court} à l’eau salée 15 minutes, puis les faire dorer à la poêle.`,
        `Émincer l’oignon et l’ail, couper ${prep(r.L)}.`,
        `Saisir ${r.P.art} dans l’huile${r.P.k ? ' ' + r.P.k : ''}, réserver.`,
        `Dans la même poêle, faire revenir l’oignon, l’ail et les légumes 8 à 10 minutes.`,
        `Remettre ${r.P.art}, saler, poivrer et servir avec ${r.F.court === 'riz' ? 'le riz' : 'les ' + r.F.court}.`,
      ],
    },
    {
      id: 'pates', time: 25, mots: ['pates', 'rapide', 'italien'], P: [0, 1], L: 1, F: 1, X: ['oignon', 'olive'], sauce: true,
      cat: () => 'Pâtes & riz',
      name: (r) => `${r.F.n} ${r.sauce === 'creme' ? 'à la crème' : 'à la tomate'}${r.P ? `, ${r.P.court}` : ''} et ${r.L[0].court}`,
      extra: (r) => (r.sauce === 'creme' ? ['creme', 'parmesan'] : ['pelees', 'ail', 'parmesan']),
      steps: (r) => [
        r.F.k,
        `Émincer l’oignon${r.sauce === 'creme' ? '' : ' et l’ail'}, préparer ${prep(r.L)}.`,
        r.P ? (r.P.k ? `Faire revenir ${r.P.art} ${r.P.k}.` : `Préparer ${r.P.court === 'thon' ? 'le thon égoutté et émietté' : r.P.art + ' en morceaux'}.`) : 'Faire chauffer l’huile d’olive dans une sauteuse.',
        `Ajouter l’oignon et les légumes, cuire 5 à 8 minutes.`,
        r.sauce === 'creme' ? `Verser la crème, laisser réduire 3 minutes, saler, poivrer.` : `Ajouter les tomates pelées, laisser mijoter 10 minutes, saler, poivrer.`,
        `Égoutter les ${r.F.court}, les mélanger à la sauce et servir avec le parmesan.`,
      ],
    },
    {
      id: 'gratin', time: 45, mots: ['gratin', 'four', 'reconfortant', 'hiver'], P: [0, 1], L: 1, F: 1, X: ['creme', 'gruyere', 'oignon'],
      cat: () => 'Gratin & four',
      name: (r) => `Gratin de ${r.F.court} ${r.L[0].aux}${r.P ? ` et ${r.P.au}` : ''}`,
      steps: (r) => [
        r.mode === 'airfryer' ? 'Préchauffer l’air fryer à 180 °C et beurrer un petit plat qui entre dans le panier.' : 'Préchauffer le four à 200 °C.',
        r.F.court === 'pommes de terre' ? 'Éplucher les pommes de terre, les couper en fines rondelles et les précuire 10 minutes à l’eau salée.' : r.F.k,
        `Faire revenir l’oignon émincé avec ${prep(r.L)} 5 minutes${r.P ? (r.P.k ? `, puis ${r.P.art} ${r.P.k}` : `, ajouter ${r.P.court === 'jambon' ? 'le jambon en lanières' : r.P.art}`) : ''}.`,
        `Mélanger avec les ${r.F.court} et la crème dans un plat, saler, poivrer.`,
        r.mode === 'airfryer' ? 'Parsemer de gruyère et gratiner 12 à 15 minutes dans l’air fryer.' : 'Parsemer de gruyère et gratiner 20 à 25 minutes.',
      ],
    },
    {
      id: 'risotto', time: 40, mots: ['risotto', 'italien', 'cremeux'], P: [0, 1], L: 1, F: 1, X: ['oignon', 'bouillon', 'vin', 'parmesan', 'beurre'], onlyP: ['poulet', 'lardons', 'crevettes', 'saumon fumé', 'jambon'],
      cat: (r) => (r.P ? catOf(r.P) : 'Pâtes & riz'),
      name: (r) => `Risotto ${r.L[0].aux}${r.P ? ` et ${r.P.au}` : ''}`,
      steps: (r) => [
        `Préparer ${prep(r.L)}${r.P && r.P.k ? ` et faire dorer ${r.P.art} ${r.P.k}, réserver` : ''}.`,
        'Faire suer l’oignon haché dans la moitié du beurre, ajouter le riz et le nacrer 2 minutes.',
        'Déglacer au vin blanc, puis ajouter le bouillon chaud louche après louche en remuant, environ 18 minutes.',
        `Ajouter les légumes à mi-cuisson${r.P ? ` et ${r.P.art} en fin de cuisson` : ''}.`,
        'Hors du feu, incorporer le parmesan et le reste de beurre.',
      ],
    },
    {
      id: 'curry', time: 35, mots: ['curry', 'epice', 'asiatique', 'indien'], P: 1, L: 2, F: 1, X: ['oignon', 'ail', 'coco', 'curry', 'huile'], onlyF: ['riz'],
      cat: (r) => catOf(r.P),
      name: (r) => `Curry ${r.P.de} ${auxLegs(r.L)}`,
      steps: (r) => r.mode === 'mijoteuse' ? [
        `Mettre dans la mijoteuse ${r.P.art}, ${prep(r.L)}, l’oignon et l’ail hachés, le curry et le lait de coco.`,
        'Saler, poivrer, mélanger et cuire 4 heures en position haute (ou 7 heures en position basse).',
        r.F.k,
        'Servir le curry avec le riz.',
      ] : [
        r.F.k,
        `Faire revenir l’oignon et l’ail hachés dans l’huile, ajouter le curry et torréfier 1 minute.`,
        r.P.k ? `Ajouter ${r.P.art} et cuire ${r.P.k}.` : `Ajouter ${r.P.art}.`,
        `Ajouter ${prep(r.L)}, puis le lait de coco ; laisser mijoter 12 à 15 minutes.`,
        'Saler, poivrer et servir avec le riz.',
      ],
    },
    {
      id: 'soupe', time: 35, mots: ['soupe', 'hiver', 'leger', 'reconfortant'], P: 0, L: 2, F: 1, X: ['oignon', 'bouillon', 'creme'], onlyF: ['pommes de terre'], pain: true,
      cat: () => 'Soupe',
      name: (r) => (r.mode === 'paysanne' ? `Soupe paysanne de ${legs(r.L)}` : `Velouté de ${legs(r.L)}`),
      steps: (r) => [
        `Éplucher et couper ${prep(r.L)}, ainsi que les pommes de terre en cubes.`,
        r.mode === 'cocotte' ? 'Faire revenir l’oignon émincé dans la cocotte-minute, ajouter les légumes et le bouillon.' : 'Faire revenir l’oignon émincé, ajouter les légumes et le bouillon.',
        r.mode === 'cocotte' ? 'Fermer et cuire 8 minutes sous pression, puis mixer finement.' : r.mode === 'paysanne' ? 'Cuire 25 minutes à couvert, en petits morceaux (sans mixer).' : 'Cuire 20 minutes à couvert, puis mixer finement.',
        'Ajouter la crème, rectifier l’assaisonnement.',
        'Dorer le pain en cubes à la poêle et parsemer sur la soupe.',
      ],
    },
    {
      id: 'salade', time: 25, mots: ['salade', 'leger', 'froid', 'emporter', 'ete'], P: 1, L: 2, F: 1, X: ['vinaigrette'], onlyF: ['lentilles', 'penne', 'pommes de terre', 'riz'],
      cat: () => 'Salade',
      name: (r) => `Salade de ${r.F.court}, ${r.P.court} et ${r.L[0].court}`,
      steps: (r) => [
        r.F.k || (r.F.court === 'pommes de terre' ? 'Cuire les pommes de terre 20 minutes à l’eau salée, laisser tiédir et couper en cubes.' : `Cuire les ${r.F.court}, laisser refroidir.`),
        r.P.k ? `Cuire ${r.P.art} ${r.P.k}, laisser tiédir.` : `Préparer ${r.P.court === 'œufs' ? 'les œufs durs (10 minutes à l’eau bouillante)' : r.P.art + (r.P.court === 'feta' ? ' en dés' : '')}.`,
        `Couper ${prep(r.L)}.`,
        'Mélanger le tout avec la vinaigrette, saler, poivrer.',
      ],
    },
    {
      id: 'four', time: 45, mots: ['four', 'plaque', 'simple'], P: 1, L: 1, F: 1, X: ['olive', 'herbes', 'oignon'], onlyF: ['pommes de terre', 'patates douces'],
      cat: (r) => (r.P.g === 'poisson' ? 'Poisson' : 'Gratin & four'),
      name: (r) => `${r.P.plat || cap(r.P.court)} ${r.mode === 'airfryer' ? 'à l’air fryer' : 'au four'}, ${r.F.court} et ${r.L[0].court}`,
      steps: (r) => r.mode === 'airfryer' ? [
        `Couper les ${r.F.court} en quartiers, les mélanger avec l’huile, du sel et les herbes.`,
        'Cuire 15 minutes à 200 °C dans l’air fryer en secouant le panier à mi-cuisson.',
        `Ajouter ${prep(r.L)} et ${r.P.art}, poursuivre ${r.P.g === 'poisson' ? '10 à 12' : '12 à 15'} minutes à 190 °C.`,
        'Servir bien chaud.',
      ] : [
        'Préchauffer le four à 200 °C.',
        `Couper les ${r.F.court} en quartiers et l’oignon en morceaux, huiler, saler et enfourner 20 minutes.`,
        `Ajouter ${prep(r.L)} et ${r.P.court === 'feta' ? 'la feta en bloc' : r.P.court} sur la plaque, parsemer d’herbes.`,
        `Poursuivre la cuisson ${r.P.g === 'poisson' ? '12 à 15' : '20 à 25'} minutes.`,
        'Servir bien chaud.',
      ],
    },
    {
      id: 'papillote', time: 30, mots: ['papillote', 'leger', 'poisson', 'four'], P: 1, L: 1, F: 1, X: ['citron', 'olive'], onlyF: ['riz'],
      cat: (r) => catOf(r.P),
      name: (r) => `Papillote ${r.P.de} ${r.L[0].aux}, riz`,
      steps: (r) => [
        r.mode === 'airfryer' ? 'Préchauffer l’air fryer à 180 °C.' : 'Préchauffer le four à 200 °C.',
        r.F.k,
        `Déposer ${prep(r.L)} sur une feuille de papier cuisson, poser ${r.P.art} dessus.`,
        'Arroser d’huile d’olive et de jus de citron, saler, poivrer, refermer la papillote.',
        r.mode === 'airfryer' ? 'Cuire 12 à 14 minutes dans le panier de l’air fryer et servir avec le riz.' : 'Cuire 15 à 18 minutes et servir avec le riz.',
      ],
    },
    {
      id: 'quiche', time: 45, mots: ['quiche', 'tarte', 'four', 'emporter'], P: [0, 1], L: 1, F: 0, X: ['brisee', 'oeufs', 'creme', 'gruyere'],
      cat: (r) => (r.P ? 'Gratin & four' : 'Végétarien'),
      name: (r) => `Quiche ${r.L[0].aux}${r.P ? ` et ${r.P.au}` : ''}`,
      steps: (r) => [
        'Préchauffer le four à 200 °C et foncer un moule avec la pâte.',
        `Faire revenir ${prep(r.L)} 6 à 8 minutes${r.P ? (r.P.k ? ` avec ${r.P.art}` : `, ajouter ${r.P.art}`) : ''}.`,
        'Battre les œufs avec la crème, saler, poivrer.',
        'Répartir la garniture sur la pâte, verser l’appareil et parsemer de gruyère.',
        'Cuire 30 minutes, jusqu’à ce que la quiche soit dorée.',
      ],
    },
    {
      id: 'omelette', time: 15, mots: ['omelette', 'rapide', 'oeuf', 'midi'], P: [0, 1], L: 1, F: [0, 1], X: ['beurre'], onlyF: ['pain'], needP: ['œufs'],
      cat: () => 'Végétarien',
      name: (r) => `Omelette ${r.L[0].aux}${r.P2 ? ` et ${r.P2.au}` : ''}`,
      steps: (r) => [
        `Faire revenir ${prep(r.L)} dans le beurre 5 minutes${r.P2 && r.P2.k ? `, avec ${r.P2.art}` : ''}.`,
        'Battre les œufs, saler, poivrer.',
        `Verser sur les légumes${r.P2 && !r.P2.k ? `, ajouter ${r.P2.art}` : ''} et cuire à feu doux 4 à 5 minutes.`,
        r.F ? 'Servir avec le pain grillé.' : 'Servir aussitôt.',
      ],
    },
    {
      id: 'wok', time: 25, mots: ['wok', 'asiatique', 'rapide', 'nouilles'], P: 1, L: 2, F: 1, X: ['ail', 'soja', 'huile'],
      cat: (r) => catOf(r.P),
      name: (r) => `Wok ${r.P.de} ${auxLegs(r.L)}, nouilles`,
      steps: (r) => [
        r.F.k,
        `Couper ${prep(r.L)}.`,
        `Saisir ${r.P.art} dans ${r.tools.has('wok') ? 'un wok' : 'une grande poêle'} très chaud${r.tools.has('wok') ? '' : 'e'}${r.P.k ? ' ' + r.P.k : ''}, réserver.`,
        'Sauter les légumes et l’ail haché 4 à 5 minutes à feu vif.',
        `Ajouter les nouilles, ${r.P.art} et la sauce soja, mélanger 2 minutes et servir.`,
      ],
    },
    {
      id: 'airfryer', time: 30, mots: ['air fryer', 'airfryer', 'frites', 'croustillant', 'rapide'], P: 1, L: 1, F: 1, X: ['huile', 'herbes'], onlyF: ['pommes de terre'],
      cat: (r) => catOf(r.P),
      name: (r) => `${r.P.plat || cap(r.P.court)} à l’air fryer, frites et ${r.L[0].court}`,
      steps: (r) => [
        'Couper les pommes de terre en frites, les rincer, bien les sécher et les mélanger avec la moitié de l’huile.',
        'Cuire les frites 15 minutes à 200 °C dans l’air fryer, en secouant le panier à mi-cuisson.',
        `Badigeonner ${r.P.art} et ${prep(r.L)} du reste d’huile, saler, poivrer, parsemer d’herbes.`,
        `Ajouter dans le panier et cuire encore ${r.P.g === 'poisson' ? '8 à 10' : '12 à 15'} minutes à 190 °C.`,
        'Servir aussitôt, bien croustillant.',
      ],
    },
    {
      id: 'mijote', time: 30, mots: ['mijote', 'mijoteuse', 'cocotte', 'ragout', 'hiver', 'reconfortant'], P: 1, L: 2, F: 1, X: ['oignon', 'ail', 'bouillon', 'herbes'], onlyF: ['pommes de terre'],
      cat: (r) => catOf(r.P),
      name: (r) => `Mijoté ${r.P.de} ${auxLegs(r.L)}`,
      steps: (r) => r.mode === 'cocotte' ? [
        `Dans la cocotte-minute, faire dorer ${r.P.art} avec l’oignon émincé.`,
        `Ajouter ${prep(r.L)}, les pommes de terre en gros cubes, l’ail, les herbes et le bouillon.`,
        'Fermer et cuire 25 minutes sous pression.',
        'Laisser la pression retomber, saler, poivrer et servir.',
      ] : [
        `Couper ${prep(r.L)} et les pommes de terre en gros cubes, émincer l’oignon et l’ail.`,
        `Tout mettre dans la mijoteuse avec ${r.P.art}, les herbes et le bouillon.`,
        'Cuire 6 heures en position basse (ou 3 h 30 en position haute).',
        'Saler, poivrer et servir. Se prépare le matin, prêt le soir.',
      ],
    },
  ];

  /* ---------- Ustensiles ----------
     Chaque modèle liste ses façons de faire (modes) et les ustensiles qu'elles demandent ;
     le premier mode possible avec les ustensiles cochés dans Réglages est retenu. */
  const MODES = {
    poele: [{ m: 'poele', t: ['plaques'] }],
    pates: [{ m: 'poele', t: ['plaques'] }],
    gratin: [{ m: 'four', t: ['four', 'plaques'] }, { m: 'airfryer', t: ['airfryer', 'plaques'] }],
    risotto: [{ m: 'poele', t: ['plaques'] }],
    curry: [{ m: 'poele', t: ['plaques'] }, { m: 'mijoteuse', t: ['mijoteuse'] }],
    soupe: [{ m: 'veloute', t: ['plaques', 'blender'] }, { m: 'cocotte', t: ['cocotte', 'blender'] }, { m: 'paysanne', t: ['plaques'] }],
    salade: [{ m: 'poele', t: ['plaques'] }],
    four: [{ m: 'four', t: ['four'] }, { m: 'airfryer', t: ['airfryer'] }],
    papillote: [{ m: 'four', t: ['four', 'plaques'] }, { m: 'airfryer', t: ['airfryer', 'plaques'] }],
    quiche: [{ m: 'four', t: ['four', 'plaques'] }],
    omelette: [{ m: 'poele', t: ['plaques'] }],
    wok: [{ m: 'poele', t: ['plaques'] }],
    airfryer: [{ m: 'airfryer', t: ['airfryer'] }],
    mijote: [{ m: 'mijoteuse', t: ['mijoteuse'] }, { m: 'cocotte', t: ['cocotte'] }],
  };
  const modeFor = (tpl, tools) => (MODES[tpl.id] || [{ m: 'poele', t: ['plaques'] }]).find((x) => x.t.every((t) => tools.has(t))) || null;

  /* ---------- Préparation des candidats ---------- */
  const allowed = (n) => !E.conflicts({ ingredients: [{ name: n }] }).length;
  const rnd = (a) => a[Math.floor(Math.random() * a.length)];

  function context({ usePromos, fridgeIds }) {
    const promos = usePromos === false ? [] : E.activePromos(C.weekId()).filter((p) => E.promoState(p) !== 'expired');
    const fridge = C.S.fridge.filter((f) => (fridgeIds || []).includes(f.id));
    const info = (item) => {
      const m = promos.length ? E.promoFor(item.n, promos) : null;
      const f = fridge.find((x) => C.tokens(item.n).every((t) => C.tokens(`${x.name} ${x.generic || ''}`).includes(t)));
      const pct = m ? Math.round((1 - m.ratio) * 100) : 0;
      return { promo: m ? m.promo : null, pct, fridge: f || null, score: (f ? 5 + (E.expiresIn(f) != null && E.expiresIn(f) <= 3 ? 3 : 0) : 0) + (m ? 1.5 + pct / 10 : 0) };
    };
    const flexi = E.flexi && E.flexi();
    const tag = (arr) => arr.filter((x) => allowed(x.n)).map((x) => ({ ...x, ...info(x), w: flexi && x.g === 'viande' ? 0.25 : 1 }));
    const extras = Object.fromEntries(Object.entries(X).map(([k, x]) => [k, { ...x, ...info(x) }]));
    return { P: tag(P), L: tag(L), F: tag(F), X: extras, fridge, promos };
  }

  // Tirage pondéré : les produits en promo et ceux du frigo sortent plus souvent.
  function pick(list, n, avoid) {
    const out = [];
    const pool = list.filter((x) => !avoid.includes(x.n));
    while (out.length < n && pool.length) {
      const w = pool.map((x) => (0.6 + x.score * x.score) * (x.w || 1));
      let r = Math.random() * w.reduce((a, b) => a + b, 0);
      let i = 0;
      while ((r -= w[i]) > 0) i++;
      out.push(pool.splice(Math.min(i, pool.length - 1), 1)[0]);
    }
    return out;
  }
  const count = (spec) => (Array.isArray(spec) ? spec[Math.random() < 0.6 ? spec.length - 1 : 0] : spec);

  function attempt(tpl, ctx) {
    const fits = (x) => x.t.includes(tpl.id);
    let Fs = ctx.F.filter(fits);
    if (tpl.onlyF) Fs = Fs.filter((f) => tpl.onlyF.includes(f.court));
    let Ps = ctx.P.filter(fits);
    if (tpl.onlyP) Ps = Ps.filter((p) => tpl.onlyP.includes(p.court));
    const Ls = ctx.L.filter(fits);
    const mode = modeFor(tpl, ctx.tools);
    if (!mode) return null;
    const r = { tpl, L: [], P: null, P2: null, F: null, mode: mode.m, tools: ctx.tools };
    if (tpl.needP) {
      const egg = ctx.P.find((p) => tpl.needP.includes(p.court));
      if (!egg) return null;
      r.P = egg;
      const more = count(tpl.P);
      if (more) r.P2 = pick(Ps.filter((p) => p !== egg), 1, [])[0] || null;
    } else {
      const np = count(tpl.P);
      if (np) {
        r.P = pick(Ps, 1, [])[0];
        if (!r.P) return null;
      }
    }
    const nf = count(tpl.F);
    if (nf) {
      r.F = pick(Fs, 1, r.P ? [r.P.n] : [])[0];
      if (!r.F) return null;
    }
    r.L = pick(Ls, tpl.L, r.F ? [r.F.n] : []);
    if (r.L.length < tpl.L) return null;
    if (tpl.sauce) r.sauce = Math.random() < 0.5 ? 'creme' : 'tomate';
    const xs = [...tpl.X, ...(tpl.extra ? tpl.extra(r) : [])].filter((k, i, a) => a.indexOf(k) === i).map((k) => ctx.X[k]);
    if (xs.some((x) => !allowed(x.n))) return null;
    r.X = xs;
    const main = [r.P, r.P2, r.F, ...r.L].filter(Boolean);
    r.uses = [...main, ...xs].filter((x) => x.promo || x.fridge);
    // Le hasard compte assez pour varier d'un clic à l'autre, sans écraser l'intérêt des promotions.
    r.score = [...main, ...xs].reduce((n, x) => n + x.score, 0) + Math.random() * 6;
    return r;
  }

  /* ---------- Photo d'illustration (Unsplash, voir assets/img/recettes/CREDITS.md) ---------- */
  const IMG = (f) => `assets/img/recettes/${f}.webp`;
  function photoFor(r) {
    const id = r.tpl.id;
    const fish = r.P && r.P.g === 'poisson';
    if (id === 'pates') return IMG(r.sauce === 'creme' ? 'plat-pates-creme' : r.F.court === 'spaghetti' ? 'spaghetti-bolognaise' : 'penne-thon-tomates-olives');
    if (id === 'soupe') return IMG(r.mode === 'paysanne' ? 'plat-soupe-paysanne' : 'soupe-courge-croutons');
    if (id === 'salade') return IMG(r.F.court === 'lentilles' ? 'salade-lentilles-feta-courge' : 'plat-salade-composee');
    if (id === 'four') return IMG(r.mode === 'airfryer' ? 'plat-airfryer' : fish ? 'saumon-pommes-de-terre-brocoli' : r.P.court === 'saucisses' ? 'saucisses-puree-carottes' : 'cuisses-poulet-legumes-hiver');
    if (id === 'poele') return IMG(r.F.court === 'riz' && r.P.court === 'poulet' ? 'emince-poulet-creme-riz' : 'plat-poelee');
    const fixe = { gratin: 'gratin-cornettes-jambon', risotto: 'risotto-champignons', curry: 'curry-pois-chiches-epinards', papillote: 'plat-papillote', quiche: 'quiche-poireaux-lardons', omelette: 'plat-omelette', wok: 'wok-tofu-nouilles', airfryer: 'plat-airfryer', mijote: 'plat-mijote' };
    return fixe[id] ? IMG(fixe[id]) : '';
  }

  const roundQty = (q, u) => {
    if (u === 'g') return q >= 100 ? Math.round(q / 10) * 10 : Math.round(q / 5) * 5;
    if (['pièce', 'tranche', 'gousse'].includes(u)) return Math.max(0.5, Math.round(q * 2) / 2);
    return Math.round(q * 4) / 4;
  };

  function build(r, people) {
    const items = [r.P, r.P2, r.F, ...r.L, ...r.X].filter(Boolean);
    const seen = new Set();
    const ingredients = items
      .filter((x) => (seen.has(x.n) ? false : seen.add(x.n)))
      .map((x) => ({
        name: x.n,
        qty: roundQty(x.q * people, x.u),
        unit: x.u,
        cat: x.c,
        price: Math.round(x.p * people * 20) / 20,
        ...(x.promo ? { promoId: x.promo.id } : {}),
        ...(x.fridge ? { frigo: true } : {}),
      }));
    const mains = [r.P, r.P2, r.F, ...r.L].filter(Boolean);
    const promoTxt = r.uses.filter((x) => x.promo && (mains.includes(x) || x.pct >= 25)).map((x) => `${x.n.toLowerCase()} (${C.storeById(x.promo.store).name}${x.pct ? ` −${x.pct} %` : ''})`);
    const frigoTxt = r.uses.filter((x) => x.fridge).map((x) => x.fridge.name.toLowerCase());
    const why = [promoTxt.length ? `En promotion : ${et(promoTxt)}.` : '', frigoTxt.length ? `Du frigo : ${et(frigoTxt)}.` : ''].filter(Boolean).join(' ');
    return {
      id: C.uid(),
      name: r.tpl.name(r),
      description: why,
      why,
      category: r.tpl.cat(r),
      prepTime: r.tpl.time,
      servings: people,
      ingredients,
      steps: r.tpl.steps(r).filter(Boolean).map((st) => (r.tools.has('cuiseur-riz') ? st.replace('Cuire le riz selon les indications du paquet.', 'Cuire le riz au cuiseur à riz.') : st)),
      photo: photoFor(r),
      tools: (modeFor(r.tpl, r.tools) || { t: [] }).t,
      favorite: false,
      validated: false,
      source: 'cabas',
      demo: false,
      createdAt: Date.now(),
    };
  }

  /* ---------- API ---------- */
  C.cuisine = {
    // Aliments connus (sert aussi à reconnaître les articles d'un ticket de caisse).
    foods: [...P, ...L, ...F, ...Object.values(X)].filter((x, i, a) => a.findIndex((y) => y.n === x.n) === i),
    // Types de plats faisables avec les ustensiles donnés (pour l'affichage dans Générer).
    possible: (tools) => T.filter((t) => modeFor(t, new Set(tools))).map((t) => t.id),
    // Renvoie des idées de recettes différentes, sans rien envoyer sur Internet.
    generate({ count: n = 3, people = 2, maxTime = 0, wish = '', usePromos = true, fridgeIds = [], avoid = [], tools }) {
      // avoid : idées affichées juste avant (on change de plat et de protéine principale)
      const key = (name) => C.tokens(name).sort().join(' ');
      const prevT = new Set(avoid.map((r) => r.tpl));
      const prevP = new Set(avoid.map((r) => r.main).filter(Boolean));
      const ctx = context({ usePromos, fridgeIds });
      ctx.tools = new Set(tools || C.S.settings.tools || []);
      const w = C.norm(wish);
      let tpls = T.filter((t) => (!maxTime || t.time <= maxTime) && modeFor(t, ctx.tools));
      if (!tpls.length) return { recipes: [], note: 'Aucun plat possible avec ces ustensiles et ce temps. Vérifiez vos ustensiles dans Réglages.' };
      const vege = /vege|sans viande/.test(w);
      const fast = /rapide|vite|express/.test(w);
      if (vege) ctx.P = ctx.P.filter((p) => p.g === 'vege');
      if (fast && tpls.some((t) => t.time <= 30)) tpls = tpls.filter((t) => t.time <= 30);
      const wanted = tpls.filter((t) => t.mots.some((m) => w.includes(m)) || w.includes(t.id));
      if (wanted.length) tpls = wanted;
      // Ingrédient demandé dans l'envie (« poireaux », « saumon ») : on le favorise.
      const words = C.tokens(w).filter((x) => x.length > 2);
      const boost = (r) => [r.P, r.P2, r.F, ...r.L].filter(Boolean).some((x) => C.tokens(x.n).some((t) => words.includes(t)));

      const known = new Set([...C.S.recipes.map((r) => r.name), ...avoid.map((r) => r.name)].map(key));
      // « Moins de viande » : les idées avec viande baissent et restent au plus un tiers du lot.
      const flexi = E.flexi();
      const meaty = (r) => [r.P, r.P2, ...(r.X || [])].filter(Boolean).some((x) => E.hasRealMeat({ ingredients: [{ name: x.n }] }));
      const meatCap = Math.max(1, Math.round(n / 3));
      let meatOut = 0;
      const tries = [];
      for (let i = 0; i < 500; i++) {
        const r = attempt(rnd(tpls), ctx);
        if (!r) continue;
        if (prevT.has(r.tpl.id)) r.score -= 4;
        if (r.P && prevP.has(r.P.court)) r.score -= 6;
        if (words.length && boost(r)) r.score += 12;
        if (flexi && meaty(r)) r.score -= 2;
        tries.push(r);
      }
      tries.sort((a, b) => b.score - a.score);
      // Variété : un type de plat et une protéine principale différents par idée, si possible.
      const out = [];
      const usedT = new Set();
      const usedP = new Set();
      const usedName = new Set();
      for (const pass of [0, 1, 2]) {
        for (const r of tries) {
          if (out.length >= n) break;
          const name = key(r.tpl.name(r));
          if (usedName.has(name) || known.has(name)) continue;
          if (pass < 2 && usedT.has(r.tpl.id)) continue;
          if (pass < 1 && r.P && usedP.has(r.P.court)) continue;
          if (flexi && pass < 2 && meaty(r) && meatOut >= meatCap) continue;
          if (meaty(r)) meatOut++;
          out.push(r);
          usedT.add(r.tpl.id);
          if (r.P) usedP.add(r.P.court);
          usedName.add(name);
        }
      }
      const recipes = out.map((r) => ({ ...build(r, people), tpl: r.tpl.id, main: r.P ? r.P.court : '' })).filter((rec) => !E.conflicts(rec).length);
      const unused = ctx.fridge.filter((f) => !recipes.some((rec) => rec.ingredients.some((i) => i.frigo && C.tokens(i.name).every((t) => C.tokens(f.name).includes(t)))));
      return {
        recipes,
        unusedFridge: unused.map((f) => f.name),
        note: recipes.length ? '' : 'Pas assez de produits compatibles avec vos préférences. Ajoutez des aliments au frigo ou assouplissez l’envie particulière.',
      };
    },
  };
})();
