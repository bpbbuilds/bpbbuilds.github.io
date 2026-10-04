/**
 * Public winner result for events that are judged by an owner instead of a
 * community vote. The endpoint acknowledges a selection during judging but
 * only returns build details after the entry is public; the private
 * event_winners table is never queried from the browser.
 */

import { config } from '../../shared/config.js';
import { faceHtml, hydrateFaces } from '../../shared/blob-face.js';
import { profileHref } from '../../shared/profile-href.js';
import { boardStillPublicUrl } from '../../shared/board-still/index.js';
import { buildViewHref } from '../builds/post-row.js';

/** @typedef {import('./catalog-data.js').CatalogEvent} CatalogEvent */

/**
 * @param {CatalogEvent} event
 * @returns {string}
 */
export function winnerStageHtml(event) {
  return `
    <div class="events-detail-stage__panel events-detail-stage__panel--bands events-detail-winner" data-event-detail-stage-panel="winner" data-event-winner="${escapeAttr(event.slug)}">
      <div class="events-detail-stage__card events-detail-stage__empty" role="status" data-event-winner-status>
        <p class="events-detail-stage__empty-title">Loading winner</p>
        <p class="events-detail-stage__blurb">Checking the official result for <strong>${escapeHtml(event.title)}</strong>.</p>
      </div>
    </div>`;
}

/**
 * Load and paint the selected winner in the currently active detail stage.
 * @param {ParentNode} scope
 * @param {CatalogEvent} event
 * @param {string} root
 */
export async function hydrateEventWinner(scope, event, root) {
  const host = scope.querySelector(`[data-event-winner="${cssEscape(event.slug)}"]`);
  if (!(host instanceof HTMLElement)) return;
  const status = host.querySelector('[data-event-winner-status]');
  if (!(status instanceof HTMLElement)) return;

  const result = await fetchEventWinner(event.slug);
  if (!host.isConnected) return;
  if (!result.ok) {
    status.innerHTML = emptyWinnerHtml(event, 'The winner could not be loaded right now. Please try again shortly.');
    return;
  }
  if (!result.winner) {
    status.innerHTML = emptyWinnerHtml(
      event,
      event.status === 'ended'
        ? 'The official result has not been announced yet.'
        : 'Judging is still in progress. The winning build will appear here once it is public.',
    );
    return;
  }
  if (!result.winner.build) {
    status.innerHTML = pendingWinnerHtml(
      event,
      event.status === 'ended'
        ? 'The winner has been selected. The board is being made public and will appear here shortly.'
        : 'The winner has been selected. The winning build will appear here once the event results are public.',
    );
    return;
  }

  const build = result.winner.build;
  const base = root.endsWith('/') ? root : `${root}/`;
  const title = String(build.title || 'Winning build').trim() || 'Winning build';
  const author = String(build.author_name || 'Unknown').trim() || 'Unknown';
  const className = String(build.hero_class || '').trim();
  const href = buildViewHref(build.slug, base);
  const profile = profileHref(build.author_discord_id, base);
  const authorHref = profile
    ? `<a class="events-winner__author" href="${escapeAttr(profile)}">${escapeHtml(author)}</a>`
    : `<span class="events-winner__author">${escapeHtml(author)}</span>`;
  const face =
    faceHtml(
      {
        avatar_url: build.author_avatar_url,
        equipped_avatar: build.author_equipped_avatar,
      },
      base,
      { className: 'events-winner__face', size: 112, alt: author },
    ) || `<span class="events-winner__face events-winner__face--initials" aria-hidden="true">${escapeHtml(initials(author))}</span>`;
  const selectedAt = formatDate(result.winner.selected_at);
  const meta = [className, build.rank ? String(build.rank) : '', selectedAt ? `Selected ${selectedAt}` : '']
    .filter(Boolean)
    .map((part) => `<span>${escapeHtml(part)}</span>`)
    .join('<span class="events-winner__meta-dot" aria-hidden="true">·</span>');

  status.outerHTML = `
    <article class="events-detail-stage__card events-winner-card" data-event-winner-card>
      <div class="events-winner-card__heading">
        <p class="events-detail-stage__empty-title">Official winner</p>
        <p class="events-detail-stage__blurb">The owner-selected winning build for <strong>${escapeHtml(event.title)}</strong>.</p>
      </div>
      <div class="events-winner-card__body">
        <div class="events-winner-card__face">${face}</div>
        <div class="events-winner-card__copy">
          <p class="events-winner-card__eyebrow">Champion</p>
          <h2 class="events-winner-card__title">${escapeHtml(title)}</h2>
          <p class="events-winner-card__byline">${authorHref}</p>
          ${meta ? `<p class="events-winner-card__meta">${meta}</p>` : ''}
          <a class="events-cta events-winner-card__link" href="${escapeAttr(href)}">View winning build</a>
        </div>
      </div>
      <div class="events-winner-card__board" data-event-winner-board aria-label="Winning build board"></div>
    </article>`;

  await hydrateFaces(host, base);
  const board = host.querySelector('[data-event-winner-board]');
  if (!(board instanceof HTMLElement) || !host.isConnected) return;
  const still = await boardStillPublicUrl(build.board_still_path).catch(() => null);
  if (!still || !board.isConnected) return;
  board.innerHTML = `<img src="${escapeAttr(still)}" alt="${escapeAttr(title)} board preview" loading="lazy" decoding="async" />`;
}

export async function fetchEventWinner(slug) {
  const endpoint = String(
    config.eventWinnerUrl ||
      (config.supabaseUrl ? `${String(config.supabaseUrl).replace(/\/$/, '')}/functions/v1/event-winner` : ''),
  ).trim();
  if (!endpoint) return { ok: false, winner: null };
  try {
    const url = new URL(endpoint);
    url.searchParams.set('event', slug);
    const res = await fetch(url, {
      headers: {
        apikey: String(config.supabasePublishableKey || ''),
        'x-client-info': 'bpb-events-winner',
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return { ok: false, winner: null };
    const json = await res.json();
    return { ok: true, winner: json?.winner || null };
  } catch {
    return { ok: false, winner: null };
  }
}

function emptyWinnerHtml(event, message) {
  return `
    <p class="events-detail-stage__empty-title">Winner not announced yet</p>
    <p class="events-detail-stage__blurb">${escapeHtml(message)} <strong>${escapeHtml(event.title)}</strong> updates will appear here.</p>`;
}

function pendingWinnerHtml(event, message) {
  return `
    <p class="events-detail-stage__empty-title">Winner selected</p>
    <p class="events-detail-stage__blurb">${escapeHtml(message)} <strong>${escapeHtml(event.title)}</strong> updates will appear here.</p>`;
}

function initials(name) {
  return (
    String(name || '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?'
  );
}

function formatDate(value) {
  const date = new Date(String(value || ''));
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function cssEscape(value) {
  const text = String(value || '');
  return text.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char.charCodeAt(0).toString(16)} `);
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
