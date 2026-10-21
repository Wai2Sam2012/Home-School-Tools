// Drawn pictures used when a sticker has no picture yet, or a picture fails
// to load, so the game never shows a broken image (test T2.6).
//
// Sticker pictures are saved on the iPad as stickers are collected (with
// internet; js/offline.js). One that isn't saved yet and can't be downloaded
// shows the drawing with "Waiting to connect to the internet to get the
// pictures", and tries again when the internet comes back or it is saved.

import { h } from './ui.js?v=0.7.6';
import { pictureUrl } from './storyline.js?v=0.7.6';
import { PICTURES_SAVED_EVENT } from './offline.js?v=0.7.6';

export const WAITING_TEXT = 'Waiting to connect to the internet to get the pictures';
export const WAITING_SHORT = 'Waiting for internet';

const COLORS = ['#7fb069', '#e08e45', '#5b8e7d', '#c8553d', '#6c8ead', '#d4a017', '#8e6c88', '#4f9d69'];

/** A colour picked from the sticker's id, so each sticker keeps the same colour. */
export function colorFor(id) {
  let hash = 0;
  for (const ch of String(id)) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
}

const DINO_SHAPE = `
  <ellipse cx="62" cy="70" rx="30" ry="18"/>
  <path d="M84 62 Q100 40 104 22 Q106 14 114 15 Q122 17 119 25 Q112 30 106 40 Q100 56 92 72 Z"/>
  <path d="M34 66 Q14 70 4 86 Q20 80 36 78 Z"/>
  <rect x="44" y="80" width="9" height="22" rx="4"/>
  <rect x="70" y="80" width="9" height="22" rx="4"/>`;

const TRUCK_SHAPE = `
  <rect x="10" y="52" width="70" height="30" rx="6"/>
  <path d="M80 82 V58 H98 L114 70 V82 Z"/>
  <circle cx="34" cy="88" r="11" fill="#333"/>
  <circle cx="96" cy="88" r="11" fill="#333"/>`;

/**
 * The placeholder as an <svg> element: a coloured shape for the theme with
 * the sticker's number, or a grey shape with "?" when locked.
 */
export function placeholderArt(theme, sticker, { locked = false } = {}) {
  const fill = locked ? '#b9b5ad' : colorFor(sticker.id);
  const shape = theme === 'parks' ? TRUCK_SHAPE : DINO_SHAPE;
  const label = locked ? '?' : String(Number(sticker.number) || '');
  const holder = document.createElement('div');
  holder.innerHTML = `<svg class="sticker-art" viewBox="0 0 128 112" role="img" aria-hidden="true">
    <rect width="128" height="112" rx="14" fill="${locked ? '#ece8e0' : '#fffaf0'}"/>
    <g fill="${fill}">${shape}</g>
    <text x="16" y="30" font-size="22" font-weight="700" fill="${locked ? '#8a857c' : '#2b2b2b'}">${label}</text>
  </svg>`;
  return holder.firstElementChild;
}

/**
 * A sticker's picture: the picture at index (wrapping around), or the drawn
 * placeholder if there is none. If it can't load (not saved yet and no
 * internet), the placeholder says it is waiting for the internet (short:
 * fewer words, for small tiles) and the picture is tried again later.
 */
export function stickerPicture(theme, sticker, index = 0, { className = 'sticker-picture', short = false } = {}) {
  const box = h('div', { class: className });
  const pictures = sticker.pictures ?? [];
  if (pictures.length === 0) {
    box.append(placeholderArt(theme, sticker));
    box.classList.add('no-picture');
    return box;
  }
  const src = pictureUrl(theme, pictures[((index % pictures.length) + pictures.length) % pictures.length]);
  function load() {
    const img = h('img', { src, alt: sticker.name, loading: 'lazy', decoding: 'async', draggable: false });
    img.addEventListener('load', () => box.classList.remove('no-picture', 'waiting'), { once: true });
    img.addEventListener('error', () => {
      img.replaceWith(placeholderArt(theme, sticker), h('p', { class: 'waiting-note', role: 'status' }, short ? `📶 ${WAITING_SHORT}` : `📶 ${WAITING_TEXT}`));
      box.classList.add('no-picture', 'waiting');
      // Try again when the internet comes back or the picture has been saved (if still on screen).
      globalThis.addEventListener(PICTURES_SAVED_EVENT, () => {
        if (box.isConnected) box.replaceChildren(load());
      }, { once: true });
    }, { once: true });
    return img;
  }
  box.append(load());
  return box;
}
