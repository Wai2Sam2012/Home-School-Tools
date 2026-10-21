// Tests for the counting blocks (js/blocks.js) and their picture files.
// Run from the arithmetic-odyssey folder with:  node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { BLOCKS, blockFor, blockSvg, hasTip, numberAsBlocks, textColorFor, tipKind, tipSvg, tipTitle } from '../js/blocks.js';
import { restoreProblem } from '../js/math.js';
import { BLOCKS_DIR, blockFileName, blockFiles } from '../tools/build-blocks.mjs';

test('there are 11 blocks with the values, colors and sizes asked for', () => {
  assert.deepEqual(BLOCKS.map((b) => `${b.value}_${b.name}_${b.rows}x${b.cols}`), [
    '1_Green_1x1', '2_Orange_1x2', '3_Pink_1x3', '4_Yellow_1x4', '5_Light Blue_1x5', '6_Purple_1x6',
    '7_Tan_1x7', '8_Brown_1x8', '9_Mint Green_1x9', '10_Dark Blue_1x10', '100_Red_10x10',
  ]);
  for (const b of BLOCKS) {
    assert.equal(b.rows * b.cols, b.value, `the ${b.value} block has ${b.value} squares`);
    assert.match(b.color, /^#[0-9a-f]{6}$/);
  }
  assert.equal(new Set(BLOCKS.map((b) => b.color)).size, BLOCKS.length, 'every block has its own color');
  assert.equal(blockFor(7).name, 'Tan');
  assert.equal(blockFor(11), null);
});

test('each block is drawn with one square per 1 it is worth', () => {
  const squares = (svg) => (svg.match(/<rect x="[\d.]+" y="[\d.]+" width="40" height="40" /g) ?? []).length;
  for (const b of BLOCKS) {
    const svg = blockSvg(b.value);
    assert.equal(squares(svg), b.value, `${b.value} block`);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, new RegExp(`<title>${b.value} block \\(${b.name}`));
    assert.ok(svg.includes(`>${b.value}</text>`), 'the value is shown');
  }
  assert.match(blockSvg(10), /viewBox="0 0 404 44"/, 'lying down: 10 squares of 40 px, plus the outline');
  assert.match(blockSvg(10, { vertical: true }), /viewBox="0 0 44 404"/, 'standing up');
  assert.match(blockSvg(100, { vertical: true }), /viewBox="0 0 404 404"/, 'the 100 block is square either way');
  assert.match(blockSvg(3, { unit: 20 }), /viewBox="0 0 64 24"/);
  assert.throws(() => blockSvg(11), /no 11 block/);
});

test('numbered blocks count along their squares', () => {
  const svg = blockSvg(7, { numbered: true });
  for (let n = 1; n <= 7; n++) assert.ok(svg.includes(`>${n}</text>`), String(n));
  assert.ok(!svg.includes('<circle'), 'no value badge over the numbers');
  assert.ok(!blockSvg(4, { label: false }).includes('</text>'), 'no text at all without a label');
});

test('text is dark on light blocks and white on dark ones', () => {
  const dark = '#1d2a24';
  for (const v of [4, 5, 7, 9]) assert.equal(textColorFor(blockFor(v).color), dark, `${v} (${blockFor(v).name})`);
  for (const v of [6, 8, 10, 100]) assert.equal(textColorFor(blockFor(v).color), '#ffffff', `${v} (${blockFor(v).name})`);
});

test('a number is shown with the fewest blocks: hundreds, tens, then the rest', () => {
  assert.deepEqual(numberAsBlocks(0), []);
  assert.deepEqual(numberAsBlocks(7), [7]);
  assert.deepEqual(numberAsBlocks(10), [10]);
  assert.deepEqual(numberAsBlocks(12), [10, 2]);
  assert.deepEqual(numberAsBlocks(237), [100, 100, 10, 10, 10, 7]);
  for (let n = 0; n <= 999; n++) assert.equal(numberAsBlocks(n).reduce((a, b) => a + b, 0), n);
  assert.throws(() => numberAsBlocks(-1), /whole numbers/);
  assert.throws(() => numberAsBlocks(2.5), /whole numbers/);
});

