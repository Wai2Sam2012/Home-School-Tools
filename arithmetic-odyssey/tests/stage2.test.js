// Stage 2 tests: theme content (the story file, pictures and credits).
// Run from the arithmetic-odyssey folder with:  node --test
// Test IDs (T2.x) match the test plan in GAME-PLAN.md.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  GAME_DIR, PARK_FOLDERS, PARK_REGIONS, PICTURE_TYPES, buildDinoStoryline, buildParksStoryline, findPictures, isCredited,
  parseCredits, parseCreditsCsv, parseDinoPeriod, parseParkRegion, shortParkName, slug, spokenName,
} from '../tools/build-storyline.mjs';

const DINO_DIR = join(GAME_DIR, 'themes', 'dino');
const { storyline, report } = buildDinoStoryline(DINO_DIR);

// Limits from GAME-PLAN.md (1.5 Pictures and T2.4).
const MAX_PICTURE_BYTES = 400 * 1024;
const MAX_PICTURE_SIDE = 1600;
const THEME_BUDGET_BYTES = 50 * 1000 * 1000;

/** Width and height of a JPEG, PNG or WebP file, read from its header. */
function pictureSize(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) { i += 1; continue; }
      const marker = bytes[i + 1];
      if (marker === 0xff) { i += 1; continue; }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const length = bytes.readUInt16BE(i + 2);
      // Start-of-frame markers C0-CF, except C4 (Huffman), C8 and CC (arithmetic coding).
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { width: bytes.readUInt16BE(i + 7), height: bytes.readUInt16BE(i + 5) };
      }
      i += 2 + length;
    }
    return null;
  }
  if (bytes.toString('latin1', 1, 4) === 'PNG') {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP') {
    const chunk = bytes.toString('latin1', 12, 16);
    if (chunk === 'VP8X') return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
    if (chunk === 'VP8 ') return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const bits = bytes.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

const allPictures = storyline.stickers.flatMap((s) => s.pictures);

// ---------------------------------------------------------------- T2.1
test('T2.1 Dino theme has 60 stickers in order: Triassic #1-20, Jurassic #1-20, Cretaceous #1-20', () => {
  assert.equal(storyline.stickers.length, 60);
  storyline.stickers.forEach((s, i) => {
    assert.equal(s.number, i + 1, `${s.name} should be sticker ${i + 1}`);
    assert.equal(s.period, ['Triassic', 'Jurassic', 'Cretaceous'][Math.floor(i / 20)], `${s.name} period`);
    assert.equal(s.periodNumber, (i % 20) + 1, `${s.name} place in its period`);
  });
  assert.equal(new Set(storyline.stickers.map((s) => s.id)).size, 60, 'sticker ids are unique');
  assert.equal(storyline.stickers[0].name, 'Eoraptor');
  assert.equal(storyline.stickers[59].name, 'Baryonyx');
});

test('T2.1 the stickers follow the quick list at the top of each period file', () => {
  for (const period of ['Triassic', 'Jurassic', 'Cretaceous']) {
    const markdown = readFileSync(join(DINO_DIR, `${period.toLowerCase()}.md`), 'utf8');
    const quickList = [...markdown.matchAll(/^\| (\d+) \| ([^|]+?) \|/gm)].map((m) => m[2]);
    const stickers = storyline.stickers.filter((s) => s.period === period).map((s) => s.name);
    assert.deepEqual(stickers, quickList, `${period} details are in the same order as the quick list`);
  }
});

// ---------------------------------------------------------------- T2.2
test('T2.2 every sticker has a name, 2-3 facts, and details from the fact files', () => {
  for (const s of storyline.stickers) {
    assert.ok(s.name.length > 0);
    assert.ok(s.facts.length >= 2 && s.facts.length <= 3, `${s.name} has ${s.facts.length} facts`);
    for (const fact of s.facts) {
      assert.ok(fact.length >= 10 && fact.length <= 120, `${s.name}: fact should be one short sentence: "${fact}"`);
      assert.match(fact, /[.!]["”]?$/, `${s.name}: fact should end with a full stop: "${fact}"`);
    }
    for (const field of ['group', 'diet', 'when', 'found']) {
      assert.ok(s[field], `${s.name} is missing "${field}" (check its section in ${s.period.toLowerCase()}.md)`);
    }
  }
});

test('T2.2 every picture in the story file exists on disk and is a picture type the game can show', () => {
  assert.ok(allPictures.length > 0, 'no pictures found');
  for (const p of allPictures) {
    assert.ok(statSync(join(DINO_DIR, p)).isFile(), `${p} is missing`);
    assert.ok(PICTURE_TYPES.some((ext) => p.toLowerCase().endsWith(ext)), `${p} type`);
  }
});

test('T2.2 every picture folder matches a dinosaur (no misnamed folders or loose files)', () => {
  assert.deepEqual(report.problems, []);
});

// ---------------------------------------------------------------- T2.4
test('T2.4 no picture is over 400 KB or wider/taller than 1600 px', () => {
  for (const p of allPictures) {
    const bytes = readFileSync(join(DINO_DIR, p));
    assert.ok(bytes.length <= MAX_PICTURE_BYTES, `${p} is ${Math.round(bytes.length / 1024)} KB (limit 400 KB)`);
    const size = pictureSize(bytes);
    assert.ok(size, `${p} is not a readable JPEG, PNG or WebP file`);
    assert.ok(size.width > 0 && size.height > 0, `${p} size`);
    assert.ok(Math.max(size.width, size.height) <= MAX_PICTURE_SIDE, `${p} is ${size.width}x${size.height} (limit ${MAX_PICTURE_SIDE} px)`);
  }
});

test('T2.4 the Dino theme is under its 50 MB size budget', () => {
  const total = allPictures.reduce((n, p) => n + statSync(join(DINO_DIR, p)).size, 0);
  assert.ok(total <= THEME_BUDGET_BYTES, `Dino pictures total ${(total / 1e6).toFixed(1)} MB`);
});

test('T2.4 the picture size reader understands JPEG, PNG and WebP headers', () => {
  const png = Buffer.alloc(24);
  png.write('\x89PNG', 0, 'latin1');
  png.writeUInt32BE(640, 16);
  png.writeUInt32BE(480, 20);
  assert.deepEqual(pictureSize(png), { width: 640, height: 480 });

  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0xe0, 0x02, 0x80, 0x03, 0, 0, 0, 0]);
  assert.deepEqual(pictureSize(jpeg), { width: 640, height: 480 });

  const webp = Buffer.alloc(30);
  webp.write('RIFF', 0, 'latin1');
  webp.write('WEBPVP8X', 8, 'latin1');
  webp.writeUIntLE(639, 24, 3);
  webp.writeUIntLE(479, 27, 3);
  assert.deepEqual(pictureSize(webp), { width: 640, height: 480 });

  assert.equal(pictureSize(Buffer.from('not a picture')), null);
});

// ---------------------------------------------------------------- T2.5
test('T2.5 every picture has a line in CREDITS.md', () => {
  assert.deepEqual(report.uncredited, []);
});

test('T2.5 credit lines can name one picture or a whole folder', () => {
  const credits = parseCredits([
    '| Picture file | Dinosaur | Source | License |',
    '| --- | --- | --- | --- |',
    '| `pictures/Triassic/Eoraptor/a.jpg` | Eoraptor | me | mine |',
    '| pictures/Jurassic/** | Jurassic | site | unknown |',
  ].join('\n'));
  assert.deepEqual(credits, ['pictures/Triassic/Eoraptor/a.jpg', 'pictures/Jurassic/**']);
  assert.ok(isCredited('pictures/Triassic/Eoraptor/a.jpg', credits));
  assert.ok(!isCredited('pictures/Triassic/Eoraptor/b.jpg', credits));
  assert.ok(isCredited('pictures/Jurassic/Stegosaurus/x.jpg', credits));
  assert.ok(!isCredited('pictures/JurassicPark/x.jpg', credits), 'a folder line only covers that folder');
});

// ---------------------------------------------------------------- story text
test('the story text has milestones, detours with a {count}, and kind setback messages', () => {
  assert.equal(storyline.schema, 1);
  assert.equal(storyline.theme, 'dino');
  assert.ok(storyline.title && storyline.intro && storyline.traveler);
  // A 100-question adventure has 9 milestones (every 10 questions) before Trail's End.
  assert.ok(storyline.milestones.length >= 9);
  assert.ok(storyline.detours.length >= 3);
  for (const d of storyline.detours) assert.match(d, /\{count\}/, `detour text needs {count}: "${d}"`);
  assert.ok(storyline.detourCleared.length >= 1);
  assert.ok(storyline.setback.length >= 1);
  for (const text of [...storyline.milestones, ...storyline.detours, ...storyline.detourCleared, ...storyline.setback]) {
    assert.ok(text.length <= 140, `story text is too long to read aloud quickly: "${text}"`);
  }
});

// ---------------------------------------------------------------- the builder
test('dinosaur names become simple ids', () => {
  assert.equal(slug('Tyrannosaurus rex'), 'tyrannosaurus-rex');
  assert.equal(slug('Apatosaurus / Brontosaurus'), 'apatosaurus-brontosaurus');
  assert.equal(slug('Eoraptor'), 'eoraptor');
});

test('the period file reader picks up name, type, diet, period and where found', () => {
  const md = [
    '### 1. Eoraptor',
    '- **Type:** Early saurischian · Omnivore',
    '- **Period:** **Late** Triassic, ~231 Ma',
    '- **Found:** [Argentina](https://example.org)',
    '',
    '### 2. Apatosaurus / Brontosaurus',
    '- **Type:** Sauropod · Herbivore',
    '- **Period:** Late Jurassic',
    '- **Found:** USA',
  ].join('\n');
  const dinos = parseDinoPeriod(md, 'Triassic');
  assert.equal(dinos.length, 2);
  assert.deepEqual(dinos[0], {
    id: 'eoraptor', periodNumber: 1, name: 'Eoraptor', period: 'Triassic',
    group: 'Early saurischian', diet: 'Omnivore', when: 'Late Triassic, ~231 Ma', found: 'Argentina',
  });
  assert.equal(dinos[1].id, 'apatosaurus-brontosaurus');
});

test('picture folders are matched by name and misplaced files are reported (test folder)', () => {
  const theme = mkdtempSync(join(tmpdir(), 'ao-theme-'));
  const files = [
    'pictures/Triassic/Eoraptor/Eoraptor_1.jpg',
    'pictures/Triassic/Eoraptor/Eoraptor+2.JPG', // "+" and capital letters are fine
    'pictures/jurassic/brontosaurus/b.jpg', // folder case doesn't matter; either half of "Apatosaurus / Brontosaurus"
    'pictures/Cretaceous/Tyrannosaurus/t.webp', // first word of "Tyrannosaurus rex"
    'pictures/Cretaceous/T-rex/t.jpg', // unknown folder
    'pictures/Permian/Dimetrodon/d.jpg', // unknown period
    'pictures/Triassic/loose.jpg', // not in a dinosaur folder
    'pictures/stray.jpg', // not in a period folder
    'pictures/Triassic/Eoraptor/notes.txt', // not a picture
    'pictures/Triassic/Eoraptor/.DS_Store', // hidden files are ignored
  ];
  const stickers = [
    { id: 'eoraptor', name: 'Eoraptor', period: 'Triassic' },
    { id: 'apatosaurus-brontosaurus', name: 'Apatosaurus / Brontosaurus', period: 'Jurassic' },
    { id: 'tyrannosaurus-rex', name: 'Tyrannosaurus rex', period: 'Cretaceous' },
  ];
  try {
    for (const f of files) {
      mkdirSync(dirname(join(theme, f)), { recursive: true });
      writeFileSync(join(theme, f), 'x');
    }
    const { byId, problems } = findPictures(theme, stickers);
    assert.deepEqual(byId.eoraptor.sort(), ['pictures/Triassic/Eoraptor/Eoraptor+2.JPG', 'pictures/Triassic/Eoraptor/Eoraptor_1.jpg']);
    assert.deepEqual(byId['apatosaurus-brontosaurus'], ['pictures/jurassic/brontosaurus/b.jpg']);
    assert.deepEqual(byId['tyrannosaurus-rex'], ['pictures/Cretaceous/Tyrannosaurus/t.webp']);
    const text = problems.join('\n');
    assert.equal(problems.length, 5, text);
    assert.match(text, /T-rex/);
    assert.match(text, /Permian/);
    assert.match(text, /loose\.jpg/);
    assert.match(text, /stray\.jpg/);
    assert.match(text, /notes\.txt/);
  } finally {
    rmSync(theme, { recursive: true, force: true });
  }
});

test('a theme with no pictures folder builds with every sticker using the drawn placeholder', () => {
  const theme = mkdtempSync(join(tmpdir(), 'ao-theme-'));
  try {
    const { byId, problems } = findPictures(theme, [{ id: 'eoraptor', name: 'Eoraptor', period: 'Triassic' }]);
    assert.deepEqual(byId, { eoraptor: [] });
    assert.deepEqual(problems, []);
  } finally {
    rmSync(theme, { recursive: true, force: true });
  }
});

// ================================================================ Off-Roading (national parks) theme

const PARKS_DIR = join(GAME_DIR, 'themes', 'national-parks');
const parks = buildParksStoryline(PARKS_DIR);
const parkPictures = parks.storyline.stickers.flatMap((s) => s.pictures);
const PARKS_PER_REGION = [8, 9, 7, 13, 10, 5, 11];

test('T2.1 Off-Roading has 63 stickers: region by region in the README order, alphabetical inside each region', () => {
  const stickers = parks.storyline.stickers;
  assert.equal(stickers.length, 63);
  assert.equal(new Set(stickers.map((s) => s.id)).size, 63, 'sticker ids are unique');
  stickers.forEach((s, i) => assert.equal(s.number, i + 1, `${s.name} should be sticker ${i + 1}`));
  let start = 0;
  PARK_REGIONS.forEach((region, r) => {
    const inRegion = stickers.slice(start, start + PARKS_PER_REGION[r]);
    for (const s of inRegion) assert.equal(s.region, region.title, `${s.name} region`);
    assert.deepEqual(inRegion.map((s) => s.regionNumber), inRegion.map((_, i) => i + 1));
    const names = inRegion.map((s) => s.name);
    assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })), `${region.title} is alphabetical`);
    start += PARKS_PER_REGION[r];
  });
  assert.equal(stickers[0].name, 'Denali');
  assert.equal(stickers[62].name, 'Virgin Islands');
});

