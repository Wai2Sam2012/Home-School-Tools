// Players (profiles), saved on this device with storage.js (GAME-PLAN.md 1.10).
// Only what changed is written: the adventure in progress once per question,
// and the player's record when settings change or an adventure ends.

import { AVATAR_IDS, checkColor } from './avatars.js?v=0.7.1';
import { KEYS, PREFIX, createStorage, memoryStorage } from './storage.js?v=0.7.1';
import {
  LEARNED_MAX, MAX_PROFILES, NAME_MAX_LENGTH, RECORD_SCHEMA, checkActive, checkHistory, checkIndex, checkProfile, cleanName, profileRecord,
} from './records.js?v=0.7.1';
import { addHighScore, addToHistory, gameSummary } from './scores.js?v=0.7.1';
import { DEFAULT_SETTINGS, DEFAULT_SETUP, THEMES, normalizeSettings, normalizeSetup } from './settings.js?v=0.7.1';

// Player icon ids; the pictures are in images/avatars/ (js/avatars.js).
export const AVATARS = AVATAR_IDS;
export { MAX_PROFILES, NAME_MAX_LENGTH, cleanName };
// A reminder to back up appears in Settings after this many finished adventures.
export const BACKUP_REMINDER_GAMES = 5;

/** Returns '' if the name can be used, otherwise a message for the grown-up. */
export function checkProfileName(name, profiles, exceptId = null) {
  const clean = cleanName(name);
  if (clean === '') return 'Type a name.';
  if ([...clean].length > NAME_MAX_LENGTH) return `Use ${NAME_MAX_LENGTH} letters or fewer.`;
  const taken = profiles.some((p) => p.id !== exceptId && p.name.toLocaleLowerCase() === clean.toLocaleLowerCase());
  if (taken) return `There is already a player called ${clean}.`;
  return '';
}

/** "Sam" -> "Sam 2" (or "Sam 3", ...) when Sam is taken. */
export function freeName(name, profiles) {
  const base = cleanName(name);
  if (!checkProfileName(base, profiles)) return base;
  for (let n = 2; ; n++) {
    const suffix = ` ${n}`;
    const candidate = `${[...base].slice(0, NAME_MAX_LENGTH - suffix.length).join('')}${suffix}`;
    if (!checkProfileName(candidate, profiles)) return candidate;
  }
}

function emptyCollection() {
  return Object.fromEntries(Object.keys(THEMES).map((theme) => [theme, []]));
}

const defaultId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * Keeps the list of players and which one is playing, and saves them.
 * storage comes from js/storage.js (in memory if left out); makeId and now
 * are only replaced in tests.
 */
