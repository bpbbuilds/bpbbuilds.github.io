/**
 * Classify GDScripts into auto-port patterns → reviewed dedicated handlers.
 *   node scripts/build-sim-auto-ports.mjs
 *
 * Writes:
 *   js/pages/sim/engine/scripts/auto-ports.js
 *   assets/data/sim-auto-ports.json
 *   assets/data/sim-reviewed-ids.json
 * Regenerates dedicated stubs + coverage.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { extractPortHandlerIds } from './lib/sim-port-handler-ids.mjs';

const INV = 'assets/data/sim-item-inventory.json';
const ITEMS = 'tools/game-extract-full/Items';
const OUT_JS = 'js/pages/sim/engine/scripts/auto-ports.js';
const OUT_JSON = 'assets/data/sim-auto-ports.json';
const REVIEWED_FILE = 'assets/data/sim-reviewed-ids.json';

const HAND = [
  'broom',
  'banana',
  'poison_bow',
  'hero_longsword',
  'falcon_blade',
  'healing_herbs',
  'wooden_sword',
  'katana',
  'amulet_of_life',
  'holy_armor',
  'wooden_buckler',
  'leather_boots',
  'gloves_of_haste',
  'leather_armor',
  'battery',
  'resistor',
  'robodog',
  'bloodthorne',
  'mecha_bat',
  'yggdrasil_leaf',
  'cog',
  'heroic_potion',
  'blueberries',
  'amulet_of_light',
  'enchanted_weapons',
  'fanny_pack',
  'miss_fortune',
  'toad',
  'oil_lamp',
  'amulet_of_fortune',
  'wolpertinger',
  'wand',
  'little_mimic',
  'bowl_of_treats',
  'cheese',
  'cheese_goobert',
  'present',
  'double_rainbow',
  'shaman_mask',
  'tesla_coil',
  // Band Y 135–143
  'carrot',
  'crow',
  'fedora',
  'seal_the_deal',
  'jynx_torquilla',
  'prismatic_wand',
  'garlic',
  'mana_crystal',
  'eggscalibur',
  'badger_spirit',
  'book_of_basics',
  'shiny_mantle',
  'rainbow_orb',
  'magitecc_armor',
  'devouring_sphere',
  'snowball',
  'burning_blade',
  'electric_torch',
  'molten_greatsword',
  'pocket_sand',
  'lump_of_coal',
  'knife_to_meet_you',
  'scissorswords',
  'toolbox',
  'relic_case',
  'steel_goobert',
  'corrupted_crystal',
  'rainbow_goobert_berserker',
  'speak_with_animals',
  'wolf_emblem',
  'amulet_of_the_wild',
  'angel_crystal',
  'blood_manipulation',
  'power_of_the_moon',
  'sloth',
  'bionic_armor',
  'stone_armor',
  'vampiric_armor',
  'heart_of_darkness',
  'squirrel',
  'turtle',
  'rat_chef',
  'blood_goobert',
  'carrot_goobert',
  'spirit_bells',
  'paradise_birb',
  'mr_struggles',
  'dark_ritual',
  'spell_scroll_dark',
  'dragon_knight',
  'echoing_battlecry',
  'cthulhu',
  'dig_deeper',
  'evil_cap',
  'extra_angy',
  'slice_of_bread',
  'lightning_potion',
  'heavy_drinking',
  'no_rush_please',
  'platin_customer_card',
  'sandbag',
  'evil_hat',
  // Band AC Wave A
  'cupcake',
  'pineapple',
  'flame',
  'lucky_piggy',
  'protective_purse',
  'holdall',
  // Band AD Wave B
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
  // Band AE Wave C
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
  // Band AE Wave D
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
  // Band Y 144 outliers
  'amethyst_egg',
  'amulet_of_alchemy',
  'portable_altar',
  'hawk_rune',
  'skull_badge',
  'stone_badge',
  'rainbow_badge',
  'recombobulator',
  'gold_armor',
  'full_body_protection',
  'mrs_struggles',
  'mercury_elemental',
  'vampiric_gloves',
  'thorn_elemental',
  'thornburst',
  'leather_helm',
  'spring_loader',
  'puzzle_badge',
  'puzzlebox',
  'time_dilator',
  'amethyst',
  'ruby',
  'topaz',
  'big_bloodthorne',
  'corrupted_armor',
  'generator',
  'cog_badge',
  // Band AK — potions / bags / shop-gem-chess
  'health_potion',
  'strong_health_potion',
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
  'coins',
  'customer_card',
  'lootbox',
  'amulet_unidentified',
  'bag_of_stones',
  'box_of_riches',
  'unidentified_skill',
  'leather_bag',
  'box_of_prosperity',
  'engineer_bag_2',
  'random_loadout_bag',
  'puzzlebag_j',
  'puzzlebag_s',
  'puzzlebag_t',
  'puzzlebag_z',
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
  // Band AL — leftover weapons + artifact stones
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
  // Band AM — leftover pets / gooberts
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
  // Band AN — accessories / sockets / armor
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
  'hypercube',
  'snowman',
  'furcifer_prime',
  'employee_uniform',
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
  // Band AO — skills / cards / shields / spells / books
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
  // Band AP 244 — leftover cd_lucky
  'broccoli',
  'broccotree',
  'charge_splitter',
  'flute',
  'fortunas_kiss',
  'leaf_badge',
  'light_flower',
  'ultima',
  'wisp',
  // Band AP 245 — leftover cd_mana / cd_regen
  'cauldron',
  'death_lotus',
  'deer_totem',
  'djinn_lamp',
  'fanfare',
  'level_up',
  'moon_armor',
  'scale',
  'spin_to_win',
  'burning_banner',
  'emerald',
  'gingerbread_man',
  'heart_container',
  'laboratory',
  'pot',
  'slice_of_toast',
  // Band AP 246 — leftover cd_heat / cd_cold / cd_poison
  'burning_coal',
  'chili_pepper',
  'draconic_orb',
  'dragon_set',
  'energy_conversion',
  'everburning',
  'ice_armor',
  'sapphire',
  'snowcake',
  'ukulele',
  'doom_cap',
  'fly_agaric',
  'poison_grenade',
  // Band AP 247 — leftover basic_cd uniques (+ stone already ported)
  'phoenix',
  'pumpkin',
  'ruby_chonk',
  'squirrel_archer',
  'thorn_bow',
  'stone',
  // Band AP 248 — leftover start_* templates
  'blood_amulet',
  'cursed_hair_comb',
  'burning_torch',
  'flame_badge',
  'ruby_whelp',
  'dark_lantern',
  'just_stats',
  'more_stats',
  'piggy_of_riches',
  'piggybank',
  'puzzlebag_l',
  'emerald_whelp',
  'lucky_clover',
  'sapphire_whelp',
  'walrus_tusk',
  // Band AP 249 — leftover on-hit / perm-bonus / double_strike
  'axe',
  'double_axe',
  'halberd',
  'magic_torch',
  'molten_dagger',
  'null_blade',
  'rib_saw_blade',
  'torch',
  'bloody_dagger',
  'burning_sword',
  'flame_whip',
  'darksaber',
  'molten_spear2',
  'shovel',
  'lucky_bow',
  'poison_dagger',
  'poison_shortbow',
  'serpent_staff',
  // Band AP 250 — leftover aura / food / link
  'hero_sword',
  'crossblades',
  'shepherds_crook',
  'mananana',
  'pan',
];

const PORT_IDS = extractPortHandlerIds('js/pages/sim/engine/scripts');
const HAND_SET = new Set(HAND);
const PORT_MISSING_HAND = [...PORT_IDS].filter((id) => !HAND_SET.has(id)).sort();
if (PORT_MISSING_HAND.length) {
  throw new Error(
    `PORT_HANDLERS ids missing from HAND (add them, then re-run): ${PORT_MISSING_HAND.join(', ')}`,
  );
}
/** MAP `hand_port` + AUTO_PORTS overwrite — only ids with a real port. */
const HAND_WIN = [...new Set(HAND.filter((id) => PORT_IDS.has(id)))].sort();

