# Arithmetic Odyssey: Game Plan

A plan for an offline, iPad-friendly math adventure game, written so it can be handed to an AI coding agent.

**How to use this document**

- **Part 1** is the brief for the agent: what to build and the rules it must follow.
- **Part 2** breaks the work into stages. Each stage has its own tests, so you can ask the agent for one stage at a time and check it before moving on.
- **Part 3** explains how to test on a PC and on the iPad.
- **Part 4** lists the decisions already made and the few still open, with the default the agent should use until you decide otherwise.

Give the agent the whole file and tell it which stage to work on, for example: *"Read the Game Plan and build Stage 1."*

**Where to run each stage**

| Stages | Where | Why |
|---|---|---|
| 0, 1, 3–7 | A cloud session or Claude on your PC | Both can run the automated tests and a headless browser |
| 2 (pictures) | Claude on your PC | You choose the pictures, and they are on your computer |
| iPad tests in every stage | You, on the iPad | Needs Safari and a real iPad, using the published test site |

---

## Part 1: Brief for the AI agent

### 1.1 Your role and how to work

You are an expert front-end web developer building a complete, kid-friendly math adventure game that runs on an iPad, using plain HTML, CSS and JavaScript.

- **Build in stages.** Work only on the stage you are asked for (see Part 2). Finish each stage with its tests passing before starting the next.
- **Ask before you guess.** Before starting, list anything unclear and ask. If you must make an assumption, write it down in your stage report.
- **Report honestly.** At the end of each stage, report what you built, which tests passed, which tests you could not run, and why. Never claim something was tested on an iPad, or works offline, unless that test was actually performed.

### 1.2 Who it is for

- Players are young children, ages 6–10 unless told otherwise. Keep text short and simple, buttons large and friendly, and all feedback encouraging.
- Several children can share one iPad, each with their own profile.

### 1.3 Technology rules

- Plain HTML, CSS and JavaScript only. No frameworks (including Tailwind), no libraries and no build or compile step.
- Nothing may be loaded from the internet while playing: no CDNs, remote fonts, remote images or third-party services.
- The game must work fully offline once it has been installed and its files have been saved on the device.
- Developer-only tools are allowed if they are not part of the game itself:
  - Node.js (LTS version) must be installed on the developer's PC to run the automated tests with Node's built-in test runner (`node --test`). No npm packages are needed.
  - Optional browser automation for testing.
- Any helper scripts for Windows must be PowerShell scripts that work in Windows PowerShell 5.1 and are tested in PowerShell 7.

### 1.4 Repository and folder structure

**Where the code lives**

- The game lives in the public GitHub repository **Home-School-Tools**, in the `arithmetic-odyssey/` folder. Other home-school tools can sit beside it later.
- Each theme keeps all of its resources (facts, story file, pictures, sounds and credits) in its own folder under `themes/`.
- Folder and file names use lowercase letters and hyphens, with no spaces, so web addresses stay simple.

```
Home-School-Tools/                public repository
├── index.html                    simple start page that links to each tool
├── README.md
├── .github/workflows/deploy.yml  publishes the whole site to GitHub Pages
└── arithmetic-odyssey/           the game
    ├── index.html
    ├── manifest.json
    ├── sw.js                     service worker (offline support)
    ├── offline.html              friendly page if something fails offline
    ├── css/style.css
    ├── js/game.js                screens, adventure loop, progress, timer
    ├── js/math.js                problem generation and answer checking
    ├── js/storage.js             profiles, saving, stats, backup and restore
    ├── js/audio.js               sound effects and voice
    ├── icons/                    app icons (192×192, 512×512, Apple touch icon)
    ├── themes/
    │   ├── dino/                 "Dino Tour" theme
    │   │   ├── triassic.md, jurassic.md, cretaceous.md   facts for 60 dinosaurs
    │   │   ├── game-text.json    kid-friendly facts and story text (milestones, detours)
    │   │   ├── storyline.json    built, not stored in git: stickers in order, facts, pictures
    │   │   ├── pictures/         pictures chosen by you: pictures/<Period>/<Dinosaur>/*.jpg
    │   │   ├── sounds/           optional theme sounds
    │   │   ├── CREDITS.md        where each picture came from
    │   │   └── downloaded-pictures/   raw downloads (excluded from git)
    │   └── national-parks/       "Off-Roading" theme, same layout;
    │                             facts in README.md and the 7 region files
    ├── tests/                    automated tests (not published)
    ├── tools/                    PowerShell helpers, including the picture
    │                             downloader (not published)
    ├── GAME-PLAN.md              this plan
    └── README.md
```

**Where the facts come from**

Each theme's Markdown files in its `themes/` folder, plus the kid-friendly facts and story text in its `game-text.json`. `tools/build-storyline.mjs` reads them, finds the pictures, and writes the theme's `storyline.json`, which the game loads. The deploy workflow and `tools/Start-LocalServer.ps1` run the build, so `storyline.json` is not stored in git and pictures uploaded on GitHub show up on the next publish.

### 1.5 Themes and content

