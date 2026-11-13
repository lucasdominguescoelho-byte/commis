/* Commis — Accueil : la semaine en cours d'un coup d'œil. */
(function () {
  'use strict';
  const C = window.C;
  const { esc, icon } = C;
  const E = C.eng;

  // Repas à venir : jusqu'à 8, à partir du prochain (les midis passés à 15 h sont ignorés)
  function upcomingAll(max) {
    const out = [];
    const now = new Date();
    const today = C.today();
    const tomorrow = C.iso(C.addDays(now, 1));
    [C.weekId(), C.shiftWeek(C.weekId(), 1)].forEach((wid) => {
      const p = C.S.plans[wid];
      if (!p) return;
      for (let d = 0; d < 7; d++) {
        const iso = C.dayIso(wid, d);
        if (iso < today) continue;
        C.SLOTS.forEach((slot) => {
          const s = p.slots[`${d}-${slot}`];
          const r = s && C.recipe(s.recipeId);
          if (!r || (iso === today && slot === 'midi' && now.getHours() >= 15)) return;
          const day = iso === today ? 'Aujourd’hui' : iso === tomorrow ? 'Demain' : C.DAYS[d];
          out.push({ r, s, wid, day, slot, when: `${day} · ${slot}` });
        });
      }
    });
    return out.slice(0, max);
  }

  // Disposition inspirée de miamz.ch : en-tête partagé (texte + photo), bande des magasins,
  // bande des économies, « on mange ça » en cartes photo, puis courses et bonnes affaires.
  // Données affichées sur les objets de la cuisine 3D
  function homeInfo() {
    const wid = C.weekId();
    const t = E.planTotals(wid);
    const next = upcomingAll(1)[0];
    const promos = E.activePromos(wid).filter((p) => E.promoState(p) !== 'expired');
    const best = promos.map((p) => ({ p, pct: E.pct(p) })).sort((a, b) => b.pct - a.pct)[0];
    const shop = E.shopping(wid);
    const soon = C.S.fridge.filter((f) => E.expiresIn(f) != null && E.expiresIn(f) <= 3);
    const plan = C.S.plans[wid];
    const today = C.today();
    const dish = (d, slot) => {
      const s = plan && plan.slots[`${d}-${slot}`];
      const r = s && C.recipe(s.recipeId);
      return r ? r.name : '';
    };
    return {
      week: C.DAYS_S.map((name, d) => {
        const iso = C.dayIso(wid, d);
        return { label: `${name} ${C.parse(iso).getDate()}`, today: iso === today, past: iso < today, midi: dish(d, 'midi'), soir: dish(d, 'soir') };
      }),
      next: next ? { id: next.r.id, name: next.r.name, when: next.when, people: next.s.servings } : null,
      meals: t.meals,
      savings: t.savings,
      fridge: C.S.fridge.length,
      soon: soon.map((f) => f.name),
      shopLeft: shop.items.length - shop.done,
      promos: promos.length,
      best: best && best.pct ? { name: best.p.name, pct: best.pct, store: C.storeById(best.p.store).name } : null,
      recipes: C.S.recipes.length,
      toTest: C.S.recipes.filter((r) => r.toTest && !r.validated).length,
    };
  }

  // Accueil en 3D : la cuisine (js/cuisine3d.js) ; la vue résumé reste disponible et sert de repli.
  function render3d(root) {
    const wid = C.weekId();
    const t = E.planTotals(wid);
    root.innerHTML = `<section class="k3">
        <div class="k3-stage"></div>
        <div class="k3-load"><span class="spin"></span>Préparation de la cuisine…</div>
        <div class="k3-labels" aria-label="Pièces de la cuisine"></div>
        <header class="k3-head"><p class="eyebrow">Semaine ${C.weekNo(wid)} · ${C.fmtDate(C.today(), { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 class="k3-t">Votre <em>cuisine</em></h1>
          <p class="k3-s">${t.savings >= 0.05 ? `<b>${C.chf(t.savings)}</b> économisés cette semaine · ` : ''}${t.meals} repas sur 14 prévus</p></header>
        <div class="k3-tools">
          <button class="btn btn--ghost btn--sm k3-switch" data-act="home.classic">${icon('book', 16)} Vue résumé</button>
          <button class="btn btn--ghost btn--sm k3-enter" data-act="home.full" aria-label="Plein écran" title="Plein écran">${icon('expand', 17)}</button>
        </div>
        <button class="k3-exit" data-act="home.full" aria-label="Afficher le menu"><span class="k3-exit-l">Afficher le menu</span><span class="logo-mark">${C.logoMark}</span></button>
        <p class="k3-hint">${matchMedia('(hover: hover) and (pointer: fine)').matches ? 'Cliquez sur un objet pour l’ouvrir' : 'Touchez un objet pour l’ouvrir'}</p>
      </section>`;
    C.k3d.mount(root.querySelector('.k3-stage'), homeInfo());
  }

  C.views.accueil = {
    render(root) {
      if (!C.ui.homeClassic && !C.k3dFailed && C.k3d && C.k3d.supported()) return render3d(root);
      const wid = C.weekId();
      const st = C.S.settings;
      const t = E.planTotals(wid);
      const promos = E.activePromos(wid).filter((p) => E.promoState(p) !== 'expired');
      const shop = E.shopping(wid);
      const today = C.today();
      const over = st.weeklyBudget > 0 && t.cost > st.weeklyBudget;
      const pool = E.compatible().length;
      const meals = upcomingAll(8);
      const next = meals[0];
      const left = shop.items.length - shop.done;
      const stores = C.STORES.filter((s) => st.stores.includes(s.id));
      const storeNames = stores.map((s) => s.name).join(', ').replace(/, ([^,]*)$/, ' et $1');
      const promoUse = (r, people) => {
        const c = E.recipeCost(r, people, E.activePromos(wid));
        const m = c.promoIngs[0];
        return { c, m };
      };

      /* 1. En-tête partagé */
      const title = t.meals === 0
        ? 'Rien n’est encore <em>prévu.</em>'
        : t.savings >= 0.05
          ? `Cette semaine, vous économisez <em>${C.chf(t.savings)}.</em>`
          : 'Votre semaine est <em>prête.</em>';
      const sub = t.meals === 0
        ? `Commis compose votre semaine avec les promotions ${storeNames ? 'de ' + storeNames : 'de vos magasins'} et vos recettes, liste de courses comprise.`
        : `${t.meals} repas sur 14 prévus avec les promotions ${storeNames ? 'de ' + storeNames : 'de vos magasins'}${left ? `, ${left} produit${left > 1 ? 's' : ''} sur la liste de courses` : ''}.`;
      const cta = t.meals === 0
        ? `<button class="btn btn--citron btn--lg" data-act="home.generate" ${pool ? '' : 'disabled'}>${icon('wand', 18)} Proposer ma semaine</button><a class="link" href="#/planning" data-act="home.week">Composer moi-même</a>`
        : `<a class="btn btn--citron btn--lg" href="#/planning" data-act="home.week">Ouvrir le planning</a>${t.meals < 14 ? `<button class="link" data-act="home.generate">${icon('wand', 15)} Compléter les ${14 - t.meals} cases libres</button>` : `<a class="link" href="#/courses" data-act="home.week">Liste de courses ${icon('arrow', 15)}</a>`}`;
      const heroCard = next
        ? (() => {
            const { c, m } = promoUse(next.r, next.s.servings);
            return `<div class="hh-card"><p class="hh-k">Prochain repas · ${esc(next.when)}</p><p class="hh-n">${esc(next.r.name)}</p>
              <p class="hh-s">${m ? `${esc(m.ing.name)} −${E.pct(m.match.promo) || ''}${E.pct(m.match.promo) ? '%' : ''} chez ${C.storeById(m.match.promo.store).name} · ` : ''}${next.r.prepTime} min · ${C.chf(c.cost)}</p>
              <div class="hh-a">${next.r.steps.length ? `<button class="btn btn--citron btn--sm" data-act="cook.open" data-id="${next.r.id}" data-people="${next.s.servings}">${icon('chef', 16)} Cuisiner</button>` : ''}<a class="link" href="#/recettes/${next.r.id}">Voir la recette ${icon('arrow', 14)}</a></div></div>`;
          })()
        : `<div class="hh-card"><p class="hh-k">En promotion cette semaine</p><p class="hh-n">${promos.length} offres dans vos magasins</p><p class="hh-s"><a class="link" href="#/promotions">Voir les promotions ${icon('arrow', 14)}</a></p></div>`;
      const heroVisual = next ? C.recipeVisual(next.r) : `<img class="ph-img is-in" src="assets/img/recettes/plat-poelee.webp" alt="">`;

      /* 2. Bande des magasins */
      const count = (id) => promos.filter((p) => p.store === id).length;
      const storeStrip = `<div class="hs-strip"><p class="hs-l">Les promotions de la semaine, lues chez</p>
        <div class="hs-list">${stores.map((s) => `<a class="hs-s" href="#/promotions" style="--c:${s.color}"><b>${s.name}</b><span>${count(s.id)} offres</span></a>`).join('')}</div></div>`;

      /* 3. Bande des économies */
      const savings = t.meals
        ? `<section class="he-band"><h2 class="he-t">Combien vous économisez, <em>cette semaine</em></h2>
            <p class="he-sentence">Chez vous, on est <span class="step he-step"><button data-act="home.people" data-d="-1" aria-label="Une personne de moins">${icon('minus', 16)}</button><b>${st.household}</b><button data-act="home.people" data-d="1" aria-label="Une personne de plus">${icon('plus', 16)}</button></span> à table, et ${t.meals} repas sont déjà prévus.</p>
            <div class="he-tiles">
              <div class="he-tile"><b>${C.chf(t.savings)}</b><span>économisés cette semaine grâce aux promotions</span></div>
              <div class="he-tile"><b>≈ ${C.chf(Math.round(t.savings * 52))}</b><span>par an, si chaque semaine ressemblait à celle-ci</span></div>
              <div class="he-tile"><b>${C.chf(t.cost)}</b><span>${st.weeklyBudget > 0 ? (over ? `soit ${C.chf(t.cost - st.weeklyBudget)} au-dessus de votre budget` : `sur un budget de ${C.chf(st.weeklyBudget)}`) : 'de courses prévues'}</span></div>
            </div>
            <p class="he-note">Calculé sur les vraies promotions ${storeNames ? 'de ' + storeNames : ''} de cette semaine, par rapport aux prix habituels (${C.chf(t.regular)}). Le nombre de personnes vaut pour les prochains repas planifiés.</p></section>`
        : '';

      /* 4. On mange ça */
      const mealCards = meals.length
        ? `<section class="hm"><p class="eyebrow">Composé avec les promotions du moment</p><div class="hm-h"><h2 class="hm-t">Cette semaine, <em>on mange ça.</em></h2><a class="link" href="#/planning" data-act="home.week">Modifier le planning ${icon('arrow', 15)}</a></div>
            <div class="hm-row">${meals
              .map((x) => {
                const { m } = promoUse(x.r, x.s.servings);
                return `<a class="hm-c" href="#/recettes/${x.r.id}"><span class="hm-v">${C.recipeVisual(x.r)}</span><span class="hm-d">${esc(x.day)} · ${x.slot}</span><span class="hm-n">${esc(x.r.name)}</span>${m ? `<span class="hm-p"><em>Action</em>${C.storeById(m.match.promo.store).name} · ${esc(m.ing.name.toLowerCase())}</span>` : `<span class="hm-p hm-p--none">${x.r.prepTime} min</span>`}</a>`;
              })
              .join('')}</div></section>`
        : '';

      /* 5. Courses et bonnes affaires */
      const toBuy = shop.items.filter((i) => !i.checked).slice(0, 6);
      const tops = promos
        .map((p) => ({ p, n: E.recipesForPromo(p).filter((r) => !E.conflicts(r).length).length, pct: E.pct(p) }))
        .filter((x) => x.n > 0)
        .sort((a, b) => b.pct * Math.min(b.n, 3) - a.pct * Math.min(a.n, 3))
        .slice(0, 5);
      const duo = `<section class="hd">
          <div><div class="hd-h"><h2 class="h2">À acheter</h2><a class="link" href="#/courses" data-act="home.week">${left ? `${left} restant${left > 1 ? 's' : ''}` : 'Liste'} ${icon('arrow', 15)}</a></div>
            ${toBuy.length ? `<div class="rows">${toBuy.map((i) => `<div class="row"><span class="row-b"><span class="row-t">${esc(i.name)}</span></span>${i.match ? `<span class="badge badge--promo">${C.storeById(i.match.promo.store).name}</span>` : ''}<span class="row-p muted" style="font-weight:400">${C.fmtQty(i.qty, i.unit)}</span></div>`).join('')}</div><p class="small muted" style="margin-top:12px">${left > toBuy.length ? `et ${left - toBuy.length} autres produits · ` : ''}total estimé ${C.chf(shop.total)}</p>` : `<p class="muted">${shop.items.length ? 'Tout est acheté. Bien joué.' : 'La liste se remplit dès qu’un repas est planifié.'}</p>`}</div>
          <div><div class="hd-h"><h2 class="h2">Les bonnes affaires</h2><a class="link" href="#/promotions">Toutes ${icon('arrow', 15)}</a></div>
            ${tops.length ? `<div class="rows">${tops.map((x) => `<div class="row" data-act="promo.edit" data-id="${x.p.id}" tabindex="0" role="button"><span class="thumb">${C.promoVisual(x.p, 'ph--sm')}</span><span class="row-b"><span class="row-t">${esc(x.p.name)}</span><span class="row-s">${C.storeById(x.p.store).name} · dans ${x.n} recette${x.n > 1 ? 's' : ''}</span></span>${x.pct ? `<span class="badge badge--promo">−${x.pct}%</span>` : ''}<span class="row-p">${C.px(x.p.promoPrice)}${x.p.regularPrice ? `<s>${C.px(x.p.regularPrice)}</s>` : ''}</span></div>`).join('')}</div>` : '<p class="muted">Aucune promotion en cours ne correspond à vos recettes.</p>'}</div>
        </section>`;

      const soon = C.S.fridge.filter((f) => E.expiresIn(f) != null && E.expiresIn(f) <= 2);
      const fridge = soon.length
        ? `<div class="note hn">${icon('fridge', 18)}<span><b>À consommer bientôt :</b> ${soon.map((f) => esc(f.name)).join(', ')}.</span><button class="btn btn--ghost btn--sm note-a" data-act="frigo.cook">Idées de recettes</button></div>`
        : '';

      root.innerHTML = `
        <section class="hh">
          <div class="hh-txt"><p class="eyebrow">Semaine ${C.weekNo(wid)} · ${C.fmtDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <h1 class="hh-t">${title}</h1>
            <p class="hh-sub">${sub}</p>
            <div class="hh-cta">${cta}</div>
            <p class="hh-micro">${promos.length} promotions en cours · ${pool} recette${pool > 1 ? 's' : ''} compatible${pool > 1 ? 's' : ''} avec vos préférences${!C.k3dFailed && C.k3d && C.k3d.supported() ? ` · <button class="link" data-act="home.room">Revenir à la cuisine 3D</button>` : ''}</p></div>
          <div class="hh-v">${next ? `<a href="#/recettes/${next.r.id}" class="hh-img" aria-label="${esc(next.r.name)}">${heroVisual}</a>` : `<span class="hh-img">${heroVisual}</span>`}${heroCard}</div>
        </section>
        ${storeStrip}
        ${fridge}
        ${savings}
        ${mealCards}
        ${duo}`;
    },
  };

  Object.assign(C.acts, {
    'home.week': () => { C.ui.week = C.weekId(); },
    'home.classic': () => { C.ui.homeClassic = true; C.render(); },
    'home.room': () => { C.ui.homeClassic = false; C.render(); },
    // Plein écran : la pièce seule ; le logo en bas à droite remet le menu (et inversement)
    'home.full': () => {
      const html = document.documentElement;
      C.ui.full = !C.ui.full;
      html.classList.toggle('k3-full', C.ui.full);
      html.classList.toggle('k3-unfold', !C.ui.full);
      clearTimeout(C.ui.unfoldT);
      C.ui.unfoldT = setTimeout(() => html.classList.remove('k3-unfold'), 450);
      const next = document.querySelector(C.ui.full ? '.k3-exit' : '.k3-enter');
      if (next) next.focus({ preventScroll: true });
    },
    'home.people': (el) => C.save.settings({ household: Math.max(1, Math.min(12, C.S.settings.household + Number(el.dataset.d))) }),
    'home.generate': () => {
      C.ui.week = C.weekId();
      C.acts['plan.generate']();
    },
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.documentElement.classList.contains('k3-full') && !document.querySelector('#ob, .sheet.is-open')) C.acts['home.full']();
  });
})();
