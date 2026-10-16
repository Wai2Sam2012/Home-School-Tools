// Stage 5 tests: sound, voice and the thinking timer.
// Run from the arithmetic-odyssey folder with:  node --test
// Test IDs (T5.x) match the test plan in GAME-PLAN.md. The speech engine and
// the clock are fakes, so these run in a second without a real voice.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_WAIT_MS, MIN_WAIT_MS, POLL_MS, START_GRACE_MS, chooseVoice, createSpeaker, estimateSpeechMs, loadVoices,
} from '../js/speech.js';
import { createThinkingTimer, formatDuration } from '../js/timer.js';
import { SOUNDS, playSound } from '../js/audio.js';
import { answerProblem, startAdventure, withNextProblem } from '../js/adventure.js';

// ---------------------------------------------------------------- fakes
/** A clock with setTimeout/setInterval that only moves when advance() is called. */
function fakeClock() {
  let time = 0;
  let nextId = 1;
  const tasks = new Map();
  const clock = {
    now: () => time,
    setTimeout: (fn, ms) => {
      tasks.set(nextId, { fn, at: time + ms });
      return nextId++;
    },
    setInterval: (fn, ms) => {
      tasks.set(nextId, { fn, at: time + ms, every: ms });
      return nextId++;
    },
    clearTimeout: (id) => tasks.delete(id),
    clearInterval: (id) => tasks.delete(id),
    async advance(ms) {
      const end = time + ms;
      for (;;) {
        const due = [...tasks.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        const [id, task] = due;
        time = task.at;
        if (task.every) task.at += task.every;
        else tasks.delete(id);
        task.fn();
        await Promise.resolve();
      }
      time = end;
      await Promise.resolve();
    },
  };
  return clock;
}

class FakeUtterance {
  constructor(text) {
    this.text = text;
  }
}

function fakeSynth() {
  return {
    speaking: false,
    pending: false,
    spoken: [],
    cancels: 0,
    speak(utterance) {
      this.spoken.push(utterance);
      this.current = utterance;
    },
    cancel() {
      this.cancels += 1;
      this.speaking = false;
    },
  };
}

function setup() {
  const clock = fakeClock();
  const synth = fakeSynth();
  const speaker = createSpeaker({ synth, Utterance: FakeUtterance, timers: clock, now: clock.now });
  speaker.unlock();
  return { clock, synth, speaker };
}

/** Records when a promise settles, in fake-clock time. */
function track(promise, clock) {
  const result = { done: false };
  promise.then((value) => Object.assign(result, { done: true, value, at: clock.now() }));
  return result;
}

const QUESTION = 'What is 7 times 8?';

// ---------------------------------------------------------------- T5.1
test('T5.1 nothing is spoken before Tap to Start', async () => {
  const clock = fakeClock();
  const synth = fakeSynth();
  const speaker = createSpeaker({ synth, Utterance: FakeUtterance, timers: clock, now: clock.now });
  assert.equal(await speaker.speak(QUESTION), 'unavailable');
  assert.equal(synth.spoken.length, 0);
});

test('T5.1 no sound is played before Tap to Start', () => {
  assert.equal(playSound('right'), false);
});

test('a device without speech still plays (text only)', async () => {
  const speaker = createSpeaker({ synth: undefined, Utterance: undefined });
  speaker.unlock();
  assert.equal(speaker.available, false);
  assert.equal(await speaker.speak(QUESTION), 'unavailable');
});

// ---------------------------------------------------------------- finished-speaking detection
test('speech finishes on the "end" event', async () => {
  const { clock, synth, speaker } = setup();
  const r = track(speaker.speak(QUESTION), clock);
  synth.speaking = true;
  await clock.advance(1200);
  assert.equal(r.done, false);
  synth.current.onend();
  await clock.advance(0);
  assert.deepEqual([r.done, r.value], [true, 'end']);
  assert.equal(speaker.lastEnd, 'end');
});

test('speech finishes when the 200 ms check finds nothing speaking, even if "end" never comes', async () => {
  const { clock, synth, speaker } = setup();
  const r = track(speaker.speak(QUESTION), clock);
  synth.speaking = true;
  await clock.advance(1500);
  synth.speaking = false; // finished, but no end event
  await clock.advance(POLL_MS);
  assert.deepEqual([r.done, r.value], [true, 'poll']);
  assert.ok(r.at <= 1500 + POLL_MS);
});

test('if speech never starts at all, the 200 ms check gives up after the start grace time', async () => {
  const { clock, speaker } = setup();
  const r = track(speaker.speak(QUESTION), clock);
  await clock.advance(START_GRACE_MS - POLL_MS);
  assert.equal(r.done, false, 'waits a moment for speech to begin');
  await clock.advance(POLL_MS * 2);
  assert.deepEqual([r.done, r.value], [true, 'poll']);
});

test('T5.3 if the end event never fires and speaking never stops, the safety timeout ends it', async () => {
  const { clock, synth, speaker } = setup();
  const r = track(speaker.speak(QUESTION), clock);
  synth.speaking = true; // stuck
  const limit = estimateSpeechMs(QUESTION);
  await clock.advance(limit - 1);
  assert.equal(r.done, false);
  await clock.advance(1);
  assert.deepEqual([r.done, r.value, r.at], [true, 'timeout', limit]);
  assert.ok(synth.cancels >= 2, 'the stuck speech is cancelled');
});

test('T5.3 the debug switch ignores "end" and the 200 ms check, so only the safety timeout ends speech', async () => {
  const { clock, synth, speaker } = setup();
  speaker.simulateStuck = true;
  const r = track(speaker.speak(QUESTION), clock);
  synth.current.onend();
  await clock.advance(3000);
  assert.equal(r.done, false);
  await clock.advance(MAX_WAIT_MS);
  assert.deepEqual([r.done, r.value], [true, 'timeout']);
});

test('the safety timeout is words ÷ 2.5 per second ÷ rate × 1.5, between 2 and 10 seconds', () => {
  assert.equal(estimateSpeechMs('What is 7 times 8?', 1), 3000); // 5 words: 2 s × 1.5
  assert.equal(estimateSpeechMs('What is 7 times 8?', 0.5), 6000);
  assert.equal(estimateSpeechMs('Hi', 1), MIN_WAIT_MS);
  assert.equal(estimateSpeechMs('word '.repeat(100), 1), MAX_WAIT_MS);
});

test('each new question cancels the last speech first, so the queue never gets stuck', async () => {
  const { clock, synth, speaker } = setup();
  const first = track(speaker.speak('first'), clock);
  const second = track(speaker.speak('second'), clock);
  await clock.advance(0);
  assert.deepEqual([first.done, first.value], [true, 'cancel']);
  assert.equal(second.done, false);
  assert.ok(synth.cancels >= 2);
  assert.equal(synth.spoken.at(-1).text, 'second');
  speaker.cancel();
  await clock.advance(0);
  assert.equal(second.value, 'cancel');
});

test('the utterance is kept referenced until it finishes (or iPad Safari may drop its events)', async () => {
  const { clock, synth, speaker } = setup();
  const r = track(speaker.speak(QUESTION), clock);
  assert.equal(globalThis.currentUtterance, synth.current);
  synth.current.onend();
  await clock.advance(0);
  assert.equal(r.value, 'end');
  assert.equal(globalThis.currentUtterance, null);
});

test('the chosen voice and a slightly slow rate are used', async () => {
  const { synth, speaker } = setup();
  const voice = { name: 'Samantha', lang: 'en-US', localService: true };
  speaker.setVoice(voice);
  speaker.speak(QUESTION);
  assert.equal(synth.current.voice, voice);
  assert.equal(synth.current.lang, 'en-US');
  assert.ok(synth.current.rate < 1 && synth.current.rate >= 0.8);
});

// ---------------------------------------------------------------- choosing a voice (T5.5)
test('an English voice that works offline is preferred, US English first', () => {
  const voices = [
    { name: 'Google US English', lang: 'en-US', localService: false, default: true },
    { name: 'Daniel', lang: 'en-GB', localService: true },
    { name: 'Thomas', lang: 'fr-FR', localService: true },
    { name: 'Samantha', lang: 'en-US', localService: true },
  ];
  assert.equal(chooseVoice(voices).name, 'Samantha');
  assert.equal(chooseVoice(voices.filter((v) => v.name !== 'Samantha')).name, 'Daniel', 'offline beats US English');
  assert.equal(chooseVoice([voices[0], voices[2]]).name, 'Google US English', 'an online English voice is the last resort');
  assert.equal(chooseVoice([voices[2]]), null, 'T5.5 no English voice: text only');
  assert.equal(chooseVoice([]), null);
  assert.equal(chooseVoice(undefined), null);
  assert.equal(chooseVoice([{ name: 'Karen', lang: 'en_AU', localService: true }]).name, 'Karen', 'Android-style en_AU counts');
});

test('the voice list is waited for when it arrives late, but not forever', async () => {
  const clock = fakeClock();
  let voices = [];
  let listener = null;
  const synth = { getVoices: () => voices, addEventListener: (_, fn) => { listener = fn; }, removeEventListener: () => {} };
  const late = track(loadVoices(synth, { timers: clock }), clock);
  voices = [{ name: 'Samantha', lang: 'en-US', localService: true }];
  listener();
  await clock.advance(0);
  assert.equal(late.value.length, 1);

  voices = [];
  const never = track(loadVoices(synth, { timers: clock, waitMs: 2000 }), clock);
  await clock.advance(1999);
  assert.equal(never.done, false);
  await clock.advance(1);
  assert.deepEqual(never.value, [], 'gives up and the game uses text only');
  assert.deepEqual(await loadVoices(undefined), []);
});

// ---------------------------------------------------------------- T5.4 thinking timer
test('T5.4 the timer counts from start (end of speech or question shown) to Submit', () => {
  let t = 1000;
  const timer = createThinkingTimer(() => t);
  assert.equal(timer.state, 'waiting');
  t += 5000; // reading the question aloud: not counted
  timer.start();
  t += 4200;
  assert.equal(timer.stop(), 4200);
  assert.equal(timer.state, 'waiting', 'ready for the next question');
  assert.equal(timer.elapsed(), 0);
});

test('T5.4 the timer pauses in the background and during Repeat', () => {
  let t = 0;
  const timer = createThinkingTimer(() => t);
  timer.start();
  t += 2000;
  timer.pause(); // app goes to the background
  t += 60000;
  timer.resume();
  t += 1000;
  timer.pause(); // Repeat starts speaking
  t += 3000;
  timer.resume(); // Repeat finished
  t += 500;
  assert.equal(timer.stop(), 3500);
});

test('T5.4 starting twice, pausing before starting, or resuming while running changes nothing', () => {
  let t = 0;
  const timer = createThinkingTimer(() => t);
  timer.pause();
  timer.resume();
  assert.equal(timer.state, 'waiting');
  timer.start();
  t += 1000;
  timer.start(); // the first key press after speech already started it
  timer.resume();
  t += 1000;
  assert.equal(timer.elapsed(), 2000);
  timer.pause();
  timer.pause();
  t += 5000;
  assert.equal(timer.elapsed(), 2000);
});

test('T5.4 each question\'s thinking time adds up in the adventure (the high-score time)', () => {
  let s = withNextProblem(startAdventure({ theme: 'dino', length: 20, detourLength: 3, operations: ['+'], difficulty: 'beginner' }));
  const times = [4000, 2500, 7250];
  for (const ms of times) {
    const right = times.indexOf(ms) !== 1;
    s = answerProblem(s, String(right ? s.problem.answer : s.problem.answer + 1), { thinkingMs: ms }).state;
    s = withNextProblem(s);
  }
  assert.equal(s.stats.thinkingMs, 13750, 'detour questions count too');
  const same = answerProblem(s, '', { thinkingMs: 9999 }).state;
  assert.equal(same.stats.thinkingMs, 13750, 'an empty answer adds no time');
  assert.equal(answerProblem(s, '1', { thinkingMs: -50 }).state.stats.thinkingMs, 13750, 'negative times are ignored');
});

test('thinking time is shown as minutes and seconds', () => {
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(4000), '0:04');
  assert.equal(formatDuration(95400), '1:35');
  assert.equal(formatDuration(3725000), '1:02:05');
});

// ---------------------------------------------------------------- sounds
test('every sound effect is short and in a comfortable pitch range', () => {
  for (const [name, sound] of Object.entries(SOUNDS)) {
    assert.ok(['sine', 'triangle'].includes(sound.wave), `${name} wave`);
    const end = Math.max(...sound.notes.map(([, start, length]) => start + length));
    assert.ok(end <= 1.5, `${name} lasts ${end} s`);
    for (const [frequency] of sound.notes) assert.ok(frequency >= 200 && frequency <= 1400, `${name} ${frequency} Hz`);
  }
  for (const name of ['right', 'wrong', 'detour', 'cleared', 'setback', 'milestone', 'finish']) assert.ok(SOUNDS[name], name);
});
