// Players (profiles). Stage 3 keeps them in memory only, so they reset when
// the page reloads; Stage 6 saves them with storage.js.

import { DEFAULT_SETTINGS, DEFAULT_SETUP, THEMES, normalizeSettings, normalizeSetup } from './settings.js?v=0.4.1';

export const AVATARS = Object.freeze(['🦖', '🦕', '🐢', '🦊', '🐼', '🐯', '🦁', '🐸', '🐙', '🦄', '🐧', '🚀']);
export const MAX_PROFILES = 8;
export const NAME_MAX_LENGTH = 20;

/** Trims a name and squeezes repeated spaces: "  Sam   Lee " -> "Sam Lee". */
export function cleanName(name) {
  return String(name ?? '').replace(/\s+/g, ' ').trim();
}

/** Returns '' if the name can be used, otherwise a message for the grown-up. */
export function checkProfileName(name, profiles, exceptId = null) {
  const clean = cleanName(name);
  if (clean === '') return 'Type a name.';
  if ([...clean].length > NAME_MAX_LENGTH) return `Use ${NAME_MAX_LENGTH} letters or fewer.`;
  const taken = profiles.some((p) => p.id !== exceptId && p.name.toLocaleLowerCase() === clean.toLocaleLowerCase());
  if (taken) return `There is already a player called ${clean}.`;
  return '';
}

function emptyCollection() {
  return Object.fromEntries(Object.keys(THEMES).map((theme) => [theme, []]));
}

/**
 * Keeps the list of players and which one is playing.
 * makeId is only replaced in tests.
 */
export function createProfileStore({ makeId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` } = {}) {
  const profiles = [];
  let activeId = null;

  return {
    list: () => [...profiles],
    get: (id) => profiles.find((p) => p.id === id) ?? null,
    active: () => profiles.find((p) => p.id === activeId) ?? null,
    canAdd: () => profiles.length < MAX_PROFILES,

    /** Adds a player. Throws with a friendly message if the name can't be used or the list is full. */
    add(name, avatar) {
      if (profiles.length >= MAX_PROFILES) throw new Error(`There can be up to ${MAX_PROFILES} players.`);
      const problem = checkProfileName(name, profiles);
      if (problem) throw new Error(problem);
      let id = makeId();
      while (profiles.some((p) => p.id === id)) id = `${id}x`;
      const profile = {
        id,
        name: cleanName(name),
        avatar: AVATARS.includes(avatar) ? avatar : AVATARS[0],
        settings: { ...DEFAULT_SETTINGS },
        setup: normalizeSetup(DEFAULT_SETUP),
        collected: emptyCollection(),
        adventure: null, // the adventure in progress (js/adventure.js)
        lastResult: null, // the last finished adventure, for Trail's End
      };
      profiles.push(profile);
      return profile;
    },

    select(id) {
      if (!profiles.some((p) => p.id === id)) throw new Error('That player no longer exists.');
      activeId = id;
    },

    remove(id) {
      const index = profiles.findIndex((p) => p.id === id);
      if (index === -1) return false;
      profiles.splice(index, 1);
      if (activeId === id) activeId = null;
      return true;
    },

    updateSettings(id, changes) {
      const profile = this.get(id);
      profile.settings = normalizeSettings({ ...profile.settings, ...changes });
      return profile.settings;
    },

    updateSetup(id, changes) {
      const profile = this.get(id);
      profile.setup = normalizeSetup({ ...profile.setup, ...changes });
      return profile.setup;
    },
  };
}
