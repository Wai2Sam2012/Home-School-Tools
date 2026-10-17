// 3. Setup: theme, operations and difficulty, with the next sticker on the
// trip ("Next stop: Eoraptor!").

import { startAdventure, withNextProblem } from '../adventure.js?v=0.5.3';
import { stickerPicture } from '../art.js?v=0.5.3';
import { OPERATIONS } from '../math.js?v=0.5.3';
import { DIFFICULTY_LABELS, THEMES, toggleOperation } from '../settings.js?v=0.5.3';
import { nextSticker } from '../storyline.js?v=0.5.3';
import { choiceRow, confirmDialog, flash, h, topBar } from '../ui.js?v=0.5.3';

const OPERATION_NAMES = { '+': 'Add', '−': 'Subtract', '×': 'Multiply', '÷': 'Divide' };
const DIFFICULTY_DETAILS = { beginner: 'Small numbers', intermediate: 'Bigger numbers', advanced: 'Big numbers' };

export function setupScreen(ctx) {
  const player = ctx.profiles.active();
  const status = h('p', { class: 'status-line', role: 'status' });

  // ---- theme and next stop
  const nextStop = h('div', { class: 'next-stop' }, h('p', {}, 'Loading the map…'));
  async function showNextStop() {
    const theme = player.setup.theme;
    try {
      const storyline = await ctx.getStoryline(theme);
      const sticker = nextSticker(storyline, player.collected[theme]);
      nextStop.replaceChildren(...(sticker
        ? [stickerPicture(theme, sticker, 0, { className: 'next-stop-picture' }), h('p', { class: 'next-stop-text' }, `Next stop: ${sticker.name}!`)]
        : [h('p', { class: 'next-stop-text' }, 'You collected every sticker! 🎉')]));
    } catch (error) {
      nextStop.replaceChildren(h('p', { class: 'form-error' }, error.message));
    }
  }
  showNextStop();

  const themeRow = choiceRow({
    label: 'Theme',
    className: 'theme-row',
    value: player.setup.theme,
    options: Object.values(THEMES).map((t) => ({
      value: t.id,
      label: `${t.icon} ${t.title}`,
      detail: t.ready ? null : 'Coming soon',
      disabled: !t.ready,
    })),
    onChange: (theme) => {
      ctx.profiles.updateSetup(player.id, { theme });
      showNextStop();
    },
  });

  // ---- operations (at least one)
  const opButtons = OPERATIONS.map((op) =>
    h('button', {
      type: 'button',
      class: 'choice op-choice',
      role: 'checkbox',
      'aria-checked': String(player.setup.operations.includes(op)),
      'aria-label': OPERATION_NAMES[op],
      dataset: { op },
      onclick: () => {
        const result = toggleOperation(player.setup.operations, op);
        if (result.refused) {
          flash(status, 'Pick at least one kind of math.');
          return;
        }
        ctx.profiles.updateSetup(player.id, { operations: result.operations });
        for (const b of opButtons) b.setAttribute('aria-checked', String(player.setup.operations.includes(b.dataset.op)));
      },
    }, h('span', { class: 'op-symbol', 'aria-hidden': 'true' }, op), h('span', { class: 'choice-detail' }, OPERATION_NAMES[op])),
  );

  // ---- difficulty
  const difficultyRow = choiceRow({
    label: 'Difficulty',
    value: player.setup.difficulty,
    options: Object.keys(DIFFICULTY_LABELS).map((d) => ({ value: d, label: DIFFICULTY_LABELS[d], detail: DIFFICULTY_DETAILS[d] })),
    onChange: (difficulty) => ctx.profiles.updateSetup(player.id, { difficulty }),
  });

  async function go() {
    const current = player.adventure;
    if (current && current.mode !== 'done') {
      const yes = await confirmDialog({
        title: 'Start a new adventure?',
        message: `You are on step ${current.step} of ${current.length} of your other trip. Starting a new one ends it.`,
        yes: 'Start new',
        no: 'Keep my trip',
      });
      if (!yes) return;
    }
    const { theme, operations, difficulty } = player.setup;
    const { adventureLength, detourLength } = player.settings;
    player.adventure = withNextProblem(startAdventure({ theme, length: adventureLength, detourLength, operations, difficulty }));
    ctx.show('adventure');
  }

  const { adventureLength, detourLength } = player.settings;
  return h('main', { class: 'screen setup-screen' },
    topBar('Plan your trip', () => ctx.show('home')),
    h('div', { class: 'setup-layout' },
      h('section', { class: 'panel' },
        h('h2', {}, 'Where to?'),
        themeRow,
        nextStop,
      ),
      h('section', { class: 'panel' },
        h('h2', {}, 'Which math?'),
        h('div', { class: 'choice-row op-row', role: 'group', 'aria-label': 'Operations' }, opButtons),
        h('h2', {}, 'How hard?'),
        difficultyRow,
        status,
        h('p', { class: 'note trip-length' }, `${adventureLength} steps to the finish · detours of ${detourLength} questions`),
        h('button', { type: 'button', class: 'big-button primary go-button', onclick: go }, "Let's go!"),
      ),
    ),
  );
}
