# Sim vs live game — validation notes

Phase 37 / Band AH checklist for comparing `/sim/` engine runs to **in-game fights**. Feeds **Band AF–AH** (GDScript 1:1 parity). Solid 100% is a prerequisite, not the finish line.

> **Note:** Live Backpack Battles has **no training dummy** — you fight other players’ boards. `/sim/` still defaults to a timed dummy. For a comparable fight, load the same two bags: `?slug=you&oppSlug=them` (first slice; charge/steal across bags still thin). Do not write ranked PvP HP onto dummy `live.*`.

## How to compare

1. Build the same board in-game (or open a published build).
2. Open `/sim/?slug={slug}&seed={n}&mode=engine` (or load the create draft).
3. Note in-game: end Health / Stamina, Buffs / Debuffs stack counts, rough activation order.
4. Scrub the sim HUD + event log to the same fight time (`?t=`).
5. Log deltas below (do not “fix” silently — list misses).

Optional: **Save run** on `/sim/`, change board/seed, **Compare** for end-HP / damage deltas between two sim runs (sim-vs-sim). Live-game numbers still need manual notes.

## Known deltas (engine vs game)

Update this table as you find misses. Family handlers (Band D) are approximate until Band G ports.

| Area | Sim today | Game | Severity |
|---|---|---|---|
| Item scripts | Solid HAND; AO skills/spells/books (combat catalog) | Per-item `Items/*.gd` | High — Band AO ([`sim-ap-census.json`](../../assets/data/sim-ap-census.json)) |
| Params | `getP*` wired; empty DB params use fallbacks | ItemData `p1`…`p10` / `getP*` | Medium |
| Stack gain | Caps + resist/reflect foundation | Full `Buff.gd` temp/cleanse | Medium |
| Heat | Buff stack, no free onTick burn | Buff stack + item heat rules | Low–medium |
| Damage order | miss→crit→%DR→flat DR→block→spikes→vamp | Full hooks / fatigue / tokens | Medium |
| Dummy AI | Timed auto-attack: **CD 2.15s**, **13** dmg, **88%** accuracy (AF 193; no extract script found) | Real opponent / training dummy scripts | Medium — tighten when `.gd` found |
| Cards / pets / gems | Partial systems | Full card/pet/socket scripts | Medium |
| HUD stacks shown | Core set + **temp countdown** (Phase 159) + stun/`invulnUntil` in snapshot | All `EventType` stacks when applied | Low (remaining EventTypes) |
| Fight length | Cap ~30s wall (~27.5s combat clock; UI shows 0 = items live) | Match rules / survival modes | Low for sandbox |
| CD first-proc time | `Item.adjustCooldown` ±5% jitter on every arm / re-arm (`seed`-stable) | Same `randf_range(0.95, 1.05)` on player CDs | Low — live vs sim within ±5% is expected, not a port bug |
| Combat Log UI | Band Q dual panel (Damage Dealt + log) | Full CombatLog + every DamageMeter metric | Low for chrome; medium for rare `LOG_*` variants |
| Log sentences | English `LOG_*` subset in `sim-log-sentences.js` | Full Interface.csv + BBCode | Low–medium (Band R) |

## Continuous-audit ownership (Package 6)

Every unexplained simulator mismatch stays in this table until source review,
a focused regression, and (where required) retained live evidence resolve it.
The continuous-audit command checks that this disclosure remains present; it
does not turn a listed gap into a pass.

