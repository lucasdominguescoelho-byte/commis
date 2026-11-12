/* Cabas — Recettes › Générer : idées de recettes créées sur le moment par l'IA,
   à partir des promotions de la semaine et, sur demande, des aliments du frigo.
   Les idées retenues partent dans « À tester » ; on les valide après les avoir cuisinées. */
(function () {
  'use strict';
  const C = window.C;
  const { esc, icon } = C;
  const E = C.eng;

  const G = (C.ui.gen = { count: 3, people: 0, maxTime: 0, wish: '', promos: true, fridge: false, fridgeIds: null, busy: false, results: [], saved: {}, error: '', cost: null });
  const people = () => G.people || C.S.settings.household || 2;
  const soon = (f) => E.expiresIn(f) != null && E.expiresIn(f) <= 3;

  function setup() {
    return `<div class="card gen-setup">
      <h2 class="h2">Générer des recettes avec l’IA</h2>
      <p class="lede">Cabas peut demander à Claude, l’IA d’Anthropic, d’inventer des recettes avec les promotions de la semaine et ce qu’il vous reste au frigo. Il faut pour cela une clé d’API Anthropic, payée à l’usage : environ 5 centimes par génération.</p>
      <ol class="hero-steps" style="margin-top:18px">
        <li><span>Créez un compte sur <a class="link" href="https://console.anthropic.com" target="_blank" rel="noopener">console.anthropic.com</a> et ajoutez un peu de crédit (5 $ suffisent pour des dizaines de générations).</span></li>
        <li><span>Créez une clé d’API (fixez une limite de dépense mensuelle si vous voulez être tranquille).</span></li>
        <li><span>Collez-la dans Réglages → Intelligence artificielle. Elle reste sur cet appareil.</span></li>
      </ol>
      <a class="btn" href="#/reglages" style="margin-top:20px">Ajouter ma clé</a>
    </div>`;
  }

  function form() {
    const fridge = C.S.fridge.slice().sort((a, b) => (E.expiresIn(a) ?? 99) - (E.expiresIn(b) ?? 99));
    if (G.fridgeIds == null) G.fridgeIds = fridge.map((f) => f.id);
    const chip = (label, on, attrs) => `<button class="chip ${on ? 'is-on' : ''}" ${attrs} aria-pressed="${!!on}">${label}</button>`;
    const nPromos = E.activePromos(C.weekId()).filter((p) => p.match || !p.auto).length;
    return `<div class="card gen-form">
      <div class="gen-row">
        <div class="field"><span>Nombre d’idées</span><div class="seg">${[1, 3, 5].map((n) => `<button class="${G.count === n ? 'is-on' : ''}" data-act="gen.count" data-v="${n}">${n}</button>`).join('')}</div></div>
        <div class="field"><span>Pour</span><div class="step"><button data-act="gen.people" data-d="-1" aria-label="Moins">${icon('minus', 16)}</button><b>${people()}</b><button data-act="gen.people" data-d="1" aria-label="Plus">${icon('plus', 16)}</button><span>pers.</span></div></div>
        ${C.field('Temps', `<select class="inp" data-change="gen.time">${C.options([{ id: 0, name: 'Peu importe' }, { id: 20, name: '20 min max' }, { id: 30, name: '30 min max' }, { id: 45, name: '45 min max' }], G.maxTime)}</select>`)}
      </div>
      <div class="field"><span>Utiliser</span><div class="chips">
        ${chip(`${icon('tag', 15)} Les promotions (${nPromos})`, G.promos, 'data-act="gen.toggle" data-k="promos"')}
        ${chip(`${icon('fridge', 15)} Mon frigo${C.S.fridge.length ? ` (${C.S.fridge.length})` : ''}`, G.fridge, 'data-act="gen.toggle" data-k="fridge"')}
      </div></div>
      ${
        G.fridge
          ? fridge.length
            ? `<div class="field"><span>Aliments du frigo à intégrer</span><div class="chips">${fridge.map((f) => chip(`${esc(f.name)}${soon(f) ? ' <em class="dot-soon" title="À consommer vite"></em>' : ''}`, G.fridgeIds.includes(f.id), `data-act="gen.item" data-id="${f.id}"`)).join('')}</div></div>`
            : `<p class="small muted">Votre frigo est vide. <a class="link" href="#/frigo">Ajouter des aliments</a></p>`
          : ''
      }
      ${C.field('Envie particulière', `<input class="inp" value="${esc(G.wish)}" data-input="gen.wish" placeholder="ex. plat réconfortant, sans four, cuisine asiatique, à emporter…" maxlength="160">`, 'Facultatif. Vos régime, allergies et aliments évités (Réglages) sont toujours respectés.')}
      <div class="gen-go">
        <button class="btn btn--citron" data-act="gen.go" ${G.busy || (!G.promos && !(G.fridge && G.fridgeIds.length)) ? 'disabled' : ''}>${icon('wand', 18)} ${G.busy ? 'Génération en cours…' : `Générer ${G.count} idée${G.count > 1 ? 's' : ''}`}</button>
        <span class="small muted">Envoie les promotions, vos préférences${G.fridge ? ' et les aliments choisis' : ''} à Claude (Anthropic).</span>
      </div>
    </div>`;
  }

  function idea(r) {
    const saved = G.saved[r.id];
    const c = E.recipeCost(r, r.servings, E.activePromos(C.weekId()));
    const fromFridge = r.ingredients.filter((i) => i.frigo).length;
    return `<article class="card idea">
      <div class="idea-h"><div><p class="eyebrow">${esc(r.category)}</p><h3 class="rc-n">${esc(r.name)}</h3></div>
        <div class="meta"><span>${icon('clock', 15)}${r.prepTime} min</span><span>${icon('users', 15)}${r.servings}</span><span>${C.chf(c.cost)}</span></div></div>
      ${r.description ? `<p class="idea-d">${esc(r.description)}</p>` : ''}
      <div class="chips" style="gap:6px">${c.promoIngs.length ? `<span class="badge badge--promo">${c.promoIngs.length} en promo${c.savings >= 0.05 ? ` · −${C.chf(c.savings)}` : ''}</span>` : ''}${fromFridge ? `<span class="badge badge--frigo">${fromFridge} du frigo</span>` : ''}${c.stores.map(C.storeChip).join('')}</div>
      ${r.why ? `<ul class="why" style="margin-top:12px"><li>${esc(r.why)}</li></ul>` : ''}
      <details class="idea-more"><summary>Ingrédients et préparation</summary>
        <div style="margin-top:8px">${C.ingLines(c)}</div>
        <ol class="steps" style="margin-top:18px">${r.steps.map((s) => `<li><span>${esc(s)}</span></li>`).join('')}</ol>
      </details>
      <div class="idea-a">${
        saved
          ? `<span class="badge badge--soft">${icon('check', 14)} Dans « À tester »</span><a class="link" href="#/recettes/${r.id}">Ouvrir</a>`
          : `<button class="btn btn--ghost btn--sm" data-act="gen.drop" data-id="${r.id}">Écarter</button><button class="btn btn--ghost btn--sm" data-act="gen.plan" data-id="${r.id}">${icon('calendar', 16)} Planifier</button><button class="btn btn--sm" data-act="gen.keep" data-id="${r.id}">Garder à tester</button>`
      }</div>
    </article>`;
  }

  function results() {
    if (G.busy)
      return `<div class="gen-wait"><span class="spin" aria-hidden="true"></span><div><b>Claude prépare ${G.count} idée${G.count > 1 ? 's' : ''}…</b><p class="small muted">Il compare les promotions${G.fridge && G.fridgeIds.length ? ' et votre frigo' : ''} avec vos préférences. Comptez 20 à 60 secondes.</p></div></div>`;
    if (G.error) return `<div class="note note--err">${icon('info', 18)}<span>${esc(G.error)}</span></div>`;
    if (!G.results.length) return '';
    return `<div class="sec-h" style="margin-top:28px"><h2 class="h2">Idées</h2>${G.cost != null ? `<span class="small muted">Coût de cette génération : ${C.ia.fmtCost(G.cost)}</span>` : ''}</div>
      <div class="ideas">${G.results.map(idea).join('')}</div>
      <p class="small muted" style="margin-top:14px">Recettes inventées par une IA : relisez quantités et cuissons avant de vous lancer. Les prix sont des estimations, les rabais viennent des promotions réelles.</p>`;
  }

  C.generator = {
    render(root) {
      root.innerHTML = C.ia.ready() ? form() + `<div id="gen-out">${results()}</div>` : setup();
    },
    // Ouvre le générateur avec le frigo activé (depuis la page Frigo).
    withFridge(ids) {
      G.fridge = true;
      G.fridgeIds = ids && ids.length ? ids : C.S.fridge.map((f) => f.id);
      C.ui.rtab = 'generer';
      C.go('#/recettes');
    },
  };

  const keep = (id) => {
    const r = G.results.find((x) => x.id === id);
    if (!r || G.saved[id]) return r;
    const { why, ...rest } = r;
    C.save.recipe({ ...rest, description: r.description || why });
    G.saved[id] = true;
    return r;
  };

  Object.assign(C.acts, {
    'gen.count': (el) => { G.count = Number(el.dataset.v); C.render(); },
    'gen.people': (el) => { G.people = Math.max(1, Math.min(12, people() + Number(el.dataset.d))); C.render(); },
    'gen.time': (el) => { G.maxTime = Number(el.value); },
    'gen.wish': (el) => { G.wish = el.value; },
    'gen.toggle': (el) => { G[el.dataset.k] = !G[el.dataset.k]; C.render(); },
    'gen.item': (el) => {
      const id = el.dataset.id;
      G.fridgeIds = G.fridgeIds.includes(id) ? G.fridgeIds.filter((x) => x !== id) : [...G.fridgeIds, id];
      C.render();
    },
    'gen.go': async () => {
      if (G.busy) return;
      G.busy = true;
      G.error = '';
      C.render();
      try {
        const res = await C.ia.recipes({ count: G.count, people: people(), maxTime: G.maxTime, wish: G.wish.trim(), usePromos: G.promos, fridgeIds: G.fridge ? G.fridgeIds : [] });
        G.results = res.recipes;
        G.saved = {};
        G.cost = res.cost;
        if (!res.recipes.length) G.error = 'Aucune idée reçue, réessayez.';
      } catch (e) {
        G.error = e.message;
      }
      G.busy = false;
      C.render();
      const out = document.getElementById('gen-out');
      if (out && G.results.length) out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    'gen.keep': (el) => {
      keep(el.dataset.id);
      C.toast('Gardée dans « À tester »');
    },
    'gen.plan': (el) => {
      const r = keep(el.dataset.id);
      if (r) C.acts['rec.plan']({ dataset: { id: r.id } });
    },
    'gen.drop': (el) => {
      G.results = G.results.filter((r) => r.id !== el.dataset.id);
      C.render();
    },
  });
})();
