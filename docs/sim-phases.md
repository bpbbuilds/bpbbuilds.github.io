# Solo combat sandbox — phase roadmap

Canonical tracking for `/sim/`. Product summary: [`sim.md`](sim.md). Game audit: [`sim-combat-audit.md`](sim-combat-audit.md).

**Ship order:** A–AO are **history**. **AP–AS numbered phases (243–270) are closed** as a ladder — that is **not** engine 1:1. Leftovers: live `live.*` fills, `chess_board` AI, leftover staple `paramChecks`, Band F **38**. Visual chrome is Bands E / Q.

**Finish line (engine, not pixels):** Load **any** placeable board on `/sim/` (`?slug=` or create draft). Same seed, same round, vs training dummy → **same combat** as `tools/game-extract-full` GDScript: item scripts, adjacency, sockets **and** loose gems, charge, consume, stamina, miss/crit, buffs, DoT/HoT, fatigue, vampirism/unhealing math. People will not trust a sim that loses a dump against the live game.

**North stars (do not drop):**
1. **Every combat item follows its `.gd`** — no generic `cd_lucky` / `basic_cd` / start-stack template standing in for a unique. Source: `Items/**/*.gd` + catalog.
2. **Combat rules 1:1 with game GDScript** — family templates are scaffolding only; AP–AS burn them down.
3. **Combat HUD** stays **1:1 with in-game panels** (info architecture): Health, Stamina, Buffs / Debuffs with stack counters — Band E.
4. **Combat Log + Damage Dealt UI** — visual 1:1 is Band Q (done). Engine *events* that feed it must still match `.gd` (AP–AS).

**Fidelity ladder (per item):** `stub` → `reviewed` / **solid** (HAND or pattern *claimed*) → **`parity`** (AH fixtures) → **`engine-1:1`** (AP–AS: dedicated port = `.gd` combat hooks; dump / live fight agrees).

**Coverage / solid / parityPct ≠ engine 1:1.** AO “catalog complete” means every id has *a* handler. Generic auto-patterns and false-deep HAND ports still lie. True any-build accuracy is **Band AP–AS** below.

Do one band at a time. Deferred: mobile layout, Discord, content seeding, PvP boards.

```bash
npm run sim-catalog   # inventory → dedicated stubs → coverage
npm run sim-harness
```

---

## Band A — Foundation (Phases 1–5)

- [x] **1 — Game file audit** — [`sim-combat-audit.md`](sim-combat-audit.md) + `SimEvent` vocabulary
- [x] **2 — `/sim/` page shell** — board, dummy, scrubber chrome, Demo banner
- [x] **3 — Board load paths** — `?slug=` + create draft
- [x] **4 — Play entry points** — build action row + create toolbar
- [x] **5 — Demo timeline + docs** — ~30s demo generator; [`sim.md`](sim.md) + this file

---

## Band B — Core engine (Phases 6–15)

- [x] **6 — Engine seam** — `runSim(...) → { events, summary }`; demo as `mode: 'demo'`
- [x] **7 — Tick clock + fight window** — ~30s cap; `?seed=`; combat delay 2.5s; tick / fight_end
- [x] **8 — Actor stats shell** — player + dummy HP / stamina / block (+ sparse snapshots)
- [x] **9 — Stamina economy** — costs, regen, fail-to-activate
- [x] **10 — Cooldown machine** — base CD loop; activate / cooldown events
- [x] **11 — Basic damage pipeline** — min/max, accuracy, block absorb
- [x] **12 — Pre-combat / start-of-battle** — armor block grant + regen stub
- [x] **13 — Buff / debuff runtime** — Block, Regeneration, Poison (core)
- [x] **14 — Dummy AI v1** — timed auto-attack vs player
- [x] **15 — Engine UI badge** — Engine (partial) + coverage + Demo/Engine toggle

---

## Band C — Combat systems (Phases 16–25)

- [x] **16 — Adjacency during combat** — board graph + canAffect / neighbor links
- [x] **17 — Gems / sockets** — gem mods on host; gem rows fetched with board
- [x] **18 — Armor / shield / block depth** — start block, flat DR, spikes reflect
- [x] **19 — Lifesteal / heal** — vampiric items + vampirism stacks
- [x] **20 — DoT / HoT families** — poison / heat / regen ticks
- [x] **21 — On-hit / trigger priorities** — rarity priority sort + effect-hint procs
- [x] **22 — Cards / decks** — card pieces + deck bonus chain
- [x] **23 — Pets / summons** — pet kind with own CD attacks
- [x] **24 — Spells / scrolls / consumables** — one-shot / charge consumables
- [x] **25 — Combat log parity + export JSON** — category filters + download run

---

## Band D — Item script porting (Phases 26–32)

- [x] **26 — Inventory + tooling** — `extract-sim-item-inventory.mjs`, `sim-item-coverage.json`, `sim-harness.mjs`
- [x] **27 — Top weapons** — `basic_cd` / `double_strike` / `poison_weapon` handlers
- [x] **28 — Class staples** — family defaults + overrides (axe, katana, hero_longsword, …)
- [x] **29 — Synergy engines** — `empower_aura`, `speed_aura_double` (neighbor links)
- [x] **30 — Unique / legendary outliers** — falcon_blade, bloodthorne family, phoenix/pet_strike
- [x] **31 — Food / potions / start relics** — `start_regen`, `start_max_hp`, `start_spikes`
- [x] **32 — Coverage milestone** — coverage file ≥80% scripted or catalog_fallback (harness)

---

## Band E — Product polish + combat HUD (Phases 33–37)

- [x] **33 — Combat HUD 1:1 (game panels)** — Health / Stamina bars + **Buffs / Debuffs stack counters** (icons + counts), dual fighter layout with VS; scrubber seeks snapshots
- [x] **34 — Visual fight pass** — activation ring VFX, hit flash, buff/debuff floats; playback **1× / 2× / 4×**; class name banners + progress-bar textures
- [x] **35 — Save / compare runs** — localStorage summaries; pick a saved run → Compare end HP / damage / activates
- [x] **36 — Entry polish** — deep-link `?slug=&seed=&mode=&t=&speed=`; Copy link; URL sync while scrubbing (nav still optional / not public)
- [x] **37 — Validation vs live game** — checklist + known-delta table in [`sim-validation.md`](sim-validation.md) (feeds Band G)

