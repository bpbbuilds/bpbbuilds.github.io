# Simulator Package 4 port backlog

Generated from `assets/data/sim-fidelity-ledger.json` on 2026-10-04. This is the evidence-first inventory of every simulator row that is not yet source-ported; it is not a parity claim.

## Current audited state

- Catalog items: **519**
- Source-ported (not fixture/live certified): **353**
- Runtime port present but incomplete: **90**
- Source unresolved: **49**
- Deferred supported-mode gap: **1**
- Intentional no-combat rows: **26** (not backlog work)
- Lifecycle-hook gaps: **10**; call-review candidates: **36**; duplicate registrations: **21**.

## Completion rule for every row

Before checking a row off: resolve the exact game source and inherited behavior, implement both player and opponent paths, add a focused regression for state and causal event order, and verify applicable Combat Log, Damage Meter, HUD, scrubber, and export behavior. Keep uncertainty in `sim-validation.md`; a handler alone is not completion.

## Start first - confirmed behavior gaps

- [ ] `power_of_the_moon` - Exclusive/PoweroftheMoon.gd; current handler: power_of_the_moon; depth: deep; Lifecycle hook audit: onPostCombatStart.
- [x] `wand_of_dissonance` - Exclusive/WandofDissonance.gd; current handler: wand_of_dissonance; depth: deep; Lifecycle hook audit: onPrepare.
- [x] `rib_saw_blade` - RibSawBlade.gd; current handler: rib_saw_blade; depth: shallow; Lifecycle hook audit: onPrepare.

## Source unresolved (49)

These rows need the exact extract script/inheritance resolved before a port can be assessed.

- [ ] `ace_of_spades`
- [ ] `armored_courage_puppy`
- [ ] `badger_rune`
- [ ] `bagtacular`
- [ ] `book_of_ice_new`
- [ ] `chipped_amethyst`
- [ ] `chipped_emerald`
- [ ] `chipped_ruby`
- [ ] `chipped_sapphire`
- [ ] `chipped_topaz`
- [ ] `darkest_lotus`
- [ ] `elephant_rune`
- [ ] `flawed_amethyst`
- [ ] `flawed_emerald`
- [ ] `flawed_ruby`
- [ ] `flawed_sapphire`
- [ ] `flawed_topaz`
- [ ] `flawless_amethyst`
- [ ] `flawless_emerald`
- [ ] `flawless_ruby`
- [ ] `flawless_sapphire`
- [ ] `flawless_topaz`
- [ ] `goobling`
- [ ] `holo_fire_lizard`
- [ ] `joker`
- [ ] `perfect_amethyst`
- [ ] `perfect_emerald`
- [ ] `perfect_ruby`
- [ ] `perfect_sapphire`
- [ ] `perfect_topaz`
- [ ] `regular_amethyst`
- [ ] `regular_emerald`
- [ ] `regular_ruby`
- [ ] `regular_sapphire`
- [ ] `regular_topaz`
- [ ] `resistor`
- [ ] `reverse`
- [ ] `shortbow`
- [ ] `skull`
- [ ] `stable_recombobulator`
- [ ] `strong_heroic_potion`
- [ ] `strong_mana_potion`
- [ ] `superior_ring`
- [ ] `the_fool`
- [ ] `the_lovers`
- [ ] `tiger_rune`
- [ ] `unstable_recombobulator`
- [ ] `whetstone2`
- [ ] `white_eyes_blue_dragon`

## Runtime port present but incomplete (92)

These rows have a registered handler but still need source/lifecycle/evidence completion.

- [ ] `axe`
- [ ] `bewitchment`
- [ ] `blood_amulet`
- [ ] `bloody_dagger`
- [ ] `broccoli`
- [ ] `broccotree`
- [ ] `burning_banner`
- [ ] `burning_coal`
- [ ] `burning_sword`
- [ ] `burning_torch`
- [ ] `carrot_goobert`
- [ ] `cauldron`
- [ ] `chainsaw`
- [ ] `charge_splitter`
- [ ] `chili_pepper`
- [ ] `coil`
- [ ] `crossblades`
- [ ] `cursed_hair_comb`
- [ ] `dark_lantern`
- [ ] `darksaber`
- [ ] `death_lotus`
- [ ] `deer_totem`
- [ ] `djinn_lamp`
- [ ] `doom_cap`
- [ ] `double_axe`
- [ ] `draconic_orb`
- [ ] `dragon_knight`
- [ ] `dragon_set`
- [ ] `emerald_whelp`
- [ ] `energy_conversion`
- [ ] `everburning`
- [ ] `fanfare`
- [ ] `flame_badge`
- [ ] `flame_whip`
- [ ] `flute`
- [ ] `fly_agaric`
- [ ] `fortunas_kiss`
- [ ] `gingerbread_man`
- [ ] `halberd`
- [ ] `heart_container`
- [ ] `hero_sword`
- [ ] `ice_armor`
- [ ] `just_stats`
- [ ] `laboratory`
- [ ] `leaf_badge`
- [ ] `level_up`
- [ ] `light_flower`
- [ ] `lucky_bow`
- [ ] `lucky_clover`
- [ ] `magic_torch`
- [ ] `mananana`
- [ ] `molten_dagger`
- [ ] `molten_spear2`
- [ ] `moon_armor`
- [ ] `more_stats`
- [ ] `null_blade`
- [ ] `pan`
- [ ] `phoenix`
- [ ] `piggy_of_riches`
- [ ] `piggybank`
- [ ] `poison_dagger`
- [ ] `poison_grenade`
- [ ] `poison_shortbow`
- [ ] `pot`
- [ ] `power_of_the_moon`
- [ ] `pumpkin`
- [ ] `puzzlebag_l`
- [x] `rib_saw_blade`
- [ ] `ruby_chonk`
- [ ] `ruby_egg`
- [ ] `ruby_whelp`
- [ ] `sapphire_whelp`
- [ ] `scale`
- [ ] `serpent_staff`
- [ ] `shepherds_crook`
- [ ] `shovel`
- [ ] `slice_of_toast`
- [ ] `snowcake`
- [ ] `spin_to_win`
- [ ] `squirrel_archer`
- [ ] `steel_goobert`
- [ ] `stone`
- [ ] `thorn_bow`
- [ ] `time_pendant`
- [ ] `torch`
- [ ] `twine`
- [ ] `ukulele`
- [ ] `ultima`
- [ ] `vampiric_gloves`
- [ ] `walrus_tusk`
- [x] `wand_of_dissonance`
- [ ] `wisp`

## Deferred supported-mode gap (1)

- [ ] `chess_board`

## Maintenance

After a completed wave, run `node scripts/build-sim-fidelity-ledger.mjs`, `node scripts/build-sim-fidelity-ledger.mjs --check`, `node scripts/sim-continuous-audit.mjs --check`, and the narrow family smoke. Run the fixtures variant when fixture work changes.
