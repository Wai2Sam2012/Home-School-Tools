// Tests for Stage 7: the offline app (manifest, sw.js and its file list,
// js/offline.js) and the storage and memory report in the debug panel.
// Test IDs (T7.x) match the test plan in GAME-PLAN.md. T7.2-T7.5 (offline in
// a real browser) are checked in a browser; see the stage report.
// Run from the arithmetic-odyssey folder with:  node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

import {
  APP_FILES, OFFLINE_BUDGET_BYTES, buildServiceWorker, listOfflineFiles, listStickerPictures, offlineVersion, readVersion, storylineText,
} from '../tools/build-offline.mjs';
import { AVATARS, AVATAR_COLORS, avatarDrawingUrl, avatarUrl } from '../js/avatars.js';
import { pictureUrl } from '../js/storyline.js';
import { THEMES } from '../js/settings.js';
import { createOffline, offlineMessage, picturesToSave } from '../js/offline.js';
import { LOCAL_STORAGE_LIMIT, memoryReport, offlineCopyReport, savedDataReport } from '../js/storage-report.js';
import { memoryStorage } from '../js/storage.js';

const GAME = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(GAME, path), 'utf8');
const VERSION = readVersion();

// Built once: listing reads every file (about 22 MB).
// Story files are built per theme folder (themes/dino, themes/national-parks).
const folderOf = (theme) => THEMES[theme].folder.split('/')[1];
const storylines = Object.fromEntries(Object.keys(THEMES).map((t) => [folderOf(t), storylineText(folderOf(t))]));
const FILES = listOfflineFiles(GAME, { version: VERSION, storylines });
const PICTURES = listStickerPictures(GAME, { version: VERSION, storylines });
const urls = new Set(FILES.map((f) => f.url));
const later = new Set(PICTURES.map((f) => f.url));

// ---------------------------------------------------------------- T7.1 the file list

test('T7.1 every file in the list exists, with its real size and fingerprint', () => {
  for (const f of [...FILES, ...PICTURES]) {
    if (f.path.endsWith('storyline.json')) continue; // built from the theme files; checked below
    const bytes = readFileSync(join(GAME, f.path));
    assert.equal(f.size, bytes.length, f.path);
    assert.equal(f.hash, createHash('sha256').update(bytes).digest('hex').slice(0, 16), f.path);
  }
  for (const [theme, { text }] of Object.entries(storylines)) {
    const f = FILES.find((x) => x.path === `themes/${theme}/storyline.json`);
    assert.equal(f.size, Buffer.byteLength(text), `${theme} storyline`);
  }
  assert.equal(urls.size, FILES.length, 'no file is listed twice');
  assert.equal(new Set([...urls, ...later]).size, FILES.length + PICTURES.length, 'no picture is in both lists');
});