---

## Band F — Monetize / legal (Phases 38–40)

- [ ] **38 — Legal / IP review** (go/no-go before paywall)
- [ ] **39 — Auth gate for full runs** — free short preview vs signed-in full 30s
- [ ] **40 — Membership / Stripe** (only if 38 is go; never auto-OP from sim)

---

## Band G — GDScript 1:1 parity track (Phases 41+)

Family handlers (Band D) are **not** the end state. This band is the long climb toward real script parity while the HUD (Band E/33) stays the truth display for stacks.

- [x] **41 — Handler fidelity audits** — appendix [`sim-handler-audit.md`](sim-handler-audit.md) (family + dedicated ports vs `Items/*.gd`)
- [x] **42 — Param wiring** — `engine/params.js` (`getP` / `getP1`…); pieces carry `params`; handlers/ports prefer `getP*` over magic numbers
- [x] **43 — Stack rules (foundation)** — `stacks.js` gain/resist/reflect/caps; Block via stacks; Heat is buff (no free onTick burn). Still open: temp stacks, cleanse protection
- [x] **44 — dealDamage pipeline (foundation)** — `damage.js` miss→crit→%DR→flat DR→block→HP→spikes; vamp on deal. Still open: EventBus hooks, fatigue, crit tokens, invuln
- [x] **45 — Dedicated ports (first wave)** — `broom`, `banana`, `poison_bow`, `hero_longsword`, `falcon_blade`, `healing_herbs` in `scripts/ports.js` (many items still `basic_cd`)
- [x] **46 — Parity harness baseline** — unit checks + fixture handler signatures in `sim-harness.mjs` (live-game end-HP bands still manual via [`sim-validation.md`](sim-validation.md))
- [x] **47 — HUD stack completeness** — temp stacks on HUD via Phase **159** (remaining EventTypes still open when ported); Heat already on buff row

Success for G: foundations exist; full catalog is **Bands H–P**.

---

## Band H — Full-catalog factory (Phases 48–50)

Goal: **every** inventory combat item has `handlerId === itemId` (dedicated), even if body is still a template stub.

- [x] **48 — Port registry + generator** — `npm run sim-ports` → `assets/data/sim-port-registry.json` + `scripts/dedicated/band-*.js`
- [x] **49 — Coverage semantics** — status `dedicated` / `family` / `catalog_fallback`; totals for stub vs reviewed
- [x] **50 — Registry resolve order** — reviewed `ports.js` → dedicated stubs → family default (legacy)

Milestone: dedicated ≈ 100% of placeable combat-override items (skip base scripts like `weapon`).

---

## Bands I–O — Pattern review of all combat overrides (Phases 51–90)

Shipped via `npm run sim-auto-ports` (`scripts/build-sim-auto-ports.mjs` + `auto-patterns.js` + hand `ports.js`).

Every inventory combat item is **dedicated + reviewed**. Coverage splits:

| Fidelity | Meaning |
|---|---|
| `reviewed` (solid) | Matched a concrete GDScript pattern (weapon CD, on-hit stack, aura, start grant, food, …) |
| `reviewed_approx` | Fallback activate / inherit Weapon CD / best-effort grant — **not** full `.gd` fidelity yet |

- [x] **I — Core weapons** — basic_cd / precombat link damage / hand ports
- [x] **J — On-hit** — poison/heat/blind/vamp/perm-bonus patterns + Weapon-inherit fallback
- [x] **K/L — Custom CD** — mana/lucky/regen/heat/cold/poison/food + `cd_activate` approx for uniques (chess_board, battery, …)
- [x] **M — Synergy auras** — damage/speed aura patterns + gloves_of_haste hand port
- [x] **N — Start / pets / food** — regen/maxHP/spikes/vamp/block/mana/heat/lucky + pet_strike
- [x] **O — Uniques** — covered by pattern + approx; hardest called out in [`sim-handler-audit.md`](sim-handler-audit.md)

Harness: `npm run sim-harness` requires **100% reviewed** (solid + approx).

---

## Band P — Catalog staples + closeout (Phases 91–96)

- [x] **91 — Catalog staples** — `wooden_buckler`, `leather_armor`, `gloves_of_haste`, `leather_boots` ports
- [x] **92 — Coverage / registry** — no `family` catch-all left for combat overrides; catalog staples dedicated
- [x] **93 — Stub → reviewed sweep** — registry reviewedPct = 100%
- [ ] **94 — Parity fixtures** — OP boards + end HP bands (live-game) — see Band AH + [`sim-validation.md`](sim-validation.md)
- [x] **95 — Raise approx → solid** — **superseded / shipped** as Band AC–AE Waves A–D (solid **100%**, floor **100**). Remaining work is **reviewed → parity**, not approx→solid.
- [x] **96 — Phase 47 HUD temp stacks** (shipped as **159**); CI gate on `npm run sim-catalog` still deferred (no GH Actions workflow yet)

**Bands I–P done means:** every placeable combat item has a dedicated handler and is at least pattern-reviewed. Approx→solid finished under AC–AE. Fixture `parityPct` = AF–AH. **Any-build engine 1:1 = Band AP–AS.**

---

## Band Q — Combat Log UI 1:1 (Phases 97–104)

**Goal:** `/sim/` post-fight log matches the game’s **Combat Log** + **Damage Dealt** panels (screenshot / `Interface/CombatLog/*` + `Interface/DamageMeter/*` + `Core/CombatLog.gd`).

Phase **25** only shipped category chips + JSON export — **not** this UI. Do not reopen 25; build Q on top of `sim-scrubber.js` / `SimEvent[]`.

