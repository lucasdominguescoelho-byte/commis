/* Cabas — Promotions : vraies promotions synchronisées (Lidl, Migros, Coop), filtres, recherche,
   saisie manuelle et import JSON. La synchronisation elle-même est dans js/sources.js. */
(function () {
  'use strict';
  const C = window.C;
  const { esc, icon } = C;
  const E = C.eng;
  const PAGE = 48;

  C.px = (n) => (Number(n) || 0).toFixed(2); // prix affiché tel que publié (sans arrondi aux 5 centimes)
  C.ui.pf = { store: '', cat: '', expired: false, q: '', linked: false, shown: PAGE };

  const validity = (p) => {
    const st = E.promoState(p);
    if (st === 'expired') return `Expirée le ${C.fmtDate(p.validTo, { day: 'numeric', month: 'short' })}`;
    if (st === 'upcoming') return `Dès le ${C.fmtDate(p.validFrom)}`;
    if (!p.validTo) return 'Sans date de fin';
    return p.approxDates ? `Jusqu’au ${C.fmtDate(p.validTo)} env.` : `Jusqu’au ${C.fmtDate(p.validTo)}`;
  };
  const priceHtml = (p) =>
    p.promoPrice
      ? `<b><small>CHF</small>${C.px(p.promoPrice)}</b>${p.regularPrice ? `<s>${C.px(p.regularPrice)}</s>` : ''}`
      : `<b>−${E.pct(p)}%</b><span class="pc-u">selon l’article</span>`;
  const sub = (p) => [p.brand, p.origName && p.origName !== p.name ? p.origName : ''].filter(Boolean).join(' · ');

  function card(p) {
    const pct = E.pct(p);
    const n = E.recipesForPromo(p).length;
    return `<article class="pc ${E.promoState(p) === 'active' ? '' : 'is-off'}" data-act="promo.edit" data-id="${p.id}" tabindex="0" role="button" aria-label="${esc(p.name)}, ${C.storeById(p.store).name}">
      <div class="pc-v">${pct ? `<span class="pc-pct">−${pct}%</span>` : ''}${C.promoVisual(p)}</div>
      <div class="pc-b">
        <div class="pc-top">${C.storeChip(p.store)}${p.auto ? '' : '<span class="badge badge--demo">Saisie</span>'}</div>
        <div class="pc-n">${esc(p.name)}</div>
        ${sub(p) ? `<div class="pc-o">${esc(sub(p))}</div>` : ''}
        <div class="pc-u">${[p.unitLabel, p.note].filter(Boolean).map(esc).join(' · ')}</div>
        <div class="price">${priceHtml(p)}</div>
        <div class="pc-f"><span>${validity(p)}</span><span>${n ? `${n} recette${n > 1 ? 's' : ''}` : ''}</span></div>
      </div></article>`;
  }

  function filtered() {
    const f = C.ui.pf;
    const q = C.norm(f.q);
    return C.S.promotions
      .filter((p) => f.expired || E.promoState(p) !== 'expired')
      .filter((p) => (!f.store || p.store === f.store) && (!f.cat || p.category === f.cat))
      .filter((p) => !q || C.norm([p.name, p.origName, p.brand, p.match].join(' ')).includes(q))
      .filter((p) => !f.linked || E.recipesForPromo(p).length)
      .sort((a, b) => (E.promoState(a) === 'expired') - (E.promoState(b) === 'expired') || E.pct(b) - E.pct(a) || a.name.localeCompare(b.name, 'fr'));
  }
  function grid() {
    const f = C.ui.pf;
    const rows = filtered();
    if (!rows.length)
      return `<div class="empty"><h2 class="h2">${C.S.promotions.length ? 'Aucune promotion pour ces filtres' : 'Aucune promotion pour le moment'}</h2><p>${C.S.promotions.length ? 'Essayez un autre magasin, un autre rayon ou une autre recherche.' : syncHint()}</p></div>`;
    return `<p class="small muted" style="margin-bottom:12px">${rows.length} promotion${rows.length > 1 ? 's' : ''}</p>
      <div class="cards">${rows.slice(0, f.shown).map(card).join('')}</div>
      ${rows.length > f.shown ? `<div style="text-align:center;margin-top:20px"><button class="btn btn--ghost" data-act="promo.more">Afficher ${Math.min(PAGE, rows.length - f.shown)} de plus</button></div>` : ''}`;
  }
  function syncHint() {
    if (location.protocol === 'file:') return 'Les promotions se chargent quand Cabas est ouvert depuis son adresse (en ligne ou avec « Ouvrir Cabas.command »), pas en double-cliquant sur index.html.';
    return 'Les promotions n’ont pas encore pu être chargées. Vérifiez la connexion puis touchez « Actualiser ».';
  }
  // État de la synchronisation : date et nombre de promotions par magasin.
  function status() {
    const m = C.S.settings.promoMeta;
    if (!m) return '';
    const when = new Date(m.generatedAt);
    const parts = C.STORES.map((s) => {
      const src = (m.sources || {})[s.id];
      if (!src) return '';
      return `<span class="store"><i style="background:${s.color}"></i>${s.name} ${src.ok ? src.count : `<span class="badge badge--warn" title="${esc(src.error || '')}">indisponible</span>`}</span>`;
    }).join('');
    return `<div class="sync"><span>${icon('check', 16)} Mises à jour ${C.fmtDate(C.iso(when), { weekday: 'long', day: 'numeric', month: 'long' })} à ${String(when.getHours()).padStart(2, '0')}h${String(when.getMinutes()).padStart(2, '0')}</span>${parts}</div>`;
  }

  C.views.promotions = {
    render(root) {
      const f = C.ui.pf;
      const all = C.S.promotions;
      const live = all.filter((p) => E.promoState(p) !== 'expired');
      const expired = all.length - live.length;
      const chip = (label, on, attrs) => `<button class="chip ${on ? 'is-on' : ''}" ${attrs} aria-pressed="${!!on}">${label}</button>`;
      const off = C.STORES.filter((s) => !C.S.settings.stores.includes(s.id)).map((s) => s.name);

      root.innerHTML = `
        <header class="head"><div><p class="eyebrow">${live.length} promotion${live.length > 1 ? 's' : ''} en cours ou à venir</p><h1 class="title">Promotions</h1></div>
          <div class="head-a">
            <button class="btn btn--ghost" data-act="promo.sync">Actualiser</button>
            <button class="ibtn ibtn--line" data-act="promo.import" aria-label="Importer un fichier" title="Importer un fichier JSON">${icon('upload')}</button>
            <button class="btn" data-act="promo.new">${icon('plus', 18)} Ajouter</button></div></header>
        ${status()}
        <div class="toolbar">
          <div class="search">${icon('search', 18)}<input class="inp" type="search" placeholder="Rechercher : saumon, gruyère, pâtes…" value="${esc(f.q)}" data-input="promo.search" aria-label="Rechercher une promotion"></div>
          ${chip('Pour mes recettes', f.linked, 'data-act="promo.linked"')}
        </div>
        <div class="chips scroll-x" style="margin-bottom:8px">${chip('Tous les magasins', !f.store, 'data-act="promo.store" data-v=""')}${C.STORES.map((s) => chip(`<i style="background:${s.color}"></i>${s.name}`, f.store === s.id, `data-act="promo.store" data-v="${s.id}"`)).join('')}</div>
        <div class="chips scroll-x" style="margin-bottom:22px">${chip('Tous les rayons', !f.cat, 'data-act="promo.cat" data-v=""')}${C.CATS.filter((c) => all.some((p) => p.category === c.id)).map((c) => chip(esc(c.name), f.cat === c.id, `data-act="promo.cat" data-v="${c.id}"`)).join('')}${expired ? chip(`Expirées (${expired})`, f.expired, 'data-act="promo.expired"') : ''}</div>
        <div id="promo-grid">${grid()}</div>
        <p class="small muted" style="margin-top:22px">Sources : site de Lidl Suisse ; Migros et Coop via aktionis.ch (noms traduits de l’allemand). Les prix et dates viennent de ces pages${off.length ? ` · ${esc(off.join(', '))} exclu${off.length > 1 ? 's' : ''} des calculs (<a class="link" href="#/reglages">Réglages</a>)` : ''}.</p>`;
    },
  };

  /* ---------- Fiche d'une promotion synchronisée (lecture seule) ---------- */
  function detail(p) {
    const used = E.recipesForPromo(p);
    const row = (a, b) => (b ? `<div class="row"><span class="row-b muted">${a}</span><span class="row-p" style="font-weight:500">${b}</span></div>` : '');
    C.sheet({
      title: p.name,
      sub: [C.storeById(p.store).name, sub(p)].filter(Boolean).map(esc).join(' · '),
      body: `<div class="pd-v">${E.pct(p) ? `<span class="pc-pct">−${E.pct(p)}%</span>` : ''}${C.promoVisual(p)}</div>
        <div class="price" style="margin:16px 0 6px">${priceHtml(p)}</div>
        <div class="rows card" style="padding:14px 18px;margin:12px 0">
          ${row('Conditionnement', esc(p.unitLabel))}
          ${row('Validité', validity(p))}
          ${row('Rayon', esc(C.catById(p.category).name))}
          ${row('Conditions', esc(p.note))}
        </div>
        ${used.length ? `<div class="field"><span>Utile pour</span><div class="chips">${used.map((r) => `<a class="chip" href="#/recettes/${r.id}">${esc(r.name)}</a>`).join('')}</div></div>` : `<p class="small muted">${p.match ? 'Aucune de vos recettes n’utilise ce produit.' : 'Produit non relié aux recettes (non reconnu automatiquement).'}</p>`}
        ${p.approxDates ? '<p class="small muted" style="margin-top:12px">La source ne donne pas de date de fin : celle-ci est estimée (fin de semaine).</p>' : ''}`,
      foot: `${p.url ? `<a class="btn btn--ghost sp" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Voir la source</a>` : ''}<button class="btn" data-close>Fermer</button>`,
    });
  }

  /* ---------- Saisie / modification ---------- */
  function editor(p) {
    const isNew = !p;
    const wid = C.weekId();
    p = p || { id: C.uid(), name: '', store: C.S.settings.stores[0] || 'migros', category: 'fl', promoPrice: '', regularPrice: '', unitLabel: '', validFrom: C.today(), validTo: C.dayIso(wid, 5) < C.today() ? C.dayIso(wid, 6) : C.dayIso(wid, 5), match: '', photo: '', demo: false, source: 'manual' };
    const used = isNew ? [] : E.recipesForPromo(p);
    C.sheet({
      title: isNew ? 'Nouvelle promotion' : p.name,
      sub: isNew ? 'Saisie manuelle' : `${C.storeById(p.store).name} · ${validity(p)}`,
      body: `<form class="form" id="promo-form" novalidate>
        ${C.field('Produit', `<input class="inp" name="name" required value="${esc(p.name)}" placeholder="Ex. Filet de saumon" ${isNew ? 'autofocus' : ''}>`)}
        <div class="form-2">
          ${C.field('Magasin', `<select class="inp" name="store">${C.options(C.STORES, p.store)}</select>`)}
          ${C.field('Rayon', `<select class="inp" name="category">${C.options(C.CATS, p.category)}</select>`)}
        </div>
        <div class="form-3">
          ${C.field('Prix promo (CHF)', `<input class="inp" name="promoPrice" inputmode="decimal" required value="${p.promoPrice}" placeholder="0.00">`)}
          ${C.field('Prix habituel', `<input class="inp" name="regularPrice" inputmode="decimal" value="${p.regularPrice || ''}" placeholder="facultatif">`)}
          ${C.field('Conditionnement', `<input class="inp" name="unitLabel" value="${esc(p.unitLabel || '')}" placeholder="500 g, le kg…">`)}
        </div>
        <div class="form-2">
          ${C.field('Valable du', `<input class="inp" type="date" name="validFrom" value="${esc(p.validFrom || '')}">`)}
          ${C.field('au', `<input class="inp" type="date" name="validTo" value="${esc(p.validTo || '')}">`)}
        </div>
        ${C.field('Ingrédient concerné', `<input class="inp" name="match" value="${esc(p.match || '')}" placeholder="Ex. saumon">`, 'Mot-clé qui relie la promotion aux ingrédients de vos recettes. Laissé vide, le nom du produit est utilisé.')}
        ${C.photoField()}
        ${used.length ? `<div class="field"><span>Recettes concernées</span><div class="chips">${used.map((r) => `<a class="chip" href="#/recettes/${r.id}">${esc(r.name)}</a>`).join('')}</div></div>` : ''}
      </form>`,
      foot: `${isNew ? '' : `<button class="btn btn--ghost sp" data-act="promo.del" data-id="${p.id}">${icon('trash', 17)} Supprimer</button>`}<button class="btn btn--ghost" data-close>Annuler</button><button class="btn" type="submit" form="promo-form">${isNew ? 'Ajouter' : 'Enregistrer'}</button>`,
      onMount(sheet) {
        const form = sheet.el.querySelector('#promo-form');
        const photo = C.wirePhoto(form, p.photo, `<div class="ph ph--sm" style="--h:${C.catById(p.category).hue}"><span>${icon('upload', 18)}</span></div>`);
        form.onsubmit = (e) => {
          e.preventDefault();
          const d = C.formData(form);
          const name = d.name.trim();
          const promoPrice = C.toNum(d.promoPrice);
          if (!name) return C.toast('Indiquez le nom du produit.');
          if (!(promoPrice > 0)) return C.toast('Indiquez le prix promotionnel.');
          if (d.validFrom && d.validTo && d.validTo < d.validFrom) return C.toast('La date de fin précède la date de début.');
          sheet.close();
          C.save.promo({
            ...p,
            name,
            store: d.store,
            category: d.category,
            promoPrice,
            regularPrice: C.toNum(d.regularPrice) || null,
            unitLabel: d.unitLabel.trim(),
            validFrom: d.validFrom,
            validTo: d.validTo,
            match: d.match.trim() || name,
            photo: photo(),
            demo: false,
            auto: false,
            source: p.source && p.source !== 'demo' ? p.source : 'manual',
          });
          C.toast(isNew ? 'Promotion ajoutée' : 'Promotion enregistrée');
        };
      },
    });
  }

  Object.assign(C.acts, {
    'promo.store': (el) => { C.ui.pf.store = el.dataset.v; C.ui.pf.shown = PAGE; C.render(); },
    'promo.cat': (el) => { C.ui.pf.cat = el.dataset.v; C.ui.pf.shown = PAGE; C.render(); },
    'promo.expired': () => { C.ui.pf.expired = !C.ui.pf.expired; C.render(); },
    'promo.new': () => editor(null),
    'promo.edit': (el) => {
      const p = C.S.promotions.find((x) => x.id === el.dataset.id);
      if (p) (p.auto ? detail : editor)(p);
    },
    'promo.search': (el) => {
      C.ui.pf.q = el.value;
      C.ui.pf.shown = PAGE;
      const g = document.getElementById('promo-grid');
      if (g) g.innerHTML = grid();
    },
    'promo.linked': () => { C.ui.pf.linked = !C.ui.pf.linked; C.ui.pf.shown = PAGE; C.render(); },
    'promo.more': () => {
      C.ui.pf.shown += PAGE;
      const g = document.getElementById('promo-grid');
      if (g) g.innerHTML = grid();
    },
    'promo.del': (el) => {
      const p = C.S.promotions.find((x) => x.id === el.dataset.id);
      if (!p) return;
      C.closeSheet();
      C.save.delPromo(p.id);
      C.toast('Promotion supprimée', { label: 'Annuler', run: () => C.save.promo(p) });
    },
    'promo.clearDemo': async () => {
      if (!(await C.confirm('Retirer les promotions de démonstration ?', 'Seules les promotions fictives marquées « Démo » sont supprimées. Vos saisies et vos imports sont conservés.', 'Retirer la démo'))) return;
      C.removeDemo('promotions');
      C.toast('Promotions de démonstration retirées');
    },
    'promo.import': async () => {
      const file = await C.pickFile('.json,application/json');
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        const res = C.sources.normalize(Array.isArray(data) ? data : data.promotions, 'import');
        if (!res.ok.length) return C.toast('Aucune promotion valide dans ce fichier. Le format attendu est décrit dans le fichier LISEZMOI.');
        C.save.promos(res.ok);
        C.toast(`${res.ok.length} promotion${res.ok.length > 1 ? 's importées' : ' importée'}${res.errors.length ? ` · ${res.errors.length} ligne${res.errors.length > 1 ? 's ignorées' : ' ignorée'}` : ''}`);
      } catch (e) {
        C.toast('Fichier illisible : ce n’est pas du JSON valide.');
      }
    },
    'promo.sync': async () => {
      C.toast('Actualisation des promotions…');
      const r = await C.sources.sync(true);
      if (r.skipped) C.toast('Ouvrez Cabas depuis son adresse pour charger les promotions.');
      else if (r.error) C.toast(`Impossible d’actualiser : ${r.error}.`);
      else C.toast(`${r.added} promotions chargées`);
    },
  });
})();
