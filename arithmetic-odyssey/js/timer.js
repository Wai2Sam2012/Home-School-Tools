// The thinking timer (GAME-PLAN.md 1.9). It runs from the moment the
// question has been read aloud (or shown, in text-only mode) until Submit,
// and pauses while the game is in the background or Repeat is speaking.

/** Creates a timer. now() is only replaced in tests. */
export function createThinkingTimer(now = () => performance.now()) {
  let state = 'waiting'; // 'waiting' (not started), 'running' or 'paused'
  let startedAt = 0;
  let total = 0;

  const timer = {
    get state() {
      return state;
    },

    /** Starts timing a question. Does nothing if it has already started. */
    start() {
      if (state !== 'waiting') return;
      state = 'running';
      startedAt = now();
    },

    pause() {
      if (state !== 'running') return;
      total += now() - startedAt;
      state = 'paused';
    },

    resume() {
      if (state !== 'paused') return;
      startedAt = now();
      state = 'running';
    },

    /** Milliseconds counted so far for this question, without stopping. */
    elapsed() {
      return Math.max(0, Math.round(state === 'running' ? total + now() - startedAt : total));
    },

    /** Stops and returns the thinking time in whole milliseconds, ready for the next question. */
    stop() {
      const ms = timer.elapsed();
      state = 'waiting';
      total = 0;
      return ms;
    },
  };
  return timer;
}

/** 95000 -> "1:35", 4000 -> "0:04", 3725000 -> "1:02:05" */
export function formatDuration(ms) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
