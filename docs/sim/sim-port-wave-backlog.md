# Simulator Package 4 port backlog

Generated from `assets/data/sim-fidelity-ledger.json` on 2026-10-05. This is the evidence-first inventory of every simulator row that is not yet source-ported; it is not a parity claim.

## Current audited state

- Catalog items: **519**
- Source-ported (not fixture/live certified): **460**
- Runtime port present but incomplete: **31**
- Source unresolved: **1**
- Deferred supported-mode gap: **1**
- Intentional no-combat rows: **26** (not backlog work)
- Lifecycle-hook gaps: **5**; call-review candidates: **44**; duplicate registrations: **19**.

## Completion rule for every row

Before checking a row off: resolve the exact game source and inherited behavior, implement both player and opponent paths, add a focused regression for state and causal event order, and verify applicable Combat Log, Damage Meter, HUD, scrubber, and export behavior. Keep uncertainty in `sim-validation.md`; a handler alone is not completion.

## Start first - confirmed behavior gaps
- [x] `power_of_the_moon` - Exclusive/PoweroftheMoon.gd; current handler: power_of_the_moon; depth: deep; Lifecycle hook audit: onPostCombatStart.
- [x] `wand_of_dissonance` - Exclusive/WandofDissonance.gd; current handler: wand_of_dissonance; depth: deep; Lifecycle hook audit: onPrepare.
- [x] `rib_saw_blade` - RibSawBlade.gd; current handler: rib_saw_blade; depth: shallow; Lifecycle hook audit: onPrepare.

## Source unresolved (1)

These rows need the exact extract script/inheritance resolved before a port can be assessed.

