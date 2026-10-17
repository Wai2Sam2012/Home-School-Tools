// Stage 4 tests: the adventure rules in js/adventure.js.
// Run from the arithmetic-odyssey folder with:  node --test
// Test IDs (T4.x) match the test plan in GAME-PLAN.md.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ADVENTURE_SCHEMA, MILESTONE_EVERY, answerProblem, jumpTo, lastMilestone, milestoneSteps, startAdventure,
  storyText, unlockSticker, withNextProblem,
} from '../js/adventure.js';
import { createSeededRandom } from '../js/math.js';
import { buildDinoStoryline } from '../tools/build-storyline.mjs';

const { storyline } = buildDinoStoryline();
const random = createSeededRandom(42);

function start(overrides = {}) {
  const state = startAdventure({ theme: 'dino', length: 20, detourLength: 3, operations: ['+'], difficulty: 'beginner', ...overrides });
  return withNextProblem(state, random);
}

/** Answers right (true) or wrong (false), then gets the next question. Returns { state, events }. */
function play(state, right) {
  const input = String(right ? state.problem.answer : state.problem.answer + 1);
  const result = answerProblem(state, input);
  assert.equal(result.check.ok, true);
  return { state: result.state.mode === 'done' ? result.state : withNextProblem(result.state, random), events: result.events };
}

function playMany(state, answers) {
  const events = [];
  for (const right of answers) {
    const r = play(state, right);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
}

const types = (events) => events.map((e) => e.type);

// ---------------------------------------------------------------- set-up
test('a new adventure starts at step 0 on the trail, with the setup and settings', () => {
  const s = start();
  assert.equal(s.schema, ADVENTURE_SCHEMA);
  assert.equal(s.mode, 'trail');
  assert.equal(s.step, 0);
  assert.equal(s.checkpoint, 0);
  assert.equal(s.detour, null);
  assert.deepEqual(s.stats, { answered: 0, correct: 0, detours: 0, setbacks: 0, thinkingMs: 0, missed: {} });
  assert.ok(s.problem && s.problem.op === '+');
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s, 'the state is plain data, so Stage 6 can save it');
});

test('bad settings are refused before the adventure starts', () => {
  assert.throws(() => start({ length: 0 }), /length/);
  assert.throws(() => start({ detourLength: 0 }), /detour/);
  assert.throws(() => start({ operations: [] }), /operation/i);
  assert.throws(() => start({ difficulty: 'expert' }), /difficulty/i);
});

test('an empty or invalid answer changes nothing, so the player can try again', () => {
  const s = start();
  for (const input of ['', '  ', 'abc', '12345']) {
    const r = answerProblem(s, input);
    assert.equal(r.check.ok, false);
    assert.equal(r.state, s);
    assert.deepEqual(r.events, []);
  }
});

// ---------------------------------------------------------------- T4.1
test('T4.1 a right answer on the trail moves one step', () => {
  const r = play(start(), true);
  assert.equal(r.state.step, 1);
  assert.equal(r.state.mode, 'trail');
  assert.deepEqual(types(r.events), ['right', 'step']);
  assert.equal(r.state.stats.correct, 1);
});

test('T4.1 a wrong answer on the trail starts a detour, stays on the same step and is logged for Need More Practice', () => {
  const s = playMany(start(), [true, true]).state;
  const missedKey = s.problem.key;
  const r = play(s, false);
  assert.equal(r.state.step, 2, 'no step forward');
  assert.equal(r.state.mode, 'detour');
  assert.deepEqual(r.state.detour, { number: 1, asked: 0, correct: 0 });
  assert.deepEqual(types(r.events), ['wrong', 'detour-start']);
  assert.equal(r.events[0].answer, s.problem.answer, 'the right answer is given back to show');
  assert.deepEqual(r.events[1], { type: 'detour-start', number: 1, length: 3 });
  assert.equal(r.state.stats.missed[missedKey], 1);
  assert.equal(r.state.stats.detours, 1);
});

// ---------------------------------------------------------------- T4.2
test('T4.2 a wrong answer inside a detour does not start another detour', () => {
  let s = play(start(), false).state;
  const r1 = play(s, false);
  assert.equal(r1.state.mode, 'detour');
  assert.deepEqual(r1.state.detour, { number: 1, asked: 1, correct: 0 });
  assert.deepEqual(types(r1.events), ['wrong', 'detour-question']);
  s = r1.state;
  const r2 = play(s, false);
  assert.equal(r2.state.stats.detours, 1, 'still only one detour');
  assert.ok(!types(r2.events).includes('detour-start'));
});

test('T4.2 detour misses also count for Need More Practice', () => {
  let s = play(start(), false).state; // the trail miss starts a detour
  const detourKey = s.problem.key;
  s = play(s, false).state; // a detour miss
  assert.equal(s.stats.missed[detourKey], 1);
  assert.equal(Object.values(s.stats.missed).reduce((a, b) => a + b, 0), 2);
});

