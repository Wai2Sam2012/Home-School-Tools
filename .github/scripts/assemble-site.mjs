// Builds the folder that GitHub Pages publishes, by copying the repository and
// leaving out files that are only for developers. Nothing is compiled.
//
// Usage (from the repository folder):
//   node .github/scripts/assemble-site.mjs [output folder, default _site]
//
// The same script runs in the deploy workflow and on a PC, so you can see
// exactly what will be published.

import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Folders left out wherever they appear (for example every tool's tests/).
export const EXCLUDED_FOLDERS = new Set(['tests', 'tools', 'downloaded-pictures', 'node_modules', '_site']);

// Files left out wherever they appear.
export const EXCLUDED_FILES = new Set(['package.json', 'package-lock.json']);

// Pages that must be in the published site.
export const REQUIRED_FILES = ['index.html', 'arithmetic-odyssey/index.html'];

// Never published, even by mistake: player backups (children's names), which git also ignores.
export const PRIVATE_FILE = /-backup-.*\.json$/i;

function isExcluded(name, isFolder) {
  if (name.startsWith('.')) return true; // .git, .github, .gitignore, .DS_Store …
  if (!isFolder && PRIVATE_FILE.test(name)) return true;
  return isFolder ? EXCLUDED_FOLDERS.has(name) : EXCLUDED_FILES.has(name);
}

/**
 * Copies repoRoot into outDir (emptied first), skipping excluded files.
 * Returns the published paths, relative to outDir, using "/".
 */
export function assembleSite(repoRoot, outDir) {
  const root = resolve(repoRoot);
  const out = resolve(outDir);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const published = [];

  function copyFolder(folder) {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const source = join(folder, entry.name);
      if (source === out) continue;
      if (entry.isDirectory()) {
        if (!isExcluded(entry.name, true)) copyFolder(source);
      } else if (entry.isFile() && !isExcluded(entry.name, false)) {
        const target = join(out, relative(root, source));
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(source, target);
        published.push(relative(root, source).split('\\').join('/'));
      }
    }
  }

  copyFolder(root);
  return published.sort();
}

/** Returns a list of problems with the published files (empty when all is well). */
export function checkSite(published) {
  const problems = [];
  for (const file of REQUIRED_FILES) {
    if (!published.includes(file)) problems.push(`missing ${file}`);
  }
  for (const file of published) {
    const parts = file.split('/');
    if (parts.some((part, i) => isExcluded(part, i < parts.length - 1))) {
      problems.push(`should not be published: ${file}`);
    }
  }
  return problems;
}

// Run as a script: node .github/scripts/assemble-site.mjs [outDir]
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const outDir = resolve(repoRoot, process.argv[2] ?? '_site');
  const published = assembleSite(repoRoot, outDir);
  const problems = checkSite(published);
  console.log(`Published ${published.length} files to ${outDir}`);
  for (const file of published) console.log(`  ${file}`);
  if (problems.length > 0 || !existsSync(join(outDir, 'index.html'))) {
    console.error('Problems found:');
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
}
