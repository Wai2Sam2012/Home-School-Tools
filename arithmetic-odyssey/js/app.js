// Starts the game: keeps the players and story files, and switches between
// screens. Each screen is a function in js/screens/ that builds its page.

import { APP_VERSION } from './version.js?v=0.6.5';
import { addDebugAction, addDebugInfo, isDebugOn, showDebugPanel } from './debug.js?v=0.6.5';
import { audioSuspended, loadRecording, pickDifferent, playRecording, playSound, soundLength, unlockAudio } from './audio.js?v=0.6.5';
import { AVATARS, createProfileStore } from './profiles.js?v=0.6.5';
import { askToKeepData, createStorage, deviceStorage } from './storage.js?v=0.6.5';
import { SPEECH_RATES, chooseVoice, createSpeaker, loadVoices } from './speech.js?v=0.6.5';
import { THEMES } from './settings.js?v=0.6.5';
import { collectNext, loadStoryline, pictureUrl } from './storyline.js?v=0.6.5';
import { h } from './ui.js?v=0.6.5';
import { startScreen } from './screens/start.js?v=0.6.5';
import { newPlayerScreen, playerPictureScreen, profilesScreen } from './screens/profiles.js?v=0.6.5';
import { homeScreen } from './screens/home.js?v=0.6.5';
import { setupScreen } from './screens/setup.js?v=0.6.5';
import { adventureScreen } from './screens/adventure.js?v=0.6.5';
import { trailEndScreen } from './screens/trail-end.js?v=0.6.5';
import { albumScreen } from './screens/album.js?v=0.6.5';
import { statsScreen } from './screens/stats.js?v=0.6.5';
import { learnScreen } from './screens/learn.js?v=0.6.5';
import { settingsScreen } from './screens/settings.js?v=0.6.5';
import { voiceLabScreen } from './screens/voice-lab.js?v=0.6.5';

const SCREENS = {
  start: { build: startScreen },
  profiles: { build: profilesScreen },
  newPlayer: { build: newPlayerScreen },
  home: { build: homeScreen, needsPlayer: true },
  playerPicture: { build: playerPictureScreen, needsPlayer: true },
  setup: { build: setupScreen, needsPlayer: true },
  adventure: { build: adventureScreen, needsPlayer: true },
  trailEnd: { build: trailEndScreen, needsPlayer: true },
  album: { build: albumScreen, needsPlayer: true },
  stats: { build: statsScreen, needsPlayer: true },
  learn: { build: learnScreen, needsPlayer: true },
  settings: { build: settingsScreen, needsPlayer: true },
  voiceLab: { build: voiceLabScreen },
};

// If the browser showed an older cached copy of index.html, there is no #app
// yet; make one instead of failing to start.
const root = document.getElementById('app') ?? document.body.appendChild(Object.assign(document.createElement('div'), { id: 'app' }));
for (const leftover of document.body.querySelectorAll(':scope > main')) leftover.remove();
const storylines = new Map();
const flagRecordings = new Map(); // theme -> its loaded recordings (themes/<theme>/sounds/flag-1.mp3, ...)
const lastFlag = new Map(); // theme -> the recording played last time
let current = { name: null, params: {}, leave: [] };

// Saving problems (damaged data set aside, storage full or unavailable) are
// listed in Settings and shown once in a short message.
const problems = [];
const lastShown = new Map();
function notify(message, ms = 6000) {
  const toast = h('div', { class: 'toast', role: 'alert' }, message);
  document.body.append(toast);
  setTimeout(() => toast.remove(), ms);
}
function reportProblem(problem) {
  problems.push({ ...problem, at: new Date().toISOString() });
  // The same kind of problem is shown at most once a minute (a full storage fails on every question).
  const now = Date.now();
  if (now - (lastShown.get(problem.type) ?? -Infinity) < 60000) return;
  lastShown.set(problem.type, now);
  notify(problem.message);
}

