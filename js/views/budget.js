/* Commis — Budget, en simple : ce qui a vraiment été dépensé face à ce qui était planifié,
   l'historique des semaines, et les dépenses réelles (tickets de caisse). */
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
      const spent = E.weekSpent(wid);
      const m = E.month();
      const hist = E.history(8);
      const now = new Date();
      const hasBudget = st.weeklyBudget > 0;
      // barre complète = le budget ; la partie remplie = ce qui est déjà dépensé
      const bar = (v, max) => (max > 0 ? `<div class="bar bar--bud ${v > max ? 'is-over' : ''}" role="img" aria-label="${C.num(Math.round((v / max) * 100), 0)} % du budget"><i style="width:${Math.min(100, (v / max) * 100)}%"></i></div>` : '');
      const anyHist = hist.some((h) => h.planned > 0 || h.spent > 0);
      const expenses = [...C.S.expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
      const moisDernier = E.month(new Date(now.getFullYear(), now.getMonth() - 1, 15));
      // une case : un titre, un montant réellement dépensé (et, s'il y en a un, le budget prévu avec une barre)
      const caseReel = (titre, depense, prevu) => `<div class="card"><p class="stat-l">${titre}</p>
            <p class="stat-v">${C.chf(depense)}${prevu > 0 ? `<small>/ ${C.num(prevu, 0)}</small>` : ''}</p>
            ${prevu > 0 ? bar(depense, prevu) : ''}</div>`;
      const cols = (pick) => hist.map((h) => ({ label: h.label, tip: `Semaine ${C.weekNo(h.wid)} · ${C.weekLabel(h.wid)}`, now: h.wid === wid, values: pick(h) }));

      root.innerHTML = `
        <header class="head"><div><h1 class="title">Budget</h1></div>
          <div class="head-a"><button class="btn btn--citron" data-act="bud.ticket">${icon('receipt', 18)} Photographier un ticket</button><button class="btn btn--ghost" data-act="bud.add">${icon('plus', 18)} Noter une dépense</button></div></header>

        <section class="grid bud-cases">
          ${caseReel('Cette semaine', spent, st.weeklyBudget || 0)}
          ${caseReel('Ce mois', m.spent, m.budget)}
          ${caseReel('Le mois dernier', moisDernier.spent, 0)}
        </section>

        <section class="sec card">
          <div class="sec-h"><div><h2 class="h3">Dépenses par semaine</h2><p class="small muted">Huit dernières semaines, en CHF</p></div>
            <div class="legend"><span><i style="background:${S1}"></i>Planifié (estimation)</span><span><i style="background:${S2}"></i>Dépensé (saisi)</span>${hasBudget ? '<span><i class="dash"></i>Budget</span>' : ''}</div></div>
          ${
            anyHist
              ? `${C.bars({ cols: cols((h) => [h.planned, h.spent]), series: [{ name: 'Planifié', color: S1 }, { name: 'Dépensé', color: S2 }], ref: hasBudget ? { value: st.weeklyBudget, label: `Budget ${C.num(st.weeklyBudget, 0)}` } : null })}`
              : '<p class="muted small" style="padding:26px 0 8px">Le graphique apparaîtra dès qu’une semaine contiendra des repas planifiés ou une dépense notée.</p>'
          }
        </section>

        <section class="sec card">
          <div class="sec-h"><div><h2 class="h3">Dépenses réelles</h2><p class="small muted">Photographiez vos tickets de caisse (ou notez le montant) pour comparer avec l’estimation.</p></div><button class="btn btn--ghost btn--sm" data-act="bud.ticket">${icon('receipt', 16)} Ticket</button><button class="btn btn--ghost btn--sm" data-act="bud.add">${icon('plus', 16)} Noter</button></div>
          ${
            expenses.length
              ? `<div class="rows">${expenses.map((e) => `<div class="row"><span class="row-b"><span class="row-t">${e.source === 'ticket' ? `${icon('receipt', 15)} ` : ''}${esc(e.note || (e.store ? C.storeById(e.store).name : 'Courses'))}</span><span class="row-s">${C.fmtDate(e.date, { weekday: 'short', day: 'numeric', month: 'long' })}${e.store && e.note ? ` · ${C.storeById(e.store).name}` : ''}</span></span><span class="row-p">${C.chf(e.amount)}</span><button class="ibtn" data-act="bud.del" data-id="${e.id}" aria-label="Supprimer cette dépense">${icon('trash', 17)}</button></div>`).join('')}</div>${C.S.expenses.length > expenses.length ? `<p class="small muted" style="margin-top:10px">${C.S.expenses.length - expenses.length} dépenses plus anciennes sont conservées dans la sauvegarde.</p>` : ''}`
              : '<p class="muted small">Aucune dépense notée pour l’instant.</p>'
          }
        </section>`;
    },
  };

  /* ---------- Ticket de caisse → dépense du mois ----------
     Le texte est lu sur l'appareil (Tesseract.js, gratuit, déjà utilisé par le frigo) : on y cherche le total,
     la date et le magasin, puis la dépense est enregistrée tout de suite ; on peut la corriger ou l'annuler. */
  const MAX = 2000; // au-delà, ce n'est sûrement pas un ticket de courses
  const sommes = (l) => [...l.matchAll(/(\d{1,4})[.,](\d{2})(?![\d.,])/g)].map((m) => Number(`${m[1]}.${m[2]}`)).filter((v) => v > 0 && v < MAX);
  const DATE = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})\b/;
  function lireTicket(text) {
    const lignes = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const tout = C.norm(text);
    const store = /\bmigros\b/.test(tout) ? 'migros' : /\bcoop\b/.test(tout) ? 'coop' : /\blidl\b/.test(tout) ? 'lidl' : '';
    const autre = store ? '' : ((tout.match(/\b(denner|aldi|volg|spar|manor|landi|aligro|migrolino)\b/) || [])[1] || '');
    let total = 0;
    let sur = false;
    // 1. la ligne du total (« Total CHF 45.60 », « À payer », « Somme »), sans les sous-totaux, la TVA ou les rabais
    lignes.forEach((l, i) => {
      const t = C.norm(l);
      if (/\b(sous total|subtotal|zwischentotal|tva|mwst|rabais|economie|points|cumulus|supercard)\b/.test(t)) return;
      if (!/\b(total|a payer|somme|summe|net a payer|montant)\b/.test(t)) return;
      const v = sommes(l).concat(sommes(l).length ? [] : sommes(lignes[i + 1] || ''));
      v.forEach((x) => {
        if (x > total) {
          total = x;
          sur = true;
        }
      });
    });
    // 2. sinon, la ligne du paiement (carte, TWINT, espèces)
    if (!total)
      lignes.forEach((l) => {
        if (/\b(twint|carte|debit|maestro|visa|mastercard|postfinance|especes|cash|paiement)\b/.test(C.norm(l))) sommes(l).forEach((x) => (total = Math.max(total, x)));
      });
    // 3. en dernier recours, le plus grand montant (hors dates et numéros) : à vérifier
    if (!total) lignes.filter((l) => !DATE.test(l) && !/\btel\b/i.test(l)).forEach((l) => sommes(l).forEach((x) => (total = Math.max(total, x))));
    // date du ticket : la première date plausible (des 90 derniers jours)
    let date = '';
    const today = C.today();
    const limite = C.iso(C.addDays(new Date(), -90));
    for (const l of lignes) {
      const m = l.match(DATE);
      if (!m) continue;
      const y = m[3].length === 2 ? `20${m[3]}` : m[3];
      const iso = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      if (!Number.isNaN(Date.parse(iso)) && iso <= today && iso >= limite) {
        date = iso;
        break;
      }
    }
    return { total: Math.round(total * 100) / 100, sur, date: date || today, store, autre };
  }

  C.lireTicket = lireTicket; // aussi utile pour vérifier la lecture depuis la console

  function ticketSheet() {
    const st = { img: '', busy: false, progress: 0, step: '', res: null, saved: null, error: '' };
    const nomMagasin = (e) => (e.store ? C.storeById(e.store).name : e.note || 'Courses');
    const body = () => {
      if (!st.img)
        return `<p style="color:var(--ink-2)">Prenez le ticket en photo, bien à plat et éclairé. Commis lit le total, la date et le magasin directement sur votre appareil, gratuitement, et ajoute la dépense au mois en cours.</p>
          <p class="small muted" style="margin-top:8px">La première fois, le module de lecture (quelques Mo) est téléchargé puis gardé en mémoire.</p>
          <div class="head-a" style="margin-top:16px"><button class="btn btn--citron" data-act="bud.shoot" data-cam="1">${icon('camera', 18)} Prendre en photo</button><button class="btn btn--ghost" data-act="bud.shoot">Choisir une photo</button></div>`;
      const head = `<img class="shot shot--ticket" src="${st.img}" alt="Ticket analysé">`;
      if (st.busy) return `${head}<div class="gen-wait"><span class="spin"></span><div><b>${esc(st.step || 'Lecture du ticket…')}</b><div class="bar" style="width:180px"><i style="width:${Math.round(st.progress * 100)}%"></i></div></div></div>`;
      if (st.error) return `${head}<div class="note note--err">${icon('info', 18)}<span>${esc(st.error)}</span></div><button class="btn btn--ghost" data-act="bud.shoot" data-cam="1" style="margin-top:12px">Autre photo</button>`;
      const e = st.saved || { amount: st.res.total, date: st.res.date, store: st.res.store, note: st.res.autre ? st.res.autre.charAt(0).toUpperCase() + st.res.autre.slice(1) : '' };
      const msg = st.saved
        ? `<div class="note note--ok">${icon('check', 18)}<span><b>Ajouté aux dépenses de ${esc(C.monthName(C.parse(e.date)))}</b> : ${C.chf(e.amount)} · ${esc(nomMagasin(e))} · ${C.fmtDate(e.date, { day: 'numeric', month: 'long' })}.${st.res.sur ? '' : ' Le total n’était pas clairement indiqué : vérifiez le montant.'}</span></div>`
        : `<div class="note">${icon('info', 18)}<span>Le total n’a pas pu être lu. Indiquez le montant, puis enregistrez.</span></div>`;
      return `${head}${msg}
        <form class="form" id="tk-form" novalidate style="margin-top:14px">
          <div class="form-2">
            ${C.field('Montant (CHF)', `<input class="inp" name="amount" inputmode="decimal" value="${e.amount ? C.num(e.amount, 2).replace(',', '.') : ''}" placeholder="0.00" data-input="bud.tkEdit">`)}
            ${C.field('Date', `<input class="inp" type="date" name="date" value="${e.date}" max="${C.today()}" data-change="bud.tkEdit">`)}
          </div>
          ${C.field('Magasin', `<select class="inp" name="store" data-change="bud.tkEdit">${C.options([{ id: '', name: 'Non précisé' }, ...C.STORES], e.store || '')}</select>`)}
        </form>`;
    };
    const foot = () =>
      st.saved
        ? `<button class="btn btn--ghost sp" data-act="bud.tkUndo">Annuler l’ajout</button><button class="btn" data-close>Terminé</button>`
        : st.res && !st.busy
          ? `<button class="btn btn--ghost" data-close>Annuler</button><button class="btn" data-act="bud.tkSave">Enregistrer</button>`
          : `<button class="btn btn--ghost" data-close>Fermer</button>`;
    C.ui.tk = st;
    const sheet = C.sheet({ title: 'Ticket de caisse', sub: 'La dépense va directement dans le budget du mois', body, foot });
    st.refresh = () => sheet.refresh();
  }

  // Les champs corrigés mettent à jour la dépense déjà enregistrée
  const tkValues = () => {
    const f = document.getElementById('tk-form');
    const d = f ? C.formData(f) : {};
    return { amount: Math.round(C.toNum(d.amount) * 100) / 100, date: d.date || C.today(), store: d.store || '' };
  };

  Object.assign(C.acts, {
    'bud.ticket': () => ticketSheet(),
    'bud.shoot': async (el) => {
      const st = C.ui.tk;
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      if (el.dataset.cam) inp.setAttribute('capture', 'environment');
      const file = await new Promise((ok) => {
        inp.onchange = () => ok(inp.files[0] || null);
        inp.click();
      });
      if (!file) return;
      try {
        st.img = await C.readImage(file, 2000);
      } catch (e) {
        return C.toast('Image illisible.');
      }
      Object.assign(st, { busy: true, error: '', res: null, saved: null, progress: 0, step: 'Préparation du module de lecture…' });
      st.refresh();
      let worker = null;
      try {
        const T = await C.ticket.load();
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
        st.res = lireTicket(data.text || '');
        if (st.res.total > 0) {
          // directement dans les dépenses du mois
          st.saved = { id: C.uid(), amount: st.res.total, date: st.res.date, store: st.res.store, note: st.res.autre ? st.res.autre.charAt(0).toUpperCase() + st.res.autre.slice(1) : '', source: 'ticket' };
          C.save.expense(st.saved);
        }
      } catch (e) {
        st.error = `Lecture impossible : ${e.message || e}`;
      }
      if (worker) worker.terminate();
      st.busy = false;
      st.refresh();
    },
    'bud.tkEdit': () => {
      const st = C.ui.tk;
      if (!st || !st.saved) return;
      const v = tkValues();
      if (!(v.amount > 0)) return;
      st.saved = { ...st.saved, ...v };
      C.save.expense(st.saved);
    },
    'bud.tkSave': () => {
      const st = C.ui.tk;
      const v = tkValues();
      if (!(v.amount > 0)) return C.toast('Indiquez un montant.');
      st.saved = { id: C.uid(), ...v, note: st.res && st.res.autre ? st.res.autre.charAt(0).toUpperCase() + st.res.autre.slice(1) : '', source: 'ticket' };
      st.res = { ...(st.res || {}), sur: true };
      C.save.expense(st.saved);
      st.refresh();
    },
    'bud.tkUndo': () => {
      const st = C.ui.tk;
      if (!st || !st.saved) return;
      C.save.delExpense(st.saved.id);
      C.closeSheet();
      C.toast('Ticket retiré des dépenses');
    },
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
