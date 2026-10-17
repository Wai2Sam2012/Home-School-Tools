# Arithmetic Odyssey

An offline math adventure game for the iPad, with two themes: **Dino Tour** and **Off-Roading** (US national parks). The game is planned in [GAME-PLAN.md](GAME-PLAN.md) and will be built here in stages.

## Contents

| Path | Description |
| --- | --- |
| [index.html](index.html) | The game's page. The screens are drawn by `js/app.js`. |
| [GAME-PLAN.md](GAME-PLAN.md) | Plan and AI-agent brief for the game, with build stages, a test plan and decisions. |
| [themes/dino/](themes/dino/) | Dino Tour theme. The top 20 dinosaurs from each period, with a quick list and a detailed summary of each one: [Triassic](themes/dino/triassic.md), [Jurassic](themes/dino/jurassic.md), [Cretaceous](themes/dino/cretaceous.md). [game-text.json](themes/dino/game-text.json) has the kid-friendly facts and story text; `pictures/` has the pictures (see [Adding pictures](#adding-pictures)). |
| [themes/national-parks/](themes/national-parks/) | Off-Roading theme. All 63 US national parks, grouped by region, with location, size, 2025 visitors, key attractions and history. [PICTURES.md](themes/national-parks/PICTURES.md) says what pictures to collect, their size, and the folder for each park. |
| [tools/Get-DinoPictures.ps1](tools/Get-DinoPictures.ps1) | PowerShell script that downloads each dinosaur's pictures from dinosaurpictures.org. See below. |
| [tools/Run-DinoPictures.cmd](tools/Run-DinoPictures.cmd) | Double-click launcher for the script. |
| [tools/Get-ParkPictures.ps1](tools/Get-ParkPictures.ps1) | PowerShell script that downloads about 5 photos of each national park attraction from Wikimedia Commons, with their credits. See [Downloading the national park pictures](#downloading-the-national-park-pictures). |
| [images/blocks/](images/blocks/) | Counting blocks (1 to 10, and 100), each value in its own color, for counting tips; made by `js/blocks.js` and `tools/build-blocks.mjs`. See [its README](images/blocks/README.md). |
| [tools/Run-ParkPictures.cmd](tools/Run-ParkPictures.cmd) | Double-click launcher for the park script. |
| [js/](js/) | The game's code. `app.js` starts the game and switches screens; each screen is in `js/screens/`. `adventure.js` has the adventure rules (steps, flags, detours, going back to a flag, unlocking stickers). `avatars.js` lists the player pictures (the files are in `images/avatars/`), `detour-road.js` draws the detour loop on the trail map, `audio.js` makes the sound effects, `speech.js` reads aloud (and knows reliably when it has finished), and `timer.js` is the thinking timer. `math.js` is the math engine: it makes problems for each operation and difficulty and checks answers. `keypad.js` is the on-screen keypad, `hold.js` the grown-up "hold for 3 seconds" button, `profiles.js` and `settings.js` the players and their settings, `storyline.js` loads a theme's story file, and `art.js` draws a picture for stickers that don't have one. `debug.js` is the debug panel; `version.js` holds the version number. |
| [css/style.css](css/style.css) | The game's styles. |
| [images/avatars/](images/avatars/) | The 16 player pictures, one file each, so they can be edited or replaced. See its [README](images/avatars/README.md). |
| [tools/Start-LocalServer.ps1](tools/Start-LocalServer.ps1) | Runs the game in a browser on your PC. See [Testing in a browser on your PC](#testing-in-a-browser-on-your-pc). |
| [tools/set-version.mjs](tools/set-version.mjs) | Sets a new version number, and the matching `?v=` tag on every game file, so browsers never mix cached files from two versions. Run `node tools/set-version.mjs 1.2.3` for each release. |
| [tools/build-storyline.mjs](tools/build-storyline.mjs) | Builds each theme's story file (`storyline.json`) from its fact files, `game-text.json` and pictures. Run automatically; see [Adding pictures](#adding-pictures). |
| [tests/](tests/) | Automated tests. See [Running the tests](#running-the-tests). |
| [package.json](package.json) | Only tells Node.js that the game's `.js` files are modules, so the tests can load them. No packages are installed. |

Each theme keeps all of its resources (facts, story text, pictures, sounds and the built story file) in its own folder under `themes/`.

## Build progress

| Stage | Status |
| --- | --- |
| 0. Project setup and first publish | Done: placeholder page, local server, debug panel and publishing workflow. The iPad check (T0.4) runs after the first publish. |
| 1. Math engine | Done: `js/math.js` |
| 2. Theme content | Both themes can be played. **Dino Tour:** Triassic pictures are in; Jurassic and Cretaceous show a drawing until their pictures are added. **Off-Roading (first version, 0.5.6):** all 63 parks with kid-friendly facts and truck story text; the 8 Alaska parks have pictures, the other parks show a drawing until theirs are added. |
| 3. Screens and keypad | Done: Tap to Start, players, home, Setup, Sticker Album, Stats and grown-up Settings, with the on-screen keypad, in portrait and landscape. |
| 4. The adventure | Done: the trail map with a flag every 10 steps, detours after a wrong answer (called **wandering** in the game: "Wandering question 1 of 3"), going back to the last flag when a whole detour is missed, Resume Adventure, and Trail's End with the new sticker, a slideshow of its pictures and a trip summary. |
| 5. Sound, voice and timer | Done: sound effects, questions and story moments read aloud with a Repeat button, the thinking timer (shown on Trail's End), and a "Tap to continue" screen when the iPad pauses sound. Grown-ups can turn the voice and the sound effects on or off in Settings, choose the voice and its speed (tap a voice to hear it), and see which voice is used. |
| 6. Saving, stats, high scores and backup | Done (0.6.0): players, settings, stickers and the adventure in progress are saved on the iPad and survive closing the game; Need More Practice and high scores in My Stats; Back up and Restore (with undo) in Grown-up Settings. See [Saving and backup](#saving-and-backup). **0.6.1:** Learn from Incorrect, and recorded flag sounds. **0.6.2:** three dinosaur roars and two truck engines, picked at random at each flag. **0.6.3:** 🙏 Help (counting blocks) for addition and subtraction (high scores also weigh Help used), two dirt bike flag sounds, detours are called "wandering", and the answer is typed straight into the question. |
| 7–8 | Not started |

## Running the tests

The tests need [Node.js](https://nodejs.org/) (the LTS version) installed on your PC. It is only used for testing, not to play the game. In PowerShell:

```powershell
cd arithmetic-odyssey
node --test
```

You should see `# fail 0` (201 tests in version 0.6.3). Each test name starts with its ID from the test plan in [GAME-PLAN.md](GAME-PLAN.md) where it has one, for example `T1.3`.

## Testing in a browser on your PC

The game has to run from a web server, not by double-clicking `index.html`: browsers only allow the game's modules and offline mode from `http://localhost` or HTTPS. A small server is included:

```powershell
cd arithmetic-odyssey\tools
Unblock-File .\Start-LocalServer.ps1    # only needed once, for files downloaded from GitHub
pwsh -ExecutionPolicy Bypass -File .\Start-LocalServer.ps1
```

It first rebuilds the story files if Node.js is installed (otherwise it warns and uses the last build), then serves the whole repository and opens the game at `http://localhost:8080/arithmetic-odyssey/`, the same folder layout as the published site. Add `?debug=1` to the address to show the debug panel. Press **Ctrl+C** in the PowerShell window to stop the server. If port 8080 is busy, add `-Port 8081`.

To see the game at iPad size, press **F12** in Chrome or Edge, then **Ctrl+Shift+M**, and choose an iPad from the device list.

The debug panel sits in the top-right corner; **Hide** folds it away. Besides the device facts, it has buttons to **add a test player**, **collect the next 5 Dino stickers** (to try the Sticker Album) and **remove the player's stickers**. It can also open the **voice and sound tester**, which plays every English voice on the device with a choice of sample line, speed and pitch (or all of them in turn, saying each name) and every sound effect, and make speech **pretend the end event never comes**, to check the game never waits on speech. During an adventure, it can also **answer right** or **answer wrong** (to force a detour or a trip back to the flag) and **jump to just before the next flag** or **to the last step**. **Delete this game's saved data** starts over with no players.

**Grown-up Settings** opens by holding the **Grown-ups** button on a player's home screen for 3 seconds. Deleting a player is there, so children can't do it by accident.

## Publishing and testing on the iPad

Every push to the repository's `main` branch runs `.github/workflows/deploy.yml`, which runs the tests and, if they pass, publishes the site to GitHub Pages:

- Start page: `https://wai2sam2012.github.io/Home-School-Tools/`
- Game: `https://wai2sam2012.github.io/Home-School-Tools/arithmetic-odyssey/`

**One-time setup:** in the repository on GitHub, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**. Without this, the deploy step fails.

The **Actions** tab shows each run; a green tick means it published. Tests, tools and `downloaded-pictures` are never published. To preview exactly what will be published, run `node .github/scripts/assemble-site.mjs` from the repository folder; it copies the site into `_site`.

## Saving and backup

**What is saved.** Players, their settings, stickers, high scores, the last 10 games and any adventure in progress are saved on the iPad as they change: an adventure after every question, so closing the game never loses more than the question on screen. When the game opens again, **Resume Adventure** carries on from the same question.

**Where.** Only on this iPad, in the browser's storage. Nothing is sent anywhere, and it is not synced to other devices. The Safari tab and the Home Screen app (Stage 7) keep **separate** saves, so always play from the same one. Grown-up Settings shows how much space the save uses.

**My Stats.**
- **Need More Practice:** the problems missed most often in the last 10 games, then ones that took 5 seconds or more.
- **High Scores:** one board for each adventure length and difficulty, top 10. The most right answers (as a share of all answers) win; then the shortest total thinking time; then the least 🙏 Help. A trip that went back to a flag still counts when it is finished.
- **Help (counting blocks):** the 🙏 Help button on an addition or subtraction question shows it with counting blocks (for 7 + 5: the 7 block, +, the 5 block, = and ?), in place of the trail map while it is open. The button sits in front of the question when the iPad stands upright, and under it when the iPad lies sideways. Each question's Help counts once in the trip's "Help used".
- **Typing an answer:** the digits show in orange in the question, in place of the ?.
- **Learn from Incorrect** (under Need More Practice): a short, calm round with those problems (up to 8), with no trail or setbacks. Each problem has to be answered right twice (a slow one, within 5 seconds); a wrong answer shows the right one, and the problem comes back two questions later. The round ends when all are learned or after 4 tries each. A learned problem leaves Need More Practice until it is missed or slow again in a later game.

**Back up** (Grown-up Settings) makes one file, `arithmetic-odyssey-backup-YYYY-MM-DD.json`, with every player. On the iPad the share sheet opens: choose **Save to Files** (iCloud Drive keeps it off the iPad too). Settings reminds you after 5 finished adventures without a backup. Backups hold the children's names, so keep them private and never add them to this repository.

**Restore** opens Files to pick a backup, checks it and shows what is in it, then asks:
- **Replace everything:** the players on this iPad are replaced by the backup's.
- **Add as new players:** the backup's players are added; a name that is taken gets a number ("Sam 2").

A wrong or damaged file is refused and nothing changes. Before a restore the game keeps a copy of everything, so **Undo the last restore** puts it all back.

**If something goes wrong:** damaged saved data is set aside (kept under a `quarantine` name) and the game carries on with safe settings; a full or blocked storage shows a message suggesting a backup, and the game keeps working until it is closed. Settings lists any saving problems from this session.

## Credits

Picture and sound credits are in each theme's `CREDITS.md` ([Dino Tour](themes/dino/CREDITS.md), [Off-Roading](themes/national-parks/CREDITS.md)). The flag sounds are from [Freesound](https://freesound.org/); six are public domain (CC0), and one needs this credit:

- "Truck-Uphill.wav" by moshwe — https://freesound.org/s/554426/
  Licensed under CC BY 3.0: https://creativecommons.org/licenses/by/3.0/
  (Modified: trimmed/converted)

## Changing the game

Most things can be changed without knowing much code. After a change, run the tests (see [Running the tests](#running-the-tests)) and try it with the local server.

| To change | Edit |
| --- | --- |
| **Player pictures** | The files in [images/avatars/](images/avatars/); names and order in `js/avatars.js`. See [its README](images/avatars/README.md). |
| **Story text**: flags, detours ("wandering" in the game), getting back on the trail, going back to a flag | `themes/dino/game-text.json`: `milestones`, `detours` (`{count}` becomes the number of detour questions), `detourCleared` and `setback`. Each list can have any number of lines. |
| **Kid-friendly dinosaur facts** | `themes/dino/game-text.json`, under `kidFacts` (2 or 3 per dinosaur). |
| **What happens after a wrong answer** | What the screen shows (the answer crossed out in red, "✗ Incorrect ✗", and the question with the right answer on a green line under it) and the words read aloud ("Incorrect. 7 times 8 is 56."): `js/screens/adventure.js`, in `submit()`; the colours are in `css/style.css` under `.question.wrong-answer` and `.correct-line`. The **Got it ›** button is made just below it. The rules (a wrong answer starts a detour; all detour answers wrong goes back to the last flag): `js/adventure.js`, in `answerProblem()`. The number of detour questions is **Wandering length** in the game's grown-up Settings. |
| **Praise after a right answer** ("Great job!") | `PRAISE` at the top of `js/screens/adventure.js`. |
| **How long the game waits** after a right answer | `NEXT_AFTER_RIGHT_MS` at the top of `js/screens/adventure.js` (in milliseconds). |
| **Sound effects** | `js/audio.js`: `SOUNDS` lists the notes of each sound; `playRoar()` and `playEngine()` make the flag sounds. Hear them all in the voice and sound tester (`?debug=1`). |
| **Which sound plays at a flag** | The recordings in the theme's `sounds/` folder, `flag-1.mp3`, `flag-2.mp3` and so on: one is picked at random at each flag, never the same twice in a row (see [themes/dino/sounds/README.md](themes/dino/sounds/README.md)). Without any, `flagSound` for each theme in `js/settings.js`. |
| **The word for a detour** ("Wandering") | "Wandering question 1 of 3" in `js/screens/adventure.js` (`showQuestion()`); **Wandering length** in `js/screens/settings.js`; **Wanderings** on Trail's End in `js/screens/trail-end.js`; and the `detourCleared` and `setback` lines in each theme's `game-text.json`. The code itself still says detour. |
| **Counting blocks** (colors and sizes) | `BLOCKS` in `js/blocks.js`, then `node tools/build-blocks.mjs` to write the pictures again. See [images/blocks/README.md](images/blocks/README.md). |
| **Help (counting blocks, 🙏)** | Which problems have it: `hasTip()` and `TIP_OPERATIONS` in `js/blocks.js`; the picture: `tipSvg()` there; the card: `js/tip-card.js`; its look: `.tip-card` and `.tip-button` in `css/style.css` (`.tip-front` is the button in front of the question on an upright screen, `.tip-row` the one under it on a sideways screen). |
| **Learn from Incorrect** | `LEARN_NEEDS` (right answers to learn a problem), `LEARN_SPACING` and `LEARN_MAX_PROBLEMS` at the top of `js/learn.js`. |
| **How high scores are ranked** | `compareScores()` in `js/scores.js`; the board size and history length (10) at the top of the same file. |
| **When a problem counts as slow** in Need More Practice | `SLOW_MS` at the top of `js/scores.js` (5000 milliseconds). |
| **The backup reminder** | `BACKUP_REMINDER_GAMES` at the top of `js/profiles.js` (5 adventures). |
| **The detour road** on the trail map | Its shape in `js/detour-road.js` (`LOOP`); its colours in `css/style.css` under `.detour-road`. |

After changing any `.js` file, give the game a new version number so iPads load the new files: `node tools/set-version.mjs 1.2.3`.

## Adding pictures

Put each theme's pictures in its `pictures` folder, in a folder for the period and one for the dinosaur, just like the downloader makes them:

```
themes/dino/pictures/
├── Triassic/
│   ├── Eoraptor/        any-name.jpg, another.jpg, ...
│   └── Herrerasaurus/   ...
├── Jurassic/
│   └── Stegosaurus/     ...
└── Cretaceous/
    └── Tyrannosaurus/   ...
```

- **Folder names** must match a dinosaur in that period's list. Capitals and spaces don't matter, and the first word is enough (`Tyrannosaurus` for Tyrannosaurus rex, `Brontosaurus` for Apatosaurus / Brontosaurus). File names can be anything.
- **Size:** each picture at most 400 KB and 1600 pixels wide or tall (JPEG, PNG or WebP). The dinosaurpictures.org downloads already fit.
- **Credits:** `themes/dino/CREDITS.md` has a line covering every picture from dinosaurpictures.org. Add a line for a picture from anywhere else.
- **Any number per dinosaur.** In the Sticker Album, the arrows step through them. A dinosaur with no pictures yet shows a drawing.

You can upload pictures straight on GitHub (**Add file → Upload files** in the dinosaur's folder). Publishing rebuilds the story file (`storyline.json`, which is not stored in the repository), so new pictures appear on the website automatically. A misnamed folder stops the publish with a message naming the folder, and the tests check sizes and credits. To check before uploading, run this in the `arithmetic-odyssey` folder:

```powershell
node tools/build-storyline.mjs
```

It lists how many pictures each theme has and any problems.

## Downloading the dinosaur pictures

`tools/Get-DinoPictures.ps1` reads the dinosaurs from the period files in `themes/dino/` (`triassic.md`, `jurassic.md`, `cretaceous.md`), opens each one's gallery page on dinosaurpictures.org, and saves the pictures in a folder for each dinosaur, grouped by period. Every file name starts with the dinosaur's name:

```
themes/dino/downloaded-pictures/
├── Triassic/
│   ├── Eoraptor/        Eoraptor_1.jpg, ...
│   └── Herrerasaurus/   Herrerasaurus-ischigualastensis-..._9e39.jpg, ...
├── Jurassic/
│   └── Stegosaurus/     Stegosaurus_1.jpg, ...
├── Cretaceous/
│   └── Tyrannosaurus/   Tyrannosaurus_1.jpg, ...
└── download-log.csv
```

`downloaded-pictures` is the raw download folder. Copy the pictures you choose for the game into `themes/dino/pictures/`, keeping the same folders (see [Adding pictures](#adding-pictures)). The script needs the period files in `themes/dino/`, so download or clone the whole repository rather than the script on its own.

**Easiest way:** double-click `tools\Run-DinoPictures.cmd`. It:

- runs the script in PowerShell 7 if it is installed (otherwise Windows PowerShell 5.1),
- keeps the window open at the end so you can read the result,
- opens the `downloaded-pictures` folder.

Right-clicking `Get-DinoPictures.ps1` and choosing **Run with PowerShell** also works, but that uses Windows PowerShell 5.1; the window waits for Enter before closing.

**From a PowerShell window**, which also lets you pass options. Use `pwsh` for PowerShell 7 or `powershell.exe` for Windows PowerShell 5.1:

```powershell
cd arithmetic-odyssey\tools

# Files downloaded from GitHub are blocked by default; unblock the script once.
Unblock-File .\Get-DinoPictures.ps1

# 1. Try one dinosaur and only list what would be downloaded.
pwsh -ExecutionPolicy Bypass -File .\Get-DinoPictures.ps1 -Dinosaur Eoraptor -ListOnly

# 2. Download everything (about 60 pages; takes a while because it pauses 1 second between requests).
pwsh -ExecutionPolicy Bypass -File .\Get-DinoPictures.ps1
```

Useful options:

- `-Dinosaur Eoraptor,Stegosaurus`: only these dinosaurs.
- `-MaxImagesPerDinosaur 5`: at most 5 pictures each.
- `-Force`: download again.
- `-OutputPath D:\DinoPictures`: save somewhere else.

Run `Get-Help .\Get-DinoPictures.ps1 -Full` for all of them.

What happens when something goes wrong:

- **Failures are logged, not fatal.** A page or picture that fails is logged in `download-log.csv` and the script carries on.
- **Exit codes:**
  - `0`: everything succeeded.
  - `1`: something failed.
  - `2`: the script could not start (for example, the period files are missing).
- **Re-running resumes.** Pictures that are already downloaded are never downloaded again (unless you use `-Force`). Only pictures that failed before are tried again.
- **Old layout.** Pictures saved by an earlier version of the script directly in a period folder (for example `Triassic\Eoraptor_1.jpg`) are moved into the dinosaur's folder instead of being downloaded again.
- **Full-size pictures.** When the site offers a resized copy of a picture, the original full-size picture is downloaded. The resized copy is used only if the original cannot be downloaded.
- **Other dinosaurs' thumbnails.** Gallery pages also show thumbnails of other dinosaurs, so only images whose web address contains the dinosaur's name are kept. If a page has none, all of its pictures are kept and marked `unfiltered` in the log, so check those by hand.
- **Missing pictures on the site.** Some pictures linked from the site no longer exist (the image server answers "NoSuchKey"). Those are logged as failed and can't be downloaded.

**This repository is public.** The pictures on dinosaurpictures.org come from many different artists, and their licenses are often unclear. `downloaded-pictures/` is listed in `.gitignore` so the raw downloads are never committed by accident. Only commit pictures you are allowed to share.

## Downloading the national park pictures

`tools/Get-ParkPictures.ps1` reads every park and its **Key attractions** from the region files in `themes/national-parks/` (63 parks, 252 attractions), searches [Wikimedia Commons](https://commons.wikimedia.org/) (the free photo library behind Wikipedia) for each attraction, and saves about 5 landscape photos of each one:

```
themes/national-parks/downloaded-pictures/
├── Southwest/
│   └── Arches/          Arches - Delicate Arch_1.jpg ... Arches - Landscape Arch_5.jpg
├── Alaska/
│   └── Denali/          Denali - The mountain_1.jpg ... Denali - Wildlife_5.jpg
├── download-log.csv
├── credits.csv          author, license and source page of every photo
└── CREDITS-lines.md     table lines ready to paste into themes/national-parks/CREDITS.md
```

The folders are the same as the game's (see [PICTURES.md](themes/national-parks/PICTURES.md)), so copy the photos you like into `themes/national-parks/pictures/` keeping the region and park folders. Then copy `credits.csv` to `themes/national-parks/credits.csv`: every picture listed in it counts as credited, so there are no lines to paste. (Pasting the lines from `CREDITS-lines.md` into `CREDITS.md` works too.)

- **Double-click** `tools\Run-ParkPictures.cmd`, or run it from PowerShell like the dinosaur script.
- **It takes a while:** every attraction is about 6 requests with a 1-second pause between them, so all 63 parks take about 30 minutes. Try one park first: `.\Get-ParkPictures.ps1 -Park Arches -ListOnly` lists what it would download.
- **Useful options:**
  - `-Park Arches,Zion` or `-Region Southwest`: only some parks.
  - `-PicturesPerAttraction 3`: fewer pictures.
  - `-ParkPicturesOnly`: 5 photos of each park instead of 5 per attraction (about 315 photos instead of about 1,260).
  - `-Force`: download again.
- **What it keeps:** only JPEG and PNG landscape photos at least 800 pixels wide. It skips maps, logos, signs and diagrams. If an attraction has too few photos (for example "Sled dog kennels"), general photos of the park fill the gap.
- **Size:** Commons sends copies 1024 pixels wide, the size the game uses, so most photos are 100 to 200 KB and already fit the game (at most 400 KB and 1600 pixels). The log marks any that are over 400 KB.
- **Re-running resumes:** photos already downloaded are skipped and never downloaded twice. A photo that fails to download is replaced by the next one found.
- **Exit codes:** 0 everything worked, 1 something failed (see `download-log.csv`), 2 the script could not start.
- **Credits:** every photo on Commons may be shared, but most licenses (CC BY, CC BY-SA) ask for a credit with the author and license. That is what `CREDITS-lines.md` is for. Public domain photos (most US government photos) need no credit, but keeping the line is good practice.

## Moving pictures you already downloaded

If you downloaded pictures with the earlier version of the script (in the `Claude_Playground` repository, under `Arithmetic Odyssey\Dino\Pictures\`), move that folder's contents into `arithmetic-odyssey\themes\dino\downloaded-pictures\`. The next run skips everything already there.
