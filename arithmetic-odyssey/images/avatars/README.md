# Player pictures

The 16 pictures players choose from when they make a profile. The chosen picture also travels the trail map during an adventure, so **every picture must face right** (toward the finish).

| File | Picture |
| --- | --- |
| `longneck.svg` | Long-neck dinosaur |
| `triceratops.svg` | Triceratops |
| `trex.svg` | T. rex |
| `mosasaur.svg` | Mosasaur |
| `pterosaur.svg` | Pterosaur |
| `pickup.svg` | Blue pickup truck |
| `monstertruck.svg` | Monster truck |
| `dirtbike.svg` | Dirt bike |
| `suv.svg` | Blue SUV |
| `atv.svg` | Blue ATV |
| `robot.svg` | Robot |
| `rocket.svg` | Rocket |
| `butterfly.svg` | Butterfly |
| `unicorn.svg` | Unicorn |
| `dog.svg` | Dog |
| `cat.svg` | Cat |

## Five colors of each picture (for Stage 7)

Each picture also has a folder with its five colors, for example `cat/orange.png` … `cat/calico.png`. They are cut from the author's avatar catalog (80 pictures: 16 characters, 5 colors each). Players will choose a color in Stage 7; until then the game shows the drawings above.

- **Order:** color 1 to 5 is the order in `AVATAR_COLORS` in `js/avatars.js`, the same order as the catalog.
- **Size:** each is a 256 × 256 PNG with a see-through background, under 100 KB (about 15 KB each; 1.2 MB for all 80, so they can be saved for offline play).
- **Facing:** every picture faces right, toward the finish on the trail map. The T. rex, pterosaur, unicorn and dirt bike faced left in the catalog and were flipped. The cat, dog, robot and butterfly face the front.
- **Replacing one:** save a square PNG with a see-through background over the old file, with the same name. Keep it facing right. The tests check every file is there, 256 × 256, see-through and under 100 KB.
- The catalog itself is not kept here, since everything in this folder is published with the game.

## Changing a picture

- **Edit the drawing:** the files are SVG drawings. Open one in a free editor such as [Inkscape](https://inkscape.org/) (Windows/Mac), or in an online editor such as [Boxy SVG](https://boxy-svg.com/) or [SVG-Edit](https://svgedit.netlify.app/editor/index.html), then save it with the same name. Keep it square.
- **Use your own picture instead:** save it here as a PNG or JPEG (square, at least 256 × 256 pixels, transparent background looks best). Then open `js/avatars.js` and change that picture's `file`, for example `file: 'trex.png'`.
- **Add a new picture:** put the file here and add a line to the list in `js/avatars.js` with a new `id`, a `label` (the name shown under the picture) and the `file`.
- **Rename a picture:** change its `label` in `js/avatars.js`. Don't change the `id`: saved players use it to remember their picture.

Upload the files on GitHub (**Add file → Upload files** in this folder); the website updates on the next publish. The tests check that every picture in the list has a file here.
