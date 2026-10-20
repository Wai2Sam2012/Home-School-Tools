// Backup and restore (GAME-PLAN.md 1.11). A backup is one JSON file with every
// player, their stickers, stats, high scores, settings and any adventure in
// progress. Restoring checks the whole file first and changes nothing if any
// of it is wrong; before it changes anything, the current data is kept so
// the restore can be undone.

import { KEYS } from './storage.js?v=0.7.4';
import { MAX_PROFILES, checkActive, checkHistory, checkProfile } from './records.js?v=0.7.4';

export const BACKUP_FORMAT = 'arithmetic-odyssey-backup';
export const BACKUP_SCHEMA = 1;
// A backup bigger than this is not one of ours (a real one is a few KB per player).
const MAX_BACKUP_CHARS = 2_000_000;
// A file bigger than this isn't read at all (reading a huge file could stop the game).
export const MAX_BACKUP_FILE_BYTES = 4 * 1024 * 1024;

/** "arithmetic-odyssey-backup-2026-10-17.json" (the local date). */
export function backupFileName(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${BACKUP_FORMAT}-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

/** The backup as plain data. */
export function makeBackup(store, { appVersion = '', date = new Date() } = {}) {
  return {
    format: BACKUP_FORMAT,
    schema: BACKUP_SCHEMA,
    exportedAt: date.toISOString(),
    appVersion,
    players: store.exportPlayers(),
  };
}

/** What a backup holds, for the preview: "2 players, 14 stickers, 6 high scores". */
export function describeBackup(players) {
  const stickers = players.reduce((n, p) => n + Object.values(p.profile.collected).reduce((m, list) => m + list.length, 0), 0);
  const scores = players.reduce((n, p) => n + Object.values(p.profile.highScores).reduce((m, list) => m + list.length, 0), 0);
  const trips = players.filter((p) => p.active?.adventure).length;
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return {
    players: players.length,
    stickers,
    highScores: scores,
    names: players.map((p) => p.profile.name),
    text: [plural(players.length, 'player'), plural(stickers, 'sticker'), plural(scores, 'high score'), trips ? plural(trips, 'adventure in progress') : '']
      .filter(Boolean).join(', '),
  };
}

/**
 * Reads and checks a backup file's text. Returns { ok: true, players,
 * preview, exportedAt } or { ok: false, error } with a message for the
 * grown-up. Nothing is changed either way.
 */
export function parseBackup(text) {
  if (typeof text !== 'string' || text.length === 0) return { ok: false, error: 'The file is empty.' };
  if (text.length > MAX_BACKUP_CHARS) return { ok: false, error: 'The file is too big to be an Arithmetic Odyssey backup.' };
  let data;
  try {
    data = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    return { ok: false, error: "This isn't an Arithmetic Odyssey backup (the file can't be read)." };
  }
  if (!data || data.format !== BACKUP_FORMAT) return { ok: false, error: "This isn't an Arithmetic Odyssey backup." };
  if (!Number.isInteger(data.schema) || data.schema < 1) return { ok: false, error: 'The backup is damaged (no version number).' };
  if (data.schema > BACKUP_SCHEMA) return { ok: false, error: 'This backup was made by a newer version of the game. Update the game, then try again.' };
  if (!Array.isArray(data.players) || data.players.length === 0) return { ok: false, error: 'The backup has no players in it.' };
  if (data.players.length > MAX_PROFILES) return { ok: false, error: `The backup has ${data.players.length} players; there can be up to ${MAX_PROFILES}.` };

  const players = [];
  const ids = new Set();
  for (const [i, raw] of data.players.entries()) {
    const label = typeof raw?.profile?.name === 'string' ? raw.profile.name : `player ${i + 1}`;
    try {
      const profile = checkProfile(raw?.profile);
      if (ids.has(profile.id)) throw new Error('the same player is in the file twice');
      ids.add(profile.id);
      const history = raw.history ? checkHistory(raw.history) : { schema: 1, games: [] };
      const active = raw.active ? checkActive(raw.active) : null;
      players.push({ profile, history, active });
    } catch (error) {
      return { ok: false, error: `The backup is damaged: ${label} can't be read (${error.message}). Nothing was changed.` };
    }
  }
  return { ok: true, players, preview: describeBackup(players), exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '' };
}

/**
 * Restores checked players: 'replace' (everyone is replaced) or 'add' (they
 * are added as new players). The current data is kept first, so undoRestore()
 * can put it back. Throws with a message if it can't be done; then nothing
 * has changed.
 */
export function restoreBackup(store, players, mode, { appVersion = '' } = {}) {
  if (!['replace', 'add'].includes(mode)) throw new Error(`Unknown restore mode "${mode}".`);
  const undo = makeBackup(store, { appVersion });
  if (!store.storage.write(KEYS.undo, undo)) {
    throw new Error("There isn't room to keep a copy for undoing, so nothing was restored. Free up some space and try again.");
  }
  return store.importPlayers(players, { replace: mode === 'replace' });
}

/** True when there is a restore that can be undone. */
export function canUndoRestore(store) {
  return store.storage.read(KEYS.undo) !== null;
}

/** Puts back the data from before the last restore. Returns the players, or throws. */
export function undoRestore(store) {
  const saved = store.storage.read(KEYS.undo);
  if (!saved) throw new Error('There is no restore to undo.');
  // Before the restore there may have been no players at all.
  const parsed = Array.isArray(saved.players) && saved.players.length === 0 ? { ok: true, players: [] } : parseBackup(JSON.stringify(saved));
  if (!parsed.ok) throw new Error(parsed.error);
  const players = store.importPlayers(parsed.players, { replace: true });
  store.storage.remove(KEYS.undo);
  return players;
}

// ---------------------------------------------------------------- undoing Delete player (0.7.2)

/**
 * Keeps a copy of a player just before they are deleted (replacing any
 * earlier copy), so undoDelete() can bring them back. Returns false if it
 * could not be kept (the storage is full); the grown-up is then told the
 * delete can't be undone.
 */
export function keepDeletedPlayer(store, id, { appVersion = '', date = new Date() } = {}) {
  const player = store.exportPlayers().find((p) => p.profile.id === id);
  if (!player) return false;
  return store.storage.write(KEYS.deleted, { format: BACKUP_FORMAT, schema: BACKUP_SCHEMA, appVersion, exportedAt: date.toISOString(), players: [player] });
}

/** The deleted player that can be brought back, as { name, profile }, or null. A damaged copy counts as none. */
export function deletedPlayer(store) {
  const saved = store.storage.read(KEYS.deleted);
  if (!saved) return null;
  const parsed = parseBackup(JSON.stringify(saved));
  if (!parsed.ok || parsed.players.length !== 1) return null;
  return { name: parsed.players[0].profile.name, players: parsed.players };
}

/** Brings the last deleted player back (with a new name if theirs is taken now). Returns the player, or throws. */
export function undoDelete(store) {
  const deleted = deletedPlayer(store);
  if (!deleted) throw new Error('There is no deleted player to bring back.');
  if (!store.canAdd()) throw new Error('There are already as many players as there can be. Delete one first.');
  const [player] = store.importPlayers(deleted.players);
  store.storage.remove(KEYS.deleted);
  return player;
}

/**
 * Gives the grown-up the backup file: the share sheet on iPad (choose
 * "Save to Files"), otherwise a normal download. Returns 'shared',
 * 'downloaded' or 'cancelled'.
 */
export async function saveBackupFile(backup, { date = new Date() } = {}) {
  const name = backupFileName(date);
  const text = `${JSON.stringify(backup, null, 2)}\n`;
  const nav = globalThis.navigator;
  try {
    const file = new File([text], name, { type: 'application/json' });
    if (nav?.canShare?.({ files: [file] }) && nav.share) {
      await nav.share({ files: [file], title: 'Arithmetic Odyssey backup' });
      return 'shared';
    }
  } catch (error) {
    if (error?.name === 'AbortError') return 'cancelled';
    // Sharing failed: fall back to a download.
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}
