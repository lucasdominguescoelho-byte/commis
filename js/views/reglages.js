/* Commis — Réglages : foyer, magasins, budget, préférences alimentaires, sauvegarde des données. */
(function () {
  'use strict';
  const C = window.C;
  const { esc, icon } = C;
  const E = C.eng;

  const tagBlock = (key, placeholder, suggestions) => {
    const list = C.S.settings[key];
    const rest = (suggestions || []).filter((s) => !list.some((x) => C.norm(x) === C.norm(s)));
    return `<form class="tag-add" data-tag="${key}"><input class="inp" name="v" placeholder="${placeholder}" aria-label="${placeholder}" autocomplete="off"><button class="btn btn--ghost" type="submit">Ajouter</button></form>
      ${list.length ? `<div class="tags">${list.map((v, i) => `<span class="tagx">${esc(v)}<button data-act="set.tagDel" data-k="${key}" data-i="${i}" aria-label="Retirer ${esc(v)}">${icon('x', 14)}</button></span>`).join('')}</div>` : ''}
      ${rest.length ? `<div class="chips" style="margin-top:2px">${rest.map((s) => `<button class="chip" style="height:30px;border-style:dashed" data-act="set.tagAdd" data-k="${key}" data-v="${esc(s)}">${icon('plus', 13)} ${esc(s)}</button>`).join('')}</div>` : ''}`;
  };
  const block = (title, text, content) => `<section class="set"><div class="set-l"><h2 class="h3">${title}</h2><p>${text}</p></div><div class="set-c">${content}</div></section>`;

  C.views.reglages = {
    render(root) {
      const st = C.S.settings;
      const pool = E.compatible().length;
      const total = C.S.recipes.length;
      const demoR = C.S.recipes.filter((r) => r.demo).length;
      const demoP = C.S.promotions.filter((p) => p.demo).length;
      root.innerHTML = `
        <header class="head"><div><p class="eyebrow">Personnalisation</p><h1 class="title">Réglages</h1>
          <p class="lede">Ces choix orientent les suggestions de recettes, la proposition de planning et les calculs de budget. <b style="color:var(--ink)">${pool} recette${pool > 1 ? 's' : ''} sur ${total}</b> ${pool > 1 ? 'respectent' : 'respecte'} actuellement vos préférences.</p></div>
          <div class="head-a"><button class="btn btn--ghost" data-act="set.onboard">${icon('wand', 18)} Revoir le questionnaire</button></div></header>

        ${block('Foyer', 'Nombre de personnes à table. Les quantités et les coûts des nouveaux repas planifiés sont calculés pour ce nombre.',
          `<div><div class="step"><button data-act="set.people" data-d="-1" aria-label="Moins">${icon('minus', 16)}</button><b>${st.household}</b><button data-act="set.people" data-d="1" aria-label="Plus">${icon('plus', 16)}</button><span>personne${st.household > 1 ? 's' : ''}</span></div></div>`)}

        ${block('Apparence', 'Le mode nuit assombrit l’app et la cuisine 3D, avec une lumière chaude de lampe. En automatique, il s’allume de 20 h à 7 h.',
          `<div class="chips">${[['jour', 'Jour'], ['nuit', 'Nuit'], ['auto', 'Automatique']].map(([id, label]) => `<button class="chip ${(st.theme || 'jour') === id ? 'is-on' : ''}" data-act="set.theme" data-v="${id}" aria-pressed="${(st.theme || 'jour') === id}">${label}</button>`).join('')}</div>`)}

        ${block('Magasins fréquentés', 'Seules les promotions de ces enseignes comptent dans les coûts, la liste de courses et le planning proposé.',
          `<div class="chips">${C.STORES.map((s) => `<button class="chip ${st.stores.includes(s.id) ? 'is-on' : ''}" data-act="set.store" data-v="${s.id}" aria-pressed="${st.stores.includes(s.id)}"><i style="background:${s.color}"></i>${s.name}</button>`).join('')}</div>`)}

        ${block('Ustensiles', 'Les recettes générées n’utilisent que ce que vous avez : avec un air fryer, une mijoteuse ou une cocotte-minute, Commis propose des plats et des étapes adaptés.',
          `<div class="chips">${C.TOOLS.map((t) => `<button class="chip ${st.tools.includes(t.id) ? 'is-on' : ''}" data-act="set.tool" data-v="${t.id}" aria-pressed="${st.tools.includes(t.id)}">${t.name}</button>`).join('')}</div>
           <p class="small muted">${C.cuisine.possible(st.tools).length} types de plats possibles avec cet équipement.</p>`)}

        ${block('Budget hebdomadaire', 'Sert de repère sur l’accueil, le planning et la page Budget. La proposition de planning évite les repas chers lorsque le budget est sous pression.',
          `<div class="form-2" style="max-width:420px">${C.field('Montant par semaine (CHF)', `<input class="inp" inputmode="decimal" value="${st.weeklyBudget || ''}" placeholder="Ex. 160" data-change="set.budget">`)}<div class="field"><span>Équivalent mensuel</span><div class="inp" style="display:flex;align-items:center;background:transparent;color:var(--ink-2)">${st.weeklyBudget > 0 ? C.chf((st.weeklyBudget * 52) / 12) : '—'}</div></div></div>`)}

        ${block('Régime alimentaire', 'Les recettes contenant un ingrédient exclu sont signalées dans la bibliothèque et écartées du planning proposé. « Moins de viande » n’exclut rien : il limite la viande à quelques repas par semaine.',
          `<div class="chips">${Object.entries(E.DIETS).map(([id, d]) => `<button class="chip ${st.diets.includes(id) ? 'is-on' : ''}" data-act="set.diet" data-v="${id}" aria-pressed="${st.diets.includes(id)}">${d.label}</button>`).join('')}</div>`)}

        ${block('Allergies et restrictions', 'Écartées strictement des suggestions.', tagBlock('allergies', 'Ex. arachides', E.ALLERGEN_SUGGESTIONS) +
          `<div class="note">${icon('info', 18)}<span>La détection repose sur le <b>nom des ingrédients</b> de vos recettes. Elle peut manquer un allergène caché dans un produit transformé : vérifiez toujours les étiquettes.</span></div>`)}

        ${block('Aliments appréciés', 'Les recettes qui en contiennent remontent dans la proposition de planning.', tagBlock('liked', 'Ex. courge, saumon'))}

        ${block('Aliments évités', 'Les recettes qui en contiennent ne sont jamais proposées. Une catégorie compte pour tout ce qu’elle contient : « Poisson » écarte saumon, thon, cabillaud…, « Volaille » le poulet, la dinde…', tagBlock('avoided', 'Ex. poisson, champignons', E.AVOID_SUGGESTIONS))}

        ${block('Données', C.noStorage ? 'Le stockage local est indisponible dans ce navigateur (navigation privée ?). Rien ne sera conservé à la fermeture.' : `Tout est enregistré dans ce navigateur, sur cet appareil (IndexedDB)${C.persisted ? ', en stockage persistant' : ''}. Rien n’est envoyé sur Internet, sauf les codes-barres cherchés dans Open Food Facts. Les recettes générées et la lecture des tickets se font sur l’appareil. Faites une sauvegarde de temps en temps : vider les données du navigateur efface aussi Commis.`,
          `<div class="head-a"><button class="btn" data-act="set.export">${icon('download', 18)} Exporter une sauvegarde</button><button class="btn btn--ghost" data-act="set.import">${icon('upload', 18)} Restaurer une sauvegarde</button></div>
           <p class="small muted">${total} recettes · ${C.S.promotions.length} promotions · ${Object.values(C.S.plans).filter((p) => Object.keys(p.slots).length).length} semaines planifiées · ${C.S.expenses.length} dépenses</p>
           ${demoR ? `<div class="head-a">${demoR ? `<button class="btn btn--ghost btn--sm" data-act="set.clearDemoRecipes">Retirer les ${demoR} recettes d’exemple</button>` : ''}</div>` : ''}
           <div><button class="link" style="color:var(--danger)" data-act="set.reset">Tout effacer et repartir de zéro</button></div>`)}`;

      root.querySelectorAll('form[data-tag]').forEach((form) => {
        form.onsubmit = (e) => {
          e.preventDefault();
          addTag(form.dataset.tag, form.elements.v.value);
        };
      });
    },
  };

  function addTag(key, raw) {
    const list = C.S.settings[key];
    const values = String(raw).split(',').map((s) => s.trim()).filter((s) => s && !list.some((x) => C.norm(x) === C.norm(s)));
    if (values.length) C.save.settings({ [key]: [...list, ...values] });
  }
  const toggle = (key, v) => {
    const list = C.S.settings[key];
    C.save.settings({ [key]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v] });
  };

  Object.assign(C.acts, {
    'set.theme': (el) => C.save.settings({ theme: el.dataset.v }),
    'set.people': (el) => C.save.settings({ household: Math.max(1, Math.min(12, C.S.settings.household + Number(el.dataset.d))) }),
    'set.store': (el) => toggle('stores', el.dataset.v),
    'set.diet': (el) => C.save.settings({ diets: E.toggleDiet(C.S.settings.diets, el.dataset.v) }),
    'set.tool': (el) => toggle('tools', el.dataset.v),
    'set.budget': (el) => C.save.settings({ weeklyBudget: Math.max(0, Math.round(C.toNum(el.value) * 100) / 100) }),
    'set.tagAdd': (el) => addTag(el.dataset.k, el.dataset.v),
    'set.tagDel': (el) => C.save.settings({ [el.dataset.k]: C.S.settings[el.dataset.k].filter((_, i) => i !== Number(el.dataset.i)) }),
    'set.export': () => {
      C.download(`commis-sauvegarde-${C.today()}.json`, JSON.stringify(C.exportData(), null, 2), 'application/json');
      C.toast('Sauvegarde exportée');
    },
    'set.import': async () => {
      const file = await C.pickFile('.json,application/json');
      if (!file) return;
      let data;
      try {
        data = JSON.parse(await file.text());
      } catch (e) {
        return C.toast('Fichier illisible : ce n’est pas du JSON valide.');
      }
      if (data && data.app === 'commis-recettes') return C.toast('Ce fichier contient des recettes : importez-le depuis Recettes › Importer.');
      if (!data || data.app !== 'cabas') return C.toast('Ce fichier n’est pas une sauvegarde Commis.');
      if (!(await C.confirm('Restaurer cette sauvegarde ?', `Les données actuelles seront remplacées par celles du ${C.esc(new Date(data.exportedAt || Date.now()).toLocaleDateString('fr-CH'))} (${(data.recipes || []).length} recettes, ${(data.promotions || []).length} promotions).`, 'Restaurer'))) return;
      try {
        await C.importData(data);
        C.toast('Sauvegarde restaurée');
      } catch (e) {
        C.toast(e.message);
      }
    },
    'set.clearDemoRecipes': async () => {
      if (!(await C.confirm('Retirer les recettes d’exemple ?', 'Les recettes fournies à l’installation seront supprimées, ainsi que les repas planifiés qui les utilisent. Vos propres recettes — et celles que vous avez modifiées — sont conservées.', 'Retirer les exemples'))) return;
      C.removeDemo('recipes');
      C.toast('Recettes d’exemple retirées');
    },
    'set.reset': async () => {
      if (!(await C.confirm('Tout effacer ?', 'Recettes, promotions, plannings, listes, dépenses et réglages seront supprimés définitivement de cet appareil. Pensez à exporter une sauvegarde avant.', 'Tout effacer'))) return;
      C.resetAll();
    },
  });
})();