**Sources of truth**
- Logic: `tools/game-extract-full/Core/CombatLog.gd`, `CombatEvent.gd`
- UI: `tools/game-extract-full/Interface/CombatLog/*`, `Interface/DamageMeter/*`
- Copy keys: `Sheets/CSV/Interface.csv` (`LOG_*`)
- Icons: `assets/icons/status/buff/*` (inline); extract Play/stylebox art → `assets/icons/sim/log/` when needed
- Scroll: site gold scrollbar (`assets/icons/scrollbar/*`)

**Layout target (desktop):** left **Damage Dealt** (meters + cumulative plot) · right **Combat Log** (filters + lines). Scrubber time cursor shared.

- [x] **97 — Chrome** — dual panels, parchment frame, Baskerville, gold scrollbar (`sim-combat-results.js` + CSS)
- [x] **98 — Row skin** — You cream / Opponent crimson; activation fade; `X.XX:  ` timestamps
- [x] **99 — Sentences + icons** — `LOG_*`-shaped lines + inline stack icons (`sim-log-sentences.js`)
- [x] **100 — Filters** — You / Opponent minimize stubs; Hide→Minimize→Show activations; Search
- [x] **101 — Log replay** — play / step / pause in log toolbar → scrubber clock
- [x] **102 — Damage Dealt meters** — source % bars + totals + rate/s; board highlight
- [x] **103 — Damage graph** — cumulative SVG plot + time cursor + sync arrow
- [x] **104 — Line scrub** — click log line / graph seeks `t`; bag highlight (`sim-fx.js`)

**Harness / checks (as phases land)**
- Snapshot test: fixed seed board → N visible lines under default filters (activations hidden)
- Meter totals: Σ damage by `itemId` equals sum of `damage` events
- Graph cursor `t` equals scrubber `t` within one step (0.05s)

**Out of Band Q (later):** full localized `LOG_*` catalog, parent/child indent depth, every DamageMeter metric dropdown (Heal / Stamina / stacks / Misses / Blocked) — Band R + polish.

---

## Band R — Log event fidelity (Phases 105–110)

**Goal:** event *data* and *sentences* match `CombatEvent.asText` / EventBus depth — so the Q UI is not just skinned ad-hoc labels.

- [x] **105 — Event fields** — `SimEvent.meta` documents `stack` / `parentId` / `eventId` / `depth` / `critical`; JSON export unchanged
- [x] **106 — `LOG_*` sentence map** — `sim-log-sentences.js` (damage, crit, miss, gain/lose buff+icon, heal, stamina, activate, round win/lose)
- [x] **107 — Child / trigger indent** — depth from `meta.parentId` / `meta.depth` → `"  > "` prefix
- [x] **108 — Activation policy** — activation lines filtered; default **Hide** matches game
- [x] **109 — Meter metrics expand** — dropdown: Damage Dealt, Heal, Stamina, Activations, Block…Cold (`sim-meter-metrics.js`)
- [x] **110 — Parity smoke** — `npm run sim-log-smoke` (sentence + damage totals); live-game side-by-side still via [`sim-validation.md`](sim-validation.md)

**Band Q+R done means:** `/sim/` shows Combat Log + Damage Dealt chrome like the game (filters, graph sync, sentence shape). Engine truth still climbs via Phases 94–95 / 47. Meter metric dropdown = Phase 109 leftover.

---

## Band S — Engineer charge board FX (polish)

**Goal:** Battery (and later Generator / Splitter / Cog Badge) charge sparks match `ElectricalCharge.gd` — scrubbable cell-to-cell travel, charged tiles, emit/receive pulses, haste applied when the spark enters a cell.

- [x] **S1 — Charge art** — `assets/fx/charge/` (`GlowingDot`, `CircleLight`, `ChargedTile`, `Electricity1.ogg`)
- [x] **S2 — Path math** — `engine/charge-path.js` (mid→center→mid waypoints, enter schedule, `dur` 2s/tile → 8s Battery)
- [x] **S3 — Timed engine events** — `batteryPort` emits `charge` + deferred `pendingHasteAt` haste in `simulate.js`
- [x] **S4 — Seekable spark layer** — `sim-charge-fx.js` wired via `sim-fx.js` seek / flashEvent
- [x] **S5 — Log + smoke** — `charge` hidden as log noise; `npm run sim-charge-smoke`

**Out of Band S (later):** full Zap shader, Generator/Splitter dual paths, combat-log charge replay UI.

---

## Band T — Tesla Coil combat 1:1

**Goal:** Tesla Coil matches `Exclusive/TeslaCoil.gd` — collect charges from ElectricalCharge cell enters, spend them advancing ally CDs (★ `hasCooldown` first, then other CD items) by `cdadvance` (3s). No dummy damage. Shop weight/sale out of scope.

- [x] **T1 — Charge-receive bus** — Battery cell enter → `deliverCharge` / `onChargeReceived` (`charge-delivery.js`)
- [x] **T2 — `advanceCooldownSeconds`** — wall-clock CD advance + activate re-entry guard (`cooldown.js`)
- [x] **T3 — `teslaCoilPort`** — prepare queue, collect, spend batch, live advances (`ports-mech.js`)
- [x] **T4 — Board pulses** — receive / advance via `sim-fx.js` (LargeZap stand-in = pulse)
- [x] **T5 — Smoke** — `npm run sim-tesla-smoke`

**Out of Band T (later):** Resistor/Robodog/etc. full `onChargeReceived`, Zap shader, shop mods, build UI.

---

## Band U — Live tip stats + piece mutators (Phases 111–116)

**Goal:** Tooltip Damage / Cooldown / Accuracy rows show combat-modified values (no “Live:” effect blurb).

