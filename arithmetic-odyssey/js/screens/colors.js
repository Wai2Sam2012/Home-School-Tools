// Colors (0.7.3): the player picks the colors of the whole game. Opened with
// 🎨 Colors on Home, so anyone can change them (it used to be in Grown-up
// Settings). Each player keeps their own; the start screens use the last
// player's.

import { COLOR_THEMES, COLOR_THEME_LABELS } from '../settings.js?v=0.7.6';
import { choiceRow, h, topBar } from '../ui.js?v=0.7.6';

export function colorsScreen(ctx) {
  const player = ctx.profiles.active();
  return h('main', { class: 'screen colors-screen' },
    topBar('Colors', () => ctx.show('home')),
    h('section', { class: 'panel colors-panel' },
      h('h2', {}, `Pick the colors for ${player.name}`),
      choiceRow({
        label: 'Colors',
        className: 'colors-row',
        value: player.settings.colors,
        options: COLOR_THEMES.map((c) => ({ value: c, label: COLOR_THEME_LABELS[c] })),
        onChange: (colors) => {
          ctx.profiles.updateSettings(player.id, { colors });
          ctx.applyColors(colors);
          ctx.profiles.setLastColors(colors);
        },
      }),
      h('p', { class: 'note' }, 'High contrast is the easiest to read; Dark is gentle in a dim room. The game changes straight away.'),
      h('button', { type: 'button', class: 'big-button primary', onclick: () => ctx.show('home') }, 'Done'),
    ),
  );
}
