// Stage 6 tests: saving, stats, high scores and backup.
// Run from the arithmetic-odyssey folder with:  node --test
// Test IDs (T6.x) match the test plan in GAME-PLAN.md. T6.8 (the iPad share
// sheet) is checked on the iPad.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { answerProblem, startAdventure, withNextProblem } from '../js/adventure.js';
import { BACKUP_FORMAT, backupFileName, canUndoRestore, makeBackup, parseBackup, restoreBackup, undoRestore } from '../js/backup.js';
import { createSeededRandom } from '../js/math.js';
import { createProfileStore, freeName } from '../js/profiles.js';
import { RECORD_SCHEMA, checkActive, checkHistory, checkIndex, checkProfile, migrate } from '../js/records.js';
import {
  BOARD_SIZE, HISTORY_SIZE, SLOW_MS, addHighScore, boardKey, compareScores, gameSummary, needMorePractice, problemText,
} from '../js/scores.js';
import { KEYS, createStorage, formatBytes, memoryStorage } from '../js/storage.js';

// ---------------------------------------------------------------- helpers

/** A store on a fresh in-memory device; problems are collected. */
function device(limitChars = Infinity) {
  const backend = memoryStorage(limitChars);
  const problems = [];
  let n = 0;
  const open = () => createProfileStore({
    storage: createStorage(backend, { onProblem: (p) => problems.push(p) }),
    makeId: () => `id${++n}`,
    now: () => new Date(Date.UTC(2026, 9, 17, 12, n)),
  });
  return { backend, problems, open };
}

/** Plays an adventure: answers is a list of true (right) / false (wrong), each taking ms. */
function play(state, answers, { ms = 2000, seed = 1 } = {}) {
  const random = createSeededRandom(seed);
  let s = state.problem ? state : withNextProblem(state, random);
  for (const right of answers) {
    if (s.mode === 'done') break;
    const input = right ? String(s.problem.answer) : String(s.problem.answer + 1);
    s = answerProblem(s, input, { thinkingMs: ms }).state;
    s = withNextProblem(s, random);
  }
  return s;
}

const newTrip = (options = {}) => startAdventure({ theme: 'dino', length: 20, detourLength: 3, operations: ['+', '×'], difficulty: 'beginner', ...options });
const all = (n, value = true) => Array(n).fill(value);

/** Plays a whole trip to the end and records it. */
function finishTrip(store, id, { length = 20, difficulty = 'beginner', ms = 2000, wrongFirst = 0, setback = false, seed = 1 } = {}) {
  let answers = [...all(wrongFirst, false)];
  // A setback: get to step 10 (a flag), then step 11, then a wrong answer and a whole detour wrong.
  if (setback) answers = [...all(11), false, false, false, false];
  answers = [...answers, ...all(length + 20)];
  const done = play(newTrip({ length, difficulty }), answers, { ms, seed });
  assert.equal(done.mode, 'done');
  const p = store.get(id);
  const next = `sticker${p.collected[done.theme].length + 1}`;
  return store.finishAdventure(id, done, { collected: [...p.collected[done.theme], next], stickerId: next });
}

const snapshot = (store) => JSON.parse(JSON.stringify(store.exportPlayers()));

// ---------------------------------------------------------------- saving and loading

test('players, settings, setup and stickers are still there after the game is closed and opened again', () => {
  const d = device();
  const a = d.open();
  const sam = a.add('Sam', 'trex');
  a.add('Ivy', 'cat');
  a.updateSettings(sam.id, { voice: false, adventureLength: 40, detourLength: 5 });
  a.updateSetup(sam.id, { theme: 'parks', operations: ['×', '÷'], difficulty: 'advanced' });
  a.setCollected(sam.id, 'dino', ['eoraptor', 'herrerasaurus']);

  const b = d.open();
  assert.deepEqual(b.list().map((p) => [p.name, p.avatar]), [['Sam', 'trex'], ['Ivy', 'cat']]);
  const again = b.get(sam.id);
  assert.equal(again.settings.voice, false);
  assert.equal(again.settings.adventureLength, 40);
  assert.equal(again.settings.detourLength, 5);
  assert.deepEqual(again.setup, { theme: 'parks', operations: ['×', '÷'], difficulty: 'advanced' });
  assert.deepEqual(again.collected, { dino: ['eoraptor', 'herrerasaurus'], parks: [] });
  assert.deepEqual(d.problems, []);
});

