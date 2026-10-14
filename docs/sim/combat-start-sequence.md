# Start-of-battle sequence

This is the simulator's source-backed reference for what happens between
pressing combat and the first normal cooldown/tick. It is derived from the
local game extract; paths below are relative to `tools/game-extract-full/`.

For the approved engine corrections and their scope, see the accompanying
[design](../superpowers/specs/2026-10-13-combat-start-parity-design.md).

## Order at a glance

```text
player inventory: copy -> shuffle -> sort trigger priority descending
opponent inventory: copy -> shuffle -> sort trigger priority descending
combined order: every player item, then every opponent item

PLAYER.prepare(), OPPONENT.prepare()
for each combined item: gem.prepare() -> item.onPrepare()

wait Game.COMBAT_DELAY (2.5 seconds)
emit Game.combat_start; start combat timer
PLAYER.combatStart(), OPPONENT.combatStart()
for each combined item: gem.preCombatStart -> arm cooldown -> item.onPreCombatStart()
for each combined item: gem.combatStart -> item.onCombatStart()
for each combined item: gem.postCombatStart -> item.onPostCombatStart()

normal character ticks and item cooldowns proceed
```

## Why the categories matter

`Core/Game.gd` builds one deterministic-for-a-seed lifecycle order. It does
not globally mix both boards by priority: player items always form the first
batch, even when an opponent item has a higher priority. Within each side,
items are shuffled before the descending priority sort, so equal priorities
remain randomized.

| Priority class | Source values | Examples |
| --- | ---: | --- |
| Highest | 10000 | Deer Totem |
| High + 100 | 1100 | Time Melting, Puzzle Bag of Endurance |
| High + 10 | 1010 | Berserker Bag, Wolf Badge |
| High + 5 | 1005 | Battery, Fedora, Fortuna's Kiss, Generator, Lucky Piggy, Amulet of Fortune |
| High + 3 / +2 / +1 | 1003 / 1002 / 1001 | Mr Struggles, Stone Armor/Shoes, Hedgehog; Arcane/Leather/Winged Boots and Automanaton; Stone Golem and Strong Health Potion |
| High | 1000 | Dark Lantern, Health Potion, Shelly, Heart of Darkness |
| Normal + offset | 2 / 1 | Holy Spear, King Crown |
| Normal | 0 | Default for every item without an override |
| Low | -1000 | Just Stats, More Stats |

Priority controls the item preparation/start passes, so it also controls the
order in which prepared EventBus listeners are connected. `Utility/EventBus.gd`
then calls those listeners in connection order; it does not apply a second
listener-priority sort.

<!-- GENERATED_COMBAT_START_CATALOG:BEGIN -->
## Complete item classification

This appendix is generated from the extracted script inventory plus the game item catalog (519 catalog items: 512 scripted rows and 7 catalog-only rows). A script can appear in more than one lifecycle list when it overrides more than one hook. The simulator priority map is an explicit override map; every item not listed in the priority table has source priority Normal (0).

Source inputs: `assets/data/sim-item-inventory.json`, `scripts/_cache/game-items.json`, and `js/pages/sim/engine/combat-start-priority.js`.

### Explicit trigger-priority overrides

| Priority class | Value | Complete item list |
| --- | ---: | --- |
| Highest | 10000 | Deerwood Guardian (`deer_totem`) |
| High + 100 | 1100 | Puzzlebag of Endurance (`puzzlebag_j`), Time Melting (`time_melting`) |
| High + 10 | 1010 | Duffle Bag (`berserker_bag`), Wolf Badge (`wolf_badge`) |
| High + 5 | 1005 | Amulet of Fortune (`amulet_of_fortune`), Battery (`battery`), Fedora (`fedora`), Fortuna’s Kiss (`fortunas_kiss`), Generator (`generator`), Lucky Piggy (`lucky_piggy`) |
| High + 3 | 1003 | Hedgehog (`hedgehog`), Mr. Struggles (`mr_struggles`), Stone Armor (`stone_armor`), Stone Shoes (`stone_shoes`) |
| High + 2 | 1002 | Arcane Boots (`arcane_boots`), Automanaton (`automanaton`), Leather Boots (`leather_boots`), Winged Boots (`winged_boots`) |
| High + 1 | 1001 | Stone Golem (`stone_golem`), Strong Health Potion (`strong_health_potion`) |
| High | 1000 | Dark Lantern (`dark_lantern`), Health Potion (`health_potion`), Heart of Darkness (`heart_of_darkness`), Shelly (`shelly`) |
| Normal + 2 | 2 | Holy Spear (`holy_spear`) |
| Normal + 1 | 1 | King Crown (`king_crown`) |
| Low | -1000 | Just Stats (`just_stats`), More Stats (`more_stats`) |

