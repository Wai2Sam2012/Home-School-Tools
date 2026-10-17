# Counting blocks

Pictures of the counting blocks, for tips that help with counting. Each block is made of squares, one for each 1 it is worth, and each value has its own color:

| Block | Color | Size (rows x squares) | File |
| --- | --- | --- | --- |
| 1 | Green | 1 x 1 | `1_Green_1x1.svg` |
| 2 | Orange | 1 x 2 | `2_Orange_1x2.svg` |
| 3 | Pink | 1 x 3 | `3_Pink_1x3.svg` |
| 4 | Yellow | 1 x 4 | `4_Yellow_1x4.svg` |
| 5 | Light Blue | 1 x 5 | `5_Light-Blue_1x5.svg` |
| 6 | Purple | 1 x 6 | `6_Purple_1x6.svg` |
| 7 | Tan | 1 x 7 | `7_Tan_1x7.svg` |
| 8 | Brown | 1 x 8 | `8_Brown_1x8.svg` |
| 9 | Mint Green | 1 x 9 | `9_Mint-Green_1x9.svg` |
| 10 | Dark Blue | 1 x 10 | `10_Dark-Blue_1x10.svg` |
| 100 | Red | 10 x 10 | `100_Red_10x10.svg` |

**These files are made by code; don't edit them by hand.** The blocks are defined in `js/blocks.js` (`BLOCKS`: value, color name, color and size). To change a color or a size, edit it there, then run this in the `arithmetic-odyssey` folder to write the files again:

```powershell
node tools/build-blocks.mjs
```

The tests check that these files match `js/blocks.js`.

**In the game** (for tips, later), `js/blocks.js` draws any block at any size without the files:

- `blockSvg(7)`: the 7 block lying down; `blockSvg(7, { vertical: true })` standing up; `{ unit: 24 }` makes each square 24 pixels; `{ numbered: true }` numbers the squares 1, 2, 3 ... for counting along.
- `numberAsBlocks(37)`: a number as the fewest blocks, `[10, 10, 10, 7]`.
