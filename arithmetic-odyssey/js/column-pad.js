// Note pads for Help: the working of a problem laid out on paper, with empty
// boxes to write in. The player taps a box, then a number key; the digit goes
// in the box instead of the answer, and the next box is chosen (to the left,
// as column sums are written; to the right in a division's answer). Tapping
// the chosen box again lets the keys answer the question as usual, and
// "Submit this answer" sends what is written in the answer boxes.
//
// Two layouts, each first worked out as plain data (so it can be tested) and
// then built from page elements (never text turned into HTML):
//
//   × with a 2-digit number: the column method (0.7.6)
//
//    carry  [ ]          carries (above the top number's tens)
//          4  7
//      ×   3  8
//      --------
//       [ ][ ][ ]        47 × 8
//     [ ][ ][ ][ ]       47 × 30 (the ones box is for its 0)
//    + --------
//     [ ][ ][ ][ ]       the answer
//
//   ÷ with a 2-digit divisor or answer: long division (0.7.8)
//
//          [ ][ ][ ]     the answer, over the number being divided
//     12 ) 1  5  6
//      − [ ][ ]          12 × 1
//        ------
//        [ ][ ][ ]       what is left, with the next digit brought down
//      − [ ][ ][ ]       12 × 3
//        --------
//        [ ][ ][ ]       what is left at the end (0 when it divides exactly)

import { h } from './ui.js?v=0.7.8';

const digitsOf = (n) => String(n).split('').map(Number);
const BOX = 'var(--pad-box)';
const LINE = '6px';

/**
 * The answer written in the answer boxes, read left to right (0.7.7). Returns
 * { ok: true, value } or { ok: false, reason }: 'empty' when nothing is
 * written, 'gap' when an empty box sits between digits.
 */
export function answerFrom(values) {
  const first = values.findIndex((v) => v !== '');
  if (first === -1) return { ok: false, reason: 'empty' };
  const last = values.length - 1 - [...values].reverse().findIndex((v) => v !== '');
  const used = values.slice(first, last + 1);
  if (used.includes('')) return { ok: false, reason: 'gap' };
  return { ok: true, value: String(Number(used.join(''))) };
}

// ---------------------------------------------------------------- multiplication

/**
 * The column layout for a × b: the bigger number on top. Returns
 * { width, top, bottom, rows } where width is the number of columns (enough
 * for the answer), top and bottom are the numbers' digits, and rows lists the
 * boxes to write in, top to bottom: { kind, from, to } boxes in columns
 * from..to (kind 'carry', 'partial' or 'answer').
 */
export function columnLayout(a, b) {
  if (![a, b].every((n) => Number.isInteger(n) && n > 0 && n <= 99)) throw new Error(`No column layout for ${a} × ${b}.`);
  const [top, bottom] = a >= b ? [a, b] : [b, a];
  const topDigits = digitsOf(top);
  const bottomDigits = digitsOf(bottom);
  const width = topDigits.length + bottomDigits.length;
  const rows = [];
  // Carries: one box over each of the top number's digits except its ones.
  if (topDigits.length > 1) rows.push({ kind: 'carry', from: width - topDigits.length, to: width - 2 });
  // One row for each digit of the bottom number (the tens row includes the
  // ones box for its 0), then the answer when there is more than one row.
  bottomDigits.forEach((_, i) => rows.push({ kind: 'partial', from: Math.max(0, width - topDigits.length - 1 - i), to: width - 1 }));
  if (bottomDigits.length > 1) rows.push({ kind: 'answer', from: 0, to: width - 1 });
  else rows.at(-1).kind = 'answer';
  return { width, top: topDigits, bottom: bottomDigits, rows };
}

