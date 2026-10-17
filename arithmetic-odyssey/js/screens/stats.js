// 7. Stats: Need More Practice and High Scores. Stage 3 shows the layout;
// the adventure (Stage 4) and saving (Stage 6) fill it in.

import { ADVENTURE_LENGTHS } from '../settings.js?v=0.5.3';
import { choiceRow, h, topBar } from '../ui.js?v=0.5.3';

export function statsScreen(ctx) {
  const player = ctx.profiles.active();
  const board = h('div', { class: 'score-board' });
  const showBoard = (length) => {
    board.replaceChildren(h('p', { class: 'empty-note' }, `No high scores for ${length}-question adventures yet.`));
  };
  showBoard(player.settings.adventureLength);

  return h('main', { class: 'screen stats-screen' },
    topBar(`${player.name}'s Stats`, () => ctx.show('home')),
    h('div', { class: 'stats-layout' },
      h('section', { class: 'panel' },
        h('h2', {}, 'Need More Practice'),
        h('p', { class: 'empty-note' }, 'Finish an adventure to see which problems to practise.'),
      ),
      h('section', { class: 'panel' },
        h('h2', {}, 'High Scores'),
        choiceRow({
          label: 'Adventure length',
          className: 'length-row',
          value: player.settings.adventureLength,
          options: ADVENTURE_LENGTHS.map((n) => ({ value: n, label: String(n) })),
          onChange: showBoard,
        }),
        board,
      ),
    ),
  );
}
