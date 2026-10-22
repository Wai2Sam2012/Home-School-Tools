// The grown-up check: a button that must be held down for 3 seconds.
// Letting go early resets it.
//
// 0.7.2: on a touch screen it takes two fingers held on the button at once,
// and the button no longer says how to open it; a one-finger touch shows a
// short hint instead. A mouse, pen or keyboard (a grown-up at a PC) still
// holds with one press.

import { h } from './ui.js?v=0.7.9';

export const HOLD_MS = 3000;
// How many fingers must hold the button on a touch screen.
export const HOLD_FINGERS = 2;
// How long the hint shows after a one-finger touch.
const HINT_MS = 4000;

/** How far through the hold we are, from 0 to 1. */
export function holdProgress(startedAt, now, holdMs = HOLD_MS) {
  if (startedAt === null) return 0;
  return Math.min(1, Math.max(0, (now - startedAt) / holdMs));
}

/** Whether enough is pressing to start holding: fingers touching, or any mouse, pen or key press. */
export function enoughToHold({ touches = 0, other = false }, fingers = HOLD_FINGERS) {
  return other || touches >= fingers;
}

/** The hint after a touch that was not enough: "Grown-ups: hold with two fingers for 3 seconds". */
export function holdHint(fingers = HOLD_FINGERS, holdMs = HOLD_MS) {
  const count = ['', 'one finger', 'two fingers', 'three fingers'][fingers] ?? `${fingers} fingers`;
  return `Grown-ups: hold with ${count} for ${Math.round(holdMs / 1000)} seconds`;
}

/**
 * Builds the hold button. onComplete() runs once the button has been held
 * for holdMs. Works with touch (fingers at once), mouse, pen and the
 * keyboard (Space or Enter).
 */
export function createHoldButton({ label, holdMs = HOLD_MS, fingers = HOLD_FINGERS, onComplete }) {
  let startedAt = null;
  let frame = 0;
  let done = false;
  let hintTimer = 0;
  const touches = new Set(); // touch pointers on the button now
  let other = false; // a mouse, pen or key is pressing

  const fill = h('span', { class: 'hold-fill', 'aria-hidden': 'true' });
  const hintText = h('span', { class: 'hold-hint', 'aria-live': 'polite' });
  const button = h('button', { type: 'button', class: 'hold-button', 'aria-description': holdHint(fingers, holdMs) }, fill, h('span', { class: 'hold-label' }, label));
  // The hint floats just above the button (0.7.4), so showing it never changes
  // the button's size or moves it out from under the fingers.
  const wrap = h('span', { class: 'hold-wrap' }, button, hintText);

  function setHint(text) {
    clearTimeout(hintTimer);
    hintText.textContent = text;
    if (text) hintTimer = setTimeout(() => { hintText.textContent = ''; }, HINT_MS);
  }

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
    clearTimeout(hintTimer);
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
    setHint(early && !done ? holdHint(fingers, holdMs) : '');
  }

  /** Starts or stops to match what is pressing now. */
  function update() {
    if (enoughToHold({ touches: touches.size, other }, fingers)) start();
    else stop();
  }

  button.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch' && event.button !== 0) return;
    try {
      button.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers refuse capture for some pointers; holding still works.
    }
    if (event.pointerType === 'touch') {
      touches.add(event.pointerId);
      // One finger is not enough: say how, without opening anything.
      if (touches.size < fingers) setHint(holdHint(fingers, holdMs));
    } else {
      other = true;
    }
    update();
  });
  const release = (event) => {
    if (event.pointerType === 'touch') touches.delete(event.pointerId);
    else other = false;
    update();
  };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, release);
  // A long press on an iPad would otherwise open the callout menu.
  button.addEventListener('contextmenu', (event) => event.preventDefault());
  button.addEventListener('keydown', (event) => {
    if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
      event.preventDefault();
      other = true;
      update();
    }
  });
  button.addEventListener('keyup', (event) => {
    if (event.key === ' ' || event.key === 'Enter') {
      other = false;
      update();
    }
  });
  button.addEventListener('blur', () => {
    touches.clear();
    other = false;
    update();
  });

  return wrap;
}
