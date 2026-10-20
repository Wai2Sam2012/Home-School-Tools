// The Help card (🙏): the question drawn as a picture to count or work out,
// opened with the Help button next to a question. 7 + 5 as the 7 block, +,
// the 5 block, = and ?; 4 × 23 as 4 rows of 23; 47 × 38 split into tens and
// ones; 56 ÷ 7 as rows of 7 to count; 72 ÷ 3 as 60 ÷ 3 and 12 ÷ 3 (js/blocks.js).

import { hasTip, tipSvg, tipTitle } from './blocks.js?v=0.7.3';
import { h } from './ui.js?v=0.7.3';

/**
 * Returns { el, show(problem), hide(), shown() }. onClose runs when the
 * player closes it; onToggle(open) whenever it opens or closes (the screen
 * makes room for it).
 */
export function createTipCard({ onClose = () => {}, onToggle = () => {} } = {}) {
  const picture = h('div', { class: 'tip-picture-box' });
  const close = h('button', { type: 'button', class: 'round-button tip-close', 'aria-label': 'Close Help', onclick: () => { hide(); onClose(); } }, '✕');
  const title = h('p', { class: 'tip-title' });
  // The ✕ sits in the title row, so it never covers the picture (0.7.2).
  const el = h('div', { class: 'tip-card', role: 'dialog', 'aria-label': 'Help', hidden: true },
    h('div', { class: 'tip-header' }, title, close),
    picture);

  function show(problem) {
    if (!hasTip(problem)) return false;
    title.textContent = `🙏 ${tipTitle(problem)}`;
    picture.innerHTML = tipSvg(problem); // numbers only (hasTip checks they are whole numbers)
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