- [x] **111** — Remove Live blurb (`sim-live-item.js`)
- [x] **112** — Piece `speedScale` / `bonusDamage` / `bonusAccuracy` / `baseCooldown` (`pieces.js`, `piece-stats.js`)
- [x] **113** — Heat−Cold ×2% + speedScale in `modifiedCooldown`; wall-clock CD in `simulate.js`
- [x] **114** — Tip Damage (+Empower) / Accuracy (+Luck−Blind×5)
- [x] **115** — Rich `pieceSnapshots` via `snapshotPieceStats`
- [x] **116** — `npm run sim-spotlight-smoke`

---

## Band V — Bag insides (Phases 117–121)

- [x] **117** — Bag hosts in `buildCombatPieces` (kind `bag`, no CD loop)
- [x] **118** — `getItemsInside` (`board-graph.js`)
- [x] **119** — Shared `addSpeed` mutator (`piece-stats.js`)
- [x] **120** — Fanny Pack port (`FannyPack.gd`)
- [x] **121** — Spotlight smoke covers fanny speed

---

## Band W — Buff economy bus (Phases 122–127)

- [x] **122–126** — `buff-economy.js`: `useLucky`, `grantStacks`, `giveMostBuffs`, `giveLeastBuffs`, `onBuffChanged`, thresholds
- [x] **127** — Exercised by Miss Fortune / Toad / Enchanted Weapons / spotlight smoke

---

## Band X — Spotlight ports (Phases 128–133)

- [x] **128** — Miss Fortune (`miss_fortune`)
- [x] **129** — Toad (replace false `cd_mana`)
- [x] **130** — Oil Lamp
- [x] **131** — Fanny Pack (Band V)
- [x] **132** — Hand list + `npm run sim-auto-ports` (solidPct ~40%)
- [x] **133** — `npm run sim-spotlight-smoke`

---

## Band Y — `cd_activate` long tail (Phases 134–145)

Batch tracker: [`sim-port-batches.md`](sim-port-batches.md). Harness floor was **60** after Y; raised to **70** in Wave A (AC).

- [x] **134** — Buff converters wave 1 (`ports-buff.js` + `giveRandomBuffs` / `removeMostBuffs`; `npm run sim-buff-smoke`)
- [x] **135–143** — Theme batches (`ports-luck` / `mana` / `heat` / `aura` / `threshold` / `pet` / `skill` / `consumable`; `npm run sim-band-y-smoke`)
- [x] **144** — Classifier cleanup + deferred outliers (`ports-outliers.js` / `ports-outliers-board.js`)
- [x] **145** — solidPct floor gate in `sim-harness.mjs` (raised to **60** after 144)

---

## Band Z — Pattern depth (Phases 146–155)

- [x] **146** — Buff-change listeners (Toad / `onBuffChanged`) — foundation shipped
- [x] **147** — Temporary stacks (`temp-stacks.js` + `grantTemporaryStacks` / tick in `simulate.js`)
- [x] **148** — Fatigue clock (`fatigue.js`; damage after `COMBAT_DELAY + 17s`)
- [x] **149** — `ScriptHandler.onDealtDamage` via `dealHit` / default weapon path
- [x] **150** — Thin `combat-bus.js` (`fatigue_start` / `fatigue_tick` / `piece_activated`)
- [x] **151** — Food depth (`food-helpers.js`; banana consume labeling)
- [x] **152** — Aura filters (`canBeEmpoweredPiece` on Oil Lamp–family)
- [x] **153** — On-hit depth (`eggscalibur` mana/food via `onDealtDamage`)
- [x] **154** — Temp-stack pilots (`carrot_goobert`, `electric_torch`, `scissorswords`)
- [x] **155** — `npm run sim-band-z-smoke`; docs; floor stays **60** (solidPct still ~69%; next ratchet 70)

Harness stayed at floor **60** after Band Z; Wave A (AC) raised solid to **70%** and floor to **70**.

---

## Band AA — Tip + HUD polish (Phases 156–160)

- [x] **156** — Tip DPS `/s` follows modified damage÷CD (tooltip.js)
- [x] **157** — No remaining-CD Live blurb
- [x] **158** — Tip refresh throttle on seek (`page.js`)
- [x] **159** — HUD temp stacks (was 47/96): `snapshotActor.temp` + scrubber countdown on stack chips
- [ ] **160** — Live-game note sheet in [`sim-validation.md`](sim-validation.md)

---

## Band AB — Validation & CI (Phases 161–168)

- [x] **161 / 164** — Spotlight fixtures + `npm run sim-spotlight-smoke`
- [x] **163** — Mana attribution via real `itemId` events (Toad/Miss Fortune)
- [x] **162 solidPct ratchet** — floors **70→80→90→100** via Waves A–D (shipped)
- [ ] **165–168** — End-HP bands; CI job; re-extract discipline

---

## Band AC–AE — Remaining catalog → solid 100% (Phases 169–185)

Batch / ratchet table: [`sim-port-batches.md`](sim-port-batches.md). Measure: `npm run sim-harness` / `npm run sim-catalog`.

**Baseline (was):** solid ~**69%** · **108** approx · floor **60**.  
**Shipped goal:** solid **100%** and harness floor **100** — **done** (Waves A–D).  
Catalog HAND through **AO** is also **done**. AP–AS numbered work closed at **270** without claiming engine 1:1.

### Inventory

- [x] **169** — Classify remaining approx by pattern (`sim-auto-ports.json` / `sim-item-coverage.json`): buckets noted in [`sim-port-batches.md`](sim-port-batches.md)
- [x] **170** — Hard-defer list current: `chess_board`, `magic_ring`, `magic_mirror`, `perpetuum_mobile`, `plastic_cube`, `repeater`, `slime_time` (+ alchemy `potion_emptied` if still deferred)

### Waves (raise solid%, then floor — never bump floor above measured solidPct)

