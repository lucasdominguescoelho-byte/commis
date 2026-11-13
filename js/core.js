/* Commis — socle : constantes, utilitaires, stockage local (IndexedDB), état.
   Tout est exposé sur window.C. Aucun appel réseau : les données restent dans le navigateur. */
(function () {
  'use strict';
  const C = (window.C = {});
  C.APP = 'Commis'; // nom affiché de l'application (logo, titres, messages)
  C.views = {}; // pages, enregistrées par js/views/*.js
  C.acts = {}; // actions déclenchées par les attributs data-act / data-input / data-change

  /* ---------- Constantes ---------- */
  C.STORES = [
    { id: 'migros', name: 'Migros', color: '#F07C1F' },
    { id: 'coop', name: 'Coop', color: '#D62F2F' },
    { id: 'lidl', name: 'Lidl', color: '#E9C21A' },
  ];
  C.storeById = (id) => C.STORES.find((s) => s.id === id);

  // Rayons : servent aux promotions, aux ingrédients et au classement de la liste de courses.
  C.CATS = [
    { id: 'fl', name: 'Fruits & légumes', hue: 135 },
    { id: 'vp', name: 'Viande & poisson', hue: 20 },
    { id: 'lait', name: 'Laitages & œufs', hue: 85 },
    { id: 'epi', name: 'Épicerie', hue: 55 },
    { id: 'boul', name: 'Boulangerie', hue: 65 },
    { id: 'surg', name: 'Surgelés', hue: 220 },
    { id: 'bois', name: 'Boissons', hue: 250 },
    { id: 'autre', name: 'Autre', hue: 300 },
  ];
  C.catById = (id) => C.CATS.find((c) => c.id === id) || C.CATS[C.CATS.length - 1];

  C.RCATS = [
    { name: 'Pâtes & riz', hue: 75 },
    { name: 'Viande', hue: 25 },
    { name: 'Poisson', hue: 215 },
    { name: 'Végétarien', hue: 140 },
    { name: 'Soupe', hue: 55 },
    { name: 'Salade', hue: 120 },
    { name: 'Gratin & four', hue: 40 },
    { name: 'Burgers & wraps', hue: 10 },
    { name: 'Petit-déjeuner', hue: 48 },
    { name: 'Autre', hue: 300 },
  ];
  // Ustensiles de cuisine : les recettes générées n'utilisent que ceux cochés dans Réglages.
  C.TOOLS = [
    { id: 'plaques', name: 'Plaques de cuisson' },
    { id: 'four', name: 'Four' },
    { id: 'airfryer', name: 'Air fryer' },
    { id: 'micro', name: 'Micro-ondes' },
    { id: 'blender', name: 'Mixeur / blender' },
    { id: 'mijoteuse', name: 'Mijoteuse' },
    { id: 'cocotte', name: 'Cocotte-minute' },
    { id: 'wok', name: 'Wok' },
    { id: 'cuiseur-riz', name: 'Cuiseur à riz' },
  ];
  C.UNITS = ['g', 'kg', 'ml', 'dl', 'l', 'pièce', 'c. à soupe', 'c. à café', 'gousse', 'tranche', 'botte', 'boîte', 'sachet', 'pincée', 'poignée'];
  C.DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  C.DAYS_S = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  C.SLOTS = ['midi', 'soir'];
  C.SLOT_LABEL = { midi: 'Midi', soir: 'Soir' };

  /* ---------- Texte ---------- */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  C.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  C.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const STOP = new Set(['de', 'du', 'des', 'd', 'la', 'le', 'les', 'l', 'a', 'au', 'aux', 'en', 'et', 'ou', 'un', 'une']);
  C.norm = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/œ/g, 'oe')
      .replace(/æ/g, 'ae')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  // Mots significatifs, au singulier approximatif : « Tomates pelées » → ['tomate','pelee']
  C.tokens = (s) =>
    C.norm(s)
      .split(' ')
      .filter((t) => t && !STOP.has(t))
      .map((t) => (t.length > 3 ? t.replace(/[sx]$/, '') : t));

  /* ---------- Dates (semaine du lundi au dimanche) ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  C.iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  C.parse = (s) => {
    const [y, m, d] = String(s).split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  C.addDays = (d, n) => {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() + n);
    return x;
  };
  C.monday = (d) => C.addDays(d, -((d.getDay() + 6) % 7));
  C.today = () => C.iso(new Date());
  C.weekId = (d) => C.iso(C.monday(d || new Date()));
  C.shiftWeek = (wid, n) => C.iso(C.addDays(C.parse(wid), 7 * n));
  C.dayIso = (wid, d) => C.iso(C.addDays(C.parse(wid), d));
  C.weekNo = (wid) => {
    const d = C.parse(wid);
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7) + 3);
    const f = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
    return 1 + Math.round(((t - f) / 864e5 - 3 + ((f.getUTCDay() + 6) % 7)) / 7);
  };
  const fMonth = new Intl.DateTimeFormat('fr-CH', { month: 'long' });
  const fMonthS = new Intl.DateTimeFormat('fr-CH', { month: 'short' });
  C.weekLabel = (wid) => {
    const a = C.parse(wid);
    const b = C.addDays(a, 6);
    if (a.getMonth() === b.getMonth()) return `${a.getDate()} – ${b.getDate()} ${fMonth.format(a)}`;
    return `${a.getDate()} ${fMonthS.format(a)} – ${b.getDate()} ${fMonthS.format(b)}`;
  };
  C.fmtDate = (iso, opts) => new Intl.DateTimeFormat('fr-CH', opts || { weekday: 'short', day: 'numeric', month: 'short' }).format(C.parse(iso));
  C.monthName = (d) => fMonth.format(d);

  /* ---------- Nombres, prix, quantités ---------- */
  const r05 = (n) => Math.round((Number(n) || 0) * 20) / 20;
  C.money = (n) => r05(n).toFixed(2);
  C.chf = (n) => `CHF ${r05(n).toFixed(2)}`;
  C.num = (n, max = 1) => Number(n).toLocaleString('fr-CH', { maximumFractionDigits: max });
  C.toNum = (v) => {
    const n = parseFloat(String(v == null ? '' : v).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };

  const BASE = { g: ['g', 1], kg: ['g', 1000], ml: ['ml', 1], cl: ['ml', 10], dl: ['ml', 100], l: ['ml', 1000] };
  C.toBase = (qty, unit) => {
    const b = BASE[unit];
    return b ? { qty: qty * b[1], unit: b[0] } : { qty, unit: unit || 'pièce' };
  };
  const UNIT_S = { 'pièce': 'pce', 'c. à soupe': 'c. à s.', 'c. à café': 'c. à c.' };
  const PLURAL = { gousse: 'gousses', tranche: 'tranches', botte: 'bottes', 'boîte': 'boîtes', sachet: 'sachets', 'pincée': 'pincées', 'poignée': 'poignées' };
  C.fmtQty = (qty, unit) => {
    if (!qty) return '';
    const { qty: q, unit: u } = C.toBase(qty, unit);
    if (u === 'g') return q >= 1000 ? `${C.num(q / 1000, 2)} kg` : `${C.num(Math.round(q), 0)} g`;
    if (u === 'ml') {
      if (q >= 1000) return `${C.num(q / 1000, 2)} l`;
      if (q >= 100) return `${C.num(q / 100, 1)} dl`;
      return `${C.num(Math.round(q), 0)} ml`;
    }
    const label = UNIT_S[u] || (q > 1 && PLURAL[u]) || u;
    return `${C.num(q, 1)} ${label}`;
  };

  /* ---------- IndexedDB ---------- */
  const DB_NAME = 'cabas'; // ne pas renommer : c'est sous ce nom que le navigateur retrouve les données existantes
  const DB_VERSION = 2; // v2 : table « fridge » (le frigo)
  const TABLES = ['recipes', 'promotions', 'plans', 'lists', 'expenses', 'kv', 'fridge'];
  let db = null;

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('IndexedDB indisponible'));
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        TABLES.forEach((t) => {
          if (!req.result.objectStoreNames.contains(t)) req.result.createObjectStore(t, { keyPath: 'id' });
        });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function tx(table, mode, fn) {
    if (!db) return Promise.resolve(mode === 'readonly' ? [] : undefined);
    return new Promise((resolve, reject) => {
      const t = db.transaction(table, mode);
      const req = fn(t.objectStore(table));
      t.oncomplete = () => resolve(req && req.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }
  const fail = (e) => {
    console.error('[Commis] écriture impossible', e);
    if (C.toast) C.toast("L'enregistrement a échoué — l'espace de stockage est peut-être plein.");
  };
  C.db = {
    all: (t) => tx(t, 'readonly', (o) => o.getAll()),
    put: (t, v) => tx(t, 'readwrite', (o) => o.put(v)).catch(fail),
    del: (t, id) => tx(t, 'readwrite', (o) => o.delete(id)).catch(fail),
    clear: (t) => tx(t, 'readwrite', (o) => o.clear()).catch(fail),
  };

  /* ---------- État ---------- */
  C.DEFAULT_SETTINGS = {
    id: 'settings',
    household: 2,
    stores: C.STORES.map((s) => s.id),
    weeklyBudget: 160,
    diets: [],
    allergies: [],
    liked: [],
    avoided: [],
    seeded: false,
    tools: ['plaques', 'four', 'micro', 'blender'],
    theme: 'jour', // 'jour', 'nuit' ou 'auto' (nuit de 20 h à 7 h)
    promoMeta: null, // dernière synchronisation des promotions (date, état de chaque source)
  };
  const S = (C.S = { settings: { ...C.DEFAULT_SETTINGS }, recipes: [], promotions: [], plans: {}, lists: {}, expenses: [], fridge: [] });
  C.ui = { week: C.weekId() }; // état d'interface, non persistant
  C.noStorage = false;
  C.persisted = null;

  C.recipe = (id) => S.recipes.find((r) => r.id === id);
  C.plan = (wid) => S.plans[wid] || (S.plans[wid] = { id: wid, slots: {} });
  C.list = (wid) => S.lists[wid] || (S.lists[wid] = { id: wid, checked: {}, manual: [] });

  async function readAll() {
    const [recipes, promotions, plans, lists, expenses, kv, fridge] = await Promise.all(TABLES.map((t) => C.db.all(t)));
    S.fridge = fridge || [];
    if ((kv || []).some((k) => k.id === 'secrets')) C.db.del('kv', 'secrets'); // ancienne clé d'API (fonction retirée)
    S.recipes = recipes || [];
    S.promotions = promotions || [];
    S.plans = Object.fromEntries((plans || []).map((p) => [p.id, p]));
    S.lists = Object.fromEntries((lists || []).map((l) => [l.id, l]));
    S.expenses = expenses || [];
    const st = (kv || []).find((k) => k.id === 'settings');
    S.settings = { ...C.DEFAULT_SETTINGS, ...(st || {}) };
  }

  C.load = async () => {
    try {
      db = await openDb();
    } catch (e) {
      console.warn('[Commis] stockage local indisponible, les données ne seront pas conservées', e);
      C.noStorage = true;
    }
    await readAll();

    // Premier lancement : recettes d'exemple. Les promotions, elles, viennent de data/promotions.json.
    if (!S.settings.seeded) {
      S.recipes = C.seed().recipes;
      S.settings.seeded = true;
      await Promise.all([...S.recipes.map((r) => C.db.put('recipes', r)), C.db.put('kv', S.settings)]);
    }
    C.migrate();

    // Demande au navigateur de ne pas purger les données automatiquement.
    if (navigator.storage && navigator.storage.persist) {
      try {
        C.persisted = (await navigator.storage.persisted()) || (await navigator.storage.persist());
      } catch (e) { /* sans importance */ }
    }
  };

  // Mises à jour des données enregistrées par une version précédente de Commis.
  C.migrate = () => {
    // Novembre 2026 : seuls Migros, Coop et Lidl restent ; les promotions fictives disparaissent.
    const valid = C.STORES.map((s) => s.id);
    const stores = (S.settings.stores || []).filter((id) => valid.includes(id));
    if (stores.length !== (S.settings.stores || []).length) {
      S.settings.stores = stores.length ? stores : valid;
      C.db.put('kv', S.settings);
    }
    S.promotions.filter((p) => p.demo || !valid.includes(p.store)).forEach((p) => C.db.del('promotions', p.id));
    S.promotions = S.promotions.filter((p) => !p.demo && valid.includes(p.store));
    if (!Array.isArray(S.settings.tools)) {
      S.settings.tools = C.DEFAULT_SETTINGS.tools.slice();
      C.db.put('kv', S.settings);
    }
    // Novembre 2026 : l'onglet Recettes ne montre que les recettes testées et validées.
    // Les exemples passent « à tester » ; les recettes écrites à la main sont considérées validées.
    S.recipes.forEach((r) => {
      if (typeof r.validated !== 'boolean') {
        r.validated = !r.demo && r.source !== 'ia';
        C.db.put('recipes', r);
      }
    });
    // Novembre 2026 : « À tester » ne contient que les recettes qu'on y met soi-même (toTest).
    // Exemples et recettes importées d'un livre n'y sont pas : on les trouve dans « Toutes ».
    S.recipes.forEach((r) => {
      if (typeof r.toTest !== 'boolean') {
        r.toTest = !r.validated && !r.demo && !['livre-perso', 'wikilivres'].includes(r.source);
        C.db.put('recipes', r);
      }
    });
    // Photos ajoutées aux recettes d'exemple : seulement si la recette n'en a pas déjà une.
    const photos = C.SEED_PHOTOS || {};
    S.recipes.forEach((r) => {
      if (!r.photo && photos[r.id]) {
        r.photo = photos[r.id];
        C.db.put('recipes', r);
      }
    });
  };

  C.changed = () => {
    if (C.eng) C.eng.refreshEstimates();
    if (C.render) C.render();
  };

  const upsert = (arr, item) => {
    const i = arr.findIndex((x) => x.id === item.id);
    if (i >= 0) arr[i] = item;
    else arr.push(item);
  };

  C.save = {
    settings(patch) {
      Object.assign(S.settings, patch);
      C.db.put('kv', S.settings);
      C.changed();
    },
    recipe(r) {
      upsert(S.recipes, r);
      C.db.put('recipes', r);
      C.changed();
    },
    delRecipe(id) {
      S.recipes = S.recipes.filter((r) => r.id !== id);
      C.db.del('recipes', id);
      Object.values(S.plans).forEach((p) => {
        let hit = false;
        Object.keys(p.slots).forEach((k) => {
          if (p.slots[k].recipeId === id) {
            delete p.slots[k];
            hit = true;
          }
        });
        if (hit) C.db.put('plans', p);
      });
      C.changed();
    },
    promo(p) {
      upsert(S.promotions, p);
      C.db.put('promotions', p);
      C.changed();
    },
    promos(list) {
      list.forEach((p) => {
        upsert(S.promotions, p);
        C.db.put('promotions', p);
      });
      C.changed();
    },
    delPromo(id) {
      S.promotions = S.promotions.filter((p) => p.id !== id);
      C.db.del('promotions', id);
      C.changed();
    },
    plan(wid, fn) {
      const p = C.plan(wid);
      fn(p.slots, p);
      C.db.put('plans', p);
      C.changed();
    },
    list(wid, fn) {
      const l = C.list(wid);
      fn(l);
      C.db.put('lists', l);
      C.changed();
    },
    expense(e) {
      upsert(S.expenses, e);
      C.db.put('expenses', e);
      C.changed();
    },
    delExpense(id) {
      S.expenses = S.expenses.filter((e) => e.id !== id);
      C.db.del('expenses', id);
      C.changed();
    },
  };

  /* ---------- Frigo ---------- */
  Object.assign(C.save, {
    fridge(item) {
      upsert(S.fridge, item);
      C.db.put('fridge', item);
      C.changed();
    },
    fridgeMany(items) {
      items.forEach((it) => {
        upsert(S.fridge, it);
        C.db.put('fridge', it);
      });
      C.changed();
    },
    delFridge(id) {
      S.fridge = S.fridge.filter((x) => x.id !== id);
      C.db.del('fridge', id);
      C.changed();
    },
  });

  /* ---------- Sauvegarde / restauration ---------- */
  C.exportData = () => ({
    app: 'cabas', // identifiant du format de sauvegarde
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: S.settings,
    recipes: S.recipes,
    promotions: S.promotions,
    plans: Object.values(S.plans),
    lists: Object.values(S.lists),
    expenses: S.expenses,
    fridge: S.fridge,
  });

  // Ajoute des recettes (fichier « commis-recettes » ou sauvegarde) sans rien effacer.
  // Une recette déjà présente (même identifiant, même origine) ne reçoit que sa nouvelle photo :
  // validation, favori, « à tester » et modifications sont conservés.
  C.recipesIn = (data) => (data && (data.app === 'commis-recettes' || data.app === 'cabas') && Array.isArray(data.recipes) ? data.recipes : null);
  C.photoUpdates = (list) =>
    list.filter((r) => {
      const cur = r && r.id && r.photo && C.recipe(r.id);
      return cur && cur.source === r.source && cur.photo !== r.photo;
    });
  C.importRecipes = async (data) => {
    const list = C.recipesIn(data);
    if (!list) throw new Error("Ce fichier ne contient pas de recettes Commis.");
    const have = new Set(S.recipes.map((r) => r.id));
    const fresh = list.filter((r) => r && r.id && r.name && Array.isArray(r.ingredients) && Array.isArray(r.steps) && !have.has(r.id));
    const photos = C.photoUpdates(list);
    for (const r of fresh) {
      const rec = { favorite: false, validated: false, demo: false, createdAt: Date.now(), ...r, toTest: false };
      upsert(S.recipes, rec);
      await C.db.put('recipes', rec);
    }
    for (const r of photos) {
      const rec = { ...C.recipe(r.id), photo: r.photo };
      upsert(S.recipes, rec);
      await C.db.put('recipes', rec);
    }
    if (fresh.length || photos.length) C.changed();
    return { added: fresh.length, photos: photos.length, skipped: list.length - fresh.length - photos.length };
  };

  C.importData = async (data) => {
    if (!data || data.app !== 'cabas' || !Array.isArray(data.recipes)) throw new Error("Ce fichier n'est pas une sauvegarde Commis.");
    await Promise.all(TABLES.map((t) => C.db.clear(t)));
    const put = (t, arr) => Promise.all((arr || []).filter((x) => x && x.id).map((x) => C.db.put(t, x)));
    await Promise.all([
      put('recipes', data.recipes),
      put('promotions', data.promotions),
      put('plans', data.plans),
      put('lists', data.lists),
      put('expenses', data.expenses),
      put('fridge', data.fridge),
      C.db.put('kv', { ...C.DEFAULT_SETTINGS, ...(data.settings || {}), id: 'settings', seeded: true }),
    ]);
    if (db) await readAll();
    else {
      // Sans IndexedDB : on charge au moins en mémoire.
      S.recipes = data.recipes || [];
      S.promotions = data.promotions || [];
      S.plans = Object.fromEntries((data.plans || []).map((p) => [p.id, p]));
      S.lists = Object.fromEntries((data.lists || []).map((l) => [l.id, l]));
      S.expenses = data.expenses || [];
      S.fridge = data.fridge || [];
      S.settings = { ...C.DEFAULT_SETTINGS, ...(data.settings || {}), seeded: true };
    }
    C.changed();
  };

  C.resetAll = async () => {
    await Promise.all(TABLES.map((t) => C.db.clear(t)));
    location.hash = '#/accueil';
    location.reload();
  };

  C.removeDemo = (what) => {
    if (what === 'promotions' || what === 'all') {
      S.promotions.filter((p) => p.demo).forEach((p) => C.db.del('promotions', p.id));
      S.promotions = S.promotions.filter((p) => !p.demo);
    }
    if (what === 'recipes' || what === 'all') {
      S.recipes.filter((r) => r.demo).map((r) => r.id).forEach((id) => C.save.delRecipe(id));
    }
    C.changed();
  };
})();
