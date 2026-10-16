// Stage 2 tests: theme content (the story file, pictures and credits).
// Run from the arithmetic-odyssey folder with:  node --test
// Test IDs (T2.x) match the test plan in GAME-PLAN.md.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  GAME_DIR, PICTURE_TYPES, buildDinoStoryline, findPictures, isCredited, parseCredits, parseDinoPeriod, slug,
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
