/**
 * Static events catalog — no DB until the Phase 2 owner hub.
 *
 * Event banner art: **1280×720 PNG (16:9)** under `assets/events/<slug>.png`.
 * Same file for featured, cards, and detail hero (`object-fit: cover`).
 */

import { applyEventDraft, eventDraftForSlug } from './event-drafts.js';

/** @typedef {'live' | 'upcoming' | 'ended' | 'voting' | 'accepting-entries' | 'judging'} EventStatus */
/** @typedef {'dps-stone' | 'craft' | 'showcase'} EventType */

export const EVENT_STATUS_LABELS = {
  live: 'Live',
  upcoming: 'Upcoming',
  ended: 'Ended',
  voting: 'Voting',
  'accepting-entries': 'Accepting entries',
  judging: 'Judging',
};

/**
 * @typedef {{
 *   startsAt?: string | null,
 *   endsAt?: string | null,
 *   entriesOpenAt?: string | null,
 *   entriesCloseAt?: string | null,
 *   votingStartsAt?: string | null,
 *   votingEndsAt?: string | null,
 * }} EventSchedule
 *
 * @typedef {{
 *   name: string,
 *   avatarUrl?: string | null,
 *   blobUrl?: string | null,
 *   profileHref?: string | null,
 * }} EventParticipant
 *
 * @typedef {{
 *   slug: string,
 *   title: string,
 *   type: EventType,
 *   status: EventStatus,
 *   image: string,
 *   featured?: boolean,
 *   kicker?: string,
 *   tag?: string,
 *   mark?: string,
 *   tags?: { label: string, tone?: string }[],
 *   titleIcon?: string,
 *   blurb: string,
 *   datesLabel: string,
 *   schedule?: EventSchedule,
 *   participants?: EventParticipant[],
 *   participantCount?: number,
 *   prize?: string,
 *   prizeDetail?: string,
 *   prizePlaces?: { place: string, label?: string, icon?: string, prizes: (string | { icon?: string, amount?: number, label?: string, kind?: string, cosmeticId?: string, title?: string })[] }[],
 *   discordHref?: string,
 *   features?: { hasVoting?: boolean, hasBuilds?: boolean },
 *   entry?: {
 *     judgeWindowSec?: number,
 *     minGameVersion?: string,
 *     requiredItemIds?: string[],
 *     allowedModes?: ('ranked' | 'unranked')[],
 *     maxEntriesPerUser?: number,
 *     showSimDpsOnEntry?: boolean,
 *     leaderboardVisibility?: 'hidden' | 'after_close' | 'live',
 *   },
 *   sections?: { tab?: 'overview' | 'rules' | 'builds' | 'voting' | 'rewards' | 'join', heading: string, html: string }[],
 * }} CatalogEvent
 */