| Mismatch / evidence gap | Owner | Game source or evidence | Severity | Next evidence |
|---|---|---|---|---|
| Power of the Moon has no `CombatTimer.advanceTime` equivalent | Package 4 lifecycle wave | `Items/Exclusive/PoweroftheMoon.gd` → `Interface/CombatTimer/CombatTimer.gd` | P1 | Source-led timer implementation plus two-sided timing/log regression and live capture if extract ordering is ambiguous. |
| Wand of Dissonance prepare/effect chain | Resolved 2026-10-04 | `Items/Exclusive/WandofDissonance.gd` + `scripts/sim-wand-rib-smoke.mjs` | Closed | Prepare factor, health gate, effect damage, max-stack random buff, causal parent IDs, log, and damage-meter exclusion are covered. |
| Rib Saw Blade retained enemy-weapon purge | Resolved 2026-10-04 | `Items/RibSawBlade.gd` + `scripts/sim-wand-rib-smoke.mjs` | Closed | Prepare-time opponent weapon snapshot, removable-only purge, hit bonus, and permanent/base damage preservation are covered. |
| Ace of Spades card reveal / crit token chain | Resolved 2026-10-04 | `Items/AceofSpades.gd` → `Items/Card.gd` + `scripts/sim-ace-puppy-smoke.mjs` | Closed | Direct reveal hook, inherited card chain, odd-position Lucky/Spikes, actor-token consumption, and player/opponent paths are covered. |
| Armored Courage Puppy inherited strike flags | Resolved 2026-10-04 | `Items/Exclusive/ArmoredCouragePuppy.gd` → `Items/Exclusive/CouragePuppy.gd` + `scripts/sim-ace-puppy-smoke.mjs` | Closed | Inherited start bonus/cooldown strike plus `_ready` removal of item-trigger and spike flags are covered. |
| Badger Rune mode-dispatched gem behavior | Resolved 2026-10-04 | `Items/Exclusive/BadgerRune.gd` → `Items/Gems/Gem.gd` + `scripts/sim-badger-bagtacular-smoke.mjs` | Closed | `prepareInventory` stamina factor, socketed weapon hit speed, raging armor `pre_take_damage` flat reduction, reduction attribution, and player/opponent paths are covered. |
| Bagtacular global bag modifiers | Resolved 2026-10-04 | `Items/Exclusive/Bagtacular.gd` + Fanny Pack/Stamina Sack/Potion Belt/Protective Purse sources + `scripts/sim-badger-bagtacular-smoke.mjs` | Closed | Presence-only global item, named `speed`/`stamina`/`buffs`/`block` params, no fabricated activation, and player/opponent bag paths are covered. |
| Book of Ice New scene alias and lifecycle | Resolved 2026-10-04 | `Items/Exclusive/BookofIceNew.tscn` → `Items/Exclusive/BookofIce.gd` + `scripts/sim-book-amethyst-smoke.mjs` | Closed | Scene-script alias is recorded; `onPrepare` linked-Ice speed, mana gate, Cold grant, activation order, and player/opponent paths are covered. |
| Chipped Amethyst scene alias and inherited gem modes | Resolved 2026-10-04 | `Items/Gems/ChippedAmethyst.tscn` → `Items/Gems/Amethyst.gd` + `scripts/sim-book-amethyst-smoke.mjs` | Closed | Inventory cleanse-before-activation, repeat/no-consume behavior, socketed weapon buff removal, armor healing reduction, and player/opponent paths are covered. |
| Four deterministic fixture bands disagree with the current engine | Package 5 fixture matrix | `scripts/fixtures/parity/berserk-bloodline.json`, `infinite-combo-machine.json`, `pyro-furnace.json`; these are sim baselines, not live proof | P1 | Reproduce each from source, preserve the mismatch, and add paired/live evidence before changing a band. |
| No retained live capture is filled (0/11 fixtures) | Package 5 live-capture matrix | `scripts/fixtures/parity/*.json` `live` blocks; protocol below | P1 | Capture real fights with board/opponent/version/timestamps and retain them only in `live.*`, never in dummy `expect` bands. |

## AF 194 — Damage / EventBus hooks audit

Doc-only blockers for AG/AH (no pipeline rewrite in AF):

| Hook / system | Sim today | Gap vs game | Priority |
|---|---|---|---|
| `preDeal` / damage modifiers | Family + port `onDealtDamage` after hit | Missing many `.gd` pre-hit mutators / token spends | AG |
| `onDealt` / `onHitReceived` | Partial on weapons | Armor / reflect / “when hit” pets incomplete | AG |
| Fatigue | `advanceFatigueCounter` + late fight damage | Confirm vs Character tick cadence | AH fixtures |
| Crit tokens / Lucky spend | Lucky used in some ports | Full crit-token economy | AG |
| Invuln | Duration + **charges** (AF 188) | Cleanse / dispel of invuln vs crowns | Low |
| Buff-protect | `hostileStrip` protect (AF 189) | Confirm which strips ignore protect | Low |
| Stun | Real `stunnedUntil` (AF 190) | Multi-stun stacking / resist | Low |
| Peer activate | Goobert counters (AF 191) | Other pets still CD-primary | AG 196 |
| Charge bus | `emitChargePulse` + receive (AF 192) | Full ElectricalCharge path / left cells | Medium |
| Remaining EventTypes | Subset in log sentences | Rare LOG_* / meter metrics | Band R / AH |

