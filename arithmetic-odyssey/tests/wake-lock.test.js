// Keeping the screen on while the game is used (0.7.9), with a pretend
// browser: the lock is asked for on use, let go after the idle time, asked
// for again when the game comes back, and a refusal or no support is fine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { IDLE_MS, createWakeLock } from '../js/wake-lock.js';

function fakeBrowser({ supported = true, refuse = false } = {}) {
  const listeners = {};
  const doc = { visibilityState: 'visible', addEventListener: (t, fn) => { listeners[t] = fn; } };
  const requests = [];
  const locks = [];
  const nav = supported ? {
    wakeLock: {
      request: async (type) => {
        requests.push(type);
        if (refuse) throw new Error('NotAllowedError');
        const lock = { released: false, release: async () => { lock.released = true; lock.onRelease?.(); }, addEventListener: (t, fn) => { lock.onRelease = fn; } };
        locks.push(lock);
        return lock;
      },
    },
  } : {};
  let timer = null;
  const timers = { setTimeout: (fn) => { timer = fn; return 1; }, clearTimeout: () => { timer = null; } };
  return { doc, nav, timers, requests, locks, listeners, idle: () => timer?.(), setVisible(v) { doc.visibilityState = v ? 'visible' : 'hidden'; listeners.visibilitychange?.(); } };
}
const settle = () => new Promise((r) => setImmediate(r));

test('the screen stays on from the first touch, with one lock however many touches', async () => {
  const b = fakeBrowser();
  const w = createWakeLock(b);
  assert.equal(w.supported, true);
  assert.equal(w.state(), 'off', 'nothing until the game is used');
  w.use(); w.use(); w.use();
  await settle();
  assert.deepEqual(b.requests, ['screen']);
  assert.equal(w.state(), 'on');
  w.use();
  await settle();
  assert.equal(b.requests.length, 1, 'no new request while it is on');
});

test(`after ${IDLE_MS / 60000} minutes without a touch the screen may sleep; the next touch keeps it on again`, async () => {
  const b = fakeBrowser();
  const w = createWakeLock(b);
  w.use(); await settle();
  b.idle();
  await settle();
  assert.equal(b.locks[0].released, true);
  assert.equal(w.state(), 'off');
  w.use(); await settle();
  assert.equal(w.state(), 'on');
  assert.equal(b.requests.length, 2);
});

test('in the background the lock goes; back in the game it is asked for again (only if recently used)', async () => {
  const b = fakeBrowser();
  const w = createWakeLock(b);
  w.use(); await settle();
  b.setVisible(false);
  assert.equal(w.state(), 'off');
  w.use(); await settle();
  assert.equal(b.requests.length, 1, 'never asked while hidden');
  b.setVisible(true); await settle();
  assert.equal(w.state(), 'on');
  assert.equal(b.requests.length, 2);
  b.idle(); await settle();
  b.setVisible(false); b.setVisible(true); await settle();
  assert.equal(w.state(), 'off', 'an idle game does not take the lock back on its own');
});

test('a browser without wake lock, or one that refuses (Low Power Mode), plays on with no error', async () => {
  const none = createWakeLock(fakeBrowser({ supported: false }));
  assert.equal(none.supported, false);
  none.use(); await settle();
  assert.equal(none.state(), 'not supported');
  const b = fakeBrowser({ refuse: true });
  const refused = createWakeLock(b);
  refused.use(); await settle();
  assert.equal(refused.state(), 'off');
  refused.use(); await settle();
  assert.equal(b.requests.length, 2, 'it tries again on the next touch');
});

test('the page asks the iPad not to zoom, and the double-tap guard covers slower taps but not the name box', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /name="viewport" content="[^"]*maximum-scale=1, user-scalable=no/);
  const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.match(app, /const DOUBLE_TAP_MS = 600;/);
  assert.match(app, /closest\?\.\('input, textarea'\)/);
  assert.match(app, /createWakeLock\(\)/);
});
