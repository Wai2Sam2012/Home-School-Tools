// Stage 0 placeholder: shows the version, checks that the math engine loads
// in this browser, and opens the debug panel when the address has ?debug=1.
// Stage 3 replaces this with the real screens.

import { APP_VERSION, BUILD_STAGE } from './version.js';
import { OPERATIONS, createProblemGenerator } from './math.js';
import { isDebugOn, showDebugPanel } from './debug.js';

document.getElementById('version').textContent = `Version ${APP_VERSION} · Stage ${BUILD_STAGE} complete`;

const check = document.getElementById('engine-check');
try {
  const problem = createProblemGenerator({ operations: [...OPERATIONS], difficulty: 'beginner' }).next();
  check.textContent = `Math engine ready: ${problem.text} = ${problem.answer}`;
  check.classList.add('ok');
} catch (error) {
  check.textContent = `Math engine problem: ${error.message}`;
  check.classList.add('error');
}

if (isDebugOn()) showDebugPanel(APP_VERSION);

// Tells the loading check in index.html that the scripts ran.
document.documentElement.dataset.ready = '1';