Smoke: `npm run sim-parity-systems-smoke` · `npm run sim-ag-smoke` · `npm run sim-parity-fixtures`.

## AQ 256 — Core leftover table

Walk of AF 194 + Core math. **Close** = in engine + report/smoke. **Ticket** = dump or later band; do not invent.

| Gap | Status | Where |
|---|---|---|
| Melee vamp `min(stacks, round(dmg × 1))` | **Closed** | `damage.js` `applyVampirism`; `report-params.js` `meleeVampirismLimit` |
| Ranged vamp limit 0 | **Closed** | `rangedVampirismLimit`; `report-params.js` `rangedVampirismLimit` |
| Unhealing `ceil` per logged heal | **Closed** | `actor.js` `unhealingFromLoggedHeal`; `report-params.js` `unhealing` |
| `Item.removeBlock` Damage Dealt | **Closed** | `ports-wave-c-util.js` `removeBlock`; `report-params.js` `blockremoval` |
| `Character.takeDamage` `attackEffectCount` | **Closed** | `attack-effects.js` + loop in `takeDamage` / `dealHit` / `combat-activate` |
| Bow `onWeaponAttacked` (Thorn spikes / Bow and Arrow bonus / Poison Bow acc) | **Closed** | `item_attacked` bus; ports in `ports-ap-basic.js` / `ports-al-weapons.js`. Smoke: `npm run sim-core-leftover-smoke` |
| Lucky Bow extra from **linked** crit | **Ticket** | still `onDealtDamage` on self (`ports-ap-onhit.js`) — needs a live dump vs star-linked weapon |
| `onPreDealDamage_late` loop | **Closed for host spectral hooks** | `damage.js` runs the late source phase after defender reductions and before Block; `gem-sockets.js` wires Sapphire's socket listener. Other source-specific late handlers remain separately audited. |
| Generic `applyOnHitStacks` × double chance | **Ticket** | catalog hint path in `combat-activate.js`, independent of HAND `onDealtDamage` |
| `preDeal` token spends / armor `onHitReceived` | **Ticket** | AF 194 AG — dump per item |
| Crit tokens / Lucky spend economy | **Ticket** | AF 194 AG |
| Fatigue cadence vs Character tick | **Ticket** | AH fixtures |
| Full ElectricalCharge / left cells | **Ticket** | AF 192; 255 covered Port-O-Charger delay only |
| Rare EventTypes / LOG_* | **Ticket** | Band R |
| `chess_board` / PvP opponents | **Deferred** | 267: game has chess CD AI; sim still defers |

Dump-driven: do not treat empty `ui.mismatches` as proof for ticketed rows.

AQ board smoke (Phase 258): `npm run sim-aq-smoke` — loose gems + Port-O-Charger/battery; `paramChecks` and `ui.mismatches` empty on those fixtures.

Dump protocol (Phase 259): [`sim-debug-protocol.md`](sim-debug-protocol.md) — `npm run sim-audit-debug -- path/to.json`. Do not strip report flags to hide a port bug.

Runtime generic ban (Phase 261): `npm run sim-engine-1to1-count` — silent `cd_*` / `basic_cd` unique resolve fails the harness.

Coverage honesty (Phase 262): the HUD meter’s **scripted** count is `engineMatch` (combat hooks), not `handlerExists`. Shop/chess noops, empty unique gem stubs, and gems still on generic `basic_cd` do not count as scripted combat. `npm run sim-coverage-honesty`.

Engine banner (Phase **268–270**): `/sim/` titles **Engine 1:1** only when 252 + 258 + 264 + 265 **and** counsel flags. Closeout JSON sets `engine11Achieved: false`. `npm run sim-engine-claim`.

## Phase 260 — class staple dumps (AR queue)

Engine `bpb-sim-debug` at seed **42**, 30s dummy. Regenerated by `npm run sim-staple-boards`. **Not a live meter pass.** Phase **264** requires empty `ui.mismatches` (`npm run sim-ar-milestone`). `paramChecks` may remain.

