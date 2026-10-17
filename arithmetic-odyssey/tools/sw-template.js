// Arithmetic Odyssey's service worker: saves the game on the device so it
// plays with no internet (GAME-PLAN.md 1.12, Stage 7).
//
// sw.js is built from this file by tools/build-offline.mjs, which fills in the
// version and the list of every file the game needs. Don't edit sw.js; edit
// this file and build again.
//
// How it works:
//   - Two lists: FILES are saved with the game (everything it needs to play,
//     with each theme's first sticker); PICTURES are the other stickers'
//     pictures, saved only when the game asks (a sticker a player collected,
//     or a player's next stop) into their own saved copy, which is kept from
//     one version to the next.
//   - Install: downloads every file in FILES into a new saved copy (a
//     cache named for this version), checking each one's size and fingerprint.
//     Files that haven't changed are copied from the previous version instead
//     of downloaded again. If any file can't be saved, the install fails and
//     the browser tries again on the next visit; the files saved so far are
//     kept, so the next try picks up where this one stopped.
//   - A new version waits: the game keeps using the old saved copy until it
//     is next opened, so an adventure is never interrupted (js/offline.js asks
//     it to take over when the game starts).
//   - Activate: deletes older saved copies of this game (only this game's:
//     other tools on the same github.io address are left alone).
//   - Fetch: answers the game's requests from the saved copies, and falls
//     back to the internet for anything not in them. A sticker picture that
//     comes from the internet is saved too, once checked.

const VERSION = '/* VERSION */';
// [address relative to this file, size in bytes, fingerprint]
const FILES = [/* FILES */];
const PICTURES = [/* PICTURES */];

const PREFIX = 'arithmetic-odyssey-';
const CACHE = PREFIX + VERSION;
const PICTURE_CACHE = `${PREFIX}sticker-pictures`; // kept across versions
const PICTURE_INFO = new Map(PICTURES.map(([url, size, hash]) => [url, { size, hash }]));
const LIST_KEY = 'offline-file-list.json'; // saved last: its presence means the copy is complete
const PARALLEL = 4;
const TRIES = 3;

const scopeUrl = (path) => new URL(path, self.registration.scope).href;

/** Tells every open page of the game how saving is going. */
async function tell(message) {
  const pages = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const page of pages) page.postMessage({ source: 'arithmetic-odyssey-sw', version: VERSION, ...message });
}

async function fingerprintOf(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

/** The file list saved with an earlier, complete copy: { url: hash }. */
async function savedList(cache) {
  const response = await cache.match(scopeUrl(LIST_KEY));
  if (!response) return null;
  try {
    return Object.fromEntries((await response.json()).map(([url, , hash]) => [url, hash]));
  } catch {
    return null;
  }
}

/** The response for a file, checked against its size and fingerprint. */
async function download(url, size, hash) {
  let problem = '';
  for (let attempt = 1; attempt <= TRIES; attempt++) {
    try {
      // The first try may use the browser's copy if it is still fresh; later tries go to the server.
      const response = await fetch(scopeUrl(url), { cache: attempt === 1 ? 'no-cache' : 'reload' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.arrayBuffer();
      if (body.byteLength !== size) throw new Error(`${body.byteLength} bytes, expected ${size}`);
      if ((await fingerprintOf(body)) !== hash) throw new Error('the file is not the expected one');
      const headers = { 'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream', 'X-AO-Hash': hash, 'X-AO-Size': String(size) };
      return new Response(body, { status: 200, headers });
    } catch (error) {
      problem = error.message;
    }
  }
  throw new Error(`${decodeURIComponent(url)}: ${problem}`);
}

async function saveEverything() {
  const cache = await caches.open(CACHE);
  // Earlier complete copies of the game, newest first, to copy unchanged files from.
  const older = [];
  for (const name of (await caches.keys()).filter((n) => n.startsWith(PREFIX) && n !== CACHE && n !== PICTURE_CACHE).reverse()) {
    const oldCache = await caches.open(name);
    const list = await savedList(oldCache);
    if (list) older.push({ cache: oldCache, list });
  }

  let done = 0;
  const failed = [];
  const total = FILES.length;
  const queue = FILES.slice();
  let lastTold = 0;
  const progress = () => {
    const now = Date.now();
    if (now - lastTold > 250 || done === total) {
      lastTold = now;
      tell({ type: 'progress', done, total });
    }
  };

  async function saveOne([url, size, hash]) {
    const key = scopeUrl(url);
    // Already saved by an earlier try of this same version.
    const here = await cache.match(key);
    if (here && here.headers.get('X-AO-Hash') === hash) return;
    for (const { cache: oldCache, list } of older) {
      if (list[url] === hash) {
        const copy = await oldCache.match(key);
        if (copy) {
          await cache.put(key, copy);
          return;
        }
      }
    }
    await cache.put(key, await download(url, size, hash));
  }

  async function worker() {
    while (queue.length) {
      const file = queue.shift();
      try {
        await saveOne(file);
      } catch (error) {
        failed.push(error.message);
      }
      done += 1;
      progress();
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker));

  if (failed.length) {
    await tell({ type: 'failed', failed: failed.slice(0, 5), count: failed.length, total });
    throw new Error(`${failed.length} file(s) could not be saved for offline play.`);
  }
  await cache.put(scopeUrl(LIST_KEY), new Response(JSON.stringify(FILES), { headers: { 'Content-Type': 'application/json' } }));
  await tell({ type: 'saved', total });
}

self.addEventListener('install', (event) => {
  event.waitUntil(saveEverything());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(PREFIX) && name !== CACHE && name !== PICTURE_CACHE) await caches.delete(name);
    }
    // Sticker pictures that are no longer in the game, or were changed, go too.
    const pictures = await caches.open(PICTURE_CACHE);
    for (const request of await pictures.keys()) {
      const url = request.url.slice(self.registration.scope.length);
      const saved = await pictures.match(request);
      if (PICTURE_INFO.get(url)?.hash !== saved?.headers.get('X-AO-Hash')) await pictures.delete(request);
    }
    await self.clients.claim();
    await tell({ type: 'ready' });
  })());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'take-over') {
    self.skipWaiting();
  } else if (data.type === 'save-pictures') {
    // The game asks for sticker pictures it needs (collected stickers and next stops).
    event.waitUntil(savePictures(Array.isArray(data.urls) ? data.urls : []).catch(() => {}));
  } else if (data.type === 'save-again') {
    // The saved copy is incomplete (the iPad may clear files to free space): save it again.
    event.waitUntil(saveEverything().catch(() => {}));
  } else if (data.type === 'status' && event.ports[0]) {
    caches.open(CACHE)
      .then(savedList)
      .then((list) => event.ports[0].postMessage({ version: VERSION, complete: Boolean(list), files: FILES.length, bytes: FILES.reduce((n, f) => n + f[1], 0) }))
      .catch(() => event.ports[0].postMessage({ version: VERSION, complete: false }));
  }
});