test('T6.1 closing in the middle of an adventure and opening again resumes the same question, step, flag, detour and time', () => {
  const d = device();
  const a = d.open();
  const sam = a.add('Sam', 'trex');
  // 12 right (past the first flag), then a wrong answer: in a detour, 1 question in.
  const trip = play(newTrip(), [...all(12), false, true], { ms: 1500 });
  assert.equal(trip.mode, 'detour');
  a.saveAdventure(sam.id, trip);

  const b = d.open();
  const resumed = b.get(sam.id).adventure;
  assert.deepEqual(resumed, JSON.parse(JSON.stringify(trip)), 'everything is the same');
  assert.equal(resumed.step, 12);
  assert.equal(resumed.checkpoint, 10, 'the last flag');
  assert.deepEqual(resumed.detour, { number: 1, asked: 1, correct: 1 });
  assert.equal(resumed.stats.thinkingMs, 14 * 1500, 'the thinking time so far');
  assert.equal(resumed.problem.text, trip.problem.text, 'the same question');
  assert.equal(typeof resumed.problem.speech, 'string');
  // ...and it carries on as if it had never stopped.
  const next = answerProblem(resumed, String(resumed.problem.answer), { thinkingMs: 1000 });
  assert.equal(next.state.detour.asked, 2);
});

test('T6.1 a finished adventure is not offered again, and a new one replaces the old one', () => {
  const d = device();
  const a = d.open();
  const sam = a.add('Sam', 'trex');
  a.saveAdventure(sam.id, play(newTrip(), all(3)));
  finishTrip(a, sam.id);
  const b = d.open();
  assert.equal(b.get(sam.id).adventure, null);
  assert.equal(d.backend.getItem(KEYS.active(sam.id)), null, 'nothing left over');
});

test('an adventure is saved after every question (only the adventure is written)', () => {
  const d = device();
  const a = d.open();
  const sam = a.add('Sam', 'trex');
  const before = d.backend.getItem(KEYS.profile(sam.id));
  let trip = play(newTrip(), []);
  for (let i = 0; i < 5; i++) {
    trip = play(trip, [true], { seed: i + 2 });
    a.saveAdventure(sam.id, trip);
    assert.equal(JSON.parse(d.backend.getItem(KEYS.active(sam.id))).adventure.step, i + 1);
  }
  assert.equal(d.backend.getItem(KEYS.profile(sam.id)), before, 'the player record is not rewritten during an adventure');
});

test('a saved question that does not add up is replaced by a new one', () => {
  const d = device();
  const a = d.open();
  const sam = a.add('Sam', 'trex');
  const trip = play(newTrip(), all(3));
  a.saveAdventure(sam.id, trip);
  const raw = JSON.parse(d.backend.getItem(KEYS.active(sam.id)));
  raw.adventure.problem = { op: '÷', a: 7, b: 0 };
  d.backend.setItem(KEYS.active(sam.id), JSON.stringify(raw));
  const resumed = d.open().get(sam.id).adventure;
  assert.equal(resumed.problem, null, 'the screen picks a new question');
  assert.equal(resumed.step, 3, 'the trip itself is kept');
});

test('deleting a player removes everything saved for them', () => {
  const d = device();
  const a = d.open();
  const sam = a.add('Sam', 'trex');
  a.saveAdventure(sam.id, play(newTrip(), all(2)));
  finishTrip(a, sam.id);
  a.saveAdventure(sam.id, play(newTrip(), all(2)));
  a.remove(sam.id);
  assert.deepEqual(d.backend.length, 1, 'only the player list is left');
  assert.deepEqual(JSON.parse(d.backend.getItem(KEYS.index)).profiles, []);
  assert.equal(d.open().list().length, 0);
});

