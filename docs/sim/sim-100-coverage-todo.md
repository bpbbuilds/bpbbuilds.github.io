# Simulator 100% Coverage TODO

This is the completion roadmap for the simulator, not a claim that it already matches the game. It starts from the audited state on 2026-10-06: 519 catalog items, 491 source-ported items, no runtime-port-incomplete rows, one unresolved source row, one deferred system row, 26 intentional no-combat rows, and 44 static call-review candidates.

## Definition of 100%

The simulator reaches 100% coverage only when every catalog item is classified as one of: source-ported and verified, genuinely no-combat with its source evidence recorded, or an explicitly supported non-combat mode with a test. No unresolved, deferred, or untriaged rows remain. All shared game systems that item scripts rely on must have a verified simulator equivalent.

## 1. Keep the current port baseline healthy

- [x] Clear the runtime-item backlog: 491 source-ported; zero runtime-port-incomplete rows.
- [x] Clear item-level lifecycle-hook gaps.
- [x] Port Time Melting's duration-only stars and prepare-time effect.
- [x] Run the ledger check after every simulator change: `node scripts/build-sim-fidelity-ledger.mjs --check` — verified 2026-10-06: `OK sim-fidelity-ledger: 519 catalog rows`.
- [x] Keep a focused smoke check for every new or corrected source behavior — current simulator waves are covered by focused smoke scripts, and the final backlog, Time Melting, lifecycle, Pumpkin-through-Scale, Axe/Broccoli, and Wand/Rib checks passed on 2026-10-06.

## 2. Resolve every remaining catalog classification

- [ ] Resolve `flawed_topaz`: trace its exact source/inheritance and replace the `source_unresolved` ledger status with tested behavior or an evidenced no-combat classification.
- [ ] Resolve Chess Board: implement supported chess movement/capture combat AI, or remove simulator support for it and record the supported-mode boundary. The current deferred item is `chess_board`.
- [ ] Audit the 26 no-combat rows against their source and record why each has no simulator combat action:
  - [ ] `amulet_unidentified`, `box_of_prosperity`, `box_of_riches`, `coins`, `customer_card`, `employee_uniform`, `engineer_bag_2`, `furcifer_prime`, `hypercube`, `leather_bag`, `lootbox`, `random_loadout_bag`, `snowman`, `unidentified_skill`.
  - [ ] Chess-piece rows: `black_bishop`, `black_king`, `black_knight`, `black_pawn`, `black_queen`, `black_rook`, `white_bishop`, `white_king`, `white_knight`, `white_pawn`, `white_queen`, `white_rook`.
- [ ] Change every remaining unresolved/deferred/no-combat decision into a tested final classification.

## 3. Close shared-system coverage

- [ ] Implement and test the shared `Weapon` behavior as an explicit engine surface, including stamina, attack, hit result, activation, and inherited hooks.
- [ ] Implement and test the shared `Bow` prepare behavior and every derived bow path that depends on it.
- [ ] Implement and test shared `Card` reveal/trigger/deactivation behavior and chain ordering.
- [ ] Decide and document support for the remaining extracted base/support classes: `dragonegg`, `chesspiece`, `forestfriend`, `goldcounter`, `rotationspring`, `food`, `gemsocket`, `itempushzone`, `socketsnode`, and `bagborder`.
- [ ] Remove all untriaged hook gaps; generic-base gaps may only close when their derived items run through the implemented base behavior.

## 4. Review the static call candidates

For each candidate, trace the game call and either map it to the simulator implementation with a focused regression or mark it intentionally unsupported with evidence. These candidates are not all confirmed bugs.

- [ ] Effect damage / effect modifiers: `amulet_of_darkness`, `demonic_flask`, `ice_dragon`, `lightning_potion`, `snowcake`, `sun_shield`, `thors_hammer`.
- [ ] Gems and socket paths: `regular_emerald`, `regular_ruby`, `regular_sapphire`, `regular_topaz`, `wisp`.
- [ ] Resource, stack, and consumable paths: `arcane_boots`, `heart_shield`, `piercing_arrow`, `platin_customer_card`, `scissorswords`, `spell_scroll_ice`, `staff_of_unhealing`, `stone`, `stone_golem`, `stone_shoes`, `winged_boots`, `yggdrasil_leaf`.
- [ ] Damage/stat mutation paths: `cupcake_staff`, `dancing_dragon`, `magic_mirror`, `rainbow_goobert`, `rainbow_goobert_adventurer`, `rainbow_goobert_engineer`, `rainbow_goobert_pyromancer`.
- [ ] Chess call paths: `black_bishop`, `black_king`, `black_knight`, `black_pawn`, `black_queen`, `black_rook`, `white_bishop`, `white_king`, `white_knight`, `white_pawn`, `white_queen`, `white_rook`.

## 5. Eliminate duplicate handler ambiguity

- [ ] For every duplicate registration, keep one canonical handler or add an intentional alias test. Current audit includes `amulet_of_alchemy`, `badger_spirit`, `crow`, `double_rainbow`, `evil_hat`, `full_body_protection`, `heart_of_darkness`, `mana_crystal`, `mercury_elemental`, `no_rush_please`, `paradise_birb`, `robodog`, `spirit_bells`, `stone_badge`, `thorn_elemental`, `thornburst`, `torch`, `turtle`, and `wolpertinger`.

## 6. Validate both boards and the player-facing result

- [ ] Add/extend source-backed tests for player and opponent boards for each changed system.
- [ ] Verify causal event order, Combat Log, Damage Meter, HUD snapshots, scrubber, and JSON export for each new behavior.
- [ ] Add fixture coverage for every source-ported item family.
- [ ] Capture and compare representative live game outcomes for every item family and shared system.
- [ ] Record any measured game/simulator difference in `docs/sim/sim-validation.md`; do not label a row fully verified while a known difference remains.

## 7. Release gate: 100% coverage

- [ ] Fidelity ledger: 519 catalog rows classified; zero `source_unresolved`, zero `deferred`, zero `runtime-incomplete`, and no untriaged lifecycle gaps.
- [ ] Every combat-capable catalog item is source-ported, fixture-verified, and live-capture-verified on applicable modes.
- [ ] Every no-combat or out-of-scope game behavior has an evidenced, approved classification rather than a silent omission.
- [ ] Static call review and duplicate-registration audits have zero unexplained entries.
- [ ] `node scripts/sim-continuous-audit.mjs --check` passes with no accepted stale baseline.
- [ ] Run a final GitHub Pages simulator smoke test after deployment.
