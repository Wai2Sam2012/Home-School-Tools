// Sound effects, made with the Web Audio API (no sound files). The iPad only
// plays sound after the player has touched the screen, so Tap to Start calls
// unlockAudio(); before that, playSound() does nothing (T5.1).

let context = null;

/** Notes for each sound: [frequency in Hz, start in seconds, length in seconds]. */
export const SOUNDS = Object.freeze({
  right: { wave: 'sine', notes: [[784, 0, 0.14], [1047, 0.11, 0.3]] },
  wrong: { wave: 'triangle', notes: [[330, 0, 0.2], [262, 0.17, 0.35]] },
  detour: { wave: 'triangle', notes: [[392, 0, 0.16], [349, 0.16, 0.16], [392, 0.32, 0.3]] },
  cleared: { wave: 'sine', notes: [[523, 0, 0.12], [659, 0.1, 0.12], [784, 0.2, 0.3]] },
  setback: { wave: 'triangle', notes: [[392, 0, 0.22], [330, 0.2, 0.22], [262, 0.4, 0.4]] },
  milestone: { wave: 'sine', notes: [[523, 0, 0.14], [659, 0.12, 0.14], [784, 0.24, 0.14], [1047, 0.36, 0.45]] },
  finish: { wave: 'sine', notes: [[523, 0, 0.16], [659, 0.15, 0.16], [784, 0.3, 0.16], [1047, 0.45, 0.2], [784, 0.62, 0.14], [1047, 0.76, 0.6]] },
});
export const VOLUME = 0.25;

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
  if (!sound || !context || context.state !== 'running') return false;
  try {
    const t0 = context.currentTime + 0.02;
    for (const [frequency, start, length] of sound.notes) {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = sound.wave;
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, t0 + start);
      gain.gain.exponentialRampToValueAtTime(VOLUME, t0 + start + 0.02);
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
