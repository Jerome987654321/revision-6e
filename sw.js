// Garde l'application disponible hors ligne. Les appels à Gemini ne sont jamais mis en cache.
const CACHE = 'revision6e-v23';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  // cache: 'reload' : ne pas reprendre une ancienne copie gardée par le navigateur
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// « Partager → Révisions 6e » (Android) : les images arrivent ici en POST ; on les dépose dans le
// stockage de l'app (IndexedDB, clé « shared »), puis on ouvre la page Nouvelle leçon qui les reprend.
function openDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('revision6e', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('lessons', { keyPath: 'id' }); r.result.createObjectStore('kv', { keyPath: 'k' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function keepShared(files) {
  const db = await openDb();
  await new Promise((res, rej) => {
    const t = db.transaction('kv', 'readwrite'), store = t.objectStore('kv'), get = store.get('shared');
    get.onsuccess = () => store.put({ k: 'shared', v: [...(get.result?.v || []), ...files.map(f => new Blob([f], { type: f.type }))] });
    t.oncomplete = res; t.onerror = () => rej(t.error);
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method === 'POST' && new URL(req.url).pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      const files = (await req.formData()).getAll('images').filter(f => f && f.size);
      if (files.length) await keepShared(files);
      return Response.redirect(new URL('./#/new', self.registration.scope).href, 303);
    })());
    return;
  }
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (new URL(req.url).searchParams.has('check')) return;   // vérification de mise à jour : toujours le réseau
  if (new URL(req.url).pathname.startsWith('/api/')) return;   // compte en ligne : toujours le réseau
  e.respondWith(caches.open(CACHE).then(async cache => {
    // La page elle-même : toujours la dernière version en ligne, le cache seulement hors connexion.
    if (req.mode === 'navigate') {
      try {
        const res = await fetch(req, { cache: 'no-cache' });
        if (res.ok) cache.put('./', res.clone());
        return res;
      } catch {
        return (await cache.match('./')) || (await cache.match('./index.html'));
      }
    }
    const cached = await cache.match(req, { ignoreSearch: true });
    const fresh = fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
    return cached || fresh;
  }));
});
