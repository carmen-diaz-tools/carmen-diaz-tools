// Service worker: permite abrir la app sin conexión.
// Estrategia "red primero": con internet siempre se carga la última versión;
// sin internet se usa la copia guardada.
// Si añades archivos nuevos, inclúyelos en ASSETS y sube VERSION.

const VERSION = 'v2';
const CACHE = `cd-tools-${VERSION}`;

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'app/css/base.css',
  'app/js/main.js',
  'app/js/config.js',
  'app/js/pin.js',
  'app/js/storage.js',
  'app/js/tools.js',
  'tools/etiquetas/etiquetas.js',
  'tools/etiquetas/etiquetas.css',
  'tools/etiquetas/sku.js',
  'tools/etiquetas/code128.js',
  'tools/etiquetas/label-render.js',
  'tools/etiquetas/logo.js',
  'data/tipos.json',
  'data/marcas.json',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true })),
  );
});
