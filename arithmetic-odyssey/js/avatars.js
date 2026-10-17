// Player pictures. Each one is a file in images/avatars/ (see the README
// there), so it can be edited or replaced without touching the code. Every
// picture faces right, so on the trail map it moves toward the finish.
//
// To change a picture, edit or replace its file. To use a PNG or JPEG
// instead, put the file in images/avatars/ and change `file` below. To add a
// picture, add a line here with a new id.

export const AVATAR_FOLDER = 'images/avatars/';

export const AVATARS = Object.freeze([
  { id: 'longneck', label: 'Long-neck dinosaur', file: 'longneck.svg' },
  { id: 'triceratops', label: 'Triceratops', file: 'triceratops.svg' },
  { id: 'trex', label: 'T. rex', file: 'trex.svg' },
  { id: 'mosasaur', label: 'Mosasaur', file: 'mosasaur.svg' },
  { id: 'pterosaur', label: 'Pterosaur', file: 'pterosaur.svg' },
  { id: 'pickup', label: 'Blue pickup truck', file: 'pickup.svg' },
  { id: 'monstertruck', label: 'Monster truck', file: 'monstertruck.svg' },
  { id: 'dirtbike', label: 'Dirt bike', file: 'dirtbike.svg' },
  { id: 'suv', label: 'Blue SUV', file: 'suv.svg' },
  { id: 'atv', label: 'Blue ATV', file: 'atv.svg' },
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

/** The picture's address, relative to the game's page. */
export function avatarUrl(id) {
  return AVATAR_FOLDER + encodeURIComponent(avatarInfo(id).file);
}

/** The picture as an <img> element. */
export function avatarIcon(id, { className = 'avatar-icon', title = '' } = {}) {
  const img = document.createElement('img');
  img.className = className;
  img.src = avatarUrl(id);
  img.alt = title || avatarInfo(id).label;
  img.draggable = false;
  return img;
}
