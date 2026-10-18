// Tests for 0.6.1: Learn from Incorrect, and recorded flag sounds.
// Run from the arithmetic-odyssey folder with:  node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LEARN_MAX_PROBLEMS, LEARN_NEEDS, TRIES_PER_PROBLEM, answerLearning, currentProblem, problemFromKey, startLearning } from '../js/learn.js';
import { createProfileStore } from '../js/profiles.js';
import { checkProfile } from '../js/records.js';
import { PRACTICE_SIZE, SLOW_MS, needMorePractice, toPractise } from '../js/scores.js';
import { KEYS, createStorage, memoryStorage } from '../js/storage.js';
import { makeBackup, parseBackup } from '../js/backup.js';
import { GAME_DIR, buildDinoStoryline, buildParksStoryline, findSounds, isCredited, parseCredits } from '../tools/build-storyline.mjs';
import { pickDifferent } from '../js/audio.js';

const missed = (key, n = 1) => ({ key, missed: n, slowMs: 0 });
const slow = (key, ms = 8000) => ({ key, missed: 0, slowMs: ms });
const right = (state, ms = 1000) => answerLearning(state, String(currentProblem(state).answer), { thinkingMs: ms });
const wrong = (state) => answerLearning(state, String(currentProblem(state).answer + 1), { thinkingMs: 1000 });
const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// ---------------------------------------------------------------- the round

test('problems come back from their keys; anything else is ignored', () => {
  assert.equal(problemFromKey('7×8').answer, 56);
  assert.equal(problemFromKey('144÷12').text, '144 ÷ 12');
  assert.equal(problemFromKey('12−5').speech, '12 minus 5');
  for (const bad of ['7x8', '7÷0', '3−9', '', null, '1+1+1']) assert.equal(problemFromKey(bad), null, String(bad));
});

test('a round has every problem from the list at once (up to 20), in random order', () => {
  const keys = ['7×8', '6×6', '9+6', '12−5', '3×4', '8+8', '9×9', '5+7', '4×6', '2+9'];
  const state = startLearning([missed('bad'), ...keys.map((k) => missed(k)), missed('7×8')]);
  assert.equal(state.items.length, keys.length, 'all of them, not a first few');
  assert.deepEqual(state.items.map((i) => i.key), keys, 'bad and repeated keys are skipped');
  assert.equal(LEARN_MAX_PROBLEMS, PRACTICE_SIZE);
  assert.equal(startLearning(Array.from({ length: 30 }, (_, i) => missed(`${i + 1}+1`))).items.length, 20);
  assert.equal(startLearning([]), null, 'nothing to practise');
  assert.equal(startLearning([missed('nope')]), null);
  // Over many rounds, any problem can come first.
  const firsts = new Set(Array.from({ length: 200 }, () => currentProblem(startLearning(keys.map((k) => missed(k)))).text));
  assert.equal(firsts.size, keys.length);
});

test('the next problem is picked at random, never the same one twice in a row', () => {
  let s = startLearning(['7×8', '6×6', '9+6', '12−5'].map((k) => missed(k)), { random: seeded(3) });
  const asked = [];
  const left = []; // problems still to learn when each was asked
  const random = seeded(5);
  while (!s.done) {
    asked.push(currentProblem(s).text);
    left.push(s.items.filter((i) => !i.learned).length);
    s = answerLearning(s, String(currentProblem(s).answer), { thinkingMs: 1000, random }).state;
  }
  for (let i = 1; i < asked.length; i++) {
    if (left[i] > 1) assert.notEqual(asked[i], asked[i - 1], `asked twice in a row with others left: ${asked.join(', ')}`);
  }
  assert.equal(asked.length, 4 * LEARN_NEEDS, 'all right: each one exactly 3 times');
  assert.ok(new Set(asked.slice(0, 4)).size >= 3, `mixed, not one problem after another: ${asked.join(', ')}`);
});

