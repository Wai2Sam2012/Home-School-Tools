// The on-screen number keypad. Answers are only ever typed here (or on a PC
// keyboard), never in a text box, so the iPad's keyboard never opens.

import { MAX_ANSWER_DIGITS } from './math.js?v=0.6.1';
import { h } from './ui.js?v=0.6.1';

export const BACK = 'back';
export const SUBMIT = 'submit';
export const KEY_ORDER = Object.freeze(['1', '2', '3', '4', '5', '6', '7', '8', '9', BACK, '0', SUBMIT]);

/**
 * What a key press does to the answer typed so far.
 * Returns { value, action } where action is:
 *   'changed'  the value changed
 *   'full'     a digit was refused because the answer already has maxDigits digits
 *   'ignored'  nothing to do (Backspace on an empty answer, an unknown key)
 *   'submit'   the player pressed Submit (value unchanged)
 */
export function pressKey(value, key, maxDigits = MAX_ANSWER_DIGITS) {
  if (key === SUBMIT) return { value, action: 'submit' };
  if (key === BACK) return value === '' ? { value, action: 'ignored' } : { value: value.slice(0, -1), action: 'changed' };
  if (!/^[0-9]$/.test(key)) return { value, action: 'ignored' };
  // A leading zero is replaced, so "0" then "7" gives "7", not "07".
  if (value === '0') return key === '0' ? { value, action: 'ignored' } : { value: key, action: 'changed' };
  if (value.length >= maxDigits) return { value, action: 'full' };
  return { value: value + key, action: 'changed' };
}

/** Maps a PC keyboard key (event.key) to a keypad key, or null. */
export function keyFromKeyboard(eventKey) {
  if (/^[0-9]$/.test(eventKey)) return eventKey;
  if (eventKey === 'Backspace' || eventKey === 'Delete') return BACK;
  if (eventKey === 'Enter') return SUBMIT;
  return null;
}

// Drawn icons for Backspace and Submit: the characters ⌫ and ✔ can show as
// small grey emoji on the iPad, which are hard to see.
const ICONS = {
  [BACK]: '<path d="M9 5 H20 A1 1 0 0 1 21 6 V18 A1 1 0 0 1 20 19 H9 L3 12 Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 9 L17 15 M17 9 L12 15" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  [SUBMIT]: '<path d="M4 12.5 L9.5 18 L20 6.5" fill="none" stroke="currentColor" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/>',
};

function keyLabel(key) {
  if (!ICONS[key]) return key;
  const holder = document.createElement('span');
  holder.innerHTML = `<svg class="key-icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[key]}</svg>`;
  return holder.firstElementChild;
}
const NAMES = { [BACK]: 'Backspace', [SUBMIT]: 'Submit' };

/**
 * Builds the keypad with its answer display.
 *   onSubmit(value)  called when Submit is pressed
 *   onChange(value)  called after each change
 * Returns { el, display, value(), clear(), setEnabled(bool), ignoreTaps(ms), destroy() }.
 * Call destroy() when the screen closes, to stop listening to the PC keyboard.
 */
export function createKeypad({ maxDigits = MAX_ANSWER_DIGITS, onSubmit = () => {}, onChange = () => {} } = {}) {
  let value = '';
  let enabled = true;
  let ignoreUntil = 0;

  const display = h('output', { class: 'answer-display empty', 'aria-live': 'polite', 'aria-label': 'Your answer' }, '?');

  function show() {
    display.textContent = value === '' ? '?' : value;
    display.classList.toggle('empty', value === '');
    display.classList.remove('correct-answer');
  }

  function bump() {
    // A short shake says "no more digits" without words.
    display.classList.remove('full');
    void display.offsetWidth;
    display.classList.add('full');
  }

  function press(key) {
    if (!enabled || performance.now() < ignoreUntil) return;
    const result = pressKey(value, key, maxDigits);
    if (result.action === 'submit') {
      onSubmit(value);
      return;
    }
    if (result.action === 'full') bump();
    if (result.action !== 'changed') return;
    value = result.value;
    show();
    onChange(value);
  }

  const buttons = KEY_ORDER.map((key) =>
    h('button', {
      type: 'button',
      class: `key${key === SUBMIT ? ' key-submit' : ''}${key === BACK ? ' key-back' : ''}`,
      'aria-label': NAMES[key] ?? key,
      dataset: { key },
      onclick: () => press(key),
    }, keyLabel(key)),
  );
  const pad = h('div', { class: 'keypad', role: 'group', 'aria-label': 'Number keypad' }, buttons);

  function onKeyDown(event) {
    // While the keypad is locked, keys are left alone, so Enter or Space can
    // press another button (such as "Got it").
    if (!enabled) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable]')) return;
    if (document.querySelector('.overlay')) return;
    const key = keyFromKeyboard(event.key);
    if (!key) return;
    // preventDefault stops Enter from also "clicking" a focused keypad button.
    event.preventDefault();
    // Holding Enter down must not submit over and over.
    if (key === SUBMIT && event.repeat) return;
    press(key);
  }
  document.addEventListener('keydown', onKeyDown);

  return {
    el: h('div', { class: 'keypad-area' }, display, pad),
    display,
    value: () => value,
    clear() {
      value = '';
      show();
    },
    /** Shows the right answer in the answer box (in green) after a wrong one; clear() puts it back. */
    showCorrect(text) {
      display.textContent = text;
      display.classList.remove('empty');
      display.classList.add('correct-answer');
    },
    setEnabled(on) {
      enabled = on;
      for (const button of buttons) button.disabled = !on;
    },
    /** Ignores key presses for a moment, e.g. the second tap of a double tap on "Got it". */
    ignoreTaps(ms) {
      ignoreUntil = performance.now() + ms;
    },
    destroy() {
      document.removeEventListener('keydown', onKeyDown);
    },
  };
}
