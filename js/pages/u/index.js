/**
 * Public profile — /u/{discord_id}/ (or /u/?d=)
 */

import { initNav } from '../../shared/nav.js';
import { initFooter } from '../../shared/footer.js';
import { getSupabase } from '../../shared/supabase.js';
import { skelBar, skelBlock, skelRegion } from '../../shared/skeleton.js';
import { mountFeedBoardThumbs } from '../builds/board-thumbs.js';
import { bindFeedPostActions } from '../builds/post-actions.js';
import { postRowHtml } from '../builds/post-row.js';

const ITEM_SELECT =
  'id, gid, name, rarity, type, class, extra_types, tags, cost, effect, image, shape, sockets, accuracy, cooldown, stamina_cost, damage_min, damage_max, block, chance, chance_tag, params';

function rootPrefix() {
  const raw = document.body?.dataset?.root ?? '../';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/**
 * @returns {string}
 */
function discordIdFromLocation() {
  const q = new URLSearchParams(location.search);
  const fromQuery = String(q.get('d') || q.get('id') || '').trim();
  if (fromQuery) return fromQuery;

  const parts = location.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  const uIdx = parts.lastIndexOf('u');
  if (uIdx >= 0 && parts[uIdx + 1]) return decodeURIComponent(parts[uIdx + 1]);
  return '';
}

async function boot() {
  initNav();
  initFooter();
  const main = document.getElementById('main');
  if (!(main instanceof HTMLElement)) return;
  const root = rootPrefix();
  const discordId = discordIdFromLocation();
  if (!discordId) {
    main.innerHTML = `<p class="build-status">Missing profile id. Use <code>/u/?d={discord_id}</code>.</p>`;
    return;
  }

    main.innerHTML = skelRegion(
    `<div class="profile-skel">
      <div class="profile-skel__persona">${skelBlock({ className: 'profile-skel__avatar' })}${skelBar({ width: '40%' })}</div>
      ${skelBar({ width: '55%' })}
      <div class="profile-skel__list">${skelBlock()}${skelBlock()}</div>
    </div>`,
    { label: 'Loading profile' },
  );

  try {
    const [profile, spriteDisplay, shapes, sockets] = await Promise.all([
      fetchProfile(discordId),
      fetchJson(`${root}assets/data/sprite-display.json`),
      fetchJson(`${root}assets/data/item-shapes.json`),
      fetchJson(`${root}assets/data/socket-offsets.json`),
    ]);

    if (!profile) {
      main.innerHTML = `<p class="build-status">Profile not found.</p>`;
      return;
    }

    const builds = await fetchAuthorBuilds(profile.id);
    const name = String(profile.display_name || profile.discord_id || 'Adventurer').trim();
    document.title = `${name} — Smojo Builds`;

    const avatar = String(profile.avatar_url || '').trim();
    const avatarHtml = avatar
      ? `<img class="profile-persona__avatar" src="${escapeAttr(avatar)}" alt="" width="72" height="72" />`
      : `<span class="profile-persona__avatar profile-persona__avatar--empty" aria-hidden="true"></span>`;

    const listHtml = builds.length
      ? `<ul class="builds-feed__list builds-feed__list--card" aria-label="Builds by ${escapeAttr(name)}">${builds
          .map((b) =>
            postRowHtml(
              {
                ...b,
                author_discord_id: profile.discord_id,
                author_avatar_url: profile.avatar_url,
                author_name: name,
              },
              root,
              { view: 'card' },
            ),
          )
          .join('')}</ul>`
      : `<p class="build-status builds-feed__empty">No public builds yet.</p>`;

    main.innerHTML = `
      <header class="profile-persona">
        ${avatarHtml}
        <div class="profile-persona__text">
          <h1 class="profile-persona__name profile-ui-text">${escapeHtml(name)}</h1>
          <p class="profile-persona__meta profile-ui-text">Discord · ${escapeHtml(String(profile.discord_id))}</p>
        </div>
      </header>
      <section class="profile-builds" aria-label="Public builds">
        <h2 class="profile-builds__title profile-ui-text">Builds</h2>
        <div data-profile-list>${listHtml}</div>
      </section>
    `;

    const list = main.querySelector('.builds-feed__list');
    if (list instanceof HTMLElement && builds.length) {
      mountFeedBoardThumbs(list, {
        builds,
        root,
        view: 'card',
        spriteDisplay,
        shapes,
        sockets,
      });
      bindFeedPostActions(list, { builds, root });
    }
  } catch (err) {
    console.error(err);
    main.innerHTML = `<p class="build-status">Could not load profile.</p>`;
  }
}

/**
 * @param {string} discordId
 */
async function fetchProfile(discordId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, discord_id, display_name, avatar_url')
    .eq('discord_id', discordId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * @param {string} authorId
 */
async function fetchAuthorBuilds(authorId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('builds')
    .select(
      `
      slug, title, hero_class, blurb, is_op, is_featured, build_tag, vote_score,
      author_id, author_name, rank, gold_count, youtube_url, created_at, updated_at,
      placements:build_placements (
        id, x, y, r, gems,
        item:items ( ${ITEM_SELECT} )
      )
    `,
    )
    .eq('is_public', true)
    .eq('author_id', authorId)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) throw error;
  return data ?? [];
}

/**
 * @param {string} path
 */
async function fetchJson(path) {
  try {
    const res = await fetch(path, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

boot();
