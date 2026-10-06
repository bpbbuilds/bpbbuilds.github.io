/**
 * Band AF 186 — generate assets/data/sim-parity-inventory.json from HAND list.
 *   node scripts/build-sim-parity-inventory.mjs
 */
import fs from 'fs';

const src = fs.readFileSync('scripts/build-sim-auto-ports.mjs', 'utf8');
const m = src.match(/const HAND = \[([\s\S]*?)\];/);
if (!m) throw new Error('HAND list not found');
const ids = [...m[1].matchAll(/'([a-z0-9_]+)'/g)].map((x) => x[1]);

const WAVE_D = new Set([
  'goobert',
  'cupcake_goobert',
  'light_goobert',
  'king_goobert',
  'rainbow_goobert_mage',
  'rainbow_goobert_ranger',
  'crown',
  'king_crown',
  'holy_spear',
  'automanaton',
  'bazooka',
  'chainsaw',
  'cupcake_dragon',
  'prismatic_sword',
  'stone_golem',
  'water_elemental',
  'lightning_staff',
  'thunder_drake',
  'amulet_of_agility',
  'bewitchment',
  'frozen_flame',
  'gigawatz',
  'hogus_bogus',
  'hyper_hedgehog',
  'inner_power',
  'wand_of_dissonance',
  'rainbow_potion',
  'perpetuum_mobile',
  'chess_board',
  'magic_ring',
  'magic_mirror',
  'plastic_cube',
  'repeater',
  'slime_time',
]);

const WAVE_C = new Set([
  'hammer',
  'lucky_shortbow',
  'thorn_shortbow',
  'snow_stick',
  'boomerang',
  'daggerang',
  'brass_knuckles',
  'thors_hammer',
  'amethyst_whelp',
  'chain_whip',
  'spear',
  'long_spear',
  'poison_spear',
  'molten_spear',
  'magic_staff',
  'spectral_dagger',
  'spiked_staff',
  'staff_of_fire',
  'critwood_staff',
  'cupcake_staff',
  'jynx_staff',
  'manathirst',
  'onion_cutter',
  'thorn_whip',
  'claws_of_attack',
  'forest_dragon',
  'ice_dragon',
  'thornbloom',
  'fancy_fencing_rapier',
  'hungry_blade',
  'war_scythe',
  'frostbite',
  'cursed_dagger',
  'wrench',
]);

const WAVE_B = new Set([
  'whetstone',
  'hero_shield',
  'smithing_for_dummies',
  'stone_gloves',
  'anvil',
  'mushroom_farm',
  'steel_dragon',
  'villain_sword',
  'dancing_dragon',
  'ghost',
  'false_life',
  'shell_totem',
  'shelly',
  'shiny_shell',
  'spell_scroll_light',
  'staff_of_unhealing',
  'sun_armor',
  'magic_badge',
  'scholar_bag',
  'burning_spikes',
  'stone_helm',
  'fire_pit',
  'hardwood',
  'mage_hat',
  'time_melting',
  'cap_of_brilliance',
  'dragon_nest',
  'amulet_of_steel',
  'wisdom_puppy',
  'armored_wisdom_puppy',
  'spell_scroll_frostbolt',
  'owl_spirit',
  'hedgehog',
  'bomb',
]);

/** Band AI — HAND shallow → deep (chess_board stays noop; HARD gaps stay shallow). */
const WAVE_AI_A = new Set([
  'blueberries',
  'bowl_of_treats',
  'carrot',
  'cheese',
  'cupcake',
  'flame',
  'garlic',
  'heroic_potion',
  'lightning_potion',
  'lucky_piggy',
  'lump_of_coal',
  'pineapple',
  'pocket_sand',
  'present',
  'slice_of_bread',
  'snowball',
]);

const WAVE_AI_B = new Set([
  'bionic_armor',
  'corrupted_armor',
  'fedora',
  'gold_armor',
  'holy_armor',
  'leather_armor',
  'magitecc_armor',
  'stone_armor',
  'vampiric_armor',
  'vampiric_gloves',
  // HARD gaps (stay shallow): evil_cap, leather_boots, leather_helm, shiny_mantle, wooden_buckler
]);

