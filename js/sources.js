/* Commis — promotions réelles.

   Le fichier data/promotions.json est produit par outils/promotions.py, lancé
   chaque jour par GitHub Actions (voir .github/workflows/promotions.yml) :
     - Lidl   : site officiel lidl.ch, en français
     - Migros : aktionis.ch (agrégateur), noms traduits de l'allemand
     - Coop   : aktionis.ch, idem
   L'application lit ce fichier au démarrage (et sur « Actualiser »), puis garde
   les promotions dans IndexedDB pour fonctionner hors ligne.

   Les promotions saisies à la main ou importées ne sont jamais touchées par la
   synchronisation. On peut aussi importer un fichier JSON au même format :

     {
       "name": "Filet de saumon",          // obligatoire
       "store": "lidl",                    // migros | coop | lidl
       "category": "vp",                   // fl | vp | lait | epi | boul | surg | bois | autre
       "promoPrice": 9.99,                 // obligatoire, sauf si discountPct est donné
       "regularPrice": 13.99,              // facultatif
       "discountPct": 30,                  // facultatif (rabais en %, quand le prix varie selon l'article)
       "unitLabel": "500 g",
       "validFrom": "2026-11-12",          // AAAA-MM-JJ
       "validTo": "2026-11-18",
       "match": "saumon",                  // mot(s)-clé(s) reliant la promo aux ingrédients, « a|b » pour plusieurs
       "photo": "https://…",
       "externalId": "abc-123"             // évite les doublons d'une synchronisation à l'autre
     }
*/
(function () {
  'use strict';
  const C = window.C;
  const FICHIER = 'data/promotions.json';
  const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
  const txt = (v, max) => String(v == null ? '' : v).trim().slice(0, max || 200);

  C.sources = {
    // Valide et met au format interne un tableau de promotions externes.
    normalize(raw, source) {
      const ok = [];
      const errors = [];
      const auto = source === 'auto';
      (Array.isArray(raw) ? raw : []).forEach((p, n) => {
        const name = txt(p && p.name, 120);
        const store = C.norm(p && p.store);
        const promoPrice = C.toNum(p && p.promoPrice) || null;
        const discountPct = Math.round(C.toNum(p && p.discountPct)) || null;
        if (!name || !C.storeById(store) || !(promoPrice > 0 || (discountPct > 0 && discountPct < 100))) {
          errors.push(`Ligne ${n + 1} ignorée (nom, magasin ou prix manquant)`);
          return;
        }
        ok.push({
          id: p.externalId ? 'x-' + C.norm(source + ' ' + p.externalId).replace(/ /g, '-') : C.uid(),
          name,
          origName: txt(p.origName, 160),
          brand: txt(p.brand, 60),
          store,
          category: C.CATS.some((c) => c.id === p.category) ? p.category : 'autre',
          promoPrice,
          regularPrice: C.toNum(p.regularPrice) || null,
          discountPct,
          unitLabel: txt(p.unitLabel, 40),
          validFrom: isDate(p.validFrom) ? p.validFrom : '',
          validTo: isDate(p.validTo) ? p.validTo : '',
          approxDates: !!p.approxDates,
          match: p.match == null ? (auto ? '' : name) : txt(p.match, 200),
          photo: /^https:\/\//.test(p.photo || '') ? txt(p.photo, 600) : '',
          url: /^https:\/\//.test(p.url || '') ? txt(p.url, 600) : '',
          note: txt(p.note, 120),
          auto,
          demo: false,
          source,
        });
      });
      return { ok, errors };
    },

    // Remplace les promotions synchronisées par le contenu de data/promotions.json.
    async sync(force) {
      if (location.protocol === 'file:') return { skipped: 'file' };
      let data;
      try {
        const res = await fetch(FICHIER + '?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        data = await res.json();
      } catch (e) {
        return { error: navigator.onLine === false ? 'hors ligne' : 'fichier des promotions introuvable' };
      }
      const meta = C.S.settings.promoMeta || {};
      if (!force && meta.generatedAt === data.generatedAt) return { unchanged: true };
      const { ok } = C.sources.normalize(data.promotions, 'auto');
      const keep = C.S.promotions.filter((p) => !p.auto && !p.demo);
      const gone = C.S.promotions.filter((p) => p.auto || p.demo);
      gone.forEach((p) => C.db.del('promotions', p.id));
      C.S.promotions = keep;
      C.save.promos(ok);
      C.save.settings({ promoMeta: { generatedAt: data.generatedAt, sources: data.sources || {}, syncedAt: new Date().toISOString() } });
      return { added: ok.length };
    },
  };
})();
