/* Commis — questionnaire de bienvenue : au premier lancement sur un appareil, quelques écrans
   pour régler le foyer, le budget, les magasins, le régime, les allergies et les ustensiles.
   Rien n'est enregistré avant « Terminer » ; tout reste modifiable dans Réglages. */
(function () {
  'use strict';
  const C = window.C;
  const { esc, icon } = C;

  const BUDGETS = [100, 160, 250];
  let D = null; // brouillon des réglages
  let step = 0;
  let dir = '';
  const LAST = 5; // 0 bienvenue · 1 foyer · 2 magasins · 3 régime · 4 ustensiles · 5 terminé

  const chip = (on, label, act, v) => `<button class="chip ${on ? 'is-on' : ''}" data-act="${act}" data-v="${esc(v)}" aria-pressed="${!!on}">${label}</button>`;

  function screen() {
    const E = C.eng;
    switch (step) {
      case 0:
        return `<div class="ob-hello"><span class="logo-mark ob-mark">${C.logoMark || ''}</span>
          <h2 class="ob-t">Bienvenue dans ${C.APP}</h2>
          <p class="ob-s">Vos repas de la semaine avec les promotions de vos magasins, la liste de courses qui va avec, et votre budget.</p>
          <p class="ob-s">Quatre petites questions pour régler l’app sur vous. Une minute, et tout reste modifiable ensuite.</p></div>`;
      case 1:
        return `<p class="eyebrow">Votre foyer</p><h2 class="ob-t">Vous êtes combien à table ?</h2>
          <div class="ob-row"><div class="step ob-step"><button data-act="ob.people" data-d="-1" aria-label="Moins">${icon('minus', 18)}</button><b>${D.household}</b><button data-act="ob.people" data-d="1" aria-label="Plus">${icon('plus', 18)}</button><span>personne${D.household > 1 ? 's' : ''}</span></div></div>
          <h3 class="ob-q">Budget courses par semaine</h3>
          <div class="chips">${BUDGETS.map((b) => chip(D.weeklyBudget === b, `${b} CHF`, 'ob.budget', b)).join('')}${chip(!D.weeklyBudget, 'Pas de budget', 'ob.budget', 0)}</div>
          <label class="field ob-other"><span>Autre montant</span><input class="inp" inputmode="decimal" placeholder="Ex. 180" value="${D.weeklyBudget && !BUDGETS.includes(D.weeklyBudget) ? D.weeklyBudget : ''}" data-input="ob.budgetIn" aria-label="Autre montant en CHF"></label>`;
      case 2:
        return `<p class="eyebrow">Vos magasins</p><h2 class="ob-t">Où faites-vous vos courses ?</h2>
          <p class="ob-s">Seules leurs promotions comptent dans les recettes, le planning et la liste de courses.</p>
          <div class="chips ob-big">${C.STORES.map((s) => chip(D.stores.includes(s.id), `<i style="background:${s.color}"></i>${s.name}`, 'ob.store', s.id)).join('')}</div>
          ${D.stores.length ? '' : '<p class="small" style="color:var(--danger);margin-top:12px">Choisissez au moins un magasin.</p>'}`;
      case 3:
        return `<p class="eyebrow">Ce que vous mangez</p><h2 class="ob-t">Un régime particulier ?</h2>
          <div class="chips">${chip(!D.diets.length, 'Je mange de tout', 'ob.dietNone', '')}${Object.entries(E.DIETS).map(([id, d]) => chip(D.diets.includes(id), esc(d.label), 'ob.diet', id)).join('')}</div>
          <h3 class="ob-q">Allergies ou intolérances</h3>
          <div class="chips">${E.ALLERGEN_SUGGESTIONS.map((a) => chip(D.allergies.some((x) => C.norm(x) === C.norm(a)), esc(a), 'ob.allergy', a)).join('')}${D.allergies.filter((x) => !E.ALLERGEN_SUGGESTIONS.some((a) => C.norm(a) === C.norm(x))).map((x) => chip(true, esc(x), 'ob.allergy', x)).join('')}</div>
          <form class="tag-add ob-other" id="ob-allergy"><input class="inp" name="v" placeholder="Autre, ex. céleri" aria-label="Autre allergie" autocomplete="off"><button class="btn btn--ghost" type="submit">Ajouter</button></form>`;
      case 4:
        return `<p class="eyebrow">Votre cuisine</p><h2 class="ob-t">Qu’avez-vous comme ustensiles ?</h2>
          <p class="ob-s">Les recettes proposées n’utiliseront que ce que vous avez.</p>
          <div class="chips">${C.TOOLS.map((t) => chip(D.tools.includes(t.id), esc(t.name), 'ob.tool', t.id)).join('')}</div>
          <p class="small muted" style="margin-top:14px">${C.cuisine.possible(D.tools).length} types de plats possibles avec cet équipement.</p>`;
      default: {
        const pool = C.S.recipes.filter((r) => !C.eng.conflicts(r, { ...C.S.settings, ...D }).length).length;
        return `<div class="ob-hello"><span class="ob-check">${icon('check', 30)}</span>
          <h2 class="ob-t">C’est prêt</h2>
          <p class="ob-s">${D.household} personne${D.household > 1 ? 's' : ''}${D.weeklyBudget ? `, ${D.weeklyBudget} CHF par semaine` : ''}, ${D.stores.map((s) => C.storeById(s).name).join(', ')}${D.diets.length ? `, ${D.diets.map((d) => C.eng.DIETS[d].label.toLowerCase()).join(', ')}` : ''}${D.allergies.length ? `, sans ${D.allergies.map((a) => a.toLowerCase()).join(', ')}` : ''}.</p>
          <p class="ob-s">${pool} recette${pool > 1 ? 's' : ''} de votre bibliothèque correspond${pool > 1 ? 'ent' : ''} à vos choix. Vous pourrez tout changer dans Réglages.</p></div>`;
      }
    }
  }

  function draw() {
    const el = document.getElementById('ob');
    if (!el) return;
    el.querySelector('.ob-b').innerHTML = `<div class="ob-in ${dir ? 'from-' + dir : ''}">${screen()}</div>`;
    el.querySelector('.ob-bar i').style.width = `${(step / LAST) * 100}%`;
    el.querySelector('.ob-bar').hidden = step === 0;
    const back = el.querySelector('[data-act="ob.back"]');
    back.hidden = step === 0 || step === LAST;
    el.querySelector('[data-act="ob.skip"]').hidden = step === LAST;
    const next = el.querySelector('[data-act="ob.next"]');
    next.innerHTML = step === 0 ? `Commencer ${icon('arrow', 18)}` : step === LAST ? `Proposer mon planning ${icon('wand', 18)}` : `Continuer ${icon('arrow', 18)}`;
    next.disabled = step === 2 && !D.stores.length;
    el.querySelector('[data-act="ob.home"]').hidden = step !== LAST;
    const form = el.querySelector('#ob-allergy');
    if (form)
      form.onsubmit = (e) => {
        e.preventDefault();
        const v = form.elements.v.value.trim();
        if (v && !D.allergies.some((x) => C.norm(x) === C.norm(v))) D.allergies = [...D.allergies, v];
        draw();
      };
  }

  function go(d) {
    step = Math.max(0, Math.min(LAST, step + d));
    dir = d > 0 ? 'right' : 'left';
    draw();
    const f = document.querySelector('#ob [data-act="ob.next"]');
    if (f) f.focus({ preventScroll: true });
  }

  function close(save) {
    const el = document.getElementById('ob');
    if (save) C.save.settings({ ...D, onboarded: true });
    else C.save.settings({ onboarded: true });
    D = null;
    document.documentElement.classList.remove('is-cooking');
    if (el) {
      el.classList.remove('is-open');
      setTimeout(() => el.remove(), 220);
    }
  }

  // Ouvre le questionnaire (au premier lancement, ou depuis Réglages)
  C.onboard = () => {
    const st = C.S.settings;
    D = { household: st.household, weeklyBudget: st.weeklyBudget, stores: [...st.stores], diets: [...st.diets], allergies: [...st.allergies], tools: [...st.tools] };
    step = 0;
    dir = '';
    document.getElementById('ob')?.remove();
    const el = document.createElement('div');
    el.id = 'ob';
    el.className = 'ob';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', `Bienvenue dans ${C.APP}`);
    el.innerHTML = `<div class="ob-p">
        <div class="ob-bar" hidden><i></i></div>
        <div class="ob-b"></div>
        <footer class="ob-f">
          <button class="btn btn--ghost" data-act="ob.back">${icon('left', 18)} Retour</button>
          <button class="link ob-skip" data-act="ob.skip">Passer</button>
          <button class="btn btn--ghost" data-act="ob.home" hidden>Aller à l’accueil</button>
          <button class="btn btn--citron" data-act="ob.next"></button>
        </footer></div>`;
    document.body.appendChild(el);
    document.documentElement.classList.add('is-cooking'); // bloque le défilement de la page derrière
    draw();
    requestAnimationFrame(() => el.classList.add('is-open'));
    el.querySelector('[data-act="ob.next"]').focus({ preventScroll: true });
  };

  const toggle = (key, v) => {
    D[key] = D[key].includes(v) ? D[key].filter((x) => x !== v) : [...D[key], v];
    draw();
  };

  Object.assign(C.acts, {
    'ob.next': () => {
      if (step === LAST) {
        close(true);
        C.ui.week = C.weekId();
        C.go('#/planning');
        setTimeout(() => C.acts['plan.generate'] && C.acts['plan.generate'](), 250);
        return;
      }
      go(1);
    },
    'ob.back': () => go(-1),
    'ob.skip': () => close(false),
    'ob.home': () => {
      close(true);
      C.go('#/accueil');
      C.render();
    },
    'ob.people': (el) => {
      D.household = Math.max(1, Math.min(12, D.household + Number(el.dataset.d)));
      draw();
    },
    'ob.budget': (el) => {
      D.weeklyBudget = Number(el.dataset.v);
      draw();
    },
    'ob.budgetIn': (el) => {
      const n = Math.round(C.toNum(el.value));
      D.weeklyBudget = n > 0 ? n : 0;
      document.querySelectorAll('#ob [data-act="ob.budget"]').forEach((b) => {
        const on = Number(b.dataset.v) === D.weeklyBudget;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', on);
      });
    },
    'ob.store': (el) => toggle('stores', el.dataset.v),
    'ob.diet': (el) => toggle('diets', el.dataset.v),
    'ob.dietNone': () => {
      D.diets = [];
      draw();
    },
    'ob.allergy': (el) => {
      const v = el.dataset.v;
      D.allergies = D.allergies.some((x) => C.norm(x) === C.norm(v)) ? D.allergies.filter((x) => C.norm(x) !== C.norm(v)) : [...D.allergies, v];
      draw();
    },
    'ob.tool': (el) => toggle('tools', el.dataset.v),
    'set.onboard': () => C.onboard(),
  });
})();
