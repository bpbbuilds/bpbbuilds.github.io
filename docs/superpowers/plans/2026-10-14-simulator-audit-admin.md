# Simulator audit Admin tab implementation plan

> **For implementation:** follow the `executing-plans` skill task-by-task.

**Goal:** Add an owner-only Admin `Sim audit` view containing every game item
and audited shared combat mechanic, with evidence-based check/cross/pending
verdicts that cannot misrepresent source ports as 1:1 parity.

**Architecture:** Generate a compact static dashboard artifact by normalizing
the existing source-backed item fidelity ledger and shared-system surface
manifest. The Admin shell fetches that artifact after its existing owner gate,
then offers client-side filtering and detailed provenance per row. The
generator deliberately grants `verified_1to1` only when retained evidence is
complete and fresh for the source hashes.

**Tech stack:** Static HTML/CSS/vanilla JS, Node ESM generation scripts,
existing generated JSON assets, Playwright/manual viewport checks.

**Spec:** `docs/superpowers/specs/2026-10-14-simulator-audit-admin-design.md`

---

### Task 1: Claim work and define the normalized audit artifact

**Files:**

- Modify: `docs/CODEX_HANDOFF.md`
- Create: `scripts/build-sim-audit-dashboard.mjs`
- Create: `assets/data/sim-audit-dashboard.json`
- Test: `scripts/build-sim-audit-dashboard.test.mjs`

**Step 1: Claim before product edits.**

Add the Admin tab, dashboard generator, dashboard JSON, and its tests to the
Codex handoff. Confirm that neither handoff currently owns the same paths.

**Step 2: Write the failing generator contract test.**

Use small fixture objects that cover `source_ported`, incomplete/no-combat,
unsupported, known-delta, `implemented`, `partial`, `unmapped`, and
unsupported system rows. Assert:

- one normalized item row per input catalog row;
- one normalized mechanic row per surface row;
- no input without complete evidence can become `verified_1to1`;
- confirmed gaps/unsupported modes become cross verdicts;
- no-combat items become dash verdicts;
- output totals equal the row statuses.

**Step 3: Run the test to prove it fails.**

Run: `node scripts/build-sim-audit-dashboard.test.mjs`

Expected: failure because the generator does not exist.

**Step 4: Implement the deterministic generator.**

Read `assets/data/sim-fidelity-ledger.json` and
`assets/data/sim-system-surface.json`; do not import the simulator runtime.
Create a stable output containing:

- schema/version plus hashes of both inputs;
- `items` and `mechanics` with stable ids, source/simulator mappings,
  existing evidence and deltas, normalized status, and human-readable reason;
- totals by verdict and scope;
- a conservative freshness/evidence rule. Evidence must be explicit and
  source-hash-compatible before a green check is possible.

Retain existing source-ledger status separately from the dashboard verdict so
the UI can explain why a row is pending.

**Step 5: Regenerate and run checks.**

Run:

```powershell
node scripts/build-sim-audit-dashboard.mjs
node scripts/build-sim-audit-dashboard.mjs --check
node scripts/build-sim-audit-dashboard.test.mjs
```

Expected: the generated artifact is stable; tests pass; initial checked count
is never inferred solely from `source_ported`/`implemented`.

### Task 2: Add the Admin rail tab and mount point

**Files:**

- Modify: `js/pages/admin/tabs.js`
- Modify: `js/pages/admin/shell.js`
- Create: `js/pages/admin/tab-sim-audit.js`
- Test: `scripts/admin-sim-audit-smoke.mjs`

**Step 1: Extend the tab model.**

Add `sim-audit` to `AdminTabId`, `ADMIN_TABS`, labels, and metadata. Keep
`reports` unchanged because it is the existing user-submitted simulator issue
report view.

**Step 2: Write a failing module/shell smoke.**

Assert the tab is normalized, labeled, its URL is stable, and `mountStage`
delegates to the audit panel. Check that the panel module exports a mount
function and reads static data through the supplied root path.

**Step 3: Mount the panel through the existing authenticated shell.**

Import the new panel into `shell.js`, branch in `mountStage`, and pass only
the root/context it needs. Do not add an API endpoint, browser credential, or
authorization bypass.

**Step 4: Run the smoke.**

Run: `node scripts/admin-sim-audit-smoke.mjs`

Expected: it passes after the tab is mountable.

### Task 3: Build the audit panel as a truthful review queue

**Files:**

- Create: `js/pages/admin/tab-sim-audit.js`
- Modify: `js/pages/admin/admin.css`
- Test: `scripts/admin-sim-audit-smoke.mjs`

**Step 1: Write failing rendering/filter assertions.**

Use a small JSON fixture or exported pure helpers. Verify search, scope,
status/category filters, count calculation, detail text, and that each
verdict displays the required semantic label rather than a bare color/icon.

