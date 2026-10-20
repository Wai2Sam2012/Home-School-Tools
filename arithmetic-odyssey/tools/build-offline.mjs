// Builds the offline app's service worker, sw.js, from tools/sw-template.js
// and two lists (GAME-PLAN.md 1.12, Stage 7).
//
// Saved with the game (so it plays offline from the first visit):
//   - the page, offline.html, manifest.json and the app icons,
//   - the stylesheet and every JavaScript file, at the ?v= address the game
//     asks for (tools/set-version.mjs),
//   - all 80 player pictures and their stand-in drawings,
//   - each theme's storyline.json and sounds, and the pictures of its FIRST
//     sticker (the first one a player collects).
// Saved when needed (the other stickers' pictures): the game asks for a
// sticker's pictures when a player collects it, or when it is a player's next
// stop, if there is internet (js/offline.js). So the saved size grows only as
// stickers are collected.
//
// Each file is listed with its size and a fingerprint (part of its SHA-256),
// so the iPad can check every download, and an update downloads only the
// files that changed. Like storyline.json, sw.js is not stored in git: the
// deploy workflow and the local server build it, so uploaded pictures are
// always in the list.
//
// Usage (from the arithmetic-odyssey folder):
//   node tools/build-offline.mjs
// It also writes each theme's storyline.json first, so the two always match.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { THEMES as STORYLINE_BUILDERS } from './build-storyline.mjs';

export const GAME_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// The page and app files, besides the code, pictures and themes.
export const APP_FILES = Object.freeze(['index.html', 'offline.html', 'manifest.json']);
export const ICON_FOLDER = 'images/icons';

// Saving more than this for offline play may be too much for an older iPad.
// When the pictures pass it, save only the theme being played (GAME-PLAN.md 1.5).
export const OFFLINE_BUDGET_BYTES = 150 * 1024 * 1024;

const CACHE_BUSTED = /\.(js|css)$/; // asked for with ?v=<version>

/** The game's version, from js/version.js. */
export function readVersion(gameDir = GAME_DIR) {
  const match = readFileSync(join(gameDir, 'js', 'version.js'), 'utf8').match(/APP_VERSION = '([^']+)'/);
  if (!match) throw new Error('js/version.js has no APP_VERSION.');
  return match[1];
}

/** A storyline as the game reads it (the same text build-storyline.mjs writes). */
export function storylineText(theme, gameDir = GAME_DIR) {
  const { storyline, report } = STORYLINE_BUILDERS[theme](join(gameDir, 'themes', theme));
  if (report.problems.length) throw new Error(`${theme}: ${report.problems.join('; ')}`);
  return { text: `${JSON.stringify(storyline, null, 2)}\n`, storyline };
}

const toUrlPath = (path) => path.split('/').map(encodeURIComponent).join('/');
const fingerprint = (bytes) => createHash('sha256').update(bytes).digest('hex').slice(0, 16);
const filesIn = (dir) => readdirSync(dir, { recursive: true })
  .map((f) => String(f).split(sep).join('/'))
  .filter((f) => statSync(join(dir, f)).isFile())
  .sort();

/**
 * Every file the game needs, as [{ path, url, size, hash }]. path is relative
 * to the game folder; url is the address the game asks for (relative, encoded,
 * with ?v= on the code). Throws if a needed file is missing.
 */
export function listOfflineFiles(gameDir = GAME_DIR, options = {}) {
  return collectFiles(gameDir, options).files;
}

/** The other stickers' pictures, saved only when needed: [{ path, url, size, hash }]. */
export function listStickerPictures(gameDir = GAME_DIR, options = {}) {
  return collectFiles(gameDir, options).pictures;
}

