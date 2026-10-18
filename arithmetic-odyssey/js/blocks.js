// Counting blocks: a visual way to see numbers, for tips that help with
// counting (for example 7 + 5 as a 7 block and a 5 block, then as a 10 block
// and a 2 block). Each block is made of unit squares, one per 1 it is worth:
// the blocks 1 to 10 are one row of squares, and the 100 block is a 10 by 10
// square. Each value has its own color.
//
// blockSvg() draws a block as SVG text, so it works in the game and in the
// tools that make the picture files in images/blocks/ (tools/build-blocks.mjs).

/** The blocks: value, color name, fill color, and size in unit squares (rows x columns). */
export const BLOCKS = Object.freeze([
  { value: 1, name: 'Green', color: '#3fa34d', rows: 1, cols: 1 },
  { value: 2, name: 'Orange', color: '#f28c28', rows: 1, cols: 2 },
  { value: 3, name: 'Pink', color: '#f7a8cf', rows: 1, cols: 3 },
  { value: 4, name: 'Yellow', color: '#f5c518', rows: 1, cols: 4 },
  { value: 5, name: 'Light Blue', color: '#5bc0eb', rows: 1, cols: 5 },
  { value: 6, name: 'Purple', color: '#8e5cc2', rows: 1, cols: 6 },
  { value: 7, name: 'Tan', color: '#d2b48c', rows: 1, cols: 7 },
  { value: 8, name: 'Brown', color: '#8b5a2b', rows: 1, cols: 8 },
  { value: 9, name: 'Mint Green', color: '#98e2c6', rows: 1, cols: 9 },
  { value: 10, name: 'Dark Blue', color: '#1f4e99', rows: 1, cols: 10 },
  { value: 100, name: 'Red', color: '#d7263d', rows: 10, cols: 10 },
].map(Object.freeze));

/** The block worth this much, or null. */
export function blockFor(value) {
  return BLOCKS.find((b) => b.value === value) ?? null;
}

/**
 * A number as the fewest blocks: hundreds, then tens, then one block for the
 * rest. 237 -> [100, 100, 10, 10, 10, 7]; 0 -> [].
 */
export function numberAsBlocks(n) {
  if (!Number.isInteger(n) || n < 0) throw new Error(`Blocks show whole numbers from 0 up, not ${n}.`);
  const blocks = [];
  let rest = n;
  for (const size of [100, 10]) {
    while (rest >= size) {
      blocks.push(size);
      rest -= size;
    }
  }
  if (rest > 0) blocks.push(rest);
  return blocks;
}

// ---------------------------------------------------------------- drawing

/** Dark text on light blocks (yellow, mint, tan, light blue), white on the rest. */
export function textColorFor(color) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const light = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return light > 0.3 ? '#1d2a24' : '#ffffff';
}