const ctx = {
  version: APP_VERSION,
  audio: null,
  debugAdventure: null, // set by the adventure screen while it is shown
  profiles: createProfileStore({ storage: createStorage(deviceStorage(), { onProblem: reportProblem }) }),
  /** Saving problems so far: [{ type, key, message, at }] (shown in Settings). */
  problems,
  notify,
  speaker: createSpeaker(),
  /** 'locked' until Tap to Start, then 'loading', 'ready' (a voice was found) or 'none'. */
  voiceState: 'locked',
  /** The device's voices, once loaded (for the voice list in Settings). */
  voices: [],

  /** Tap to Start: unlocks sound and speech and finds a voice (GAME-PLAN.md 1.9). */
  unlock() {
    ctx.audio = unlockAudio();
    // Asks the browser to keep the saved players even when the iPad is short of space.
    askToKeepData();
    if (ctx.voiceState !== 'locked') return;
    ctx.speaker.unlock();
    ctx.voiceState = 'loading';
    loadVoices(globalThis.speechSynthesis).then((voices) => {
      ctx.voices = voices;
      ctx.speaker.setVoice(chooseVoice(voices));
      ctx.voiceState = ctx.speaker.available && ctx.speaker.voice ? 'ready' : 'none';
    });
  },

  /**
   * True when questions should be read aloud for this player: Voice is on and
   * a voice was found. Also sets the player's chosen voice and speed.
   */
  voiceOn(player) {
    if (!player?.settings.voice || ctx.voiceState !== 'ready') return false;
    ctx.speaker.setVoice(chooseVoice(ctx.voices, { chosenId: player.settings.voiceId }));
    ctx.speaker.rate = SPEECH_RATES[player.settings.speed] ?? SPEECH_RATES.normal;
    return true;
  },

  /**
   * Plays a sound effect if the active player has sound turned on. Returns
   * how long it lasts in milliseconds (0 if nothing played), so speech can
   * wait for it instead of talking over it.
   */
  sound(name) {
    if (ctx.profiles.active()?.settings.sound === false) return 0;
    return playSound(name) ? soundLength(name) : 0;
  },

  /**
   * Plays a theme's flag sound: one of its recordings, picked at random (a
   * different one each time), or if it has none the sound made in
   * js/audio.js (a roar or an engine). Returns how long it lasts in
   * milliseconds, so the voice can wait for it.
   */
  flagSound(theme) {
    if (ctx.profiles.active()?.settings.sound === false) return 0;
    const recordings = flagRecordings.get(theme) ?? [];
    const i = pickDifferent(recordings.length, lastFlag.get(theme));
    lastFlag.set(theme, i);
    const ms = i >= 0 ? playRecording(recordings[i]) : 0;
    return ms || ctx.sound(THEMES[theme]?.flagSound ?? 'milestone');
  },

  /** Loads a theme's recorded flag sounds ahead of time (after Tap to Start). Resolves the list of recordings (maybe empty). */
  async prepareSounds(theme) {
    const storyline = await ctx.getStoryline(theme).catch(() => null);
    const paths = [].concat(storyline?.sounds?.flag ?? []);
    const recordings = (await Promise.all(paths.map((path) => loadRecording(pictureUrl(theme, path))))).filter(Boolean);
    flagRecordings.set(theme, recordings);
    return recordings;
  },

  /** The theme's story file, loaded once. A failed load is tried again next time. */
  getStoryline(theme) {
    if (!storylines.has(theme)) {
      storylines.set(theme, loadStoryline(theme).catch((error) => {
        storylines.delete(theme);
        throw error;
      }));
    }
    return storylines.get(theme);
  },

  /** Runs fn when the current screen closes (to stop timers and listeners). */
  onLeave(fn) {
    current.leave.push(fn);
  },

  show(name, params = {}) {
    for (const fn of current.leave.splice(0)) {
      try {
        fn();
      } catch (error) {
        console.error(error);
      }
    }
    for (const overlay of document.querySelectorAll('.overlay')) {
      if (overlay.closeOverlay) overlay.closeOverlay();
      else overlay.remove();
    }
    let screen = SCREENS[name] ?? SCREENS.start;
    if (screen.needsPlayer && !ctx.profiles.active()) {
      name = 'profiles';
      screen = SCREENS.profiles;
    }
    current = { name, params, leave: [] };
    let page;
    try {
      page = screen.build(ctx, params);
    } catch (error) {
      console.error(error);
      page = errorScreen(error);
    }
    root.replaceChildren(page);
    root.dataset.screen = name;
    root.scrollTop = 0;
    page.querySelector('h1')?.focus({ preventScroll: true });
  },

  /** Draws the current screen again (used after debug actions). */
  refresh() {
    ctx.show(current.name, current.params);
  },
};

function errorScreen(error) {
  return h('main', { class: 'screen error-screen' },
    h('h1', { tabIndex: -1 }, 'Oops! Something went wrong.'),
    h('p', { class: 'form-error' }, error.message),
    h('button', { type: 'button', class: 'big-button primary', onclick: () => ctx.show('start') }, 'Back to the start'),
  );
}

