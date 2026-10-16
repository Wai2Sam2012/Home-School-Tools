// The player's home: start an adventure, see stickers and stats, switch
// player, or (grown-ups, by holding for 3 seconds) open Settings.

import { createHoldButton } from '../hold.js?v=0.3.1';
import { h } from '../ui.js?v=0.3.1';

export function homeScreen(ctx) {
  const player = ctx.profiles.active();
  const dinoCount = player.collected.dino.length;
  return h('main', { class: 'screen home-screen' },
    h('header', { class: 'home-header' },
      h('span', { class: 'player-avatar large', 'aria-hidden': 'true' }, player.avatar),
      h('h1', { tabIndex: -1 }, `Hi, ${player.name}!`),
      h('p', { class: 'lead' }, dinoCount ? `You have ${dinoCount} Dino ${dinoCount === 1 ? 'sticker' : 'stickers'}.` : 'Ready for an adventure?'),
    ),
    h('div', { class: 'home-grid' },
      h('button', { type: 'button', class: 'big-button primary home-adventure', onclick: () => ctx.show('setup') },
        h('span', { class: 'button-icon', 'aria-hidden': 'true' }, '🗺️'), 'Start Adventure'),
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
