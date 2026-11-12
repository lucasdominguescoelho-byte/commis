/* Cabas — composants d'interface partagés : icônes, fenêtres, notifications, visuels, graphiques. */
(function () {
  'use strict';
  const C = window.C;
  const esc = C.esc;

  /* ---------- Icônes (trait 1.6, grille 24) ---------- */
  const I = {
    home: '<path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    book: '<path d="M5 5.5a2 2 0 0 1 2-2h11.5v13H7a2 2 0 0 0-2 2z"/><path d="M5 18.5a2 2 0 0 0 2 2h11.5v-4"/>',
    cart: '<path d="M5 9.5h14l-1.2 8.8a2 2 0 0 1-2 1.7H8.2a2 2 0 0 1-2-1.7z"/><path d="M9 9.5V7.5a3 3 0 0 1 6 0v2"/>',
    tag: '<path d="M3.5 12.4V5A1.5 1.5 0 0 1 5 3.5h7.4l8.1 8.1a1.5 1.5 0 0 1 0 2.1l-6.8 6.8a1.5 1.5 0 0 1-2.1 0z"/><circle cx="8" cy="8" r="1.2"/>',
    wallet: '<rect x="3.5" y="6" width="17" height="13" rx="2.5"/><path d="M3.5 10.5h17M15.5 15h1.5"/>',
    settings: '<path d="M4 7.5h9M18 7.5h2M4 16.5h2M11 16.5h9"/><circle cx="15.5" cy="7.5" r="2.3"/><circle cx="8.5" cy="16.5" r="2.3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
    heart: '<path d="M12 19.5s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.6-7.5 10-7.5 10z"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    users: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.8a3 3 0 0 1 0 5.4M17.5 14.2a5.5 5.5 0 0 1 3 4.8"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    left: '<path d="m14.5 6-6 6 6 6"/>',
    right: '<path d="m9.5 6 6 6-6 6"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 11.6a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7"/>',
    edit: '<path d="M4 20h4L19.5 8.5l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    wand: '<path d="M11 3.5l1.9 4.6 4.6 1.9-4.6 1.9L11 16.5l-1.9-4.6L4.5 10l4.6-1.9z"/><path d="M18 15v5M15.5 17.5h5"/>',
    print: '<path d="M7 8V4h10v4M7 17H5a1.5 1.5 0 0 1-1.5-1.5v-6A1.5 1.5 0 0 1 5 8h14a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 19 17h-2"/><rect x="7" y="14" width="10" height="6" rx="0.5"/>',
    download: '<path d="M12 4v11M7.5 11 12 15.5 16.5 11M5 19.5h14"/>',
    upload: '<path d="M12 15.5v-11M7.5 9 12 4.5 16.5 9M5 19.5h14"/>',
    copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/>',
    move: '<path d="M4 8.5h13.5l-3-3M20 15.5H6.5l3 3"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
  };
  C.icon = (name, size) =>
    `<svg class="ic" width="${size || 20}" height="${size || 20}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[name] || ''}</svg>`;
  const icon = C.icon;

  /* ---------- Petits éléments ---------- */
  C.storeChip = (id) => {
    const s = C.storeById(id);
    return s ? `<span class="store"><i style="background:${s.color}"></i>${s.name}</span>` : '';
  };
  // Visuel : la photo si elle existe, sinon une « assiette » typographique teintée selon la catégorie.
  C.visual = (item, hue, cls) => {
    if (item.photo) return `<img class="ph-img${item.auto ? ' ph-img--produit' : ''}" src="${esc(item.photo)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">`;
    const letter = (C.norm(item.name)[0] || '·').toUpperCase();
    return `<div class="ph ${cls || ''}" style="--h:${hue}"><span>${esc(letter)}</span></div>`;
  };
  C.recipeHue = (r) => (C.RCATS.find((c) => c.name === r.category) || C.RCATS[C.RCATS.length - 1]).hue;
  C.recipeVisual = (r, cls) => C.visual(r, C.recipeHue(r), cls);
  C.promoVisual = (p, cls) => C.visual(p, C.catById(p.category).hue, cls);

  C.weekNav = (wid) =>
    `<div class="wk no-print"><button class="ibtn" data-act="week.prev" aria-label="Semaine précédente">${icon('left', 18)}</button><button class="wk-t" data-act="week.today" title="Revenir à cette semaine">Sem. ${C.weekNo(wid)}${wid === C.weekId() ? '' : ' ·&nbsp;revenir'}</button><button class="ibtn" data-act="week.next" aria-label="Semaine suivante">${icon('right', 18)}</button></div>`;

  C.field = (label, input, hint) => `<label class="field"><span>${label}</span>${input}${hint ? `<small>${hint}</small>` : ''}</label>`;
  C.options = (list, value) => list.map((o) => `<option value="${esc(o.id != null ? o.id : o)}" ${String(o.id != null ? o.id : o) === String(value) ? 'selected' : ''}>${esc(o.name || o)}</option>`).join('');
  C.formData = (form) => Object.fromEntries(new FormData(form).entries());

  /* ---------- Notifications ---------- */
  C.toast = (text, action) => {
    const box = document.getElementById('toasts');
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span>${esc(text)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add('open'));
    const close = () => {
      el.classList.remove('open');
      setTimeout(() => el.remove(), 260);
    };
    const timer = setTimeout(close, action ? 6000 : 3200);
    if (action)
      el.querySelector('button').onclick = () => {
        clearTimeout(timer);
        close();
        action.run();
      };
  };

  /* ---------- Fenêtres ---------- */
  C.sheets = [];
  C.sheet = ({ title, sub, body, foot, size, onMount, onClose }) => {
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    const html = () => (typeof body === 'function' ? body() : body);
    wrap.innerHTML = `<div class="sheet-bg" data-close></div>
      <section class="sheet ${size ? 'sheet--' + size : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}" tabindex="-1">
        <header class="sheet-h"><div><h2>${esc(title)}</h2>${sub ? `<p>${sub}</p>` : ''}</div><button class="ibtn" data-close aria-label="Fermer">${icon('x')}</button></header>
        <div class="sheet-b">${html()}</div>
        ${foot ? `<footer class="sheet-f">${foot}</footer>` : ''}
      </section>`;
    document.getElementById('layer').appendChild(wrap);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
    let closed = false;
    const api = {
      el: wrap,
      body: wrap.querySelector('.sheet-b'),
      refresh: typeof body === 'function' ? () => { const h = html(); if (h == null) api.close(); else api.body.innerHTML = h; } : null,
      close() {
        if (closed) return;
        closed = true;
        C.sheets.splice(C.sheets.indexOf(api), 1);
        wrap.classList.remove('open');
        if (!C.sheets.length) document.body.style.overflow = '';
        setTimeout(() => wrap.remove(), 340);
        if (onClose) onClose();
      },
    };
    wrap.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) api.close();
    });
    C.sheets.push(api);
    const focus = wrap.querySelector('[autofocus]');
    if (focus && window.matchMedia('(min-width: 761px)').matches) setTimeout(() => focus.focus(), 60);
    else wrap.querySelector('.sheet').focus({ preventScroll: true });
    if (onMount) onMount(api);
    return api;
  };
  C.closeSheet = () => C.sheets.length && C.sheets[C.sheets.length - 1].close();
  C.closeAllSheets = () => [...C.sheets].forEach((s) => s.close());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') C.closeSheet();
  });

  C.confirm = (title, text, ok) =>
    new Promise((resolve) => {
      const s = C.sheet({
        title,
        size: 'small',
        body: `<p style="color:var(--ink-2)">${text}</p>`,
        foot: `<button class="btn btn--ghost" data-close>Annuler</button><button class="btn btn--danger" data-ok>${ok || 'Supprimer'}</button>`,
        onClose: () => resolve(false),
      });
      s.el.querySelector('[data-ok]').onclick = () => {
        resolve(true);
        s.close();
      };
    });

  /* ---------- Fichiers ---------- */
  C.download = (name, text, mime) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: mime || 'text/plain;charset=utf-8' }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  C.pickFile = (accept) =>
    new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = accept;
      inp.onchange = () => resolve(inp.files[0] || null);
      inp.click();
    });
  // Réduit une photo à 1100 px de large et la convertit en JPEG pour un stockage local raisonnable.
  C.readImage = (file) =>
    new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(fr.error);
      fr.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Image illisible'));
        img.onload = () => {
          const k = Math.min(1, 1100 / Math.max(img.width, img.height));
          const cv = document.createElement('canvas');
          cv.width = Math.round(img.width * k);
          cv.height = Math.round(img.height * k);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          resolve(cv.toDataURL('image/jpeg', 0.82));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });

  // Champ photo (fichier ou adresse web). wirePhoto() renvoie une fonction qui donne la valeur courante.
  C.photoField = () =>
    `<div class="field"><span>Photographie</span><div class="photo-f" data-photo>
      <div data-ph-prev style="width:96px;height:72px;border-radius:10px;overflow:hidden;flex:none"></div>
      <div class="photo-f-c">
        <div class="photo-f-b"><button type="button" class="btn btn--ghost btn--sm" data-ph-file>${icon('upload', 16)} Choisir une image</button><button type="button" class="link" data-ph-clear hidden>Retirer</button></div>
        <input class="inp" type="url" data-ph-url placeholder="ou coller l'adresse d'une image (https://…)">
      </div></div></div>`;
  C.wirePhoto = (root, initial, placeholder) => {
    let value = initial || '';
    const box = root.querySelector('[data-photo]');
    const prev = box.querySelector('[data-ph-prev]');
    const url = box.querySelector('[data-ph-url]');
    const clear = box.querySelector('[data-ph-clear]');
    const paint = () => {
      prev.innerHTML = value ? `<img class="ph-img" src="${esc(value)}" alt="">` : placeholder;
      clear.hidden = !value;
    };
    if (/^https?:/.test(value)) url.value = value;
    paint();
    box.querySelector('[data-ph-file]').onclick = async () => {
      const f = await C.pickFile('image/*');
      if (!f) return;
      try {
        value = await C.readImage(f);
        url.value = '';
        paint();
      } catch (e) {
        C.toast("Cette image n'a pas pu être lue.");
      }
    };
    url.oninput = () => {
      const v = url.value.trim();
      if (/^https?:\/\/\S+$/.test(v)) value = v;
      else if (!v && /^https?:/.test(value)) value = '';
      paint();
    };
    clear.onclick = () => {
      value = '';
      url.value = '';
      paint();
    };
    return () => value;
  };

  /* ---------- Graphiques ---------- */
  const niceMax = (v) => {
    if (!(v > 0)) return 100;
    const step = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / step;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 8 ? 8 : 10) * step;
  };
  // Barres verticales (1 ou 2 séries), ligne de référence optionnelle, infobulle au survol et au focus.
  C.bars = ({ cols, series, ref }) => {
    const top = niceMax(Math.max(ref ? ref.value : 0, ...cols.flatMap((c) => c.values)) * 1.04);
    const pc = (v) => Math.max(0, Math.min(100, (v / top) * 100));
    return `<div class="chart">
      <div class="chart-plot">
        <div class="chart-grid">${[0, 0.5, 1].map((k) => `<span style="bottom:${k * 100}%"><em>${C.num(top * k, 0)}</em></span>`).join('')}</div>
        ${ref && ref.value > 0 ? `<div class="chart-ref" style="bottom:${pc(ref.value)}%"><em>${esc(ref.label)}</em></div>` : ''}
        <div class="chart-cols">${cols
          .map(
            (c) => `<div class="chart-col ${c.now ? 'is-now' : ''}" tabindex="0" aria-label="${esc(c.tip)} : ${series.map((s, n) => `${s.name} ${C.chf(c.values[n])}`).join(', ')}">
              <div class="chart-bars">${series.map((s, n) => `<i style="height:${pc(c.values[n])}%;background:${s.color}"></i>`).join('')}</div>
              <div class="chart-tip"><b>${esc(c.tip)}</b>${series.map((s, n) => `<span><i style="background:${s.color}"></i>${esc(s.name)}<strong>${C.chf(c.values[n])}</strong></span>`).join('')}</div>
            </div>`
          )
          .join('')}</div>
      </div>
      <div class="chart-x">${cols.map((c) => `<span class="${c.now ? 'is-now' : ''}">${esc(c.label)}</span>`).join('')}</div>
    </div>`;
  };
})();
