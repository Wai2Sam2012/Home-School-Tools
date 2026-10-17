// The counting tip card: the question drawn with counting blocks (for
// example 7 + 5 = ? as the 7 block, +, the 5 block, = and ?), opened with the
// 💡 button next to a question. Addition and subtraction only, for now.

import { hasTip, tipSvg } from './blocks.js?v=0.6.3';
import { h } from './ui.js?v=0.6.3';

/** Returns { el, show(problem), hide(), shown() }. onClose runs when the player closes it. */
export function createTipCard({ onClose = () => {} } = {}) {
  const picture = h('div', { class: 'tip-picture-box' });
  const close = h('button', { type: 'button', class: 'round-button tip-close', 'aria-label': 'Close the tip', onclick: () => { hide(); onClose(); } }, '✕');
  const el = h('div', { class: 'tip-card', role: 'dialog', 'aria-label': 'Counting tip', hidden: true },
    h('p', { class: 'tip-title' }, '💡 Count the blocks'),
    picture,
    close);

  function show(problem) {
    if (!hasTip(problem)) return false;
    picture.innerHTML = tipSvg(problem);
    el.hidden = false;
    return true;
  }
  function hide() {
    el.hidden = true;
    picture.replaceChildren();
  }
  return { el, show, hide, shown: () => !el.hidden };
}

/** The 💡 button that opens the tip (hidden for problems without one). */
export function createTipButton(onclick) {
  return h('button', { type: 'button', class: 'round-button tip-button', 'aria-label': 'Show a counting tip', onclick }, '💡');
}
