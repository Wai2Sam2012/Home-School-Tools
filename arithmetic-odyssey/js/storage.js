// Saving on this device (GAME-PLAN.md 1.10). Everything goes through here, so
// the game could later move from localStorage to IndexedDB without changing
// anything else.
//
//   Safe writes: the new value is written to a temporary key first, then to
//     the real key, then the temporary key is removed. When loading, whichever
//     copy is valid is used, so a crash in the middle never loses both.
//   Damaged data is moved to ao.v1.quarantine.<name> and reported; the game
//     carries on with safe defaults.
//   A full or unavailable storage is reported, never thrown, so the game
//     keeps working (it just can't save until there is room).

export const PREFIX = 'ao.v1.';
const TEMP = '.tmp';

export const KEYS = Object.freeze({
  index: `${PREFIX}index`,
  profile: (id) => `${PREFIX}profile.${id}`,
  history: (id) => `${PREFIX}history.${id}`,
  active: (id) => `${PREFIX}active.${id}`,
  quarantine: (key) => `${PREFIX}quarantine.${key.startsWith(PREFIX) ? key.slice(PREFIX.length) : key}`,
  undo: `${PREFIX}undo`,
});

/** localStorage, or null when the browser refuses it (some private modes do). */
export function deviceStorage() {
  try {
    const store = globalThis.localStorage;
    const probe = `${PREFIX}probe`;
    store.setItem(probe, '1');
    store.removeItem(probe);
    return store;
  } catch {
    return null;
  }
}

/** A Storage-like object kept in memory: used when the device storage can't be, and in tests. */
export function memoryStorage(limitChars = Infinity) {
  const items = new Map();
  const used = () => [...items].reduce((n, [k, v]) => n + k.length + v.length, 0);
  return {
    get length() { return items.size; },
    key: (i) => [...items.keys()][i] ?? null,
    getItem: (k) => (items.has(k) ? items.get(k) : null),
    setItem(k, v) {
      const value = String(v);
      if (used() - (items.has(k) ? k.length + items.get(k).length : 0) + k.length + value.length > limitChars) {
        const error = new Error('The quota has been exceeded.');
        error.name = 'QuotaExceededError';
        throw error;
      }
      items.set(k, value);
    },
    removeItem: (k) => { items.delete(k); },
    clear: () => items.clear(),
  };
}

function isQuotaError(error) {
  return error?.name === 'QuotaExceededError' || error?.name === 'NS_ERROR_DOM_QUOTA_REACHED' || error?.code === 22 || error?.code === 1014;
}

/**
 * Wraps a Storage-like backend. onProblem({ type, key, message }) is called
 * for 'damaged' (moved to quarantine), 'full' and 'unavailable'.
 * With no backend, data is kept in memory for this visit only.
 */
export function createStorage(backend, { onProblem = () => {} } = {}) {
  const saving = Boolean(backend);
  const store = backend ?? memoryStorage();
  if (!saving) onProblem({ type: 'unavailable', key: '', message: "This browser won't let the game save, so progress lasts only until the page closes." });

  function parse(raw, check) {
    if (raw === null) return { ok: false, missing: true };
    try {
      return { ok: true, value: check(JSON.parse(raw)) };
    } catch (error) {
      return { ok: false, missing: false, error };
    }
  }

  const api = {
    /** True when data really is kept on the device. */
    saving,
    backend: store,

    /**
     * Reads a saved value. check(data) returns the cleaned-up value or throws
     * if it is damaged. Returns null when there is nothing (usable) saved.
     */
    read(key, check = (data) => data) {
      let raw = null;
      let tempRaw = null;
      try {
        raw = store.getItem(key);
        tempRaw = store.getItem(key + TEMP);
      } catch {
        return null;
      }
      const main = parse(raw, check);
      if (main.ok) {
        if (tempRaw !== null) api.remove(key + TEMP);
        return main.value;
      }
      // The real copy is missing or damaged: a finished temporary copy wins.
      const temp = parse(tempRaw, check);
      if (temp.ok) {
        if (!main.missing) api.quarantine(key, raw, main.error);
        api.write(key, temp.value);
        return temp.value;
      }
      if (!main.missing) api.quarantine(key, raw, main.error);
      if (tempRaw !== null) api.remove(key + TEMP);
      return null;
    },

    /** Saves a value safely. Returns false (and reports why) if it couldn't be saved. */
    write(key, value) {
      const text = JSON.stringify(value);
      try {
        store.setItem(key + TEMP, text);
        store.setItem(key, text);
        store.removeItem(key + TEMP);
        return true;
      } catch (error) {
        try { store.removeItem(key + TEMP); } catch { /* nothing more to do */ }
        onProblem(isQuotaError(error)
          ? { type: 'full', key, message: 'The iPad is out of room for saving the game. Make a backup in Grown-up Settings, then free up some space.' }
          : { type: 'unavailable', key, message: `The game couldn't save (${error?.message ?? 'unknown error'}).` });
        return false;
      }
    },

    remove(key) {
      try {
        store.removeItem(key);
        store.removeItem(key + TEMP);
      } catch { /* nothing to remove */ }
    },

    /** Moves a damaged value aside so it can be looked at later, and reports it. */
    quarantine(key, raw, error) {
      try {
        store.setItem(KEYS.quarantine(key), String(raw));
      } catch { /* no room to keep it; it is dropped */ }
      try {
        store.removeItem(key);
      } catch { /* nothing to remove */ }
      onProblem({ type: 'damaged', key, detail: error?.message ?? 'unreadable', message: `${damagedWhat(key)} damaged, so the game put that copy aside and carried on. A backup can bring it back.` });
    },

    /** Every key this game uses (optionally only those starting with a prefix). */
    keys(prefix = PREFIX) {
      const found = [];
      try {
        for (let i = 0; i < store.length; i++) {
          const key = store.key(i);
          if (key !== null && key.startsWith(prefix)) found.push(key);
        }
      } catch { /* storage not readable */ }
      return found;
    },

    /** About how many bytes the game's saved data takes (localStorage keeps text as 2 bytes a character). */
    usage() {
      let chars = 0;
      for (const key of api.keys()) chars += key.length + (store.getItem(key)?.length ?? 0);
      return chars * 2;
    },
  };
  return api;
}

/** What a damaged key held, in words for a grown-up. */
function damagedWhat(key) {
  const name = key.slice(PREFIX.length);
  if (name === 'index') return 'The saved list of players was';
  if (name.startsWith('profile.')) return "A player's saved settings and stickers were";
  if (name.startsWith('history.')) return "A player's game history was";
  if (name.startsWith('active.')) return 'A saved adventure in progress was';
  return 'Some saved data was';
}

/** Asks the browser to keep the game's data even when the device is short of space. Never throws. */
export async function askToKeepData() {
  try {
    if (await globalThis.navigator?.storage?.persisted?.()) return true;
    return Boolean(await globalThis.navigator?.storage?.persist?.());
  } catch {
    return false;
  }
}

/** "12 KB", "1.4 MB" */
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
