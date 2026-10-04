/**
 * Admin event saves for this browser tab. The public event page reads them
 * so a test of /events/ matches the form. The catalog file stays the default.
 */

const KEY = 'bpb-admin-event-drafts';

/**
 * @typedef {Record<string, unknown> & {
 *   slug?: string,
 *   requiredItemIds?: string,
 * }} EventDraft
 */

/** @returns {EventDraft[]} */
export function loadEventDrafts() {
  try {
    const raw = sessionStorage.getItem(KEY);
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/** @param {EventDraft[]} rows */
export function saveEventDrafts(rows) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(rows));
  } catch {
    /* private mode / quota — the admin tab still keeps the in-memory list */
  }
}

/**
 * @param {string} raw
 */
function itemIds(raw) {
  return String(raw || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

/**
 * @param {string} id
 */
function itemLabel(id) {
  const text = String(id || '').trim();
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * @param {string[]} ids
 */
function requirementSentence(ids) {
  if (!ids.length) return 'The board does not require a specific item.';
  const names = ids.map((id) => `<strong>${itemLabel(id)}</strong>`).join(', ');
  return ids.length === 1
    ? `The board must include at least one ${names}.`
    : `The board must include ${names}.`;
}

/**
 * @param {string} html
 * @param {string[]} ids
 */
function requirementCopy(html, ids) {
  const sentence = requirementSentence(ids);
  const onBoard = ids.length
    ? ` with ${ids.map((id) => `<strong>${itemLabel(id)}</strong>`).join(', ')} on the board`
    : '';
  return String(html || '')
    .replace(/The board must include at least one <strong>Stone<\/strong>\./, sentence)
    .replace(/ with <strong>Stone<\/strong> on the board/, onBoard);
}

/**
 * Copy a catalog event and apply the saved required-item list (and the sentences that mention it).
 * @param {import('./catalog-data.js').CatalogEvent} event
 * @param {EventDraft} draft
 */
export function applyEventDraft(event, draft) {
  const ids = itemIds(draft.requiredItemIds);
  const schedule = { ...(event.schedule || {}) };
  for (const key of [
    'startsAt',
    'endsAt',
    'entriesOpenAt',
    'entriesCloseAt',
    'votingStartsAt',
    'votingEndsAt',
  ]) {
    if (Object.prototype.hasOwnProperty.call(draft, key)) {
      const value = String(draft[key] || '').trim();
      schedule[key] = value || null;
    }
  }

  const entry = {
    ...(event.entry || {}),
    requiredItemIds: ids,
  };
  if (typeof draft.judgeWindowSec === 'number') entry.judgeWindowSec = draft.judgeWindowSec;
  if (typeof draft.minGameVersion === 'string') entry.minGameVersion = draft.minGameVersion;
  if (typeof draft.maxEntriesPerUser === 'number') entry.maxEntriesPerUser = draft.maxEntriesPerUser;
  if (typeof draft.showSimDpsOnEntry === 'boolean') entry.showSimDpsOnEntry = draft.showSimDpsOnEntry;
  if (typeof draft.leaderboardVisibility === 'string') entry.leaderboardVisibility = draft.leaderboardEnabled === false
    ? 'off'
    : draft.leaderboardVisibility;
  if (typeof draft.modeRanked === 'boolean' || typeof draft.modeUnranked === 'boolean') {
    entry.allowedModes = [
      draft.modeRanked === true ? 'ranked' : '',
      draft.modeUnranked === true ? 'unranked' : '',
    ].filter(Boolean);
  }
  const sections = (event.sections || []).map((section) => ({
    ...section,
    html:
      String(section.heading || '').trim().toLowerCase() === 'schedule'
        ? scheduleSectionHtml(schedule) || requirementCopy(section.html, ids)
        : requirementCopy(section.html, ids),
  }));
  return {
    ...event,
    ...(typeof draft.title === 'string' ? { title: draft.title } : {}),
    ...(typeof draft.type === 'string' ? { type: draft.type } : {}),
    ...(typeof draft.featured === 'boolean' ? { featured: draft.featured } : {}),
    ...(typeof draft.tag === 'string' ? { tag: draft.tag } : {}),
    ...(typeof draft.blurb === 'string' ? { blurb: draft.blurb } : {}),
    ...(typeof draft.image === 'string' ? { image: draft.image } : {}),
    ...(typeof draft.titleIcon === 'string' ? { titleIcon: draft.titleIcon } : {}),
    ...(typeof draft.discordHref === 'string' ? { discordHref: draft.discordHref } : {}),
    ...(typeof draft.prize === 'string' ? { prize: draft.prize } : {}),
    schedule,
    features: {
      ...(event.features || {}),
      ...(typeof draft.votingEnabled === 'boolean' ? { hasVoting: draft.votingEnabled } : {}),
      ...(typeof draft.entriesEnabled === 'boolean' ? { hasBuilds: draft.entriesEnabled } : {}),
    },
    entry,
    sections,
  };
}

/**
 * Render the schedule fact list from the event's actual schedule. The catalog
 * keeps the surrounding prose, but dates must never drift from an admin edit.
 * @param {Record<string, unknown> | null | undefined} schedule
 * @returns {string}
 */
export function scheduleSectionHtml(schedule) {
  const rows = [
    ['Opens', schedule?.startsAt],
    ['Entries close', schedule?.entriesCloseAt],
    ['Voting opens', schedule?.votingStartsAt],
    ['Voting closes', schedule?.votingEndsAt],
    ['Closes', schedule?.endsAt],
  ]
    .map(([label, value]) => {
      const date = formatScheduleDate(value);
      return date ? `<li><strong>${label}:</strong> ${date}</li>` : '';
    })
    .filter(Boolean)
    .join('');
  return rows
    ? `<ul>${rows}</ul><p>Exact times are pinned in Discord when the event goes live.</p>`
    : '';
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function formatScheduleDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * @param {string} slug
 * @returns {EventDraft | null}
 */
export function eventDraftForSlug(slug) {
  const id = String(slug || '').trim();
  if (!id) return null;
  return loadEventDrafts().find((row) => row.slug === id) || null;
}
