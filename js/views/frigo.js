/* Cabas — Frigo : ce qu'il reste à la maison.
   Ajout par code-barres (caméra → Open Food Facts), par ticket de caisse (texte lu sur l'appareil)
   ou à la main. Les aliments servent, sur demande, à générer des recettes, et sont
   déduits de la liste de courses. */
(function () {
  'use strict';
  const C = window.C;
  const { esc, icon } = C;
  const E = C.eng;

  const ZXING = 'https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/umd/zxing-browser.min.js';
  const OFF = 'https://world.openfoodfacts.org/api/v2/product/';

  /* ---------- Affichage ---------- */
  const expiry = (f) => {
    const d = E.expiresIn(f);
    if (d == null) return '';
    if (d < 0) return `<span class="badge badge--warn">périmé depuis ${-d} j</span>`;
    if (d === 0) return '<span class="badge badge--warn">à consommer aujourd’hui</span>';
    if (d <= 3) return `<span class="badge badge--warn">encore ${d} j</span>`;
    return `<span class="badge">jusqu’au ${C.fmtDate(f.expires, { day: 'numeric', month: 'short' })}</span>`;
  };
  const row = (f) => `<div class="row fr" data-act="frigo.edit" data-id="${f.id}" tabindex="0" role="button">
      <span class="thumb">${f.photo ? `<img class="ph-img ph-img--produit" src="${esc(f.photo)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : C.visual(f, C.catById(f.cat).hue, 'ph--sm')}</span>
      <span class="row-b"><span class="row-t">${esc(f.name)}</span><span class="row-s">${[f.brand, f.qty ? C.fmtQty(f.qty, f.unit) : ''].filter(Boolean).map(esc).join(' · ')}</span>${expiry(f) ? `<span class="fr-d">${expiry(f)}</span>` : ''}</span>
      <button class="btn btn--ghost btn--sm" data-act="frigo.used" data-id="${f.id}" title="Retirer du frigo">Utilisé</button>
    </div>`;

  C.views.frigo = {
    render(root) {
      const items = C.S.fridge.slice().sort((a, b) => (E.expiresIn(a) ?? 999) - (E.expiresIn(b) ?? 999) || a.name.localeCompare(b.name, 'fr'));
      const soon = items.filter((f) => E.expiresIn(f) != null && E.expiresIn(f) <= 3);
      const rest = items.filter((f) => !soon.includes(f));
      const groups = C.CATS.map((c) => ({ c, list: rest.filter((f) => f.cat === c.id) })).filter((g) => g.list.length);
      root.innerHTML = `
        <header class="head"><div><p class="eyebrow">${items.length ? `${items.length} aliment${items.length > 1 ? 's' : ''}` : 'Ce qu’il reste à la maison'}</p><h1 class="title">Frigo</h1></div>
          <div class="head-a">
            <button class="btn btn--ghost" data-act="frigo.scan">${icon('barcode', 18)} Scanner</button>
            <button class="btn btn--ghost" data-act="frigo.photo">${icon('receipt', 18)} Ticket</button>
            <button class="btn" data-act="frigo.add">${icon('plus', 18)} Ajouter</button></div></header>
        ${
          items.length
            ? `${soon.length ? `<section class="card" style="margin-bottom:16px"><div class="sec-h"><h2 class="h3">À consommer bientôt</h2></div><div class="rows">${soon.map(row).join('')}</div></section>` : ''}
               ${groups.map((g) => `<section class="card" style="margin-bottom:16px"><div class="sec-h"><h2 class="h3">${esc(g.c.name)}</h2><span class="small muted">${g.list.length}</span></div><div class="rows">${g.list.map(row).join('')}</div></section>`).join('')}
               <div class="card card--citron frigo-cta"><div><p class="stat-l">${icon('wand', 17)} Cuisiner avec ce qu’il reste</p><p class="small" style="margin-top:6px">Des recettes inventées autour de vos aliments${soon.length ? ', en commençant par ceux à consommer vite' : ''}, complétées par les promotions de la semaine.</p></div><button class="btn" data-act="frigo.cook">Proposer des recettes</button></div>
               <p class="small muted" style="margin-top:14px">Les aliments du frigo sont aussi signalés « au frigo » dans la liste de courses et ne sont pas comptés dans son total.</p>`
            : `<div class="empty"><h2 class="h2">Le frigo est vide</h2><p>Notez ce qu’il vous reste : Cabas le proposera dans des recettes et ne vous le fera pas racheter.</p>
                <div class="head-a" style="justify-content:center;margin-top:18px"><button class="btn" data-act="frigo.scan">${icon('barcode', 18)} Scanner un code-barres</button><button class="btn btn--ghost" data-act="frigo.photo">${icon('receipt', 18)} Lire un ticket de caisse</button><button class="btn btn--ghost" data-act="frigo.add">${icon('plus', 18)} Saisir</button></div></div>`
        }`;
    },
  };

  /* ---------- Fiche d'un aliment (ajout / modification) ---------- */
  function editor(f, opts = {}) {
    const isNew = !f || !C.S.fridge.some((x) => x.id === f.id);
    f = { id: C.uid(), name: '', qty: 1, unit: 'pièce', cat: 'autre', expires: '', source: 'manuel', addedAt: C.today(), ...(f || {}) };
    C.sheet({
      title: isNew ? 'Ajouter au frigo' : f.name,
      sub: opts.sub || (f.barcode ? `Code-barres ${esc(f.barcode)}` : ''),
      body: `<form class="form" id="frigo-form" novalidate>
        ${f.photo || f.brand ? `<div class="row" style="padding-top:0">${f.photo ? `<span class="thumb"><img class="ph-img ph-img--produit" src="${esc(f.photo)}" alt="" referrerpolicy="no-referrer"></span>` : ''}<span class="row-b"><span class="row-s">${esc(f.brand || '')}</span></span></div>` : ''}
        ${C.field('Aliment', `<input class="inp" name="name" required value="${esc(f.name)}" placeholder="Ex. Crème entière" ${opts.focus === false ? '' : 'autofocus'}>`, 'Un nom simple aide Cabas à le retrouver dans les recettes.')}
        <div class="form-3">
          ${C.field('Quantité', `<input class="inp" name="qty" inputmode="decimal" value="${f.qty || ''}">`)}
          ${C.field('Unité', `<select class="inp" name="unit">${C.options(C.UNITS, f.unit)}</select>`)}
          ${C.field('Rayon', `<select class="inp" name="cat">${C.options(C.CATS, f.cat)}</select>`)}
        </div>
        ${C.field('À consommer avant', `<input class="inp" type="date" name="expires" value="${esc(f.expires || '')}">`, 'Facultatif : les aliments proches de la date passent en premier.')}
      </form>`,
      foot: `${isNew ? '' : `<button class="btn btn--ghost sp" data-act="frigo.used" data-id="${f.id}">${icon('trash', 17)} Retirer</button>`}<button class="btn btn--ghost" data-close>Annuler</button><button class="btn" type="submit" form="frigo-form">${isNew ? 'Ajouter' : 'Enregistrer'}</button>`,
      onMount(sheet) {
        const form = sheet.el.querySelector('#frigo-form');
        form.onsubmit = (e) => {
          e.preventDefault();
          const d = C.formData(form);
          if (!d.name.trim()) return C.toast('Indiquez le nom de l’aliment.');
          sheet.close();
          C.save.fridge({ ...f, name: d.name.trim(), qty: C.toNum(d.qty), unit: d.unit, cat: d.cat, expires: d.expires });
          C.toast(isNew ? `${d.name.trim()} ajouté au frigo` : 'Enregistré');
        };
      },
    });
  }

  /* ---------- Code-barres ---------- */
  // Rayon d'après les catégories Open Food Facts.
  const RAYONS = [
    [/meats|poultr|sausages|hams|fishes|seafood|smoked-salmon/, 'vp'],
    [/cheeses|dairies|milks|yogurts|eggs|butters|creams|fermented-milk/, 'lait'],
    [/frozen/, 'surg'],
    [/breads|viennoiseries/, 'boul'],
    [/beverages|waters|juices|wines|beers/, 'bois'],
    [/fresh-vegetables|fresh-fruits|^en:vegetables$|^en:fruits$|salads|potatoes|mushrooms/, 'fl'],
  ];
  function rayon(tags) {
    const t = (tags || []).join(' ');
    for (const [re, cat] of RAYONS) if ((tags || []).some((x) => re.test(x)) || re.test(t)) return cat;
    return 'epi';
  }
  function quantite(p) {
    const q = Number(p.product_quantity);
    const u = String(p.product_quantity_unit || '').toLowerCase();
    if (q > 0 && ['g', 'kg', 'ml', 'cl', 'dl', 'l'].includes(u)) return u === 'cl' ? { qty: q * 10, unit: 'ml' } : { qty: q, unit: u };
    return { qty: 1, unit: 'pièce' };
  }

  async function lookup(code) {
    code = String(code || '').replace(/\D/g, '');
    if (code.length < 6) return C.toast('Code-barres incomplet.');
    let p = null;
    try {
      const res = await fetch(`${OFF}${code}?fields=product_name,product_name_fr,generic_name_fr,brands,quantity,product_quantity,product_quantity_unit,image_front_small_url,categories_tags`);
      const data = await res.json();
      if (data.status === 1) p = data.product;
    } catch (e) {
      return editor({ barcode: code, source: 'scan' }, { sub: 'Recherche impossible (hors ligne ?) : saisissez le nom.' });
    }
    if (!p) return editor({ barcode: code, source: 'scan' }, { sub: `Code ${code} inconnu d’Open Food Facts : saisissez le nom.` });
    editor(
      {
        name: (p.product_name_fr || p.product_name || p.generic_name_fr || '').trim(),
        brand: String(p.brands || '').split(',')[0].trim(),
        ...quantite(p),
        cat: rayon(p.categories_tags),
        photo: /^https:\/\//.test(p.image_front_small_url || '') ? p.image_front_small_url : '',
        barcode: code,
        source: 'scan',
      },
      { sub: `Trouvé sur Open Food Facts · ${code}`, focus: false }
    );
  }

  let stopScan = () => {};
  const loadZxing = () =>
    window.ZXingBrowser
      ? Promise.resolve(window.ZXingBrowser)
      : new Promise((ok, ko) => {
          const s = document.createElement('script');
          s.src = ZXING;
          s.onload = () => ok(window.ZXingBrowser);
          s.onerror = () => ko(new Error('Lecteur de codes-barres indisponible (connexion ?)'));
          document.head.appendChild(s);
        });

  async function startCamera(video, status, onCode) {
    const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
    // 1) Détecteur natif du navigateur (Chrome, Android).
    if ('BarcodeDetector' in window) {
      try {
        const ok = (await window.BarcodeDetector.getSupportedFormats()).filter((f) => FORMATS.includes(f));
        if (ok.length) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
          video.srcObject = stream;
          await video.play();
          const det = new window.BarcodeDetector({ formats: ok });
          let live = true;
          stopScan = () => {
            live = false;
            stream.getTracks().forEach((t) => t.stop());
          };
          const loop = async () => {
            if (!live) return;
            try {
              const found = await det.detect(video);
              if (found.length) return onCode(found[0].rawValue);
            } catch (e) { /* image pas prête */ }
            setTimeout(loop, 200);
          };
          loop();
          return;
        }
      } catch (e) { /* on passe à ZXing */ }
    }
    // 2) ZXing (Safari sur iPhone, Firefox…).
    const Z = await loadZxing();
    const reader = new Z.BrowserMultiFormatReader();
    const controls = await reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, video, (result) => {
      if (result) onCode(result.getText());
    });
    stopScan = () => controls.stop();
    status.textContent = 'Visez le code-barres, bien à plat.';
  }

  function scanner() {
    let done = false;
    const found = (code) => {
      if (done) return;
      done = true;
      stopScan();
      if (navigator.vibrate) navigator.vibrate(40);
      C.closeSheet();
      lookup(code);
    };
    C.sheet({
      title: 'Scanner un code-barres',
      sub: 'Le produit est cherché dans Open Food Facts, une base de données collaborative.',
      body: `<div class="scan"><video playsinline muted autoplay></video><i class="scan-guide"></i></div>
        <p class="small muted scan-status" style="margin-top:10px">Ouverture de la caméra…</p>
        <form class="tag-add" id="scan-manual" style="margin-top:16px"><input class="inp" name="code" inputmode="numeric" placeholder="ou tapez les chiffres du code-barres" aria-label="Code-barres"><button class="btn btn--ghost" type="submit">Chercher</button></form>
        <button class="link" data-act="frigo.scanPhoto" style="margin-top:12px">La caméra ne marche pas ? Prendre une photo du code-barres</button>`,
      onClose: () => stopScan(),
      onMount(sheet) {
        const video = sheet.el.querySelector('video');
        const status = sheet.el.querySelector('.scan-status');
        sheet.el.querySelector('#scan-manual').onsubmit = (e) => {
          e.preventDefault();
          found(e.target.elements.code.value);
        };
        C.ui.scanFound = found;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          status.textContent = 'Caméra indisponible ici (il faut ouvrir Cabas en https). Tapez le code ou prenez une photo.';
          return;
        }
        startCamera(video, status, found)
          .then(() => { if (!done) status.textContent = 'Visez le code-barres, bien à plat.'; })
          .catch((e) => {
            status.textContent = /Permission|NotAllowed/i.test(e.name + e.message) ? 'Accès à la caméra refusé : autorisez-le dans les réglages du navigateur, ou tapez le code.' : `Caméra indisponible : ${e.message}`;
          });
      },
    });
  }

  /* ---------- Ticket de caisse : lecture du texte sur l'appareil (Tesseract.js, gratuit) ---------- */
  const TESSERACT = 'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js';
  const loadTesseract = () =>
    window.Tesseract
      ? Promise.resolve(window.Tesseract)
      : new Promise((ok, ko) => {
          const s = document.createElement('script');
          s.src = TESSERACT;
          s.onload = () => ok(window.Tesseract);
          s.onerror = () => ko(new Error('Module de lecture indisponible (connexion ?)'));
          document.head.appendChild(s);
        });

  // Lignes à ignorer : totaux, paiement, fidélité, en-têtes.
  const SKIP = /\b(total|sous total|tva|mwst|cumulus|supercard|carte|twint|maestro|visa|rendu|especes?|bon|rabais|montant|merci|caisse|ticket|date|heure|tel|www|points?|recu|quittance|change|arrondi|filiale)\b/;

  // Transforme le texte du ticket en aliments probables, reconnus grâce à la base du générateur.
  function parseTicket(text) {
    const foods = C.cuisine.foods;
    const out = [];
    const seen = new Set();
    text.split('\n').forEach((raw) => {
      const line = raw.trim();
      if (!/\d+[.,]\d{2}/.test(line)) return; // une ligne d'article porte un prix
      if (SKIP.test(C.norm(line))) return;
      const label = line
        .replace(/\s+-?\d+[.,]\d{2}.*$/, '')
        .replace(/^\d+\s*[x×*]\s*/i, '')
        .replace(/[^A-Za-zÀ-ÿ0-9 '%.-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!/[A-Za-zÀ-ÿ]{3}/.test(label)) return;
      const toks = C.tokens(label);
      let best = null;
      let bestScore = 0;
      foods.forEach((f) => {
        const ft = C.tokens(f.n);
        const hit = ft.filter((t) => toks.includes(t)).length;
        const sc = hit / ft.length;
        if (hit && sc >= 0.5 && sc > bestScore) {
          best = f;
          bestScore = sc;
        }
      });
      const kg = line.match(/(\d+(?:[.,]\d{1,3})?)\s*kg\b/i);
      const gr = !kg && line.match(/\b(\d{2,4})\s*g\b/i);
      const w = kg ? Math.round(C.toNum(kg[1]) * 1000) : gr ? Number(gr[1]) : 0;
      const name = best ? best.n : label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
      const k = C.norm(name);
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ name, qty: w || 1, unit: w ? 'g' : best ? (best.u === 'g' ? 'pièce' : best.u) : 'pièce', cat: best ? best.c : 'autre', confidence: best ? 'sure' : 'incertain', raw: label });
    });
    return out;
  }

  C.ticket = { parse: parseTicket, load: loadTesseract };

  function photoSheet() {
    const st = { img: '', busy: false, progress: 0, step: '', items: null, keep: {}, error: '' };
    const body = () => {
      if (!st.img)
        return `<p style="color:var(--ink-2)">Photographiez le ticket de caisse bien à plat, sans pli, avec une bonne lumière. Cabas lit le texte directement sur votre appareil, gratuitement, et propose les aliments reconnus : vous vérifiez avant d’ajouter.</p>
          <p class="small muted" style="margin-top:8px">La première fois, le module de lecture (quelques Mo) est téléchargé puis gardé en mémoire.</p>
          <button class="btn btn--citron btn--block" data-act="frigo.shoot" style="margin-top:16px">${icon('receipt', 18)} Photographier le ticket</button>`;
      const head = `<img class="shot shot--ticket" src="${st.img}" alt="Ticket analysé">`;
      if (st.busy) return `${head}<div class="gen-wait"><span class="spin"></span><div><b>${esc(st.step || 'Lecture du ticket…')}</b><div class="bar" style="width:180px"><i style="width:${Math.round(st.progress * 100)}%"></i></div></div></div>`;
      if (st.error) return `${head}<div class="note note--err">${icon('info', 18)}<span>${esc(st.error)}</span></div><button class="btn btn--ghost" data-act="frigo.shoot" style="margin-top:12px">Autre photo</button>`;
      if (!st.items.length) return `${head}<p class="muted">Aucun article lisible. Reprenez la photo de plus près, bien droite et éclairée.</p><button class="btn btn--ghost" data-act="frigo.shoot" style="margin-top:12px">Autre photo</button>`;
      const ok = st.items.filter((it) => it.confidence === 'sure').length;
      return `${head}<p class="small muted" style="margin:12px 0 6px">${st.items.length} article${st.items.length > 1 ? 's' : ''} lu${st.items.length > 1 ? 's' : ''}, dont ${ok} reconnu${ok > 1 ? 's' : ''} comme aliment${ok > 1 ? 's' : ''}. Cochez ce qui va au frigo, corrigez les noms si besoin.</p>
        <div class="detect">${st.items.map((it, n) => `<div class="detect-r ${st.keep[n] ? '' : 'is-off'}">
            <input type="checkbox" ${st.keep[n] ? 'checked' : ''} data-change="frigo.pick" data-n="${n}" aria-label="Garder ${esc(it.name)}">
            <input class="inp" value="${esc(it.name)}" data-input="frigo.rename" data-n="${n}" aria-label="Nom" title="${esc(it.raw)}">
            <input class="inp" value="${it.qty}" inputmode="decimal" data-input="frigo.reqty" data-n="${n}" aria-label="Quantité">
            <select class="inp" data-change="frigo.reunit" data-n="${n}" aria-label="Unité">${C.options(C.UNITS, it.unit)}</select>
            ${it.confidence === 'sure' ? '' : '<span class="badge">à vérifier</span>'}
          </div>`).join('')}</div>`;
    };
    C.ui.photo = st;
    const sheet = C.sheet({
      title: 'Lire un ticket de caisse',
      size: 'wide',
      body,
      foot: `<button class="btn btn--ghost" data-close>Fermer</button><button class="btn" data-act="frigo.addDetected">Ajouter au frigo</button>`,
    });
    st.refresh = () => sheet.refresh();
  }

  /* ---------- Actions ---------- */
  Object.assign(C.acts, {
    'frigo.add': () => editor(null),
    'frigo.edit': (el, e) => {
      if (e && e.target.closest('[data-act="frigo.used"]')) return;
      const f = C.S.fridge.find((x) => x.id === el.dataset.id);
      if (f) editor(f);
    },
    'frigo.used': (el, e) => {
      if (e) e.stopPropagation();
      const f = C.S.fridge.find((x) => x.id === el.dataset.id);
      if (!f) return;
      if (C.sheets.length) C.closeSheet();
      C.save.delFridge(f.id);
      C.toast(`${f.name} retiré du frigo`, { label: 'Annuler', run: () => C.save.fridge(f) });
    },
    'frigo.cook': () => C.generator.withFridge(),
    'frigo.scan': () => scanner(),
    'frigo.scanPhoto': async () => {
      const file = await C.pickFile('image/*');
      if (!file) return;
      try {
        const Z = await loadZxing();
        const url = URL.createObjectURL(file);
        const res = await new Z.BrowserMultiFormatReader().decodeFromImageUrl(url);
        URL.revokeObjectURL(url);
        if (C.ui.scanFound) C.ui.scanFound(res.getText());
      } catch (e) {
        C.toast('Aucun code-barres lisible sur cette photo.');
      }
    },
    'frigo.photo': () => photoSheet(),
    'frigo.shoot': async () => {
      const st = C.ui.photo;
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      inp.setAttribute('capture', 'environment');
      const file = await new Promise((ok) => {
        inp.onchange = () => ok(inp.files[0] || null);
        inp.click();
      });
      if (!file) return;
      try {
        st.img = await C.readImage(file, 2000); // assez de détails pour lire les petites lettres
      } catch (e) {
        return C.toast('Image illisible.');
      }
      Object.assign(st, { busy: true, error: '', items: null, progress: 0, step: 'Préparation du module de lecture…' });
      st.refresh();
      let worker = null;
      try {
        const T = await loadTesseract();
        worker = await T.createWorker('fra', 1, {
          logger: (m) => {
            st.step = m.status === 'recognizing text' ? 'Lecture du ticket…' : 'Préparation du module de lecture…';
            st.progress = m.progress || 0;
            const bar = document.querySelector('.gen-wait .bar i');
            const lbl = document.querySelector('.gen-wait b');
            if (bar) bar.style.width = Math.round(st.progress * 100) + '%';
            if (lbl) lbl.textContent = st.step;
          },
        });
        const { data } = await worker.recognize(st.img);
        st.items = parseTicket(data.text || '');
        st.keep = Object.fromEntries(st.items.map((it, n) => [n, it.confidence === 'sure']));
      } catch (e) {
        st.error = `Lecture impossible : ${e.message || e}`;
      }
      if (worker) worker.terminate();
      st.busy = false;
      st.refresh();
    },
    'frigo.pick': (el) => { C.ui.photo.keep[el.dataset.n] = el.checked; el.closest('.detect-r').classList.toggle('is-off', !el.checked); },
    'frigo.rename': (el) => { C.ui.photo.items[el.dataset.n].name = el.value; },
    'frigo.reqty': (el) => { C.ui.photo.items[el.dataset.n].qty = C.toNum(el.value); },
    'frigo.reunit': (el) => { C.ui.photo.items[el.dataset.n].unit = el.value; },
    'frigo.addDetected': () => {
      const st = C.ui.photo;
      const picked = (st.items || []).filter((it, n) => st.keep[n] && it.name.trim());
      if (!picked.length) return C.toast('Aucun aliment sélectionné.');
      C.closeSheet();
      C.save.fridgeMany(picked.map((it) => ({ id: C.uid(), name: it.name.trim(), qty: it.qty, unit: it.unit, cat: it.cat, expires: '', source: 'ticket', addedAt: C.today() })));
      C.toast(`${picked.length} aliment${picked.length > 1 ? 's' : ''} ajouté${picked.length > 1 ? 's' : ''} au frigo`);
    },
  });
})();