| Class | Fixture | paramChecks | ui.mismatches | Notes (sim vs `.gd`, not silenced) |
|---|---|---|---|---|
| Ranger | `poison-garden-ranger` | 0 | 0 | Empty flags ≠ live pass. |
| Pyromancer | `pyro-furnace` | 0 | 0 | Flame start consume now `pushActivate`. Empty flags ≠ live pass. |
| Berserker | `berserk-bloodline` | 0 | 0 | Bloodthorne convert is `onPreDealDamageEarly` + `grantStacks`. Empty flags ≠ live pass. |
| Reaper | `reaper-harvest` | 0 | 0 | Unhealing logs full-HP heals (`flushUnloggedHeal`) + `takeDamage`. Empty flags ≠ live pass. |
| Adventurer | `history-3705` | 4 | 0 | Emerald poison-on-hit vs catalog `poison`; Frog Prince luck/mana vs catalog **blind**. FBP block matches descriptor `block`, not `params.block` amp. |
| Engineer | `history-3703` | 0 | 0 | Empty flags ≠ live pass. |

## Phase 266 — wildcard dumps (off staple set)

Same engine dump as 260 (`seed` **42**, 30s dummy). Regenerated by `npm run sim-wildcard-boards`. **Not a live meter pass.** Flags are logged, not required empty.

| Board | Fixture | paramChecks | ui.mismatches | Notes (sim vs `.gd`, not silenced) |
|---|---|---|---|---|
| Create demo | `infinite-combo-machine` | 0 | 0 | Featured create layout. Empty flags ≠ live pass. Dummy HP 95 vs old expect max 90 is a **parity-band** issue, not this dump. |
| History Ranger | `history-3708` | 3 | 1 | Bloodthorne melee vamp-cap UI; Mecha Bat vamp grant **6** vs catalog **3**; Rat Chef empower vs stamina. |
| History Pyromancer | `history-3709` | 2 | 1 | Amulet of Darkness vamp-cap UI; Enchanted Weapons vamp grant vs `buffs`. |
| History Berserker | `history-3706` | 1 | 0 | Amulet of Fortune regen vs catalog `buffs`. |
| History Mage | `history-3704` | 3 | 0 | Wand regen/lucky vs empower; Serpent Staff poison vs mana. |

## Phase 267 — intentional noops

Canonical list: [`assets/data/sim-intentional-noops.json`](../../assets/data/sim-intentional-noops.json). Smoke: `npm run sim-noop-audit`.

Shop junk, leather/storage bags, and wearables (`hypercube` / `snowman` / `furcifer_prime` / `employee_uniform`) have **no** combat CD/start in `.gd`. Chess **pieces** only act when `ChessBoard.doCooldownEffect` runs; the dummy sim still **defers** that AI. Puzzlebag J/S/T/Z and Bag of Stones were false noops and are ported.

## Band AH — live capture protocol (Phase 212)

Fixtures live under [`scripts/fixtures/parity/`](../scripts/fixtures/parity/). Each file has `seed` (default **42**), `durationSec` (**30**), `placements`, `expect` HP bands, and a `live` block (null until you capture).

### Steps

1. Rebuild the **same bag** in-game and fight any opponent (note their class / rough strength).
2. Open the same board in `/sim/?slug={slug}&seed=42&mode=engine` (sim still uses the fixed dummy).
3. Record into the fixture’s `live` object (from **the game**), or:

```bash
npm run sim-live-capture -- --slug pyro-furnace --player-hp 142 --stam 12 --duration 8.2 --opponent-class Pyromancer --notes "8.2s vs Pyro, maxHP 200" --stacks heat:3,vampirism:2
```

That writes `live.playerEndHpMin/Max` (±15% of your HP, min width 25). It does **not** rewrite dummy `expect` (PvP opponent HP is not the sim dummy).

Fields:
   - `playerEndHp`, and opponent HP as `dummyEndHp` (name is historical — store the real opponent’s end HP)
   - `playerStamina`
   - `stacks` — at least `mana`, `heat`, `lucky`, `regeneration`, `poison`, `cold`, `empower`, `spikes`, `vampirism`, `blind` when non-zero
   - `capturedAt` — ISO date
   - `notes` — fight length (e.g. 8.32s), opponent name/class, max HP if not 200, anything odd
4. Keep `expect` as dummy-sim bands (`npm run sim-parity-fixtures`). Do not widen those bands to match PvP HP.
5. Optional: scrubber **export JSON** (`⤓`) — attach to the PR; keep seed + duration in the filename.