| Theme | Journey | Fact source | Stickers, in this order |
|---|---|---|---|
| **Dino Tour** | Travel through the Triassic, Jurassic and Cretaceous | `themes/dino/triassic.md`, `jurassic.md`, `cretaceous.md` | 60 dinosaurs: Triassic #1–20, then Jurassic #1–20, then Cretaceous #1–20 |
| **Off-Roading** | Drive a truck to national parks across the US | `themes/national-parks/README.md` and the region files | 63 parks: region by region in the order of the README's region table, alphabetically within each region |

**Facts**

- Build each theme's `storyline.json` from the Markdown files and `game-text.json`.
- Each sticker needs a name, its place in the order, a picture, and two or three short, kid-friendly facts taken from those files. Do not invent facts.
- Keep the order in `storyline.json`, so it can be changed later without changing code.

**Pictures**

- You choose the pictures (for dinosaurs, usually from `themes/dino/downloaded-pictures/`) and put them in the theme's `pictures/` folder, in the same layout the downloader uses: `pictures/<Period>/<Dinosaur>/<any name>.jpg`. Any number per dinosaur; the file names don't matter. A folder name that doesn't match a dinosaur fails the build, so typos are caught.
- Each picture must be at most 400 KB and 1600 px on its longest side (JPEG, PNG or WebP). The dinosaurpictures.org downloads already fit, so the resize script, `tools/Resize-Pictures.ps1`, is postponed to the Parks theme, whose photos will be larger.
- Every picture has a line in the theme's `CREDITS.md` saying where it came from. A line can cover one picture or a whole folder (`pictures/**`).
- If a picture is missing, the game shows a simple drawn placeholder made with SVG instead of a broken image.

**Sounds**

- Sound effects can be generated in code with the Web Audio API, so no audio files are required.
- If you do use audio files, store them in the theme's `sounds/` folder.

**Size budget**

Keep each theme's pictures under about 50 MB (the Dino theme with 3–5 pictures per dinosaur is about 33 MB). Stage 7 decides how much to save for offline use; if both themes together are too big, it saves only the pictures of the theme being played.

### 1.6 Screens

1. **Tap to Start**: shown on every launch. It unlocks sound and speech (see 1.9) and then shows the profile screen.
2. **Profiles**: create, choose or delete a profile. Each profile has its own Sticker Album, stats, high scores and saved adventure. If a saved adventure exists, offer **Resume Adventure**.
3. **Setup**:
   - Theme: Dino Tour or Off-Roading. The screen shows where the trip is going, for example *"Next stop: Eoraptor!"*
   - Operations: checkboxes for +, −, × and ÷. At least one must be selected.
   - Difficulty: Beginner, Intermediate or Advanced (see 1.7).
4. **Adventure**: the question, the progress map with milestones, the on-screen keypad, and detours.
5. **Trail's End**: a summary, a rotating slideshow of the theme's pictures, and the new sticker added to the album.
6. **Sticker Album**: all stickers for both themes, in order, with locked ones greyed out.
7. **Stats**: Need More Practice and High Scores.
8. **Settings** (grown-up area): voice or text only, adventure length, detour length, backup and restore, and delete profile. Put this behind a simple grown-up check: hold a button for 3 seconds.

### 1.7 Math rules

| | Beginner | Intermediate | Advanced |
|---|---|---|---|
| **+** | 1-digit + 1-digit | 2-digit + 1-digit | 2-digit + 2-digit |
| **−** | 1-digit − 1-digit | 2-digit − 1-digit | 2-digit − 2-digit |
| **×** | 1-digit × 1-digit | 2-digit × 1-digit | 2-digit × 2-digit |
| **÷** | divisor 1–9, answer 1–9 | divisor 1–9, dividend up to 99 | 3-digit dividend (100–999) ÷ 2-digit divisor (10–99), answer 2–99 |

- Subtraction answers are never negative.
- Division always gives a whole number: create it by picking the divisor and the answer, then multiply them to get the dividend. For Advanced, keep only results where the dividend has 3 digits. Never divide by 0.
- Only use the operations the player selected, in the main trail and in detours.
- Do not repeat the same problem twice in a row.
- Answers are whole numbers typed on the on-screen keypad.

### 1.8 Adventure rules

**Main trail**

- **Adventure length** (Settings: 20, 40, 60, 80 or 100) is the number of trail steps to the destination.
- Each correct answer on the main trail moves the truck or dinosaur one step along the progress map.
- A wrong answer on the main trail does not move forward. It starts a **detour**. The missed question is not asked again in that adventure, but it is counted in Need More Practice.
- After any wrong answer (on the trail or in a detour), the game shows the right answer and waits for the player to press **Got it** before going on. After a right answer it goes on by itself after about a second.

**Milestones**

- There is a milestone every **10 steps** (10, 20, 30 …), shown as a flag on the progress map with a short story moment, for example *"You reached the Jurassic forest!"*
- Each milestone reached becomes the **checkpoint**, saved with the adventure. The final step is the destination.

**Detours**

