/**
 * The signed-in player's boards for one event.
 */

import { getProfile, getSession } from '../../shared/auth.js';
import { getSupabase } from '../../shared/supabase.js';
import { buildViewHref } from '../create/publish.js';
import { mountFeedBoardThumbs } from '../builds/board-thumbs.js';

const ITEM_SELECT =
  'id, gid, name, rarity, type, class, extra_types, tags, cost, effect, image, shape, sockets, accuracy, cooldown, stamina_cost, damage_min, damage_max, block, chance, chance_tag, params';

/**
 * @typedef {{
 *   id: number,
 *   slug: string,
 *   title: string,
 *   board_still_path?: string | null,
 *   placements?: object[],
 * }} MyEventEntry
 */

/**
 * @param {string} slug
 * @returns {Promise<MyEventEntry[]>}
 */
export async function loadMyEventEntries(slug) {
  const id = String(slug || '').trim();
  if (!id) return [];
  const session = await getSession();
  if (!session?.access_token) return [];
  const profile = await getProfile().catch(() => null);
  if (!profile?.id) return [];
  const { data, error } = await getSupabase()
    .from('builds')
    .select(
      `
      id, slug, title, hero_class, gold_count, rank, board_still_path,
      placements:build_placements (
        id, x, y, r, gems,
        item:items ( ${ITEM_SELECT} )
      )
    `,
    )
    .eq('author_id', profile.id)
    .eq('event_slug', id)
    .order('created_at', { ascending: false });
  if (error || !Array.isArray(data)) return [];
  return data.map((row) => ({
    id: Number(row.id),
    slug: String(row.slug),
    title: String(row.title || row.slug),
    hero_class: row.hero_class || null,
    gold_count: row.gold_count ?? null,
    rank: row.rank || null,
    board_still_path: row.board_still_path || null,
    author_name: String(profile.display_name || '').trim() || 'You',
    author_avatar_url: profile.avatar_url || null,
    author_equipped_avatar: profile.equipped_avatar ?? null,
    placements: Array.isArray(row.placements) ? row.placements : [],
  }));
}

/**
 * Board stills, same path as the home curated vault.
 * @param {ParentNode} host
 * @param {MyEventEntry[]} builds
 * @param {string} root
 * @param {number} [cellPx]
 * @returns {Promise<() => void>}
 */
export async function mountEntryBoards(host, builds, root, cellPx = 22) {
  const list = host.querySelector('[data-event-entry-boards]');
  if (!(list instanceof HTMLElement) || !builds.length) return () => {};
  const base = root.endsWith('/') ? root : `${root}/`;
  const [shapesRes, socketsRes, spriteRes] = await Promise.all([
    fetch(`${base}assets/data/item-shapes.json`).catch(() => null),
    fetch(`${base}assets/data/socket-offsets.json`).catch(() => null),
    fetch(`${base}assets/data/sprite-display.json`).catch(() => null),
  ]);
  return mountFeedBoardThumbs(list, {
    builds,
    root: base,
    spriteDisplay: spriteRes?.ok ? await spriteRes.json() : null,
    shapes: shapesRes?.ok ? await shapesRes.json() : null,
    sockets: socketsRes?.ok ? await socketsRes.json() : null,
    boardAttr: 'data-event-entry-board',
    tipSelector: '[data-event-entry-tip]',
    cellPx,
    emptyHtml: '<span class="event-entry-board__empty">No board</span>',
  });
}

/**
 * @param {MyEventEntry[]} rows
 * @param {string} root
 * @param {string} listClass
 */
export function entryCardsHtml(rows, root, listClass) {
  const items = rows
    .map((row) => {
      const slug = String(row.slug || '');
      const title = String(row.title || slug);
      return `<li>
        <a class="event-entry-card" href="${escapeHtml(buildViewHref(slug, root))}" data-event-entry-tip>
          <span class="event-entry-card__board" data-event-entry-board="${escapeHtml(slug)}" aria-hidden="true"></span>
          <span class="event-entry-card__title">${escapeHtml(title)}</span>
        </a>
      </li>`;
    })
    .join('');
  return `<ul class="${listClass}" data-event-entry-boards>${items}</ul>`;
}

/**
 * @param {string} s
 */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** @type {WeakMap<ParentNode, () => void>} */
const mounts = new WeakMap();
let fillSeq = 0;

/**
 * @param {ParentNode} host
 */
export function clearMyEventEntries(host) {
  mounts.get(host)?.();
  mounts.delete(host);
}

/**
 * @param {ParentNode} host
 * @param {string} slug
 * @param {string} root
 */
export async function fillMyEventEntries(host, slug, root) {
  const box = host.querySelector('[data-event-my-entries]');
  if (!(box instanceof HTMLElement)) return;
  const token = String(++fillSeq);
  box.dataset.entryMount = token;
  mounts.get(host)?.();
  const rows = await loadMyEventEntries(slug);
  if (!box.isConnected || box.dataset.entryMount !== token) return;
  if (!rows.length) {
    box.innerHTML = '';
    mounts.delete(host);
    return;
  }
  box.innerHTML = `
    <p class="events-detail-stage__entries-label">Your entries</p>
    ${entryCardsHtml(rows, root, 'events-detail-stage__entries')}`;
  const off = await mountEntryBoards(box, rows, root, 28);
  if (!box.isConnected || box.dataset.entryMount !== token) {
    off();
    return;
  }
  mounts.set(host, off);
}
