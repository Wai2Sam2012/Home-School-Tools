// Tests for 0.6.1: Learn from Incorrect, and recorded flag sounds.
// Run from the arithmetic-odyssey folder with:  node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LEARN_MAX_PROBLEMS, LEARN_NEEDS, LEARN_SPACING, answerLearning, currentProblem, problemFromKey, startLearning } from '../js/learn.js';
import { createProfileStore } from '../js/profiles.js';
import { checkProfile } from '../js/records.js';
import { SLOW_MS, needMorePractice } from '../js/scores.js';
import { KEYS, createStorage, memoryStorage } from '../js/storage.js';
import { makeBackup, parseBackup } from '../js/backup.js';
import { GAME_DIR, buildDinoStoryline, buildParksStoryline, findSounds, isCredited, parseCredits } from '../tools/build-storyline.mjs';
import { pickDifferent } from '../js/audio.js';

const missed = (key, n = 1) => ({ key, missed: n, slowMs: 0 });
const slow = (key, ms = 8000) => ({ key, missed: 0, slowMs: ms });
const right = (state, ms = 1000) => answerLearning(state, String(currentProblem(state).answer), { thinkingMs: ms });
const wrong = (state) => answerLearning(state, String(currentProblem(state).answer + 1), { thinkingMs: 1000 });

// ---------------------------------------------------------------- the round

test('problems come back from their keys; anything else is ignored', () => {
  assert.equal(problemFromKey('7×8').answer, 56);
  assert.equal(problemFromKey('144÷12').text, '144 ÷ 12');
  assert.equal(problemFromKey('12−5').speech, '12 minus 5');
  for (const bad of ['7x8', '7÷0', '3−9', '', null, '1+1+1']) assert.equal(problemFromKey(bad), null, String(bad));
});

test('a round takes the practice list (up to 8 problems), in order', () => {
  const list = ['7×8', '6×6', '9+6', '12−5', '3×4', '8+8', '9×9', '5+7', '4×6', '2+9'].map((k) => missed(k));
  const state = startLearning([missed('bad'), ...list, missed('7×8')]);
  assert.equal(state.items.length, LEARN_MAX_PROBLEMS);
  assert.deepEqual(state.queue, list.slice(0, LEARN_MAX_PROBLEMS).map((p) => p.key), 'bad and repeated keys are skipped');
  assert.equal(currentProblem(state).text, '7 × 8');
  assert.equal(startLearning([]), null, 'nothing to practise');
  assert.equal(startLearning([missed('nope')]), null);
});

test(`a problem is learned after ${LEARN_NEEDS} right answers, then leaves the round`, () => {
  let s = startLearning([missed('7×8'), missed('6×6'), missed('9+6')]);
  let r = right(s);
  assert.deepEqual(r.events, [{ type: 'right' }]);
  s = r.state;
  assert.equal(s.items[0].right, 1);
  assert.deepEqual(s.queue, ['6×6', '9+6', '7×8'].slice(0, 2).concat('7×8'), `it comes back after ${LEARN_SPACING} others`);
  s = right(s).state; // 6×6
  s = right(s).state; // 9+6
  r = right(s); // 7×8 again
  assert.deepEqual(r.events, [{ type: 'right' }, { type: 'learned', key: '7×8', text: '7 × 8' }]);
  assert.ok(!r.state.queue.includes('7×8'));
  assert.ok(r.state.items[0].learned);
});

test('a wrong answer starts that problem\'s count again and brings it back soon', () => {
  let s = startLearning([missed('7×8'), missed('6×6'), missed('9+6'), missed('3×4')]);
  s = right(s).state; // 7×8: 1
  s = right(s).state; // 6×6
  s = right(s).state; // 9+6
  const r = wrong(s); // 7×8 wrong
  assert.deepEqual(r.events, [{ type: 'wrong', answer: 56 }]);
  assert.equal(r.state.items[0].right, 0, 'the count starts again');
  assert.equal(r.state.items[0].wrong, 1);
  assert.equal(r.state.queue.indexOf('7×8'), LEARN_SPACING, 'back after 2 others');
});

