// Sound effects, made with the Web Audio API (no sound files). The iPad only
// plays sound after the player has touched the screen, so Tap to Start calls
// unlockAudio(); before that, playSound() does nothing (T5.1).

let context = null;

/**
 * Notes for each sound: [frequency in Hz, start in seconds, length in seconds,
 * loudness (1 = normal)]. The roar and the engine are made differently; see SYNTHS.
 */
export const SOUNDS = Object.freeze({
  // A bell "ding": a high note with two quieter overtones that fade slowly.
  right: { wave: 'sine', notes: [[1319, 0, 1.1, 1], [3640, 0, 0.6, 0.22], [7120, 0, 0.25, 0.06]] },
  wrong: { wave: 'triangle', notes: [[330, 0, 0.2], [262, 0.17, 0.35]] },
  detour: { wave: 'triangle', notes: [[392, 0, 0.16], [349, 0.16, 0.16], [392, 0.32, 0.3]] },
  cleared: { wave: 'sine', notes: [[523, 0, 0.12], [659, 0.1, 0.12], [784, 0.2, 0.3]] },
  setback: { wave: 'triangle', notes: [[392, 0, 0.22], [330, 0.2, 0.22], [262, 0.4, 0.4]] },
  milestone: { wave: 'sine', notes: [[523, 0, 0.14], [659, 0.12, 0.14], [784, 0.24, 0.14], [1047, 0.36, 0.45]] },
  // Right answers in a row (5, 10, ...): a quick sparkle up.
  streak: { wave: 'sine', notes: [[587, 0, 0.1], [740, 0.08, 0.1], [880, 0.16, 0.1], [1175, 0.24, 0.4]] },
  finish: { wave: 'sine', notes: [[523, 0, 0.16], [659, 0.15, 0.16], [784, 0.3, 0.16], [1047, 0.45, 0.2], [784, 0.62, 0.14], [1047, 0.76, 0.6]] },
});
export const VOLUME = 0.25;

/** Sounds built from noise and growling tones: the Dino roar and the truck engine (played at flags). */
export const SYNTHS = Object.freeze({ roar: playRoar, engine: playEngine });
export const SYNTH_LENGTHS = Object.freeze({ roar: 2.6, engine: 1.8 });

/** How long a sound lasts, in milliseconds (0 for an unknown sound), so speech can wait for it. */
export function soundLength(name) {
  if (SYNTH_LENGTHS[name]) return Math.round(SYNTH_LENGTHS[name] * 1000);
  const notes = SOUNDS[name]?.notes ?? [];
  return Math.round(Math.max(0, ...notes.map(([, start, length]) => start + length)) * 1000);
}

/**
 * Unlocks sound and speech. Must run inside a tap or click handler.
 * Never throws: a device without sound or speech still plays (text only).
 * Returns { sound, speech } saying what is available.
 */
export function unlockAudio() {
  let sound = false;
  let speech = false;
  try {
    const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (AudioContextClass) {
      context ??= new AudioContextClass();
      if (context.state !== 'running') context.resume().catch(() => {});
      // Playing a very short silent sound is what actually unlocks iPad audio.
      const source = context.createBufferSource();
      source.buffer = context.createBuffer(1, 1, 22050);
      source.connect(context.destination);
      source.start(0);
      sound = true;
    }
  } catch {
    sound = false;
  }
  try {
    if ('speechSynthesis' in globalThis && 'SpeechSynthesisUtterance' in globalThis) {
      // A silent utterance inside the tap unlocks speech for later.
      const hello = new SpeechSynthesisUtterance('Hello!');
      hello.volume = 0;
      speechSynthesis.cancel();
      speechSynthesis.speak(hello);
      speechSynthesis.getVoices(); // starts loading the voice list, which can arrive late
      speech = true;
    }
  } catch {
    speech = false;
  }
  return { sound, speech };
}

/** True when sound was unlocked but the iPad has suspended it (for example after the game was in the background). */
export function audioSuspended() {
  return context !== null && context.state !== 'running';
}

