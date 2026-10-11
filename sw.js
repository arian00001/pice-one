/* ==========================================================================
   ONE PIECE | Luffy — the offline worker.

   A service worker watching over this exact folder. It keeps the shell —
   this page, the stylesheet, the scroll choreography — in a cache of its own,
   and everything else the visitor actually watches (the footage, the frame
   sequences, the guide) is put away the first time it is asked for.

   Two rules it never breaks:

     1. Online, the network still wins for the page itself, so a new release is
        never hidden behind a stale copy.
     2. Offline, the last good copy answers — byte ranges included, so the
        footage can still be scrubbed while the line is down.

   Bump VERSION on a release: every older cache is swept on activation.
   ========================================================================== */

const VERSION = 'one-piece-v1';
const SHELL = `${VERSION}-shell`;
const LIBRARY = `${VERSION}-library`;
const LIVE = [SHELL, LIBRARY];

/* Asked for by name while installing, so the very first offline visit still has
   a page, its look and its motion. */
const SHELL_FILES = ['./', 'css/style.css', 'js/main.js', 'offline.js'];

/* How many runtime responses stay warm. Past that the oldest go first. */
const LIBRARY_LIMIT = 300;

/* One quiet refresh per address per worker life, so the cache stays current
   without asking the network twice for the same file. */
const refreshed = new Set();

/* ------------------------------------------------------------------ install */

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      // One missing file must never sink the whole install.
      await Promise.allSettled(
        SHELL_FILES.map((file) => cache.add(new Request(file, { cache: 'reload' })))
      );
      await self.skipWaiting();
    })()
  );
});

/* ----------------------------------------------------------------- activate */

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const open = await caches.keys();
      await Promise.all(open.filter((name) => !LIVE.includes(name)).map((name) => caches.delete(name)));
      await self.clients.claim();
      const windows = await self.clients.matchAll({ type: 'window' });
      windows.forEach((client) => client.postMessage({ type: 'OFFLINE_READY', version: VERSION }));
    })()
  );
});

/* ------------------------------------------------------------------ message */

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  if (data.type === 'CACHE_VERSION' && event.source) {
    event.source.postMessage({ type: 'CACHE_VERSION', version: VERSION });
  }
});

/* -------------------------------------------------------------------- fetch */

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (request.url.startsWith('chrome-extension://')) return;

  // The worker's own script is the browser's business, never the cache's.
  if (new URL(request.url).pathname.endsWith('/sw.js')) return;

  event.respondWith(request.mode === 'navigate' ? serveDocument(request) : serveAsset(request));
});

/* A page: fresh while online, the last good copy while not. The copy is kept
   under the address it was asked for, so /index.htm and /index.html both look
   after themselves. */
async function serveDocument(request) {
  const cache = await caches.open(SHELL);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.status === 200) await cache.put(request, fresh.clone());
    return fresh;
  } catch (error) {
    return (
      (await cache.match(request)) ||
      (await cache.match(request, { ignoreSearch: true })) ||
      (await cache.match('./')) ||
      Response.error()
    );
  }
}

/* Everything else — stylesheet, choreography, footage, frames, fonts from the
   CDN: from the cache the moment it is warm, and quietly refreshed after. */
async function serveAsset(request) {
  const cache = await caches.open(LIBRARY);
  const cached = await cache.match(request.url);

  if (cached) {
    if (request.headers.has('range')) return slice(cached, request);
    refresh(cache, request.url);
    return cached;
  }

  try {
    const fresh = await fetch(request);
    return await store(cache, request.url, fresh);
  } catch (error) {
    const shell = await caches.open(SHELL);
    return (await shell.match(request.url)) || Response.error();
  }
}

/* The cache is only worth keeping if it refreshes: a copy that is served is a
   copy that is also quietly re-asked for, once per worker life. */
function refresh(cache, url) {
  if (refreshed.has(url)) return;
  refreshed.add(url);
  fetch(url, { cache: 'no-cache' })
    .then((fresh) => store(cache, url, fresh))
    .catch(() => refreshed.delete(url));
}

/* A full copy is worth keeping; a partial one never is. */
async function store(cache, url, response) {
  if (!response) return response;
  const keepable = response.status === 200 || response.type === 'opaque';
  if (keepable && response.type !== 'error') {
    try {
      await cache.put(url, response.clone());
      await trim(cache);
    } catch (error) {
      // a response we are not allowed to store is simply not stored
    }
  }
  return response;
}

/* Oldest first, so a long scroll through the voyage cannot grow the cache
   without limit. */
async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length <= LIBRARY_LIMIT) return;
  await Promise.all(keys.slice(0, keys.length - LIBRARY_LIMIT).map((key) => cache.delete(key)));
}

/* A range asked of a fully cached file: answered from the copy we already have,
   so seeking through the footage works with the line cut. */
async function slice(cached, request) {
  const match = /bytes=(\d*)-(\d*)/.exec(request.headers.get('range') || '');
  if (!match) return cached;

  const body = await cached.clone().arrayBuffer();
  const total = body.byteLength;
  const start = match[1] ? Number(match[1]) : 0;
  const last = match[2] ? Number(match[2]) : total - 1;
  if (start >= total) return cached;

  const end = Math.min(last, total - 1);
  const part = body.slice(start, end + 1);

  return new Response(part, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': cached.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Content-Length': String(part.byteLength),
      'Accept-Ranges': 'bytes',
    },
  });
}