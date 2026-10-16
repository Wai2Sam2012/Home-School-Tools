// Sound and speech. The iPad only plays sound or speech after the player has
// touched the screen, so Tap to Start calls unlockAudio(). Stage 5 adds the
// sound effects and reading questions aloud.

let context = null;

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
      if (context.state === 'suspended') context.resume().catch(() => {});
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
