# Solo combat sandbox (`/sim/`)

Predictive fight page — default **dummy-target**, or **bag vs bag** with `?oppSlug=`. Not a replay of history.db CombatLog.

**Product / UX vision (paid testing grounds, VFX, reports):** [`sim-product.md`](sim-product.md)  
**Related:** [`sim-combat-audit.md`](sim-combat-audit.md) · [`sim-phases.md`](sim-phases.md) · [`sim-debug-protocol.md`](sim-debug-protocol.md) · [`todo.md`](../todo.md)

---

## Route + load

| URL | Board source |
|---|---|
| `/sim/?slug={slug}` | Public build from Supabase |
| `/sim/?slug={A}&oppSlug={B}` | Bag vs bag (engine). Dummy auto-attack off. Optional `round` / `oppRound` (or pickers on the page) |
| `/sim/?foe=dummy\|build\|mirror` | Foe mode UI (Run details). `build` uses `oppSlug`; `mirror` clones you-board; default dummy |
| `/sim/` (no slug) | Current create draft (`bpb-create-draft:v1`) |
| `?mode=engine\|demo` | Engine (default) or Demo timeline |
| `?seed={uint}` | Deterministic RNG seed (permalink) |
| Neither board / empty | Status + links to Create / builds |

Not linked from public nav yet. Entry points:

- Build guide action row → Play → `/sim/?slug=…`
- Create board toolbar → Play in sim → `/sim/` (draft)

---

## Modes

| Mode | Behavior |
|---|---|
| **Engine** | Catalog solid 100% + fixture `parityPct` ≥90 (AH). AP–AS numbered ladder **closed at 270** without claiming any-build 1:1. Banner stays fixture subset until tech gates **and** Phase 38. |
| **Demo** | Simple scheduled CD hits (Band A); no stamina/dummy AI |

Both emit `SimEvent[]` via `runSim()` (`js/pages/sim/engine/index.js`). Toggle on the page; preference stored in `localStorage` (`bpb-sim-mode`).

Coverage meter: **scripted** vs catalog-CD vs passive (`assets/data/sim-item-coverage.json`). Phase 25 log = category chips + **export JSON** (not game Combat Log UI yet).

**Combat HUD** (Phase 33): dual panels with Health, Stamina, Buffs / Debuffs **stack counters** — same info architecture as the in-game fight UI. Scrubber seeks actor snapshots. Base max HP follows `Game.getMaxHealthInRound`: round 1 is **25** for every class, then +10 / +15 / +20 / +30 per later round band. With a round selected, the training dummy uses the same pool so early-round tests finish. No round in the URL → player 200 / dummy 1200 (old sandbox default).

**Playback** (Band E): speed **1× / 2× / 4×**, activation rings + hit flash, Save / Compare run summaries, deep-link `?slug=&oppSlug=&seed=&mode=&t=&speed=`.

**Combat Log 1:1** (Bands Q–R): in-game **Damage Dealt** (You + Opponent) + **Combat Log** under the stage — Hide activations, search, meters, cumulative graph, line/graph scrub. Sentences via `log/sim-log-sentences.js`. Smoke: `npm run sim-log-smoke`.

**Charge board FX** (Band S): Battery sparks fly cell-to-cell (`fx/sim-charge-fx.js` + `engine/charge-path.js`); haste applies on cell enter; scrubber seek repositions the spark. Smoke: `npm run sim-charge-smoke`.

**Tesla Coil** (Band T): charge-receive bus + CD advances (`cdadvance` 3s, ★ priority). Smoke: `npm run sim-tesla-smoke`.

Live-game check notes: [`sim-validation.md`](sim-validation.md).

```bash
npm run sim-catalog     # inventory → AP census → auto-ports → coverage
npm run sim-ports       # regenerate per-item stubs only
npm run sim-harness     # fixtures + dedicated-count check
npm run sim-charge-smoke
npm run sim-tesla-smoke
```

**Catalog goal:** 100% dedicated ✓ → 100% reviewed ✓ → raise **approx → solid** → **parity** vs live game (`npm run sim-catalog`).

---

## Modules

| Path | Role |
|---|---|
| `sim/index.html` | Page shell |
| `js/pages/sim/page.js` | Orchestration + mode toggle |
| `shell/board-load.js` | Slug / draft load |
| `engine/index.js` | `runSim({ mode, … })` |
| `engine/simulate.js` | Orchestrator |
| `engine/board-graph.js` | Occupancy + adjacency / canAffect |
| `engine/pieces.js` / `gems.js` / `combat-activate.js` | Piece kinds + activate pipeline |
| `engine/actor.js` / `ticks.js` | Actors + DoT/HoT |
| `engine/log-export.js` | Run JSON download |
| `engine/params.js` | `getP` / `getP1`… ItemData params |
| `engine/damage.js` / `stacks.js` | takeDamage / dealDamage + Buff-like gain |
| `engine/scripts/*` | Family templates + reviewed `ports.js` + generated `dedicated/` |
| `assets/data/sim-port-registry.json` | Every itemId → band / fidelity / template |
| `demo-timeline.js` | Demo generator |
| `hud/sim-hud.js` | In-game-style Health / Stamina / stack counters |
| `controls/sim-scrubber.js` / `fx/sim-fx.js` | Playback + HUD sync + speed |
| `fx/sim-charge-fx.js` / `engine/charge-path.js` | Battery charge spark path + seekable board FX |
| `engine/charge-delivery.js` / `engine/cooldown.js` | Charge receive bus + CD advance helper |
| `assets/fx/charge/*` | Charge spark / charged-tile art + SFX |
| `log/sim-combat-results.js` | You Damage Dealt + Combat Log + Opponent Damage Dealt |
| `log/sim-combat-log.js` / `log/sim-combat-log.css` | Log filters, search, row chrome |
| `log/sim-damage-meter.js` / `log/sim-meter-metrics.js` | Source meters + metric dropdown + plot |
| `log/sim-log-sentences.js` | `LOG_*`-shaped line HTML |
| `shell/sim-permalink.js` | Query deep-link helpers |
| `shell/sim-runs.js` | Save / compare run summaries |
| `assets/icons/sim/hud/*` | Name banners + progress bar textures |
| `assets/data/sim-item-inventory.json` | GDScript override inventory |
| `assets/data/sim-item-coverage.json` | handlerId / status per item |

---

## Event contract

See [`sim-combat-audit.md`](sim-combat-audit.md) + `sim-events.js`. Types include `fight_start`, `activate`, `damage`, `miss`, `stamina`, `buff`, `debuff`, `heal`, `cooldown`, `fight_end`, …  
`meta.category` used for log filters (`damage`, `adjacency`, `gem`, `card`, `dot`, `hot`, …).

---

## Later

Roadmap: [`sim-phases.md`](sim-phases.md).

- **Phase 95** — deepen `reviewed_approx` items toward solid `.gd` ports
- **Band F** — legal / auth / Stripe
