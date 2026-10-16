# Arithmetic Odyssey

An offline math adventure game for the iPad, with two themes: **Dino Tour** and **Off-Roading** (US national parks). The game is planned in [GAME-PLAN.md](GAME-PLAN.md) and will be built here in stages.

## Contents

| Path | Description |
| --- | --- |
| [index.html](index.html) | The game's page. The screens are drawn by `js/app.js`. |
| [GAME-PLAN.md](GAME-PLAN.md) | Plan and AI-agent brief for the game, with build stages, a test plan and decisions. |
| [themes/dino/](themes/dino/) | Dino Tour theme. The top 20 dinosaurs from each period, with a quick list and a detailed summary of each one: [Triassic](themes/dino/triassic.md), [Jurassic](themes/dino/jurassic.md), [Cretaceous](themes/dino/cretaceous.md). [game-text.json](themes/dino/game-text.json) has the kid-friendly facts and story text; `pictures/` has the pictures (see [Adding pictures](#adding-pictures)). |
| [themes/national-parks/](themes/national-parks/) | Off-Roading theme. All 63 US national parks, grouped by region, with location, size, 2025 visitors, key attractions and history. |
| [tools/Get-DinoPictures.ps1](tools/Get-DinoPictures.ps1) | PowerShell script that downloads each dinosaur's pictures from dinosaurpictures.org. See below. |
| [tools/Run-DinoPictures.cmd](tools/Run-DinoPictures.cmd) | Double-click launcher for the script. |
| [js/](js/) | The game's code. `app.js` starts the game and switches screens; each screen is in `js/screens/`. `adventure.js` has the adventure rules (steps, flags, detours, going back to a flag, unlocking stickers). `audio.js` makes the sound effects, `speech.js` reads aloud (and knows reliably when it has finished), and `timer.js` is the thinking timer. `math.js` is the math engine: it makes problems for each operation and difficulty and checks answers. `keypad.js` is the on-screen keypad, `hold.js` the grown-up "hold for 3 seconds" button, `profiles.js` and `settings.js` the players and their settings, `storyline.js` loads a theme's story file, and `art.js` draws a picture for stickers that don't have one. `debug.js` is the debug panel; `version.js` holds the version number. |
| [css/style.css](css/style.css) | The game's styles. |
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
| 2. Theme content | Dino theme done: story file builder, kid-friendly facts, story text and picture checks. Triassic pictures are in; Jurassic and Cretaceous show a drawing until their pictures are added. The Parks theme comes later. |
| 3. Screens and keypad | Done: Tap to Start, players, home, Setup, Sticker Album, Stats and grown-up Settings, with the on-screen keypad, in portrait and landscape. |
| 4. The adventure | Done: the trail map with a flag every 10 steps, detours after a wrong answer, going back to the last flag when a whole detour is missed, Resume Adventure, and Trail's End with the new sticker, a slideshow of its pictures and a trip summary. Players, stickers and trips are not saved yet (Stage 6). |
| 5. Sound, voice and timer | Done: sound effects, questions and story moments read aloud with a Repeat button, the thinking timer (shown on Trail's End), and a "Tap to continue" screen when the iPad pauses sound. Grown-ups can turn the voice and the sound effects on or off in Settings, which also says which voice is used. |
| 6–8 | Not started |

## Running the tests

The tests need [Node.js](https://nodejs.org/) (the LTS version) installed on your PC. It is only used for testing, not to play the game. In PowerShell:

```powershell
cd arithmetic-odyssey
node --test
```

You should see `# fail 0` (123 tests at the end of Stage 5). Each test name starts with its ID from the test plan in [GAME-PLAN.md](GAME-PLAN.md) where it has one, for example `T1.3`.

## Testing in a browser on your PC

The game has to run from a web server, not by double-clicking `index.html`: browsers only allow the game's modules and offline mode from `http://localhost` or HTTPS. A small server is included:

```powershell
cd arithmetic-odyssey\tools
Unblock-File .\Start-LocalServer.ps1    # only needed once, for files downloaded from GitHub
pwsh -ExecutionPolicy Bypass -File .\Start-LocalServer.ps1
```

It first rebuilds the story files if Node.js is installed (otherwise it warns and uses the last build), then serves the whole repository and opens the game at `http://localhost:8080/arithmetic-odyssey/`, the same folder layout as the published site. Add `?debug=1` to the address to show the debug panel. Press **Ctrl+C** in the PowerShell window to stop the server. If port 8080 is busy, add `-Port 8081`.

To see the game at iPad size, press **F12** in Chrome or Edge, then **Ctrl+Shift+M**, and choose an iPad from the device list.

The debug panel sits in the top-right corner; **Hide** folds it away. Besides the device facts, it has buttons to **add a test player**, **collect the next 5 Dino stickers** (to try the Sticker Album) and **remove the player's stickers**. It can also make speech **pretend the end event never comes**, to check the game never waits on speech. During an adventure, it can also **answer right** or **answer wrong** (to force a detour or a trip back to the flag) and **jump to just before the next flag** or **to the last step**. Players only last until the page reloads in this version.

**Grown-up Settings** opens by holding the **Grown-ups** button on a player's home screen for 3 seconds. Deleting a player is there, so children can't do it by accident.

## Publishing and testing on the iPad

Every push to the repository's `main` branch runs `.github/workflows/deploy.yml`, which runs the tests and, if they pass, publishes the site to GitHub Pages:

- Start page: `https://wai2sam2012.github.io/Home-School-Tools/`
- Game: `https://wai2sam2012.github.io/Home-School-Tools/arithmetic-odyssey/`

**One-time setup:** in the repository on GitHub, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**. Without this, the deploy step fails.

The **Actions** tab shows each run; a green tick means it published. Tests, tools and `downloaded-pictures` are never published. To preview exactly what will be published, run `node .github/scripts/assemble-site.mjs` from the repository folder; it copies the site into `_site`.

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

## Moving pictures you already downloaded

If you downloaded pictures with the earlier version of the script (in the `Claude_Playground` repository, under `Arithmetic Odyssey\Dino\Pictures\`), move that folder's contents into `arithmetic-odyssey\themes\dino\downloaded-pictures\`. The next run skips everything already there.
