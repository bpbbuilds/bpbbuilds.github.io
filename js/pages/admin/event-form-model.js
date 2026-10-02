/**
 * Event form values — shared by new and edit. Shape follows DPS Stone.
 */

import { EVENT_STATUS_LABELS } from '../events/catalog-data.js';

export const TYPES = Object.freeze([
  { id: 'dps-stone', label: 'DPS Stone' },
  { id: 'craft', label: 'Craft' },
  { id: 'showcase', label: 'Showcase' },
]);

export const BOARDS = Object.freeze([
  { id: 'hidden', label: 'Hidden while entries are open' },
  { id: 'after_close', label: 'Opens after entries close' },
  { id: 'live', label: 'Live while entries are open' },
]);

export const PLACE_LABELS = Object.freeze(['1st', '2nd', '3rd']);

/**
 * @typedef {'dps-stone' | 'craft' | 'showcase'} EventFormType
 * @typedef {'live' | 'upcoming' | 'ended' | 'voting' | 'accepting-entries' | 'judging'} EventFormStatus
 * @typedef {'hidden' | 'after_close' | 'live' | 'off'} EventFormBoard
 * @typedef {{
 *   gold: string,
 *   discordRoleId: string,
 *   discordTitle: string,
 *   giftCard: string,
 *   cosmeticId: string,
 * }} EventFormPlace
 * @typedef {{
 *   slug: string,
 *   title: string,
 *   type: EventFormType,
 *   status: EventFormStatus,
 *   featured: boolean,
 *   tag: string,
 *   blurb: string,
 *   image: string,
 *   titleIcon: string,
 *   discordHref: string,
 *   startsAt: string,
 *   endsAt: string,
 *   entriesEnabled: boolean,
 *   entriesOpenAt: string,
 *   entriesCloseAt: string,
 *   votingEnabled: boolean,
 *   votingStartsAt: string,
 *   votingEndsAt: string,
 *   judgeWindowSec: number,
 *   minGameVersion: string,
 *   requiredItemIds: string,
 *   modeRanked: boolean,
 *   modeUnranked: boolean,
 *   maxEntriesPerUser: number,
 *   showSimDpsOnEntry: boolean,
 *   leaderboardEnabled: boolean,
 *   leaderboardVisibility: EventFormBoard,
 *   prize: string,
 *   places: EventFormPlace[],
 * }} EventFormValues
 */

/** @returns {EventFormPlace} */
export function emptyPlace() {
  return { gold: '', discordRoleId: '', discordTitle: '', giftCard: '', cosmeticId: '' };
}

/**
 * @param {string} title
 */
