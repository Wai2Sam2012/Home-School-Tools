// Choosing a player picture: one of the 16 pictures, then one of its 5 options
// (numbered 1 to 5 on screen: the options are colors, but for the cat and dog
// they are kinds, like calico or husky). The pictures show no names; buttons
// still tell a screen reader what they are. Used on the New player screen and
// when a player changes their picture.

import { AVATARS, COLOR_COUNT, avatarIcon, avatarInfo, avatarLabel, checkColor } from './avatars.js?v=0.7.0';
import { h } from './ui.js?v=0.7.0';

/**
 * Returns { el, value() } where value() is { avatar, color }. The pictures
 * show color 1, except the chosen one, which shows its chosen color. Picking a
 * new picture starts it at color 1.
 */
export function createAvatarPicker({ avatar, color = 1, onChange = () => {} } = {}) {
  let chosen = avatarInfo(avatar).id;
  let shade = checkColor(color);

  const pictureButtons = AVATARS.map((a) =>
    h('button', {
      type: 'button',
      class: 'avatar-choice',
      dataset: { avatar: a.id },
      onclick: () => {
        if (a.id !== chosen) {
          chosen = a.id;
          shade = 1;
        }
        update();
      },
    }));

  const colorButtons = Array.from({ length: COLOR_COUNT }, (_, i) =>
    h('button', {
      type: 'button',
      class: 'color-choice',
      dataset: { color: String(i + 1) },
      onclick: () => {
        shade = i + 1;
        update();
      },
    }));

  const colorTitle = h('h2', { class: 'color-title' }, 'Pick 1 to 5');

  function update() {
    for (const b of pictureButtons) {
      const id = b.dataset.avatar;
      const on = id === chosen;
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', avatarInfo(id).label);
      b.replaceChildren(avatarIcon(id, { color: on ? shade : 1, title: '' }));
    }
    colorButtons.forEach((b, i) => {
      b.setAttribute('aria-pressed', String(i + 1 === shade));
      b.setAttribute('aria-label', `${i + 1}: ${avatarLabel(chosen, i + 1)}`);
      b.replaceChildren(avatarIcon(chosen, { color: i + 1, title: '' }), h('span', { class: 'color-number', 'aria-hidden': 'true' }, String(i + 1)));
    });
    onChange({ avatar: chosen, color: shade });
  }

  const el = h('div', { class: 'avatar-picker' },
    h('h2', {}, 'Pick a picture'),
    h('div', { class: 'avatar-grid', role: 'group', 'aria-label': 'Player picture' }, pictureButtons),
    colorTitle,
    h('div', { class: 'color-grid', role: 'group', 'aria-label': 'Picture option, 1 to 5' }, colorButtons));
  update();
  return { el, value: () => ({ avatar: chosen, color: shade }) };
}
