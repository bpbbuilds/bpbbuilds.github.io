# Simulator Package 4 port backlog

Generated from `assets/data/sim-fidelity-ledger.json` on 2026-10-03. This is the working list for completing Package 4 over time. It is an inventory of incomplete rows, **not** a claim that an item is correctly ported.

## Completion rule for every row

Before checking a row off, record the exact game source (including inherited behavior), implement the player and opponent path, add a focused regression for state and causal event order, and verify applicable Combat Log, Damage Meter, HUD, scrubber/export behavior. Keep any remaining uncertainty in `sim-validation.md`; do not promote a row merely because it has a handler.

## Start first - confirmed behavior gaps

- `power_of_the_moon` - source: `Items/Exclusive/PoweroftheMoon.gd`; exact `CombatTimer.advanceTime` semantics, fatigue transition, both sides, and log/snapshot timing.
- `wand_of_dissonance` - source: `Items/Exclusive/WandofDissonance.gd`; affected-Dark prepare factor, effect-damage path, health cost, most-stack selection, and both sides.
- `rib_saw_blade` - source: `Items/RibSawBlade.gd`; capture opposing empowerable weapons at prepare, purge only removable damage on hit, and both sides.

## Source resolution (49)

These catalog IDs have a simulator handler but no resolved extract-script row. First establish the exact script or inherited/base alias; only then assess the port.

- [ ] `ace_of_spades` - source mapping required; current depth `deep`.
- [ ] `armored_courage_puppy` - source mapping required; current depth `deep`.
- [ ] `badger_rune` - source mapping required; current depth `deep`.
- [ ] `bagtacular` - source mapping required; current depth `deep`.
- [ ] `book_of_ice_new` - source mapping required; current depth `deep`.
- [ ] `chipped_amethyst` - source mapping required; current depth `deep`.
- [ ] `chipped_emerald` - source mapping required; current depth `deep`.
- [ ] `chipped_ruby` - source mapping required; current depth `deep`.
- [ ] `chipped_sapphire` - source mapping required; current depth `deep`.
- [ ] `chipped_topaz` - source mapping required; current depth `deep`.
- [ ] `darkest_lotus` - source mapping required; current depth `deep`.
- [ ] `elephant_rune` - source mapping required; current depth `deep`.
- [ ] `flawed_amethyst` - source mapping required; current depth `deep`.
- [ ] `flawed_emerald` - source mapping required; current depth `deep`.
- [ ] `flawed_ruby` - source mapping required; current depth `deep`.
- [ ] `flawed_sapphire` - source mapping required; current depth `deep`.
- [ ] `flawed_topaz` - source mapping required; current depth `deep`.
- [ ] `flawless_amethyst` - source mapping required; current depth `deep`.
- [ ] `flawless_emerald` - source mapping required; current depth `deep`.
- [ ] `flawless_ruby` - source mapping required; current depth `deep`.
- [ ] `flawless_sapphire` - source mapping required; current depth `deep`.
- [ ] `flawless_topaz` - source mapping required; current depth `deep`.
- [ ] `goobling` - source mapping required; current depth `deep`.
- [ ] `holo_fire_lizard` - source mapping required; current depth `deep`.
- [ ] `joker` - source mapping required; current depth `deep`.
- [ ] `perfect_amethyst` - source mapping required; current depth `deep`.
- [ ] `perfect_emerald` - source mapping required; current depth `deep`.
- [ ] `perfect_ruby` - source mapping required; current depth `deep`.
- [ ] `perfect_sapphire` - source mapping required; current depth `deep`.
- [ ] `perfect_topaz` - source mapping required; current depth `deep`.
- [ ] `regular_amethyst` - source mapping required; current depth `deep`.
- [ ] `regular_emerald` - source mapping required; current depth `deep`.
- [ ] `regular_ruby` - source mapping required; current depth `deep`.
- [ ] `regular_sapphire` - source mapping required; current depth `deep`.
- [ ] `regular_topaz` - source mapping required; current depth `deep`.
- [ ] `resistor` - source mapping required; current depth `deep`.
- [ ] `reverse` - source mapping required; current depth `deep`.
- [ ] `shortbow` - source mapping required; current depth `deep`.
- [ ] `skull` - source mapping required; current depth `deep`.
- [ ] `stable_recombobulator` - source mapping required; current depth `deep`.
- [ ] `strong_heroic_potion` - source mapping required; current depth `deep`.
- [ ] `strong_mana_potion` - source mapping required; current depth `deep`.
- [ ] `superior_ring` - source mapping required; current depth `deep`.
- [ ] `the_fool` - source mapping required; current depth `deep`.
- [ ] `the_lovers` - source mapping required; current depth `deep`.
- [ ] `tiger_rune` - source mapping required; current depth `deep`.
- [ ] `unstable_recombobulator` - source mapping required; current depth `deep`.
- [ ] `whetstone2` - source mapping required; current depth `deep`.
- [ ] `white_eyes_blue_dragon` - source mapping required; current depth `deep`.

