# Sim port batches (catalog → solid 100%)

Burn down `reviewed_approx` / activate stubs toward solid GDScript patterns. Source of truth: `tools/game-extract-full/Items/*.gd`.  
Hand ports: theme modules under [`js/pages/sim/engine/scripts/`](../js/pages/sim/engine/scripts/) (`ports-*.js`) + `HAND` in [`scripts/build-sim-auto-ports.mjs`](../scripts/build-sim-auto-ports.mjs), then `npm run sim-auto-ports`.

Phase checkboxes: [`sim-phases.md`](sim-phases.md). Catalog solid 100% = **AC–AE (done)**. **Current:** leftover engine-1:1 work after 270 (live fills, chess, paramChecks, Phase 38).

**Ratchet:** `scripts/sim-harness.mjs` `SOLID_PCT_FLOOR` = **100** (Waves A–D **shipped**). Approx list **cleared**.

### Next leftover — engine 1:1 (after 270)

AH `parityPct` ≠ any-build accuracy. Remaining work: generic `cd_*` / `basic_cd` / start-on-hit templates, **CD-then-consume one-shots** (`onAfterEffectFinished`), loose gems, false-deep HAND, live dumps. Timeline: [`sim-phases.md`](sim-phases.md) **Phases 243–270** (numbered ladder closed; 1:1 not claimed).

`paramChecks` `cd_then_consume`: extra activates on ids in [`sim-cd-then-consume.json`](../assets/data/sim-cd-then-consume.json).

<!-- sim-ap-census:start -->

### AP census (Phase 243, living)

Regenerate after extract / MAP changes: `npm run sim-inventory && npm run sim-ap-census`. Machine JSON: [`sim-ap-census.json`](../assets/data/sim-ap-census.json). Consume extract: [`sim-cd-then-consume.json`](../assets/data/sim-cd-then-consume.json).

A `PORT_HANDLERS` entry wins when `MAP` is `hand_port` **and** that id is a real port key (Phase **251**). HAND in `build-sim-auto-ports.mjs` must list every port; ids without `PORT_HANDLERS` stay on the classifier pattern (not silent `basic_cd` via `PATTERNS.hand_port`). Last run: **0** generic CD, **0** other generic, **0** `hand_port` with no port key, **39** `cdThenConsume` ids.

| Bucket | Count |
|---|---|
| Generic CD templates | 0 |
| Other generic MAP | 0 |
| `hand_port` missing port key | 0 |
| Extract `cdThenConsume` | 39 |
| Documented true Weapon-CD twins (247) | 0 |

Phase **247:** leftover `basic_cd` MAP ids were **not** Weapon-only CDs. Dedicated ports: `phoenix` (self-dmg + reincarnate), `pumpkin` (on-hit stun + fatigue heat), `ruby_chonk` (on-hit heat/stun), `squirrel_archer` (ForestFriend speed + steal on hit), `thorn_bow` (start spikes → temp bonus). `stone` already had `stonePort` and is on HAND so MAP `basic_cd` does not win. **No** true Weapon-CD twins were kept on `bindPattern`.

Phase **248:** leftover `start_*` MAP ids were **not** grant-only twins. Dedicated ports in `ports-ap-start.js` (plus HAND `piggybank`). Weapons still strike; Dark Lantern is % HP loss + reincarnate, not `start_max_hp`.

Phase **249:** leftover on-hit / perm-bonus / `double_strike` MAP ids were **not** family recipes. Dedicated ports in `ports-ap-perm.js` / `ports-ap-onhit.js`. Lucky Bow is crit-gated extra strike, not every-CD double.

Phase **250:** leftover aura / food / link MAP ids were **not** Hero Longsword / Banana twins. Dedicated ports in `ports-ap-aura.js`. Census other-generic should be 0 after this wave.

Phase **251:** `MAP` `hand_port` only when `PORT_HANDLERS[id]` exists. Builder throws if a port id is missing from HAND.

Phase **252:** census ratchet **0** generic CD / start / on-hit stand-ins. `wooden_sword` is an explicit `WoodenSword.gd` port (`weaponStrike`), not `bindPattern` `basic_cd`. Smoke: `npm run sim-ap-smoke`.

Phase **261:** runtime ratchet `npm run sim-engine-1to1-count` — MAP must be all `hand_port`; `getScriptHandler` must not resolve to auto-pattern `cd_*` / `basic_cd` (function identity; `handlerId` is rewritten to the item id). Documented Weapon-CD twins remain **0**.

Phase **263:** `grantStacks` emits Combat Log / meter buff lines (`buff-log.js`); duplicates vs existing port logs are collapsed. Smoke: `npm run sim-ar-buff-log`.