test('a slow problem has to be answered quickly to count', () => {
  let s = startLearning([slow('7×8')]);
  let r = right(s, SLOW_MS + 500);
  assert.deepEqual(r.events, [{ type: 'right', tooSlow: true }]);
  assert.equal(r.state.items[0].right, 0);
  s = r.state;
  s = right(s, 2000).state;
  r = right(s, 2000);
  assert.ok(r.events.some((e) => e.type === 'learned'));
  // A missed problem counts however long it takes.
  const m = right(startLearning([missed('6×6')]), SLOW_MS + 5000);
  assert.equal(m.state.items[0].right, 1);
});

test('the round ends when all are learned', () => {
  let s = startLearning([missed('7×8'), missed('6×6')]);
  const events = [];
  while (!s.done) {
    const r = right(s);
    events.push(...r.events);
    s = r.state;
  }
  assert.equal(s.asked, 4);
  assert.deepEqual(events.at(-1), { type: 'finished', learned: ['7×8', '6×6'], total: 2 });
  assert.equal(currentProblem(s), null);
  assert.throws(() => answerLearning(s, '56'), /over/);
});

test('the round never goes on and on: it stops after 4 questions per problem', () => {
  let s = startLearning([missed('7×8'), missed('6×6')]);
  let last;
  while (!s.done) {
    last = wrong(s);
    s = last.state;
  }
  assert.equal(s.asked, 8);
  assert.deepEqual(last.events.at(-1), { type: 'finished', learned: [], total: 2 });
});

test('an empty or bad answer changes nothing', () => {
  const s = startLearning([missed('7×8')]);
  for (const input of ['', 'abc']) {
    const r = answerLearning(s, input);
    assert.equal(r.check.ok, false);
    assert.equal(r.state, s);
    assert.deepEqual(r.events, []);
  }
});

// ---------------------------------------------------------------- learned problems

test('a learned problem leaves Need More Practice until a later game misses it again', () => {
  const games = [
    { at: '2026-10-01T00:00:00.000Z', missed: { '7×8': 2, '6×6': 1 }, slow: { '9×9': 9000 } },
    { at: '2026-10-02T00:00:00.000Z', missed: { '7×8': 1 }, slow: {} },
  ];
  const learned = { '7×8': '2026-10-03T00:00:00.000Z', '9×9': '2026-10-03T00:00:00.000Z' };
  assert.deepEqual(needMorePractice(games, 10, learned).map((p) => p.key), ['6×6']);
  const later = [...games, { at: '2026-10-04T00:00:00.000Z', missed: { '7×8': 1 }, slow: {} }];
  const list = needMorePractice(later, 10, learned);
  assert.deepEqual(list.map((p) => p.key), ['6×6', '7×8']);
  assert.equal(list.find((p) => p.key === '7×8').missed, 1, 'only the miss after it was learned counts');
});

test('learned problems are saved, kept in backups, and cleaned up when read back', () => {
  const backend = memoryStorage();
  let n = 0;
  const open = () => createProfileStore({ storage: createStorage(backend), makeId: () => `id${++n}`, now: () => new Date('2026-10-17T12:00:00Z') });
  const a = open();
  const sam = a.add('Sam', 'trex');
  assert.deepEqual(sam.learned, {});
  a.markLearned(sam.id, ['7×8', '6×6']);
  const b = open();
  assert.deepEqual(b.get(sam.id).learned, { '7×8': '2026-10-17T12:00:00.000Z', '6×6': '2026-10-17T12:00:00.000Z' });
  assert.ok(JSON.parse(backend.getItem(KEYS.profile(sam.id))).learned['7×8']);
  const backup = parseBackup(JSON.stringify(makeBackup(b)));
  assert.ok(backup.ok);
  assert.deepEqual(Object.keys(backup.players[0].profile.learned), ['7×8', '6×6']);
  const cleaned = checkProfile({ schema: 1, id: 'x', learned: { '7×8': 'not a date', 'hello': '2026-10-17T12:00:00Z', '1+1': '2026-10-17T12:00:00Z' } });
  assert.deepEqual(cleaned.learned, { '1+1': '2026-10-17T12:00:00Z' });
  assert.deepEqual(checkProfile({ schema: 1, id: 'y' }).learned, {}, 'players saved before 0.6.1 have none');
});

