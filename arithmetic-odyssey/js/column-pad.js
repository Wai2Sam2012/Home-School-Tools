// Help for multiplication with a 2-digit number (0.7.6): the column method,
// with empty boxes to write in, like a note pad. The player taps a box, then
// a number key; the digit goes in the box instead of the answer. After each
// digit the next box to the left is chosen, as column sums are written.
// Tapping the chosen box again lets the keys answer the question as usual.
//
//        [ ]          carries (above the top number's tens)
//       4  7
//   ×   3  8
//   --------
//    [ ][ ][ ]        47 × 8
//  [ ][ ][ ][ ]       47 × 30 (the ones box is for its 0)
//   --------
//  [ ][ ][ ][ ]       the answer
//
// columnLayout() is the plan as plain data, so it can be tested; the picture
// is built from it with page elements (not text turned into HTML).

import { h } from './ui.js?v=0.7.6';

const digitsOf = (n) => String(n).split('').map(Number);

/**
 * The column layout for a × b: the bigger number on top. Returns
 * { width, top, bottom, rows } where width is the number of columns (enough
 * for the answer), top and bottom are the numbers' digits, and rows lists the
 * boxes to write in, top to bottom: { kind, from } boxes in columns from..width-1
 * (kind 'carry', 'partial' or 'answer').
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

/**
 * The note pad for a × b. Returns { el, press(key), selected(), clear() }.
 * press(key) takes a keypad key ('0'-'9' or 'back') and returns true when it
 * went into a box (a box is chosen), false when the keypad should answer the
 * question as usual.
 */
export function createColumnPad(a, b) {
  const layout = columnLayout(a, b);
  const cells = []; // every box, by row then column
  let chosen = null;

  const choose = (cell) => {
    if (chosen) chosen.el.setAttribute('aria-pressed', 'false');
    chosen = cell;
    if (chosen) chosen.el.setAttribute('aria-pressed', 'true');
  };
  const box = (row, column) => {
    const cell = { row, column, value: '', el: null };
    cell.el = h('button', {
      type: 'button',
      class: `pad-box pad-${layout.rows[row].kind}`,
      'aria-pressed': 'false',
      'aria-label': `${layout.rows[row].kind === 'carry' ? 'Carry' : layout.rows[row].kind === 'answer' ? 'Answer' : 'Working'} box, empty`,
      style: `grid-row: ${rowLine(row)}; grid-column: ${column + 2}`,
      onclick: () => choose(chosen === cell ? null : cell),
    });
    cells.push(cell);
    return cell.el;
  };
  // Grid lines: carries first, then the two numbers and the line under them,
  // then the working rows (with a line before the answer).
  const hasCarry = layout.rows[0].kind === 'carry';
  const numbersAt = hasCarry ? 2 : 1;
  const rowLine = (row) => {
    const kind = layout.rows[row].kind;
    if (kind === 'carry') return 1;
    const partials = layout.rows.filter((r) => r.kind !== 'carry');
    const index = partials.indexOf(layout.rows[row]);
    // Numbers (2 lines), a line, the partial rows, a line before the answer if there are partials.
    const afterLine = numbersAt + 3 + index;
    return kind === 'answer' && layout.bottom.length > 1 ? afterLine + 1 : afterLine;
  };

  const parts = [];
  // Row heights: boxes, a shorter carry row, and thin rows for the lines.
  const lines = [numbersAt + 2];
  if (layout.bottom.length > 1) lines.push(rowLine(layout.rows.length - 1) - 1);
  const lastLine = rowLine(layout.rows.length - 1);
  const heights = Array.from({ length: lastLine }, (_, i) => {
    const line = i + 1;
    if (lines.includes(line)) return '6px';
    if (hasCarry && line === 1) return 'calc(var(--pad-box) * 0.7)';
    return 'var(--pad-box)';
  });
  layout.rows.forEach((r, row) => {
    for (let column = r.from; column <= r.to; column++) parts.push(box(row, column));
  });
  const digit = (d, line, column) => h('span', { class: 'pad-digit', style: `grid-row: ${line}; grid-column: ${column + 2}` }, String(d));
  layout.top.forEach((d, i) => parts.push(digit(d, numbersAt, layout.width - layout.top.length + i)));
  layout.bottom.forEach((d, i) => parts.push(digit(d, numbersAt + 1, layout.width - layout.bottom.length + i)));
  parts.push(h('span', { class: 'pad-sign', style: `grid-row: ${numbersAt + 1}; grid-column: 1` }, '×'));
  parts.push(h('span', { class: 'pad-line', style: `grid-row: ${numbersAt + 2}; grid-column: 1 / ${layout.width + 2}` }));
  if (layout.bottom.length > 1) {
    const answerLine = rowLine(layout.rows.length - 1) - 1;
    parts.push(h('span', { class: 'pad-sign', style: `grid-row: ${answerLine - 1}; grid-column: 1` }, '+'));
    parts.push(h('span', { class: 'pad-line', style: `grid-row: ${answerLine}; grid-column: 1 / ${layout.width + 2}` }));
  }
  const el = h('div', { class: 'column-pad', role: 'group', 'aria-label': `${a} times ${b} in columns, with boxes to write in`, style: `grid-template-columns: repeat(${layout.width + 1}, var(--pad-box)); grid-template-rows: ${heights.join(' ')}` }, parts);

  const show = (cell) => {
    cell.el.textContent = cell.value;
    cell.el.setAttribute('aria-label', `${cell.el.getAttribute('aria-label').split(',')[0]}, ${cell.value || 'empty'}`);
  };

  return {
    el,
    selected: () => chosen,
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
      // The box to the left in the same row, as column sums are written.
      const left = cells.find((c) => c.row === chosen.row && c.column === chosen.column - 1);
      if (left) choose(left);
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