- [x] `ace_of_spades` - `AceofSpades.gd` extends `Card`; direct `doRevealEffect` and inherited card-chain behavior resolved; handler: `ace_of_spades`.
- [x] `armored_courage_puppy` - `Exclusive/ArmoredCouragePuppy.gd` extends `CouragePuppy`; inherited `onPreCombatStart`/`doCooldownEffect` and `_ready` DamageSource flags resolved; handler: `armored_courage_puppy`.
- [x] `badger_rune` - `Exclusive/BadgerRune.gd` extends `Gem`; mode-dispatched `prepareInventory`/`prepareWeapon`/`prepareArmor` resolved; handler: `badger_rune`; focused regression: `scripts/sim-badger-bagtacular-smoke.mjs`.
- [x] `bagtacular` - `Exclusive/Bagtacular.gd` extends `Item`; `canAffect_global` presence-only bag modifier resolved across Fanny Pack/Stamina Sack/Potion Belt/Protective Purse; handler: `bagtacular`; focused regression: `scripts/sim-badger-bagtacular-smoke.mjs`.
- [x] `book_of_ice_new` - `Exclusive/BookofIceNew.tscn` reuses `Exclusive/BookofIce.gd` (`Item`); `onPrepare` linked-spell speed and mana-gated Cold/activation behavior resolved; handler: `book_of_ice_new`; focused regression: `scripts/sim-book-amethyst-smoke.mjs`.
- [x] `chipped_amethyst` - `Gems/ChippedAmethyst.tscn` reuses `Gems/Amethyst.gd` (`Gem`); inherited inventory cleanse/activation plus socketed weapon/armor modes resolved; handler: `chipped_amethyst`; focused regression: `scripts/sim-book-amethyst-smoke.mjs`.
- [x] `chipped_emerald` - `Gems/ChippedEmerald.tscn` reuses `Gems/Emerald.gd` (`Gem`); inventory regeneration/consume plus socketed poison and resistance modes resolved; handler: `chipped_emerald`; focused regression: `scripts/sim-chipped-gems-lotus-elephant-smoke.mjs`.
- [x] `chipped_ruby` - `Gems/ChippedRuby.tscn` reuses `Gems/Ruby.gd` (`Gem`); inventory steal-life/consume plus socketed lifesteal and healing-efficiency modes resolved; handler: `chipped_ruby`; focused regression: `scripts/sim-chipped-gems-lotus-elephant-smoke.mjs`.
- [x] `chipped_sapphire` - `Gems/ChippedSapphire.tscn` reuses `Gems/Sapphire.gd` (`Gem`); inventory cold/consume plus socketed mana, cold, and mana-to-block modes resolved; handler: `chipped_sapphire`; focused regression: `scripts/sim-chipped-gems-lotus-elephant-smoke.mjs`.
- [x] `chipped_topaz` - `Gems/ChippedTopaz.tscn` reuses `Gems/Topaz.gd` (`Gem`); prepare-inventory stamina regeneration plus socketed speed, stun-resistance, and crit-resistance modes resolved; handler: `chipped_topaz`; focused regression: `scripts/sim-chipped-gems-lotus-elephant-smoke.mjs`.
- [x] `darkest_lotus` - `DarkestLotus.tscn`/`DarkestLotus.gd` (`Card`); chain-position mana and hostile buff removal now occur before card activation; handler: `darkest_lotus`; focused regression: `scripts/sim-chipped-gems-lotus-elephant-smoke.mjs`.
- [x] `elephant_rune` - `Exclusive/ElephantRune.tscn`/`Exclusive/ElephantRune.gd` (`Gem`); inventory max-health consume, socketed stun, and timed armor debuff resistance resolved; handler: `elephant_rune`; focused regression: `scripts/sim-chipped-gems-lotus-elephant-smoke.mjs`.
- [x] `flawed_amethyst` - `Gems/FlawedAmethyst.tscn` reuses `Gems/Amethyst.gd` (`Gem`); repeating inventory cleanse/activation and socketed buff removal/healing reduction resolved; handler: `flawed_amethyst`; focused regression: `scripts/sim-flawed-flawless-gems-smoke.mjs`.
- [x] `flawed_emerald` - `Gems/FlawedEmerald.tscn` reuses `Gems/Emerald.gd` (`Gem`); inventory regeneration/consume and socketed poison/resistance modes resolved; handler: `flawed_emerald`; focused regression: `scripts/sim-flawed-flawless-gems-smoke.mjs`.
- [x] `flawed_ruby` - `Gems/FlawedRuby.tscn` reuses `Gems/Ruby.gd` (`Gem`); inventory effect-damage lifesteal/consume and socketed lifesteal/healing-efficiency modes resolved; handler: `flawed_ruby`; focused regression: `scripts/sim-flawed-flawless-gems-smoke.mjs`.
- [x] `flawed_sapphire` - `Gems/FlawedSapphire.tscn` reuses `Gems/Sapphire.gd` (`Gem`); inventory Cold/consume plus socketed late spectral/block-bypass, post-hit Mana, and Cold are resolved; focused regression: `scripts/sim-joker-sapphire-smoke.mjs`.
- [x] `flawless_amethyst` - `Gems/FlawlessAmethyst.tscn` reuses `Gems/Amethyst.gd` (`Gem`); repeating inventory cleanse/activation and socketed buff removal/healing reduction resolved; handler: `flawless_amethyst`; focused regression: `scripts/sim-flawed-flawless-gems-smoke.mjs`.
- [x] `flawless_emerald` - `Gems/FlawlessEmerald.tscn` reuses `Gems/Emerald.gd` (`Gem`); inventory regeneration/consume and socketed poison/resistance modes resolved; handler: `flawless_emerald`; focused regression: `scripts/sim-flawed-flawless-gems-smoke.mjs`.
- [x] `flawless_ruby` - `Gems/FlawlessRuby.tscn` reuses `Gems/Ruby.gd` (`Gem`); inventory effect-damage lifesteal/consume and socketed lifesteal/healing-efficiency modes resolved; handler: `flawless_ruby`; focused regression: `scripts/sim-flawed-flawless-gems-smoke.mjs`.
- [x] `flawless_sapphire` - `Gems/FlawlessSapphire.tscn` reuses `Gems/Sapphire.gd` (`Gem`); inventory Cold/consume plus socketed late spectral/block-bypass, post-hit Mana, and Cold are resolved; focused regression: `scripts/sim-joker-sapphire-smoke.mjs`.
- [x] `flawless_topaz` - `Gems/FlawlessTopaz.tscn` reuses `Gems/Topaz.gd` (`Gem`); prepare-inventory stamina regeneration and socketed speed/stun/crit resistance modes resolved; handler: `flawless_topaz`; focused regression: `scripts/sim-flawed-flawless-gems-smoke.mjs`.
- [x] `goobling` - `Exclusive/Goobling.tscn` reuses `Goobert.gd` (`Item`); peer-activation counter/heal lifecycle resolved under its own handler id; focused regression: `scripts/sim-goobling-cards-gems-smoke.mjs`.
- [x] `holo_fire_lizard` - `HoloFireLizard.gd` (`Card`); effect-damage factor, effect damage, Heat, and activation order resolved; focused regression: `scripts/sim-goobling-cards-gems-smoke.mjs`.
- [x] `joker` - `Exclusive/Joker.gd` (`Card`); random buffs, pair Crit resistance, triplet stamina reduction, and quadruple direct `doRevealEffect()` dispatch are resolved without changing the selected card's reveal/cooldown state; focused regression: `scripts/sim-joker-sapphire-smoke.mjs`.
- [x] `perfect_amethyst` - `Gems/PerfectAmethyst.tscn` reuses `Gems/Amethyst.gd` (`Gem`); inventory and supported socket paths resolved; focused regression: `scripts/sim-flawed-flawless-gems-smoke.mjs`.
- [x] `perfect_emerald` - `Gems/PerfectEmerald.tscn` reuses `Gems/Emerald.gd` (`Gem`); inventory and supported socket paths resolved; focused regression: `scripts/sim-flawed-flawless-gems-smoke.mjs`.
- [x] `perfect_ruby` - `Gems/PerfectRuby.tscn` reuses `Gems/Ruby.gd` (`Gem`); inventory and supported socket paths resolved; focused regression: `scripts/sim-flawed-flawless-gems-smoke.mjs`.
- [x] `perfect_sapphire` - `Gems/PerfectSapphire.tscn` reuses `Gems/Sapphire.gd` (`Gem`); inventory Cold/consume plus socketed late spectral/block-bypass, post-hit Mana, and Cold are resolved; focused regression: `scripts/sim-joker-sapphire-smoke.mjs`.
- [x] `perfect_topaz` - `Gems/PerfectTopaz.tscn` reuses `Gems/Topaz.gd` (`Gem`); inventory and supported socket paths resolved; focused regression: `scripts/sim-flawed-flawless-gems-smoke.mjs`.
- [x] `regular_amethyst` - `Gems/RegularAmethyst.tscn` reuses `Gems/Amethyst.gd` (`Gem`); inventory and supported socket paths resolved; focused regression: `scripts/sim-flawed-flawless-gems-smoke.mjs`.
- [x] `regular_emerald` - `Gems/RegularEmerald.tscn` reuses `Gems/Emerald.gd` (`Gem`); inventory regeneration/consume and socketed poison/resistance modes resolved; handler: `regular_emerald`; focused regression: `scripts/sim-regular-gems-resistor-reverse-smoke.mjs`.
- [x] `regular_ruby` - `Gems/RegularRuby.tscn` reuses `Gems/Ruby.gd` (`Gem`); inventory effect-damage lifesteal/consume and socketed lifesteal/healing-efficiency modes resolved; handler: `regular_ruby`; focused regression: `scripts/sim-regular-gems-resistor-reverse-smoke.mjs`.
- [x] `regular_sapphire` - `Gems/RegularSapphire.tscn` reuses `Gems/Sapphire.gd` (`Gem`); inventory Cold/consume plus socketed late spectral/block-bypass, post-hit Mana/Cold, and armor Mana-to-Block modes resolved; handler: `regular_sapphire`; focused regression: `scripts/sim-regular-gems-resistor-reverse-smoke.mjs`.
- [x] `regular_topaz` - `Gems/RegularTopaz.tscn` reuses `Gems/Topaz.gd` (`Gem`); prepare-inventory stamina regeneration plus socketed speed, stun-resistance, and crit-resistance modes resolved; handler: `regular_topaz`; focused regression: `scripts/sim-regular-gems-resistor-reverse-smoke.mjs`.
- [x] `resistor` - `Exclusive/Resistor.gd` (`Item`); charge callback grants source-configured Heat below `heatt`, emits a VFX-only mini activation, and leaves the threshold/failure path inert; handler: `resistor`; focused regression: `scripts/sim-regular-gems-resistor-reverse-smoke.mjs`.
- [x] `reverse` - `Exclusive/Reverse.gd` (`Card`); reveal grants consumable Reflect stacks and steals source-configured random buffs only when the chain has no earlier duplicate; handler: `reverse`; focused regression: `scripts/sim-regular-gems-resistor-reverse-smoke.mjs`.
- [x] `shortbow` - `Exclusive/Shortbow.tscn` reuses `Weapon.gd`; inherited stamina-gated ranged attack is covered by the base weapon handler; handler: `shortbow`; focused regression: `scripts/sim-shortbow-skull-potions-ring-fool-smoke.mjs`.
- [x] `skull` - `Gems/Skull.tscn` reuses `Gems/Skull.gd`; one-shot low-opponent-health heal/Empower, socketed buff steal, and all-debuff/crit resistance modes resolved; handler: `skull`; focused regression: `scripts/sim-shortbow-skull-potions-ring-fool-smoke.mjs`.
- [x] `stable_recombobulator` - `Exclusive/StableRecombobulator.tscn` reuses `Exclusive/Recombobulator.gd`; combat cooldown grants one random buff, cleanses one random debuff, and activates; handler: `stable_recombobulator`; focused regression: `scripts/sim-shortbow-skull-potions-ring-fool-smoke.mjs`.
- [x] `strong_heroic_potion` - `StrongHeroicPotion.tscn` reuses `HeroicPotion.gd`; starvation-triggered p1 Stamina/p2 Empower consumption resolved (unused catalog p3 is not invented as Lucky); handler: `strong_heroic_potion`; focused regression: `scripts/sim-shortbow-skull-potions-ring-fool-smoke.mjs`.
- [x] `strong_mana_potion` - `Exclusive/StrongManaPotion.tscn` reuses `ManaPotion.gd`; p1 HP-threshold/p2 Mana/p3 max-health consumption resolved; handler: `strong_mana_potion`; focused regression: `scripts/sim-shortbow-skull-potions-ring-fool-smoke.mjs`.
- [x] `superior_ring` - `Exclusive/SuperiorRing.tscn` reuses `Exclusive/MagicRing.gd`; generated trigger/stack scaling across Start, Every, own-low, and opponent-low lifecycles resolved; handler: `superior_ring`; focused regression: `scripts/sim-shortbow-skull-potions-ring-fool-smoke.mjs`.
- [x] `the_fool` - `TheFool.tscn` reuses `TheFool.gd`; deck-local reveal-speed buff and chain-position-zero Empower resolved; handler: `the_fool`; focused regression: `scripts/sim-shortbow-skull-potions-ring-fool-smoke.mjs`.
- [x] `the_lovers` - `TheLovers.gd` (`Card`); every reveal steals source damage/lifesteal, while even chain positions add healing efficiency and Regeneration; handler: `the_lovers`; focused regression: `scripts/sim-lovers-tiger-unstable-whetstone-white-eyes-smoke.mjs`.
- [x] `tiger_rune` - `Exclusive/TigerRune.gd` (`Gem`); inventory all-buff amplification, weapon-hit Vampirism, and armor buff-counter Block conversion resolved through the prepare/socket lifecycle; handler: `tiger_rune`; focused regression: `scripts/sim-lovers-tiger-unstable-whetstone-white-eyes-smoke.mjs`.
- [x] `unstable_recombobulator` - `Exclusive/UnstableRecombobulator.tscn` reuses `Exclusive/Recombobulator.gd`; combat cooldown grants one random buff and cleanses one random debuff; shop consumption/recombobulation remains outside combat; handler: `unstable_recombobulator`; focused regression: `scripts/sim-lovers-tiger-unstable-whetstone-white-eyes-smoke.mjs`.
- [x] `whetstone2` - `Exclusive/Whetstone2.tscn` reuses `Whetstone.gd`; start-of-battle linked empowerable weapons gain source-configured damage; handler: `whetstone2`; focused regression: `scripts/sim-lovers-tiger-unstable-whetstone-white-eyes-smoke.mjs`.
- [x] `white_eyes_blue_dragon` - `White-EyesBlueDragon.gd` (`Card`); reveal grants chain-scaled Block, Cold, and opponent effect-damage reduction; handler: `white_eyes_blue_dragon`; focused regression: `scripts/sim-lovers-tiger-unstable-whetstone-white-eyes-smoke.mjs`.