The rows above are the complete non-default map in `COMBAT_START_PRIORITY`; they are not representative examples. Equal-priority items are still shuffled within each side, and the player batch still runs before the opponent batch.

Coverage check: 29 explicit-priority items + 321 default-Normal items with a direct start hook + 169 default-Normal items without a direct start hook = 519 catalog items.

The priority table is the ordering classification. The lifecycle lists below subdivide the remaining Normal (0) items by what they do during preparation/start; an item can occur in multiple lifecycle lists when the source overrides multiple hooks.

### Preparation / listener registration (`onPrepare`) — 278 items

- Acorn Ace (`acorn_ace`)
- Acorn Collar (`acorn_collar`)
- Amulet of Energy (`amulet_of_agility`)
- Amulet of Alchemy (`amulet_of_alchemy`)
- Amulet of Darkness (`amulet_of_darkness`)
- Amulet of Feasting (`amulet_of_feasting`)
- Amulet of Fortune (`amulet_of_fortune`)
- Amulet of Life (`amulet_of_life`)
- Amulet of Light (`amulet_of_light`)
- Amulet of Steel (`amulet_of_steel`)
- Amulet of the Wild (`amulet_of_the_wild`)
- Angel Crystal (`angel_crystal`)
- Arcane Boots (`arcane_boots`)
- Arcane Vision (`arcane_intellect`)
- Armored Power Puppy (`armored_power_puppy`)
- Armored Wisdom Puppy (`armored_wisdom_puppy`)
- Artifact Stone: Cold (`artifact_stone_cold`)
- Artifact Stone: Death (`artifact_stone_death`)
- Artifact Stone: Heat (`artifact_stone_heat`)
- Automanaton (`automanaton`)
- Badger Spirit Companion (`badger_spirit`)
- Bag of Giving (`bag_of_giving`)
- Bag of Stones (`bag_of_stones`)
- Stuff-Throwinator (`bazooka`)
- Duffle Bag (`berserker_bag`)
- Bewitchment (`bewitchment`)
- Impractically Large Bloodthorne (`big_bloodthorne`)
- Mecha Armor (`bionic_armor`)
- Bismuth Cube (`bismuth_cube`)
- Blood Manipulation (`blood_manipulation`)
- Bloodthorne (`bloodthorne`)
- Bloody Dagger (`bloody_dagger`)
- Magic For Dummies (`book_of_basics`)
- Encyclopspedia of Darkness (`book_of_darkness`)
- Frieren’s Guide to Ice (`book_of_ice`)
- Book of Ice New (`book_of_ice_new`)
- Scripture of Light  (`book_of_light`)
- Nature Chronicles: Trees (`book_of_nature`)
- Bow and Arrow (`bow_and_arrow`)
- Brass Knuckles (`brass_knuckles`)
- Broccotree (`broccotree`)
- Broom (`broom`)
- Burning Banner (`burning_banner`)
- Thermal Thorns (`burning_spikes`)
- Burning Sword (`burning_sword`)
- Busted Blade (`busted_blade`)
- Buy the Holy Light (`buy_the_holy_light`)
- Carrot Goobert (`carrot_goobert`)
- Cat Spirit Companion (`cat_spirit`)
- Cauldron (`cauldron`)
- Chain Whip (`chain_whip`)
- Chainsaw (`chainsaw`)
- Charge Splitter (`charge_splitter`)
- Chess Board (`chess_board`)
- Chess Master (`chess_master`)
- Chromium Cube (`chrome_cube`)
- Claws of Attack (`claws_of_attack`)
- Coil (`coil`)
- Con-Trap-Tron (`con_trap_tron`)
- Critical Poison (`critical_poison`)
- Critwood Staff (`critwood_staff`)
- Crow (`crow`)
- Cthulhu (`cthulhu`)
- Cubert (`cubert`)
- Cupdrake (`cupcake_dragon`)
- Cupcake Staff (`cupcake_staff`)
- Cursed Dagger (`cursed_dagger`)
- Nocturnal Lock Lifter (`cursed_hair_comb`)
- Dagger (`dagger`)
- Dancing Dragon (`dancing_dragon`)
- Dark Lantern (`dark_lantern`)
- Dark Ritual (`dark_ritual`)
- Darksaber (`darksaber`)
- Death Lotus (`death_lotus`)
- Death Scythe (`death_scythe`)
- Deck of Cards (`deck_of_cards`)
- Deerwood Guardian (`deer_totem`)
- Devouring Sphere (`devouring_sphere`)
- Djinn Lamp (`djinn_lamp`)
- Double Axe (`double_axe`)
- Double Rainbow (`double_rainbow`)
- Draconic Orb (`draconic_orb`)
- Dragon Claws (`dragon_claws`)
- Dragon Knight (`dragon_knight`)
- Dragon Nest (`dragon_nest`)
- Dragon Set (`dragon_set`)
- Dragonscale Armor (`dragonscale_armor`)
- Dragonskin Boots (`dragonskin_boots`)
- Dual Wielding (`dual_wielding`)
- Eat-o-matic (`eat_o_matic`)
- Echoing Battlecry (`echoing_battlecry`)
- Electric Torch (`electric_torch`)
- Enchanted Weapons (`enchanted_weapons`)
- Energy Conversion (`energy_conversion`)
- Port-O-Charger (`engineer_box`)
- Everburning (`everburning`)
- Harold, the Hateful Hat (`evil_hat`)
- Extra Angy (`extra_angy`)
- Superspacious (`extra_bags`)
- False Life (`false_life`)
- Fanfare (`fanfare`)
- Flute (`flute`)
- Forest Dragon (`forest_dragon`)
- Forging Hammer (`forging_hammer`)
- Fortuna’s Kiss (`fortunas_kiss`)
- Friendly Fire (`friendly_fire`)
- Frog Prince (`frog_prince`)
- Frostbite (`frostbite`)
- Frozen Buckler (`frozen_buckler`)
- Frozen Flame (`frozen_flame`)
- Full Body Protection (`full_body_protection`)
- Unsettling Presence (`ghost`)
- Gigawatz (`gigawatz`)
- Girl Power (`girl_power`)
- Gold Armor (`gold_armor`)
- Gold Cube (`gold_cube`)
- Goobert (`goobert`)
- Impractically Large Greatsword (`greatsword`)
- Halberd (`halberd`)
- Hardwood (`hardwood`)
- Heart Container (`heart_container`)
- Heart of Darkness (`heart_of_darkness`)
- Heart of the Cards (`heart_of_the_cards`)
- Heart Shield (`heart_shield`)
- Heavy Drinking (`heavy_drinking`)
- Hedgehog (`hedgehog`)
- Hogus Bogus (`hogus_bogus`)
- White Lily Collar (`holy_collar`)
- Holy Spear (`holy_spear`)
- Hungry Blade (`hungry_blade`)
- Ice Dragon (`ice_dragon`)
- Ice Flower (`ice_flower`)
- Inner Power (`inner_power`)
- Investment Opportunity (`investment_opportunity`)
- Jynx Staff (`jynx_staff`)
- Jynx torquilla (`jynx_torquilla`)
- King Goobert (`king_goobert`)
- King of the Bling (`king_of_the_bling`)
- Knife to Meet You (`knife_to_meet_you`)
- Leaf Badge (`leaf_badge`)
- Leather Boots (`leather_boots`)
- Level Up (`level_up`)
- Lantern Berry (`light_flower`)
- Light Goobert (`light_goobert`)
- Lightning Staff (`lightning_staff`)
- Lightsaber (`lightsaber`)
- Lil Chestnut (`little_mimic`)
- Very Long Spear (`long_spear`)
- Fortuna's Grace (`lucky_bow`)
- Maneki-neko (`lucky_cat`)
- Lucky Piggy (`lucky_piggy`)
- Magic Badge (`magic_badge`)
- Blue Sage Collar (`magic_collar`)
- Cold Mirror (`magic_mirror`)
- Magic Ring (`magic_ring`)
- Magitecc Armor (`magitecc_armor`)
- Mana Mastery (`mana_mastery`)
- Mana Orb (`mana_orb`)
- Manathirst (`manathirst`)
- Markswoman (`markswoman`)
- Mecha Bat (`mecha_bat`)
- Mega Clover (`mega_clover`)
- Mercury Elemental (`mercury_elemental`)
- Molten Spear (`molten_spear`)
- Blazing Spear (`molten_spear2`)
- Moon Shield (`moon_shield`)
- Mr. Struggles (`mr_struggles`)
- Mrs. Struggles (`mrs_struggles`)
- No Rush Please (`no_rush_please`)
- Obsidian Dragon (`obsidian_dragon`)
- Stankus’ Toothpick (`onion_cutter`)
- Owl Spirit Companion (`owl_spirit`)
- Pandamonium (`pandamonium`)
- Paradise Birb (`paradise_birb`)
- Perpetuum Mobile (`perpetuum_mobile`)
- Phoenix (`phoenix`)
- Enraged Phoenix (`phoenix2`)
- Piercing Arrow (`piercing_arrow`)
- Piggy Piñata (`piggy_pinata`)
- Pine Protector (`pine_protector`)
- Belladonna's Whisper (`poison_bow`)
- Poison Frog (`poison_frog`)
- Poison Grenade (`poison_grenade`)
- Poison Ivy (`poison_ivy`)
- Poison Spear (`poison_spear`)
- Pop (`pop`)
- Boiling Pot (`pot`)
- Potion Belt (`potion_belt`)
- Power of the Moon (`power_of_the_moon`)
- Power Puppy (`power_puppy`)
- Prismatic Sword (`prismatic_sword`)
- Pumpkin (`pumpkin`)
- Puzzle Badge (`puzzle_badge`)
- Puzzlebag of Endurance (`puzzlebag_j`)
- Puzzlebag of Love (`puzzlebag_l`)
- Puzzlebag of Improvement (`puzzlebag_s`)
- Puzzlebag of Energy (`puzzlebag_t`)
- Puzzlebag of Ruin (`puzzlebag_z`)
- Puzzlebox (`puzzlebox`)
- Ranger Bag (`ranger_bag`)
- Ripsaw Blade (`rib_saw_blade`)
- Shovel-B01 3000 (`robodog`)
- Rope (`rope`)
- Ruby Chonk (`ruby_chonk`)
- Sir Sand (`sandbag`)
- Scale (`scale`)
- Scholar Bag (`scholar_bag`)
- Serpent Staff (`serpent_staff`)
- Sewing Case (`sewing_case`)
- Shell Totem (`shell_totem`)
- Shelly (`shelly`)
- Shepherd’s Crook (`shepherds_crook`)
- Shield of Valor (`shield_of_valor`)
- Shielded (`shielded`)
- Shiny Mantle (`shiny_mantle`)
- Sloth (`sloth`)
- Smelly Wall (`smelly_barrier`)
- Snake (`snake`)
- Snowball (`snowball`)
- Snowmaster (`snowmaster`)
- Solaris (`solaris`)
- Spear (`spear`)
- Spell Scroll: Dark Frenzy (`spell_scroll_dark`)
- Spell Scroll: Frostbolt (`spell_scroll_frostbolt`)
- Spell Scroll: Ice Block  (`spell_scroll_ice`)
- Spell Scroll: Blessing of Purity (`spell_scroll_light`)
- Spell Scroll: Regrowth (`spell_scroll_nature`)
- Spicy Banana (`spicy_banana`)
- Spiked Collar (`spiked_collar`)
- Spiked Shield (`spiked_shield`)
- Spiked Wall (`spiked_wall`)
- Staff of Fire (`staff_of_fire`)
- Staff of Unhealing (`staff_of_unhealing`)
- Stamina Sack (`stamina_sack`)
- Star of Courage (`star_of_courage`)
- Panzer Dragon (`steel_dragon`)
- Steel Goobert (`steel_goobert`)
- Stone Armor (`stone_armor`)
- Gloves of Power (`stone_gloves`)
- Stone Golem (`stone_golem`)
- Stone Shoes (`stone_shoes`)
- Stoned (`stoned`)
- Storage Coffin (`storage_coffin`)
- Strong Heroic Potion (`strong_heroic_potion`)
- Strong Mana Potion (`strong_mana_potion`)
- Sun Shield (`sun_shield`)
- Superior Ring (`superior_ring`)
- Tesla Coil (`tesla_coil`)
- Tusk Piercer (`thorn_bow`)
- Thorn Elemental (`thorn_elemental`)
- Thorn Whip (`thorn_whip`)
- Thornbloom (`thornbloom`)
- Thornburst (`thornburst`)
- Thunder Drake (`thunder_drake`)
- Time Dilator (`time_dilator`)
- Time Melting (`time_melting`)
- Toad (`toad`)
- Utility Pouch (`toolbox`)
- Turtle (`turtle`)
- Twine (`twine`)
- Twine Badge (`twine_badge`)
- Ukulele (`ukulele`)
- Ultima Ascension (`ultima`)
- Uniquely Unique (`uniquely_unique`)
- Red Orchid Collar (`vampiric_collar`)
- Vampiric Gloves (`vampiric_gloves`)
- Blood Harvester (`vampiric_scythe`)
- Vineweave Basket (`vineweave_basket`)
- Wand of Dissonance (`wand_of_dissonance`)
- War Scythe (`war_scythe`)
- Water Elemental (`water_elemental`)
- Essence of Steel (`whetstone3`)
- Winged Boots (`winged_boots`)
- Wisdom Puppy (`wisdom_puppy`)
- Wolf Badge (`wolf_badge`)
- Wolf Emblem (`wolf_emblem`)
- Wolpertinger (`wolpertinger`)
- Yggdrasil Leaf (`yggdrasil_leaf`)

