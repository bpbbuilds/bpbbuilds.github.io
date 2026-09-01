# Sim handler fidelity audit (Band G Phase 41+)

Diff dedicated JS handlers vs `tools/game-extract-full/Items/*.gd`.  
**Bands H–P:** every placeable combat item has `handlerId === itemId` and is **reviewed**. Coverage reports `solid` vs `reviewed_approx` (`npm run sim-coverage`).

**Band AG (196–210) shipped:** Waves B–D + spotlight HAND deepened vs `.gd` combat hooks. Inventory `depth: deep` for those ids; `chess_board` remains **noop**. Coverage fidelity `parity` + fixtures = **Band AH**.

Silent misses are failures — list them.

**Related:** [`sim-phases.md`](sim-phases.md) Bands G–P · [`sim-validation.md`](sim-validation.md) · [`sim-combat-audit.md`](sim-combat-audit.md)

```bash
npm run sim-catalog   # refresh inventory + stubs + coverage
```

## Legend

| Status | Meaning |
|---|---|
| `port` | Dedicated handler in `scripts/ports.js` |
| `family` | Shared family handler (`basic_cd`, …) |
| `gap` | Behavior missing or wrong vs GDScript |

## Dedicated ports (Phase 45+)

| Item id | Game script | Handler | Fidelity notes |
|---|---|---|---|
| `wooden_sword` | `WoodenSword.gd` | `basic_cd` | Match: stamina → `dealDamage` → activate. No extras. |
| `broom` | `Broom.gd` | `broom` **port** | Miss → `+getP1` bonus dmg; hit clears bonus; chance → Blind. Partial: no particle / full attack-hook wiring. |
| `banana` | `Banana.gd` | `banana` **port** | Heal + stamina on CD (`getP1`/`getP2`). Gap: Food base helpers may differ. |
| `poison_bow` | `PoisonBow.gd` | `poison_bow` **port** | Hit → poison ≈ damage/`getP1`. Gap: no `damageAcc` carry / `onOpponentPoisonChanged` varying dmg. |
| `hero_longsword` | `HeroLongsword.gd` | `hero_longsword` **port** | Start: `+getP1` `damageBonus` on linked pieces. Gap: `canBeEmpowered` filter not exact. |
| `falcon_blade` | `FalconBlade.gd` | `falcon_blade` **port** | Start: haste `getP1%` on CD items; CD = double strike. Gap: animation-only hit counts. |
| `healing_herbs` | `HealingHerbs.gd` | `healing_herbs` **port** | `giveRegeneration(getP1)` + consume. |
| `katana` | (family) | `double_strike` | Approx double hit; verify vs real Katana.gd when audited. |
| `holy_armor` | (spikes armor) | `start_spikes` | `getP1` spikes + block grant. Gap: full armor script. |

## Family handlers vs GDScript

| Handler | Typical game pattern | Gaps |
|---|---|---|
| `basic_cd` | `useStamina` → `dealDamage` → `activate` | No preDeal/onDealt hooks; ~274 inventory items still map here |
| `double_strike` | Two `dealDamage` | No hit-count animation branch |
| `empower_aura` | `addBonusDamage(getP1)` on affected | Still grants player Empower stacks (approx); prefer dedicated ports |
| `speed_aura_double` | `addSpeed(getP1/100)` + double | Family path does not mutate neighbor CDs (falcon port does) |
| `poison_weapon` | On-hit poison | Fixed/`getP1` stacks; not per-script inflict helpers |
| `start_regen` / `start_max_hp` / `start_spikes` | `onCombatStart` consume / buff | Param fallbacks when DB `params` empty |
| `pet_strike` | Pet CD attack | Generic damage range |

## Pipeline / systems (Phases 42–44)

| Area | Status |
|---|---|
| Params `getP1`… via `params.js` | Wired on pieces; ports/handlers read `piece.params` |
| `gainStacks` resist/reflect/caps | `stacks.js` + **temp timers** (`temp-stacks.js` / `grantTemporaryStacks`) — cleanse protection still gap |
| `takeDamage` / `dealDamage` | `damage.js` — miss→crit→%DR→flat DR→block→HP→spikes; vamp on deal. **Fatigue** in `fatigue.js` + `simulate.js`. Thin `combat-bus.js` (not full EventBus). Gaps: invuln, crit tokens |
| `onDealtDamage` | Wired from `dealHit` + default activate path (`notifyDealtDamage`) |
| Heat | Stack + HUD buff; **no** onTick burn (matches `Character.onTick`) |
| Dodge stacks | Consumed on would-hit in `takeDamage` |

## Still on `basic_cd` catch-all (sample)

High-interest misses to port next: `burning_coal`, `claws_of_attack`, `corrupted_armor`, `critwood_staff`, `carrot`, `card` (deck items), most uniques.

## How to extend

1. Read `Items/<Name>.gd` (`onCombatStart` / `doCooldownEffect` / on-hit).
2. Add handler in `scripts/ports.js`; register in `registry.js` `OVERRIDES`.
3. Prefer `getP1(piece.params, fallback)` over magic numbers.
4. Add fixture row in `scripts/sim-harness.mjs` + note expected end HP band here or in validation doc.
