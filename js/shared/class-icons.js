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