**What to trust from PvP captures today**

| Compare | Useful now? |
|---|---|
| Item procs (chili +1 Heat / heal 5, CDs, log lines) | Yes — primary signal |
| Your end HP / stam / stacks at fight end | Yes (note max HP — early rounds ≠ 200) |
| Fight length | Yes |
| Opponent end HP vs sim “dummy” | No — different foe model |

**Cooldown timing:** live first-proc times vary by **±5%** (`Item.adjustCooldown`). The sim mirrors that with the fight `seed` — do not flag chili-at-4.30 vs catalog-4.50 as a miss when the delta is inside the band. Live client fights call `Util.rng.randomize()` at boot and are **not** URL-seedable, so screenshot vs `?seed=` first-proc deltas inside ±5% are expected stream mismatch, not a port bug. Do not port Godot PCG32 hoping to match live screenshots.

Until `live.playerEndHp` is filled, `expect` bands are **sim-baseline** (engine run at the same seed/duration). Phase **265** adds live player bands **on `live.*` only**. Do not silently widen dummy `expect` to hide deltas.

### Runner

```bash
node scripts/build-parity-fixtures.mjs   # regenerate board JSON from DEMO/history
npm run sim-parity-fixtures              # assert expect bands
npm run sim-live-bands                   # capture schema + apply (does not invent HP)
```

## Parity harness

## Chipped gem / Darkest Lotus / Elephant Rune source-port audit (2026-10-04)

Focused source review and player/opponent smoke coverage now pass in
`scripts/sim-chipped-gems-lotus-elephant-smoke.mjs`:

- Chipped Emerald, Ruby, Sapphire, and Topaz resolve their scene aliases and
  inherited `Gem` lifecycle. Loose inventory effects consume in source order;
  socketed weapon/armor effects remain in `gem-sockets.js`.
- Darkest Lotus follows `Card.trigger`: next-card state is prepared first,
  then chain-position mana and hostile buff removal, then activation.
- Elephant Rune grants max health before consuming from inventory. Socketed
  weapon stun and armor debuff resistance are modeled for both board sides;
  armor resistance expires after the source `dur_resist` window.

The call audit includes the shared socket lifecycle for `Gem` rows, so these
source calls are not reported as missing merely because they live outside the
loose-gem handler module. This is source-port evidence, not a live capture or
claim of complete game parity.

## Flawed / Flawless gem source-port audit (2026-10-04)

`Flawed*.tscn` and `Flawless*.tscn` are scene aliases over the base Gem
scripts, not separate behavior scripts. The source inventory now records the
exact scene-to-script mapping. `scripts/sim-flawed-flawless-gems-smoke.mjs`
covers the requested tiers' parameters, inventory order, both-side Emerald
path, effect-damage/lifesteal causal order, Topaz HUD stat event, and supported
socket modes.

Flawed, Flawless, and Perfect Sapphire now use the canonical late pre-deal
dispatch. `damage.js` runs it after defender reductions but before Block, and
the socket handler applies `DamageSource.makeSpectral()` semantics to the live
source before the host strike resolves. Mana/Cold are then granted only after
the spectral hit. `scripts/sim-joker-sapphire-smoke.mjs` covers Perfect and
Flawless Sapphire on both boards against 999 Block; the shared source path also
closes Flawed Sapphire.

## Goobling, Holo Fire Lizard, Joker, and next gem source audit (2026-10-04)

The source inventory now resolves Goobling's `Exclusive/Goobling.tscn` alias
to `Goobert.gd`, the five Perfect gem aliases, and Regular Amethyst. The
focused smoke retains Holo Fire Lizard's source order (effect-damage factor,
effect damage, Heat, activation) and Joker's pair/triplet duplicate branches.

Joker's source quadruple branch is now complete. `ports-ao-cards.js` separates
each Card subclass's reveal effect from state-changing `Card.trigger`, then
Joker calls the selected card's effect directly. The selected card keeps its
face-down/reveal and cooldown state while still emitting its own source-order
effects and activation event. `scripts/sim-joker-sapphire-smoke.mjs` verifies
the seeded quadruple branch and the no-state-change contract. Perfect Sapphire
is covered by the shared late-pre-deal Sapphire regression above.

