// The detour road on the trail map: when a wrong answer starts a detour, a
// road loops off the trail below the track, and the player's icon drives
// around it as the detour questions are answered, back to the spot where it
// left the trail.

import { avatarIcon } from './avatars.js?v=0.7.6';

// The loop, in a 150 × 60 pixel box whose point (24, 0) sits on the trail.
const WIDTH = 150;
const HEIGHT = 60;
const START_X = 24;
const LOOP = `M${START_X} 0 C24 28 44 54 78 54 C112 54 140 44 140 28 C140 12 112 10 84 12 C56 14 36 10 ${START_X} 0`;
const ANIMATE_MS = 700;

/** How far around the loop the icon is: a little way in at the start, nearly back at the end. */
export function loopProgress(asked, length) {
  const done = Math.min(Math.max(asked, 0), length);
  return 0.08 + (0.84 * done) / Math.max(1, length);
}

/** Detours past 60% of the trail loop back to the left, so the road stays on the map. */
export function loopsLeft(atPercent) {
  return atPercent > 60;
}

export function createDetourRoad(avatarId, color = 1) {
  const holder = document.createElement('div');
  holder.innerHTML = `<svg class="detour-road-svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" aria-hidden="true">
    <path d="${LOOP}" fill="none" stroke="#c8b58a" stroke-width="10" stroke-linecap="round"/>
    <path d="${LOOP}" fill="none" stroke="#fff" stroke-width="1.5" stroke-dasharray="4 5"/>
    <path class="detour-road-path" d="${LOOP}" fill="none" stroke="none"/>
  </svg>`;
  const svg = holder.firstElementChild;
  const path = svg.querySelector('.detour-road-path');
  const icon = avatarIcon(avatarId, { color, className: 'avatar-icon detour-traveler' });
  const el = document.createElement('div');
  el.className = 'detour-road';
  el.hidden = true;
  el.append(svg, icon);

  let shown = 0;
  let left = false;
  let frame = 0;

  function place(p) {
    const point = path.getPointAtLength(path.getTotalLength() * p);
    const x = left ? WIDTH - point.x : point.x;
    icon.style.transform = `translate(${x}px, ${point.y}px) translate(-50%, -60%)`;
  }

  return {
    el,
    /** Shows the road leaving the trail at atPercent, with the icon at progress p (0 to 1). */
    show(atPercent, p, { animate = true } = {}) {
      cancelAnimationFrame(frame);
      const wasHidden = el.hidden;
      left = loopsLeft(atPercent);
      el.hidden = false;
      el.classList.toggle('loops-left', left);
      el.style.left = `calc(${atPercent}% - ${left ? WIDTH - START_X : START_X}px)`;
      const from = wasHidden ? 0 : shown;
      shown = p;
      if (!animate || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        place(p);
        return;
      }
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - start) / ANIMATE_MS);
        place(from + (p - from) * (1 - (1 - t) ** 2));
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    },
    hide() {
      cancelAnimationFrame(frame);
      el.hidden = true;
      shown = 0;
    },
    /** For tests: where the icon is now, 0 to 1. */
    get progress() {
      return el.hidden ? null : shown;
    },
  };
}
