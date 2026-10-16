// Stage 1 tests for js/math.js. Run from the arithmetic-odyssey folder with:
//   node --test
// Test IDs (T1.x) match the test plan in GAME-PLAN.md.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OPERATIONS,
  DIFFICULTIES,
  MAX_ANSWER_DIGITS,
  createSeededRandom,
  generateProblem,
  createProblemGenerator,
  checkAnswer,
} from '../js/math.js';

const RUNS = 10_000;
const digits = (n) => String(n).length;
const isOneDigit = (n) => n >= 1 && n <= 9;
const isTwoDigit = (n) => n >= 10 && n <= 99;

function* problems(op, difficulty, seed = 1, count = RUNS) {
  const random = createSeededRandom(seed);
  for (let i = 0; i < count; i++) yield generateProblem(op, difficulty, random);
}

function compute(p) {
  switch (p.op) {
    case '+': return p.a + p.b;
    case '−': return p.a - p.b;
    case '×': return p.a * p.b;
    case '÷': return p.a / p.b;
  }
}

// Expected operand sizes from the table in GAME-PLAN.md 1.7.
// For + and × the order of a mixed pair can be either way round.
const SIZE_RULES = {
  '+': {
    beginner: (p) => isOneDigit(p.a) && isOneDigit(p.b),
    intermediate: (p) => (isTwoDigit(p.a) && isOneDigit(p.b)) || (isOneDigit(p.a) && isTwoDigit(p.b)),
    advanced: (p) => isTwoDigit(p.a) && isTwoDigit(p.b),
  },
  '−': {
    beginner: (p) => isOneDigit(p.a) && isOneDigit(p.b),
    intermediate: (p) => isTwoDigit(p.a) && isOneDigit(p.b),
    advanced: (p) => isTwoDigit(p.a) && isTwoDigit(p.b),
  },
  '×': {
    beginner: (p) => isOneDigit(p.a) && isOneDigit(p.b),
    intermediate: (p) => (isTwoDigit(p.a) && isOneDigit(p.b)) || (isOneDigit(p.a) && isTwoDigit(p.b)),
    advanced: (p) => isTwoDigit(p.a) && isTwoDigit(p.b),
  },
  '÷': {
    beginner: (p) => isOneDigit(p.b) && isOneDigit(p.answer),
    intermediate: (p) => isTwoDigit(p.a) && isOneDigit(p.b),
    advanced: (p) => digits(p.a) === 3 && isTwoDigit(p.b) && p.answer >= 2 && p.answer <= 99,
  },
};

// ---------------------------------------------------------------- T1.1
test('T1.1 every operation and difficulty follows the digit rules and gives the right answer', () => {
  for (const op of OPERATIONS) {
    for (const difficulty of DIFFICULTIES) {
      let n = 0;
      for (const p of problems(op, difficulty)) {
        n++;
        assert.ok(SIZE_RULES[op][difficulty](p), `${difficulty} ${p.text} breaks the digit rules`);
        assert.equal(p.answer, compute(p), `${p.text} has the wrong answer ${p.answer}`);
        assert.ok(Number.isInteger(p.answer), `${p.text} answer is not a whole number`);
        assert.ok(digits(p.answer) <= MAX_ANSWER_DIGITS, `${p.text} answer is too long`);
      }
      assert.equal(n, RUNS);
    }
  }
});

test('T1.1 problems are varied: every Beginner + and × pair (1-9 by 1-9) appears', () => {
  for (const op of ['+', '×']) {
    const seen = new Set();
    for (const p of problems(op, 'beginner', 7)) seen.add(`${p.a},${p.b}`);
    assert.equal(seen.size, 81, `${op}: only ${seen.size} of 81 pairs appeared`);
  }
});

test('T1.1 problems use the full number range at every difficulty', () => {
  for (const op of OPERATIONS) {
    for (const difficulty of DIFFICULTIES) {
      const answers = new Set();
      for (const p of problems(op, difficulty, 3)) answers.add(p.answer);
      assert.ok(answers.size >= 9, `${op} ${difficulty}: only ${answers.size} different answers`);
    }
  }
});