test(`a problem is learned after ${LEARN_NEEDS} right answers, then leaves the round`, () => {
  assert.equal(LEARN_NEEDS, 3);
  let s = startLearning([missed('7×8'), missed('6×6')], { random: () => 0 });
  const events = [];
  for (let i = 0; i < 2 * LEARN_NEEDS - 1; i++) {
    const r = right(s);
    events.push(...r.events);
    s = r.state;
  }
  const learned = events.filter((e) => e.type === 'learned');
  assert.equal(learned.length, 1, 'one is learned after 3 right answers each way round');
  assert.equal(s.items.find((i) => i.key === learned[0].key).right, LEARN_NEEDS);
  assert.notEqual(currentProblem(s).text, learned[0].text, 'a learned problem is not asked again');
});

test('a wrong answer starts that problem\'s count again', () => {
  let s = startLearning([missed('7×8'), missed('6×6')], { random: () => 0 });
  const key = s.current;
  s = right(s).state; // key: 1
  s = right(s).state; // the other one
  assert.equal(s.current, key, 'with two problems they take turns');
  const r = wrong(s);
  assert.deepEqual(r.events, [{ type: 'wrong', answer: s.items.find((i) => i.key === key).problem.answer }]);
  const item = r.state.items.find((i) => i.key === key);
  assert.deepEqual([item.right, item.wrong], [0, 1]);
});

test('a slow problem has to be answered quickly to count', () => {
  let s = startLearning([slow('7×8')]);
  let r = right(s, SLOW_MS + 500);
  assert.deepEqual(r.events, [{ type: 'right', tooSlow: true }]);
  assert.equal(r.state.items[0].right, 0);
  s = r.state;
  for (let i = 0; i < LEARN_NEEDS - 1; i++) s = right(s, 2000).state;
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
  assert.equal(s.asked, 2 * LEARN_NEEDS);
  assert.equal(events.at(-1).type, 'finished');
  assert.deepEqual([...events.at(-1).learned].sort(), ['6×6', '7×8']);
  assert.equal(events.at(-1).total, 2);
  assert.equal(currentProblem(s), null);
  assert.throws(() => answerLearning(s, '56'), /over/);
});

test(`the round never goes on and on: it stops after ${TRIES_PER_PROBLEM} questions per problem`, () => {
  let s = startLearning([missed('7×8'), missed('6×6')]);
  let last;
  while (!s.done) {
    last = wrong(s);
    s = last.state;
  }
  assert.equal(s.asked, 2 * TRIES_PER_PROBLEM);
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

test('a learned problem stays in Need More Practice (marked learned) until a later game misses it again', () => {
  const games = [
    { at: '2026-10-01T00:00:00.000Z', missed: { '7×8': 2, '6×6': 1 }, slow: { '9×9': 9000 } },
    { at: '2026-10-02T00:00:00.000Z', missed: { '7×8': 1 }, slow: {} },
  ];
  const learned = { '7×8': '2026-10-03T00:00:00.000Z', '9×9': '2026-10-03T00:00:00.000Z' };
  const list = needMorePractice(games, 20, learned);
  assert.deepEqual(list.map((p) => [p.key, p.learned]), [['7×8', true], ['6×6', false], ['9×9', true]], 'still listed, most recent first');
  assert.deepEqual(toPractise(list).map((p) => p.key), ['6×6'], 'the round practises the one not learned');
  const later = [...games, { at: '2026-10-04T00:00:00.000Z', missed: { '7×8': 1 }, slow: {} }];
  const again = needMorePractice(later, 20, learned);
  assert.deepEqual(again.map((p) => [p.key, p.learned]), [['7×8', false], ['6×6', false], ['9×9', true]], 'missed again: to learn again');
  // Everything learned: the round practises them all again.
  const allLearned = needMorePractice(games, 20, { ...learned, '6×6': '2026-10-03T00:00:00.000Z' });
  assert.equal(toPractise(allLearned).length, 3);
});

test('Need More Practice keeps the last 20 problems answered wrong, newest first', () => {
  const games = Array.from({ length: 10 }, (_, g) => ({
    at: `2026-10-${String(g + 1).padStart(2, '0')}T00:00:00.000Z`,
    missed: Object.fromEntries(Array.from({ length: 3 }, (_, i) => [`${g + 1}+${i + 1}`, 1])),
    slow: {},
  }));
  const list = needMorePractice(games);
  assert.equal(list.length, 20);
  assert.equal(list[0].key.split('+')[0], '10', 'the newest game first');
  assert.ok(!list.some((p) => p.key.startsWith('1+') || p.key.startsWith('2+')), 'the oldest drop off past 20');
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

