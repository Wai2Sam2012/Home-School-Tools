// Loads a theme's storyline.json (built by tools/build-storyline.mjs) and
// answers questions about it: which sticker comes next, where pictures are.

import { THEMES } from './settings.js?v=0.5.4';

export const STORYLINE_SCHEMA = 1;

/** Throws a clear error if the file isn't a storyline this version understands. */
export function checkStoryline(data, theme) {
  if (!data || typeof data !== 'object') throw new Error('The story file is empty or damaged.');
  if (data.schema !== STORYLINE_SCHEMA) throw new Error(`The story file has schema ${data.schema}; this game needs ${STORYLINE_SCHEMA}.`);
  if (data.theme !== theme) throw new Error(`The story file is for "${data.theme}", not "${theme}".`);
  if (!Array.isArray(data.stickers) || data.stickers.length === 0) throw new Error('The story file has no stickers.');
  for (const s of data.stickers) {
    if (typeof s.id !== 'string' || typeof s.name !== 'string' || !Array.isArray(s.facts) || !Array.isArray(s.pictures)) {
      throw new Error('A sticker in the story file is missing its id, name, facts or pictures.');
    }
  }
  return data;
}

export async function loadStoryline(theme, fetchFile = globalThis.fetch) {
  const info = THEMES[theme];
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