// ---------------------------------------------------------------- T1.2
test('T1.2 subtraction answers are never negative', () => {
  for (const difficulty of DIFFICULTIES) {
    for (const p of problems('−', difficulty, 11)) {
      assert.ok(p.answer >= 0, `${p.text} = ${p.answer}`);
      assert.ok(p.a >= p.b, `${p.text}: the larger number must come first`);
    }
  }
});

// ---------------------------------------------------------------- T1.3
test('T1.3 division always gives a whole number and never divides by 0', () => {
  for (const difficulty of DIFFICULTIES) {
    for (const p of problems('÷', difficulty, 13)) {
      assert.notEqual(p.b, 0, `${p.text} divides by 0`);
      assert.equal(p.a % p.b, 0, `${p.text} does not divide evenly`);
      assert.equal(p.a, p.b * p.answer);
    }
  }
});

test('T1.3 Advanced division is a 3-digit number divided by a 2-digit number', () => {
  const answers = new Set();
  for (const p of problems('÷', 'advanced', 17)) {
    assert.ok(p.a >= 100 && p.a <= 999, `${p.text}: dividend must have 3 digits`);
    assert.ok(p.b >= 10 && p.b <= 99, `${p.text}: divisor must have 2 digits`);
    answers.add(p.answer);
  }
  // Answers should cover most of 2-99, not just small numbers.
  assert.ok(answers.size >= 80, `only ${answers.size} different answers`);
  assert.ok(Math.max(...answers) >= 90 && Math.min(...answers) === 2);
});

test('T1.3 Beginner division answers and divisors are 1-9; Intermediate dividends are 10-99', () => {
  for (const p of problems('÷', 'beginner', 19)) {
    assert.ok(isOneDigit(p.b) && isOneDigit(p.answer), p.text);
  }
  for (const p of problems('÷', 'intermediate', 23)) {
    assert.ok(isTwoDigit(p.a) && isOneDigit(p.b), p.text);
  }
});

// ---------------------------------------------------------------- T1.4
function allSubsets(items) {
  const result = [];
  for (let mask = 1; mask < 1 << items.length; mask++) {
    result.push(items.filter((_, i) => mask & (1 << i)));
  }
  return result;
}

test('T1.4 only the selected operations appear (all 15 combinations)', () => {
  for (const operations of allSubsets([...OPERATIONS])) {
    for (const difficulty of DIFFICULTIES) {
      const generator = createProblemGenerator({ operations, difficulty, random: createSeededRandom(29) });
      const used = new Set();
      for (let i = 0; i < 2_000; i++) used.add(generator.next().op);
      assert.deepEqual([...used].sort(), [...operations].sort(), `selected ${operations.join(' ')}`);
    }
  }
});

test('T1.4 operations are picked about equally often', () => {
  const generator = createProblemGenerator({ operations: [...OPERATIONS], difficulty: 'intermediate', random: createSeededRandom(31) });
  const counts = Object.fromEntries(OPERATIONS.map((op) => [op, 0]));
  for (let i = 0; i < RUNS; i++) counts[generator.next().op]++;
  for (const op of OPERATIONS) {
    assert.ok(counts[op] > RUNS * 0.2 && counts[op] < RUNS * 0.3, `${op} picked ${counts[op]} times`);
  }
});

test('T1.4 selecting no operation, an unknown operation or an unknown difficulty is rejected', () => {
  assert.throws(() => createProblemGenerator({ operations: [], difficulty: 'beginner' }), /at least one operation/);
  assert.throws(() => createProblemGenerator({ difficulty: 'beginner' }), /at least one operation/);
  assert.throws(() => createProblemGenerator({ operations: ['%'], difficulty: 'beginner' }), /Unknown operation/);
  assert.throws(() => createProblemGenerator({ operations: ['+'], difficulty: 'expert' }), /Unknown difficulty/);
  assert.throws(() => generateProblem('-', 'beginner'), /Unknown operation/, 'a plain hyphen is not the minus sign');
});

