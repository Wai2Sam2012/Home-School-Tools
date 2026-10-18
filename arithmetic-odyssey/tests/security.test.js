// Security checks (0.7.1): the pages' security policy is up to date, the
// code only builds pages from safe pieces, and saved data or a backup file
// can't change how the game's code works.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PAGES, inlineHashes, policyFor, withPolicy } from '../tools/csp.mjs';
import { PRIVATE_FILE } from '../../.github/scripts/assemble-site.mjs';
import { MAX_BACKUP_FILE_BYTES, makeBackup, parseBackup } from '../js/backup.js';
import { createProfileStore } from '../js/profiles.js';
import { checkProfile } from '../js/records.js';
import { THEMES, isThemeId, normalizeSettings, normalizeSetup } from '../js/settings.js';
import { createStorage, memoryStorage } from '../js/storage.js';

const GAME = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(GAME, path), 'utf8');

function jsFiles(dir = 'js') {
  return readdirSync(join(GAME, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return jsFiles(path);
    return entry.name.endsWith('.js') ? [path] : [];
  });
}

// ---------------------------------------------------------------- the pages

for (const page of PAGES) {
  test(`${page}: the security policy matches the page (run node tools/csp.mjs if not)`, () => {
    const html = read(page);
    const meta = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/);
    assert.ok(meta, 'the page has a Content-Security-Policy meta tag');
    assert.equal(meta[1], policyFor(html));
    assert.equal(withPolicy(html), html);
  });

  test(`${page}: the policy only allows the game's own files`, () => {
    const policy = policyFor(read(page));
    assert.match(policy, /default-src 'none'/);
    assert.match(policy, /object-src 'none'/);
    assert.match(policy, /base-uri 'none'/);
    assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval|https?:|data:|blob:|\*/);
  });

  test(`${page}: no inline event handlers or javascript: links`, () => {
    const html = read(page);
    assert.doesNotMatch(html, /<[^>]+\son[a-z]+\s*=/i);
    assert.doesNotMatch(html, /javascript:/i);
  });

  test(`${page}: the policy meta comes before any script, style or link`, () => {
    const html = read(page);
    const at = html.indexOf('Content-Security-Policy');
    for (const tag of ['<script', '<style', '<link']) {
      const first = html.indexOf(tag);
      if (first !== -1) assert.ok(at < first, `${tag} comes after the policy`);
    }
  });
}

test('the policy changes when an inline script changes', () => {
  const page = '<meta http-equiv="Content-Security-Policy" content=""><script>a()</script>';
  const changed = page.replace('a()', 'b()');
  assert.notEqual(policyFor(page), policyFor(changed));
  assert.equal(inlineHashes(page).scripts.length, 1);
  assert.equal(inlineHashes('<script src="x.js"></script>').scripts.length, 0);
  assert.throws(() => withPolicy('<p>no policy</p>'), /no Content-Security-Policy/);
});

// ---------------------------------------------------------------- the code

