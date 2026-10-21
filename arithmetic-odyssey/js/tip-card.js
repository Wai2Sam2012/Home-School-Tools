// The Help card (🙏): the question drawn as a picture to count or work out,
// opened with the Help button next to a question. 7 + 5 as the 7 block, +,
// the 5 block, = and ?; 3 × 4 as 3 groups of 4; 47 × 38 in columns with
// boxes to write in (js/column-pad.js); 56 ÷ 7 as rows of 7 to count; 72 ÷ 3
// as 60 ÷ 3 and 12 ÷ 3 (js/blocks.js).

import { hasTip, tipKind, tipSvg, tipTitle } from './blocks.js?v=0.7.7';
import { createColumnPad } from './column-pad.js?v=0.7.7';
import { h } from './ui.js?v=0.7.7';

/**
 * Returns { el, show(problem), hide(), shown(), press(key) }. onClose runs
 * when the player closes it; onToggle(open) whenever it opens or closes (the
 * screen makes room for it). press(key) gives a keypad key to the column
 * note pad: true if it went into a box (the screen's keypad then leaves the
 * answer alone).
 */
export function createTipCard({ onClose = () => {}, onToggle = () => {}, onAnswer = null } = {}) {
  const picture = h('div', { class: 'tip-picture-box' });
  // The column note pad: submit the answer written in its bottom row (0.7.7).
  const padMessage = h('p', { class: 'pad-message', role: 'status' });
  const submitPad = h('button', {
    type: 'button',
    class: 'big-button primary pad-submit',
    onclick: () => {
      const result = pad?.answer();
      if (!result) return;
      if (!result.ok) {
        padMessage.textContent = result.reason === 'gap' ? 'Fill in the empty box between the digits first.' : 'Write the answer in the bottom row first.';
        return;
      }
      padMessage.textContent = '';
      onAnswer?.(result.value);
    },
  }, h('span', { 'aria-hidden': 'true' }, '✓ '), 'Submit this answer');
  const padActions = h('div', { class: 'pad-actions', hidden: true }, submitPad, padMessage);
  const close = h('button', { type: 'button', class: 'round-button tip-close', 'aria-label': 'Close Help', onclick: () => { hide(); onClose(); } }, '✕');
  const title = h('p', { class: 'tip-title' });
  // The ✕ sits in the title row, so it never covers the picture (0.7.2).
  const el = h('div', { class: 'tip-card', role: 'dialog', 'aria-label': 'Help', hidden: true },
    h('div', { class: 'tip-header' }, title, close),
    picture,
    padActions);

  // The note pad keeps what was written while Help is closed and opened
  // again for the same question; a new question starts a clean one.
  let pad = null;
  let padFor = '';
  function show(problem) {
    if (!hasTip(problem)) return false;
    title.textContent = `🙏 ${tipTitle(problem)}`;
    if (tipKind(problem) === 'column') {
      if (padFor !== problem.key) {
        pad = createColumnPad(problem.a, problem.b);
        padFor = problem.key;
      }
      picture.replaceChildren(pad.el);
    } else {
      picture.innerHTML = tipSvg(problem); // numbers only (hasTip checks they are whole numbers)
    }
    el.classList.toggle('tip-column', tipKind(problem) === 'column');
    padActions.hidden = !(onAnswer && tipKind(problem) === 'column');
    padMessage.textContent = '';
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
  return {
    el,
    show,
    hide,
    shown: () => !el.hidden,
    press: (key) => !el.hidden && pad !== null && picture.contains(pad.el) && pad.press(key),
  };
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
