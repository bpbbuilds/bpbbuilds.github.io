/**
 * YouTube URL helpers (thumbs + embed).
 */

const ID_RE =
  /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{6,})/;

/**
 * @param {string | null | undefined} url
 * @returns {string | null}
 */
export function youtubeId(url) {
  if (!url) return null;
  const m = String(url).match(ID_RE);
  return m ? m[1] : null;
}

/**
 * @param {string | null | undefined} url
 * @param {'maxresdefault' | 'hqdefault' | 'mqdefault'} [quality]
 */
export function youtubeThumb(url, quality = 'hqdefault') {
  const id = youtubeId(url);
  if (!id) return null;
  return `https://i.ytimg.com/vi/${id}/${quality}.jpg`;
}

/**
 * Mute + autoplay embed for carousel preview (does NOT count as a view).
 * @param {string | null | undefined} url
 */
export function youtubeEmbedSrc(url) {
  const id = youtubeId(url);
  if (!id) return null;
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    controls: '1',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    enablejsapi: '1',
  });
  if (typeof location !== 'undefined' && location.origin) {
    params.set('origin', location.origin);
  }
  return `https://www.youtube.com/embed/${id}?${params}`;
}

/**
 * Click-to-play embed for build guide pages (user-initiated play can count as a view).
 * @param {string | null | undefined} url
 */
export function youtubeWatchEmbedSrc(url) {
  const id = youtubeId(url);
  if (!id) return null;
  const params = new URLSearchParams({
    autoplay: '0',
    controls: '1',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    enablejsapi: '1',
  });
  if (typeof location !== 'undefined' && location.origin) {
    params.set('origin', location.origin);
  }
  return `https://www.youtube.com/embed/${id}?${params}`;
}
