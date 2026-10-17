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
  finish: { wave: 'sine', notes: [[523, 0, 0.16], [659, 0.15, 0.16], [784, 0.3, 0.16], [1047, 0.45, 0.2], [784, 0.62, 0.14], [1047, 0.76, 0.6]] },
});
export const VOLUME = 0.25;

/** Sounds built from noise and growling tones: the Dino roar and the truck engine (played at flags). */
export const SYNTHS = Object.freeze({ roar: playRoar, engine: playEngine });
export const SYNTH_LENGTHS = Object.freeze({ roar: 1.5, engine: 1.8 });

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

/** A second of white noise, for the roar's breath and the engine's rumble. */
function noise(ctx, seconds) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  return source;
}

/** Shapes a sound's loudness: up quickly, held, then fading out. */
function envelope(ctx, t0, { attack, hold, release, level }) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(level, t0 + attack);
  gain.gain.setValueAtTime(level, t0 + attack + hold);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
  gain.connect(ctx.destination);
  return gain;
}

/** Dinosaur roar: a low growl that rises then falls, with a rough throat flutter and breath. */
function playRoar(ctx, t0) {
  const length = SYNTH_LENGTHS.roar;
  const out = envelope(ctx, t0, { attack: 0.12, hold: 0.55, release: 0.8, level: VOLUME * 1.6 });
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.setValueAtTime(700, t0);
  lowpass.frequency.linearRampToValueAtTime(1100, t0 + 0.3);
  lowpass.frequency.exponentialRampToValueAtTime(350, t0 + length);
  lowpass.connect(out);

  // The growl: two slightly different saw waves, swept up then down.
  for (const detune of [0, 7]) {
    const growl = ctx.createOscillator();
    growl.type = 'sawtooth';
    growl.detune.value = detune * 100;
    growl.frequency.setValueAtTime(95, t0);
    growl.frequency.linearRampToValueAtTime(150, t0 + 0.3);
    growl.frequency.exponentialRampToValueAtTime(55, t0 + length);
    // Throat flutter: the loudness wobbles about 30 times a second.
    const flutter = ctx.createGain();
    flutter.gain.value = 0.6;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 31;
    const depth = ctx.createGain();
    depth.gain.value = 0.4;
    lfo.connect(depth).connect(flutter.gain);
    growl.connect(flutter).connect(lowpass);
    growl.start(t0);
    lfo.start(t0);
    growl.stop(t0 + length);
    lfo.stop(t0 + length);
  }

  // Breath: filtered noise.
  const breath = noise(ctx, length);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.setValueAtTime(500, t0);
  band.frequency.exponentialRampToValueAtTime(250, t0 + length);
  band.Q.value = 0.7;
  const breathLevel = ctx.createGain();
  breathLevel.gain.value = 0.9;
  breath.connect(band).connect(breathLevel).connect(lowpass);
  breath.start(t0);
  breath.stop(t0 + length);
}

/** Truck engine revving: idle, a rev up, a short hold, then back down to idle. */
function playEngine(ctx, t0) {
  const length = SYNTH_LENGTHS.engine;
  const out = envelope(ctx, t0, { attack: 0.08, hold: 1.2, release: 0.5, level: VOLUME * 1.4 });
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.setValueAtTime(500, t0);
  lowpass.frequency.linearRampToValueAtTime(1400, t0 + 0.7);
  lowpass.frequency.linearRampToValueAtTime(600, t0 + length);

  // Engine speed: idle 40 Hz, rev to 120 Hz, settle back.
  const rpm = (param, scale) => {
    param.setValueAtTime(40 * scale, t0);
    param.linearRampToValueAtTime(42 * scale, t0 + 0.2);
    param.exponentialRampToValueAtTime(120 * scale, t0 + 0.75);
    param.setValueAtTime(120 * scale, t0 + 1.0);
    param.exponentialRampToValueAtTime(45 * scale, t0 + length);
  };
  for (const [wave, scale, level] of [['sawtooth', 1, 0.7], ['square', 2, 0.25]]) {
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