/** The pad plan for a × b: grid rows, fixed marks and boxes (see buildPad()). */
function multiplicationPlan(a, b) {
  const layout = columnLayout(a, b);
  const col = (c) => c + 2; // grid column of layout column c (column 1 holds the signs)
  const heights = [];
  const marks = [];
  const boxes = [];
  const line = (height) => heights.push(height);
  const rowsOf = (kind) => layout.rows.filter((r) => r.kind === kind);
  const addBoxes = (r, at) => {
    for (let c = r.from; c <= r.to; c++) boxes.push({ line: at, column: col(c), kind: r.kind, flow: 'left' });
  };
  const carry = rowsOf('carry')[0];
  if (carry) {
    line(`calc(${BOX} * 0.7)`);
    marks.push({ line: heights.length, column: 1, cls: 'pad-note', text: 'carry' });
    addBoxes(carry, heights.length);
  }
  line(BOX);
  layout.top.forEach((d, i) => marks.push({ line: heights.length, column: col(layout.width - layout.top.length + i), cls: 'pad-digit', text: String(d) }));
  line(BOX);
  layout.bottom.forEach((d, i) => marks.push({ line: heights.length, column: col(layout.width - layout.bottom.length + i), cls: 'pad-digit', text: String(d) }));
  marks.push({ line: heights.length, column: 1, cls: 'pad-sign', text: '×' });
  line(LINE);
  marks.push({ line: heights.length, column: 1, span: layout.width + 1, cls: 'pad-line' });
  const working = layout.rows.filter((r) => r.kind !== 'carry');
  working.forEach((r, i) => {
    if (r.kind === 'answer' && working.length > 1) {
      line(LINE);
      marks.push({ line: heights.length, column: 1, span: layout.width + 1, cls: 'pad-line' });
    }
    line(BOX);
    addBoxes(r, heights.length);
    // The + goes beside the last row of working, just above the answer's line.
    if (working.length > 1 && i === working.length - 2) marks.push({ line: heights.length, column: 1, cls: 'pad-sign', text: '+' });
  });
  return { columns: layout.width + 1, heights, marks, boxes, label: `${a} times ${b} in columns, with boxes to write in` };
}

// ---------------------------------------------------------------- division

/**
 * The long division layout for a ÷ b (0.7.8). Returns { width, divisor,
 * dividend, steps, rows }: width is the number of the dividend's digits
 * (columns), steps the number of answer digits (one step each), and rows the
 * boxes to write in, top to bottom: { kind, from, to } in columns from..to,
 * kind 'answer' (over the dividend), then for each step 'product' (the
 * divisor times the answer digit) and 'difference' (what is left, with the
 * next digit brought down; the last one is what is left at the end).
 */
export function divisionLayout(a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a <= 0 || b <= 0 || a > 999 || b > 99 || a % b !== 0) throw new Error(`No long division layout for ${a} ÷ ${b}.`);
  const dividend = digitsOf(a);
  const width = dividend.length;
  const steps = String(a / b).length;
  const rows = [{ kind: 'answer', from: 0, to: width - 1 }];
  for (let k = 0; k < steps; k++) {
    // The answer digit of this step sits over this column.
    const at = width - steps + k;
    rows.push({ kind: 'product', from: 0, to: at });
    rows.push({ kind: 'difference', from: 0, to: Math.min(at + 1, width - 1) });
  }
  return { width, divisor: digitsOf(b), dividend, steps, rows };
}

/** The pad plan for a ÷ b (see buildPad()). */
function divisionPlan(a, b) {
  const layout = divisionLayout(a, b);
  const col = (c) => c + 2; // column 1 holds the divisor and the − signs
  const heights = [];
  const marks = [];
  const boxes = [];
  const line = (height) => heights.push(height);
  const addBoxes = (r, at, flow) => {
    for (let c = r.from; c <= r.to; c++) boxes.push({ line: at, column: col(c), kind: r.kind, flow });
  };
  // The answer is written left to right, one digit for each step.
  line(BOX);
  addBoxes(layout.rows[0], heights.length, 'right');
  line(BOX);
  marks.push({ line: heights.length, column: 1, cls: 'pad-divisor', text: `${layout.divisor.join('')})` });
  // One unbroken line over the number being divided.
  marks.push({ line: heights.length, column: col(0), span: layout.width, cls: 'pad-bracket' });
  layout.dividend.forEach((d, i) => marks.push({ line: heights.length, column: col(i), cls: 'pad-digit pad-dividend', text: String(d) }));
  for (let k = 0; k < layout.steps; k++) {
    const product = layout.rows[1 + 2 * k];
    const difference = layout.rows[2 + 2 * k];
    line(BOX);
    addBoxes(product, heights.length, 'left');
    marks.push({ line: heights.length, column: 1, cls: 'pad-sign', text: '−' });
    line(LINE);
    marks.push({ line: heights.length, column: col(0), span: product.to + 1, cls: 'pad-line' });
    line(BOX);
    addBoxes(difference, heights.length, 'left');
  }
  // The first column is as wide as the divisor and its bracket ("12)").
  return { columns: layout.width + 1, firstColumn: `minmax(${BOX}, auto)`, heights, marks, boxes, label: `${a} divided by ${b} by long division, with boxes to write in` };
}

