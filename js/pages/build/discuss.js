/**
 * Discuss CTA — YouTube comments when the build has a video, else Discord.
 */

import { DISCORD_INVITE_URL } from '../../shared/social-links.js';
import { youtubeId } from '../../shared/youtube.js';

/**
 * @param {string | null | undefined} url
 * @returns {string | null}
 */
export function youtubeWatchUrl(url) {
  const id = youtubeId(url);
  if (!id) return null;
  return `https://www.youtube.com/watch?v=${id}`;
}

/**
 * @param {{ youtube_url?: string | null } | null | undefined} build
 * @returns {{ href: string, kind: 'youtube' | 'discord', label: string }}
 */
export function discussTarget(build) {
  const watch = youtubeWatchUrl(build?.youtube_url);
  if (watch) {
    return {
      href: watch,
      kind: 'youtube',
      label: 'Discuss on YouTube',
    };
  }
  return {
    href: DISCORD_INVITE_URL,
    kind: 'discord',
    label: 'Discuss on Discord',
  };
}

/**
 * Markup for Discuss under Build Info.
 * @param {{ youtube_url?: string | null } | null | undefined} build
 * @param {string} [root]
 */
export function discussControlHtml(build, root = '../../') {
  const base = root.endsWith('/') ? root : `${root}/`;
  const { href, kind, label } = discussTarget(build);
  const icon =
    kind === 'youtube'
      ? `${base}assets/theme/ui/ui-icon-youtube.png`
      : `${base}assets/theme/ui/ui-icon-discord.png`;
  const short = kind === 'youtube' ? 'YouTube' : 'Discord';

  return `
    <a
      class="build-info__discuss build-info__discuss--${kind}"
      href="${escapeAttr(href)}"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="${escapeAttr(label)}"
      title="${escapeAttr(label)}"
    >
      <img
        class="build-info__discuss-icon"
        src="${escapeAttr(icon)}"
        alt=""
        width="36"
        height="30"
        draggable="false"
      />
      <span class="build-info__discuss-label build-info__ui-text">Discuss</span>
      <span class="build-visually-hidden"> on ${escapeHtml(short)}</span>
    </a>
  `;
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