## Runtime port present but incomplete (57)
    80|
These rows have a registered handler but still need source/lifecycle/evidence completion.

- [x] `axe` - `Exclusive/Axe.tscn` / `Exclusive/Axe.gd` (`Weapon`); inherited stamina-gated strikes plus source p1 permanent damage on each successful early hit resolved; focused regression: `scripts/sim-axe-bewitchment-blood-broccoli-smoke.mjs`.
- [x] `bewitchment` - `Exclusive/Bewitchment.tscn` / `Exclusive/Bewitchment.gd` (`Item`); prepare-time Nature/Dark/Ice counts, Mana gate, random least-debuff distribution, and per-type chance bonuses resolved; focused regression: `scripts/sim-axe-bewitchment-blood-broccoli-smoke.mjs`.
- [x] `blood_amulet` - `BloodAmulet.tscn` / `BloodAmulet.gd` (`Item`); start-of-battle Vampirism and temporary maximum-health gain resolved; focused regression: `scripts/sim-axe-bewitchment-blood-broccoli-smoke.mjs`.
- [x] `bloody_dagger` - `BloodyDagger.tscn` / `BloodyDagger.gd` (`Dagger`); prepare-time Vampirism cap reset, successful-hit Vampirism growth, and linked Vampiric-item healing resolved; focused regression: `scripts/sim-axe-bewitchment-blood-broccoli-smoke.mjs`.
- [x] `broccoli` - `Exclusive/Broccoli.tscn` / `Exclusive/Broccoli.gd` (`Food`); inherited food-link speed plus Lucky/Regeneration threshold behavior resolved; focused regression: `scripts/sim-axe-bewitchment-blood-broccoli-smoke.mjs`.
- [x] `broccotree` - `Exclusive/Broccotree.tscn` / `Exclusive/Broccotree.gd` (`Food`); source onPrepare override, base-stamina regeneration listener, and Lucky-before-threshold Regeneration behavior resolved; focused regression: `scripts/sim-axe-bewitchment-blood-broccoli-smoke.mjs`.
- [x] `burning_banner` - `Exclusive/BurningBanner.tscn` / `Exclusive/BurningBanner.gd` (`Item`); cached Holy activatable listeners and prepare-time protection match source, with post-effect activation; focused regression: `scripts/sim-burning-heat-charge-smoke.mjs`.
    90|- [x] `burning_coal` - `Gems/BurningCoal.tscn` / `BurningCoal.gd` (`Gem`); loose heat/cleanse/consume plus weapon and armor socket hooks verified; focused regression: `scripts/sim-burning-heat-charge-smoke.mjs`.
