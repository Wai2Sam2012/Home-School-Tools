// 0.7.3 tests: a sticker set for each level (Intermediate and Advanced are
// their own sets, empty until added), and saves from before still work.
// Run from the arithmetic-odyssey folder with:  node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LEVELS, collectionKey, collectionKeys } from '../js/settings.js';
import { checkStoryline, collectNext, nextSticker, stickerSet } from '../js/storyline.js';
import { picturesToSave } from '../js/offline.js';
import { checkProfile } from '../js/records.js';
import { createProfileStore } from '../js/profiles.js';
import { createStorage, memoryStorage } from '../js/storage.js';
import { buildDinoStoryline, buildLevelSets } from '../tools/build-storyline.mjs';

const sticker = (id, pictures = []) => ({ id, name: id, facts: ['a', 'b'], pictures });
const story = (levels) => ({ schema: 1, theme: 'dino', stickers: [sticker('b1', ['p/b1.jpg']), sticker('b2', ['p/b2.jpg'])], ...(levels ? { levels } : {}) });

test('each theme has a collection for each level; Beginner keeps the old name', () => {
  assert.deepEqual(LEVELS, ['beginner', 'intermediate', 'advanced']);
  assert.equal(collectionKey('dino', 'beginner'), 'dino');
  assert.equal(collectionKey('dino'), 'dino');
  assert.equal(collectionKey('parks', 'advanced'), 'parks.advanced');
  assert.equal(collectionKey('dino', 'expert'), 'dino', 'an unknown level counts as Beginner');
  assert.deepEqual(collectionKeys().sort(), ['dino', 'dino.advanced', 'dino.intermediate', 'parks', 'parks.advanced', 'parks.intermediate']);
});

test('a level\'s set: Beginner is the main list, the others their own (empty until added)', () => {
  const s = story({ intermediate: [sticker('i1')], advanced: [] });
  assert.deepEqual(stickerSet(s, 'beginner').stickers.map((x) => x.id), ['b1', 'b2']);
  assert.deepEqual(stickerSet(s, 'intermediate').stickers.map((x) => x.id), ['i1']);
  assert.deepEqual(stickerSet(s, 'advanced').stickers, []);
  assert.deepEqual(stickerSet(story(), 'advanced').stickers, [], 'a story file without levels');
  assert.equal(nextSticker(stickerSet(s, 'advanced'), []), null, 'an empty set has no next sticker');
  assert.deepEqual(collectNext(stickerSet(s, 'advanced'), [], 5), []);
  assert.deepEqual(collectNext(stickerSet(s, 'intermediate'), [], 5), ['i1']);
});

test('story files with level sets are checked; damaged ones are refused', () => {
  assert.ok(checkStoryline(story({ intermediate: [], advanced: [] }), 'dino'));
  assert.ok(checkStoryline(story(), 'dino'), 'files from before 0.7.3 have no levels');
  assert.throws(() => checkStoryline(story({ intermediate: 'x' }), 'dino'), /level list/);
  assert.throws(() => checkStoryline(story({ intermediate: [{ id: 'x' }] }), 'dino'), /missing its id, name, facts or pictures/);
});

test('a finished trip collects from its own level\'s set only', () => {
  const store = createProfileStore({ storage: createStorage(memoryStorage()) });
  const p = store.add('Sam', 'cat', 1);
  const trip = (difficulty) => ({ theme: 'dino', length: 20, difficulty, operations: ['+'], stats: { answered: 20, correct: 20, detours: 0, setbacks: 0, thinkingMs: 1000, tips: 0, missed: {}, times: {} } });
  store.finishAdventure(p.id, trip('beginner'), { collected: ['b1'], stickerId: 'b1' });
  store.finishAdventure(p.id, trip('intermediate'), { collected: ['i1'], stickerId: 'i1' });
  store.finishAdventure(p.id, trip('advanced'), { collected: [], stickerId: null });
  assert.deepEqual(p.collected.dino, ['b1']);
  assert.deepEqual(p.collected['dino.intermediate'], ['i1']);
  assert.deepEqual(p.collected['dino.advanced'], []);
  assert.equal(p.lastResult.difficulty, 'advanced');
});

