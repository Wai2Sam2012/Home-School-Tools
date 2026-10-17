# Off-Roading pictures: what to collect

Each of the 63 parks becomes a sticker. Like the Dino theme, the game shows a park's pictures on its sticker card (changing every 3 seconds), in the Sticker Album, at the finish of the trail and on Trail's End.

## Size and format

| | Best | Allowed |
| --- | --- | --- |
| **Shape** | Landscape (wider than tall), about 3:2, for example 1200 × 800 | Any shape; the whole picture is always shown |
| **Size** | 1200 to 1600 pixels on the longest side | At most **1600 pixels** on the longest side |
| **File size** | 150 to 300 KB | At most **400 KB** per picture |
| **Format** | JPEG (`.jpg`), quality about 80% | JPEG, PNG or WebP |
| **How many** | 3 to 5 per park | Any number; a park with none shows a drawing |

All 63 parks with 4 pictures each at about 250 KB is about 63 MB. The game should stay under about 50 MB per theme, so aim for about 3 pictures per park, or 4 smaller ones (about 200 KB).

To make a photo smaller on Windows: open it in **Photos** › **⋯** › **Resize image**, choose a custom width of 1600 pixels and quality 80, and save a copy. (A resize script will be added with this theme.)

## Where to find pictures you may share

The game is published, so only use pictures you are allowed to share:

- **National Park Service photos** are usually in the public domain (free to use). Each park's website has a **Photos & Multimedia** page, and the [NPS Gallery](https://www.nps.gov/media/multimedia-search.htm) has thousands. Check the credit line under each photo: one that says "NPS" or "NPS Photo" is public domain; a photo credited to a person may not be.
- **Wikimedia Commons** ([commons.wikimedia.org](https://commons.wikimedia.org/)) has photos of every park; most allow sharing with a credit (write the author and license in `CREDITS.md`).
- **Your own photos** from your trips.

Add a line to [CREDITS.md](CREDITS.md) for each picture (or one line for a whole folder, such as `pictures/**` if they all come from the NPS).

## Folders

One folder per region and one per park, without "National Park", just like the Dino folders. File names can be anything.

```
themes/national-parks/pictures/
├── Alaska/
│   ├── Denali/        denali-1.jpg, denali-2.jpg, ...
│   └── Katmai/        ...
├── Southwest/
│   └── Grand Canyon/  ...
└── ...
```

| Region folder | Park folders |
| --- | --- |
| `Alaska` | Denali, Gates of the Arctic, Glacier Bay, Katmai, Kenai Fjords, Kobuk Valley, Lake Clark, Wrangell-St Elias |
| `California` | Channel Islands, Death Valley, Joshua Tree, Kings Canyon, Lassen Volcanic, Pinnacles, Redwood, Sequoia, Yosemite |
| `Pacific` | American Samoa, Crater Lake, Haleakala, Hawaii Volcanoes, Mount Rainier, North Cascades, Olympic |
| `Southwest` | Arches, Big Bend, Bryce Canyon, Canyonlands, Capitol Reef, Carlsbad Caverns, Grand Canyon, Great Basin, Guadalupe Mountains, Petrified Forest, Saguaro, White Sands, Zion |
| `Rockies-and-Plains` | Badlands, Black Canyon of the Gunnison, Glacier, Grand Teton, Great Sand Dunes, Mesa Verde, Rocky Mountain, Theodore Roosevelt, Wind Cave, Yellowstone |
| `Midwest` | Cuyahoga Valley, Gateway Arch, Indiana Dunes, Isle Royale, Voyageurs |
| `East-and-Caribbean` | Acadia, Biscayne, Congaree, Dry Tortugas, Everglades, Great Smoky Mountains, Hot Springs, Mammoth Cave, New River Gorge, Shenandoah, Virgin Islands |

When the theme is built, the story file builder will check these folder names the same way it does for the dinosaurs, and say which folder doesn't match a park.
