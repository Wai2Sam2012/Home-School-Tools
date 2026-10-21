// 4. Adventure: the trail map with milestone flags, the question, the keypad,
// and the story moments (milestones, detours, going back to a flag).
// The rules are in js/adventure.js; this screen only shows them.
//
// Voice and timer (Stage 5): with Voice on, each question (and any story
// moment before it) is read aloud. The thinking timer starts when reading
// has finished, or at the first key press if that comes sooner, and stops at
// Submit. It pauses while Repeat is reading and while the game is in the
// background. The keypad works the whole time; nothing waits on speech.

import { answerProblem, jumpTo, milestoneSteps, storyText, unlockSticker, useTip, withNextProblem } from '../adventure.js?v=0.7.8';
import { hasTip } from '../blocks.js?v=0.7.8';
import { createTipButton, createTipCard, showTipButtons } from '../tip-card.js?v=0.7.8';
import { stickerPicture } from '../art.js?v=0.7.8';
import { playerIcon } from '../avatars.js?v=0.7.8';
import { createDetourRoad, loopProgress } from '../detour-road.js?v=0.7.8';
import { createKeypad } from '../keypad.js?v=0.7.8';
import { THEMES, collectionKey } from '../settings.js?v=0.7.8';
import { createThinkingTimer } from '../timer.js?v=0.7.8';
import { nextSticker, stickerSet } from '../storyline.js?v=0.7.8';
import { h, topBar } from '../ui.js?v=0.7.8';

