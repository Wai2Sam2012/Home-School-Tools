// 6. Sticker Album: every sticker in order, with locked ones greyed out,
// in sections (dinosaurs by period, parks by region) with a count each.
// Each level has its own set (0.7.3): Beginner, Intermediate and Advanced.
// Tapping a collected sticker shows its pictures and facts.

/** The section a sticker is in: its period (dinosaurs) or region (parks). */
export function stickerSection(sticker) {
  return sticker.period ?? sticker.region ?? sticker.section ?? '';
}

import { placeholderArt, stickerPicture } from '../art.js?v=0.7.4';
import { readAloudButton, stickerReading } from '../read-aloud.js?v=0.7.4';
import { DIFFICULTY_LABELS, LEVELS, THEMES, collectionKey } from '../settings.js?v=0.7.4';
import { nextSticker, stickerSet } from '../storyline.js?v=0.7.4';
import { choiceRow, flash, h, topBar } from '../ui.js?v=0.7.4';

/** Long one-word names get a smaller size so they fit on one line ("Thecodontosaurus"). */
function nameSize(name) {
  const longestWord = Math.max(0, ...name.split(/\s+/).map((w) => w.length));
  if (longestWord > 17) return ' longest';
  if (longestWord > 13) return ' long';
  return '';
}

export function albumScreen(ctx, { theme = 'dino', level } = {}) {
  const player = ctx.profiles.active();
  // Opens at the level asked for (Trail's End), else the player's own level,
  // unless that level's stickers are still to come: then at Beginner (0.7.4).
  const asked = LEVELS.includes(level);
  if (!asked) level = LEVELS.includes(player.setup.difficulty) ? player.setup.difficulty : 'beginner';
  let firstShow = true;
  // Floats at the bottom of the screen, so it is seen however far the album is scrolled.
  const status = h('p', { class: 'status-line album-status', role: 'status' });
  const body = h('div', { class: 'album-body' }, h('p', {}, 'Loading stickers…'));

  async function showTheme() {
    const info = THEMES[theme];
    if (!info.ready) {
      body.replaceChildren(h('p', { class: 'lead' }, `${info.icon} ${info.title} stickers are coming soon!`));
      return;
    }
    try {
      const storyline = stickerSet(await ctx.getStoryline(theme), level);
      const collected = player.collected[collectionKey(theme, level)] ?? [];
      const opening = firstShow;
      firstShow = false;
      if (storyline.stickers.length === 0 && opening && !asked && level !== 'beginner') {
        // Pressing Beginner moves the level choice too, and shows its stickers.
        levelRow.querySelector('.choice[data-value="beginner"]').click();
        return;
      }
      if (storyline.stickers.length === 0) {
        body.replaceChildren(h('p', { class: 'lead album-soon' }, `🚧 ${DIFFICULTY_LABELS[level]} ${info.title} stickers are coming soon!`));
        return;
      }
      const owned = new Set(collected);
      const upNext = nextSticker(storyline, collected);
      const tile = (s) => {
        const have = owned.has(s.id);
        return h('button', {
          type: 'button',
          class: `sticker-tile${have ? '' : ' locked'}${s === upNext ? ' up-next' : ''}`,
          'aria-label': have ? `${s.number}. ${s.name}` : `Sticker ${s.number}, locked`,
          onclick: () => (have ? showSticker(ctx, theme, s) : flash(status, `Keep exploring to unlock sticker ${s.number}!`)),
        },
        have ? stickerPicture(theme, s, 0, { className: 'tile-picture', short: true }) : h('div', { class: 'tile-picture' }, placeholderArt(theme, s, { locked: true })),
        h('span', { class: `tile-name${nameSize(have ? s.name : '')}` }, have ? s.name : `#${s.number}`),
        s === upNext ? h('span', { class: 'tile-badge' }, 'Next!') : null);
      };
      const sections = [];
      for (const s of storyline.stickers) {
        const name = stickerSection(s);
        if (sections.at(-1)?.name !== name) sections.push({ name, stickers: [] });
        sections.at(-1).stickers.push(s);
      }
      body.replaceChildren(
        h('p', { class: 'lead' }, `${owned.size} of ${storyline.stickers.length} collected`),
        ...sections.map(({ name, stickers }) => h('section', { class: 'album-section' },
          name ? h('h2', { class: 'album-section-title' }, name,
            h('span', { class: 'album-section-count' }, `${stickers.filter((s) => owned.has(s.id)).length} of ${stickers.length}`)) : null,
          h('div', { class: 'sticker-grid' }, stickers.map(tile)))),
      );
    } catch (error) {
      body.replaceChildren(h('p', { class: 'form-error' }, error.message));
    }
  }
  const levelRow = choiceRow({
    label: 'Level',
    className: 'level-row',
    value: level,
    options: LEVELS.map((l) => ({ value: l, label: DIFFICULTY_LABELS[l] })),
    onChange: (value) => {
      level = value;
      body.replaceChildren(h('p', {}, 'Loading stickers…'));
      showTheme();
    },
  });
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
    levelRow,
    status,
    body,
  );
}

/** How long each picture shows on the sticker card before the next one. */
export const PICTURE_MS = 3000;

/** A large card with the sticker's pictures (changing by themselves every few seconds) and facts. */
function showSticker(ctx, theme, sticker) {
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
    ctx.speaker.cancel();
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
      readAloudButton(ctx, ctx.profiles.active(), () => stickerReading(sticker)),
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
