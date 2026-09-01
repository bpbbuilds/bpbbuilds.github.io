# Sim combat audit (game extract)

Phase 1 audit of [`tools/game-extract-full/`](../tools/game-extract-full/) for the solo combat sandbox. Refresh the GDRE extract when the game patches. Catalog combat columns already import static ItemData — this doc covers **behavior** the engine must port.

**Related:** [`sim.md`](sim.md) · [`sim-phases.md`](sim-phases.md) · [`db/sql/003_items_combat.sql`](db/sql/003_items_combat.sql)

---

## Fight orchestration

| Piece | Path | Notes |
|---|---|---|
| Combat scene / UI phases | `Core/Combat.gd` | Scene phases: Combat → RoundResult → RunResult. Connects `Game.combat_start` / `combat_end`. Heavy ranked/survival UI — sim needs the **fight window**, not trophy chrome. |
| Pre-fight delay | `Core/Game.gd` `COMBAT_DELAY = 2.5` | Items activate after delay (`activateItems` delayed). |
| Fight clock / fatigue | `Interface/CombatTimer/CombatTimer.gd` | `FATIGUE_TIME = 17` then escalating fatigue ticks. Speed slider up to `MAX_SPEED = 3`. |
| Event log UI | `Core/CombatLog.gd` + `Interface/CombatLog/*` | Holds `events[]`, timestamps, You/Opponent minimize, activations filter, search, replay. **Sim 1:1 track = Band Q** in [`sim-phases.md`](sim-phases.md). |
| Damage meters | `Interface/DamageMeter/*` | Per-source Damage/Heal/… + cumulative plot; syncs with log scrub. Band Q phases 102–103. |
| Event record | `Core/CombatEvent.gd` | `id`, `timestamp`, `parentEvent`, `origin`, `type`, `target`, `params`. `asText()` → `LOG_*` sentences. Band R. |
| Snapshot | `Core/CombatSnapshot.gd` | Player/opponent: health, stamina, stacks (Block…Cold), damage meter — used for log scrub/replay. |

There is **no separate training-dummy scene**. Opponent is a full `Character` with an inventory. For `/sim/`, model a **dummy Character** with fixed HP, no (or minimal) backpack, and optional simple auto-attack later (Phase 14).

---

## Character tick + damage

Path: `Core/Character.gd`

- `combatStart()` — starts `tickTimer`, physics; optional auto-rage.
- `onTick()` — even ticks: Regeneration heal; odd ticks: Poison damage. `tickCounter++`.
- `TickTimer` in `Character.tscn` — Timer node (default Godot interval if unset ≈ 1s; confirm in live game if parity drifts).
- `dealDamage(damageSource)` → `opponent.takeDamage(...)` + vampirism.
- `takeDamage` — miss/accuracy, dodge stacks, block absorb, crit, DR, then HP; emits combat-log events.
- `useStamina(amount)` — stamina economy; out-of-stamina paths exist in EventType.
- `cleanse()` / `combatEnd()` — reset stacks, buffs, timers.

---

## Item machine

Path: `Items/Item.gd` (~6.5k lines) + **~527** item scripts under `Items/*.gd`.

Roughly **~280** scripts override at least one of `trigger` / `activate` / `onCombatStart` / `onPreCombatStart` / `doCooldownEffect` (inventory for Band D).

### Lifecycle (combat)

1. Pre-combat: gems `preCombatStart`, set initial cooldown via `activateCooldown()`, then `onPreCombatStart()`.
2. `combatStart()` → optional `onCombatStart()` (“Start of battle”).
3. `_physics_process`: `triggerTime -= delta * getSpeed()`; when ≤ 0 → `trigger()` → `doCooldownEffect()` (per-item).
4. `activate(...)` — combat-log Activation event, animation, metrics (not bag items).
5. `dealDamage` / `useStamina` / stack helpers on Item + Character.

### Stacks (`Item.Stack` bitflags)

Block, Lucky, Regeneration, Vampirism, Spikes, Mana, Empower, Heat, Poison, Blind, Cold (+ Buff/Debuff aggregates).