test('a save from before 0.7.3 keeps its stickers as Beginner, with empty Intermediate and Advanced', () => {
  const p = checkProfile({ schema: 1, id: 'p1', name: 'Sam', collected: { dino: ['triassic-01-eoraptor'], parks: ['x'], 'dino.expert': ['y'], 'dino.intermediate': 'bad' } });
  assert.deepEqual(p.collected.dino, ['triassic-01-eoraptor']);
  assert.deepEqual(p.collected.parks, ['x']);
  assert.deepEqual(p.collected['dino.intermediate'], []);
  assert.equal(p.collected['dino.expert'], undefined, 'unknown sets are dropped');
});

test('offline: collected and next-stop pictures are saved for every level', () => {
  const s = story({ intermediate: [sticker('i1', ['levels/intermediate/pictures/I1/a.jpg']), sticker('i2', ['levels/intermediate/pictures/I2/a.jpg'])], advanced: [] });
  const urls = picturesToSave({ dino: s }, [{ collected: { dino: ['b1'], 'dino.intermediate': [] } }]);
  assert.ok(urls.some((u) => u.endsWith('p/b1.jpg')) && urls.some((u) => u.endsWith('p/b2.jpg')), 'Beginner: collected and next');
  assert.ok(urls.some((u) => u.includes('levels/intermediate/pictures/I1/')), 'Intermediate: the next stop');
  assert.ok(!urls.some((u) => u.includes('/I2/')), 'not the one after');
});

test('the game\'s own story files have Intermediate and Advanced sets, empty for now', () => {
  const { storyline } = buildDinoStoryline();
  assert.deepEqual(storyline.levels, { intermediate: [], advanced: [] });
  assert.ok(checkStoryline(JSON.parse(JSON.stringify(storyline)), 'dino'));
});

function themeWith(files) {
  const dir = mkdtempSync(join(tmpdir(), 'ao-levels-'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
}

test('building a set: names, facts and pictures; problems are reported', () => {
  const dir = themeWith({
    'levels/intermediate/stickers.json': JSON.stringify([
      { name: 'Spinosaurus', section: 'Cretaceous', facts: ['It had a sail.', 'It ate fish.'], details: ['Found in: Africa'] },
      { name: 'Too Few', facts: ['Only one.'] },
      { name: 'Spinosaurus', facts: ['a', 'b'] },
      { facts: ['a', 'b'] },
    ]),
    'levels/intermediate/pictures/Spinosaurus/one.jpg': 'x',
    'levels/intermediate/pictures/Spinosaurus/notes.txt': 'x',
    'levels/intermediate/pictures/Nobody/one.jpg': 'x',
    'levels/advanced/stickers.json': '{ not json',
    'CREDITS.md': '',
  });
  try {
    const { levels, problems, uncredited } = buildLevelSets(dir);
    assert.deepEqual(levels.intermediate.map((s) => s.id), ['intermediate-spinosaurus', 'intermediate-too-few']);
    const spino = levels.intermediate[0];
    assert.deepEqual([spino.number, spino.section, spino.details, spino.pictures], [1, 'Cretaceous', ['Found in: Africa'], ['levels/intermediate/pictures/Spinosaurus/one.jpg']]);
    assert.deepEqual(levels.advanced, []);
    for (const expected of [/Too Few needs at least 2 facts/, /"Spinosaurus" is in the list twice/, /sticker 4: needs a "name"/, /notes\.txt: not a picture/, /no sticker called "Nobody"/, /advanced\/stickers\.json can't be read/]) {
      assert.ok(problems.some((p) => expected.test(p)), `${expected}: ${problems.join(' | ')}`);
    }
    assert.deepEqual(uncredited, ['levels/intermediate/pictures/Spinosaurus/one.jpg']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a theme with no levels folder simply has empty sets', () => {
  const dir = themeWith({ 'CREDITS.md': '' });
  try {
    assert.deepEqual(buildLevelSets(dir), { levels: { intermediate: [], advanced: [] }, problems: [], uncredited: [] });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
