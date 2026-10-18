// 0.7.2 tests: giveaway problems are limited, a missed question comes back
// later in the same trip, and right answers in a row are praised.
// Run from the arithmetic-odyssey folder with:  node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { AGAIN_AFTER, AGAIN_MAX, STREAK_EVERY, answerProblem, startAdventure, withNextProblem } from '../js/adventure.js';
import { GIVEAWAY_EVERY, createProblemGenerator, createSeededRandom, giveawayAllowed, isGiveaway, restoreProblem } from '../js/math.js';
import { checkActive } from '../js/records.js';

const p = (op, a, b) => restoreProblem({ op, a, b });

function trip(overrides = {}, seed = 7) {
  const random = createSeededRandom(seed);
  const state = startAdventure({ theme: 'dino', length: 100, detourLength: 3, operations: ['+', '−', '×', '÷'], difficulty: 'beginner', ...overrides });
  return { state: withNextProblem(state, random), random };
}

/** Answers right or wrong, then picks the next question (resuming from a save when resume is true). */
function answer(t, right, { resume = false } = {}) {
  const { state, events } = answerProblem(t.state, String(right ? t.state.problem.answer : t.state.problem.answer + 1));
  let next = state;
  if (resume) next = checkActive(JSON.parse(JSON.stringify({ schema: 1, adventure: next }))).adventure;
  t.state = next.mode === 'done' ? next : withNextProblem(next, t.random);
  return events;
}

// ---------------------------------------------------------------- giveaways

test('giveaways are anything by 1, and a number take away itself', () => {
  for (const [op, a, b] of [['+', 1, 7], ['+', 7, 1], ['−', 8, 1], ['−', 6, 6], ['×', 1, 9], ['×', 9, 1], ['÷', 7, 1]]) {
    assert.equal(isGiveaway(p(op, a, b)), true, `${a} ${op} ${b}`);
  }
  for (const [op, a, b] of [['+', 2, 7], ['−', 8, 2], ['×', 2, 9], ['÷', 8, 2], ['÷', 7, 7], ['−', 10, 1 + 1]]) {
    assert.equal(isGiveaway(p(op, a, b)), false, `${a} ${op} ${b}`);
  }
  assert.equal(giveawayAllowed('beginner', null), true);
  assert.equal(giveawayAllowed('beginner', GIVEAWAY_EVERY - 2), false);
  assert.equal(giveawayAllowed('beginner', GIVEAWAY_EVERY - 1), true);
  assert.equal(giveawayAllowed('intermediate', null), false);
  assert.equal(giveawayAllowed('advanced', 1000), false);
});

/** True when no GIVEAWAY_EVERY questions in a row hold more than one giveaway. */
function atMostOnePerWindow(problems) {
  const at = problems.flatMap((q, i) => (isGiveaway(q) ? [i] : []));
  return at.every((i, n) => n === 0 || i - at[n - 1] >= GIVEAWAY_EVERY);
}

test('Beginner: at most one giveaway in any 20 questions in a row, for every operation', () => {
  for (const operations of [['+'], ['−'], ['×'], ['÷'], ['+', '−', '×', '÷']]) {
    for (const seed of [1, 2, 3]) {
      const generator = createProblemGenerator({ operations, difficulty: 'beginner', random: createSeededRandom(seed) });
      const problems = Array.from({ length: 2000 }, () => generator.next());
      assert.ok(atMostOnePerWindow(problems), `${operations.join('')} seed ${seed}`);
      // They still come now and then (the limit is not "never").
      assert.ok(problems.filter(isGiveaway).length >= 2000 / GIVEAWAY_EVERY / 2, `${operations.join('')}: too few`);
    }
  }
});

test('Intermediate and Advanced never have a giveaway', () => {
  for (const difficulty of ['intermediate', 'advanced']) {
    for (const operations of [['+'], ['−'], ['×'], ['÷']]) {
      const generator = createProblemGenerator({ operations, difficulty, random: createSeededRandom(5) });
      for (let i = 0; i < 3000; i++) {
        const q = generator.next();
        assert.equal(isGiveaway(q), false, `${difficulty}: ${q.text}`);
      }
    }
  }
});

test('the limit carries on through a trip, a saved and resumed trip, and asked-again questions', () => {
  // With misses too: asked-again questions repeat a miss on purpose, so only new ones count.
  const t = trip({ length: 400 });
  const asked = [t.state];
  for (let i = 0; i < 380; i++) {
    answer(t, i % 7 !== 3, { resume: i % 5 === 0 });
    asked.push(t.state);
  }
  // Each new giveaway comes at least GIVEAWAY_EVERY questions after the last giveaway of any kind.
  const at = asked.flatMap((s, i) => (isGiveaway(s.problem) ? [{ i, again: s.isAgain }] : []));
  assert.ok(at.length >= 2, 'some giveaways came');
  for (let n = 1; n < at.length; n++) {
    if (!at[n].again) assert.ok(at[n].i - at[n - 1].i >= GIVEAWAY_EVERY, `new giveaway at ${at[n].i}, previous at ${at[n - 1].i}`);
  }
  const fresh = [];
  const t2 = trip({ length: 400 }, 11);
  fresh.push(t2.state);
  for (let i = 0; i < 380; i++) {
    answer(t2, true, { resume: i % 3 === 0 });
    fresh.push(t2.state);
  }
  assert.ok(atMostOnePerWindow(fresh.map((s) => s.problem)), 'all right answers, resumed every third question');
  assert.equal(trip({ difficulty: 'advanced' }).state.sinceGiveaway, null);
});

