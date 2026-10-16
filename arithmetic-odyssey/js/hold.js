// The grown-up check: a button that must be held down for 3 seconds.
// Letting go early resets it.

import { h } from './ui.js';

export const HOLD_MS = 3000;

/** How far through the hold we are, from 0 to 1. */
export function holdProgress(startedAt, now, holdMs = HOLD_MS) {
  if (startedAt === null) return 0;
  return Math.min(1, Math.max(0, (now - startedAt) / holdMs));
}

/**
 * Builds the hold button. onComplete() runs once the button has been held
 * for holdMs. Works with touch, mouse, pen and the keyboard (Space or Enter).
 */
export function createHoldButton({ label, hint = 'Hold for 3 seconds', holdMs = HOLD_MS, onComplete }) {
  let startedAt = null;
  let frame = 0;
  let done = false;

  const fill = h('span', { class: 'hold-fill', 'aria-hidden': 'true' });
  const hintText = h('span', { class: 'hold-hint' }, hint);
  const button = h('button', { type: 'button', class: 'hold-button' }, fill, h('span', { class: 'hold-label' }, label), hintText);

  function draw() {
    const progress = holdProgress(startedAt, performance.now(), holdMs);
    fill.style.transform = `scaleX(${progress})`;
    if (progress >= 1 && !done) {
      done = true;
      stop(false);
      onComplete();
      return;
    }
    if (startedAt !== null) frame = requestAnimationFrame(draw);
  }

  function start() {
    if (startedAt !== null) return;
    done = false;
    startedAt = performance.now();
    hintText.textContent = 'Keep holding…';
    button.classList.add('holding');
    frame = requestAnimationFrame(draw);
  }

  function stop(early = true) {
    if (startedAt === null) return;
    startedAt = null;
    cancelAnimationFrame(frame);
    fill.style.transform = 'scaleX(0)';
    button.classList.remove('holding');
    hintText.textContent = early && !done ? 'Keep holding for 3 seconds' : hint;
  }

  button.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    try {
      button.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers refuse capture for some pointers; holding still works.
    }
    start();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, () => stop());
  // A long press on an iPad would otherwise open the callout menu.
  button.addEventListener('contextmenu', (event) => event.preventDefault());
  button.addEventListener('keydown', (event) => {
    if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
      event.preventDefault();
      start();
    }
  });
  button.addEventListener('keyup', (event) => {
    if (event.key === ' ' || event.key === 'Enter') stop();
  });
  button.addEventListener('blur', () => stop());

  return button;
}
