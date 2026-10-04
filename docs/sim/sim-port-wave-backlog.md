# Simulator Package 4 port backlog

Generated from `assets/data/sim-fidelity-ledger.json` on 2026-10-04. This is the evidence-first inventory of every simulator row that is not yet source-ported; it is not a parity claim.

## Current audited state

- Catalog items: **519**
- Source-ported (not fixture/live certified): **373**
- Runtime port present but incomplete: **90**
- Source unresolved: **29**
- Deferred supported-mode gap: **1**
- Intentional no-combat rows: **26** (not backlog work)
- Lifecycle-hook gaps: **10**; call-review candidates: **47**; duplicate registrations: **21**.

## Completion rule for every row

Before checking a row off: resolve the exact game source and inherited behavior, implement both player and opponent paths, add a focused regression for state and causal event order, and verify applicable Combat Log, Damage Meter, HUD, scrubber, and export behavior. Keep uncertainty in `sim-validation.md`; a handler alone is not completion.

## Start first - confirmed behavior gaps
- [x] `power_of_the_moon` - Exclusive/PoweroftheMoon.gd; current handler: power_of_the_moon; depth: deep; Lifecycle hook audit: onPostCombatStart.
- [x] `wand_of_dissonance` - Exclusive/WandofDissonance.gd; current handler: wand_of_dissonance; depth: deep; Lifecycle hook audit: onPrepare.
- [x] `rib_saw_blade` - RibSawBlade.gd; current handler: rib_saw_blade; depth: shallow; Lifecycle hook audit: onPrepare.

## Source unresolved (29)

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
- [ ] `flawed_amethyst`
- [ ] `flawed_emerald`
- [ ] `flawed_ruby`
- [ ] `flawed_sapphire`
- [ ] `flawless_amethyst`
- [ ] `flawless_emerald`
- [ ] `flawless_ruby`
- [ ] `flawless_sapphire`
    50|- [ ] `flawless_topaz`
- [ ] `goobling`
- [ ] `holo_fire_lizard`
- [ ] `joker`
- [ ] `perfect_amethyst`
- [ ] `perfect_emerald`
- [ ] `perfect_ruby`
- [ ] `perfect_sapphire`
- [ ] `perfect_topaz`
- [ ] `regular_amethyst`
    60|- [ ] `regular_emerald`
- [ ] `regular_ruby`
- [ ] `regular_sapphire`
- [ ] `regular_topaz`
- [ ] `resistor`
- [ ] `reverse`
- [ ] `shortbow`
- [ ] `skull`
- [ ] `stable_recombobulator`
- [ ] `strong_heroic_potion`
    70|- [ ] `strong_mana_potion`
- [ ] `superior_ring`
- [ ] `the_fool`
- [ ] `the_lovers`
- [ ] `tiger_rune`
- [ ] `unstable_recombobulator`
- [ ] `whetstone2`
- [ ] `white_eyes_blue_dragon`

## Runtime port present but incomplete (90)
    80|
These rows have a registered handler but still need source/lifecycle/evidence completion.

- [ ] `axe`
- [ ] `bewitchment`
- [ ] `blood_amulet`
- [ ] `bloody_dagger`
- [ ] `broccoli`
- [ ] `broccotree`
- [ ] `burning_banner`
    90|- [ ] `burning_coal`
- [ ] `burning_sword`
- [ ] `burning_torch`
- [ ] `carrot_goobert`
- [ ] `cauldron`
- [ ] `chainsaw`
- [ ] `charge_splitter`
- [ ] `chili_pepper`
- [ ] `coil`
- [ ] `crossblades`
   100|- [ ] `cursed_hair_comb`
- [ ] `dark_lantern`
- [ ] `darksaber`
- [ ] `death_lotus`
- [ ] `deer_totem`
- [ ] `djinn_lamp`
- [ ] `doom_cap`
- [ ] `double_axe`
- [ ] `draconic_orb`
- [ ] `dragon_knight`
   110|- [ ] `dragon_set`
- [ ] `emerald_whelp`
- [ ] `energy_conversion`
- [ ] `everburning`
- [ ] `fanfare`
- [ ] `flame_badge`
- [ ] `flame_whip`
- [ ] `flute`
- [ ] `fly_agaric`
- [ ] `fortunas_kiss`
   120|- [ ] `gingerbread_man`
- [ ] `halberd`
- [ ] `heart_container`
- [ ] `hero_sword`
- [ ] `ice_armor`
- [ ] `just_stats`
- [ ] `laboratory`
- [ ] `leaf_badge`
- [ ] `level_up`
- [ ] `light_flower`
   130|- [ ] `lucky_bow`
- [ ] `lucky_clover`
- [ ] `magic_torch`
- [ ] `mananana`
- [ ] `molten_dagger`
- [ ] `molten_spear2`
- [ ] `moon_armor`
- [ ] `more_stats`
- [ ] `null_blade`
- [ ] `pan`
   140|- [ ] `phoenix`
- [ ] `piggy_of_riches`
- [ ] `piggybank`
- [ ] `poison_dagger`
- [ ] `poison_grenade`
- [ ] `poison_shortbow`
- [ ] `pot`
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
