// Tests for the five colors of each player picture (0.6.4 files, 0.6.5 choosing
// and saving). Run from the arithmetic-odyssey folder with:  node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AVATARS, AVATAR_COLORS, avatarLabel, avatarUrl, checkColor, colorLabel } from '../js/avatars.js';
import { makeBackup, parseBackup, restoreBackup } from '../js/backup.js';
import { createProfileStore } from '../js/profiles.js';
import { checkIndex, checkProfile } from '../js/records.js';
import { KEYS, createStorage, memoryStorage } from '../js/storage.js';

const GAME = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FOLDER = join(GAME, 'images/avatars');

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

// ---------------------------------------------------------------- choosing and saving a color (0.6.5)

test('a color is 1 to 5; anything else is color 1', () => {
  for (const c of [1, 2, 3, 4, 5]) assert.equal(checkColor(c), c);
  for (const bad of [0, 6, -1, 2.5, '2', null, undefined, NaN, Infinity, [3], { color: 3 }]) assert.equal(checkColor(bad), 1, String(bad));
});

test('every picture and color has an address that is a real file, and words for it', () => {
  for (const a of AVATARS) {
    for (let c = 1; c <= 5; c++) {
      const url = avatarUrl(a.id, c);
      assert.ok(existsSync(join(GAME, url)), url);
      assert.match(avatarLabel(a.id, c), new RegExp(`^${a.label.replace('.', '\\.')} \\(.+\\)$`));
    }
  }
  assert.equal(avatarUrl('cat', 99), 'images/avatars/cat/orange.png', 'a bad color shows color 1');
  assert.equal(avatarUrl('not-a-picture', 2), 'images/avatars/longneck/blue.png', 'an unknown picture shows the first');
  assert.equal(colorLabel('cat', 4), 'light brown');
  assert.equal(avatarLabel('dog', 3), 'Dog (brown and white)');
});

const openStore = (backend, n = { i: 0 }) =>
  createProfileStore({ storage: createStorage(backend), makeId: () => `id${++n.i}`, now: () => new Date('2026-10-18T12:00:00Z') });

test('a new player keeps the color they chose, after the game is closed and opened', () => {
  const backend = memoryStorage();
  const counter = { i: 0 };
  const a = openStore(backend, counter);
  const mia = a.add('Mia', 'dog', 4);
  const ben = a.add('Ben', 'cat', 'purple');
  assert.equal(mia.color, 4);
  assert.equal(ben.color, 1, 'a bad color becomes 1');
  assert.equal(JSON.parse(backend.getItem(KEYS.profile(mia.id))).color, 4, 'saved in the player record');
  assert.equal(JSON.parse(backend.getItem(KEYS.index)).profiles[0].color, 4, 'and in the player list');
  const b = openStore(backend, counter);
  assert.equal(b.get(mia.id).color, 4);
  assert.equal(b.get(mia.id).avatar, 'dog');
});

test('a player can change their picture and color; it is saved', () => {
  const backend = memoryStorage();
  const counter = { i: 0 };
  const a = openStore(backend, counter);
  const mia = a.add('Mia', 'dog', 4);
  assert.equal(a.setPicture(mia.id, 'robot', 2), true);
  assert.deepEqual([mia.avatar, mia.color], ['robot', 2]);
  const b = openStore(backend, counter);
  assert.deepEqual([b.get(mia.id).avatar, b.get(mia.id).color], ['robot', 2]);
  a.setPicture(mia.id, 'not-a-picture', 9);
  assert.deepEqual([mia.avatar, mia.color], ['robot', 1], 'an unknown picture keeps the old one; a bad color becomes 1');
  assert.throws(() => a.setPicture('nobody', 'cat', 2), /no longer exists/);
});

test('players saved before 0.6.5 (no color) get color 1; a damaged color reads as 1', () => {
  const old = checkProfile({ schema: 1, id: 'p1', name: 'Sam', avatar: 'trex' });
  assert.equal(old.color, 1);
  assert.equal(checkProfile({ schema: 1, id: 'p1', name: 'Sam', avatar: 'trex', color: 'blue' }).color, 1);
  assert.equal(checkProfile({ schema: 1, id: 'p1', name: 'Sam', avatar: 'trex', color: 3 }).color, 3);
  assert.equal(checkProfile({ schema: 0, id: 'p1', name: 'Sam', avatar: 'trex' }).color, 1, 'the oldest saves too');
  const index = checkIndex({ schema: 1, profiles: [{ id: 'p1', name: 'Sam', avatar: 'trex' }, { id: 'p2', name: 'Ann', avatar: 'cat', color: 5 }] });
  assert.deepEqual(index.profiles.map((p) => p.color), [1, 5]);

  // An old save on the iPad: the player opens with color 1 and can still play and change it.
  const backend = memoryStorage();
  backend.setItem(KEYS.index, JSON.stringify({ schema: 1, profiles: [{ id: 'p1', name: 'Sam', avatar: 'trex' }] }));
  backend.setItem(KEYS.profile('p1'), JSON.stringify({ schema: 1, id: 'p1', name: 'Sam', avatar: 'trex' }));
  const store = openStore(backend);
  assert.equal(store.get('p1').color, 1);
  store.setPicture('p1', 'trex', 3);
  assert.equal(openStore(backend).get('p1').color, 3);
});

test('if the player list is lost, it is rebuilt with each player\'s color', () => {
  const backend = memoryStorage();
  const counter = { i: 0 };
  const a = openStore(backend, counter);
  const mia = a.add('Mia', 'unicorn', 3);
  backend.removeItem(KEYS.index);
  const b = openStore(backend, counter);
  assert.deepEqual([b.get(mia.id).avatar, b.get(mia.id).color], ['unicorn', 3]);
});

test('a backup keeps each player\'s color; an old backup without one restores as color 1', () => {
  const counter = { i: 0 };
  const a = openStore(memoryStorage(), counter);
  a.add('Mia', 'butterfly', 5);
  const text = JSON.stringify(makeBackup(a));
  const parsed = parseBackup(text);
  assert.ok(parsed.ok);
  const other = openStore(memoryStorage(), counter);
  restoreBackup(other, parsed.players, 'replace');
  assert.deepEqual(other.list().map((p) => [p.avatar, p.color]), [['butterfly', 5]]);

  const old = JSON.parse(text);
  for (const p of old.players) delete p.profile.color;
  const fromOld = parseBackup(JSON.stringify(old));
  assert.ok(fromOld.ok, 'a backup from before 0.6.5 still restores');
  const third = openStore(memoryStorage(), counter);
  restoreBackup(third, fromOld.players, 'replace');
  assert.equal(third.list()[0].color, 1);
});