- A detour is a short story event, for example: *"Oh no, a mudslide blocked the road! Solve 3 quick problems to winch the truck out!"*
- **Detour length** (Settings: 3 to 10, default 3) is the number of questions in each detour.
- Each detour question is answered once. A wrong answer during a detour **does not** start another detour; the player simply moves on to the next detour question.
- When all the detour questions have been answered:
  - **At least one correct:** the detour is cleared and the player continues the main trail from where they were.
  - **All wrong:** the player goes **back to the last milestone reached**, or to the start if no milestone has been reached yet. Show a kind, encouraging message, never a "game over" screen. The adventure continues from there with the same settings.
- Every new wrong answer on the main trail starts a new detour.

**End of the trail**

- Show the summary: questions answered, how many were correct, detours taken, milestone setbacks and total thinking time.
- Unlock the **next sticker in order** for that theme. Each profile has its own place in each theme's order. If every sticker is already collected, show a "Collection complete!" celebration instead.

### 1.9 Sound, voice and the thinking timer

**Tap to Start**

iPadOS will not play sound or speech until the user has touched the screen. The Tap to Start button must:

1. Create or resume the `AudioContext` and play a very short silent sound.
2. Speak a short word, such as "Hello!", to unlock speech.
3. Load the list of voices (they can arrive late, so also listen for the `voiceschanged` event).

If the game returns from the background and sound is suspended, show a "Tap to continue" overlay that unlocks it again.

**Sound effects**

A satisfying chime or a dinosaur roar for correct answers, and a soft, encouraging sound for detours. Include a volume or mute control.

**Voice** (when Voice Guided is on)

- Read questions aloud with `window.speechSynthesis`.
- Prefer a voice with `localService === true`, because those work offline.
- If no voice is available, switch to text-only mode and tell the grown-up in Settings.

**Reliable "finished speaking" detection**

The `end` event of speech is not reliable on iPad: it can fire late or never. Use all of these together:

1. Keep a reference to the current utterance (for example `window.currentUtterance`). Otherwise the browser can clean it up early and its events never fire.
2. Call `speechSynthesis.cancel()` before speaking each new question, to clear a stuck queue.
3. Treat speech as finished at whichever of these happens first:
   - the `end` or `error` event fires,
   - checking `speechSynthesis.speaking` every 200 ms shows it has stopped,
   - a safety timeout runs out. Estimate the speaking time as words ÷ 2.5 per second ÷ speech rate, multiply by 1.5, and use at least 2 seconds and at most 10.
4. Never let the game get stuck waiting for speech. The keypad works the whole time.
5. A **Repeat** button reads the question again. The timer pauses while it speaks.

**Thinking timer**

- Voice mode: start timing when speech is finished (see above). Text mode: start when the question appears on screen.
- Stop when the player presses Submit.
- Pause while the app is in the background (use the `visibilitychange` event) and while Repeat is speaking.
- Add up the thinking time for every question in the adventure, including detour questions.

### 1.10 Saving progress (storage design)

All data is small (well under 1 MB), so use `localStorage`, wrapped in `storage.js` so it could later be moved to IndexedDB without changing the rest of the game.

**Keys**

| Key | Holds |
|---|---|
| `ao.v1.index` | Profile list (id, name, avatar), global settings, schema version |
| `ao.v1.profile.<id>` | That profile's stickers and place in each theme's order, settings, high scores and Need More Practice counts |
| `ao.v1.history.<id>` | The last 10 completed games (compact summary only) |
| `ao.v1.active.<id>` | The adventure in progress, including its current step, last milestone and any detour, if any |

**Rules for clean, safe storage**

- **Save only what changed.** During an adventure, write only `ao.v1.active.<id>`, once per question. Update the profile only when an adventure ends.
- **Keep data small.** Store problems as short text such as `"7×8"`, times as whole milliseconds, and no repeated names.
- **Limit growth.**
  - History keeps only the last 10 games.
  - Each high-score board keeps its top 10.
  - Need More Practice keeps counts per problem from the last 10 games and drops anything older.
- **Safe writes.** Write the new value to a temporary key first, then to the real key, then delete the temporary key. When loading, use whichever copy is valid.
- **Version and check everything.** Every saved object has a schema version. On load, check its structure; if it is damaged, move it to `ao.v1.quarantine.<key>`, tell the grown-up, and carry on with safe defaults. Add a migration step for each schema version.
- **Handle storage errors.** Handle a full or unavailable storage without crashing, and show a friendly message suggesting a backup.
- **Ask to keep data.** Call `navigator.storage.persist()` so the device is less likely to clear the game's data.
- **Show the size.** Show how much storage the game is using in Settings.

**Explain in the app and the README** that:

- Progress is stored only on this iPad and is not synced.
- The Safari tab and the Home Screen app keep **separate** data, so children should always play from the Home Screen icon.

### 1.11 Stats, high scores and backup

**Need More Practice**

For each profile, list the problems answered wrong most often over the last 10 games, with how many times each was missed; then, if there is room, the slowest problems (5 seconds or more).

**High scores**

- There is a separate board for each **adventure length** (20, 40, 60, 80 and 100 questions), and within each length a board for each difficulty.
- Fewer milestone setbacks rank higher; between equal setbacks, less total thinking time is better (decided after the 0.5.5 iPad checklist; the first plan ranked by thinking time only).
- Each entry also shows the date, accuracy, milestone setbacks and the operations used.
- Only completed adventures count. A run that went back to a milestone still counts when it is completed: the extra questions simply add thinking time.

