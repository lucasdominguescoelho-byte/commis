/* Commis — Liste de courses : générée depuis le planning, regroupée, chiffrée, cochable.
   Un article coché reste barré 5 minutes (le temps de se rattraper), puis passe dans « Déjà acheté »,
   en bas : la liste ne montre que ce qui manque. */
(function () {
  'use strict';
  const C = window.C;
  const { esc, icon } = C;
  const E = C.eng;

  C.ui.shopBy = 'cat';
  const RANGE_APRES = 5 * 60 * 1000; // 5 minutes
  const range = (it) => it.checked && Date.now() - it.checkedAt >= RANGE_APRES;
  let minuterie = null;

  function groups(shop) {
    const out = new Map();
    const add = (id, name, it) => {
      if (!out.has(id)) out.set(id, { name, items: [], total: 0 });
      const g = out.get(id);
      g.items.push(it);
      g.total += it.cost;
    };
    if (C.ui.shopBy === 'store') {
      C.STORES.forEach((s) => shop.items.filter((it) => it.stores[0] === s.id).forEach((it) => add(s.id, it.manual ? s.name : `${s.name} — en promotion`, it)));
      shop.items.filter((it) => !it.stores.length).forEach((it) => add('none', 'Magasin habituel — sans promotion', it));
      // un même magasin peut avoir deux libellés (promo / ajout manuel) : on harmonise
      out.forEach((g, id) => { const s = C.storeById(id); if (s && g.items.some((it) => !it.manual)) g.name = `${s.name} — en promotion`; });
    } else {
      C.CATS.forEach((c) => shop.items.filter((it) => it.cat === c.id).forEach((it) => add(c.id, c.name, it)));
    }
    return [...out.values()];
  }

  function itemHtml(it, wid) {
    const pct = it.match ? E.pct(it.match.promo) : 0;
    const where = it.match
      ? it.stores.map((s) => `<span class="badge badge--promo">${C.storeById(s).name}${s === it.match.promo.store && pct ? ` −${pct}%` : ''}</span>`).join('')
      : it.stores.map(C.storeChip).join('');
    return `<div class="si ${it.checked ? 'is-done' : ''}" data-act="shop.toggle" data-wid="${wid}" data-key="${esc(it.key)}" role="checkbox" aria-checked="${it.checked}" tabindex="0">
      <span class="si-x">${icon('check', 15)}</span>
      <div style="min-width:0"><div class="si-n">${esc(it.name)}<small>${C.fmtQty(it.qty, it.unit)}</small>${it.inFridge ? `<span class="badge badge--frigo" title="${esc(it.inFridge.name)}">au frigo</span>` : ''}</div>${it.recipes.length ? `<div class="si-s">${esc(it.recipes.join(' · '))}</div>` : it.manual ? '<div class="si-s">Ajout manuel</div>' : ''}</div>
      <div class="si-w">${where}${it.manual ? `<button class="ibtn no-print" data-act="shop.edit" data-id="${it.manual.id}" aria-label="Modifier" style="width:32px;height:32px">${icon('edit', 16)}</button>` : ''}</div>
      <div class="si-p">${it.match && it.regular - it.cost >= 0.05 ? `<s>${C.money(it.regular)}</s>` : ''}${it.cost ? C.money(it.cost) : '—'}</div>
    </div>`;
  }

  C.views.courses = {
    render(root) {
      const wid = C.ui.week;
      const shop = E.shopping(wid);
      const n = shop.items.length;
      const achetes = shop.items.filter(range);
      const gs = groups({ ...shop, items: shop.items.filter((it) => !range(it)) });
      // les articles cochés à l'instant rejoindront « Déjà acheté » dans 5 minutes
      clearTimeout(minuterie);
      const prochains = shop.items.filter((it) => it.checked && !range(it)).map((it) => it.checkedAt + RANGE_APRES - Date.now());
      if (prochains.length) minuterie = setTimeout(() => C.route && C.route().view === 'courses' && C.render(), Math.max(1000, Math.min(...prochains) + 300));
      root.innerHTML = `
        <header class="head"><div><h1 class="title">Liste de courses</h1></div>
          <div class="head-a no-print">${C.weekNav(wid)}
            <button class="btn" data-act="shop.add">${icon('plus', 18)} Ajouter un produit</button></div></header>
        ${
          n
            ? `<div class="sum">
                <div class="sum-i"><span>Total estimé</span><b>${C.chf(shop.total)}</b></div>
                <div class="sum-i"><span>Économies promos</span><b>${C.chf(shop.savings)}</b></div>
                <div class="sum-i no-print"><span>Reste à acheter</span><b>${C.chf(shop.left)}</b></div>
                <div class="sum-i no-print"><span>Produits cochés</span><b>${shop.done} <small>/ ${n}</small></b></div>
                <div class="bar no-print"><i style="width:${(shop.done / n) * 100}%"></i></div>
              </div>
              <div class="toolbar no-print" style="justify-content:space-between;margin-bottom:0">
                <div class="seg"><button class="${C.ui.shopBy === 'cat' ? 'is-on' : ''}" data-act="shop.by" data-v="cat">Par rayon</button><button class="${C.ui.shopBy === 'store' ? 'is-on' : ''}" data-act="shop.by" data-v="store">Par magasin</button></div>
                <span class="chips" style="gap:14px">${shop.inFridge ? `<label class="check check--inline"><input type="checkbox" ${shop.deduct ? 'checked' : ''} data-change="shop.fridge"><span>Déduire le frigo (${shop.inFridge})</span></label>` : ''}${shop.done ? `<button class="link" data-act="shop.uncheck">Tout décocher</button>` : ''}</span>
              </div>
              ${gs.length ? `<div class="shop-cols">${gs.map((g) => `<section class="shop-g"><div class="shop-gh"><h3>${esc(g.name)}</h3><span>${g.items.length} produit${g.items.length > 1 ? 's' : ''} · ${C.chf(g.total)}</span></div>${g.items.map((it) => itemHtml(it, wid)).join('')}</section>`).join('')}</div>` : `<div class="empty shop-fini"><h2 class="h2">Tout est acheté</h2><p>Il ne manque plus rien pour les repas de la semaine.</p></div>`}
              ${achetes.length ? `<details class="shop-done" ${C.ui.shopDone ? 'open' : ''}><summary data-act="shop.doneToggle">${icon('check', 16)} Déjà acheté <span class="muted">(${achetes.length})</span></summary><div class="shop-done-l">${achetes.map((it) => itemHtml(it, wid)).join('')}</div><p class="small muted">Touchez un article pour le remettre dans la liste.</p></details>` : ''}
              <p class="small muted" style="margin-top:18px">Prix estimés d’après le coût indiqué dans vos recettes${shop.savings >= 0.05 ? ', promotions de la semaine déduites' : ''}. Les quantités identiques sont additionnées (g, kg, dl, l…).</p>`
            : `<div class="empty"><h2 class="h2">La liste est vide</h2><p>Elle se construit toute seule à partir des repas planifiés pour cette semaine.</p><a class="btn" href="#/planning">${icon('calendar', 18)} Ouvrir le planning</a></div>`
        }`;
    },
  };

  Object.assign(C.acts, {
    'shop.toggle': (el) => {
      const key = el.dataset.key;
      C.save.list(el.dataset.wid || C.ui.week, (l) => {
        if (l.checked[key]) delete l.checked[key];
        else l.checked[key] = Date.now(); // l'heure compte : 5 minutes plus tard, l'article est rangé
      });
    },
    'shop.uncheck': () => C.save.list(C.ui.week, (l) => { l.checked = {}; }),
    'shop.fridge': (el) => C.save.list(C.ui.week, (l) => { l.deductFridge = el.checked; }),
    'shop.by': (el) => { C.ui.shopBy = el.dataset.v; C.render(); },
    'shop.add': () => manualSheet(C.ui.week, null),
    'shop.edit': (el) => {
      const m = C.list(C.ui.week).manual.find((x) => x.id === el.dataset.id);
      if (m) manualSheet(C.ui.week, m);
    },
    'shop.del': (el) => {
      const wid = C.ui.week;
      C.closeSheet();
      C.save.list(wid, (l) => {
        l.manual = l.manual.filter((x) => x.id !== el.dataset.id);
        delete l.checked['m:' + el.dataset.id];
      });
      C.toast('Produit retiré de la liste');
    },
    'shop.doneToggle': (el, e) => {
      if (e) e.preventDefault();
      C.ui.shopDone = !C.ui.shopDone;
      el.parentNode.open = C.ui.shopDone;
    },
  });
})();
