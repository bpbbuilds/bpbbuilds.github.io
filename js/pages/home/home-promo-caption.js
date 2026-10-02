/**
 * Create-promo caption above the demo board (author, title, class).
 * Build tags render under the board via `data-promo-board-tags`.
 *
 *   import { normalizePromoBuild, paintPromoCaption } from './home-promo-caption.js';
 */

import { classIconPath } from '../../shared/class-icons.js';
import { faceHtml, hydrateFaces } from '../../shared/blob-face.js';
import { profileHref } from '../../shared/profile-href.js';
import { buildViewHref, escapeAttr, escapeHtml } from './home-build-media.js';

/** Game league badge files under assets/icons/leagues/ */
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

/**
 * Attach live profile name/avatar/discord onto a builds row.
 * @param {object} row
 */
export function normalizePromoBuild(row) {
  const raw = row?.profile;
  const profile =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? raw
      : Array.isArray(raw)
        ? raw[0]
        : null;
  const discord_id = String(profile?.discord_id || '').trim();
  const avatar = String(profile?.avatar_url || '').trim();
  const equipped = profile?.equipped_avatar != null ? String(profile.equipped_avatar) : null;
  const liveName = String(profile?.display_name || '').trim();
  return {
    ...row,
    author_discord_id: discord_id || null,
    author_avatar_url: avatar || row.author_avatar_url || null,
    author_equipped_avatar: equipped,
    author_name: liveName || row.author_name || 'Unknown',
  };
}

/**
 * @param {object} build
 * @param {string} root
 * @param {string} name
 */
function authorFaceHtml(build, root, name) {
  const face = faceHtml(
    {
      avatar_url: build?.author_avatar_url,
      equipped_avatar: build?.author_equipped_avatar,
    },
    root,
    {
      className: 'home-promo__caption-avatar',
      size: 84,
      alt: name,
    },
  );
  if (face) return face;
  if (/^smojo$/i.test(name)) {
    return `<img class="home-promo__caption-avatar" src="${escapeAttr(`${root}assets/brand/logo-backpack-battles-builds.png`)}" alt="" width="84" height="84" draggable="false" />`;
  }
  const parts = name.split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : name.slice(0, 2).toUpperCase();
  return `<span class="home-promo__caption-avatar home-promo__caption-avatar--initials" aria-hidden="true">${escapeHtml(initials || '?')}</span>`;
}

/**
 * @param {object} build
 * @param {string} root
 */
function captionHtml(build, root) {
  const base = root.endsWith('/') ? root : `${root}/`;
  const title = String(build.title || 'Untitled').trim() || 'Untitled';
  const author = String(build.author_name || 'Unknown').trim() || 'Unknown';
  const slug = String(build.slug || '').trim();
  const href = slug ? buildViewHref(slug, base) : '';
  const hero = String(build.hero_class || '').trim();
  const icon = classIconPath(base, hero);
  const avatarInner = authorFaceHtml(build, base, author);
  const profileUrl = profileHref(build.author_discord_id, base) || '';

  const avatarHtml = profileUrl
    ? `<a class="home-promo__caption-avatar-link" href="${escapeAttr(profileUrl)}" aria-label="${escapeAttr(author)}">${avatarInner}</a>`
    : avatarInner;
  const authorHtml = profileUrl
    ? `<a class="home-promo__caption-author" href="${escapeAttr(profileUrl)}">${escapeHtml(author)}</a>`
    : `<span class="home-promo__caption-author">${escapeHtml(author)}</span>`;
  const titleHtml = href
    ? `<a class="home-promo__caption-title" href="${escapeAttr(href)}" title="${escapeAttr(title)}">${escapeHtml(title)}</a>`
    : `<span class="home-promo__caption-title" title="${escapeAttr(title)}">${escapeHtml(title)}</span>`;
  const classHtml = icon
    ? `<img class="home-promo__caption-class" src="${escapeAttr(icon)}" alt="${escapeAttr(hero)}" title="${escapeAttr(hero)}" width="36" height="36" draggable="false" />`
    : '';

  return `
    <header class="home-promo__caption-head${icon ? ' home-promo__caption-head--icon' : ''}">
      ${classHtml}
      ${titleHtml}
    </header>
    <div class="home-promo__caption-meta">
      <div class="home-promo__caption-side home-promo__caption-side--left">${avatarHtml}</div>
      ${authorHtml}
      <div class="home-promo__caption-side home-promo__caption-side--right" aria-hidden="true"></div>
    </div>
  `;
}

