/**
 * Admin event saves for this browser tab. The public event page reads them
 * so a test of /events/ matches the form. The catalog file stays the default.
 */

const KEY = 'bpb-admin-event-drafts';

/**
 * @typedef {{
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
  const entry = { ...(event.entry || {}), requiredItemIds: ids };
  const sections = (event.sections || []).map((section) => ({
    ...section,
    html: requirementCopy(section.html, ids),
  }));
  return { ...event, entry, sections };
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
