// Player pictures. Each of the 16 pictures comes in 5 colors, each a file in
// images/avatars/<id>/<color>.png (see the README there), so it can be
// replaced without touching the code. Every picture faces right, so on the
// trail map it moves toward the finish.
//
// `file` is the older drawing of each picture, shown if a color's file is
// missing. To add a picture, add a line here with a new id and its 5 colors in
// AVATAR_COLORS below.

export const AVATAR_FOLDER = 'images/avatars/';

export const AVATARS = Object.freeze([
  { id: 'longneck', label: 'Long-neck dinosaur', file: 'longneck.svg' },
  { id: 'triceratops', label: 'Triceratops', file: 'triceratops.svg' },
  { id: 'trex', label: 'T. rex', file: 'trex.svg' },
  { id: 'mosasaur', label: 'Mosasaur', file: 'mosasaur.svg' },
  { id: 'pterosaur', label: 'Pterosaur', file: 'pterosaur.svg' },
  { id: 'pickup', label: 'Pickup truck', file: 'pickup.svg' },
  { id: 'monstertruck', label: 'Monster truck', file: 'monstertruck.svg' },
  { id: 'dirtbike', label: 'Dirt bike', file: 'dirtbike.svg' },
  { id: 'suv', label: 'SUV', file: 'suv.svg' },
  { id: 'atv', label: 'ATV', file: 'atv.svg' },
  { id: 'robot', label: 'Robot', file: 'robot.svg' },
  { id: 'rocket', label: 'Rocket', file: 'rocket.svg' },
  { id: 'butterfly', label: 'Butterfly', file: 'butterfly.svg' },
  { id: 'unicorn', label: 'Unicorn', file: 'unicorn.svg' },
  { id: 'dog', label: 'Dog', file: 'dog.svg' },
  { id: 'cat', label: 'Cat', file: 'cat.svg' },
].map(Object.freeze));

export const AVATAR_IDS = Object.freeze(AVATARS.map((a) => a.id));

export function avatarInfo(id) {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}

/** A color number 1 to 5; anything else (an old save, a damaged one) is 1. */
export function checkColor(color) {
  return Number.isInteger(color) && color >= 1 && color <= COLOR_COUNT ? color : 1;
}

/** The color's file name, for example colorName('cat', 2) -> 'gray'. */
export function colorName(id, color = 1) {
  return AVATAR_COLORS[avatarInfo(id).id][checkColor(color) - 1];
}

/** The color as words, for example 'light brown'. */
export function colorLabel(id, color = 1) {
  const name = colorName(id, color);
  return COLOR_WORDS[name] ?? name;
}

/** The picture and color in words, for example 'Cat (light brown)'. */
export function avatarLabel(id, color = 1) {
  return `${avatarInfo(id).label} (${colorLabel(id, color)})`;
}

/** The picture's address in a color, relative to the game's page. */
export function avatarUrl(id, color = 1) {
  return `${AVATAR_FOLDER}${avatarInfo(id).id}/${colorName(id, color)}.png`;
}

/** The older drawing of the picture (shown if a color's file is missing). */
export function avatarDrawingUrl(id) {
  return AVATAR_FOLDER + encodeURIComponent(avatarInfo(id).file);
}

/** The picture as an <img> element, in a color (1-5). */
export function avatarIcon(id, { color = 1, className = 'avatar-icon', title = '' } = {}) {
  const img = document.createElement('img');
  img.className = className;
  img.addEventListener('error', () => {
    // A missing or damaged file: show the drawing instead (once, so a missing drawing can't loop).
    if (img.dataset.fallback) return;
    img.dataset.fallback = '1';
    img.src = avatarDrawingUrl(id);
  });
  img.src = avatarUrl(id, color);
  img.alt = title || avatarLabel(id, color);
  img.draggable = false;
  return img;
}

/** A player's picture as an <img> element. */
export function playerIcon(player, options = {}) {
  return avatarIcon(player.avatar, { ...options, color: player.color });
}

/**
 * The five colors of each picture, in the order players see them (color 1
 * first). Each is a file in images/avatars/<id>/<color>.png.
 */
export const AVATAR_COLORS = Object.freeze({
  longneck: ['green', 'blue', 'brown', 'purple', 'teal'],
  triceratops: ['green', 'blue', 'brown', 'purple', 'gold'],
  trex: ['green', 'blue', 'orange', 'purple', 'olive'],
  mosasaur: ['blue', 'teal', 'gray', 'purple', 'green'],
  pterosaur: ['orange', 'green', 'blue', 'red', 'purple'],
  pickup: ['red', 'blue', 'black', 'white', 'green'],
  monstertruck: ['red', 'blue', 'green', 'purple', 'yellow'],
  dirtbike: ['red', 'blue', 'green', 'orange', 'yellow'],
  suv: ['white', 'black', 'blue', 'red', 'green'],
  atv: ['red', 'blue', 'green', 'yellow', 'purple'],
  robot: ['white', 'red', 'teal', 'yellow', 'green'],
  rocket: ['red', 'blue', 'teal', 'black', 'purple'],
  butterfly: ['orange', 'blue', 'pink', 'purple', 'green'],
  unicorn: ['pink', 'blue', 'rainbow', 'lavender', 'whitegold'],
  dog: ['golden', 'black', 'brownwhite', 'husky', 'white'],
  cat: ['orange', 'gray', 'black', 'lightbrown', 'calico'],
});

export const COLOR_COUNT = 5;

/** Color names that are more than one word. */
const COLOR_WORDS = Object.freeze({ lightbrown: 'light brown', brownwhite: 'brown and white', whitegold: 'white and gold' });
