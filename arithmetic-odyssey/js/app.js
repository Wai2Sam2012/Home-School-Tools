// Starts the game: keeps the players and story files, and switches between
// screens. Each screen is a function in js/screens/ that builds its page.

import { APP_VERSION } from './version.js?v=0.5.4';
import { addDebugAction, addDebugInfo, isDebugOn, showDebugPanel } from './debug.js?v=0.5.4';
import { audioSuspended, playSound, soundLength, unlockAudio } from './audio.js?v=0.5.4';
import { AVATARS, createProfileStore } from './profiles.js?v=0.5.4';
import { SPEECH_RATES, chooseVoice, createSpeaker, loadVoices } from './speech.js?v=0.5.4';
import { collectNext, loadStoryline } from './storyline.js?v=0.5.4';
import { h } from './ui.js?v=0.5.4';
import { startScreen } from './screens/start.js?v=0.5.4';
import { newPlayerScreen, profilesScreen } from './screens/profiles.js?v=0.5.4';
import { homeScreen } from './screens/home.js?v=0.5.4';
import { setupScreen } from './screens/setup.js?v=0.5.4';
import { adventureScreen } from './screens/adventure.js?v=0.5.4';
import { trailEndScreen } from './screens/trail-end.js?v=0.5.4';
import { albumScreen } from './screens/album.js?v=0.5.4';
import { statsScreen } from './screens/stats.js?v=0.5.4';
import { settingsScreen } from './screens/settings.js?v=0.5.4';
import { voiceLabScreen } from './screens/voice-lab.js?v=0.5.4';

const SCREENS = {
  start: { build: startScreen },
  profiles: { build: profilesScreen },
  newPlayer: { build: newPlayerScreen },
  home: { build: homeScreen, needsPlayer: true },
  setup: { build: setupScreen, needsPlayer: true },
  adventure: { build: adventureScreen, needsPlayer: true },
  trailEnd: { build: trailEndScreen, needsPlayer: true },
  album: { build: albumScreen, needsPlayer: true },
  stats: { build: statsScreen, needsPlayer: true },
  settings: { build: settingsScreen, needsPlayer: true },
  voiceLab: { build: voiceLabScreen },
};

// If the browser showed an older cached copy of index.html, there is no #app
// yet; make one instead of failing to start.
const root = document.getElementById('app') ?? document.body.appendChild(Object.assign(document.createElement('div'), { id: 'app' }));
for (const leftover of document.body.querySelectorAll(':scope > main')) leftover.remove();
const storylines = new Map();
let current = { name: null, params: {}, leave: [] };

const ctx = {
  version: APP_VERSION,
  audio: null,
  debugAdventure: null, // set by the adventure screen while it is shown
  profiles: createProfileStore(),
  speaker: createSpeaker(),
  /** 'locked' until Tap to Start, then 'loading', 'ready' (a voice was found) or 'none'. */
  voiceState: 'locked',
  /** The device's voices, once loaded (for the voice list in Settings). */
  voices: [],

  /** Tap to Start: unlocks sound and speech and finds a voice (GAME-PLAN.md 1.9). */
  unlock() {
    ctx.audio = unlockAudio();
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
    player.collected.dino = collectNext(storyline, player.collected.dino, 5);
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
    for (const theme of Object.keys(player.collected)) player.collected[theme] = [];
    ctx.refresh();
    return `Removed ${player.name}'s stickers.`;
  });
  showDebugPanel(APP_VERSION);
}

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
