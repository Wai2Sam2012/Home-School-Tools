// Math engine: problem generation and answer checking (Game Plan 1.7).
//
// Plain ES module with no browser APIs, so the same file runs in the game
// and in the Node.js tests (`node --test`).
//
// Number sizes: a "1-digit" operand is 1-9 and a "2-digit" operand is 10-99
// (0 is never an operand, which keeps problems meaningful). Answers can be 0
// only in subtraction, e.g. 7 - 7. Giveaways (by 1, or a number take away
// itself) are limited: see GIVEAWAY_EVERY.

export const OPERATIONS = Object.freeze(['+', '−', '×', '÷']);
export const DIFFICULTIES = Object.freeze(['beginner', 'intermediate', 'advanced']);

// The largest possible answer is 99 × 99 = 9801, so 4 digits is always enough.
export const MAX_ANSWER_DIGITS = 4;

const SPOKEN = { '+': 'plus', '−': 'minus', '×': 'times', '÷': 'divided by' };

// ---------------------------------------------------------------------------
// Random numbers
// ---------------------------------------------------------------------------

/**
 * A small seeded random number generator (mulberry32). Returns a function
 * like Math.random. Used by the tests and the debug panel to repeat a game.
 */
export function createSeededRandom(seed) {
  let t = seed >>> 0;
  return function random() {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

const ONE_DIGIT = [1, 9];
const TWO_DIGIT = [10, 99];

// ---------------------------------------------------------------------------
// Problem generation, one function per operation
// ---------------------------------------------------------------------------

// Addition and multiplication: the operand sizes for each difficulty. For
// mixed sizes (2-digit and 1-digit) the order is random, since both orders
// are the same problem for the child.
const OPERAND_SIZES = {
  beginner: [ONE_DIGIT, ONE_DIGIT],
  intermediate: [TWO_DIGIT, ONE_DIGIT],
  advanced: [TWO_DIGIT, TWO_DIGIT],
};

function twoOperands(difficulty, random) {
  const [first, second] = OPERAND_SIZES[difficulty];
  let a = randomInt(random, first[0], first[1]);
  let b = randomInt(random, second[0], second[1]);
  if (first !== second && random() < 0.5) [a, b] = [b, a];
  return [a, b];
}

function makeAddition(difficulty, random) {
  const [a, b] = twoOperands(difficulty, random);
  return makeProblem('+', a, b, a + b);
}

function makeMultiplication(difficulty, random) {
  const [a, b] = twoOperands(difficulty, random);
  return makeProblem('×', a, b, a * b);
}

// Subtraction: the larger number always comes first, so the answer is never
// negative. Intermediate is always 2-digit minus 1-digit.
function makeSubtraction(difficulty, random) {
  const [first, second] = OPERAND_SIZES[difficulty];
  let a = randomInt(random, first[0], first[1]);
  let b = randomInt(random, second[0], second[1]);
  if (b > a) [a, b] = [b, a];
  return makeProblem('−', a, b, a - b);
}

// Division: pick the divisor and the answer, then multiply them to get the
// dividend, so the answer is always a whole number. The answer range is
// chosen so the dividend has the right number of digits, with no retries.
//   beginner:     divisor 1-9,   answer 1-9            (dividend up to 81)
//   intermediate: divisor 1-9,   2-digit dividend 10-99
//   advanced:     divisor 10-99, 3-digit dividend 100-999, answer 2-99
const DIVISION = {
  beginner: { divisor: ONE_DIGIT, dividend: [1, 81], answer: [1, 9] },
  intermediate: { divisor: ONE_DIGIT, dividend: [10, 99], answer: [1, 99] },
  advanced: { divisor: TWO_DIGIT, dividend: [100, 999], answer: [2, 99] },
};

function makeDivision(difficulty, random) {
  const rule = DIVISION[difficulty];
  const divisor = randomInt(random, rule.divisor[0], rule.divisor[1]);
  const lowest = Math.max(rule.answer[0], Math.ceil(rule.dividend[0] / divisor));
  const highest = Math.min(rule.answer[1], Math.floor(rule.dividend[1] / divisor));
  const answer = randomInt(random, lowest, highest);
  return makeProblem('÷', divisor * answer, divisor, answer);
}

const MAKERS = {
  '+': makeAddition,
  '−': makeSubtraction,
  '×': makeMultiplication,
  '÷': makeDivision,
};

function makeProblem(op, a, b, answer) {
  return Object.freeze({
    op,
    a,
    b,
    answer,
    text: `${a} ${op} ${b}`, // shown on screen: "7 × 8"
    key: `${a}${op}${b}`, // stored in stats: "7×8"
    speech: `${a} ${SPOKEN[op]} ${b}`, // read aloud: "7 times 8"
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Giveaway problems: anything added, taken away, multiplied or divided by 1,
// and a number take away itself (answer 0). Beginner gets at most one in any
// GIVEAWAY_EVERY questions in a row; Intermediate and Advanced never get one.
export const GIVEAWAY_EVERY = 20;

/** True for a giveaway problem (see GIVEAWAY_EVERY). */
export function isGiveaway(problem) {
  const { op, a, b } = problem;
  if (op === '÷') return b === 1;
  if (op === '−') return b === 1 || a === b;
  return a === 1 || b === 1;
}

/** Whether a giveaway may come next, sinceGiveaway questions after the last one (null: none yet). */
export function giveawayAllowed(difficulty, sinceGiveaway = null) {
  if (difficulty !== 'beginner') return false;
  return sinceGiveaway === null || sinceGiveaway >= GIVEAWAY_EVERY - 1;
}

/**
 * A saved problem made whole again (its text, key and spoken words), or null
 * if it is not a real problem (a damaged save).
 */
export function restoreProblem(saved) {
  if (!saved || typeof saved !== 'object' || !MAKERS[saved.op]) return null;
  const { op, a, b } = saved;
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return null;
  const answer = { '+': a + b, '−': a - b, '×': a * b, '÷': b === 0 ? NaN : a / b }[op];
  if (!Number.isInteger(answer) || answer < 0) return null;
  return makeProblem(op, a, b, answer);
}

function checkSettings(operations, difficulty) {
  if (!Array.isArray(operations) || operations.length === 0) {
    throw new Error('Select at least one operation.');
  }
  for (const op of operations) {
    if (!OPERATIONS.includes(op)) throw new Error(`Unknown operation: ${op}`);
  }
  if (!DIFFICULTIES.includes(difficulty)) {
    throw new Error(`Unknown difficulty: ${difficulty}`);
  }
}

/** Makes one problem for an operation and difficulty. */
export function generateProblem(op, difficulty, random = Math.random) {
  checkSettings([op], difficulty);
  return MAKERS[op](difficulty, random);
}

/**
 * Creates a problem generator for the player's settings. Each call to
 * next() returns a new problem using only the selected operations, and never
 * the same problem twice in a row.
 *
 * @param {object} settings
 * @param {string[]} settings.operations - one or more of OPERATIONS
 * @param {string} settings.difficulty - one of DIFFICULTIES
 * @param {() => number} [settings.random] - defaults to Math.random
 * @param {string} [settings.lastKey] - key of the previous problem, so a
 *   resumed adventure does not repeat it either
 * @param {number|null} [settings.sinceGiveaway] - questions since the last
 *   giveaway (null: none yet), so the limit carries on in a resumed adventure
 */
export function createProblemGenerator({ operations, difficulty, random = Math.random, lastKey = null, sinceGiveaway = null }) {
  checkSettings(operations, difficulty);
  const ops = [...new Set(operations)];
  let previous = lastKey;
  let since = sinceGiveaway;
  return {
    next() {
      let problem;
      do {
        const op = ops[Math.floor(random() * ops.length)];
        problem = MAKERS[op](difficulty, random);
      } while (problem.key === previous || (isGiveaway(problem) && !giveawayAllowed(difficulty, since)));
      previous = problem.key;
      since = isGiveaway(problem) ? 0 : since === null ? null : since + 1;
      return problem;
    },
    /** Questions since the last giveaway (null: none yet). */
    sinceGiveaway: () => since,
  };
}

/**
 * Checks the player's answer from the keypad.
 * Returns { ok: true, correct } for a usable answer, or
 * { ok: false, reason } when the input can't be checked:
 * 'empty', 'not-a-number' or 'too-long'.
 */
export function checkAnswer(problem, input) {
  const text = String(input ?? '').trim();
  if (text === '') return { ok: false, reason: 'empty' };
  if (!/^[0-9]+$/.test(text)) return { ok: false, reason: 'not-a-number' };
  if (text.length > MAX_ANSWER_DIGITS) return { ok: false, reason: 'too-long' };
  return { ok: true, correct: Number(text) === problem.answer };
}