- [x] `burning_sword` - `Exclusive/BurningSword.tscn` / `Exclusive/BurningSword.gd` (`Weapon`); prepare-time heat bank and cached empowerable targets plus hit heat are source-aligned; focused regression: `scripts/sim-burning-heat-charge-smoke.mjs`.
- [x] `burning_torch` - `BurningTorch.tscn` / `BurningTorch.gd` (`Weapon`); combat-start heat/activation and successful-hit permanent damage verified; focused regression: `scripts/sim-burning-heat-charge-smoke.mjs`.
- [x] `carrot_goobert` - `CarrotGoobert.tscn` / `CarrotGoobert.gd` (`Goobert`); inherited peer-activation threshold, cleanse, temporary Empower, and post-effect activation resolved; focused regression: `scripts/sim-burning-heat-charge-smoke.mjs`.
- [x] `cauldron` - `Exclusive/Cauldron.tscn` / `Exclusive/Cauldron.gd` (`Item`); prepare-time Food/Potion speed and no-immediate-repeat heal/Mana/Heat effects resolved; focused regression: `scripts/sim-burning-heat-charge-smoke.mjs`.
- [x] `chainsaw` - `Exclusive/Chainsaw.tscn` / `Exclusive/Chainsaw.gd` (`Weapon`); early-hit fractional buff strip/steal and slowdown replace the prior random-stack approximation; focused regression: `scripts/sim-burning-heat-charge-smoke.mjs`.
- [x] `charge_splitter` - `Exclusive/ChargeSplitter.tscn` / `Exclusive/ChargeSplitter.gd` (`Item`); prepare reset, dual explicit sendCharge paths, per-cell buff amplification, and heat-gated effect resolved; focused regression: `scripts/sim-burning-heat-charge-smoke.mjs`.
- [x] `chili_pepper` - `Exclusive/ChiliPepper.tscn` / `Exclusive/ChiliPepper.gd` (`Food`); heat, heal, threshold cleanse, and post-effect activation order resolved without duplicate registration; focused regression: `scripts/sim-burning-heat-charge-smoke.mjs`.
- [x] `coil` - `Exclusive/Coil.tscn` / `Exclusive/Coil.gd` (`Item`); prepare reset, capped charge steals, mini activation metadata, and terminal consume state resolved; focused regression: `scripts/sim-burning-heat-charge-smoke.mjs`.
- [x] `crossblades` - `Crossblades.gd`; source onPrepare linked primary damage/secondary speed, then per-hit damage; focused regression: `scripts/sim-crossblades-dragon-wave-smoke.mjs`.
   100|- [x] `cursed_hair_comb` - `CursedHairComb.gd`; source onPrepare healing-efficiency/lifesteal listener, combat-start Vampirism, and linked lifesteal healing; focused regression: `scripts/sim-crossblades-dragon-wave-smoke.mjs`.