// ---------------------------------------------------------------- T4.3
for (const pattern of [[true, false, false], [false, true, false], [false, false, true], [true, true, true]]) {
  test(`T4.3 a detour answered ${pattern.map((r) => (r ? 'right' : 'wrong')).join(', ')} returns to the same step`, () => {
    let s = playMany(start(), [true, true, true, true, true]).state;
    s = play(s, false).state;
    const r = playMany(s, pattern);
    assert.equal(r.state.mode, 'trail');
    assert.equal(r.state.step, 5);
    assert.equal(r.state.detour, null);
    assert.equal(types(r.events).filter((t) => t === 'detour-cleared').length, 1);
    assert.equal(r.events.find((e) => e.type === 'detour-cleared').correct, pattern.filter(Boolean).length);
  });
}

test('T4.3 the detour length setting decides how many detour questions there are', () => {
  for (const detourLength of [3, 5, 10]) {
    let s = play(start({ detourLength }), false).state;
    for (let i = 1; i < detourLength; i++) {
      s = play(s, true).state;
      assert.equal(s.mode, 'detour', `still in the detour after ${i} of ${detourLength}`);
    }
    s = play(s, true).state;
    assert.equal(s.mode, 'trail');
  }
});

// ---------------------------------------------------------------- T4.4
test('T4.4 a detour with every answer wrong goes back to step 0 before the first milestone', () => {
  let s = playMany(start(), Array(7).fill(true)).state;
  s = play(s, false).state;
  const r = playMany(s, [false, false, false]);
  assert.equal(r.state.step, 0);
  assert.equal(r.state.mode, 'trail');
  assert.deepEqual(r.events.at(-1), { type: 'setback', from: 7, to: 0 });
  assert.equal(r.state.stats.setbacks, 1);
});

test('T4.4 a detour with every answer wrong goes back to the last milestone, keeping the same settings', () => {
  const first = start({ length: 40, detourLength: 4, operations: ['×', '÷'], difficulty: 'intermediate' });
  let s = playMany(first, Array(23).fill(true)).state;
  assert.equal(s.checkpoint, 20);
  s = play(s, false).state;
  const r = playMany(s, [false, false, false, false]);
  assert.equal(r.state.step, 20);
  assert.equal(r.state.checkpoint, 20);
  for (const key of ['length', 'detourLength', 'operations', 'difficulty', 'theme']) assert.deepEqual(r.state[key], first[key], key);
  // ... and the adventure carries on from there.
  const after = play(r.state, true);
  assert.equal(after.state.step, 21);
});

test('T4.4 a setback is never shown as "game over": the trail just continues', () => {
  let s = play(start(), false).state;
  const r = playMany(s, [false, false, false]);
  assert.equal(r.state.mode, 'trail');
  assert.ok(r.state.problem, 'there is a next question');
});

// ---------------------------------------------------------------- T4.5
test('T4.5 milestones fall every 10 steps, and the destination is not a milestone', () => {
  assert.equal(MILESTONE_EVERY, 10);
  assert.deepEqual(milestoneSteps(20), [10]);
  assert.deepEqual(milestoneSteps(100), [10, 20, 30, 40, 50, 60, 70, 80, 90]);
  assert.deepEqual(milestoneSteps(25), [10, 20]);
  assert.deepEqual(lastMilestone(0), 0);
  assert.deepEqual(lastMilestone(19), 10);
  assert.deepEqual(lastMilestone(20), 20);
});

test('T4.5 reaching a milestone saves it as the checkpoint, with its number for the story', () => {
  const r = playMany(start({ length: 40 }), Array(20).fill(true));
  const milestones = r.events.filter((e) => e.type === 'milestone');
  assert.deepEqual(milestones, [{ type: 'milestone', step: 10, number: 1 }, { type: 'milestone', step: 20, number: 2 }]);
  assert.equal(r.state.checkpoint, 20);
});

test('T4.5 going back to a flag and reaching it again keeps the same checkpoint', () => {
  let s = playMany(start({ length: 40 }), Array(12).fill(true)).state;
  s = playMany(s, [false, false, false, false]).state;
  assert.equal(s.step, 10);
  assert.equal(s.checkpoint, 10);
});

// ---------------------------------------------------------------- T4.6
test('T4.6 trail and detour questions use only the selected operations', () => {
  for (const operations of [['−'], ['×', '÷'], ['+', '−', '×', '÷']]) {
    let s = start({ operations, difficulty: 'advanced', length: 100, detourLength: 10 });
    const seen = new Set();
    for (let i = 0; i < 300 && s.mode !== 'done'; i++) {
      seen.add(s.problem.op);
      assert.ok(operations.includes(s.problem.op), `${s.problem.op} in ${s.mode}`);
      s = play(s, i % 3 !== 0).state; // a mix of right and wrong, so detours happen
    }
    assert.deepEqual([...seen].sort(), [...operations].sort());
  }
});