/** Plays one of SOUNDS. Returns false (and plays nothing) before Tap to Start or while suspended. */
export function playSound(name) {
  const sound = SOUNDS[name];
  if ((!sound && !SYNTHS[name]) || !context || context.state !== 'running') return false;
  try {
    const t0 = context.currentTime + 0.02;
    if (SYNTHS[name]) {
      SYNTHS[name](context, t0);
      return true;
    }
    for (const [frequency, start, length, loudness = 1] of sound.notes) {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = sound.wave;
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, t0 + start);
      gain.gain.exponentialRampToValueAtTime(VOLUME * loudness, t0 + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + length);
      osc.connect(gain).connect(context.destination);
      osc.start(t0 + start);
      osc.stop(t0 + start + length + 0.05);
    }
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- recorded sounds

// The voice waits at most this long for a recording (a long file doesn't hold up the game).
export const RECORDING_WAIT_MAX_MS = 5000;
// Recordings are evened out to this peak, about as loud as the voice.
const RECORDING_PEAK = 0.9;
const recordings = new Map(); // url -> Promise<{ buffer, gain } | null>

/**
 * Loads and decodes a recorded sound (after Tap to Start). Resolves
 * { buffer, gain } or null if it can't be played; never rejects.
 */
export function loadRecording(url, fetchFile = globalThis.fetch) {
  if (!context) return Promise.resolve(null);
  if (!recordings.has(url)) {
    const loading = (async () => {
      try {
        const response = await fetchFile(url);
        if (!response.ok) return null;
        const data = await response.arrayBuffer();
        // Older Safari only has the callback form of decodeAudioData.
        const buffer = await new Promise((resolve, reject) => {
          const result = context.decodeAudioData(data, resolve, reject);
          if (result?.then) result.then(resolve, reject);
        });
        let peak = 0;
        for (let c = 0; c < buffer.numberOfChannels; c++) {
          const samples = buffer.getChannelData(c);
          for (let i = 0; i < samples.length; i += 4) peak = Math.max(peak, Math.abs(samples[i]));
        }
        return { buffer, gain: peak > 0.01 ? Math.min(4, RECORDING_PEAK / peak) : 1 };
      } catch {
        return null;
      }
    })();
    recordings.set(url, loading);
  }
  return recordings.get(url);
}

/**
 * Picks one of count sounds at random, never the same as last time (when
 * there is more than one). Returns its index, or -1 if there are none.
 */
export function pickDifferent(count, last = -1, random = Math.random) {
  if (count <= 0) return -1;
  if (count === 1) return 0;
  // The first time, any of them; after that, one of the others.
  if (!(last >= 0 && last < count)) return Math.floor(random() * count);
  const i = Math.floor(random() * (count - 1));
  return i >= last ? i + 1 : i;
}

/**
 * Plays a loaded recording. Returns how long the voice should wait for it in
 * milliseconds (0 if it couldn't play).
 */
export function playRecording(recording) {
  if (!recording || !context || context.state !== 'running') return 0;
  try {
    const source = context.createBufferSource();
    source.buffer = recording.buffer;
    const level = context.createGain();
    level.gain.value = recording.gain;
    source.connect(level).connect(context.destination);
    source.start(context.currentTime + 0.02);
    return Math.min(RECORDING_WAIT_MAX_MS, Math.round(recording.buffer.duration * 1000));
  } catch {
    return 0;
  }
}

/** A second of white noise, for the roar's breath and the engine's rumble. */
function noise(ctx, seconds) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  return source;
}

/** How much the flag sounds are turned up after their peaks are evened out. */
export const FLAG_BOOST = 3.2;

/**
 * The flag sounds play through a compressor, which evens out their peaks,
 * then are turned up (FLAG_BOOST) to about as loud as the voice; a limiter
 * at the end stops them crackling.
 */