test('the picture files in images/blocks/ match the blocks (run tools/build-blocks.mjs after a change)', () => {
  const files = blockFiles();
  assert.deepEqual(readdirSync(BLOCKS_DIR).filter((f) => f.endsWith('.svg')).sort(), Object.keys(files).sort());
  for (const [name, svg] of Object.entries(files)) assert.equal(readFileSync(join(BLOCKS_DIR, name), 'utf8'), svg, name);
  assert.equal(blockFileName(blockFor(5)), '5_Light-Blue_1x5.svg');
});

test('the value sits on the last square: the right end lying down, the bottom standing up', () => {
  const badge = (svg) => svg.match(/<circle cx="([\d.]+)" cy="([\d.]+)"/).slice(1).map(Number);
  assert.deepEqual(badge(blockSvg(7)), [2 + 6 * 40 + 20, 2 + 20], 'lying down: the 7th square');
  assert.deepEqual(badge(blockSvg(7, { vertical: true })), [2 + 20, 2 + 6 * 40 + 20], 'standing up: the bottom square');
  assert.deepEqual(badge(blockSvg(1)), [22, 22]);
  assert.deepEqual(badge(blockSvg(100)), [2 + 9 * 40 + 20, 2 + 9 * 40 + 20], 'the 100 block: the bottom-right square');
});

test('the 3 block is a light pink', () => {
  assert.equal(blockFor(3).color, '#f7a8cf');
});

// ---------------------------------------------------------------- tips

const problem = (op, a, b) => restoreProblem({ op, a, b });
const texts = (svg) => [...svg.matchAll(/>([^<>]+)<\/text>/g)].map((m) => m[1]);

test('every problem has Help: + and − up to 99, and every × and ÷', () => {
  assert.ok(hasTip(problem('+', 7, 5)));
  assert.ok(hasTip(problem('−', 12, 5)));
  assert.ok(hasTip(problem('+', 99, 99)));
  assert.ok(hasTip(problem('×', 7, 5)));
  assert.ok(hasTip(problem('×', 99, 99)));
  assert.ok(hasTip(problem('÷', 12, 3)));
  assert.ok(hasTip(problem('÷', 999, 37)));
  assert.ok(!hasTip(problem('+', 100, 5)), 'too big to count with blocks');
  assert.ok(!hasTip(null));
  // Only whole numbers ever reach the picture (it is built as text).
  for (const bad of [{ op: '×', a: 7, b: 5, answer: '35' }, { op: '+', a: '<b>', b: 5, answer: 5 }, { op: '÷', a: 7.5, b: 2, answer: 3.75 }, { op: '÷', a: 5, b: 0, answer: Infinity }]) {
    assert.ok(!hasTip(bad), JSON.stringify(bad));
    assert.throws(() => tipSvg(bad), /no tip/);
  }
});

test('× of two 1-digit numbers: groups to count (3 rows of 4, numbered)', () => {
  const p = problem('×', 4, 3);
  assert.equal(tipKind(p), 'groups');
  assert.equal(tipTitle(p), '3 groups of 4: count them all');
  assert.equal(tipTitle(problem('×', 1, 8)), '1 group of 8: count them all');
  assert.deepEqual(texts(tipSvg(p)), ['1', '2', '3'], 'each row numbered (no numbers on the blocks since 0.7.4)');
  assert.equal((tipSvg(p).match(/width="20" height="20" /g) ?? []).length, 12, '12 squares in all (3 × 4)');
  assert.equal((tipSvg(problem('×', 7, 8)).match(/width="20" height="20" /g) ?? []).length, 56);
});

test('× with a 2-digit number: the column method note pad (0.7.6)', () => {
  for (const [a, b] of [[23, 4], [4, 23], [47, 38], [10, 10], [99, 99], [12, 1]]) {
    assert.equal(tipKind(problem('×', a, b)), 'column', `${a} × ${b}`);
    assert.match(tipTitle(problem('×', a, b)), /Column method: tap a box/);
    assert.throws(() => tipSvg(problem('×', a, b)), /column-pad/, 'built by js/column-pad.js');
  }
  assert.equal(tipKind(problem('×', 9, 9)), 'groups', 'Beginner keeps the groups');
});

test('÷ with an answer up to 12: how many groups make it (rows to count)', () => {
  const p = problem('÷', 56, 7);
  assert.equal(tipKind(p), 'groups');
  assert.equal(tipTitle(p), 'How many 7s make 56? Count the rows');
  const t = texts(tipSvg(p));
  assert.deepEqual(t, ['1', '2', '3', '4', '5', '6', '7', '8'], '8 numbered rows of the 7 block (no number on the block since 0.7.4)');
  assert.equal(tipKind(problem('÷', 456, 38)), 'longdivision', '456 ÷ 38: a 2-digit divisor gets long division (0.7.8)');
});