const WAVE_AI_C = new Set([
  'amethyst_egg',
  'badger_spirit',
  'blood_goobert',
  'cheese_goobert',
  'crow',
  'cthulhu',
  'evil_hat',
  'jynx_torquilla',
  'little_mimic',
  'mecha_bat',
  'mercury_elemental',
  'paradise_birb',
  'rainbow_goobert_berserker',
  'rat_chef',
  'robodog',
  'sloth',
  'squirrel',
  'steel_goobert',
  'thorn_elemental',
  'turtle',
  'wolpertinger',
]);

const WAVE_AI_D = new Set([
  'amulet_of_alchemy',
  'amulet_of_fortune',
  'amulet_of_life',
  'amulet_of_the_wild',
  'angel_crystal',
  'cog',
  'cog_badge',
  'generator',
  'heart_of_darkness',
  'mana_crystal',
  'mrs_struggles',
  'platin_customer_card',
  'prismatic_wand',
  'puzzle_badge',
  'rainbow_badge',
  'rainbow_orb',
  'sandbag',
  'shaman_mask',
  'skull_badge',
  'spirit_bells',
  'spring_loader',
  'stone_badge',
  'time_dilator',
  'wand',
  'wolf_emblem',
  'yggdrasil_leaf',
  // HARD gaps: mr_struggles, resistor
]);

const WAVE_AI_E = new Set([
  'blood_manipulation',
  'book_of_basics',
  'dark_ritual',
  'devouring_sphere',
  'dig_deeper',
  'double_rainbow',
  'echoing_battlecry',
  'full_body_protection',
  'heavy_drinking',
  'knife_to_meet_you',
  'no_rush_please',
  'power_of_the_moon',
  'seal_the_deal',
  'speak_with_animals',
  'spell_scroll_dark',
  'thornburst',
]);

const WAVE_AI_F = new Set([
  'amethyst',
  'big_bloodthorne',
  'burning_blade',
  'corrupted_crystal',
  'dragon_knight',
  'hawk_rune',
  'holdall',
  'katana',
  'molten_greatsword',
  'portable_altar',
  'protective_purse',
  'puzzlebox',
  'recombobulator',
  'relic_case',
  'ruby',
]);

/** Band AJ — former HARD gaps now deep. */
const WAVE_AI_HARD = new Set([
  'evil_cap',
  'leather_boots',
  'leather_helm',
  'shiny_mantle',
  'wooden_buckler',
  'mr_struggles',
  'resistor',
  'extra_angy',
  'toolbox',
]);

const WAVE_AK_DEEP = new Set([
  'health_potion',
  'strong_health_potion',
  'heroic_potion',
  'mana_potion',
  'strong_mana_potion',
  'strong_heroic_potion',
  'divine_potion',
  'strong_divine_potion',
  'vampiric_potion',
  'strong_vampiric_potion',
  'stone_skin_potion',
  'strong_stone_skin_potion',
  'pestilence_flask',
  'strong_pestilence_flask',
  'demonic_flask',
  'strong_demonic_flask',
  'stamina_sack',
  'vineweave_basket',
  'potion_belt',
  'ranger_bag',
  'berserker_bag',
  'bag_of_giving',
  'sewing_case',
  'storage_coffin',
  'engineer_box',
  'bag_of_stones',
  'puzzlebag_j',
  'puzzlebag_s',
  'puzzlebag_t',
  'puzzlebag_z',
]);

const WAVE_AK_NOOP = new Set([
  'coins',
  'customer_card',
  'lootbox',
  'amulet_unidentified',
  'box_of_riches',
  'unidentified_skill',
  'leather_bag',
  'box_of_prosperity',
  'engineer_bag_2',
  'random_loadout_bag',
  'black_bishop',
  'black_king',
  'black_knight',
  'black_pawn',
  'black_queen',
  'black_rook',
  'white_bishop',
  'white_king',
  'white_knight',
  'white_pawn',
  'white_queen',
  'white_rook',
]);

