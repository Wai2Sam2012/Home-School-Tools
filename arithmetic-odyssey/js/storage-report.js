// How much the game keeps on the device and how much memory the page uses,
// for the debug panel (?debug=1). Nothing here changes any data.
//
// What can be measured differs by browser:
//   - Saved game data (localStorage): measured exactly everywhere.
//   - The offline copy (sw.js's saved files): read from its file list.
//   - The browser's own estimate of storage used and allowed: Chrome, Edge,
//     Firefox and newer Safari (navigator.storage.estimate()).
//   - Memory (JavaScript heap): only Chrome and Edge report it. Safari on the
//     iPad doesn't, so the panel shows page elements and loaded sounds instead.

import { PREFIX, formatBytes } from './storage.js?v=0.7.6';

const OFFLINE_PREFIX = 'arithmetic-odyssey-';
const OFFLINE_LIST = 'offline-file-list.json';
const PICTURE_CACHE = 'arithmetic-odyssey-sticker-pictures';
// Safari and Chrome let each address keep about 5 MB in localStorage.
export const LOCAL_STORAGE_LIMIT = 5 * 1024 * 1024;

/**
 * Saved game data by player: { gameBytes, gameKeys, players: [{ id, name, bytes }],
 * sharedBytes (the player list, undo copy, set-aside data), otherBytes, otherKeys }.
 * localStorage keeps text as 2 bytes a character. Every tool on the same
 * github.io address shares it, so other tools' data counts toward the limit too.
 */
export function savedDataReport(storage, players = []) {
  const report = { gameBytes: 0, gameKeys: 0, sharedBytes: 0, otherBytes: 0, otherKeys: 0, players: players.map((p) => ({ id: p.id, name: p.name, bytes: 0 })) };
  const byId = new Map(report.players.map((p) => [p.id, p]));
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key === null) continue;
    const bytes = (key.length + (storage.getItem(key)?.length ?? 0)) * 2;
    if (!key.startsWith(PREFIX)) {
      report.otherBytes += bytes;
      report.otherKeys += 1;
      continue;
    }
    report.gameBytes += bytes;
    report.gameKeys += 1;
    const match = key.slice(PREFIX.length).match(/^(?:profile|history|active)\.(.+?)(?:\.tmp)?$/);
    const player = match ? byId.get(match[1]) : null;
    if (player) player.bytes += bytes;
    else report.sharedBytes += bytes;
  }
  return report;
}

/**
 * The offline copy: { copies, complete, files, bytes } from each saved copy's
 * file list, and { pictures, pictureBytes } for the sticker pictures saved as
 * they were collected (from the size saved with each). No file is read.
 */
export async function offlineCopyReport(cacheStorage = globalThis.caches) {
  if (!cacheStorage) return null;
  const all = await cacheStorage.keys();
  let pictures = 0;
  let pictureBytes = 0;
  if (all.includes(PICTURE_CACHE)) {
    const cache = await cacheStorage.open(PICTURE_CACHE);
    for (const request of await cache.keys()) {
      pictures += 1;
      pictureBytes += Number((await cache.match(request))?.headers.get('X-AO-Size')) || 0;
    }
  }
  const names = all.filter((n) => n.startsWith(OFFLINE_PREFIX) && n !== PICTURE_CACHE);
  let files = 0;
  let bytes = 0;
  let complete = 0;
  for (const name of names) {
    const cache = await cacheStorage.open(name);
    const entries = (await cache.keys()).length;
    const list = await cache.match(new URL(OFFLINE_LIST, globalThis.location?.href ?? 'http://localhost/').href);
    if (list) {
      complete += 1;
      const saved = await list.json();
      bytes += saved.reduce((n, f) => n + f[1], 0);
      files += saved.length;
    } else {
      files += entries; // a copy still being saved: count what is there so far
    }
  }
  return { copies: names.length, complete, files, bytes, pictures, pictureBytes };
}

/** The browser's own numbers: { usage, quota, persisted } (null where not reported). */
export async function browserStorageReport(nav = globalThis.navigator) {
  const estimate = await nav?.storage?.estimate?.().catch(() => null) ?? null;
  const persisted = await nav?.storage?.persisted?.().catch(() => null) ?? null;
  return { usage: estimate?.usage ?? null, quota: estimate?.quota ?? null, persisted };
}

/** Memory: the JavaScript heap where the browser reports it, and what the page holds. */
export function memoryReport({ perf = globalThis.performance, doc = globalThis.document, sounds = 0 } = {}) {
  const heap = perf?.memory ? { used: perf.memory.usedJSHeapSize, total: perf.memory.totalJSHeapSize, limit: perf.memory.jsHeapSizeLimit } : null;
  return {
    heap,
    elements: doc ? doc.getElementsByTagName('*').length : 0,
    images: doc ? doc.images.length : 0,
    sounds,
  };
}

/** Everything at once, as lines for the debug panel. */
export async function measureAll({ storage, players, sounds = 0 } = {}) {
  const lines = {};
  try {
    const saved = savedDataReport(storage, players);
    lines['Saved game data'] = `${formatBytes(saved.gameBytes)} in ${saved.gameKeys} items (about ${Math.max(1, Math.round((saved.gameBytes / LOCAL_STORAGE_LIMIT) * 100))}% of the ~5 MB limit)`;
    lines['Saved data by player'] = saved.players.length
      ? `${saved.players.map((p) => `${p.name} ${formatBytes(p.bytes)}`).join(', ')}; player list and backups ${formatBytes(saved.sharedBytes)}`
      : 'no players';
    lines["Other tools' saved data here"] = saved.otherKeys ? `${formatBytes(saved.otherBytes)} in ${saved.otherKeys} items` : 'none';
  } catch (error) {
    lines['Saved game data'] = `unavailable (${error.message})`;
  }
  try {
    const offline = await offlineCopyReport();
    lines['Offline copy'] = !offline
      ? 'not supported here'
      : offline.copies === 0
        ? 'not saved yet'
        : `${offline.files} files, ${formatBytes(offline.bytes)}${offline.complete < offline.copies ? ` (${offline.copies - offline.complete} copy still saving)` : ''}${offline.complete > 1 ? `, ${offline.complete} versions kept` : ''}`;
    lines['Sticker pictures saved'] = offline ? `${offline.pictures} pictures, ${formatBytes(offline.pictureBytes)} (collected stickers and next stops)` : 'not supported here';
  } catch (error) {
    lines['Offline copy'] = `unavailable (${error.message})`;
  }
  const browser = await browserStorageReport();
  lines['Browser storage used'] = browser.usage === null
    ? 'not reported by this browser'
    : `${formatBytes(browser.usage)}${browser.quota ? ` of ${formatBytes(browser.quota)} allowed (${((browser.usage / browser.quota) * 100).toFixed(1)}%)` : ''}`;
  lines['Kept when the iPad is short of space'] = browser.persisted === null ? 'not reported' : browser.persisted ? 'yes' : 'no (the browser may clear it)';
  const memory = memoryReport({ sounds });
  lines['Memory (JavaScript)'] = memory.heap
    ? `${formatBytes(memory.heap.used)} used of ${formatBytes(memory.heap.limit)}`
    : 'not reported by this browser (Safari never does)';
  lines['Page right now'] = `${memory.elements} elements, ${memory.images} pictures, ${memory.sounds} recorded sounds loaded`;
  lines['Measured at'] = new Date().toLocaleTimeString();
  return lines;
}
