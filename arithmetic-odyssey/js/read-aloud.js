// 🔊 Read to me: a button that reads a sticker's name and facts aloud, for
// children who can't read them yet (Trail's End and the Sticker Album card).
// It works with Voice off too, since the child asked for it; tapping it
// again stops. No button when the device has no voice.

import { h } from './ui.js?v=0.7.5';

/** What is read for a sticker: its name (as it is said) and its facts. */
export function stickerReading(sticker) {
  return [sticker.spokenName ?? sticker.name, ...(sticker.facts ?? [])]
    .map((t) => String(t).trim())
    .filter(Boolean)
    .map((t) => (/[.!?]$/.test(t) ? t : `${t}.`))
    .join(' ');
}

/** The button, or null when nothing can be read aloud. getText() is called at each tap. */
export function readAloudButton(ctx, player, getText) {
  if (!ctx.canReadAloud()) return null;
  let reading = 0;
  const label = h('span', {}, 'Read to me');
  const icon = h('span', { 'aria-hidden': 'true' }, '🔊 ');
  const button = h('button', { type: 'button', class: 'read-button', 'aria-pressed': 'false' }, icon, label);
  const stopped = () => {
    reading = 0;
    icon.textContent = '🔊 ';
    label.textContent = 'Read to me';
    button.setAttribute('aria-pressed', 'false');
  };
  button.addEventListener('click', () => {
    if (reading) {
      ctx.speaker.cancel();
      stopped();
      return;
    }
    const token = Date.now();
    reading = token;
    icon.textContent = '⏹ ';
    label.textContent = 'Stop';
    button.setAttribute('aria-pressed', 'true');
    ctx.readAloud(player, getText()).then(() => {
      if (reading === token) stopped();
    });
  });
  return button;
}
