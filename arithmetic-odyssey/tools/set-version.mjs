// Sets the game's version everywhere it appears:
//   - APP_VERSION in js/version.js,
//   - the ?v= tag on the page's own CSS and JavaScript links in index.html,
//   - the ?v= tag on every import between the game's JavaScript files.
//
// Usage (from the arithmetic-odyssey folder):
//   node tools/set-version.mjs 0.4.0
//
// Why: GitHub Pages lets browsers keep files for 10 minutes. Without a new
// address for each version, Safari can mix a new page with old cached code
// and the game fails to start. tests/stage0.test.js checks every tag matches.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Adds or replaces ?v= on relative imports: from './math.js' -> from './math.js?v=1.2.3' */
export function tagImports(source, version) {
  return source.replace(/(\bfrom\s+'|\bimport\s+')(\.{1,2}\/[^'?]+\.js)(\?v=[^']*)?'/g, `$1$2?v=${version}'`);
}

/** Adds or replaces ?v= on the page's local css/ and js/ links. */
export function tagPage(html, version) {
  return html.replace(/((?:src|href)=")((?:css|js)\/[^"?]+\.(?:css|js))(\?v=[^"]*)?"/g, `$1$2?v=${version}"`);
}

export function setVersion(version, gameDir = GAME_DIR) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`"${version}" is not a version like 1.2.3`);
  const versionFile = join(gameDir, 'js', 'version.js');
  writeFileSync(versionFile, readFileSync(versionFile, 'utf8').replace(/APP_VERSION = '[^']*'/, `APP_VERSION = '${version}'`));
  const page = join(gameDir, 'index.html');
  writeFileSync(page, tagPage(readFileSync(page, 'utf8'), version));
  const files = readdirSync(join(gameDir, 'js'), { recursive: true }).filter((f) => f.endsWith('.js'));
  for (const file of files) {
    const path = join(gameDir, 'js', file);
    writeFileSync(path, tagImports(readFileSync(path, 'utf8'), version));
  }
  return files.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const version = process.argv[2];
  try {
    const count = setVersion(version);
    console.log(`Version ${version} set in js/version.js, index.html and ${count} JavaScript files.`);
  } catch (error) {
    console.error(error.message);
    console.error('Usage: node tools/set-version.mjs 1.2.3');
    process.exit(1);
  }
}
