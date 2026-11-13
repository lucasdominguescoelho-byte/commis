/* Commis — synchronisation entre appareils par un dépôt GitHub privé (gratuit, sans serveur).

   Chaque appareil garde ses données dans son navigateur et continue de marcher hors ligne.
   Quand il a du réseau, il récupère les changements des autres appareils et envoie les siens :
     - chaque élément enregistré reçoit une date de modification (_m) ;
     - chaque suppression laisse une trace datée (pierre tombale) pour ne pas « ressusciter » l'élément ;
     - à la fusion, la version la plus récente d'un élément gagne.
   Dans le dépôt : commis/<table>.json (frigo, dépenses, planning, listes, promotions saisies, réglages)
   et commis/recettes/<id>.json (une recette par fichier : les photos pèsent lourd), plus l'index
   commis/recettes.json. Tout part en un seul commit (API Git de GitHub).

   Le jeton (accès limité à ce seul dépôt) reste sur l'appareil, dans le navigateur ; il n'est ni
   exporté dans les sauvegardes ni publié. */
(function () {
  'use strict';
  const C = window.C;

  const API = 'https://api.github.com';
  const CFG_KEY = 'commis-sync'; // { repo, token }
  const ETAT_KEY = 'commis-sync-etat'; // { head, shas: {chemin: sha}, last, count, error }
  const TABLES = ['plans', 'lists', 'expenses', 'fridge', 'promotions', 'kv'];
  const RACINE = 'commis';
  const GARDE_TOMBES = 90 * 864e5; // les traces de suppression de plus de 90 jours sont oubliées

  const lire = (k, def) => {
    try {
      return JSON.parse(localStorage.getItem(k)) || def;
    } catch (e) {
      return def;
    }
  };
  const ecrire = (k, v) => {
    try {
      if (v == null) localStorage.removeItem(k);
      else localStorage.setItem(k, JSON.stringify(v));
    } catch (e) { /* stockage plein ou bloqué */ }
  };
  const cfg = () => lire(CFG_KEY, null);
  const etat = () => lire(ETAT_KEY, { shas: {} });

  /* ---------- Ce qui se synchronise ---------- */
  // Les promotions automatiques viennent du site (data/promotions.json) : chaque appareil les relit lui-même.
  const suivi = (t, v) =>
    ['recipes', 'plans', 'lists', 'expenses', 'fridge'].includes(t) || (t === 'promotions' && v && !v.auto) || (t === 'kv' && v && v.id === 'settings');
  const suiviDel = (t, id) => ['recipes', 'plans', 'lists', 'expenses', 'fridge'].includes(t) || (t === 'promotions' && !String(id).startsWith('x-auto'));

  /* ---------- Dates de modification et traces de suppression ---------- */
  let calme = true; // pendant le chargement (exemples, migrations) : rien n'est daté, rien ne part
  let tombes = { id: 'tombs', t: {} };
  const put0 = C.db.put;
  const del0 = C.db.del;
  C.db.put = (t, v, opts) => {
    const garder = calme || (opts && opts.keep);
    if (v && typeof v === 'object' && !garder && suivi(t, v)) {
      v._m = Date.now();
      plusTard();
    }
    return put0(t, v);
  };
  C.db.del = (t, id, opts) => {
    if (!calme && !(opts && opts.keep) && suiviDel(t, id)) {
      (tombes.t[t] = tombes.t[t] || {})[id] = Date.now();
      put0('kv', tombes);
      plusTard();
    }
    return del0(t, id);
  };

  /* ---------- API GitHub ---------- */
  async function gh(chemin, opts = {}) {
    const c = cfg();
    const res = await fetch(API + chemin, {
      method: opts.method || 'GET',
      headers: { Authorization: `Bearer ${c.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store',
    });
    if (!res.ok) {
      const err = new Error(message(res.status));
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? null : res.json();
  }
  const message = (s) =>
    s === 401 ? 'Jeton refusé (expiré ou mal copié).'
    : s === 403 ? 'Le jeton n’a pas le droit d’écrire dans ce dépôt (permission « Contents » en lecture et écriture).'
    : s === 404 ? 'Dépôt introuvable, ou le jeton n’y a pas accès.'
    : s === 409 ? 'Le dépôt est vide.'
    : s === 422 ? 'Un autre appareil a envoyé ses changements en même temps.'
    : `GitHub a répondu ${s}.`;

  const decode = (b64) => {
    const bin = atob(b64.replace(/\n/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  };
  const nomFichier = (id) => String(id).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80) + '.json';
  const appareil = () => (/iPhone|iPad|Android/i.test(navigator.userAgent) ? 'téléphone' : 'ordinateur');

  /* ---------- Une synchronisation ---------- */
  let enCours = null;
  let minuterie = 0;
  function plusTard() {
    if (!cfg()) return;
    clearTimeout(minuterie);
    minuterie = setTimeout(() => C.sync.now(), 4000);
  }

  async function lireLocal() {
    const [recipes, plans, lists, expenses, fridge, promotions, kv] = await Promise.all(['recipes', 'plans', 'lists', 'expenses', 'fridge', 'promotions', 'kv'].map((t) => C.db.all(t)));
    return {
      recipes: recipes || [],
      plans: plans || [],
      lists: lists || [],
      expenses: expenses || [],
      fridge: fridge || [],
      promotions: (promotions || []).filter((p) => !p.auto),
      kv: (kv || []).filter((k) => k.id === 'settings'),
    };
  }

  // Fusion d'une table : pour chaque identifiant, la version (ou la suppression) la plus récente gagne.
  // À égalité sans date (jamais modifié nulle part), la version déjà dans le dépôt est gardée ;
  // à égalité avec une date, c'est la même version : on garde celle de l'appareil (rien à réécrire).
  function fusion(locaux, tombesLoc, distant) {
    const res = { items: {}, tombs: {} };
    const loc = Object.fromEntries(locaux.map((x) => [x.id, x]));
    const ids = new Set([...Object.keys(loc), ...Object.keys(tombesLoc), ...Object.keys(distant.items || {}), ...Object.keys(distant.tombs || {})]);
    const limite = Date.now() - GARDE_TOMBES;
    ids.forEach((id) => {
      const cands = [];
      if (distant.items && distant.items[id]) cands.push({ m: distant.items[id]._m || 0, item: distant.items[id], ici: false });
      if (distant.tombs && distant.tombs[id]) cands.push({ m: distant.tombs[id], tomb: true, ici: false });
      if (loc[id]) cands.push({ m: loc[id]._m || 0, item: loc[id], ici: true });
      if (tombesLoc[id]) cands.push({ m: tombesLoc[id], tomb: true, ici: true });
      cands.sort((a, b) => b.m - a.m || (a.ici === b.ici ? 0 : (a.ici ? 1 : -1) * (a.m === 0 ? 1 : -1)));
      const g = cands[0];
      if (g.tomb) {
        if (g.m > limite) res.tombs[id] = g.m;
      } else res.items[id] = g.item;
    });
    return res;
  }

  // Même contenu d'un point de vue synchronisation : mêmes éléments aux mêmes dates, mêmes suppressions
  const pareil = (a, b) => {
    const ia = Object.keys(a.items || {});
    const ta = Object.keys(a.tombs || {});
    return (
      ia.length === Object.keys(b.items || {}).length &&
      ta.length === Object.keys(b.tombs || {}).length &&
      ia.every((id) => b.items[id] && (b.items[id]._m || 0) === (a.items[id]._m || 0)) &&
      ta.every((id) => b.tombs[id] === a.tombs[id])
    );
  };
  const sansMeta = (v) => JSON.stringify({ ...v, promoMeta: null });

  async function synchroniser() {
    const c = cfg();
    if (!c) return { skipped: true };
    const st = etat();
    const [owner, repo] = c.repo.split('/');
    const base = `/repos/${owner}/${repo}`;

    // 1. Où en est le dépôt ? (dépôt vide : on y dépose un petit mot pour créer le premier commit)
    const info = await gh(base);
    const branche = info.default_branch || 'main';
    let ref;
    try {
      ref = await gh(`${base}/git/ref/heads/${branche}`);
    } catch (e) {
      if (e.status !== 409 && e.status !== 404) throw e;
      await gh(`${base}/contents/${RACINE}/LISEZMOI.md`, { method: 'PUT', body: { message: 'Commis : début de la synchronisation', content: btoa(unescape(encodeURIComponent('Données de Commis (synchronisation entre appareils). Ne pas modifier à la main.\n'))) } });
      ref = await gh(`${base}/git/ref/heads/${branche}`);
    }
    const head = ref.object.sha;
    const commit = await gh(`${base}/git/commits/${head}`);
    const arbre = await gh(`${base}/git/trees/${commit.tree.sha}?recursive=1`);
    const fichiers = Object.fromEntries((arbre.tree || []).filter((f) => f.type === 'blob').map((f) => [f.path, f.sha]));

    // 2. Lire ce qui a changé dans le dépôt depuis la dernière fois (les fichiers inchangés ne sont pas retéléchargés)
    const cache = lire('commis-sync-cache', {}); // contenu des fichiers de tables déjà lus { chemin: {sha, data} }
    const lireFichier = async (chemin) => {
      const sha = fichiers[chemin];
      if (!sha) return null;
      if (cache[chemin] && cache[chemin].sha === sha) return cache[chemin].data;
      const blob = await gh(`${base}/git/blobs/${sha}`);
      const data = decode(blob.content);
      if (!chemin.startsWith(`${RACINE}/recettes/`)) cache[chemin] = { sha, data };
      return data;
    };

    const local = await lireLocal();
    const kvTous = (await C.db.all('kv')) || [];
    tombes = kvTous.find((k) => k.id === 'tombs') || tombes;
    const tLoc = (t) => (tombes.t && tombes.t[t]) || {};

    const sorties = []; // fichiers à écrire dans le dépôt : { path, content } ou { path, sha: null } pour supprimer
    let recus = 0;
    const ecritsLocal = [];

    // 3. Tables (un fichier chacune)
    for (const t of TABLES) {
      const chemin = `${RACINE}/${t}.json`;
      const distant = (await lireFichier(chemin)) || { items: {}, tombs: {} };
      const f = fusion(local[t], tLoc(t), distant);
      // côté appareil : ce qui vient d'ailleurs
      const loc = Object.fromEntries(local[t].map((x) => [x.id, x]));
      for (const [id, item] of Object.entries(f.items)) {
        const l = loc[id];
        if (l === item || (l && (t === 'kv' ? sansMeta(l) === sansMeta(item) : JSON.stringify(l) === JSON.stringify(item)))) continue;
        {
          let v = item;
          if (t === 'kv') v = { ...item, promoMeta: (local.kv[0] || {}).promoMeta || null }; // propre à chaque appareil
          ecritsLocal.push(put0(t, v));
          recus++;
        }
      }
      for (const [id, ts] of Object.entries(f.tombs)) {
        if (loc[id]) {
          ecritsLocal.push(del0(t, id));
          recus++;
        }
        (tombes.t[t] = tombes.t[t] || {})[id] = ts;
      }
      // côté dépôt : n'écrire que si le contenu change
      const pourDepot = { items: f.items, tombs: f.tombs };
      if (t === 'kv') for (const k of Object.keys(pourDepot.items)) pourDepot.items[k] = { ...pourDepot.items[k], promoMeta: null };
      if (!pareil(pourDepot, distant)) sorties.push({ path: chemin, content: JSON.stringify(pourDepot), data: pourDepot });
    }

    // 4. Recettes (un fichier par recette, et un index des dates)
    const cheminIndex = `${RACINE}/recettes.json`;
    const index = (await lireFichier(cheminIndex)) || { items: {}, tombs: {} };
    const distantsR = { items: Object.fromEntries(Object.entries(index.items || {}).map(([id, x]) => [id, { id, _m: x.m, __f: x.f }])), tombs: index.tombs || {} };
    const fR = fusion(local.recipes, tLoc('recipes'), distantsR);
    const locR = Object.fromEntries(local.recipes.map((r) => [r.id, r]));
    const nouvelIndex = { items: {}, tombs: fR.tombs };
    for (const [id, gagnant] of Object.entries(fR.items)) {
      const f = nomFichier(id);
      if (gagnant.__f !== undefined) {
        // la version du dépôt gagne : on la télécharge si elle est plus récente que la nôtre
        const l = locR[id];
        if (!l || (l._m || 0) < (gagnant._m || 0)) {
          const r = await lireFichier(`${RACINE}/recettes/${gagnant.__f}`);
          if (r && r.id) {
            ecritsLocal.push(put0('recipes', r));
            recus++;
          }
        }
        nouvelIndex.items[id] = { m: gagnant._m || 0, f: gagnant.__f };
      } else {
        const deja = index.items && index.items[id];
        if (deja && deja.m === (gagnant._m || 0) && fichiers[`${RACINE}/recettes/${deja.f}`]) {
          nouvelIndex.items[id] = deja; // même version que dans le dépôt : rien à renvoyer
          continue;
        }
        // la nôtre est plus récente : on l'envoie
        sorties.push({ path: `${RACINE}/recettes/${f}`, content: JSON.stringify(gagnant) });
        nouvelIndex.items[id] = { m: gagnant._m || 0, f };
      }
    }
    for (const [id, ts] of Object.entries(fR.tombs)) {
      if (locR[id]) {
        ecritsLocal.push(del0('recipes', id));
        recus++;
      }
      (tombes.t.recipes = tombes.t.recipes || {})[id] = ts;
      const ancien = index.items && index.items[id] && index.items[id].f;
      if (ancien && fichiers[`${RACINE}/recettes/${ancien}`]) sorties.push({ path: `${RACINE}/recettes/${ancien}`, sha: null });
    }
    const memeIndex =
      Object.keys(nouvelIndex.items).length === Object.keys(index.items || {}).length &&
      Object.entries(nouvelIndex.items).every(([id, x]) => index.items[id] && index.items[id].m === x.m && index.items[id].f === x.f) &&
      pareil({ items: {}, tombs: nouvelIndex.tombs }, { items: {}, tombs: index.tombs || {} });
    if (!memeIndex) sorties.push({ path: cheminIndex, content: JSON.stringify(nouvelIndex) });

    // 5. Appliquer sur l'appareil, puis envoyer au dépôt en un seul commit
    await Promise.all(ecritsLocal);
    await put0('kv', tombes);
    let nouveauHead = head;
    if (sorties.length) {
      const entrees = [];
      for (const s of sorties) {
        if (s.sha === null) {
          entrees.push({ path: s.path, mode: '100644', type: 'blob', sha: null });
          continue;
        }
        const blob = await gh(`${base}/git/blobs`, { method: 'POST', body: { content: s.content, encoding: 'utf-8' } });
        entrees.push({ path: s.path, mode: '100644', type: 'blob', sha: blob.sha });
        if (s.data) cache[s.path] = { sha: blob.sha, data: s.data };
      }
      const tree = await gh(`${base}/git/trees`, { method: 'POST', body: { base_tree: commit.tree.sha, tree: entrees } });
      const nouveau = await gh(`${base}/git/commits`, { method: 'POST', body: { message: `Commis : changements depuis le ${appareil()}`, tree: tree.sha, parents: [head] } });
      await gh(`${base}/git/refs/heads/${branche}`, { method: 'PATCH', body: { sha: nouveau.sha } }); // échoue (422) si un autre appareil a écrit entre-temps
      nouveauHead = nouveau.sha;
    }
    ecrire('commis-sync-cache', cache);
    const total = local.recipes.length + local.plans.length + local.lists.length + local.expenses.length + local.fridge.length;
    ecrire(ETAT_KEY, { ...st, head: nouveauHead, last: Date.now(), count: total, error: '' });
    return { recus, envoyes: sorties.length };
  }

  C.sync = {
    config: cfg,
    etat,
    async now(opts = {}) {
      if (!cfg()) return { skipped: true };
      if (enCours) return enCours;
      enCours = (async () => {
        let res;
        for (let essai = 0; essai < 3; essai++) {
          try {
            res = await synchroniser();
            break;
          } catch (e) {
            if (e.status === 422 && essai < 2) continue; // un autre appareil vient d'écrire : on relit et on refait
            if (!e.status) {
              res = { offline: true }; // pas de réseau : ce sera pour la prochaine fois
              break;
            }
            ecrire(ETAT_KEY, { ...etat(), error: e.message || String(e), errorAt: Date.now() });
            res = { error: e.message || String(e) };
            break;
          }
        }
        if (res && res.recus) {
          await C.reloadState();
          C.changed();
          if (!opts.quiet) C.toast(`Synchronisé : ${res.recus} changement${res.recus > 1 ? 's' : ''} reçu${res.recus > 1 ? 's' : ''} d’un autre appareil`);
        } else if (C.route && C.route().view === 'reglages') C.render();
        return res;
      })();
      try {
        return await enCours;
      } finally {
        enCours = null;
      }
    },
    // Teste le dépôt et le jeton avant de les garder sur l'appareil
    async connect(repo, token) {
      repo = String(repo || '').trim().replace(/^https:\/\/github\.com\//, '').replace(/\/+$/, '').replace(/\.git$/, '');
      token = String(token || '').trim();
      if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Indiquez le dépôt sous la forme « compte/nom ».');
      if (!token) throw new Error('Collez le jeton d’accès.');
      const avant = cfg();
      ecrire(CFG_KEY, { repo, token });
      try {
        const info = await gh(`/repos/${repo}`);
        if (!info.private) throw new Error('Ce dépôt est public : vos données y seraient visibles par tous. Rendez-le privé (Settings › Danger Zone › Change visibility).');
      } catch (e) {
        ecrire(CFG_KEY, avant);
        throw e;
      }
      ecrire(ETAT_KEY, { shas: {} });
      ecrire('commis-sync-cache', {});
      return C.sync.now();
    },
    disconnect() {
      ecrire(CFG_KEY, null);
      ecrire(ETAT_KEY, null);
      ecrire('commis-sync-cache', null);
    },
  };

  // Après le chargement : on commence à dater les changements, puis première synchronisation
  const load0 = C.load;
  C.load = async () => {
    calme = true;
    try {
      await load0();
      const kv = (await C.db.all('kv')) || [];
      tombes = kv.find((k) => k.id === 'tombs') || { id: 'tombs', t: {} };
    } finally {
      calme = false;
    }
    if (cfg()) setTimeout(() => C.sync.now({ quiet: false }), 800);
  };
  // Au retour sur l'app, et toutes les 3 minutes tant qu'elle est ouverte
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && cfg() && C.sync.now());
  window.addEventListener('online', () => cfg() && C.sync.now());
  setInterval(() => document.visibilityState === 'visible' && cfg() && C.sync.now({ quiet: false }), 3 * 60 * 1000);
})();
