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
  { value: 3, name: 'Pink', color: '#ef6fa8', rows: 1, cols: 3 },
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
  // The value sits in a round badge on the first square (not over the numbers).
  const badge = label && !numbered
    ? `<circle cx="${pad + unit / 2}" cy="${pad + unit / 2}" r="${unit * 0.36}" fill="#ffffff" opacity="0.92"/>`
      + `<text x="${pad + unit / 2}" y="${pad + unit / 2 + unit * (value >= 100 ? 0.11 : 0.14)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${Math.round(unit * (value >= 100 ? 0.3 : value >= 10 ? 0.36 : 0.42))}" fill="#1d2a24">${value}</text>`
    : '';
  const title = `<title>${value} block (${block.name}, ${block.rows === 1 ? `1 x ${block.cols}` : `${block.rows} x ${block.cols}`})</title>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" class="count-block" data-value="${value}">`
    + `${title}<g>${squares.join('')}</g>${outline}${badge}</svg>`;
}
