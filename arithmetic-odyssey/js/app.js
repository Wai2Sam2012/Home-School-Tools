// Starts the game: keeps the players and story files, and switches between
// screens. Each screen is a function in js/screens/ that builds its page.

import { APP_VERSION } from './version.js';
import { addDebugAction, addDebugInfo, isDebugOn, showDebugPanel } from './debug.js';
import { AVATARS, createProfileStore } from './profiles.js';
import { collectNext, loadStoryline } from './storyline.js';
import { h } from './ui.js';
import { startScreen } from './screens/start.js';
import { newPlayerScreen, profilesScreen } from './screens/profiles.js';
import { homeScreen } from './screens/home.js';
import { setupScreen } from './screens/setup.js';
import { practiceScreen } from './screens/practice.js';
import { albumScreen } from './screens/album.js';
import { statsScreen } from './screens/stats.js';
import { settingsScreen } from './screens/settings.js';

const SCREENS = {
  start: { build: startScreen },
  profiles: { build: profilesScreen },
  newPlayer: { build: newPlayerScreen },
  home: { build: homeScreen, needsPlayer: true },
  setup: { build: setupScreen, needsPlayer: true },
  practice: { build: practiceScreen, needsPlayer: true },
  album: { build: albumScreen, needsPlayer: true },
  stats: { build: statsScreen, needsPlayer: true },
  settings: { build: settingsScreen, needsPlayer: true },
};

const root = document.getElementById('app');
const storylines = new Map();
let current = { name: null, params: {}, leave: [] };

const ctx = {
  version: APP_VERSION,
  audio: null,
  profiles: createProfileStore(),

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
    window.scrollTo(0, 0);
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
  addDebugAction("Remove the player's stickers", () => {
    const player = ctx.profiles.active();
    if (!player) return 'Choose a player first.';
    for (const theme of Object.keys(player.collected)) player.collected[theme] = [];
    ctx.refresh();
    return `Removed ${player.name}'s stickers.`;
  });
  showDebugPanel(APP_VERSION);
}

if (isDebugOn()) addDebugTools();
ctx.show('start');

// Tells the loading check in index.html that the scripts ran.
document.documentElement.dataset.ready = '1';
