// Builds each theme's storyline.json, the file the game reads, from:
//   - the theme's Markdown fact files (dinosaurs: names, periods, where
//     found; national parks: names, regions, locations, key attractions),
//   - the theme's game-text.json (kid-friendly facts and story text),
//   - the pictures in the theme's pictures/ folder,
//   - recorded flag sounds, if the theme's sounds/ folder has flag.mp3 or
//     several (flag-1.mp3, flag-2.mp3, ...; also .m4a or .wav): the game
//     picks one at random at each flag; without any it makes its own,
//   - the theme's CREDITS.md.
//
// Usage (from the arithmetic-odyssey folder):
//   node tools/build-storyline.mjs                  build every theme
//   node tools/build-storyline.mjs dino             build one theme
//   node tools/build-storyline.mjs national-parks   (the Off-Roading theme)
//
// storyline.json is not stored in git: the deploy workflow and the local
// server build it, so pictures uploaded on GitHub appear automatically.
// Run this yourself after adding pictures if you test with your own server.

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const GAME_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const PICTURE_TYPES = ['.jpg', '.jpeg', '.png', '.webp'];
// Recorded sounds iPad Safari can play.
export const SOUND_TYPES = ['.mp3', '.m4a', '.wav'];

/**
 * The theme's recorded sounds: { flag: ['sounds/flag-1.mp3', ...] } (empty if
 * there are none). Flag sounds are named flag.mp3, or flag-1.mp3, flag-2.mp3
 * and so on (any name starting with "flag").
 */
