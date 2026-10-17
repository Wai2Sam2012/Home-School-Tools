// 7. Stats: Need More Practice (from the last 10 games) and the high-score
// boards, one for each adventure length and difficulty (GAME-PLAN.md 1.11).

import { boardKey, needMorePractice } from '../scores.js?v=0.6.0';
import { ADVENTURE_LENGTHS, DIFFICULTY_LABELS, THEMES } from '../settings.js?v=0.6.0';
import { formatDuration } from '../timer.js?v=0.6.0';
import { choiceRow, h, topBar } from '../ui.js?v=0.6.0';

/** "Oct 17" */
function shortDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function statsScreen(ctx) {
  const player = ctx.profiles.active();

  // ---- Need More Practice
  const practice = needMorePractice(player.history);
  let practicePanel;
  if (player.history.length === 0) {
    practicePanel = h('p', { class: 'empty-note' }, 'Finish an adventure to see which problems to practise.');
  } else if (practice.length === 0) {
    practicePanel = h('p', { class: 'empty-note' }, 'Nothing to practise: no missed or slow problems in your last games. Great work! 🌟');
  } else {
    practicePanel = h('ol', { class: 'practice-list' }, practice.map((p) =>
      h('li', { class: 'practice-item' },
        h('span', { class: 'practice-problem' }, p.text),
        h('span', { class: 'practice-why' }, p.missed
          ? `missed ${p.missed === 1 ? 'once' : `${p.missed} times`}`
          : `took ${formatDuration(p.slowMs)}`))));
  }

  // ---- High scores: pick a length and a difficulty
  let length = player.settings.adventureLength;
  let difficulty = player.setup.difficulty;
  const board = h('div', { class: 'score-board' });
  function showBoard() {
    const entries = player.highScores[boardKey(length, difficulty)] ?? [];
    if (entries.length === 0) {
      board.replaceChildren(h('p', { class: 'empty-note' }, `No high scores yet for ${length}-question ${DIFFICULTY_LABELS[difficulty]} adventures.`));
      return;
    }
    board.replaceChildren(
      h('table', { class: 'score-table' },
        h('thead', {}, h('tr', {},
          h('th', { scope: 'col' }, '#'),
          h('th', { scope: 'col' }, 'Date'),
          h('th', { scope: 'col' }, 'Time'),
          h('th', { scope: 'col' }, 'Right'),
          h('th', { scope: 'col' }, 'Setbacks'),
          h('th', { scope: 'col' }, 'Math'))),
        h('tbody', {}, entries.map((e, i) => h('tr', { class: i === 0 ? 'best' : '' },
          h('td', {}, i === 0 ? '🏆' : String(i + 1)),
          h('td', {}, `${THEMES[e.theme]?.icon ?? ''} ${shortDate(e.at)}`),
          h('td', {}, formatDuration(e.thinkingMs)),
          h('td', {}, e.answered ? `${Math.round((e.correct / e.answered) * 100)}%` : '–'),
          h('td', {}, String(e.setbacks)),
          h('td', { class: 'score-ops' }, e.operations))))),
      h('p', { class: 'note' }, 'Fewest setbacks wins; then the shortest thinking time.'),
    );
  }
  showBoard();

  return h('main', { class: 'screen stats-screen' },
    topBar(`${player.name}'s Stats`, () => ctx.show('home')),
    h('div', { class: 'stats-layout' },
      h('section', { class: 'panel' },
        h('h2', {}, 'Need More Practice'),
        player.history.length ? h('p', { class: 'note' }, `From your last ${player.history.length} ${player.history.length === 1 ? 'game' : 'games'}.`) : null,
        practicePanel,
      ),
      h('section', { class: 'panel' },
        h('h2', {}, 'High Scores'),
        choiceRow({
          label: 'Adventure length',
          className: 'length-row',
          value: length,
          options: ADVENTURE_LENGTHS.map((n) => ({ value: n, label: String(n) })),
          onChange: (value) => {
            length = value;
            showBoard();
          },
        }),
        choiceRow({
          label: 'Difficulty',
          value: difficulty,
          options: Object.keys(DIFFICULTY_LABELS).map((d) => ({ value: d, label: DIFFICULTY_LABELS[d] })),
          onChange: (value) => {
            difficulty = value;
            showBoard();
          },
        }),
        board,
      ),
    ),
  );
}