export function slugEventId(title) {
  return String(title || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/**
 * @param {string | null | undefined} iso
 */
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * @param {string} local
 * @returns {number | null}
 */
function localMs(local) {
  if (!local) return null;
  const t = new Date(local).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Stage comes from the dates. Voting and entries only exist when those windows are on.
 * @param {Pick<EventFormValues, 'startsAt' | 'endsAt' | 'entriesEnabled' | 'entriesOpenAt' | 'entriesCloseAt' | 'votingEnabled' | 'votingStartsAt' | 'votingEndsAt'>} values
 * @param {Date} [now]
 * @returns {EventFormStatus}
 */
export function statusFromSchedule(values, now = new Date()) {
  const t = now.getTime();
  const start = localMs(values.startsAt);
  const end = localMs(values.endsAt);
  const entriesOpen = values.entriesEnabled ? localMs(values.entriesOpenAt) : null;
  const entriesClose = values.entriesEnabled ? localMs(values.entriesCloseAt) : null;
  const votingOpen = values.votingEnabled ? localMs(values.votingStartsAt) : null;
  const votingClose = values.votingEnabled ? localMs(values.votingEndsAt) : null;

  if (votingOpen != null && votingClose != null && t >= votingOpen && t < votingClose) return 'voting';
  if (entriesOpen != null && entriesClose != null && t >= entriesOpen && t < entriesClose) {
    return 'accepting-entries';
  }
  if (!values.votingEnabled && entriesClose != null && t >= entriesClose && end != null && t < end) {
    return 'judging';
  }

  const ends = [end, entriesClose, votingClose].filter((n) => n != null);
  const lastEnd = ends.length ? Math.max(...ends) : null;
  if (lastEnd != null && t >= lastEnd) return 'ended';
  if (start != null && t < start) return 'upcoming';
  if (start != null && t >= start) return 'live';
  return 'upcoming';
}

/**
 * @param {EventFormStatus} status
 */
export function statusLabel(status) {
  return EVENT_STATUS_LABELS[status] || 'Upcoming';
}

/**
 * @param {Pick<EventFormValues, 'startsAt' | 'endsAt' | 'entriesEnabled' | 'entriesOpenAt' | 'entriesCloseAt' | 'votingEnabled' | 'votingStartsAt' | 'votingEndsAt'>} s
 * @returns {string}
 */
export function scheduleError(s) {
  if (s.startsAt && s.endsAt && s.endsAt < s.startsAt) return 'Event ends after it starts.';
  if (s.entriesEnabled) {
    if (s.entriesOpenAt && s.entriesCloseAt && s.entriesCloseAt <= s.entriesOpenAt) {
      return 'Entries close after they open.';
    }
    if (s.entriesOpenAt && s.startsAt && s.entriesOpenAt < s.startsAt) {
      return 'Entries open after the event starts.';
    }
    if (s.entriesCloseAt && s.endsAt && s.entriesCloseAt > s.endsAt) {
      return 'Entries close before the event ends.';
    }
  }
  if (s.votingEnabled) {
    if (s.votingStartsAt && s.votingEndsAt && s.votingEndsAt <= s.votingStartsAt) {
      return 'Voting ends after it opens.';
    }
    const after = s.entriesEnabled ? s.entriesCloseAt : s.startsAt;
    if (s.votingStartsAt && after && s.votingStartsAt < after) {
      return s.entriesEnabled ? 'Voting opens after entries close.' : 'Voting opens after the event starts.';
    }
    if (s.votingEndsAt && s.endsAt && s.votingEndsAt > s.endsAt) {
      return 'Voting ends before the event ends.';
    }
  }
  return '';
}

/** @returns {EventFormValues} */
export function blankEventForm() {
  return {
    slug: '',
    title: '',
    type: 'dps-stone',
    status: 'upcoming',
    featured: false,
    tag: '',
    blurb: '',
    image: '',
    titleIcon: '',
    discordHref: '',
    startsAt: '',
    endsAt: '',
    entriesEnabled: true,
    entriesOpenAt: '',
    entriesCloseAt: '',
    votingEnabled: true,
    votingStartsAt: '',
    votingEndsAt: '',
    judgeWindowSec: 15,
    minGameVersion: '',
    requiredItemIds: '',
    modeRanked: true,
    modeUnranked: true,
    maxEntriesPerUser: 3,
    showSimDpsOnEntry: true,
    leaderboardEnabled: true,
    leaderboardVisibility: 'after_close',
    prize: '',
    places: [emptyPlace(), emptyPlace(), emptyPlace()],
  };
}

/**
 * Map a public catalog event (DPS Stone shape) into the shared form.
 * @param {import('../events/catalog-data.js').CatalogEvent} event
 * @returns {EventFormValues}
 */
export function catalogEventToForm(event) {
  const base = blankEventForm();
  const entry = event.entry || {};
  const modes = entry.allowedModes || [];
  const schedule = event.schedule || {};
  base.slug = event.slug;
  base.title = event.title;
  base.type = /** @type {EventFormType} */ (event.type);
  base.featured = Boolean(event.featured);
  base.tag = event.tag || event.kicker || '';
  base.blurb = event.blurb || '';
  base.image = event.image || '';
  base.titleIcon = event.titleIcon || '';
  base.discordHref = event.discordHref || '';
  base.startsAt = toLocalInput(schedule.startsAt);
  base.endsAt = toLocalInput(schedule.endsAt);
  base.entriesCloseAt = toLocalInput(schedule.entriesCloseAt);
  base.votingEndsAt = toLocalInput(schedule.votingEndsAt);
  base.entriesEnabled = Boolean(event.entry) || Boolean(schedule.entriesCloseAt);
  base.votingEnabled = event.features?.hasVoting === true;
  base.entriesOpenAt =
    toLocalInput(schedule.entriesOpenAt) || (base.entriesEnabled ? base.startsAt : '');
  base.votingStartsAt =
    toLocalInput(schedule.votingStartsAt) ||
    (base.votingEnabled ? base.entriesCloseAt || base.startsAt : '');
  base.status = statusFromSchedule(base);
  base.judgeWindowSec = Number(entry.judgeWindowSec) || 15;
  base.minGameVersion = entry.minGameVersion || '';
  base.requiredItemIds = (entry.requiredItemIds || []).join(', ');
  base.modeRanked = modes.includes('ranked');
  base.modeUnranked = modes.includes('unranked');
  base.maxEntriesPerUser = Number(entry.maxEntriesPerUser) || 1;
  base.showSimDpsOnEntry = entry.showSimDpsOnEntry !== false;
  base.leaderboardEnabled = entry.leaderboardVisibility !== 'off';
  base.leaderboardVisibility =
    entry.leaderboardVisibility === 'hidden' || entry.leaderboardVisibility === 'live'
      ? entry.leaderboardVisibility
      : 'after_close';
  base.prize = event.prize || '';
  const byPlace = new Map((event.prizePlaces || []).map((row) => [row.place, row]));
  base.places = PLACE_LABELS.map((place) => placeFromPrizes(byPlace.get(place)?.prizes));
  return base;
}

/**
 * @param {unknown[] | undefined} prizes
 * @returns {EventFormPlace}
 */
function placeFromPrizes(prizes) {
  const out = emptyPlace();
  for (const raw of prizes || []) {
    if (!raw || typeof raw !== 'object') continue;
    const prize = /** @type {{ icon?: string, amount?: number, label?: string, cosmeticId?: string }} */ (
      raw
    );
    if (prize.cosmeticId) out.cosmeticId = String(prize.cosmeticId);
    const icon = String(prize.icon || '');
    if (prize.amount != null && /gold/i.test(icon)) out.gold = String(prize.amount);
    if (/amazon|gift/i.test(icon)) out.giftCard = String(prize.label || '');
    if (/discord/i.test(icon)) out.discordTitle = String(prize.label || '');
  }
  return out;
}

/**
 * @param {EventFormValues} values
 * @returns {EventFormValues}
 */
export function cloneEventForm(values) {
  return {
    ...values,
    places: (values.places || []).map((p) => ({ ...emptyPlace(), ...p })),
  };
}