**Step 2: Implement safe static-data loading.**

Fetch `assets/data/sim-audit-dashboard.json` with timeout/error handling.
Show a non-success state for absent, malformed, or unsupported schema data;
never replace it with an all-green empty report.

**Step 3: Render overview and lists.**

Render:

- an explanation of evidence rules and the loaded source freshness;
- summary tiles for verified, gaps, evidence pending, and no-combat;
- switchable Items/Mechanics scopes;
- filtering/search controls and a bounded page size;
- rows with status glyph plus text, name/category, concise reason, and an
  accessible details control for paths, hooks/functions, evidence, and known
  delta.

Use `textContent`/existing escaping for all JSON-controlled strings. Do not
use `innerHTML` for source-data values.

**Step 4: Add responsive scoped styles.**

Append only `.admin-sim-audit*` rules. Verify 1440p desktop reference, 1080p
short desktop, narrow desktop/tablet, and mobile. Make filters wrap/stack,
details remain readable, rows avoid horizontal clipping, and focus state is
visible.

**Step 5: Run panel smoke.**

Run: `node scripts/admin-sim-audit-smoke.mjs`

Expected: test fixture controls return the expected rows and semantics.

### Task 4: Integrate artifact freshness with the simulator audit gates

**Files:**

- Modify: `scripts/sim-continuous-audit.mjs`
- Modify: `package.json`
- Modify: `docs/sim/sim-1to1-audit.md`
- Modify: `docs/sim/sim-validation.md`
- Test: existing continuous-audit check

**Step 1: Inspect package/ownership before touching shared configuration.**

`package.json` is a shared path; verify no other assistant owns it. If it is
claimed, stop and request coordination rather than editing it concurrently.

**Step 2: Add the generated-dashboard stale check.**

Run the generator's `--check` from the existing continuous audit path so a
ledger/surface change cannot leave the Admin audit stale. Add an explicit
npm script only if the project convention warrants it.

**Step 3: Document the exact verdict semantics.**

Add a short reference to the generated Admin audit in simulator docs. State
that item-source ports and mechanics marked implemented/partial are evidence
inputs, not 1:1 checks. Link the ongoing row-evidence procedure.

**Step 4: Run targeted audit checks.**

Run:

```powershell
node scripts/build-sim-fidelity-ledger.mjs --check
node scripts/build-sim-system-surface.mjs --check
node scripts/build-sim-audit-dashboard.mjs --check
node scripts/sim-continuous-audit.mjs --check
```

Expected: all generated artifacts match their sources. Investigate rather than
rewriting any unrelated baseline if another pre-existing check fails.

### Task 5: Establish the exhaustive evidence programme

**Files:**

- Modify: `docs/sim/sim-validation.md`
- Modify: `docs/CODEX_HANDOFF.md`
- Test: focused simulator scripts per audited item/mechanic family

**Step 1: Turn every dashboard pending/gap row into auditable work.**

Group catalog items by source family and mechanics by their shared surface.
For each row record source hook/parameters, simulator owner, both-side state,
ordered events/log/meter/HUD expectation, regression command, source hash,
and whether a live capture is required.

**Step 2: Audit in dependency order.**

Complete the shared surfaces first: lifecycle/scheduler, damage/state
(including stun, invulnerability, resistance/reduced damage, protection),
resources/stacks, RNG, board/card/gem evolution, and all user projections.
Then audit each item against those validated primitives, family by family.

**Step 3: Promote only with retained proof.**

For each candidate check, add the focused regression and any required live
probe, verify current source hashes, regenerate the dashboard, and re-run its
family audit. Record confirmed defects as cross verdicts with their delta.

**Step 4: Maintain truth as patches arrive.**

When extract hashes change, let stale proof fall back to pending until it is
rechecked. Never preserve a check merely because an old handler remains.

### Task 6: End-to-end verification and handoff

**Files:**

- Modify: `docs/CODEX_HANDOFF.md`

**Step 1: Run static and artifact verification.**

Run `node --check` for changed JS modules, generator tests, stale checks, and
the narrowest Admin smoke. Inspect `git diff --check` and scan the change for
credentials before handoff.

**Step 2: Run visual checks.**

Open the owner-gated Admin page and inspect `?tab=sim-audit` at 1440p, 1080p,
tablet/narrow desktop, and mobile. Confirm all status text is readable and no
row/control is clipped.

**Step 3: Verify safety and legal scope.**

Confirm the page stays behind the pre-existing owner gate, makes no writes,
and fetches only public generated simulator metadata. This task changes no
authentication, payments, uploads, storage, analytics, or moderation behavior,
so the legal pages require review but no factual update.

**Step 4: Update only the Codex handoff.**

Record owned paths, the generated-data commands, initial verdict totals, what
the tab does and does not prove, verification results, and the next audit
batch. Do not edit Cursor's handoff.