test('T2.1 the region order matches the README region table', () => {
  const readme = readFileSync(join(PARKS_DIR, 'README.md'), 'utf8');
  const table = [...readme.matchAll(/^\| \[[^\]]+\]\(([a-z-]+)\.md\) \| (\d+) \|/gm)].map((m) => [m[1], Number(m[2])]);
  assert.deepEqual(table, PARK_REGIONS.map((r, i) => [r.file, PARKS_PER_REGION[i]]));
});

test('T2.2 every park has a name, 2-3 short facts and its details', () => {
  for (const s of parks.storyline.stickers) {
    assert.ok(s.name.length > 0);
    assert.ok(s.facts.length >= 2 && s.facts.length <= 3, `${s.name} has ${s.facts.length} facts`);
    for (const fact of s.facts) {
      assert.ok(fact.length >= 10 && fact.length <= 120, `${s.name}: fact should be one short sentence: "${fact}"`);
      assert.match(fact, /[.!]["”]?$/, `${s.name}: fact should end with a full stop: "${fact}"`);
      assert.doesNotMatch(fact, /\bSt\./, `${s.name}: write "Saint" so the voice doesn't say "street": "${fact}"`);
    }
    assert.ok(s.location, `${s.name} location`);
    assert.match(s.established, /^(18|19|20)\d\d$/, `${s.name} year`);
    assert.match(s.details[0], /^Location: /);
    assert.ok(s.details.some((d) => d.startsWith('Famous for: ')), `${s.name} attractions`);
  }
});

test('T2.2 every park picture exists on disk and every picture folder matches a park', () => {
  for (const p of parkPictures) {
    assert.ok(statSync(join(PARKS_DIR, p)).isFile(), `${p} is missing`);
    assert.ok(PICTURE_TYPES.some((ext) => p.toLowerCase().endsWith(ext)), `${p} type`);
  }
  assert.deepEqual(parks.report.problems, []);
});

test('T2.2 every folder name in PICTURES.md matches its park', () => {
  const guide = readFileSync(join(PARKS_DIR, 'PICTURES.md'), 'utf8');
  const rows = [...guide.matchAll(/^\| `([A-Za-z-]+)` \| ([^|]+) \|$/gm)];
  assert.equal(rows.length, 7, 'one row per region');
  const theme = mkdtempSync(join(tmpdir(), 'ao-parks-'));
  try {
    const expected = {};
    for (const [, region, list] of rows) {
      for (const park of list.split(',').map((p) => p.trim())) {
        const where = `pictures/${region}/${park}/x.jpg`;
        mkdirSync(dirname(join(theme, where)), { recursive: true });
        writeFileSync(join(theme, where), 'x');
        expected[where] = true;
      }
    }
    const { byId, problems } = findPictures(theme, parks.storyline.stickers.map((s) => ({ ...s, regionFolder: PARK_REGIONS.find((r) => r.title === s.region).folder })), PARK_FOLDERS);
    assert.deepEqual(problems, []);
    const found = Object.values(byId).flat();
    assert.equal(found.length, 63, 'each folder matches exactly one park');
    assert.ok(Object.values(byId).every((list) => list.length === 1), 'every park gets its folder');
  } finally {
    rmSync(theme, { recursive: true, force: true });
  }
});

test('T2.4 no park picture is over 400 KB or wider/taller than 1600 px', () => {
  for (const p of parkPictures) {
    const bytes = readFileSync(join(PARKS_DIR, p));
    assert.ok(bytes.length <= MAX_PICTURE_BYTES, `${p} is ${Math.round(bytes.length / 1024)} KB (limit 400 KB)`);
    const size = pictureSize(bytes);
    assert.ok(size, `${p} is not a readable JPEG, PNG or WebP file`);
    assert.ok(Math.max(size.width, size.height) <= MAX_PICTURE_SIDE, `${p} is ${size.width}x${size.height} (limit ${MAX_PICTURE_SIDE} px)`);
  }
});

test('T2.4 the Off-Roading theme is under its 50 MB size budget', () => {
  const total = parkPictures.reduce((n, p) => n + statSync(join(PARKS_DIR, p)).size, 0);
  assert.ok(total <= THEME_BUDGET_BYTES, `Off-Roading pictures total ${(total / 1e6).toFixed(1)} MB; keep about 3 pictures per park`);
});

test('T2.5 every park picture has a credit (CREDITS.md or the downloader\'s credits.csv)', () => {
  assert.deepEqual(parks.report.uncredited, []);
});

test('the Off-Roading story text has milestones, detours with a {count}, and kind setback messages', () => {
  const s = parks.storyline;
  assert.equal(s.theme, 'parks');
  assert.ok(s.title && s.intro && s.traveler);
  assert.ok(s.milestones.length >= 9);
  assert.ok(s.detours.length >= 3);
  for (const d of s.detours) assert.match(d, /\{count\}/, `detour text needs {count}: "${d}"`);
  for (const text of [...s.milestones, ...s.detours, ...s.detourCleared, ...s.setback]) {
    assert.ok(text.length <= 140, `story text is too long to read aloud quickly: "${text}"`);
  }
});

test('park names: short names, ids and how the voice says them', () => {
  assert.equal(shortParkName('Arches National Park'), 'Arches');
  assert.equal(shortParkName('National Park of American Samoa'), 'American Samoa');
  assert.equal(shortParkName('Wrangell–St. Elias National Park'), 'Wrangell–St. Elias');
  assert.equal(slug('Hawaiʻi Volcanoes'), 'hawaii-volcanoes');
  assert.equal(slug('Haleakalā'), 'haleakala');
  assert.equal(spokenName('Wrangell–St. Elias'), 'Wrangell Saint Elias');
  assert.equal(spokenName('Hawaiʻi Volcanoes'), 'Hawaii Volcanoes');
  assert.equal(spokenName('Denali'), 'Denali');
  const wrangell = parks.storyline.stickers.find((s) => s.id === 'wrangell-st-elias');
  assert.equal(wrangell.spokenName, 'Wrangell Saint Elias');
  assert.equal(parks.storyline.stickers.find((s) => s.id === 'denali').spokenName, undefined);
});

test('the region file reader picks up location, year and attractions', () => {
  const md = [
    '# Test', '', '## Zeta National Park', '', '| | |', '|---|---|', '| **Location** | Utah |',
    '| **Became a national park** | November 12, 1971 (national monument from 1929) |', '',
    '**Key attractions**', '', '- **Delicate Arch:** The famous one.', '- **Fiery Furnace:** A maze.', '',
    '## Alpha National Park', '', '| **Location** | Alaska |', '| **Became a national park** | 1980 |', '', '- **Ice:** Cold.',
    '## Not a park', 'text',
  ].join('\n');
  const list = parseParkRegion(md, { title: 'Test', folder: 'Test' });
  assert.deepEqual(list.map((p) => p.name), ['Alpha', 'Zeta'], 'alphabetical, and only park sections');
  assert.equal(list[1].location, 'Utah');
  assert.equal(list[1].established, '1971');
  assert.deepEqual(list[1].attractions, ['Delicate Arch', 'Fiery Furnace']);
});

test('the downloader\'s credits.csv counts as credits, one picture per row', () => {
  const csv = '﻿"File","Park","Attraction","Title","Source","Author","License","LicenseUrl"\r\n'
    + '"pictures/Alaska/Denali/Denali - Wildlife_1.jpg","Denali","Wildlife","File:A, ""B"".jpg","https://x","Ann","CC BY-SA 4.0","https://y"\r\n'
    + '"pictures/Alaska/Katmai/Katmai - Brooks Falls_1.jpg","Katmai","Brooks\nFalls","t","s","a","l","u"\r\n';
  const credits = parseCreditsCsv(csv);
  assert.deepEqual(credits, ['pictures/Alaska/Denali/Denali - Wildlife_1.jpg', 'pictures/Alaska/Katmai/Katmai - Brooks Falls_1.jpg']);
  assert.ok(isCredited('pictures/Alaska/Denali/Denali - Wildlife_1.jpg', credits));
  assert.ok(!isCredited('pictures/Alaska/Denali/Denali - Wildlife_2.jpg', credits));
  assert.deepEqual(parseCreditsCsv('"Name","Other"\n"a","b"\n'), [], 'no File column: nothing');
  assert.deepEqual(parseCreditsCsv(''), []);
});