test('safe writes: a crash between the temporary copy and the real key loses nothing', () => {
  const backend = memoryStorage();
  const problems = [];
  const s = createStorage(backend, { onProblem: (p) => problems.push(p) });
  // The crash happened after the temporary copy was written, before the real key.
  backend.setItem(`${KEYS.index}.tmp`, JSON.stringify({ schema: 1, profiles: [{ id: 'a', name: 'Sam', avatar: 'cat' }] }));
  assert.equal(s.read(KEYS.index, checkIndex).profiles[0].name, 'Sam');
  assert.ok(backend.getItem(KEYS.index), 'the real key is written');
  assert.equal(backend.getItem(`${KEYS.index}.tmp`), null, 'the temporary copy is removed');
  // A half-written real key with a good temporary copy: the good copy wins.
  backend.setItem(KEYS.index, '{"schema":1,"prof');
  backend.setItem(`${KEYS.index}.tmp`, JSON.stringify({ schema: 1, profiles: [{ id: 'b', name: 'Ivy', avatar: 'cat' }] }));
  assert.equal(s.read(KEYS.index, checkIndex).profiles[0].name, 'Ivy');
  assert.equal(problems.length, 1, 'the damaged copy is set aside and reported');
  // After a normal write there is no temporary copy left.
  assert.ok(s.write('ao.v1.x', { a: 1 }));
  assert.deepEqual(s.keys().filter((k) => k.endsWith('.tmp')), []);
});

// ---------------------------------------------------------------- T6.2 damaged saves

test('T6.2 a damaged player record is set aside and the game still starts, keeping the player', () => {
  const d = device();
  const a = d.open();
  const sam = a.add('Sam', 'trex');
  a.add('Ivy', 'cat');
  d.backend.setItem(KEYS.profile(sam.id), '{"schema":1,"id":"id1","name":');
  const b = d.open();
  assert.deepEqual(b.list().map((p) => p.name), ['Sam', 'Ivy'], 'Sam is still a player (with fresh settings)');
  assert.ok(d.backend.getItem(KEYS.quarantine(KEYS.profile(sam.id))), 'the damaged data is kept aside');
  assert.equal(d.problems.length, 1);
  assert.equal(d.problems[0].type, 'damaged');
  assert.equal(d.problems[0].message, "A player's saved settings and stickers were damaged, so the game put that copy aside and carried on. A backup can bring it back.");
});

test('T6.2 damaged data of every kind is set aside, never crashing the game', () => {
  const garbage = ['not json', '[]', '{"schema":1}', '{"schema":99,"profiles":[]}', 'null', '{"schema":1,"adventure":{"schema":1,"theme":"space"}}'];
  for (const junk of garbage) {
    const d = device();
    const a = d.open();
    const sam = a.add('Sam', 'trex');
    a.saveAdventure(sam.id, play(newTrip(), all(3)));
    finishTrip(a, sam.id);
    a.saveAdventure(sam.id, play(newTrip(), all(3)));
    for (const key of [KEYS.history(sam.id), KEYS.active(sam.id)]) d.backend.setItem(key, junk);
    const b = d.open();
    const p = b.get(sam.id);
    assert.ok(p, `player kept (${junk})`);
    assert.ok(Array.isArray(p.history), junk);
    if (junk !== 'null') assert.equal(p.adventure, null, `no adventure to resume (${junk})`);
  }
});

test('T6.2 a damaged player list is rebuilt from the players\' own records', () => {
  const d = device();
  const a = d.open();
  a.add('Sam', 'trex');
  a.add('Ivy', 'cat');
  d.backend.setItem(KEYS.index, '%%%');
  const b = d.open();
  assert.deepEqual(b.list().map((p) => p.name).sort(), ['Ivy', 'Sam']);
  assert.equal(JSON.parse(d.backend.getItem(KEYS.index)).profiles.length, 2, 'the list is saved again');
});

// ---------------------------------------------------------------- T6.3 full or missing storage

