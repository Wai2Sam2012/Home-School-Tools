// Debug panel, opened by adding ?debug=1 to the game's address.
//
// It shows facts about the device (screen size, Home Screen mode, which
// browser features are available) and buttons that later stages use to
// simulate hard cases, such as speech that never finishes or full storage.
// Other modules add buttons with addDebugAction() and facts with
// addDebugInfo().

// Every key this game saves starts with this prefix. Other tools published on
// the same github.io address share the iPad's storage, so the game must only
// ever touch its own keys.
export const STORAGE_PREFIX = 'ao.';

const infoRows = [];
const actions = [];
let panel = null;
let collapsed = false;

/** True when the page address contains debug=1. */
export function isDebugOn(search = globalThis.location?.search ?? '') {
  return new URLSearchParams(search).get('debug') === '1';
}

/** Lists the keys in a Storage object (such as localStorage) that belong to this game. */
export function listGameKeys(storage) {
  const keys = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null && key.startsWith(STORAGE_PREFIX)) keys.push(key);
  }
  return keys;
}

/** Removes only this game's keys from a Storage object. Returns how many were removed. */
export function clearGameKeys(storage) {
  const keys = listGameKeys(storage);
  for (const key of keys) storage.removeItem(key);
  return keys.length;
}

/** Adds a row of information. getValue is called each time the panel is drawn. */
export function addDebugInfo(label, getValue) {
  infoRows.push({ label, getValue });
  if (panel) render();
}

/** Adds a button. run() is called when it is pressed; a returned string is shown as the result. */
export function addDebugAction(label, run) {
  actions.push({ label, run });
  if (panel) render();
}

function isStandalone() {
  return globalThis.navigator?.standalone === true || globalThis.matchMedia?.('(display-mode: standalone)').matches === true;
}

function localStorageWorks() {
  try {
    const key = `${STORAGE_PREFIX}debug.test`;
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function yesNo(value) {
  return value ? 'yes' : 'no';
}

function addStandardInfo(version) {
  addDebugInfo('Version', () => version);
  addDebugInfo('Address', () => location.href);
  addDebugInfo('Screen', () => `${screen.width} × ${screen.height} (window ${innerWidth} × ${innerHeight}, pixel ratio ${devicePixelRatio})`);
  addDebugInfo('Home Screen app', () => yesNo(isStandalone()));
  addDebugInfo('Online', () => yesNo(navigator.onLine));
  addDebugInfo('Secure (HTTPS or localhost)', () => yesNo(globalThis.isSecureContext));
  addDebugInfo('Service worker support', () => yesNo('serviceWorker' in navigator));
  addDebugInfo('Saving (localStorage) works', () => yesNo(localStorageWorks()));
  addDebugInfo('Saved game keys', () => {
    try {
      return String(listGameKeys(localStorage).length);
    } catch {
      return 'unavailable';
    }
  });
  addDebugInfo('Speech support', () => yesNo('speechSynthesis' in globalThis));
  addDebugInfo('Sound (Web Audio) support', () => yesNo('AudioContext' in globalThis || 'webkitAudioContext' in globalThis));
}

function addStandardActions() {
  addDebugAction('Refresh this panel', () => 'Refreshed.');
  addDebugAction('Reload the page', () => {
    location.reload();
  });
  addDebugAction("Delete this game's saved data", () => {
    if (!confirm("Delete all of Arithmetic Odyssey's saved data on this device? Other tools are not affected.")) {
      return 'Cancelled.';
    }
    try {
      return `Deleted ${clearGameKeys(localStorage)} saved item(s).`;
    } catch {
      return 'Saving is not available, so there was nothing to delete.';
    }
  });
}

function element(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  Object.assign(el, props);
  for (const child of children) el.append(child);
  return el;
}

function render(message = '') {
  const rows = infoRows.map(({ label, getValue }) => {
    let value;
    try {
      value = String(getValue());
    } catch (error) {
      value = `error: ${error.message}`;
    }
    return element('div', { className: 'debug-row' }, [
      element('dt', { textContent: label }),
      element('dd', { textContent: value }),
    ]);
  });
  const buttons = actions.map(({ label, run }) =>
    element('button', {
      type: 'button',
      textContent: label,
      onclick: async () => {
        try {
          const result = await run();
          render(typeof result === 'string' ? result : `Done: ${label}`);
        } catch (error) {
          render(`Failed: ${error.message}`);
        }
      },
    }),
  );
  // The panel can be folded away so it doesn't cover the game's buttons.
  const toggle = element('button', {
    type: 'button',
    className: 'debug-toggle',
    textContent: collapsed ? 'Show' : 'Hide',
    onclick: () => {
      collapsed = !collapsed;
      render();
    },
  });
  const heading = element('h2', { textContent: 'Debug panel ' }, [toggle]);
  panel.classList.toggle('collapsed', collapsed);
  if (collapsed) {
    panel.replaceChildren(heading);
    return;
  }
  panel.replaceChildren(
    heading,
    element('dl', {}, rows),
    element('div', { className: 'debug-actions' }, buttons),
    element('p', { className: 'debug-message', textContent: message, role: 'status' }),
  );
}

/** Creates the panel (once) and shows it. */
export function showDebugPanel(version) {
  if (panel) return panel;
  addStandardInfo(version);
  addStandardActions();
  panel = element('aside', { id: 'debug-panel', className: 'debug-panel' });
  panel.setAttribute('aria-label', 'Debug panel');
  document.body.append(panel);
  render();
  return panel;
}