/** @param {string} key */
function titleCaseLeague(key) {
  if (key === 'grandma') return 'Grandma';
  if (key === 'grandmaster') return 'Grandmaster';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Gold + rank + blurb for the create-promo CTA column.
 * @param {object} build
 * @param {string} root
 */
function infoHtml(build, root) {
  const base = root.endsWith('/') ? root : `${root}/`;
  const goldNum = Number(build.gold_count);
  const goldHtml = Number.isFinite(goldNum)
    ? `<span class="home-promo__info-gold">
        <span class="home-promo__info-gold-num">${escapeHtml(String(Math.round(goldNum)))}</span>
        <img class="home-promo__info-gold-icon" src="${escapeAttr(`${base}assets/tooltips/icons/Gold.png`)}" alt="" width="28" height="28" draggable="false" />
      </span>`
    : `<span class="home-promo__info-empty">—</span>`;

  const rankKey = String(build.rank ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  const rankFile = LEAGUE_ICONS[rankKey];
  const rankHtml = rankFile
    ? `<img
        class="home-promo__info-rank"
        src="${escapeAttr(`${base}assets/icons/leagues/${rankFile}`)}"
        alt="${escapeAttr(titleCaseLeague(rankKey))}"
        title="${escapeAttr(titleCaseLeague(rankKey))}"
        width="48"
        height="48"
        draggable="false"
      />`
    : `<span class="home-promo__info-empty">—</span>`;

  const desc =
    String(build.blurb || '').trim() ||
    String(build.notes || '').trim() ||
    '';
  const descHtml = desc
    ? `<p class="home-promo__info-desc">${escapeHtml(desc)}</p>`
    : `<p class="home-promo__info-desc home-promo__info-desc--empty">No description yet.</p>`;

  return `
    <div class="home-promo__info-grid">
      <div class="home-promo__info-cell home-promo__info-shade">
        <span class="home-promo__info-label">Gold</span>
        ${goldHtml}
      </div>
      <div class="home-promo__info-cell home-promo__info-shade">
        <span class="home-promo__info-label">Rank</span>
        ${rankHtml}
      </div>
    </div>
    <div class="home-promo__info-how home-promo__info-shade">
      ${descHtml}
    </div>
  `;
}

/**
 * @param {HTMLAnchorElement | null | undefined} anchor
 * @param {string} href
 * @param {string} [ariaLabel]
 */
function bindPromoHref(anchor, href, ariaLabel) {
  if (!(anchor instanceof HTMLAnchorElement)) return;
  if (href) {
    anchor.href = href;
    if (ariaLabel) anchor.setAttribute('aria-label', ariaLabel);
    else anchor.removeAttribute('aria-label');
  } else {
    anchor.removeAttribute('href');
    anchor.removeAttribute('aria-label');
  }
}

/**
 * @param {object} build
 * @returns {{ kind: string, label: string }[]}
 */
function buildFlairs(build) {
  const flairs = [];
  if (build?.is_op) flairs.push({ kind: 'op', label: 'OP' });
  const authTag =
    build?.build_tag === 'theorycraft' ? 'theory' : build?.build_tag;
  if (authTag === 'feasible') flairs.push({ kind: 'feasible', label: 'Feasible' });
  if (authTag === 'theory') flairs.push({ kind: 'theory', label: 'Theory' });
  if (authTag === 'real') flairs.push({ kind: 'real', label: 'Real' });
  if (build?.is_featured) flairs.push({ kind: 'featured', label: 'Featured' });
  return flairs;
}

/**
 * @param {object} build
 */
function boardTagsHtml(build) {
  const flairs = buildFlairs(build);
  if (!flairs.length) return '';
  return flairs
    .map(
      (f) =>
        `<span class="home-promo__board-tag home-promo__board-tag--${escapeAttr(f.kind)}">${escapeHtml(f.label)}</span>`,
    )
    .join('');
}

/**
 * @param {Element | null} el
 * @param {object | null} build
 * @param {string} root
 * @param {HTMLAnchorElement | null} [boardLink]
 * @param {HTMLElement | null} [infoEl]
 * @param {HTMLElement | null} [boardTagsEl]
 */
export function paintPromoCaption(el, build, root, boardLink, infoEl, boardTagsEl) {
  if (el instanceof HTMLElement) {
    if (!build) {
      el.replaceChildren();
      el.hidden = true;
      el.closest('[data-promo-create-card]')?.removeAttribute('aria-busy');
    } else {
      el.hidden = false;
      el.innerHTML = captionHtml(build, root);
      void hydrateFaces(el, root);
      el.closest('[data-promo-create-card]')?.removeAttribute('aria-busy');
    }
  }
  if (boardTagsEl instanceof HTMLElement) {
    if (!build) {
      boardTagsEl.replaceChildren();
      boardTagsEl.hidden = true;
    } else {
      const tags = boardTagsHtml(build);
      boardTagsEl.innerHTML = tags;
      boardTagsEl.hidden = !tags;
    }
  }
  if (infoEl instanceof HTMLElement) {
    if (!build) {
      infoEl.replaceChildren();
      infoEl.hidden = true;
    } else {
      infoEl.hidden = false;
      infoEl.innerHTML = infoHtml(build, root);
    }
  }
  const base = root.endsWith('/') ? root : `${root}/`;
  const slug = String(build?.slug || '').trim();
  const title = String(build?.title || 'Untitled').trim() || 'Untitled';
  bindPromoHref(
    boardLink,
    slug ? buildViewHref(slug, base) : '',
    slug ? `View ${title}` : '',
  );
}
