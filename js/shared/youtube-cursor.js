/**
 * Game cursor over YouTube embeds.
 * A cross-origin player paints its own cursor, so a clear layer covers the
 * picture. The bottom of the frame stays uncovered for YouTube's controls.
 * A click on the picture toggles play through the player API.
 */

const state = new WeakMap();

function isYoutubeFrame(node) {
  if (!(node instanceof HTMLIFrameElement)) return false;
  const src = node.getAttribute('src') || '';
  return /youtube\.com|youtube-nocookie\.com/.test(src);
}

/**
 * @param {HTMLIFrameElement} iframe
 * @param {string} func
 */
function command(iframe, func) {
  const win = iframe.contentWindow;
  if (!win) return;
  win.postMessage(
    JSON.stringify({ event: 'command', func, args: [] }),
    '*',
  );
}

/**
 * @param {HTMLIFrameElement} iframe
 */
function listen(iframe) {
  const win = iframe.contentWindow;
  if (!win) return;
  win.postMessage(
    JSON.stringify({ event: 'listening', id: iframe.id || 'bpb-yt', channel: 'widget' }),
    '*',
  );
}

/**
 * @param {HTMLIFrameElement} iframe
 */
function toggle(iframe) {
  const known = state.get(iframe);
  const playing = known === undefined ? /[?&]autoplay=1(?:&|$)/.test(iframe.src) : known;
  command(iframe, playing ? 'pauseVideo' : 'playVideo');
  state.set(iframe, !playing);
}

/**
 * @param {HTMLIFrameElement} iframe
 */
function attach(iframe) {
  if (iframe.dataset.bpbYtCursor === '1') return;
  const parent = iframe.parentElement;
  if (!parent) return;
  iframe.dataset.bpbYtCursor = '1';
  if (!iframe.id) iframe.id = `bpb-yt-${Math.random().toString(36).slice(2, 8)}`;
  if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';

  const hit = document.createElement('div');
  hit.className = 'bpb-yt-hit';
  hit.setAttribute('aria-hidden', 'true');
  parent.appendChild(hit);

  let startX = 0;
  let startY = 0;
  let moved = false;
  hit.addEventListener('pointerdown', (event) => {
    startX = event.clientX;
    startY = event.clientY;
    moved = false;
  });
  hit.addEventListener('pointermove', (event) => {
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > 8) moved = true;
  });
  hit.addEventListener('click', (event) => {
    if (moved) return;
    event.preventDefault();
    event.stopPropagation();
    listen(iframe);
    toggle(iframe);
  });

  iframe.addEventListener('load', () => listen(iframe));
}

function scan(root) {
  const scope = root instanceof Element || root instanceof Document ? root : document;
  const frames = scope instanceof HTMLIFrameElement
    ? [scope]
    : [...scope.querySelectorAll('iframe')];
  for (const frame of frames) {
    if (isYoutubeFrame(frame)) attach(frame);
  }
}

function onMessage(event) {
  if (event.origin !== 'https://www.youtube.com') return;
  let data = event.data;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return;
    }
  }
  if (!data || data.event !== 'onStateChange') return;
  const code = typeof data.info === 'number' ? data.info : Number(data.info?.playerState);
  if (!Number.isFinite(code)) return;
  for (const frame of document.querySelectorAll('iframe[data-bpb-yt-cursor="1"]')) {
    if (!(frame instanceof HTMLIFrameElement) || frame.contentWindow !== event.source) continue;
    if (code === 1) state.set(frame, true);
    else if (code === 0 || code === 2 || code === 5) state.set(frame, false);
  }
}

export function bindYoutubeCursors() {
  if (document.documentElement.dataset.bpbYtCursor === '1') return;
  document.documentElement.dataset.bpbYtCursor = '1';
  scan(document);
  window.addEventListener('message', onMessage);
  const obs = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element) scan(node);
      }
      if (record.type === 'attributes' && record.target instanceof HTMLIFrameElement) {
        scan(record.target);
      }
    }
  });
  obs.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
  });
}

bindYoutubeCursors();
