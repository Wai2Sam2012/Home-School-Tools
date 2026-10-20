# Intermediate and Advanced sticker sets

Each theme has a separate set of stickers for each level, so one level can't fill the whole album:

| Level | Where its stickers come from |
| --- | --- |
| Beginner | The theme's main list (the dinosaur period files or the park region files), as before. |
| Intermediate | `themes/<theme>/levels/intermediate/` |
| Advanced | `themes/<theme>/levels/advanced/` |

`<theme>` is `dino` (Dinosaur Adventure) or `national-parks` (Off-Roading).

Until a set has stickers, a trip at that level still counts for stats and high scores, but gives no sticker: Trail's End, the trip planner and the album say that level's stickers are "coming soon".

## Adding a set

1. Fill in `stickers.json` in the level's folder. It is a list, in the order the stickers are unlocked:

   ```json
   [
     {
       "name": "Spinosaurus",
       "section": "Cretaceous",
       "facts": ["It had a big sail on its back.", "It caught fish."],
       "details": ["Found in: North Africa"]
     }
   ]
   ```

   - `name` (required): shown on the sticker; each name only once.
   - `facts` (at least 2): the kid-friendly facts, read aloud by 🔊 Read to me.
   - `section` (optional): the album groups stickers under these headings, for example a period or a region.
   - `details` (optional): extra lines on the album card.

2. Put each sticker's pictures in `pictures/<sticker name>/` inside the level's folder, for example `themes/dino/levels/intermediate/pictures/Spinosaurus/spinosaurus-1.jpg` (`.jpg`, `.jpeg`, `.png` or `.webp`, at most about 400 KB each).

3. Credit every picture in the theme's `CREDITS.md` or `credits.csv`, like the theme's other pictures.

4. Run `node tools/build-storyline.mjs` (the local server and the publish step do this for you). It lists the set's stickers, and stops with a `PROBLEM` line for a missing name, fewer than 2 facts, a name used twice, or a picture folder with no matching sticker.

A player's stickers are saved for each theme and level separately (`dino`, `dino.intermediate`, `dino.advanced`, ...), so adding a set never changes what a player already has.
