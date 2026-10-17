// Learn from Incorrect (opened from My Stats): a short practice round with the
// problems the player missed most and the ones that took longest. The rules
// are in js/learn.js. Like the adventure, each question is read aloud, the
// thinking timer starts when reading ends (or at the first key press), and a
// wrong answer shows the right one and waits for "Got it".

import { LEARN_NEEDS, answerLearning, currentProblem, startLearning } from '../learn.js?v=0.6.4';
import { hasTip } from '../blocks.js?v=0.6.4';
import { createKeypad } from '../keypad.js?v=0.6.4';
import { createTipButton, createTipCard, showTipButtons } from '../tip-card.js?v=0.6.4';
import { PRACTICE_SIZE, needMorePractice } from '../scores.js?v=0.6.4';
import { createThinkingTimer } from '../timer.js?v=0.6.4';
import { h, topBar } from '../ui.js?v=0.6.4';

const PRAISE = ['Correct!', 'Great job!', 'You got it!', 'Nice work!'];
const NEXT_AFTER_RIGHT_MS = 1100;
const SOUND_GAP_MS = 150;
const GOT_IT_SETTLE_MS = 350;

export function learnScreen(ctx) {
  const player = ctx.profiles.active();
  let state = startLearning(needMorePractice(player.history, PRACTICE_SIZE, player.learned));
  if (!state) {
    return h('main', { class: 'screen' },
      topBar('Learn from Incorrect', () => ctx.show('stats')),
      h('p', { class: 'lead' }, 'Nothing to practise right now. Great work! 🌟'),
      h('button', { type: 'button', class: 'big-button primary', onclick: () => ctx.show('stats') }, 'Back to My Stats'));
  }

  const thinking = createThinkingTimer();
  let busy = false;
  let waiting = false; // a wrong answer waits for "Got it"
  let timer = 0;
  let speakTimer = 0;
  let sayToken = 0;
  let questionNo = 0;

  // ---- the problems in this round, with a star for each right answer
  const chips = h('ol', { class: 'learn-chips', 'aria-label': 'Problems in this round' });
  function showChips() {
    chips.replaceChildren(...state.items.map((item) => h('li', {
      class: `learn-chip${item.learned ? ' learned' : ''}${!state.done && item.key === state.queue[0] ? ' now' : ''}`,
    },
    h('span', { class: 'learn-chip-text' }, item.problem.text),
    h('span', { class: 'learn-stars', 'aria-label': item.learned ? 'learned' : `${item.right} of ${LEARN_NEEDS}` },
      item.learned ? '✓' : '★'.repeat(item.right) + '☆'.repeat(LEARN_NEEDS - item.right)))));
  }

  const banner = h('p', { class: 'story learn-banner' });
  const question = h('p', { class: 'question', 'aria-live': 'polite' });
  const feedback = h('p', { class: 'feedback', role: 'status' });
  const correctLine = h('p', { class: 'correct-line', hidden: true });

  /** The question with what the player has typed in place of the "?", in orange (as in the adventure). */
  function showTyped(value = '') {
    const problem = currentProblem(state);
    if (problem) question.replaceChildren(`${problem.text} = `, value === '' ? '?' : h('span', { class: 'typed' }, value));
  }
  function bumpQuestion() {
    question.classList.remove('full');
    void question.offsetWidth;
    question.classList.add('full');
  }
  const repeat = h('button', { type: 'button', class: 'round-button repeat-button', 'aria-label': 'Read the question again', onclick: () => repeatQuestion() }, '🔊');
  // 🙏 The same counting tip as in the adventure (practice: tips are not counted).
  const tipCard = createTipCard();
  const openTip = () => {
    if (!busy && !state.done) tipCard.show(currentProblem(state));
  };
  const tipButtons = [createTipButton(openTip, { place: 'front' }), createTipButton(openTip, { place: 'below' })];

  // ---- speech and the thinking timer (as in the adventure)
  function say(text, then, afterMs = 0) {
    if (!ctx.voiceOn(player)) {
      then?.('off');
      return;
    }
    const token = ++sayToken;
    clearTimeout(speakTimer);
    const speak = () => {
      if (token !== sayToken) return;
      ctx.speaker.speak(text).then((reason) => {
        if (token === sayToken) then?.(reason);
      });
    };
    if (afterMs > 0) {
      ctx.speaker.cancel();
      speakTimer = setTimeout(speak, afterMs + SOUND_GAP_MS);
    } else {
      speak();
    }
  }
  function silence() {
    sayToken += 1;
    clearTimeout(speakTimer);
    ctx.speaker.cancel();
  }
  function startTimer() {
    thinking.start();
    if (document.hidden) thinking.pause();
  }
  function askAloud(intro = '', afterMs = 0) {
    const asked = questionNo;
    say(`${intro ? `${intro} ` : ''}What is ${currentProblem(state).speech}?`, () => {
      if (asked === questionNo && thinking.state === 'waiting') startTimer();
    }, afterMs);
  }
  function repeatQuestion() {
    if (busy || state.done) return;
    if (thinking.state === 'waiting') {
      askAloud();
      return;
    }
    thinking.pause(); // Repeat time doesn't count
    const asked = questionNo;
    say(`What is ${currentProblem(state).speech}?`, () => {
      if (asked === questionNo) thinking.resume();
    });
  }

  function showQuestion(intro = '', afterMs = 0) {
    const problem = currentProblem(state);
    showTyped('');
    question.classList.remove('wrong-answer', 'right-answer');
    correctLine.hidden = true;
    feedback.textContent = '';
    feedback.className = 'feedback';
    keypad.clear();
    keypad.setEnabled(true);
    busy = false;
    thinking.stop();
    questionNo += 1;
    tipCard.hide();
    showTipButtons(tipButtons, hasTip(problem));
    showChips();
    repeat.hidden = !ctx.voiceOn(player);
    if (ctx.voiceOn(player)) askAloud(intro, afterMs);
    else startTimer();
  }

  function submit(value) {
    if (busy || waiting || state.done) return;
    const problem = currentProblem(state);
    const { state: next, check, events } = answerLearning(state, value, { thinkingMs: thinking.elapsed() });
    if (!check.ok) {
      feedback.textContent = 'Type your answer on the keypad first.';
      feedback.className = 'feedback hint';
      return;
    }
    thinking.stop();
    silence();
    busy = true;
    tipCard.hide();
    showTipButtons(tipButtons, false);
    state = next;
    keypad.setEnabled(false);
    question.replaceChildren(`${problem.text} = `, h('span', { class: 'typed' }, value));
    question.classList.toggle('wrong-answer', !check.correct);
    question.classList.toggle('right-answer', check.correct);
    const learned = events.find((e) => e.type === 'learned');
    if (learned) ctx.profiles.markLearned(player.id, [learned.key]); // saved now, so closing the game keeps it
    const answer = events[0];
    if (answer.type === 'right') {
      feedback.replaceChildren(h('span', { 'aria-hidden': 'true' }, '✓ '),
        answer.tooSlow ? 'Right! Next time, try to answer a little faster.' : (learned ? `You learned ${problem.text}! ⭐` : PRAISE[Math.floor(Math.random() * PRAISE.length)]));
      feedback.className = 'feedback right';
      ctx.sound(learned ? 'cleared' : 'right');
      showChips();
      timer = setTimeout(() => next.done ? finish(events.at(-1)) : showQuestion(), NEXT_AFTER_RIGHT_MS);
    } else {
      feedback.replaceChildren(h('span', { 'aria-hidden': 'true' }, '✗ '), 'Incorrect', h('span', { 'aria-hidden': 'true' }, ' ✗'));
      feedback.className = 'feedback wrong';
      correctLine.textContent = `${problem.text} = ${problem.answer}`;
      correctLine.hidden = false;
      say(`Incorrect. ${problem.speech} is ${problem.answer}. It will come back soon.`, null, ctx.sound('wrong'));
      showChips();
      waiting = true;
      gotItCover.hidden = false;
      gotIt.focus({ preventScroll: true });
    }
  }

  function acknowledge() {
    if (!waiting) return;
    waiting = false;
    gotItCover.hidden = true;
    keypad.ignoreTaps(GOT_IT_SETTLE_MS);
    if (state.done) finish({ type: 'finished', learned: state.items.filter((i) => i.learned).map((i) => i.key), total: state.items.length });
    else showQuestion();
  }

  // ---- the end of the round
  const summary = h('section', { class: 'panel learn-summary', hidden: true });
  function finish(result) {
    silence();
    clearTimeout(timer);
    const learnedCount = result.learned.length;
    const all = learnedCount === result.total;
    layout.hidden = true;
    tipCard.hide();
    banner.textContent = all ? '🌟 You learned them all!' : `⭐ You learned ${learnedCount} of ${result.total}!`;
    summary.hidden = false;
    summary.replaceChildren(
      h('h2', {}, all ? 'Amazing work!' : 'Good practice!'),
      h('ul', { class: 'learn-results' }, state.items.map((item) =>
        h('li', { class: item.learned ? 'learned' : '' }, h('span', { class: 'learn-chip-text' }, item.problem.text), h('span', {}, item.learned ? ' ✓ learned' : ' · keep practising')))),
      all ? null : h('p', { class: 'note' }, 'The ones not learned yet stay in Need More Practice for next time.'),
      h('div', { class: 'button-row' },
        h('button', { type: 'button', class: 'big-button primary', onclick: () => ctx.show('stats') }, 'Back to My Stats'),
        h('button', { type: 'button', class: 'big-button', onclick: () => ctx.show('home') }, 'Home')),
    );
    showChips();
    // The voice waits for the finish fanfare.
    say(all ? 'You learned them all! Amazing work!' : `You learned ${learnedCount} of ${result.total}. Good practice!`, null, ctx.sound('finish'));
  }

  const keypad = createKeypad({
    showDisplay: false, // the answer shows in the question instead
    onSubmit: submit,
    onChange: (value) => {
      startTimer();
      showTyped(value);
    },
    onFull: bumpQuestion,
  });
  const gotIt = h('button', { type: 'button', class: 'big-button primary got-it', onclick: acknowledge }, 'Got it ›');
  const gotItCover = h('div', { class: 'got-it-cover', hidden: true }, gotIt);
  keypad.el.querySelector('.keypad').append(gotItCover);

  function onVisibility() {
    if (document.hidden) thinking.pause();
    else if (thinking.state === 'paused') thinking.resume();
  }
  document.addEventListener('visibilitychange', onVisibility);
  ctx.onLeave(() => {
    clearTimeout(timer);
    silence();
    document.removeEventListener('visibilitychange', onVisibility);
    keypad.destroy();
    ctx.debugLearn = null;
  });

  // Debug helper (?debug=1) for automated checks.
  ctx.debugLearn = {
    state: () => state,
    answer(right) {
      if (waiting) return 'Press "Got it" first.';
      if (busy || state.done) return 'Wait.';
      const problem = currentProblem(state);
      submit(String(right ? problem.answer : problem.answer + 1));
      return right ? 'Answered right.' : 'Answered wrong.';
    },
  };

  const layout = h('div', { class: 'adventure-layout' },
    h('section', { class: 'question-area' }, tipCard.el, h('div', { class: 'question-row' }, tipButtons[0], question, repeat), correctLine, feedback, h('div', { class: 'tip-row' }, tipButtons[1])),
    keypad.el);
  banner.textContent = `Let's practise ${state.items.length === 1 ? 'a tricky one' : `${state.items.length} tricky ones`}! Answer each one right ${LEARN_NEEDS} times.`;
  showQuestion(`Let's practise the tricky ones!`);

  return h('main', { class: 'screen learn-screen' },
    topBar('Learn from Incorrect', () => ctx.show('stats')),
    banner,
    chips,
    layout,
    summary,
  );
}