export function createProfileStore({ storage = createStorage(memoryStorage()), makeId = defaultId, now = () => new Date() } = {}) {
  const profiles = [];
  let activeId = null;
  let index = { schema: RECORD_SCHEMA, profiles: [], gamesSinceBackup: 0, lastBackupAt: null, colors: DEFAULT_SETTINGS.colors };

  // ---------------------------------------------------------------- saving
  const saveIndex = () => {
    index.profiles = profiles.map(({ id, name, avatar, color }) => ({ id, name, avatar, color }));
    return storage.write(KEYS.index, index);
  };
  const saveProfile = (p) => storage.write(KEYS.profile(p.id), profileRecord(p));
  const saveHistory = (p) => storage.write(KEYS.history(p.id), { schema: RECORD_SCHEMA, games: p.history });
  const saveActive = (p) => {
    if (p.adventure && p.adventure.mode !== 'done') return storage.write(KEYS.active(p.id), { schema: RECORD_SCHEMA, adventure: p.adventure });
    storage.remove(KEYS.active(p.id));
    return true;
  };
  const savePlayer = (p) => [saveProfile(p), saveHistory(p), saveActive(p)].every(Boolean);

  function freshId() {
    let id = makeId();
    while (profiles.some((p) => p.id === id)) id = `${id}x`;
    return id;
  }

  /** A player in memory from its saved parts (each already checked). */
  function player(record, history = [], adventure = null) {
    return {
      id: record.id,
      name: record.name,
      avatar: record.avatar,
      color: checkColor(record.color),
      settings: record.settings,
      setup: record.setup,
      collected: record.collected,
      highScores: record.highScores,
      lastResult: record.lastResult,
      learned: record.learned ?? {},
      history,
      adventure, // the adventure in progress (js/adventure.js)
    };
  }

  // ---------------------------------------------------------------- loading
  function load() {
    let saved = storage.read(KEYS.index, checkIndex);
    if (!saved) {
      // No usable player list: rebuild it from the players' own records, if any.
      const ids = storage.keys(`${PREFIX}profile.`).map((k) => k.slice(`${PREFIX}profile.`.length)).filter((k) => !k.endsWith('.tmp'));
      saved = checkIndex({ schema: RECORD_SCHEMA, profiles: ids.map((id) => ({ id, name: 'Player', avatar: AVATAR_IDS[0] })) });
    }
    index = saved;
    for (const entry of saved.profiles) {
      const record = storage.read(KEYS.profile(entry.id), (d) => checkProfile(d, entry.id))
        // A damaged record was set aside: keep the player with fresh settings.
        ?? checkProfile({ schema: RECORD_SCHEMA, id: entry.id, name: entry.name, avatar: entry.avatar, color: entry.color });
      const history = storage.read(KEYS.history(entry.id), checkHistory)?.games ?? [];
      const adventure = storage.read(KEYS.active(entry.id), checkActive)?.adventure ?? null;
      profiles.push(player(record, history, adventure));
    }
    if (profiles.length && !storage.read(KEYS.index)) saveIndex();
  }
  load();

  return {
    list: () => [...profiles],
    get: (id) => profiles.find((p) => p.id === id) ?? null,
    active: () => profiles.find((p) => p.id === activeId) ?? null,
    canAdd: () => profiles.length < MAX_PROFILES,
    storage,

    /** Adds a player. Throws with a friendly message if the name can't be used or the list is full. */
    add(name, avatar, color = 1) {
      if (profiles.length >= MAX_PROFILES) throw new Error(`There can be up to ${MAX_PROFILES} players.`);
      const problem = checkProfileName(name, profiles);
      if (problem) throw new Error(problem);
      const p = player({
        id: freshId(),
        name: cleanName(name),
        avatar: AVATARS.includes(avatar) ? avatar : AVATARS[0],
        color: checkColor(color),
        settings: { ...DEFAULT_SETTINGS },
        setup: normalizeSetup(DEFAULT_SETUP),
        collected: emptyCollection(),
        highScores: {},
        lastResult: null,
        learned: {},
      });
      profiles.push(p);
      saveProfile(p);
      saveIndex();
      return p;
    },

    select(id) {
      if (!profiles.some((p) => p.id === id)) throw new Error('That player no longer exists.');
      activeId = id;
    },

    /** Deletes a player and everything saved for them. */
    remove(id) {
      const i = profiles.findIndex((p) => p.id === id);
      if (i === -1) return false;
      profiles.splice(i, 1);
      if (activeId === id) activeId = null;
      for (const key of [KEYS.profile(id), KEYS.history(id), KEYS.active(id)]) storage.remove(key);
      saveIndex();
      return true;
    },

    updateSettings(id, changes) {
      const p = this.get(id);
      p.settings = normalizeSettings({ ...p.settings, ...changes });
      saveProfile(p);
      return p.settings;
    },

    updateSetup(id, changes) {
      const p = this.get(id);
      p.setup = normalizeSetup({ ...p.setup, ...changes });
      saveProfile(p);
      return p.setup;
    },

    /** Changes a player's picture and its color (1-5). Returns false if it couldn't be saved. */
    setPicture(id, avatar, color = 1) {
      const p = this.get(id);
      if (!p) throw new Error('That player no longer exists.');
      p.avatar = AVATARS.includes(avatar) ? avatar : p.avatar;
      p.color = checkColor(color);
      return [saveProfile(p), saveIndex()].every(Boolean);
    },

    /** Saves the adventure in progress (null or finished: removes it). Returns false if it couldn't be saved. */
    saveAdventure(id, adventure) {
      const p = this.get(id);
      p.adventure = adventure;
      return saveActive(p);
    },

    /**
     * Records a finished adventure: the new sticker list, the history, the
     * high scores and the result for Trail's End. Returns that result
     * ({ theme, length, difficulty, stats, stickerId, rank }; rank 0 = not on the board).
     */
    finishAdventure(id, adventure, { collected, stickerId }) {
      const p = this.get(id);
      const game = gameSummary(adventure, now());
      const { boards, rank } = addHighScore(p.highScores, game);
      p.highScores = boards;
      p.history = addToHistory(p.history, game);
      p.collected = { ...p.collected, [adventure.theme]: collected };
      p.lastResult = { theme: adventure.theme, length: adventure.length, difficulty: adventure.difficulty, stats: adventure.stats, stickerId, rank };
      p.adventure = null;
      savePlayer(p);
      index.gamesSinceBackup += 1;
      saveIndex();
      return p.lastResult;
    },

    /** Records problems learned in Learn from Incorrect, so they leave Need More Practice. */
    markLearned(id, keys) {
      const p = this.get(id);
      const at = now().toISOString();
      const learned = { ...p.learned };
      for (const key of keys) learned[key] = at;
      // Keep the newest LEARNED_MAX.
      p.learned = Object.fromEntries(Object.entries(learned).sort((a, b) => a[1].localeCompare(b[1])).slice(-LEARNED_MAX));
      return saveProfile(p);
    },

    /** Debug and tests: sets a player's stickers for a theme. */
    setCollected(id, theme, ids) {
      const p = this.get(id);
      p.collected = { ...p.collected, [theme]: [...ids] };
      saveProfile(p);
    },

    // ---------------------------------------------------------------- backup support

    /** Finished adventures since the last backup, and when that was. */
    /** The last player's color theme (shown before a player is chosen). */
    lastColors: () => index.colors ?? DEFAULT_SETTINGS.colors,
    setLastColors(colors) {
      if (index.colors === colors) return;
      index.colors = colors;
      saveIndex();
    },

    backupStatus: () => ({ gamesSinceBackup: index.gamesSinceBackup, lastBackupAt: index.lastBackupAt, remind: index.gamesSinceBackup >= BACKUP_REMINDER_GAMES }),

    markBackedUp() {
      index.gamesSinceBackup = 0;
      index.lastBackupAt = now().toISOString();
      saveIndex();
    },

    /** Every player as plain data: { profile, history, active } (for js/backup.js). */
    exportPlayers: () => profiles.map((p) => ({
      profile: profileRecord(p),
      history: { schema: RECORD_SCHEMA, games: p.history },
      active: { schema: RECORD_SCHEMA, adventure: p.adventure && p.adventure.mode !== 'done' ? p.adventure : null },
    })),

    /**
     * Puts checked players (from js/backup.js) in. replace: true removes
     * everyone else first. Added players get new ids, and a new name if
     * theirs is taken. Throws (changing nothing) if they would not fit.
     */
    importPlayers(players, { replace = false } = {}) {
      if ((replace ? 0 : profiles.length) + players.length > MAX_PROFILES) {
        throw new Error(`That would make ${(replace ? 0 : profiles.length) + players.length} players; there can be up to ${MAX_PROFILES}.`);
      }
      // Whoever is playing stays chosen if they come back (for example after undoing a restore).
      const playing = activeId;
      if (replace) {
        for (const p of [...profiles]) this.remove(p.id);
      }
      const added = [];
      for (const { profile, history, active } of players) {
        const p = player(profile, history?.games ?? [], active?.adventure ?? null);
        if (!replace || profiles.some((other) => other.id === p.id)) p.id = freshId();
        p.name = freeName(p.name, profiles);
        profiles.push(p);
        savePlayer(p);
        added.push(p);
      }
      if (profiles.some((p) => p.id === playing)) activeId = playing;
      saveIndex();
      return added;
    },
  };
}