**Backup and restore** (Settings)

- **Back Up** saves a file called `arithmetic-odyssey-backup-YYYY-MM-DD.json` containing:
  - a format name and schema version,
  - the export date and app version,
  - all profiles, stickers, stats, high scores and settings,
  - any saved adventures.
- On iPad, use the share sheet (`navigator.share` with a file) so the grown-up can choose **Save to Files**. If that is not available, use a normal download link.
- **Restore** opens a file picker, checks the file, and shows a preview (for example *"2 profiles, 14 stickers, 6 high scores"*). The grown-up then chooses either:
  - **Replace everything**, or
  - **Add as new profiles**.
- Before restoring, keep a copy of the current data so the restore can be undone.
- Optionally, remind the grown-up to back up after every 5 completed adventures.

### 1.12 Offline support, hosting and publishing

**Installable app (PWA)**

- `manifest.json` has the name, short name, icons, theme colors, `display: standalone`, and a relative `start_url` and `scope`.
- `index.html` also includes the iPad tags: `<link rel="apple-touch-icon">`, `apple-mobile-web-app-capable` and `apple-mobile-web-app-title`.

**Service worker**

- Saves every file the game needs from an **explicit list**, including both themes' files. A tool script in `tools/` creates this list automatically, and a test checks that every file in the list exists and that no needed file is missing.
- Uses a version number. A new version is not switched on until all its files have downloaded, and the old saved files are kept until then.
- Never interrupts an adventure in progress to update. Show "Update ready, it will apply next time you open the game."
- Shows "Ready to play offline" only after every file has been saved and checked.
- If something unexpected fails while offline, shows `offline.html` instead of an error.

**Paths**

- Use relative paths everywhere. The game is published at `https://USERNAME.github.io/Home-School-Tools/arithmetic-odyssey/`, and must also work at any other path.
- Never hard-code the username, repository name or website address.

**Publishing with GitHub Pages**

The site is published from the start (Stage 0), so the game can be checked on the iPad over HTTPS at every stage. `.github/workflows/deploy.yml`, at the top of the Home-School-Tools repository:

1. Runs on every push to the `main` branch.
2. Runs each tool's automated tests and stops if any fail.
3. Copies the repository into a publish folder, **leaving out** every `tests/` and `tools/` folder, `downloaded-pictures/` and `.github/`. No compiling.
4. Uploads that folder using the official GitHub Pages Actions steps, then deploys it.

For local testing, `arithmetic-odyssey/tools/Start-LocalServer.ps1` serves the whole repository at `http://localhost:8080`, so the game opens at `http://localhost:8080/arithmetic-odyssey/`, the same subpath shape as the published site. It works in Windows PowerShell 5.1 and PowerShell 7.

**Shared storage on github.io.** Every GitHub Pages site on the same account shares one browser storage area on the iPad (`USERNAME.github.io`). That is why every key starts with `ao.v1.`. Future tools in this repository must use their own prefix. The service worker's scope is limited to `arithmetic-odyssey/` so it never affects other tools.

### 1.13 iPad touch and layout

- Answers are entered with a large on-screen keypad: digits 0–9, Backspace and Submit, with each button at least 60 × 60 points.
- Never use a text input for answers, so the iPad keyboard never appears.
- Work in both portrait and landscape, and respect the iPad's safe areas.
- Prevent double-tap zoom, text selection, pull-to-refresh and page bounce during play.
- Don't rely on color alone to show right or wrong; also use an icon or word.
- Respect "Reduce Motion" in iPad settings.

### 1.14 Privacy

- All data stays on the device. Nothing is sent anywhere.
- The repository is public, so never put player names, saves, backups or raw downloaded pictures in it.

---

## Part 2: Stages and test plan

Every stage ends with its tests passing, the site republished, and a short report. Test IDs (for example **T1.3**) are referred to in the reports.

**Kinds of tests**

- **Automated:** run with `node --test` in `tests/`. The game logic files (`math.js`, `storage.js`, and the adventure rules in `game.js`) are written so they can be tested without a browser.
- **PC:** done by hand in Chrome or Edge on a PC (see Part 3).
- **iPad:** done on a real iPad using the published site.

### Stage 0: Project setup and first publish

**Build:**

- The game folder structure from 1.4 inside Home-School-Tools, and the repository's start page linking to the game.
- A placeholder game page that shows the game's name and version.
- `arithmetic-odyssey/tools/Start-LocalServer.ps1`.
- The deploy workflow, publishing the start page and the placeholder to GitHub Pages.
- A debug panel, opened with `?debug=1`, used by later stages to simulate problems.

| ID | Test | Kind |
|---|---|---|
| T0.1 | The local server serves the page, and `.json`, `.js`, `.css` and `.jpg` files with the correct types | PC |
| T0.2 | `node --test` runs (even with no tests yet) | Automated |
| T0.3 | Pushing to `main` runs the workflow, which publishes the start page and the placeholder; `tests/`, `tools/` and `downloaded-pictures/` are not on the site | PC |
| T0.4 | `https://USERNAME.github.io/Home-School-Tools/arithmetic-odyssey/` opens on the iPad | iPad |