## Regular gems, Resistor, and Reverse source-port audit (2026-10-04)

The source inventory now records the four Regular Gem scene aliases and their
inherited scripts (`RegularEmerald/Ruby/Sapphire/Topaz.tscn` → the matching
`Gems/*.gd` script). `scripts/sim-regular-gems-resistor-reverse-smoke.mjs`
covers both board sides and the source lifecycle split: loose inventory
effects/consume, socketed weapon/armor behavior, Sapphire's late spectral
dispatch, and Topaz's prepare-time stamina/speed/resistance changes.

`Exclusive/Resistor.gd` is ported through the shared charge-delivery path. It
grants `heat` only while the actor is below `heatt`, emits a VFX-only
`miniActivate` after the grant, and intentionally produces no combat-log state
change when the source only plays its failed animation at the threshold.

`Exclusive/Reverse.gd` now uses the source's consumable
`changeDebuffReflectStacks` operation (not the unrelated percentage reflect
chance). Its secondary `stealRandomBuff` branch is gated by the source card
duplicate rule; the focused smoke checks Reflect HUD/stat output, buff transfer,
duplicate suppression, and activation ordering. This is source-port evidence,
not live-capture or complete 1:1 parity evidence.

Band AH: `npm run sim-parity-fixtures` + harness `PARITY_PCT_FLOOR`. Inventory `depth` ≠ coverage `fidelity: parity` — parity ids are fixture-backed (`parityIds` in `sim-parity-inventory.json`).

Combat log smoke: `npm run sim-log-smoke`.

## Shortbow, Skull, potion, ring, and Fool source-port audit (2026-10-04)

The source inventory now records the seven scene aliases and exact inherited
scripts. `scripts/sim-shortbow-skull-potions-ring-fool-smoke.mjs` exercises both
board sides:

- Shortbow uses the inherited `Weapon.gd` stamina-gated ranged attack.
- Skull covers its one-shot opponent-health threshold heal/Empower path plus
  socketed weapon buff steal and all-debuff/crit resistance.
- Stable Recombobulator covers one random buff, one random debuff cleanse, and
  combat activation; shop fusion remains out of combat scope.
- Strong Heroic and Strong Mana use their inherited HeroicPotion/ManaPotion
  hooks and exact catalog parameters. Strong Heroic's unused catalog p3 is not
  treated as an invented Lucky effect.
- Superior Ring covers generated trigger/stack scaling for Start, Every,
  owner-low, and opponent-low events. Misses do not satisfy the source's
  opponent `character_damaged` listener.
- The Fool buffs only its own `deck.cards` and grants Empower at chain position
  zero; unrelated decks remain unchanged.

This is source-port evidence, not live-capture or complete 1:1 parity evidence.

## The Lovers, Tiger Rune, Unstable Recombobulator, Whetstone2, and White-Eyes Blue Dragon source-port audit (2026-10-05)

The source inventory now resolves the Unstable Recombobulator and Whetstone2
scene aliases. `scripts/sim-lovers-tiger-unstable-whetstone-white-eyes-smoke.mjs`
covers both board sides and the source lifecycle split:

- The Lovers steals its configured damage/lifesteal every reveal and adds the
  even-chain healing-efficiency and Regeneration effects.
- Tiger Rune amplifies inventory buff gains during prepare, converts ten
  gained buffs to five Block in armor sockets, and grants one Vampirism on a
  successful weapon-socket roll. The implementation uses the simulator's
  `buffAmpChance` surface rather than an unused display-only field.
- Unstable Recombobulator shares the inherited Recombobulator combat cooldown
  (one random buff plus one debuff cleanse); shop recombination remains out of
  combat scope.
- Whetstone2 inherits Whetstone's start-of-battle linked-weapon damage bonus.
- White-Eyes Blue Dragon grants chain-scaled Block, Cold, and the opponent's
  effect-damage reduction in source order.

This is source-port evidence, not live-capture or complete 1:1 parity evidence.

## Axe, Bewitchment, Blood Amulet, Bloody Dagger, Broccoli, and Broccotree source-port audit (2026-10-04)

`scripts/sim-axe-bewitchment-blood-broccoli-smoke.mjs` covers both board owners
and the inherited/source lifecycle for all six rows:

- Axe uses the inherited Weapon cooldown path and applies its p1 permanent
  damage bonus on each successful early hit, including the current strike.
