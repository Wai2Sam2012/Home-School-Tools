// 8. Settings (grown-ups, behind the 3-second hold): voice, adventure and
// detour length, saving, backup and restore, and deleting the player.

import { ADVENTURE_LENGTHS, DETOUR_MAX, DETOUR_MIN, stepDetourLength } from '../settings.js?v=0.6.5';
import { bestVersions, chooseVoice, isFunVoice, voiceId, voiceQuality } from '../speech.js?v=0.6.5';
import { playerIcon } from '../avatars.js?v=0.6.5';
import { canUndoRestore, makeBackup, parseBackup, restoreBackup, saveBackupFile, undoRestore } from '../backup.js?v=0.6.5';
import { formatBytes } from '../storage.js?v=0.6.5';
import { choiceDialog, choiceRow, confirmDialog, h, topBar } from '../ui.js?v=0.6.5';

const REGIONS = { US: 'US', GB: 'UK', AU: 'Australia', IE: 'Ireland', IN: 'India', ZA: 'South Africa', NZ: 'New Zealand', CA: 'Canada', SG: 'Singapore' };
const SAMPLE = 'Hi! What is 7 times 8?';

/** "Enhanced · UK · works offline" */
export function describeVoice(v) {
  const region = String(v.lang).split(/[-_]/)[1]?.toUpperCase();
  return [
    { 0: 'Premium', 1: 'Enhanced', 1.5: 'Standard', 2: 'Standard', 2.5: 'Basic' }[voiceQuality(v)] ?? '',
    REGIONS[region] ?? v.lang,
    v.localService ? 'works offline' : 'needs the internet',
  ].filter(Boolean).join(' · ');
}