### Pre-combat-start pass (`onPreCombatStart`) — 19 items

- Anvil (`anvil`)
- Armored Courage Puppy (`armored_courage_puppy`)
- Courage Puppy (`courage_puppy`)
- Cap of Discomfort (`evil_cap`)
- Fire Pit (`fire_pit`)
- Laboratory (`laboratory`)
- Leather Armor (`leather_armor`)
- Cap of Resilience (`leather_helm`)
- Mana Mastery (`mana_mastery`)
- No Rush Please (`no_rush_please`)
- Pan (`pan`)
- Platinum Customer Card (`platin_customer_card`)
- Ruby Egg (`ruby_egg`)
- Ruby Whelp (`ruby_whelp`)
- Sir Sand (`sandbag`)
- Panzer Dragon (`steel_dragon`)
- Stone Golem (`stone_golem`)
- Turtle (`turtle`)
- Villain Sword (`villain_sword`)

### Combat-start pass (`onCombatStart`) — 100 items

- Amethyst Egg (`amethyst_egg`)
- Amethyst Whelp (`amethyst_whelp`)
- Amulet of Energy (`amulet_of_agility`)
- Amulet of Alchemy (`amulet_of_alchemy`)
- Amulet of Life (`amulet_of_life`)
- Amulet of Steel (`amulet_of_steel`)
- Angel Crystal (`angel_crystal`)
- Battery (`battery`)
- Mecha Armor (`bionic_armor`)
- Blood Amulet (`blood_amulet`)
- Blood Goobert (`blood_goobert`)
- Thermal Thorns (`burning_spikes`)
- Burning Torch (`burning_torch`)
- Cap of Brilliance (`cap_of_brilliance`)
- Cog (`cog`)
- Corrupted Armor (`corrupted_armor`)
- Crossblades (`crossblades`)
- Nocturnal Lock Lifter (`cursed_hair_comb`)
- Dancing Dragon (`dancing_dragon`)
- Dark Lantern (`dark_lantern`)
- Deck of Cards (`deck_of_cards`)
- Dig Deeper (`dig_deeper`)
- Dragon Nest (`dragon_nest`)
- Emerald Egg (`emerald_egg`)
- Emerald Whelp (`emerald_whelp`)
- Cap of Discomfort (`evil_cap`)
- Falcon Blade (`falcon_blade`)
- Fanny Pack (`fanny_pack`)
- Fedora (`fedora`)
- Flame (`flame`)
- Flame Badge (`flame_badge`)
- Frozen Flame (`frozen_flame`)
- Generator (`generator`)
- Gingerbread Jerry (`gingerbread_man`)
- Gloves of Haste (`gloves_of_haste`)
- Gold Armor (`gold_armor`)
- Hardwood (`hardwood`)
- Healing Herbs (`healing_herbs`)
- Hero Longsword (`hero_longsword`)
- Hero Shield (`hero_shield`)
- Hero Sword (`hero_sword`)
- Holdall (`holdall`)
- Holy Armor (`holy_armor`)
- Hungry Blade (`hungry_blade`)
- Ice Armor (`ice_armor`)
- Inner Power (`inner_power`)
- Just Stats (`just_stats`)
- Leather Armor (`leather_armor`)
- Cap of Resilience (`leather_helm`)
- Fortuna's Grace (`lucky_bow`)
- Lucky Clover (`lucky_clover`)
- Lucky Piggy (`lucky_piggy`)
- Mage Hat (`mage_hat`)
- Magic Badge (`magic_badge`)
- Magic Ring (`magic_ring`)
- Magitecc Armor (`magitecc_armor`)
- Moon Armor (`moon_armor`)
- More Stats (`more_stats`)
- Mushroom Farm (`mushroom_farm`)
- No Rush Please (`no_rush_please`)
- Oil Lamp (`oil_lamp`)
- Perpetuum Mobile (`perpetuum_mobile`)
- Piggy of Riches (`piggy_of_riches`)
- Piggybank (`piggybank`)
- Platinum Customer Card (`platin_customer_card`)
- Pocket Sand (`pocket_sand`)
- Offering Bowl (`portable_altar`)
- Present (`present`)
- Protective Purse (`protective_purse`)
- Puzzlebag of Love (`puzzlebag_l`)
- Prismatic Orb (`rainbow_orb`)
- Rainbow Potion (`rainbow_potion`)
- Rat Chef (`rat_chef`)
- Ruby Egg (`ruby_egg`)
- Ruby Whelp (`ruby_whelp`)
- Sir Sand (`sandbag`)
- Sapphire Egg (`sapphire_egg`)
- Sapphire Whelp (`sapphire_whelp`)
- Scholar Bag (`scholar_bag`)
- Shaman Mask (`shaman_mask`)
- Shepherd’s Crook (`shepherds_crook`)
- Sloth (`sloth`)
- Smithing For Dummies (`smithing_for_dummies`)
- Snake (`snake`)
- Snowball (`snowball`)
- Spring Loader (`spring_loader`)
- Panzer Dragon (`steel_dragon`)
- Stone Armor (`stone_armor`)
- Gloves of Power (`stone_gloves`)
- Stone Helm (`stone_helm`)
- Sun Armor (`sun_armor`)
- Superior Ring (`superior_ring`)
- Tusk Piercer (`thorn_bow`)
- Time Melting (`time_melting`)
- Utility Pouch (`toolbox`)
- Vampiric Armor (`vampiric_armor`)
- Walrus Tusk (`walrus_tusk`)
- Whetstone (`whetstone`)
- Improved Whetstone (`whetstone2`)
- Yggdrasil Leaf (`yggdrasil_leaf`)

