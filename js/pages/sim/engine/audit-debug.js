/**
 * Phase 259 — audit a `kind: "bpb-sim-debug"` dump vs GDScript, not vs empty flags.
 * Does not mutate the dump. Empty paramChecks is not a live-game pass.
 */

const EXTRACT = 'tools/game-extract-full/Items';

/**
 * @param {object | null | undefined} dump
 * @param {object | null} [inventory] sim-item-inventory.json
 */
export function collectDumpItemIds(dump) {
  /** @type {Set<string>} */
  const ids = new Set();
  for (const p of dump?.placements || []) {
    if (p?.id) ids.add(String(p.id));
    for (const g of p?.gems || []) if (g) ids.add(String(g));
  }
  for (const row of dump?.catalog || []) {
    if (row?.id) ids.add(String(row.id));
  }
  for (const row of dump?.paramChecks || []) {
    if (row?.itemId) ids.add(String(row.itemId));
  }
  for (const row of dump?.ui?.mismatches || []) {
    if (row?.itemId) ids.add(String(row.itemId));
  }
  return [...ids];
}

/**
 * @param {string} itemId
 * @param {object | null} inventory
 */
export function gdPathForItem(itemId, inventory) {
  const row = inventory?.byId?.[itemId];
  const file = row?.file ? String(row.file).replace(/\\/g, '/') : null;
  if (!file) return `${EXTRACT}/ (no inventory row for ${itemId})`;
  return `${EXTRACT}/${file}`;
}

/**
 * @param {object | null | undefined} dump
 * @param {object | null} [inventory]
 */
export function auditSimDebugDump(dump, inventory = null) {
  if (!dump || dump.kind !== 'bpb-sim-debug') {
    return {
      ok: false,
      error: 'expected JSON with kind: "bpb-sim-debug" (do not audit ad-hoc event logs as a dump)',
      paramChecks: [],
      mismatches: [],
      gdFiles: [],
      itemIds: [],
    };
  }
  const paramChecks = Array.isArray(dump.paramChecks) ? dump.paramChecks : [];
  const mismatches = Array.isArray(dump.ui?.mismatches) ? dump.ui.mismatches : [];
  const itemIds = collectDumpItemIds(dump);
  const gdFiles = itemIds.map((id) => ({
    itemId: id,
    gd: gdPathForItem(id, inventory),
    overrides: inventory?.byId?.[id]?.overrides || [],
  }));
  return {
    ok: true,
    error: null,
    paramChecks,
    mismatches,
    gdFiles,
    itemIds,
    emptyFlagsAreNotALivePass:
      paramChecks.length === 0 &&
      mismatches.length === 0,
    protocol:
      'Read ui.mismatches + paramChecks first. Open the .gd files. Fix the port or engine. Do not delete flags in report-*.js to hide a miss.',
  };
}

/**
 * @param {ReturnType<typeof auditSimDebugDump>} audit
 */
export function formatAuditReport(audit) {
  const lines = [];
  if (!audit.ok) {
    lines.push(`FAIL: ${audit.error}`);
    return lines.join('\n');
  }
  lines.push('AR 259 dump audit (GDScript first — empty flags ≠ live pass)');
  lines.push(audit.protocol);
  lines.push(`items: ${audit.itemIds.join(', ') || '(none)'}`);
  for (const row of audit.gdFiles) {
    const ov = row.overrides?.length ? ` [${row.overrides.join(', ')}]` : '';
    lines.push(`  ${row.itemId} → ${row.gd}${ov}`);
  }
  lines.push(`paramChecks: ${audit.paramChecks.length}`);
  for (const p of audit.paramChecks) {
    lines.push(
      `  - ${p.expectedKey || p.stack || '?'} ${p.itemId || ''} ${p.note || p.hint || ''}`.trim(),
    );
  }
  lines.push(`ui.mismatches: ${audit.mismatches.length}`);
  for (const m of audit.mismatches) {
    lines.push(`  - ${m.hint || m.stack || JSON.stringify(m)}`);
  }
  if (audit.emptyFlagsAreNotALivePass) {
    lines.push(
      'NOTE: empty paramChecks/ui.mismatches only means this JSON has no automated flags. A live Damage Meter dump can still disagree — open the .gd files anyway.',
    );
  }
  return lines.join('\n');
}