export function settingsScreen(ctx) {
  const player = ctx.profiles.active();
  const update = (changes) => ctx.profiles.updateSettings(player.id, changes);

  const detourValue = h('output', { class: 'stepper-value', 'aria-live': 'polite' });
  const minus = h('button', { type: 'button', class: 'round-button', 'aria-label': 'Fewer wandering questions', onclick: () => changeDetour(-1) }, '−');
  const plus = h('button', { type: 'button', class: 'round-button', 'aria-label': 'More wandering questions', onclick: () => changeDetour(1) }, '+');
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

  // Which voice reads the questions (or why there is none, T5.5), its speed,
  // and the list of the device's English voices to choose from.
  const voiceNote = h('p', { class: 'note voice-note' });
  const voiceList = h('div', { class: 'voice-list', role: 'group', 'aria-label': 'Voices' });
  const voicePanel = h('div', { class: 'voice-panel' },
    h('h3', {}, 'Speed'),
    choiceRow({
      label: 'Speed',
      value: player.settings.speed,
      options: [{ value: 'slower', label: 'Slower' }, { value: 'normal', label: 'Normal' }],
      onChange: (speed) => {
        update({ speed });
        sample();
      },
    }),
    h('h3', {}, 'Voice'),
    h('p', { class: 'note' }, 'Tap a voice to hear it.'),
    voiceList,
    h('p', { class: 'note' },
      'For a more natural voice on iPad: open the Settings app › Accessibility › Spoken Content › Voices › English, ',
      'download a voice marked Enhanced or Premium (for example Ava or Samantha), then close the game and open it again. ',
      'Some downloaded voices are not offered to web pages, so not every one appears here.'),
  );

  function sample() {
    if (ctx.voiceOn(player)) ctx.speaker.speak(SAMPLE);
  }

  function voiceButton(id, label, detail) {
    return h('button', {
      type: 'button',
      class: 'choice voice-choice',
      'aria-pressed': String(player.settings.voiceId === id),
      dataset: { voice: id },
      onclick: () => {
        update({ voiceId: id });
        showVoice();
        sample();
      },
    }, h('span', { class: 'choice-label' }, label), h('span', { class: 'choice-detail' }, detail));
  }

  function showVoice() {
    const ready = ctx.voiceState === 'ready';
    voicePanel.hidden = !player.settings.voice || !ready;
    if (!player.settings.voice) voiceNote.textContent = 'Questions are shown as text only.';
    else if (ready) {
      const v = chooseVoice(ctx.voices, { chosenId: player.settings.voiceId });
      voiceNote.textContent = `Voice: ${v.name} (${describeVoice(v)}).`;
    } else if (ctx.voiceState === 'loading') voiceNote.textContent = 'Looking for a voice…';
    else voiceNote.textContent = 'No voice was found on this device, so questions are shown as text only.';
    voiceNote.classList.toggle('notice', player.settings.voice && ctx.voiceState === 'none');
    if (!ready) return;

    // Each voice once, in its best version (the iPad can list a name two or three times).
    const ranked = bestVersions(ctx.voices);
    const best = chooseVoice(ctx.voices);
    const natural = ranked.filter((v) => !isFunVoice(v));
    const fun = ranked.filter((v) => isFunVoice(v));
    // replaceChildren() doesn't flatten lists or skip nulls the way h() does.
    voiceList.replaceChildren(...[
      voiceButton('', 'Automatic', `The best voice here: ${best.name}`),
      natural.length ? h('p', { class: 'voice-group' }, 'Natural voices') : null,
      natural.map((v) => voiceButton(voiceId(v), v.name, describeVoice(v))),
      fun.length ? h('p', { class: 'voice-group' }, 'Robot and fun voices') : null,
      fun.map((v) => voiceButton(voiceId(v), v.name, describeVoice(v))),
    ].flat().filter(Boolean));
  }
  showVoice();
  // The voice list can still be loading just after Tap to Start.
  if (ctx.voiceState === 'loading') {
    const later = setTimeout(showVoice, 2200);
    ctx.onLeave(() => clearTimeout(later));
  }

  // ---- saving, backup and restore (GAME-PLAN.md 1.10 and 1.11)
  const store = ctx.profiles;
  const backupStatus = h('p', { class: 'status-line', role: 'status' });
  const savingInfo = h('div', { class: 'saving-info' });
  const undoButton = h('button', { type: 'button', class: 'big-button quiet', onclick: undo }, 'Undo the last restore');
  function showSaving() {
    const { gamesSinceBackup, lastBackupAt, remind } = store.backupStatus();
    const lines = [
      store.storage.saving
        ? h('p', { class: 'note' }, `Saved on this iPad only (${formatBytes(store.storage.usage())}). It is not copied anywhere else.`)
        : h('p', { class: 'note notice' }, "This browser won't let the game save, so players and stickers last only until the page closes. Make a backup to keep them."),
      h('p', { class: 'note' }, 'The Safari tab and the Home Screen app keep separate saves, so always play from the same one (the Home Screen icon is best).'),
      h('p', { class: `note${remind ? ' notice' : ''}` }, lastBackupAt
        ? `Last backup: ${new Date(lastBackupAt).toLocaleDateString()}${gamesSinceBackup ? `, ${gamesSinceBackup} ${gamesSinceBackup === 1 ? 'adventure' : 'adventures'} ago` : ''}.`
        : (gamesSinceBackup ? `No backup yet (${gamesSinceBackup} ${gamesSinceBackup === 1 ? 'adventure' : 'adventures'} finished).` : 'No backup yet.')),
    ];
    if (ctx.problems.length) {
      lines.push(h('div', { class: 'note notice' },
        h('p', {}, 'Saving problems this session:'),
        h('ul', {}, [...new Set(ctx.problems.map((p) => p.message))].map((m) => h('li', {}, m)))));
    }
    savingInfo.replaceChildren(...lines);
    undoButton.hidden = !canUndoRestore(store);
  }
  showSaving();

  async function backUp() {
    try {
      const outcome = await saveBackupFile(makeBackup(store, { appVersion: ctx.version }));
      if (outcome === 'cancelled') {
        backupStatus.textContent = 'Backup cancelled.';
        return;
      }
      store.markBackedUp();
      backupStatus.textContent = outcome === 'shared'
        ? 'Backup ready. Choose "Save to Files" to keep it on the iPad or in iCloud Drive.'
        : 'Backup file saved (look in Downloads).';
      showSaving();
    } catch (error) {
      backupStatus.textContent = `The backup could not be made: ${error.message}`;
    }
  }

  const fileInput = h('input', { type: 'file', accept: '.json,application/json', class: 'file-input', 'aria-label': 'Backup file' });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    const parsed = parseBackup(await file.text().catch(() => ''));
    if (!parsed.ok) {
      backupStatus.textContent = parsed.error;
      return;
    }
    const made = parsed.exportedAt ? ` made on ${new Date(parsed.exportedAt).toLocaleDateString()}` : '';
    const mode = await choiceDialog({
      title: 'Restore this backup?',
      message: `The backup${made} has ${parsed.preview.text}.`,
      details: [`Players: ${parsed.preview.names.join(', ')}`],
      choices: [
        { value: 'replace', label: 'Replace everything', detail: 'All players on this iPad are replaced by the backup', danger: true },
        { value: 'add', label: 'Add as new players', detail: 'Players already here stay as they are' },
      ],
    });
    if (!mode) return;
    try {
      const added = restoreBackup(store, parsed.players, mode, { appVersion: ctx.version });
      ctx.notify(`Restored ${added.length} ${added.length === 1 ? 'player' : 'players'}. You can undo this in Settings.`);
      // After "Replace everything" the player whose settings were open is gone.
      if (store.active()) {
        showSaving();
        backupStatus.textContent = 'Restore done. "Undo the last restore" puts everything back as it was.';
      } else {
        ctx.show('profiles');
      }
    } catch (error) {
      backupStatus.textContent = error.message;
    }
  });

  async function undo() {
    const yes = await confirmDialog({
      title: 'Undo the last restore?',
      message: 'Every player goes back to how they were just before the restore.',
      yes: 'Undo restore',
    });
    if (!yes) return;
    try {
      undoRestore(store);
      ctx.notify('The restore was undone.');
      if (store.active()) ctx.refresh();
      else ctx.show('profiles');
    } catch (error) {
      backupStatus.textContent = error.message;
    }
  }

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
    h('p', { class: 'lead settings-for' }, 'Settings for ', playerIcon(player, { className: 'avatar-icon inline' }), ` ${player.name}`),
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
        voicePanel,
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
        h('h2', {}, 'Wandering length'),
        h('div', { class: 'stepper', role: 'group', 'aria-label': 'Wandering length' }, minus, detourValue, plus),
        h('p', { class: 'note' }, `Questions each time a player wanders off the trail after a wrong answer (${DETOUR_MIN} to ${DETOUR_MAX}).`),
      ),
      h('section', { class: 'panel' },
        h('h2', {}, 'Saving and backup'),
        savingInfo,
        h('div', { class: 'button-row' },
          h('button', { type: 'button', class: 'big-button primary backup-button', onclick: backUp }, 'Back up'),
          h('button', { type: 'button', class: 'big-button restore-button', onclick: () => fileInput.click() }, 'Restore'),
          fileInput,
        ),
        h('p', { class: 'note' }, 'A backup is one file with every player, their stickers, stats, high scores and settings.'),
        undoButton,
        backupStatus,
        h('h2', {}, 'Player'),
        h('button', { type: 'button', class: 'big-button danger', onclick: deletePlayer }, `Delete ${player.name}`),
      ),
    ),
  );
}
