// 4. Adventure: the trail map with milestone flags, the question, the keypad,
// and the story moments (milestones, detours, going back to a flag).
// The rules are in js/adventure.js; this screen only shows them.

import { answerProblem, jumpTo, milestoneSteps, storyText, unlockSticker, withNextProblem } from '../adventure.js?v=0.4.0';
import { stickerPicture } from '../art.js?v=0.4.0';
import { createKeypad } from '../keypad.js?v=0.4.0';
import { THEMES } from '../settings.js?v=0.4.0';
import { nextSticker } from '../storyline.js?v=0.4.0';
import { h, topBar } from '../ui.js?v=0.4.0';

const PRAISE = ['Correct!', 'Great job!', 'You got it!', 'Awesome!', 'Nice work!'];
const NEXT_AFTER_RIGHT_MS = 1100;
const NEXT_AFTER_WRONG_MS = 2400;

export function adventureScreen(ctx) {
  const player = ctx.profiles.active();
  let state = player.adventure;
  if (!state || state.mode === 'done') {
    return h('main', { class: 'screen' },
      topBar('Adventure', () => ctx.show('home')),
      h('p', { class: 'lead' }, 'There is no adventure in progress.'),
      h('button', { type: 'button', class: 'big-button primary', onclick: () => ctx.show('setup') }, 'Plan a new trip'));
  }
  const theme = THEMES[state.theme];
  let storyline = null;
  let timer = 0;
  let busy = false;

  // ---- trail map
  const fill = h('div', { class: 'trail-fill' });
  const traveler = h('div', { class: 'trail-traveler', 'aria-hidden': 'true' }, theme.icon);
  const flags = milestoneSteps(state.length).map((step) =>
    h('div', { class: 'trail-flag', style: `left: ${(step / state.length) * 100}%`, dataset: { step: String(step) }, 'aria-hidden': 'true' }, '🚩'));
  const goal = h('div', { class: 'trail-goal', 'aria-hidden': 'true' }, '🏁');
  const count = h('p', { class: 'trail-count' });
  const map = h('div', { class: 'trail-map', role: 'img' },
    h('div', { class: 'trail-track' }, fill, flags, traveler),
    goal);

  // ---- story, question and feedback
  const story = h('p', { class: 'story', role: 'status' });
  const question = h('p', { class: 'question', 'aria-live': 'polite' });
  const feedback = h('p', { class: 'feedback', role: 'status' });
  const detourCount = h('p', { class: 'detour-count' });

  function save(next) {
    state = next;
    player.adventure = next;
  }

  function showMap() {
    const at = (state.step / state.length) * 100;
    fill.style.width = `${at}%`;
    traveler.style.left = `${at}%`;
    traveler.classList.toggle('on-detour', state.mode === 'detour');
    for (const flag of flags) flag.classList.toggle('reached', Number(flag.dataset.step) <= state.checkpoint);
    detourCount.hidden = state.mode !== 'detour';
    if (state.detour) detourCount.textContent = `Detour question ${Math.min(state.detour.asked + 1, state.detourLength)} of ${state.detourLength}`;
    count.textContent = `Step ${state.step} of ${state.length}`;
    map.setAttribute('aria-label', `Trail map: step ${state.step} of ${state.length}`);
  }

  function setStory(text, kind = '') {
    story.textContent = text;
    story.className = `story${kind ? ` ${kind}` : ''}`;
    story.hidden = !text;
  }

  function showQuestion() {
    question.textContent = `${state.problem.text} = ?`;
    feedback.textContent = '';
    feedback.className = 'feedback';
    keypad.clear();
    keypad.setEnabled(true);
    busy = false;
  }

  async function finish() {
    try {
      storyline ??= await ctx.getStoryline(state.theme);
    } catch (error) {
      setStory(`You reached the end, but the sticker list could not be loaded: ${error.message}`, 'setback');
      return;
    }
    const { sticker, collected } = unlockSticker(storyline, player.collected[state.theme]);
    player.collected[state.theme] = collected;
    const result = { theme: state.theme, length: state.length, stats: state.stats, stickerId: sticker?.id ?? null };
    player.lastResult = result;
    player.adventure = null;
    ctx.show('trailEnd', result);
  }

  function afterAnswer(events) {
    const types = events.map((e) => e.type);
    if (types.includes('finished')) {
      finish();
      return;
    }
    const milestone = events.find((e) => e.type === 'milestone');
    const detourStart = events.find((e) => e.type === 'detour-start');
    const cleared = events.find((e) => e.type === 'detour-cleared');
    const setback = events.find((e) => e.type === 'setback');
    const lines = storyline ?? { milestones: [], detours: [], detourCleared: ['Detour done! Back on the trail.'], setback: ["Back to the last flag. You can do it!"] };
    if (milestone) setStory(`🚩 ${storyText(lines, milestone) || `Flag ${milestone.number} reached!`}`, 'milestone');
    else if (detourStart) setStory(`🚧 ${storyText(lines, detourStart)}`, 'detour');
    else if (cleared) setStory(`✅ ${storyText(lines, cleared)}`, 'cleared');
    else if (setback) setStory(`↩️ ${storyText(lines, setback)}`, 'setback');
    else if (state.mode !== 'detour') setStory('');
    // During a detour its story stays up, with the question counter below it.
    save(withNextProblem(state));
    showMap();
    showQuestion();
  }

  function submit(value) {
    if (busy) return;
    const { state: next, check, events } = answerProblem(state, value);
    if (!check.ok) {
      feedback.textContent = 'Type your answer on the keypad first.';
      feedback.className = 'feedback hint';
      return;
    }
    busy = true;
    const problem = state.problem;
    save(next);
    keypad.setEnabled(false);
    question.textContent = `${problem.text} = ${value}`;
    if (check.correct) {
      feedback.replaceChildren(h('span', { 'aria-hidden': 'true' }, '✔ '), PRAISE[Math.floor(Math.random() * PRAISE.length)]);
      feedback.className = 'feedback right';
    } else {
      feedback.replaceChildren(h('span', { 'aria-hidden': 'true' }, '✖ '), `Not quite. ${problem.text} = ${problem.answer}`);
      feedback.className = 'feedback wrong';
    }
    showMap();
    timer = setTimeout(() => afterAnswer(events), check.correct ? NEXT_AFTER_RIGHT_MS : NEXT_AFTER_WRONG_MS);
  }

  const keypad = createKeypad({ onSubmit: submit });

  // Debug helpers (?debug=1) to force detours, setbacks and the ending (T4.8).
  ctx.debugAdventure = {
    answer(right) {
      if (busy) return 'Wait for the next question.';
      const answer = right ? state.problem.answer : state.problem.answer + 1;
      submit(String(answer));
      return right ? 'Answered right.' : 'Answered wrong.';
    },
    jump(where) {
      if (busy) return 'Wait for the next question.';
      const target = where === 'end' ? state.length - 1 : Math.min(state.length - 1, (Math.floor(state.step / 10) + 1) * 10 - 1);
      save(withNextProblem(jumpTo(state, target)));
      setStory('');
      showMap();
      showQuestion();
      return `Jumped to step ${state.step}.`;
    },
  };
  ctx.onLeave(() => {
    clearTimeout(timer);
    keypad.destroy();
    ctx.debugAdventure = null;
  });

  // The destination: the sticker this trail unlocks.
  ctx.getStoryline(state.theme).then((loaded) => {
    storyline = loaded;
    const sticker = nextSticker(storyline, player.collected[state.theme]);
    if (sticker) {
      goal.replaceChildren(stickerPicture(state.theme, sticker, 0, { className: 'goal-picture' }));
      goal.title = sticker.name;
    }
  }).catch(() => {
    // Without the story file the trail still works; the finish line stays a flag.
  });

  if (!state.problem) save(withNextProblem(state));
  if (state.mode === 'detour') setStory('🚧 You are on a detour. Answer the questions to get back on the trail!', 'detour');
  else if (state.step === 0 && state.stats.answered === 0) setStory(`${theme.icon} Off we go! Answer to move along the trail.`, 'cleared');
  else setStory('Welcome back! Keep going.', 'cleared');
  showMap();
  showQuestion();

  return h('main', { class: 'screen adventure-screen' },
    topBar(`${theme.icon} ${theme.title}`, () => ctx.show('home')),
    h('section', { class: 'trail-area' }, map, count),
    h('div', { class: 'adventure-layout' },
      h('section', { class: 'question-area' }, story, detourCount, question, feedback),
      keypad.el,
    ),
  );
}