### Post-combat-start pass (`onPostCombatStart`) — 1 items

- Power of the Moon (`power_of_the_moon`)

### Inventory-start gem effects (`combatStartInventory`) — 1 items

- Elephant Rune (`elephant_rune`)

### Default Normal items with no direct start hook — 169 items

These catalog items do not directly override one of the five lifecycle hooks above. Their priority is Normal (0) unless they also appear in the explicit priority table. A no-direct-hook row is not a claim of no combat behavior: it may use an inherited hook, a reactive callback such as `onDamaged`, or ordinary cooldown/trigger behavior later in the fight.

- Ace of Spades (`ace_of_spades`)
- Unidentified Amulet (`amulet_unidentified`)
- Axe (`axe`)
- Badger Rune (`badger_rune`)
- Bagtacular (`bagtacular`)
- Banana (`banana`)
- Black Bishop (`black_bishop`)
- Black King (`black_king`)
- Black Knight (`black_knight`)
- Black Pawn (`black_pawn`)
- Black Queen (`black_queen`)
- Black Rook (`black_rook`)
- Blueberries (`blueberries`)
- Happy Bomb (`bomb`)
- Boomerang (`boomerang`)
- Big Bowl of Treats (`bowl_of_treats`)
- Box of Prosperity (`box_of_prosperity`)
- Box of Riches (`box_of_riches`)
- Broccoli (`broccoli`)
- Broccoli Goobert (`broccoli_goobert`)
- Burning Blade (`burning_blade`)
- Burning Coal (`burning_coal`)
- Carrot (`carrot`)
- Cheese (`cheese`)
- Cheese Goobert (`cheese_goobert`)
- Chili Goobert (`chili_goobert`)
- Chili Pepper (`chili_pepper`)
- Chipped Amethyst (`chipped_amethyst`)
- Chipped Emerald (`chipped_emerald`)
- Chipped Ruby (`chipped_ruby`)
- Chipped Sapphire (`chipped_sapphire`)
- Chipped Topaz (`chipped_topaz`)
- Cog Badge (`cog_badge`)
- Bunch of Coins (`coins`)
- Corrupted Crystal (`corrupted_crystal`)
- Glowing Crown (`crown`)
- Cupcake (`cupcake`)
- Cupcake Goobert (`cupcake_goobert`)
- Customer Card (`customer_card`)
- Daggerang (`daggerang`)
- Darkest Lotus (`darkest_lotus`)
- Demonic Flask (`demonic_flask`)
- Divine Potion (`divine_potion`)
- Doom Cap (`doom_cap`)
- Eggscalibur (`eggscalibur`)
- Employee Uniform (`employee_uniform`)
- Box of Cogs (`engineer_bag_2`)
- Fancy Fencing Rapier (`fancy_fencing_rapier`)
- Turbo-Shelly (`fire_shelly`)
- Flame Whip (`flame_whip`)
- Flawed Amethyst (`flawed_amethyst`)
- Flawed Emerald (`flawed_emerald`)
- Flawed Ruby (`flawed_ruby`)
- Flawed Sapphire (`flawed_sapphire`)
- Flawed Topaz (`flawed_topaz`)
- Flawless Amethyst (`flawless_amethyst`)
- Flawless Emerald (`flawless_emerald`)
- Flawless Ruby (`flawless_ruby`)
- Flawless Sapphire (`flawless_sapphire`)
- Flawless Topaz (`flawless_topaz`)
- Fly Agaric (`fly_agaric`)
- Furcifer Prime Subscription (`furcifer_prime`)
- Garlic (`garlic`)
- Goobling (`goobling`)
- Hammer (`hammer`)
- Hawk Rune (`hawk_rune`)
- Heroic Potion (`heroic_potion`)
- Holo Fire Lizard (`holo_fire_lizard`)
- Hyper Hedgehog (`hyper_hedgehog`)
- Hypercube (`hypercube`)
- Jimbo (`joker`)
- Katana (`katana`)
- Leather Bag (`leather_bag`)
- Lightning in a Bottle (`lightning_potion`)
- Treasure Chest (`lootbox`)
- Fortuna's Hope (`lucky_shortbow`)
- Lump of Coal (`lump_of_coal`)
- Magic Staff (`magic_staff`)
- Magic Torch (`magic_torch`)
- Mana Crystal (`mana_crystal`)
- Mana Potion (`mana_potion`)
- Mananana (`mananana`)
- Miss Fortune (`miss_fortune`)
- Molten Dagger (`molten_dagger`)
- Molten Greatsword (`molten_greatsword`)
- Null Blade (`null_blade`)
- Perfect Amethyst (`perfect_amethyst`)
- Perfect Emerald (`perfect_emerald`)
- Perfect Ruby (`perfect_ruby`)
- Perfect Sapphire (`perfect_sapphire`)
- Perfect Topaz (`perfect_topaz`)
- Pestilence Flask (`pestilence_flask`)
- Pineapple (`pineapple`)
- Plastic Cube (`plastic_cube`)
- Poison Dagger (`poison_dagger`)
- Poison Goobert (`poison_goobert`)
- Belladonna's Shade (`poison_shortbow`)
- Prismatic Wand (`prismatic_wand`)
- Rainbow Badge (`rainbow_badge`)
- Rainbow Goobert Omegaooze Primeslime (`rainbow_goobert`)
- Rainbow Goobert Gigabrocolomega  (`rainbow_goobert_adventurer`)
- Rainbow Goobert Deathslushy Mansquisher (`rainbow_goobert_berserker`)
- Rainbow Goobert Fluffyloaf Prismacrust (`rainbow_goobert_engineer`)
- Rainbow Goobert Omnicolor Sugargoo  (`rainbow_goobert_mage`)
- Rainbow Goobert Epicglob Uberviscous (`rainbow_goobert_pyromancer`)
- Rainbow Goobert Megasludge Alphapuddle (`rainbow_goobert_ranger`)
- Sack of Surprises (`random_loadout_bag`)
- Rat (`rat`)
- Regular Amethyst (`regular_amethyst`)
- Regular Emerald (`regular_emerald`)
- Regular Ruby (`regular_ruby`)
- Regular Sapphire (`regular_sapphire`)
- Regular Topaz (`regular_topaz`)
- Relic Case (`relic_case`)
- Repeater (`repeater`)
- Resistor (`resistor`)
- Reverse! (`reverse`)
- Scissorswords (`scissorswords`)
- Seal the Deal (`seal_the_deal`)
- Shiny Shell (`shiny_shell`)
- Shortbow (`shortbow`)
- Shovel (`shovel`)
- Tim (`skull`)
- Skull Badge (`skull_badge`)
- Slice of Bread (`slice_of_bread`)
- Slice of Toast (`slice_of_toast`)
- It’s Slime Time! (`slime_time`)
- Snow Stick (`snow_stick`)
- Snowcake (`snowcake`)
- Wonky Snowman (`snowman`)
- Speak with Animals (`speak_with_animals`)
- Spectral Dagger (`spectral_dagger`)
- Spiked Staff (`spiked_staff`)
- Spin to Win (`spin_to_win`)
- Spirit Bells (`spirit_bells`)
- Squirrel (`squirrel`)
- Squirrel Archer (`squirrel_archer`)
- Stable Recombobulator (`stable_recombobulator`)
- Stone (`stone`)
- Stone Badge (`stone_badge`)
- Stone Skin Potion (`stone_skin_potion`)
- Strong Demonic Flask (`strong_demonic_flask`)
- Strong Divine Potion (`strong_divine_potion`)
- Strong Pestilence Flask (`strong_pestilence_flask`)
- Strong Stone Skin Potion (`strong_stone_skin_potion`)
- Strong Vampiric Potion (`strong_vampiric_potion`)
- The Fool (`the_fool`)
- The Lovers (`the_lovers`)
- Tusk Poker (`thorn_shortbow`)
- Thor’s Hammer (`thors_hammer`)
- Tiger Rune (`tiger_rune`)
- Time Pendant (`time_pendant`)
- Toast Goobert (`toast_goobert`)
- Torch (`torch`)
- Unidentified Skill (`unidentified_skill`)
- Unstable Recombobulator (`unstable_recombobulator`)
- Vampiric Potion (`vampiric_potion`)
- Wand of Equilibrium (`wand`)
- White Bishop (`white_bishop`)
- White-Eyes Blue Dragon (`white_eyes_blue_dragon`)
- White King (`white_king`)
- White Knight (`white_knight`)
- White Pawn (`white_pawn`)
- White Queen (`white_queen`)
- White Rook (`white_rook`)
- Wisp (`wisp`)
- Wooden Buckler (`wooden_buckler`)
- Wooden Sword (`wooden_sword`)
- Wrench (`wrench`)