/** @type {CatalogEvent[]} */
export const CATALOG_EVENTS = [
  {
    slug: 'highest-dps',
    title: 'DPS Stone',
    type: 'dps-stone',
    status: 'upcoming',
    featured: true,
    image: 'assets/events/highest-dps.png',
    titleIcon: 'assets/item-sprites/Stone.png',
    tag: 'Highest DPS',
    mark: 'HDS I',
    tags: [
      { label: 'Highest DPS', tone: 'legendary' },
      { label: 'Real runs', tone: 'rare' },
      { label: 'Manual judge', tone: 'epic' },
      { label: 'Launch', tone: 'godly' },
    ],
    blurb:
      'Highest DPS on a stone board from a real ranked or unranked run. Proof is your history.db — we score vs a shared dummy for a fixed fight window.',
    datesLabel: '',
    entry: {
      judgeWindowSec: 15,
      // Version floor off for local testing — restore before launch (e.g. '1.2.0').
      minGameVersion: '0.0.0',
      requiredItemIds: ['stone'],
      allowedModes: ['ranked', 'unranked'],
      maxEntriesPerUser: 3,
      showSimDpsOnEntry: true,
      leaderboardVisibility: 'after_close',
    },
    schedule: {
      startsAt: '2026-09-28T17:00:00.000Z',
      endsAt: '2026-10-12T17:00:00.000Z',
      entriesCloseAt: '2026-10-10T17:00:00.000Z',
    },
    features: { hasVoting: false },
    participantCount: 18,
    participants: [
      { name: 'Mira', blobUrl: 'assets/blob/blob-base.png' },
      { name: 'Kai' },
      { name: 'Rook', blobUrl: 'assets/blob/blob-base.png' },
      { name: 'Sable' },
      { name: 'Vex', blobUrl: 'assets/blob/blob-base.png' },
      { name: 'Nyx' },
      { name: 'Orrin' },
    ],
    prize: 'Event Trophy',
    prizeDetail: '',
    prizePlaces: [
      {
        place: '1st',
        label: '1st place',
        icon: 'assets/icons/history/Trophy.png',
        prizes: [
          {
            icon: 'assets/blob/cosmetics/premium-crown.png',
            kind: 'item',
            cosmeticId: 'premium_crown',
            label: 'Premium Crown',
            title: 'Premium Crown — testing stand-in for the Event Trophy',
          },
          { icon: 'assets/tooltips/icons/Gold.png', amount: 500 },
          { icon: 'assets/icons/misc/AmazonGiftCard.png', label: '$10 GC', title: '$10 Amazon gift card' },
          { icon: 'assets/theme/ui/ui-icon-discord.png', label: 'Stone Champion' },
        ],
      },
      {
        place: '2nd',
        label: '2nd place',
        icon: 'assets/icons/history/Trophy.png',
        prizes: [
          { icon: 'assets/tooltips/icons/Gold.png', amount: 200 },
          { icon: 'assets/theme/ui/ui-icon-discord.png', label: 'Stone Contender' },
        ],
      },
    ],
    discordHref: 'https://discord.gg/s5WghmrFSp',
    sections: [
      {
        tab: 'overview',
        heading: 'The challenge',
        html: `<p>Build the strongest <strong>stone</strong> DPS board you can in a <strong>real</strong> Backpack Battles run — <strong>ranked or unranked only</strong> (customs do not count). The board must include at least one <strong>Stone</strong>.</p>
          <p>Your proof is the run’s <code>history.db</code>. We score every entry against the <strong>same blank/dummy foe</strong> for a fixed fight window so the opponent doesn’t decide the contest. Highest verified DPS wins the <strong>Event Trophy</strong>.</p>`,
      },
      {
        tab: 'overview',
        heading: 'Schedule',
        html: `<ul>
          <li><strong>Opens:</strong> Sep 28, 2026</li>
          <li><strong>Entries close:</strong> Oct 10, 2026</li>
          <li><strong>Closes:</strong> Oct 12, 2026</li>
        </ul>
        <p>Exact times are pinned in Discord when the event goes live.</p>`,
      },
      {
        tab: 'overview',
        heading: 'Who it is for',
        html: `<p>Anyone with a Discord-linked site account who can play a real BPB run and upload <code>history.db</code> proof.</p>
          <p>You do not need Premium or Founding to enter or to receive the Event Trophy if you win.</p>`,
      },
      {
        tab: 'rules',
        heading: 'Eligible runs',
        html: `<ul>
          <li><strong>Real runs only</strong> — ranked or unranked. Custom / private lobbies do not count.</li>
          <li>Build and fight in the actual game. A site-only sim board is not an entry by itself.</li>
          <li><strong>Proof:</strong> the <code>history.db</code> from that run (canonical). Optional Discord post / clip for hype — not the score source.</li>
          <li>Your Discord identity on the entry must match the account signed in on this site (needed to grant cosmetics).</li>
        </ul>`,
      },
      {
        tab: 'join',
        heading: 'Steps',
        html: `<ol>
          <li>Sign in on Smojo Builds with Discord.</li>
          <li>Play a <strong>real</strong> ranked or unranked run with <strong>Stone</strong> on the board.</li>
          <li>Click <strong>Enter event</strong> and upload that run’s <code>history.db</code>.</li>
          <li>Name your entry and submit — it becomes a permanent site build on your profile (no delete).</li>
        </ol>`,
      },
      {
        tab: 'join',
        heading: 'What to include',
        html: `<ul>
          <li><code>history.db</code> for the qualifying run (required).</li>
          <li>A title for the board (required).</li>
          <li>Optional: claimed in-game DPS, screenshot, or clip link (flavor only).</li>
        </ul>`,
      },
      {
        tab: 'rules',
        heading: 'Judging',
        html: `<ul>
          <li>Score = sim DPS vs a <strong>shared dummy</strong> for a fixed fight window (same <strong>N</strong> seconds for everyone).</li>
          <li>Live opponent DPS / photo / video are <strong>not</strong> the score — they don’t beat opponent RNG.</li>
          <li>Highest verified DPS wins. Ties and disputed files are settled by the owner.</li>
          <li>A results / highlight video may follow from the top boards — you do not need to film your own fight.</li>
        </ul>`,
      },
      {
        tab: 'rules',
        heading: 'Fair play',
        html: `<ul>
          <li>Do not edit or fake <code>history.db</code>.</li>
          <li>Entry cap applies (see event rules). Submitted entries <strong>cannot be deleted</strong>.</li>
          <li>Cheating or mismatched Discord accounts can be disqualified.</li>
          <li>Submitted boards stay <strong>private until the event ends</strong> (only you see yours), including while the winner is being scored, so others cannot copy. The gallery opens when the event ends.</li>
        </ul>`,
      },
    ],
  },
];

