// What is saved, and how it is checked when it is read back (GAME-PLAN.md
// 1.10). Every saved record has a schema number. check...() functions bring an
// older record up to date (migrations), clean it up, and throw if it is too
// damaged to use, so storage.js can set it aside.
//
//   ao.v1.index          the players (id, name, picture) and backup reminders
//   ao.v1.profile.<id>   settings, setup, stickers, high scores, last result
//   ao.v1.history.<id>   the last 10 finished games
//   ao.v1.active.<id>    the adventure in progress

import { ADVENTURE_SCHEMA, AGAIN_AFTER, AGAIN_MAX } from './adventure.js?v=0.7.4';
import { AVATAR_IDS, checkColor } from './avatars.js?v=0.7.4';
import { createProblemGenerator, restoreProblem } from './math.js?v=0.7.4';
import { HISTORY_SIZE, BOARD_SIZE } from './scores.js?v=0.7.4';
import { COLOR_THEMES, DEFAULT_SETTINGS, DEFAULT_SETUP, collectionKeys, isThemeId, normalizeSettings, normalizeSetup } from './settings.js?v=0.7.4';

export const RECORD_SCHEMA = 1;
export const MAX_PROFILES = 8;
export const NAME_MAX_LENGTH = 20;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
const isId = (v) => typeof v === 'string' && ID_PATTERN.test(v);

/** Trims a name and squeezes repeated spaces: "  Sam   Lee " -> "Sam Lee". */
export function cleanName(name) {
  return String(name ?? '').replace(/\s+/g, ' ').trim();
}

class DamagedError extends Error {}
function fail(message) {
  throw new DamagedError(message);
}
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const count = (v) => (Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);
const isDate = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v));

// ---------------------------------------------------------------- migrations

/**
 * One step per schema version: MIGRATIONS[kind][n] turns a schema n record
 * into schema n + 1. Schema 0 is the shape the game used in memory before
 * saving existed (versions 0.3 to 0.5): no schema number, the player list was
 * a plain array, and a player's stickers could be a single list of Dino ids.
 */
const MIGRATIONS = {
  index: {
    0: (data) => ({ schema: 1, profiles: Array.isArray(data) ? data : data.profiles }),
  },
  profile: {
    0: (data) => ({
      ...data,
      schema: 1,
      collected: Array.isArray(data.collected) ? { dino: data.collected } : data.collected,
      highScores: data.highScores ?? {},
    }),
  },
  history: {
    0: (data) => ({ schema: 1, games: Array.isArray(data) ? data : data.games }),
  },
  active: {
    0: (data) => ({ schema: 1, adventure: isObject(data) && 'mode' in data ? data : data.adventure }),
  },
};

/** Brings a record up to RECORD_SCHEMA, one step at a time. */
export function migrate(kind, data) {
  let record = data;
  let version = isObject(record) && Number.isInteger(record.schema) ? record.schema : 0;
  if (version > RECORD_SCHEMA) fail(`saved by a newer version of the game (schema ${version})`);
  while (version < RECORD_SCHEMA) {
    const step = MIGRATIONS[kind]?.[version];
    if (!step) fail(`no way to update schema ${version}`);
    record = step(record);
    version += 1;
  }
  return record;
}

// ---------------------------------------------------------------- index

export function checkIndex(data) {
  const record = migrate('index', data);
  if (!isObject(record) || !Array.isArray(record.profiles)) fail('the player list is missing');
  const seen = new Set();
  const profiles = [];
  for (const p of record.profiles) {
    if (!isObject(p) || !isId(p.id) || seen.has(p.id)) continue;
    seen.add(p.id);
    profiles.push({ id: p.id, name: cleanName(p.name).slice(0, NAME_MAX_LENGTH) || 'Player', avatar: AVATAR_IDS.includes(p.avatar) ? p.avatar : AVATAR_IDS[0], color: checkColor(p.color) });
  }
  return {
    schema: RECORD_SCHEMA,
    profiles: profiles.slice(0, MAX_PROFILES),
    gamesSinceBackup: count(record.gamesSinceBackup),
    // The colors of the last player (for the start screens, before anyone is chosen).
    colors: COLOR_THEMES.includes(record.colors) ? record.colors : DEFAULT_SETTINGS.colors,
    lastBackupAt: isDate(record.lastBackupAt) ? record.lastBackupAt : null,
  };
}

// ---------------------------------------------------------------- profile

