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
/** The speeds a grown-up can choose in Settings. */
export const SPEECH_RATES = Object.freeze({ slower: 0.8, normal: 0.95 });

/** The safety timeout: words ÷ 2.5 per second ÷ rate, × 1.5, between 2 and 10 seconds. */
export function estimateSpeechMs(text, rate = SPEECH_RATE) {
  const words = String(text).trim().split(/\s+/).filter(Boolean).length;
  const ms = (words / WORDS_PER_SECOND / rate) * 1000 * 1.5;
  return Math.round(Math.min(MAX_WAIT_MS, Math.max(MIN_WAIT_MS, ms)));
}

// Apple devices list "fun" voices (Zarvox, Bubbles, ...) and older robotic
// ones (Eddy, Flo, ...) among the English voices. They are never chosen
// automatically, but a grown-up can pick one in Settings.
export const FUN_VOICES = Object.freeze([
  'Albert', 'Bad News', 'Bahh', 'Bells', 'Boing', 'Bubbles', 'Cellos', 'Deranged', 'Good News', 'Hysterical', 'Jester',
  'Organ', 'Pipe Organ', 'Superstar', 'Trinoids', 'Whisper', 'Wobble', 'Zarvox', 'Fred', 'Junior', 'Kathy', 'Ralph',
  'Princess', 'Eddy', 'Flo', 'Grandma', 'Grandpa', 'Reed', 'Rocko', 'Sandy', 'Shelley',
]);
// Voices known to sound natural, after any marked Enhanced or Premium.
const NATURAL_VOICES = ['Ava', 'Samantha', 'Allison', 'Susan', 'Zoe', 'Evan', 'Nathan', 'Tom', 'Joelle', 'Noelle', 'Nicky', 'Aaron',
  'Karen', 'Daniel', 'Kate', 'Serena', 'Moira', 'Tessa', 'Fiona', 'Lee', 'Google US English', 'Google UK English Female',
  'Microsoft Aria', 'Microsoft Jenny', 'Microsoft Guy', 'Microsoft Zira', 'Microsoft David'];

const isEnglish = (v) => /^en([-_]|$)/i.test(v?.lang ?? '');
const baseName = (v) => String(v.name ?? '').replace(/\s*\(.*\)\s*$/, '').trim();

/** True for the novelty and older robotic voices. */
export function isFunVoice(voice) {
  return FUN_VOICES.includes(baseName(voice)) || /eloquence|novelty/i.test(voice.voiceURI ?? '');
}

/** 0 = Premium, 1 = Enhanced or natural sounding (Neural/Natural/known name), 2 = standard, 3 = fun or robotic. */
export function voiceQuality(voice) {
  if (isFunVoice(voice)) return 3;
  const text = `${voice.name ?? ''} ${voice.voiceURI ?? ''}`;
  if (/premium/i.test(text)) return 0;
  if (/enhanced|neural|natural/i.test(text)) return 1;
  if (NATURAL_VOICES.some((n) => baseName(voice) === n || baseName(voice).startsWith(`${n} `))) return 1.5;
  return 2;
}

/** A stable id for a voice, to remember a grown-up's choice. */
export function voiceId(voice) {
  return voice ? String(voice.voiceURI || voice.name) : '';
}

/** English voices, best first: offline, then quality, then US English, then the device default. */
export function rankVoices(voices, preferredLang = 'en-US') {
  const rank = (v) => [
    v.localService ? 0 : 1,
    voiceQuality(v),
    v.lang.replace('_', '-').toLowerCase() === preferredLang.toLowerCase() ? 0 : 1,
    v.default ? 0 : 1,
  ];
  return (voices ?? []).filter(isEnglish).sort((a, b) => {
    const [ra, rb] = [rank(a), rank(b)];
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
    return String(a.name).localeCompare(String(b.name));
  });
}

/**
 * Picks the voice to use. A voice the grown-up chose (by id) wins if the
 * device still has it. Otherwise the best English voice that is not a fun
 * or robotic one: offline first, then Premium, Enhanced, natural names;
 * then US English and the device default. Null when there is no English voice.
 */
export function chooseVoice(voices, { preferredLang = 'en-US', chosenId = '' } = {}) {
  const english = (voices ?? []).filter(isEnglish);
  if (chosenId) {
    const chosen = english.find((v) => voiceId(v) === chosenId);
    if (chosen) return chosen;
  }
  const ranked = rankVoices(english, preferredLang);
  // Only if a device has nothing but fun voices is one of them used.
  return ranked.find((v) => !isFunVoice(v)) ?? ranked[0] ?? null;
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
  let speed = SPEECH_RATE;
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

    get rate() {
      return speed;
    },
    set rate(value) {
      speed = Number(value) > 0 ? Number(value) : SPEECH_RATE;
    },

    /** Options (for the voice tester): rate, pitch, and a voice to use just this once. */
    speak(text, { rate = speed, pitch = 1, voice: once = null } = {}) {
      speaker.cancel();
      if (!unlocked || !speaker.available || !String(text).trim()) return Promise.resolve('unavailable');
      // Clears anything stuck in the queue (the iPad sometimes keeps old speech).
      synth.cancel();
      return new Promise((resolve) => {
        const utterance = new Utterance(String(text));
        const use = once ?? voice;
        utterance.rate = rate;
        utterance.pitch = pitch;
        utterance.lang = use?.lang ?? 'en-US';
        if (use) utterance.voice = use;
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
