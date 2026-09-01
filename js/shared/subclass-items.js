/**
 * Class subclass unlock items (game shop = "Class>SubclassName").
 * Used to detect the chosen subclass unique on a build board.
 */

/** @type {ReadonlyMap<string, { subclass: string, hero: string }>} */
export const SUBCLASS_BY_ITEM_ID = new Map([
  ['piercing_arrow', { subclass: 'Hunter', hero: 'Ranger' }],
  ['yggdrasil_leaf', { subclass: 'Lifebinder', hero: 'Ranger' }],
  ['poison_ivy', { subclass: 'Pathfinder', hero: 'Ranger' }],
  ['mega_clover', { subclass: 'Grovekeeper', hero: 'Ranger' }],
  ['bowl_of_treats', { subclass: 'Beastmaster', hero: 'Ranger' }],
  ['cursed_hair_comb', { subclass: 'Vampiress', hero: 'Reaper' }],
  ['mr_struggles', { subclass: 'Witch', hero: 'Reaper' }],
  ['cursed_dagger', { subclass: 'Hexblade', hero: 'Reaper' }],
  ['snake', { subclass: 'Venomancer', hero: 'Reaper' }],
  ['cauldron', { subclass: 'Alchemist', hero: 'Reaper' }],
  ['friendly_fire', { subclass: 'Firebender', hero: 'Pyromancer' }],
  ['burning_banner', { subclass: 'Crusader', hero: 'Pyromancer' }],
  ['dark_lantern', { subclass: 'Ashbringer', hero: 'Pyromancer' }],
  ['frozen_flame', { subclass: 'Cryomancer', hero: 'Pyromancer' }],
  ['dragon_nest', { subclass: 'Scalewarden', hero: 'Pyromancer' }],
  ['anvil', { subclass: 'Blacksmith', hero: 'Berserker' }],
  ['deer_totem', { subclass: 'Chieftain', hero: 'Berserker' }],
  ['wolf_emblem', { subclass: 'Pack Leader', hero: 'Berserker' }],
  ['shaman_mask', { subclass: 'Shaman', hero: 'Berserker' }],
  ['brass_knuckles', { subclass: 'Fighter', hero: 'Berserker' }],
  ['shiny_mantle', { subclass: 'Shiny Chariot', hero: 'Mage' }],
  ['spirit_bells', { subclass: 'Spectromancer', hero: 'Mage' }],
  ['water_elemental', { subclass: 'Waterbender', hero: 'Mage' }],
  ['evil_hat', { subclass: 'Battle Mage', hero: 'Mage' }],
  ['rainbow_potion', { subclass: 'Magical Girl', hero: 'Mage' }],
  ['fedora', { subclass: 'Archaeologist', hero: 'Adventurer' }],
  ['scale', { subclass: 'Merchant', hero: 'Adventurer' }],
  ['mercury_elemental', { subclass: 'Weaponmaster', hero: 'Adventurer' }],
  ['turtle', { subclass: 'Shieldmaster', hero: 'Adventurer' }],
  ['ukulele', { subclass: 'Bard', hero: 'Adventurer' }],
  ['tesla_coil', { subclass: 'Electrician', hero: 'Engineer' }],
  ['mana_crystal', { subclass: 'Artificer', hero: 'Engineer' }],
  ['bionic_armor', { subclass: 'Power Pilot', hero: 'Engineer' }],
  ['laboratory', { subclass: 'Chemist', hero: 'Engineer' }],
  ['hypercube', { subclass: 'Materials Scientist', hero: 'Engineer' }],
]);

/**
 * Find the subclass unlock item on a board (or explicit id).
 * @param {{
 *   subclass_item_id?: string | null,
 *   placements?: { id?: string, item?: { id?: string, name?: string, image?: string } | null }[],
 * }} build
 * @returns {{ id: string, name: string, image: string, subclass: string, hero: string } | null}
 */
export function resolveSubclassItem(build) {
  const explicit = String(build?.subclass_item_id || '').trim();
  if (explicit && SUBCLASS_BY_ITEM_ID.has(explicit)) {
    const meta = SUBCLASS_BY_ITEM_ID.get(explicit);
    const fromBoard = (build?.placements || []).find(
      (p) => String(p?.item?.id || p?.id || '') === explicit,
    );
    const item = fromBoard?.item;
    return {
      id: explicit,
      name: String(item?.name || meta.subclass),
      image: String(item?.image || ''),
      subclass: meta.subclass,
      hero: meta.hero,
    };
  }

  for (const p of build?.placements || []) {
    const id = String(p?.item?.id || p?.id || '').trim();
    if (!id || !SUBCLASS_BY_ITEM_ID.has(id)) continue;
    const meta = SUBCLASS_BY_ITEM_ID.get(id);
    const item = p?.item;
    return {
      id,
      name: String(item?.name || meta.subclass),
      image: String(item?.image || ''),
      subclass: meta.subclass,
      hero: meta.hero,
    };
  }
  return null;
}
