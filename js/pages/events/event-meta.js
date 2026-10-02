/**
 * Featured / detail meta strip — timer + participant stack.
 */

/** @typedef {import('./catalog-data.js').CatalogEvent} CatalogEvent */
/** @typedef {import('./catalog-data.js').EventStatus} EventStatus */
/** @typedef {import('./catalog-data.js').EventParticipant} EventParticipant */

/** Faces shown before collapsing into +N */
export const EVENT_PARTICIPANT_FACE_LIMIT = 5;

/**
 * Pick the schedule instant that matters for the current status.
 * @param {CatalogEvent} event
 * @returns {{ at: string | null, kind: 'start' | 'entries' | 'vote' | 'end' | 'none', pastLabel: string }}
 */
export function eventTimerTarget(event) {
  const s = event.schedule || {};
  switch (event.status) {
    case 'upcoming':
      return { at: s.startsAt || null, kind: 'start', pastLabel: 'Started' };
    case 'accepting-entries':
      return {
        at: s.entriesCloseAt || s.endsAt || null,
        kind: 'entries',
        pastLabel: 'Entries closed',
      };
    case 'live':
      return { at: s.endsAt || null, kind: 'end', pastLabel: 'Ended' };
    case 'voting':
      return {
        at: s.votingEndsAt || s.endsAt || null,
        kind: 'vote',
        pastLabel: 'Voting ended',
      };
    case 'judging':
      return { at: s.endsAt || null, kind: 'end', pastLabel: 'Ended' };
    case 'ended':
      return { at: s.endsAt || s.startsAt || null, kind: 'end', pastLabel: 'Ended' };
    default:
      return { at: null, kind: 'none', pastLabel: '' };
  }
}

/**
 * @param {number} ms
 */
export function formatCountdown(ms) {
  if (ms <= 0) return '0s';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days >= 2) return `${days}d ${hours}h`;
  if (days === 1) return `1d ${hours}h`;
  if (hours >= 1) return `${hours}h ${mins}m`;
  if (mins >= 1) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

/**
 * @param {string} iso
 * @param {Date} [now]
 */