test('the code never runs text as code', () => {
  for (const file of [...jsFiles(), 'tools/sw-template.js']) {
    const code = read(file);
    assert.doesNotMatch(code, /\beval\s*\(|new Function\s*\(|document\.write|insertAdjacentHTML|outerHTML\s*=/, file);
    assert.doesNotMatch(code, /setTimeout\(\s*['"`]|setInterval\(\s*['"`]/, file);
  }
});

test('innerHTML is only used for drawings made from numbers and fixed shapes', () => {
  const allowed = new Set(['js/art.js', 'js/detour-road.js', 'js/keypad.js', 'js/tip-card.js']);
  for (const file of jsFiles()) {
    if (/\.innerHTML\s*=/.test(read(file))) assert.ok(allowed.has(file), `${file} uses innerHTML`);
  }
  // Names and other typed text never reach those drawings.
  for (const file of allowed) assert.doesNotMatch(read(file), /\bname\b[^\n]*innerHTML|innerHTML[^\n]*\bname\b/, file);
});

test('links the game opens are its own, and new windows cannot reach back', () => {
  for (const file of jsFiles()) {
    const code = read(file);
    assert.doesNotMatch(code, /window\.open\(|location\.href\s*=\s*[^'"`]/, file);
    for (const m of code.matchAll(/target:\s*'_blank'[^)]*/g)) assert.match(m[0], /noopener/, file);
  }
});

test('the offline worker only answers for this game and only saves its own files', () => {
  const sw = read('tools/sw-template.js');
  // Requests outside the game's folder (other sites, other tools) are left alone.
  assert.match(sw, /if \(!url\.href\.startsWith\(self\.registration\.scope\)\) return;/);
  assert.match(sw, /if \(request\.method !== 'GET'\) return;/);
  assert.doesNotMatch(sw, /importScripts|eval\s*\(/);
});

// ---------------------------------------------------------------- saved data and backups

test('theme ids are only the real themes, never built-in object names', () => {
  for (const id of Object.keys(THEMES)) assert.equal(isThemeId(id), true);
  for (const id of ['constructor', '__proto__', 'toString', 'hasOwnProperty', '', null, undefined, 7, {}]) {
    assert.equal(isThemeId(id), false, String(id));
  }
  assert.ok(Object.keys(THEMES).includes(normalizeSetup({ theme: 'constructor' }).theme));
  assert.ok(Object.keys(THEMES).includes(normalizeSetup({ theme: '__proto__' }).theme));
});

test('settings from a file keep only known values', () => {
  const s = normalizeSettings({ colors: '"><script>', adventureLength: '__proto__', extra: 'x', __proto__: { polluted: true } });
  assert.equal(s.colors, 'classic');
  assert.equal(s.extra, undefined);
  assert.equal(s.polluted, undefined);
  assert.equal({}.polluted, undefined);
});

function hostileBackup() {
  const store = createProfileStore({ storage: createStorage(memoryStorage()) });
  store.add('Sam', 'dino', 1);
  const backup = makeBackup(store);
  const profile = backup.players[0].profile;
  profile.name = '<img src=x onerror=alert(1)>';
  profile.collected = { constructor: ['a'], __proto__: ['b'], dino: ['d1', { evil: true }, 'd1'] };
  profile.highScores = { constructor: [{}], '__proto__': [{}], '10|easy': [{ at: '2026-10-01T00:00:00.000Z', thinkingMs: 5, theme: 'constructor' }] };
  profile.learned = { __proto__: '2026-10-01T00:00:00.000Z', 'constructor': '2026-10-01T00:00:00.000Z', '7×8': '2026-10-01T00:00:00.000Z' };
  profile.lastResult = { theme: 'constructor' };
  profile.setup = { theme: 'hasOwnProperty' };
  profile.settings = { colors: 'toString' };
  // JSON.stringify drops a __proto__ set with =, so add the keys in the text, as a hostile file would.
  return JSON.stringify(backup).replace('"collected":{', '"collected":{"__proto__":{"polluted":["x"]},');
}

test('a hostile backup file is cleaned, and changes nothing outside the player', () => {
  const parsed = parseBackup(hostileBackup());
  assert.equal(parsed.ok, true);
  const { profile } = parsed.players[0];
  assert.deepEqual(Object.keys(profile.collected).sort(), Object.keys(THEMES).sort());
  assert.deepEqual(profile.collected.dino, ['d1']);
  assert.deepEqual(Object.keys(profile.highScores), ['10|easy']);
  assert.equal(profile.highScores['10|easy'][0].theme, 'dino');
  assert.deepEqual(Object.keys(profile.learned), ['7×8']);
  assert.equal(profile.lastResult, null);
  assert.ok(isThemeId(profile.setup.theme));
  assert.equal(profile.settings.colors, 'classic');
  // The name is kept as plain text (the game shows names with textContent, never as HTML).
  assert.equal(typeof profile.name, 'string');
  assert.equal({}.polluted, undefined);
  assert.equal(Object.prototype.polluted, undefined);
});

test('a hostile saved record is cleaned the same way', () => {
  const record = JSON.parse('{"schema":1,"id":"p1","name":"Sam","collected":{"__proto__":{"x":1}},"learned":{"__proto__":"2026-10-01T00:00:00.000Z"}}');
  const profile = checkProfile(record);
  assert.equal(Object.getPrototypeOf(profile.collected), Object.prototype);
  assert.deepEqual(profile.learned, {});
  assert.equal({}.x, undefined);
});

test('backup files that are too big or not backups are refused before reading them in', () => {
  assert.equal(MAX_BACKUP_FILE_BYTES, 4 * 1024 * 1024);
  assert.equal(parseBackup('x'.repeat(MAX_BACKUP_FILE_BYTES + 10)).ok, false);
  assert.equal(parseBackup('{"format":"something-else"}').ok, false);
  assert.equal(parseBackup('not json').ok, false);
  assert.equal(parseBackup('').ok, false);
  assert.equal(parseBackup(null).ok, false);
  // The settings screen checks the file's size before reading it.
  assert.match(read('js/screens/settings.js'), /file\.size\s*>\s*MAX_BACKUP_FILE_BYTES/);
});

// ---------------------------------------------------------------- publishing

test('player backups are never published, even if left in the repository', () => {
  for (const name of ['arithmetic-odyssey-backup-2026-10-18.json', 'Sam-BACKUP-1.json']) assert.ok(PRIVATE_FILE.test(name), name);
  for (const name of ['storyline.json', 'manifest.json', 'backup.js']) assert.ok(!PRIVATE_FILE.test(name), name);
});

test('the deploy workflow does not keep the GitHub token in the published checkout', () => {
  const workflow = readFileSync(join(GAME, '..', '.github', 'workflows', 'deploy.yml'), 'utf8');
  assert.match(workflow, /persist-credentials:\s*false/);
});

test('the deploy workflow gives write access only to the publishing job, and pins every action', () => {
  const workflow = readFileSync(join(GAME, '..', '.github', 'workflows', 'deploy.yml'), 'utf8');
  assert.match(workflow, /^permissions: \{\}$/m);
  const [, build, deploy] = workflow.split(/^ {2}(?:build|deploy):$/m);
  assert.doesNotMatch(build, /: write/);
  assert.match(deploy, /pages: write/);
  assert.match(deploy, /id-token: write/);
  assert.doesNotMatch(deploy, /run:/);
  const uses = [...workflow.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1]);
  assert.ok(uses.length >= 5);
  for (const action of uses) assert.match(action, /@[0-9a-f]{40}$/, `${action} is not pinned to a commit`);
});

test('the PowerShell tools are plain ASCII (Windows PowerShell 5.1 reads them correctly)', () => {
  for (const file of readdirSync(join(GAME, 'tools')).filter((f) => f.endsWith('.ps1'))) {
    const bytes = readFileSync(join(GAME, 'tools', file));
    assert.ok(bytes.every((b) => b < 128), `${file} has non-ASCII characters`);
  }
});

test('the local server only answers this computer and hides private files', () => {
  const ps = read('tools/Start-LocalServer.ps1');
  assert.match(ps, /IsLocal/);
  assert.match(ps, /Test-PrivatePath/);
  assert.match(ps, /backup/);
});

test('the picture downloaders only use https, limit size and file type, and protect their spreadsheets', () => {
  for (const file of ['tools/Get-ParkPictures.ps1', 'tools/Get-DinoPictures.ps1']) {
    const ps = read(file);
    assert.match(ps, /Protect-CsvRow/, file);
    assert.match(ps, /'https'/, file);
    // Size and file-type limits (tested with PowerShell against a local server, see GAME-PLAN.md).
    assert.match(ps, /\[int\]\$MaxPictureMB = 20/, file);
    assert.match(ps, /function Test-PictureBytes/, file);
    assert.match(ps, /Get-LimitedPicture -Url \$Url/, file);
    assert.doesNotMatch(ps, /RawContentStream/, file);
  }
});
