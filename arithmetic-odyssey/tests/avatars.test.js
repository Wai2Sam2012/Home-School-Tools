// Tests for the five colors of each player picture (planned for Stage 7; the
// files are in place now). Run from the arithmetic-odyssey folder with:  node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AVATARS, AVATAR_COLORS } from '../js/avatars.js';

const FOLDER = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'images/avatars');

/** Width, height and whether a PNG has see-through parts, read from its header. */
function pngInfo(path) {
  const b = readFileSync(path);
  assert.equal(b.toString('latin1', 1, 4), 'PNG', `${path} is not a PNG`);
  const colorType = b[25];
  // RGBA (6), grey with alpha (4), or a palette with a transparency chunk (tRNS)
  const seeThrough = colorType === 6 || colorType === 4 || b.includes(Buffer.from('tRNS'));
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), seeThrough };
}

test('every picture has five colors, all different', () => {
  assert.deepEqual(Object.keys(AVATAR_COLORS).sort(), AVATARS.map((a) => a.id).sort());
  for (const [id, colors] of Object.entries(AVATAR_COLORS)) {
    assert.equal(colors.length, 5, id);
    assert.equal(new Set(colors).size, 5, `${id} has a color twice`);
    for (const c of colors) assert.match(c, /^[a-z]+$/, `${id}/${c}: file names are plain lower-case words`);
  }
});

test('each color is a square 256 x 256 PNG with a see-through background, under 100 KB', () => {
  let total = 0;
  for (const [id, colors] of Object.entries(AVATAR_COLORS)) {
    for (const c of colors) {
      const path = join(FOLDER, id, `${c}.png`);
      assert.ok(existsSync(path), `images/avatars/${id}/${c}.png is missing`);
      const info = pngInfo(path);
      assert.equal(info.width, 256, `${id}/${c} width`);
      assert.equal(info.height, 256, `${id}/${c} height`);
      assert.ok(info.seeThrough, `${id}/${c} needs a see-through background`);
      const size = statSync(path).size;
      assert.ok(size < 100 * 1024, `${id}/${c}.png is ${Math.round(size / 1024)} KB`);
      total += size;
    }
  }
  assert.ok(total < 3 * 1024 * 1024, `all 80 together are ${(total / 1024 / 1024).toFixed(1)} MB; keep them small for offline play`);
});

test('the picture folders hold only the five colors (no left-over uploads)', () => {
  for (const [id, colors] of Object.entries(AVATAR_COLORS)) {
    assert.deepEqual(readdirSync(join(FOLDER, id)).sort(), colors.map((c) => `${c}.png`).sort(), id);
  }
  const loose = readdirSync(FOLDER).filter((f) => !f.endsWith('.svg') && f !== 'README.md' && !(f in AVATAR_COLORS));
  assert.deepEqual(loose, [], 'images/avatars/ has files that are not used');
});