/** Saves the sticker pictures asked for (ones not saved yet), and says how it went. */
let picturesBusy = Promise.resolve();
function savePictures(urls) {
  // One request at a time, so the same picture is never downloaded twice at once.
  picturesBusy = picturesBusy.then(async () => {
    const cache = await caches.open(PICTURE_CACHE);
    const wanted = [...new Set(urls)].filter((url) => PICTURE_INFO.has(url));
    let saved = 0;
    const failed = [];
    const queue = wanted.slice();
    async function worker() {
      while (queue.length) {
        const url = queue.shift();
        const { size, hash } = PICTURE_INFO.get(url);
        const here = await cache.match(scopeUrl(url));
        if (here && here.headers.get('X-AO-Hash') === hash) continue;
        try {
          await cache.put(scopeUrl(url), await download(url, size, hash));
          saved += 1;
        } catch (error) {
          failed.push(url);
        }
      }
    }
    await Promise.all(Array.from({ length: PARALLEL }, worker));
    await tell({ type: 'pictures', wanted: wanted.length, saved, failed: failed.length });
  });
  return picturesBusy;
}

/** The saved answer for a request: this version's copy, or a saved sticker picture. */
async function fromSaved(request) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(request);
  if (saved) return saved;
  return (await caches.open(PICTURE_CACHE)).match(request);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!url.href.startsWith(self.registration.scope)) return;

  if (request.mode === 'navigate') {
    // The game's page (with or without index.html or ?debug=1): the saved page first.
    const path = url.href.slice(self.registration.scope.length).split(/[?#]/)[0];
    if (path === '' || path === 'index.html') {
      event.respondWith((async () => {
        const saved = await fromSaved(scopeUrl('index.html'));
        if (saved) return saved;
        try {
          return await fetch(request);
        } catch {
          return (await fromSaved(scopeUrl('offline.html'))) || Response.error();
        }
      })());
      return;
    }
    event.respondWith(fetch(request).catch(async () => (await fromSaved(scopeUrl('offline.html'))) || Response.error()));
    return;
  }

  event.respondWith((async () => {
    const saved = await fromSaved(request);
    if (saved) return saved;
    try {
      const response = await fetch(request);
      // A sticker picture shown from the internet is saved too (once checked).
      const info = PICTURE_INFO.get(url.href.slice(self.registration.scope.length));
      if (info && response.ok) event.waitUntil(savePictures([url.href.slice(self.registration.scope.length)]).catch(() => {}));
      return response;
    } catch {
      return new Response('', { status: 503, statusText: 'Offline and not saved' });
    }
  })());
});
