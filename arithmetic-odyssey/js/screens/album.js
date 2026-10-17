// 6. Sticker Album: every sticker in order, with locked ones greyed out.
// Tapping a collected sticker shows its pictures and facts.

import { placeholderArt, stickerPicture } from '../art.js?v=0.6.5';
import { THEMES } from '../settings.js?v=0.6.5';
import { nextSticker } from '../storyline.js?v=0.6.5';
import { choiceRow, flash, h, topBar } from '../ui.js?v=0.6.5';

/** Long one-word names get a smaller size so they fit on one line ("Thecodontosaurus"). */
function nameSize(name) {
  const longestWord = Math.max(0, ...name.split(/\s+/).map((w) => w.length));
  if (longestWord > 17) return ' longest';
  if (longestWord > 13) return ' long';
  return '';
}

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
        h('span', { class: `tile-name${nameSize(have ? s.name : '')}` }, have ? s.name : `#${s.number}`),
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

/** How long each picture shows on the sticker card before the next one. */
export const PICTURE_MS = 3000;

/** A large card with the sticker's pictures (changing by themselves every few seconds) and facts. */
function showSticker(theme, sticker) {
  let index = 0;
  let timer = 0;
  const total = sticker.pictures.length;
  const pictureBox = h('div', { class: 'detail-picture-box' });
  // Dots show how many pictures there are and which one is showing.
  const dots = total > 1 ? h('div', { class: 'picture-dots', 'aria-hidden': 'true' }, sticker.pictures.map(() => h('span', { class: 'dot' }))) : null;
  const showPicture = () => {
    pictureBox.replaceChildren(stickerPicture(theme, sticker, index, { className: 'detail-picture slide' }));
    if (dots) [...dots.children].forEach((dot, i) => dot.classList.toggle('on', i === index));
  };
  const close = () => {
    clearInterval(timer);
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (event) => {
    if (event.key === 'Escape') close();
  };
  // Parks list their own details (location, year, famous for); dinosaurs are built from their fields.
  const details = Array.isArray(sticker.details) ? sticker.details : [
    sticker.group && `${sticker.group}${sticker.diet ? ` · ${sticker.diet}` : ''}`,
    sticker.when,
    sticker.found && `Found in: ${sticker.found}`,
  ].filter(Boolean);
  const closeButton = h('button', { type: 'button', class: 'big-button primary', onclick: close }, 'Close');
  const overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': sticker.name },
    h('div', { class: 'dialog sticker-detail' },
      pictureBox,
      dots,
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
  if (total > 1) {
    timer = setInterval(() => {
      index = (index + 1) % total;
      showPicture();
    }, PICTURE_MS);
  }
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
  overlay.closeOverlay = close;
  closeButton.focus();
}
