/* Commis — coquille de l'application : navigation, routeur, délégation des événements, démarrage. */
(function () {
  'use strict';
  const C = window.C;
  const { icon } = C;

  const NAV = [
    { id: 'accueil', label: 'Accueil', icon: 'home' },
    { id: 'planning', label: 'Planning', icon: 'calendar' },
    { id: 'recettes', label: 'Recettes', icon: 'book' },
    { id: 'frigo', label: 'Frigo', icon: 'fridge' },
    { id: 'courses', label: 'Courses', icon: 'cart' },
    { id: 'promotions', label: 'Promotions', short: 'Promos', icon: 'tag' },
    { id: 'budget', label: 'Budget', icon: 'wallet' },
  ];
  const TITLES = { accueil: 'Accueil', planning: 'Planning', recettes: 'Recettes', frigo: 'Frigo', courses: 'Courses', promotions: 'Promotions', budget: 'Budget', reglages: 'Réglages' };

  C.views = C.views || {};
  C.acts = C.acts || {};

  // Marque : un cabas de marché en paille — corps évasé, deux bandes tressées en réserve, anse fine.
  const mark = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 9.2c0-3.3 1.3-5 3.5-5s3.5 1.7 3.5 5" stroke="currentColor" stroke-width="1.7"/><path d="M3.9 9.4h16.2l-2.5 8.9a2.6 2.6 0 0 1-2.5 1.9H8.9a2.6 2.6 0 0 1-2.5-1.9z" fill="currentColor" stroke="currentColor" stroke-width="1.2"/><path d="M3.2 12.5q8.8 1.8 17.6 0M4.3 15.9q7.7 1.7 15.4 0" stroke="var(--ink)" stroke-width="1.35" stroke-linecap="butt"/></svg>';
  C.logoMark = mark; // repris par le questionnaire de bienvenue
  const logo = `<a class="logo" href="#/accueil" aria-label="${C.APP} — accueil"><span class="logo-mark">${mark}</span><span class="logo-name">${C.APP}</span></a>`;

  C.route = () => {
    const [view, param] = location.hash.replace(/^#\/?/, '').split('/');
    return { view: C.views[view] ? view : 'accueil', param: param ? decodeURIComponent(param) : '' };
  };
  C.go = (hash) => {
    if (location.hash === hash) C.render();
    else location.hash = hash;
  };

  /* ---------- Mode nuit : ambiance sombre et chaude ---------- */
  // Lever et coucher du soleil, calculés sur l'appareil (algorithme de l'« Almanac for Computers »,
  // précis à une ou deux minutes) pour un point moyen de Suisse romande.
  const LIEU = { lat: 46.6, lon: 6.6 };
  C.sunTimes = (date = new Date(), lat = LIEU.lat, lon = LIEU.lon) => {
    const rad = Math.PI / 180;
    const y = date.getFullYear();
    const mo = date.getMonth();
    const d = date.getDate();
    const n = Math.round((Date.UTC(y, mo, d) - Date.UTC(y, 0, 0)) / 864e5);
    const lngH = lon / 15;
    const at = (rising) => {
      const t = n + ((rising ? 6 : 18) - lngH) / 24;
      const M = 0.9856 * t - 3.289;
      let L = M + 1.916 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 282.634;
      L = ((L % 360) + 360) % 360;
      let RA = Math.atan(0.91764 * Math.tan(L * rad)) / rad;
      RA = ((RA % 360) + 360) % 360;
      RA = (RA + Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90) / 15;
      const sinDec = 0.39782 * Math.sin(L * rad);
      const cosDec = Math.cos(Math.asin(sinDec));
      const cosH = (Math.cos(90.833 * rad) - sinDec * Math.sin(lat * rad)) / (cosDec * Math.cos(lat * rad));
      if (cosH > 1 || cosH < -1) return null; // pas de lever ni de coucher (jamais en Suisse)
      const H = (rising ? 360 - Math.acos(cosH) / rad : Math.acos(cosH) / rad) / 15;
      const T = H + RA - 0.06571 * t - 6.622;
      const UT = (((T - lngH) % 24) + 24) % 24;
      return new Date(Date.UTC(y, mo, d) + UT * 3600e3);
    };
    return { rise: at(true), set: at(false) };
  };
  C.night = () => {
    const t = C.S.settings.theme || 'jour';
    if (t === 'nuit') return true;
    if (t !== 'auto') return false;
    const now = new Date();
    const { rise, set } = C.sunTimes(now);
    return !rise || !set ? now.getHours() >= 20 || now.getHours() < 7 : now < rise || now >= set;
  };
  C.applyTheme = () => {
    const n = C.night();
    const html = document.documentElement;
    html.classList.toggle('nuit', n);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = n ? '#1B1410' : '#FFFAF6';
    try {
      localStorage.setItem('commis-nuit', n ? '1' : '0'); // relu dès le chargement (pas d'éclair blanc)
    } catch (e) {}
    if (C.k3d && C.k3d.night) C.k3d.night(n);
  };
  // En automatique : vérifié chaque minute, et au retour sur l'app
  setInterval(() => C.S.settings.theme === 'auto' && C.applyTheme(), 60 * 1000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && C.S.settings.theme === 'auto' && C.applyTheme());
  const themeBtn = (size) => `<button class="ibtn theme-t" data-act="theme.toggle" aria-label="Mode nuit" title="Mode nuit">${icon('moon', size)}${icon('sun', size)}</button>`;

  function shell(route) {
    const left = C.eng.shopping(C.weekId());
    const toBuy = left.items.length - left.done;
    const link = (n, cls) =>
      `<a class="${cls} ${route.view === n.id ? 'is-on' : ''}" href="#/${n.id}" title="${n.label}" ${route.view === n.id ? 'aria-current="page"' : ''}>${icon(n.icon, cls === 'tab' ? 22 : 20)}<span>${n.label}</span>${
        cls === 'nav-i' && n.id === 'courses' && toBuy ? `<em class="nav-n" style="font-style:normal">${toBuy}</em>` : ''
      }</a>`;
    document.getElementById('side').innerHTML = `${logo}
      <nav class="nav">${NAV.map((n) => link(n, 'nav-i')).join('')}</nav>
      <div class="side-foot">
        ${themeBtn(20)}<nav class="nav">${link({ id: 'reglages', label: 'Réglages', icon: 'settings' }, 'nav-i')}</nav>
        <p class="side-note">${C.noStorage ? 'Stockage local indisponible : les données ne seront pas conservées.' : 'Données enregistrées sur cet appareil uniquement.'}</p>
      </div>`;
    document.getElementById('topbar').innerHTML = `${logo}<div>${themeBtn(22)}<a class="ibtn ${route.view === 'budget' ? 'is-on' : ''}" href="#/budget" aria-label="Budget">${icon('wallet', 22)}</a><a class="ibtn ${route.view === 'reglages' ? 'is-on' : ''}" href="#/reglages" aria-label="Réglages">${icon('settings', 22)}</a></div>`;
    document.getElementById('tabs').innerHTML = NAV.slice(0, 6).map((n) => link({ ...n, label: n.short || n.label }, 'tab')).join('');
  }

  let last = '';
  C.render = () => {
    const route = C.route();
    const root = document.getElementById('view');
    const id = route.view + '/' + route.param;
    const changed = id !== last;
    last = id;
    shell(route);
    C.applyTheme();
    root.classList.toggle('fade', changed);
    root.dataset.view = route.view; // dispositions propres à une page (ex. accueil)
    // Cuisine 3D : plein écran par défaut ; le mode choisi (plein écran ou menu) est gardé
    // pendant la visite, la barre de menu passe alors par-dessus la pièce (k3-home)
    const html = document.documentElement;
    const home = route.view === 'accueil' && !C.k3dFailed && !!C.k3d && C.k3d.supported();
    html.classList.toggle('k3-home', home);
    html.classList.toggle('k3-full', home && !!C.ui.full);
    C.views[route.view].render(root, route.param);
    if (!root.querySelector('.k3')) html.classList.remove('k3-full', 'k3-home');
    document.title = `${TITLES[route.view]} — ${C.APP}`;
    if (changed) window.scrollTo(0, 0);
    C.sheets.forEach((s) => s.refresh && s.refresh());
  };

  /* ---------- Événements : data-act (clic), data-input, data-change ---------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = C.acts[el.dataset.act];
    if (fn) fn(el, e);
  });
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-act][tabindex]:not(button):not(a)')) {
      e.preventDefault();
      e.target.click();
    }
  });
  ['input', 'change'].forEach((type) =>
    document.addEventListener(type, (e) => {
      const el = e.target.closest(`[data-${type}]`);
      if (el && C.acts[el.dataset[type]]) C.acts[el.dataset[type]](el, e);
    })
  );

  Object.assign(C.acts, {
    'week.prev': () => { C.ui.week = C.shiftWeek(C.ui.week, -1); C.ui.moving = null; C.render(); },
    'week.next': () => { C.ui.week = C.shiftWeek(C.ui.week, 1); C.ui.moving = null; C.render(); },
    'week.today': () => { C.ui.week = C.weekId(); C.ui.moving = null; C.render(); },
    go: (el) => C.go(el.dataset.href),
    // Bascule rapide jour ⇄ nuit (sans tout redessiner : la cuisine 3D change d'éclairage en douceur)
    'theme.toggle': () => {
      const html = document.documentElement;
      Object.assign(C.S.settings, { theme: html.classList.contains('nuit') ? 'jour' : 'nuit' });
      C.db.put('kv', C.S.settings);
      html.classList.add('theme-fade');
      C.applyTheme();
      clearTimeout(C.ui.themeT);
      C.ui.themeT = setTimeout(() => html.classList.remove('theme-fade'), 450);
      if (C.route().view === 'reglages') C.render();
    },
  });

  window.addEventListener('hashchange', () => {
    C.closeAllSheets();
    C.ui.moving = null;
    C.render();
  });

  // Promotions : chargées au démarrage, puis à chaque retour sur l'app si la dernière lecture date de plus d'une heure.
  let lastSync = 0;
  const syncPromos = () => {
    if (Date.now() - lastSync < 36e5) return;
    lastSync = Date.now();
    C.sources.sync().then((r) => {
      if (r && r.added) C.toast(`Promotions de la semaine à jour (${r.added})`);
    });
  };
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && syncPromos());

  // Hors ligne et installation sur l'écran d'accueil (HTTPS ou localhost uniquement).
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    setTimeout(() => navigator.serviceWorker.register('sw.js').catch(() => {}), 1500); // après l'affichage
  }

  C.ui.full = true; // on arrive sur la pièce en plein écran
  C.load()
    .then(() => {
      C.eng.refreshEstimates();
      C.render();
      syncPromos();
      // Premier lancement sur cet appareil : questionnaire de réglages
      if (!C.S.settings.onboarded && !C.noStorage) C.onboard();
    })
    .catch((e) => {
      console.error(e);
      document.getElementById('view').innerHTML = `<div class="empty"><h2 class="h2">Impossible de démarrer</h2><p>${C.esc(e.message || e)}</p></div>`;
    });
})();
