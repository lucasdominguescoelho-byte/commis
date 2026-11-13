/* Commis — Accueil : la cuisine en 3D, dont les objets mènent aux pages. */
(function () {
  'use strict';
  const C = window.C;
  const { icon } = C;
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

  // Accueil : la cuisine en 3D (js/cuisine3d.js), seule à l'écran ; le menu s'affiche ou se cache
  // avec le logo en bas à droite.
  function render3d(root) {
    const full = !!C.ui.full;
    root.innerHTML = `<section class="k3">
        <h1 class="sr-only">Votre cuisine</h1>
        <div class="k3-stage"></div>
        <div class="k3-load"><span class="spin"></span>Préparation de la cuisine…</div>
        <div class="k3-labels" aria-label="Pièces de la cuisine"></div>
        <p class="k3-hint">${matchMedia('(hover: hover) and (pointer: fine)').matches ? 'Cliquez sur un objet pour l’ouvrir' : 'Touchez un objet pour l’ouvrir'}</p>
        <button class="k3-mode" data-act="home.full" aria-label="${full ? 'Afficher le menu' : 'Plein écran'}"><span class="k3-mode-l"><span class="k3-mode-menu">Afficher le menu</span><span class="k3-mode-full">Plein écran</span></span><span class="logo-mark">${C.logoMark}</span></button>
      </section>`;
    C.k3d.mount(root.querySelector('.k3-stage'), homeInfo());
  }

  // Sans WebGL, ou si la 3D n'a pas pu se charger : un mot d'explication, le menu reste là
  function renderOff(root) {
    root.innerHTML = `<section class="k3-off">
        <h1 class="k3-off-t">Votre <em>cuisine</em></h1>
        <p class="k3-off-s">${C.k3dFailed ? 'La cuisine 3D n’a pas pu se charger. Vérifiez la connexion, puis réessayez.' : 'La cuisine 3D a besoin de WebGL, qui n’est pas disponible sur ce navigateur.'} Le menu mène à toutes les pages.</p>
        ${C.k3dFailed ? `<button class="btn btn--citron" data-act="home.retry">${icon('arrow', 18)} Réessayer</button>` : ''}
      </section>`;
  }

  C.views.accueil = {
    render(root) {
      if (!C.k3dFailed && C.k3d && C.k3d.supported()) return render3d(root);
      renderOff(root);
    },
  };

  Object.assign(C.acts, {
    // Plein écran (la pièce seule) ⇄ pièce avec le menu : le même logo, en bas à droite
    'home.full': () => {
      const html = document.documentElement;
      C.ui.full = !C.ui.full;
      html.classList.toggle('k3-full', C.ui.full);
      html.classList.toggle('k3-unfold', !C.ui.full);
      clearTimeout(C.ui.unfoldT);
      C.ui.unfoldT = setTimeout(() => html.classList.remove('k3-unfold'), 450);
      const b = document.querySelector('.k3-mode');
      if (b) b.setAttribute('aria-label', C.ui.full ? 'Afficher le menu' : 'Plein écran');
    },
    'home.retry': () => {
      C.k3dFailed = false;
      C.render();
    },
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.documentElement.classList.contains('k3-full') && !document.querySelector('#ob, .sheet.is-open')) C.acts['home.full']();
  });
})();
