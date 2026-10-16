// A player's settings (chosen by a grown-up in Settings) and adventure setup
// (chosen by the player on the Setup screen), with their allowed values.
// normalize...() turns anything, including damaged saved data, into valid values.

import { DIFFICULTIES, OPERATIONS } from './math.js?v=0.4.0';

export const ADVENTURE_LENGTHS = Object.freeze([20, 40, 60, 80, 100]);
export const DETOUR_MIN = 3;
export const DETOUR_MAX = 10;

/** Themes in album order. Only themes marked ready can be played. */
export const THEMES = Object.freeze({
  dino: Object.freeze({ id: 'dino', title: 'Dino Tour', icon: '🦕', folder: 'themes/dino/', ready: true }),
  parks: Object.freeze({ id: 'parks', title: 'Truck Off-Road', icon: '🛻', folder: 'themes/national-parks/', ready: false }),
});

export const DIFFICULTY_LABELS = Object.freeze({
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
});

export const DEFAULT_SETTINGS = Object.freeze({ voice: true, adventureLength: 20, detourLength: DETOUR_MIN });
export const DEFAULT_SETUP = Object.freeze({ theme: 'dino', operations: Object.freeze(['+']), difficulty: 'beginner' });

export function normalizeSettings(raw) {
  const value = raw && typeof raw === 'object' ? raw : {};
  const detour = Number(value.detourLength);
  return {
    voice: typeof value.voice === 'boolean' ? value.voice : DEFAULT_SETTINGS.voice,
    adventureLength: ADVENTURE_LENGTHS.includes(value.adventureLength) ? value.adventureLength : DEFAULT_SETTINGS.adventureLength,
    detourLength: Number.isInteger(detour) && detour >= DETOUR_MIN && detour <= DETOUR_MAX ? detour : DEFAULT_SETTINGS.detourLength,
  };
}

export function normalizeSetup(raw) {
  const value = raw && typeof raw === 'object' ? raw : {};
  const chosen = Array.isArray(value.operations) ? value.operations : [];
  const operations = OPERATIONS.filter((op) => chosen.includes(op));
  return {
    theme: THEMES[value.theme]?.ready ? value.theme : DEFAULT_SETUP.theme,
    operations: operations.length ? operations : [...DEFAULT_SETUP.operations],
    difficulty: DIFFICULTIES.includes(value.difficulty) ? value.difficulty : DEFAULT_SETUP.difficulty,
  };
}

/**
 * Turns an operation on or off. Turning off the last one is refused, because
 * at least one operation must stay selected.
 * Returns { operations, refused }.
 */
export function toggleOperation(operations, op) {
  if (!OPERATIONS.includes(op)) return { operations: [...operations], refused: true };
  if (operations.includes(op)) {
    if (operations.length === 1) return { operations: [...operations], refused: true };
    return { operations: operations.filter((o) => o !== op), refused: false };
  }
  return { operations: OPERATIONS.filter((o) => o === op || operations.includes(o)), refused: false };
}

/** Moves the detour length up or down by one, staying within 3-10. */
export function stepDetourLength(current, change) {
  return Math.min(DETOUR_MAX, Math.max(DETOUR_MIN, current + change));
}
