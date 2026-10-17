// Stage 3 tests: screens and keypad. These test the logic behind the screens;
// the screens themselves are checked in a browser (T3.1-T3.5, see README).
// Run from the arithmetic-odyssey folder with:  node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BACK, KEY_ORDER, SUBMIT, keyFromKeyboard, pressKey } from '../js/keypad.js';
import { HOLD_MS, holdProgress } from '../js/hold.js';
import { MAX_ANSWER_DIGITS, OPERATIONS } from '../js/math.js';
import { AVATARS, MAX_PROFILES, NAME_MAX_LENGTH, checkProfileName, cleanName, createProfileStore } from '../js/profiles.js';
import {
  ADVENTURE_LENGTHS, DEFAULT_SETTINGS, DEFAULT_SETUP, DETOUR_MAX, DETOUR_MIN, THEMES,
  normalizeSettings, normalizeSetup, stepDetourLength, toggleOperation,
} from '../js/settings.js';
import { checkStoryline, collectNext, loadStoryline, nextSticker, pictureUrl } from '../js/storyline.js';
import { colorFor } from '../js/art.js';
import { buildDinoStoryline } from '../tools/build-storyline.mjs';

const GAME = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(GAME, path), 'utf8');

// ---------------------------------------------------------------- T3.2 keypad
/** Presses keys in order, like a player tapping the keypad. */
function type(keys, start = '', maxDigits = MAX_ANSWER_DIGITS) {
  let value = start;
  const actions = [];
  for (const key of keys) {
    const result = pressKey(value, key, maxDigits);
    value = result.value;
    actions.push(result.action);
  }
  return { value, actions };
}

test('T3.2 the keypad enters digits in order', () => {
  assert.equal(type(['1', '2', '3']).value, '123');
  assert.deepEqual(type(['4', '2']).actions, ['changed', 'changed']);
});

test('T3.2 Backspace removes the last digit and does nothing on an empty answer', () => {
  assert.equal(type(['1', '2', BACK]).value, '1');
  assert.deepEqual(type([BACK]), { value: '', actions: ['ignored'] });
  assert.equal(type(['5', BACK, BACK, '7']).value, '7');
});

test('T3.2 Submit sends the answer without changing it', () => {
  assert.deepEqual(pressKey('56', SUBMIT), { value: '56', action: 'submit' });
  assert.deepEqual(pressKey('', SUBMIT), { value: '', action: 'submit' }, 'an empty answer is still sent; the game asks for a number');
});

test(`T3.2 the keypad stops at ${MAX_ANSWER_DIGITS} digits, the longest possible answer`, () => {
  const { value, actions } = type(['9', '8', '0', '1', '5', '6']);
  assert.equal(value, '9801');
  assert.deepEqual(actions.slice(4), ['full', 'full']);
  assert.equal(type(['1', '2', '3'], '', 2).value, '12', 'a smaller limit can be set');
  // The biggest answer in the game is 99 × 99 = 9801, which fits.
  assert.equal(String(99 * 99).length, MAX_ANSWER_DIGITS);
});

test('T3.2 a leading zero is replaced instead of making "07"', () => {
  assert.equal(type(['0', '7']).value, '7');
  assert.equal(type(['0', '0']).value, '0');
  assert.equal(type(['1', '0', '0']).value, '100', 'zeros after the first digit are kept');
});

test('T3.2 only digits, Backspace and Submit do anything', () => {
  for (const key of ['a', '-', '.', ' ', '10', '', '٣']) {
    assert.deepEqual(pressKey('12', key), { value: '12', action: 'ignored' }, `key "${key}"`);
  }
});

test('T3.2 the keypad has 0-9, Backspace and Submit, laid out like a phone keypad', () => {
  assert.deepEqual(KEY_ORDER, ['1', '2', '3', '4', '5', '6', '7', '8', '9', BACK, '0', SUBMIT]);
});