function loudOutput(ctx) {
  const squeeze = ctx.createDynamicsCompressor();
  squeeze.threshold.value = -24;
  squeeze.knee.value = 6;
  squeeze.ratio.value = 10;
  squeeze.attack.value = 0.001;
  squeeze.release.value = 0.2;
  const boost = ctx.createGain();
  boost.gain.value = FLAG_BOOST;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.1;
  squeeze.connect(boost).connect(limiter).connect(ctx.destination);
  return squeeze;
}

/** Shapes a sound's loudness: up quickly, held, then fading out. */
function envelope(ctx, t0, { attack, hold, release, level, to = ctx.destination }) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(level, t0 + attack);
  gain.gain.setValueAtTime(level, t0 + attack + hold);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
  gain.connect(to);
  return gain;
}

/**
 * T. rex roar, in the style of the big movie roars: a high trumpeting scream
 * that bends up and down, then a deep raspy growl that rumbles away. Made from
 * scratch (no recording). iPad speakers hardly play deep sounds, so even the
 * growl keeps a bright, rough edge; it is about as loud as the voice.
 */
function playRoar(ctx, t0) {
  const length = SYNTH_LENGTHS.roar;
  const out = loudOutput(ctx);
  const end = t0 + length;

  // A fast wobble (about 28 times a second) gives both parts their rasp.
  const rasp = ctx.createOscillator();
  rasp.frequency.setValueAtTime(34, t0);
  rasp.frequency.linearRampToValueAtTime(24, end);
  rasp.start(t0);
  rasp.stop(end);
  const raspy = (amount) => {
    const gain = ctx.createGain();
    gain.gain.value = 1 - amount;
    const depth = ctx.createGain();
    depth.gain.value = amount;
    rasp.connect(depth).connect(gain.gain);
    return gain;
  };

  // 1. The scream (0 to 1.1 s): sharp saw waves bent up then down, with a
  //    shaky vibrato, shaped by two "throat" filters like a trumpeting call.
  const scream = envelope(ctx, t0, { attack: 0.06, hold: 0.45, release: 0.6, level: VOLUME * 3.2, to: out });
  const screamRasp = raspy(0.35);
  for (const [freq, filterQ] of [[1150, 3], [2400, 4]]) {
    const throat = ctx.createBiquadFilter();
    throat.type = 'bandpass';
    throat.frequency.value = freq;
    throat.Q.value = filterQ;
    screamRasp.connect(throat).connect(scream);
  }
  const vibrato = ctx.createOscillator();
  vibrato.frequency.value = 7;
  const vibratoDepth = ctx.createGain();
  vibratoDepth.gain.value = 14;
  vibrato.connect(vibratoDepth);
  for (const detune of [-12, 12]) {
    const voice = ctx.createOscillator();
    voice.type = 'sawtooth';
    voice.detune.value = detune;
    voice.frequency.setValueAtTime(360, t0);
    voice.frequency.exponentialRampToValueAtTime(580, t0 + 0.22);
    voice.frequency.exponentialRampToValueAtTime(470, t0 + 0.65);
    voice.frequency.exponentialRampToValueAtTime(260, t0 + 1.1);
    vibratoDepth.connect(voice.frequency);
    voice.connect(screamRasp);
    voice.start(t0);
    voice.stop(t0 + 1.15);
  }
  vibrato.start(t0);
  vibrato.stop(t0 + 1.15);
  const hiss = noise(ctx, 1.15);
  const hissBand = ctx.createBiquadFilter();
  hissBand.type = 'bandpass';
  hissBand.frequency.value = 1900;
  hissBand.Q.value = 1;
  const hissLevel = ctx.createGain();
  hissLevel.gain.value = 0.35;
  hiss.connect(hissBand).connect(hissLevel).connect(scream);
  hiss.start(t0);
  hiss.stop(t0 + 1.15);

  // 2. The growl (0.5 s to the end): low saw waves sliding down, an octave
  //    above them so small speakers can play it, and a rough breath.
  const g0 = t0 + 0.5;
  const growl = envelope(ctx, g0, { attack: 0.25, hold: 0.8, release: length - 1.55, level: VOLUME * 4, to: out });
  const growlFilter = ctx.createBiquadFilter();
  growlFilter.type = 'lowpass';
  growlFilter.frequency.setValueAtTime(2200, g0);
  growlFilter.frequency.exponentialRampToValueAtTime(700, end);
  const growlRasp = raspy(0.6);
  growlRasp.connect(growlFilter).connect(growl);
  for (const [scale, level] of [[1, 0.55], [2, 0.45], [1.5, 0.25]]) {
    const voice = ctx.createOscillator();
    voice.type = 'sawtooth';
    voice.frequency.setValueAtTime(150 * scale, g0);
    voice.frequency.exponentialRampToValueAtTime(115 * scale, g0 + 0.8);
    voice.frequency.exponentialRampToValueAtTime(60 * scale, end);
    const gain = ctx.createGain();
    gain.gain.value = level;
    voice.connect(gain).connect(growlRasp);
    voice.start(g0);
    voice.stop(end);
  }
  const breath = noise(ctx, length - 0.5);
  const breathBand = ctx.createBiquadFilter();
  breathBand.type = 'bandpass';
  breathBand.frequency.setValueAtTime(900, g0);
  breathBand.frequency.exponentialRampToValueAtTime(380, end);
  breathBand.Q.value = 0.8;
  const breathLevel = ctx.createGain();
  breathLevel.gain.value = 0.8;
  breath.connect(breathBand).connect(breathLevel).connect(growlRasp);
  breath.start(g0);
  breath.stop(end);
}