const WAVE_AL_DEEP = new Set([
  'shortbow',
  'dagger',
  'pandamonium',
  'death_scythe',
  'lightsaber',
  'greatsword',
  'busted_blade',
  'armored_courage_puppy',
  'vampiric_scythe',
  'forging_hammer',
  'bow_and_arrow',
  'obsidian_dragon',
  'phoenix2',
  'pop',
  'artifact_stone_cold',
  'artifact_stone_heat',
  'artifact_stone_death',
]);

const WAVE_AM_DEEP = new Set([
  'goobling',
  'poison_goobert',
  'chili_goobert',
  'broccoli_goobert',
  'toast_goobert',
  'rainbow_goobert',
  'rainbow_goobert_pyromancer',
  'rainbow_goobert_adventurer',
  'rainbow_goobert_engineer',
  'power_puppy',
  'armored_power_puppy',
  'courage_puppy',
  'frog_prince',
  'cubert',
  'snowmaster',
  'rat',
  'poison_frog',
  'snake',
  'fire_shelly',
  'friendly_fire',
  'cat_spirit',
  'ruby_egg',
  'emerald_egg',
  'sapphire_egg',
]);

const WAVE_AN_DEEP = new Set([
  'acorn_collar',
  'amulet_of_darkness',
  'amulet_of_feasting',
  'bismuth_cube',
  'chrome_cube',
  'coil',
  'con_trap_tron',
  'eat_o_matic',
  'gold_cube',
  'holy_collar',
  'lucky_cat',
  'magic_collar',
  'mana_orb',
  'mega_clover',
  'piercing_arrow',
  'poison_ivy',
  'rope',
  'spiked_collar',
  'stable_recombobulator',
  'star_of_courage',
  'superior_ring',
  'twine',
  'twine_badge',
  'unstable_recombobulator',
  'vampiric_collar',
  'whetstone2',
  'whetstone3',
  'wolf_badge',
  'dragonscale_armor',
  'dragon_claws',
  'arcane_boots',
  'dragonskin_boots',
  'stone_shoes',
  'winged_boots',
]);

const WAVE_AN_SOCKET = new Set([
  'badger_rune',
  'chipped_amethyst',
  'chipped_emerald',
  'chipped_ruby',
  'chipped_sapphire',
  'chipped_topaz',
  'elephant_rune',
  'flawed_amethyst',
  'flawed_emerald',
  'flawed_ruby',
  'flawed_sapphire',
  'flawed_topaz',
  'flawless_amethyst',
  'flawless_emerald',
  'flawless_ruby',
  'flawless_sapphire',
  'flawless_topaz',
  'perfect_amethyst',
  'perfect_emerald',
  'perfect_ruby',
  'perfect_sapphire',
  'perfect_topaz',
  'regular_amethyst',
  'regular_emerald',
  'regular_ruby',
  'regular_sapphire',
  'regular_topaz',
  'skull',
  'tiger_rune',
]);

const WAVE_AN_NOOP = new Set([
  'hypercube',
  'snowman',
  'furcifer_prime',
  'employee_uniform',
]);

const WAVE_AO_DEEP = new Set([
  'ace_of_spades',
  'acorn_ace',
  'arcane_intellect',
  'bagtacular',
  'buy_the_holy_light',
  'chess_master',
  'critical_poison',
  'darkest_lotus',
  'dual_wielding',
  'extra_bags',
  'heart_of_the_cards',
  'investment_opportunity',
  'king_of_the_bling',
  'markswoman',
  'piggy_pinata',
  'reverse',
  'spicy_banana',
  'stoned',
  'uniquely_unique',
  'holo_fire_lizard',
  'ice_flower',
  'joker',
  'solaris',
  'the_fool',
  'the_lovers',
  'white_eyes_blue_dragon',
  'frozen_buckler',
  'heart_shield',
  'moon_shield',
  'pine_protector',
  'shield_of_valor',
  'shielded',
  'smelly_barrier',
  'spiked_shield',
  'spiked_wall',
  'sun_shield',
  'spell_scroll_ice',
  'spell_scroll_nature',
  'book_of_ice_new',
  'book_of_ice',
  'book_of_darkness',
  'book_of_light',
  'book_of_nature',
  'mana_mastery',
  'deck_of_cards',
  'girl_power',
]);

