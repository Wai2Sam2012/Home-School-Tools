// Learn from Incorrect: a calm practice round with the problems from Need
// More Practice (js/scores.js). No trail, detours or setbacks.
//
//   Every problem not learned yet is in the round at once, and the next one is
//     picked at random each time (never the same one twice in a row).
//   Each problem needs LEARN_NEEDS right answers to be learned; a wrong answer
//     starts its count again. A problem that was slow (not missed) also has to
//     be answered within SLOW_MS.
//   The round ends when every problem is learned, or after a few tries each
//     (so it never goes on and on); unlearned problems stay on the list.

import { checkAnswer, restoreProblem } from './math.js?v=0.7.6';
import { PRACTICE_SIZE, SLOW_MS } from './scores.js?v=0.7.6';

export const LEARN_NEEDS = 3;
export const LEARN_MAX_PROBLEMS = PRACTICE_SIZE;
// The round stops after this many questions per problem, learned or not.
export const TRIES_PER_PROBLEM = 6;

/** A problem picked at random from the ones still to learn, not the one just asked (unless it is the only one). */
function pickNext(items, lastKey, random) {
  const open = items.filter((i) => !i.learned);
  if (open.length === 0) return null;
  const choices = open.length > 1 ? open.filter((i) => i.key !== lastKey) : open;
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))].key;
}

/** "7×8" -> the problem 7 × 8 (or null if the key isn't a real problem). */
export function problemFromKey(key) {
  const match = /^(\d{1,4})([+−×÷])(\d{1,4})$/.exec(String(key));
  return match ? restoreProblem({ op: match[2], a: Number(match[1]), b: Number(match[3]) }) : null;
}

/**
 * A new round from Need More Practice items ([{ key, missed, slowMs }]).
 * Returns null if there is nothing to practice. random is Math.random (or a
 * seeded one in tests).
 */
export function startLearning(practice, { max = LEARN_MAX_PROBLEMS, random = Math.random } = {}) {
  const items = [];
  for (const p of practice) {
    const problem = problemFromKey(p.key);
    if (!problem || items.some((i) => i.key === p.key)) continue;
    items.push({ key: p.key, problem, mustBeQuick: !p.missed, right: 0, wrong: 0, learned: false });
    if (items.length >= max) break;
  }
  if (items.length === 0) return null;
  return {
    items,
    current: pickNext(items, null, random),
    asked: 0,
    limit: items.length * TRIES_PER_PROBLEM,
    done: false,
  };
}

/** The problem being asked now (null when the round is over). */
export function currentProblem(state) {
  if (state.done) return null;
  return state.items.find((i) => i.key === state.current)?.problem ?? null;
}

/**
 * Answers the current problem. Returns { state, check, events }; if check.ok
 * is false (empty or invalid input) nothing changes. Events, in order:
 *   { type: 'right' } / { type: 'right', tooSlow: true } / { type: 'wrong', answer }
 *   { type: 'learned', key, text }
 *   { type: 'finished', learned: [keys], total }
 */
export function answerLearning(state, input, { thinkingMs = 0, random = Math.random } = {}) {
  if (state.done) throw new Error('The round is over.');
  const key = state.current;
  const item = state.items.find((i) => i.key === key);
  const check = checkAnswer(item.problem, input);
  if (!check.ok) return { state, check, events: [] };

  const events = [];
  const tooSlow = check.correct && item.mustBeQuick && thinkingMs >= SLOW_MS;
  const counts = check.correct && !tooSlow;
  const updated = {
    ...item,
    right: item.right + (counts ? 1 : 0),
    wrong: item.wrong + (check.correct ? 0 : 1),
  };
  // A wrong answer starts the count again.
  if (!check.correct) updated.right = 0;
  updated.learned = updated.right >= LEARN_NEEDS;

  if (check.correct) events.push(tooSlow ? { type: 'right', tooSlow: true } : { type: 'right' });
  else events.push({ type: 'wrong', answer: item.problem.answer });
  if (updated.learned) events.push({ type: 'learned', key, text: item.problem.text });

  const items = state.items.map((i) => (i.key === key ? updated : i));
  const asked = state.asked + 1;
  const next = pickNext(items, key, random);
  const done = next === null || asked >= state.limit;
  if (done) events.push({ type: 'finished', learned: items.filter((i) => i.learned).map((i) => i.key), total: items.length });
  return { state: { ...state, items, current: done ? null : next, asked, done }, check, events };
}
