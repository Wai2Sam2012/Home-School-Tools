// The offline app, page side (GAME-PLAN.md 1.12, Stage 7): registers the
// service worker (sw.js, built by tools/build-offline.mjs), follows it while
// it saves the game, and says how it is going:
//   - 'saving'        saving the game for the first time (done / total files)
//   - 'ready'         every file is saved and checked: plays with no internet
//   - 'failed'        some files couldn't be saved; it tries again next visit
//   - 'update-saving' ready, and downloading a new version in the background
//   - 'update-ready'  a new version is saved; it applies the next time the
//                     game opens (never in the middle of an adventure)
//   - 'unsupported'   this browser or address can't save the game
//
// Sticker pictures: the game is saved with each theme's first sticker only.
// The pictures of every sticker a player has collected, and of each player's
// next stop, are saved when there is internet (picturesToSave(),
// savePictures()); until then the game shows a drawing that says it is
// waiting for the internet (js/art.js).
//
// container is navigator.serviceWorker (replaced in tests).

import { LEVELS, collectionKey } from './settings.js?v=0.7.5';
import { nextSticker, pictureUrl, stickerSet } from './storyline.js?v=0.7.5';

export const OFFLINE_TEXT = Object.freeze({
  checking: 'Checking offline play…',
  saving: 'Saving the game for offline play…',
  ready: '✓ Ready to play offline',
  failed: "Some files couldn't be saved for offline play. It will try again next time the game opens with internet.",
  'update-saving': '✓ Ready to play offline (downloading an update…)',
  'update-ready': 'Update ready: it will apply next time you open the game.',
  unsupported: "Offline play isn't available here (it needs Safari or Chrome, at an https:// address).",
});

/** The status in words, with the progress when saving. */
export function offlineMessage(state) {
  const base = OFFLINE_TEXT[state.status] ?? '';
  if ((state.status === 'saving' || state.status === 'update-saving') && state.total > 0) {
    const percent = Math.min(100, Math.floor((state.done / state.total) * 100));
    return state.status === 'saving' ? `${base} ${percent}%` : `✓ Ready to play offline (downloading an update… ${percent}%)`;
  }
  return base;
}

const UPDATE_CHECK_MS = 30 * 60 * 1000;
const TAKE_OVER_WAIT_MS = 4000;
const RELOAD_KEY = 'ao.offline.reloaded';

/**
 * The sticker pictures the players need saved: for each theme and level,
 * every sticker a player has collected and each player's next stop.
 * storylines is { theme: storyline } (a missing theme is skipped). Returns addresses.
 */
export function picturesToSave(storylines, players) {
  const urls = new Set();
  for (const [theme, storyline] of Object.entries(storylines)) {
    if (!storyline) continue;
    for (const level of LEVELS) {
      const set = stickerSet(storyline, level);
      for (const player of players) {
        const owned = new Set(player.collected?.[collectionKey(theme, level)] ?? []);
        const next = nextSticker(set, [...owned]);
        for (const sticker of set.stickers) {
          if (!owned.has(sticker.id) && sticker !== next) continue;
          for (const picture of sticker.pictures ?? []) urls.add(pictureUrl(theme, picture));
        }
      }
    }
  }
  return [...urls];
}

/** Tells pictures on screen to try again (after the internet comes back, or pictures were saved). */
export const PICTURES_SAVED_EVENT = 'ao-pictures-saved';

/**
 * Starts offline play. canApplyUpdate() says whether a waiting update may
 * take over now (only on the start screen, so an adventure is never
 * interrupted); reload() reloads the page once it has.
 */