- [x] `dark_lantern` - `Exclusive/DarkLantern.gd`; source onPrepare lethal listener, reincarnation/invulnerability, Fire-linked effect damage, debuffs, and activation; focused regression: `scripts/sim-crossblades-dragon-wave-smoke.mjs`.
- [x] `darksaber` - `Darksaber.gd`; source Mana-triggered Blind and non-removable varying damage scaling; focused regression: `scripts/sim-crossblades-dragon-wave-smoke.mjs`.
- [x] `death_lotus` - `Exclusive/DeathLotus.gd`; source linked Dark speed, Mana/strip/Lucky-to-Stamina cooldown effects, and post-effect activation; focused regression: `scripts/sim-crossblades-dragon-wave-smoke.mjs`.
- [x] `deer_totem` - `Exclusive/DeerTotem.gd`; source prepare damage resistance/rage duration, Rage-gated heal/Mana cooldown, and cooldown lock lifecycle; focused regression: `scripts/sim-crossblades-dragon-wave-smoke.mjs`.
- [x] `djinn_lamp` - `DjinnLamp.gd`; source prepare threshold tracking/first empowerable target and least-resource cooldown grant; focused regression: `scripts/sim-crossblades-dragon-wave-smoke.mjs`.
- [x] `doom_cap` - `Exclusive/DoomCap.gd`; source poison and healing-efficiency reduction occur before cooldown activation; focused regression: `scripts/sim-crossblades-dragon-wave-smoke.mjs`.
- [x] `double_axe` - `Exclusive/DoubleAxe.gd`; source normal/Rage permanent hit damage and first Rage-start cooldown strike; focused regression: `scripts/sim-crossblades-dragon-wave-smoke.mjs`.
- [x] `draconic_orb` - `Exclusive/DraconicOrb.gd`; source prepare Heat bank to Crit tokens and cooldown spike conversion to Heat; focused regression: `scripts/sim-crossblades-dragon-wave-smoke.mjs`.
- [x] `dragon_knight` - `Exclusive/DragonKnight.gd` inheriting `RubyWhelp.gd`; source Reflect/Heat lifecycle, peer activation cooldown advance, weapon strike, and damage heal; focused regression: `scripts/sim-crossblades-dragon-wave-smoke.mjs`.
   110|- [x] `dragon_set` - `Exclusive/DragonSet.gd`; source Rage-gated cooldown lock, Heat-before-activation, and full-set opponent-hit lifesteal; focused regression: `scripts/sim-crossblades-dragon-wave-smoke.mjs`.