/** A color made darker (amount 0-1), for the lines between squares. */
function darker(color, amount) {
  const [r, g, b] = [1, 3, 5].map((i) => Math.round(parseInt(color.slice(i, i + 2), 16) * (1 - amount)));
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * A block as SVG text.
 *   unit      size of one square in pixels (default 40)
 *   vertical  stand the 1-10 blocks up instead of lying them down
 *   label     show the block's value (default true)
 *   numbered  number each square 1, 2, 3 ... (for counting along)
 */
export function blockSvg(value, { unit = 40, vertical = false, label = true, numbered = false } = {}) {
  const block = blockFor(value);
  if (!block) throw new Error(`There is no ${value} block.`);
  const rows = vertical && block.rows === 1 ? block.cols : block.rows;
  const cols = vertical && block.rows === 1 ? 1 : block.cols;
  const pad = Math.max(2, Math.round(unit * 0.06)); // room for the outline
  const width = cols * unit + pad * 2;
  const height = rows * unit + pad * 2;
  const line = darker(block.color, 0.28);
  const ink = textColorFor(block.color);
  const radius = Math.round(unit * 0.18);

  const squares = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = pad + c * unit;
      const y = pad + r * unit;
      squares.push(`<rect x="${x}" y="${y}" width="${unit}" height="${unit}" fill="${block.color}" stroke="${line}" stroke-width="${Math.max(1, unit / 20)}"/>`);
      // A light edge along the top of each square makes it look like a little block.
      squares.push(`<rect x="${x + unit * 0.12}" y="${y + unit * 0.1}" width="${unit * 0.76}" height="${unit * 0.12}" rx="${unit * 0.06}" fill="#ffffff" opacity="0.28"/>`);
      if (numbered) {
        const n = r * cols + c + 1;
        squares.push(`<text x="${x + unit / 2}" y="${y + unit * 0.68}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${Math.round(unit * (n >= 100 ? 0.34 : 0.42))}" fill="${ink}">${n}</text>`);
      }
    }
  }
  const outline = `<rect x="${pad / 2}" y="${pad / 2}" width="${width - pad}" height="${height - pad}" rx="${radius}" fill="none" stroke="${line}" stroke-width="${pad}"/>`;
  // The value sits in a round badge on the last square: the right end of a
  // block lying down, the bottom of one standing up (not over the numbers).
  const bx = pad + (cols - 1) * unit + unit / 2;
  const by = pad + (rows - 1) * unit + unit / 2;
  const badge = label && !numbered
    ? `<circle cx="${bx}" cy="${by}" r="${unit * 0.36}" fill="#ffffff" opacity="0.92"/>`
      + `<text x="${bx}" y="${by + unit * (value >= 100 ? 0.11 : 0.14)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${Math.round(unit * (value >= 100 ? 0.3 : value >= 10 ? 0.36 : 0.42))}" fill="#1d2a24">${value}</text>`
    : '';
  const title = `<title>${value} block (${block.name}, ${block.rows === 1 ? `1 x ${block.cols}` : `${block.rows} x ${block.cols}`})</title>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" class="count-block" data-value="${value}">`
    + `${title}<g>${squares.join('')}</g>${outline}${badge}</svg>`;
}

// ---------------------------------------------------------------- tips

/** Operations that have a counting tip (Help, 🙏). */
export const TIP_OPERATIONS = Object.freeze(['+', '−', '×', '÷']);

/** True when a problem has a counting tip: addition and subtraction up to 99, and every multiplication and division. */
export function hasTip(problem) {
  if (!problem || !TIP_OPERATIONS.includes(problem.op)) return false;
  // Only whole numbers ever reach the picture (it is built as text).
  if (![problem.a, problem.b, problem.answer].every(Number.isInteger)) return false;
  if (problem.op === '+' || problem.op === '−') return problem.a <= 99 && problem.b <= 99;
  return problem.a > 0 && problem.b > 0 && problem.a <= 999 && problem.b <= 999;
}

/**
 * Which picture a problem's tip uses:
 *   'blocks'  + and −: the problem drawn with blocks
 *   'groups'  × with a number up to 10 (4 groups of 23), and ÷ with an
 *             answer up to 12 (how many 7s make 56: rows of 7 to count)
 *   'area'    × of two 2-digit numbers: a box split into tens and ones
 *   'split'   ÷ with a bigger answer: 72 = 60 + 12, share each part
 */
export function tipKind(problem) {
  if (problem.op === '+' || problem.op === '−') return 'blocks';
  if (problem.op === '×') return Math.min(problem.a, problem.b) <= 10 ? 'groups' : 'area';
  return problem.answer <= 12 ? 'groups' : 'split';
}

/** The tip's title, saying how to use the picture. */
export function tipTitle(problem) {
  const kind = tipKind(problem);
  if (kind === 'blocks') return 'Count the blocks';
  if (problem.op === '×') {
    if (kind === 'groups') {
      const [few, each] = problem.a <= problem.b ? [problem.a, problem.b] : [problem.b, problem.a];
      return `${few} ${few === 1 ? 'group' : 'groups'} of ${each}: count them all`;
    }
    return 'Split into tens and ones: work out each box, then add them';
  }
  // Groups over 30 are drawn standing up, side by side (see groupsSvg()).
  if (kind === 'groups') return `How many ${problem.b}s make ${problem.a}? Count the ${problem.b > 30 ? 'groups' : 'rows'}`;
  const { first, rest } = divisionSplit(problem.a, problem.b);
  return rest ? `${problem.a} = ${first} + ${rest}: share each part, then add` : `${problem.a} ÷ ${problem.b}: think tens first`;
}

