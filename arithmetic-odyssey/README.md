# Arithmetic Odyssey

An offline math adventure game for the iPad, with two themes: **Dino Tour** and **Truck Off-Road** (US national parks). The game is planned in [GAME-PLAN.md](GAME-PLAN.md) and will be built here in stages.

## Contents

| Path | Description |
| --- | --- |
| [GAME-PLAN.md](GAME-PLAN.md) | Plan and AI-agent brief for the game, with build stages, a test plan and decisions. |
| [themes/dino/](themes/dino/) | Dino Tour theme. The top 20 dinosaurs from each period, with a quick list and a detailed summary of each one: [Triassic](themes/dino/triassic.md), [Jurassic](themes/dino/jurassic.md), [Cretaceous](themes/dino/cretaceous.md). |
| [themes/national-parks/](themes/national-parks/) | Truck Off-Road theme. All 63 US national parks, grouped by region, with location, size, 2025 visitors, key attractions and history. |
| [tools/Get-DinoPictures.ps1](tools/Get-DinoPictures.ps1) | PowerShell script that downloads each dinosaur's pictures from dinosaurpictures.org. See below. |
| [tools/Run-DinoPictures.cmd](tools/Run-DinoPictures.cmd) | Double-click launcher for the script. |
| [js/math.js](js/math.js) | The game's math engine: makes problems for each operation and difficulty, and checks answers (Stage 1). |
| [tests/](tests/) | Automated tests. See [Running the tests](#running-the-tests). |
| [package.json](package.json) | Only tells Node.js that the game's `.js` files are modules, so the tests can load them. No packages are installed. |

Each theme keeps all of its resources (facts, pictures, sounds and, later, the game's story file) in its own folder under `themes/`.

## Build progress

| Stage | Status |
| --- | --- |
| 0. Project setup and first publish | Not started (the test runner part works) |
| 1. Math engine | Done: `js/math.js`, 17 tests passing |
| 2–8 | Not started |

## Running the tests

The tests need [Node.js](https://nodejs.org/) (the LTS version) installed on your PC. It is only used for testing, not to play the game. In PowerShell:

```powershell
cd arithmetic-odyssey
node --test
```

You should see `# pass 17` and `# fail 0`. Each test name starts with its ID from the test plan in [GAME-PLAN.md](GAME-PLAN.md), for example `T1.3`.

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

`downloaded-pictures` is the raw download folder. The pictures you choose for the game are resized and copied into `themes/dino/pictures/` in Stage 2 of the game plan. The script needs the period files in `themes/dino/`, so download or clone the whole repository rather than the script on its own.

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
