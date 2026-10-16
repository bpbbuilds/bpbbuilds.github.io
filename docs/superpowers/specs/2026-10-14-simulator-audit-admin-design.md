# Simulator audit admin design

## Goal

Give the existing owner-only Admin hub a Simulator audit tab that enumerates
every catalog item and every audited shared combat surface, then reports the
strongest evidence currently retained for that row. It must make unfinished
work visible without representing source-port coverage as live-game parity.

## Truth model

The dashboard uses these exclusive verdicts:

- **Verified 1:1 (check):** source mapping, focused deterministic regression,
  required projected effects, and live evidence where source cannot settle the
  behavior are all recorded for the current source hashes.
- **Confirmed gap / unsupported (cross):** a source-backed mismatch or an
  intentional unsupported mode is documented. The row shows its delta.
- **Evidence pending (question):** a handler, source mapping, or partial
  system implementation exists, but the proof needed for a 1:1 verdict is
  incomplete.
- **No independent combat behavior (dash):** shop-only or dependent content
  that has no standalone simulator behavior to compare.

Only the first state may render as a green check. A registered handler,
coverage percentage, passing final-HP fixture, or a matching method name is
not enough by itself.

## Initial data scope

- One row for each catalog item from `sim-fidelity-ledger.json` (currently
  519); preserving stable item id, display name, class/type, game source,
  simulator owner, audit findings, known delta, source hashes, and evidence.
- One row for every shared combat surface from `sim-system-surface.json`,
  including lifecycle, timing, damage, state, event/log projection, item/gem/
  card lifecycle, and unsupported modes. Stun, invulnerability, damage
  reduction/resistance, block/protection, fatigue, temporary stacks, resource
  changes, and related mechanics are included through their source functions
  and searchable labels.
- The generated dashboard must show the existing evidence faithfully. Rows
  without recorded proof begin as Evidence pending; it must not manufacture
  checks from the current `source_ported` or `implemented` fields.

## Admin experience

- Add a `Sim audit` rail tab to the existing authenticated Admin shell; it
  performs no writes and uses the shell's existing owner gate.
- Show source version/freshness, status totals, a clear explanation of the
  verdict rules, full-text search, and filters for scope, status, item class,
  item type, and mechanics category.
- Render virtualizable/paginated accessible rows for the catalog and shared
  mechanics, with expandable details for source mapping, simulator mapping,
  evidence, known delta, and audit leads.
- Support keyboard navigation and preserve a usable one-column layout on
  narrow/tablet/mobile viewports.

## Generation and regression contract

- A deterministic Node generator merges the two existing generated inputs into
  `assets/data/sim-audit-dashboard.json`; `--check` fails when it is stale.
- The output includes an explicit schema version, generated-at/source hashes,
  counts, and per-row normalized verdicts. Generator tests cover every source
  status/disposition and prohibit a check without complete proof metadata.
- The Admin panel must handle missing, invalid, and stale data without
  claiming a clean audit.

## Audit programme after UI delivery

The UI is the ledger for a continuing evidence programme, not a declaration
that all behavior is done. Audit each item and mechanic family against the
game extract, simulator lifecycle, state/event/log/meter/HUD effects, both
sides, and a focused regression. Record a retained live probe for timing,
RNG, visual, or other behavior that source alone cannot decide. Promote only
the rows whose evidence is current for the input hashes; mark real gaps with
their repro and source links.

## Non-goals

- No automatic modification of simulator combat behavior.
- No public simulator marketing claim, public data exposure, or admin API
  endpoint.
- No fabricated live-game observations or status upgrade based only on static
  code inspection.
