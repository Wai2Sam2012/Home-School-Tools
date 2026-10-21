// 5. Trail's End: the new sticker (with a slideshow of its pictures), its
// facts, and a summary of the trip. When every sticker is collected, a
// "Collection complete!" celebration with all the theme's pictures.
// 0.7.2: the sticker pops in with confetti (not with Reduce Motion on), its
// facts can be read aloud (🔊 Read to me), and the summary shows % right.

import { stickerPicture } from '../art.js?v=0.7.5';
import { soundLength } from '../audio.js?v=0.7.5';
import { DIFFICULTY_LABELS, LEVELS, THEMES, isThemeId } from '../settings.js?v=0.7.5';
import { stickerSet } from '../storyline.js?v=0.7.5';
import { readAloudButton, stickerReading } from '../read-aloud.js?v=0.7.5';
import { formatDuration } from '../timer.js?v=0.7.5';
import { fitToWindow, h } from '../ui.js?v=0.7.5';

const SLIDE_MS = 3500;
const CONFETTI_PIECES = 36;
const CONFETTI_MS = 4000;

/** Confetti falling over the screen for a few seconds, unless the device asks for less motion. */
function confetti(onLeave) {
  if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return null;
  const pieces = Array.from({ length: CONFETTI_PIECES }, (_, i) => {
    const piece = h('span', { class: `confetti-piece confetti-${i % 5}` });
    piece.style.setProperty('--x', `${Math.round(Math.random() * 100)}vw`);
    piece.style.setProperty('--drift', `${Math.round((Math.random() - 0.5) * 30)}vw`);
    piece.style.setProperty('--delay', `${Math.round(Math.random() * 900)}ms`);
    piece.style.setProperty('--spin', `${Math.round(360 + Math.random() * 720)}deg`);
    return piece;
  });
  const layer = h('div', { class: 'confetti', 'aria-hidden': 'true' }, pieces);
  const timer = setTimeout(() => layer.remove(), CONFETTI_MS);
  onLeave(() => {
    clearTimeout(timer);
    layer.remove();
  });
  return layer;
}

export function trailEndScreen(ctx, result = {}) {
  const theme = isThemeId(result.theme) ? THEMES[result.theme] : THEMES.dino;
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

  ctx.getStoryline(theme.id).then((all) => {
    // The trip's level's set (0.7.3).
    const level = LEVELS.includes(result.difficulty) ? result.difficulty : 'beginner';
    const levelName = level === 'beginner' ? '' : `${DIFFICULTY_LABELS[level]} `;
    const storyline = stickerSet(all, level);
    const sticker = storyline.stickers.find((s) => s.id === result.stickerId);
    if (sticker) {
      const count = Math.max(1, sticker.pictures.length);
      runSlideshow(Array.from({ length: count }, (_, picture) => ({ sticker, picture })));
      say(`You made it! Your new sticker is ${sticker.spokenName ?? sticker.name}.`);
      // (No Read button on a device without a voice: replaceChildren would show null as text.)
      about.replaceChildren(...[
        h('div', { class: 'sticker-heading' },
          h('h2', {}, `New sticker: ${sticker.number}. ${sticker.name}`),
          readAloudButton(ctx, player, () => stickerReading(sticker))),
        h('ul', { class: 'fact-list' }, sticker.facts.map((f) => h('li', {}, f))),
      ].filter(Boolean));
    } else if (storyline.stickers.length === 0) {
      // This level's stickers are still to come: show the theme's pictures meanwhile.
      const withPictures = all.stickers.filter((s) => s.pictures.length > 0);
      runSlideshow((withPictures.length ? withPictures : all.stickers).map((s) => ({ sticker: s, picture: 0 })));
      say(`You made it! ${levelName}stickers are coming soon.`);
      about.replaceChildren(
        h('h2', {}, `${levelName}stickers are coming soon! 🚧`),
        h('p', { class: 'lead' }, 'Your trip and score are saved. Beginner trips still collect Beginner stickers.'),
      );
    } else {
      const withPictures = storyline.stickers.filter((s) => s.pictures.length > 0);
      runSlideshow((withPictures.length ? withPictures : storyline.stickers).map((s) => ({ sticker: s, picture: 0 })));
      say(`You made it! You collected every ${levelName}${theme.title} sticker!`);
      about.replaceChildren(
        h('h2', {}, 'Collection complete! 🎉'),
        h('p', { class: 'lead' }, `You have all ${storyline.stickers.length} ${levelName}${theme.title} stickers!`),
      );
    }
  }).catch((error) => {
    stage.replaceChildren(h('p', { class: 'form-error' }, error.message));
  });

  const row = (label, value) => h('div', { class: 'summary-row' }, h('dt', {}, label), h('dd', {}, String(value)));
  const percent = stats.answered ? Math.round((stats.correct / stats.answered) * 100) : 0;

  const page = h('main', { class: 'screen trail-end-screen' },
    confetti(ctx.onLeave),
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
          row(`Right answers (${stats.correct} of ${stats.answered})`, `${percent}%`),
          row('Most in a row', stats.bestStreak ?? 0),
          row('Wanderings', stats.detours),
          row('Sent back to a flag', stats.setbacks),
          row('Thinking time', formatDuration(stats.thinkingMs ?? 0)),
          row('Help used', stats.tips ?? 0),
        ),
        h('div', { class: 'trail-end-buttons' },
          h('button', { type: 'button', class: 'big-button primary', onclick: () => ctx.show('setup') }, 'New adventure'),
          h('button', { type: 'button', class: 'big-button', onclick: () => ctx.show('album', { theme: theme.id, level: result.difficulty }) }, 'Sticker Album'),
          h('button', { type: 'button', class: 'big-button quiet', onclick: () => ctx.show('home') }, 'Home'),
        ),
      ),
    ),
  );
  // Steps down to a compact size if the window is short (Safari's bars, Split View).
  fitToWindow(ctx, page);
  return page;
}
