/**
 * Class starting bags (game BuildEntry getStartingBag loadout 1 + 2).
 * Shared by create meta, submit validation, and build info rail.
 */

/** @type {Record<string, string[]>} */
export const CLASS_STARTING_BAG_IDS = {
  Adventurer: ['bag_of_giving', 'sewing_case'],
  Berserker: ['berserker_bag', 'toolbox'],
  Engineer: ['engineer_box', 'engineer_bag_2'],
  Mage: ['scholar_bag', 'puzzlebox'],
  Pyromancer: ['fire_pit', 'portable_altar'],
  Ranger: ['ranger_bag', 'vineweave_basket'],
  Reaper: ['storage_coffin', 'relic_case'],
};

/**
 * @param {string | null | undefined} hero
 * @returns {string[]}
 */
export function startingBagIdsForClass(hero) {
  const key = String(hero || '').trim();
  const ids = CLASS_STARTING_BAG_IDS[key];
  return Array.isArray(ids) ? ids.slice() : [];
}

/**
 * @param {string | null | undefined} hero
 * @param {string | null | undefined} itemId
 * @returns {boolean}
 */
export function isLegalStartingBag(hero, itemId) {
  const id = String(itemId || '').trim();
  if (!id) return false;
  return startingBagIdsForClass(hero).includes(id);
}

/**
 * Map game Loadout enum → starting bag id.
 * Loadout1=0, Loadout2=1; RandomLoadout/RandomCharacter fall back to bag 0.
 * @param {string | null | undefined} hero
 * @param {number | null | undefined} loadout
 * @returns {string | null}
 */
export function startingBagIdForLoadout(hero, loadout) {
  const ids = startingBagIdsForClass(hero);
  if (!ids.length) return null;
  const n = Number(loadout);
  if (n === 1 && ids[1]) return ids[1];
  return ids[0] || null;
}
