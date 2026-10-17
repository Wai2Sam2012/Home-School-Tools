# Player pictures

The 16 pictures players choose from when they make a profile, each in 5 colors. Players pick a picture, then a color; they can change either later by tapping their picture on Home. The chosen picture also travels the trail map during an adventure, so **every picture must face right** (toward the finish).

The game shows the color files (`cat/orange.png` and so on, below). The `.svg` drawings in this folder are kept as a stand-in: if a color's file is missing or damaged, the game shows that picture's drawing instead.

| Folder | Picture | Colors 1–5 |
| --- | --- | --- |
| `longneck/` | Long-neck dinosaur | green, blue, brown, purple, teal |
| `triceratops/` | Triceratops | green, blue, brown, purple, gold |
| `trex/` | T. rex | green, blue, orange, purple, olive |
| `mosasaur/` | Mosasaur | blue, teal, gray, purple, green |
| `pterosaur/` | Pterosaur | orange, green, blue, red, purple |
| `pickup/` | Pickup truck | red, blue, black, white, green |
| `monstertruck/` | Monster truck | red, blue, green, purple, yellow |
| `dirtbike/` | Dirt bike | red, blue, green, orange, yellow |
| `suv/` | SUV | white, black, blue, red, green |
| `atv/` | ATV | red, blue, green, yellow, purple |
| `robot/` | Robot | white, red, teal, yellow, green |
| `rocket/` | Rocket | red, blue, teal, black, purple |
| `butterfly/` | Butterfly | orange, blue, pink, purple, green |
| `unicorn/` | Unicorn | pink, blue, rainbow, lavender, white and gold (`whitegold`) |
| `dog/` | Dog | golden, black, brown and white (`brownwhite`), husky, white |
| `cat/` | Cat | orange, gray, black, light brown (`lightbrown`), calico |

## Five colors of each picture

Each picture has a folder with its five colors, for example `cat/orange.png` … `cat/calico.png`. They are cut from the author's avatar catalog (80 pictures: 16 characters, 5 colors each).

- **Order:** color 1 to 5 is the order in `AVATAR_COLORS` in `js/avatars.js`, the same order as the catalog.
- **Size:** each is a 256 × 256 PNG with a see-through background, under 100 KB (about 15 KB each; 1.2 MB for all 80, so they can be saved for offline play).
- **Facing:** every picture faces right, toward the finish on the trail map. The T. rex, pterosaur, unicorn and dirt bike faced left in the catalog and were flipped. The cat, dog, robot and butterfly face the front.
- The catalog itself is not kept here, since everything in this folder is published with the game.

## Changing a picture

- **Replace a color:** save a square PNG with a see-through background, facing right, over the old file with the same name (for example `cat/gray.png`). 256 × 256 pixels and under 100 KB, so the game stays quick and can be saved for offline play; the tests check this.
- **Rename a picture:** change its `label` in `js/avatars.js`. Don't change the `id` or the color file names: saved players use them to remember their picture and color (color 1–5 is the position in `AVATAR_COLORS`).
- **Add a new picture:** make a folder here with its 5 colors, then add a line to `AVATARS` (a new `id`, a `label` and a stand-in drawing `file`) and to `AVATAR_COLORS` in `js/avatars.js`.

Upload the files on GitHub (**Add file → Upload files** in this folder); the website updates on the next publish.