test('T6.3 a full storage shows a friendly message and does not crash; the game keeps going', () => {
  const d = device(3000);
  const a = d.open();
  const sam = a.add('Sam', 'trex');
  let trip = play(newTrip({ length: 100 }), []);
  assert.doesNotThrow(() => {
    for (let i = 0; i < 40; i++) {
      trip = play(trip, [true], { seed: i + 5 });
      a.saveAdventure(sam.id, trip);
      if (a.canAdd()) a.add(`Player ${i}`, 'cat');
    }
  });
  assert.ok(d.problems.some((p) => p.type === 'full'), 'the full storage was reported');
  const full = d.problems.find((p) => p.type === 'full');
  assert.match(full.message, /backup/i, 'it suggests a backup');
  assert.equal(a.get(sam.id).adventure.step, 40, 'the adventure goes on in memory');
  assert.equal(d.backend.getItem(`${KEYS.active(sam.id)}.tmp`), null, 'no half-written copies are left');
});

test('T6.3 with no storage at all the game still works for this visit and says so', () => {
  const problems = [];
  const s = createStorage(null, { onProblem: (p) => problems.push(p) });
  assert.equal(s.saving, false);
  assert.equal(problems[0].type, 'unavailable');
  const store = createProfileStore({ storage: s });
  const p = store.add('Sam', 'cat');
  store.saveAdventure(p.id, play(newTrip(), all(2)));
  assert.equal(store.get(p.id).adventure.step, 2);
});

test('the storage size is measured and shown in a readable way', () => {
  const d = device();
  const a = d.open();
  const before = a.storage.usage();
  a.add('Sam', 'trex');
  assert.ok(a.storage.usage() > before);
  assert.equal(formatBytes(512), '512 bytes');
  assert.equal(formatBytes(12 * 1024), '12 KB');
  assert.equal(formatBytes(1.5 * 1024 * 1024), '1.5 MB');
});

// ---------------------------------------------------------------- T6.4 and T6.5 history and high scores

test('T6.4 the history keeps only the last 10 games; each board keeps only its top 10', () => {
  const d = device();
  const a = d.open();
  const sam = a.add('Sam', 'trex');
  for (let i = 0; i < 13; i++) finishTrip(a, sam.id, { ms: 1000 + i * 100, seed: i + 1 });
  const p = d.open().get(sam.id);
  assert.equal(p.history.length, HISTORY_SIZE);
  assert.equal(p.history[0].thinkingMs, 20 * 1300, 'the 3 oldest games were dropped');
  const board = p.highScores[boardKey(20, 'beginner')];
  assert.equal(board.length, BOARD_SIZE);
  assert.deepEqual(board.map((e) => e.thinkingMs), board.map((e) => e.thinkingMs).sort((x, y) => x - y), 'best first');
  assert.equal(board[0].thinkingMs, 20 * 1000);
  assert.equal(p.collected.dino.length, 13, 'every finished trip gave a sticker');
});

test('T6.5 high scores are kept apart by adventure length and difficulty', () => {
  const d = device();
  const a = d.open();
  const sam = a.add('Sam', 'trex');
  finishTrip(a, sam.id, { length: 20, difficulty: 'beginner' });
  finishTrip(a, sam.id, { length: 40, difficulty: 'beginner' });
  finishTrip(a, sam.id, { length: 20, difficulty: 'advanced' });
  finishTrip(a, sam.id, { length: 20, difficulty: 'beginner' });
  const boards = d.open().get(sam.id).highScores;
  assert.deepEqual(Object.keys(boards).sort(), ['20|advanced', '20|beginner', '40|beginner']);
  assert.equal(boards['20|beginner'].length, 2);
  assert.equal(boards['40|beginner'].length, 1);
});

test('T6.5 a finished trip with a setback still counts, and fewer setbacks rank higher (then less time)', () => {
  const d = device();
  const a = d.open();
  const sam = a.add('Sam', 'trex');
  const slowClean = finishTrip(a, sam.id, { ms: 5000 });
  const fastSetback = finishTrip(a, sam.id, { ms: 1000, setback: true });
  const fastClean = finishTrip(a, sam.id, { ms: 2000 });
  assert.equal(fastSetback.stats.setbacks, 1, 'the run went back to a flag');
  assert.ok(fastSetback.rank > 0, 'it still made the board');
  const board = a.get(sam.id).highScores['20|beginner'];
  assert.deepEqual(board.map((e) => [e.setbacks, e.thinkingMs]), [[0, 40000], [0, 100000], [1, fastSetback.stats.thinkingMs]]);
  assert.equal(fastClean.rank, 1, 'Trail\'s End is told the new score is the best');
  assert.equal(slowClean.rank, 1, 'the first score was the best at the time');
  assert.equal(fastSetback.rank, 2);
});

