/**
 * One Reddit-style build post row for the catalog feed.
 */

import { classIconPath } from '../../shared/class-icons.js';
import { profileHref as hrefForProfile } from '../../shared/profile-href.js';
import { resolveSubclassItem } from '../../shared/subclass-items.js';
import { postActionsHtml, postVoteHtml } from './post-actions.js';

const LEAGUE_ICONS = {
  bronze: 'League_Bronze.png',
  silver: 'League_Silver.png',
  gold: 'League_Gold.png',
  platinum: 'League_Platinum.png',
  diamond: 'League_Diamond.png',
  master: 'League_Master.png',
  grandmaster: 'League_Grandmaster.png',
  grandma: 'League_Grandma.png',
};

const RANK_LABELS = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  diamond: 'Diamond',
  master: 'Master',
  grandmaster: 'Grandmaster',
  grandma: 'Grandma',
};

/**
 * @param {string} slug
 * @param {string} root
 */
export function buildViewHref(slug, root) {
  const base = root.endsWith('/') ? root : `${root}/`;
  return `${base}builds/view/?slug=${encodeURIComponent(slug)}`;
}

/**
 * Reddit-ish relative upload time (“17 hr. ago”).
 * @param {string | null | undefined} iso
 */
export function formatRelativeTime(iso) {
  const t = Date.parse(String(iso || ''));
  if (!Number.isFinite(t)) return '';
  const sec = Math.round((Date.now() - t) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min. ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr} hr. ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? '' : 's'} ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo} mo. ago`;
  const yr = Math.round(mo / 12);
  return `${yr} yr. ago`;
}

/**
 * @param {object} build
 * @param {string} root
 * @param {string} name
 * @returns {{ src: string, initials: string }}
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

/**
 * @param {object} build
 * @param {string} root
 * @param {{ view?: 'card' | 'compact' }} [opts]
 */
export function postRowHtml(build, root, opts = {}) {
  const view = opts.view === 'compact' ? 'compact' : 'card';
  const base = root.endsWith('/') ? root : `${root}/`;
  const href = buildViewHref(build.slug, base);
  const title = String(build.title || 'Untitled');
  const author = String(build.author_name || 'Unknown').trim() || 'Unknown';
  const when = formatRelativeTime(build.created_at);
  const slug = String(build.slug || '');
  const hero = String(build.hero_class || '').trim();
  const isOp = Boolean(build.is_op);
  const avatar = resolveAvatar(build, base, author);

  const flairs = [];
  if (isOp) flairs.push({ kind: 'op', label: 'OP' });
  const authTag =
    build.build_tag === 'theorycraft' ? 'theory' : build.build_tag;
  if (authTag === 'feasible') flairs.push({ kind: 'feasible', label: 'Feasible' });
  if (authTag === 'theory') flairs.push({ kind: 'theory', label: 'Theory' });
  if (authTag === 'real') flairs.push({ kind: 'real', label: 'Real' });
  if (build.is_featured) flairs.push({ kind: 'featured', label: 'Featured' });

  const flairHtml = flairs.length
    ? `<span class="builds-post__flairs">${flairs
        .map(
          (f) =>
            `<span class="builds-post__flair builds-post__flair--${escapeAttr(f.kind)}">${escapeHtml(f.label)}</span>`,
        )
        .join('')}</span>`
    : '';

  const profileUrl = hrefForProfile(build.author_discord_id, base) || '';
  const avatarInner = avatar.src
    ? `<img class="builds-post__avatar" src="${escapeAttr(avatar.src)}" alt="" width="28" height="28" draggable="false" />`
    : `<span class="builds-post__avatar builds-post__avatar--initials" aria-hidden="true">${escapeHtml(avatar.initials)}</span>`;
  const avatarHtml = profileUrl
    ? `<a class="builds-post__avatar-link" href="${escapeAttr(profileUrl)}" aria-label="${escapeAttr(author)}">${avatarInner}</a>`
    : avatarInner;
  const authorInner = profileUrl
    ? `<a class="builds-post__author" href="${escapeAttr(profileUrl)}">${escapeHtml(author)}</a>`
    : `<span class="builds-post__author">${escapeHtml(author)}</span>`;

  const bylineHtml = `
    <span class="builds-post__byline">
      ${avatarHtml}
      ${authorInner}
      ${when ? `<span class="builds-post__dot" aria-hidden="true">·</span><span class="builds-post__time">${escapeHtml(when)}</span>` : ''}
    </span>`;

  const boardHtml = `
    <span
      class="builds-post__board"
      data-feed-board="${escapeAttr(slug)}"
      aria-hidden="true"
    ></span>`;

  if (view === 'compact') {
    return `
    <li class="builds-post builds-post--compact" data-build-slug="${escapeAttr(slug)}">
      <div class="builds-post__compact">
        <a class="builds-post__compact-thumb" href="${escapeAttr(href)}" tabindex="-1" aria-hidden="true">
          ${boardHtml}
        </a>
        <div class="builds-post__compact-side">
          <div class="builds-post__top">
            <div class="builds-post__meta">
              ${bylineHtml}
              <a class="builds-post__compact-text" href="${escapeAttr(href)}">
                <span class="builds-post__title">${escapeHtml(title)}</span>
                ${flairHtml}
              </a>
            </div>
            ${postVoteHtml(base)}
          </div>
          ${postActionsHtml(build, base)}
        </div>
      </div>
    </li>`;
  }

  const rankKey = String(build.rank || '').trim().toLowerCase();
  const rankLabel = RANK_LABELS[rankKey] || '';
  const leagueFile = LEAGUE_ICONS[rankKey];

  const classIcon = classIconPath(base, hero);
  const classCell = classIcon
    ? `<img class="builds-post__info-icon" src="${escapeAttr(classIcon)}" alt="${escapeAttr(hero)}" title="${escapeAttr(hero)}" width="48" height="48" draggable="false" />`
    : `<span class="builds-post__info-icon builds-post__info-icon--empty" aria-hidden="true"></span>`;

  const sub = resolveSubclassItem(build);
  const subTitle = sub
    ? `${sub.subclass}${sub.name ? ` (${sub.name})` : ''}`
    : '';
  const subCell = sub?.image
    ? `<img class="builds-post__info-icon" src="${escapeAttr(base)}assets/item-sprites/${escapeAttr(sub.image)}" alt="${escapeAttr(sub.subclass)}" title="${escapeAttr(subTitle)}" width="48" height="48" draggable="false" />`
    : `<span class="builds-post__info-icon builds-post__info-icon--empty" aria-hidden="true"></span>`;

  const rankCell = leagueFile
    ? `<img class="builds-post__info-icon builds-post__info-icon--rank" src="${escapeAttr(base)}assets/icons/leagues/${escapeAttr(leagueFile)}" alt="${escapeAttr(rankLabel)}" title="${escapeAttr(rankLabel)}" width="48" height="48" draggable="false" />`
    : `<span class="builds-post__info-icon builds-post__info-icon--empty" aria-hidden="true"></span>`;

  const goldRaw = build.gold_count;
  const goldNum = Number(goldRaw);
  const goldValue =
    goldRaw != null && goldRaw !== '' && Number.isFinite(goldNum)
      ? `<span class="builds-post__gold">
        <span class="builds-post__gold-num">${escapeHtml(String(Math.round(goldNum)))}</span>
        <img class="builds-post__gold-icon" src="${escapeAttr(base)}assets/tooltips/icons/Gold.png" alt="" width="28" height="28" draggable="false" />
      </span>`
      : `<span class="builds-post__info-empty">—</span>`;

  return `
    <li class="builds-post" data-build-slug="${escapeAttr(slug)}">
      <div class="builds-post__top">
        <div class="builds-post__meta">
          ${bylineHtml}
          <a class="builds-post__head" href="${escapeAttr(href)}">
            <span class="builds-post__title">${escapeHtml(title)}</span>
            ${flairHtml}
          </a>
        </div>
        ${postVoteHtml(base)}
      </div>
      <div class="builds-post__body">
        <a class="builds-post__link" href="${escapeAttr(href)}" aria-label="${escapeAttr(title)}">
          <span class="builds-post__stage">
            ${boardHtml}
            <aside class="builds-post__info" aria-label="Build details">
              <header class="builds-post__info-head">
                <span class="builds-post__info-title">Build Info</span>
              </header>
              <div class="builds-post__info-grid">
                <div class="builds-post__info-cell">
                  <span class="builds-post__info-label">Class</span>
                  <span class="builds-post__info-value">${classCell}</span>
                </div>
                <div class="builds-post__info-cell">
                  <span class="builds-post__info-label">Rank</span>
                  <span class="builds-post__info-value">${rankCell}</span>
                </div>
                <div class="builds-post__info-cell builds-post__info-cell--wide">
                  <span class="builds-post__info-label">Sub</span>
                  <span class="builds-post__info-value">${subCell}</span>
                </div>
                <div class="builds-post__info-cell builds-post__info-cell--wide">
                  <span class="builds-post__info-label">Gold</span>
                  <span class="builds-post__info-value">${goldValue}</span>
                </div>
              </div>
            </aside>
          </span>
        </a>
        ${postActionsHtml(build, base)}
      </div>
    </li>`;
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