// ---------------------------------------------------------------- recorded flag sounds

test('a theme\'s recorded flag sound is found in its sounds folder', () => {
  const theme = mkdtempSync(join(tmpdir(), 'ao-sounds-'));
  try {
    assert.deepEqual(findSounds(theme), {}, 'no sounds folder: the game makes its own');
    mkdirSync(join(theme, 'sounds'));
    writeFileSync(join(theme, 'sounds', 'README.md'), 'x');
    writeFileSync(join(theme, 'sounds', 'roar.ogg'), 'x');
    assert.deepEqual(findSounds(theme), {}, 'only flag sounds in .mp3, .m4a or .wav count');
    writeFileSync(join(theme, 'sounds', 'Flag.MP3'), 'x');
    assert.deepEqual(findSounds(theme), { flag: ['sounds/Flag.MP3'] });
    for (const f of ['flag-10.mp3', 'flag-2.wav', 'flag_3.m4a', 'flagpole.mp3', 'flag-4.ogg']) writeFileSync(join(theme, 'sounds', f), 'x');
    assert.deepEqual(findSounds(theme).flag, ['sounds/Flag.MP3', 'sounds/flag_3.m4a', 'sounds/flag-2.wav', 'sounds/flag-10.mp3'].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })),
      'every flag sound, in number order');
  } finally {
    rmSync(theme, { recursive: true, force: true });
  }
  const credits = parseCredits('| `sounds/flag.mp3` | T. rex roar | someone | CC0 |\n| sounds/** | all | x | y |');
  assert.deepEqual(credits, ['sounds/flag.mp3', 'sounds/**']);
  assert.ok(isCredited('sounds/flag.mp3', credits));
});

test('the recorded flag sounds in the game are small and credited', () => {
  for (const [dir, build] of [['dino', buildDinoStoryline], ['national-parks', buildParksStoryline]]) {
    const themeDir = join(GAME_DIR, 'themes', dir);
    const { storyline, report } = build(themeDir);
    assert.ok(storyline.sounds && typeof storyline.sounds === 'object', dir);
    for (const path of Object.values(storyline.sounds).flat()) {
      assert.ok(statSync(join(themeDir, path)).size <= 600 * 1024, `${dir}/${path} is over 600 KB`);
      assert.ok(!report.uncredited.includes(path), `${dir}/${path} needs a line in CREDITS.md`);
    }
  }
});

test('the dinosaur and truck themes each have their recorded flag sounds', () => {
  assert.deepEqual(buildDinoStoryline(join(GAME_DIR, 'themes', 'dino')).storyline.sounds.flag, ['sounds/flag-1.mp3', 'sounds/flag-2.mp3', 'sounds/flag-3.mp3']);
  assert.deepEqual(buildParksStoryline(join(GAME_DIR, 'themes', 'national-parks')).storyline.sounds.flag, ['sounds/flag-1.mp3', 'sounds/flag-2.mp3', 'sounds/flag-3.mp3', 'sounds/flag-4.mp3']);
});

test('a flag sound is picked at random, never the same one twice in a row', () => {
  assert.equal(pickDifferent(0), -1, 'none: the game makes its own sound');
  assert.equal(pickDifferent(1, 0), 0, 'only one: always that one');
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const counts = [0, 0, 0];
  let last = -1;
  for (let i = 0; i < 3000; i++) {
    const pick = pickDifferent(3, last, random);
    assert.notEqual(pick, last);
    counts[pick] += 1;
    last = pick;
  }
  for (const n of counts) assert.ok(n > 800, `each sound is picked about as often (${counts})`);
  const first = new Set(Array.from({ length: 200 }, () => pickDifferent(3, -1, random)));
  assert.equal(first.size, 3, 'any of them can come first');
});

