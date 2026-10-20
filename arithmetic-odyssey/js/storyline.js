// Loads a theme's storyline.json (built by tools/build-storyline.mjs) and
// answers questions about it: which sticker comes next, where pictures are.

import { LEVELS, THEMES, isThemeId } from './settings.js?v=0.7.5';

export const STORYLINE_SCHEMA = 1;

/** Throws a clear error if the file isn't a storyline this version understands. */
export function checkStoryline(data, theme) {
  if (!data || typeof data !== 'object') throw new Error('The story file is empty or damaged.');
  if (data.schema !== STORYLINE_SCHEMA) throw new Error(`The story file has schema ${data.schema}; this game needs ${STORYLINE_SCHEMA}.`);
  if (data.theme !== theme) throw new Error(`The story file is for "${data.theme}", not "${theme}".`);
  if (!Array.isArray(data.stickers) || data.stickers.length === 0) throw new Error('The story file has no stickers.');
  // The Intermediate and Advanced sets may be empty (coming later).
  const lists = [data.stickers, ...LEVELS.slice(1).map((level) => data.levels?.[level] ?? [])];
  if (data.levels !== undefined && (typeof data.levels !== 'object' || lists.some((l) => !Array.isArray(l)))) throw new Error('The story file has a damaged level list.');
  for (const s of lists.flat()) {
    if (typeof s.id !== 'string' || typeof s.name !== 'string' || !Array.isArray(s.facts) || !Array.isArray(s.pictures)) {
      throw new Error('A sticker in the story file is missing its id, name, facts or pictures.');
    }
  }
  return data;
}

/**
 * The stickers for one level, as a storyline (so nextSticker(), collectNext()
 * and the rest work on it): Beginner is the main list; Intermediate and
 * Advanced are their own sets, empty until they are added.
 */
export function stickerSet(storyline, level = 'beginner') {
  if (level === 'beginner' || !LEVELS.includes(level)) return storyline;
  return { ...storyline, stickers: storyline.levels?.[level] ?? [] };
}

export async function loadStoryline(theme, fetchFile = globalThis.fetch) {
  const info = isThemeId(theme) ? THEMES[theme] : null;
  if (!info) throw new Error(`Unknown theme "${theme}".`);
  const response = await fetchFile(`${info.folder}storyline.json`, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`The ${info.title} story file could not be loaded (HTTP ${response.status}).`);
  return checkStoryline(await response.json(), theme);
}

/** The first sticker, in order, that the player hasn't collected; null when all are collected. */
export function nextSticker(storyline, collectedIds = []) {
  const owned = new Set(collectedIds);
  return storyline.stickers.find((s) => !owned.has(s.id)) ?? null;
}

/** Collects the next n stickers in order. Returns the new list of collected ids. */
export function collectNext(storyline, collectedIds, n = 1) {
  const ids = [...collectedIds];
  for (let i = 0; i < n; i++) {
    const sticker = nextSticker(storyline, ids);
    if (!sticker) break;
    ids.push(sticker.id);
  }
  return ids;
}

/** Web address of a picture, with each folder and file name encoded (names can contain "+", spaces or "#"). */
export function pictureUrl(theme, path) {
  return THEMES[theme].folder + path.split('/').map(encodeURIComponent).join('/');
}
