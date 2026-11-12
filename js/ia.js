/* Cabas — intelligence artificielle (Claude, d'Anthropic).

   Deux usages, uniquement quand on les demande :
     1. générer des recettes à partir des promotions du moment (et, si on le veut, du frigo) ;
     2. reconnaître les aliments sur une photo du frigo.

   Fonctionnement : le navigateur appelle directement l'API Claude avec la clé
   saisie dans Réglages. Cette clé reste sur l'appareil (IndexedDB, hors sauvegardes).
   Chaque appel est facturé sur le compte Anthropic de la clé : le coût approximatif
   est affiché après chaque génération. Sans clé, rien n'est envoyé nulle part. */
(function () {
  'use strict';
  const C = window.C;
  const E = C.eng;

  const SDK = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.3.0/+esm';
  const MODEL = 'claude-opus-5-5';
  const PRICE = { in: 4 / 1e6, out: 20 / 1e6 }; // USD par token (Claude Opus 5.5)

  let sdk = null;
  async function client() {
    const key = C.secret.get('anthropic');
    if (!key) throw new Error('Aucune clé d’API : ajoutez-la dans Réglages → Intelligence artificielle.');
    if (!sdk) sdk = (await import(SDK)).default;
    // Appel direct depuis le navigateur : acceptable ici car l'app est personnelle
    // et la clé est saisie par son propriétaire, sur son propre appareil.
    return new sdk({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 2 });
  }

  // Erreurs de l'API traduites en phrases utiles.
  function explain(e) {
    if (!sdk || !(e instanceof sdk.APIError)) return e && e.message ? e.message : String(e);
    if (e instanceof sdk.AuthenticationError) return 'Clé d’API refusée : vérifiez-la dans Réglages.';
    if (e instanceof sdk.PermissionDeniedError) return 'Cette clé n’a pas accès au modèle demandé.';
    if (e instanceof sdk.RateLimitError) return 'Trop de demandes d’un coup : réessayez dans une minute.';
    if (e instanceof sdk.BadRequestError) return /credit|balance|billing/i.test(e.message) ? 'Crédit épuisé sur le compte Anthropic : rechargez-le dans la console.' : 'Demande refusée par l’API : ' + e.message;
    if (e instanceof sdk.APIConnectionError) return 'Impossible de joindre l’API (connexion ?).';
    return `Erreur de l’API (${e.status || '?'}) : ${e.message}`;
  }

  // Appel générique : réponse JSON conforme au schéma demandé (sorties structurées).
  async function ask({ system, content, schema, effort, maxTokens }) {
    const api = await client();
    let res;
    try {
      res = await api.beta.messages.create({
        model: MODEL,
        max_tokens: maxTokens || 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default', // si le modèle décline, l'API relance la demande sur un modèle de repli
        output_config: { effort: effort || 'medium', format: { type: 'json_schema', schema } },
        system,
        messages: [{ role: 'user', content }],
      });
    } catch (e) {
      throw new Error(explain(e));
    }
    if (res.stop_reason === 'refusal') throw new Error('L’IA a décliné cette demande. Reformulez l’envie particulière et réessayez.');
    if (res.stop_reason === 'max_tokens') throw new Error('Réponse trop longue, interrompue : demandez moins d’idées à la fois.');
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error('Réponse illisible de l’IA, réessayez.');
    }
    const u = res.usage || {};
    const cost = (u.input_tokens || 0) * PRICE.in + (u.cache_read_input_tokens || 0) * PRICE.in * 0.1 + (u.output_tokens || 0) * PRICE.out;
    return { data, cost };
  }

  /* ---------- Schémas ---------- */
  const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
  const RECIPES_SCHEMA = obj({
    recipes: {
      type: 'array',
      items: obj({
        name: { type: 'string' },
        description: { type: 'string' },
        category: { type: 'string', enum: C.RCATS.map((c) => c.name) },
        prepTime: { type: 'integer' },
        servings: { type: 'integer' },
        why: { type: 'string', description: 'Une phrase : quelles promotions et quels aliments du frigo la recette met à profit.' },
        ingredients: {
          type: 'array',
          items: obj({
            name: { type: 'string' },
            qty: { type: 'number' },
            unit: { type: 'string', enum: C.UNITS },
            cat: { type: 'string', enum: C.CATS.map((c) => c.id) },
            price: { type: 'number', description: 'Prix habituel estimé en CHF pour la quantité utilisée' },
            promoId: { type: 'string', description: 'id de la promotion utilisée, ou chaîne vide' },
            frigo: { type: 'boolean', description: 'true si l’ingrédient vient du frigo' },
          }),
        },
        steps: { type: 'array', items: { type: 'string' } },
      }),
    },
  });
  const FRIDGE_SCHEMA = obj({
    items: {
      type: 'array',
      items: obj({
        name: { type: 'string', description: 'Nom générique en français, comme sur une liste de courses' },
        qty: { type: 'number' },
        unit: { type: 'string', enum: C.UNITS },
        cat: { type: 'string', enum: C.CATS.map((c) => c.id) },
        confidence: { type: 'string', enum: ['sure', 'probable', 'incertain'] },
      }),
    },
  });

  /* ---------- 1. Générer des recettes ---------- */
  const SYSTEM_RECIPES = `Tu es le cuisinier d'un foyer en Suisse romande. Tu proposes des recettes de tous les jours, simples, réalistes et bonnes, à cuisiner chez soi.

Règles :
- Tout en français (Suisse romande : CHF, dl, « poivron », « courgette »…).
- Construis chaque recette autour des produits en promotion fournis, en privilégiant ceux qui ont le plus gros rabais. Réutilise un même produit frais dans plusieurs recettes plutôt que d'en acheter un nouveau pour une seule.
- Si une liste d'aliments du frigo est fournie, utilise-les en priorité (frigo: true) et ne les rachète pas.
- Respecte strictement le régime, les allergies et les aliments évités : aucun ingrédient interdit, même en petite quantité.
- Nomme les ingrédients de façon générique, comme sur une liste de courses (« Émincé de poulet », « Crème entière », « Pommes de terre »), sans marque. Quand un ingrédient correspond à une promotion, indique son id dans promoId.
- Quantités pour le nombre de personnes demandé, avec les unités autorisées. Prix : estimation du prix habituel en supermarché suisse pour la quantité utilisée (pas le prix promo).
- 4 à 7 étapes claires, sans numéro. Temps de préparation réaliste en minutes.
- Ne propose pas un plat que la personne a déjà dans ses recettes.`;

  C.ia = {
    model: MODEL,
    ready: () => !!C.secret.get('anthropic'),

    async testKey(key) {
      if (!sdk) sdk = (await import(SDK)).default;
      const api = new sdk({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 0 });
      try {
        await api.models.retrieve(MODEL); // gratuit : vérifie juste la clé et l'accès au modèle
        return { ok: true };
      } catch (e) {
        return { ok: false, error: explain(e) };
      }
    },

    async recipes({ count, people, maxTime, wish, fridgeIds, usePromos }) {
      const st = C.S.settings;
      const wid = C.weekId();
      const promos = usePromos === false
        ? []
        : E.activePromos(wid)
            .filter((p) => E.promoState(p) !== 'expired' && ['vp', 'fl', 'lait', 'epi', 'boul', 'surg'].includes(p.category) && (p.match || !p.auto))
            .sort((a, b) => E.pct(b) - E.pct(a))
            .slice(0, 90);
      const fridge = C.S.fridge.filter((f) => (fridgeIds || []).includes(f.id));
      const prefs = [
        st.diets.length && `Régime : ${st.diets.map((d) => E.DIETS[d].label).join(', ')}`,
        st.allergies.length && `Allergies et restrictions (strict) : ${st.allergies.join(', ')}`,
        st.avoided.length && `Aliments évités : ${st.avoided.join(', ')}`,
        st.liked.length && `Aliments appréciés : ${st.liked.join(', ')}`,
      ].filter(Boolean);
      const lines = [
        `Propose ${count} recette${count > 1 ? 's' : ''} différente${count > 1 ? 's' : ''} pour ${people} personne${people > 1 ? 's' : ''}.`,
        maxTime ? `Temps de préparation maximum : ${maxTime} minutes.` : '',
        wish ? `Envie particulière : ${wish}` : '',
        prefs.length ? `Préférences du foyer :\n- ${prefs.join('\n- ')}` : 'Aucune restriction alimentaire.',
        fridge.length
          ? `Aliments du frigo à utiliser :\n${fridge.map((f) => `- ${f.name}${f.qty ? ` (${C.fmtQty(f.qty, f.unit)})` : ''}${E.expiresIn(f) != null && E.expiresIn(f) <= 3 ? ' — à consommer vite' : ''}`).join('\n')}`
          : '',
        promos.length
          ? `Promotions de la semaine (id | magasin | produit | prix | rabais) :\n${promos.map((p) => `${p.id} | ${C.storeById(p.store).name} | ${p.name}${p.origName && p.origName !== p.name ? ` (${p.origName})` : ''}${p.unitLabel ? `, ${p.unitLabel}` : ''} | ${p.promoPrice ? 'CHF ' + C.px(p.promoPrice) : 'prix variable'} | ${E.pct(p) ? '−' + E.pct(p) + '%' : 'prix bas'}`).join('\n')}`
          : 'Pas de promotion à prendre en compte.',
        `Recettes déjà connues (à ne pas reproposer) : ${C.S.recipes.map((r) => r.name).join(' ; ') || 'aucune'}.`,
      ].filter(Boolean);
      const { data, cost } = await ask({ system: SYSTEM_RECIPES, content: lines.join('\n\n'), schema: RECIPES_SCHEMA, effort: 'medium' });
      const ids = new Set(promos.map((p) => p.id));
      const recipes = (data.recipes || []).map((r) => ({
        id: C.uid(),
        name: String(r.name || 'Recette').slice(0, 120),
        description: String(r.description || ''),
        category: C.RCATS.some((c) => c.name === r.category) ? r.category : 'Autre',
        prepTime: Math.max(5, Math.round(r.prepTime) || 30),
        servings: Math.max(1, Math.round(r.servings) || people),
        why: String(r.why || ''),
        ingredients: (r.ingredients || []).filter((i) => i && i.name).map((i) => ({
          name: String(i.name).slice(0, 80),
          qty: Number(i.qty) || 0,
          unit: C.UNITS.includes(i.unit) ? i.unit : 'pièce',
          cat: C.CATS.some((c) => c.id === i.cat) ? i.cat : 'epi',
          price: Math.max(0, Math.round((Number(i.price) || 0) * 20) / 20),
          ...(i.promoId && ids.has(i.promoId) ? { promoId: i.promoId } : {}),
          ...(i.frigo ? { frigo: true } : {}),
        })),
        steps: (r.steps || []).map(String).filter(Boolean),
        favorite: false,
        photo: '',
        validated: false,
        source: 'ia',
        demo: false,
        createdAt: Date.now(),
      }));
      return { recipes, cost, promosUsed: promos.length, fridgeUsed: fridge.length };
    },

    /* ---------- 2. Reconnaître les aliments sur une photo ---------- */
    async recognize(dataUrl) {
      const [, mediaType, b64] = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.*)$/) || [];
      if (!b64) throw new Error('Image illisible.');
      const { data, cost } = await ask({
        system: 'Tu fais l’inventaire d’un frigo ou d’un placard en Suisse romande, à partir d’une photo. Liste uniquement les aliments réellement visibles, en français, avec un nom générique (« Yogourt nature », « Poivron rouge », « Jambon »). Estime la quantité visible. Ignore les objets qui ne sont pas des aliments. N’invente rien : si un contenant est opaque et sans étiquette lisible, ne le liste pas.',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
          { type: 'text', text: 'Quels aliments vois-tu sur cette photo ?' },
        ],
        schema: FRIDGE_SCHEMA,
        effort: 'low',
        maxTokens: 4000,
      });
      const items = (data.items || []).filter((i) => i && i.name).map((i) => ({
        name: String(i.name).slice(0, 80),
        qty: Number(i.qty) || 1,
        unit: C.UNITS.includes(i.unit) ? i.unit : 'pièce',
        cat: C.CATS.some((c) => c.id === i.cat) ? i.cat : 'autre',
        confidence: i.confidence,
      }));
      return { items, cost };
    },

    // Coût affiché en francs (approximation : 1 USD ≈ 0.80 CHF).
    fmtCost: (usd) => (usd * 0.8 < 0.01 ? 'moins d’un centime' : `≈ CHF ${(usd * 0.8).toFixed(2)}`),
  };
})();