/** Band AP — source-backed heat/charge/activation lifecycle ports. */
const WAVE_AP_DEEP = new Set([
  'burning_banner',
  'burning_coal',
  'burning_sword',
  'burning_torch',
  'carrot_goobert',
  'cauldron',
  'chainsaw',
  'charge_splitter',
  'chili_pepper',
  'coil',
]);

/** Band AQ — source-backed crossblades/dragon lifecycle ports. */
const WAVE_AQ_DEEP = new Set([
  'crossblades',
  'cursed_hair_comb',
  'dark_lantern',
  'darksaber',
  'death_lotus',
  'deer_totem',
  'djinn_lamp',
  'doom_cap',
  'double_axe',
  'draconic_orb',
  'dragon_knight',
  'dragon_set',
]);

/** Band AR — source-backed Emerald/activation/food lifecycle ports. */
const WAVE_AR_DEEP = new Set([
  'emerald_whelp',
  'energy_conversion',
  'everburning',
  'fanfare',
  'flame_badge',
  'flame_whip',
  'flute',
  'fly_agaric',
  'fortunas_kiss',
  'gingerbread_man',
]);

/** Band AS — source-backed weapon/start/unique lifecycle ports. */
const WAVE_AS_DEEP = new Set([
  'halberd',
  'heart_container',
  'hero_sword',
  'ice_armor',
  'just_stats',
  'laboratory',
  'leaf_badge',
  'level_up',
  'light_flower',
  'lucky_bow',
  'lucky_clover',
  'magic_torch',
  'mananana',
  'molten_dagger',
  'molten_spear2',
  'moon_armor',
  'more_stats',
  'null_blade',
]);

/** Band AT â€” source-backed Pan/Phoenix/Piggy/Poison/Pot lifecycle ports. */
const WAVE_AT_DEEP = new Set([
  'pan',
  'phoenix',
  'piggy_of_riches',
  'piggybank',
  'poison_dagger',
  'poison_grenade',
  'poison_shortbow',
  'pot',
]);

/** Band AU — source-backed Pumpkin through Scale lifecycle ports. */
const WAVE_AU_DEEP = new Set([
  'pumpkin', 'puzzlebag_l', 'ruby_chonk', 'ruby_egg',
  'ruby_whelp', 'sapphire_whelp', 'scale',
]);

/** Band AV — final source-backed runtime backlog closure. */
const WAVE_AV_DEEP = new Set([
  'axe', 'blood_amulet', 'bloody_dagger', 'broccoli', 'broccotree',
  'rib_saw_blade', 'serpent_staff', 'shepherds_crook', 'shovel', 'slice_of_toast',
  'snowcake', 'spin_to_win', 'squirrel_archer', 'stone', 'thorn_bow', 'time_pendant',
  'torch', 'ukulele', 'ultima', 'walrus_tusk', 'wisp',
]);

const DEEP = new Set([
  'broom',
  'banana',
  'poison_bow',
  'hero_longsword',
  'falcon_blade',
  'healing_herbs',
  'wooden_sword',
  'battery',
  'eggscalibur',
  'scissorswords',
  'tesla_coil',
  'miss_fortune',
  'toad',
  'oil_lamp',
  'carrot_goobert',
  'electric_torch',
  'bloodthorne',
  'gloves_of_haste',
  'fanny_pack',
  'amulet_of_light',
  'enchanted_weapons',
  ...WAVE_B,
  ...WAVE_C,
  ...[...WAVE_D].filter((id) => id !== 'chess_board'),
  ...WAVE_AI_A,
  ...WAVE_AI_B,
  ...WAVE_AI_C,
  ...WAVE_AI_D,
  ...WAVE_AI_E,
  ...WAVE_AI_F,
  ...WAVE_AI_HARD,
  ...WAVE_AK_DEEP,
  ...WAVE_AL_DEEP,
  ...WAVE_AM_DEEP,
  ...WAVE_AN_DEEP,
  ...WAVE_AN_SOCKET,
  ...WAVE_AO_DEEP,
  ...WAVE_AP_DEEP,
  ...WAVE_AQ_DEEP,
  ...WAVE_AR_DEEP,
  ...WAVE_AS_DEEP,
  ...WAVE_AT_DEEP,
  ...WAVE_AU_DEEP,
  ...WAVE_AV_DEEP,
]);

