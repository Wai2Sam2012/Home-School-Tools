// Stage 0 tests: project structure, pages, debug panel helpers and publishing.
// Run from the arithmetic-odyssey folder with:  node --test
// Test IDs (T0.x) match the test plan in GAME-PLAN.md.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { APP_VERSION, BUILD_STAGE } from '../js/version.js';
import { STORAGE_PREFIX, isDebugOn, listGameKeys, clearGameKeys } from '../js/debug.js';
import { assembleSite, checkSite } from '../../.github/scripts/assemble-site.mjs';

const GAME = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(GAME, '..');
const read = (path) => readFileSync(path, 'utf8');

// ---------------------------------------------------------------- T0.2
test('T0.2 the test runner finds and runs the tests', () => {
  assert.ok(true);
});

// ---------------------------------------------------------------- structure
test('the folder structure from the Game Plan (1.4) is in place', () => {
  const required = [
    'index.html',
    'css/style.css',
    'js/app.js',
    'js/debug.js',
    'js/math.js',
    'js/version.js',
    'GAME-PLAN.md',
    'README.md',
    'tools/Start-LocalServer.ps1',
    'tools/Get-DinoPictures.ps1',
    'themes/dino/triassic.md',
    'themes/dino/jurassic.md',
    'themes/dino/cretaceous.md',
    'themes/dino/CREDITS.md',
    'themes/dino/pictures',
    'themes/national-parks/README.md',
    'themes/national-parks/CREDITS.md',
    'themes/national-parks/pictures',
  ];
  for (const path of required) assert.ok(existsSync(join(GAME, path)), `missing arithmetic-odyssey/${path}`);
  for (const path of ['index.html', '.github/workflows/deploy.yml', '.github/scripts/assemble-site.mjs']) {
    assert.ok(existsSync(join(REPO, path)), `missing ${path} at the top of the repository`);
  }
  const regions = readdirSync(join(GAME, 'themes/national-parks')).filter((f) => f.endsWith('.md') && f !== 'README.md' && f !== 'CREDITS.md');
  assert.equal(regions.length, 7, 'the 7 national park region files');
});

test('the version is a normal version number and the build stage is a number', () => {
  assert.match(APP_VERSION, /^\d+\.\d+\.\d+$/);
  assert.ok(Number.isInteger(BUILD_STAGE) && BUILD_STAGE >= 0 && BUILD_STAGE <= 8);
});

// ---------------------------------------------------------------- pages
function localLinks(htmlPath) {
  const html = read(htmlPath);
  return [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
}

test('both pages only use relative links that point at real files', () => {
  for (const page of [join(REPO, 'index.html'), join(GAME, 'index.html')]) {
    const links = localLinks(page);
    assert.ok(links.length > 0, `${page} has no links`);
    for (const link of links) {
      assert.ok(!link.startsWith('/'), `${link} in ${page} must be relative, not start with /`);
      assert.ok(!/^[a-z]+:/i.test(link), `${link} in ${page} must not load anything from the internet`);
      const target = resolve(dirname(page), link.endsWith('/') ? `${link}index.html` : link);
      assert.ok(existsSync(target), `${link} in ${page} points at a missing file`);
    }
  }
});

test('the start page links to the game', () => {
  assert.ok(localLinks(join(REPO, 'index.html')).includes('arithmetic-odyssey/'));
});

test('the game page sets up the iPad viewport and loads the scripts as a module', () => {
  const html = read(join(GAME, 'index.html'));
  assert.match(html, /<meta name="viewport" content="[^"]*viewport-fit=cover/);
  assert.match(html, /<script type="module" src="js\/app.js">/);
  assert.match(html, /<html lang="en">/);
});

test('every JavaScript import points at a real file', () => {
  for (const file of readdirSync(join(GAME, 'js'))) {
    const source = read(join(GAME, 'js', file));
    for (const [, path] of source.matchAll(/from\s+'(\.[^']+)'/g)) {
      assert.ok(existsSync(join(GAME, 'js', path)), `js/${file} imports missing ${path}`);
    }
  }
});

// ---------------------------------------------------------------- debug panel
test('the debug panel opens only with debug=1 in the address', () => {
  assert.equal(isDebugOn('?debug=1'), true);
  assert.equal(isDebugOn('?theme=dino&debug=1'), true);
  assert.equal(isDebugOn(''), false);
  assert.equal(isDebugOn('?debug=0'), false);
  assert.equal(isDebugOn('?debug=true'), false);
  assert.equal(isDebugOn('?nodebug=1'), false);
});

function fakeStorage(entries) {
  const map = new Map(Object.entries(entries));
  return {
    get length() { return map.size; },
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (key) => map.delete(key),
    keys: () => [...map.keys()].sort(),
  };
}

