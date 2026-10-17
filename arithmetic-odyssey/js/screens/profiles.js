// 2. Profiles: choose a player or make a new one. Deleting a player is in
// the grown-up Settings, so it can't happen by accident.

import { AVATARS, MAX_PROFILES, NAME_MAX_LENGTH, checkProfileName } from '../profiles.js?v=0.5.2';
import { avatarIcon, avatarInfo } from '../avatars.js?v=0.5.2';
import { h, topBar } from '../ui.js?v=0.5.2';

const NOT_SAVED_NOTE = 'Test version: players and stickers are not saved yet, so they reset when the page reloads.';

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
    }, h('span', { class: 'player-avatar', 'aria-hidden': 'true' }, avatarIcon(p.avatar)), h('span', { class: 'player-name' }, p.name)),
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
    h('p', { class: 'note notice' }, NOT_SAVED_NOTE),
  );
}

export function newPlayerScreen(ctx) {
  let avatar = AVATARS[ctx.profiles.list().length % AVATARS.length];
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

  const avatarButtons = AVATARS.map((a) =>
    h('button', {
      type: 'button',
      class: 'avatar-choice',
      'aria-pressed': String(a === avatar),
      'aria-label': avatarInfo(a).label,
      dataset: { avatar: a },
      onclick: (event) => {
        avatar = a;
        for (const b of avatarButtons) b.setAttribute('aria-pressed', String(b === event.currentTarget));
      },
    }, avatarIcon(a), h('span', { class: 'avatar-name' }, avatarInfo(a).label)),
  );

  function create() {
    const problem = checkProfileName(input.value, ctx.profiles.list());
    if (problem) {
      error.textContent = problem;
      input.focus();
      return;
    }
    try {
      const player = ctx.profiles.add(input.value, avatar);
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
      h('h2', {}, 'Pick a picture'),
      h('div', { class: 'avatar-grid', role: 'group', 'aria-label': 'Player picture' }, avatarButtons),
      h('h2', {}, h('label', { for: 'player-name' }, "What's your name?")),
      input,
      error,
      h('button', { type: 'button', class: 'big-button primary', onclick: create }, 'Create player'),
    ),
  );
}
