// The player's home: start an adventure, see stickers and stats, practice
// with Learn from Incorrect, change their picture, switch player, or
// (grown-ups, by holding for 3 seconds) open Settings.

import { stickerPicture } from '../art.js?v=0.7.3';
import { createHoldButton } from '../hold.js?v=0.7.3';
import { playerIcon } from '../avatars.js?v=0.7.3';
import { PRACTICE_SIZE, needMorePractice } from '../scores.js?v=0.7.3';
import { DIFFICULTY_LABELS, LEVELS, THEMES, collectionKey, isThemeId } from '../settings.js?v=0.7.3';
import { nextSticker, stickerSet } from '../storyline.js?v=0.7.3';
import { fitToWindow, h } from '../ui.js?v=0.7.3';

export function homeScreen(ctx) {
  const player = ctx.profiles.active();
  const stickers = Object.values(player.collected).reduce((n, list) => n + list.length, 0);
  const trip = player.adventure && player.adventure.mode !== 'done' ? player.adventure : null;
  const practice = needMorePractice(player.history, PRACTICE_SIZE, player.learned);
  const toLearn = practice.filter((p) => !p.learned).length;
  const learnDetail = toLearn ? `${toLearn} to learn` : practice.length ? `Practice ${practice.length} again` : 'Nothing yet';

  // The next stop: the sticker the next trip leads to, and how many of each
  // theme's stickers the player has at that level. It follows the trip in
  // progress, or else the last game played (theme and level, 0.7.3); before
  // the first game there is nothing chosen yet, so it asks to pick one.
  const last = trip ?? player.history.at(-1) ?? null;
  const nextStop = h('section', { class: 'home-next', 'aria-label': 'Next stop' });
  if (!last || !isThemeId(last.theme)) {
    nextStop.replaceChildren(h('div', { class: 'home-next-text' }, h('p', { class: 'home-next-title' }, '🗺️ Pick an adventure to start!')));
  } else {
    const nextTheme = last.theme;
    const level = LEVELS.includes(last.difficulty) ? last.difficulty : 'beginner';
    Promise.all(Object.keys(THEMES).map((id) => ctx.getStoryline(id).then((s) => [id, stickerSet(s, level)], () => [id, null]))).then((loaded) => {
      const stories = Object.fromEntries(loaded);
      const story = stories[nextTheme];
      const owned = (id) => player.collected[collectionKey(id, level)] ?? [];
      const sticker = story ? nextSticker(story, owned(nextTheme)) : null;
      let title = '';
      if (sticker) title = `Next stop: ${sticker.name}!`;
      else if (story?.stickers.length === 0) title = `${DIFFICULTY_LABELS[level]} stickers are coming soon!`;
      else if (story) title = `You have every ${THEMES[nextTheme].title} sticker! 🎉`;
      const counts = h('p', { class: 'home-counts' },
        h('span', { class: 'home-count home-level' }, DIFFICULTY_LABELS[level]),
        Object.entries(stories).filter(([, s]) => s?.stickers.length).map(([id, s]) =>
          h('span', { class: 'home-count' }, `${THEMES[id].icon} ${owned(id).length} of ${s.stickers.length}`)));
      nextStop.replaceChildren(...[
        sticker ? stickerPicture(nextTheme, sticker, 0, { className: 'home-next-picture' }) : null,
        h('div', { class: 'home-next-text' }, h('p', { class: 'home-next-title' }, title), counts),
      ].filter(Boolean));
    });
  }

  const page = h('main', { class: 'screen home-screen' },
    h('header', { class: 'home-header' },
      // Tapping the picture lets the player choose another picture or color.
      h('button', { type: 'button', class: 'player-avatar large avatar-button', 'aria-label': 'Change your picture', onclick: () => ctx.show('playerPicture') },
        playerIcon(player, { title: '' }),
        h('span', { class: 'avatar-edit', 'aria-hidden': 'true' }, '✏️')),
      h('h1', { tabIndex: -1 }, `Hi, ${player.name}!`),
      h('p', { class: 'lead' }, stickers ? `You have ${stickers} ${stickers === 1 ? 'sticker' : 'stickers'}.` : 'Ready for an adventure?'),
    ),
    nextStop,
    h('div', { class: trip ? 'home-grid has-trip' : 'home-grid' },
      trip
        ? h('button', { type: 'button', class: 'big-button primary home-adventure', onclick: () => ctx.show('adventure') },
          h('span', { class: 'button-icon', 'aria-hidden': 'true' }, '🗺️'),
          h('span', {}, 'Resume Adventure', h('span', { class: 'button-detail' }, `Step ${trip.step} of ${trip.length}`)))
        : h('button', { type: 'button', class: 'big-button primary home-adventure', onclick: () => ctx.show('setup') },
          h('span', { class: 'button-icon', 'aria-hidden': 'true' }, '🗺️'), 'Start Adventure'),
      trip ? h('button', { type: 'button', class: 'big-button', onclick: () => ctx.show('setup') }, 'New Adventure') : null,
      h('button', { type: 'button', class: 'big-button', onclick: () => ctx.show('album') },
        h('span', { class: 'button-icon', 'aria-hidden': 'true' }, '📒'), 'Sticker Album'),
      h('button', { type: 'button', class: 'big-button', onclick: () => ctx.show('stats') },
        h('span', { class: 'button-icon', 'aria-hidden': 'true' }, '🏆'), 'My Stats'),
      h('button', { type: 'button', class: 'big-button home-learn', onclick: () => ctx.show('learn') },
        h('span', { class: 'button-icon', 'aria-hidden': 'true' }, '🎯'),
        h('span', {}, 'Learn from Incorrect', h('span', { class: 'button-detail' }, learnDetail))),
    ),
    h('footer', { class: 'home-footer' },
      h('button', { type: 'button', class: 'big-button quiet', onclick: () => ctx.show('profiles') }, 'Switch player'),
      // Anyone can change the colors (0.7.3).
      h('button', { type: 'button', class: 'big-button quiet colors-button', onclick: () => ctx.show('colors') },
        h('span', { 'aria-hidden': 'true' }, '🎨 '), 'Colors'),
      createHoldButton({ label: 'Grown-ups', onComplete: () => ctx.show('settings') }),
    ),
  );
  // Steps down to a compact size if the window is short (Safari's bars, Split View).
  fitToWindow(ctx, page);
  return page;
}