- Bewitchment caches affected Nature/Dark/Ice counts during `onPrepare`, spends
  one Mana only when available, distributes its base debuffs through the
  source's random least-stack selection, and rolls each affected type's
  configured poison/blind/cold bonus. It does not activate when the Mana gate
  fails.
- Blood Amulet grants source Vampirism and temporary maximum health at combat
  start. Bloody Dagger resets its Vampirism cap in `onPrepare`, adds source
  Vampirism on successful hits up to p2, and heals from linked Vampiric items.
- Broccoli inherits Food's +10% speed per linked food during preparation, then
  chooses Lucky or Regeneration from the source threshold. Broccotree keeps its
  source `onPrepare` override (no inherited Food speed), listens for positive
  Regeneration changes using base stamina regen, and checks Lucky after its
  per-cooldown grant.

The source inventory now records the exact six scenes/scripts. Hook parity,
call audit, and the focused smoke pass; this remains source-port evidence,
not live-capture or complete 1:1 parity evidence.

## Burning heat/charge wave source-port audit (2026-10-04)

`scripts/sim-burning-heat-charge-smoke.mjs` covers both board owners and the
source lifecycle for Burning Banner, Burning Coal, Burning Sword, Burning
Torch, Carrot Goobert, Cauldron, Chainsaw, Charge Splitter, Chili Pepper, and
Coil. The source inventory records the exact scene/script aliases.

- Burning Banner and Burning Sword cache their affected sets in `onPrepare`;
  Banner applies protection before combat and activates after strip/Regeneration,
  while Sword banks Heat into permanent damage for cached Empowerable targets.
- Burning Coal keeps its loose consume path and socketed weapon/armor hooks;
  Torch grants start Heat before activation and permanent damage only on a hit.
- Carrot Goobert uses the inherited peer-activation threshold rather than a
  timed cooldown, then cleanses, grants temporary Empower, and activates.
- Cauldron prepares linked Food/Potion speed and selects a non-repeating
  heal/Mana/Heat result. Chainsaw now uses the source fractional buff
  remove/steal operation in `onPreDealDamageEarly`, not a random three-stack
  approximation.
- Charge Splitter emits both explicit source charge paths and applies the
  per-cell buff-amplification stat. Chili Pepper's activation follows its
  Heat/heal/cleanse effects, and Coil resets on prepare, steals on each
  received charge, emits a VFX-only mini activation, and consumes at its cap.

This is source-port evidence, not live-capture or complete 1:1 parity evidence.

## Crossblades through Dragon Set source-port audit (2026-10-05)

`scripts/sim-crossblades-dragon-wave-smoke.mjs` now exercises both board owners
for all twelve AQ rows and asserts the extracted source files, registered
handlers, lifecycle hooks, effect values, and activation ordering:

- Crossblades, Cursed Hair Comb, Dark Lantern, Darksaber, Death Lotus, Deer
  Totem, Djinn Lamp, and Doom Cap use source-backed prepare/listener and
  cooldown sequencing, including actor-side filtering and lethal/reincarnation
  behavior where applicable.
- Double Axe, Draconic Orb, Dragon Knight, and Dragon Set cover their Rage,
  Heat, Crit, Reflect, cooldown-advance, weapon-strike, and full-set lifesteal
  paths. Dragon Knight's inherited `RubyWhelp.gd` lifecycle is represented
  explicitly rather than flattened into a generic skill port.
- Doom Cap, Djinn Lamp, and Dragon Set assertions verify that effects are
  applied before the source activation event. Dragon Set and Deer Totem also
  verify cooldown locking outside Rage.

The parity inventory records these rows as the AQ source-port wave. This is
source-port evidence from the extracted scripts and focused deterministic
fixtures, not live-capture or complete commercial 1:1 evidence.

## Emerald Whelp through Gingerbread Man source-port audit (2026-10-05)

`scripts/sim-emerald-ginger-wave-smoke.mjs` exercises both board owners for
all ten AR rows and asserts the exact extracted source aliases, registered
handlers, prepare/combat-start lifecycle, resource gates, effect ordering,
activation/consume state, and event-visible damage or stamina changes.

- Emerald Whelp, Flame Badge, Fly Agaric, and Gingerbread Man now follow their
  source start/cooldown ordering and inherited Food.prepare link speed.
  Gingerbread uses the existing temporary max health projection and always
  activates even when its Luck/Heat/Mana gate is closed.
