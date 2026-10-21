// The adventure rules (GAME-PLAN.md 1.8), with no screen code so they can be
// tested on their own. The state is plain data, so it can be saved (js/profiles.js).
//
//   Main trail: a right answer moves one step; a wrong one starts a detour.
//   Milestones: every 10 steps; each one reached becomes the checkpoint.
//   Detour: detourLength questions, each answered once. At least one right
//     clears it (back to the same step); all wrong goes back to the checkpoint.
//   The trail ends at step `length`, and the next sticker is unlocked.
//   A missed question comes back AGAIN_AFTER questions later (0.7.2).

import { checkAnswer, createProblemGenerator, isGiveaway, restoreProblem } from './math.js?v=0.7.5';
import { collectNext, nextSticker } from './storyline.js?v=0.7.5';

export const ADVENTURE_SCHEMA = 1;
export const MILESTONE_EVERY = 10;
// A missed question is asked again after this many other questions, once for each miss.
// (wait counts down by one as each next question is picked; at 0 it is its turn).
export const AGAIN_AFTER = 3;
// At most this many missed questions wait to come back (the oldest are dropped).
export const AGAIN_MAX = 5;
// Praise for right answers in a row: at 5, 10, 15, ...
export const STREAK_EVERY = 5;

/** The milestone steps on a trail: 10, 20, ... (the last step is the destination, not a milestone). */
export function milestoneSteps(length) {
  const steps = [];
  for (let step = MILESTONE_EVERY; step < length; step += MILESTONE_EVERY) steps.push(step);
  return steps;
}

/** The last milestone at or before this step (0 = the start). */
export function lastMilestone(step) {
  return Math.floor(step / MILESTONE_EVERY) * MILESTONE_EVERY;
}

/** A new adventure with the player's setup and settings. Throws if they are not valid. */
export function startAdventure({ theme, length, detourLength, operations, difficulty }) {
  if (!Number.isInteger(length) || length < 1) throw new Error('The adventure length must be a whole number of steps.');
  if (!Number.isInteger(detourLength) || detourLength < 1) throw new Error('The detour length must be a whole number of questions.');
  // Checks the operations and difficulty now, rather than on the first question.
  createProblemGenerator({ operations, difficulty });
  return {
    schema: ADVENTURE_SCHEMA,
    theme,
    length,
    detourLength,
    operations: [...operations],
    difficulty,
    mode: 'trail', // 'trail', 'detour' or 'done'
    step: 0,
    checkpoint: 0,
    detour: null, // { number, asked, correct } while in a detour
    problem: null,
    lastKey: null,
    tipFor: null, // the problem whose counting tip has been shown (counted once per question)
    isAgain: false, // the problem is one missed earlier in this trip, asked again
    again: [], // missed problems waiting to come back: { op, a, b, wait }
    sinceGiveaway: null, // questions since the last giveaway (js/math.js), null: none yet
    streak: 0, // right answers in a row
    // missed: wrong answers per problem; times: the longest thinking time per problem (for Need More Practice).
    stats: { answered: 0, correct: 0, detours: 0, setbacks: 0, thinkingMs: 0, tips: 0, bestStreak: 0, missed: {}, times: {} },
  };
}

/**
 * Picks the next problem: a missed one whose turn has come, or else a new one
 * (never the same as the last one, and with giveaways limited, js/math.js).
 */
export function withNextProblem(state, random = Math.random) {
  if (state.mode === 'done') return state;
  const waiting = (state.again ?? []).map((q) => ({ ...q, wait: q.wait - 1 }));
  const due = waiting.findIndex((q) => q.wait <= 0 && `${q.a}${q.op}${q.b}` !== state.lastKey);
  let problem = due === -1 ? null : restoreProblem(waiting[due]);
  const again = due === -1 ? waiting : waiting.filter((_, i) => i !== due);
  const isAgain = problem !== null;
  let sinceGiveaway = state.sinceGiveaway ?? null;
  if (problem) {
    sinceGiveaway = isGiveaway(problem) ? 0 : sinceGiveaway === null ? null : sinceGiveaway + 1;
  } else {
    const generator = createProblemGenerator({
      operations: state.operations,
      difficulty: state.difficulty,
      random,
      lastKey: state.lastKey,
      sinceGiveaway,
    });
    problem = generator.next();
    sinceGiveaway = generator.sinceGiveaway();
  }
  return { ...state, problem, lastKey: problem.key, tipFor: null, isAgain, again, sinceGiveaway };
}

/** Counts a counting tip for the current question (once, however often it is opened). */
export function useTip(state) {
  if (!state.problem || state.tipFor === state.problem.key) return state;
  return { ...state, tipFor: state.problem.key, stats: { ...state.stats, tips: (state.stats.tips ?? 0) + 1 } };
}

