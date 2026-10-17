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

## Changing a picture

- **Edit the drawing:** the files are SVG drawings. Open one in a free editor such as [Inkscape](https://inkscape.org/) (Windows/Mac), or in an online editor such as [Boxy SVG](https://boxy-svg.com/) or [SVG-Edit](https://svgedit.netlify.app/editor/index.html), then save it with the same name. Keep it square.
- **Use your own picture instead:** save it here as a PNG or JPEG (square, at least 256 × 256 pixels, transparent background looks best). Then open `js/avatars.js` and change that picture's `file`, for example `file: 'trex.png'`.
- **Add a new picture:** put the file here and add a line to the list in `js/avatars.js` with a new `id`, a `label` (the name shown under the picture) and the `file`.
- **Rename a picture:** change its `label` in `js/avatars.js`. Don't change the `id`: saved players use it to remember their picture.

Upload the files on GitHub (**Add file → Upload files** in this folder); the website updates on the next publish. The tests check that every picture in the list has a file here.
