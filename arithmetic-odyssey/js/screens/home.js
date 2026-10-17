// The player's home: start an adventure, see stickers and stats, switch
// player, or (grown-ups, by holding for 3 seconds) open Settings.

import { createHoldButton } from '../hold.js?v=0.5.5';
import { avatarIcon } from '../avatars.js?v=0.5.5';
import { h } from '../ui.js?v=0.5.5';

export function homeScreen(ctx) {
  const player = ctx.profiles.active();
  const dinoCount = player.collected.dino.length;
  const trip = player.adventure && player.adventure.mode !== 'done' ? player.adventure : null;
  return h('main', { class: 'screen home-screen' },
    h('header', { class: 'home-header' },
      h('span', { class: 'player-avatar large', 'aria-hidden': 'true' }, avatarIcon(player.avatar)),
      h('h1', { tabIndex: -1 }, `Hi, ${player.name}!`),
      h('p', { class: 'lead' }, dinoCount ? `You have ${dinoCount} Dino ${dinoCount === 1 ? 'sticker' : 'stickers'}.` : 'Ready for an adventure?'),
    ),
    h('div', { class: trip ? 'home-grid has-trip' : 'home-grid' },
      trip
        ? h('button', { type: 'button', class: 'big-button primary home-adventure', onclick: () => ctx.show('adventure') },
          h('span', { class: 'button-icon', 'aria-hidden': 'true' }, '🗺️'),
          h('span', {}, 'Resume Adventure', h('span', { class: 'button-detail' }, `Step ${trip.step} of ${trip.length}`)))
        : h('button', { type: 'button', class: 'big-button primary home-adventure', onclick: () => ctx.show('setup') },
          h('span', { class: 'button-icon', 'aria-hidden': 'true' }, '🗺️'), 'Start Adventure'),
      trip ? h('button', { type: 'button', class: 'big-button', onclick: () => ctx.show('setup') }, 'New Adventure') : null,
      h('button', { type: 'button', class: 'big-button', onclick: () => ctx.show('album') },
        h('span', { class: 'button-icon', 'aria-hidden': 'true' }, '📒'), 'Sticker Album'),
      h('button', { type: 'button', class: 'big-button', onclick: () => ctx.show('stats') },
        h('span', { class: 'button-icon', 'aria-hidden': 'true' }, '🏆'), 'My Stats'),
    ),
    h('footer', { class: 'home-footer' },
      h('button', { type: 'button', class: 'big-button quiet', onclick: () => ctx.show('profiles') }, 'Switch player'),
      createHoldButton({ label: 'Grown-ups', onComplete: () => ctx.show('settings') }),
    ),
  );
}