test('÷ with a 2-digit divisor or answer: the long division note pad (0.7.8)', () => {
  for (const [a, b] of [[72, 3], [156, 12], [96, 12], [990, 99], [60, 6]]) {
    assert.equal(tipKind(problem('÷', a, b)), 'longdivision', `${a} ÷ ${b}`);
    assert.match(tipTitle(problem('÷', a, b)), /Long division: tap a box/);
    assert.throws(() => tipSvg(problem('÷', a, b)), /column-pad/);
  }
  for (const [a, b] of [[56, 7], [81, 9], [9, 3], [8, 1]]) assert.equal(tipKind(problem('÷', a, b)), 'groups', `${a} ÷ ${b} keeps the rows to count`);
});

test('a tip shows the problem with blocks: 7 block, +, 5 block, =, ?', () => {
  const svg = tipSvg(problem('+', 7, 5));
  const texts = [...svg.matchAll(/>([^<>]+)<\/text>/g)].map((m) => m[1]);
  // 0.7.4: no number on the blocks (it got in the way of counting).
  assert.deepEqual(texts, ['+', '=', '?'], 'the 7 block, +, the 5 block, = and ?, with no numbers on the blocks');
  assert.ok(!svg.includes('<svg x='), 'blocks are drawn as shapes, not pictures in the picture');
  assert.match(svg, /aria-label="7 plus 5 with counting blocks"/);
  assert.equal((svg.match(/width="20" height="20" /g) ?? []).length, 12, '12 squares in all (7 + 5)');
});

test('bigger numbers use tens and the rest, standing up: 47 + 35', () => {
  const svg = tipSvg(problem('+', 47, 35));
  const texts = [...svg.matchAll(/>([^<>]+)<\/text>/g)].map((m) => m[1]);
  assert.deepEqual(texts, ['+', '=', '?']);
  assert.equal((svg.match(/width="20" height="20" /g) ?? []).length, 82);
});

test('Help pictures never put a number on a block (0.7.4)', () => {
  const badge = /<circle[^>]*fill="#ffffff" opacity="0.92"/;
  for (const [op, a, b] of [['+', 7, 5], ['+', 47, 35], ['×', 3, 4], ['×', 9, 8], ['÷', 56, 7], ['÷', 8, 2]]) {
    const svg = tipSvg(problem(op, a, b));
    assert.doesNotMatch(svg, badge, `${a} ${op} ${b}`);
  }
  // The groups keep their row numbers (1, 2, 3 ...), which count the groups, not the squares.
  const groups = [...tipSvg(problem('×', 3, 4)).matchAll(/>([^<>]+)<\/text>/g)].map((m) => m[1]);
  assert.deepEqual(groups, ['1', '2', '3']);
  // The block pictures in images/blocks/ keep their number.
  assert.match(blockSvg(7), badge);
});

test('subtraction Help is take away: the first number, with the second crossed out from the end (0.7.2)', () => {
  const count = (svg, cls) => (svg.match(new RegExp(`class="${cls}"`, 'g')) ?? []).length;
  for (const [a, b] of [[9, 5], [12, 5], [7, 7], [93, 47], [99, 1], [10, 9]]) {
    const svg = tipSvg(problem('−', a, b));
    assert.equal(tipKind(problem('−', a, b)), 'takeaway');
    assert.equal(count(svg, 'tip-keep'), a - b, `${a} − ${b}: squares left`);
    assert.equal(count(svg, 'tip-gone'), b, `${a} − ${b}: crossed out`);
    assert.match(svg, new RegExp(`aria-label="${a} blocks, with ${b} taken away`));
    // The squares left come first, so whole rows of ten stay at the top.
    const keep = svg.indexOf('tip-keep');
    if (a > b) assert.ok(keep !== -1 && keep < svg.indexOf('tip-gone'));
    assert.doesNotMatch(svg, /NaN|undefined/);
  }
  assert.equal(tipTitle(problem('−', 9, 5)), 'Take away 5: count the blocks that are left');
  assert.equal(tipTitle(problem('+', 9, 5)), 'Count the blocks');
});
