/**
 * Homepage featured stage — Karry Kraze–style scroll-snap carousel.
 *
 *   import { initFeaturedStage } from './featured-stage.js';
 *   initFeaturedStage();
 */

import { getSupabase } from '../../shared/supabase.js';
import { youtubeThumb, youtubeEmbedSrc } from '../../shared/youtube.js';
import { classIconPath } from '../../shared/class-icons.js';
import { skelBar, skelBlock, skelRegion } from '../../shared/skeleton.js';

const AUTO_MS = 120_000;
const CLONE_COUNT = 2;

function rootPrefix() {
  const raw = document.body?.dataset?.root ?? './';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/**
 * @param {string | null | undefined} path
 * @param {string | null | undefined} youtubeUrl
 * @param {string} root
 */
function resolveThumb(path, youtubeUrl, root) {
  if (path) {
    if (/^https?:\/\//i.test(path)) return path;
    return `${root}${path.replace(/^\//, '')}`;
  }
  return youtubeThumb(youtubeUrl, 'maxresdefault') || `${root}assets/heroes/hero-party-loot.png`;
}

/** @param {string | null | undefined} youtubeUrl */
function thumbOnErrorAttr(youtubeUrl) {
  const hq = youtubeThumb(youtubeUrl, 'sddefault') || youtubeThumb(youtubeUrl, 'hqdefault');
  if (!hq) return '';
  return ` onerror="this.onerror=null;this.src='${hq.replace(/'/g, '%27')}'"`;
}

/** @returns {Promise<object[]>} */
async function fetchFeaturedBuilds() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('builds')
    .select(
      'id, slug, title, hero_class, blurb, youtube_url, thumbnail_path, is_op, author_name',
    )
    .eq('is_public', true)
    .eq('is_featured', true)
    .order('updated_at', { ascending: false })
    .limit(5);

  if (error) throw error;
  return data ?? [];
}

/**
 * @param {object} build
 * @param {string} root
 * @param {number} realIndex
 * @param {number} domIndex
 */
function slideHtml(build, root, realIndex, domIndex) {
  const thumb = resolveThumb(build.thumbnail_path, build.youtube_url, root);
  const icon = classIconPath(root, build.hero_class);
  const watchHref = build.youtube_url || '#';
  const buildHref = `${root}builds/${build.slug}/`;
  const classLabel = build.hero_class || 'Unknown';
  const errAttr = build.thumbnail_path ? '' : thumbOnErrorAttr(build.youtube_url);

  return `
    <article
      class="fs-slide"
      data-real-index="${realIndex}"
      data-dom-index="${domIndex}"
      data-slug="${escapeAttr(build.slug)}"
    >
      <div class="fs-focus">
        <div class="fs-lane fs-lane--video">
          <div class="fs-focus__media">
            <img class="fs-focus__thumb" src="${escapeAttr(thumb)}" alt=""${errAttr} />
          </div>
        </div>
        <div class="fs-lane fs-lane--info">
          ${
            build.is_op
              ? `<img class="fs-op-badge" src="${escapeAttr(root)}assets/theme/ui/ui-badge-op.png" alt="OP" width="899" height="1130" />`
              : ''
          }
          <div class="fs-focus__stitch">
            <header class="fs-focus__header">
              <h2 class="fs-focus__title"><span class="fs-focus__title-text">${escapeHtml(build.title)}</span></h2>
              ${ruleHtml()}
            </header>
            <div class="fs-focus__main">
              <div class="fs-focus__meta">
                <span class="fs-class">
                  ${
                    icon
                      ? `<img class="fs-class__icon" src="${escapeAttr(icon)}" alt="" />`
                      : ''
                  }
                  <span class="fs-class__name">${escapeHtml(classLabel)}</span>
                </span>
              </div>
              <p class="fs-focus__blurb">${escapeHtml(build.blurb || '')}</p>
            </div>
            <div class="fs-focus__actions">
              <a class="fs-btn fs-btn--watch" href="${escapeAttr(watchHref)}" target="_blank" rel="noopener noreferrer">
                <svg class="fs-btn__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/>
                  <path fill="currentColor" d="M6.2 4.8v6.4L11.4 8z"/>
                </svg>
                <span>Watch</span>
              </a>
              <a class="fs-btn fs-btn--build" href="${escapeAttr(buildHref)}">
                <img class="fs-btn__icon fs-btn__icon--img" src="${escapeAttr(root)}assets/icons/misc/Backpack_icon.png" alt="" width="20" height="20" />
                <span>View build</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </article>
  `;
}

function ruleHtml() {
  return `<div class="fs-rule fs-rule--diamond" aria-hidden="true"><span class="fs-rule__line"></span><svg class="fs-rule__motif fs-rule__motif--diamond" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path fill="currentColor" d="M5 0.8 L9.2 5 L5 9.2 L0.8 5 Z"/></svg><span class="fs-rule__line"></span></div>`;
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

/** Placeholder carousel while featured builds load — matches real layout. */
function skeletonStageHtml() {
  const card = `
    <div class="fs-focus fs-focus--skel">
      <div class="fs-lane fs-lane--video">
        <div class="fs-focus__media fs-skel-media">
          ${skelBlock({ className: 'fs-skel-media__fill' })}
        </div>
      </div>
      <div class="fs-lane fs-lane--info">
        <div class="fs-focus__stitch">
          <header class="fs-focus__header">
            ${skelBar({ className: 'fs-skel-title', width: '78%', height: '1.15em' })}
            ${skelBar({ className: 'fs-skel-rule', width: '100%', height: '2px' })}
          </header>
          <div class="fs-focus__main">
            ${skelBar({ className: 'fs-skel-class', width: '42%', height: '0.95em' })}
            ${skelBar({ className: 'fs-skel-blurb', width: '100%', height: '0.8em' })}
            ${skelBar({ className: 'fs-skel-blurb', width: '88%', height: '0.8em' })}
          </div>
          <div class="fs-focus__actions fs-skel-actions">
            ${skelBar({ className: 'fs-skel-btn', height: 'var(--fs-btn-h, 2.4rem)', radius: '0.35rem' })}
            ${skelBar({ className: 'fs-skel-btn', height: 'var(--fs-btn-h, 2.4rem)', radius: '0.35rem' })}
          </div>
        </div>
      </div>
    </div>`;

  const peek = () => `
    <div class="fs-slide fs-slide--skel is-side" aria-hidden="true">
      ${card}
    </div>`;

  const center = `
    <div class="fs-slide fs-slide--skel is-active" aria-hidden="true">
      ${card}
    </div>`;

  return skelRegion(
    `<div class="fs-shell">
      <div class="fs-track" aria-hidden="true">
        ${peek()}
        ${center}
        ${peek()}
      </div>
    </div>`,
    { className: 'fs-skel-wrap', label: 'Loading featured builds' },
  );
}

/** Center a track child instantly (no smooth scroll / no entrance animation). */
function centerTrackInstant(track, domIdx) {
  const child = track.children[domIdx];
  if (!child) {
    track.classList.add('is-ready');
    return;
  }
  const hadSnap = track.classList.contains('fs-track--snap');
  if (hadSnap) track.classList.remove('fs-track--snap');
  track.scrollLeft = child.offsetLeft - track.offsetWidth / 2 + child.offsetWidth / 2;
  void track.offsetHeight;
  if (hadSnap) track.classList.add('fs-track--snap');
  track.classList.add('is-ready');
}

/**
 * @param {object[]} builds
 */
function withClones(builds) {
  if (builds.length <= 1) {
    return { slides: builds.map((b, i) => ({ build: b, realIndex: i })), cloneCount: 0, looping: false };
  }

  const left = [];
  const right = [];
  for (let i = 0; i < CLONE_COUNT; i += 1) {
    const leftReal = (builds.length - 1 - i + builds.length * 10) % builds.length;
    const rightReal = i % builds.length;
    left.unshift({ build: builds[leftReal], realIndex: leftReal });
    right.push({ build: builds[rightReal], realIndex: rightReal });
  }

  const mid = builds.map((b, i) => ({ build: b, realIndex: i }));
  return { slides: [...left, ...mid, ...right], cloneCount: CLONE_COUNT, looping: true };
}

/**
 * @param {string | Element} [selector='#featured-stage']
 */
export async function initFeaturedStage(selector = '#featured-stage') {
  const host = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!host) return;

  const root = rootPrefix();
  host.innerHTML = skeletonStageHtml();
  const skelTrack = host.querySelector('.fs-track');
  if (skelTrack) {
    // Middle skeleton slide (peek | center | peek)
    requestAnimationFrame(() => centerTrackInstant(skelTrack, 1));
  }

  let builds = [];
  try {
    builds = await fetchFeaturedBuilds();
  } catch (err) {
    console.error(err);
    host.innerHTML = `<div class="fs-shell"><p class="fs-status">Could not load featured builds.</p></div>`;
    return;
  }

  if (!builds.length) {
    host.innerHTML = `<div class="fs-shell"><p class="fs-status">No featured builds yet.</p></div>`;
    return;
  }

  const { slides, cloneCount, looping } = withClones(builds);
  const totalDom = slides.length;

  host.innerHTML = `
    <div class="fs-shell">
      <div class="fs-track fs-track--snap" tabindex="0" aria-label="Featured builds carousel">
        ${slides.map((s, i) => slideHtml(s.build, root, s.realIndex, i)).join('')}
      </div>
    </div>
  `;

  const track = host.querySelector('.fs-track');
  if (!track) return;

  let currentReal = 0;
  let isTeleporting = false;
  let programmaticScroll = false;
  let skipAnimUntil = 0;
  let scrollDebounce = null;
  let autoTimer = null;
  let playDelay = null;

  function centerOffset(el) {
    return el.offsetLeft - track.offsetWidth / 2 + el.offsetWidth / 2;
  }

  function scrollToDom(domIdx, behavior = 'smooth') {
    const child = track.children[domIdx];
    if (!child) return;
    const left = centerOffset(child);

    if (behavior === 'smooth') {
      programmaticScroll = true;
      track.classList.remove('fs-track--snap');
      highlight(domIdx, true);
      track.scrollTo({ left, behavior: 'smooth' });
      return;
    }

    track.scrollTo({ left, behavior: 'auto' });
  }

  function calculateActiveIndex() {
    const center = track.scrollLeft + track.offsetWidth / 2;
    let bestIdx = 0;
    let minDiff = Infinity;
    Array.from(track.children).forEach((child, idx) => {
      const childCenter = child.offsetLeft + child.offsetWidth / 2;
      const diff = Math.abs(childCenter - center);
      if (diff < minDiff) {
        minDiff = diff;
        bestIdx = idx;
      }
    });
    return bestIdx;
  }

  function highlight(domIdx, skipAnim = false) {
    const skip = skipAnim || Date.now() < skipAnimUntil;
    Array.from(track.children).forEach((child, idx) => {
      const on = idx === domIdx;
      child.classList.toggle('is-active', on);
      child.classList.toggle('is-side', !on);
      if (on && !skip) {
        child.classList.add('is-settling');
        window.setTimeout(() => child.classList.remove('is-settling'), 500);
      }
    });
  }

  function realFromDom(domIdx) {
    if (!looping) return domIdx;
    let real = domIdx - cloneCount;
    real %= builds.length;
    if (real < 0) real += builds.length;
    return real;
  }

  function clearPreview(slide) {
    const media = slide?.querySelector('.fs-focus__media');
    if (!media || !media.querySelector('iframe')) return;
    const build = builds[Number(slide.getAttribute('data-real-index'))];
    if (!build) return;
    const thumb = resolveThumb(build.thumbnail_path, build.youtube_url, root);
    const errAttr = build.thumbnail_path ? '' : thumbOnErrorAttr(build.youtube_url);
    media.innerHTML = `
      <img class="fs-focus__thumb" src="${escapeAttr(thumb)}" alt=""${errAttr} />
    `;
  }

  function mountPreview(slide) {
    const media = slide?.querySelector('.fs-focus__media');
    const build = builds[Number(slide?.getAttribute('data-real-index'))];
    const embed = youtubeEmbedSrc(build?.youtube_url);
    if (!media || !embed || media.querySelector('iframe')) return;
    media.innerHTML = `
      <iframe
        class="fs-focus__frame"
        src="${escapeAttr(embed)}"
        title="${escapeAttr(build.title)}"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
      ></iframe>
    `;
  }

  function schedulePreview(domIdx, immediate = false) {
    if (playDelay) {
      clearTimeout(playDelay);
      playDelay = null;
    }
    Array.from(track.children).forEach((child, idx) => {
      if (idx !== domIdx) clearPreview(child);
    });
    const mount = () => {
      mountPreview(track.children[domIdx]);
      playDelay = null;
    };
    if (immediate) {
      mount();
      return;
    }
    playDelay = setTimeout(mount, 450);
  }

  function teleport(targetIdx, sourceIdx) {
    isTeleporting = true;
    skipAnimUntil = Date.now() + 800;
    track.classList.remove('fs-track--snap');
    track.classList.add('fs-track--no-transition');

    const target = track.children[targetIdx];
    const source = track.children[sourceIdx];
    if (target) {
      target.classList.add('is-active');
      target.classList.remove('is-side');
    }
    if (source) {
      source.classList.remove('is-active');
      source.classList.add('is-side');
    }

    const relativeOffset = track.scrollLeft - source.offsetLeft;
    track.scrollTo({ left: target.offsetLeft + relativeOffset, behavior: 'auto' });
    void track.offsetHeight;
    highlight(targetIdx, true);

    setTimeout(() => {
      track.classList.add('fs-track--snap');
      isTeleporting = false;
    }, 50);

    setTimeout(() => {
      track.classList.remove('fs-track--no-transition');
    }, 400);
  }

  function updateVisuals() {
    if (isTeleporting) return;
    const bestIdx = calculateActiveIndex();
    highlight(bestIdx);
    currentReal = realFromDom(bestIdx);
    return bestIdx;
  }

  function handleScrollStop() {
    if (programmaticScroll) {
      programmaticScroll = false;
      track.classList.add('fs-track--snap');
    }

    if (!looping || isTeleporting) {
      const idx = updateVisuals();
      schedulePreview(idx);
      return;
    }

    const bestIdx = updateVisuals();
    if (bestIdx < cloneCount) {
      teleport(bestIdx + builds.length, bestIdx);
      schedulePreview(bestIdx + builds.length);
    } else if (bestIdx >= totalDom - cloneCount) {
      teleport(bestIdx - builds.length, bestIdx);
      schedulePreview(bestIdx - builds.length);
    } else {
      schedulePreview(bestIdx);
    }
  }

  function onScroll() {
    if (!programmaticScroll && !isTeleporting) {
      window.requestAnimationFrame(updateVisuals);
    }
    if (scrollDebounce) clearTimeout(scrollDebounce);
    scrollDebounce = setTimeout(handleScrollStop, 80);
  }

  function scrollToReal(realIdx) {
    const domIdx = looping ? realIdx + cloneCount : realIdx;
    scrollToDom(domIdx, 'smooth');
  }

  function playNext() {
    const activeDom = looping ? currentReal + cloneCount : currentReal;
    const nextDom = activeDom + 1;
    if (nextDom >= totalDom) {
      scrollToDom(looping ? cloneCount : 0, 'smooth');
      return;
    }
    scrollToDom(nextDom, 'smooth');
  }

  function stopTimer() {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
  }

  function startTimer() {
    stopTimer();
    if (builds.length < 2) return;
    autoTimer = setInterval(playNext, AUTO_MS);
  }

  track.addEventListener('scroll', onScroll, { passive: true });

  track.addEventListener('click', (e) => {
    const slide = e.target.closest('.fs-slide');
    if (!slide || !track.contains(slide)) return;
    if (slide.classList.contains('is-active')) return;
    if (e.target.closest('a')) e.preventDefault();
    const domIdx = Number(slide.getAttribute('data-dom-index'));
    scrollToDom(domIdx, 'smooth');
    startTimer();
  });

  track.addEventListener('mouseenter', stopTimer);
  track.addEventListener('mouseleave', startTimer);
  track.addEventListener('touchstart', stopTimer, { passive: true });
  track.addEventListener('touchend', startTimer, { passive: true });

  // Start on first real slide — positioned before reveal (no slide-in)
  const startDom = looping ? cloneCount : 0;
  requestAnimationFrame(() => {
    centerTrackInstant(track, startDom);
    highlight(startDom, true);
    schedulePreview(startDom, true);
    startTimer();
  });
}