/**
 * Stage follows the schedule. Entries and voting only count while those windows are on.
 * Missing open times use the same defaults as the admin form: entries open at the start,
 * voting opens when entries close.
 * @param {CatalogEvent} event
 * @param {Date} [now]
 * @returns {EventStatus}
 */
export function statusForCatalogEvent(event, now = new Date()) {
  const schedule = event.schedule || {};
  const t = now.getTime();
  const start = isoMs(schedule.startsAt);
  const end = isoMs(schedule.endsAt);
  const entriesOn = Boolean(event.entry) || Boolean(schedule.entriesCloseAt);
  const votingOn = event.features?.hasVoting === true;
  const entriesOpen = entriesOn ? isoMs(schedule.entriesOpenAt) ?? start : null;
  const entriesClose = entriesOn ? isoMs(schedule.entriesCloseAt) : null;
  const votingOpen = votingOn ? isoMs(schedule.votingStartsAt) ?? entriesClose ?? start : null;
  const votingClose = votingOn ? isoMs(schedule.votingEndsAt) : null;

  if (votingOpen != null && votingClose != null && t >= votingOpen && t < votingClose) return 'voting';
  if (entriesOpen != null && entriesClose != null && t >= entriesOpen && t < entriesClose) {
    return 'accepting-entries';
  }
  // No public vote: entries are locked and the winner is still being scored.
  if (!votingOn && entriesClose != null && t >= entriesClose && end != null && t < end) {
    return 'judging';
  }

  const ends = [end, entriesClose, votingClose].filter((n) => n != null);
  const lastEnd = ends.length ? Math.max(...ends) : null;
  if (lastEnd != null && t >= lastEnd) return 'ended';
  if (start != null && t < start) return 'upcoming';
  if (start != null && t >= start) return 'live';
  return event.status || 'upcoming';
}

/**
 * @param {string | null | undefined} iso
 * @returns {number | null}
 */
function isoMs(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * @param {CatalogEvent} event
 * @returns {CatalogEvent}
 */
function withLiveStatus(event) {
  const status = statusForCatalogEvent(event);
  if (status === event.status) return event;
  return { ...event, status };
}

/**
 * @param {string | null | undefined} slug
 * @returns {CatalogEvent | null}
 */
export function getCatalogEvent(slug) {
  const id = String(slug || '').trim();
  if (!id) return null;
  const event = CATALOG_EVENTS.find((e) => e.slug === id) || null;
  if (!event) return null;
  const draft = eventDraftForSlug(id);
  return withLiveStatus(draft ? applyEventDraft(event, draft) : event);
}

/** @returns {CatalogEvent[]} */
export function listCatalogEvents() {
  return CATALOG_EVENTS.map((event) => withLiveStatus(event));
}

/** @returns {CatalogEvent | null} */
export function getFeaturedEvent() {
  const event = CATALOG_EVENTS.find((e) => e.featured) || null;
  return event ? withLiveStatus(event) : null;
}

/**
 * @param {CatalogEvent[]} events
 * @param {{ statuses: EventStatus[], q: string, type?: EventType | null }} state
 */
export function filterCatalogEvents(events, state) {
  const q = String(state.q || '')
    .trim()
    .toLowerCase();
  const statuses = state.statuses || [];
  const type = state.type || null;
  return events.filter((e) => {
    if (statuses.length && !statuses.includes(e.status)) return false;
    if (type && e.type !== type) return false;
    if (!q) return true;
    const hay = [e.title, e.blurb, e.kicker, e.tag, e.mark, e.prize, e.datesLabel, e.type]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}
