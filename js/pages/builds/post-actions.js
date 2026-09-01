/**
 * Feed post footer — comment, remix, share + right-aligned Play.
 */

import { discussTarget } from '../build/discuss.js';
import { bindShareBuild } from '../build/share.js';
import { bindBuildVote, voteControlHtml } from '../build/vote.js';
import { premiumCtaFxHtml } from '../../shared/premium-cta.js';

function buildViewHref(slug, root) {
  const base = root.endsWith('/') ? root : `${root}/`;
  return `${base}builds/view/?slug=${encodeURIComponent(slug)}`;
}

function simHref(slug, root) {
  const base = root.endsWith('/') ? root : `${root}/`;
  return `${base}sim/?slug=${encodeURIComponent(slug)}`;
}

/**
 * Vote control for the feed post header (right-aligned).
 * @param {string} root
 */
export function postVoteHtml(root) {
  const base = root.endsWith('/') ? root : `${root}/`;
  return `<div class="builds-post__vote" data-post-vote>${voteControlHtml(base)}</div>`;
}

/**
 * Markup for the action row under a feed post.
 * @param {object} build
 * @param {string} root
 */
export function postActionsHtml(build, root) {
  const base = root.endsWith('/') ? root : `${root}/`;
  const slug = String(build.slug || '');
  const discuss = discussTarget(build);
  const commentIcon = `${base}assets/icons/history/CommentBuild.png`;
  const remixHref = `${base}create/?remix=${encodeURIComponent(slug)}`;
  const remixIcon = `${base}assets/icons/history/RemixBuild.png`;
  const shareIcon = `${base}assets/icons/history/ShareBuild.png`;
  const playHref = simHref(slug, base);

  return `
    <div class="builds-post__actions" data-post-actions>
      <div class="builds-post__actions-main">
        <a
          class="builds-post__action builds-post__comment"
          href="${escapeAttr(discuss.href)}"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="${escapeAttr(discuss.label)}"
          title="${escapeAttr(discuss.label)}"
        >
          <img
            class="builds-post__action-icon builds-post__comment-icon"
            src="${escapeAttr(commentIcon)}"
            alt=""
            width="28"
            height="28"
            draggable="false"
          />
        </a>
        <a
          class="builds-post__action builds-post__remix"
          href="${escapeAttr(remixHref)}"
          aria-label="Remix this build"
          title="Remix in creator"
        >
          <img
            class="builds-post__action-icon builds-post__remix-icon"
            src="${escapeAttr(remixIcon)}"
            alt=""
            width="28"
            height="28"
            draggable="false"
          />
        </a>
        <button
          type="button"
          class="builds-post__action builds-post__share build-round__share"
          aria-label="Share build link"
          title="Copy build link"
          data-share
        >
          <img
            class="build-round__share-icon"
            src="${escapeAttr(shareIcon)}"
            alt=""
            width="28"
            height="28"
            draggable="false"
          />
          <span class="builds-post__action-label" data-share-label>Share</span>
        </button>
      </div>
      <a
        class="bpb-premium-cta bpb-premium-cta--plaque builds-post__play"
        href="${escapeAttr(playHref)}"
        aria-label="Play in sim"
        title="Play in combat sandbox"
      >
        <span class="bpb-premium-cta__face" aria-hidden="true">
          ${premiumCtaFxHtml(base, { count: 8 })}
          <img
            class="bpb-premium-cta__icon"
            src="${escapeAttr(base)}assets/icons/sim/PlayButton.png"
            alt=""
            width="276"
            height="100"
            draggable="false"
          />
        </span>
      </a>
    </div>`;
}

/**
 * Bind vote + share on each post.
 * @param {HTMLElement} listEl
 * @param {{
 *   builds: object[],
 *   root: string,
 *   onVoteChange?: (vote: -1 | 0 | 1, slug: string) => void,
 * }} opts
 * @returns {() => void}
 */
export function bindFeedPostActions(listEl, opts) {
  if (!(listEl instanceof HTMLElement)) return () => {};
  const root = opts.root.endsWith('/') ? opts.root : `${opts.root}/`;
  const bySlug = new Map(
    (opts.builds || []).map((b) => [String(b.slug || ''), b]),
  );
  /** @type {(() => void)[]} */
  const unbinds = [];

  listEl.querySelectorAll('.builds-post[data-build-slug]').forEach((post) => {
    if (!(post instanceof HTMLElement)) return;
    const slug = post.getAttribute('data-build-slug') || '';
    const build = bySlug.get(slug);
    if (!build) return;

    const voteHost = post.querySelector('[data-post-vote]') || post;
    unbinds.push(
      bindBuildVote(voteHost, {
        buildKey: slug,
        baseScore: Number(build.vote_score ?? build.like_count ?? 0) || 0,
        onChange(vote, voteScore) {
          if (Number.isFinite(Number(voteScore))) {
            build.vote_score = Number(voteScore);
          }
          opts.onVoteChange?.(vote, slug);
        },
      }),
    );

    const actions = post.querySelector('[data-post-actions]');
    const shareBtn = actions?.querySelector?.('[data-share]');
    if (shareBtn instanceof HTMLButtonElement) {
      const title = String(build.title || 'Build');
      unbinds.push(
        bindShareBuild(shareBtn, {
          url: () => new URL(buildViewHref(slug, root), location.href).href,
          title: () => title,
        }),
      );
    }
  });

  return () => {
    for (const u of unbinds) u();
    unbinds.length = 0;
  };
}

function escapeAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