- [x] **AC / Wave A (171–173)** — Easy leftovers (`cupcake`, `pineapple`, `flame`, `lucky_piggy`, `protective_purse`, `holdall`); solid **70%**; `SOLID_PCT_FLOOR` → **70** (`npm run sim-wave-a-smoke`)
- [x] **AD / Wave B (174–177)** — Aura / start / heal / cold HAND ports (~34); solid **80%**; floor → **80** (`npm run sim-wave-b-smoke`)
- [x] **AE / Wave C (178–181)** — On-hit / spear / mana / scale weapons (~34); solid **90%**; floor → **90**; Engine banner at ≥90 (`npm run sim-wave-c-smoke`)
- [x] **AE / Wave D (182–185)** — Last 34 approx (gooberts/crowns/hard weapons/board); solid **100%**; floor → **100** (`npm run sim-wave-d-smoke`); `chess_board` intentional noop HAND

### Habits each wave

- Prefer HAND ports in `ports-*.js` + `HAND` in `build-sim-auto-ports.mjs`, then `npm run sim-auto-ports`
- Smoke + harness green before each floor bump; update [`sim-port-batches.md`](sim-port-batches.md) status column

---

## Band AF–AH — GDScript parity 1:1 (Phases 186–220)

**Goal (this band, shipped):** climb **`parityPct`** + sandbox fixtures. Did **not** finish any-build 1:1 — leftover generic auto-patterns and dump-found script bugs are **AP–AS**.

Batch tracking: [`sim-port-batches.md`](sim-port-batches.md) · live notes: [`sim-validation.md`](sim-validation.md) · audits: [`sim-handler-audit.md`](sim-handler-audit.md).

**Definition of `parity` (per item):** port matches the item’s combat `.gd` hooks used in a training fight (start / prepare / CD / on-hit / peer / charge as applicable); params via `getP*`; called out gaps only for shop/fuse/VFX; at least one fixture note or smoke assert.

### AF — Engine systems that unlock many ports (186–195)

Ship systems before deepening dozens of shallow HAND ports. **Shipped.**

- [x] **186 — Parity inventory** — [`sim-parity-inventory.json`](../assets/data/sim-parity-inventory.json) + table in [`sim-port-batches.md`](sim-port-batches.md)
- [x] **187 — Coverage `parity` / `parityPct`** — harness prints `parityPct` (floor deferred to AH 216)
- [x] **188 — Invuln polish** — `invulnCharges` + `consumeInvulnHit`; crowns / king_goobert wired
- [x] **189 — Buff-protect stacks** — `hostileStrip` in spend/steal/`removeRandomBuffs`; `grantBuffProtect`
- [x] **190 — Stun as combat state** — `grantStun` / `stunnedUntil`; skips piece CD + dummy swing
- [x] **191 — Goobert peer counters** — activation count → heal/buffs via `onPeerActivated`
- [x] **192 — Charge emit completeness** — `emitChargePulse`; staff / drake / gigawatz / chainsaw receive
- [x] **193 — Dummy / training AI pass** — CD 2.15s / 13 dmg / 88% acc (documented in validation)
- [x] **194 — Damage / EventBus hooks audit** — gap table in [`sim-validation.md`](sim-validation.md)
- [x] **195 — AF smoke** — `npm run sim-parity-systems-smoke`

**Next:** AH 211 (AF + AG complete).

### AG — Deepen shallow HAND → `.gd` parity (196–210)

Work in theme batches (~8–12 items). Source of truth: matching `.gd`. Prefer deepening existing `ports-wave-*.js` / theme modules over new approx patterns. **Shipped.**

- [x] **196–197 — Gooberts + crowns** — peer-only gooberts; crown mana→once invuln; king protect/heal CD
- [x] **198–199 — Wave D hard weapons** — util imports + `.gd` secondary hooks; path `sendCharge`; timed speed
- [x] **200–201 — Wave D uniques** — refund/aura/phase deepen
- [x] **202–203 — Board set** — ring/mirror/cube/repeater/slime; **`chess_board` permanent noop**
- [x] **204–206 — Wave C weapon depth** — on-hit / spear / mana / scale secondary hooks
- [x] **207–208 — Wave B aura / heal / start depth** — combat hooks; shop omitted
- [x] **209 — Spotlight / Band X revisit** — Miss Fortune / Toad / Oil Lamp / Tesla / Fanny / Enchanted
- [x] **210 — AG milestone** — inventory mostly `deep`; `npm run sim-ag-smoke`; next = AH 211

**Next:** fill fixture `live.*` from training fights (AF + AG + AH scaffolding complete).

### AH — Live-game fixtures + ratchet (211–220) [= Phase 94 expanded]

**Shipped** (sim-baseline bands; `live.*` fill-in still upgrades).

- [x] **211 — Fixture board set** — 8 boards in [`scripts/fixtures/parity/`](../scripts/fixtures/parity/) (`npm run build-parity-fixtures`)
- [x] **212 — Capture protocol** — [`sim-validation.md`](sim-validation.md) Band AH section
- [x] **213 — First HP bands** — `npm run sim-parity-fixtures` (+ `--write-bands`)
- [x] **214 — Tighten bands** — ±10% / min width 15; harness runs fixtures
- [x] **215 — Mark `parity` in coverage** — `parityIds` via `scripts/sync-parity-ids.mjs`
- [x] **216 — `PARITY_PCT_FLOOR`** — harness floor (final **90**)
- [x] **217–218 — Ratchet waves** — fixtures → deep → hand modes (`sync-parity-ids`)
- [x] **219 — Parity ≥75%** — Engine banner “fixture-validated subset” at parity ≥75
- [x] **220 — Parity ≥90% sandbox** — floor 90; gaps + Phase 38 note in validation

**Next:** fill fixture `live.*` from training fights; Band F Phase 38 before public “1:1”.

### AI — HAND shallow → deep (221–232)

**Shipped** (HARD leftovers closed in Band AJ). `chess_board` noop.

