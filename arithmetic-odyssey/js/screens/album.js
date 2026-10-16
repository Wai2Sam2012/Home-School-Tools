// 6. Sticker Album: every sticker in order, with locked ones greyed out.
// Tapping a collected sticker shows its pictures and facts.

import { placeholderArt, stickerPicture } from '../art.js';
import { THEMES } from '../settings.js';
import { nextSticker } from '../storyline.js';
import { choiceRow, flash, h, topBar } from '../ui.js';

export function albumScreen(ctx, { theme = 'dino' } = {}) {
  const player = ctx.profiles.active();
  const status = h('p', { class: 'status-line', role: 'status' });
  const body = h('div', { class: 'album-body' }, h('p', {}, 'Loading stickers…'));

  async function showTheme() {
    const info = THEMES[theme];
    if (!info.ready) {
      body.replaceChildren(h('p', { class: 'lead' }, `${info.icon} ${info.title} stickers are coming soon!`));
      return;
    }
    try {
      const storyline = await ctx.getStoryline(theme);
      const owned = new Set(player.collected[theme]);
      const upNext = nextSticker(storyline, player.collected[theme]);
      const tiles = storyline.stickers.map((s) => {
        const have = owned.has(s.id);
        return h('button', {
          type: 'button',
          class: `sticker-tile${have ? '' : ' locked'}${s === upNext ? ' up-next' : ''}`,
          'aria-label': have ? `${s.number}. ${s.name}` : `Sticker ${s.number}, locked`,
          onclick: () => (have ? showSticker(theme, s) : flash(status, `Keep exploring to unlock sticker ${s.number}!`)),
        },
        have ? stickerPicture(theme, s, 0, { className: 'tile-picture' }) : h('div', { class: 'tile-picture' }, placeholderArt(theme, s, { locked: true })),
        h('span', { class: 'tile-name' }, have ? s.name : `#${s.number}`),
        s === upNext ? h('span', { class: 'tile-badge' }, 'Next!') : null);
      });
      body.replaceChildren(
        h('p', { class: 'lead' }, `${owned.size} of ${storyline.stickers.length} collected`),
        h('div', { class: 'sticker-grid' }, tiles),
      );
    } catch (error) {
      body.replaceChildren(h('p', { class: 'form-error' }, error.message));
    }
  }
  showTheme();

  return h('main', { class: 'screen album-screen' },
    topBar('Sticker Album', () => ctx.show('home')),
    choiceRow({
      label: 'Album',
      className: 'theme-row',
      value: theme,
      options: Object.values(THEMES).map((t) => ({ value: t.id, label: `${t.icon} ${t.title}` })),
      onChange: (value) => {
        theme = value;
        body.replaceChildren(h('p', {}, 'Loading stickers…'));
        showTheme();
      },
    }),
    status,
    body,
  );
}

/** A large card with the sticker's pictures (with arrows if there are several) and facts. */
function showSticker(theme, sticker) {
  let index = 0;
  const pictureBox = h('div', { class: 'detail-picture-box' });
  const count = h('span', { class: 'picture-count' });
  const showPicture = () => {
    pictureBox.replaceChildren(stickerPicture(theme, sticker, index, { className: 'detail-picture' }));
    count.textContent = sticker.pictures.length > 1 ? `${index + 1} / ${sticker.pictures.length}` : '';
  };
  const step = (change) => {
    index = (index + change + sticker.pictures.length) % sticker.pictures.length;
    showPicture();
  };
  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (event) => {
    if (event.key === 'Escape') close();
    if (sticker.pictures.length > 1 && event.key === 'ArrowLeft') step(-1);
    if (sticker.pictures.length > 1 && event.key === 'ArrowRight') step(1);
  };
  const arrows = sticker.pictures.length > 1
    ? h('div', { class: 'picture-arrows' },
      h('button', { type: 'button', class: 'round-button', 'aria-label': 'Previous picture', onclick: () => step(-1) }, '‹'),
      count,
      h('button', { type: 'button', class: 'round-button', 'aria-label': 'Next picture', onclick: () => step(1) }, '›'))
    : null;
  const details = [
    sticker.group && `${sticker.group}${sticker.diet ? ` · ${sticker.diet}` : ''}`,
    sticker.when,
    sticker.found && `Found in: ${sticker.found}`,
  ].filter(Boolean);
  const closeButton = h('button', { type: 'button', class: 'big-button primary', onclick: close }, 'Close');
  const overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': sticker.name },
    h('div', { class: 'dialog sticker-detail' },
      pictureBox,
      arrows,
      h('h2', {}, `${sticker.number}. ${sticker.name}`),
      h('ul', { class: 'detail-list' }, details.map((d) => h('li', {}, d))),
      h('ul', { class: 'fact-list' }, sticker.facts.map((f) => h('li', {}, f))),
      closeButton,
    ),
  );
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  showPicture();
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
  overlay.closeOverlay = close;
  closeButton.focus();
}
