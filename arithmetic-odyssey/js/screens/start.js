// 1. Tap to Start: shown on every launch. The tap unlocks sound and speech.

import { h } from '../ui.js?v=0.6.4';

/** The math symbol between the dinosaur and the truck changes through these. */
export const START_SYMBOLS = Object.freeze(['➗', '➕', '➖', '✖️']);
export const SYMBOL_MS = 1500;

export function startScreen(ctx) {
  let index = 0;
  const symbol = h('span', { class: 'start-symbol' }, START_SYMBOLS[0]);
  const timer = setInterval(() => {
    index = (index + 1) % START_SYMBOLS.length;
    symbol.textContent = START_SYMBOLS[index];
    // Restart the little flip animation for the new symbol.
    symbol.classList.remove('flip');
    void symbol.offsetWidth;
    symbol.classList.add('flip');
  }, SYMBOL_MS);
  ctx.onLeave(() => clearInterval(timer));

  return h('main', { class: 'screen start-screen' },
    h('div', { class: 'start-art', 'aria-hidden': 'true' }, '🦕', symbol, '🛻'),
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