/** Stickers per theme and level ("dino", "dino.intermediate", ...); saves from before 0.7.3 have Beginner only. */
function checkCollected(raw) {
  const value = isObject(raw) ? raw : {};
  return Object.fromEntries(collectionKeys().map((key) => {
    const list = Object.hasOwn(value, key) && Array.isArray(value[key]) ? value[key].filter((id) => typeof id === 'string' && id.length <= 80) : [];
    return [key, [...new Set(list)]];
  }));
}

function checkScore(e) {
  if (!isObject(e) || !isDate(e.at) || !Number.isFinite(e.thinkingMs)) return null;
  return {
    at: e.at,
    theme: isThemeId(e.theme) ? e.theme : 'dino',
    thinkingMs: count(e.thinkingMs),
    setbacks: count(e.setbacks),
    tips: count(e.tips),
    answered: count(e.answered),
    correct: count(e.correct),
    operations: typeof e.operations === 'string' ? e.operations.slice(0, 8) : '',
  };
}

function checkBoards(raw) {
  const boards = {};
  if (!isObject(raw)) return boards;
  for (const [key, list] of Object.entries(raw)) {
    if (!/^\d{1,3}\|[a-z]{1,20}$/.test(key) || !Array.isArray(list)) continue;
    const entries = list.map(checkScore).filter(Boolean).slice(0, BOARD_SIZE);
    if (entries.length) boards[key] = entries;
  }
  return boards;
}

// At most this many learned problems are kept (the oldest are dropped).
export const LEARNED_MAX = 200;

/** { "7×8": "2026-10-17T12:00:00.000Z" }: when each problem was learned in Learn from Incorrect. */
function checkLearned(raw) {
  if (!isObject(raw)) return {};
  const entries = Object.entries(raw).filter(([key, at]) => /^\d{1,4}[+−×÷]\d{1,4}$/.test(key) && isDate(at));
  return Object.fromEntries(entries.sort((a, b) => a[1].localeCompare(b[1])).slice(-LEARNED_MAX));
}

function checkLastResult(raw) {
  if (!isObject(raw) || !isThemeId(raw.theme)) return null;
  return {
    theme: raw.theme,
    length: count(raw.length),
    stats: checkStats(raw.stats),
    stickerId: typeof raw.stickerId === 'string' ? raw.stickerId : null,
    rank: count(raw.rank),
    difficulty: typeof raw.difficulty === 'string' ? raw.difficulty : '',
  };
}

export function checkProfile(data, expectedId = null) {
  const record = migrate('profile', data);
  if (!isObject(record) || !isId(record.id)) fail('the player has no id');
  if (expectedId && record.id !== expectedId) fail('the player id does not match its key');
  return {
    schema: RECORD_SCHEMA,
    id: record.id,
    name: cleanName(record.name).slice(0, NAME_MAX_LENGTH) || 'Player',
    avatar: AVATAR_IDS.includes(record.avatar) ? record.avatar : AVATAR_IDS[0],
    color: checkColor(record.color), // 1-5; players saved before 0.6.5 have none and get 1
    settings: normalizeSettings(record.settings ?? DEFAULT_SETTINGS),
    setup: normalizeSetup(record.setup ?? DEFAULT_SETUP),
    collected: checkCollected(record.collected),
    highScores: checkBoards(record.highScores),
    lastResult: checkLastResult(record.lastResult),
    learned: checkLearned(record.learned),
  };
}

// ---------------------------------------------------------------- history

function checkCounts(raw, limit) {
  const out = {};
  if (!isObject(raw)) return out;
  for (const [key, n] of Object.entries(raw).slice(0, limit)) {
    if (/^\d{1,4}[+−×÷]\d{1,4}$/.test(key) && Number.isFinite(n) && n > 0) out[key] = Math.round(n);
  }
  return out;
}

function checkGame(g) {
  if (!isObject(g) || !isDate(g.at) || !isThemeId(g.theme) || !Number.isInteger(g.length)) return null;
  return {
    at: g.at,
    theme: g.theme,
    length: g.length,
    difficulty: typeof g.difficulty === 'string' ? g.difficulty : 'beginner',
    operations: typeof g.operations === 'string' ? g.operations.slice(0, 8) : '',
    answered: count(g.answered),
    correct: count(g.correct),
    detours: count(g.detours),
    setbacks: count(g.setbacks),
    thinkingMs: count(g.thinkingMs),
    tips: count(g.tips),
    missed: checkCounts(g.missed, 200),
    slow: checkCounts(g.slow, 20),
  };
}