// ---------------------------------------------------------------- asked again

test(`a missed question comes back after ${AGAIN_AFTER} other questions, marked as asked again`, () => {
  const t = trip({ operations: ['×'] });
  const missed = t.state.problem;
  answer(t, false);
  for (let i = 0; i < AGAIN_AFTER; i++) {
    assert.notEqual(t.state.problem.key, missed.key, `question ${i + 1} after the miss`);
    assert.equal(t.state.isAgain, false);
    answer(t, true);
  }
  assert.equal(t.state.problem.key, missed.key);
  assert.equal(t.state.isAgain, true);
  answer(t, true);
  assert.equal(t.state.isAgain, false);
  assert.deepEqual(t.state.again, [], 'answered right: it does not come back again');
});

test('missed again: it comes back again; several misses wait in order, at most AGAIN_MAX', () => {
  const t = trip({ operations: ['+'] });
  const first = t.state.problem.key;
  answer(t, false);
  for (let i = 0; i < AGAIN_AFTER; i++) answer(t, true);
  assert.equal(t.state.problem.key, first);
  answer(t, false); // wrong again
  for (let i = 0; i < AGAIN_AFTER; i++) answer(t, true);
  assert.equal(t.state.problem.key, first, 'missed twice: asked a third time');
  answer(t, true);
  for (let i = 0; i < AGAIN_MAX + 3; i++) answer(t, false);
  assert.ok(t.state.again.length <= AGAIN_MAX);
});

test('the same question is never asked twice in a row, even when it is due again', () => {
  const t = trip({ operations: ['+'] });
  t.state = { ...t.state, again: [{ op: t.state.problem.op, a: t.state.problem.a, b: t.state.problem.b, wait: 1 }] };
  const before = t.state.problem.key;
  answer(t, true);
  assert.notEqual(t.state.problem.key, before);
});

test('a resumed trip keeps the questions waiting to come back; damaged ones are dropped', () => {
  const t = trip({ operations: ['×'] });
  const missed = t.state.problem.key;
  answer(t, false, { resume: true });
  assert.deepEqual(t.state.again.map((q) => `${q.a}${q.op}${q.b}`), [missed]);
  const saved = JSON.parse(JSON.stringify({ schema: 1, adventure: t.state }));
  saved.adventure.again.push({ op: '÷', a: 7, b: 0, wait: 1 }, { op: 'constructor', a: 1, b: 1, wait: 1 }, 'x', null, { op: '+', a: 1, b: 2, wait: 'soon' });
  saved.adventure.sinceGiveaway = -4;
  saved.adventure.streak = 'lots';
  saved.adventure.isAgain = 'yes';
  const back = checkActive(saved).adventure;
  assert.deepEqual(back.again.map((q) => `${q.a}${q.op}${q.b}`), [missed]);
  assert.equal(back.sinceGiveaway, null);
  assert.equal(back.streak, 0);
  assert.equal(back.isAgain, false);
});

test('a trip saved before 0.7.2 (without the new fields) still resumes', () => {
  const t = trip();
  const old = JSON.parse(JSON.stringify(t.state));
  for (const key of ['again', 'isAgain', 'sinceGiveaway', 'streak']) delete old[key];
  delete old.stats.bestStreak;
  const back = checkActive({ schema: 1, adventure: old }).adventure;
  assert.deepEqual([back.again, back.isAgain, back.sinceGiveaway, back.streak, back.stats.bestStreak], [[], false, null, 0, 0]);
  const next = withNextProblem(answerProblem(back, String(back.problem.answer)).state, createSeededRandom(1));
  assert.ok(next.problem);
});

// ---------------------------------------------------------------- streaks

test(`streak praise at every ${STREAK_EVERY} right answers in a row; a wrong answer starts again`, () => {
  const t = trip();
  const streaks = [];
  const pattern = [...Array(12).fill(true), false, ...Array(6).fill(true)];
  for (const right of pattern) streaks.push(...answer(t, right).filter((e) => e.type === 'streak').map((e) => e.count));
  assert.deepEqual(streaks, [5, 10, 5]);
  assert.equal(t.state.streak, 6);
  assert.equal(t.state.stats.bestStreak, 12);
});

// ---------------------------------------------------------------- grown-ups (0.7.2)

