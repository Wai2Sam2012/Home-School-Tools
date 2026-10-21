// The column method note pad for × with a 2-digit number (0.7.6): the layout
// as data. (Tapping boxes and typing into them is checked in a browser.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { answerFrom, columnLayout } from '../js/column-pad.js';

test('2-digit × 1-digit: carries over the tens, then one answer row', () => {
  const l = columnLayout(47, 6);
  assert.equal(l.width, 3);
  assert.deepEqual([l.top, l.bottom], [[4, 7], [6]]);
  assert.deepEqual(l.rows, [{ kind: 'carry', from: 1, to: 1 }, { kind: 'answer', from: 0, to: 2 }]);
  assert.deepEqual(columnLayout(6, 47), l, 'the bigger number goes on top either way');
});

test('2-digit × 2-digit: a row for each digit (the tens row has the box for its 0), then the answer', () => {
  const l = columnLayout(47, 38);
  assert.equal(l.width, 4);
  assert.deepEqual([l.top, l.bottom], [[4, 7], [3, 8]]);
  assert.deepEqual(l.rows, [
    { kind: 'carry', from: 2, to: 2 },
    { kind: 'partial', from: 1, to: 3 },
    { kind: 'partial', from: 0, to: 3 },
    { kind: 'answer', from: 0, to: 3 },
  ]);
});

test('there is always room for the answer, and every box is inside the columns', () => {
  for (let a = 10; a <= 99; a++) {
    for (const b of [1, 5, 9, 10, 55, 99]) {
      const l = columnLayout(a, b);
      const answer = l.rows.at(-1);
      assert.equal(answer.kind, 'answer');
      assert.ok(answer.to - answer.from + 1 >= String(a * b).length, `${a} × ${b}`);
      for (const r of l.rows) assert.ok(r.from >= 0 && r.to < l.width && r.from <= r.to, `${a} × ${b}: ${JSON.stringify(r)}`);
    }
  }
});

test('anything else is refused', () => {
  for (const [a, b] of [[0, 5], [100, 2], [4.5, 2], ['12', 3], [-12, 3]]) assert.throws(() => columnLayout(a, b), /No column layout/);
});

test('the pad is built from page elements, never text turned into HTML', () => {
  const code = readFileSync(new URL('../js/column-pad.js', import.meta.url), 'utf8');
  assert.doesNotMatch(code, /innerHTML|insertAdjacentHTML/);
});

test('the answer written in the bottom row: read left to right; empty or a gap is refused (0.7.7)', () => {
  assert.deepEqual(answerFrom(['1', '1', '5']), { ok: true, value: '115' });
  assert.deepEqual(answerFrom(['', '9', '6']), { ok: true, value: '96' }, 'leading empty boxes are fine');
  assert.deepEqual(answerFrom(['', '4', '']), { ok: true, value: '4' }, 'so are trailing ones');
  assert.deepEqual(answerFrom(['0', '0', '7']), { ok: true, value: '7' }, 'leading zeros are dropped');
  assert.deepEqual(answerFrom(['', '', '0']), { ok: true, value: '0' });
  assert.deepEqual(answerFrom(['', '', '']), { ok: false, reason: 'empty' });
  assert.deepEqual(answerFrom(['1', '', '5']), { ok: false, reason: 'gap' });
});
