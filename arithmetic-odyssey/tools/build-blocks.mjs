// Writes a picture file for each counting block (js/blocks.js) into
// images/blocks/, named like the block list: 1_Green_1x1.svg,
// 5_Light-Blue_1x5.svg, 100_Red_10x10.svg. Run it after changing a block:
//   node tools/build-blocks.mjs
// The tests check that the files match js/blocks.js.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BLOCKS, blockSvg } from '../js/blocks.js';

export const BLOCKS_DIR = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'images', 'blocks');

/** "5_Light-Blue_1x5.svg" */
export function blockFileName(block) {
  return `${block.value}_${block.name.replace(/\s+/g, '-')}_${block.rows}x${block.cols}.svg`;
}

/** The text of each block's picture file: { fileName: svg }. */
export function blockFiles() {
  return Object.fromEntries(BLOCKS.map((b) => [blockFileName(b), `${blockSvg(b.value)}\n`]));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mkdirSync(BLOCKS_DIR, { recursive: true });
  for (const [name, svg] of Object.entries(blockFiles())) {
    writeFileSync(join(BLOCKS_DIR, name), svg);
    console.log(`wrote images/blocks/${name}`);
  }
}