test('the grown-up hold needs two fingers on a touch screen, or a mouse, pen or key press', async () => {
  const { HOLD_FINGERS, enoughToHold, holdHint } = await import('../js/hold.js');
  assert.equal(HOLD_FINGERS, 2);
  assert.equal(enoughToHold({ touches: 1 }), false, 'one finger is not enough');
  assert.equal(enoughToHold({ touches: 0 }), false);
  assert.equal(enoughToHold({ touches: 2 }), true);
  assert.equal(enoughToHold({ touches: 3 }), true);
  assert.equal(enoughToHold({ other: true }), true, 'a mouse at a PC');
  assert.equal(holdHint(), 'Grown-ups: hold with two fingers for 3 seconds');
  // The button itself no longer prints how to open it.
  const hold = (await import('node:fs')).readFileSync(new URL('../js/hold.js', import.meta.url), 'utf8');
  assert.doesNotMatch(hold, /hint = 'Hold for 3 seconds'/);
});

async function storeWith(names, limitChars = Infinity) {
  const { createProfileStore } = await import('../js/profiles.js');
  const { createStorage, memoryStorage } = await import('../js/storage.js');
  let n = 0;
  const store = createProfileStore({ storage: createStorage(memoryStorage(limitChars)), makeId: () => `p${++n}` });
  for (const name of names) store.add(name, 'cat', 2);
  return store;
}

test('a deleted player can be brought back once, with their stickers and history', async () => {
  const { deletedPlayer, keepDeletedPlayer, undoDelete } = await import('../js/backup.js');
  const store = await storeWith(['Sam', 'Mia']);
  const sam = store.list()[0];
  store.setCollected(sam.id, 'dino', ['triassic-01-eoraptor']);
  assert.equal(deletedPlayer(store), null, 'nothing deleted yet');
  assert.equal(keepDeletedPlayer(store, sam.id), true);
  store.remove(sam.id);
  assert.equal(deletedPlayer(store).name, 'Sam');
  const back = undoDelete(store);
  assert.equal(back.name, 'Sam');
  assert.equal(back.color, 2);
  assert.deepEqual(back.collected.dino, ['triassic-01-eoraptor']);
  assert.equal(store.list().length, 2);
  assert.equal(deletedPlayer(store), null, 'only once');
  assert.throws(() => undoDelete(store), /no deleted player/);
});

test('bringing back: a taken name gets a number; a full player list or a damaged copy is refused safely', async () => {
  const { KEYS } = await import('../js/storage.js');
  const { MAX_PROFILES } = await import('../js/records.js');
  const { deletedPlayer, keepDeletedPlayer, undoDelete } = await import('../js/backup.js');
  const store = await storeWith(['Sam']);
  const sam = store.list()[0];
  keepDeletedPlayer(store, sam.id);
  store.remove(sam.id);
  store.add('Sam', 'dog', 1);
  assert.equal(undoDelete(store).name, 'Sam 2');

  const full = await storeWith(Array.from({ length: MAX_PROFILES }, (_, i) => `P${i}`));
  const first = full.list()[0];
  keepDeletedPlayer(full, first.id);
  full.remove(first.id);
  full.add('New', 'dog', 1);
  assert.throws(() => undoDelete(full), /as many players/);
  assert.ok(deletedPlayer(full), 'the copy is still kept for later');

  const damaged = await storeWith(['Ana']);
  damaged.storage.write(KEYS.deleted, { format: 'arithmetic-odyssey-backup', schema: 1, players: [{ profile: { id: '../x', name: 7 } }] });
  assert.equal(deletedPlayer(damaged), null);
  assert.throws(() => undoDelete(damaged), /no deleted player/);
  assert.equal(damaged.list().length, 1, 'nothing changed');
  assert.equal(keepDeletedPlayer(damaged, 'nobody'), false);
});

test('when there is no room for the copy, keeping it fails (and the grown-up is asked again)', async () => {
  const { keepDeletedPlayer } = await import('../js/backup.js');
  const store = await storeWith(['Sam'], 800); // room for the player (about 530 characters) but not a copy
  assert.equal(keepDeletedPlayer(store, store.list()[0].id), false);
  const settings = (await import('node:fs')).readFileSync(new URL('../js/screens/settings.js', import.meta.url), 'utf8');
  assert.match(settings, /if \(!keepDeletedPlayer\(store, player\.id[^)]*\)\) \{\s*const anyway = await confirmDialog/);
});

// ---------------------------------------------------------------- read aloud and album sections

test('Read to me reads the name as it is said, then each fact, as sentences', async () => {
  const { stickerReading } = await import('../js/read-aloud.js');
  assert.equal(stickerReading({ name: 'T. rex', spokenName: 'Tyrannosaurus rex', facts: ['It was big.', 'It ran fast', ' '] }),
    'Tyrannosaurus rex. It was big. It ran fast.');
  assert.equal(stickerReading({ name: 'Acadia', facts: [] }), 'Acadia.');
});