Runtime: `Core/Buff.gd` — `gainStacks` / `gainTemporary`, resist/reflect/cleanse protection, max stacks (Block huge; others 10k).

---

## EventType vocabulary (game)

From `Core/Game.gd` `enum EventType` (sim maps these to string `SimEvent.type`):

| Game | Role |
|---|---|
| Activation | Item fired |
| DealDamage / CriticalDamage / MissedAttack / TakeDamage / LoseHealth | Damage pipeline |
| Health | Heal |
| Stamina / DrainStamina / OutofStamina | Stamina |
| Block…Heat (100–107) | Buff stacks |
| Poison…Cold (108–110) | Debuff stacks |
| CooldownAdvance | CD shove |
| Fatigue | Late-fight pressure |
| Stun / Invulnerable* / BattleRage* / Win / Loss | Status / outcome |
| Spikes / Vampirism / Unhealing / TemporaryMax* | Related combat stats |

---

## Catalog vs scripts

**Already in Supabase** (`003_items_combat.sql`): gid, cooldown, stamina_cost, damage_min/max, accuracy, block, chance*, params, sockets, tags, …

**Not in DB:** per-item GDScript (`doCooldownEffect`, on-hit chains, card decks, start-of-battle logic, summon rules). Hover `can-affect` is adjacency-only; `cardAffect` needs combat state.

---

## Dummy-target feasibility

- Opponent is always a `Character` — dummy = Character with no/minimal inventory + fixed max HP.
- Fatigue at 17s still applies in real fights; Phase 1 demo ignores fatigue.
- history.db has boards + W/L only — useful as seed boards later, **not** CombatLog replay.

---

## Target `SimEvent` contract (site)

Stable across demo generator and future engine. See also `js/pages/sim/sim-events.js`.

```js
/**
 * @typedef {'player' | 'dummy'} SimActor
 * @typedef {{
 *   t: number,
 *   type: 'fight_start' | 'fight_end' | 'tick' | 'activate' | 'damage' | 'miss'
 *     | 'heal' | 'buff' | 'debuff' | 'stamina' | 'cooldown' | 'info',
 *   actor?: SimActor,
 *   target?: SimActor,
 *   itemId?: string,
 *   placementKey?: string,
 *   amount?: number,
 *   label?: string,
 *   meta?: Record<string, unknown>,
 * }} SimEvent
 */
```

| `type` | Aligns with game |
|---|---|
| `activate` | EventType.Activation |
| `damage` | DealDamage / TakeDamage / CriticalDamage |
| `miss` | MissedAttack |
| `heal` | Health / Regeneration |
| `buff` / `debuff` | Block…Cold stack events |
| `stamina` | Stamina / OutofStamina |
| `cooldown` | CooldownAdvance / CD ready |
| `tick` | Character.onTick side effects |
| `fight_start` / `fight_end` | combat_start / fightEnded |

---

## Engine port order (from roadmap)

1. Tick clock + 30s cap + seed — **done (Band B)**  
2. Actor HP/stamina/block shell — **done**  
3. Stamina + base CD activate loop — **done**  
4. Damage (accuracy → block → HP) — **done**  
5. Pre-combat / start-of-battle subset — **done**  
6. Core stacks — **done**  
7. Dummy AI — **done**  
8. Systems (adjacency, gems, cards, …) — **done (Band C)**  
9. Per-item / family handlers — **done (Band D)** via `js/pages/sim/engine/scripts/` + `sim-item-coverage.json`  
10. Combat HUD panels — **done (Phase 33)**: Health / Stamina / Buffs / Debuffs with stack counters (`sim-hud.js`); mirrors fight UI info architecture  
11. Deepen individual GDScript ports toward 1:1 — **Band G** foundation shipped (`params.js`, `damage.js`, `stacks.js`, ports + [`sim-handler-audit.md`](sim-handler-audit.md)); don’t claim full parity  

Refresh inventory: `npm run sim-inventory && npm run sim-coverage && npm run sim-harness`

---

## Legal note

Porting combat rules derived from game scripts for a public/paid sim needs an IP check before monetization (roadmap Phase 38). Fan-site `/sim/` does not claim official 1:1 (Phase **269** marketing lock).