### Extracted base/support classes (not catalog items)

The extract also contains these shared classes. They are intentionally excluded from the item counts above and are covered through their derived items: `amethyst`, `bagborder`, `bow`, `card`, `chesspiece`, `dragonegg`, `emerald`, `food`, `forestfriend`, `gemsocket`, `goldcounter`, `itempushzone`, `recombobulator`, `rotationspring`, `ruby`, `sapphire`, `socketsnode`, `topaz`, `weapon`.

If a new item script or source hook is added, rerun `node scripts/build-combat-start-catalog.mjs` and review the resulting diff. This keeps the audit complete without hand-maintaining a second item registry.
<!-- GENERATED_COMBAT_START_CATALOG:END -->

## Phase details

### Character preparation

`Core/Character.gd` resets character stamina regeneration and probability RNGs,
applies mode health setup, and determines a possible automatic Battle Rage
source. If the board has no Battle Rage starter-tag item, one eligible
Battle-Rage-effect item/gem is selected. `combatStart()` later resets stun,
starts the character tick timer, and schedules that automatic rage at five
seconds.

### Item preparation

`Items/Item.gd` first caches affected targets and resets its RNGs. It then
prepares every socketed gem before calling the host's `onPrepare()`. This is
where long-lived listeners are registered: health thresholds, attacks,
Battle-Rage transitions, stack changes, and socket effects. A later start
effect can trigger only listeners that have already been connected.