/** For ÷: the biggest tens-of-the-divisor part, and the rest (456 ÷ 38 -> 380 and 76). */
export function divisionSplit(a, b) {
  const first = Math.floor(a / (10 * b)) * 10 * b;
  return { first, rest: a - first };
}

/** The tip picture as SVG text (see tipKind()). */
export function tipSvg(problem, { unit = 20 } = {}) {
  if (!hasTip(problem)) throw new Error(`There is no tip for ${problem?.text ?? 'this problem'}.`);
  const kind = tipKind(problem);
  if (kind === 'groups') {
    if (problem.op === '×') {
      const [few, each] = problem.a <= problem.b ? [problem.a, problem.b] : [problem.b, problem.a];
      return groupsSvg(few, each, { unit, label: `${few} groups of ${each} counting blocks` });
    }
    return groupsSvg(problem.answer, problem.b, { unit, label: `rows of ${problem.b} counting blocks that make ${problem.a}` });
  }
  if (kind === 'area') return areaSvg(problem.a, problem.b);
  if (kind === 'split') return splitSvg(problem.a, problem.b);
  return addSubSvg(problem, { unit });
}

/** A block's shapes, moved to (x, y) (not a picture inside the picture, which page styles could stretch). */
function placedBlock(value, x, y, { unit, vertical = false }) {
  const svg = blockSvg(value, { unit, vertical });
  const [, w, hh] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).map(Number);
  const shapes = svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>')).replace(/<title>.*?<\/title>/, '');
  return { svg: `<g transform="translate(${x} ${y})">${shapes}</g>`, w, h: hh };
}

/**
 * Groups to count: rows numbered rows, each the number each as blocks lying
 * down (tens, then the rest). A group over 30 (long rows would be tiny) is
 * drawn standing up instead, the groups in a grid, each numbered under it.
 */
