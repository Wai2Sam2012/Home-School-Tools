// 2. Profiles: choose a player or make a new one, or change a player's
// picture. Deleting a player is in the grown-up Settings, so it can't happen by
// accident.

import { AVATARS, MAX_PROFILES, NAME_MAX_LENGTH, checkProfileName } from '../profiles.js?v=0.7.0';
import { createAvatarPicker } from '../avatar-picker.js?v=0.7.0';
import { playerIcon } from '../avatars.js?v=0.7.0';
import { h, topBar } from '../ui.js?v=0.7.0';


export function profilesScreen(ctx) {
  const players = ctx.profiles.list();
  const cards = players.map((p) =>
    h('button', {
      type: 'button',
      class: 'player-card',
      onclick: () => {
        ctx.profiles.select(p.id);
        ctx.show('home');
      },
    }, h('span', { class: 'player-avatar', 'aria-hidden': 'true' }, playerIcon(p)), h('span', { class: 'player-name' }, p.name)),
  );
  if (ctx.profiles.canAdd()) {
    cards.push(h('button', { type: 'button', class: 'player-card new-player', onclick: () => ctx.show('newPlayer') },
      h('span', { class: 'player-avatar', 'aria-hidden': 'true' }, '＋'),
      h('span', { class: 'player-name' }, 'New player')));
  }
  return h('main', { class: 'screen profiles-screen' },
    topBar(players.length ? "Who's playing?" : 'Welcome!', () => ctx.show('start')),
    players.length ? null : h('p', { class: 'lead' }, 'Make a player to start your adventure.'),
    h('div', { class: 'player-grid' }, cards),
    players.length >= MAX_PROFILES ? h('p', { class: 'note' }, `There can be up to ${MAX_PROFILES} players. A grown-up can delete one in Settings.`) : null,
  );
}

export function newPlayerScreen(ctx) {
  const picker = createAvatarPicker({ avatar: AVATARS[ctx.profiles.list().length % AVATARS.length] });
  const error = h('p', { class: 'form-error', role: 'alert' });
  // The only text box in the game: a grown-up usually types the name.
  const input = h('input', {
    type: 'text',
    id: 'player-name',
    class: 'name-input',
    maxLength: NAME_MAX_LENGTH,
    autocomplete: 'off',
    autocapitalize: 'words',
    enterkeyhint: 'done',
    placeholder: 'Name',
  });

  input.spellcheck = false;

  function create() {
    const problem = checkProfileName(input.value, ctx.profiles.list());
    if (problem) {
      error.textContent = problem;
      input.focus();
      return;
    }
    try {
      const { avatar, color } = picker.value();
      const player = ctx.profiles.add(input.value, avatar, color);
      ctx.profiles.select(player.id);
      ctx.show('home');
    } catch (e) {
      error.textContent = e.message;
    }
  }

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      create();
    }
  });
  input.addEventListener('input', () => {
    error.textContent = '';
  });

  return h('main', { class: 'screen new-player-screen' },
    topBar('New player', () => ctx.show('profiles')),
    h('section', { class: 'panel' },
      picker.el,
      h('h2', {}, h('label', { for: 'player-name' }, "What's your name?")),
      // Side by side on a wide screen, so the whole form fits without scrolling.
      h('div', { class: 'name-row' },
        input,
        h('button', { type: 'button', class: 'big-button primary', onclick: create }, 'Create player')),
      error,
    ),
  );
}

/** A player changes their picture or its color (opened by tapping the picture on Home). */
export function playerPictureScreen(ctx) {
  const player = ctx.profiles.active();
  const picker = createAvatarPicker({ avatar: player.avatar, color: player.color });
  function done() {
    // A saving problem shows the game's usual notice (js/app.js), so just carry on.
    const { avatar, color } = picker.value();
    ctx.profiles.setPicture(player.id, avatar, color);
    ctx.show('home');
  }
  return h('main', { class: 'screen player-picture-screen' },
    topBar(`${player.name}'s picture`, () => ctx.show('home')),
    h('section', { class: 'panel' },
      picker.el,
      h('button', { type: 'button', class: 'big-button primary', onclick: done }, 'Use this picture'),
    ),
  );
}