function collectFiles(gameDir, { version = readVersion(gameDir), storylines = null } = {}) {
  const files = [];
  const pictures = [];
  const entry = (path, bytes) => ({
    path, url: toUrlPath(path) + (CACHE_BUSTED.test(path) ? `?v=${version}` : ''), size: bytes.length, hash: fingerprint(bytes),
  });
  const add = (path, bytes = readFileSync(join(gameDir, path)), list = files) => list.push(entry(path, bytes));

  for (const path of APP_FILES) add(path);
  for (const f of filesIn(join(gameDir, ICON_FOLDER))) if (f.endsWith('.png')) add(`${ICON_FOLDER}/${f}`);
  add('css/style.css');
  for (const f of filesIn(join(gameDir, 'js'))) if (f.endsWith('.js')) add(`js/${f}`);
  for (const f of filesIn(join(gameDir, 'images', 'avatars'))) if (/\.(png|svg)$/.test(f)) add(`images/avatars/${f}`);

  for (const theme of Object.keys(STORYLINE_BUILDERS)) {
    const { text, storyline } = storylines?.[theme] ?? storylineText(theme, gameDir);
    add(`themes/${theme}/storyline.json`, Buffer.from(text));
    const first = new Set(storyline.stickers[0]?.pictures ?? []);
    // Every level's stickers (Intermediate and Advanced sets too, 0.7.3).
    const stickers = [...storyline.stickers, ...Object.values(storyline.levels ?? {}).flat()];
    const used = new Set([...Object.values(storyline.sounds ?? {}).flat(), ...stickers.flatMap((s) => s.pictures ?? [])]);
    for (const p of [...used].sort()) {
      const path = `themes/${theme}/${p}`;
      if (!existsSync(join(gameDir, path))) throw new Error(`${path} is in the story file but missing.`);
      // Sounds and the first sticker's pictures are saved with the game; other pictures when needed.
      const later = !first.has(p) && !Object.values(storyline.sounds ?? {}).flat().includes(p);
      add(path, readFileSync(join(gameDir, path)), later ? pictures : files);
    }
  }
  const seen = new Set();
  for (const f of [...files, ...pictures]) {
    if (seen.has(f.url)) throw new Error(`${f.path} is listed twice.`);
    seen.add(f.url);
  }
  return { files, pictures };
}

/** The version the service worker saves under: the game's version plus a fingerprint of the whole list. */
export function offlineVersion(version, files) {
  return `${version}-${fingerprint(files.map((f) => `${f.url} ${f.hash}`).join('\n'))}`;
}

/** sw.js: the template with the version and both lists filled in. */
export function buildServiceWorker(gameDir = GAME_DIR, options = {}) {
  const version = options.version ?? readVersion(gameDir);
  const collected = options.files && options.pictures ? null : collectFiles(gameDir, { version, storylines: options.storylines });
  const files = options.files ?? collected.files;
  const pictures = options.pictures ?? collected.pictures;
  const template = readFileSync(join(gameDir, 'tools', 'sw-template.js'), 'utf8');
  for (const mark of ['/* VERSION */', '/* FILES */', '/* PICTURES */']) {
    if (!template.includes(mark)) throw new Error(`tools/sw-template.js is missing its ${mark} placeholder.`);
  }
  const list = (items) => `\n${items.map((f) => `  [${JSON.stringify(f.url)}, ${f.size}, ${JSON.stringify(f.hash)}],`).join('\n')}\n`;
  return template
    .replace("'/* VERSION */'", JSON.stringify(offlineVersion(version, files)))
    .replace('/* FILES */', list(files))
    .replace('/* PICTURES */', list(pictures));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const version = readVersion();
    const storylines = {};
    for (const theme of Object.keys(STORYLINE_BUILDERS)) {
      storylines[theme] = storylineText(theme);
      writeFileSync(join(GAME_DIR, 'themes', theme, 'storyline.json'), storylines[theme].text);
    }
    const { files, pictures } = collectFiles(GAME_DIR, { version, storylines });
    const total = files.reduce((n, f) => n + f.size, 0);
    const later = pictures.reduce((n, f) => n + f.size, 0);
    writeFileSync(join(GAME_DIR, 'sw.js'), buildServiceWorker(GAME_DIR, { version, files, pictures }));
    console.log(`Wrote ${relative(process.cwd(), join(GAME_DIR, 'sw.js')) || 'sw.js'}: ${files.length} files saved with the game (${(total / 1e6).toFixed(1)} MB);`
      + ` ${pictures.length} sticker pictures saved when collected (${(later / 1e6).toFixed(1)} MB in all).`);
    if (total + later > OFFLINE_BUDGET_BYTES) {
      console.error(`That is over the ${OFFLINE_BUDGET_BYTES / 1024 / 1024} MB offline budget; save only the theme being played (see GAME-PLAN.md).`);
      process.exit(1);
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