- [x] `emerald_whelp` - `Exclusive/EmeraldWhelp.gd` (`Weapon`); combat-start Lucky, hit-gated Poison, and weapon strike are source-aligned; focused regression: `scripts/sim-emerald-ginger-wave-smoke.mjs`.
- [x] `energy_conversion` - `Exclusive/EnergyConversion.gd` (`Item`); Food-only prepare speed, stamina gate, Heat/random-buff branch, and post-effect activation are source-aligned; focused regression: `scripts/sim-emerald-ginger-wave-smoke.mjs`.
- [x] `everburning` - `Exclusive/Everburning.gd` (`Item`); prepare-time Flame count/stamina reduction, Heat conversion, and consume-after-effect lifecycle are source-aligned; focused regression: `scripts/sim-emerald-ginger-wave-smoke.mjs`.
- [x] `fanfare` - `Fanfare.gd` (`Item`); prepare speed, no-immediate-repeat effect choices, opponent Mana/Stamina drains, and post-effect activation are source-aligned; focused regression: `scripts/sim-emerald-ginger-wave-smoke.mjs`.
- [x] `flame_badge` - `Exclusive/FlameBadge.gd` (`Item`); combat-start Heat and consume lifecycle are source-aligned; focused regression: `scripts/sim-emerald-ginger-wave-smoke.mjs`.
- [x] `flame_whip` - `Exclusive/FlameWhip.gd` (`Weapon`); early hit-result Spikes gate, unrounded damage bonus, Heat grant, and miss preservation are source-aligned; focused regression: `scripts/sim-emerald-ginger-wave-smoke.mjs`.
- [x] `flute` - `Flute.gd` (`Item`); prepare speed, no-immediate-repeat Block/Stamina/Lucky choices, event projection, and post-effect activation are source-aligned; focused regression: `scripts/sim-emerald-ginger-wave-smoke.mjs`.
- [x] `fly_agaric` - `FlyAgaric.gd` (`Food`); inherited Food-link prepare speed and Poison-before-activation cooldown ordering are source-aligned; focused regression: `scripts/sim-emerald-ginger-wave-smoke.mjs`.
- [x] `fortunas_kiss` - `Exclusive/FortunasKiss.gd` (`Item`); chance-target filtering, prepare-time bonus chance, Lucky/random-buff gate, and post-effect activation are source-aligned; focused regression: `scripts/sim-emerald-ginger-wave-smoke.mjs`.
   120|- [x] `gingerbread_man` - `GingerbreadMan.gd` (`Food`); inherited Food-link prepare speed, combat-start temporary max health, gated Luck/Heat/Mana conversion, max-health grant, and always-activate ordering are source-aligned; focused regression: `scripts/sim-emerald-ginger-wave-smoke.mjs`.
