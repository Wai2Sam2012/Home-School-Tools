// The counting tip card: the question drawn with counting blocks (for
// example 7 + 5 = ? as the 7 block, +, the 5 block, = and ?), opened with the
// 🙏 button next to a question. Addition and subtraction only, for now.

import { hasTip, tipSvg } from './blocks.js?v=0.7.0';
import { h } from './ui.js?v=0.7.0';

/**
 * Returns { el, show(problem), hide(), shown() }. onClose runs when the
 * player closes it; onToggle(open) whenever it opens or closes (the screen
 * makes room for it).
 */
export function createTipCard({ onClose = () => {}, onToggle = () => {} } = {}) {
  const picture = h('div', { class: 'tip-picture-box' });
  const close = h('button', { type: 'button', class: 'round-button tip-close', 'aria-label': 'Close Help', onclick: () => { hide(); onClose(); } }, '✕');
  const el = h('div', { class: 'tip-card', role: 'dialog', 'aria-label': 'Help: counting blocks', hidden: true },
    h('p', { class: 'tip-title' }, '🙏 Count the blocks'),
    picture,
    close);

  function show(problem) {
    if (!hasTip(problem)) return false;
    picture.innerHTML = tipSvg(problem);
    el.hidden = false;
    onToggle(true);
    return true;
  }
  function hide() {
    const wasOpen = !el.hidden;
    el.hidden = true;
    picture.replaceChildren();
    if (wasOpen) onToggle(false);
  }
  return { el, show, hide, shown: () => !el.hidden };
}

/**
 * The 🙏 Help button that opens the tip (hidden for problems without one).
 * The screens make two: one in front of the question (an upright screen) and
 * one under it (a wide screen); style.css shows the one that fits the screen.
 */
export function createTipButton(onclick, { place = 'below' } = {}) {
  return h('button', { type: 'button', class: `big-button tip-button tip-${place}`, 'aria-label': 'Help: count the blocks', onclick },
    h('span', { class: 'tip-icon', 'aria-hidden': 'true' }, '🙏'), 'Help');
}

/** Shows or hides a screen's Help buttons together. */
export function showTipButtons(buttons, show) {
  for (const b of buttons) b.hidden = !show;
}