- [x] **221 — Docs + checklist** — Band AI in phases + living id list in [`sim-port-batches.md`](sim-port-batches.md)
- [x] **222 — `sim-ai-shallow-count`** — fail if shallow > 0 (unless `--allow-gaps`)
- [x] **223 — Wave AI-A** — Food / Potion / consumables
- [x] **224 — Wave AI-B** — Armor / Helmet / Shield / Shoes / Gloves (5 HARD gaps)
- [x] **225 — Wave AI-C** — Pets
- [x] **226–227 — Wave AI-D** — Accessories / amulets / badges (2 HARD gaps)
- [x] **228 — Wave AI-E** — Skills / Spells / Books (1 HARD gap)
- [x] **229 — Wave AI-F** — Bags / Gems / weapons / misc (1 HARD gap)
- [x] **230 — Gates** — fixtures re-baselined + harness green
- [x] **231 — Shallow burn-down** — 113 → 9 HARD gaps (documented)
- [x] **232 — Mark AI shipped** + morning handoff

**Habits:** read `.gd` before marking deep; gap > fake deep; file ≤500 lines (new `ports-ai-*.js`).

### AJ — HARD gaps → shallow 0 (233–242)

**Shipped** — HAND depth deep=235 / shallow=0 / noop=1 (`chess_board`).

- [x] **233 — Docs** — Band AJ phases + HARD checklist
- [x] **234 — Timed %DR + crit/stun resist** — `grantTimedResistancePct` + actor fields
- [x] **235 — Wave AJ-S** — `resistor`, `leather_boots`
- [x] **236 — Wave AJ-M** — `leather_helm`, `evil_cap`, `shiny_mantle`
- [x] **237 — Battle rage API** — `startBattleRage` + bus
- [x] **238 — Wave AJ-rage** — `extra_angy`, `toolbox`
- [x] **239 — Shield afterBlock** — chance-block pipeline in `damage.js`
- [x] **240 — Wave AJ-shield** — `wooden_buckler`
- [x] **241 — `mr_struggles` deepen**
- [x] **242 — Shallow = 0** + mark AJ shipped

Engine: [`timed-resistance.js`](../js/pages/sim/engine/timed-resistance.js), [`battle-rage.js`](../js/pages/sim/engine/battle-rage.js); ports: [`ports-ai-hard.js`](../js/pages/sim/engine/scripts/ports-ai-hard.js).

### AK — bags / potions / shop junk (+ gem & chess noops)

**Shipped.** Extract now counts potion consume + combat bag prepare/stamina. Catalog potions/bags/shop junk/gems/chess are HAND (deep or explicit noop). Weapons/pets/combat accessories/skills remain later plans.

- [x] **AK-1 — Widen extract** — `onTriggerPotion` / `consumePotion` / potion `onDamaged`; bag `onPrepare` / stamina `addToInventory`; skip `Animations/`
- [x] **AK-2 — Triage** — 16 potions consume; combat bags deep; shop/storage bags + shop junk + 29 gems + 12 chess pieces noop
- [x] **AK-3 — Potion ports** — reuse health/heroic; rest in `ports-ak-potions.js`
- [x] **AK-4 — Bag ports** — `ports-ak-bags.js` (stamina / bagtacular / insides)
- [x] **AK-5 — Noops** — `ports-ak-noop.js`
- [x] **AK-6 — Gates** — HAND + parity depths; fixtures + harness

### AL — remaining weapons (melee/ranged + weaponish)

**Shipped.** Catalog leftover weapons use `weaponStrike` plus `.gd` hooks. Artifact stones are 1-ammo strikers with affect-weapon side effects. Pets/accessories/skills stay later bands.

- [x] **AL-1 — Extract** — Weapon/Bow `onPrepare` / Dagger `prepare`
- [x] **AL-2 — Triage** — 17 leftover Melee/Ranged vs `.gd`
- [x] **AL-3 — Ports** — `ports-al-weapons.js` + `ports-al-stones.js`
- [x] **AL-4 — HAND + WAVE_AL_DEEP**
- [x] **AL-5 — Gates** — fixtures + harness + shallow-count

### AM — pets + leftover gooberts

**Shipped.** Catalog-missing pets plus leftover gooberts/pets that were auto-port only. Peer-activate gooberts reuse exported `goobertHeal` / `goobertPeerTick`. Accessories/skills/shields stay later bands.

- [x] **AM-1 — Extract** — Pet/Goobert/Toad `onPrepare` / `prepare`
- [x] **AM-2 — Gooberts** — `ports-am-goobert.js` (goobling alias + 8 variants)
- [x] **AM-3 — Pets** — `ports-am-pets.js` + `ports-am-eggs.js`
- [x] **AM-4 — HAND + WAVE_AM_DEEP**
- [x] **AM-5 — Gates** — fixtures + harness + shallow-count

### AN — accessories / sockets / armor

**Shipped.** Leftover accessories, gadgets, armor/boots HAND. Socket gems apply on host (weapon vs armor) via `gem-sockets.js`. Shop-only `hypercube` / `snowman` / `furcifer_prime` / `employee_uniform` stay combat noops. Skills/cards/shields/spells/books stay Plan 5.

- [x] **AN-1 — Extract** — Accessory/Armor/Gloves/Shoes `onPrepare` / `prepare`
- [x] **AN-2 — Sockets** — `gem-sockets.js` + `WAVE_AN_SOCKET` deep (not AK gem noops)
- [x] **AN-3 — Ports** — `ports-an-accessories.js` / `ports-an-gadgets.js` / `ports-an-armor.js`
- [x] **AN-4 — HAND + WAVE_AN**
- [x] **AN-5 — Gates** — fixtures + harness + shallow-count

### AO — skills / spells / books / leftover catalog

**Shipped as “every leftover id has HAND.”** Family books/skills HAND. **Not** engine 1:1 — auto `cd_*` / `basic_cd` / start-on-hit templates still exist (see AP).

- [x] **AO-1 — Extract** — Skill/Spell/Book/Shield/Card `onPrepare` / CD / afterBlock
- [x] **AO-2 — Ports** — `ports-ao-skills.js` / `ports-ao-cards.js` / `ports-ao-shields.js` / `ports-ao-spells.js`
- [x] **AO-3 — Leftover family auto-patterns**
- [x] **AO-4 — HAND + WAVE_AO_DEEP**
- [x] **AO-5 — Gates** — fixtures + harness + shallow-count

