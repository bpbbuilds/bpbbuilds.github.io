/**
 * Event detail hub — left tabs, middle stage, right panel (profile/admin pattern).
 */

/** @typedef {import('./catalog-data.js').CatalogEvent} CatalogEvent */
/** @typedef {import('./detail-tabs.js').EventDetailTabId} EventDetailTabId */

import { eventStatusBarHtml, featuredPrizeColHtml } from './event-card.js';
import {
  eventBuildEntriesOpen,
  eventBuildEntriesUpcoming,
  eventBuildGalleryIsPublic,
} from './event-builds-privacy.js';
import { tabsForEvent } from './event-features.js';
import { fillMyEventEntries, clearMyEventEntries } from './event-my-entries.js';
import { eventTimerHtml } from './event-meta.js';
import { hydrateEventWinner, winnerStageHtml } from './event-winner.js';
import { openEnterWizard, resumeEnterWizardIfNeeded } from './enter-wizard.js';
import {
  EVENT_DETAIL_TAB_LABELS,
  eventDetailTabFromLocation,
  normalizeEventDetailTab,
  urlForEventDetailTab,
} from './detail-tabs.js';

/**
 * @param {CatalogEvent} event
 * @param {EventDetailTabId} active
 */
function railHtml(event, active) {
  const tabs = tabsForEvent(event);
  const tiles = tabs
    .map((id) => {
      const on = id === active;
      return `
      <li class="events-detail-rail__item">
        <button
          type="button"
          class="events-detail-rail__tile${on ? ' is-active' : ''}"
          data-event-detail-tab="${escapeAttr(id)}"
          ${on ? 'aria-current="page"' : ''}
        >${escapeHtml(EVENT_DETAIL_TAB_LABELS[id])}</button>
      </li>`;
    })
    .join('');

  return `
    <nav class="events-detail-rail" aria-label="Event sections">
      <ul class="events-detail-rail__list">${tiles}</ul>
    </nav>`;
}

/**
 * @param {CatalogEvent} event
 * @param {EventDetailTabId} tab
 */
function sectionsForTab(event, tab) {
  const all = Array.isArray(event.sections) ? event.sections : [];
  const tagged = all.filter((s) => (s.tab || 'overview') === tab);
  if (tagged.length) return tagged;
  if (tab === 'overview' && all.length && all.every((s) => !s.tab)) return all;
  return [];
}

/**
 * @param {{ heading: string, html: string }[]} sections
 */
function sectionsHtml(sections) {
  if (!sections.length) return '';
  return sections
    .map(
      (s) => `
      <section class="events-detail-stage__card events-detail-stage__block">
        <h3 class="events-detail-stage__heading">${escapeHtml(s.heading)}</h3>
        <div class="events-detail-stage__prose">${s.html}</div>
      </section>`,
    )
    .join('');
}

/**
 * @param {CatalogEvent} event
 * @param {string} root
 */
