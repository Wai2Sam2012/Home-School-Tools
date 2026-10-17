// Tests for the counting blocks (js/blocks.js) and their picture files.
// Run from the arithmetic-odyssey folder with:  node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { BLOCKS, blockFor, blockSvg, numberAsBlocks, textColorFor } from '../js/blocks.js';
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
