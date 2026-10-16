// Builds each theme's storyline.json, the file the game reads, from:
//   - the theme's Markdown fact files (names, periods, where found),
//   - the theme's game-text.json (kid-friendly facts and story text),
//   - the pictures in the theme's pictures/ folder,
//   - the theme's CREDITS.md.
//
// Usage (from the arithmetic-odyssey folder):
//   node tools/build-storyline.mjs          build every theme
//   node tools/build-storyline.mjs dino     build one theme
//
// storyline.json is not stored in git: the deploy workflow and the local
// server build it, so pictures uploaded on GitHub appear automatically.
// Run this yourself after adding pictures if you test with your own server.

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const GAME_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const PICTURE_TYPES = ['.jpg', '.jpeg', '.png', '.webp'];

// ---------------------------------------------------------------- helpers

/** "Tyrannosaurus rex" -> "tyrannosaurus-rex", "Apatosaurus / Brontosaurus" -> "apatosaurus-brontosaurus" */
export function slug(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
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

/** Words used to match a picture folder to a sticker, e.g. Tyrannosaurus rex -> tyrannosaurusrex, tyrannosaurus */
function folderKeys(name) {
  const keys = new Set();
  const squash = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
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

// ---------------------------------------------------------------- credits

/** Picture paths (or "folder/**" defaults) listed in the first column of CREDITS.md tables. */
export function parseCredits(markdown) {
  const entries = [];
  for (const line of markdown.split('\n')) {
    const cell = line.match(/^\|\s*`?([^|`]+?)`?\s*\|/);
    if (!cell) continue;
    const value = cell[1].trim();
    if (value.startsWith('pictures/')) entries.push(value);
  }
  return entries;
}

export function isCredited(picturePath, credits) {
  return credits.some((entry) =>
    entry.endsWith('/**') ? picturePath.startsWith(entry.slice(0, -2)) : entry === picturePath,
  );
}

// ---------------------------------------------------------------- pictures

/**
 * Finds the pictures for each sticker. Pictures live in
 * pictures/<Period>/<Dinosaur>/<any name>.jpg, matching the folders made by
 * the picture downloader. Returns { byId, problems }.
 */
export function findPictures(themeDir, stickers) {
  const byId = Object.fromEntries(stickers.map((s) => [s.id, []]));
  const problems = [];
  const root = join(themeDir, 'pictures');
  if (!existsSync(root)) return { byId, problems };

  for (const periodEntry of readdirSync(root, { withFileTypes: true })) {
    if (periodEntry.name.startsWith('.')) continue;
    if (!periodEntry.isDirectory()) {
      problems.push(`pictures/${periodEntry.name}: put pictures in a folder for their period and dinosaur, e.g. pictures/Triassic/Eoraptor/`);
      continue;
    }
    const inPeriod = stickers.filter((s) => s.period.toLowerCase() === periodEntry.name.toLowerCase());
    if (inPeriod.length === 0) {
      problems.push(`pictures/${periodEntry.name}/: unknown period folder (use ${DINO_PERIODS.join(', ')})`);
      continue;
    }
    for (const dinoEntry of readdirSync(join(root, periodEntry.name), { withFileTypes: true })) {
      if (dinoEntry.name.startsWith('.')) continue;
      const where = `pictures/${periodEntry.name}/${dinoEntry.name}`;
      if (!dinoEntry.isDirectory()) {
        problems.push(`${where}: put pictures inside the dinosaur's folder`);
        continue;
      }
      const key = dinoEntry.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const sticker = inPeriod.find((s) => folderKeys(s.name).has(key));
      if (!sticker) {
        problems.push(`${where}/: no ${periodEntry.name} dinosaur called "${dinoEntry.name}" in the list`);
        continue;
      }
      const files = readdirSync(join(root, periodEntry.name, dinoEntry.name), { withFileTypes: true })
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

/** Builds the Dino theme's storyline. Returns { storyline, report }. */
export function buildDinoStoryline(themeDir = join(GAME_DIR, 'themes', 'dino')) {
  const text = JSON.parse(readFileSync(join(themeDir, 'game-text.json'), 'utf8'));
  const stickers = [];
  for (const period of DINO_PERIODS) {
    const markdown = readFileSync(join(themeDir, `${period.toLowerCase()}.md`), 'utf8');
    stickers.push(...parseDinoPeriod(markdown, period));
  }
  stickers.forEach((s, i) => (s.number = i + 1));

  const problems = [];
  const ids = new Set(stickers.map((s) => s.id));
  for (const s of stickers) {
    const facts = text.kidFacts?.[s.id];
    if (!Array.isArray(facts) || facts.length < 2) problems.push(`${s.name}: needs at least 2 kid facts in game-text.json`);
    s.facts = Array.isArray(facts) ? facts : [];
  }
  for (const id of Object.keys(text.kidFacts ?? {})) {
    if (!ids.has(id)) problems.push(`game-text.json has facts for "${id}", which is not in the dinosaur list`);
  }

  const pictures = findPictures(themeDir, stickers);
  problems.push(...pictures.problems);
  const credits = existsSync(join(themeDir, 'CREDITS.md')) ? parseCredits(readFileSync(join(themeDir, 'CREDITS.md'), 'utf8')) : [];
  const uncredited = [];
  for (const s of stickers) {
    s.pictures = pictures.byId[s.id];
    for (const p of s.pictures) if (!isCredited(p, credits)) uncredited.push(p);
  }

  const storyline = {
    schema: 1,
    theme: 'dino',
    title: text.title,
    intro: text.intro,
    traveler: text.traveler,
    stickers: stickers.map(({ id, number, periodNumber, name, period, group, diet, when, found, facts, pictures: pics }) => ({
      id, number, periodNumber, name, period, group, diet, when, found, facts, pictures: pics,
    })),
    milestones: text.milestones,
    detours: text.detours,
    detourCleared: text.detourCleared,
    setback: text.setback,
  };
  const withPictures = stickers.filter((s) => s.pictures.length > 0).length;
  return {
    storyline,
    report: {
      stickers: stickers.length,
      withPictures,
      pictures: stickers.reduce((n, s) => n + s.pictures.length, 0),
      missingPictures: stickers.filter((s) => s.pictures.length === 0).map((s) => `${s.period} #${s.periodNumber} ${s.name}`),
      uncredited,
      problems,
    },
  };
}

export const THEMES = { dino: buildDinoStoryline };

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