### Pre-combat pass

This happens after the delay. For one item at a time, its gems run their
pre-combat hooks, its initial cooldown is adjusted/armed, and then its
`onPreCombatStart()` runs. This pass covers effects that must operate on an
armed cooldown or deliberately disable it.

### Combat-start pass

For one item at a time, socket combat-start hooks run before the host's
`onCombatStart()`. This is the ordinary `Start of battle:` item-effect pass.
Examples include opening Block, stacks, health loss, and direct activation.

### Post-combat-start pass

This separate final pass calls gem post hooks followed by the host's
`onPostCombatStart()`. It exists even when most items do not use it. The
extract's Power of the Moon is an example of an item-specific post-start hook.

## Important reaction rules

- `takeDamage` emits `character_damaged` after HP/Block resolution but before
  death and spikes. `loseHealth` emits the same signal after unmitigated health
  loss and before death.
- Thresholds are usually strict. A 50% rule using `< 0.5` does not fire at
  exactly 50%.
- Dark Lantern starts by losing 50% maximum health; that is not an
  invulnerability event. Its invulnerability belongs only to lethal
  reincarnation.
- Stun is one shared duration using `max(current, incoming)`, not duplicate
  stuns. It suppresses the stunned character's item cooldown/trigger loop.
- Character ticks alternate: Regeneration on even ticks and Poison on odd
  ticks. Heat is a stack, not automatic character damage.

## Simulator boundaries

The simulator mirrors the ordered lifecycle, damage signal timing, source
priority categories, Dark Lantern self-health path, and core tick/stun rules.
It does not attempt to reproduce Game UI-only `combat_start` subscribers.
Shared lifecycle correctness is not proof that every individual item hook has
been ported; item behavior remains tracked in the fidelity ledger.

## Verification

Run these after lifecycle changes:

```powershell
node scripts/sim-combat-start-priority-smoke.mjs
node scripts/sim-lifecycle-smoke.mjs
node scripts/sim-dark-lantern-start-threshold-smoke.mjs
node scripts/sim-phoenix-lantern-smoke.mjs
node scripts/build-sim-fidelity-ledger.mjs --check
git diff --check
```
