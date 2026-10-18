// The security policy (Content Security Policy) of index.html and
// offline.html: only the game's own files may load, and the few small
// scripts and styles written in the page itself are allowed by their
// fingerprints (SHA-256). Changing one of those means the policy must be set
// again, or the browser blocks it:
//
//   node tools/csp.mjs          (from the arithmetic-odyssey folder)
//
// tests/security.test.js checks the policy matches the page.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const GAME_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const hash = (text) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

/** The fingerprints of the inline <script> and <style> blocks in a page. */
export function inlineHashes(html) {
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => hash(m[1]));
  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => hash(m[1]));
  return { scripts, styles };
}

/** The policy for a page. */
export function policyFor(html) {
  const { scripts, styles } = inlineHashes(html);
  return [
    "default-src 'none'",
    `script-src ${["'self'", ...scripts].join(' ')}`,
    `style-src ${["'self'", ...styles].join(' ')}`,
    "img-src 'self'",
    "media-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

/** The page with its policy filled in. */
export function withPolicy(html) {
  const tag = /<meta http-equiv="Content-Security-Policy" content="[^"]*">/;
  if (!tag.test(html)) throw new Error('The page has no Content-Security-Policy meta tag.');
  return html.replace(tag, `<meta http-equiv="Content-Security-Policy" content="${policyFor(html)}">`);
}

export const PAGES = ['index.html', 'offline.html'];

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const page of PAGES) {
    const path = join(GAME_DIR, page);
    writeFileSync(path, withPolicy(readFileSync(path, 'utf8')));
    console.log(`${page}: security policy set.`);
  }
}
