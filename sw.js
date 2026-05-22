/* ============================================================
   Service Worker — Pokémon card game
   ------------------------------------------------------------
   Strategie:
     - "Network first" per HTML (così aggiornamenti del codice arrivano
       subito quando online; fallback cache se offline).
     - "Stale-while-revalidate" per CSS/JS/asset locali (rapido +
       aggiornamento in background al prossimo caricamento).
     - "Cache first" per asset/icons (raramente cambiano).
     - "Network first" per PokeAPI / Supabase / online server (dati live).

   Versioning: bumpa CACHE_VERSION quando vuoi forzare un refresh
   completo della cache (es. dopo cambi major).
   ============================================================ */
const CACHE_VERSION = 'v63';
const STATIC_CACHE  = `shc-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `shc-runtime-${CACHE_VERSION}`;

/* File da pre-cachare al primo install — il "core shell" dell'app +
   tracce audio principali (così il primo cambio pagina non aspetta la rete). */
const PRECACHE_URLS = [
  './',
  './index.html',
  './play.html',
  './manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/audio/menu.mp3',
  './assets/audio/oak-battle.mp3',
  './assets/audio/gym-battle.mp3',
  './assets/audio/trainer-battle.mp3',
  './assets/audio/champion-battle.mp3',
  './assets/audio/victory.mp3',
];

/* Audio files: cache-first (raramente cambiano, pesanti da scaricare) */
const AUDIO_RE = /\/assets\/audio\/[^/]+\.(mp3|ogg|wav|m4a)$/i;

/* Domini di runtime (dati live, NON da cachare aggressivamente) */
const LIVE_HOSTS = [
  'pokeapi.co',
  'raw.githubusercontent.com', // sprite PokeAPI
  'supabase.co',
  'esm.sh',
  'cdn.jsdelivr.net',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  // Pulisce vecchie cache di versioni precedenti
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(k => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
        .map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  // Solo GET; le richieste POST/PUT/DELETE passano sempre alla rete
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Salta cross-origin "live" (PokeAPI, Supabase, ecc.) — passa diretto alla rete
  if (LIVE_HOSTS.some(h => url.hostname.endsWith(h))) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // Solo same-origin per le strategie cache
  if (url.origin !== self.location.origin) return;

  // HTML → network first (sempre il più aggiornato quando online)
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(networkFirst(req));
    return;
  }

  // manifest.json → network first (così cambi di nome/icone PWA arrivano subito)
  if (url.pathname.endsWith('/manifest.json') || url.pathname === '/manifest.json') {
    event.respondWith(networkFirst(req));
    return;
  }

  // Audio → cache first (file grossi, raramente cambiano)
  if (AUDIO_RE.test(url.pathname)) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Icons / artwork PNG → cache first (cambiano di rado)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // CSS / JS / altro same-origin → stale-while-revalidate
  event.respondWith(staleWhileRevalidate(req));
});

async function networkFirst(req) {
  try {
    const fresh = await fetch(req);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    // Ultima spiaggia: la home offline
    return caches.match('./index.html');
  }
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    // Cache solo risposte complete (status 200). Le risposte parziali (206)
    // sono il risultato di range requests (es. audio seek) → non cachabili.
    if (fresh.ok && fresh.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(req, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (e) {
    return cached ?? Response.error();
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(req);
  const networkFetch = fetch(req).then(fresh => {
    cache.put(req, fresh.clone());
    return fresh;
  }).catch(() => null);
  return cached ?? networkFetch ?? Response.error();
}

/* Permette al client di forzare l'aggiornamento (es. dopo un push) */
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
