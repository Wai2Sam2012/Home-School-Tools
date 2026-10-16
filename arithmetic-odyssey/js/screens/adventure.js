// 4. Adventure: the trail map with milestone flags, the question, the keypad,
// and the story moments (milestones, detours, going back to a flag).
// The rules are in js/adventure.js; this screen only shows them.
//
// Voice and timer (Stage 5): with Voice on, each question (and any story
// moment before it) is read aloud. The thinking timer starts when reading
// has finished, or at the first key press if that comes sooner, and stops at
// Submit. It pauses while Repeat is reading and while the game is in the
// background. The keypad works the whole time; nothing waits on speech.

import { answerProblem, jumpTo, milestoneSteps, storyText, unlockSticker, withNextProblem } from '../adventure.js?v=0.5.0';
import { stickerPicture } from '../art.js?v=0.5.0';
import { createKeypad } from '../keypad.js?v=0.5.0';
import { THEMES } from '../settings.js?v=0.5.0';
import { createThinkingTimer } from '../timer.js?v=0.5.0';
import { nextSticker } from '../storyline.js?v=0.5.0';
import { h, topBar } from '../ui.js?v=0.5.0';

const PRAISE = ['Correct!', 'Great job!', 'You got it!', 'Awesome!', 'Nice work!'];
// A right answer moves on by itself; after a wrong one the game waits for
// "Got it" so the player has time to read the right answer.
const NEXT_AFTER_RIGHT_MS = 1100;

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
  let waitingFor = null; // the events of a wrong answer, until "Got it" is pressed
  const thinking = createThinkingTimer();
  let questionNo = 0;
  let sayToken = 0;

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
  const repeat = h('button', { type: 'button', class: 'round-button repeat-button', 'aria-label': 'Read the question again', onclick: () => repeatQuestion() }, '🔊');

  // ---- speech and the thinking timer
  /** Reads text aloud if Voice is on; then() runs when it has finished (not if something else interrupts it). */
  function say(text, then) {
    if (!ctx.voiceOn(player)) {
      then?.('off');
      return;
    }
    const token = ++sayToken;
    ctx.speaker.speak(text).then((reason) => {
      if (token === sayToken) then?.(reason);
    });
  }

  function silence() {
    sayToken += 1;
    ctx.speaker.cancel();
  }

  function startTimer() {
    thinking.start();
    if (document.hidden) thinking.pause();
  }

  function askAloud(intro = '') {
    const asked = questionNo;
    say(`${intro ? `${intro} ` : ''}What is ${state.problem.speech}?`, () => {
      if (asked === questionNo && thinking.state === 'waiting') startTimer();
    });
  }

  function repeatQuestion() {
    if (busy || !state.problem) return;
    if (thinking.state === 'waiting') {
      askAloud();
      return;
    }
    thinking.pause(); // Repeat time doesn't count
    const asked = questionNo;
    say(`What is ${state.problem.speech}?`, () => {
      if (asked === questionNo) thinking.resume();
    });
  }

  function onVisibility() {
    if (document.hidden) {
      thinking.pause();
      silence();
    } else if (!busy) {
      if (thinking.state === 'paused') thinking.resume();
      else startTimer(); // reading was cut short by going to the background
    }
  }
  document.addEventListener('visibilitychange', onVisibility);

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

    count.textContent = `Step ${state.step} of ${state.length}`;
    map.setAttribute('aria-label', `Trail map: step ${state.step} of ${state.length}`);
  }

  function setStory(text, kind = '') {
    story.textContent = text;
    story.className = `story${kind ? ` ${kind}` : ''}`;
    story.hidden = !text;
  }

  function showQuestion(intro = '') {
    // The detour counter changes with the question, not while the last answer is still shown.
    detourCount.hidden = state.mode !== 'detour';
    if (state.detour) detourCount.textContent = `Detour question ${state.detour.asked + 1} of ${state.detourLength}`;
    question.textContent = `${state.problem.text} = ?`;
    feedback.textContent = '';
    feedback.className = 'feedback';
    keypad.clear();
    keypad.setEnabled(true);
    busy = false;
    thinking.stop();
    questionNo += 1;
    repeat.hidden = !ctx.voiceOn(player);
    if (ctx.voiceOn(player)) askAloud(intro);
    else startTimer(); // text only: timing starts when the question is shown
  }

  async function finish() {
    try {
      storyline ??= await ctx.getStoryline(state.theme);
    } catch (error) {
      setStory(`You reached the end, but the sticker list could not be loaded: ${error.message}`, 'setback');
      return;
    }
    ctx.sound('finish');
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
    let line = '';
    if (milestone) {
      line = storyText(lines, milestone) || `Flag ${milestone.number} reached!`;
      setStory(`🚩 ${line}`, 'milestone');
      ctx.sound('milestone');
    } else if (detourStart) {
      line = storyText(lines, detourStart);
      setStory(`🚧 ${line}`, 'detour');
      ctx.sound('detour');
    } else if (cleared) {
      line = storyText(lines, cleared);
      setStory(`✅ ${line}`, 'cleared');
      ctx.sound('cleared');
    } else if (setback) {
      line = storyText(lines, setback);
      setStory(`↩️ ${line}`, 'setback');
      ctx.sound('setback');
    } else if (state.mode !== 'detour') {
      setStory('');
    }
    // During a detour its story stays up, with the question counter below it.
    save(withNextProblem(state));
    showMap();
    showQuestion(line);
  }

  function submit(value) {
    if (busy) return;
    const { state: next, check, events } = answerProblem(state, value, { thinkingMs: thinking.elapsed() });
    if (!check.ok) {
      feedback.textContent = 'Type your answer on the keypad first.';
      feedback.className = 'feedback hint';
      return;
    }
    thinking.stop();
    silence();
    busy = true;
    const problem = state.problem;
    save(next);
    keypad.setEnabled(false);
    question.textContent = `${problem.text} = ${value}`;
    if (check.correct) {
      feedback.replaceChildren(h('span', { 'aria-hidden': 'true' }, '✔ '), PRAISE[Math.floor(Math.random() * PRAISE.length)]);
      feedback.className = 'feedback right';
      ctx.sound('right');
    } else {
      feedback.replaceChildren(h('span', { 'aria-hidden': 'true' }, '✖ '), `Not quite. ${problem.text} = ${problem.answer}`);
      feedback.className = 'feedback wrong';
      ctx.sound('wrong');
      say(`Not quite. ${problem.speech} is ${problem.answer}.`);
    }
    showMap();
    if (check.correct) {
      timer = setTimeout(() => afterAnswer(events), NEXT_AFTER_RIGHT_MS);
    } else {
      waitingFor = events;
      gotItCover.hidden = false;
      gotIt.focus({ preventScroll: true });
    }
  }

  function acknowledge() {
    if (!waitingFor) return;
    const events = waitingFor;
    waitingFor = null;
    gotItCover.hidden = true;
    afterAnswer(events);
  }

  // The first key press starts the timer if reading hasn't finished yet.
  const keypad = createKeypad({ onSubmit: submit, onChange: () => startTimer() });
  // Covers the keys (not the answer box) after a wrong answer, so the screen doesn't change size.
  const gotIt = h('button', { type: 'button', class: 'big-button primary got-it', onclick: acknowledge }, 'Got it ›');
  const gotItCover = h('div', { class: 'got-it-cover', hidden: true }, gotIt);
  keypad.el.querySelector('.keypad').append(gotItCover);

  // Debug helpers (?debug=1) to force detours, setbacks and the ending (T4.8).
  ctx.debugAdventure = {
    timer: () => ({ state: thinking.state, elapsed: thinking.elapsed() }),
    answer(right) {
      if (waitingFor) return 'Press "Got it" first.';
      if (busy) return 'Wait for the next question.';
      const answer = right ? state.problem.answer : state.problem.answer + 1;
      submit(String(answer));
      return right ? 'Answered right.' : 'Answered wrong.';
    },
    jump(where) {
      if (busy) return 'Wait for the next question.';
      const target = where === 'end' ? state.length - 1 : Math.min(state.length - 1, (Math.floor(state.step / 10) + 1) * 10 - 1);
      silence();
      save(withNextProblem(jumpTo(state, target)));
      setStory('');
      showMap();
      showQuestion();
      return `Jumped to step ${state.step}.`;
    },
  };
  ctx.onLeave(() => {
    clearTimeout(timer);
    silence();
    document.removeEventListener('visibilitychange', onVisibility);
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
  let opening = 'Welcome back! Keep going.';
  if (state.mode === 'detour') opening = 'You are on a detour. Answer the questions to get back on the trail!';
  else if (state.step === 0 && state.stats.answered === 0) opening = 'Off we go! Answer to move along the trail.';
  setStory(`${state.mode === 'detour' ? '🚧' : theme.icon} ${opening}`, state.mode === 'detour' ? 'detour' : 'cleared');
  showMap();
  showQuestion(opening);

  return h('main', { class: 'screen adventure-screen' },
    topBar(`${theme.icon} ${theme.title}`, () => ctx.show('home')),
    h('section', { class: 'trail-area' }, map, count),
    h('div', { class: 'adventure-layout' },
      h('section', { class: 'question-area' }, story, detourCount, h('div', { class: 'question-row' }, question, repeat), feedback),
      keypad.el,
    ),
  );
}