const inv = JSON.parse(fs.readFileSync(INV, 'utf8'));

function findGd(file) {
  const direct = path.join(ITEMS, file);
  if (fs.existsSync(direct)) return direct;
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        const hit = walk(full);
        if (hit) return hit;
      } else if (ent.name === path.basename(file)) return full;
    }
    return null;
  }
  return walk(ITEMS);
}

function extractFunc(text, name) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const startRe = new RegExp(`^func\\s+${name}\\s*\\(`);
  let i = 0;
  while (i < lines.length && !startRe.test(lines[i])) i += 1;
  if (i >= lines.length) return '';
  i += 1;
  const body = [];
  while (i < lines.length) {
    const line = lines[i];
    if (
      line.length &&
      !/^\t/.test(line) &&
      !/^ /.test(line) &&
      !/^#/.test(line.trim())
    ) {
      break;
    }
    body.push(line);
    i += 1;
  }
  return body.join('\n');
}

function extendsOf(text) {
  const m = text.match(/^extends\s+(\w+)/m);
  return m ? m[1] : '';
}

/** @type {Record<string, { pattern: string, notes: string }>} */
const auto = {};

/**
 * @param {string} id
 * @param {string} text
 * @param {object} entry
 */
function tryAuto(id, text, entry) {
  const o = new Set(entry.overrides || []);
  const cd = extractFunc(text, 'doCooldownEffect');
  const start = extractFunc(text, 'onCombatStart');
  const preStart = extractFunc(text, 'onPreCombatStart');
  const onDealt = extractFunc(text, 'onDealtDamage');
  const preEarly = extractFunc(text, 'onPreDealDamage_early');
  const ext = extendsOf(text);
  const weaponish =
    /^(Weapon|Bow|Dagger|Greatsword|Pan|Lightsaber|BurningSword|RibSawBlade)/.test(
      ext,
    );

  if (
    o.has('doCooldownEffect') &&
    !o.has('onDealtDamage') &&
    !o.has('onPreDealDamage_early') &&
    /useStamina/.test(cd) &&
    (cd.match(/dealDamage\s*\(/g) || []).length === 1 &&
    !/inflict|give[A-Z]|heal\s*\(|getP1|addBonus|addSpeed/.test(cd)
  ) {
    auto[id] = { pattern: 'basic_cd', notes: 'stamina→dealDamage' };
    return;
  }

  if (
    o.has('doCooldownEffect') &&
    (cd.match(/dealDamage\s*\(/g) || []).length === 2 &&
    /useStamina/.test(cd) &&
    !/inflict|give[A-Z]|heal\s*\(/.test(cd) &&
    !/addSpeed/.test(start)
  ) {
    auto[id] = { pattern: 'double_strike', notes: 'double dealDamage' };
    return;
  }

  if (
    o.has('doCooldownEffect') &&
    /heal\s*\(/.test(cd) &&
    /giveStamina|gainStamina/.test(cd) &&
    !/dealDamage/.test(cd)
  ) {
    auto[id] = { pattern: 'food_heal_stam', notes: 'heal+stamina' };
    return;
  }

  if (
    /giveRegeneration\s*\(\s*getP1/.test(start) &&
    /consume\s*\(/.test(start) &&
    !o.has('doCooldownEffect')
  ) {
    auto[id] = { pattern: 'start_regen', notes: 'regen+consume' };
    return;
  }

  if (start && !o.has('doCooldownEffect') && !/getAffectedItems/.test(start)) {
    if (/giveVampirism\s*\(\s*getP1/.test(start)) {
      auto[id] = { pattern: 'start_vampirism', notes: 'vamp start' };
      return;
    }
    if (/giveSpikes\s*\(\s*getP1|gainSpikes\s*\(\s*getP1/.test(start)) {
      auto[id] = { pattern: 'start_spikes', notes: 'spikes start' };
      return;
    }
    if (/MaxHealth|maxHealth|giveMaxHealth|changeMaxHealth/i.test(start)) {
      auto[id] = { pattern: 'start_max_hp', notes: 'max HP start' };
      return;
    }
    if (/giveBlock\s*\(\s*getP1|gainBlock\s*\(\s*getP1/.test(start)) {
      auto[id] = { pattern: 'start_block', notes: 'block start' };
      return;
    }
    if (/giveMana\s*\(\s*getP1|gainMana\s*\(\s*getP1/.test(start)) {
      auto[id] = { pattern: 'start_mana', notes: 'mana start' };
      return;
    }
    if (/giveHeat\s*\(\s*getP1|gainHeat\s*\(\s*getP1/.test(start)) {
      auto[id] = { pattern: 'start_heat', notes: 'heat start' };
      return;
    }
    if (/giveLucky\s*\(\s*getP1|gainLucky\s*\(\s*getP1/.test(start)) {
      auto[id] = { pattern: 'start_lucky', notes: 'lucky start' };
      return;
    }
  }

  if (
    /getAffectedItems/.test(start) &&
    /addBonusDamage\s*\(\s*getP1/.test(start) &&
    !o.has('doCooldownEffect')
  ) {
    auto[id] = { pattern: 'aura_damage', notes: 'damage aura' };
    return;
  }

  if (
    /getAffectedItems/.test(start) &&
    /addSpeed\s*\(\s*getP1/.test(start) &&
    !o.has('doCooldownEffect')
  ) {
    auto[id] = { pattern: 'aura_speed', notes: 'speed aura' };
    return;
  }

  if (
    /getAffectedItems/.test(start) &&
    /addSpeed\s*\(\s*getP1/.test(start) &&
    (cd.match(/dealDamage\s*\(/g) || []).length >= 2
  ) {
    auto[id] = { pattern: 'falcon_blade', notes: 'haste+double' };
    return;
  }

  if (
    o.has('onPreCombatStart') &&
    /addBonusDamage\s*\(\s*getP1/.test(preStart) &&
    /getNumAffectedItems|getAffectedItems/.test(preStart)
  ) {
    auto[id] = { pattern: 'precombat_link_damage', notes: 'pan-like' };
    return;
  }

  if (
    weaponish &&
    o.has('onPreDealDamage_early') &&
    !o.has('doCooldownEffect') &&
    /addBonusDamage/.test(preEarly) &&
    /hasHit/.test(preEarly) &&
    !/giveHeat|givePoison|inflict|giveVampirism|stun|steal/.test(preEarly)
  ) {
    auto[id] = { pattern: 'weapon_perm_bonus_on_hit', notes: 'axe-like' };
    return;
  }

  const hitBody = onDealt + preEarly;
  if (
    weaponish &&
    (o.has('onDealtDamage') || o.has('onPreDealDamage_early')) &&
    !o.has('doCooldownEffect')
  ) {
    if (/inflictPoison|givePoison|gainPoison/.test(hitBody)) {
      auto[id] = { pattern: 'weapon_onhit_poison', notes: 'on-hit poison' };
      return;
    }
    if (
      /giveHeat|inflictHeat|gainHeat/.test(hitBody) &&
      !/useHeat|getHeat\s*\(\s*\)\s*>=/.test(hitBody)
    ) {
      auto[id] = { pattern: 'weapon_onhit_heat', notes: 'on-hit heat' };
      return;
    }
    if (/inflictBlind|giveBlind/.test(hitBody)) {
      auto[id] = { pattern: 'weapon_onhit_blind', notes: 'on-hit blind' };
      return;
    }
    if (
      /giveVampirism/.test(hitBody) &&
      !/stealLife|useRegeneration/.test(hitBody)
    ) {
      auto[id] = {
        pattern: 'weapon_onhit_vampirism',
        notes: 'on-hit vamp',
      };
      return;
    }
  }

  if (o.has('doCooldownEffect') && !/dealDamage/.test(cd)) {
    if (/giveMana|gainMana/.test(cd) && !/useMana/.test(cd)) {
      auto[id] = { pattern: 'cd_mana', notes: 'CD mana' };
      return;
    }
    if (/giveLucky|gainLucky/.test(cd)) {
      auto[id] = { pattern: 'cd_lucky', notes: 'CD lucky' };
      return;
    }
    if (/giveRegeneration|gainRegeneration/.test(cd)) {
      auto[id] = { pattern: 'cd_regen', notes: 'CD regen' };
      return;
    }
    if (/giveHeat|gainHeat/.test(cd) && !/useHeat/.test(cd)) {
      auto[id] = { pattern: 'cd_heat', notes: 'CD heat' };
      return;
    }
    if (/inflictCold|giveCold|gainCold/.test(cd)) {
      auto[id] = { pattern: 'cd_cold', notes: 'CD cold' };
      return;
    }
    if (/inflictPoison|givePoison/.test(cd)) {
      auto[id] = { pattern: 'cd_poison', notes: 'CD poison' };
      return;
    }
  }

  if (
    o.has('doCooldownEffect') &&
    /dealDamage\s*\(/.test(cd) &&
    !/useStamina/.test(cd) &&
    (cd.match(/dealDamage\s*\(/g) || []).length === 1
  ) {
    auto[id] = { pattern: 'pet_strike', notes: 'pet strike' };
    return;
  }

  // --- Fallbacks (still reviewed: correct CD inheritance / best-effort grants) ---

  // Weapon family inherits Weapon.doCooldownEffect
  if (
    weaponish &&
    !o.has('doCooldownEffect') &&
    (o.has('onDealtDamage') ||
      o.has('onPreDealDamage_early') ||
      o.has('onPreDealDamage_late') ||
      o.has('onCombatStart') ||
      o.has('onPreCombatStart'))
  ) {
    auto[id] = {
      pattern: 'basic_cd',
      notes: 'Weapon inherit CD (+hooks approx)',
    };
    return;
  }

  // Loose stamina weapon CD (allow getP / extra lines)
  if (
    o.has('doCooldownEffect') &&
    /useStamina/.test(cd) &&
    /dealDamage\s*\(/.test(cd)
  ) {
    const hits = (cd.match(/dealDamage\s*\(/g) || []).length;
    auto[id] = {
      pattern: hits >= 2 ? 'double_strike' : 'basic_cd',
      notes: 'loose weapon CD',
    };
    return;
  }

  // Any giveX on combat start
  if ((start || preStart) && !o.has('doCooldownEffect')) {
    const s = start + preStart;
    const map = [
      [/Regeneration/i, 'start_regen'],
      [/Vampirism/i, 'start_vampirism'],
      [/Spikes/i, 'start_spikes'],
      [/MaxHealth|maxHealth/i, 'start_max_hp'],
      [/giveBlock|gainBlock|Block\s*\(/i, 'start_block'],
      [/Mana/i, 'start_mana'],
      [/Heat/i, 'start_heat'],
      [/Lucky/i, 'start_lucky'],
      [/addBonusDamage/i, 'aura_damage'],
      [/addSpeed/i, 'aura_speed'],
    ];
    for (const [re, pat] of map) {
      if (re.test(s)) {
        auto[id] = { pattern: pat, notes: 'start fallback' };
        return;
      }
    }
  }

  // CD give/inflict fallbacks (first match)
  if (o.has('doCooldownEffect') && cd) {
    const map = [
      [/giveMana|gainMana|Mana_capped/i, 'cd_mana'],
      [/giveLucky|gainLucky/i, 'cd_lucky'],
      [/giveRegeneration|gainRegeneration/i, 'cd_regen'],
      [/giveHeat|gainHeat/i, 'cd_heat'],
      [/Cold/i, 'cd_cold'],
      [/Poison/i, 'cd_poison'],
      [/heal\s*\(/i, 'food_heal_stam'],
      [/dealDamage|dealEffectDamage/i, 'pet_strike'],
    ];
    for (const [re, pat] of map) {
      if (re.test(cd)) {
        auto[id] = { pattern: pat, notes: 'CD fallback' };
        return;
      }
    }
    auto[id] = { pattern: 'cd_activate', notes: 'CD unknown→activate approx' };
    return;
  }

  // Battery / charge emitters — haste linked CD items (not regen!)
  if (
    /emitCharge|sendCharge|onChargeEnteredCell/.test(text) &&
    (o.has('onCombatStart') || /emitCharge/.test(start))
  ) {
    if (PORT_IDS.has(id)) {
      auto[id] = { pattern: 'hand_port', notes: 'charge→speed (ports-mech)' };
      return;
    }
  }

  // Start-only unknown — do NOT invent Regeneration
  if (o.has('onCombatStart') || o.has('onPreCombatStart')) {
    auto[id] = { pattern: 'cd_activate', notes: 'start unknown→noop approx' };
    return;
  }

  // Last resort
  auto[id] = { pattern: 'cd_activate', notes: 'fallback activate' };
}

for (const [id, entry] of Object.entries(inv.byId || {})) {
  if (['weapon', 'card', 'item', 'bow', 'food', 'pet', 'gem'].includes(id)) continue;
  const gdPath = findGd(entry.file);
  if (!gdPath) continue;
  tryAuto(id, fs.readFileSync(gdPath, 'utf8'), entry);
}

for (const id of HAND_WIN) {
  auto[id] = { pattern: 'hand_port', notes: 'ports.js / ports-*.js' };
}

const ids = Object.keys(auto).sort();
const mapLines = ids.map(
  (id) => `  ${JSON.stringify(id)}: ${JSON.stringify(auto[id].pattern)},`,
);

const js = `/**
 * GENERATED by scripts/build-sim-auto-ports.mjs — do not hand-edit.
 * ${ids.length} pattern-reviewed item handlers.
 */
import { bindPattern, PATTERNS } from './auto-patterns.js';
import { PORT_HANDLERS } from './ports.js';
import { HANDLERS } from './handlers.js';

/** @type {Record<string, string>} */
const MAP = {
${mapLines.join('\n')}
};

/** @type {Record<string, import('./handlers.js').ScriptHandler>} */
export const AUTO_PORTS = {};
for (const [id, pattern] of Object.entries(MAP)) {
  if (pattern === 'hand_port') {
    if (!PORT_HANDLERS[id]) {
      throw new Error('MAP hand_port without PORT_HANDLERS[' + id + ']');
    }
    AUTO_PORTS[id] = PORT_HANDLERS[id];
  } else if (PATTERNS[pattern]) {
    AUTO_PORTS[id] = bindPattern(id, pattern);
  } else {
    AUTO_PORTS[id] = bindPattern(id, 'basic_cd');
  }
}

for (const id of ${JSON.stringify(HAND_WIN)}) {
  if (PORT_HANDLERS[id]) AUTO_PORTS[id] = PORT_HANDLERS[id];
}

export function listAutoPortIds() {
  return Object.keys(AUTO_PORTS);
}

void HANDLERS;
`;

fs.writeFileSync(OUT_JS, js);
fs.writeFileSync(
  OUT_JSON,
  JSON.stringify(
    {
      builtAt: new Date().toISOString(),
      totals: { count: ids.length },
      byId: auto,
    },
    null,
    2,
  ),
);

const reviewed = [...new Set([...ids, ...HAND])].sort();
fs.writeFileSync(
  REVIEWED_FILE,
  JSON.stringify(
    { updatedAt: new Date().toISOString(), ids: reviewed, count: reviewed.length },
    null,
    2,
  ),
);

console.log(`Auto-ports: ${ids.length} → ${OUT_JS}`);
console.log(`Reviewed: ${reviewed.length} → ${REVIEWED_FILE}`);

// Patch generator to load reviewed file
const genPath = 'scripts/gen-sim-dedicated-ports.mjs';
let gen = fs.readFileSync(genPath, 'utf8');
if (!gen.includes('sim-reviewed-ids.json')) {
  gen = gen.replace(
    `/** Hand-reviewed ports in ports.js — fidelity bumped in registry. */
const REVIEWED = {
  broom: true,
  banana: true,
  poison_bow: true,
  hero_longsword: true,
  falcon_blade: true,
  healing_herbs: true,
  wooden_sword: true,
  katana: true,
  amulet_of_life: true,
  holy_armor: true,
};`,
    `/** Reviewed = hand ports + auto-pattern ports */
const REVIEWED_FILE = 'assets/data/sim-reviewed-ids.json';
const REVIEWED = Object.create(null);
if (fs.existsSync(REVIEWED_FILE)) {
  for (const id of JSON.parse(fs.readFileSync(REVIEWED_FILE, 'utf8')).ids || []) {
    REVIEWED[id] = true;
  }
}
for (const id of ${JSON.stringify(HAND)}) REVIEWED[id] = true;`,
  );
  fs.writeFileSync(genPath, gen);
}

spawnSync(process.execPath, ['scripts/gen-sim-dedicated-ports.mjs'], {
  stdio: 'inherit',
});
spawnSync(process.execPath, ['scripts/build-sim-coverage.mjs'], {
  stdio: 'inherit',
});