/**
 * Truck engine revving: idle, a rev up, a short hold, then back down to idle.
 * Like the roar, it is kept bright enough for iPad speakers and about as loud
 * as the voice.
 */
function playEngine(ctx, t0) {
  const length = SYNTH_LENGTHS.engine;
  const out = envelope(ctx, t0, { attack: 0.08, hold: 1.2, release: 0.5, level: VOLUME * 3.5, to: loudOutput(ctx) });
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.setValueAtTime(1000, t0);
  lowpass.frequency.linearRampToValueAtTime(2600, t0 + 0.7);
  lowpass.frequency.linearRampToValueAtTime(1100, t0 + length);

  // Engine speed: idle 40 Hz, rev to 120 Hz, settle back.
  const rpm = (param, scale) => {
    param.setValueAtTime(40 * scale, t0);
    param.linearRampToValueAtTime(42 * scale, t0 + 0.2);
    param.exponentialRampToValueAtTime(120 * scale, t0 + 0.75);
    param.setValueAtTime(120 * scale, t0 + 1.0);
    param.exponentialRampToValueAtTime(45 * scale, t0 + length);
  };
  for (const [wave, scale, level] of [['sawtooth', 1, 0.6], ['square', 2, 0.3], ['sawtooth', 4, 0.25]]) {
    const osc = ctx.createOscillator();
    osc.type = wave;
    rpm(osc.frequency, scale);
    const gain = ctx.createGain();
    gain.gain.value = level;
    osc.connect(gain).connect(lowpass);
    osc.start(t0);
    osc.stop(t0 + length);
  }
  // Cylinder pulses: the loudness throbs in time with the engine.
  const pulse = ctx.createOscillator();
  rpm(pulse.frequency, 0.5);
  const pulseDepth = ctx.createGain();
  pulseDepth.gain.value = 0.35;
  const throb = ctx.createGain();
  throb.gain.value = 0.65;
  pulse.connect(pulseDepth).connect(throb.gain);
  lowpass.connect(throb).connect(out);
  pulse.start(t0);
  pulse.stop(t0 + length);

  // Exhaust rumble: low noise.
  const rumble = noise(ctx, length);
  const low = ctx.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = 180;
  const rumbleLevel = ctx.createGain();
  rumbleLevel.gain.value = 0.5;
  rumble.connect(low).connect(rumbleLevel).connect(out);
  rumble.start(t0);
  rumble.stop(t0 + length);
}