test("the debug panel only touches this game's saved data (keys starting ao.)", () => {
  assert.equal(STORAGE_PREFIX, 'ao.');
  const storage = fakeStorage({
    'ao.v1.index': '{}',
    'ao.v1.profile.p1': '{}',
    'other-tool.settings': '{}',
    'aov1.not-ours': '{}',
  });
  assert.deepEqual(listGameKeys(storage).sort(), ['ao.v1.index', 'ao.v1.profile.p1']);
  assert.equal(clearGameKeys(storage), 2);
  assert.deepEqual(storage.keys(), ['aov1.not-ours', 'other-tool.settings']);
});

// ---------------------------------------------------------------- T0.3 (publishing)
test('T0.3 the published site has the pages but not tests, tools or downloads (real repository)', () => {
  const out = mkdtempSync(join(tmpdir(), 'ao-site-'));
  try {
    const published = assembleSite(REPO, out);
    assert.deepEqual(checkSite(published), []);
    for (const file of ['index.html', 'arithmetic-odyssey/index.html', 'arithmetic-odyssey/js/app.js', 'arithmetic-odyssey/js/math.js', 'arithmetic-odyssey/css/style.css']) {
      assert.ok(published.includes(file), `${file} should be published`);
    }
    for (const file of published) {
      assert.doesNotMatch(file, /(^|\/)(tests|tools|downloaded-pictures|\.github|\.git)\//, `${file} should not be published`);
      assert.doesNotMatch(file, /(^|\/)package\.json$/, `${file} should not be published`);
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('T0.3 the copy step leaves out excluded folders and files wherever they are (test repository)', () => {
  const repo = mkdtempSync(join(tmpdir(), 'ao-repo-'));
  const out = join(repo, '_site');
  const files = {
    'index.html': 'start',
    'tool/index.html': 'game',
    'tool/js/app.js': 'app',
    'tool/tests/a.test.js': 'test',
    'tool/tools/script.ps1': 'tool',
    'tool/themes/dino/downloaded-pictures/x.jpg': 'raw',
    'tool/themes/dino/pictures/rex.jpg': 'chosen',
    'tool/themes/dino/pictures/.gitkeep': '',
    'tool/package.json': '{}',
    '.github/workflows/deploy.yml': 'workflow',
    '.gitignore': 'x',
    'node_modules/pkg/index.js': 'x',
  };
  try {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(repo, path)), { recursive: true });
      writeFileSync(join(repo, path), text);
    }
    mkdirSync(join(repo, 'arithmetic-odyssey'), { recursive: true });
    writeFileSync(join(repo, 'arithmetic-odyssey/index.html'), 'game');
    const published = assembleSite(repo, out);
    assert.deepEqual(published, ['arithmetic-odyssey/index.html', 'index.html', 'tool/index.html', 'tool/js/app.js', 'tool/themes/dino/pictures/rex.jpg']);
    assert.deepEqual(checkSite(published), []);
    assert.equal(read(join(out, 'tool/themes/dino/pictures/rex.jpg')), 'chosen');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('T0.3 the site check catches a missing start page or an excluded file', () => {
  assert.deepEqual(checkSite(['arithmetic-odyssey/index.html']), ['missing index.html']);
  assert.deepEqual(checkSite(['index.html', 'arithmetic-odyssey/index.html', 'arithmetic-odyssey/tests/x.js']), ['should not be published: arithmetic-odyssey/tests/x.js']);
});

test('T0.3 the deploy workflow runs on main, runs the tests, builds the site and deploys it', () => {
  const workflow = read(join(REPO, '.github/workflows/deploy.yml'));
  assert.match(workflow, /on:\s*\n\s*push:\s*\n\s*branches: \[main\]/);
  assert.match(workflow, /pages: write/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /node --test/);
  assert.match(workflow, /node \.github\/scripts\/assemble-site\.mjs _site/);
  assert.match(workflow, /actions\/upload-pages-artifact@v\d+[\s\S]*path: _site/);
  assert.match(workflow, /actions\/deploy-pages@v\d+/);
});

// ---------------------------------------------------------------- Windows files
test('PowerShell scripts contain only plain ASCII (Windows PowerShell 5.1 misreads other characters)', () => {
  for (const file of readdirSync(join(GAME, 'tools')).filter((f) => f.endsWith('.ps1'))) {
    const bytes = readFileSync(join(GAME, 'tools', file));
    const bad = bytes.findIndex((b) => b > 127);
    assert.equal(bad, -1, `tools/${file} has a non-ASCII character at byte ${bad}`);
  }
});

test('batch files keep Windows line endings', () => {
  for (const file of readdirSync(join(GAME, 'tools')).filter((f) => f.endsWith('.cmd'))) {
    const text = read(join(GAME, 'tools', file));
    assert.ok(!/[^\r]\n/.test(text), `tools/${file} has a line ending without CR`);
  }
});