// ---------------------------------------------------------------- the pad

const KIND_NAMES = { carry: 'Carry', partial: 'Working', product: 'Working', difference: 'Working', answer: 'Answer' };

/**
 * Builds a pad from its plan: { columns, heights (one per grid row), marks
 * (fixed digits, signs and lines), boxes ({ line, column, kind, flow }),
 * label }. Returns { el, press(key), selected(), answer(), clear() }.
 * press(key) takes a keypad key ('0'-'9' or 'back') and returns true when it
 * went into a box (a box is chosen), false when the keypad should answer the
 * question as usual.
 */
function buildPad({ columns, firstColumn = BOX, heights, marks, boxes, label }) {
  const cells = [];
  let chosen = null;
  const choose = (cell) => {
    if (chosen) chosen.el.setAttribute('aria-pressed', 'false');
    chosen = cell;
    if (chosen) chosen.el.setAttribute('aria-pressed', 'true');
  };
  const place = (lineNo, column, span = 1) => `grid-row: ${lineNo}; grid-column: ${column} / span ${span}`;
  const parts = marks.map((m) => h('span', { class: m.cls, style: place(m.line, m.column, m.span) }, m.text ?? ''));
  for (const b of boxes) {
    const cell = { ...b, value: '', el: null };
    cell.el = h('button', {
      type: 'button',
      class: `pad-box pad-${b.kind}`,
      'aria-pressed': 'false',
      'aria-label': `${KIND_NAMES[b.kind]} box, empty`,
      style: place(b.line, b.column),
      onclick: () => choose(chosen === cell ? null : cell),
    });
    cells.push(cell);
    parts.push(cell.el);
  }
  const el = h('div', {
    class: 'column-pad',
    role: 'group',
    'aria-label': label,
    style: `grid-template-columns: ${firstColumn} repeat(${columns - 1}, ${BOX}); grid-template-rows: ${heights.join(' ')}`,
  }, parts);

  const show = (cell) => {
    cell.el.textContent = cell.value;
    cell.el.setAttribute('aria-label', `${KIND_NAMES[cell.kind]} box, ${cell.value || 'empty'}`);
  };
  return {
    el,
    selected: () => chosen,
    /** The answer written in the answer boxes (see answerFrom()). */
    answer: () => answerFrom(cells.filter((c) => c.kind === 'answer').sort((x, y) => x.column - y.column).map((c) => c.value)),
    press(key) {
      if (!chosen) return false;
      if (key === 'back') {
        chosen.value = '';
        show(chosen);
        return true;
      }
      if (!/^[0-9]$/.test(key)) return false;
      chosen.value = key;
      show(chosen);
      // The next box in the same row: to the left, or to the right in a division's answer.
      const step = chosen.flow === 'right' ? 1 : -1;
      const next = cells.find((c) => c.line === chosen.line && c.column === chosen.column + step);
      if (next) choose(next);
      return true;
    },
    clear() {
      for (const cell of cells) {
        cell.value = '';
        show(cell);
      }
      choose(null);
    },
  };
}

/** The note pad for a × b (the column method). */
export function createColumnPad(a, b) {
  return buildPad(multiplicationPlan(a, b));
}

/** The note pad for a ÷ b (long division, 0.7.8). */
export function createDivisionPad(a, b) {
  return buildPad(divisionPlan(a, b));
}
