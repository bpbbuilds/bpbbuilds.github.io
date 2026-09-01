# Sim debug dump protocol (Phase 259)

Every paste of `kind: "bpb-sim-debug"` JSON (or a live Combat Log / Damage Meter screenshot) is audited **against GDScript** before the sim is treated as correct.

Cursor agents: [`.cursor/rules/sim-debug-audit.mdc`](../.cursor/rules/sim-debug-audit.mdc).

```bash
node scripts/sim-audit-debug.mjs path/to/dump.json
```

## Order of work

1. Read `ui.mismatches` and `paramChecks` first. They are findings, not UI chrome to hide.
2. Open `tools/game-extract-full/` for each placement id (`Items/**/*.gd`, `Core/Character.gd`, catalog `scripts/_cache/game-items.json`).
3. If the dump disagrees with `.gd`, **fix the port or engine**.
4. Do **not** delete or filter `paramChecks` / `ui.mismatches` in `report-*.js` so a dump looks clean.
5. Empty automated flags only mean this JSON had no detector hits. A live meter can still disagree — still open the `.gd` files.

Class staple dumps (Phase 260 / 264): `npm run sim-staple-boards` — compact JSON in `scripts/fixtures/debug/staple/`. Wildcard dumps (Phase **266**, five boards off that set): `npm run sim-wildcard-boards` — `scripts/fixtures/debug/wildcard/`. Empty flags still ≠ live pass.

Leftover **paramChecks** after 264 (do not strip in `report-*.js`): Reaper Unhealing total vs ceil-per-tick; Adventurer emerald / Frog Prince catalog-key compares. Ghost CD heals after spending a buff are item heals, not `applyVampirism`.
