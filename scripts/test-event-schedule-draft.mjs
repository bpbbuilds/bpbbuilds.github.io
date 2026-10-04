/** Regression check for edited event dates flowing into public status/timers. */
import assert from 'node:assert/strict';
import { applyEventDraft, scheduleSectionHtml } from '../js/pages/events/event-drafts.js';
import { statusForCatalogEvent } from '../js/pages/events/catalog-data.js';
import { eventBuildEntriesOpen } from '../js/pages/events/event-builds-privacy.js';

const base = {
  slug: 'test-event',
  title: 'Test event',
  status: 'accepting-entries',
  entry: { requiredItemIds: ['stone'] },
  features: { hasVoting: false },
  schedule: {
    startsAt: '2026-10-01T00:00:00.000Z',
    endsAt: '2026-10-20T00:00:00.000Z',
    entriesCloseAt: '2026-10-19T00:00:00.000Z',
  },
  sections: [{ tab: 'overview', heading: 'Schedule', html: '<ul><li>old date</li></ul>' }],
};
const edited = applyEventDraft(base, {
  slug: 'test-event',
  startsAt: '2026-10-01T00:00',
  endsAt: '2026-10-20T00:00',
  entriesOpenAt: '2026-10-01T00:00',
  entriesCloseAt: '2026-10-02T00:00',
  entriesEnabled: true,
  votingEnabled: false,
});

assert.equal(edited.schedule.entriesCloseAt, '2026-10-02T00:00');
assert.match(edited.sections[0].html, /Oct 2, 2026/);
assert.equal(
  statusForCatalogEvent(edited, new Date('2026-10-04T00:00:00Z')),
  'judging',
);
assert.equal(
  statusForCatalogEvent(edited, new Date('2026-10-21T00:00:00Z')),
  'ended',
);
assert.equal(eventBuildEntriesOpen(edited, Date.parse('2026-10-04T00:00:00Z')), false);
assert.match(scheduleSectionHtml(edited.schedule), /Oct 20, 2026/);
console.log('event schedule draft recovery passed');