test('T3.2 a PC keyboard works too: digits, Backspace/Delete and Enter', () => {
  for (const digit of '0123456789') assert.equal(keyFromKeyboard(digit), digit);
  assert.equal(keyFromKeyboard('Backspace'), BACK);
  assert.equal(keyFromKeyboard('Delete'), BACK);
  assert.equal(keyFromKeyboard('Enter'), SUBMIT);
  for (const other of ['a', 'Tab', 'Escape', 'ArrowLeft', 'F5', ' ']) assert.equal(keyFromKeyboard(other), null, other);
});

// ---------------------------------------------------------------- T3.3 and T3.5 (checked in the code)
test('T3.3 answers are never typed into a text box (no <input> outside the new-player screen)', () => {
  const files = readdirSync(join(GAME, 'js'), { recursive: true }).filter((f) => f.endsWith('.js'));
  for (const file of files) {
    // The Restore button's file picker (type "file") opens Files, never the keyboard.
    const source = read(join('js', file)).replace(/h\('input', \{ type: 'file'/g, '');
    const hasInput = /h\('(input|textarea)'|createElement\('(input|textarea)'|contentEditable =|contenteditable:/.test(source);
    assert.equal(hasInput, file.replace(/\\/g, '/') === 'screens/profiles.js', `js/${file}`);
  }
  assert.doesNotMatch(read('index.html'), /<input|<textarea|contenteditable/);
});

test('T3.5 the styles turn off double-tap and pinch zoom, text selection and pull-to-refresh', () => {
  const css = read('css/style.css');
  assert.match(css, /touch-action: pan-x pan-y/);
  assert.doesNotMatch(css, /touch-action: (manipulation|auto)/);
  assert.match(read('js/app.js'), /addEventListener\(type, \(event\) => event\.preventDefault\(\), \{ passive: false \}\)/);
  assert.match(css, /#app\[data-screen="adventure"\] \{\s*overflow-y: hidden;/);
  assert.match(css, /body \{[^}]*user-select: none/);
  assert.match(css, /body \{[^}]*-webkit-touch-callout: none/);
  assert.match(css, /body \{[^}]*overscroll-behavior: none/);
});

test('T3.1 buttons are large: at least 60 px high', () => {
  const css = read('css/style.css');
  for (const [, px] of css.matchAll(/--button-height: (\d+)px/g)) assert.ok(Number(px) >= 60, `--button-height ${px}px`);
  const key = css.match(/\.key \{[^}]*height: clamp\((\d+)px/);
  assert.ok(key && Number(key[1]) >= 60, 'keypad keys');
});

test('T3.1 every screen in the app has its module', () => {
  const app = read('js/app.js');
  const screens = [...app.matchAll(/^ {2}(\w+): \{ build: (\w+)/gm)];
  assert.deepEqual(screens.map((m) => m[1]), ['start', 'profiles', 'newPlayer', 'home', 'playerPicture', 'setup', 'adventure', 'trailEnd', 'album', 'stats', 'learn', 'settings', 'voiceLab']);
  for (const [, , builder] of screens) assert.match(app, new RegExp(`import \\{[^}]*\\b${builder}\\b[^}]*\\} from './screens/`), builder);
});

// ---------------------------------------------------------------- grown-up hold
test('the grown-up button must be held for the full 3 seconds', () => {
  assert.equal(HOLD_MS, 3000);
  assert.equal(holdProgress(null, 5000), 0, 'not pressed');
  assert.equal(holdProgress(1000, 1000), 0);
  assert.equal(holdProgress(1000, 2500), 0.5);
  assert.ok(holdProgress(1000, 3999) < 1, 'just under 3 seconds is not enough');
  assert.equal(holdProgress(1000, 4000), 1);
  assert.equal(holdProgress(1000, 9000), 1, 'never over 1');
  assert.equal(holdProgress(1000, 500), 0, 'a clock going backwards is treated as 0');
});

// ---------------------------------------------------------------- players
test('player names are tidied and checked', () => {
  assert.equal(cleanName('  Sam   Lee '), 'Sam Lee');
  assert.equal(checkProfileName('Sam', []), '');
  assert.match(checkProfileName('   ', []), /Type a name/);
  assert.match(checkProfileName('x'.repeat(NAME_MAX_LENGTH + 1), []), /20 letters/);
  assert.equal(checkProfileName('x'.repeat(NAME_MAX_LENGTH), []), '');
  assert.match(checkProfileName('sam', [{ id: 'a', name: 'Sam' }]), /already a player/, 'names are unique, ignoring capitals');
  assert.equal(checkProfileName('Sam', [{ id: 'a', name: 'Sam' }], 'a'), '', 'a player can keep their own name');
});

test('players can be added, chosen and deleted', () => {
  let n = 0;
  const store = createProfileStore({ makeId: () => `id${++n}` });
  assert.equal(store.active(), null);
  const ana = store.add(' Ana ', 'dog');
  assert.equal(ana.name, 'Ana');
  assert.equal(ana.avatar, 'dog');
  assert.deepEqual(ana.settings, DEFAULT_SETTINGS);
  assert.deepEqual(ana.setup, normalizeSetup(DEFAULT_SETUP));
  assert.deepEqual(ana.collected, { dino: [], parks: [] });
  const ben = store.add('Ben', 'not an avatar');
  assert.equal(ben.avatar, AVATARS[0], 'an unknown avatar falls back to the first');
  store.select(ben.id);
  assert.equal(store.active().name, 'Ben');
  assert.throws(() => store.add('ben', 'dog'), /already a player/);
  assert.throws(() => store.select('missing'), /no longer exists/);
  assert.equal(store.remove(ben.id), true);
  assert.equal(store.active(), null, 'deleting the active player leaves no one chosen');
  assert.equal(store.remove(ben.id), false);
  assert.deepEqual(store.list().map((p) => p.name), ['Ana']);
});

test(`there can be up to ${MAX_PROFILES} players`, () => {
  const store = createProfileStore();
  for (let i = 1; i <= MAX_PROFILES; i++) store.add(`Player ${i}`, AVATARS[0]);
  assert.equal(store.canAdd(), false);
  assert.throws(() => store.add('One more', AVATARS[0]), /up to 8/);
  assert.equal(new Set(store.list().map((p) => p.id)).size, MAX_PROFILES, 'ids are unique even when made in the same millisecond');
});

test('changing settings and setup keeps them valid', () => {
  const store = createProfileStore();
  const p = store.add('Cy', AVATARS[0]);
  assert.deepEqual(store.updateSettings(p.id, { adventureLength: 60, voice: false }), { voice: false, sound: true, voiceId: '', speed: 'normal', adventureLength: 60, detourLength: 3 });
  assert.equal(store.updateSettings(p.id, { adventureLength: 55 }).adventureLength, 20, 'an invalid length goes back to the default');
  assert.deepEqual(store.updateSetup(p.id, { operations: ['×', '+'], difficulty: 'advanced' }).operations, ['+', '×'], 'kept in + − × ÷ order');
});

// ---------------------------------------------------------------- settings
test('settings are fixed up if they are missing or damaged', () => {
  assert.deepEqual(normalizeSettings(undefined), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings({ voice: 'yes', adventureLength: '40', detourLength: 11 }), DEFAULT_SETTINGS);
  assert.deepEqual(
    normalizeSettings({ voice: false, sound: false, voiceId: 'com.apple.voice.enhanced.en-US.Ava', speed: 'slower', adventureLength: 100, detourLength: 10 }),
    { voice: false, sound: false, voiceId: 'com.apple.voice.enhanced.en-US.Ava', speed: 'slower', adventureLength: 100, detourLength: 10 },
  );
  assert.equal(normalizeSettings({ speed: 'fast' }).speed, 'normal');
  assert.equal(normalizeSettings({ voiceId: 42 }).voiceId, '', 'a damaged voice choice goes back to automatic');
  assert.equal(normalizeSettings({ sound: 'off' }).sound, true, 'sound is on unless it is turned off');
  assert.deepEqual(ADVENTURE_LENGTHS, [20, 40, 60, 80, 100]);
  assert.equal(normalizeSettings({ detourLength: 2.5 }).detourLength, 3);
});

test('setup is fixed up: a known theme that is ready, known operations, a known difficulty', () => {
  assert.deepEqual(normalizeSetup(null), { theme: 'dino', operations: ['+'], difficulty: 'beginner' });
  assert.equal(normalizeSetup({ theme: 'parks' }).theme, 'parks', 'Off-Roading can be played');
  assert.equal(normalizeSetup({ theme: 'space' }).theme, 'dino');
  assert.deepEqual(normalizeSetup({ operations: ['÷', '-', '+'] }).operations, ['+', '÷'], 'a plain "-" is not the game minus sign');
  assert.deepEqual(normalizeSetup({ operations: [] }).operations, ['+'], 'at least one operation');
  assert.equal(normalizeSetup({ difficulty: 'expert' }).difficulty, 'beginner');
});

test('operations toggle on and off, but the last one stays on', () => {
  assert.deepEqual(toggleOperation(['+'], '×'), { operations: ['+', '×'], refused: false });
  assert.deepEqual(toggleOperation(['×'], '+'), { operations: ['+', '×'], refused: false }, 'kept in order');
  assert.deepEqual(toggleOperation(['+', '×'], '+'), { operations: ['×'], refused: false });
  assert.deepEqual(toggleOperation(['+'], '+'), { operations: ['+'], refused: true });
  assert.deepEqual(toggleOperation(['+'], '%'), { operations: ['+'], refused: true });
  // Tapping each one starting from just +: + is refused (last one on), the others are added.
  let ops = ['+'];
  for (const op of OPERATIONS) ops = toggleOperation(ops, op).operations;
  assert.deepEqual(ops, ['+', '−', '×', '÷']);
});

test('detour length moves one step at a time between 3 and 10', () => {
  assert.equal(stepDetourLength(3, -1), DETOUR_MIN);
  assert.equal(stepDetourLength(3, 1), 4);
  assert.equal(stepDetourLength(10, 1), DETOUR_MAX);
  assert.equal(stepDetourLength(10, -1), 9);
});

// ---------------------------------------------------------------- story file
const { storyline } = buildDinoStoryline();

test('the next stop is the first sticker in order the player does not have', () => {
  assert.equal(nextSticker(storyline, []).name, 'Eoraptor');
  assert.equal(nextSticker(storyline, ['eoraptor']).name, 'Herrerasaurus');
  assert.equal(nextSticker(storyline, ['herrerasaurus']).name, 'Eoraptor', 'a gap is filled first');
  assert.equal(nextSticker(storyline, storyline.stickers.map((s) => s.id)), null, 'all collected');
});

test('stickers are collected in order and never past the end', () => {
  const five = collectNext(storyline, [], 5);
  assert.deepEqual(five, storyline.stickers.slice(0, 5).map((s) => s.id));
  assert.equal(collectNext(storyline, five, 100).length, 60);
  assert.equal(nextSticker(storyline, collectNext(storyline, [], 20)).name, 'Stegosaurus', 'sticker 21 is the first Jurassic dinosaur');
});

test('picture addresses are encoded, so names with "+", spaces or "#" load', () => {
  assert.equal(pictureUrl('dino', 'pictures/Triassic/Staurikosaurus/Staurikosaurus+1_95ed.jpg'), 'themes/dino/pictures/Triassic/Staurikosaurus/Staurikosaurus%2B1_95ed.jpg');
  assert.equal(pictureUrl('dino', 'pictures/Jurassic/T rex/a#1.jpg'), 'themes/dino/pictures/Jurassic/T%20rex/a%231.jpg');
  assert.equal(pictureUrl('parks', 'pictures/x.jpg'), 'themes/national-parks/pictures/x.jpg');
});

test('the story file is checked when it loads', async () => {
  assert.equal(checkStoryline(storyline, 'dino'), storyline);
  assert.throws(() => checkStoryline(null, 'dino'), /empty or damaged/);
  assert.throws(() => checkStoryline({ ...storyline, schema: 2 }, 'dino'), /schema 2/);
  assert.throws(() => checkStoryline(storyline, 'parks'), /not "parks"/);
  assert.throws(() => checkStoryline({ ...storyline, stickers: [] }, 'dino'), /no stickers/);
  assert.throws(() => checkStoryline({ ...storyline, stickers: [{ id: 'x' }] }, 'dino'), /missing/);

  const asked = [];
  const okFetch = async (url) => {
    asked.push(url);
    return { ok: true, status: 200, json: async () => storyline };
  };
  assert.equal((await loadStoryline('dino', okFetch)).stickers.length, 60);
  assert.deepEqual(asked, ['themes/dino/storyline.json'], 'a relative address, so it works under /Home-School-Tools/');
  const missing = async () => ({ ok: false, status: 404, json: async () => ({}) });
  await assert.rejects(loadStoryline('dino', missing), /could not be loaded \(HTTP 404\)/);
  await assert.rejects(loadStoryline('space', okFetch), /Unknown theme/);
});

test('every theme has a folder that exists, and both themes can be played', () => {
  for (const theme of Object.values(THEMES)) {
    assert.ok(readdirSync(join(GAME, theme.folder)).length > 0, theme.folder);
  }
  assert.deepEqual(Object.values(THEMES).filter((t) => t.ready).map((t) => t.id), ['dino', 'parks']);
});

test('placeholder colours stay the same for each sticker', () => {
  assert.equal(colorFor('eoraptor'), colorFor('eoraptor'));
  assert.match(colorFor('eoraptor'), /^#[0-9a-f]{6}$/);
  const colours = new Set(storyline.stickers.map((s) => colorFor(s.id)));
  assert.ok(colours.size >= 4, 'stickers get a mix of colours');
});

// ---------------------------------------------------------------- player pictures
test('there are 16 player pictures, the ones asked for, each a file in images/avatars', async () => {
  const { AVATARS: PICTURES, avatarInfo, avatarUrl } = await import('../js/avatars.js');
  assert.deepEqual(PICTURES.map((a) => a.label), [
    'Diplodocus', 'Triceratops', 'T. rex', 'Mosasaur', 'Pterosaur', 'Pickup truck', 'Monster truck', 'Dirt bike',
    'SUV', 'ATV', 'Robot', 'Rocket', 'Butterfly', 'Unicorn', 'Dog', 'Cat',
  ]);
  assert.deepEqual(AVATARS, PICTURES.map((a) => a.id), 'players choose from the same list');
  assert.equal(new Set(AVATARS).size, 16);
  for (const a of PICTURES) {
    const path = join(GAME, 'images/avatars', a.file);
    assert.ok(existsSync(path), `images/avatars/${a.file} is missing`);
    assert.match(a.file, /\.(svg|png|jpe?g|webp)$/i, `${a.file} is a picture`);
    if (a.file.endsWith('.svg')) {
      const svg = readFileSync(path, 'utf8');
      assert.match(svg, /^<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]*viewBox=/, `${a.file} is an SVG drawing`);
      assert.doesNotMatch(svg, /<script|\son\w+=|href=/i, `${a.file} is only shapes`);
    }
  }
  assert.equal(avatarInfo('not-a-picture').id, 'longneck', 'an unknown picture falls back to the first');
  assert.equal(avatarUrl('trex'), 'images/avatars/trex/green.png', 'a relative address, so it works under /Home-School-Tools/');
  assert.equal(avatarUrl('trex', 3), 'images/avatars/trex/orange.png');
});
