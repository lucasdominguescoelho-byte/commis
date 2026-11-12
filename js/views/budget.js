/* Cabas — Budget : estimation des repas planifiés, dépenses réelles saisies, économies liées aux promotions. */
(function () {
  'use strict';
  const C = window.C;
  const { esc, icon } = C;
  const E = C.eng;

  const S1 = 'var(--s1)';
  const S2 = 'var(--s2)';

  C.views.budget = {
    render(root) {
      const st = C.S.settings;
      const wid = C.weekId();
      const t = E.planTotals(wid);
      const spent = E.weekSpent(wid);
      const m = E.month();
      const hist = E.history(8);
      const now = new Date();
      const hasBudget = st.weeklyBudget > 0;
      const bar = (v, max) => (max > 0 ? `<div class="bar ${v > max ? 'is-over' : ''}"><i style="width:${Math.min(100, (v / max) * 100)}%"></i></div>` : '');
      const cats = C.CATS.map((c) => ({ name: c.name, v: t.byCat[c.id] || 0 })).filter((c) => c.v > 0.004).sort((a, b) => b.v - a.v);
      const catMax = cats.length ? cats[0].v : 1;
      const anyHist = hist.some((h) => h.planned > 0 || h.spent > 0);
      const anySave = hist.some((h) => h.savings > 0.04);
      const expenses = [...C.S.expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
      const cols = (pick) => hist.map((h) => ({ label: h.label, tip: `Semaine ${C.weekNo(h.wid)} · ${C.weekLabel(h.wid)}`, now: h.wid === wid, values: pick(h) }));

      root.innerHTML = `
        <header class="head"><div><p class="eyebrow">Budget alimentaire</p><h1 class="title">Budget</h1></div>
          <div class="head-a"><button class="btn" data-act="bud.add">${icon('plus', 18)} Noter une dépense</button></div></header>
        ${hasBudget ? '' : `<div class="note" style="margin-bottom:16px">${icon('info', 18)}<span>Aucun budget hebdomadaire n’est défini.</span><a class="btn btn--ghost btn--sm note-a" href="#/reglages">Définir un budget</a></div>`}

        <section class="grid g3">
          <div class="card"><p class="stat-l">Cette semaine · sem. ${C.weekNo(wid)}</p>
            <p class="stat-v">${C.chf(t.cost)}${hasBudget ? `<small>/ ${C.num(st.weeklyBudget, 0)}</small>` : ''}</p>
            ${bar(t.cost, st.weeklyBudget)}
            <p class="stat-s">Coût estimé de ${t.meals} repas planifié${t.meals > 1 ? 's' : ''}. Dépensé réellement : <b style="color:var(--ink)">${C.chf(spent)}</b></p></div>
          <div class="card"><p class="stat-l">Ce mois · ${esc(C.monthName(now))}</p>
            <p class="stat-v">${C.chf(m.planned)}${hasBudget ? `<small>/ ${C.num(m.budget, 0)}</small>` : ''}</p>
            ${bar(m.planned, m.budget)}
            <p class="stat-s">${hasBudget ? `Budget mensuel : ${C.chf(m.budget)} (hebdomadaire × 52 ÷ 12). ` : ''}Dépensé réellement : <b style="color:var(--ink)">${C.chf(m.spent)}</b></p></div>
          <div class="card span-t ${m.savings >= 0.05 ? 'card--citron' : ''}"><p class="stat-l">${icon('tag', 17)} Économies grâce aux promotions</p>
            <p class="stat-v">${C.chf(t.savings)}</p>
            <p class="stat-s">Cette semaine, par rapport aux prix habituels. Sur le mois : ${C.chf(m.savings)}.</p></div>
        </section>

        <section class="sec card">
          <div class="sec-h"><div><h2 class="h3">Dépenses par semaine</h2><p class="small muted">Huit dernières semaines, en CHF</p></div>
            <div class="legend"><span><i style="background:${S1}"></i>Planifié (estimation)</span><span><i style="background:${S2}"></i>Dépensé (saisi)</span>${hasBudget ? '<span><i class="dash"></i>Budget</span>' : ''}</div></div>
          ${
            anyHist
              ? `${C.bars({ cols: cols((h) => [h.planned, h.spent]), series: [{ name: 'Planifié', color: S1 }, { name: 'Dépensé', color: S2 }], ref: hasBudget ? { value: st.weeklyBudget, label: `Budget ${C.num(st.weeklyBudget, 0)}` } : null })}
                <details class="tbl"><summary>Voir les chiffres</summary><table class="t"><thead><tr><th>Semaine</th><th>Planifié</th><th>Dépensé</th><th>Économies promos</th></tr></thead><tbody>${hist.map((h) => `<tr><td>${h.label} · ${C.weekLabel(h.wid)}</td><td>${C.money(h.planned)}</td><td>${C.money(h.spent)}</td><td>${C.money(h.savings)}</td></tr>`).join('')}</tbody></table></details>`
              : '<p class="muted small" style="padding:26px 0 8px">Le graphique apparaîtra dès qu’une semaine contiendra des repas planifiés ou une dépense notée.</p>'
          }
        </section>

        <section class="sec grid g2">
          <div class="card"><div class="sec-h"><div><h2 class="h3">Répartition par rayon</h2><p class="small muted">Repas planifiés cette semaine</p></div></div>
            ${cats.length ? cats.map((c) => `<div class="hb"><span>${esc(c.name)}</span><div class="hb-t" title="${esc(c.name)} : ${C.chf(c.v)}"><i style="width:${(c.v / catMax) * 100}%"></i></div><span class="hb-v">${C.chf(c.v)}</span></div>`).join('') : '<p class="muted small" style="padding:14px 0">Aucun repas planifié cette semaine.</p>'}
          </div>
          <div class="card"><div class="sec-h"><div><h2 class="h3">Économies par semaine</h2><p class="small muted">Promotions appliquées aux repas planifiés, en CHF</p></div></div>
            ${anySave ? C.bars({ cols: cols((h) => [h.savings]), series: [{ name: 'Économies', color: S1 }] }) : '<p class="muted small" style="padding:14px 0">Pas encore d’économies enregistrées.</p>'}
          </div>
        </section>

        <section class="sec card">
          <div class="sec-h"><div><h2 class="h3">Dépenses réelles</h2><p class="small muted">Notez le montant de vos tickets de caisse pour comparer avec l’estimation.</p></div><button class="btn btn--ghost btn--sm" data-act="bud.add">${icon('plus', 16)} Noter</button></div>
          ${
            expenses.length
              ? `<div class="rows">${expenses.map((e) => `<div class="row"><span class="row-b"><span class="row-t">${esc(e.note || (e.store ? C.storeById(e.store).name : 'Courses'))}</span><span class="row-s">${C.fmtDate(e.date, { weekday: 'short', day: 'numeric', month: 'long' })}${e.store && e.note ? ` · ${C.storeById(e.store).name}` : ''}</span></span><span class="row-p">${C.chf(e.amount)}</span><button class="ibtn" data-act="bud.del" data-id="${e.id}" aria-label="Supprimer cette dépense">${icon('trash', 17)}</button></div>`).join('')}</div>${C.S.expenses.length > expenses.length ? `<p class="small muted" style="margin-top:10px">${C.S.expenses.length - expenses.length} dépenses plus anciennes sont conservées dans la sauvegarde.</p>` : ''}`
              : '<p class="muted small">Aucune dépense notée pour l’instant.</p>'
          }
        </section>`;
    },
  };

  Object.assign(C.acts, {
    'bud.add': () => {
      C.sheet({
        title: 'Noter une dépense',
        sub: 'Le montant réellement payé en magasin',
        body: `<form class="form" id="bud-form" novalidate>
          <div class="form-2">
            ${C.field('Montant (CHF)', `<input class="inp" name="amount" inputmode="decimal" required placeholder="0.00" autofocus>`)}
            ${C.field('Date', `<input class="inp" type="date" name="date" value="${C.today()}" max="${C.today()}">`)}
          </div>
          ${C.field('Magasin', `<select class="inp" name="store">${C.options([{ id: '', name: 'Non précisé' }, ...C.STORES], '')}</select>`)}
          ${C.field('Note', `<input class="inp" name="note" placeholder="facultatif — ex. grosses courses du samedi">`)}
        </form>`,
        foot: `<button class="btn btn--ghost" data-close>Annuler</button><button class="btn" type="submit" form="bud-form">Enregistrer</button>`,
        onMount(sheet) {
          const form = sheet.el.querySelector('#bud-form');
          form.onsubmit = (e) => {
            e.preventDefault();
            const d = C.formData(form);
            const amount = C.toNum(d.amount);
            if (!(amount > 0)) return C.toast('Indiquez un montant.');
            sheet.close();
            C.save.expense({ id: C.uid(), amount, date: d.date || C.today(), store: d.store, note: d.note.trim() });
            C.toast('Dépense enregistrée');
          };
        },
      });
    },
    'bud.del': (el) => {
      const e = C.S.expenses.find((x) => x.id === el.dataset.id);
      if (!e) return;
      C.save.delExpense(e.id);
      C.toast('Dépense supprimée', { label: 'Annuler', run: () => C.save.expense(e) });
    },
  });
})();
