// Voice and sound tester (opened from the ?debug=1 panel): plays any English
// voice on this device with a choice of sample line, speed and pitch, and
// every sound effect, so a grown-up can compare them and pick the best.

import { describeVoice } from './settings.js?v=0.5.2';
import { chooseVoice, isFunVoice, loadVoices, rankVoices, voiceId } from '../speech.js?v=0.5.2';
import { SOUNDS, SYNTHS, playSound } from '../audio.js?v=0.5.2';
import { choiceRow, h, topBar } from '../ui.js?v=0.5.2';

const SOUND_NAMES = {
  right: 'Right answer (ding)',
  wrong: 'Wrong answer',
  detour: 'Detour starts',
  cleared: 'Detour cleared',
  setback: 'Back to a flag',
  milestone: 'Flag (no theme sound)',
  finish: "Trail's End",
  roar: 'Flag in Dino Tour (roar)',
  engine: 'Flag in Off-Roading (engine)',
};

const SAMPLES = {
  question: 'What is 7 times 8?',
  story: 'You crossed the steaming swamp! What is 12 plus 9?',
  wrong: 'Not quite. 7 times 8 is 56.',
  sticker: 'You made it! Your new sticker is Eoraptor.',
};
const RATES = [0.7, 0.8, 0.9, 0.95, 1, 1.1];
const PITCHES = [0.8, 0.9, 1, 1.1, 1.2];

export function voiceLabScreen(ctx) {
  const player = ctx.profiles.active();
  let sample = 'question';
  let rate = 0.95;
  let pitch = 1;
  let playingAll = false;
  const status = h('p', { class: 'status-line', role: 'status' });
  const list = h('div', { class: 'voice-lab-list' }, h('p', {}, 'Loading the voices…'));
  ctx.onLeave(() => {
    playingAll = false;
    ctx.speaker.cancel();
  });

  const play = (voice, text = SAMPLES[sample]) => ctx.speaker.speak(text, { voice, rate, pitch });

  function row(voice) {
    const id = voiceId(voice);
    return h('div', { class: 'voice-lab-row', dataset: { voice: id } },
      h('button', { type: 'button', class: 'round-button', 'aria-label': `Play ${voice.name}`, onclick: () => play(voice) }, '▶'),
      h('div', { class: 'voice-lab-name' },
        h('strong', {}, voice.name),
        h('span', { class: 'choice-detail' }, describeVoice(voice)),
        h('span', { class: 'voice-lab-id' }, `${voice.lang} · ${id}${voice.default ? ' · device default' : ''}`)),
      player
        ? h('button', {
          type: 'button',
          class: 'big-button use-voice',
          onclick: () => {
            ctx.profiles.updateSettings(player.id, { voiceId: id, speed: rate < 0.9 ? 'slower' : 'normal' });
            status.textContent = `${player.name} now uses ${voice.name}. (Speed ${rate < 0.9 ? 'Slower' : 'Normal'}; pitch is only for testing.)`;
          },
        }, 'Use this voice')
        : null);
  }

  async function playAll(voices) {
    playingAll = true;
    for (const voice of voices) {
      if (!playingAll) break;
      for (const r of list.querySelectorAll('.voice-lab-row')) r.classList.toggle('playing', r.dataset.voice === voiceId(voice));
      status.textContent = `Playing ${voice.name}…`;
      // Two voices can share a name (a basic and an Enhanced Samantha), so say which.
      const kind = /premium/i.test(voice.voiceURI ?? '') ? ' Premium' : /enhanced/i.test(voice.voiceURI ?? '') ? ' Enhanced' : '';
      const name = voice.name.includes(kind.trim()) ? voice.name : `${voice.name}${kind}`;
      await play(voice, `This is ${name}. ${SAMPLES[sample]}`);
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    for (const r of list.querySelectorAll('.voice-lab-row')) r.classList.remove('playing');
    if (playingAll) status.textContent = 'Done. Tap ▶ to hear one again.';
    playingAll = false;
  }

  loadVoices(globalThis.speechSynthesis, { waitMs: 2500 }).then((voices) => {
    const ranked = rankVoices(voices);
    if (!ranked.length) {
      list.replaceChildren(h('p', { class: 'form-error' }, 'This device offers no English voices to web pages.'));
      return;
    }
    const natural = ranked.filter((v) => !isFunVoice(v));
    const fun = ranked.filter((v) => isFunVoice(v));
    const best = chooseVoice(voices);
    // replaceChildren() doesn't flatten lists or skip nulls the way h() does.
    list.replaceChildren(...[
      h('p', { class: 'note' }, `${ranked.length} English voices. The game picks automatically: ${best ? best.name : 'none'}. Natural voices are listed best first.`),
      h('div', { class: 'button-row' },
        h('button', { type: 'button', class: 'big-button primary', onclick: () => playAll(natural) }, '▶ Play all natural voices'),
        fun.length ? h('button', { type: 'button', class: 'big-button', onclick: () => playAll(fun) }, '▶ Play all robot and fun voices') : null,
        h('button', {
          type: 'button',
          class: 'big-button quiet',
          onclick: () => {
            playingAll = false;
            ctx.speaker.cancel();
            status.textContent = 'Stopped.';
          },
        }, '■ Stop')),
      h('h2', {}, 'Natural voices'),
      natural.map(row),
      fun.length ? h('h2', {}, 'Robot and fun voices') : null,
      fun.map(row),
    ].flat().filter(Boolean));
  });

  return h('main', { class: 'screen voice-lab-screen' },
    topBar('Voice and sound tester', () => ctx.show(player ? 'settings' : 'profiles')),
    h('section', { class: 'panel' },
      h('h2', {}, 'Sound effects'),
      h('div', { class: 'sound-buttons' },
        [...Object.keys(SOUNDS), ...Object.keys(SYNTHS)].map((name) =>
          h('button', { type: 'button', class: 'choice', dataset: { sound: name }, onclick: () => playSound(name) }, `▶ ${SOUND_NAMES[name] ?? name}`))),
    ),
    h('section', { class: 'panel' },
      h('h2', {}, 'Sample'),
      choiceRow({
        label: 'Sample',
        value: sample,
        options: [
          { value: 'question', label: 'Question' },
          { value: 'story', label: 'Story' },
          { value: 'wrong', label: 'Wrong answer' },
          { value: 'sticker', label: 'Sticker' },
        ],
        onChange: (value) => {
          sample = value;
        },
      }),
      h('h2', {}, 'Speed'),
      choiceRow({ label: 'Speed', className: 'length-row', value: rate, options: RATES.map((r) => ({ value: r, label: String(r) })), onChange: (value) => { rate = value; } }),
      h('h2', {}, 'Pitch'),
      choiceRow({ label: 'Pitch', className: 'length-row', value: pitch, options: PITCHES.map((p) => ({ value: p, label: String(p) })), onChange: (value) => { pitch = value; } }),
      player ? null : h('p', { class: 'note' }, 'Choose a player first to use "Use this voice".'),
    ),
    status,
    h('section', { class: 'panel' }, list),
  );
}
