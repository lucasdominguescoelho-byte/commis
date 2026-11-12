/* Commis — Recettes : bibliothèque, fiche détaillée, éditeur, ajout au planning. */
(function () {
  'use strict';
  const C = window.C;
  const { esc, icon } = C;
  const E = C.eng;

  C.ui.rf = { q: '', cat: '', time: 0, fav: false, promo: false };
  C.ui.rtab = 'mes'; // mes (validées) | tester | generer
  const inTab = (r) => (C.ui.rtab === 'tester' ? !r.validated : !!r.validated);
  C.ui.serv = {};

  // Lignes d'ingrédients (quantité, nom, promotion éventuelle, coût) — partagé avec le planning.
  C.ingLines = (c) =>
    c.lines
      .map((l) => {
        const pct = l.match ? E.pct(l.match.promo) : 0;
        return `<div class="ing"><span class="ing-q">${C.fmtQty(l.qty, l.ing.unit) || '—'}</span>
          <span class="ing-n">${esc(l.ing.name)}${E.fridgeFor(l.ing.name) ? '<span class="badge badge--frigo">au frigo</span>' : ''}${l.match ? `<span class="badge badge--promo" title="${esc(l.match.promo.name)}">${C.storeById(l.match.promo.store).name}${pct ? ` −${pct}%` : ''}</span>` : ''}</span>
          <span class="ing-c">${l.match && l.reg - l.cost >= 0.05 ? `<s>${C.money(l.reg)}</s>` : ''}${C.money(l.cost)}</span></div>`;
      })
      .join('');

  const conflictText = (bad) => bad.map((b) => b.label).join(', ');

  /* ---------- Liste ---------- */
  function filtered() {
    const f = C.ui.rf;
    const q = C.norm(f.q);
    const promos = E.activePromos(C.weekId());
    return C.S.recipes
      .filter(inTab)
      .map((r) => ({ r, c: E.recipeCost(r, r.servings, promos), bad: E.conflicts(r) }))
      .filter((x) => {
        if (f.cat && x.r.category !== f.cat) return false;
        if (f.time && x.r.prepTime > f.time) return false;
        if (f.fav && !x.r.favorite) return false;
        if (f.promo && !x.c.promoIngs.length) return false;
        if (q && !C.norm([x.r.name, x.r.description, x.r.category, ...x.r.ingredients.map((i) => i.name)].join(' ')).includes(q)) return false;
        return true;
      })
      .sort((a, b) => Number(b.r.favorite) - Number(a.r.favorite) || a.r.name.localeCompare(b.r.name, 'fr'));
  }
  function cards() {
    const rows = filtered();
    if (!rows.length) {
      if (C.S.recipes.some(inTab)) return `<div class="empty"><h2 class="h2">Aucune recette ne correspond</h2><p>Modifiez la recherche ou les filtres.</p></div>`;
      if (C.ui.rtab === 'tester')
        return `<div class="empty"><h2 class="h2">Rien à tester pour le moment</h2><p>Générez des idées avec les promotions de la semaine : elles attendent ici que vous les cuisiniez.</p><button class="btn btn--citron" data-act="rec.tab" data-v="generer">${icon('wand', 18)} Générer des recettes</button></div>`;
      return `<div class="empty"><h2 class="h2">Aucune recette validée</h2><p>Ici n’apparaissent que les recettes que vous avez cuisinées et approuvées. Testez celles de l’onglet « À tester », puis validez-les depuis leur fiche.</p><button class="btn" data-act="rec.tab" data-v="tester">Voir les recettes à tester</button></div>`;
    }
    return `<div class="cards">${rows
      .map(({ r, c, bad }) => {
        const n = c.promoIngs.length;
        return `<article class="rc" data-act="go" data-href="#/recettes/${r.id}" tabindex="0" role="link" aria-label="${esc(r.name)}">
          <div class="rc-v">${C.recipeVisual(r)}
            <button class="ibtn rc-fav ${r.favorite ? 'is-on' : ''}" data-act="rec.fav" data-id="${r.id}" aria-label="Favori" aria-pressed="${!!r.favorite}">${icon('heart', 18)}</button>
            <div class="rc-tags">${r.validated ? '' : `<span class="badge badge--soft">${['cabas', 'ia', 'wikilivres'].includes(r.source) ? 'Idée · ' : ''}à tester</span>`}${n ? `<span class="badge badge--promo">${n} en promo</span>` : ''}${bad.length ? `<span class="badge badge--warn" title="${esc(bad.map((b) => `${b.kind} : ${b.label} (${b.ing})`).join(' · '))}">${esc(conflictText(bad))}</span>` : ''}</div>
          </div>
          <div class="rc-b"><span class="eyebrow">${esc(r.category)}</span><h3 class="rc-n">${esc(r.name)}</h3>
            <div class="meta" style="margin-top:auto;padding-top:8px"><span>${icon('clock', 15)}${r.prepTime} min</span><span>${C.chf(c.cost / (r.servings || 1))} / pers.</span></div></div>
        </article>`;
      })
      .join('')}</div>`;
  }

  function list(root) {
    const f = C.ui.rf;
    const nMes = C.S.recipes.filter((r) => r.validated).length;
    const nTest = C.S.recipes.length - nMes;
    const tab = C.ui.rtab;
    const tabBtn = (v, label) => `<button role="tab" class="${tab === v ? 'is-on' : ''}" aria-selected="${tab === v}" data-act="rec.tab" data-v="${v}">${label}</button>`;
    const tabs = `<div class="seg seg--tabs" role="tablist">${tabBtn('mes', `Mes recettes <em>${nMes}</em>`)}${tabBtn('tester', `À tester <em>${nTest}</em>`)}${tabBtn('generer', `${icon('wand', 15)} Générer`)}</div>`;
    const sub = { mes: 'Testées et validées', tester: 'Pas encore cuisinées', generer: 'Idées avec les promotions du moment' }[tab];
    const head = `<header class="head"><div><p class="eyebrow">${sub}</p><h1 class="title">Recettes</h1></div>
        <div class="head-a"><button class="btn btn--ghost" data-act="rec.import" title="Ajouter des recettes depuis un fichier .json">${icon('upload', 18)} Importer</button><button class="btn ${tab === 'generer' ? 'btn--ghost' : ''}" data-act="rec.new">${icon('plus', 18)} Nouvelle recette</button></div></header>`;
    if (tab === 'generer') {
      root.innerHTML = head + tabs + '<div id="gen-root"></div>';
      C.generator.render(document.getElementById('gen-root'));
      return;
    }
    const cats = C.RCATS.map((c) => c.name).filter((n) => C.S.recipes.some((r) => inTab(r) && r.category === n));
    const chip = (label, on, attrs) => `<button class="chip ${on ? 'is-on' : ''}" ${attrs} aria-pressed="${!!on}">${label}</button>`;
    if (!C.S.recipes.some(inTab)) {
      root.innerHTML = `${head}${tabs}<div id="rec-grid">${cards()}</div>`;
      return;
    }
    root.innerHTML = `${head}${tabs}
      <div class="toolbar">
        <div class="search">${icon('search', 18)}<input class="inp" type="search" placeholder="Rechercher un plat, un ingrédient…" value="${esc(f.q)}" data-input="rec.search" aria-label="Rechercher"></div>
        <select class="inp" data-change="rec.time" aria-label="Temps de préparation">${C.options([{ id: 0, name: 'Tous les temps' }, { id: 20, name: '20 min ou moins' }, { id: 30, name: '30 min ou moins' }, { id: 45, name: '45 min ou moins' }], f.time)}</select>
        ${chip(`${icon('heart', 15)} Favoris`, f.fav, 'data-act="rec.toggle" data-k="fav"')}
        ${chip('En promotion', f.promo, 'data-act="rec.toggle" data-k="promo"')}
      </div>
      <div class="chips scroll-x" style="margin-bottom:22px">${chip('Toutes', !f.cat, 'data-act="rec.cat" data-cat=""')}${cats.map((n) => chip(esc(n), f.cat === n, `data-act="rec.cat" data-cat="${esc(n)}"`)).join('')}</div>
      <div id="rec-grid">${cards()}</div>`;
  }

  /* ---------- Fiche ---------- */
  function detail(root, id) {
    const r = C.recipe(id);
    if (!r) {
      root.innerHTML = `<a class="back" href="#/recettes">${icon('left', 16)} Recettes</a><div class="empty"><h2 class="h2">Recette introuvable</h2><p>Elle a peut-être été supprimée.</p></div>`;
      return;
    }
    const people = C.ui.serv[id] || C.S.settings.household || r.servings;
    const c = E.recipeCost(r, people, E.activePromos(C.weekId()));
    const bad = E.conflicts(r);
    const fromIa = r.source === 'cabas' || r.source === 'ia';
    const fromLib = r.source === 'wikilivres';
    const fromBook = r.source === 'livre-perso';
    root.innerHTML = `
      <a class="back" href="#/recettes" data-act="rec.back" data-v="${r.validated ? 'mes' : 'tester'}">${icon('left', 16)} ${r.validated ? 'Mes recettes' : 'À tester'}</a>
      ${r.validated ? '' : `<div class="note note--test">${icon('info', 18)}<span><b>Recette à tester.</b> ${fromLib ? 'Tirée du Livre de cuisine de Wikilivres. ' : ''}${fromBook ? 'Importée de votre livre de recettes : prix estimés, cuissons à vérifier. ' : ''}${fromIa ? `Composée par Commis avec les promotions${r.ingredients.some((i) => i.frigo) ? ' et votre frigo' : ''}. ` : ''}Une fois cuisinée, validez-la pour la ranger dans « Mes recettes », ou supprimez-la si elle ne vous a pas plu.</span><button class="btn btn--citron btn--sm note-a" data-act="rec.validate" data-id="${r.id}">${icon('check', 16)} Testée, je valide</button></div>`}
      <div class="rd">
        <div>
          <div class="rd-v">${C.recipeVisual(r)}</div>
          <section class="sec"><h2 class="h2" style="margin-bottom:18px">Préparation</h2>
            ${r.steps.length ? `<ol class="steps">${r.steps.map((s) => `<li><span>${esc(s)}</span></li>`).join('')}</ol>` : '<p class="muted">Aucune étape renseignée.</p>'}
            ${r.sourceUrl ? `<p class="small muted" style="margin-top:20px">Recette adaptée de <a class="link" href="${esc(r.sourceUrl)}" target="_blank" rel="noopener">« ${esc(r.name)} », Livre de cuisine de Wikilivres</a>, contributeurs de Wikilivres, licence <a class="link" href="https://creativecommons.org/licenses/by-sa/4.0/deed.fr" target="_blank" rel="noopener">CC BY-SA 4.0</a>${r.photo ? ' ; photo : Wikimedia Commons' : ''}.</p>` : ''}
          </section>
        </div>
        <div class="rd-side">
          <div>
            <p class="eyebrow">${esc(r.category)}${r.demo ? ' · recette d’exemple' : fromIa ? ' · idée générée' : fromLib ? ' · Livre de cuisine Wikilivres' : fromBook ? ' · votre livre de recettes' : ''}${r.validated ? ' · validée' : ''}</p>
            <h1 class="title" style="font-size:clamp(32px,3.6vw,46px)">${esc(r.name)}</h1>
            ${r.description ? `<p class="lede">${esc(r.description)}</p>` : ''}
            <div class="meta" style="margin-top:14px"><span>${icon('clock', 16)}${r.prepTime} min</span><span>${icon('users', 16)}${r.servings} portions de base</span></div>
            ${bad.length ? `<p style="margin-top:12px"><span class="badge badge--warn">Ne respecte pas vos préférences : ${esc(bad.map((b) => `${b.label} (${b.ing.toLowerCase()})`).join(', '))}</span></p>` : ''}
            <div class="head-a" style="margin-top:18px">
              <button class="btn btn--citron" data-act="rec.plan" data-id="${r.id}">${icon('calendar', 18)} Planifier</button>
              <button class="ibtn ibtn--line ${r.favorite ? 'is-on' : ''}" data-act="rec.fav" data-id="${r.id}" aria-label="Favori" aria-pressed="${!!r.favorite}">${icon('heart')}</button>
              <button class="ibtn ibtn--line" data-act="rec.edit" data-id="${r.id}" aria-label="Modifier">${icon('edit')}</button>
              <button class="ibtn ibtn--line" data-act="rec.del" data-id="${r.id}" aria-label="Supprimer">${icon('trash')}</button>
            </div>
          </div>
          <div class="card">
            <div class="sec-h" style="align-items:center"><h2 class="h3">Ingrédients</h2>
              <div class="step"><button data-act="rec.serv" data-id="${r.id}" data-d="-1" aria-label="Moins">${icon('minus', 16)}</button><b>${people}</b><button data-act="rec.serv" data-id="${r.id}" data-d="1" aria-label="Plus">${icon('plus', 16)}</button><span>pers.</span></div></div>
            ${C.ingLines(c)}
            <div class="total"><span>Coût estimé<br><small class="muted">${C.chf(c.cost / people)} par personne${c.savings >= 0.05 ? ` · ${C.chf(c.savings)} d’économie` : ''}</small></span><b>${C.chf(c.cost)}</b></div>
          </div>
          <div class="note">${icon('tag', 18)}<div>${
            c.stores.length
              ? `<b>En promotion cette semaine chez</b><div class="chips" style="margin-top:8px;gap:14px">${c.stores.map(C.storeChip).join('')}</div>`
              : 'Aucun ingrédient de cette recette n’est en promotion cette semaine dans vos magasins.'
          }</div></div>
        </div>
      </div>`;
  }

  C.views.recettes = { render: (root, id) => (id ? detail(root, id) : list(root)) };

  /* ---------- Éditeur ---------- */
  const ingRow = (x = {}) => `<div class="ed-row">
      <input class="inp" name="ing-name" placeholder="Ingrédient" value="${esc(x.name || '')}" aria-label="Ingrédient">
      <input class="inp" name="ing-qty" inputmode="decimal" placeholder="Qté" value="${x.qty || ''}" aria-label="Quantité">
      <select class="inp" name="ing-unit" aria-label="Unité">${C.options(C.UNITS, x.unit || 'g')}</select>
      <select class="inp" name="ing-cat" aria-label="Rayon">${C.options(C.CATS, x.cat || 'epi')}</select>
      <input class="inp" name="ing-price" inputmode="decimal" placeholder="CHF" value="${x.price != null ? x.price : ''}" aria-label="Coût estimé">
      <button type="button" class="ibtn" data-act="rec.ingDel" aria-label="Retirer cet ingrédient">${icon('x', 18)}</button></div>`;

  function editor(r) {
    const isNew = !r;
    r = r || { validated: true, source: 'manuel', id: C.uid(), name: '', description: '', category: 'Autre', prepTime: 30, servings: 4, ingredients: [{}, {}, {}], steps: [], favorite: false, photo: '', createdAt: Date.now() };
    C.sheet({
      title: isNew ? 'Nouvelle recette' : 'Modifier la recette',
      size: 'wide',
      body: `<form class="form" id="rec-form" novalidate>
        ${C.field('Nom', `<input class="inp" name="name" required value="${esc(r.name)}" placeholder="Ex. Gratin de courge" autofocus>`)}
        ${C.field('Description', `<textarea class="inp" name="description" rows="2" placeholder="Une phrase pour s'en souvenir">${esc(r.description)}</textarea>`)}
        <div class="form-3">
          ${C.field('Catégorie', `<select class="inp" name="category">${C.options(C.RCATS.map((c) => c.name), r.category)}</select>`)}
          ${C.field('Préparation (min)', `<input class="inp" name="prepTime" type="number" min="1" max="600" value="${r.prepTime}">`)}
          ${C.field('Portions', `<input class="inp" name="servings" type="number" min="1" max="24" value="${r.servings}">`)}
        </div>
        ${C.photoField()}
        <label class="check"><input type="checkbox" name="validated" ${r.validated !== false ? 'checked' : ''}><span><b>Je l’ai testée et je la valide</b><small>Décochée, la recette reste dans « À tester ».</small></span></label>
        <div class="field"><span>Ingrédients</span>
          <div class="ed-rows" id="ed-rows">
            <div class="ed-row ed-head"><span>Nom</span><span>Quantité</span><span>Unité</span><span>Rayon</span><span>Coût (CHF)</span><span></span></div>
            ${r.ingredients.map(ingRow).join('')}
          </div>
          <div><button type="button" class="btn btn--ghost btn--sm" data-act="rec.ingAdd" style="margin-top:6px">${icon('plus', 16)} Ajouter un ingrédient</button></div>
          <small>Le coût est une estimation, au prix habituel, pour la quantité indiquée. Il sert à calculer le budget et les économies.</small>
        </div>
        ${C.field('Étapes de préparation', `<textarea class="inp" name="steps" rows="6" placeholder="Une étape par ligne">${esc(r.steps.join('\n'))}</textarea>`, 'Une étape par ligne.')}
      </form>`,
      foot: `<button class="btn btn--ghost" data-close>Annuler</button><button class="btn" type="submit" form="rec-form">${isNew ? 'Ajouter la recette' : 'Enregistrer'}</button>`,
      onMount(sheet) {
        const form = sheet.el.querySelector('#rec-form');
        const photo = C.wirePhoto(form, r.photo, `<div class="ph ph--sm" style="--h:${C.recipeHue(r)}"><span>${icon('upload', 18)}</span></div>`);
        form.onsubmit = (e) => {
          e.preventDefault();
          const fd = new FormData(form);
          const name = String(fd.get('name')).trim();
          if (!name) {
            form.elements.name.focus();
            return C.toast('Donnez un nom à la recette.');
          }
          const names = fd.getAll('ing-name');
          const ingredients = names
            .map((n, i) => ({ name: String(n).trim(), qty: C.toNum(fd.getAll('ing-qty')[i]), unit: fd.getAll('ing-unit')[i], cat: fd.getAll('ing-cat')[i], price: C.toNum(fd.getAll('ing-price')[i]) }))
            .filter((x) => x.name);
          if (!ingredients.length) return C.toast('Ajoutez au moins un ingrédient.');
          const saved = {
            ...r,
            name,
            description: String(fd.get('description')).trim(),
            category: fd.get('category'),
            prepTime: Math.max(1, Math.round(C.toNum(fd.get('prepTime'))) || 30),
            servings: Math.max(1, Math.round(C.toNum(fd.get('servings'))) || 4),
            photo: photo(),
            ingredients,
            steps: String(fd.get('steps')).split('\n').map((s) => s.trim()).filter(Boolean),
            validated: fd.get('validated') === 'on',
            demo: false,
          };
          sheet.close();
          C.save.recipe(saved);
          C.toast(isNew ? 'Recette ajoutée' : 'Recette enregistrée');
          if (isNew) C.go('#/recettes/' + saved.id);
        };
      },
    });
  }

  /* ---------- Ajout au planning depuis une fiche ---------- */
  function planSheet(id) {
    const r = C.recipe(id);
    if (!r) return;
    C.ui.planWeek = C.ui.planWeek || C.weekId();
    const now = C.weekId();
    const next = C.shiftWeek(now, 1);
    C.sheet({
      title: 'Planifier ce repas',
      sub: esc(r.name),
      body: () => {
        const wid = C.ui.planWeek;
        const plan = C.S.plans[wid];
        const today = C.today();
        return `<div class="seg" style="margin-bottom:14px"><button class="${wid === now ? 'is-on' : ''}" data-act="rec.planWeek" data-w="${now}">Cette semaine</button><button class="${wid === next ? 'is-on' : ''}" data-act="rec.planWeek" data-w="${next}">Semaine prochaine</button></div>
          <div class="slotgrid">${C.DAYS.map((_, d) => {
            const cell = (slot) => {
              const s = plan && plan.slots[`${d}-${slot}`];
              const cur = s && C.recipe(s.recipeId);
              return `<button class="${cur ? '' : 'is-free'}" data-act="rec.planPick" data-id="${r.id}" data-key="${d}-${slot}" ${C.dayIso(wid, d) < today ? 'style="opacity:.5"' : ''}><small>${C.SLOT_LABEL[slot]}</small>${cur ? esc(cur.name) : 'Libre'}</button>`;
            };
            return `<span class="d">${C.DAYS_S[d]} ${C.parse(C.dayIso(wid, d)).getDate()}</span>${cell('midi')}${cell('soir')}`;
          }).join('')}</div>
          <p class="small muted" style="margin-top:12px">Choisir une case déjà occupée remplace le repas prévu.</p>`;
      },
    });
  }

  /* ---------- Actions ---------- */
  const regrid = () => {
    const g = document.getElementById('rec-grid');
    if (g) g.innerHTML = cards();
  };
  Object.assign(C.acts, {
    'rec.search': (el) => { C.ui.rf.q = el.value; regrid(); },
    'rec.time': (el) => { C.ui.rf.time = Number(el.value); regrid(); },
    'rec.toggle': (el) => { C.ui.rf[el.dataset.k] = !C.ui.rf[el.dataset.k]; C.render(); },
    'rec.cat': (el) => { C.ui.rf.cat = el.dataset.cat; C.render(); },
    'rec.fav': (el) => {
      const r = C.recipe(el.dataset.id);
      if (r) C.save.recipe({ ...r, favorite: !r.favorite });
    },
    'rec.new': () => editor(null),
    'rec.import': async () => {
      const file = await C.pickFile('.json,application/json');
      if (!file) return;
      let data;
      try {
        data = JSON.parse(await file.text());
      } catch (e) {
        return C.toast('Fichier illisible : ce n’est pas du JSON valide.');
      }
      const list = C.recipesIn(data);
      if (!list) return C.toast('Ce fichier ne contient pas de recettes Commis.');
      const have = new Set(C.S.recipes.map((r) => r.id));
      const n = list.filter((r) => r && r.id && !have.has(r.id)).length;
      if (!n) return C.toast('Ces recettes sont déjà dans Commis.');
      if (!(await C.confirm(`Ajouter ${n} recette${n > 1 ? 's' : ''} ?`, `Elles arrivent dans « À tester » ; vos recettes actuelles ne changent pas.${list.length > n ? ` ${list.length - n} déjà présente${list.length - n > 1 ? 's' : ''} ser${list.length - n > 1 ? 'ont' : 'a'} ignorée${list.length - n > 1 ? 's' : ''}.` : ''}`, 'Ajouter'))) return;
      try {
        const res = await C.importRecipes(data);
        C.ui.rtab = 'tester';
        C.ui.rf.cat = '';
        C.render();
        C.toast(`${res.added} recette${res.added > 1 ? 's' : ''} ajoutée${res.added > 1 ? 's' : ''} à « À tester »`);
      } catch (e) {
        C.toast(e.message);
      }
    },
    'rec.tab': (el) => {
      C.ui.rtab = el.dataset.v;
      C.ui.rf.cat = '';
      if (location.hash.startsWith('#/recettes/') || !location.hash.startsWith('#/recettes')) C.go('#/recettes');
      else C.render();
    },
    'rec.back': (el, e) => {
      C.ui.rtab = el.dataset.v;
    },
    'rec.validate': (el) => {
      const r = C.recipe(el.dataset.id);
      if (!r) return;
      C.save.recipe({ ...r, validated: true, validatedAt: C.today() });
      C.toast('Recette validée : elle rejoint « Mes recettes »', { label: 'Annuler', run: () => C.save.recipe({ ...r }) });
    },
    'rec.edit': (el) => editor(C.recipe(el.dataset.id)),
    'rec.del': async (el) => {
      const r = C.recipe(el.dataset.id);
      if (!r) return;
      if (!(await C.confirm('Supprimer cette recette ?', `« ${esc(r.name)} » sera retirée de la bibliothèque et des plannings où elle figure.`))) return;
      C.save.delRecipe(r.id);
      C.toast('Recette supprimée', { label: 'Annuler', run: () => C.save.recipe(r) });
      C.go('#/recettes');
    },
    'rec.serv': (el) => {
      const id = el.dataset.id;
      const r = C.recipe(id);
      const cur = C.ui.serv[id] || C.S.settings.household || r.servings;
      C.ui.serv[id] = Math.max(1, Math.min(24, cur + Number(el.dataset.d)));
      C.render();
    },
    'rec.ingAdd': () => {
      const rows = document.getElementById('ed-rows');
      rows.insertAdjacentHTML('beforeend', ingRow());
      rows.lastElementChild.querySelector('input').focus();
    },
    'rec.ingDel': (el) => el.closest('.ed-row').remove(),
    'rec.plan': (el) => planSheet(el.dataset.id),
    'rec.planWeek': (el) => {
      C.ui.planWeek = el.dataset.w;
      C.sheets[C.sheets.length - 1].refresh();
    },
    'rec.planPick': (el) => {
      const wid = C.ui.planWeek;
      const [d, slot] = el.dataset.key.split('-');
      const id = el.dataset.id;
      C.closeSheet();
      C.save.plan(wid, (slots) => {
        slots[el.dataset.key] = { recipeId: id, servings: C.ui.serv[id] || C.S.settings.household || 2 };
      });
      C.toast(`Ajouté : ${C.DAYS[Number(d)].toLowerCase()} ${slot}`, { label: 'Voir le planning', run: () => { C.ui.week = wid; C.go('#/planning'); } });
    },
  });
})();