const PRAISE = ['Correct!', 'Great job!', 'You got it!', 'Awesome!', 'Nice work!'];
// A right answer moves on by itself; after a wrong one the game waits for
// "Got it" so the player has time to read the right answer.
const NEXT_AFTER_RIGHT_MS = 1100;
// A short pause between a sound effect ending and the voice starting.
const SOUND_GAP_MS = 150;
// How long the keys ignore taps after "Got it" (a double tap must not type a digit).
const GOT_IT_SETTLE_MS = 350;

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
  // The stickers of this trip's level (0.7.3): each level has its own set.
  const setKey = collectionKey(state.theme, state.difficulty);
  let storyline = null;
  let timer = 0;
  let busy = false;
  let waitingFor = null; // the events of a wrong answer, until "Got it" is pressed
  const thinking = createThinkingTimer();
  let page = null; // the screen's <main>, made at the end
  let questionNo = 0;
  let sayToken = 0;
  let speakTimer = 0;

  // ---- trail map
  const fill = h('div', { class: 'trail-fill' });
  // The player's own icon travels the trail (all icons face right, toward the finish).
  const traveler = h('div', { class: 'trail-traveler', 'aria-hidden': 'true' }, playerIcon(player));
  const road = createDetourRoad(player.avatar, player.color);
  const flags = milestoneSteps(state.length).map((step) =>
    h('div', { class: 'trail-flag', style: `left: ${(step / state.length) * 100}%`, dataset: { step: String(step) }, 'aria-hidden': 'true' }, '🚩'));
  const goal = h('div', { class: 'trail-goal', 'aria-hidden': 'true' }, '🏁');
  const count = h('p', { class: 'trail-count' });
  const map = h('div', { class: 'trail-map', role: 'img' },
    h('div', { class: 'trail-lane' }, h('div', { class: 'trail-track' }, fill, flags, traveler, road.el)),
    h('div', { class: 'trail-finish' }, goal, count));

  // ---- story, question and feedback
  const story = h('p', { class: 'story', role: 'status' });
  const question = h('p', { class: 'question', 'aria-live': 'polite' });
  const feedback = h('p', { class: 'feedback', role: 'status' });
  // After a wrong answer: the question with the right answer, in green.
  const correctLine = h('p', { class: 'correct-line', hidden: true });

  /** The question with what the player has typed in place of the "?", in orange. */
  function showTyped(value = '') {
    question.replaceChildren(`${state.problem.text} = `, value === '' ? '?' : h('span', { class: 'typed' }, value));
  }
  /** A little shake when no more digits fit. */
  function bumpQuestion() {
    question.classList.remove('full');
    void question.offsetWidth;
    question.classList.add('full');
  }
  const detourCount = h('p', { class: 'detour-count' });
  // A question missed earlier in this trip, asked again (js/adventure.js).
  const againNote = h('p', { class: 'again-note', hidden: true }, h('span', { 'aria-hidden': 'true' }, '🔁 '), 'One you missed. Try it again!');
  const repeat = h('button', { type: 'button', class: 'round-button repeat-button', 'aria-label': 'Read the question again', onclick: () => repeatQuestion() }, '🔊');
  // 🙏 Help (addition and subtraction): the question drawn with counting blocks.
  // Each question's Help counts once in the trip's "Help used".
  // While the tip is open it takes the place of the trail map and the story, so it can be bigger.
  // The size is fitted again straight away, so the screen never shows a frame that is too tall.
  const tipCard = createTipCard({
    // "Submit this answer" on the column note pad answers like the keypad's ✓.
    onAnswer: (value) => submit(value),
    onToggle: (open) => {
      page?.classList.toggle('tip-open', open);
      fitNow();
    },
  });
  // Help in front of the question (upright screen) and under it (wide screen); style.css shows one.
  const tipButtons = [createTipButton(() => showTip(), { place: 'front' }), createTipButton(() => showTip(), { place: 'below' })];
  function showTip() {
    if (busy || !hasTip(state.problem)) return false;
    if (tipCard.show(state.problem)) save(useTip(state));
    return true;
  }

  // ---- speech and the thinking timer
  /**
   * Reads text aloud if Voice is on; then() runs when it has finished (not if
   * something else interrupts it). afterMs waits for a sound effect to finish
   * first (a flag's roar lasts about 1.5 s), so the voice never talks over it.
   */
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
      ctx.speaker.cancel(); // stop anything still being read while the sound plays
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
    say(`${intro ? `${intro} ` : ''}What is ${state.problem.speech}?`, () => {
      if (asked === questionNo && thinking.state === 'waiting') startTimer();
    }, afterMs);
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

  // Saved after every change, so closing the game never loses more than the current question.
  function save(next) {
    state = next;
    ctx.profiles.saveAdventure(player.id, next);
  }

  function showMap() {
    const at = (state.step / state.length) * 100;
    fill.style.width = `${at}%`;
    traveler.style.left = `${at}%`;
    // On a detour the icon leaves the trail and drives around the detour road.
    traveler.hidden = state.mode === 'detour';
    if (state.mode === 'detour') road.show(at, loopProgress(state.detour.asked, state.detourLength));
    else road.hide();
    for (const flag of flags) flag.classList.toggle('reached', Number(flag.dataset.step) <= state.checkpoint);

    count.textContent = `Step ${state.step} of ${state.length}`;
    map.setAttribute('aria-label', `Trail map: step ${state.step} of ${state.length}`);
  }

  function setStory(text, kind = '') {
    story.textContent = text;
    story.className = `story${kind ? ` ${kind}` : ''}`;
    story.hidden = !text;
  }

  /** Shows the next question; with Voice on, reads it (after afterMs, if a sound effect is playing). */
  function showQuestion(intro = '', afterMs = 0) {
    // The detour counter changes with the question, not while the last answer is still shown.
    detourCount.hidden = state.mode !== 'detour';
    // Players call a detour "wandering" (the code keeps the word detour).
    if (state.detour) detourCount.textContent = `Wandering question ${state.detour.asked + 1} of ${state.detourLength}`;
    againNote.hidden = !state.isAgain;
    if (state.isAgain) intro = `${intro ? `${intro} ` : ''}Here's one you missed. Try it again!`;
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
    showTipButtons(tipButtons, hasTip(state.problem));
    repeat.hidden = !ctx.voiceOn(player);
    if (ctx.voiceOn(player)) askAloud(intro, afterMs);
    else startTimer(); // text only: timing starts when the question is shown
  }

  // The finished trip is recorded (sticker, high score, history) as soon as
  // the last answer is right, not when Trail's End opens a moment later, so
  // leaving or closing the game in between never loses it.
  let finishing = null;
  function recordFinish() {
    finishing ??= (async () => {
      let error = null;
      try {
        storyline ??= await ctx.getStoryline(state.theme);
      } catch (e) {
        error = e;
      }
      if (error) {
        // No sticker list: keep the score and history anyway.
        const result = ctx.profiles.finishAdventure(player.id, state, { collected: player.collected[setKey] ?? [], stickerId: null });
        return { result, error };
      }
      // A level whose set is still to come gives no sticker (Trail's End says so).
      const { sticker, collected } = unlockSticker(stickerSet(storyline, state.difficulty), player.collected[setKey] ?? []);
      return { result: ctx.profiles.finishAdventure(player.id, state, { collected, stickerId: sticker?.id ?? null }), error: null };
    })();
    return finishing;
  }

  async function finish() {
    const { result, error } = await recordFinish();
    if (error) {
      setStory(`You reached the end! Your score is saved, but the sticker list could not be loaded: ${error.message}`, 'setback');
      return;
    }
    ctx.sound('finish');
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
    const streak = events.find((e) => e.type === 'streak');
    const lines = storyline ?? { milestones: [], detours: [], detourCleared: ['Wandering done! Back on the trail.'], setback: ["Back to the last flag. You can do it!"] };
    let line = '';
    let wait = 0; // how long the sound effect lasts; the voice waits for it
    if (milestone) {
      line = storyText(lines, milestone) || `Flag ${milestone.number} reached!`;
      setStory(`🚩 ${line}`, 'milestone');
      wait = ctx.flagSound(state.theme); // a roar for dinosaurs, an engine for trucks (or the theme's recording)
    } else if (detourStart) {
      line = storyText(lines, detourStart);
      setStory(`🚧 ${line}`, 'detour');
      wait = ctx.sound('detour');
    } else if (cleared) {
      line = storyText(lines, cleared);
      setStory(`✅ ${line}`, 'cleared');
      wait = ctx.sound('cleared');
    } else if (setback) {
      line = storyText(lines, setback);
      setStory(`↩️ ${line}`, 'setback');
      wait = ctx.sound('setback');
    } else if (streak) {
      line = `${streak.count} in a row! Keep it going!`;
      setStory(`🔥 ${line}`, 'streak');
    } else if (state.mode !== 'detour') {
      setStory('');
    }
    // During a detour its story stays up, with the question counter below it.
    save(withNextProblem(state));
    showMap();
    showQuestion(line, wait);
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
    tipCard.hide();
    showTipButtons(tipButtons, false);
    const problem = state.problem;
    save(next);
    if (events.some((e) => e.type === 'finished')) recordFinish();
    keypad.setEnabled(false);
    question.replaceChildren(`${problem.text} = `, h('span', { class: 'typed' }, value));
    // A wrong answer: the player's answer in red, crossed out, and the right
    // one in green in the answer box.
    question.classList.toggle('wrong-answer', !check.correct);
    question.classList.toggle('right-answer', check.correct);
    const streak = events.find((e) => e.type === 'streak');
    if (check.correct && streak) {
      feedback.replaceChildren(h('span', { 'aria-hidden': 'true' }, '🔥 '), `${streak.count} in a row!`);
      feedback.className = 'feedback right streak';
      ctx.sound('streak');
    } else if (check.correct) {
      feedback.replaceChildren(h('span', { 'aria-hidden': 'true' }, '✓ '), PRAISE[Math.floor(Math.random() * PRAISE.length)]);
      feedback.className = 'feedback right';
      ctx.sound('right');
    } else {
      feedback.replaceChildren(h('span', { 'aria-hidden': 'true' }, '✗ '), 'Incorrect', h('span', { 'aria-hidden': 'true' }, ' ✗'));
      correctLine.textContent = `${problem.text} = ${problem.answer}`;
      correctLine.hidden = false;
      feedback.className = 'feedback wrong';
      say(`Incorrect. ${problem.speech} is ${problem.answer}.`, null, ctx.sound('wrong'));
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
    // A double tap on "Got it" must not type a digit with its second tap.
    keypad.ignoreTaps(GOT_IT_SETTLE_MS);
    afterAnswer(events);
  }

  // The first key press starts the timer if reading hasn't finished yet.
  const keypad = createKeypad({
    showDisplay: false, // the answer shows in the question instead
    onSubmit: submit,
    onChange: (value) => {
      startTimer();
      showTyped(value);
    },
    onFull: bumpQuestion,
  });
  // With Help's column note pad open and a box chosen, the number keys write in the box (0.7.6).
  keypad.setKeyTaker((key) => tipCard.press(key));
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
    tip() {
      if (busy) return 'Wait for the next question.';
      return showTip() ? 'Tip shown.' : 'No tip for this question.';
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
  // ---- fit: the screen never scrolls. Each time its size or the window
  // changes, start from the biggest size ('big', 0.7.2: fills a tall iPad)
  // and step down to more compact sizes until it fits; if even the smallest
  // doesn't fit, let it scroll (see style.css).
  let fitFrame = 0;
  function fitNow() {
    cancelAnimationFrame(fitFrame);
    const app = page?.parentElement;
    if (!app) return;
    const tooTall = () => app.scrollHeight > app.clientHeight + 1;
    app.classList.remove('fit-scroll');
    const levels = ['big', '0', '1', '2', '3'];
    let level = 0;
    page.dataset.fit = levels[0];
    while (tooTall() && level < levels.length - 1) page.dataset.fit = levels[++level];
    app.classList.toggle('fit-scroll', tooTall());
  }
  function fit() {
    cancelAnimationFrame(fitFrame);
    fitFrame = requestAnimationFrame(fitNow);
  }
  const resizes = new ResizeObserver(fit);
  window.addEventListener('resize', fit);

  ctx.onLeave(() => {
    clearTimeout(timer);
    silence();
    document.removeEventListener('visibilitychange', onVisibility);
    keypad.destroy();
    ctx.debugAdventure = null;
    cancelAnimationFrame(fitFrame);
    resizes.disconnect();
    window.removeEventListener('resize', fit);
    page?.parentElement?.classList.remove('fit-scroll');
  });

  // A recorded flag sound, if the theme has one, is loaded now so it plays without a delay.
  ctx.prepareSounds(state.theme);

  // The destination: the sticker this trail unlocks.
  ctx.getStoryline(state.theme).then((loaded) => {
    storyline = loaded;
    const sticker = nextSticker(stickerSet(storyline, state.difficulty), player.collected[setKey] ?? []);
    if (sticker) {
      goal.replaceChildren(stickerPicture(state.theme, sticker, 0, { className: 'goal-picture' }));
      goal.title = sticker.name;
    }
  }).catch(() => {
    // Without the story file the trail still works; the finish line stays a flag.
  });

  if (!state.problem) save(withNextProblem(state));
  let opening = 'Welcome back! Keep going.';
  if (state.mode === 'detour') opening = 'You are wandering off the trail. Answer the questions to get back on it!';
  else if (state.step === 0 && state.stats.answered === 0) opening = 'Off we go! Answer to move along the trail.';
  setStory(`${state.mode === 'detour' ? '🚧' : theme.icon} ${opening}`, state.mode === 'detour' ? 'detour' : 'cleared');
  showMap();
  showQuestion(opening);

  const layout = h('div', { class: 'adventure-layout' },
    h('section', { class: 'question-area' }, story, detourCount, againNote, h('div', { class: 'question-row' }, tipButtons[0], question, repeat), correctLine, feedback, h('div', { class: 'tip-row' }, tipButtons[1])),
    keypad.el,
  );
  page = h('main', { class: `screen adventure-screen theme-${state.theme}`, dataset: { fit: 'big' } },
    topBar(`${theme.icon} ${theme.title}`, () => ctx.show('home')),
    h('section', { class: 'trail-area' }, map, tipCard.el),
    layout,
  );
  // The screen is at least as tall as the window, so watch what is inside it.
  resizes.observe(layout);
  resizes.observe(page);
  return page;
}
