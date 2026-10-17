// 5. Trail's End: the new sticker (with a slideshow of its pictures), its
// facts, and a summary of the trip. When every sticker is collected, a
// "Collection complete!" celebration with all the theme's pictures.

import { stickerPicture } from '../art.js?v=0.6.4';
import { soundLength } from '../audio.js?v=0.6.4';
import { DIFFICULTY_LABELS, THEMES } from '../settings.js?v=0.6.4';
import { formatDuration } from '../timer.js?v=0.6.4';
import { h } from '../ui.js?v=0.6.4';

const SLIDE_MS = 3500;

export function trailEndScreen(ctx, result = {}) {
  const theme = THEMES[result.theme] ?? THEMES.dino;
  const stats = result.stats ?? { answered: 0, correct: 0, detours: 0, setbacks: 0, thinkingMs: 0 };
  const player = ctx.profiles.active();
  // The finish fanfare plays as this screen opens; the voice waits for it.
  let sayTimer = 0;
  const say = (text) => {
    if (ctx.voiceOn(player)) sayTimer = setTimeout(() => ctx.speaker.speak(text), soundLength('finish') + 150);
  };
  ctx.onLeave(() => {
    clearTimeout(sayTimer);
    ctx.speaker.cancel();
  });
  const stage = h('div', { class: 'slideshow' }, h('p', {}, 'Loading your sticker…'));
  const about = h('div', { class: 'trail-end-sticker' });
  let slideTimer = 0;
  ctx.onLeave(() => clearInterval(slideTimer));

  /** Shows the slides one after another, fading between them. */
  function runSlideshow(slides) {
    let index = 0;
    const show = () => {
      const { sticker, picture } = slides[index % slides.length];
      const slide = stickerPicture(theme.id, sticker, picture, { className: 'slide' });
      stage.replaceChildren(slide);
      index += 1;
    };
    show();
    if (slides.length > 1) slideTimer = setInterval(show, SLIDE_MS);
  }

  ctx.getStoryline(theme.id).then((storyline) => {
    const sticker = storyline.stickers.find((s) => s.id === result.stickerId);
    if (sticker) {
      const count = Math.max(1, sticker.pictures.length);
      runSlideshow(Array.from({ length: count }, (_, picture) => ({ sticker, picture })));
      say(`You made it! Your new sticker is ${sticker.spokenName ?? sticker.name}.`);
      about.replaceChildren(
        h('h2', {}, `New sticker: ${sticker.number}. ${sticker.name}`),
        h('ul', { class: 'fact-list' }, sticker.facts.map((f) => h('li', {}, f))),
      );
    } else {
      const withPictures = storyline.stickers.filter((s) => s.pictures.length > 0);
      runSlideshow((withPictures.length ? withPictures : storyline.stickers).map((s) => ({ sticker: s, picture: 0 })));
      say(`You made it! You collected every ${theme.title} sticker!`);
      about.replaceChildren(
        h('h2', {}, 'Collection complete! 🎉'),
        h('p', { class: 'lead' }, `You have all ${storyline.stickers.length} ${theme.title} stickers!`),
      );
    }
  }).catch((error) => {
    stage.replaceChildren(h('p', { class: 'form-error' }, error.message));
  });

  const row = (label, value) => h('div', { class: 'summary-row' }, h('dt', {}, label), h('dd', {}, String(value)));

  return h('main', { class: 'screen trail-end-screen' },
    h('h1', { tabIndex: -1 }, `${theme.icon} You made it!`),
    h('div', { class: 'trail-end-layout' },
      h('section', { class: 'panel' }, stage, about),
      h('section', { class: 'panel' },
        h('h2', {}, 'Your trip'),
        result.rank > 0
          ? h('p', { class: 'high-score-note' }, `🏆 ${result.rank === 1 ? 'New best score' : `High score #${result.rank}`} for ${result.length} questions (${DIFFICULTY_LABELS[result.difficulty] ?? result.difficulty})!`)
          : null,
        h('dl', { class: 'summary' },
          row('Questions answered', stats.answered),
          row('Right answers', stats.correct),
          row('Wanderings', stats.detours),
          row('Sent back to a flag', stats.setbacks),
          row('Thinking time', formatDuration(stats.thinkingMs ?? 0)),
          row('Help used', stats.tips ?? 0),
        ),
        h('div', { class: 'trail-end-buttons' },
          h('button', { type: 'button', class: 'big-button primary', onclick: () => ctx.show('setup') }, 'New adventure'),
          h('button', { type: 'button', class: 'big-button', onclick: () => ctx.show('album', { theme: theme.id }) }, 'Sticker Album'),
          h('button', { type: 'button', class: 'big-button quiet', onclick: () => ctx.show('home') }, 'Home'),
        ),
      ),
    ),
  );
}
