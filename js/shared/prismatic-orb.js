/**
 * Prismatic Orb section rules copied from the game's RainbowOrb.gd.
 *
 * RainbowOrb.countTypes() iterates Item.getTypes(), so custom catalog tags do
 * not qualify unless they are also a primary or extra game type.
 */

export const PRISMATIC_ORB_ID = 'rainbow_orb';

export const PRISMATIC_ORB_SECTION_KEYS = [
  'magic',
  'vampiric',
  'holy',
  'dark',
];

/**
 * Return the primary and extra game types represented by a catalog row.
 * @param {object | null | undefined} item
 * @returns {string[]}
 */
export function prismaticOrbTypes(item) {
  if (!item || typeof item !== 'object') return [];
  const types = [];
  if (item.type) types.push(String(item.type));
  const extraTypes = Array.isArray(item.extraTypes)
    ? item.extraTypes
    : Array.isArray(item.extra_types)
      ? item.extra_types
      : [];
  for (const type of extraTypes) {
    if (type) types.push(String(type));
  }
  return types;
}

/**
 * Count catalog/board items in each Prismatic Orb section.
 *
 * This intentionally counts an item once per section, while allowing an item
 * with multiple game types to contribute to multiple sections, matching the
 * game's `countTypes(getAffectedItems())` behavior.
 *
 * @param {Iterable<object> | null | undefined} items
 * @returns {Record<string, number>}
 */
export function countPrismaticOrbSections(items) {
  const counts = Object.fromEntries(
    PRISMATIC_ORB_SECTION_KEYS.map((key) => [key, 0]),
  );
  if (!items) return counts;

  for (const item of items) {
    const types = new Set(prismaticOrbTypes(item).map((type) => type.toLowerCase()));
    for (const key of PRISMATIC_ORB_SECTION_KEYS) {
      if (types.has(key)) counts[key] += 1;
    }
  }
  return counts;
}