---

## Band AP–AS — Engine 1:1 ladder (Phases 243–270) — numbered work closed

Numbered phases are **done**. That is **not** “any build, dummy fight, combat agrees with GDScript.” Leftovers live in **Still open** below.

**Sources of truth:** `tools/game-extract-full/Items/**/*.gd`, `Core/*.gd`, catalog `scripts/_cache/game-items.json`. Audit dumps: `kind: "bpb-sim-debug"` vs [`.cursor/rules/sim-debug-audit.mdc`](../.cursor/rules/sim-debug-audit.mdc) · protocol: [`sim-debug-protocol.md`](sim-debug-protocol.md).

**Out of this ladder:** new visual FX, PvP opponent boards, shop/fuse-only scripts, Band F paywall. Shop/chess **noops** stay noops only if the game also does nothing in a training fight.

Measure: `AUTO_PORTS` pattern is not the runtime handler unless the `.gd` *is* that pattern; harness gate when 261 lands.

### AP — Replace generic auto-patterns (243–252)

Runtime still uses `auto-ports.js` `MAP` + `auto-patterns.js` for items **without** a winning `PORT_HANDLERS` entry. Those fights are family recipes (Leaf Badge was `cd_lucky` +2 with no activate).

Census: `npm run sim-inventory && npm run sim-ap-census` → tables in [`sim-port-batches.md`](sim-port-batches.md) + [`sim-ap-census.json`](../assets/data/sim-ap-census.json).

- [x] **243 — Living census** — generic `MAP` patterns **and** `cdThenConsume` (`onAfterEffectFinished` one-shots vs repeating `activate()`). Table in [`sim-port-batches.md`](sim-port-batches.md). Re-run `npm run sim-inventory && npm run sim-ap-census` after extract / MAP changes.
- [x] **244 — `cd_lucky` wave** — dedicated ports from `.gd`: `broccoli`, `broccotree`, `charge_splitter`, `flute`, `fortunas_kiss`, `leaf_badge` (HAND; existing port), `light_flower`, `ultima`, `wisp` (`ports-ap-lucky.js`). Consume one-shots: splitter / ultima / board wisp.
- [x] **245 — `cd_mana` / `cd_regen` waves** — dedicated ports in `ports-ap-mana.js` / `ports-ap-regen.js` (9 mana + 7 regen). Consume one-shots: board `emerald`, `pot`, `laboratory` phase 5.
- [x] **246 — `cd_heat` / `cd_cold` / `cd_poison`** — dedicated ports in `ports-ap-heat.js` / `ports-ap-cold.js` (6 heat + 4 cold + 3 poison). Consume: board `burning_coal`, `everburning`, `sapphire`, `poison_grenade`.
- [x] **247 — `basic_cd` uniques** — `phoenix`, `pumpkin`, `ruby_chonk`, `squirrel_archer`, `thorn_bow` (+ HAND `stone`). None were true Weapon CD; dedicated ports in `ports-ap-basic.js`. Census `trueWeaponCdTwins: []`.
- [x] **248 — Start-stack templates** — dedicated ports in `ports-ap-start.js` (+ HAND `piggybank`). None were grant-only twins: weapons still CD; Dark Lantern is % HP loss + reincarnate, not `+max HP`.
- [x] **249 — On-hit + perm-bonus templates** — dedicated ports in `ports-ap-perm.js` / `ports-ap-onhit.js`. Combat-start sort uses `getTriggerPriority` (`combat-start-priority.js`); Puzzlebag L amps cargo `heal`/`lifesteal` params. `onPreDealDamage_early` can convert a miss (Molten Spear).
- [x] **250 — Aura / food / link leftovers** — dedicated ports in `ports-ap-aura.js`. Crossblades is dam+speed aura **and** on-hit perm; Mananana is mana-gated repeating food (not Banana); Pan bonuses in `onPreCombatStart`; Shepherd Crook is accessory resist/protect + aura, no weapon CD.
- [x] **251 — `MAP` + HAND** — after each wave: `HAND` in `build-sim-auto-ports.mjs`, `npm run sim-auto-ports`; pattern row is `hand_port` only when `PORT_HANDLERS[id]` exists. Builder throws if a port id is missing from HAND.
- [x] **252 — AP milestone** — census **0** generic CD/start/on-hit stand-ins (`sim-ap-census` throws otherwise). `wooden_sword` is a dedicated `WoodenSword.gd` port, not `bindPattern`. Smoke: `npm run sim-ap-smoke` (one dump per wave theme).

### AQ — Engine + gem/board gaps (253–258)

Ports can be “deep” and still miss Core or gem-as-item rules.

- [x] **253 — Loose gems** — board gems run `Gem`/`Ruby.gd` combat (`ports-an-gems.js`). **`onAfterEffectFinished` gems are one steal/heal then consume** (live Activations = 1), not a repeating 5s loop. Socketed gems still use `prepareWeapon` only (`gem-sockets.js`). Smoke: `npm run sim-loose-gem-smoke`.
- [x] **254 — Socket vs inventory split** — `prepareWeapon` / `prepareArmor` / `prepareInventory` once at prepare (Topaz speed already); no per-hit `addSpeed` unless `.gd` says so (Badger Rune on-hit speed **is** per hit). Smoke: `npm run sim-socket-split-smoke`.
- [x] **255 — Charge delay bags** — `EngineerBox.gd` queued `emitCharge(delay)` not “addSpeed on batteries at start.” Smoke: `npm run sim-engineer-box-smoke`.
- [x] **256 — Core leftover table** — walk [`sim-validation.md`](sim-validation.md) EventBus / damage gaps; close or ticket each. `rollDoubleAttackEffect` now loops `takeDamage` hooks; Thorn / Bow and Arrow / Poison Bow listen to linked `item_attacked`. Smoke: `npm run sim-core-leftover-smoke`.
- [x] **257 — Consume / activate meter + debug report** — combat-start consume still needs 1 activate. **CD-then-consume** (`Item.onAfterEffectFinished`) must not loop: `paramChecks` `expectedKey: "cd_then_consume"` if **more than one CD activate after combat delay** (`report-cd-consume.js`, list from `npm run sim-inventory`). HAND ids in `sim-cd-then-consume.json` stop via `afterEffectFinished` (Fortune + CogBadge `consume:false`). `$t[After $cds:]` is **not** “every CD” when the script consumes. Smoke: `npm run sim-cd-consume-smoke`.
- [x] **258 — AQ smoke** — gem-on-board fixture + Port-O-Charger + battery path; `paramChecks` / `ui.mismatches` empty on those boards. Smoke: `npm run sim-aq-smoke`.

