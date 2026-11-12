/* Commis — Accueil : la semaine en cours d'un coup d'œil. */
(function () {
  'use strict';
  const C = window.C;
  const { esc, icon } = C;
  const E = C.eng;

  function upcoming() {
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
          out.push({ r, s, when: `${iso === today ? "Aujourd'hui" : iso === tomorrow ? 'Demain' : C.DAYS[d]} · ${slot}` });
        });
      }
    });
    return out.slice(0, 4);
  }

  C.views.accueil = {
    render(root) {
      const wid = C.weekId();
      const st = C.S.settings;
      const t = E.planTotals(wid);
      const plan = C.S.plans[wid];
      const promos = E.activePromos(wid).filter((p) => E.promoState(p) !== 'expired');
      const shop = E.shopping(wid);
      const today = C.today();
      const over = st.weeklyBudget > 0 && t.cost > st.weeklyBudget;
      const pool = E.compatible().length;

      const strip = C.DAYS_S.map((name, d) => {
        const iso = C.dayIso(wid, d);
        const cell = (slot) => {
          const s = plan && plan.slots[`${d}-${slot}`];
          const r = s && C.recipe(s.recipeId);
          return `<span class="strip-m ${r ? '' : 'is-empty'}"><small>${C.SLOT_LABEL[slot]}</small>${r ? `<span class="strip-p">${C.recipeVisual(r, 'ph--sm')}</span><span class="strip-t">${esc(r.name)}</span>` : '—'}</span>`;
        };
        return `<a class="strip-d ${iso === today ? 'is-today' : ''} ${iso < today ? 'is-past' : ''}" href="#/planning" data-act="home.week"><span class="strip-h">${name} <b>${C.parse(iso).getDate()}</b></span>${cell('midi')}${cell('soir')}</a>`;
      }).join('');

      const next = upcoming();

      root.innerHTML = `
        <header class="head"><div><p class="eyebrow">Semaine ${C.weekNo(wid)} · ${C.fmtDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}</p><h1 class="title">Cette <em>semaine</em></h1></div>
          <div class="head-a"><a class="btn btn--ghost" href="#/planning" data-act="home.week">${icon('calendar', 18)} Planning</a></div></header>

        ${
          t.meals === 0
            ? `<section class="card hero" style="margin-bottom:16px"><div><h2 class="h2">Rien n’est encore prévu.<br>Voulez-vous une proposition ?</h2>
                <p class="lede">Commis compose une semaine à partir de vos recettes, en privilégiant les produits en promotion et ceux qui servent à plusieurs repas.</p>
                <div class="head-a" style="margin-top:20px"><button class="btn btn--citron" data-act="home.generate" ${pool ? '' : 'disabled'}>${icon('wand', 18)} Proposer un planning</button><a class="btn btn--ghost" href="#/planning" data-act="home.week">Composer moi-même</a></div></div>
                <ol class="hero-steps"><li><span><b>${promos.length}</b> promotion${promos.length > 1 ? 's' : ''} en cours dans vos magasins</span></li><li><span><b>${pool}</b> recette${pool > 1 ? 's' : ''} compatible${pool > 1 ? 's' : ''} avec vos préférences</span></li><li><span>Une liste de courses regroupée et chiffrée, prête à cocher</span></li></ol></section>`
            : ''
        }

        ${(() => {
          const x = next[0];
          if (!x) return '';
          const nu = C.nutri(x.r);
          const c = E.recipeCost(x.r, x.s.servings, E.activePromos(wid));
          return `<section class="card nextm"><a class="nextm-v" href="#/recettes/${x.r.id}" aria-label="${esc(x.r.name)}">${C.recipeVisual(x.r)}</a>
            <div class="nextm-b"><p class="eyebrow">Prochain repas · ${esc(x.when)}</p><h2 class="nextm-n">${esc(x.r.name)}</h2>
              <div class="meta"><span>${icon('clock', 16)}${x.r.prepTime} min</span><span>${icon('users', 16)}${x.s.servings} pers.</span><span>${C.chf(c.cost)}</span>${c.promoIngs.length ? `<span class="badge badge--promo">${c.promoIngs.length} en promo</span>` : ''}</div>
              ${C.nutriChips(nu)}
              <div class="head-a" style="margin-top:auto;padding-top:18px">${x.r.steps.length ? `<button class="btn btn--citron" data-act="cook.open" data-id="${x.r.id}" data-people="${x.s.servings}">${icon('chef', 18)} Cuisiner</button>` : ''}<a class="btn btn--ghost" href="#/recettes/${x.r.id}">Voir la recette</a></div></div></section>`;
        })()}

        ${(() => {
          const soon = C.S.fridge.filter((f) => E.expiresIn(f) != null && E.expiresIn(f) <= 2);
          return soon.length
            ? `<div class="note" style="margin-bottom:16px">${icon('fridge', 18)}<span><b>À consommer bientôt :</b> ${soon.map((f) => esc(f.name)).join(', ')}.</span><button class="btn btn--ghost btn--sm note-a" data-act="frigo.cook">Idées de recettes</button></div>`
            : '';
        })()}
        ${t.meals ? `<div class="sum home-sum">
          <div class="sum-i"><span>Budget</span><b>${C.chf(t.cost)}${st.weeklyBudget > 0 ? ` <small>/ ${C.num(st.weeklyBudget, 0)}</small>` : ''}</b></div>
          <div class="sum-i"><span>Économies promos</span><b>${C.chf(t.savings)}</b></div>
          <div class="sum-i"><span>Repas prévus</span><b>${t.meals} <small>/ 14</small></b></div>
          <a class="sum-i sum-a" href="#/courses" data-act="home.week"><span>À acheter</span><b>${shop.items.length - shop.done} <small>produit${shop.items.length - shop.done > 1 ? 's' : ''}</small></b></a>
          ${over ? `<span class="badge badge--warn">Budget dépassé de ${C.chf(t.cost - st.weeklyBudget)}</span>` : ''}
        </div>` : ''}

        <section class="sec"><div class="sec-h"><h2 class="h2">La semaine</h2><a class="link" href="#/planning" data-act="home.week">Modifier ${icon('arrow', 15)}</a></div>
          <div class="card card--flush"><div class="strip">${strip}</div></div></section>`;
      // Sur téléphone, la semaine défile : on l'ouvre sur aujourd'hui
      const sr = root.querySelector('.strip');
      const td = sr && sr.querySelector('.is-today');
      if (td && sr.scrollWidth > sr.clientWidth) sr.scrollLeft = td.offsetLeft - sr.offsetLeft;
    },
  };

  Object.assign(C.acts, {
    'home.week': () => { C.ui.week = C.weekId(); },
    'home.generate': () => {
      C.ui.week = C.weekId();
      C.acts['plan.generate']();
    },
  });
})();