Phase **264:** staple `ui.mismatches` empty. Flame activate, Blood Goobert start vamp, Bloodthorne early convert, FBP `item.block`. Smoke: `npm run sim-ar-milestone`.

Phase **266:** five off-staple boards (`infinite-combo-machine`, history 3708 / 3709 / 3706 / 3704). Smoke: `npm run sim-wildcard-boards`.

Phase **267:** shop/wearable/chess-piece noops vs `.gd`; Puzzlebag J/S/T/Z + Bag of Stones ported. Chess board AI still deferred. Smoke: `npm run sim-noop-audit`.

Phase **270:** AP–AS numbered closeout. `engine11Achieved` / `claimEngine11` stay **false**. Smoke: `npm run sim-engine-claim`.

#### Generic CD (still `bindPattern`)

| Pattern | Count | Ids |
|---|---|---|
| — | 0 | *(none)* |

#### Other generic MAP

| Pattern | Count | Ids |
|---|---|---|
| — | 0 | *(none)* |

#### CD-then-consume (`onAfterEffectFinished` one-shots)

Game: first CD effect then consume — not a repeating `activate()`. Sim loops if the winning handler is still a generic CD recipe.

| Id | MAP | Winning port | Generic auto |
|---|---|---|---|
| `amulet_of_fortune` | `hand_port` | yes | no |
| `angel_crystal` | `hand_port` | yes | no |
| `burning_coal` | `hand_port` | yes | no |
| `charge_splitter` | `hand_port` | yes | no |
| `chipped_emerald` | `hand_port` | yes | no |
| `chipped_ruby` | `hand_port` | yes | no |
| `chipped_sapphire` | `hand_port` | yes | no |
| `cog_badge` | `hand_port` | yes | no |
| `dark_ritual` | `hand_port` | yes | no |
| `electric_torch` | `hand_port` | yes | no |
| `emerald` | `hand_port` | yes | no |
| `everburning` | `hand_port` | yes | no |
| `flawed_emerald` | `hand_port` | yes | no |
| `flawed_ruby` | `hand_port` | yes | no |
| `flawed_sapphire` | `hand_port` | yes | no |
| `flawless_emerald` | `hand_port` | yes | no |
| `flawless_ruby` | `hand_port` | yes | no |
| `flawless_sapphire` | `hand_port` | yes | no |
| `knife_to_meet_you` | `hand_port` | yes | no |
| `lightning_potion` | `hand_port` | yes | no |
| `lump_of_coal` | `hand_port` | yes | no |
| `perfect_emerald` | `hand_port` | yes | no |
| `perfect_ruby` | `hand_port` | yes | no |
| `perfect_sapphire` | `hand_port` | yes | no |
| `poison_grenade` | `hand_port` | yes | no |
| `pot` | `hand_port` | yes | no |
| `puzzle_badge` | `hand_port` | yes | no |
| `puzzlebox` | `hand_port` | yes | no |
| `rainbow_badge` | `hand_port` | yes | no |
| `regular_emerald` | `hand_port` | yes | no |
| `regular_ruby` | `hand_port` | yes | no |
| `regular_sapphire` | `hand_port` | yes | no |
| `ruby` | `hand_port` | yes | no |
| `sapphire` | `hand_port` | yes | no |
| `spirit_bells` | `hand_port` | yes | no |
| `spring_loader` | `hand_port` | yes | no |
| `ultima` | `hand_port` | yes | no |
| `vampiric_gloves` | `hand_port` | yes | no |
| `wisp` | `hand_port` | yes | no |

<!-- sim-ap-census:end -->

| Band | Focus | Status |
|---|---|---|
| AF 186–195 | Engine systems (stun, peer goobert, charge, buff-protect, `parityPct`) | **Shipped** |
| AG 196–210 | Deepen shallow HAND → `.gd` by theme | **Shipped** |
| AH 211–220 | Live-game fixtures + `PARITY_PCT_FLOOR` ratchet (= Phase 94 expanded) | **Shipped** (sim-baseline; live fill-in open) |
| AI 221–232 | Remaining HAND `shallow` → `deep` from `.gd` | **Shipped** |
| AJ 233–242 | HARD gap engine hooks → shallow 0 | **Shipped** |
| AK | Bags / potions / shop junk; gem & chess noops | **Shipped** |
| AL | Remaining melee/ranged + artifact stones | **Shipped** |
| AM | Pets + leftover gooberts | **Shipped** |
| AN | Accessories / gem sockets / armor | **Shipped** |
| AO | Skills / spells / books / leftover catalog | **Shipped** (handler exists; not engine 1:1) |
| AP 243–252 | Kill generic `cd_*` / `basic_cd` / start-on-hit auto-patterns | **Shipped** |
| AQ 253–258 | Loose gems, charge-delay bags, Core leftover table | **Shipped** |
| AR 259–264 | False-deep HAND via debug dumps | **264 done** (staple `ui.mismatches` empty; leftover paramChecks in validation) |
| AS 265–270 | Any-build closeout + honest banner + Phase 38 | **270 closeout** (1:1 not claimed) |