test('the score order: fewer setbacks, then less time, then the earlier game', () => {
  const s = (setbacks, thinkingMs, at) => ({ setbacks, thinkingMs, at });
  const list = [s(1, 100, 'b'), s(0, 900, 'b'), s(0, 300, 'b'), s(0, 300, 'a')].sort(compareScores);
  assert.deepEqual(list, [s(0, 300, 'a'), s(0, 300, 'b'), s(0, 900, 'b'), s(1, 100, 'b')]);
  let boards = {};
  for (let i = 0; i < 12; i++) boards = addHighScore(boards, { at: `2026-01-${10 + i}T00:00:00Z`, length: 20, difficulty: 'beginner', setbacks: 0, thinkingMs: 1000 * (12 - i), answered: 20, correct: 20, operations: '+' }).boards;
  assert.equal(boards['20|beginner'].length, 10);
  const worse = addHighScore(boards, { at: '2026-02-01T00:00:00Z', length: 20, difficulty: 'beginner', setbacks: 3, thinkingMs: 1, answered: 20, correct: 17, operations: '+' });
  assert.equal(worse.rank, 0, 'a score below the top 10 is not added');
});

test('Need More Practice: most-missed problems first, then the slowest', () => {
  const games = [
    { missed: { '7×8': 2, '9+6': 1 }, slow: { '7×8': 9000, '12−5': 8000, '2+2': 1000 } },
    { missed: { '7×8': 1, '6×6': 1 }, slow: { '6×6': 12000, '11+9': 6000 } },
  ];
  const list = needMorePractice(games);
  assert.deepEqual(list.map((p) => p.text), ['7 × 8', '6 × 6', '9 + 6', '12 − 5', '11 + 9']);
  assert.deepEqual(list[0], { key: '7×8', text: '7 × 8', missed: 3, slowMs: 9000 });
  assert.ok(!list.some((p) => p.key === '2+2'), `a quick problem (under ${SLOW_MS} ms) is not listed`);
  assert.equal(needMorePractice([]).length, 0);
  // Only the last 10 games count.
  const old = { missed: { '1+1': 9 }, slow: {} };
  assert.ok(!needMorePractice([old, ...Array(10).fill({ missed: {}, slow: {} })]).some((p) => p.key === '1+1'));
  assert.equal(problemText('144÷12'), '144 ÷ 12');
});

test('a game summary is small: only the 10 slowest problems are kept', () => {
  const trip = play(newTrip({ length: 40 }), all(40), { ms: 100 });
  trip.stats.times = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`${i}+1`, i * 100]));
  const game = gameSummary(trip, new Date('2026-10-17T00:00:00Z'));
  assert.equal(Object.keys(game.slow).length, 10);
  assert.equal(game.slow['29+1'], 2900);
  assert.equal(game.at, '2026-10-17T00:00:00.000Z');
  assert.ok(JSON.stringify(game).length < 1000);
});

// ---------------------------------------------------------------- T6.6 and T6.7 backup and restore

function filledDevice() {
  const d = device();
  const a = d.open();
  const sam = a.add('Sam', 'trex');
  const ivy = a.add('Ivy', 'unicorn');
  a.updateSettings(ivy.id, { speed: 'slower' });
  finishTrip(a, sam.id);
  finishTrip(a, sam.id, { length: 40, wrongFirst: 2 });
  finishTrip(a, ivy.id);
  a.saveAdventure(ivy.id, play(newTrip(), [...all(4), false]));
  return { d, a, sam, ivy };
}

