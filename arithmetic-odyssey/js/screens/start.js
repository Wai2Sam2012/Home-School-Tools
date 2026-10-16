// 1. Tap to Start: shown on every launch. The tap unlocks sound and speech.

import { h } from '../ui.js?v=0.5.0';

export function startScreen(ctx) {
  return h('main', { class: 'screen start-screen' },
    h('div', { class: 'start-art', 'aria-hidden': 'true' }, '🦕', h('span', {}, '➗'), '🛻'),
    h('h1', { tabIndex: -1 }, 'Arithmetic Odyssey'),
    h('p', { class: 'tagline' }, 'A math adventure'),
    h('button', {
      type: 'button',
      class: 'big-button primary start-button',
      onclick: () => {
        ctx.unlock();
        ctx.show('profiles');
      },
    }, 'Tap to Start'),
    h('p', { class: 'version' }, `Version ${ctx.version}`),
  );
}