## Existing port, incomplete evidence or behavior (92)

These rows have a resolved source and runtime port but are still shallow, have an open hook/call finding, or otherwise lack the required evidence. Work in source-driven family waves, not by changing the ledger label.

- [ ] `axe` - source `Exclusive/Axe.gd`; extends `Weapon`; family `on_hit`; current depth `shallow`.
- [ ] `bewitchment` - source `Exclusive/Bewitchment.gd`; extends `Item`; family `unique`; current depth `deep`.
- [ ] `blood_amulet` - source `BloodAmulet.gd`; extends `Item`; family `start_buff`; current depth `shallow`.
- [ ] `bloody_dagger` - source `BloodyDagger.gd`; extends `Dagger`; family `on_hit`; current depth `shallow`.
- [ ] `broccoli` - source `Exclusive/Broccoli.gd`; extends `Food`; family `custom_cd`; current depth `shallow`.
- [ ] `broccotree` - source `Exclusive/Broccotree.gd`; extends `Food`; family `custom_cd`; current depth `shallow`.
- [ ] `burning_banner` - source `Exclusive/BurningBanner.gd`; extends `Item`; family `unique`; current depth `shallow`.
- [ ] `burning_coal` - source `BurningCoal.gd`; extends `Gem`; family `custom_cd`; current depth `shallow`.
- [ ] `burning_sword` - source `Exclusive/BurningSword.gd`; extends `Weapon`; family `on_hit`; current depth `shallow`.
- [ ] `burning_torch` - source `BurningTorch.gd`; extends `Weapon`; family `synergy_aura`; current depth `shallow`.
- [ ] `carrot_goobert` - source `CarrotGoobert.gd`; extends `Goobert`; family `pet_like`; current depth `deep`.
- [ ] `cauldron` - source `Exclusive/Cauldron.gd`; extends `Item`; family `unique`; current depth `shallow`.
- [ ] `chainsaw` - source `Exclusive/Chainsaw.gd`; extends `Weapon`; family `on_hit`; current depth `deep`.
- [ ] `charge_splitter` - source `Exclusive/ChargeSplitter.gd`; extends `Item`; family `unique`; current depth `shallow`.
- [ ] `chili_pepper` - source `Exclusive/ChiliPepper.gd`; extends `Food`; family `custom_cd`; current depth `shallow`.
- [ ] `coil` - source `Exclusive/Coil.gd`; extends `Item`; family `unique`; current depth `deep`.
- [ ] `crossblades` - source `Crossblades.gd`; extends `Weapon`; family `synergy_aura`; current depth `shallow`.
- [ ] `cursed_hair_comb` - source `CursedHairComb.gd`; extends `Item`; family `synergy_aura`; current depth `shallow`.
- [ ] `dark_lantern` - source `Exclusive/DarkLantern.gd`; extends `Item`; family `start_buff`; current depth `shallow`.
- [ ] `darksaber` - source `Darksaber.gd`; extends `Weapon`; family `on_hit`; current depth `shallow`.
- [ ] `death_lotus` - source `Exclusive/DeathLotus.gd`; extends `Item`; family `unique`; current depth `shallow`.
- [ ] `deer_totem` - source `Exclusive/DeerTotem.gd`; extends `Item`; family `unique`; current depth `shallow`.
- [ ] `djinn_lamp` - source `DjinnLamp.gd`; extends `Item`; family `unique`; current depth `shallow`.
- [ ] `doom_cap` - source `Exclusive/DoomCap.gd`; extends `Food`; family `custom_cd`; current depth `shallow`.
- [ ] `double_axe` - source `Exclusive/DoubleAxe.gd`; extends `Weapon`; family `on_hit`; current depth `shallow`.
- [ ] `draconic_orb` - source `Exclusive/DraconicOrb.gd`; extends `Item`; family `unique`; current depth `shallow`.
- [ ] `dragon_knight` - source `Exclusive/DragonKnight.gd`; extends `RubyWhelp`; family `on_hit`; current depth `deep`.
- [ ] `dragon_set` - source `Exclusive/DragonSet.gd`; extends `Item`; family `pet_like`; current depth `shallow`.
- [ ] `emerald_whelp` - source `Exclusive/EmeraldWhelp.gd`; extends `Weapon`; family `on_hit`; current depth `shallow`.
- [ ] `energy_conversion` - source `Exclusive/EnergyConversion.gd`; extends `Item`; family `unique`; current depth `shallow`.
- [ ] `everburning` - source `Exclusive/Everburning.gd`; extends `Item`; family `unique`; current depth `shallow`.
- [ ] `fanfare` - source `Fanfare.gd`; extends `Item`; family `unique`; current depth `shallow`.
- [ ] `flame_badge` - source `Exclusive/FlameBadge.gd`; extends `Item`; family `unique`; current depth `shallow`.
- [ ] `flame_whip` - source `Exclusive/FlameWhip.gd`; extends `Weapon`; family `on_hit`; current depth `shallow`.
- [ ] `flute` - source `Flute.gd`; extends `Item`; family `unique`; current depth `shallow`.
- [ ] `fly_agaric` - source `FlyAgaric.gd`; extends `Food`; family `custom_cd`; current depth `shallow`.
- [ ] `fortunas_kiss` - source `Exclusive/FortunasKiss.gd`; extends `Item`; family `unique`; current depth `shallow`.
- [ ] `gingerbread_man` - source `GingerbreadMan.gd`; extends `Food`; family `synergy_aura`; current depth `shallow`.
- [ ] `halberd` - source `Exclusive/Halberd.gd`; extends `Weapon`; family `on_hit`; current depth `shallow`.
- [ ] `heart_container` - source `HeartContainer.gd`; extends `Item`; family `unique`; current depth `shallow`.
- [ ] `hero_sword` - source `HeroSword.gd`; extends `Weapon`; family `synergy_aura`; current depth `shallow`.
- [ ] `ice_armor` - source `Exclusive/IceArmor.gd`; extends `Item`; family `unique`; current depth `shallow`.
- [ ] `just_stats` - source `Exclusive/JustStats.gd`; extends `Item`; family `start_buff`; current depth `shallow`.
- [ ] `laboratory` - source `Exclusive/Laboratory.gd`; extends `Item`; family `unique`; current depth `shallow`.
- [ ] `leaf_badge` - source `Exclusive/LeafBadge.gd`; extends `Item`; family `unique`; current depth `shallow`.
- [ ] `level_up` - source `Exclusive/LevelUp.gd`; extends `Item`; family `unique`; current depth `shallow`.
- [ ] `light_flower` - source `Exclusive/LightFlower.gd`; extends `Food`; family `unique`; current depth `shallow`.
- [ ] `lucky_bow` - source `LuckyBow.gd`; extends `Bow`; family `unique`; current depth `shallow`.
- [ ] `lucky_clover` - source `LuckyClover.gd`; extends `Item`; family `unique`; current depth `shallow`.
- [ ] `magic_torch` - source `MagicTorch.gd`; extends `Weapon`; family `on_hit`; current depth `shallow`.
- [ ] `mananana` - source `Exclusive/Mananana.gd`; extends `Food`; family `custom_cd`; current depth `shallow`.
- [ ] `molten_dagger` - source `Exclusive/MoltenDagger.gd`; extends `Dagger`; family `on_hit`; current depth `shallow`.
- [ ] `molten_spear2` - source `Exclusive/MoltenSpear2.gd`; extends `Weapon`; family `on_hit`; current depth `shallow`.
- [ ] `moon_armor` - source `Exclusive/MoonArmor.gd`; extends `Item`; family `unique`; current depth `shallow`.
- [ ] `more_stats` - source `Exclusive/MoreStats.gd`; extends `Item`; family `synergy_aura`; current depth `shallow`.
- [ ] `null_blade` - source `Exclusive/NullBlade.gd`; extends `Weapon`; family `on_hit`; current depth `shallow`.
- [ ] `pan` - source `Pan.gd`; extends `Weapon`; family `weapon_base`; current depth `shallow`.
- [ ] `phoenix` - source `Exclusive/Phoenix.gd`; extends `Weapon`; family `weapon_base`; current depth `shallow`.
- [ ] `piggy_of_riches` - source `Exclusive/PiggyofRiches.gd`; extends `BoxofRiches`; family `start_buff`; current depth `shallow`.
- [ ] `piggybank` - source `Piggybank.gd`; extends `Item`; family `start_buff`; current depth `shallow`.
- [ ] `poison_dagger` - source `PoisonDagger.gd`; extends `Dagger`; family `on_hit`; current depth `shallow`.
- [ ] `poison_grenade` - source `Exclusive/PoisonGrenade.gd`; extends `Item`; family `unique`; current depth `shallow`.
- [ ] `poison_shortbow` - source `Exclusive/PoisonShortbow.gd`; extends `Weapon`; family `on_hit`; current depth `shallow`.
- [ ] `pot` - source `Exclusive/Pot.gd`; extends `Item`; family `unique`; current depth `shallow`.
- [ ] `power_of_the_moon` - source `Exclusive/PoweroftheMoon.gd`; extends `Item`; family `unique`; current depth `deep`. - P0 confirmed gap: `onPostCombatStart` must advance the combat timer.
- [ ] `pumpkin` - source `Pumpkin.gd`; extends `Food`; family `on_hit`; current depth `shallow`.
- [ ] `puzzlebag_l` - source `Exclusive/PuzzlebagL.gd`; extends `Bag`; family `synergy_aura`; current depth `shallow`.
- [ ] `rib_saw_blade` - source `RibSawBlade.gd`; extends `Weapon`; family `on_hit`; current depth `shallow`. - P0 confirmed gap: retain/purge opposing empowerable weapons before damage.
- [ ] `ruby_chonk` - source `RubyChonk.gd`; extends `Weapon`; family `on_hit`; current depth `shallow`.
- [ ] `ruby_egg` - source `RubyEgg.gd`; extends `DragonEgg`; family `unique`; current depth `deep`.
- [ ] `ruby_whelp` - source `RubyWhelp.gd`; extends `Weapon`; family `weapon_base`; current depth `shallow`.
- [ ] `sapphire_whelp` - source `Exclusive/SapphireWhelp.gd`; extends `Weapon`; family `on_hit`; current depth `shallow`.
- [ ] `scale` - source `Exclusive/Scale.gd`; extends `Item`; family `unique`; current depth `shallow`.
- [ ] `serpent_staff` - source `Exclusive/SerpentStaff.gd`; extends `Weapon`; family `on_hit`; current depth `shallow`.
- [ ] `shepherds_crook` - source `Exclusive/ShepherdsCrook.gd`; extends `Item`; family `synergy_aura`; current depth `shallow`.
- [ ] `shovel` - source `Shovel.gd`; extends `Weapon`; family `on_hit`; current depth `shallow`.
- [ ] `slice_of_toast` - source `Exclusive/SliceofToast.gd`; extends `Food`; family `custom_cd`; current depth `shallow`.
- [ ] `snowcake` - source `Exclusive/Snowcake.gd`; extends `Food`; family `custom_cd`; current depth `shallow`.
- [ ] `spin_to_win` - source `Exclusive/SpintoWin.gd`; extends `Item`; family `custom_cd`; current depth `shallow`.
- [ ] `squirrel_archer` - source `Exclusive/SquirrelArcher.gd`; extends `Squirrel`; family `on_hit`; current depth `shallow`.
- [ ] `steel_goobert` - source `SteelGoobert.gd`; extends `Goobert`; family `pet_like`; current depth `deep`.
- [ ] `stone` - source `Stone.gd`; extends `Item`; family `on_hit`; current depth `shallow`.
- [ ] `thorn_bow` - source `ThornBow.gd`; extends `Bow`; family `synergy_aura`; current depth `shallow`.
- [ ] `time_pendant` - source `Exclusive/TimePendant.gd`; extends `Item`; family `custom_cd`.
- [ ] `torch` - source `Torch.gd`; extends `Weapon`; family `on_hit`; current depth `shallow`.
- [ ] `twine` - source `Exclusive/Twine.gd`; extends `Item`; family `unique`; current depth `deep`.
- [ ] `ukulele` - source `Exclusive/Ukulele.gd`; extends `Item`; family `unique`; current depth `shallow`.
- [ ] `ultima` - source `Exclusive/Ultima.gd`; extends `Item`; family `unique`; current depth `shallow`.
- [ ] `vampiric_gloves` - source `VampiricGloves.gd`; extends `Item`; family `unique`; current depth `deep`.
- [ ] `walrus_tusk` - source `WalrusTusk.gd`; extends `Item`; family `unique`; current depth `shallow`.
- [ ] `wand_of_dissonance` - source `Exclusive/WandofDissonance.gd`; extends `Item`; family `unique`; current depth `deep`. - P0 confirmed gap: prepare-time affected-Dark effect-damage factor is missing.
- [ ] `wisp` - source `Exclusive/Wisp.gd`; extends `Gem`; family `custom_cd`; current depth `shallow`.

## Deferred supported-mode gap (1)

- [ ] `chess_board` - source `Exclusive/ChessBoard.gd`; extends `Item`; family `unique`; current depth `noop`.

## Totals

- Total incomplete rows: **142**
- Source resolution: **49**
- Existing port incomplete: **92**
- Deferred: **1**

Rebuild/check the ledger after a completed wave with `node scripts/build-sim-fidelity-ledger.mjs --check`, then run `node scripts/sim-continuous-audit.mjs --check` and the narrow family smoke. Fixture work also runs `node scripts/sim-continuous-audit.mjs --check --fixtures`.