### Band AI / AJ — depth checklist (living)

Verify: `npm run sim-ai-shallow-count` (fails if shallow &gt; 0 unless `--allow-gaps`).

| Wave | Theme | Status |
|---|---|---|
| AI-A…F | Theme deepen | **deep** |
| AJ | Former HARD (9) | **deep** — `ports-ai-hard.js` + timed DR / battle rage / shield |
| AK | Potions + combat bags | **deep** — `ports-ak-potions.js` / `ports-ak-bags.js` |
| AK | Shop junk, storage bags, gems, chess pieces | **noop** — `ports-ak-noop.js` |
| AL | Leftover weapons + stones | **deep** — `ports-al-weapons.js` / `ports-al-stones.js` |
| AM | Leftover gooberts + pets | **deep** — `ports-am-goobert.js` / `ports-am-pets.js` |
| AN | Accessories / gadgets / armor | **deep** — `ports-an-*.js` |
| AN | Socket gems | **deep** — host `prepareWeapon`/`prepareArmor` in `gem-sockets.js`; inventory on loose gems (`ports-an-gems.js`) |
| AN | Shop-only wearables | **noop** — hypercube / snowman / furcifer_prime / employee_uniform |
| AO | Skills / cards / shields / spells / books | **deep** — `ports-ao-*.js` |

**Noop (shop/drop only, GD-checked Phase 267):** shop junk + storage bags + 12 chess **pieces** + AN wearables. **`chess_board`:** game combat AI deferred, not a shop noop. **Ported off noop:** Puzzlebag J/S/T/Z, `bag_of_stones`.

### Parity inventory (Phase 186)

Machine-readable: [`assets/data/sim-parity-inventory.json`](../assets/data/sim-parity-inventory.json) (`node scripts/build-sim-parity-inventory.mjs`). Depth is **not** fidelity `parity`.

| Depth | ~Count (HAND) | Meaning |
|---|---|---|
| `deep` | **414** | Combat hooks match `.gd` intent |
| `shallow` | **83** | leftover HAND (not 267) |
| `noop` | **27** | `chess_board` (deferred AI) + shop/wearables + 12 chess pieces |

**Deep after AM:** leftover pets/gooberts. Gems/chess/shop remain noop.

**Wave A–D (shipped):** solid floors 70→100 — see phase checkboxes.

### Path to solid 100% (done)

| Wave | Phases | Target solid | Floor bump | Focus | Status |
|---|---|---|---|---|---|
| A | AC 171–173 | ≥70% | **70** | Easy approx leftovers | **Shipped** |
| B | AD 174–177 | ≥80% | **80** | Aura / start / heal / cold | **Shipped** |
| C | AE 178–181 | ≥90% | **90** | On-hit / spear / mana / scale; Engine banner | **Shipped** |
| D | AE 182–185 | **100%** | **100%** | Gooberts / crowns / hard uniques / board | **Shipped** |

**Hard defer (Wave D):** `chess_board`, `magic_ring`, `magic_mirror`, `perpetuum_mobile`, `plastic_cube`, `repeater`, `slime_time`; alchemy `potion_emptied` if still deferred.

### Band Y history (shipped)

| Phase | Theme | Status |
|---|---|---|
| 134 | Buff converters | **Shipped** — `ports-buff.js` |
| 135–143 | Theme batches | **Shipped** — luck/mana/heat/aura/threshold/pet/skill/consumable |
| 144 | Classifier cleanup + deferred outliers | **Shipped** — `ports-outliers.js` + `ports-outliers-board.js` |
| 145 | solidPct gate ratchet | Floor **60** → **70** → **80** → **90** → **100** (Wave D) |

Smoke: `npm run sim-band-y-smoke` · `npm run sim-band-z-smoke` · `npm run sim-wave-a-smoke` · `npm run sim-wave-b-smoke` · `npm run sim-wave-c-smoke` · `npm run sim-wave-d-smoke` · `npm run sim-ap-smoke`.

Find remaining candidates:

```bash
rg '"cd_activate"' assets/data/sim-auto-ports.json
rg 'approx|fallback|unknown' assets/data/sim-auto-ports.json
```
