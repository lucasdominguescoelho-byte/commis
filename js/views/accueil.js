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
      const toBuy = shop.items.filter((i) => !i.checked).slice(0, 6);
      const tops = promos
        .map((p) => ({ p, n: E.recipesForPromo(p).filter((r) => !E.conflicts(r).length).length, pct: E.pct(p) }))
        .filter((x) => x.n > 0)
        .sort((a, b) => b.pct * Math.min(b.n, 3) - a.pct * Math.min(a.n, 3))
        .slice(0, 4);

      root.innerHTML = `
        <header class="head"><div><p class="eyebrow">Semaine ${C.weekNo(wid)} · ${C.fmtDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}</p><h1 class="title">Cette <em>semaine</em></h1></div>
          <div class="head-a">${t.meals < 14 && t.meals > 0 ? `<button class="btn btn--ghost" data-act="home.generate">${icon('wand', 18)} Compléter le planning</button>` : ''}<a class="btn" href="#/planning" data-act="home.week">Ouvrir le planning</a></div></header>

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
        <section class="grid g3">
          <div class="card"><p class="stat-l">${icon('wallet', 17)} Budget estimé</p>
            <p class="stat-v">${C.chf(t.cost)}</p>
            ${st.weeklyBudget > 0 ? `<div class="bar ${over ? 'is-over' : ''}"><i style="width:${Math.min(100, (t.cost / st.weeklyBudget) * 100)}%"></i></div><p class="stat-s">${over ? `Dépassement de ${C.chf(t.cost - st.weeklyBudget)}` : `Reste ${C.chf(st.weeklyBudget - t.cost)}`} sur un budget de ${C.chf(st.weeklyBudget)}</p>` : `<p class="stat-s"><a class="link" href="#/reglages">Définir un budget hebdomadaire</a></p>`}
          </div>
          <div class="card ${t.savings >= 0.05 ? 'card--citron' : ''}"><p class="stat-l">${icon('tag', 17)} Économies potentielles</p>
            <p class="stat-v">${C.chf(t.savings)}</p>
            <p class="stat-s">${t.savings >= 0.05 ? `Grâce aux promotions sur les repas planifiés, par rapport aux prix habituels (${C.chf(t.regular)}).` : promos.length ? `Planifiez des repas pour profiter des ${promos.length} promotions en cours.` : 'Aucune promotion enregistrée pour cette semaine.'}</p>
          </div>
          <div class="card span-t"><p class="stat-l">${icon('calendar', 17)} Repas planifiés</p>
            <p class="stat-v">${t.meals}<small>/ 14</small></p>
            <div class="bar"><i style="width:${(t.meals / 14) * 100}%"></i></div>
            <p class="stat-s">${t.meals === 14 ? 'La semaine est complète.' : t.meals ? `${14 - t.meals} case${14 - t.meals > 1 ? 's' : ''} encore libre${14 - t.meals > 1 ? 's' : ''}.` : 'Midi et soir, du lundi au dimanche.'}</p>
          </div>
        </section>

        <section class="sec"><div class="sec-h"><h2 class="h2">Le planning</h2><a class="link" href="#/planning" data-act="home.week">Modifier ${icon('arrow', 15)}</a></div>
          <div class="card card--flush"><div class="strip">${strip}</div></div></section>

        <section class="sec grid g3">
          <div class="card"><div class="sec-h"><h2 class="h3">Prochains repas</h2></div>
            ${next.length > 1 ? `<div class="rows">${next.slice(1).map((x) => `<a class="row" href="#/recettes/${x.r.id}"><span class="thumb">${C.recipeVisual(x.r, 'ph--sm')}</span><span class="row-b"><span class="row-t">${esc(x.r.name)}</span><span class="row-s">${x.when} · ${x.r.prepTime} min</span></span></a>`).join('')}</div>` : `<p class="muted small">${next.length ? 'Rien d’autre de prévu pour l’instant.' : 'Aucun repas à venir pour l’instant.'}</p>`}
          </div>
          <div class="card"><div class="sec-h"><h2 class="h3">À acheter</h2><a class="link" href="#/courses" data-act="home.week">${shop.items.length ? `${shop.items.length - shop.done} restant${shop.items.length - shop.done > 1 ? 's' : ''}` : 'Liste'} ${icon('arrow', 15)}</a></div>
            ${toBuy.length ? `<div class="rows">${toBuy.map((i) => `<div class="row" style="padding:9px 0"><span class="row-b"><span class="row-t">${esc(i.name)}</span></span>${i.match ? `<span class="badge badge--promo">${C.storeById(i.match.promo.store).name}</span>` : ''}<span class="row-p muted" style="font-weight:400">${C.fmtQty(i.qty, i.unit)}</span></div>`).join('')}</div>${shop.items.length - shop.done > toBuy.length ? `<p class="small muted" style="margin-top:12px">et ${shop.items.length - shop.done - toBuy.length} autres produits · total estimé ${C.chf(shop.total)}</p>` : `<p class="small muted" style="margin-top:12px">Total estimé ${C.chf(shop.total)}</p>`}` : `<p class="muted small">${shop.items.length ? 'Tout est acheté. Bien joué.' : 'La liste se remplit dès qu’un repas est planifié.'}</p>`}
          </div>
          <div class="card span-t"><div class="sec-h"><h2 class="h3">Promotions intéressantes</h2><a class="link" href="#/promotions">Toutes ${icon('arrow', 15)}</a></div>
            ${tops.length ? `<div class="rows">${tops.map((x) => `<div class="row" data-act="promo.edit" data-id="${x.p.id}" tabindex="0" role="button"><span class="thumb">${C.promoVisual(x.p, 'ph--sm')}</span><span class="row-b"><span class="row-t">${esc(x.p.name)}</span><span class="row-s">${C.storeById(x.p.store).name} · dans ${x.n} recette${x.n > 1 ? 's' : ''}</span></span>${x.pct ? `<span class="badge badge--promo">−${x.pct}%</span>` : ''}<span class="row-p">${C.px(x.p.promoPrice)}${x.p.regularPrice ? `<s>${C.px(x.p.regularPrice)}</s>` : ''}</span></div>`).join('')}</div>` : '<p class="muted small">Aucune promotion en cours ne correspond à vos recettes.</p>'}
          </div>
        </section>`;
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
