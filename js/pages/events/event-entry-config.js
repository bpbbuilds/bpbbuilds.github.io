/**
 * Admin-shaped event entry knobs — catalog defaults until the event portal exists.
 */

/** @typedef {import('./catalog-data.js').CatalogEvent} CatalogEvent */

/**
 * @typedef {{
 *   judgeWindowSec: number,
 *   minGameVersion: string,
 *   requiredItemIds: string[],
 *   allowedModes: ('ranked' | 'unranked')[],
 *   maxEntriesPerUser: number,
 *   showSimDpsOnEntry: boolean,
 *   leaderboardVisibility: 'hidden' | 'after_close' | 'live',
 * }} EventEntryRules
 */

/**
 * @param {CatalogEvent} event
 * @returns {EventEntryRules}
 */
export function entryRulesForEvent(event) {
  const e = event?.entry && typeof event.entry === 'object' ? event.entry : {};
  const modes = Array.isArray(e.allowedModes)
    ? e.allowedModes.filter((m) => m === 'ranked' || m === 'unranked')
    : [];
  const required = Array.isArray(e.requiredItemIds)
    ? e.requiredItemIds.map(String).filter(Boolean)
    : [];
  const lb = e.leaderboardVisibility;
  return {
    judgeWindowSec: Math.max(1, Number(e.judgeWindowSec) || 15),
    minGameVersion: String(e.minGameVersion || '0.0.0').trim() || '0.0.0',
    requiredItemIds: required,
    allowedModes: modes.length ? modes : ['ranked', 'unranked'],
    maxEntriesPerUser: Math.max(1, Math.min(20, Number(e.maxEntriesPerUser) || 3)),
    showSimDpsOnEntry: e.showSimDpsOnEntry !== false,
    leaderboardVisibility:
      lb === 'live' || lb === 'hidden' || lb === 'after_close' ? lb : 'after_close',
  };
}