export function findSounds(themeDir) {
  const folder = join(themeDir, 'sounds');
  if (!existsSync(folder)) return {};
  const flags = readdirSync(folder)
    .filter((f) => /^flag\b|^flag[-_ ]/i.test(f) && SOUND_TYPES.includes(f.slice(f.lastIndexOf('.')).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  return flags.length ? { flag: flags.map((f) => `sounds/${f}`) } : {};
}

// ---------------------------------------------------------------- helpers

/** "Tyrannosaurus rex" -> "tyrannosaurus-rex", "Apatosaurus / Brontosaurus" -> "apatosaurus-brontosaurus", "Hawaiʻi" -> "hawaii" */
export function slug(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ʻ'’]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Removes Markdown bold, italics and links: "**Middle** Triassic" -> "Middle Triassic" */
function plain(text) {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/(^|[^\w])\*([^*]+)\*/g, '$1$2')
    .trim();
}

/** A name with only its letters and digits, for matching folder names: "Wrangell–St. Elias" -> "wrangellstelias" */
function squash(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Words used to match a picture folder to a sticker, e.g. Tyrannosaurus rex -> tyrannosaurusrex, tyrannosaurus */
function folderKeys(name) {
  const keys = new Set();
  keys.add(squash(name));
  for (const part of name.split('/')) {
    keys.add(squash(part));
    keys.add(squash(part.trim().split(/\s+/)[0]));
  }
  keys.delete('');
  return keys;
}

// ---------------------------------------------------------------- Dino theme

const DINO_PERIODS = ['Triassic', 'Jurassic', 'Cretaceous'];

/** Reads the 20 dinosaurs from one period file, in list order. */
export function parseDinoPeriod(markdown, period) {
  const dinos = [];
  const sections = markdown.split(/^### /m).slice(1);
  for (const section of sections) {
    const heading = section.split('\n', 1)[0];
    const match = heading.match(/^(\d+)\.\s+(.+?)\s*$/);
    if (!match) continue;
    const field = (label) => {
      const line = section.match(new RegExp(`^- \\*\\*${label}:\\*\\* (.+)$`, 'm'));
      return line ? plain(line[1]) : '';
    };
    const [group = '', diet = ''] = field('Type').split('·').map((s) => s.trim());
    dinos.push({
      id: slug(match[2]),
      periodNumber: Number(match[1]),
      name: match[2],
      period,
      group,
      diet,
      when: field('Period'),
      found: field('Found'),
    });
  }
  return dinos;
}

// ---------------------------------------------------------------- Off-Roading (national parks) theme

/**
 * The region files and their picture folders, in sticker order (the order of
 * the README's region table). Parks are in alphabetical order inside each region.
 */
export const PARK_REGIONS = [
  { file: 'alaska', folder: 'Alaska', title: 'Alaska' },
  { file: 'california', folder: 'California', title: 'California' },
  { file: 'pacific', folder: 'Pacific', title: 'Pacific Northwest, Hawaii and American Samoa' },
  { file: 'southwest', folder: 'Southwest', title: 'Southwest' },
  { file: 'rockies-and-plains', folder: 'Rockies-and-Plains', title: 'Rocky Mountains and Great Plains' },
  { file: 'midwest', folder: 'Midwest', title: 'Midwest and Great Lakes' },
  { file: 'east-and-caribbean', folder: 'East-and-Caribbean', title: 'East, South and Caribbean' },
];

/** "Arches National Park" -> "Arches"; "National Park of American Samoa" -> "American Samoa" (as the picture downloader names folders) */
export function shortParkName(heading) {
  return plain(heading)
    .replace(/^National Park of (the )?/i, '')
    .replace(/\s+National Parks?(\s+and\s+Preserve)?\s*$/i, '')
    .trim();
}

/** Reads the parks in one region file, in alphabetical order. */
export function parseParkRegion(markdown, region) {
  const parks = [];
  for (const section of markdown.split(/^## /m).slice(1)) {
    const heading = section.split('\n', 1)[0].trim();
    if (!/National Park|Park of/i.test(heading)) continue;
    const row = (label) => {
      const line = section.match(new RegExp(`^\\|\\s*\\*\\*${label}\\*\\*\\s*\\|\\s*(.+?)\\s*\\|\\s*$`, 'm'));
      return line ? plain(line[1]) : '';
    };
    const name = shortParkName(heading);
    const established = row('Became a national park').match(/\b(1[89]\d\d|20\d\d)\b/)?.[1] ?? '';
    const attractions = [...section.matchAll(/^- \*\*(.+?):\*\*/gm)].map((m) => plain(m[1]));
    parks.push({
      id: slug(name),
      name,
      fullName: plain(heading),
      region: region.title,
      regionFolder: region.folder,
      location: row('Location'),
      established,
      attractions,
    });
  }
  return parks.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

/** A park name as the voice should read it: "St." is "Saint", and no ʻokina or dashes to stumble over. */
export function spokenName(name) {
  return name.replace(/\bSt\.\s*/g, 'Saint ').replace(/[ʻ]/g, '').replace(/\s*[–-]\s*/g, ' ');
}

export const PARK_FOLDERS = {
  groupOf: (s) => s.regionFolder,
  groups: PARK_REGIONS.map((r) => r.folder),
  group: 'region',
  item: 'park',
  example: 'pictures/Alaska/Denali/',
};

// ---------------------------------------------------------------- credits

/** Picture paths (or "folder/**" defaults) listed in the first column of CREDITS.md tables. */
export function parseCredits(markdown) {
  const entries = [];
  for (const line of markdown.split('\n')) {
    const cell = line.match(/^\|\s*`?([^|`]+?)`?\s*\|/);
    if (!cell) continue;
    const value = cell[1].trim();
    if (value.startsWith('pictures/') || value.startsWith('sounds/')) entries.push(value);
  }
  return entries;
}

/**
 * Picture paths in a credits.csv written by tools/Get-ParkPictures.ps1 (its
 * File column), so its one-line-per-picture credits count without copying
 * them into CREDITS.md.
 */
export function parseCreditsCsv(csv) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const text = csv.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const header = rows.shift() ?? [];
  const column = header.findIndex((h) => h.trim().toLowerCase() === 'file');
  if (column < 0) return [];
  return rows.map((r) => (r[column] ?? '').trim().replace(/\\/g, '/')).filter((f) => f.startsWith('pictures/'));
}

export function isCredited(picturePath, credits) {
  return credits.some((entry) =>
    entry.endsWith('/**') ? picturePath.startsWith(entry.slice(0, -2)) : entry === picturePath,
  );
}

// ---------------------------------------------------------------- pictures

/** How each theme's picture folders are named: pictures/<group>/<sticker>/ */
const DINO_FOLDERS = {
  groupOf: (s) => s.period,
  groups: DINO_PERIODS,
  group: 'period',
  item: 'dinosaur',
  example: 'pictures/Triassic/Eoraptor/',
};

/**
 * Finds the pictures for each sticker. Pictures live in
 * pictures/<Period>/<Dinosaur>/<any name>.jpg (or, for the parks,
 * pictures/<Region>/<Park>/), matching the folders made by the picture
 * downloaders. Returns { byId, problems }.
 */
export function findPictures(themeDir, stickers, folders = DINO_FOLDERS) {
  const byId = Object.fromEntries(stickers.map((s) => [s.id, []]));
  const problems = [];
  const root = join(themeDir, 'pictures');
  if (!existsSync(root)) return { byId, problems };

  for (const groupEntry of readdirSync(root, { withFileTypes: true })) {
    if (groupEntry.name.startsWith('.')) continue;
    if (!groupEntry.isDirectory()) {
      problems.push(`pictures/${groupEntry.name}: put pictures in a folder for their ${folders.group} and ${folders.item}, e.g. ${folders.example}`);
      continue;
    }
    const inGroup = stickers.filter((s) => folders.groupOf(s).toLowerCase() === groupEntry.name.toLowerCase());
    if (inGroup.length === 0) {
      problems.push(`pictures/${groupEntry.name}/: unknown ${folders.group} folder (use ${folders.groups.join(', ')})`);
      continue;
    }
    for (const itemEntry of readdirSync(join(root, groupEntry.name), { withFileTypes: true })) {
      if (itemEntry.name.startsWith('.')) continue;
      const where = `pictures/${groupEntry.name}/${itemEntry.name}`;
      if (!itemEntry.isDirectory()) {
        problems.push(`${where}: put pictures inside the ${folders.item}'s folder`);
        continue;
      }
      // An exact name wins ("Glacier Bay"), then a shorter form ("Tyrannosaurus" for Tyrannosaurus rex).
      const key = squash(itemEntry.name);
      const sticker = inGroup.find((s) => squash(s.name) === key) ?? inGroup.find((s) => folderKeys(s.name).has(key));
      if (!sticker) {
        problems.push(`${where}/: no ${groupEntry.name} ${folders.item} called "${itemEntry.name}" in the list`);
        continue;
      }
      const files = readdirSync(join(root, groupEntry.name, itemEntry.name), { withFileTypes: true })
        .filter((f) => f.isFile() && !f.name.startsWith('.'))
        .map((f) => f.name)
        .sort((a, b) => a.localeCompare(b));
      for (const file of files) {
        const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
        if (!PICTURE_TYPES.includes(ext)) {
          problems.push(`${where}/${file}: not a picture the game can use (${PICTURE_TYPES.join(', ')})`);
          continue;
        }
        byId[sticker.id].push(`${where}/${file}`);
      }
    }
  }
  return { byId, problems };
}

// ---------------------------------------------------------------- build

/**
 * Adds each sticker's kid facts (from game-text.json) and pictures, and
 * checks their credits. Shared by every theme. Returns { problems, uncredited }.
 */
function addFactsAndPictures(themeDir, text, stickers, folders, item) {
  const problems = [];
  const ids = new Set(stickers.map((s) => s.id));
  for (const s of stickers) {
    const facts = text.kidFacts?.[s.id];
    if (!Array.isArray(facts) || facts.length < 2) problems.push(`${s.name}: needs at least 2 kid facts in game-text.json (key "${s.id}")`);
    s.facts = Array.isArray(facts) ? facts : [];
  }
  for (const id of Object.keys(text.kidFacts ?? {})) {
    if (!ids.has(id)) problems.push(`game-text.json has facts for "${id}", which is not in the ${item} list`);
  }

  const pictures = findPictures(themeDir, stickers, folders);
  problems.push(...pictures.problems);
  const credits = existsSync(join(themeDir, 'CREDITS.md')) ? parseCredits(readFileSync(join(themeDir, 'CREDITS.md'), 'utf8')) : [];
  if (existsSync(join(themeDir, 'credits.csv'))) credits.push(...parseCreditsCsv(readFileSync(join(themeDir, 'credits.csv'), 'utf8')));
  const uncredited = [];
  for (const s of stickers) {
    s.pictures = pictures.byId[s.id];
    for (const p of s.pictures) if (!isCredited(p, credits)) uncredited.push(p);
  }
  const sounds = findSounds(themeDir);
  for (const p of Object.values(sounds).flat()) if (!isCredited(p, credits)) uncredited.push(p);
  return { problems, uncredited, sounds };
}

/** The story text every theme's storyline carries, from its game-text.json (and its recorded sounds). */
function storyParts(text, sounds = {}) {
  return {
    sounds,
    milestones: text.milestones,
    detours: text.detours,
    detourCleared: text.detourCleared,
    setback: text.setback,
  };
}

function report(stickers, { sounds, ...checks }, where) {
  return {
    stickers: stickers.length,
    withPictures: stickers.filter((s) => s.pictures.length > 0).length,
    pictures: stickers.reduce((n, s) => n + s.pictures.length, 0),
    missingPictures: stickers.filter((s) => s.pictures.length === 0).map(where),
    ...checks,
  };
}

/** Builds the Dino theme's storyline. Returns { storyline, report }. */
export function buildDinoStoryline(themeDir = join(GAME_DIR, 'themes', 'dino')) {
  const text = JSON.parse(readFileSync(join(themeDir, 'game-text.json'), 'utf8'));
  const stickers = [];
  for (const period of DINO_PERIODS) {
    const markdown = readFileSync(join(themeDir, `${period.toLowerCase()}.md`), 'utf8');
    stickers.push(...parseDinoPeriod(markdown, period));
  }
  stickers.forEach((s, i) => (s.number = i + 1));
  const checks = addFactsAndPictures(themeDir, text, stickers, DINO_FOLDERS, 'dinosaur');

  const storyline = {
    schema: 1,
    theme: 'dino',
    title: text.title,
    intro: text.intro,
    traveler: text.traveler,
    stickers: stickers.map(({ id, number, periodNumber, name, period, group, diet, when, found, facts, pictures: pics }) => ({
      id, number, periodNumber, name, period, group, diet, when, found, facts, pictures: pics,
    })),
    ...storyParts(text, checks.sounds),
  };
  return { storyline, report: report(stickers, checks, (s) => `${s.period} #${s.periodNumber} ${s.name}`) };
}

/** Builds the Off-Roading theme's storyline from the national park region files. Returns { storyline, report }. */
export function buildParksStoryline(themeDir = join(GAME_DIR, 'themes', 'national-parks')) {
  const text = JSON.parse(readFileSync(join(themeDir, 'game-text.json'), 'utf8'));
  const stickers = [];
  for (const region of PARK_REGIONS) {
    const parks = parseParkRegion(readFileSync(join(themeDir, `${region.file}.md`), 'utf8'), region);
    parks.forEach((p, i) => (p.regionNumber = i + 1));
    stickers.push(...parks);
  }
  stickers.forEach((s, i) => (s.number = i + 1));
  const checks = addFactsAndPictures(themeDir, text, stickers, PARK_FOLDERS, 'park');
  for (const s of stickers) {
    if (!s.location) checks.problems.push(`${s.fullName}: no Location row in its region file`);
  }

  const storyline = {
    schema: 1,
    theme: 'parks',
    title: text.title,
    intro: text.intro,
    traveler: text.traveler,
    stickers: stickers.map((s) => ({
      id: s.id,
      number: s.number,
      regionNumber: s.regionNumber,
      name: s.name,
      // How the voice should say it, when that differs ("Wrangell–St. Elias" -> "Wrangell Saint Elias").
      ...(spokenName(s.name) !== s.name ? { spokenName: spokenName(s.name) } : {}),
      fullName: s.fullName,
      region: s.region,
      location: s.location,
      established: s.established,
      // Shown on the sticker card, one per line.
      details: [
        `Location: ${s.location}`,
        s.established && `National park since ${s.established}`,
        s.attractions.length && `Famous for: ${s.attractions.join(' · ')}`,
      ].filter(Boolean),
      facts: s.facts,
      pictures: s.pictures,
    })),
    ...storyParts(text, checks.sounds),
  };
  return { storyline, report: report(stickers, checks, (s) => `${s.regionFolder} #${s.regionNumber} ${s.name}`) };
}

/** Theme folder name -> builder. */
export const THEMES = { dino: buildDinoStoryline, 'national-parks': buildParksStoryline };

// ---------------------------------------------------------------- command line

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const wanted = process.argv.slice(2);
  const names = wanted.length ? wanted : Object.keys(THEMES);
  let failed = false;
  for (const name of names) {
    if (!THEMES[name]) {
      console.error(`Unknown theme "${name}". Themes: ${Object.keys(THEMES).join(', ')}`);
      failed = true;
      continue;
    }
    const themeDir = join(GAME_DIR, 'themes', name);
    const { storyline, report } = THEMES[name](themeDir);
    const out = join(themeDir, 'storyline.json');
    writeFileSync(out, `${JSON.stringify(storyline, null, 2)}\n`);
    console.log(`${name}: wrote ${out}`);
    console.log(`  ${report.stickers} stickers, ${report.withPictures} with pictures (${report.pictures} pictures, ${(totalSize(storyline, themeDir) / 1e6).toFixed(1)} MB)`);
    if (report.missingPictures.length) console.log(`  No pictures yet (the game shows a drawing): ${report.missingPictures.length}`);
    for (const p of report.uncredited) console.log(`  WARNING no credit line in CREDITS.md: ${p}`);
    for (const p of report.problems) console.log(`  PROBLEM ${p}`);
    if (report.problems.length) failed = true;
  }
  process.exit(failed ? 1 : 0);
}

function totalSize(storyline, themeDir) {
  return storyline.stickers.flatMap((s) => s.pictures).reduce((n, p) => n + statSync(join(themeDir, p)).size, 0);
}
