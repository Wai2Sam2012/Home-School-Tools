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
// container is navigator.serviceWorker (replaced in tests).

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
} = {}) {
  const listeners = new Set();
  let state = { status: 'checking', done: 0, total: 0, failedCount: 0, failed: [], version: '' };
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

  /** A waiting version takes over and the page reloads (only when canApplyUpdate() allows it). */
  function applyUpdate() {
    const waiting = registration?.waiting;
    if (!waiting || takingOver) return false;
    takingOver = true;
    waiting.postMessage({ type: 'take-over' });
    return true;
  }

  function follow(worker) {
    if (!worker) return;
    const isUpdate = Boolean(registration.active);
    set({ status: isUpdate ? 'update-saving' : 'saving', done: 0, failedCount: 0, failed: [] });
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed') {
        if (registration.active) {
          set({ status: 'update-ready' });
          if (canApplyUpdate()) applyUpdate();
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
      if (takingOver) reload();
    });
    try {
      // updateViaCache 'none': always ask the server for a new sw.js (GitHub Pages lets browsers keep files for 10 minutes).
      registration = await container.register('sw.js', { scope: './', updateViaCache: 'none' });
    } catch (error) {
      set({ status: 'unsupported', error: error.message });
      return state;
    }
    lastCheck = now();
    registration.addEventListener('updatefound', () => follow(registration.installing));
    if (registration.installing) follow(registration.installing);
    if (registration.waiting && registration.active) {
      set({ status: 'update-ready' });
      // The game was just opened: the waiting version takes over before anyone starts playing.
      if (canApplyUpdate()) applyUpdate();
      return state;
    }
    if (registration.active) await checkActive();
    return state;
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