### Stage 1: Math engine (`math.js`)

**Build:** problem generation for every operation and difficulty (1.7), and answer checking.

| ID | Test | Kind |
|---|---|---|
| T1.1 | For every operation × difficulty, 10,000 generated problems match the digit rules in the table | Automated |
| T1.2 | Subtraction answers are never negative | Automated |
| T1.3 | Division always gives a whole number and never divides by 0; Advanced always has a 3-digit dividend and a 2-digit divisor | Automated |
| T1.4 | Only the selected operations appear; selecting none is rejected | Automated |
| T1.5 | The same problem never appears twice in a row | Automated |
| T1.6 | Answer checking accepts the right answer and rejects wrong, empty or too-long input | Automated |

### Stage 2: Theme content

**Build:**

- `tools/build-storyline.mjs`, which builds `storyline.json` for each theme from the Markdown files and `game-text.json`, with stickers in the order from 1.5.
- Milestone and detour story text, and kid-friendly facts, in `game-text.json`.
- The pictures you chose, with `CREDITS.md`.
- Dino theme first; the Parks theme and `tools/Resize-Pictures.ps1` follow.

| ID | Test | Kind |
|---|---|---|
| T2.1 | Dino theme has 60 stickers in order (Triassic #1–20, Jurassic #1–20, Cretaceous #1–20); Parks theme has 63 stickers in region order | Automated |
| T2.2 | Every sticker has a name, at least 2 facts, and pictures that exist on disk | Automated |
| T2.3 | Facts match the Markdown source (spot-check 10 per theme) | PC |
| T2.4 | Each theme is under its size budget; no single picture is over 400 KB or 1600 px | Automated |
| T2.5 | Every picture has a line in `CREDITS.md` | Automated |
| T2.6 | A missing picture shows the drawn placeholder, not a broken image | PC |

### Stage 3: Screens and keypad

**Build:**

- Tap to Start, Profiles, Setup (with "Next stop"), Sticker Album, Stats and Settings screens with the grown-up check, using placeholder data where later stages fill in.
- The on-screen keypad.
- Layout for portrait and landscape.
- Until Stage 4, **Start Adventure** opens a practice run with the player's setup, so the keypad can be tried. Players live in memory only until Stage 6, and the screens say so.
- The only text box is the player's name on the New player screen, usually typed by a grown-up.

| ID | Test | Kind |
|---|---|---|
| T3.1 | Every screen can be reached and left with large buttons | PC |
| T3.2 | The keypad enters digits, Backspace works, Submit sends the answer, and a maximum digit length is enforced | PC |
| T3.3 | No text input appears, so the system keyboard never opens | iPad |
| T3.4 | The layout fits iPad portrait and landscape (DevTools iPad sizes on PC; a real device on iPad) | PC, iPad |
| T3.5 | No double-tap zoom, text selection or pull-to-refresh | iPad |

### Stage 4: The adventure

**Build:** the adventure state machine, progress map with milestones, detours, going back to milestones, Trail's End, the slideshow and unlocking stickers in order.

| ID | Test | Kind |
|---|---|---|
| T4.1 | A correct main-trail answer moves one step; a wrong one starts a detour and is logged for Need More Practice | Automated |
| T4.2 | A wrong answer inside a detour does not start another detour | Automated |
| T4.3 | A detour with at least 1 correct answer returns to the same trail position | Automated |
| T4.4 | A detour with every answer wrong goes back to the last milestone (step 0 if none yet), keeping the same settings | Automated |
| T4.5 | Milestones fall every 10 steps and are saved as checkpoints | Automated |
| T4.6 | Detours use only the selected operations | Automated |
| T4.7 | Finishing unlocks the next sticker in order for that theme and profile; when all are collected, it shows "Collection complete!" | Automated |
| T4.8 | A full 20-question adventure plays through in each theme, including a detour and a milestone setback (forced with `?debug=1`) | PC |

**Notes from building Stage 4:**

- The rules are in `js/adventure.js`, separate from the screen, and the adventure is plain data so Stage 6 can save it as `ao.v1.active.<id>`.
- Leaving an adventure keeps it, and the home screen offers **Resume Adventure**. Until Stage 6 it is kept only until the page reloads.
- Wrong answers in a detour also count for Need More Practice, since they are problems the player missed.
- Trail's End shows the new sticker's pictures as a slideshow; after "Collection complete!" it shows one picture of every sticker. Total thinking time is added to the summary in Stage 5.
- The T4.8 check ran in each layout for the Dino theme; the Parks theme follows with its content.

### Stage 5: Sound, voice and timer

**Build:** `audio.js` (Web Audio sound effects, voice with the reliable finished-speaking detection in 1.9) and the thinking timer.

| ID | Test | Kind |
|---|---|---|
| T5.1 | Before Tap to Start, no sound or speech is attempted | PC, iPad |
| T5.2 | After Tap to Start, sound effects and voice both work | PC, iPad |
| T5.3 | If the speech `end` event never fires (simulated with `?debug=1`), the timer still starts within the safety timeout | Automated, PC |
| T5.4 | The timer counts only from end of speech (or question shown) to Submit, and pauses while in the background and during Repeat | Automated |
| T5.5 | With no offline voice available, the game switches to text-only mode and says so in Settings | PC |
| T5.6 | Voice works with Wi-Fi turned off | iPad |

**Notes from building Stage 5:**

- The thinking timer starts when the question has been read aloud, **or at the first key press** if that comes sooner, so a player who answers while it is still being read never gets a time of zero.
- Besides the question, the voice reads the story moments (flags, detours, going back to a flag), "Incorrect. 7 times 8 is 56." after a wrong answer, and the new sticker on Trail's End.
- Settings has **Sound effects: On/Off** as the mute control, and says which voice is used, or that none was found and the game is text only.
- An English voice that works offline is preferred. If the device only has voices that need the internet, one of those is used and Settings says so.
- The automatic voice is the most natural one: Premium, then Enhanced, then known natural voices (Ava, Samantha, Daniel …). The novelty and older robotic voices Apple lists among the English voices (Albert, Bad News, Zarvox, Eddy, Flo …) are never picked automatically, but a grown-up can choose any voice in Settings, where tapping a voice plays a sample, and set the speed to Slower or Normal.
- To get a more natural voice on iPad: Settings app › Accessibility › Spoken Content › Voices › English, download an Enhanced or Premium voice, then restart the game. Not every downloaded voice is offered to web pages. Siri voices are not offered to web pages at all.

**Changes after trying it on the iPad (0.5.2):**

- Players choose from 16 pictures: long-neck dinosaur, triceratops, T. rex, mosasaur, pterosaur, blue pickup truck, monster truck, dirt bike, blue SUV, blue ATV, robot, rocket, butterfly, unicorn, dog and cat. They are drawn in `js/avatars.js` (there are no emoji for several of them, and iPad emoji face left); all face right.
- The player's picture travels the trail map. On a detour it leaves the trail onto a road that loops below it, moves round the loop with each detour question, and rejoins the trail where it left.
- A right answer plays a bell "ding". Reaching a flag plays the theme's sound: a dinosaur roar in Dino Tour, an engine revving in Off-Roading. Both are made in code and can be replaced with recorded sounds in the theme's `sounds/` folder later.
- The keypad's ✔ and ⌫ are drawn icons (a white check on green), because the iPad can show those characters as small grey emoji.
- The page never scrolls or bounces. Every game screen fits the iPad in both orientations; only the Sticker Album and Settings, which are long lists, scroll inside the screen.

**More changes after trying it (0.5.3):**

- The player pictures are files in `images/avatars/`, so they can be edited or replaced without touching the code.
- The voice waits for a sound effect to finish before reading: the flag roar, the detour sound, the wrong-answer sound and the Trail's End fanfare.
- The sticker card changes pictures by itself every 3 seconds (dots show which one); there are no arrows.
- Album tiles and the finish picture show the whole picture (many dinosaur pictures are about twice as wide as the tile), and long names such as Thecodontosaurus get a smaller size so they stay on one line.
- After a wrong answer the screen shows the player's answer in red and crossed out, "✗ Incorrect ✗", and the question with the right answer in green in the answer box (0.5.5)
- The voice now says "Incorrect. 7 times 8 is 56." after a wrong answer, matching the screen. (0.5.6)
- No zooming or scrolling while playing (T3.5 on the iPad, 0.5.6):
  - pinch zoom is blocked everywhere, and double-tap zoom on quick taps is blocked without losing fast typing;
  - the adventure screen never scrolls: on a short window it steps down to more compact sizes, and only if even those don't fit does it scroll, so the keypad can always be reached;
  - a double tap on "Got it" no longer types a digit with its second tap.
- The flag sounds (roar and engine) are about as loud as the voice (0.5.6). iPad speakers hardly play deep sounds, so both now keep most of their sound above about 300 Hz and play through a compressor, a boost and a limiter (no clipping).
- **Off-Roading, first version (0.5.6):**
  - all 63 parks, region by region in the README order and alphabetical inside each region;
  - three kid-friendly facts per park, written from the region files;
  - truck story text for flags, detours and setbacks;
  - each park's sticker card shows its location, year and key attractions;
  - "St." is read aloud as "Saint";
  - the trail uses the truck colours, and the engine revs at each flag.

  The 8 Alaska parks have pictures, and the rest show a drawing for now. The story file builder also accepts the downloader's `credits.csv` as the credits for its pictures.
- The Alaska pictures were resized to 1024 pixels on the longest side and 200 KB at most (71 pictures, 19 MB down to 9.2 MB), the size now recommended in `themes/national-parks/PICTURES.md`. Their credit is listed as unknown for now.
- `tools/Get-ParkPictures.ps1` downloads about 5 Wikimedia Commons photos of each park attraction, with their credits, for the Off-Roading theme.
- Voice lists show each voice once, in its best version; the iPad can list a name two or three times, including Apple's lowest-quality "super-compact" copies, which are labelled Basic. The tester can still show every copy.
- `?debug=1` can make speech "never finish", to check the safety timeout (T5.3). Automated browser checks use a fake speech engine; the real voices are checked on the iPad (T5.2, T5.6).

### Stage 6: Saving, stats, high scores and backup

**Build:** `storage.js` as designed in 1.10, Resume Adventure, Need More Practice, high-score boards, and backup and restore.

| ID | Test | Kind |
|---|---|---|
| T6.1 | Closing in the middle of an adventure and reopening offers Resume, and resumes at the same question with the same step, last milestone, detour and time | Automated, PC |
| T6.2 | A damaged save is quarantined and the game still starts | Automated |
| T6.3 | A full storage (simulated) shows a friendly message and does not crash | Automated, PC |
| T6.4 | History keeps only 10 games; each board keeps only its top 10 | Automated |
| T6.5 | High scores are separated by adventure length and difficulty; a completed run with milestone setbacks still counts | Automated |
| T6.6 | Back Up then Restore (Replace) gives identical data; Restore (Add) adds profiles without changing existing ones | Automated |
| T6.7 | Restoring a wrong or damaged file is refused with a clear message and changes nothing | Automated |
| T6.8 | Back Up saves a file through the share sheet (Save to Files) | iPad |
| T6.9 | Older saves are migrated to the current schema version | Automated |

**Notes from building Stage 6 (0.6.0):**

- `js/storage.js` wraps localStorage: safe writes (temporary key, real key, remove the temporary key; a read uses whichever copy is valid), quarantine of damaged data, and friendly messages for a full or blocked storage (a toast, and a list in Settings). With no storage at all the game runs in memory for that visit and says so.
- `js/records.js` checks every saved record and migrates older ones, one schema step at a time. Schema 0 is the shape players had in memory in 0.3 to 0.5 (no schema number; the player list as a plain array; stickers as one Dino list).
- `js/profiles.js` saves only what changed: `ao.v1.active.<id>` after every question, the player's record when settings change or an adventure ends. If the player list is damaged it is rebuilt from the players' own records.
- **High scores** (decided after the 0.5.5 iPad checklist): fewer milestone setbacks rank higher, then the shortest total thinking time, then the earlier game. Trail's End says when a trip makes the board ("New best score for 20 questions (Beginner)!").
- **Need More Practice** (decided with it): the problems missed most often in the last 10 games, then the slowest of those, then, if there is room, problems that took 5 seconds or more. Each game keeps only its 10 slowest problems.
- `js/backup.js`: the backup file (format `arithmetic-odyssey-backup`, schema 1) holds every player's record, history and adventure in progress. Restore checks the whole file before changing anything, keeps an undo copy (`ao.v1.undo`), and keeps the current player chosen if they come back.
- `navigator.storage.persist()` is asked for at Tap to Start.
- The Restore file picker is the only `<input>` besides the player name; it opens Files, never the keyboard (T3.3 still holds).
- The Dino flag roar was rebuilt in the style of the big movie T. rex roars (a trumpeting scream, then a raspy growl; 2.6 s, made with Web Audio, not a recording).

**0.6.1 (added after Stage 6, asked for after trying it):**

- **Learn from Incorrect** (`js/learn.js`, `js/screens/learn.js`), opened from My Stats: a practice round with the Need More Practice problems (up to 8). A problem is learned after 2 right answers in the round (a problem that was only slow must be answered within 5 seconds); a wrong answer resets its count and it comes back 2 questions later; the round stops when all are learned or after 4 questions per problem. No stickers or high scores. Learned problems are saved in the player's record (`learned`, the date each was learned, at most 200) and leave Need More Practice until a later game misses them (or is slow on them) again.
- **Recorded flag sounds:** `themes/<theme>/sounds/flag.mp3` (or `.m4a`, `.wav`) plays at the flags instead of the made-up roar or engine; the story file lists it, the voice waits for it (at most 5 seconds since 0.6.2), it is evened out to about the voice's loudness, and it must be credited and at most 600 KB. The voice and sound tester has a button for each recording.
- **The Uppbeat "T-Rex Roar"** (by Epic Stock Media) was looked into and not added: the free (Basic) license allows sounds inside web games but forbids sharing the original audio file, and every file in this public repository can be downloaded by anyone. A public domain (CC0) recording is the safe choice.

**0.6.2:** the flag sounds are recordings from Freesound, cleaned up (the best part, under 5 s; rumble below 40 Hz removed; short fades; even volume; mono MP3, 20 to 60 KB each): three dinosaur roars by jarredgibb and two truck engines by canucklovingbrit and moshwe. A theme can have several (`sounds/flag-1.mp3`, `flag-2.mp3`, ...); one is picked at random at each flag, never the same twice in a row. The original uploads (about 10 MB) were removed. Their licenses still need checking on their Freesound pages (`CREDITS.md` says so).

### Stage 7: Offline app (PWA)

**Build:** `manifest.json`, the iPad tags, the icons, `sw.js` with the generated file list, update handling and `offline.html`.

| ID | Test | Kind |
|---|---|---|
| T7.1 | Every file in the list exists, and every file the game needs is in the list | Automated |
| T7.2 | After the first load, the game works with DevTools set to Offline, including after a full reload | PC |
| T7.3 | "Ready to play offline" appears only after everything is saved; a failed file stops it from appearing | PC |
| T7.4 | A new version installs without interrupting an adventure and applies on the next launch | PC |
| T7.5 | It works from a subpath (`http://localhost:8080/arithmetic-odyssey/`), and the service worker does not control pages outside `arithmetic-odyssey/` | PC |

### Stage 8: Release and iPad acceptance

**Build:** the final README (setup, publishing, installation on iPad, offline checklist and troubleshooting) and the first full release.

| ID | Test | Kind |
|---|---|---|
| T8.1 | The release passes all automated tests and publishes; the published address loads | PC |
| T8.2 | No broken links or missing files on the published site | PC |
| T8.3 | Add to Home Screen opens full screen (standalone) | iPad |
| T8.4 | After installing: Wi-Fi off, close the app completely, reopen, then play a full adventure with sound and voice | iPad |
| T8.5 | Profiles, stickers, high scores and a saved adventure survive restarting the iPad | iPad |
| T8.6 | Publishing a new version updates the installed app on the next launch | iPad |

---

## Part 3: Testing on a PC and on the iPad

**Most of the game can be tested on a PC.** It is ordinary HTML and JavaScript, so Chrome, Edge or Firefox run it the same way. All automated tests (about two-thirds of the test plan) run on a PC with Node.js.

### On the PC

1. **Install Node.js (LTS)** if `node --version` doesn't work in PowerShell. It is only needed to run the tests, not to play.
2. **Run the game from the local server, not by double-clicking `index.html`.** Service workers, and so offline mode, only work from `http://localhost` or HTTPS, not from a `file://` path. Run `tools/Start-LocalServer.ps1`, then open `http://localhost:8080`.
3. **Use Chrome or Edge DevTools** (press F12):
   - **Device toolbar** (Ctrl+Shift+M): choose an iPad size and touch input to check the layout and keypad.
   - **Application** tab: see the service worker and saved files, view `localStorage`, and use **Clear site data** to start fresh.
   - **Network** tab: set it to **Offline** to test offline play.
4. **Use the debug panel** (`?debug=1`) to simulate the hard cases:
   - speech that never reports finishing,
   - a full storage,
   - a damaged save,
   - forcing a detour or a milestone setback,
   - jumping near the end of a trail.
5. **Optional, closest to Safari:** Safari isn't available for Windows, but the free Playwright tool includes WebKit, the engine Safari uses. The agent can add Playwright tests that run in WebKit on a PC. This is a developer tool and is not part of the game.

### On the iPad

The iPad can't open your PC's `localhost`, and offline mode, Save to Files and keeping stored data all need HTTPS. So iPad tests use the **published GitHub Pages site**, which is updated every time a stage is pushed to `main`. Use Safari for quick checks during development, and the Home Screen app for the offline tests in Stages 7 and 8.

| Only on an iPad | Why |
|---|---|
| Add to Home Screen and full-screen launch | Only iPadOS does this |
| The exact rules for when sound and speech are allowed | Safari on iPad is stricter than desktop browsers |
| Which voices exist, and the unreliable speech-finished event | Voices and speech bugs differ by device |
| The separate data of the Home Screen app and Safari, and whether data is cleared | iPad-specific storage behavior |
| Save to Files through the share sheet | The iPad share sheet |
| Touch feel, double-tap zoom and page bounce | Real fingers on real glass |

A good routine is to build and test each stage on the PC, push it, and then run that stage's iPad tests on the published site.

---

## Part 4: Decisions

### Decided

| Topic | Decision |
|---|---|
| Hosting | The public repository Home-School-Tools, with the game in `arithmetic-odyssey/`, published with GitHub Pages from Stage 0 |
| Theme resources | Each theme keeps all of its resources, including its facts, in its own folder: `themes/dino/` and `themes/national-parks/` |
| Advanced division | 3-digit dividend ÷ 2-digit divisor, whole-number answer (for example 156 ÷ 12 = 13) |
| Sticker unlocks | In order: dinosaurs by period and list number; parks by region |
| Milestones | Every 10 steps; a detour with every answer wrong goes back to the last milestone, not the very start |
| Detours | A wrong answer inside a detour never starts another detour; at least one correct answer clears it |
| High scores | Separate boards by adventure length, then by difficulty |
| Pictures | You choose them and put them in `pictures/<Period>/<Dinosaur>/`; each is credited in `CREDITS.md` |

### Still open (the agent uses the default)

1. **Players' age or grade.** This affects reading level and voice speed. **Default:** ages 6–10.
2. **The question missed on the main trail.** **Default:** not asked again in that adventure, but counted in Need More Practice. An alternative is to ask it again later in the same adventure.
3. **Grown-up check.** **Default:** hold a button for 3 seconds to open Settings.
4. **Picture rights.** Both the repository and the website are public, so anyone can see and download the pictures. Choose pictures you are allowed to share; photos taken by National Park Service staff are generally free to reuse. Record each picture's source in `CREDITS.md` so any picture can be swapped out later if needed.
