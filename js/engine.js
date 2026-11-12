/* Commis — moteur : préférences, promotions, coûts, génération du planning, liste de courses, budget.
   Logique 100 % locale et déterministe (règles + score). Aucune IA, aucune donnée externe. */
(function () {
  'use strict';
  const C = window.C;
  const E = (C.eng = {});

  const cache = new Map();
  const tk = (s) => {
    let t = cache.get(s);
    if (!t) cache.set(s, (t = C.tokens(s)));
    return t;
  };
  const hasAll = (need, have) => need.length > 0 && need.every((t) => have.includes(t));

  /* ---------- Préférences alimentaires ----------
     Détection par mots-clés dans le nom des ingrédients (formes normalisées, au singulier). */
  const MEAT = ['poulet', 'boeuf', 'porc', 'lard', 'lardon', 'jambon', 'saucisse', 'viande', 'dinde', 'veau', 'agneau', 'bacon', 'chorizo', 'cervela', 'salami', 'canard', 'lapin', 'steak', 'volaille', 'merguez'];
  const FISH = ['saumon', 'thon', 'cabillaud', 'poisson', 'truite', 'anchoi', 'colin', 'sardine', 'perche', 'fera', 'dorade', 'lieu'];
  const SHELL = ['crevette', 'moule', 'crabe', 'homard', 'langoustine', 'calamar', 'crustace'];
  const PORK = ['porc', 'lard', 'lardon', 'jambon', 'saucisse', 'bacon', 'chorizo', 'cervela', 'salami'];
  const DAIRY = ['lait', 'creme', 'beurre', 'fromage', 'gruyere', 'parmesan', 'mozzarella', 'yogourt', 'yaourt', 'feta', 'ricotta', 'mascarpone', 'raclette', 'emmental', 'sere', 'vacherin', 'cheddar'];
  const PLANT = ['coco', 'soja', 'avoine', 'vegetal', 'amande'];
  const EGG = ['oeuf'];
  const GLUTEN = ['farine', 'pate', 'spaghetti', 'penne', 'tagliatelle', 'lasagne', 'pain', 'semoule', 'ble', 'chapelure', 'couscou', 'boulgour', 'nouille', 'gnocchi', 'orge', 'seigle', 'tortilla', 'baguette', 'macaroni', 'cornette', 'spatzli', 'knopfli', 'crouton'];
  const NUTS = ['noi', 'noisette', 'amande', 'pignon', 'pistache', 'cajou', 'pecan'];
  const PEANUT = ['arachide', 'cacahuete'];
  const SOY = ['soja', 'tofu', 'edamame'];

  E.DIETS = {
    vegetarien: { label: 'Végétarien', words: [...MEAT, ...FISH, ...SHELL] },
    vegan: { label: 'Végan', words: [...MEAT, ...FISH, ...SHELL, ...DAIRY, ...EGG, 'miel'] },
    pescetarien: { label: 'Pescétarien', words: MEAT },
    'sans-porc': { label: 'Sans porc', words: PORK },
    'sans-gluten': { label: 'Sans gluten', words: GLUTEN },
    'sans-lactose': { label: 'Sans lactose', words: DAIRY },
  };
  const ALLERGENS = {
    gluten: GLUTEN, lactose: DAIRY, lait: DAIRY, oeuf: EGG, oeufs: EGG, 'fruits a coque': NUTS, noix: NUTS,
    arachide: PEANUT, arachides: PEANUT, cacahuete: PEANUT, cacahuetes: PEANUT, poisson: FISH, poissons: FISH,
    crustaces: SHELL, 'fruits de mer': SHELL, soja: SOY,
  };
  E.ALLERGEN_SUGGESTIONS = ['Gluten', 'Lactose', 'Œufs', 'Fruits à coque', 'Arachides', 'Poisson', 'Crustacés', 'Soja'];

  function rules() {
    const st = C.S.settings;
    const out = [];
    st.diets.forEach((d) => E.DIETS[d] && out.push({ kind: 'régime', label: E.DIETS[d].label, any: E.DIETS[d].words }));
    st.allergies.forEach((a) => {
      const preset = ALLERGENS[C.norm(a)];
      out.push(preset ? { kind: 'allergie', label: a, any: preset } : { kind: 'allergie', label: a, all: tk(a) });
    });
    st.avoided.forEach((a) => out.push({ kind: 'évité', label: a, all: tk(a) }));
    return out;
  }
  const hitRule = (rule, t) => {
    if (rule.all) return hasAll(rule.all, t);
    const plant = t.some((x) => PLANT.includes(x));
    return t.some((x) => rule.any.includes(x) && !(plant && DAIRY.includes(x)));
  };
  // Raisons pour lesquelles une recette ne respecte pas les préférences (tableau vide = compatible).
  E.conflicts = (recipe) => {
    const rs = rules();
    const out = [];
    rs.forEach((rule) => {
      const ing = recipe.ingredients.find((x) => hitRule(rule, tk(x.name)));
      if (ing) out.push({ kind: rule.kind, label: rule.label, ing: ing.name });
    });
    return out;
  };
  E.hasMeat = (recipe) => recipe.ingredients.some((i) => tk(i.name).some((t) => MEAT.includes(t) || FISH.includes(t) || SHELL.includes(t)));
  E.compatible = () => C.S.recipes.filter((r) => E.conflicts(r).length === 0);
  const likedCount = (recipe) =>
    C.S.settings.liked.filter((l) => {
      const need = tk(l);
      return hasAll(need, tk(recipe.name)) || recipe.ingredients.some((x) => hasAll(need, tk(x.name)));
    }).length;

  /* ---------- Promotions ---------- */
  E.pct = (p) => {
    if (p.regularPrice > 0 && p.promoPrice > 0 && p.promoPrice < p.regularPrice) return Math.round((1 - p.promoPrice / p.regularPrice) * 100);
    return p.discountPct > 0 && p.discountPct < 100 ? Math.round(p.discountPct) : 0;
  };
  const ratio = (p) => {
    if (p.regularPrice > 0 && p.promoPrice > 0 && p.promoPrice < p.regularPrice) return p.promoPrice / p.regularPrice;
    return p.discountPct > 0 && p.discountPct < 100 ? 1 - p.discountPct / 100 : 1;
  };
  E.promoState = (p, day) => {
    const d = day || C.today();
    if (p.validTo && p.validTo < d) return 'expired';
    if (p.validFrom && p.validFrom > d) return 'upcoming';
    return 'active';
  };
  // Promotions valables pendant la semaine donnée, dans les magasins fréquentés.
  E.activePromos = (wid) => {
    const a = wid;
    const b = C.dayIso(wid, 6);
    return C.S.promotions.filter((p) => C.S.settings.stores.includes(p.store) && (!p.validFrom || p.validFrom <= b) && (!p.validTo || p.validTo >= a));
  };
  // Mots-clés reliant une promotion aux ingrédients : « emince poulet|poitrine poulet ».
  // Une promotion synchronisée sans mot-clé n'est reliée à rien (produit non reconnu).
  const keys = (p) => {
    const src = p.match != null && p.match !== '' ? p.match : p.auto ? '' : p.name;
    return String(src).split('|').map(tk).filter((k) => k.length);
  };
  // Une promotion concerne un ingrédient si tous les mots d'un de ses mots-clés se retrouvent dans son nom.
  E.promoFor = (name, promos) => {
    const t = tk(name);
    const all = promos.filter((p) => keys(p).some((k) => hasAll(k, t)));
    if (!all.length) return null;
    all.sort((x, y) => ratio(x) - ratio(y));
    return { promo: all[0], ratio: ratio(all[0]), all };
  };
  E.recipesForPromo = (p) => {
    const ks = keys(p);
    if (!ks.length) return [];
    return C.S.recipes.filter((r) => r.ingredients.some((x) => ks.some((k) => hasAll(k, tk(x.name)))));
  };

  /* ---------- Coûts ---------- */
  E.recipeCost = (recipe, servings, promos) => {
    const f = (servings || recipe.servings || 1) / (recipe.servings || 1);
    const out = { regular: 0, cost: 0, savings: 0, lines: [], promoIngs: [], stores: [] };
    recipe.ingredients.forEach((ing) => {
      const reg = (Number(ing.price) || 0) * f;
      // Promotion désignée par l'IA à la génération (si elle est toujours valable), sinon correspondance par le nom.
      const forced = ing.promoId && promos && promos.find((p) => p.id === ing.promoId);
      const match = forced ? { promo: forced, ratio: ratio(forced), all: [forced] } : promos && promos.length ? E.promoFor(ing.name, promos) : null;
      const cost = match ? reg * match.ratio : reg;
      out.regular += reg;
      out.cost += cost;
      out.lines.push({ ing, qty: (Number(ing.qty) || 0) * f, reg, cost, match });
      if (match) {
        out.promoIngs.push({ ing, match });
        match.all.forEach((p) => !out.stores.includes(p.store) && out.stores.push(p.store));
      }
    });
    out.savings = out.regular - out.cost;
    return out;
  };

  function planLive(wid) {
    const out = { cost: 0, regular: 0, savings: 0, meals: 0, byCat: {}, slots: [] };
    const p = C.S.plans[wid];
    if (!p) return out;
    const promos = E.activePromos(wid);
    Object.entries(p.slots).forEach(([key, s]) => {
      const r = C.recipe(s.recipeId);
      if (!r) return;
      const c = E.recipeCost(r, s.servings, promos);
      out.meals++;
      out.cost += c.cost;
      out.regular += c.regular;
      out.savings += c.savings;
      c.lines.forEach((l) => {
        const k = l.ing.cat || 'autre';
        out.byCat[k] = (out.byCat[k] || 0) + l.cost;
      });
      out.slots.push({ key, d: Number(key[0]), slot: key.slice(2), cost: c.cost, savings: c.savings });
    });
    return out;
  }
  // Totaux d'une semaine. Pour les semaines passées, on reprend l'estimation figée à l'époque
  // (les promotions ont pu expirer ou être supprimées depuis).
  E.planTotals = (wid) => {
    const live = planLive(wid);
    const p = C.S.plans[wid];
    if (p && p.est && wid < C.weekId()) {
      const k = live.cost > 0 ? p.est.cost / live.cost : 1;
      return {
        ...live,
        cost: p.est.cost,
        regular: p.est.regular,
        savings: p.est.savings,
        slots: live.slots.map((s) => ({ ...s, savings: live.cost > 0 ? p.est.savings * (s.cost / live.cost) : 0, cost: s.cost * k })),
      };
    }
    return live;
  };
  E.refreshEstimates = () => {
    const now = C.weekId();
    Object.values(C.S.plans).forEach((p) => {
      if (p.id < now) return;
      const t = planLive(p.id);
      const est = { cost: +t.cost.toFixed(2), regular: +t.regular.toFixed(2), savings: +t.savings.toFixed(2), meals: t.meals };
      if (JSON.stringify(est) !== JSON.stringify(p.est || null)) {
        p.est = est;
        C.db.put('plans', p);
      }
    });
  };

  /* ---------- Génération d'une proposition de planning ----------
     Parcourt les cases libres et choisit à chaque fois la recette au meilleur score :
       + économies réalisées grâce aux promotions de la semaine
       + ingrédients frais déjà achetés pour un autre repas (anti-gaspillage)
       + favoris et aliments appréciés
       − répétitions, même catégorie deux fois de suite
       − coût, pondéré plus fortement quand le budget hebdomadaire est sous pression */
  const FRESH = ['fl', 'vp', 'lait'];
  E.generate = (wid, opts = {}) => {
    const st = C.S.settings;
    const pool = E.compatible();
    if (!pool.length) return { error: 'Aucune recette ne correspond à vos préférences. Ajoutez des recettes ou assouplissez les réglages.' };
    const promos = E.activePromos(wid);
    const people = st.household || 2;
    const info = new Map(
      pool.map((r) => [
        r.id,
        {
          c: E.recipeCost(r, people, promos),
          fresh: r.ingredients.filter((x) => FRESH.includes(x.cat)).map((x) => ({ key: tk(x.name).join(' '), name: x.name })),
          liked: likedCount(r),
        },
      ])
    );

    const plan = C.plan(wid);
    const firstDay = wid === C.weekId() ? (new Date().getDay() + 6) % 7 : 0; // on ne touche pas aux jours passés
    if (opts.replace) {
      Object.keys(plan.slots).forEach((k) => {
        if (Number(k[0]) >= firstDay) delete plan.slots[k];
      });
    }

    const used = {};
    const freshUsed = new Set();
    let running = 0;
    let count = 0;
    Object.values(plan.slots).forEach((s) => {
      const r = C.recipe(s.recipeId);
      if (!r) return;
      used[r.id] = (used[r.id] || 0) + 1;
      r.ingredients.filter((x) => FRESH.includes(x.cat)).forEach((x) => freshUsed.add(tk(x.name).join(' ')));
      running += E.recipeCost(r, s.servings, promos).cost;
      count++;
    });

    const perMeal = st.weeklyBudget > 0 ? st.weeklyBudget / 14 : 0;
    let filled = 0;
    let prev = null;
    for (let d = firstDay; d < 7; d++) {
      for (const slot of C.SLOTS) {
        const key = `${d}-${slot}`;
        if (plan.slots[key]) {
          prev = C.recipe(plan.slots[key].recipeId) || prev;
          continue;
        }
        const other = plan.slots[`${d}-${slot === 'midi' ? 'soir' : 'midi'}`];
        const pressure = perMeal && running > perMeal * count ? 2.2 : 0.8;
        let best = null;
        pool.forEach((r) => {
          const n = info.get(r.id);
          const shared = n.fresh.filter((x) => freshUsed.has(x.key));
          let score = 2.2 * n.c.savings + 1.2 * n.c.promoIngs.length + Math.min(shared.length, 3) + (r.favorite ? 0.8 : 0) + 1.2 * n.liked + (r.validated ? 1.2 : 0);
          score -= 7 * (used[r.id] || 0);
          if (prev && prev.category === r.category) score -= 1.5;
          if (other && other.recipeId === r.id) score -= 100;
          if (slot === 'midi') score += r.prepTime <= 30 ? 0.8 : r.prepTime > 45 ? -0.8 : 0;
          if (perMeal) score -= pressure * (n.c.cost / perMeal);
          score += Math.random() * 0.6; // léger aléa : relancer donne une variante
          if (!best || score > best.score) best = { r, n, shared, score };
        });
        const { r, n, shared } = best;
        const why = [];
        if (n.c.promoIngs.length) why.push(`${n.c.promoIngs.length} ingrédient${n.c.promoIngs.length > 1 ? 's' : ''} en promotion${n.c.savings >= 0.05 ? ` (−${C.chf(n.c.savings)})` : ''}`);
        if (shared.length) why.push(`réutilise ${shared.slice(0, 3).map((x) => x.name.toLowerCase()).join(', ')}`);
        if (r.favorite) why.push('recette favorite');
        if (n.liked) why.push('contient un aliment apprécié');
        if (slot === 'midi' && r.prepTime <= 30) why.push(`rapide (${r.prepTime} min)`);
        plan.slots[key] = { recipeId: r.id, servings: people, why, auto: true };
        used[r.id] = (used[r.id] || 0) + 1;
        n.fresh.forEach((x) => freshUsed.add(x.key));
        running += n.c.cost;
        count++;
        filled++;
        prev = r;
      }
    }
    C.db.put('plans', plan);
    C.changed();
    return { filled, pool: pool.length, promos: promos.length };
  };

  /* ---------- Liste de courses ---------- */
  /* ---------- Frigo ----------
     Un aliment du frigo correspond à un ingrédient si tous les mots de l'ingrédient se retrouvent
     dans son nom (« Crème entière » ↔ « Crème entière UHT Valflora »). */
  E.fridgeFor = (ingName) => {
    const need = tk(ingName);
    if (!need.length) return null;
    return C.S.fridge.find((f) => hasAll(need, tk(`${f.name} ${f.generic || ''}`))) || null;
  };
  E.expiresIn = (f) => (f.expires ? Math.round((C.parse(f.expires) - C.parse(C.today())) / 864e5) : null);

  E.shopping = (wid) => {
    const plan = C.S.plans[wid];
    const list = C.S.lists[wid] || { checked: {}, manual: [] };
    const promos = E.activePromos(wid);
    const map = new Map();
    if (plan) {
      Object.values(plan.slots).forEach((s) => {
        const r = C.recipe(s.recipeId);
        if (!r) return;
        const f = (s.servings || r.servings) / (r.servings || 1);
        r.ingredients.forEach((ing) => {
          const b = C.toBase((Number(ing.qty) || 0) * f, ing.unit);
          const key = tk(ing.name).join(' ') + '|' + b.unit;
          let it = map.get(key);
          if (!it) map.set(key, (it = { key, name: ing.name, qty: 0, unit: b.unit, cat: ing.cat || 'autre', regular: 0, recipes: [] }));
          it.qty += b.qty;
          it.regular += (Number(ing.price) || 0) * f;
          if (!it.recipes.includes(r.name)) it.recipes.push(r.name);
        });
      });
    }
    const WHOLE = ['pièce', 'boîte', 'sachet', 'botte']; // on n'achète pas une demi-boîte : arrondi à l'unité supérieure
    const items = [...map.values()].map((it) => {
      if (WHOLE.includes(it.unit)) it.qty = Math.ceil(it.qty - 1e-9);
      const match = E.promoFor(it.name, promos);
      return { ...it, match, cost: match ? it.regular * match.ratio : it.regular, stores: match ? [...new Set(match.all.map((p) => p.store))] : [] };
    });
    (list.manual || []).forEach((m) =>
      items.push({ key: 'm:' + m.id, manual: m, name: m.name, qty: Number(m.qty) || 0, unit: m.unit || 'pièce', cat: m.cat || 'autre', regular: Number(m.price) || 0, cost: Number(m.price) || 0, recipes: [], stores: m.store ? [m.store] : [], match: null })
    );
    items.forEach((it) => (it.checked = !!list.checked[it.key]));
    // Ce qui est déjà au frigo n'est pas compté dans le total (réglable sur la liste).
    const deduct = list.deductFridge !== false;
    items.forEach((it) => {
      it.inFridge = it.manual ? null : E.fridgeFor(it.name);
      if (it.inFridge && deduct) {
        it.cost = 0;
        it.regular = 0;
      }
    });
    items.sort((x, y) => x.name.localeCompare(y.name, 'fr'));
    const total = items.reduce((n, it) => n + it.cost, 0);
    const regular = items.reduce((n, it) => n + it.regular, 0);
    return { items, deduct, inFridge: items.filter((it) => it.inFridge).length, total, regular, savings: regular - total, done: items.filter((it) => it.checked).length, left: items.filter((it) => !it.checked).reduce((n, it) => n + it.cost, 0) };
  };

  /* ---------- Budget ---------- */
  E.weekSpent = (wid) => {
    const end = C.dayIso(wid, 6);
    return C.S.expenses.filter((e) => e.date >= wid && e.date <= end).reduce((n, e) => n + (Number(e.amount) || 0), 0);
  };
  E.history = (n) => {
    const now = C.weekId();
    const out = [];
    for (let k = n - 1; k >= 0; k--) {
      const wid = C.shiftWeek(now, -k);
      const t = E.planTotals(wid);
      out.push({ wid, label: 'S' + C.weekNo(wid), planned: t.cost, savings: t.savings, spent: E.weekSpent(wid), meals: t.meals });
    }
    return out;
  };
  E.month = (date) => {
    const d = date || new Date();
    const prefix = C.iso(d).slice(0, 7);
    let planned = 0;
    let savings = 0;
    Object.keys(C.S.plans).forEach((wid) => {
      E.planTotals(wid).slots.forEach((s) => {
        if (C.dayIso(wid, s.d).startsWith(prefix)) {
          planned += s.cost;
          savings += s.savings;
        }
      });
    });
    const spent = C.S.expenses.filter((e) => e.date.startsWith(prefix)).reduce((n, e) => n + (Number(e.amount) || 0), 0);
    return { planned, savings, spent, budget: ((C.S.settings.weeklyBudget || 0) * 52) / 12 };
  };
})();
