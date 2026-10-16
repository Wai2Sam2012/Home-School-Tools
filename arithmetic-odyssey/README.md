# Arithmetic Odyssey

An offline math adventure game for the iPad, with two themes: **Dino Tour** and **Truck Off-Road** (US national parks). The game is planned in [GAME-PLAN.md](GAME-PLAN.md) and will be built here in stages.

## Contents

| Path | Description |
| --- | --- |
| [index.html](index.html) | The game's page. For now a placeholder that shows the version and checks the math engine loads. |
| [GAME-PLAN.md](GAME-PLAN.md) | Plan and AI-agent brief for the game, with build stages, a test plan and decisions. |
| [themes/dino/](themes/dino/) | Dino Tour theme. The top 20 dinosaurs from each period, with a quick list and a detailed summary of each one: [Triassic](themes/dino/triassic.md), [Jurassic](themes/dino/jurassic.md), [Cretaceous](themes/dino/cretaceous.md). |
| [themes/national-parks/](themes/national-parks/) | Truck Off-Road theme. All 63 US national parks, grouped by region, with location, size, 2025 visitors, key attractions and history. |
| [tools/Get-DinoPictures.ps1](tools/Get-DinoPictures.ps1) | PowerShell script that downloads each dinosaur's pictures from dinosaurpictures.org. See below. |
| [tools/Run-DinoPictures.cmd](tools/Run-DinoPictures.cmd) | Double-click launcher for the script. |
| [js/](js/) | The game's code. `math.js` is the math engine (Stage 1): it makes problems for each operation and difficulty and checks answers. `debug.js` is the debug panel; `version.js` holds the version number. |
| [css/style.css](css/style.css) | The game's styles. |
| [tools/Start-LocalServer.ps1](tools/Start-LocalServer.ps1) | Runs the game in a browser on your PC. See [Testing in a browser on your PC](#testing-in-a-browser-on-your-pc). |
| [tests/](tests/) | Automated tests. See [Running the tests](#running-the-tests). |
| [package.json](package.json) | Only tells Node.js that the game's `.js` files are modules, so the tests can load them. No packages are installed. |

Each theme keeps all of its resources (facts, pictures, sounds and, later, the game's story file) in its own folder under `themes/`.

## Build progress

| Stage | Status |
| --- | --- |
| 0. Project setup and first publish | Done: placeholder page, local server, debug panel and publishing workflow. The iPad check (T0.4) runs after the first publish. |
| 1. Math engine | Done: `js/math.js` |
| 2–8 | Not started |

## Running the tests

The tests need [Node.js](https://nodejs.org/) (the LTS version) installed on your PC. It is only used for testing, not to play the game. In PowerShell:

```powershell
cd arithmetic-odyssey
node --test
```

You should see `# fail 0` (32 tests at the end of Stage 1). Each test name starts with its ID from the test plan in [GAME-PLAN.md](GAME-PLAN.md) where it has one, for example `T1.3`.

## Testing in a browser on your PC

The game has to run from a web server, not by double-clicking `index.html`: browsers only allow the game's modules and offline mode from `http://localhost` or HTTPS. A small server is included:

```powershell
cd arithmetic-odyssey\tools
Unblock-File .\Start-LocalServer.ps1    # only needed once, for files downloaded from GitHub
pwsh -ExecutionPolicy Bypass -File .\Start-LocalServer.ps1
```

It serves the whole repository and opens the game at `http://localhost:8080/arithmetic-odyssey/`, the same folder layout as the published site. Add `?debug=1` to the address to show the debug panel. Press **Ctrl+C** in the PowerShell window to stop the server. If port 8080 is busy, add `-Port 8081`.

To see the game at iPad size, press **F12** in Chrome or Edge, then **Ctrl+Shift+M**, and choose an iPad from the device list.

## Publishing and testing on the iPad

Every push to the repository's `main` branch runs `.github/workflows/deploy.yml`, which runs the tests and, if they pass, publishes the site to GitHub Pages:

- Start page: `https://wai2sam2012.github.io/Home-School-Tools/`
- Game: `https://wai2sam2012.github.io/Home-School-Tools/arithmetic-odyssey/`

**One-time setup:** in the repository on GitHub, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**. Without this, the deploy step fails.

The **Actions** tab shows each run; a green tick means it published. Tests, tools and `downloaded-pictures` are never published. To preview exactly what will be published, run `node .github/scripts/assemble-site.mjs` from the repository folder; it copies the site into `_site`.

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
