// High scores, the last 10 games and Need More Practice (GAME-PLAN.md 1.11).
// Plain data in, plain data out, so it is easy to test and to save.
//
//   History: the last 10 finished adventures, as compact summaries.
//   High scores: a board for each adventure length and difficulty, top 10.
//     The most right answers (as a share of answers) rank highest; then less
//     total thinking time; then fewer counting tips.
//   Need More Practice: the last 20 problems answered wrong in the last 10
//     games, the most recent first, then (if there is room) slow ones. A
//     problem learned in Learn from Incorrect stays on the list, marked
//     learned, so it can still be practiced; missing it again in a later game
//     makes it "to learn" again.

export const HISTORY_SIZE = 10;
export const BOARD_SIZE = 10;
export const PRACTICE_SIZE = 20;
// Only the slowest few problems of each game are kept in its summary.
const SLOWEST_PER_GAME = 10;
// A problem answered right counts as slow (worth practicing) from this long.
export const SLOW_MS = 5000;

/** The board for an adventure length and difficulty: "20|beginner". */
export function boardKey(length, difficulty) {
  return `${length}|${difficulty}`;
}

/** A finished adventure as a small summary for the history and the high scores. */
export function gameSummary(state, at = new Date()) {
  const stats = state.stats;
  const slowest = Object.entries(stats.times ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, SLOWEST_PER_GAME);
  return {
    at: at.toISOString(),
    theme: state.theme,
    length: state.length,
    difficulty: state.difficulty,
    operations: state.operations.join(''),
    answered: stats.answered,
    correct: stats.correct,
    detours: stats.detours,
    setbacks: stats.setbacks,
    thinkingMs: stats.thinkingMs,
    tips: stats.tips ?? 0,
    missed: { ...stats.missed },
    slow: Object.fromEntries(slowest),
  };
}

/** Adds a game to the history, keeping the newest HISTORY_SIZE. */
export function addToHistory(games, game) {
  return [...games, game].slice(-HISTORY_SIZE);
}

/** The share of answers that were right (0 to 1). */
export function accuracy(score) {
  return score.answered > 0 ? score.correct / score.answered : 0;
}

/** The most right answers (as a share) first, then less thinking time, then fewer tips, then the earlier game. */
export function compareScores(a, b) {
  return accuracy(b) - accuracy(a) || a.thinkingMs - b.thinkingMs || (a.tips ?? 0) - (b.tips ?? 0) || String(a.at).localeCompare(String(b.at));
}

/** A high-score entry: only what the board shows. */
export function scoreEntry(game) {
  return {
    at: game.at,
    theme: game.theme,
    thinkingMs: game.thinkingMs,
    setbacks: game.setbacks,
    tips: game.tips ?? 0,
    answered: game.answered,
    correct: game.correct,
    operations: game.operations,
  };
}

/**
 * Puts a finished game on its board. Returns { boards, rank }: rank is its
 * place (1 = best) or 0 if it didn't make the top BOARD_SIZE.
 */
export function addHighScore(boards, game) {
  const key = boardKey(game.length, game.difficulty);
  const entry = scoreEntry(game);
  const board = [...(boards[key] ?? []), entry].sort(compareScores).slice(0, BOARD_SIZE);
  const rank = board.indexOf(entry) + 1;
  return { boards: { ...boards, [key]: board }, rank };
}

/** "7×8" -> "7 × 8" */
export function problemText(key) {
  return String(key).replace(/^(\d+)([+−×÷])(\d+)$/, '$1 $2 $3');
}

/**
 * Need More Practice, from the last games: the problems answered wrong, the
 * most recent game first (in a game, the most missed first), then, if there
 * is room, ones that took SLOW_MS or longer, slowest first. At most size.
 * learned ({ key: date }) marks a problem learned when it was learned after
 * the last time it was missed or slow; it stays on the list either way.
 * Returns [{ key, text, missed, slowMs, learned }]; missed is how many times
 * it was missed in these games.
 */
export function needMorePractice(games, size = PRACTICE_SIZE, learned = {}) {
  const recent = games.slice(-HISTORY_SIZE);
  const missed = new Map();
  const slow = new Map();
  const lastSeen = new Map(); // key -> the date of the latest game it was missed or slow in
  for (const game of recent) {
    for (const [key, n] of Object.entries(game.missed ?? {})) {
      missed.set(key, (missed.get(key) ?? 0) + n);
      lastSeen.set(key, String(game.at));
    }
    for (const [key, ms] of Object.entries(game.slow ?? {})) {
      if (ms < SLOW_MS) continue;
      slow.set(key, Math.max(slow.get(key) ?? 0, ms));
      if (!lastSeen.has(key) || String(game.at) > lastSeen.get(key)) lastSeen.set(key, String(game.at));
    }
  }
  const order = [];
  for (const game of [...recent].reverse()) {
    const keys = Object.entries(game.missed ?? {}).sort((a, b) => b[1] - a[1]).map(([key]) => key);
    for (const key of keys) if (!order.includes(key)) order.push(key);
  }
  const slowOnly = [...slow.keys()].filter((key) => !missed.has(key)).sort((a, b) => slow.get(b) - slow.get(a));
  return [...order, ...slowOnly].slice(0, size).map((key) => ({
    key,
    text: problemText(key),
    missed: missed.get(key) ?? 0,
    slowMs: slow.get(key) ?? 0,
    learned: Boolean(learned[key]) && String(learned[key]) > lastSeen.get(key),
  }));
}

/** What a Learn from Incorrect round practices: the problems not learned yet, or (if all are) every one again. */
export function toPractice(list) {
  const open = list.filter((p) => !p.learned);
  return open.length ? open : list;
}
