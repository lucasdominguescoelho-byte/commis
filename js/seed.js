/* Cabas — recettes d'exemple chargées au tout premier lancement (marquées demo:true).
   Les coûts sont des estimations au prix habituel ; les promotions réelles s'y appliquent ensuite. */
(function () {
  'use strict';
  const C = window.C;

  // Photos des recettes d'exemple (Unsplash, licence libre — voir assets/img/recettes/CREDITS.md).
  C.SEED_PHOTOS = {
    'demo-r1': 'assets/img/recettes/emince-poulet-creme-riz.webp',
    'demo-r2': 'assets/img/recettes/spaghetti-bolognaise.webp',
    'demo-r3': 'assets/img/recettes/gratin-cornettes-jambon.webp',
    'demo-r4': 'assets/img/recettes/saumon-pommes-de-terre-brocoli.webp',
    'demo-r5': 'assets/img/recettes/curry-pois-chiches-epinards.webp',
    'demo-r6': 'assets/img/recettes/risotto-champignons.webp',
    'demo-r7': 'assets/img/recettes/soupe-courge-croutons.webp',
    'demo-r8': 'assets/img/recettes/rosti-oeufs-salade.webp',
    'demo-r9': 'assets/img/recettes/quiche-poireaux-lardons.webp',
    'demo-r10': 'assets/img/recettes/salade-lentilles-feta-courge.webp',
    'demo-r11': 'assets/img/recettes/penne-thon-tomates-olives.webp',
    'demo-r12': 'assets/img/recettes/saucisses-puree-carottes.webp',
    'demo-r13': 'assets/img/recettes/wok-tofu-nouilles.webp',
    'demo-r14': 'assets/img/recettes/cuisses-poulet-legumes-hiver.webp',
  };

  // i(nom, quantité, unité, rayon, coût estimé en CHF pour cette quantité au prix habituel)
  const i = (name, qty, unit, cat, price) => ({ name, qty, unit, cat, price });

  const RECIPES = [
    {
      name: 'Émincé de poulet à la crème et riz',
      category: 'Viande', prepTime: 30, servings: 4,
      description: 'Un classique de semaine : poulet tendre, champignons et sauce crémeuse au paprika.',
      ingredients: [
        i('Émincé de poulet', 500, 'g', 'vp', 9.9), i('Champignons de Paris', 250, 'g', 'fl', 2.8), i('Oignon', 1, 'pièce', 'fl', 0.4),
        i('Crème entière', 2, 'dl', 'lait', 1.9), i('Riz long grain', 300, 'g', 'epi', 1.1), i('Huile de colza', 1, 'c. à soupe', 'epi', 0.1), i('Paprika', 1, 'c. à café', 'epi', 0.1),
      ],
      steps: ['Cuire le riz selon les indications du paquet.', "Saisir l'émincé de poulet à feu vif dans l'huile, saler, réserver.", "Dans la même poêle, faire revenir l'oignon haché et les champignons émincés 5 minutes.", 'Ajouter le paprika et la crème, laisser réduire 3 minutes.', 'Remettre le poulet, réchauffer 2 minutes et servir avec le riz.'],
    },
    {
      name: 'Spaghetti bolognaise',
      category: 'Pâtes & riz', prepTime: 40, servings: 4,
      description: 'Sauce mijotée à la viande hachée, carottes et tomates. Se congèle très bien.',
      ingredients: [
        i('Viande hachée de bœuf', 400, 'g', 'vp', 7.2), i('Spaghetti', 500, 'g', 'epi', 1.5), i('Tomates pelées', 400, 'g', 'epi', 1.2),
        i('Oignon', 1, 'pièce', 'fl', 0.4), i('Carottes', 200, 'g', 'fl', 0.5), i('Ail', 2, 'gousse', 'fl', 0.3), i('Parmesan', 50, 'g', 'lait', 1.8),
      ],
      steps: ["Hacher l'oignon et l'ail, couper les carottes en petits dés.", 'Faire revenir les légumes 5 minutes, ajouter la viande et la faire dorer.', 'Verser les tomates pelées, saler, poivrer et laisser mijoter 25 minutes à feu doux.', 'Cuire les spaghetti al dente.', 'Servir la sauce sur les pâtes avec le parmesan râpé.'],
    },
    {
      name: 'Gratin de cornettes au jambon',
      category: 'Gratin & four', prepTime: 35, servings: 4,
      description: 'Le gratin réconfortant par excellence, prêt avec cinq ingrédients.',
      ingredients: [
        i('Cornettes', 400, 'g', 'epi', 1.4), i('Jambon', 200, 'g', 'vp', 4.2), i('Crème entière', 2, 'dl', 'lait', 1.9),
        i('Gruyère râpé', 150, 'g', 'lait', 3.3), i('Oignon', 1, 'pièce', 'fl', 0.4),
      ],
      steps: ['Préchauffer le four à 200 °C.', 'Cuire les cornettes 2 minutes de moins que le temps indiqué.', "Faire revenir l'oignon haché, ajouter le jambon en lanières.", 'Mélanger pâtes, jambon, crème et la moitié du gruyère dans un plat.', 'Couvrir du reste de gruyère et gratiner 15 minutes.'],
    },
    {
      name: 'Saumon au four, pommes de terre et brocoli',
      category: 'Poisson', prepTime: 35, servings: 4,
      description: 'Tout cuit sur une seule plaque. Peu de vaisselle, beaucoup de goût.',
      ingredients: [
        i('Filet de saumon', 500, 'g', 'vp', 13.9), i('Pommes de terre', 800, 'g', 'fl', 1.9), i('Brocoli', 400, 'g', 'fl', 2.3),
        i('Citron', 1, 'pièce', 'fl', 0.7), i("Huile d'olive", 2, 'c. à soupe', 'epi', 0.3),
      ],
      steps: ['Préchauffer le four à 200 °C.', "Couper les pommes de terre en quartiers, les enrober d'huile, saler et enfourner 15 minutes.", 'Ajouter le brocoli en bouquets et le saumon sur la plaque.', 'Poursuivre la cuisson 12 à 15 minutes.', 'Arroser de jus de citron au moment de servir.'],
    },
    {
      name: 'Curry de pois chiches aux épinards',
      category: 'Végétarien', prepTime: 30, servings: 4,
      description: 'Un curry doux au lait de coco, entièrement végétal, qui se réchauffe encore mieux le lendemain.',
      ingredients: [
        i('Pois chiches en boîte', 500, 'g', 'epi', 2.2), i('Épinards frais', 250, 'g', 'fl', 2.9), i('Lait de coco', 4, 'dl', 'epi', 2.6),
        i('Tomates pelées', 400, 'g', 'epi', 1.2), i('Oignon', 1, 'pièce', 'fl', 0.4), i('Ail', 2, 'gousse', 'fl', 0.3),
        i('Curry en poudre', 2, 'c. à soupe', 'epi', 0.4), i('Riz long grain', 300, 'g', 'epi', 1.1),
      ],
      steps: ['Cuire le riz.', "Faire revenir l'oignon et l'ail hachés, ajouter le curry et torréfier 1 minute.", 'Verser les tomates et le lait de coco, laisser mijoter 10 minutes.', 'Ajouter les pois chiches égouttés, cuire 5 minutes.', 'Incorporer les épinards, laisser tomber 2 minutes et servir avec le riz.'],
    },
    {
      name: 'Risotto aux champignons',
      category: 'Pâtes & riz', prepTime: 40, servings: 4,
      description: 'Crémeux sans crème : il suffit de remuer et d’ajouter le bouillon petit à petit.',
      ingredients: [
        i('Riz pour risotto', 320, 'g', 'epi', 2.1), i('Champignons de Paris', 300, 'g', 'fl', 3.3), i('Oignon', 1, 'pièce', 'fl', 0.4),
        i('Vin blanc', 1, 'dl', 'bois', 0.8), i('Bouillon de légumes', 1, 'l', 'epi', 0.6), i('Parmesan', 60, 'g', 'lait', 2.2), i('Beurre', 30, 'g', 'lait', 0.4),
      ],
      steps: ['Faire dorer les champignons émincés, réserver.', "Faire suer l'oignon haché dans la moitié du beurre, ajouter le riz et le nacrer 2 minutes.", 'Déglacer au vin blanc, laisser évaporer.', 'Ajouter le bouillon chaud louche après louche en remuant, environ 18 minutes.', 'Hors du feu, incorporer champignons, parmesan et reste de beurre.'],
    },
    {
      name: 'Soupe de courge et croûtons',
      category: 'Soupe', prepTime: 35, servings: 4,
      description: 'Veloutée, légèrement sucrée, avec des croûtons dorés pour le croquant.',
      ingredients: [
        i('Courge', 1, 'kg', 'fl', 3.2), i('Pommes de terre', 300, 'g', 'fl', 0.7), i('Oignon', 1, 'pièce', 'fl', 0.4),
        i('Bouillon de légumes', 8, 'dl', 'epi', 0.5), i('Crème entière', 1, 'dl', 'lait', 0.95), i('Pain', 4, 'tranche', 'boul', 0.9),
      ],
      steps: ['Peler et couper la courge et les pommes de terre en cubes.', "Faire revenir l'oignon, ajouter les légumes et le bouillon.", 'Cuire 20 minutes à couvert, puis mixer finement.', 'Ajouter la crème, rectifier l’assaisonnement.', 'Dorer le pain en cubes à la poêle et parsemer sur la soupe.'],
    },
    {
      name: 'Rösti, œufs au plat et salade',
      category: 'Végétarien', prepTime: 30, servings: 4,
      description: 'Une galette de pommes de terre bien croustillante, un œuf coulant, une salade croquante.',
      ingredients: [
        i('Pommes de terre', 1, 'kg', 'fl', 2.4), i('Œufs', 8, 'pièce', 'lait', 3.6), i('Beurre', 30, 'g', 'lait', 0.4),
        i('Salade pommée', 1, 'pièce', 'fl', 1.6), i('Vinaigrette', 4, 'c. à soupe', 'epi', 0.5),
      ],
      steps: ['Râper grossièrement les pommes de terre crues, saler et presser pour retirer l’eau.', 'Faire fondre le beurre, tasser les pommes de terre en galette et cuire 10 minutes par face.', 'Cuire les œufs au plat dans une seconde poêle.', 'Assaisonner la salade.', 'Servir le rösti en parts avec les œufs et la salade.'],
    },
    {
      name: 'Quiche aux poireaux et lardons',
      category: 'Gratin & four', prepTime: 45, servings: 4,
      description: 'Se mange chaude le soir et froide le lendemain à midi.',
      ingredients: [
        i('Pâte brisée', 1, 'pièce', 'epi', 2.2), i('Poireaux', 400, 'g', 'fl', 1.9), i('Lardons', 150, 'g', 'vp', 2.9),
        i('Œufs', 3, 'pièce', 'lait', 1.35), i('Crème entière', 2, 'dl', 'lait', 1.9), i('Gruyère râpé', 100, 'g', 'lait', 2.2),
      ],
      steps: ['Préchauffer le four à 200 °C et foncer un moule avec la pâte.', 'Faire revenir les lardons, ajouter les poireaux émincés et cuire 8 minutes.', 'Battre les œufs avec la crème, poivrer.', 'Répartir poireaux et lardons sur la pâte, verser l’appareil et parsemer de gruyère.', 'Cuire 30 minutes, jusqu’à ce que la quiche soit dorée.'],
    },
    {
      name: 'Salade de lentilles, feta et courge rôtie',
      category: 'Salade', prepTime: 35, servings: 4,
      description: 'Une salade tiède et rassasiante, idéale à emporter.',
      ingredients: [
        i('Lentilles vertes', 300, 'g', 'epi', 1.6), i('Feta', 200, 'g', 'lait', 3.2), i('Courge', 400, 'g', 'fl', 1.3),
        i('Carottes', 200, 'g', 'fl', 0.5), i('Oignon rouge', 1, 'pièce', 'fl', 0.5), i("Huile d'olive", 3, 'c. à soupe', 'epi', 0.45), i('Vinaigre de vin', 2, 'c. à soupe', 'epi', 0.2),
      ],
      steps: ['Préchauffer le four à 210 °C.', 'Rôtir la courge et les carottes en dés avec un filet d’huile, 25 minutes.', 'Cuire les lentilles 20 minutes dans de l’eau non salée, égoutter.', 'Mélanger lentilles, légumes rôtis et oignon émincé avec huile et vinaigre.', 'Émietter la feta par-dessus.'],
    },
    {
      name: 'Penne au thon, tomates et olives',
      category: 'Pâtes & riz', prepTime: 20, servings: 4,
      description: 'Le plat du placard : prêt en vingt minutes, sans passer au magasin.',
      ingredients: [
        i('Penne', 500, 'g', 'epi', 1.5), i('Thon en boîte', 300, 'g', 'vp', 4.4), i('Tomates pelées', 400, 'g', 'epi', 1.2),
        i('Olives noires', 80, 'g', 'epi', 1.5), i('Ail', 2, 'gousse', 'fl', 0.3), i('Oignon', 1, 'pièce', 'fl', 0.4),
      ],
      steps: ['Cuire les penne al dente.', "Faire revenir l'oignon et l'ail hachés.", 'Ajouter les tomates pelées et laisser réduire 8 minutes.', 'Incorporer le thon égoutté et les olives, réchauffer 2 minutes.', 'Mélanger avec les pâtes et servir.'],
    },
    {
      name: 'Saucisses à rôtir, purée et carottes',
      category: 'Viande', prepTime: 40, servings: 4,
      description: 'Purée maison bien lisse, carottes glacées et saucisses dorées.',
      ingredients: [
        i('Saucisses à rôtir', 4, 'pièce', 'vp', 7.6), i('Pommes de terre', 1, 'kg', 'fl', 2.4), i('Lait', 2, 'dl', 'lait', 0.35),
        i('Beurre', 30, 'g', 'lait', 0.4), i('Carottes', 500, 'g', 'fl', 1.2), i('Oignon', 2, 'pièce', 'fl', 0.8),
      ],
      steps: ['Cuire les pommes de terre pelées 20 minutes dans de l’eau salée.', 'Cuire les carottes en rondelles avec un fond d’eau et une noisette de beurre.', 'Dorer les saucisses à feu moyen 12 minutes, ajouter les oignons émincés en fin de cuisson.', 'Écraser les pommes de terre avec le lait chaud et le beurre.', 'Servir la purée avec les saucisses, les oignons et les carottes.'],
    },
    {
      name: 'Wok de légumes au tofu et nouilles',
      category: 'Végétarien', prepTime: 25, servings: 4,
      description: 'Légumes croquants, tofu doré et sauce soja : rapide et coloré.',
      ingredients: [
        i('Tofu nature', 250, 'g', 'epi', 3.4), i('Nouilles de blé', 250, 'g', 'epi', 1.8), i('Carottes', 200, 'g', 'fl', 0.5),
        i('Brocoli', 300, 'g', 'fl', 1.75), i('Champignons de Paris', 200, 'g', 'fl', 2.2), i('Sauce soja', 3, 'c. à soupe', 'epi', 0.5), i('Ail', 2, 'gousse', 'fl', 0.3),
      ],
      steps: ['Cuire les nouilles, égoutter.', 'Dorer le tofu en dés dans un wok très chaud, réserver.', 'Sauter les carottes en bâtonnets, le brocoli et les champignons 5 minutes.', "Ajouter l'ail haché, les nouilles, le tofu et la sauce soja.", 'Mélanger 2 minutes à feu vif et servir.'],
    },
    {
      name: 'Cuisses de poulet rôties et légumes d’hiver',
      category: 'Gratin & four', prepTime: 60, servings: 4,
      description: 'Le four fait tout le travail : peau croustillante et légumes confits dans le jus.',
      ingredients: [
        i('Cuisses de poulet', 800, 'g', 'vp', 8.8), i('Pommes de terre', 800, 'g', 'fl', 1.9), i('Carottes', 500, 'g', 'fl', 1.2),
        i('Oignon', 2, 'pièce', 'fl', 0.8), i("Huile d'olive", 2, 'c. à soupe', 'epi', 0.3), i('Thym', 1, 'c. à café', 'epi', 0.1),
      ],
      steps: ['Préchauffer le four à 200 °C.', 'Couper pommes de terre, carottes et oignons en gros morceaux, les disposer dans un plat.', 'Poser les cuisses par-dessus, huiler, saler, parsemer de thym.', 'Rôtir 45 à 50 minutes en arrosant à mi-cuisson.', 'Laisser reposer 5 minutes avant de servir.'],
    },
  ];

  C.seed = () => {
    return {
      recipes: RECIPES.map((r, n) => ({ id: 'demo-r' + (n + 1), favorite: false, photo: (C.SEED_PHOTOS || {})['demo-r' + (n + 1)] || '', demo: true, createdAt: Date.now(), ...r })),
    };
  };
})();
