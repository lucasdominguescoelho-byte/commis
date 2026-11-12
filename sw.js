/* Cabas — service worker : l'application s'ouvre même sans réseau (au magasin, en sous-sol…).
   - Fichiers de l'app (HTML, CSS, JS) : réseau d'abord, copie locale si hors ligne.
   - Promotions (data/promotions.json) : réseau d'abord, dernière version connue sinon.
   - Images et icônes de l'app : copie locale d'abord.
   Les photos des produits (sites des magasins) ne passent pas par ici. */
const CACHE = 'cabas-v1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/core.js', 'js/seed.js', 'js/engine.js', 'js/sources.js', 'js/ui.js', 'js/app.js',
  'js/views/accueil.js', 'js/views/promotions.js', 'js/views/recettes.js', 'js/views/planning.js',
  'js/views/courses.js', 'js/views/budget.js', 'js/views/reglages.js',
  'assets/icons/icon-192.png', 'assets/icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const sansVersion = (req) => {
  const u = new URL(req.url);
  u.search = ''; // « app.css?v=5 » et « app.css » partagent la même copie
  return u.href;
};

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const key = sansVersion(req);
  const image = /\/assets\/(img|icons)\//.test(req.url);

  if (image) {
    e.respondWith(
      caches.match(key).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(key, res.clone()));
        return res;
      }))
    );
    return;
  }
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(key, res.clone()));
        return res;
      })
      .catch(() => caches.match(key).then((hit) => hit || (req.mode === 'navigate' ? caches.match(new URL('index.html', location).href) : Response.error())))
  );
});