function groupsSvg(rows, each, { unit, label }) {
  if (each > 30) return standingGroupsSvg(rows, each, { unit, label });
  const gap = Math.round(unit * 0.3);
  const numberWidth = unit * 1.6;
  const parts = [];
  let width = 0;
  let y = 0;
  for (let r = 0; r < rows; r++) {
    let x = numberWidth;
    let rowHeight = 0;
    for (const v of numberAsBlocks(each)) {
      const b = placedBlock(v, x, y, { unit });
      parts.push(b.svg);
      x += b.w + gap;
      rowHeight = Math.max(rowHeight, b.h);
    }
    parts.push(`<text x="${numberWidth / 2}" y="${y + rowHeight / 2 + unit * 0.3}" text-anchor="middle" class="tip-row-number" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${Math.round(unit * 0.8)}" fill="currentColor">${r + 1}</text>`);
    width = Math.max(width, x - gap);
    y += rowHeight + gap;
  }
  const height = y - gap;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="tip-picture tip-groups" role="img" aria-label="${label}">${parts.join('')}</svg>`;
}

function standingGroupsSvg(groups, each, { unit, label }) {
  const gap = Math.round(unit * 0.3);
  const blocks = numberAsBlocks(each);
  const groupW = blocks.length * (unit + 2 * Math.max(2, Math.round(unit * 0.06))) + (blocks.length - 1) * gap;
  const blockH = 10 * unit + 2 * Math.max(2, Math.round(unit * 0.06));
  const labelH = unit * 2.2;
  const groupH = blockH + labelH;
  const space = unit * 1.6; // between groups
  // The grid closest to a wide box (about 3 times as wide as tall), with rows as even as possible (5 and 4, not 8 and 1).
  let cols = groups;
  let best = Infinity;
  for (let r = 1; r <= groups; r++) {
    const c = Math.ceil(groups / r);
    const ratio = (c * groupW + (c - 1) * space) / (r * groupH + (r - 1) * gap);
    if (Math.abs(Math.log(ratio / 3)) < best) {
      best = Math.abs(Math.log(ratio / 3));
      cols = c;
    }
  }
  const parts = [];
  for (let g = 0; g < groups; g++) {
    const gx = (g % cols) * (groupW + space);
    const gy = Math.floor(g / cols) * (groupH + gap);
    let x = gx;
    for (const v of blocks) {
      const b = placedBlock(v, x, gy + blockH - (v === 10 ? blockH : v * unit + 2 * Math.max(2, Math.round(unit * 0.06))), { unit, vertical: true });
      parts.push(b.svg);
      x += b.w + gap;
    }
    parts.push(`<text x="${gx + groupW / 2}" y="${gy + blockH + labelH * 0.8}" text-anchor="middle" class="tip-row-number" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${Math.round(unit * 1.6)}" fill="currentColor">${g + 1}</text>`);
  }
  const rows = Math.ceil(groups / cols);
  const width = cols * groupW + (cols - 1) * space;
  const height = rows * groupH + (rows - 1) * gap;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="tip-picture tip-groups" role="img" aria-label="${label}">${parts.join('')}</svg>`;
}

/** A number split into tens and ones ([40, 7]; [30]; [8]). */
function tensAndOnes(n) {
  return [Math.floor(n / 10) * 10, n % 10].filter((v) => v > 0);
}

const TIP_FONT = 'font-family="Arial, Helvetica, sans-serif" font-weight="700" fill="currentColor"';

/** a × b as a box split into tens and ones: a's parts down the side, b's along the top. */
function areaSvg(a, b) {
  const rows = tensAndOnes(a);
  const cols = tensAndOnes(b);
  const side = 90; // room for the labels on the left
  const top = 50;
  // Sizes follow the numbers a little, so the bigger parts look bigger, but every box fits its words.
  const colW = cols.map((v) => (v >= 10 ? 330 : 230));
  const rowH = rows.map((v) => (v >= 10 ? 130 : 100));
  const parts = [];
  let x = side;
  cols.forEach((v, c) => {
    parts.push(`<text x="${x + colW[c] / 2}" y="${top - 14}" text-anchor="middle" font-size="34" ${TIP_FONT}>${v}</text>`);
    x += colW[c];
  });
  let y = top;
  rows.forEach((rv, r) => {
    parts.push(`<text x="${side - 14}" y="${y + rowH[r] / 2 + 12}" text-anchor="end" font-size="34" ${TIP_FONT}>${rv}</text>`);
    let cx = side;
    cols.forEach((cv, c) => {
      parts.push(`<rect x="${cx}" y="${y}" width="${colW[c]}" height="${rowH[r]}" class="tip-cell tip-cell-${(r + c) % 2}" stroke-width="3"/>`);
      parts.push(`<text x="${cx + colW[c] / 2}" y="${y + rowH[r] / 2 + 12}" text-anchor="middle" font-size="34" ${TIP_FONT}>${rv} × ${cv} = ?</text>`);
      cx += colW[c];
    });
    y += rowH[r];
  });
  const width = side + colW.reduce((n, w) => n + w, 0) + 10;
  const height = y + 10;
  const label = `${a} times ${b} split into tens and ones: ${rows.map((rv) => cols.map((cv) => `${rv} times ${cv}`).join(', ')).join(', ')}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="tip-picture tip-area" role="img" aria-label="${label}">${parts.join('')}</svg>`;
}

/** a ÷ b as two easier parts: 72 ÷ 3 -> 60 ÷ 3 = ? and 12 ÷ 3 = ?, then add. */
function splitSvg(a, b) {
  const { first, rest } = divisionSplit(a, b);
  const boxes = [`${first} ÷ ${b} = ?`, `${rest} ÷ ${b} = ?`].filter((_, i) => (i === 0 ? first : rest) > 0);
  const boxW = 330;
  const plusW = 70;
  const margin = 4; // room for the boxes' outlines
  const parts = [`<text x="${margin + (boxes.length * boxW + (boxes.length - 1) * plusW) / 2}" y="40" text-anchor="middle" font-size="34" ${TIP_FONT}>${a} = ${first}${rest ? ` + ${rest}` : ''}</text>`];
  let x = margin;
  boxes.forEach((text, i) => {
    parts.push(`<rect x="${x}" y="64" width="${boxW}" height="110" rx="16" class="tip-cell tip-cell-${i % 2}" stroke-width="3"/>`);
    parts.push(`<text x="${x + boxW / 2}" y="131" text-anchor="middle" font-size="36" ${TIP_FONT}>${text}</text>`);
    x += boxW;
    if (i < boxes.length - 1) {
      parts.push(`<text x="${x + plusW / 2}" y="133" text-anchor="middle" font-size="44" ${TIP_FONT}>+</text>`);
      x += plusW;
    }
  });
  const label = `${a} divided by ${b}: ${a} is ${first} plus ${rest}; ${first} divided by ${b}, plus ${rest} divided by ${b}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x + margin} 184" class="tip-picture tip-split" role="img" aria-label="${label}">${parts.join('')}</svg>`;
}