/** @type {Record<string, { depth: string, notes: string }>} */
const byId = {};
for (const id of ids) {
  let depth = 'shallow';
  let notes = 'HAND port; remaining shallow after AG — AH fixtures next';
  if (id === 'chess_board' || WAVE_AK_NOOP.has(id) || WAVE_AN_NOOP.has(id)) {
    depth = 'noop';
    notes = id === 'chess_board'
      ? 'game ChessBoard.gd has combat CD AI; sim defers piece move/capture (Phase 267)'
      : WAVE_AN_NOOP.has(id)
        ? 'AN shop-only combat noop'
        : 'AK noop — shop/chess (not fake deep)';
  } else if (DEEP.has(id)) {
    depth = 'deep';
    notes = WAVE_AV_DEEP.has(id)
      ? 'AV final runtime backlog source port from .gd'
      : WAVE_AT_DEEP.has(id)
      ? 'AT source-port wave from .gd'
      : WAVE_AS_DEEP.has(id)
      ? 'AS source-port wave from .gd'
      : WAVE_AR_DEEP.has(id)
      ? 'AR source-port wave from .gd'
      : WAVE_AQ_DEEP.has(id)
      ? 'AQ source-port wave from .gd'
      : WAVE_AP_DEEP.has(id)
      ? 'AP source-port wave from .gd'
      : WAVE_AO_DEEP.has(id)
      ? 'AO skill/card/shield/spell port from .gd'
      : WAVE_AN_SOCKET.has(id)
      ? 'AN socket apply on host, not a board piece'
      : WAVE_AN_DEEP.has(id)
      ? 'AN accessory/armor port from .gd'
      : WAVE_AM_DEEP.has(id)
      ? 'AM pet/goobert port from .gd'
      : WAVE_AL_DEEP.has(id)
      ? 'AL weapon port from .gd (weaponStrike + hooks)'
      : WAVE_AK_DEEP.has(id)
      ? 'AK bag/potion port from .gd'
      : WAVE_AI_HARD.has(id)
      ? 'AJ deepen — HARD gap closed via engine hooks (.gd intent)'
      : WAVE_AI_A.has(id) || WAVE_AI_B.has(id) || WAVE_AI_C.has(id) || WAVE_AI_D.has(id) || WAVE_AI_E.has(id) || WAVE_AI_F.has(id)
        ? 'AI deepen — combat hooks match .gd intent (fidelity parity = AH fixtures)'
        : 'AG deepen — combat hooks match .gd intent (fidelity parity = AH fixtures)';
  }
  byId[id] = { depth, notes };
}

const depths = Object.values(byId);
const payload = {
  builtAt: new Date().toISOString(),
  note: 'Band AO — skills / spells / books / leftover catalog',
  parityIds: [],
  totals: {
    hand: ids.length,
    deep: depths.filter((x) => x.depth === 'deep').length,
    shallow: depths.filter((x) => x.depth === 'shallow').length,
    noop: depths.filter((x) => x.depth === 'noop').length,
  },
  byId,
};

fs.writeFileSync('assets/data/sim-parity-inventory.json', JSON.stringify(payload, null, 2));
console.log(
  `Wrote sim-parity-inventory.json: hand=${payload.totals.hand} deep=${payload.totals.deep} shallow=${payload.totals.shallow} noop=${payload.totals.noop}`,
);
