const VIDEO_ID = 'qy01ovo25tU';
const VIDEO_SOURCE = 'https://www.youtube.com/watch?v=' + VIDEO_ID;
const LOCAL_VIDEO_PATH = 'assets/videos/loading-screen/video-loading-background.mp4';
const LOCAL_POSTER_PATH = 'assets/videos/loading-screen/video-loading-background-poster.jpg';

// The source has a short intro before the animation begins. Keep the loading
// asset bounded to a useful segment so a page never waits on a four-minute
// playback cycle. The file remains streamable with preload="metadata".
// The local asset is already trimmed at the original five-second mark, so
// playback starts at the first frame of the trimmed file.
const VIDEO_START_SECONDS = 0;
const VIDEO_LOOP_END_SECONDS = 60;

function localVideoUrl(root) {
  try {
    return new URL(LOCAL_VIDEO_PATH, new URL(root || './', document.baseURI)).href;
  } catch {
    return LOCAL_VIDEO_PATH;
  }
}

function localPosterUrl(root) {
  try {
    return new URL(LOCAL_POSTER_PATH, new URL(root || './', document.baseURI)).href;
  } catch {
    return LOCAL_POSTER_PATH;
  }
}

/**
 * Full-viewport local video loading preset.
 *
 * The source is a user-provided, authorized local file. Playback starts at
 * the first animated frame and loops a short window instead of running the
 * entire source. If the asset cannot load, the poster remains visible.
 */
export function createVideoLoadingScreen({ host, root = './' } = {}) {
  if (!(host instanceof HTMLElement)) return null;

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
  const localSource = localVideoUrl(root);
  const localPoster = localPosterUrl(root);
  const video = reducedMotion
    ? ''
    : '<video class="bpb-video-loading__video" src="' + localSource + '" muted playsinline preload="metadata" aria-hidden="true"></video>';
  const startingClass = reducedMotion ? '' : ' is-video-starting';

  host.innerHTML = [
    '<section class="bpb-loading-screen bpb-loading-screen--video' + startingClass + '" role="status" aria-live="polite" aria-busy="true">',
    '<div class="bpb-video-loading__poster" style="background-image:url(' + localPoster + ')" aria-hidden="true"></div>',
    video,
    '<div class="bpb-video-loading__shade" aria-hidden="true"></div>',
    '<p class="bpb-video-loading__label">Loading<span class="bpb-video-loading__dots" aria-hidden="true">...</span></p>',
    '<a class="bpb-video-loading__credit" href="' + VIDEO_SOURCE + '" target="_blank" rel="noopener noreferrer">Background artwork by Papamation · CC BY 4.0</a>',
    '</section>',
  ].join('');

  const screen = host.querySelector('.bpb-loading-screen');
  const media = host.querySelector('.bpb-video-loading__video');
  const posterNode = host.querySelector('.bpb-video-loading__poster');
  let destroyed = false;
  let loopEnd = VIDEO_LOOP_END_SECONDS;

  const showFallback = () => {
    screen?.classList.add('is-fallback');
    if (posterNode instanceof HTMLElement) posterNode.setAttribute('aria-hidden', 'false');
  };

  const seekToStart = () => {
    if (!(media instanceof HTMLVideoElement) || !Number.isFinite(media.duration)) return false;
    const start = Math.min(VIDEO_START_SECONDS, Math.max(0, media.duration - 0.1));
    loopEnd = Math.min(VIDEO_LOOP_END_SECONDS, media.duration);
    const lastSeekable = media.seekable.length - 1;
    if (lastSeekable < 0 || media.seekable.end(lastSeekable) < start) return false;
    media.currentTime = start;
    screen?.classList.remove('is-video-starting');
    return true;
  };

  const startPlayback = () => {
    if (destroyed || !(media instanceof HTMLVideoElement)) return Promise.resolve();
    seekToStart();
    return media.play().catch(() => {
      showFallback();
    });
  };

  media?.addEventListener('loadedmetadata', startPlayback, { once: true });
  media?.addEventListener('timeupdate', () => {
    if (destroyed || !(media instanceof HTMLVideoElement)) return;
    if (screen?.classList.contains('is-video-starting')) {
      if (media.currentTime < VIDEO_START_SECONDS) return;
      screen.classList.remove('is-video-starting');
    }
    if (media.currentTime >= loopEnd) {
      const sought = seekToStart();
      if (!sought) {
        media.currentTime = 0;
        screen?.classList.add('is-video-starting');
      }
      void media.play().catch(() => {});
    }
  });
  media?.addEventListener('ended', () => {
    if (destroyed || !(media instanceof HTMLVideoElement)) return;
    media.currentTime = 0;
    screen?.classList.add('is-video-starting');
    void media.play().catch(() => {});
  });
  media?.addEventListener('error', showFallback, { once: true });
  if (media instanceof HTMLVideoElement && media.readyState >= 1) void startPlayback();

  const setProgress = (value, message = '') => {
    const progress = Math.min(100, Math.max(0, Number(value) || 0));
    screen?.setAttribute('aria-busy', String(progress < 100));
    if (progress >= 100) screen?.classList.add('is-complete');
    if (message) screen?.setAttribute('data-loading-message', String(message));
  };

  const reset = () => {
    screen?.classList.remove('is-complete', 'is-fallback');
    if (media instanceof HTMLVideoElement) screen?.classList.add('is-video-starting');
    screen?.setAttribute('aria-busy', 'true');
    screen?.removeAttribute('data-loading-message');
    if (media instanceof HTMLVideoElement) {
      media.currentTime = 0;
      seekToStart();
      void media.play().catch(() => {});
    }
  };

  const destroy = () => {
    destroyed = true;
    if (media instanceof HTMLVideoElement) {
      media.pause();
      media.removeAttribute('src');
      media.load();
    }
    host.replaceChildren();
  };

  return {
    host,
    screen,
    sourceUrl: VIDEO_SOURCE,
    localSourceUrl: localSource,
    posterUrl: localPoster,
    play: startPlayback,
    setProgress,
    reset,
    complete: (message = 'Ready to play') => setProgress(100, message),
    dismiss: destroy,
    destroy,
  };
}

export const videoLoadingPreset = Object.freeze({
  id: 'video',
  label: 'Video background',
  create: createVideoLoadingScreen,
});
