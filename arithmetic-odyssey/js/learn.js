// Learn from Incorrect: a short, calm practice round with the problems from
// Need More Practice (js/scores.js). No trail, detours or setbacks.
//
//   Each problem needs LEARN_NEEDS right answers to be learned. A problem that
//     was slow (not missed) also has to be answered within SLOW_MS.
//   After an answer that isn't enough yet, the problem comes back a couple of
//     questions later (LEARN_SPACING), so it is practised, not just repeated.
//   The round ends when every problem is learned, or after a few tries each
//     (so it never goes on and on); unlearned problems stay on the list.

import { checkAnswer, restoreProblem } from './math.js?v=0.6.3';
import { SLOW_MS } from './scores.js?v=0.6.3';

export const LEARN_NEEDS = 2;
export const LEARN_SPACING = 2;
export const LEARN_MAX_PROBLEMS = 8;
// The round stops after this many questions per problem, learned or not.
const TRIES_PER_PROBLEM = 4;

/** "7×8" -> the problem 7 × 8 (or null if the key isn't a real problem). */
export function problemFromKey(key) {
  const match = /^(\d{1,4})([+−×÷])(\d{1,4})$/.exec(String(key));
  return match ? restoreProblem({ op: match[2], a: Number(match[1]), b: Number(match[3]) }) : null;
}

/**
 * A new round from Need More Practice items ([{ key, missed, slowMs }]).
 * Returns null if there is nothing to practise.
 */
export function startLearning(practice, { max = LEARN_MAX_PROBLEMS } = {}) {
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
    queue: items.map((i) => i.key),
    asked: 0,
    limit: items.length * TRIES_PER_PROBLEM,
    done: false,
  };
}

/** The problem being asked now (null when the round is over). */
export function currentProblem(state) {
  if (state.done) return null;
  return state.items.find((i) => i.key === state.queue[0])?.problem ?? null;
}

/**
 * Answers the current problem. Returns { state, check, events }; if check.ok
 * is false (empty or invalid input) nothing changes. Events, in order:
 *   { type: 'right' } / { type: 'right', tooSlow: true } / { type: 'wrong', answer }
 *   { type: 'learned', key, text }
 *   { type: 'finished', learned: [keys], total }
 */
export function answerLearning(state, input, { thinkingMs = 0 } = {}) {
  if (state.done) throw new Error('The round is over.');
  const key = state.queue[0];
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

  const queue = state.queue.slice(1);
  if (!updated.learned) queue.splice(Math.min(LEARN_SPACING, queue.length), 0, key);
  const items = state.items.map((i) => (i.key === key ? updated : i));
  const asked = state.asked + 1;
  const done = queue.length === 0 || asked >= state.limit;
  if (done) events.push({ type: 'finished', learned: items.filter((i) => i.learned).map((i) => i.key), total: items.length });
  return { state: { ...state, items, queue, asked, done }, check, events };
}