- Energy Conversion, Everburning, Fanfare, Flute, and Fortuna's Kiss perform
  prepare-time listener/stat work. Fanfare's Mana/Stamina operations target the
  opponent as `Item.gd` does, while Fortuna filters to `canModifyChance`
  targets rather than granting chance to every linked item.
- Flame Whip now mutates the live early `DamageResult` only after a successful
  hit roll, preserving Spikes on misses and retaining the source's unrounded
  bonus. The shared damage path now exposes the rolled amount to early hooks;
  the change is covered by the focused miss/hit regression.

The parity inventory records these rows as the AR source-port wave. This is
source-port evidence from the extracted scripts and focused deterministic
fixtures, not live-capture or complete commercial 1:1 evidence.

## Halberd through Null Blade source-port audit (2026-10-05)

`scripts/sim-halberd-null-blade-wave-smoke.mjs` validates both board owners,
the exact resolved extracted scripts, handler registration, source lifecycle,
and visible state/event ordering for all eighteen AS rows.

- Halberd now performs its Block-power and affected-cell cache work during
  prepare, then removes opponent Block in the source late-damage phase before
  granting any unused amount to its owner. Magic Torch, Molten Dagger, Molten
  Spear2, and Null Blade apply their source early-damage bonus to the current
  successful hit as well as the persistent item stat.
- Heart Container, Leaf Badge, Light Flower, Lucky Bow, Mananana, Level Up,
  Laboratory, and Molten Spear2 use their source prepare/pre-combat hooks.
  Ice Armor, Light Flower, Level Up, and Moon Armor activate after their
  corresponding source effects rather than before them.
- Hero Sword, Just Stats, Lucky Clover, and More Stats retain their source
  combat-start semantics. Existing start-priority support keeps Just Stats and
  More Stats at the source Low priority.

This is deterministic source-port evidence from the extracted GDScript and
focused simulator regression, not live-capture or commercial 1:1 evidence.

## Pan through Pot source-port audit (2026-10-05)

`scripts/sim-pan-pot-wave-smoke.mjs` exercises both board owners for Pan,
Phoenix, Piggy of Riches, Piggybank, Poison Dagger, Poison Grenade, Poison
Shortbow, and Pot. It asserts each extracted source alias, handler resolution,
lifecycle timing, source-visible state, and event order.

- Pan applies its Food-affect damage during `onPreCombatStart`; Phoenix now
  registers its own-character damage listener during `onPrepare`, reincarnates
  only once, spends all Heat, and logs the weapon activation after its strike.
- Piggy of Riches counts socketed gems while Piggybank counts affected
  start-of-battle items; both grant maximum health and consume at combat start.
- Poison Dagger retains its source Poison hook and now inherits Dagger's
  prepare-time free attack when the opponent is stunned. Poison Shortbow keeps
  the source chance/random-debuff branch.
- Poison Grenade and Pot set up their Lucky/potion listeners in `onPrepare`,
  before cooldown arming. Grenade advances from received charge and consumes
  after its two Poison grants; Pot prepares Food/Potion speed, heals on a
  linked potion trigger, then grants Heat/Regeneration and consumes.

This is deterministic source-port evidence from the extracted GDScript and
focused simulator regression, not live-capture or commercial 1:1 evidence.

## Remaining sandbox gaps (AH 220)

Intentional / deferred vs commercial “1:1”:

| Gap | Notes |
|---|---|
| `chess_board` combat AI | Game has CD capture/move; sim **defers** (Phase **267**) |
| Shop / fuse / VFX | Out of combat scope |
| PvP / ranked opponents | Sim is still a fixed dummy AI — live captures are PvP; opponent HP not comparable yet |
| Rare EventTypes / LOG_* | Band R / log chrome |
| Live `live.*` fill-in | Phase **265** ingest; paste a real fight — history.db has no end HP |

Public marketing of “1:1 combat” still needs **Band F Phase 38** (Phase **270** closed the numbered ladder without claiming 1:1; [`sim-ip-marketing.md`](sim-ip-marketing.md)).

## Legal

Validation for personal/fan use is fine. Shipping paid “1:1 combat” needs Phase 38 IP review — see [`sim-phases.md`](sim-phases.md) Band F.
