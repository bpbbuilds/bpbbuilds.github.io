/**
 * Map hero_class → local class icon path.
 * Files match create meta picker (`{Class}Icon.png`).
 * @param {string} root site root prefix ending in /
 * @param {string | null | undefined} heroClass
 */
export function classIconPath(root, heroClass) {
  const key = String(heroClass || '')
    .trim()
    .toLowerCase();
  const map = {
    adventurer: 'AdventurerIcon.png',
    berserker: 'BerserkerIcon.png',
    engineer: 'EngineerIcon.png',
    mage: 'MageIcon.png',
    pyromancer: 'PyromancerIcon.png',
    ranger: 'RangerIcon.png',
    reaper: 'ReaperIcon.png',
    neutral: 'NeutralIcon.png',
  };
  const file = map[key];
  if (!file) return null;
  return `${root}assets/icons/classes/${file}`;
}

/** Heroes with full-body showcase sprites under assets/characters/. */
const CHARACTER_SPRITE_KEYS = new Set([
  'adventurer',
  'berserker',
  'engineer',
  'mage',
  'pyromancer',
  'ranger',
  'reaper',
]);

/**
 * Map hero_class → full-body character sprite (sim Class avatar / homepage showcase).
 * Unknown classes fall back to Adventurer.
 * @param {string} root site root prefix ending in /
 * @param {string | null | undefined} heroClass
 */
export function classCharacterPath(root, heroClass) {
  const key = String(heroClass || '')
    .trim()
    .toLowerCase();
  const file = CHARACTER_SPRITE_KEYS.has(key) ? key : 'adventurer';
  return `${root}assets/characters/char-${file}.png`;
}
