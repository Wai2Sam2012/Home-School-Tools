// 8. Settings (grown-ups, behind the 3-second hold): voice, adventure and
// detour length, backup and restore (Stage 6), and deleting the player.

import { ADVENTURE_LENGTHS, DETOUR_MAX, DETOUR_MIN, stepDetourLength } from '../settings.js?v=0.5.0';
import { choiceRow, confirmDialog, h, topBar } from '../ui.js?v=0.5.0';

export function settingsScreen(ctx) {
  const player = ctx.profiles.active();
  const update = (changes) => ctx.profiles.updateSettings(player.id, changes);

  const detourValue = h('output', { class: 'stepper-value', 'aria-live': 'polite' });
  const minus = h('button', { type: 'button', class: 'round-button', 'aria-label': 'Fewer detour questions', onclick: () => changeDetour(-1) }, '−');
  const plus = h('button', { type: 'button', class: 'round-button', 'aria-label': 'More detour questions', onclick: () => changeDetour(1) }, '+');
  function showDetour() {
    detourValue.textContent = String(player.settings.detourLength);
    minus.disabled = player.settings.detourLength <= DETOUR_MIN;
    plus.disabled = player.settings.detourLength >= DETOUR_MAX;
  }
  function changeDetour(change) {
    update({ detourLength: stepDetourLength(player.settings.detourLength, change) });
    showDetour();
  }
  showDetour();

  // Which voice reads the questions, or why there is none (T5.5).
  const voiceNote = h('p', { class: 'note voice-note' });
  const hear = h('button', { type: 'button', class: 'big-button', onclick: () => ctx.speaker.speak('What is 7 times 8?') }, '🔊 Hear the voice');
  function showVoice() {
    const v = ctx.speaker.voice;
    hear.hidden = !ctx.voiceOn(player);
    if (!player.settings.voice) voiceNote.textContent = 'Questions are shown as text only.';
    else if (ctx.voiceState === 'ready') voiceNote.textContent = `Voice: ${v.name}${v.localService ? ' (works offline)' : ' (needs the internet)'}.`;
    else if (ctx.voiceState === 'loading') voiceNote.textContent = 'Looking for a voice…';
    else voiceNote.textContent = 'No voice was found on this device, so questions are shown as text only.';
    voiceNote.classList.toggle('notice', player.settings.voice && ctx.voiceState === 'none');
    voiceNote.append(' ', hear);
  }
  showVoice();

  async function deletePlayer() {
    const yes = await confirmDialog({
      title: `Delete ${player.name}?`,
      message: `${player.name}'s stickers, stats and high scores will be deleted. This can't be undone.`,
      yes: 'Delete',
      danger: true,
    });
    if (!yes) return;
    ctx.profiles.remove(player.id);
    ctx.show('profiles');
  }

  return h('main', { class: 'screen settings-screen' },
    topBar('Grown-up Settings', () => ctx.show('home')),
    h('p', { class: 'lead' }, `Settings for ${player.avatar} ${player.name}`),
    h('div', { class: 'settings-layout' },
      h('section', { class: 'panel' },
        h('h2', {}, 'Questions'),
        choiceRow({
          label: 'Voice',
          value: player.settings.voice,
          options: [
            { value: true, label: 'Read aloud', detail: 'Questions are spoken' },
            { value: false, label: 'Text only', detail: 'No speaking' },
          ],
          onChange: (voice) => {
            update({ voice });
            showVoice();
          },
        }),
        voiceNote,
        h('h2', {}, 'Sound effects'),
        choiceRow({
          label: 'Sound effects',
          value: player.settings.sound,
          options: [
            { value: true, label: 'On', detail: 'Chimes and fanfares' },
            { value: false, label: 'Off', detail: 'Quiet' },
          ],
          onChange: (sound) => update({ sound }),
        }),
        h('h2', {}, 'Adventure length'),
        choiceRow({
          label: 'Adventure length',
          className: 'length-row',
          value: player.settings.adventureLength,
          options: ADVENTURE_LENGTHS.map((n) => ({ value: n, label: String(n) })),
          onChange: (adventureLength) => update({ adventureLength }),
        }),
        h('p', { class: 'note' }, 'Questions to reach the end of the trail.'),
        h('h2', {}, 'Detour length'),
        h('div', { class: 'stepper', role: 'group', 'aria-label': 'Detour length' }, minus, detourValue, plus),
        h('p', { class: 'note' }, `Questions in each detour (${DETOUR_MIN} to ${DETOUR_MAX}).`),
      ),
      h('section', { class: 'panel' },
        h('h2', {}, 'Saving and backup'),
        h('p', { class: 'note notice' }, "This test version doesn't save yet: players and stickers reset when the page reloads."),
        h('div', { class: 'button-row' },
          h('button', { type: 'button', class: 'big-button', disabled: true }, 'Back up'),
          h('button', { type: 'button', class: 'big-button', disabled: true }, 'Restore'),
        ),
        h('p', { class: 'note' }, 'Backup and restore are coming soon.'),
        h('h2', {}, 'Player'),
        h('button', { type: 'button', class: 'big-button danger', onclick: deletePlayer }, `Delete ${player.name}`),
      ),
    ),
  );
}