// ---------------------------------------------------------------- T1.5
test('T1.5 the same problem never appears twice in a row', () => {
  for (const operations of allSubsets([...OPERATIONS])) {
    for (const difficulty of DIFFICULTIES) {
      const generator = createProblemGenerator({ operations, difficulty, random: createSeededRandom(37) });
      let previous = null;
      for (let i = 0; i < 3_000; i++) {
        const p = generator.next();
        assert.notEqual(p.key, previous, `${p.key} repeated (${operations.join(' ')}, ${difficulty})`);
        previous = p.key;
      }
    }
  }
});

test('T1.5 a resumed adventure does not repeat the last problem before it was closed', () => {
  // A random source that gives 0 for the first three draws (operation, a, b)
  // produces 1 + 1, then 0.5 for everything after, which produces 5 + 5.
  const scripted = () => {
    let calls = 0;
    return () => (calls++ < 3 ? 0 : 0.5);
  };
  const fresh = createProblemGenerator({ operations: ['+'], difficulty: 'beginner', random: scripted() });
  assert.equal(fresh.next().key, '1+1', 'without lastKey the first problem is 1+1');

  const resumed = createProblemGenerator({ operations: ['+'], difficulty: 'beginner', random: scripted(), lastKey: '1+1' });
  assert.equal(resumed.next().key, '5+5', 'with lastKey 1+1 it must pick something else');
});

// ---------------------------------------------------------------- T1.6
test('T1.6 answer checking accepts the right answer and rejects wrong answers', () => {
  const p = generateProblem('×', 'beginner', createSeededRandom(43));
  assert.deepEqual(checkAnswer(p, String(p.answer)), { ok: true, correct: true });
  assert.deepEqual(checkAnswer(p, String(p.answer + 1)), { ok: true, correct: false });
  assert.deepEqual(checkAnswer(p, p.answer), { ok: true, correct: true }, 'a number works as well as text');
  assert.deepEqual(checkAnswer(p, `0${p.answer}`), { ok: true, correct: true }, 'a leading zero is fine');
});

test('T1.6 answer checking rejects empty, non-number and too-long input', () => {
  const p = generateProblem('+', 'beginner', createSeededRandom(47));
  assert.deepEqual(checkAnswer(p, ''), { ok: false, reason: 'empty' });
  assert.deepEqual(checkAnswer(p, '   '), { ok: false, reason: 'empty' });
  assert.deepEqual(checkAnswer(p, undefined), { ok: false, reason: 'empty' });
  assert.deepEqual(checkAnswer(p, '-3'), { ok: false, reason: 'not-a-number' });
  assert.deepEqual(checkAnswer(p, '4.5'), { ok: false, reason: 'not-a-number' });
  assert.deepEqual(checkAnswer(p, '1 2'), { ok: false, reason: 'not-a-number' });
  assert.deepEqual(checkAnswer(p, '12345'), { ok: false, reason: 'too-long' });
});

test('T1.6 a subtraction answer of 0 can be checked', () => {
  const random = createSeededRandom(53);
  for (let i = 0; i < 5_000; i++) {
    const p = generateProblem('−', 'beginner', random);
    if (p.answer === 0) {
      assert.deepEqual(checkAnswer(p, '0'), { ok: true, correct: true });
      return;
    }
  }
  assert.fail('no subtraction problem with answer 0 was generated');
});

// ---------------------------------------------------------------- extras
test('problems have display, storage and spoken text', () => {
  const p = generateProblem('÷', 'beginner', createSeededRandom(59));
  assert.equal(p.text, `${p.a} ÷ ${p.b}`);
  assert.equal(p.key, `${p.a}÷${p.b}`);
  assert.equal(p.speech, `${p.a} divided by ${p.b}`);
  assert.ok(Object.isFrozen(p), 'problems cannot be changed by accident');
});

test('the seeded random generator repeats exactly, so a game can be replayed', () => {
  const run = (seed) => {
    const g = createProblemGenerator({ operations: [...OPERATIONS], difficulty: 'advanced', random: createSeededRandom(seed) });
    return Array.from({ length: 50 }, () => g.next().key);
  };
  assert.deepEqual(run(61), run(61));
  assert.notDeepEqual(run(61), run(62));
});
