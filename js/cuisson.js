/* Commis — mode cuisine : la recette étape par étape, en grand, écran maintenu allumé.
   Étape 0 : sortir les ingrédients (à cocher). Puis une étape par écran : flèches, balayage ou clavier.
   Aussi : C.nutri(r) lit les valeurs nutritionnelles écrites en tête de description (recettes du livre). */
(function () {
  'use strict';
  const C = window.C;
  const { esc, icon } = C;

  // « Par portion : 461 kcal · 39 g de protéines · 59 g de glucides · 8 g de lipides. » → valeurs + reste du texte
  const NUTRI = /Par portion\s*:\s*(\d+)\s*kcal\s*·\s*(\d+)\s*g de protéines\s*·\s*(\d+)\s*g de glucides\s*·\s*(\d+)\s*g de lipides\.?\s*/i;
  C.nutri = (r) => {
    const m = NUTRI.exec((r && r.description) || '');
    if (!m) return null;
    return { kcal: +m[1], prot: +m[2], gluc: +m[3], lip: +m[4], rest: r.description.replace(m[0], '').trim() };
  };
  C.nutriChips = (n, full) =>
    n
      ? `<div class="nutri">${[
          [n.kcal, 'kcal'],
          [n.prot + ' g', 'protéines'],
          ...(full ? [[n.gluc + ' g', 'glucides'], [n.lip + ' g', 'lipides']] : []),
        ]
          .map(([v, l]) => `<span><b>${v}</b> ${l}</span>`)
          .join('')}${full ? '<small>par portion</small>' : ''}</div>`
      : '';

  /* ---------- Écran allumé pendant la cuisine ---------- */
  let lock = null;
  const wake = async (on) => {
    try {
      if (on && 'wakeLock' in navigator && !lock) {
        lock = await navigator.wakeLock.request('screen');
        lock.addEventListener('release', () => (lock = null));
      } else if (!on && lock) {
        await lock.release();
        lock = null;
      }
    } catch (e) {
      /* refusé (batterie faible, navigateur) : la cuisine continue sans */
    }
  };
  document.addEventListener('visibilitychange', () => {
    if (K && document.visibilityState === 'visible') wake(true);
  });

  let K = null; // { r, i, people, got:Set, dir }

  // Mots trop génériques pour reconnaître un ingrédient dans le texte d'une étape
  const VAGUE = new Set(['sauce', 'des', 'avec', 'sans', 'aux', 'pour', 'allege', 'allegee', 'frais', 'fraiche', 'seche', 'sechee', 'moulu', 'moulue', 'rouge', 'blanc', 'blanche', 'vert', 'verte', 'petit', 'petite', 'grand', 'grande', 'pour', 'tranches', 'tranche', 'surgeles', 'surgelees', 'cuit', 'leger', 'legere', 'nature', 'entiere', 'demi', 'ecreme', 'pieces']);
  const words = (s) => C.norm(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !VAGUE.has(w));
  function used(step, lines) {
    const flat = (x) => ' ' + C.norm(x).replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
    const t = flat(step);
    const has = (w) => t.includes(' ' + w + ' ') || t.includes(' ' + w + 's ') || (w.endsWith('s') && t.includes(' ' + w.slice(0, -1) + ' '));
    // Retenu si le nom complet est cité, si tous ses mots distinctifs le sont,
    // ou s'il est le seul ingrédient à porter le mot trouvé (« le poulet » → poitrine de poulet).
    const cand = lines.map((l) => ({ l, w: words(l.ing.name), exact: t.includes(flat(l.ing.name)) })).map((x) => ({ ...x, hit: x.w.filter(has) }));
    const owners = (w) => cand.filter((x) => x.w.includes(w)).length;
    const taken = new Set(cand.filter((x) => x.exact).flatMap((x) => x.w)); // « ail en poudre » cité : « ail » ne désigne plus l'ail en purée
    return cand
      .filter((x) => x.exact || ((x.hit = x.hit.filter((w) => !taken.has(w))).length && (x.hit.length === x.w.length || x.hit.some((w) => owners(w) === 1))))
      .map((x) => x.l);
  }

  function screen() {
    const { r, i } = K;
    const n = r.steps.length;
    if (i === 0) {
      const c = C.eng.recipeCost(r, K.people, C.eng.activePromos(C.weekId()));
      return `<p class="eyebrow">Avant de commencer · ${K.people} pers.</p>
        <h2 class="cook-t">Sortez les ingrédients</h2>
        <p class="cook-s">Touchez un ingrédient quand il est prêt sur le plan de travail.</p>
        <ul class="cook-ing">${c.lines
          .map((l, k) => `<li><button class="${K.got.has(k) ? 'is-done' : ''}" data-act="cook.got" data-k="${k}" aria-pressed="${K.got.has(k)}"><span class="si-x">${icon('check', 14)}</span><span class="cook-q">${C.fmtQty(l.qty, l.ing.unit) || ''}</span><span>${esc(l.ing.name)}</span></button></li>`)
          .join('')}</ul>`;
    }
    if (i > n)
      return `<div class="cook-end"><p class="eyebrow">Terminé</p><h2 class="cook-t">Bon appétit !</h2>
        ${r.validated ? '<p class="cook-s">Cette recette est déjà dans « Mes recettes ».</p>' : `<p class="cook-s">Elle vous a plu ? Validez-la pour la ranger dans « Mes recettes ».</p><button class="btn btn--citron" data-act="cook.validate">${icon('check', 18)} Testée, je valide</button>`}</div>`;
    const lines = C.eng.recipeCost(r, K.people, C.eng.activePromos(C.weekId())).lines;
    const u = used(r.steps[i - 1], lines);
    return `<p class="eyebrow">Étape ${i} sur ${n}</p><p class="cook-step">${esc(r.steps[i - 1])}</p>
      ${u.length ? `<div class="cook-use">${u.map((l) => `<span>${C.fmtQty(l.qty, l.ing.unit) ? `<b>${C.fmtQty(l.qty, l.ing.unit)}</b> ` : ''}${esc(l.ing.name.toLowerCase())}</span>`).join('')}</div>` : ''}`;
  }

  function draw() {
    const el = document.getElementById('cook');
    if (!el || !K) return;
    const n = K.r.steps.length;
    const body = el.querySelector('.cook-b');
    body.innerHTML = `<div class="cook-in ${K.dir ? 'from-' + K.dir : ''}">${screen()}</div>`;
    body.scrollTop = 0;
    el.querySelector('.cook-bar i').style.width = `${Math.min(100, (K.i / (n + 1)) * 100)}%`;
    el.querySelector('[data-act="cook.prev"]').disabled = K.i === 0;
    const next = el.querySelector('[data-act="cook.next"]');
    next.innerHTML = K.i === 0 ? `C’est parti ${icon('arrow', 18)}` : K.i === n ? `Terminer ${icon('check', 18)}` : K.i > n ? 'Fermer' : `Suivant ${icon('arrow', 18)}`;
  }

  function go(d) {
    const n = K.r.steps.length;
    if (K.i + d > n + 1) return close();
    K.i = Math.max(0, Math.min(n + 1, K.i + d));
    K.dir = d > 0 ? 'right' : 'left';
    draw();
  }

  function close() {
    const el = document.getElementById('cook');
    K = null;
    wake(false);
    document.documentElement.classList.remove('is-cooking');
    if (el) {
      el.classList.remove('is-open');
      setTimeout(() => el.remove(), 260);
    }
  }

  C.cook = (id, people) => {
    const r = C.recipe(id);
    if (!r) return;
    K = { r, i: r.steps.length ? 0 : 1, people: people || r.servings, got: new Set(), dir: '' };
    document.getElementById('cook')?.remove();
    const el = document.createElement('div');
    el.id = 'cook';
    el.className = 'cook';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', `Mode cuisine : ${r.name}`);
    el.innerHTML = `<header class="cook-h"><div class="cook-n"><span class="thumb">${C.recipeVisual(r, 'ph--sm')}</span><b>${esc(r.name)}</b></div>
        <button class="ibtn" data-act="cook.close" aria-label="Quitter le mode cuisine">${icon('x')}</button></header>
      <div class="cook-bar"><i></i></div>
      <div class="cook-b"></div>
      <footer class="cook-f"><button class="btn btn--ghost" data-act="cook.prev">${icon('left', 18)} Précédent</button><button class="btn btn--citron" data-act="cook.next"></button></footer>`;
    document.body.appendChild(el);
    document.documentElement.classList.add('is-cooking');
    draw();
    requestAnimationFrame(() => el.classList.add('is-open'));
    el.querySelector('[data-act="cook.next"]').focus({ preventScroll: true });
    wake(true);
    // Balayage horizontal pour changer d'étape
    let x0 = null;
    const b = el.querySelector('.cook-b');
    b.addEventListener('touchstart', (e) => (x0 = e.touches[0].clientX), { passive: true });
    b.addEventListener('touchend', (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
    });
  };

  document.addEventListener('keydown', (e) => {
    if (!K) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
  });

  Object.assign(C.acts, {
    'cook.open': (el) => C.cook(el.dataset.id, Number(el.dataset.people) || 0),
    'cook.close': () => close(),
    'cook.next': () => go(1),
    'cook.prev': () => go(-1),
    'cook.got': (el) => {
      const k = Number(el.dataset.k);
      K.got.has(k) ? K.got.delete(k) : K.got.add(k);
      el.classList.toggle('is-done', K.got.has(k));
      el.setAttribute('aria-pressed', K.got.has(k));
    },
    'cook.validate': () => {
      const r = C.recipe(K.r.id);
      if (r) C.save.recipe({ ...r, validated: true, toTest: false, validatedAt: C.today() });
      C.toast('Recette validée : elle rejoint « Mes recettes »');
      close();
    },
    // Étapes cochables sur la fiche (on garde sa place pendant qu'on cuisine sans le mode plein écran)
    'step.toggle': (el) => el.classList.toggle('is-done'),
  });
})();
