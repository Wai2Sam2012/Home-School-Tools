// 4. Adventure (Stage 3 version): a practice run with the player's setup and
// the on-screen keypad. Stage 4 replaces it with the full trail, milestones
// and detours.

import { createKeypad } from '../keypad.js';
import { checkAnswer, createProblemGenerator } from '../math.js';
import { THEMES } from '../settings.js';
import { h, topBar } from '../ui.js';

const PRAISE = ['Correct!', 'Great job!', 'You got it!', 'Awesome!'];
const NEXT_AFTER_RIGHT_MS = 1200;
const NEXT_AFTER_WRONG_MS = 2500;

export function practiceScreen(ctx) {
  const player = ctx.profiles.active();
  const { operations, difficulty, theme } = player.setup;
  const generator = createProblemGenerator({ operations, difficulty });
  let problem = generator.next();
  let asked = 0;
  let right = 0;
  let timer = 0;

  const question = h('p', { class: 'question', 'aria-live': 'polite' });
  const feedback = h('p', { class: 'feedback', role: 'status' });
  const score = h('p', { class: 'score' });

  function showProblem() {
    question.textContent = `${problem.text} = ?`;
    feedback.textContent = '';
    feedback.className = 'feedback';
    keypad.clear();
    keypad.setEnabled(true);
  }

  function showScore() {
    score.textContent = asked ? `${right} right out of ${asked}` : '';
  }

  function submit(value) {
    const result = checkAnswer(problem, value);
    if (!result.ok) {
      feedback.textContent = 'Type your answer on the keypad first.';
      feedback.className = 'feedback hint';
      return;
    }
    asked += 1;
    keypad.setEnabled(false);
    question.textContent = `${problem.text} = ${value}`;
    if (result.correct) {
      right += 1;
      feedback.replaceChildren(h('span', { 'aria-hidden': 'true' }, '✔ '), PRAISE[Math.floor(Math.random() * PRAISE.length)]);
      feedback.className = 'feedback right';
    } else {
      feedback.replaceChildren(h('span', { 'aria-hidden': 'true' }, '✖ '), `Not quite. ${problem.text} = ${problem.answer}`);
      feedback.className = 'feedback wrong';
    }
    showScore();
    timer = setTimeout(() => {
      problem = generator.next();
      showProblem();
    }, result.correct ? NEXT_AFTER_RIGHT_MS : NEXT_AFTER_WRONG_MS);
  }

  const keypad = createKeypad({ onSubmit: submit });
  ctx.onLeave(() => {
    clearTimeout(timer);
    keypad.destroy();
  });
  showProblem();
  showScore();

  return h('main', { class: 'screen practice-screen' },
    topBar(`${THEMES[theme].icon} Practice run`, () => ctx.show('home')),
    h('div', { class: 'practice-layout' },
      h('section', { class: 'question-area' },
        h('p', { class: 'note' }, 'The adventure trail is coming soon. For now, practise with the keypad!'),
        question,
        feedback,
        score,
      ),
      keypad.el,
    ),
  );
}