function addDebugTools() {
  addDebugInfo('Screen shown', () => current.name);
  addDebugInfo('Players', () => ctx.profiles.list().map((p) => p.name).join(', ') || 'none');
  addDebugInfo('Sound and speech unlocked', () => (ctx.audio ? `sound ${ctx.audio.sound ? 'yes' : 'no'}, speech ${ctx.audio.speech ? 'yes' : 'no'}` : 'not yet (tap Start)'));
  addDebugInfo('Voice', () => (ctx.speaker.voice ? `${ctx.speaker.voice.name} (${ctx.speaker.voice.lang}, ${ctx.speaker.voice.localService ? 'offline' : 'needs internet'})` : ctx.voiceState));
  addDebugInfo('Last speech finished by', () => ctx.speaker.lastEnd || 'nothing spoken yet');
  addDebugAction('Open the voice and sound tester', () => {
    ctx.unlock(); // the tap on this button also unlocks sound and speech
    ctx.show('voiceLab');
    return 'Tester opened. Hide this panel to see it all.';
  });
  addDebugAction('Speech: pretend the end event never comes', () => {
    ctx.speaker.simulateStuck = !ctx.speaker.simulateStuck;
    return ctx.speaker.simulateStuck
      ? 'On: speech now only finishes by the safety timeout (2-10 s).'
      : 'Off: speech finishes normally again.';
  });
  addDebugAction('Add a test player', () => {
    if (!ctx.profiles.canAdd()) return 'The player list is full.';
    let n = 1;
    while (ctx.profiles.list().some((p) => p.name === `Tester ${n}`)) n += 1;
    const player = ctx.profiles.add(`Tester ${n}`, AVATARS[n % AVATARS.length]);
    ctx.profiles.select(player.id);
    ctx.show('home');
    return `Added and chose ${player.name}.`;
  });
  addDebugAction('Collect the next 5 Dino stickers', async () => {
    const player = ctx.profiles.active();
    if (!player) return 'Choose a player first.';
    const storyline = await ctx.getStoryline('dino');
    ctx.profiles.setCollected(player.id, 'dino', collectNext(storyline, player.collected.dino, 5));
    ctx.refresh();
    return `${player.name} has ${player.collected.dino.length} Dino stickers.`;
  });
  const onAdventure = (run) => () => (ctx.debugAdventure ? run(ctx.debugAdventure) : 'Start or resume an adventure first.');
  addDebugAction('Adventure: answer right', onAdventure((a) => a.answer(true)));
  addDebugAction('Adventure: answer wrong', onAdventure((a) => a.answer(false)));
  addDebugAction('Adventure: jump to just before the next flag', onAdventure((a) => a.jump('flag')));
  addDebugAction('Adventure: jump to the last step', onAdventure((a) => a.jump('end')));
  addDebugAction("Remove the player's stickers", () => {
    const player = ctx.profiles.active();
    if (!player) return 'Choose a player first.';
    for (const theme of Object.keys(player.collected)) ctx.profiles.setCollected(player.id, theme, []);
    ctx.refresh();
    return `Removed ${player.name}'s stickers.`;
  });
  showDebugPanel(APP_VERSION);
}

// No pinch zoom while playing. Safari ignores user-scalable=no and doesn't
// fully honour touch-action, so stop its pinch gesture directly.
for (const type of ['gesturestart', 'gesturechange']) {
  document.addEventListener(type, (event) => event.preventDefault(), { passive: false });
}
document.addEventListener('touchmove', (event) => {
  if (event.touches.length > 1) event.preventDefault();
}, { passive: false });

// No double-tap zoom either: Safari can still zoom on two quick taps (for
// example on Submit). Cancelling the second tap stops the zoom but also its
// click, so press the button here instead; fast typing ("11") still works.
// A swipe (to scroll the album) never presses anything.
let tapStart = null;
let lastTapAt = 0;
document.addEventListener('touchstart', (event) => {
  const touch = event.touches[0];
  tapStart = event.touches.length === 1 && touch ? { x: touch.clientX, y: touch.clientY } : null;
}, { passive: true });
document.addEventListener('touchend', (event) => {
  const touch = event.changedTouches[0];
  if (!touch || event.touches.length) return;
  const moved = !tapStart || Math.hypot(touch.clientX - tapStart.x, touch.clientY - tapStart.y) > 10;
  const now = Date.now();
  if (!moved && now - lastTapAt < 350) {
    event.preventDefault();
    const button = event.target.closest?.('button');
    if (button && !button.disabled) button.click();
  }
  lastTapAt = moved ? 0 : now;
}, { passive: false });

// "Tap to continue": back from the background, the iPad may have suspended
// sound. A tap is needed to start it again.
document.addEventListener('visibilitychange', () => {
  if (document.hidden || !audioSuspended() || document.querySelector('.resume-overlay')) return;
  const overlay = h('div', { class: 'overlay resume-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Tap to continue' },
    h('button', {
      type: 'button',
      class: 'big-button primary start-button',
      onclick: () => {
        unlockAudio();
        overlay.remove();
      },
    }, 'Tap to continue'));
  overlay.closeOverlay = () => overlay.remove();
  document.body.append(overlay);
});

if (isDebugOn()) {
  addDebugTools();
  // For automated browser checks only (never without ?debug=1).
  globalThis.aoDebug = ctx;
}
ctx.show('start');

// Tells the loading check in index.html that the scripts ran.
document.documentElement.dataset.ready = '1';
