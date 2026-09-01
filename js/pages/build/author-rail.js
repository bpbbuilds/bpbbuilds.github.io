/**
 * Build author credit — left of the backpack (avatar, name, more builds).
 * Discord profiles link to /u/{discord_id}/; Smojo still links to YouTube.
 * “More builds” thumbnails are mounted by more-builds.js (interactive grids).
 */

import { SMOJO_YOUTUBE_URL } from '../../shared/social-links.js';
import { profileHref } from '../../shared/profile-href.js';

const SMOJO_YT = SMOJO_YOUTUBE_URL;

/**
 * @param {object} build
 * @param {string} root
 */
export function renderAuthorRail(build, root) {
  const base = root.endsWith('/') ? root : `${root}/`;
  const name = String(build?.author_name || '').trim() || 'Unknown';
  const avatar = resolveAvatar(build, base, name);
  const href = authorHref(build, name, base);
  const nameClass = 'build-author__name build-info__ui-text';
  const external = Boolean(href && /^https?:\/\//i.test(href));
  const discordId = String(build?.author_discord_id || '').trim();
  const moreTitle = discordId ? `More by ${name}` : 'More builds';
  const viewAllHref = profileHref(discordId, base);

  const moreBlock = `
      <section class="build-author__more" aria-label="${escapeAttr(moreTitle)}" hidden>
        <h3 class="build-author__more-title build-info__ui-text">${escapeHtml(moreTitle)}</h3>
        <ul class="build-author__more-list"></ul>
        ${
          viewAllHref
            ? `<a class="build-author__more-all build-info__ui-text" href="${escapeAttr(viewAllHref)}">View all</a>`
            : ''
        }
      </section>`;

  const nameHtml = href
    ? `<a class="${nameClass}" href="${escapeAttr(href)}"${
        external ? ' target="_blank" rel="noopener noreferrer"' : ''
      }>${escapeHtml(name)}</a>`
    : `<p class="${nameClass}">${escapeHtml(name)}</p>`;

  const avatarInner = avatar.src
    ? `<img class="build-author__avatar" src="${escapeAttr(avatar.src)}" alt="" width="96" height="96" />`
    : `<span class="build-author__avatar build-author__avatar--initials" aria-hidden="true">${escapeHtml(avatar.initials)}</span>`;

  const avatarHtml = href
    ? `<a class="build-author__avatar-link" href="${escapeAttr(href)}"${
        external ? ' target="_blank" rel="noopener noreferrer"' : ''
      } aria-label="${escapeAttr(name)}">${avatarInner}</a>`
    : avatarInner;

  return `
    <aside class="build-author" aria-label="Build creator">
      <div class="build-author__card">
        <div class="build-author__avatar-wrap">
          ${avatarHtml}
        </div>
        ${nameHtml}
        ${moreBlock}
      </div>
    </aside>
  `;
}

/**
 * @param {object} build
 * @param {string} name
 * @param {string} root
 */
function authorHref(build, name, root) {
  const byDiscord = profileHref(build?.author_discord_id, root);
  if (byDiscord) return byDiscord;
  const url = String(build?.author_url || '').trim();
  if (url) return url;
  if (/^smojo$/i.test(name)) return SMOJO_YT;
  return null;
}

/**
 * @param {object} build
 * @param {string} root
 * @param {string} name
 */
function resolveAvatar(build, root, name) {
  const custom = String(build?.author_avatar_url || '').trim();
  if (custom) return { src: custom, initials: '' };

  if (/^smojo$/i.test(name)) {
    return {
      src: `${root}assets/brand/logo-backpack-battles-builds.png`,
      initials: '',
    };
  }

  const parts = name.split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : name.slice(0, 2).toUpperCase();
  return { src: '', initials: initials || '?' };
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
