// Small helpers for building screens without a framework.

/**
 * Creates an element: h('button', { class: 'big', onclick: go }, 'Start').
 * Props starting with "on" become event listeners; "class" sets the class;
 * "dataset" sets data- attributes; false, null and undefined are skipped.
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (key.includes('-') || !(key in el)) el.setAttribute(key, value === true ? '' : String(value));
    else el[key] = value;
  }
  for (const child of children.flat(Infinity)) {
    if (child !== null && child !== undefined && child !== false) el.append(child);
  }
  return el;
}

/** A screen's top bar: a Back button (if back is given) and the title. */
export function topBar(title, back) {
  return h('header', { class: 'top-bar' },
    back ? h('button', { type: 'button', class: 'back-button', onclick: back }, h('span', { 'aria-hidden': 'true' }, '‹ '), 'Back') : h('span', { class: 'top-bar-spacer' }),
    h('h1', { tabIndex: -1 }, title),
    h('span', { class: 'top-bar-spacer' }),
  );
}

/** Asks a yes/no question in a large dialog. Resolves true for yes. */
export function confirmDialog({ title, message, yes = 'Yes', no = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    const finish = (answer) => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve(answer);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') finish(false);
    };
    const yesButton = h('button', { type: 'button', class: danger ? 'big-button danger' : 'big-button primary', onclick: () => finish(true) }, yes);
    const noButton = h('button', { type: 'button', class: 'big-button', onclick: () => finish(false) }, no);
    const overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'dialog' },
        h('h2', {}, title),
        message ? h('p', {}, message) : null,
        h('div', { class: 'dialog-buttons' },
          noButton,
          yesButton,
        ),
      ),
    );
    overlay.closeOverlay = () => finish(false);
    document.addEventListener('keydown', onKey);
    document.body.append(overlay);
    // For something that can't be undone, the safe answer has the focus.
    (danger ? noButton : yesButton).focus();
  });
}

/**
 * A row of large buttons where one is chosen (like radio buttons).
 * options: [{ value, label, detail? }]. onChange(value) runs on a new choice.
 */
export function choiceRow({ label, options, value, onChange, className = '' }) {
  const buttons = options.map((option) =>
    h('button', {
      type: 'button',
      class: 'choice',
      'aria-pressed': String(option.value === value),
      disabled: option.disabled,
      dataset: { value: String(option.value) },
      onclick: () => {
        if (option.value === value) return;
        value = option.value;
        for (const b of buttons) b.setAttribute('aria-pressed', String(b === buttons[options.indexOf(option)]));
        onChange(value);
      },
    },
    h('span', { class: 'choice-label' }, option.label),
    option.detail ? h('span', { class: 'choice-detail' }, option.detail) : null),
  );
  return h('div', { class: `choice-row ${className}`.trim(), role: 'group', 'aria-label': label }, buttons);
}

/** A short message that appears for a few seconds in a status line. */
export function flash(statusEl, message, ms = 2500) {
  statusEl.textContent = message;
  clearTimeout(statusEl._flashTimer);
  statusEl._flashTimer = setTimeout(() => {
    statusEl.textContent = '';
  }, ms);
}
