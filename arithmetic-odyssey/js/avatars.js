// Player icons: small drawings (SVG) instead of emoji, because there are
// no emoji for most of them and the iPad's emoji face left. Every icon
// faces right, so on the trail map it moves toward the finish.
// Each drawing uses a 64 × 64 box.

const EYE = '#1d1d1d';

export const AVATARS = Object.freeze([
  {
    id: 'longneck',
    label: 'Long-neck dinosaur',
    svg: `
      <path d="M4 44 Q14 38 22 39 L22 46 Q12 49 4 44Z" fill="#5fa042"/>
      <ellipse cx="30" cy="42" rx="14" ry="10" fill="#6ab04c"/>
      <path d="M37 36 Q45 26 46 12 L53 12 Q52 30 43 42Z" fill="#6ab04c"/>
      <ellipse cx="52" cy="11" rx="8" ry="5" fill="#6ab04c"/>
      <rect x="21" y="47" width="6" height="12" rx="2" fill="#5fa042"/>
      <rect x="34" y="47" width="6" height="12" rx="2" fill="#5fa042"/>
      <ellipse cx="30" cy="46" rx="10" ry="4" fill="#9fd08a"/>
      <circle cx="55" cy="10" r="1.4" fill="${EYE}"/>
      <circle cx="26" cy="37" r="2" fill="#4f8a36"/><circle cx="33" cy="35" r="1.6" fill="#4f8a36"/>`,
  },
  {
    id: 'triceratops',
    label: 'Triceratops',
    svg: `
      <path d="M4 40 Q12 35 20 37 L20 44 Q11 46 4 40Z" fill="#d86a2e"/>
      <ellipse cx="29" cy="40" rx="14" ry="10" fill="#e17b3c"/>
      <circle cx="43" cy="31" r="11" fill="#b8551f"/>
      <path d="M41 30 Q52 26 59 35 Q57 43 45 43Z" fill="#e17b3c"/>
      <path d="M45 29 L61 20 L49 32Z" fill="#f5efe0"/>
      <path d="M49 30 L63 25 L52 33Z" fill="#f5efe0"/>
      <path d="M56 34 L62 32 L58 37Z" fill="#f5efe0"/>
      <rect x="19" y="45" width="6" height="12" rx="2" fill="#c9622b"/>
      <rect x="33" y="45" width="6" height="12" rx="2" fill="#c9622b"/>
      <circle cx="50" cy="35" r="1.5" fill="${EYE}"/>`,
  },
  {
    id: 'trex',
    label: 'T. rex',
    svg: `
      <path d="M2 28 L22 25 L24 35Z" fill="#3f8a50"/>
      <ellipse cx="28" cy="33" rx="12" ry="10" fill="#4e9a5b"/>
      <path d="M33 26 L38 16 L44 22 L40 31Z" fill="#4e9a5b"/>
      <rect x="35" y="8" width="25" height="16" rx="6" fill="#4e9a5b"/>
      <path d="M44 20 L60 20 L58 25 L44 24Z" fill="#3f8a50"/>
      <path d="M46 20 L48 22.5 L50 20 L52 22.5 L54 20 L56 22.5 L58 20Z" fill="#fff"/>
      <circle cx="49" cy="13" r="1.8" fill="${EYE}"/>
      <path d="M37 33 L44 37" stroke="#3f8a50" stroke-width="3" stroke-linecap="round"/>
      <path d="M20 38 L18 56 L26 56 L28 42Z" fill="#3f8a50"/>
      <path d="M30 40 L32 56 L40 56 L36 40Z" fill="#3f8a50"/>
      <ellipse cx="28" cy="36" rx="7" ry="4" fill="#8cc58f"/>`,
  },
  {
    id: 'mosasaur',
    label: 'Mosasaur',
    svg: `
      <path d="M2 50 Q10 46 18 50 T34 50 T50 50 T64 50" stroke="#8fd3f5" stroke-width="3" fill="none"/>
      <path d="M2 22 L11 30 L2 38Z" fill="#1f6fa8"/>
      <path d="M8 30 Q16 21 28 25 Q42 20 52 24 Q62 27 63 31 Q57 35 47 35 Q32 39 20 35 Q12 37 8 30Z" fill="#2e86c1"/>
      <path d="M20 34 Q32 37 47 34 Q36 31 22 31Z" fill="#a9d6f2"/>
      <ellipse cx="27" cy="38" rx="6" ry="2.5" transform="rotate(25 27 38)" fill="#1f6fa8"/>
      <ellipse cx="42" cy="37" rx="5" ry="2.2" transform="rotate(25 42 37)" fill="#1f6fa8"/>
      <path d="M50 31 L63 31" stroke="#174f78" stroke-width="1.5"/>
      <path d="M52 31 L53.5 33 L55 31 L56.5 33 L58 31 L59.5 33 L61 31Z" fill="#fff"/>
      <circle cx="53" cy="27" r="1.5" fill="${EYE}"/>
      <path d="M30 22 L34 16 L38 22Z" fill="#1f6fa8"/>`,
  },
  {
    id: 'pterosaur',
    label: 'Pterosaur',
    svg: `
      <path d="M4 16 L36 31 L22 46Z" fill="#a77c9f"/>
      <path d="M30 30 L42 6 L46 32Z" fill="#8e6c88"/>
      <ellipse cx="36" cy="32" rx="9" ry="4.5" fill="#7d5c77"/>
      <path d="M41 28 L63 31 L43 35Z" fill="#e0b04a"/>
      <path d="M42 29 L33 19 L46 27Z" fill="#c0392b"/>
      <circle cx="46" cy="30" r="1.5" fill="${EYE}"/>
      <path d="M30 36 L28 42 M34 36 L33 42" stroke="#7d5c77" stroke-width="2" stroke-linecap="round"/>`,
  },
  {
    id: 'pickup',
    label: 'Blue pickup truck',
    svg: `
      <rect x="4" y="33" width="27" height="13" rx="2" fill="#2f6fd6"/>
      <path d="M30 46 L30 23 L44 23 L52 33 L61 35 L61 46Z" fill="#2f6fd6"/>
      <path d="M33 26 L43 26 L48 33 L33 33Z" fill="#cfe8ff"/>
      <rect x="4" y="31" width="27" height="3" rx="1" fill="#1d4f9e"/>
      <rect x="57" y="37" width="4" height="3" rx="1" fill="#ffd54a"/>
      <circle cx="17" cy="47" r="7" fill="#2b2b2b"/><circle cx="17" cy="47" r="3" fill="#bdc3c7"/>
      <circle cx="49" cy="47" r="7" fill="#2b2b2b"/><circle cx="49" cy="47" r="3" fill="#bdc3c7"/>`,
  },
  {
    id: 'monstertruck',
    label: 'Monster truck',
    svg: `
      <path d="M14 38 L14 30 M50 38 L50 30" stroke="#555" stroke-width="3"/>
      <rect x="6" y="20" width="52" height="11" rx="3" fill="#d64541"/>
      <path d="M26 20 L30 9 L44 9 L50 20Z" fill="#d64541"/>
      <path d="M31 12 L43 12 L46 19 L30 19Z" fill="#cfe8ff"/>
      <rect x="54" y="23" width="4" height="3" rx="1" fill="#ffd54a"/>
      <circle cx="16" cy="48" r="12" fill="#2b2b2b"/><circle cx="16" cy="48" r="5" fill="#95a5a6"/>
      <circle cx="48" cy="48" r="12" fill="#2b2b2b"/><circle cx="48" cy="48" r="5" fill="#95a5a6"/>
      <path d="M6 44 L4 44 M6 52 L4 52 M58 44 L60 44 M58 52 L60 52" stroke="#2b2b2b" stroke-width="3"/>`,
  },
  {
    id: 'dirtbike',
    label: 'Dirt bike',
    svg: `
      <circle cx="13" cy="45" r="10" fill="none" stroke="#2b2b2b" stroke-width="4"/>
      <circle cx="51" cy="45" r="10" fill="none" stroke="#2b2b2b" stroke-width="4"/>
      <path d="M13 45 L26 33 L40 33 L51 45" stroke="#7f8c8d" stroke-width="3" fill="none"/>
      <path d="M22 30 L36 28 L42 34 L26 37Z" fill="#f39c12"/>
      <path d="M18 27 L32 26" stroke="#2b2b2b" stroke-width="4" stroke-linecap="round"/>
      <path d="M51 45 L44 22" stroke="#7f8c8d" stroke-width="3"/>
      <path d="M40 20 L48 18" stroke="#2b2b2b" stroke-width="3" stroke-linecap="round"/>
      <path d="M44 28 Q54 26 58 33" stroke="#f39c12" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M6 33 Q12 29 20 31" stroke="#f39c12" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  },
  {
    id: 'suv',
    label: 'Blue SUV',
    svg: `
      <path d="M4 44 L4 26 L14 17 L44 17 L55 29 L61 31 L61 44Z" fill="#3c8ce7"/>
      <path d="M15 20 L28 20 L28 29 L9 29Z" fill="#cfe8ff"/>
      <path d="M31 20 L43 20 L51 29 L31 29Z" fill="#cfe8ff"/>
      <rect x="4" y="34" width="57" height="3" fill="#2a6fc0"/>
      <rect x="57" y="32" width="4" height="3" rx="1" fill="#ffd54a"/>
      <circle cx="17" cy="45" r="7" fill="#2b2b2b"/><circle cx="17" cy="45" r="3" fill="#bdc3c7"/>
      <circle cx="48" cy="45" r="7" fill="#2b2b2b"/><circle cx="48" cy="45" r="3" fill="#bdc3c7"/>`,
  },
  {
    id: 'atv',
    label: 'Blue ATV',
    svg: `
      <circle cx="15" cy="45" r="11" fill="#2b2b2b"/><circle cx="15" cy="45" r="4" fill="#95a5a6"/>
      <circle cx="49" cy="45" r="11" fill="#2b2b2b"/><circle cx="49" cy="45" r="4" fill="#95a5a6"/>
      <path d="M3 36 Q15 24 27 34Z" fill="#2f6fd6"/>
      <path d="M37 34 Q49 24 61 36Z" fill="#2f6fd6"/>
      <rect x="20" y="27" width="24" height="9" rx="3" fill="#2f6fd6"/>
      <rect x="18" y="23" width="16" height="5" rx="2" fill="#2b2b2b"/>
      <path d="M42 27 L46 17" stroke="#555" stroke-width="3"/>
      <path d="M42 16 L50 16" stroke="#2b2b2b" stroke-width="3" stroke-linecap="round"/>`,
  },
  {
    id: 'robot',
    label: 'Robot',
    svg: `
      <path d="M32 9 L32 4" stroke="#7f8c8d" stroke-width="2"/><circle cx="32" cy="4" r="2.5" fill="#e74c3c"/>
      <rect x="18" y="9" width="28" height="20" rx="5" fill="#95a5a6"/>
      <rect x="22" y="13" width="20" height="9" rx="3" fill="#2b2b2b"/>
      <circle cx="29" cy="17.5" r="2.4" fill="#7ee0ff"/><circle cx="38" cy="17.5" r="2.4" fill="#7ee0ff"/>
      <rect x="26" y="24" width="12" height="2" rx="1" fill="#2b2b2b"/>
      <rect x="16" y="31" width="32" height="20" rx="4" fill="#b2bec3"/>
      <circle cx="32" cy="41" r="4" fill="#f1c40f"/>
      <path d="M16 36 L8 44 M48 36 L57 30" stroke="#7f8c8d" stroke-width="4" stroke-linecap="round"/>
      <rect x="20" y="51" width="8" height="9" rx="2" fill="#7f8c8d"/><rect x="36" y="51" width="8" height="9" rx="2" fill="#7f8c8d"/>`,
  },
  {
    id: 'rocket',
    label: 'Rocket',
    svg: `
      <path d="M11 26 L0 32 L11 38Z" fill="#f39c12"/><path d="M11 29 L5 32 L11 35Z" fill="#ffe066"/>
      <path d="M10 32 Q22 18 44 22 Q56 25 62 32 Q56 39 44 42 Q22 46 10 32Z" fill="#ecf0f1"/>
      <path d="M48 23 Q57 26 62 32 Q57 38 48 41Z" fill="#e74c3c"/>
      <path d="M16 25 L10 14 L26 22Z" fill="#e74c3c"/><path d="M16 39 L10 50 L26 42Z" fill="#e74c3c"/>
      <circle cx="36" cy="32" r="5" fill="#3c8ce7" stroke="#bdc3c7" stroke-width="2"/>`,
  },
  {
    id: 'butterfly',
    label: 'Butterfly',
    svg: `
      <ellipse cx="22" cy="22" rx="13" ry="12" fill="#9b59b6"/>
      <ellipse cx="44" cy="22" rx="13" ry="12" fill="#9b59b6"/>
      <ellipse cx="24" cy="43" rx="10" ry="9" fill="#e84393"/>
      <ellipse cx="42" cy="43" rx="10" ry="9" fill="#e84393"/>
      <circle cx="21" cy="21" r="4" fill="#f8c8ff"/><circle cx="45" cy="21" r="4" fill="#f8c8ff"/>
      <ellipse cx="33" cy="33" rx="3" ry="16" fill="#2b2b2b"/>
      <path d="M33 18 Q36 8 42 6 M33 18 Q31 8 26 6" stroke="#2b2b2b" stroke-width="1.5" fill="none"/>`,
  },
  {
    id: 'unicorn',
    label: 'Unicorn',
    svg: `
      <path d="M8 32 Q2 40 6 50 Q10 42 14 38Z" fill="#e17ee8"/>
      <ellipse cx="28" cy="38" rx="15" ry="9" fill="#fdfdfd" stroke="#c9c3d9" stroke-width="1.5"/>
      <path d="M36 34 L44 18 L52 20 L44 38Z" fill="#fdfdfd" stroke="#c9c3d9" stroke-width="1.5"/>
      <path d="M43 17 Q52 14 59 22 Q60 28 54 28 L47 25Z" fill="#fdfdfd" stroke="#c9c3d9" stroke-width="1.5"/>
      <path d="M47 15 L54 3 L51 17Z" fill="#f5c542"/>
      <path d="M44 17 Q38 22 38 32 Q34 24 40 16Z" fill="#9b59b6"/>
      <circle cx="52" cy="20" r="1.5" fill="${EYE}"/>
      <rect x="17" y="44" width="5" height="14" rx="2" fill="#fdfdfd" stroke="#c9c3d9" stroke-width="1.5"/>
      <rect x="35" y="44" width="5" height="14" rx="2" fill="#fdfdfd" stroke="#c9c3d9" stroke-width="1.5"/>`,
  },
  {
    id: 'dog',
    label: 'Dog',
    svg: `
      <path d="M14 34 Q8 26 10 20" stroke="#b07d4f" stroke-width="4" fill="none" stroke-linecap="round"/>
      <ellipse cx="28" cy="38" rx="15" ry="9" fill="#b07d4f"/>
      <circle cx="46" cy="27" r="10" fill="#b07d4f"/>
      <ellipse cx="55" cy="30" rx="7" ry="5" fill="#c99b6d"/>
      <circle cx="61" cy="28" r="2.5" fill="#2b2b2b"/>
      <ellipse cx="41" cy="27" rx="4" ry="8" fill="#7a5230"/>
      <circle cx="49" cy="24" r="1.6" fill="${EYE}"/>
      <rect x="17" y="44" width="5" height="13" rx="2" fill="#9a6b40"/>
      <rect x="33" y="44" width="5" height="13" rx="2" fill="#9a6b40"/>`,
  },
  {
    id: 'cat',
    label: 'Cat',
    svg: `
      <path d="M13 38 Q2 32 8 18" stroke="#f0a04b" stroke-width="4" fill="none" stroke-linecap="round"/>
      <ellipse cx="27" cy="41" rx="14" ry="8" fill="#f0a04b"/>
      <circle cx="45" cy="31" r="9" fill="#f0a04b"/>
      <path d="M38 26 L39 16 L45 23Z" fill="#f0a04b"/><path d="M47 23 L52 15 L53 26Z" fill="#f0a04b"/>
      <circle cx="49" cy="30" r="1.6" fill="${EYE}"/>
      <circle cx="54" cy="34" r="1.3" fill="#e17055"/>
      <path d="M53 35 L62 33 M53 36 L62 38" stroke="#2b2b2b" stroke-width="0.8"/>
      <path d="M22 35 L24 40 M28 34 L30 39" stroke="#d9822b" stroke-width="2"/>
      <rect x="18" y="46" width="5" height="11" rx="2" fill="#d9822b"/>
      <rect x="32" y="46" width="5" height="11" rx="2" fill="#d9822b"/>`,
  },
]);

export const AVATAR_IDS = Object.freeze(AVATARS.map((a) => a.id));

export function avatarInfo(id) {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}

/** The icon as an <svg> element. Only our own drawings are inserted, never player text. */
export function avatarIcon(id, { className = 'avatar-icon', title = '' } = {}) {
  const info = avatarInfo(id);
  const holder = document.createElement('span');
  holder.innerHTML = `<svg class="${className}" viewBox="0 0 64 64" role="img" aria-label="${title || info.label}">${info.svg}</svg>`;
  return holder.firstElementChild;
}
