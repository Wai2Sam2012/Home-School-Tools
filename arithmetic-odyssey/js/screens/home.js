// The player's home: start an adventure, see stickers and stats, practice
// with Learn from Incorrect, change their picture, switch player, or
// (grown-ups, by holding for 3 seconds) open Settings.

import { stickerPicture } from '../art.js?v=0.7.2';
import { createHoldButton } from '../hold.js?v=0.7.2';
import { playerIcon } from '../avatars.js?v=0.7.2';
import { PRACTICE_SIZE, needMorePractice } from '../scores.js?v=0.7.2';
import { THEMES } from '../settings.js?v=0.7.2';
import { nextSticker } from '../storyline.js?v=0.7.2';
import { h } from '../ui.js?v=0.7.2';

export function homeScreen(ctx) {
  const player = ctx.profiles.active();
  const stickers = Object.values(player.collected).reduce((n, list) => n + list.length, 0);
  const trip = player.adventure && player.adventure.mode !== 'done' ? player.adventure : null;
  const practice = needMorePractice(player.history, PRACTICE_SIZE, player.learned);
  const toLearn = practice.filter((p) => !p.learned).length;
  const learnDetail = toLearn ? `${toLearn} to learn` : practice.length ? `Practice ${practice.length} again` : 'Nothing yet';

  // The next stop (0.7.2): the sticker the next trip leads to, and how many of
  // each theme's stickers the player has. Filled in when the story files load.
  const nextTheme = trip?.theme ?? player.setup.theme;
  const nextStop = h('section', { class: 'home-next', 'aria-label': 'Next stop' });
  Promise.all(Object.keys(THEMES).map((id) => ctx.getStoryline(id).then((s) => [id, s], () => [id, null]))).then((loaded) => {
    const stories = Object.fromEntries(loaded);
    const story = stories[nextTheme];
    const sticker = story ? nextSticker(story, player.collected[nextTheme] ?? []) : null;
    const counts = h('p', { class: 'home-counts' }, Object.entries(stories).filter(([, s]) => s).map(([id, s]) =>
      h('span', { class: 'home-count' }, `${THEMES[id].icon} ${(player.collected[id] ?? []).length} of ${s.stickers.length}`)));
    nextStop.replaceChildren(...[
      sticker ? stickerPicture(nextTheme, sticker, 0, { className: 'home-next-picture' }) : null,
      h('div', { class: 'home-next-text' },
        h('p', { class: 'home-next-title' }, sticker ? `Next stop: ${sticker.name}!` : story ? `You have every ${THEMES[nextTheme].title} sticker! 🎉` : ''),
        counts),
    ].filter(Boolean));
  });

  return h('main', { class: 'screen home-screen' },
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
      createHoldButton({ label: 'Grown-ups', onComplete: () => ctx.show('settings') }),
    ),
  );
}