test('T6.6 Back Up then Restore (Replace) gives identical data', () => {
  const { a } = filledDevice();
  const before = snapshot(a);
  const text = JSON.stringify(makeBackup(a, { appVersion: '0.6.0', date: new Date('2026-10-17T12:00:00Z') }));
  const file = JSON.parse(text);
  assert.equal(file.format, BACKUP_FORMAT);
  assert.equal(file.schema, 1);
  assert.equal(file.appVersion, '0.6.0');
  assert.equal(file.exportedAt, '2026-10-17T12:00:00.000Z');

  // Restored on a new iPad.
  const other = device().open();
  other.add('Someone', 'cat');
  const parsed = parseBackup(text);
  assert.ok(parsed.ok, parsed.error);
  assert.equal(parsed.preview.text, '2 players, 3 stickers, 3 high scores, 1 adventure in progress');
  restoreBackup(other, parsed.players, 'replace');
  assert.deepEqual(snapshot(other), before, 'identical');
});

test('T6.6 Restore (Add) adds players without changing the ones already there', () => {
  const { a } = filledDevice();
  const backup = parseBackup(JSON.stringify(makeBackup(a)));
  const d2 = device();
  const other = d2.open();
  const own = other.add('Sam', 'dog');
  finishTrip(other, own.id);
  const ownBefore = snapshot(other);
  const added = restoreBackup(other, backup.players, 'add');
  assert.deepEqual(added.map((p) => p.name), ['Sam 2', 'Ivy'], 'a taken name gets a number');
  assert.deepEqual(snapshot(other).slice(0, 1), ownBefore, 'the player already there is unchanged');
  assert.equal(other.list().length, 3);
  assert.equal(new Set(other.list().map((p) => p.id)).size, 3, 'every player has their own id');
  assert.equal(d2.open().list().length, 3, 'and it is all saved');
  assert.equal(freeName('Abcdefghijklmnopqrst', [{ id: 'x', name: 'Abcdefghijklmnopqrst' }]), 'Abcdefghijklmnopqr 2', 'still 20 letters at most');
});

test('T6.6 a restore can be undone', () => {
  const { a } = filledDevice();
  const before = snapshot(a);
  const other = createProfileStore({ makeId: () => 'zed1' }); // another iPad: its own ids
  other.add('Zed', 'robot');
  const backup = parseBackup(JSON.stringify(makeBackup(other)));
  assert.equal(canUndoRestore(a), false);
  a.select(a.list()[0].id);
  restoreBackup(a, backup.players, 'replace');
  assert.equal(a.active(), null, 'the player who was playing is gone');
  assert.deepEqual(a.list().map((p) => p.name), ['Zed']);
  assert.equal(canUndoRestore(a), true);
  undoRestore(a);
  assert.deepEqual(snapshot(a), before, 'everyone is back as they were');
  assert.equal(a.active(), null, 'nobody is chosen after a replace that removed them');
  assert.equal(canUndoRestore(a), false);
});

test('T6.6 adding players that would make more than 8 is refused, changing nothing', () => {
  const d = device();
  const a = d.open();
  for (let i = 0; i < 7; i++) a.add(`P${i}`, 'cat');
  const two = device().open();
  two.add('X', 'cat');
  two.add('Y', 'cat');
  const before = snapshot(a);
  assert.throws(() => restoreBackup(a, parseBackup(JSON.stringify(makeBackup(two))).players, 'add'), /up to 8/);
  assert.deepEqual(snapshot(a), before);
});

