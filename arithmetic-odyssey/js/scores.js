// High scores, the last 10 games and Need More Practice (GAME-PLAN.md 1.11).
// Plain data in, plain data out, so it is easy to test and to save.
//
//   History: the last 10 finished adventures, as compact summaries.
//   High scores: a board for each adventure length and difficulty, top 10.
//     Fewer milestone setbacks rank higher; then less total thinking time.
//   Need More Practice: the problems missed most often in the last 10 games,
//     then the slowest ones. A problem learned in Learn from Incorrect leaves
//     the list until it is missed (or slow) again in a later game.

export const HISTORY_SIZE = 10;
export const BOARD_SIZE = 10;
export const PRACTICE_SIZE = 10;
// Only the slowest few problems of each game are kept in its summary.
const SLOWEST_PER_GAME = 10;
// A problem answered right counts as slow (worth practising) from this long.
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
    missed: { ...stats.missed },
    slow: Object.fromEntries(slowest),
  };
}

/** Adds a game to the history, keeping the newest HISTORY_SIZE. */
export function addToHistory(games, game) {
  return [...games, game].slice(-HISTORY_SIZE);
}

/** Fewer setbacks first, then less thinking time, then the earlier game. */
export function compareScores(a, b) {
  return a.setbacks - b.setbacks || a.thinkingMs - b.thinkingMs || String(a.at).localeCompare(String(b.at));
}

/** A high-score entry: only what the board shows. */
export function scoreEntry(game) {
  return {
    at: game.at,
    theme: game.theme,
    thinkingMs: game.thinkingMs,
    setbacks: game.setbacks,
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
 * The problems to practise, from the last games: the ones missed most often
 * (then the slowest of those), then, if there is room, ones that took
 * SLOW_MS or longer, slowest first. learned ({ key: date }) leaves out what
 * happened to a problem before it was learned.
 * Returns [{ key, text, missed, slowMs }].
 */
export function needMorePractice(games, size = PRACTICE_SIZE, learned = {}) {
  const missed = new Map();
  const slow = new Map();
  const counts = (key, game) => !learned[key] || String(game.at) > learned[key];
  for (const game of games.slice(-HISTORY_SIZE)) {
    for (const [key, n] of Object.entries(game.missed ?? {})) if (counts(key, game)) missed.set(key, (missed.get(key) ?? 0) + n);
    for (const [key, ms] of Object.entries(game.slow ?? {})) if (counts(key, game)) slow.set(key, Math.max(slow.get(key) ?? 0, ms));
  }
  const item = (key) => ({ key, text: problemText(key), missed: missed.get(key) ?? 0, slowMs: slow.get(key) ?? 0 });
  const missedList = [...missed.keys()].map(item).sort((a, b) => b.missed - a.missed || b.slowMs - a.slowMs);
  const slowList = [...slow.keys()].filter((key) => !missed.has(key) && slow.get(key) >= SLOW_MS).map(item).sort((a, b) => b.slowMs - a.slowMs);
  return [...missedList, ...slowList].slice(0, size);
}
