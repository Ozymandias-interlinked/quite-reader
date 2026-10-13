// Quiet Reader service worker: keeps the app usable offline and turns on
// cross-origin isolation (needed for multi-threaded voices) on hosts like GitHub Pages.
const VERSION = 'qr-4f4b859bbb';
const SHELL = ["./", "LICENSES.txt", "app.js", "fonts/albert-sans-latin-400-normal.woff2", "fonts/albert-sans-latin-500-normal.woff2", "fonts/albert-sans-latin-600-normal.woff2", "fonts/literata-latin-400-italic.woff2", "fonts/literata-latin-400-normal.woff2", "fonts/literata-latin-600-italic.woff2", "fonts/literata-latin-600-normal.woff2", "icons/apple-touch-icon.png", "icons/favicon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "index.html", "manifest.webmanifest", "tts-worker.js", "vendor/jszip.min.js", "vendor/mammoth.browser.min.js", "vendor/ort-wasm-simd-threaded.jsep.mjs", "vendor/ort-wasm-simd-threaded.jsep.wasm", "vendor/pdf.min.js", "vendor/pdf.worker.min.js", "voices/af_bella.bin", "voices/af_heart.bin", "voices/af_nicole.bin", "voices/bf_emma.bin"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('qr-') && k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

function isolate(res) {
  if (!res || res.status === 0 || res.type === 'opaque') return res;
  const h = new Headers(res.headers);
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Cross-Origin-Embedder-Policy', 'require-corp');
  h.set('Cross-Origin-Resource-Policy', 'same-origin');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // voice downloads are cached by the voice engine itself
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    let res = await cache.match(req, { ignoreSearch: true });
    if (!res && req.mode === 'navigate') res = await cache.match('./index.html');
    if (!res) {
      try {
        res = await fetch(req);
      } catch (err) {
        if (req.mode === 'navigate') res = await cache.match('./index.html');
        if (!res) return new Response('Offline and not saved yet.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
    }
    return isolate(res);
  })());
});