test('T6.7 a wrong or damaged backup file is refused with a clear message and changes nothing', () => {
  const { a } = filledDevice();
  const good = makeBackup(a);
  const before = snapshot(a);
  const cases = [
    ['', /empty/],
    ['hello', /isn't an Arithmetic Odyssey backup/],
    ['{"format":"something-else"}', /isn't an Arithmetic Odyssey backup/],
    [JSON.stringify({ ...good, schema: 99 }), /newer version/],
    [JSON.stringify({ ...good, schema: 'x' }), /damaged/],
    [JSON.stringify({ ...good, players: [] }), /no players/],
    [JSON.stringify({ ...good, players: Array(9).fill(good.players[0]) }), /up to 8/],
    [JSON.stringify({ ...good, players: [good.players[0], good.players[0]] }), /twice/],
    [JSON.stringify({ ...good, players: [{ ...good.players[0], profile: { name: 'Sam' } }] }), /damaged: Sam/],
    [JSON.stringify({ ...good, players: [{ ...good.players[1], active: { schema: 1, adventure: { schema: 1, theme: 'moon' } } }] }), /damaged: Ivy/],
    [JSON.stringify(good).slice(0, 200), /can't be read/],
    ['x'.repeat(3_000_000), /too big/],
  ];
  for (const [text, message] of cases) {
    const result = parseBackup(text);
    assert.equal(result.ok, false, text.slice(0, 60));
    assert.match(result.error, message);
  }
  assert.deepEqual(snapshot(a), before, 'nothing changed');
  assert.throws(() => restoreBackup(a, [], 'merge'), /Unknown restore mode/);
});

test('the backup file is named for the day it was made', () => {
  assert.equal(backupFileName(new Date(2026, 9, 7)), 'arithmetic-odyssey-backup-2026-10-07.json');
});

// ---------------------------------------------------------------- T6.9 migrations

test('T6.9 saves from before saving existed (schema 0) are brought up to date', () => {
  const backend = memoryStorage();
  // The shapes the game used in memory in versions 0.3 to 0.5.
  backend.setItem(KEYS.index, JSON.stringify([{ id: 'old1', name: 'Sam', avatar: 'trex' }]));
  backend.setItem(KEYS.profile('old1'), JSON.stringify({
    id: 'old1', name: 'Sam', avatar: 'trex', settings: { voice: false }, setup: { theme: 'dino', operations: ['×'], difficulty: 'intermediate' },
    collected: ['eoraptor', 'herrerasaurus'], lastResult: null,
  }));
  backend.setItem(KEYS.history('old1'), JSON.stringify([]));
  const trip = play(newTrip(), all(5));
  backend.setItem(KEYS.active('old1'), JSON.stringify(trip));
  const problems = [];
  const store = createProfileStore({ storage: createStorage(backend, { onProblem: (p) => problems.push(p) }) });
  const sam = store.get('old1');
  assert.deepEqual(problems, []);
  assert.deepEqual(sam.collected, { dino: ['eoraptor', 'herrerasaurus'], parks: [] });
  assert.deepEqual(sam.highScores, {});
  assert.equal(sam.settings.voice, false);
  assert.equal(sam.setup.difficulty, 'intermediate');
  assert.equal(sam.adventure.step, 5);
  assert.equal(migrate('profile', { id: 'x' }).schema, RECORD_SCHEMA);
  // Saved again, everything is at the current schema.
  store.updateSettings('old1', { voice: true });
  assert.equal(JSON.parse(backend.getItem(KEYS.profile('old1'))).schema, RECORD_SCHEMA);
});

test('T6.9 a save from a newer version is set aside rather than misread', () => {
  assert.throws(() => checkProfile({ schema: RECORD_SCHEMA + 1, id: 'a' }), /newer version/);
  assert.throws(() => checkHistory({ schema: 1 }), /history is missing/);
  assert.throws(() => checkActive({ schema: 1, adventure: { schema: 2 } }), /unknown adventure schema/);
  assert.equal(checkActive({ schema: 1, adventure: { ...newTrip(), mode: 'done' } }).adventure, null, 'a finished trip is not resumed');
});

test('saved values are cleaned up: unknown pictures, too-long names and out-of-range numbers', () => {
  const p = checkProfile({ schema: 1, id: 'a', name: '   A   very   long   name that goes on   ', avatar: 'dragon', settings: { adventureLength: 7 }, collected: { dino: ['x', 'x', 5], moon: ['y'] }, highScores: { 'bad key': [], '20|beginner': [{ at: 'yesterday' }] } });
  assert.equal(p.name, 'A very long name tha');
  assert.equal(p.avatar, 'longneck');
  assert.equal(p.settings.adventureLength, 20);
  assert.deepEqual(p.collected, { dino: ['x'], parks: [] });
  assert.deepEqual(p.highScores, {});
  const index = checkIndex({ schema: 1, profiles: [{ id: 'a b', name: 'X' }, { id: 'ok', name: 'Y' }, { id: 'ok', name: 'Z' }] });
  assert.deepEqual(index.profiles.map((e) => e.name), ['Y'], 'bad and repeated ids are dropped');
});
