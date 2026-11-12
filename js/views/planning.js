/* Commis — Planning hebdomadaire : grille midi / soir, ajout, déplacement, détail d'un repas, proposition automatique. */
(function () {
  'use strict';
  const C = window.C;
  const { esc, icon } = C;
  const E = C.eng;

  const slotOf = (wid, key) => C.S.plans[wid] && C.S.plans[wid].slots[key];
  const slotName = (key) => `${C.DAYS[Number(key[0])]} ${key.slice(2)}`;

  function slotHtml(wid, d, slot, promos, today) {
    const key = `${d}-${slot}`;
    const s = slotOf(wid, key);
    const r = s && C.recipe(s.recipeId);
    const mv = C.ui.moving;
    const pos = `style="grid-column:${d + 2};grid-row:${slot === 'midi' ? 2 : 3}"`;
    let cls = C.dayIso(wid, d) < today ? ' is-past' : '';
    if (mv) cls += mv === key ? ' is-src' : ' is-target';
    const act = mv ? (mv === key ? 'plan.cancelMove' : 'plan.drop') : r ? 'plan.open' : 'plan.add';
    if (!r)
      return `<button class="slot slot--empty${cls}" ${pos} data-key="${key}" data-act="${act}" aria-label="Ajouter un repas : ${slotName(key)}"><span class="slot-l">${C.SLOT_LABEL[slot]}</span>${mv ? '' : icon('plus')}</button>`;
    const c = E.recipeCost(r, s.servings, promos);
    const n = c.promoIngs.length;
    return `<div class="slot meal${cls}" ${pos} draggable="${mv ? 'false' : 'true'}" tabindex="0" role="button" data-key="${key}" data-act="${act}" aria-label="${slotName(key)} : ${esc(r.name)}">
      <span class="meal-v">${C.recipeVisual(r, 'ph--sm')}${n ? `<span class="badge badge--promo">${n} promo${n > 1 ? 's' : ''}</span>` : ''}</span>
      <span class="meal-t"><span class="slot-l">${C.SLOT_LABEL[slot]}</span><strong class="meal-n">${esc(r.name)}</strong>
      <span class="meal-m">${C.chf(c.cost)} · ${s.servings} pers.</span></span></div>`;
  }

  C.views.planning = {
    render(root) {
      const wid = C.ui.week;
      const st = C.S.settings;
      const t = E.planTotals(wid);
      const promos = E.activePromos(wid);
      const today = C.today();
      const over = st.weeklyBudget > 0 && t.cost > st.weeklyBudget;
      let grid = `<div class="plan-l" style="grid-row:2">Midi</div><div class="plan-l" style="grid-row:3">Soir</div>`;
      for (let d = 0; d < 7; d++) {
        const iso = C.dayIso(wid, d);
        grid += `<div class="plan-h ${iso === today ? 'is-today' : ''} ${iso < today ? 'is-past' : ''}" style="grid-column:${d + 2}">${C.DAYS_S[d]} <b>${C.parse(iso).getDate()}</b></div>`;
        grid += slotHtml(wid, d, 'midi', promos, today) + slotHtml(wid, d, 'soir', promos, today);
      }
      root.innerHTML = `
        <header class="head"><div><p class="eyebrow">Planning · semaine ${C.weekNo(wid)}</p><h1 class="title">${C.weekLabel(wid)}</h1></div>
          <div class="head-a">${C.weekNav(wid)}
            ${t.meals ? `<button class="ibtn ibtn--line" data-act="plan.clear" aria-label="Vider la semaine" title="Vider la semaine">${icon('trash')}</button>` : ''}
            <button class="btn btn--citron" data-act="plan.generate">${icon('wand', 18)} Proposer un planning</button></div></header>
        <div class="sum">
          <div class="sum-i"><span>Coût estimé</span><b>${C.chf(t.cost)}${st.weeklyBudget > 0 ? ` <small>/ ${C.num(st.weeklyBudget, 0)}</small>` : ''}</b></div>
          <div class="sum-i"><span>Économies promos</span><b>${C.chf(t.savings)}</b></div>
          <div class="sum-i"><span>Repas planifiés</span><b>${t.meals} <small>/ 14</small></b></div>
          ${st.weeklyBudget > 0 ? `<div class="bar ${over ? 'is-over' : ''}" role="img" aria-label="Part du budget hebdomadaire utilisée"><i style="width:${Math.min(100, (t.cost / st.weeklyBudget) * 100)}%"></i></div>` : ''}
          <a class="link" href="#/courses">Liste de courses ${icon('arrow', 15)}</a>
        </div>
        ${C.ui.moving ? `<div class="movebar"><span>${icon('move', 18)}</span><span>Choisissez la case où déplacer <b>${esc((C.recipe((slotOf(wid, C.ui.moving) || {}).recipeId) || {}).name || 'ce repas')}</b>.</span><button class="btn btn--sm" data-act="plan.cancelMove">Annuler</button></div>` : ''}
        ${(() => {
          const past = [0, 1, 2, 3, 4, 5, 6].filter((d) => C.dayIso(wid, d) < today);
          if (!past.length || past.length === 7) return '';
          const label = past.length === 1 ? C.DAYS[0].toLowerCase() : `${C.DAYS[0].toLowerCase()} – ${C.DAYS[past.length - 1].toLowerCase()}`;
          return `<button class="past-t" data-act="plan.past" aria-expanded="${!!C.ui.showPast}">${icon(C.ui.showPast ? 'minus' : 'plus', 16)} ${C.ui.showPast ? 'Masquer' : 'Afficher'} les jours passés <span class="muted">(${label})</span></button>`;
        })()}
        <div class="plan ${C.ui.showPast ? 'show-past' : ''}">${grid}</div>
        <p class="small muted" style="margin-top:16px">Cliquez sur une case pour ajouter un repas, sur un repas pour voir ses ingrédients. Sur ordinateur, glissez un repas pour le déplacer ; ailleurs, utilisez « Déplacer ».</p>`;
    },
  };

  /* ---------- Sélecteur de recette ---------- */
  C.pickRecipe = (title, sub, onPick) => {
    const wid = C.ui.week;
    const list = () => {
      const q = C.norm(C.ui.pick.q);
      const promos = E.activePromos(wid);
      const people = C.S.settings.household || 2;
      const rows = C.S.recipes
        .map((r) => ({ r, c: E.recipeCost(r, people, promos), bad: E.conflicts(r) }))
        .filter((x) => !q || C.norm([x.r.name, x.r.category, ...x.r.ingredients.map((i) => i.name)].join(' ')).includes(q))
        .sort((a, b) => a.bad.length - b.bad.length || b.c.savings - a.c.savings || a.r.name.localeCompare(b.r.name, 'fr'));
      if (!rows.length) return `<p class="muted" style="padding:18px 0">${C.S.recipes.length ? 'Aucune recette trouvée.' : 'Aucune recette dans la bibliothèque pour le moment.'}</p>`;
      return rows
        .map(
          (x) => `<button class="pick ${x.bad.length ? 'is-off' : ''}" data-act="pick.choose" data-id="${x.r.id}">
            <span class="thumb">${C.recipeVisual(x.r, 'ph--sm')}</span>
            <span class="row-b"><span class="row-t">${esc(x.r.name)}</span><span class="row-s">${x.r.prepTime} min · ${C.chf(x.c.cost)}${x.bad.length ? ` · contient : ${esc(x.bad.map((b) => b.label).join(', '))}` : ''}</span></span>
            ${x.c.promoIngs.length ? `<span class="badge badge--promo">${x.c.promoIngs.length} promo${x.c.promoIngs.length > 1 ? 's' : ''}</span>` : ''}</button>`
        )
        .join('');
    };
    C.ui.pick = { q: '', onPick, list };
    C.sheet({
      title,
      sub,
      body: `<div class="search" style="max-width:none;margin-bottom:10px">${icon('search', 18)}<input class="inp" type="search" placeholder="Rechercher une recette ou un ingrédient" data-input="pick.search" aria-label="Rechercher" autofocus></div>
        <p class="small muted" style="margin-bottom:6px">Classées par économies possibles cette semaine, pour ${C.S.settings.household} pers.</p><div id="pick-list">${list()}</div>`,
    });
  };

  /* ---------- Détail d'un repas ---------- */
  function openMeal(wid, key) {
    const s = slotOf(wid, key);
    const r = s && C.recipe(s.recipeId);
    if (!r) return;
    C.ui.meal = { wid, key };
    C.sheet({
      title: r.name,
      sub: `${slotName(key)} · ${C.fmtDate(C.dayIso(wid, Number(key[0])), { day: 'numeric', month: 'long' })}`,
      body: () => {
        const cur = slotOf(wid, key);
        const rec = cur && C.recipe(cur.recipeId);
        if (!rec || rec.id !== r.id) return null;
        const c = E.recipeCost(rec, cur.servings, E.activePromos(wid));
        return `${cur.auto && cur.why && cur.why.length ? `<ul class="why">${cur.why.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin:16px 0 4px">
            <div class="meta"><span>${icon('clock', 16)}${rec.prepTime} min</span><span>${esc(rec.category)}</span></div>
            <div class="step"><button data-act="plan.serv" data-d="-1" aria-label="Moins">${icon('minus', 16)}</button><b>${cur.servings}</b><button data-act="plan.serv" data-d="1" aria-label="Plus">${icon('plus', 16)}</button><span>pers.</span></div>
          </div>
          ${C.ingLines(c)}
          <div class="total"><span>Coût estimé<br><small class="muted">${C.chf(c.cost / cur.servings)} par personne${c.savings >= 0.05 ? ` · ${C.chf(c.savings)} d’économie` : ''}</small></span><b>${C.chf(c.cost)}</b></div>`;
      },
      foot: `<button class="btn btn--ghost sp" data-act="plan.remove">${icon('trash', 17)} Retirer</button>
        <button class="btn btn--ghost" data-act="plan.move">${icon('move', 17)} Déplacer</button>
        <button class="btn btn--ghost" data-act="plan.replace">Remplacer</button>
        <a class="btn" href="#/recettes/${r.id}">Voir la recette</a>`,
    });
  }

  function move(wid, from, to) {
    if (from === to) return;
    C.save.plan(wid, (slots) => {
      const a = slots[from];
      const b = slots[to];
      if (!a) return;
      if (b) slots[from] = b;
      else delete slots[from];
      slots[to] = a;
    });
    C.toast(`Repas déplacé : ${slotName(to).toLowerCase()}`);
  }

  Object.assign(C.acts, {
    'plan.past': () => {
      C.ui.showPast = !C.ui.showPast;
      C.render();
    },
    'pick.search': (el) => {
      C.ui.pick.q = el.value;
      document.getElementById('pick-list').innerHTML = C.ui.pick.list();
    },
    'pick.choose': (el) => {
      const p = C.ui.pick;
      C.closeSheet();
      p.onPick(el.dataset.id);
    },
    'plan.add': (el) => {
      const wid = C.ui.week;
      const key = el.dataset.key;
      C.pickRecipe('Choisir un repas', slotName(key), (id) =>
        C.save.plan(wid, (slots) => {
          slots[key] = { recipeId: id, servings: C.S.settings.household || 2 };
        })
      );
    },
    'plan.open': (el) => openMeal(C.ui.week, el.dataset.key),
    'plan.serv': (el) => {
      const { wid, key } = C.ui.meal;
      C.save.plan(wid, (slots) => {
        if (slots[key]) slots[key].servings = Math.max(1, Math.min(24, slots[key].servings + Number(el.dataset.d)));
      });
    },
    'plan.remove': () => {
      const { wid, key } = C.ui.meal;
      const old = slotOf(wid, key);
      C.closeSheet();
      C.save.plan(wid, (slots) => delete slots[key]);
      C.toast('Repas retiré', { label: 'Annuler', run: () => C.save.plan(wid, (slots) => { slots[key] = old; }) });
    },
    'plan.replace': () => {
      const { wid, key } = C.ui.meal;
      const old = slotOf(wid, key);
      C.closeSheet();
      C.pickRecipe('Remplacer le repas', slotName(key), (id) =>
        C.save.plan(wid, (slots) => {
          slots[key] = { recipeId: id, servings: (old && old.servings) || C.S.settings.household || 2 };
        })
      );
    },
    'plan.move': () => {
      C.closeSheet();
      C.ui.moving = C.ui.meal.key;
      C.render();
    },
    'plan.cancelMove': () => {
      C.ui.moving = null;
      C.render();
    },
    'plan.drop': (el) => {
      const from = C.ui.moving;
      C.ui.moving = null;
      move(C.ui.week, from, el.dataset.key);
    },
    'plan.clear': async () => {
      const wid = C.ui.week;
      if (!(await C.confirm('Vider cette semaine ?', 'Tous les repas planifiés de la semaine affichée seront retirés. Vos recettes ne sont pas touchées.', 'Vider la semaine'))) return;
      const backup = { ...C.plan(wid).slots };
      C.save.plan(wid, (slots) => Object.keys(slots).forEach((k) => delete slots[k]));
      C.toast('Semaine vidée', { label: 'Annuler', run: () => C.save.plan(wid, (slots) => Object.assign(slots, backup)) });
    },
    'plan.generate': () => {
      const wid = C.ui.week;
      const st = C.S.settings;
      const t = E.planTotals(wid);
      const pool = E.compatible().length;
      const row = (a, b) => `<div class="row"><span class="row-b">${a}</span><span class="row-p">${b}</span></div>`;
      C.sheet({
        title: 'Proposer un planning',
        sub: `Semaine ${C.weekNo(wid)} · ${C.weekLabel(wid)}`,
        body: `<p style="color:var(--ink-2)">Commis choisit, parmi vos recettes, celles qui profitent le mieux des promotions de la semaine, réutilisent les mêmes produits frais d’un repas à l’autre et tiennent dans votre budget.</p>
          <div class="card rows" style="margin:16px 0;padding:16px 18px">
            ${row('Recettes compatibles avec vos préférences', `${pool} sur ${C.S.recipes.length}`)}
            ${row('Promotions valables dans vos magasins', E.activePromos(wid).length)}
            ${row('Personnes à table', st.household)}
            ${row('Budget hebdomadaire', st.weeklyBudget > 0 ? C.chf(st.weeklyBudget) : 'non défini')}
          </div>
          <div class="note">${icon('info', 18)}<span>Calcul local par règles et score, à partir de vos données uniquement — sans intelligence artificielle ni service externe. Les jours déjà passés ne sont pas modifiés.</span></div>`,
        foot: `${t.meals ? `<button class="btn btn--ghost" data-act="plan.gen" data-mode="replace">Tout remplacer</button>` : ''}<button class="btn btn--citron" data-act="plan.gen" data-mode="fill" ${pool ? '' : 'disabled'}>${t.meals ? 'Compléter les cases vides' : 'Générer la proposition'}</button>`,
      });
    },
    'plan.gen': (el) => {
      C.closeSheet();
      const res = E.generate(C.ui.week, { replace: el.dataset.mode === 'replace' });
      if (res.error) C.toast(res.error);
      else C.toast(res.filled ? `${res.filled} repas proposés — ajustez librement` : 'Aucune case libre à compléter');
    },
  });

  /* ---------- Glisser-déposer (ordinateur) ---------- */
  let dragKey = null;
  const slotAt = (e) => (e.target && e.target.closest ? e.target.closest('.plan .slot') : null);
  const clearOver = () => document.querySelectorAll('.slot.is-over').forEach((x) => x.classList.remove('is-over'));
  document.addEventListener('dragstart', (e) => {
    const el = e.target && e.target.closest ? e.target.closest('.meal[draggable="true"]') : null;
    if (!el) return;
    dragKey = el.dataset.key;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragKey);
    requestAnimationFrame(() => el.classList.add('is-drag'));
  });
  document.addEventListener('dragend', () => {
    dragKey = null;
    clearOver();
    document.querySelectorAll('.slot.is-drag').forEach((x) => x.classList.remove('is-drag'));
  });
  document.addEventListener('dragover', (e) => {
    if (!dragKey) return;
    const el = slotAt(e);
    if (!el || el.dataset.key === dragKey) return clearOver();
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!el.classList.contains('is-over')) {
      clearOver();
      el.classList.add('is-over');
    }
  });
  document.addEventListener('drop', (e) => {
    if (!dragKey) return;
    const el = slotAt(e);
    if (!el) return;
    e.preventDefault();
    const from = dragKey;
    dragKey = null;
    move(C.ui.week, from, el.dataset.key);
  });
})();
