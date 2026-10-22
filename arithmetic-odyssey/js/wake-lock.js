// Keeps the iPad's screen on while the game is being used (0.7.9), so it
// doesn't dim and lock in the middle of a question. It uses the browser's
// Screen Wake Lock (iPadOS 16.4 and later in Safari; the Home Screen app
// needs iPadOS 18.4 or later). After IDLE_MS without a touch or key press
// the screen may sleep as usual, so an iPad left on the game still locks.
// The browser drops the lock when the game goes to the background; it is
// asked for again when the game comes back.

export const IDLE_MS = 5 * 60 * 1000;

/**
 * Returns { supported, use(), state() }. use() is called on every touch or
 * key press: it keeps the screen on (asking for the lock if needed) and
 * restarts the idle timer. state() is 'on', 'off' or 'not supported'.
 */
export function createWakeLock({ nav = globalThis.navigator, doc = globalThis.document, timers = globalThis, idleMs = IDLE_MS } = {}) {
  const supported = typeof nav?.wakeLock?.request === 'function';
  let lock = null;
  let asking = false;
  let idleTimer = 0;
  let active = false; // used in the last idleMs

  async function acquire() {
    if (!supported || !active || lock || asking || doc.visibilityState !== 'visible') return;
    asking = true;
    try {
      const got = await nav.wakeLock.request('screen');
      // The player may have gone idle (or the page hidden) while asking.
      if (!active || doc.visibilityState !== 'visible') {
        got.release().catch(() => {});
      } else {
        lock = got;
        lock.addEventListener?.('release', () => {
          if (lock === got) lock = null;
        });
      }
    } catch {
      // Refused (low battery mode, or not allowed here): the screen sleeps as usual.
      lock = null;
    } finally {
      asking = false;
    }
  }

  function release() {
    const held = lock;
    lock = null;
    held?.release().catch(() => {});
  }

  doc.addEventListener?.('visibilitychange', () => {
    if (doc.visibilityState === 'visible') acquire();
    else lock = null; // the browser releases it in the background
  });

  return {
    supported,
    use() {
      active = true;
      timers.clearTimeout(idleTimer);
      idleTimer = timers.setTimeout(() => {
        active = false;
        release();
      }, idleMs);
      acquire();
    },
    state: () => (!supported ? 'not supported' : lock ? 'on' : 'off'),
  };
}
