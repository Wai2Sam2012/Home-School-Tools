// The on-screen number keypad. Answers are only ever typed here (or on a PC
// keyboard), never in a text box, so the iPad's keyboard never opens.

import { MAX_ANSWER_DIGITS } from './math.js';
import { h } from './ui.js';

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

const LABELS = { [BACK]: '⌫', [SUBMIT]: '✔' };
const NAMES = { [BACK]: 'Backspace', [SUBMIT]: 'Submit' };

/**
 * Builds the keypad with its answer display.
 *   onSubmit(value)  called when Submit is pressed
 *   onChange(value)  called after each change
 * Returns { el, display, value(), clear(), setEnabled(bool), destroy() }.
 * Call destroy() when the screen closes, to stop listening to the PC keyboard.
 */
export function createKeypad({ maxDigits = MAX_ANSWER_DIGITS, onSubmit = () => {}, onChange = () => {} } = {}) {
  let value = '';
  let enabled = true;

  const display = h('output', { class: 'answer-display empty', 'aria-live': 'polite', 'aria-label': 'Your answer' }, '?');

  function show() {
    display.textContent = value === '' ? '?' : value;
    display.classList.toggle('empty', value === '');
  }

  function bump() {
    // A short shake says "no more digits" without words.
    display.classList.remove('full');
    void display.offsetWidth;
    display.classList.add('full');
  }

  function press(key) {
    if (!enabled) return;
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
    }, LABELS[key] ?? key),
  );
  const pad = h('div', { class: 'keypad', role: 'group', 'aria-label': 'Number keypad' }, buttons);

  function onKeyDown(event) {
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
    setEnabled(on) {
      enabled = on;
      for (const button of buttons) button.disabled = !on;
    },
    destroy() {
      document.removeEventListener('keydown', onKeyDown);
    },
  };
}