### AR — False-deep HAND (dump loop) (259–264)

Many `ports-*.js` handlers are labeled deep and still fail a live dump (Hungry Blade convert timing, Magic Staff roll-then-mana, Leaf Badge, …).

- [x] **259 — Protocol** — every `bpb-sim-debug` paste → audit vs `.gd` **before** treating sim as correct; fix port or engine; do not “fix” the report to hide it. [`sim-debug-protocol.md`](sim-debug-protocol.md) · `npm run sim-audit-debug` · smoke `npm run sim-debug-protocol-smoke`.
- [x] **260 — Class staple boards** — one Ranger / Pyro / Berserker / Reaper / Adventurer / Engineer OP (or starter→mid) dump each; log mismatches in validation. Smoke: `npm run sim-staple-boards`. Compact dumps: `scripts/fixtures/debug/staple/`. Flags table: [`sim-validation.md`](sim-validation.md) Phase 260.
- [x] **261 — Harness: no silent generic** — fail `sim-harness` if resolved handler is still `cd_*` / undocumented `basic_cd` unique. `npm run sim-engine-1to1-count` (MAP leftover, function-identity vs auto-patterns, `AUTO_PORTS` must be `PORT_HANDLERS` for `hand_port`).
- [x] **262 — Coverage honesty** — coverage/scripted meter must not count empty `unique` gem stubs as “scripted combat.” `engineMatch` vs `handlerExists` in `coverage.js`. Smoke: `npm run sim-coverage-honesty`.
- [x] **263 — False-deep burn** — first theme: `grantStacks` → Combat Log / meter buff lines (`buff-log.js`). Smoke: `npm run sim-ar-buff-log`.
- [x] **264 — AR milestone** — staple-class dumps in 260 have empty `ui.mismatches`. Flame start `pushActivate`; Blood Goobert `vampirism` + start activate; Bloodthorne early regen convert + `grantStacks`; FBP `giveBlock` from descriptor `block`. Ghost item heals are not `applyVampirism`. Smoke: `npm run sim-ar-milestone`. Leftover **paramChecks** (not silenced): Reaper Unhealing total vs ceil-per-tick; Adventurer emerald `poisononhit` / Frog Prince luck-mana vs catalog `blind`. Empty UI flags still ≠ live meter pass.

### AS — Any-build closeout (265–270)

- [x] **265 — Live `live.*` bands** — ingest writes `playerEndHpMin/Max` from a **game** capture; dummy `expect` stays sim-baseline (`opponentHpComparable: false`). Smoke: `npm run sim-live-bands`. Capture: `npm run sim-live-capture -- --slug pyro-furnace --player-hp N --notes "…"`. Parity JSON `live.playerEndHp` is still **null** until you run that (history.db has no CombatLog HP).
- [x] **266 — Wildcard boards** — five boards **not** in the 260 staple set: create demo `infinite-combo-machine` + history **3708 / 3709 / 3706 / 3704**. Same dump protocol (`bpb-sim-debug`, flags logged). Smoke: `npm run sim-wildcard-boards`. Compact dumps: `scripts/fixtures/debug/wildcard/`. Table: [`sim-validation.md`](sim-validation.md) Phase 266.
- [x] **267 — Intentional noops list** — shop/wearables/`chess_board`/pieces audited vs `.gd`. False noops **ported** (Puzzlebag J/S/T/Z, Bag of Stones). Chess **AI** still deferred (`ChessBoard.gd` has combat CD). List: [`assets/data/sim-intentional-noops.json`](../assets/data/sim-intentional-noops.json). Smoke: `npm run sim-noop-audit`.
- [x] **268 — Engine banner** — `/sim/` says **Engine 1:1** only when 252 + 258 + 264 + 265 hold (`sim-engine-claim.json`). Until live captures exist, banner is **fixture-validated subset** / “partial / fixture subset.” Smoke: `npm run sim-engine-claim`.
- [x] **269 — Marketing lock** — public “matches the game” / Engine 1:1 title also needs `legal.phase38CounselReview` + `legal.allowPublicMatchesTheGameMarketing` (both **false**). About/Terms/footer stubs; [`sim-ip-marketing.md`](sim-ip-marketing.md) is a **no-go**, not counsel sign-off. Band F **38** stays open. Fan `/sim/` can keep iterating.
- [x] **270 — Ladder closeout** — numbered AP–AS checkboxes are `[x]`. Harness floors stay solid **100** / parity **90**; `sim-engine-claim.json` `engine11Achieved` stays **false**. Engine 1:1 is **not** claimed (live staple HP, chess AI, leftover `paramChecks`, Phase 38). Smoke: `npm run sim-engine-claim`.

**Habits:** `.gd` before code; dump before “fixed”; no new `auto-patterns.js` recipes for uniques; split `ports-ap-*.js` if a file grows.

---

## Still open (other bands)

- [ ] **CI on `sim-catalog`** — still deferred (Phase 96 leftover; no GH Actions in repo)
- [ ] **Engine 1:1 leftovers** — checklist in [`todo.md`](todo.md) (bag-vs-bag compare, Adventurer paramChecks, chess AI, Phase 38; plus parity-band / wildcard / shallow)
- [ ] **Band F — 39–40** — auth gate / Stripe after **38** counsel (38 itself is on the leftover list)