test('T4.6 the same question never comes twice in a row, including into and out of a detour', () => {
  let s = start({ difficulty: 'beginner', operations: ['+'], length: 100 });
  let previous = null;
  for (let i = 0; i < 500 && s.mode !== 'done'; i++) {
    assert.notEqual(s.problem.key, previous);
    previous = s.problem.key;
    s = play(s, i % 4 !== 0).state;
  }
});

// ---------------------------------------------------------------- finishing and T4.7
test('a 20-step trail finishes on the 20th right answer, with no milestone at the finish', () => {
  const r = playMany(start(), Array(20).fill(true));
  assert.equal(r.state.mode, 'done');
  assert.equal(r.state.step, 20);
  assert.deepEqual(types(r.events).slice(-3), ['right', 'step', 'finished']);
  assert.equal(r.events.filter((e) => e.type === 'milestone').length, 1);
  assert.throws(() => answerProblem(r.state, '1'), /no question/);
  assert.equal(withNextProblem(r.state, random), r.state, 'no new question once finished');
});

test('the trip summary counts answers, detours and setbacks', () => {
  let s = start();
  s = playMany(s, [true, true, false, false, false, false]).state; // detour, all wrong -> back to 0
  s = playMany(s, [false, true, false, false]).state; // detour, cleared
  const { stats } = s;
  assert.equal(stats.answered, 10);
  assert.equal(stats.correct, 3);
  assert.equal(stats.detours, 2);
  assert.equal(stats.setbacks, 1);
});

test('T4.7 finishing unlocks the next sticker in order for that player', () => {
  const first = unlockSticker(storyline, []);
  assert.equal(first.sticker.name, 'Eoraptor');
  assert.deepEqual(first.collected, ['eoraptor']);
  const second = unlockSticker(storyline, first.collected);
  assert.equal(second.sticker.name, 'Herrerasaurus');
  const twentyOne = unlockSticker(storyline, storyline.stickers.slice(0, 20).map((s) => s.id));
  assert.equal(twentyOne.sticker.name, 'Stegosaurus', 'after the Triassic come the Jurassic dinosaurs');
});

test('T4.7 with every sticker collected, nothing new is unlocked ("Collection complete!")', () => {
  const all = storyline.stickers.map((s) => s.id);
  const r = unlockSticker(storyline, all);
  assert.equal(r.sticker, null);
  assert.deepEqual(r.collected, all);
});

test('T4.7 each player has their own place in the order', () => {
  const ana = unlockSticker(storyline, ['eoraptor', 'herrerasaurus']);
  const ben = unlockSticker(storyline, []);
  assert.equal(ana.sticker.name, 'Coelophysis');
  assert.equal(ben.sticker.name, 'Eoraptor');
});

// ---------------------------------------------------------------- story text
test('story text: milestones in order, detours with the question count, kind setbacks', () => {
  assert.equal(storyText(storyline, { type: 'milestone', number: 1 }), storyline.milestones[0]);
  assert.equal(storyText(storyline, { type: 'milestone', number: 11 }), storyline.milestones[0], 'wraps around if there are more flags than texts');
  const detour = storyText(storyline, { type: 'detour-start', number: 1, length: 5 });
  assert.match(detour, /5/);
  assert.doesNotMatch(detour, /\{count\}/);
  assert.ok(storyline.setback.includes(storyText(storyline, { type: 'setback' }, () => 0)));
  assert.ok(storyline.detourCleared.includes(storyText(storyline, { type: 'detour-cleared' }, () => 0.99)));
  assert.equal(storyText(storyline, { type: 'right' }), '');
});

// ---------------------------------------------------------------- debug jump
test('the debug jump moves to a step with the checkpoint at the flag before it', () => {
  const s = jumpTo(start({ length: 40 }), 29);
  assert.equal(s.step, 29);
  assert.equal(s.checkpoint, 20);
  assert.equal(jumpTo(start(), 99).step, 19, 'never past the last step');
  assert.equal(jumpTo(start(), -5).step, 0);
  const inDetour = play(start(), false).state;
  assert.equal(jumpTo(inDetour, 5).mode, 'trail', 'a jump leaves any detour');
});

// ---------------------------------------------------------------- detour road (trail map)
test('the detour road: the icon goes round the loop as detour questions are answered', async () => {
  const { loopProgress, loopsLeft } = await import('../js/detour-road.js');
  const steps = [0, 1, 2, 3].map((asked) => loopProgress(asked, 3));
  for (let i = 1; i < steps.length; i++) assert.ok(steps[i] > steps[i - 1], 'moves forward with each answer');
  assert.ok(steps[0] > 0 && steps[0] < 0.2, 'just off the trail at the start');
  assert.ok(steps[3] < 1 && steps[3] > 0.85, 'nearly back at the trail after the last question');
  assert.equal(loopProgress(10, 3), steps[3], 'never past the end');
  assert.equal(loopProgress(-1, 3), steps[0]);
  assert.equal(loopsLeft(30), false);
  assert.equal(loopsLeft(80), true, 'near the finish the loop turns back so it stays on the map');
});
