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
| Wand of Dissonance misses its prepare-time affected-Dark effect-damage factor | Package 4 item-port wave | `Items/Exclusive/WandofDissonance.gd` | P1 | Preserve affected-item set and factor in a focused player/opponent fixture with event/log/meter proof. |
| Rib Saw Blade misses retained enemy-weapon setup for its early damage purge | Package 4 item-port wave | `Items/RibSawBlade.gd` | P1 | Source-led retained-target fixture proving purge order, both sides, and combat-log output. |
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
| `onPreDealDamage_late` loop | **Ticket** | stones/spears still `weaponStrike` `beforeDeal`; not a second Core loop |
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

Band AH: `npm run sim-parity-fixtures` + harness `PARITY_PCT_FLOOR`. Inventory `depth` ≠ coverage `fidelity: parity` — parity ids are fixture-backed (`parityIds` in `sim-parity-inventory.json`).

Combat log smoke: `npm run sim-log-smoke`.

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