- [x] `halberd` - `Exclusive/Halberd.gd` (`Weapon`); prepare-time Block power and cached strip, early permanent/current damage, and late Block removal/leftover grant are covered by `scripts/sim-halberd-null-blade-wave-smoke.mjs`.
- [x] `heart_container` - `HeartContainer.gd` (`Item`); prepare listener, Regeneration threshold, temporary max health, Empower, and healing efficiency are covered by `scripts/sim-halberd-null-blade-wave-smoke.mjs`.
- [x] `hero_sword` - `HeroSword.gd` (`Weapon`); combat-start empowerable-link damage and weapon cooldown path are covered by `scripts/sim-halberd-null-blade-wave-smoke.mjs`.
- [x] `ice_armor` - `Exclusive/IceArmor.gd` (`Item`); start Block/Cold and Heat-gated cooldown effect-before-activation ordering are covered by `scripts/sim-halberd-null-blade-wave-smoke.mjs`.
- [x] `just_stats` - `Exclusive/JustStats.gd` (`Item`); Low-priority start max-health percentage and stamina-regeneration grant are covered by `scripts/sim-halberd-null-blade-wave-smoke.mjs`.
- [x] `laboratory` - `Exclusive/Laboratory.gd` (`Item`); pre-combat phase/type initialization and staged resource conversion lifecycle are covered by `scripts/sim-halberd-null-blade-wave-smoke.mjs`.
- [x] `leaf_badge` - `Exclusive/LeafBadge.gd` (`Item`); prepare-time Lucky listener, linked damage-item crit percentage, and cooldown Lucky grant are covered by `scripts/sim-halberd-null-blade-wave-smoke.mjs`.
- [x] `level_up` - `Exclusive/LevelUp.gd` (`Item`); round-scaled prepare speed plus cooldown max-health/Stamina/Mana/Lucky ordering are covered by `scripts/sim-halberd-null-blade-wave-smoke.mjs`.
- [x] `light_flower` - `Exclusive/LightFlower.gd` (`Food`); prepare-time Holy protection, Mana-gated cleanse, empty-debuff reward, and activation ordering are covered by `scripts/sim-halberd-null-blade-wave-smoke.mjs`.
   130|- [x] `lucky_bow` - `LuckyBow.gd` (`Bow`); prepare reset, combat-start Lucky, critical-hit extra attack arm, and inherited weapon path are covered by `scripts/sim-halberd-null-blade-wave-smoke.mjs`.
