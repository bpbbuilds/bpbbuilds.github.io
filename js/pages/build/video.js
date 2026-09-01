/**
 * Build page YouTube layer — overlays the backpack stage; scrubber steps into it.
 */

import { youtubeWatchEmbedSrc } from '../../shared/youtube.js';

/**
 * @param {object | null | undefined} build
 * @returns {boolean}
 */
export function hasBuildVideo(build) {
  return Boolean(youtubeWatchEmbedSrc(build?.youtube_url));
}

/**
 * Video shell over the bag (iframe injected on first show).
 * @param {object | null | undefined} build
 * @returns {string}
 */
export function renderBuildVideo(build) {
  if (!hasBuildVideo(build)) return '';

  const title = String(build?.title || 'Build').trim() || 'Build';
  return `
    <section
      class="build-video"
      aria-label="Build showcase video"
      aria-hidden="true"
      data-youtube-url="${escapeAttr(String(build.youtube_url || ''))}"
      data-video-title="${escapeAttr(`${title} showcase`)}"
    >
      <div class="build-video__frame"></div>
    </section>
  `;
}

/**
 * Show / hide video over the bag. Injects the iframe once.
 * @param {HTMLElement | null} mediaHost `.build-stage__media`
 * @param {boolean} showVideo
 */
export function setStageShowingVideo(mediaHost, showVideo) {
  if (!(mediaHost instanceof HTMLElement)) return;

  const video = mediaHost.querySelector('.build-video');
  const bag = mediaHost.querySelector('.build-bag');

  if (showVideo) {
    if (video instanceof HTMLElement) ensureVideoIframe(video);
    // Reflow so opacity/transform transition plays
    void mediaHost.offsetWidth;
    mediaHost.classList.add('is-showing-video');
  } else {
    mediaHost.classList.remove('is-showing-video');
  }

  if (bag instanceof HTMLElement) {
    bag.setAttribute('aria-hidden', showVideo ? 'true' : 'false');
  }
  if (video instanceof HTMLElement) {
    video.setAttribute('aria-hidden', showVideo ? 'false' : 'true');
  }
}

/**
 * @param {HTMLElement} video
 */
function ensureVideoIframe(video) {
  const frame = video.querySelector('.build-video__frame');
  if (!(frame instanceof HTMLElement)) return;
  if (frame.querySelector('iframe')) return;

  const url = video.dataset.youtubeUrl || '';
  const embed = youtubeWatchEmbedSrc(url);
  if (!embed) return;

  const iframe = document.createElement('iframe');
  iframe.className = 'build-video__iframe';
  iframe.src = embed;
  iframe.title = video.dataset.videoTitle || 'Build showcase';
  iframe.allow =
    'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.allowFullscreen = true;
  iframe.loading = 'lazy';
  frame.appendChild(iframe);
}

function escapeAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