test('T7.1 every file the game needs is in the list, at the address the game asks for', () => {
  for (const path of APP_FILES) assert.ok(urls.has(path), path);
  // The page's own links (stylesheet, script, manifest, icons).
  const page = read('index.html');
  for (const [, href] of page.matchAll(/(?:src|href)="([^"#]+)"/g)) assert.ok(urls.has(href), `index.html links to ${href}`);
  // Every JavaScript file, reached from js/app.js through its imports, at its ?v= address.
  const seen = new Set();
  const visit = (path) => {
    if (seen.has(path)) return;
    seen.add(path);
    assert.ok(urls.has(`${path}?v=${VERSION}`), `${path}?v=${VERSION} is not in the list`);
    for (const [, spec] of read(path).matchAll(/\bfrom\s+'(\.{1,2}\/[^'?]+\.js)\?v=([^']+)'/g)) {
      visit(join(dirname(path), spec).split('\\').join('/'));
    }
  };
  visit('js/app.js');
  for (const f of readdirSync(join(GAME, 'js'), { recursive: true })) {
    if (String(f).endsWith('.js')) assert.ok(seen.has(`js/${String(f).split('\\').join('/')}`), `js/${f} is never imported (dead code?)`);
  }
  // Every player picture in every color, and the stand-in drawings.
  for (const a of AVATARS) {
    assert.ok(urls.has(avatarDrawingUrl(a.id)), avatarDrawingUrl(a.id));
    for (let c = 1; c <= AVATAR_COLORS[a.id].length; c++) assert.ok(urls.has(avatarUrl(a.id, c)), avatarUrl(a.id, c));
  }
  // Each theme's story file and sounds and its first sticker's pictures are saved with the game;
  // every other sticker picture is in the second list, saved when needed. Encoded the way the game asks for them.
  for (const [theme, info] of Object.entries(THEMES)) {
    const { storyline } = storylines[folderOf(theme)];
    assert.ok(urls.has(`${info.folder}storyline.json`), `${theme} story file`);
    for (const p of Object.values(storyline.sounds ?? {}).flat()) assert.ok(urls.has(pictureUrl(theme, p)), pictureUrl(theme, p));
    const [first, ...rest] = storyline.stickers;
    assert.ok(first.pictures.length > 0, `${theme}: the first sticker has pictures`);
    for (const p of first.pictures) assert.ok(urls.has(pictureUrl(theme, p)), `${theme} first sticker: ${p}`);
    for (const p of rest.flatMap((x) => x.pictures)) assert.ok(later.has(pictureUrl(theme, p)), `${theme}: ${p} is saved when needed`);
  }
  // The manifest's icons.
  for (const icon of JSON.parse(read('manifest.json')).icons) assert.ok(urls.has(icon.src), icon.src);
});

test('T7.1 the list has only what the game uses: no tests, tools, notes or absolute addresses', () => {
  for (const f of FILES) {
    assert.doesNotMatch(f.path, /^(tests|tools)\/|\.md$|downloaded-pictures/, f.path);
    assert.doesNotMatch(f.url, /^(\/|https?:)/, `${f.url} must be relative (the game lives under /Home-School-Tools/)`);
  }
  assert.ok(!urls.has('sw.js'), 'the service worker is not saved by itself');
});

test('T7.1 a picture named in a story file but missing stops the build (instead of an incomplete offline copy)', () => {
  const broken = structuredClone(storylines);
  broken.dino.storyline.stickers[0].pictures = ['pictures/Triassic/Nobody/missing.jpg'];
  assert.throws(() => listOfflineFiles(GAME, { version: VERSION, storylines: broken }), /missing\.jpg is in the story file but missing/);
});

test('the game saved at first is small; even with every sticker collected it fits the budget', () => {
  const first = FILES.reduce((n, f) => n + f.size, 0);
  const all = first + PICTURES.reduce((n, f) => n + f.size, 0);
  assert.ok(first < 10 * 1024 * 1024, `${(first / 1e6).toFixed(1)} MB saved at first`);
  assert.ok(all < OFFLINE_BUDGET_BYTES, `${(all / 1e6).toFixed(1)} MB with every sticker is over the budget`);
});

// ---------------------------------------------------------------- sw.js

test('sw.js is built with the version and every file, and is valid JavaScript', () => {
  const sw = buildServiceWorker(GAME, { version: VERSION, files: FILES, pictures: PICTURES });
  assert.doesNotThrow(() => new Script(sw, { filename: 'sw.js' }));
  assert.ok(!sw.includes('/* VERSION */') && !sw.includes('/* FILES */'), 'placeholders filled in');
  assert.match(sw, new RegExp(`const VERSION = "${VERSION.replace(/\./g, '\\.')}-[0-9a-f]{16}";`));
  const listed = [...sw.matchAll(/^ {2}\["([^"]+)", (\d+), "([0-9a-f]{16})"\],$/gm)];
  assert.equal(listed.length, FILES.length + PICTURES.length, 'both lists');
  assert.match(sw, /const PICTURES = \[\n {2}\[/, 'the sticker pictures list is filled in');
  assert.ok(sw.includes('["index.html", '), 'the page is saved');
});

test('a new version is saved under a new name only when a file changes', () => {
  const same = offlineVersion(VERSION, FILES);
  assert.equal(offlineVersion(VERSION, FILES.map((f) => ({ ...f }))), same);
  const changed = FILES.map((f, i) => (i === 5 ? { ...f, hash: '0000000000000000' } : f));
  assert.notEqual(offlineVersion(VERSION, changed), same, 'an uploaded or edited picture gives a new version');
  assert.notEqual(offlineVersion('9.9.9', FILES), same);
});

test('the service worker only touches this game: its own saved copies, inside its own folder', () => {
  const template = read('tools/sw-template.js');
  assert.match(template, /const PREFIX = 'arithmetic-odyssey-';/);
  assert.match(template, /name\.startsWith\(PREFIX\) && name !== CACHE && name !== PICTURE_CACHE\) await caches\.delete\(name\)/, 'deletes only its own old copies, and keeps saved sticker pictures');
  assert.match(template, /if \(!url\.href\.startsWith\(self\.registration\.scope\)\) return;/, 'leaves other pages alone');
  // It takes over only when the page asks (on the start screen, or "Update now"): one skipWaiting, in that message.
  assert.equal(template.split('skipWaiting()').length - 1, 1);
  assert.match(template, /if \(data\.type === 'take-over'\) \{\s+self\.skipWaiting\(\);/);
});

// ---------------------------------------------------------------- the installable app

test('the manifest makes a full-screen app that starts in its own folder', () => {
  const m = JSON.parse(read('manifest.json'));
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, './');
  assert.equal(m.scope, './');
  assert.equal(m.short_name, 'Arithmetic Odyssey', 'the name under the Home Screen icon (the author chose the full name)');
  assert.ok(m.name);
  for (const icon of m.icons) {
    const png = readFileSync(join(GAME, icon.src));
    const [w, h] = [png.readUInt32BE(16), png.readUInt32BE(20)];
    assert.equal(`${w}x${h}`, icon.sizes, icon.src);
  }
});

test('index.html has the iPad tags and a 180 x 180 Home Screen icon', () => {
  const page = read('index.html');
  assert.match(page, /<link rel="manifest" href="manifest\.json">/);
  assert.match(page, /<meta name="apple-mobile-web-app-capable" content="yes">/);
  assert.match(page, /<meta name="apple-mobile-web-app-title" content="Arithmetic Odyssey">/, 'the same name on the iPad');
  const icon = page.match(/<link rel="apple-touch-icon" href="([^"]+)">/)[1];
  const png = readFileSync(join(GAME, icon));
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [180, 180]);
});

test('offline.html works on its own: no scripts, no other files', () => {
  const page = read('offline.html');
  assert.doesNotMatch(page, /<script|<link|src=/i);
  assert.deepEqual([...page.matchAll(/href="([^"]+)"/g)].map((m) => m[1]), ['./'], 'only a link back to the game');
});

test('the deploy workflow builds sw.js after the story files, and git does not keep it', () => {
  const workflow = readFileSync(join(GAME, '..', '.github', 'workflows', 'deploy.yml'), 'utf8');
  const story = workflow.indexOf('tools/build-storyline.mjs');
  const offline = workflow.indexOf('tools/build-offline.mjs');
  assert.ok(story > 0 && offline > story && offline < workflow.indexOf('assemble-site.mjs'));
  assert.match(readFileSync(join(GAME, '..', '.gitignore'), 'utf8'), /^arithmetic-odyssey\/sw\.js$/m);
});

// ---------------------------------------------------------------- js/offline.js

/** A pretend service worker, registration and navigator.serviceWorker. */
function fakeBrowser({ active = null, installing = null, waiting = null, complete = true } = {}) {
  const listeners = {};
  const on = (target) => (type, fn) => { (target[type] ??= []).push(fn); };
  const fire = (target, type, event = {}) => { for (const fn of target[type] ?? []) fn(event); };
  const worker = (name) => {
    const w = { name, state: name === 'active' ? 'activated' : 'installing', posted: [], ev: {} };
    w.addEventListener = on(w.ev);
    w.postMessage = (data, ports) => {
      w.posted.push(data.type);
      if (data.type === 'status') ports[0].postMessage({ version: '0.7.0-abc', complete: w.complete ?? complete, files: 282, bytes: 22e6 });
    };
    w.become = (state) => { w.state = state; fire(w.ev, 'statechange'); };
    return w;
  };
  const reg = { ev: {}, active: active && worker('active'), installing: installing && worker('installing'), waiting: waiting && worker('waiting'), updates: 0 };
  reg.addEventListener = on(reg.ev);
  reg.update = async () => { reg.updates += 1; };
  reg.unregister = async () => true;
  const container = {
    registered: null,
    addEventListener: on(listeners),
    register: async (url, options) => { container.registered = { url, options }; return reg; },
    message: (data) => fire(listeners, 'message', { data: { source: 'arithmetic-odyssey-sw', ...data } }),
    controllerChange: () => fire(listeners, 'controllerchange'),
  };
  const newWorker = () => {
    reg.installing = worker('installing');
    fire(reg.ev, 'updatefound');
    return reg.installing;
  };
  return { container, reg, worker, newWorker };
}
const tick = () => new Promise((r) => setTimeout(r, 20));

test('offline play is "unsupported" without service workers or a secure address', async () => {
  assert.equal((await createOffline({ container: undefined, secure: true }).start()).status, 'unsupported');
  const { container } = fakeBrowser();
  assert.equal((await createOffline({ container, secure: false }).start()).status, 'unsupported');
  assert.equal(container.registered, null, 'nothing registered');
  const refusing = { ...container, register: async () => { throw new Error('denied'); } };
  assert.equal((await createOffline({ container: refusing, secure: true }).start()).status, 'unsupported');
});

test('T7.3 first visit: saving shows progress, and "Ready to play offline" comes only once every file is saved', async () => {
  const b = fakeBrowser({ installing: true });
  const offline = createOffline({ container: b.container, secure: true });
  await offline.start();
  assert.deepEqual(b.container.registered, { url: 'sw.js', options: { scope: './', updateViaCache: 'none' } });
  assert.equal(offline.state().status, 'saving');
  b.container.message({ type: 'progress', done: 141, total: 282 });
  assert.equal(offline.message(), 'Saving the game for offline play… 50%');
  b.reg.installing.become('installed');
  assert.equal(offline.state().status, 'saving', 'installed is not enough: it must take charge and confirm');
  const w = b.reg.installing;
  b.reg.active = w;
  b.reg.installing = null;
  w.become('activated');
  await tick();
  assert.equal(offline.state().status, 'ready');
  assert.equal(offline.message(), '✓ Ready to play offline');
});

test('T7.3 a file that fails to save: no "Ready", a plain message, and it tries again next time', async () => {
  const b = fakeBrowser({ installing: true });
  const offline = createOffline({ container: b.container, secure: true });
  await offline.start();
  b.container.message({ type: 'failed', count: 1, failed: ['themes/dino/pictures/x.jpg: HTTP 404'], total: 282 });
  b.reg.installing.become('redundant');
  assert.equal(offline.state().status, 'failed');
  assert.equal(offline.state().failedCount, 1);
  assert.match(offline.message(), /couldn't be saved.*try again/);
});

test('T7.4 an update downloads in the background and waits; it never takes over in the middle of a game', async () => {
  const b = fakeBrowser({ active: true });
  let reloads = 0;
  let onStart = false;
  const offline = createOffline({ container: b.container, secure: true, canApplyUpdate: () => onStart, reload: () => { reloads += 1; }, setTimer: () => {} });
  await offline.start();
  assert.equal(offline.state().status, 'ready');
  const next = b.newWorker();
  assert.equal(offline.state().status, 'update-saving');
  assert.match(offline.message(), /Ready to play offline \(downloading an update/);
  b.reg.waiting = next;
  next.become('installed');
  assert.equal(offline.state().status, 'update-ready');
  assert.equal(offline.message(), 'Update ready: it will apply next time you open the game.');
  assert.deepEqual(next.posted, [], 'not on the start screen: it waits');
  b.container.controllerChange();
  assert.equal(reloads, 0, 'nothing reloads on its own');
  // A grown-up presses "Update now" (or the game is opened again).
  assert.equal(offline.applyUpdate(), true);
  assert.deepEqual(next.posted, ['take-over']);
  assert.equal(offline.applyUpdate(), false, 'only once');
  b.container.controllerChange();
  assert.equal(reloads, 1);
});

test('T7.4 opening the game with an update waiting applies it on the start screen, before anyone plays', async () => {
  const b = fakeBrowser({ active: true, waiting: true });
  let reloads = 0;
  const offline = createOffline({ container: b.container, secure: true, canApplyUpdate: () => true, reload: () => { reloads += 1; }, setTimer: () => {}, session: null });
  await offline.start();
  assert.deepEqual(b.reg.waiting.posted, ['take-over']);
  b.container.controllerChange();
  assert.equal(reloads, 1);
  // Not on the start screen (for example the game was left on an adventure): it only says so.
  const c = fakeBrowser({ active: true, waiting: true });
  const later = createOffline({ container: c.container, secure: true, canApplyUpdate: () => false, setTimer: () => {} });
  await later.start();
  assert.equal(later.state().status, 'update-ready');
  assert.deepEqual(c.reg.waiting.posted, []);
});

test('while an update switches in, the game starts nothing new; if the switch stalls it reloads once, never in a loop', async () => {
  const session = new Map();
  const fakeSession = { getItem: (k) => session.get(k) ?? null, setItem: (k, v) => session.set(k, v) };
  let clock = 1_000_000;
  let timer = null;
  let reloads = 0;
  const open = (b) => createOffline({
    container: b.container, secure: true, canApplyUpdate: () => true, reload: () => { reloads += 1; },
    setTimer: (fn) => { timer = fn; }, session: fakeSession, now: () => clock,
  });
  const b = fakeBrowser({ active: true, waiting: true });
  const offline = open(b);
  const seen = [];
  offline.onChange((s) => seen.push(s.applying === true));
  await offline.start();
  assert.equal(offline.state().applying, true);
  assert.ok(seen.every(Boolean), 'every change after start says it is switching (so pictures are not saved meanwhile)');
  timer(); // the switch didn't happen in time
  assert.equal(reloads, 1, 'reloads once anyway');
  // The reloaded game finds the update still waiting: it tries again, but doesn't reload again within a minute.
  const again = open(fakeBrowser({ active: true, waiting: true }));
  await again.start();
  timer();
  assert.equal(reloads, 1, 'no reload loop');
  clock += 61_000;
  const later = open(fakeBrowser({ active: true, waiting: true }));
  await later.start();
  timer();
  assert.equal(reloads, 2, 'a minute later it may try once more');
});

test('an update that fails to download leaves the saved game working', async () => {
  const b = fakeBrowser({ active: true });
  const offline = createOffline({ container: b.container, secure: true });
  await offline.start();
  const next = b.newWorker();
  b.reg.installing = null;
  next.become('redundant');
  await tick();
  assert.equal(offline.state().status, 'ready');
});

test('if the iPad cleared some saved files, the game saves them again', async () => {
  const b = fakeBrowser({ active: true, complete: false });
  const offline = createOffline({ container: b.container, secure: true });
  await offline.start();
  assert.equal(offline.state().status, 'saving');
  assert.deepEqual(b.reg.active.posted, ['status', 'save-again']);
  b.reg.active.complete = true;
  b.container.message({ type: 'saved', total: 282 });
  await tick();
  assert.equal(offline.state().status, 'ready');
  // And if saving again fails, it says so instead of saving forever.
  const c = fakeBrowser({ active: true, complete: false });
  const other = createOffline({ container: c.container, secure: true });
  await other.start();
  c.container.message({ type: 'failed', count: 3, failed: [], total: 282 });
  assert.equal(other.state().status, 'failed');
});

test('it looks for updates at most every 30 minutes (or when asked), and not without internet', async () => {
  let clock = 0;
  const b = fakeBrowser({ active: true });
  const offline = createOffline({ container: b.container, secure: true, now: () => clock });
  await offline.start();
  assert.equal(offline.checkForUpdate(), false, 'just checked when it registered');
  clock += 31 * 60 * 1000;
  assert.equal(offline.checkForUpdate(), true);
  assert.equal(offline.checkForUpdate(), false);
  assert.equal(offline.checkForUpdate({ force: true }), true);
  assert.equal(b.reg.updates, 2);
});

test('the status in words', () => {
  assert.equal(offlineMessage({ status: 'saving', done: 0, total: 0 }), 'Saving the game for offline play…');
  assert.equal(offlineMessage({ status: 'saving', done: 282, total: 282 }), 'Saving the game for offline play… 100%');
  assert.equal(offlineMessage({ status: 'nonsense' }), '');
});

// ---------------------------------------------------------------- sticker pictures saved when needed

const story = (ids) => ({ stickers: ids.map((id, i) => ({ id, number: i + 1, pictures: [`pictures/${id}/a b.jpg`, `pictures/${id}/2.jpg`] })) });

test('the pictures to save: every collected sticker and each player\'s next stop, for every player', () => {
  const storylines = { dino: story(['eo', 'herr', 'coel', 'plat']), parks: story(['denali', 'kenai']), missing: null };
  const players = [
    { collected: { dino: ['eo', 'herr'], parks: [] } },
    { collected: { dino: ['eo'] } }, // no parks list at all (an old save)
  ];
  const urls = picturesToSave(storylines, players);
  assert.deepEqual(urls.filter((u) => u.startsWith('themes/dino/')).sort(), [
    'themes/dino/pictures/coel/2.jpg', 'themes/dino/pictures/coel/a%20b.jpg', // first player's next stop
    'themes/dino/pictures/eo/2.jpg', 'themes/dino/pictures/eo/a%20b.jpg',
    'themes/dino/pictures/herr/2.jpg', 'themes/dino/pictures/herr/a%20b.jpg', // collected, and the second player's next stop
  ]);
  assert.deepEqual(urls.filter((u) => u.startsWith('themes/national-parks/')).sort(), [
    'themes/national-parks/pictures/denali/2.jpg', 'themes/national-parks/pictures/denali/a%20b.jpg',
  ], 'nobody collected a park yet: only the next stop');
  assert.equal(new Set(urls).size, urls.length, 'each picture once');
  // Everything collected: no next stop.
  assert.equal(picturesToSave({ parks: story(['denali']) }, [{ collected: { parks: ['denali'] } }]).length, 2);
  assert.deepEqual(picturesToSave({}, players), []);
});

test('pictures are asked for only when offline play works and there is internet', async () => {
  const offline = createOffline({ container: undefined, secure: true });
  await offline.start();
  assert.equal(offline.savePictures(['themes/dino/x.jpg']), false, 'offline play unsupported');
  const b = fakeBrowser({ active: true });
  const working = createOffline({ container: b.container, secure: true });
  await working.start();
  assert.equal(working.savePictures([]), false, 'nothing to save');
  assert.equal(working.savePictures(['themes/dino/x.jpg']), true);
  assert.deepEqual(b.reg.active.posted, ['status', 'save-pictures']);
  b.container.message({ type: 'pictures', wanted: 4, saved: 3, failed: 1 });
  assert.deepEqual(working.state().pictures, { wanted: 4, saved: 3, failed: 1 });
});

test('the service worker keeps saved sticker pictures across updates, and checks each one', () => {
  const template = read('tools/sw-template.js');
  assert.match(template, /const PICTURE_CACHE = `\$\{PREFIX\}sticker-pictures`;/);
  assert.match(template, /PICTURE_INFO\.get\(url\)\?\.hash !== saved\?\.headers\.get\('X-AO-Hash'\)\) await pictures\.delete\(request\)/, 'a changed or removed picture is dropped');
  assert.match(template, /filter\(\(url\) => PICTURE_INFO\.has\(url\)\)/, 'only pictures in its list are saved');
  assert.match(template, /await download\(url, size, hash\)/, 'checked like every other file');
});

// ---------------------------------------------------------------- storage and memory report

test('saved data is measured per player, with other tools on the same address counted separately', () => {
  const s = memoryStorage();
  s.setItem('ao.v1.index', 'x'.repeat(100));
  s.setItem('ao.v1.profile.p1', 'y'.repeat(1000));
  s.setItem('ao.v1.history.p1', 'z'.repeat(500));
  s.setItem('ao.v1.active.p1.tmp', 'w'.repeat(10));
  s.setItem('ao.v1.profile.p2', 'v'.repeat(200));
  s.setItem('ao.v1.quarantine.profile.p9', 'q'.repeat(50));
  s.setItem('spelling.v1.words', 's'.repeat(300));
  const r = savedDataReport(s, [{ id: 'p1', name: 'Mia' }, { id: 'p2', name: 'Ben' }]);
  const bytes = (key, n) => (key.length + n) * 2;
  assert.equal(r.players[0].bytes, bytes('ao.v1.profile.p1', 1000) + bytes('ao.v1.history.p1', 500) + bytes('ao.v1.active.p1.tmp', 10));
  assert.equal(r.players[1].bytes, bytes('ao.v1.profile.p2', 200));
  assert.equal(r.sharedBytes, bytes('ao.v1.index', 100) + bytes('ao.v1.quarantine.profile.p9', 50), 'the list and set-aside data');
  assert.equal(r.gameKeys, 6);
  assert.deepEqual([r.otherKeys, r.otherBytes], [1, bytes('spelling.v1.words', 300)]);
  assert.equal(r.gameBytes, r.players[0].bytes + r.players[1].bytes + r.sharedBytes);
  assert.equal(LOCAL_STORAGE_LIMIT, 5 * 1024 * 1024);
});

test('memory: the heap where the browser reports it; Safari reports none', () => {
  const chrome = memoryReport({ perf: { memory: { usedJSHeapSize: 30e6, totalJSHeapSize: 40e6, jsHeapSizeLimit: 4e9 } }, doc: null, sounds: 3 });
  assert.deepEqual(chrome.heap, { used: 30e6, total: 40e6, limit: 4e9 });
  assert.equal(chrome.sounds, 3);
  assert.equal(memoryReport({ perf: {}, doc: null }).heap, null);
});

test('the offline copy is measured from its saved file list, without reading the files', async () => {
  const list = [['index.html', 3000, 'a'], ['js/app.js?v=0.7.0', 14000, 'b']];
  const cache = (complete) => ({
    keys: async () => [1, 2, 3],
    match: async () => (complete ? { json: async () => list } : undefined),
  });
  const pictures = {
    keys: async () => ['a', 'b'],
    match: async (r) => ({ headers: { get: (h) => (h === 'X-AO-Size' ? (r === 'a' ? '150000' : '250000') : null) } }),
  };
  const stores = {
    'arithmetic-odyssey-0.7.0-x': cache(true), 'arithmetic-odyssey-0.7.1-y': cache(false), 'arithmetic-odyssey-sticker-pictures': pictures, 'other-tool': cache(true),
  };
  const fakeCaches = { keys: async () => Object.keys(stores), open: async (n) => stores[n] };
  assert.deepEqual(await offlineCopyReport(fakeCaches), { copies: 2, complete: 1, files: 2 + 3, bytes: 17000, pictures: 2, pictureBytes: 400000 });
  assert.equal(await offlineCopyReport(null), null);
});