- [x] `lucky_clover` - `LuckyClover.gd` (`Item`); combat-start Lucky then consume lifecycle is covered by `scripts/sim-halberd-null-blade-wave-smoke.mjs`.
- [x] `magic_torch` - `MagicTorch.gd` (`Weapon`); early Mana gate and current/permanent self plus empowerable-link damage are covered by `scripts/sim-halberd-null-blade-wave-smoke.mjs`.
- [x] `mananana` - `Exclusive/Mananana.gd` (`Food`); inherited Food prepare speed and Mana-gated heal/Stamina/always-activate cooldown are covered by `scripts/sim-halberd-null-blade-wave-smoke.mjs`.
- [x] `molten_dagger` - `Exclusive/MoltenDagger.gd` (`Dagger`); Heat-gated early current/permanent damage and resource spend are covered by `scripts/sim-halberd-null-blade-wave-smoke.mjs`.
- [x] `molten_spear2` - `Exclusive/MoltenSpear2.gd` (`Weapon`); prepare-time Fire strip cache, Heat miss conversion, dual Blind, and late Block removal are covered by `scripts/sim-halberd-null-blade-wave-smoke.mjs`.
- [x] `moon_armor` - `Exclusive/MoonArmor.gd` (`Item`); Magic-link start Block plus cooldown Mana/Reflect-before-activation ordering are covered by `scripts/sim-halberd-null-blade-wave-smoke.mjs`.
- [x] `more_stats` - `Exclusive/MoreStats.gd` (`Item`); global empowerable damage factor and Low-priority start max-health percentage are covered by `scripts/sim-halberd-null-blade-wave-smoke.mjs`.
- [x] `null_blade` - `Exclusive/NullBlade.gd` (`Weapon`); Lucky current/permanent damage, Regeneration-gated buff removal, and empty-opponent speed are covered by `scripts/sim-halberd-null-blade-wave-smoke.mjs`.
- [x] `pan` - `Pan.tscn` / `Pan.gd` (`Weapon`); pre-combat Food-affect damage and inherited stamina-gated weapon cooldown resolved; focused regression: `scripts/sim-pan-pot-wave-smoke.mjs`.
   140|- [x] `phoenix` - `Exclusive/Phoenix.tscn` / `Exclusive/Phoenix.gd` (`Weapon`); prepare-time own-damage listener, once-only Heat-scaled reincarnation, self-damage gate, and post-hit activation order resolved; focused regression: `scripts/sim-pan-pot-wave-smoke.mjs`.
- [x] `piggy_of_riches` - `Exclusive/PiggyofRiches.tscn` / `Exclusive/PiggyofRiches.gd` (`BoxofRiches`); socketed-gem maximum-health gain and start consume lifecycle resolved; focused regression: `scripts/sim-pan-pot-wave-smoke.mjs`.
- [x] `piggybank` - `Piggybank.tscn` / `Piggybank.gd` (`Item`); start-of-battle affected-item count, maximum-health gain, and consume lifecycle resolved; focused regression: `scripts/sim-pan-pot-wave-smoke.mjs`.
- [x] `poison_dagger` - `PoisonDagger.tscn` / `PoisonDagger.gd` (`Dagger`); successful-hit Poison plus inherited prepare-time opponent-stun free attack and source damage-then-activation order resolved; focused regression: `scripts/sim-pan-pot-wave-smoke.mjs`.
- [x] `poison_grenade` - `Exclusive/PoisonGrenade.tscn` / `Exclusive/PoisonGrenade.gd` (`Item`); prepare-time Lucky poison-crit listener, charge cooldown advance, Poison effects, and consume lifecycle resolved; focused regression: `scripts/sim-pan-pot-wave-smoke.mjs`.
- [x] `poison_shortbow` - `Exclusive/PoisonShortbow.tscn` / `Exclusive/PoisonShortbow.gd` (`Weapon`); hit/chance-gated Poison plus random-debuff branch and inherited weapon cooldown resolved; focused regression: `scripts/sim-pan-pot-wave-smoke.mjs`.
- [x] `pot` - `Exclusive/Pot.tscn` / `Exclusive/Pot.gd` (`Item`); prepare-time Food/Potion speed and linked-potion listener, Heat/Regeneration cooldown effects, heal reaction, and consume lifecycle resolved; focused regression: `scripts/sim-pan-pot-wave-smoke.mjs`.
- [ ] `power_of_the_moon`
- [ ] `pumpkin`
- [ ] `puzzlebag_l`
   150|- [x] `rib_saw_blade`
- [ ] `ruby_chonk`
- [ ] `ruby_egg`
- [ ] `ruby_whelp`
- [ ] `sapphire_whelp`
- [ ] `scale`
- [ ] `serpent_staff`
- [ ] `shepherds_crook`
- [ ] `shovel`
- [ ] `slice_of_toast`
   160|- [ ] `snowcake`
- [ ] `spin_to_win`
- [ ] `squirrel_archer`
- [ ] `steel_goobert`
- [ ] `stone`
- [ ] `thorn_bow`
- [ ] `time_pendant`
- [ ] `torch`
- [ ] `twine`
- [ ] `ukulele`
   170|- [ ] `ultima`
- [ ] `vampiric_gloves`
- [ ] `walrus_tusk`
- [x] `wand_of_dissonance`
- [ ] `wisp`

## Deferred supported-mode gap (1)

- [ ] `chess_board`

   180|## Maintenance

After a completed wave, run `node scripts/build-sim-fidelity-ledger.mjs`, `node scripts/build-sim-fidelity-ledger.mjs --check`, `node scripts/sim-continuous-audit.mjs --check`, and the narrow family smoke. Run the fixtures variant when fixture work changes.
