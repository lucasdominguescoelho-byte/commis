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
  // Synchronisation entre appareils (js/sync.js) : guide de mise en place, puis état
  const depuis = (ts) => {
    if (!ts) return 'jamais';
    const min = Math.round((Date.now() - ts) / 60000);
    if (min < 1) return 'à l’instant';
    if (min < 60) return `il y a ${min} min`;
    if (min < 24 * 60) return `il y a ${Math.round(min / 60)} h`;
    return C.fmtDate(C.iso(new Date(ts)), { day: 'numeric', month: 'long' });
  };
  function syncBlock() {
    const c = C.sync && C.sync.config();
    if (c) {
      const e = C.sync.etat();
      return `<p><b style="color:var(--ink)">${icon('check', 16)} Cet appareil est relié</b> au dépôt <b style="color:var(--ink)">${esc(c.repo.split('/')[1] || c.repo)}</b>.</p>
        <p class="small muted">Dernière synchronisation : ${depuis(e.last)}${e.count ? ` · ${e.count} éléments` : ''}. Elle se fait toute seule à l’ouverture, après chaque changement et toutes les 3 minutes.</p>
        ${e.error && (!e.last || e.errorAt > e.last) ? `<div class="note note--err">${icon('info', 18)}<span>${esc(e.error)}</span></div>` : ''}
        <div class="head-a"><button class="btn" data-act="set.syncNow">Synchroniser maintenant</button><button class="btn btn--ghost" data-act="set.syncOff">Délier cet appareil</button></div>
        <p class="small muted">Le jeton expire après un an : GitHub vous prévient par e-mail ; il suffira d’en créer un nouveau et de relier à nouveau les appareils.</p>`;
    }
    const repo = 'lucasdominguescoelho-byte/commis-donnees';
    return `<ol class="sync-steps">
        <li><b>Créer le dépôt privé</b> sur GitHub : nom <code>commis-donnees</code>, visibilité <b>Private</b>.
          <a class="link" href="https://github.com/new?name=commis-donnees&visibility=private" target="_blank" rel="noopener">Créer le dépôt ${icon('arrow', 14)}</a></li>
        <li><b>Créer un jeton d’accès</b> (une fois) : nom « Commis », expiration 1 an, <i>Repository access</i> › <i>Only select repositories</i> › <code>commis-donnees</code>, puis <i>Permissions</i> › <i>Contents</i> : <b>Read and write</b>. Copiez le jeton (il commence par <code>github_pat_</code>).
          <a class="link" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Créer le jeton ${icon('arrow', 14)}</a></li>
        <li><b>Le coller ici</b>, sur l’ordinateur puis sur le téléphone (le même jeton sert aux deux).</li>
      </ol>
      <form class="form" id="sync-form" autocomplete="off" style="max-width:520px">
        ${C.field('Dépôt', `<input class="inp" name="repo" value="${esc(repo)}" spellcheck="false" autocapitalize="off">`)}
        ${C.field('Jeton d’accès', `<input class="inp" name="token" type="password" placeholder="github_pat_…" spellcheck="false" autocapitalize="off" autocomplete="off">`)}
        <div class="head-a"><button class="btn btn--citron" type="submit">Relier cet appareil</button></div>
      </form>
      <p class="small muted">Le jeton reste dans ce navigateur : il n’est ni publié ni mis dans les sauvegardes, et il n’ouvre que ce dépôt.</p>`;
  }

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

        ${block('Apparence', 'Le mode nuit assombrit l’app et la cuisine 3D, avec une lumière chaude de lampe. En automatique, il suit le soleil : il s’allume au coucher et s’éteint au lever.',
          `<div class="chips">${[['jour', 'Jour'], ['nuit', 'Nuit'], ['auto', 'Automatique']].map(([id, label]) => `<button class="chip ${(st.theme || 'jour') === id ? 'is-on' : ''}" data-act="set.theme" data-v="${id}" aria-pressed="${(st.theme || 'jour') === id}">${label}</button>`).join('')}</div>
           ${(() => {
             const { rise, set } = C.sunTimes();
             const h = (d) => d.toLocaleTimeString('fr-CH', { hour: 'numeric', minute: '2-digit' }).replace(':', ' h ');
             return rise && set ? `<p class="small muted">Aujourd’hui en Suisse romande : lever du soleil à ${h(rise)}, coucher à ${h(set)}.</p>` : '';
           })()}`)}

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

        ${block('Synchronisation', 'Reliez votre ordinateur et votre téléphone : le frigo scanné, les tickets, le planning, les recettes et la liste de courses passent de l’un à l’autre. Gratuit : les données vont dans un dépôt privé de votre compte GitHub, chaque appareil continue de marcher hors ligne.', syncBlock())}

        ${block('Données', C.noStorage ? 'Le stockage local est indisponible dans ce navigateur (navigation privée ?). Rien ne sera conservé à la fermeture.' : `Tout est enregistré dans ce navigateur, sur cet appareil (IndexedDB)${C.persisted ? ', en stockage persistant' : ''}. Rien n’est envoyé sur Internet, sauf les codes-barres cherchés dans Open Food Facts. Les recettes générées et la lecture des tickets se font sur l’appareil. Faites une sauvegarde de temps en temps : vider les données du navigateur efface aussi Commis.`,
          `<div class="head-a"><button class="btn" data-act="set.export">${icon('download', 18)} Exporter une sauvegarde</button><button class="btn btn--ghost" data-act="set.import">${icon('upload', 18)} Restaurer une sauvegarde</button></div>
           <p class="small muted">${total} recettes · ${C.S.promotions.length} promotions · ${Object.values(C.S.plans).filter((p) => Object.keys(p.slots).length).length} semaines planifiées · ${C.S.expenses.length} dépenses</p>
           ${demoR ? `<div class="head-a">${demoR ? `<button class="btn btn--ghost btn--sm" data-act="set.clearDemoRecipes">Retirer les ${demoR} recettes d’exemple</button>` : ''}</div>` : ''}
           <div><button class="link" style="color:var(--danger)" data-act="set.reset">Tout effacer et repartir de zéro</button></div>`)}`;

      const sf = root.querySelector('#sync-form');
      if (sf)
        sf.onsubmit = async (e) => {
          e.preventDefault();
          const d = C.formData(sf);
          const btn = sf.querySelector('[type="submit"]');
          btn.disabled = true;
          btn.textContent = 'Connexion… (la première fois, l’envoi des recettes et de leurs photos prend une minute)';
          try {
            const res = await C.sync.connect(d.repo, d.token);
            if (res && res.error) throw new Error(res.error);
            C.toast('Appareil relié : la synchronisation est en route');
          } catch (err) {
            C.toast(err.message || String(err));
          }
          C.render();
        };
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
    'set.syncNow': async (el) => {
      el.disabled = true;
      el.textContent = 'Synchronisation…';
      const res = await C.sync.now();
      if (res && res.error) C.toast(res.error);
      else if (res && res.offline) C.toast('Pas de connexion : ce sera fait au retour du réseau.');
      else if (res && !res.recus) C.toast('Tout est à jour');
      C.render();
    },
    'set.syncOff': async () => {
      if (!(await C.confirm('Délier cet appareil ?', 'Les données restent sur cet appareil et dans le dépôt ; elles ne seront simplement plus synchronisées ici.', 'Délier'))) return;
      C.sync.disconnect();
      C.render();
    },
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