/**
 * + and −: the problem drawn with blocks, for example 7 + 5 = ? as the 7
 * block, "+", the 5 block, "=" and "?". Numbers up to 10 lie down; with
 * bigger numbers every block stands up, the tens side by side, so the picture
 * stays short. The picture scales to fit its box.
 */
function addSubSvg(problem, { unit }) {
  const vertical = problem.a > 10 || problem.b > 10;
  const gap = Math.round(unit * 0.3);
  const parts = [];
  let x = 0;
  let height = 0;

  // Each number: its blocks, side by side when standing, one per row when lying.
  const groups = [problem.a, problem.b].map((n) => {
    const blocks = numberAsBlocks(n).map((v) => {
      const svg = blockSvg(v, { unit, vertical });
      const [, w, hh] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).map(Number);
      return { svg, w, h: hh };
    });
    const w = vertical ? blocks.reduce((s, b) => s + b.w, 0) + gap * (blocks.length - 1) : Math.max(...blocks.map((b) => b.w));
    const h = vertical ? Math.max(...blocks.map((b) => b.h)) : blocks.reduce((s, b) => s + b.h, 0) + gap * (blocks.length - 1);
    height = Math.max(height, h);
    return { blocks, w, h };
  });
  height = Math.max(height, unit * 2); // room for the + and = signs
  // The signs grow with the picture, so they stay easy to see next to tall blocks.
  const symbolSize = vertical ? height * 0.45 : Math.max(unit * 1.6, height * 0.24);
  const symbolWidth = symbolSize * 1.4;

  const place = (group) => {
    // Standing blocks stand on the same line; lying blocks are centered.
    let y = vertical ? height - group.h : (height - group.h) / 2;
    let bx = x;
    for (const b of group.blocks) {
      const by = vertical ? height - b.h : y;
      // The block's shapes, moved into place (not a picture inside the picture,
      // which a page's styles for svg could stretch).
      const shapes = b.svg.slice(b.svg.indexOf('>') + 1, b.svg.lastIndexOf('</svg>')).replace(/<title>.*?<\/title>/, '');
      parts.push(`<g transform="translate(${bx} ${by})">${shapes}</g>`);
      if (vertical) bx += b.w + gap;
      else y += b.h + gap;
    }
    x += group.w;
  };
  const symbol = (text) => {
    parts.push(`<text x="${x + symbolWidth / 2}" y="${height / 2 + symbolSize * 0.35}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${Math.round(symbolSize)}" fill="currentColor">${text}</text>`);
    x += symbolWidth;
  };

  place(groups[0]);
  symbol(problem.op);
  place(groups[1]);
  symbol('=');
  symbol('?');
  const label = `${problem.a} ${problem.op === '+' ? 'plus' : 'minus'} ${problem.b} with counting blocks`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x} ${height}" class="tip-picture" role="img" aria-label="${label}">${parts.join('')}</svg>`;
}