export function checkHistory(data) {
  const record = migrate('history', data);
  if (!isObject(record) || !Array.isArray(record.games)) fail('the game history is missing');
  return { schema: RECORD_SCHEMA, games: record.games.map(checkGame).filter(Boolean).slice(-HISTORY_SIZE) };
}

// ---------------------------------------------------------------- adventure in progress

function checkStats(raw) {
  const s = isObject(raw) ? raw : {};
  return {
    answered: count(s.answered),
    correct: count(s.correct),
    detours: count(s.detours),
    setbacks: count(s.setbacks),
    thinkingMs: count(s.thinkingMs),
    tips: count(s.tips),
    bestStreak: count(s.bestStreak),
    missed: checkCounts(s.missed, 500),
    times: checkCounts(s.times, 500),
  };
}

/** Missed problems waiting to be asked again (saved before 0.7.2: none). */
function checkAgain(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(-50).flatMap((q) => {
    const problem = restoreProblem(q);
    if (!problem || !Number.isInteger(q.wait)) return [];
    return [{ op: problem.op, a: problem.a, b: problem.b, wait: Math.min(Math.max(q.wait, 0), AGAIN_AFTER + 1) }];
  }).slice(-AGAIN_MAX);
}

/** Checks a saved adventure. Returns null for a finished one (nothing to resume). */
export function checkAdventure(a) {
  if (!isObject(a)) fail('the adventure is missing');
  if (a.schema !== ADVENTURE_SCHEMA) fail(`unknown adventure schema ${a.schema}`);
  if (!isThemeId(a.theme)) fail(`unknown theme "${a.theme}"`);
  if (!Number.isInteger(a.length) || a.length < 1 || a.length > 1000) fail('bad adventure length');
  if (!Number.isInteger(a.detourLength) || a.detourLength < 1 || a.detourLength > 50) fail('bad detour length');
  createProblemGenerator({ operations: a.operations, difficulty: a.difficulty }); // throws if they are not valid
  if (!['trail', 'detour', 'done'].includes(a.mode)) fail('bad adventure mode');
  if (a.mode === 'done') return null;
  if (!Number.isInteger(a.step) || a.step < 0 || a.step >= a.length) fail('bad step');
  if (!Number.isInteger(a.checkpoint) || a.checkpoint < 0 || a.checkpoint > a.step) fail('bad checkpoint');
  let detour = null;
  if (a.mode === 'detour') {
    const d = a.detour;
    if (!isObject(d) || !Number.isInteger(d.asked) || d.asked < 0 || d.asked >= a.detourLength) fail('bad detour');
    detour = { number: count(d.number), asked: d.asked, correct: Math.min(count(d.correct), d.asked) };
  }
  // A question that doesn't add up is replaced by a new one when the adventure resumes.
  const problem = restoreProblem(a.problem);
  return {
    schema: ADVENTURE_SCHEMA,
    theme: a.theme,
    length: a.length,
    detourLength: a.detourLength,
    operations: [...a.operations],
    difficulty: a.difficulty,
    mode: a.mode,
    step: a.step,
    checkpoint: a.checkpoint,
    detour,
    problem,
    lastKey: problem ? problem.key : (typeof a.lastKey === 'string' ? a.lastKey : null),
    tipFor: problem && a.tipFor === problem.key ? problem.key : null,
    isAgain: Boolean(problem && a.isAgain === true),
    again: checkAgain(a.again),
    sinceGiveaway: Number.isInteger(a.sinceGiveaway) && a.sinceGiveaway >= 0 ? Math.min(a.sinceGiveaway, 1000) : null,
    streak: count(a.streak),
    stats: checkStats(a.stats),
  };
}

export function checkActive(data) {
  // Schema 0 was the adventure itself, which has its own schema number, so it is recognised by its shape.
  const record = isObject(data) && 'mode' in data && !('adventure' in data) ? MIGRATIONS.active[0](data) : migrate('active', data);
  if (!isObject(record)) fail('the saved adventure is missing');
  // A backup says "no adventure in progress" with null.
  if (record.adventure === null) return { schema: RECORD_SCHEMA, adventure: null };
  return { schema: RECORD_SCHEMA, adventure: checkAdventure(record.adventure) };
}

// ---------------------------------------------------------------- a whole player

/** A player as saved: the profile record plus history and adventure. */
export function profileRecord(player) {
  return {
    schema: RECORD_SCHEMA,
    id: player.id,
    name: player.name,
    avatar: player.avatar,
    color: player.color,
    settings: player.settings,
    setup: player.setup,
    collected: player.collected,
    highScores: player.highScores,
    lastResult: player.lastResult,
    learned: player.learned,
  };
}