/**
 * Answers the current problem. thinkingMs is the thinking time for this
 * question (from js/timer.js); it is added to the trip's total, which is the
 * high-score time. Returns { state, check, events }:
 *   check   the result of checkAnswer(); if check.ok is false (empty or
 *           invalid input) nothing else changes and the player tries again.
 *   events  what happened, in order, for the screen to show:
 *     { type: 'right' } / { type: 'wrong', answer }
 *     { type: 'step', step }                    moved one step on the trail
 *     { type: 'milestone', step, number }       reached a milestone (1, 2, ...)
 *     { type: 'detour-start', number, length }  a wrong trail answer started a detour
 *     { type: 'detour-question', asked, length }
 *     { type: 'detour-cleared', correct }       back to the same step
 *     { type: 'setback', from, to }             all detour answers wrong
 *     { type: 'finished' }                      reached the end of the trail
 */
export function answerProblem(state, input, { thinkingMs = 0 } = {}) {
  if (state.mode === 'done' || !state.problem) throw new Error('There is no question to answer.');
  const check = checkAnswer(state.problem, input);
  if (!check.ok) return { state, check, events: [] };

  const problem = state.problem;
  const ms = Math.max(0, Math.round(Number(thinkingMs) || 0));
  const stats = {
    ...state.stats,
    answered: state.stats.answered + 1,
    thinkingMs: (state.stats.thinkingMs ?? 0) + ms,
    missed: { ...state.stats.missed },
    times: { ...state.stats.times, [problem.key]: Math.max(state.stats.times?.[problem.key] ?? 0, ms) },
  };
  const events = [];
  let next = { ...state, problem: null, isAgain: false, stats };

  if (check.correct) {
    stats.correct += 1;
    next.streak = (state.streak ?? 0) + 1;
    stats.bestStreak = Math.max(stats.bestStreak ?? 0, next.streak);
    events.push({ type: 'right' });
    if (next.streak % STREAK_EVERY === 0) events.push({ type: 'streak', count: next.streak });
  } else {
    // Every wrong answer counts for Need More Practice, on the trail or in a detour.
    stats.missed[problem.key] = (stats.missed[problem.key] ?? 0) + 1;
    next.streak = 0;
    // It comes back a few questions later (once, unless it is already waiting).
    const waiting = (state.again ?? []).filter((q) => `${q.a}${q.op}${q.b}` !== problem.key);
    next.again = [...waiting, { op: problem.op, a: problem.a, b: problem.b, wait: AGAIN_AFTER + 1 }].slice(-AGAIN_MAX);
    events.push({ type: 'wrong', answer: problem.answer });
  }

  if (state.mode === 'trail') {
    if (check.correct) {
      next.step = state.step + 1;
      events.push({ type: 'step', step: next.step });
      if (next.step >= state.length) {
        next.mode = 'done';
        events.push({ type: 'finished' });
      } else if (next.step % MILESTONE_EVERY === 0) {
        next.checkpoint = next.step;
        events.push({ type: 'milestone', step: next.step, number: next.step / MILESTONE_EVERY });
      }
    } else {
      stats.detours += 1;
      next.mode = 'detour';
      next.detour = { number: stats.detours, asked: 0, correct: 0 };
      events.push({ type: 'detour-start', number: stats.detours, length: state.detourLength });
    }
    return { state: next, check, events };
  }

  // In a detour: a wrong answer never starts another detour.
  const detour = { ...state.detour, asked: state.detour.asked + 1, correct: state.detour.correct + (check.correct ? 1 : 0) };
  next.detour = detour;
  if (detour.asked < state.detourLength) {
    events.push({ type: 'detour-question', asked: detour.asked, length: state.detourLength });
    return { state: next, check, events };
  }
  next.mode = 'trail';
  next.detour = null;
  if (detour.correct > 0) {
    events.push({ type: 'detour-cleared', correct: detour.correct });
  } else {
    stats.setbacks += 1;
    next.step = state.checkpoint;
    events.push({ type: 'setback', from: state.step, to: state.checkpoint });
  }
  return { state: next, check, events };
}

/**
 * Unlocks the next sticker in order for a finished adventure.
 * Returns { sticker, collected }; sticker is null when every sticker was
 * already collected ("Collection complete!").
 */
export function unlockSticker(storyline, collectedIds) {
  const sticker = nextSticker(storyline, collectedIds);
  return { sticker, collected: sticker ? collectNext(storyline, collectedIds, 1) : [...collectedIds] };
}

/** Story text for an event: the milestone, detour, cleared or setback line. */
export function storyText(storyline, event, pick = Math.random) {
  const choose = (list) => (list?.length ? list[Math.floor(pick() * list.length)] : '');
  switch (event.type) {
    case 'milestone':
      return storyline.milestones?.[(event.number - 1) % storyline.milestones.length] ?? '';
    case 'detour-start':
      return (storyline.detours?.[(event.number - 1) % storyline.detours.length] ?? 'Wandering off the trail! Solve {count} problems.').replace(/\{count\}/g, String(event.length));
    case 'detour-cleared':
      return choose(storyline.detourCleared);
    case 'setback':
      return choose(storyline.setback);
    default:
      return '';
  }
}

/** Debug only: moves the trail to a step, with the checkpoint at the milestone before it. */
export function jumpTo(state, step) {
  const to = Math.min(Math.max(0, step), state.length - 1);
  return { ...state, mode: 'trail', detour: null, step: to, checkpoint: lastMilestone(to) };
}