export function createOffline({
  container = globalThis.navigator?.serviceWorker,
  secure = globalThis.isSecureContext,
  canApplyUpdate = () => false,
  reload = () => globalThis.location.reload(),
  now = () => Date.now(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  session = (() => { try { return globalThis.sessionStorage; } catch { return null; } })(),
} = {}) {
  // The fallback reload happens at most once a minute, so a stuck update can never keep reloading the game.
  const reloadedRecently = () => {
    try {
      return now() - Number(session?.getItem(RELOAD_KEY) || 0) < 60000;
    } catch {
      return false;
    }
  };
  const markReload = () => {
    try {
      session?.setItem(RELOAD_KEY, String(now()));
    } catch {
      // No session storage: the once-a-minute guard just isn't kept.
    }
  };
  const listeners = new Set();
  let state = { status: 'checking', done: 0, total: 0, failedCount: 0, failed: [], version: '', pictures: null };
  let registration = null;
  let takingOver = false;
  let lastCheck = 0;

  function set(changes) {
    state = { ...state, ...changes };
    for (const fn of listeners) fn(state);
  }

  /** Asks the active service worker whether its saved copy is complete. */
  function askStatus(worker) {
    return new Promise((resolve) => {
      if (!worker || typeof MessageChannel === 'undefined') {
        resolve(null);
        return;
      }
      const channel = new MessageChannel();
      // An answer, or none within 5 seconds; either way the channel is closed.
      const finish = (answer) => {
        clearTimeout(timer);
        channel.port1.close();
        resolve(answer);
      };
      const timer = setTimeout(() => finish(null), 5000);
      channel.port1.onmessage = (event) => finish(event.data);
      worker.postMessage({ type: 'status' }, [channel.port2]);
    });
  }

  let savingAgain = false;

  async function checkActive() {
    const reply = await askStatus(registration?.active);
    if (reply?.complete) {
      savingAgain = false;
      set({ status: registration.waiting ? 'update-ready' : registration.installing ? 'update-saving' : 'ready', version: reply.version, total: reply.files ?? state.total, bytes: reply.bytes });
    } else if (!registration?.installing && registration?.active && !savingAgain) {
      // Installed, but the saved copy is incomplete (the iPad may clear files to free space): save it again.
      savingAgain = true;
      set({ status: 'saving', done: 0, failedCount: 0, failed: [] });
      registration.active.postMessage({ type: 'save-again' });
    } else if (!registration?.installing) {
      set({ status: 'failed' });
    }
  }

  /**
   * A waiting version takes over and the page reloads. While it does, state
   * has applying: true, and the game starts nothing new (a download started
   * now can hold up the switch). If the switch hasn't happened within a few
   * seconds, the page reloads anyway, once (that stops anything in flight).
   */
  function applyUpdate() {
    const waiting = registration?.waiting;
    if (!waiting || takingOver) return false;
    takingOver = true;
    set({ applying: true });
    waiting.postMessage({ type: 'take-over' });
    setTimer(() => {
      if (reloadedRecently()) return;
      markReload();
      reload();
    }, TAKE_OVER_WAIT_MS);
    return true;
  }

  function follow(worker) {
    if (!worker) return;
    const isUpdate = Boolean(registration.active);
    set({ status: isUpdate ? 'update-saving' : 'saving', done: 0, failedCount: 0, failed: [] });
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed') {
        if (registration.active) {
          // Switch first (if allowed), so nothing new starts while it does.
          if (canApplyUpdate()) applyUpdate();
          set({ status: 'update-ready' });
        }
      } else if (worker.state === 'activated') {
        checkActive();
      } else if (worker.state === 'redundant' && !takingOver) {
        // The install failed (a file couldn't be saved). An update failing leaves the old version working.
        set({ status: registration.active ? 'ready' : 'failed' });
        if (registration.active) checkActive();
      }
    });
  }

  function onMessage(event) {
    const data = event.data || {};
    if (data.source !== 'arithmetic-odyssey-sw') return;
    if (data.type === 'progress') set({ done: data.done, total: data.total });
    else if (data.type === 'failed') set({ failedCount: data.count, failed: data.failed ?? [], ...(savingAgain ? { status: 'failed' } : {}) });
    else if (data.type === 'saved' && savingAgain) checkActive();
    else if (data.type === 'pictures') {
      set({ pictures: { wanted: data.wanted, saved: data.saved, failed: data.failed } });
      if (data.saved > 0) globalThis.dispatchEvent?.(new Event(PICTURES_SAVED_EVENT));
    }
  }

  /** Looks for a new version now and then, or now if force (only downloads; never switches mid-game). */
  function checkForUpdate({ force = false } = {}) {
    if (!registration || (!force && now() - lastCheck < UPDATE_CHECK_MS) || globalThis.navigator?.onLine === false) return false;
    lastCheck = now();
    registration.update().catch(() => {});
    return true;
  }

  async function start() {
    if (!container || !secure) {
      set({ status: 'unsupported' });
      return state;
    }
    container.addEventListener('message', onMessage);
    container.addEventListener('controllerchange', () => {
      if (takingOver) {
        markReload();
        reload();
      }
    });
    try {
      // updateViaCache 'none': always ask the server for a new sw.js (GitHub Pages lets browsers keep files for 10 minutes).
      registration = await container.register('sw.js', { scope: './', updateViaCache: 'none' });
    } catch (error) {
      set({ status: 'unsupported', error: error.message });
      return state;
    }
    if (!registration) {
      // Some browsers (or settings) block it without saying so.
      set({ status: 'unsupported' });
      return state;
    }
    lastCheck = now();
    registration.addEventListener('updatefound', () => follow(registration.installing));
    if (registration.installing) follow(registration.installing);
    if (registration.waiting && registration.active) {
      // The game was just opened: the waiting version takes over before anyone starts playing.
      if (canApplyUpdate()) applyUpdate();
      set({ status: 'update-ready' });
      return state;
    }
    if (registration.active) await checkActive();
    return state;
  }

  /**
   * Asks for sticker pictures to be saved (the ones not saved yet). Returns
   * false when it can't now (no internet, or offline play isn't working).
   */
  function savePictures(urls) {
    const worker = registration?.active;
    if (!worker || !urls.length || globalThis.navigator?.onLine === false) return false;
    worker.postMessage({ type: 'save-pictures', urls });
    return true;
  }

  /** Removes the offline app and its saved copy (debug panel, for testing). Saved players are not touched. */
  async function remove(cacheStorage = globalThis.caches) {
    let removed = 0;
    if (registration) {
      await registration.unregister();
      registration = null;
    }
    for (const name of (await cacheStorage?.keys()) ?? []) {
      if (name.startsWith('arithmetic-odyssey-')) {
        await cacheStorage.delete(name);
        removed += 1;
      }
    }
    set({ status: 'checking', done: 0, total: 0 });
    return removed;
  }

  return {
    start,
    remove,
    savePictures,
    applyUpdate,
    checkForUpdate,
    state: () => state,
    message: () => offlineMessage(state),
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
