// Reading aloud with speechSynthesis, and knowing reliably when it has
// finished (GAME-PLAN.md 1.9). On the iPad the "end" event can come late or
// never, so speech counts as finished at whichever comes first:
//   - the "end" or "error" event,
//   - a check every 200 ms finding that nothing is speaking any more,
//   - a safety timeout based on the length of the text (2 to 10 seconds).
// The game never waits on speech: the keypad works the whole time.
//
// The speech engine and timers are passed in, so the tests can fake them.

export const WORDS_PER_SECOND = 2.5;
export const MIN_WAIT_MS = 2000;
export const MAX_WAIT_MS = 10000;
export const POLL_MS = 200;
/** How long to wait for speech to begin before the 200 ms check may decide it has finished. */
export const START_GRACE_MS = 1000;
export const SPEECH_RATE = 0.9;

/** The safety timeout: words ÷ 2.5 per second ÷ rate, × 1.5, between 2 and 10 seconds. */
export function estimateSpeechMs(text, rate = SPEECH_RATE) {
  const words = String(text).trim().split(/\s+/).filter(Boolean).length;
  const ms = (words / WORDS_PER_SECOND / rate) * 1000 * 1.5;
  return Math.round(Math.min(MAX_WAIT_MS, Math.max(MIN_WAIT_MS, ms)));
}

/**
 * Picks the voice to use: English voices that work offline (localService)
 * first, US English before other English, the device default before others.
 * Falls back to an English voice that needs the internet, then to null.
 */
export function chooseVoice(voices, preferredLang = 'en-US') {
  const english = (voices ?? []).filter((v) => /^en([-_]|$)/i.test(v.lang ?? ''));
  const rank = (v) => (v.localService ? 0 : 4) + (v.lang.replace('_', '-').toLowerCase() === preferredLang.toLowerCase() ? 0 : 2) + (v.default ? 0 : 1);
  return [...english].sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

/**
 * Waits up to waitMs for the voice list, which can arrive late
 * (the "voiceschanged" event). Resolves with the list, possibly empty.
 */
export function loadVoices(synth, { waitMs = 2000, timers = globalThis } = {}) {
  return new Promise((resolve) => {
    if (!synth) {
      resolve([]);
      return;
    }
    const now = synth.getVoices();
    if (now.length) {
      resolve(now);
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      synth.removeEventListener?.('voiceschanged', finish);
      resolve(synth.getVoices());
    };
    synth.addEventListener?.('voiceschanged', finish);
    timers.setTimeout(finish, waitMs);
  });
}

/**
 * Creates the speaker. speak(text) resolves with how speech finished:
 * 'end', 'error', 'poll' (found not speaking), 'timeout', 'cancel' or
 * 'unavailable'. Only one thing is spoken at a time; a new speak() cancels
 * the one before.
 */
export function createSpeaker({ synth = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance, timers = globalThis, now = () => Date.now() } = {}) {
  let unlocked = false;
  let voice = null;
  let finishCurrent = null;
  // Debug (?debug=1): ignore "end", "error" and the 200 ms check, to prove the safety timeout works (T5.3).
  let simulateStuck = false;
  let lastEnd = '';

  const speaker = {
    get available() {
      return Boolean(synth && Utterance);
    },
    get voice() {
      return voice;
    },
    get lastEnd() {
      return lastEnd;
    },
    get simulateStuck() {
      return simulateStuck;
    },
    set simulateStuck(on) {
      simulateStuck = Boolean(on);
    },

    /** Called from Tap to Start: before it, nothing is ever spoken (T5.1). */
    unlock() {
      unlocked = true;
    },

    setVoice(chosen) {
      voice = chosen ?? null;
    },

    speak(text, { rate = SPEECH_RATE } = {}) {
      speaker.cancel();
      if (!unlocked || !speaker.available || !String(text).trim()) return Promise.resolve('unavailable');
      // Clears anything stuck in the queue (the iPad sometimes keeps old speech).
      synth.cancel();
      return new Promise((resolve) => {
        const utterance = new Utterance(String(text));
        utterance.rate = rate;
        utterance.lang = voice?.lang ?? 'en-US';
        if (voice) utterance.voice = voice;
        // Keep a reference until it finishes: otherwise the browser can
        // clean the utterance up early and its events never fire.
        globalThis.currentUtterance = utterance;
        const startedAt = now();
        let sawSpeaking = false;
        let poll = 0;
        let timeout = 0;

        const finish = (reason) => {
          if (finishCurrent !== finish) return;
          finishCurrent = null;
          timers.clearInterval(poll);
          timers.clearTimeout(timeout);
          if (globalThis.currentUtterance === utterance) globalThis.currentUtterance = null;
          lastEnd = reason;
          resolve(reason);
        };
        finishCurrent = finish;

        utterance.onend = () => {
          if (!simulateStuck) finish('end');
        };
        utterance.onerror = () => {
          if (!simulateStuck) finish('error');
        };
        poll = timers.setInterval(() => {
          if (synth.speaking || synth.pending) {
            sawSpeaking = true;
            return;
          }
          if (!simulateStuck && (sawSpeaking || now() - startedAt >= START_GRACE_MS)) finish('poll');
        }, POLL_MS);
        timeout = timers.setTimeout(() => {
          synth.cancel();
          finish('timeout');
        }, estimateSpeechMs(text, rate));

        synth.speak(utterance);
      });
    },

    /** Stops speaking now. A speak() waiting to finish resolves with 'cancel'. */
    cancel() {
      if (!finishCurrent) return;
      const finish = finishCurrent;
      try {
        synth.cancel();
      } catch {
        // Nothing to cancel.
      }
      finish('cancel');
    },
  };
  return speaker;
}