export function formatEventDate(iso, now = new Date()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Date TBA';
  const opts = /** @type {Intl.DateTimeFormatOptions} */ ({
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
  return d.toLocaleDateString(undefined, opts);
}

/**
 * Prefer countdown when the target is soon; otherwise show the calendar date.
 * Ended events always show the day they ended — never the word "Ended" (status
 * already covers that).
 * @param {CatalogEvent} event
 * @param {Date} [now]
 * @returns {{ primary: string, targetIso: string | null }}
 */
export function resolveEventTimerView(event, now = new Date()) {
  const target = eventTimerTarget(event);
  const fallbackLabel = String(event.datesLabel || '').trim();
  const fallbackLooksLikeEnded =
    !fallbackLabel ||
    /^ended$/i.test(fallbackLabel) ||
    /^coming soon$/i.test(fallbackLabel);

  if (!target.at) {
    if (event.status === 'ended' && fallbackLooksLikeEnded) {
      return { primary: 'Date TBA', targetIso: null };
    }
    return {
      primary: fallbackLabel || 'Date TBA',
      targetIso: null,
    };
  }

  const atMs = new Date(target.at).getTime();
  if (Number.isNaN(atMs)) {
    return { primary: 'Date TBA', targetIso: null };
  }

  const delta = atMs - now.getTime();
  const dateLine = formatEventDate(target.at, now);

  // Past / ended → calendar day the milestone hit (not "Ended").
  if (event.status === 'ended' || delta <= 0) {
    return { primary: dateLine, targetIso: null };
  }

  // Under ~7 days → countdown only; farther out → date only.
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  if (delta <= weekMs) {
    return {
      primary: formatCountdown(delta),
      targetIso: target.at,
    };
  }

  return { primary: dateLine, targetIso: target.at };
}

/**
 * @param {CatalogEvent} event
 * @param {{ root?: string }} [opts]
 */
export function eventTimerHtml(event, opts = {}) {
  const view = resolveEventTimerView(event);
  const targetAttr = view.targetIso
    ? ` data-event-timer-target="${escapeAttr(view.targetIso)}"`
    : '';
  const statusAttr = ` data-event-timer-status="${escapeAttr(event.status)}"`;
  return `
    <div class="events-meta__timer${opts.shade ? ' bpb-panel--rewards' : ''}" role="timer"${targetAttr}${statusAttr} aria-live="polite" aria-label="Schedule">
      <p class="events-meta__primary${opts.shade ? ' events-featured__ui-text' : ''}" data-event-timer-primary>${escapeHtml(view.primary)}</p>
    </div>`;
}

/**
 * @param {EventParticipant} p
 * @param {string} root
 * @param {number} z
 */
function participantFaceHtml(p, root, z) {
  const base = root.endsWith('/') ? root : `${root}/`;
  const name = String(p.name || 'Player').trim() || 'Player';
  const avatar = String(p.avatarUrl || '').trim();
  const blobRaw = String(p.blobUrl || '').trim();
  const href = String(p.profileHref || '').trim();
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';

  const blobSrc = blobRaw
    ? blobRaw.startsWith('http') || blobRaw.startsWith('/')
      ? blobRaw
      : `${base}${blobRaw.replace(/^\//, '')}`
    : '';

  // Prefer blob when set; otherwise profile avatar; else initials.
  let inner;
  if (blobSrc) {
    inner = `<img class="events-meta__face-img events-meta__face-img--blob" src="${escapeAttr(blobSrc)}" alt="" width="36" height="36" draggable="false" />`;
  } else if (avatar) {
    inner = `<img class="events-meta__face-img" src="${escapeAttr(avatar)}" alt="" width="36" height="36" draggable="false" />`;
  } else {
    inner = `<span class="events-meta__face-img events-meta__face-img--initials" aria-hidden="true">${escapeHtml(initials)}</span>`;
  }

  const style = `style="z-index:${z}"`;
  if (href) {
    return `<a class="events-meta__face" href="${escapeAttr(href)}" title="${escapeAttr(name)}" aria-label="${escapeAttr(name)}" ${style}>${inner}</a>`;
  }
  return `<span class="events-meta__face" title="${escapeAttr(name)}" ${style}>${inner}</span>`;
}

/**
 * @param {CatalogEvent} event
 * @param {{ root?: string }} [opts]
 */
export function eventParticipantsHtml(event, opts = {}) {
  const root = opts.root || '';
  const shade = opts.shade ? ' events-featured__shade' : '';
  const ui = opts.shade ? ' events-featured__ui-text' : '';
  const preview = Array.isArray(event.participants) ? event.participants : [];
  const total =
    typeof event.participantCount === 'number' && event.participantCount >= 0
      ? event.participantCount
      : preview.length;
  const faces = preview.slice(0, EVENT_PARTICIPANT_FACE_LIMIT);
  const overflow = Math.max(0, total - faces.length);

  if (!total && !faces.length) {
    return `
      <div class="events-meta__people${shade}" aria-label="Participants">
        <p class="events-meta__primary events-meta__primary--quiet${ui}">None yet</p>
      </div>`;
  }

  const stack = faces
    .map((p, i) => participantFaceHtml(p, root, faces.length - i))
    .join('');
  const more = overflow
    ? `<span class="events-meta__more${ui}" title="${overflow} more">+${overflow}</span>`
    : '';

  return `
    <div class="events-meta__people${shade}">
      <div class="events-meta__stack" aria-label="${total} participants">
        <span class="events-meta__faces">${stack}</span>${more}
      </div>
    </div>`;
}

/**
 * Meta row under the status bar (schedule timer).
 * @param {CatalogEvent} event
 * @param {{ root?: string }} [opts]
 */
export function eventMetaStripHtml(event, opts = {}) {
  return `
    <div class="events-meta" data-event-meta="${escapeAttr(event.slug)}">
      ${eventTimerHtml(event, opts)}
    </div>`;
}

/**
 * Keep countdown text fresh while a target ISO is present.
 * @param {ParentNode} root
 * @returns {() => void} unbind
 */
export function bindEventTimers(root) {
  /** @type {ReturnType<typeof setInterval> | null} */
  let id = null;

  function tick() {
    const now = new Date();
    root.querySelectorAll('[data-event-timer-target]').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const iso = el.getAttribute('data-event-timer-target');
      const status = /** @type {EventStatus} */ (
        el.getAttribute('data-event-timer-status') || 'upcoming'
      );
      if (!iso) return;
      const view = resolveEventTimerView(
        {
          status,
          datesLabel: '',
          schedule: statusSchedule(status, iso),
        },
        now,
      );
      const primary = el.querySelector('[data-event-timer-primary]');
      if (primary) primary.textContent = view.primary;
      if (!view.targetIso) {
        el.removeAttribute('data-event-timer-target');
      }
    });
  }

  tick();
  id = setInterval(tick, 1000);
  return () => {
    if (id != null) clearInterval(id);
    id = null;
  };
}

/**
 * @param {EventStatus} status
 * @param {string} iso
 */
function statusSchedule(status, iso) {
  if (status === 'upcoming') return { startsAt: iso };
  if (status === 'accepting-entries') return { entriesCloseAt: iso };
  if (status === 'voting') return { votingEndsAt: iso };
  if (status === 'judging') return { endsAt: iso };
  return { endsAt: iso };
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}