function overviewHeroHtml(event, root) {
  const base = root.endsWith('/') ? root : `${root}/`;
  const path = String(event.image || '').replace(/^\//, '');
  if (!path) return '';
  const src = `${base}${path}`;
  return `
    <figure class="events-detail-stage__hero">
      <img
        class="events-detail-stage__hero-img"
        src="${escapeAttr(src)}"
        alt=""
        width="640"
        height="360"
        decoding="async"
        draggable="false"
      />
    </figure>`;
}

/**
 * @param {CatalogEvent} event
 */
function overviewTagsHtml(event) {
  const tags = Array.isArray(event.tags) ? event.tags : [];
  if (!tags.length) return '';
  return `<ul class="events-detail-stage__tags" aria-label="Event tags">${tags
    .map(
      (t) =>
        `<li class="events-detail-stage__tag events-detail-stage__tag--${escapeAttr(t.tone || 'rare')}">${escapeHtml(t.label)}</li>`,
    )
    .join('')}</ul>`;
}

/**
 * @param {{ heading: string, html: string }} section
 * @param {string} [extraClass]
 */
function overviewCardHtml(section, extraClass = '') {
  const cls = extraClass
    ? `events-detail-stage__card ${extraClass}`
    : 'events-detail-stage__card';
  return `
    <section class="${cls}">
      <h3 class="events-detail-stage__heading">${escapeHtml(section.heading)}</h3>
      <div class="events-detail-stage__prose">${section.html}</div>
    </section>`;
}

/**
 * Overview: hero + challenge row, then fact cards in columns.
 * @param {CatalogEvent} event
 * @param {string} root
 */
function overviewStageHtml(event, root) {
  const sections = sectionsForTab(event, 'overview');
  const hero = overviewHeroHtml(event, root);
  const tags = overviewTagsHtml(event);
  const [lead, ...rest] = sections;
  if (!hero && !sections.length) {
    return `
      <div class="events-detail-stage__stub" data-event-detail-stage-panel="overview">
        <p class="events-detail-stage__blurb">Coming soon for ${escapeHtml(event.title)}.</p>
      </div>`;
  }
  const leadHtml = lead ? overviewCardHtml(lead, 'events-detail-stage__card--lead') : '';
  const factsHtml = rest.length
    ? `<div class="events-detail-stage__overview-facts">${rest
        .map((s) => overviewCardHtml(s))
        .join('')}</div>`
    : '';
  return `
    <div class="events-detail-stage__panel events-detail-stage__panel--overview" data-event-detail-stage-panel="overview">
      <div class="events-detail-stage__overview-lead">
        <div class="events-detail-stage__overview-media">
          ${hero}
          ${tags}
        </div>
        ${leadHtml}
      </div>
      ${factsHtml}
    </div>`;
}

/**
 * @param {CatalogEvent} event
 * @param {string} root
 */
function buildsStageHtml(event, root) {
  const base = root.endsWith('/') ? root : `${root}/`;
  const feedHref = `${base}builds/?event=${encodeURIComponent(event.slug)}`;
  const mineHref = `${feedHref}&mine=1`;
  const publicGallery = eventBuildGalleryIsPublic(event);
  const entriesOpen = eventBuildEntriesOpen(event);
  const upcoming = eventBuildEntriesUpcoming(event);

  let title;
  let blurb;
  let actions = '';

  const opensWhen = event.features?.hasVoting ? 'voting opens' : 'the event ends';
  if (event.status === 'judging') {
    title = 'Judging entries';
    blurb = `Entries are closed. Boards stay private while the highest DPS is scored for <strong>${escapeHtml(event.title)}</strong>. Only you can open your own entry.`;
  } else if (publicGallery) {
    title = 'Event builds';
    blurb = `Submitted boards for <strong>${escapeHtml(event.title)}</strong> are public. Browse them here on the Builds feed.`;
    actions = `<p class="events-detail-stage__actions">
      <a class="events-cta" href="${escapeAttr(feedHref)}">Browse event builds</a>
    </p>`;
  } else if (entriesOpen) {
    title = 'Your entry stays private';
    blurb = `Other players cannot see submitted boards, so nobody can copy mid-contest. After you enter, you can open <strong>your</strong> submission here. The gallery opens when ${opensWhen}.`;
    actions = `<p class="events-detail-stage__actions">
      <a class="events-cta" href="${escapeAttr(mineHref)}">View my entry</a>
    </p>`;
  } else if (upcoming) {
    title = 'Builds unlock later';
    blurb = `Entries aren't open yet. When the contest is running, only <strong>you</strong> will see your own board here. The gallery opens when ${opensWhen}.`;
  } else {
    title = 'Builds locked';
    blurb = `Boards for <strong>${escapeHtml(event.title)}</strong> stay private for now.`;
  }

  return `
    <div class="events-detail-stage__panel events-detail-stage__panel--bands" data-event-detail-stage-panel="builds">
      <div class="events-detail-stage__card events-detail-stage__empty" role="status">
        <p class="events-detail-stage__empty-title">${title}</p>
        <p class="events-detail-stage__blurb">${blurb}</p>
        <div data-event-my-entries></div>
        ${actions}
      </div>
    </div>`;
}

/**
 * @param {CatalogEvent} event
 * @param {string} root
 */
function votingStageHtml(event, root) {
  const base = root.endsWith('/') ? root : `${root}/`;
  const feedHref = `${base}builds/?event=${encodeURIComponent(event.slug)}`;
  const status = event.status;
  const voteEnds = event.schedule?.votingEndsAt
    ? new Date(event.schedule.votingEndsAt)
    : null;
  const endsLabel =
    voteEnds && Number.isFinite(voteEnds.getTime())
      ? voteEnds.toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : '';

  let title;
  let blurb;
  let actions = '';

  if (status === 'voting') {
    title = 'Community voting';
    blurb = `Entries are locked. Browse the public gallery and vote for your favorites on <strong>${escapeHtml(event.title)}</strong>${endsLabel ? ` — voting runs through <strong>${escapeHtml(endsLabel)}</strong>` : ''}.`;
    actions = `<p class="events-detail-stage__actions">
      <a class="events-cta" href="${escapeAttr(feedHref)}">Open boards to vote</a>
    </p>`;
  } else if (status === 'ended') {
    title = 'Voting closed';
    blurb = `Voting for <strong>${escapeHtml(event.title)}</strong> has ended. You can still browse the submitted boards.`;
    actions = `<p class="events-detail-stage__actions">
      <a class="events-cta" href="${escapeAttr(feedHref)}">Browse event builds</a>
    </p>`;
  } else if (status === 'accepting-entries' || status === 'live') {
    title = 'Voting comes next';
    blurb = `Boards stay private while entries are open. After entries close, this tab is where community voting will live for <strong>${escapeHtml(event.title)}</strong>.`;
  } else {
    title = 'Voting not open yet';
    blurb = `This event will include a community vote. Check back when the status flips to <strong>Voting</strong>.`;
  }

  const extra = sectionsHtml(sectionsForTab(event, 'voting'));

  return `
    <div class="events-detail-stage__panel events-detail-stage__panel--bands" data-event-detail-stage-panel="voting">
      <div class="events-detail-stage__card events-detail-stage__empty" role="status">
        <p class="events-detail-stage__empty-title">${title}</p>
        <p class="events-detail-stage__blurb">${blurb}</p>
        ${actions}
      </div>
      ${extra}
    </div>`;
}

/**
 * @param {CatalogEvent} event
 * @param {string} root
 */
function rewardsStageHtml(event, root) {
  return `
    <div class="events-detail-stage__panel events-detail-stage__panel--bands" data-event-detail-stage-panel="rewards">
      <div class="events-detail-stage__prize">
        ${featuredPrizeColHtml(event, root, { layout: 'grid', chrome: 'filter' })}
      </div>
    </div>`;
}

/**
 * @param {EventDetailTabId} tab
 * @param {CatalogEvent} event
 * @param {string} root
 */
function stageHtml(tab, event, root) {
  if (tab === 'overview') return overviewStageHtml(event, root);
  if (tab === 'builds') return buildsStageHtml(event, root);
  if (tab === 'voting') return votingStageHtml(event, root);
  if (tab === 'winner') return winnerStageHtml(event);
  if (tab === 'rewards') return rewardsStageHtml(event, root);

  const sections = sectionsForTab(event, tab);
  if (!sections.length) {
    return `
      <div class="events-detail-stage__stub" data-event-detail-stage-panel="${escapeAttr(tab)}">
        <p class="events-detail-stage__blurb">Coming soon for ${escapeHtml(event.title)}.</p>
      </div>`;
  }
  return `
    <div class="events-detail-stage__panel events-detail-stage__panel--bands" data-event-detail-stage-panel="${escapeAttr(tab)}">
      ${sectionsHtml(sections)}
    </div>`;
}

/**
 * Right column — status/timer + Enter CTA + how to join (sticky together).
 * @param {CatalogEvent} event
 * @param {string} root
 */
function asideHtml(event, root) {
  const joinSections = sectionsForTab(event, 'join');
  const steps = joinSections.length
    ? sectionsHtml(joinSections)
    : `<p class="events-detail-aside__hint">Join details land when this event opens. Watch Discord for the pin.</p>`;
  return `
    <div class="events-detail-join">
      <div class="events-detail-join__top">
        <div class="events-detail-join__station">
          ${eventStatusBarHtml(event)}
          ${eventTimerHtml(event, { root })}
        </div>
        ${enterCtaHtml(event)}
      </div>
      <aside class="events-detail-aside" aria-label="How to join">
        <header class="events-detail-aside__head">
          <h2 class="events-detail-aside__title">How to join</h2>
        </header>
        <div class="events-detail-aside__body">
          ${steps}
        </div>
      </aside>
    </div>`;
}

/**
 * @param {CatalogEvent} event
 */
function enterCtaHtml(_event) {
  return `
    <div class="events-detail-join__enter">
      <button type="button" class="events-cta events-detail-join__cta" data-event-enter>
        Enter event
      </button>
    </div>`;
}

/**
 * Title block — name, blurb, schedule note.
 * @param {CatalogEvent} event
 */
function personaHtml(event) {
  const dates = String(event.datesLabel || '').trim();
  return `
    <header class="events-detail-persona">
      <div class="events-detail-persona__copy">
        ${event.kicker ? `<p class="events-detail-persona__kicker">${escapeHtml(event.kicker)}</p>` : ''}
        <h1 class="events-detail-persona__title bpb-label-text">${escapeHtml(event.title)}</h1>
        ${dates ? `<p class="events-detail-persona__dates">${escapeHtml(dates)}</p>` : ''}
        <p class="events-detail-persona__blurb">${escapeHtml(event.blurb || '')}</p>
      </div>
    </header>`;
}

/**
 * @param {CatalogEvent} event
 * @param {{ root?: string, tab?: EventDetailTabId }} [opts]
 */
export function eventDetailHtml(event, opts = {}) {
  const root = opts.root || '';
  const base = root.endsWith('/') ? root : `${root}/`;
  const allowed = tabsForEvent(event);
  const tab = normalizeEventDetailTab(
    opts.tab || eventDetailTabFromLocation(allowed),
    allowed,
  );

  return `
    <article class="events-detail-hub" data-event-detail="${escapeAttr(event.slug)}" aria-label="${escapeAttr(event.title)}">
      ${personaHtml(event)}
      <div class="events-detail-grid">
        ${railHtml(event, tab)}
        <div class="events-detail-stage" data-event-detail-stage aria-live="polite">
          ${stageHtml(tab, event, base)}
        </div>
        ${asideHtml(event, base)}
      </div>
    </article>`;
}

/**
 * Bind left-rail tab swaps inside a painted detail hub.
 * @param {HTMLElement} rootEl
 * @param {CatalogEvent} event
 * @param {{ root?: string, onStage?: () => void }} [opts]
 * @returns {() => void}
 */
export function bindEventDetailHub(rootEl, event, opts = {}) {
  const hub = rootEl.querySelector('[data-event-detail]');
  if (!(hub instanceof HTMLElement)) return () => {};

  const siteRoot = (() => {
    const r = String(opts.root || '/').trim() || '/';
    return r.endsWith('/') ? r : `${r}/`;
  })();

  const allowed = tabsForEvent(event);

  /** @type {EventDetailTabId} */
  let active = normalizeEventDetailTab(eventDetailTabFromLocation(allowed), allowed);

  const paintStage = () => {
    const stage = hub.querySelector('[data-event-detail-stage]');
    if (stage instanceof HTMLElement) {
      stage.innerHTML = stageHtml(active, event, siteRoot);
    }
    hub.querySelectorAll('[data-event-detail-tab]').forEach((el) => {
      if (!(el instanceof HTMLButtonElement)) return;
      const id = normalizeEventDetailTab(el.getAttribute('data-event-detail-tab'), allowed);
      const on = id === active;
      el.classList.toggle('is-active', on);
      if (on) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    });
    opts.onStage?.();
    if (active === 'builds') void fillMyEventEntries(hub, event.slug, siteRoot);
    else clearMyEventEntries(hub);
    if (active === 'winner') void hydrateEventWinner(hub, event, siteRoot);
  };

  /** @param {EventDetailTabId} next */
  const setTab = (next, push) => {
    const tab = normalizeEventDetailTab(next, allowed);
    if (tab === active) return;
    active = tab;
    paintStage();
    try {
      const url = urlForEventDetailTab(tab);
      if (push) history.pushState({}, '', url);
      else history.replaceState({}, '', url);
    } catch {
      /* ignore */
    }
  };

  const onClick = (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const enterBtn = t.closest('[data-event-enter]');
    if (enterBtn instanceof HTMLButtonElement && hub.contains(enterBtn)) {
      e.preventDefault();
      void openEnterWizard(event, { root: siteRoot, returnFocusEl: enterBtn });
      return;
    }
    const btn = t.closest('[data-event-detail-tab]');
    if (!(btn instanceof HTMLButtonElement) || !hub.contains(btn)) return;
    e.preventDefault();
    setTab(normalizeEventDetailTab(btn.getAttribute('data-event-detail-tab'), allowed), true);
  };

  const onPop = () => {
    active = normalizeEventDetailTab(eventDetailTabFromLocation(allowed), allowed);
    paintStage();
  };

  hub.addEventListener('click', onClick);
  window.addEventListener('popstate', onPop);
  paintStage();
  void resumeEnterWizardIfNeeded(event, { root: siteRoot });

  return () => {
    hub.removeEventListener('click', onClick);
    window.removeEventListener('popstate', onPop);
  };
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
