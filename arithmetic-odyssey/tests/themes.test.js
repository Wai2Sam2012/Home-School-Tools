// Tests for the color themes (css/style.css, [data-colors]): each theme sets
// every color, and text stays readable (WCAG contrast) in all of them.
// Run from the arithmetic-odyssey folder with:  node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COLOR_THEMES, COLOR_THEME_LABELS, DEFAULT_SETTINGS } from '../js/settings.js';

const css = readFileSync(join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'css', 'style.css'), 'utf8');

/** The --name: value colors set in a rule. */
function colorsIn(selector) {
  const start = css.indexOf(selector);
  assert.ok(start >= 0, `${selector} is missing`);
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6}|rgba\([^)]*\))/g)].map((m) => [m[1], m[2]]));
}

const classic = colorsIn(':root {');
const themes = { classic };
for (const t of COLOR_THEMES.filter((c) => c !== 'classic')) themes[t] = { ...classic, ...colorsIn(`:root[data-colors="${t}"]`) };

test('the five color themes asked for, in order, with Classic (the usual colors) as the default', () => {
  assert.deepEqual(COLOR_THEMES, ['contrast', 'soft', 'classic', 'warm', 'dark']);
  assert.deepEqual(Object.values(COLOR_THEME_LABELS), ['High contrast', 'Soft', 'Classic', 'Warm', 'Dark']);
  assert.equal(DEFAULT_SETTINGS.colors, 'classic');
});

test('each theme sets every color (so no screen mixes two themes)', () => {
  for (const t of COLOR_THEMES.filter((c) => c !== 'classic')) {
    const own = colorsIn(`:root[data-colors="${t}"]`);
    const missing = Object.keys(classic).filter((name) => !(name in own));
    assert.deepEqual(missing, [], `${t} is missing colors`);
  }
});

test('the styles use the theme colors, not fixed ones (apart from the debug panel and the color samples)', () => {
  const rules = css.slice(css.indexOf('* {'), css.indexOf('/* ------------------------------------------------------------ color themes'));
  const fixed = [];
  let selector = '';
  for (const line of rules.split('\n')) {
    if (line.includes('{')) selector = line.trim();
    if (/debug|toast/.test(selector)) continue;
    if (/#[0-9a-fA-F]{3,6}\b/.test(line)) fixed.push(`${selector} ${line.trim()}`);
  }
  assert.deepEqual(fixed, []);
});

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

test('text is easy to read in every theme (WCAG contrast)', () => {
  // [text, background, minimum]: 4.5 for normal text, 3 for large text and big buttons.
  const pairs = [
    ['text', 'bg', 4.5], ['text', 'surface', 4.5], ['muted', 'surface', 4.5], ['text', 'surface-2', 4.5],
    ['accent', 'bg', 3], ['on-accent', 'accent', 3], ['on-accent', 'error', 3],
    ['error', 'surface', 4.5], ['error', 'bg', 4.5], ['ok', 'ok-soft', 4.5], ['ok', 'surface', 4.5],
    ['typed', 'surface', 3], ['detour-text', 'surface', 4.5],
    ['text', 'milestone', 4.5], ['text', 'setback-soft', 4.5], ['text', 'accent-soft', 4.5],
    ['text', 'tip-cell', 4.5], ['text', 'tip-cell-alt', 4.5], ['toast-text', 'toast-bg', 4.5],
  ];
  for (const [t, colors] of Object.entries(themes)) {
    for (const [fg, bg, min] of pairs) {
      const c = contrast(colors[fg], colors[bg]);
      assert.ok(c >= min, `${t}: ${fg} on ${bg} is ${c.toFixed(2)}, needs ${min}`);
    }
  }
  // High contrast really is the highest.
  assert.ok(contrast(themes.contrast.text, themes.contrast.bg) >= 20);
});
