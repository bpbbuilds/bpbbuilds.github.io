/**
 * Public face (Discord pfp vs website blob + equipped cosmetics).
 * Sync HTML paints the base immediately; hydrateFaces() adds cosmetic layers.
 * bakeBlobFaceUrl() composites to a data URL for single-<img> hosts (sim).
 */

import { resolveEquippedAvatarUrl, resolveIdentityMode } from './profile-avatar.js';

/** Slot draw order (back → front), matches wardrobe BLOB_SLOTS. */
const SLOT_ORDER = Object.freeze(['hat', 'face', 'head', 'neck', 'body', 'hand']);

/** @type {Map<string, { id: string, image?: string, name?: string }> | null} */
let cosmeticMap = null;
/** @type {Promise<Map<string, { id: string, image?: string, name?: string }>> | null} */
let cosmeticLoad = null;
let avatarFallbackBound = false;

/**
 * Keep failed external profile images from rendering the browser broken-image
 * glyph. The listener is delegated so dynamically painted cards are covered
 * without each page needing its own image handler.
 */
export function bindAvatarFallback() {
  if (avatarFallbackBound || typeof document === 'undefined') return;
  avatarFallbackBound = true;
  document.addEventListener(
    'error',
    (event) => {
      const img = event.target;
      if (!(img instanceof HTMLImageElement) || !img.dataset.bpbAvatarImg) return;
      if (img.dataset.bpbAvatarFailed) return;
      img.dataset.bpbAvatarFailed = '1';

      const base = String(img.dataset.bpbAvatarClass || '').trim() || 'bpb-avatar';
      const mode = img.dataset.bpbAvatarMode === 'empty' ? 'empty' : 'initials';
      const fallback = document.createElement('span');
      fallback.className = `${base} ${base}--${mode}`;
      fallback.dataset.bpbAvatarFallback = '1';
      fallback.setAttribute('aria-hidden', 'true');
      if (mode === 'initials') {
        const name = String(img.dataset.bpbAvatarName || img.alt || '').trim();
        const parts = name.split(/\s+/).filter(Boolean);
        fallback.textContent =
          parts.length >= 2
            ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
            : (parts[0] || '?').slice(0, 2).toUpperCase();
      }
      img.replaceWith(fallback);
    },
    true,
  );
}

bindAvatarFallback();

/**
 * @param {string} s
 */
function escapeAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * @param {string} root
 */
function assetRoot(root) {
  return root.endsWith('/') ? root : `${root}/`;
}

/**
 * @param {string} root
 */
function blobBaseSrc(root) {
  return `${assetRoot(root)}assets/blob/blob-base.png`;
}

/**
 * @param {string | null | undefined} raw
 * @returns {{ base: 'discord' | 'blob', slots: Record<string, string | null> } | null}
 */
export function parseFaceLoadout(raw) {
  const s = String(raw || '').trim();
  if (!s.startsWith('{')) return null;
  try {
    const j = JSON.parse(s);
    if (!(j && j.v === 1 && j.slots && typeof j.slots === 'object')) return null;
    const base = String(j.base || 'discord').trim().toLowerCase() === 'blob' ? 'blob' : 'discord';
    /** @type {Record<string, string | null>} */
    const slots = {};
    for (const id of SLOT_ORDER) {
      const v = j.slots[id];
      slots[id] = typeof v === 'string' && v.trim() ? v.trim() : null;
    }
    return { base, slots };
  } catch {
    return null;
  }
}

/**
 * @param {string} root
 */
function loadCosmeticMap(root) {
  if (cosmeticMap) return Promise.resolve(cosmeticMap);
  if (cosmeticLoad) return cosmeticLoad;
  const base = assetRoot(root);
  cosmeticLoad = fetch(`${base}assets/data/blob-cosmetics.json`, {
    signal: AbortSignal.timeout(12000),
  })
    .then((r) => (r.ok ? r.json() : { items: [] }))
    .then((j) => {
      /** @type {Map<string, { id: string, image?: string, name?: string }>} */
      const map = new Map();
      const items = Array.isArray(j?.items) ? j.items : [];
      for (const raw of items) {
        const id = String(raw?.id || '').trim();
        if (!id) continue;
        const image = String(raw?.image || '').trim();
        map.set(id, {
          id,
          name: String(raw?.name || id).trim(),
          image: image
            ? image.startsWith('http') || image.startsWith('data:')
              ? image
              : `${base}${image.replace(/^\//, '')}`
            : '',
        });
      }
      cosmeticMap = map;
      return map;
    })
    .catch(() => {
      cosmeticMap = new Map();
      return cosmeticMap;
    });
  return cosmeticLoad;
}

/**
 * Layer image URLs for a blob loadout (equipped cosmetics only).
 * @param {string | null | undefined} equippedRaw
 * @param {string} root
 * @returns {Promise<string[]>}
 */
export async function blobFaceLayerSrcs(equippedRaw, root) {
  const loadout = parseFaceLoadout(equippedRaw);
  if (!loadout || loadout.base !== 'blob') return [];
  const map = await loadCosmeticMap(root);
  /** @type {string[]} */
  const out = [];
  for (const slot of SLOT_ORDER) {
    const id = loadout.slots[slot];
    if (!id) continue;
    const item = map.get(id);
    if (item?.image) out.push(item.image);
  }
  return out;
}

/**
 * Face markup — Discord img, or blob stack (base now; cosmetics via hydrateFaces).
 * @param {{
 *   avatar_url?: string | null,
 *   equipped_avatar?: string | null,
 * } | null | undefined} profile
 * @param {string} root
 * @param {{
 *   className?: string,
 *   size?: number,
 *   emptyHtml?: string,
 *   alt?: string,
 * }} [opts]
 */
export function faceHtml(profile, root, opts = {}) {
  bindAvatarFallback();
  const className = String(opts.className || 'bpb-face').trim() || 'bpb-face';
  const identity = resolveIdentityMode(profile);

  if (identity === 'blob') {
    const equipped = String(profile?.equipped_avatar || '').trim();
    const sizeStyle =
      Number(opts.size) > 0
        ? ` style="width:${Math.round(Number(opts.size))}px;height:${Math.round(Number(opts.size))}px"`
        : '';
    const wh = Number(opts.size) > 0 ? Math.round(Number(opts.size)) : 128;
    const tokens = className.split(/\s+/).filter(Boolean);
    const primary = tokens[0] || 'bpb-face';
    const faceClass = [...tokens, `${primary}--blob`, 'bpb-face'].join(' ');
    return `<span
      class="${escapeAttr(faceClass)}"
      data-bpb-face="${escapeAttr(equipped)}"${sizeStyle}
      role="img"
      aria-label="${escapeAttr(opts.alt || 'Blob')}"
    ><img class="bpb-face__base" src="${escapeAttr(blobBaseSrc(root))}" alt="" width="${wh}" height="${wh}" draggable="false" /></span>`;
  }

  const url = resolveEquippedAvatarUrl(profile, root);
  if (url) {
    const size = Number(opts.size) > 0 ? Math.round(Number(opts.size)) : 40;
    const sizeAttrs =
      Number(opts.size) > 0 ? ` width="${size}" height="${size}"` : '';
    const primary = className.split(/\s+/).filter(Boolean)[0] || 'bpb-avatar';
    const mode = String(opts.emptyHtml || '').includes('--empty') ? 'empty' : 'initials';
    return `<img
      class="${escapeAttr(className)}"
      src="${escapeAttr(url)}"
      alt="${escapeAttr(opts.alt || '')}"${sizeAttrs}
      data-bpb-avatar-img="1"
      data-bpb-avatar-class="${escapeAttr(primary)}"
      data-bpb-avatar-mode="${mode}"
      data-bpb-avatar-name="${escapeAttr(opts.alt || '')}"
      draggable="false"
    />`;
  }
  return opts.emptyHtml || '';
}

/**
 * Fill cosmetic layers onto every `[data-bpb-face]` under scope.
 * @param {ParentNode | null | undefined} scope
 * @param {string} root
 */
export async function hydrateFaces(scope, root) {
  if (!scope || typeof scope.querySelectorAll !== 'function') return;
  const nodes = [...scope.querySelectorAll('[data-bpb-face]')];
  if (!nodes.length) return;
  const map = await loadCosmeticMap(root);

  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) continue;
    const loadout = parseFaceLoadout(node.getAttribute('data-bpb-face'));
    node.querySelectorAll('.bpb-face__overlay').forEach((el) => el.remove());
    if (!loadout || loadout.base !== 'blob') continue;
    let z = 2;
    for (const slot of SLOT_ORDER) {
      const id = loadout.slots[slot];
      if (!id) continue;
      const item = map.get(id);
      if (!item?.image) continue;
      const img = document.createElement('img');
      img.className = `bpb-face__overlay bpb-face__overlay--${slot}`;
      img.src = item.image;
      img.alt = '';
      img.draggable = false;
      img.style.zIndex = String(z++);
      node.appendChild(img);
    }
  }
}

/**
 * Bake blob + cosmetics to a PNG data URL (for sim / single-img hosts).
 * @param {{
 *   avatar_url?: string | null,
 *   equipped_avatar?: string | null,
 * } | null | undefined} profile
 * @param {string} root
 * @param {number} [size]
 * @returns {Promise<string | null>}
 */
export async function bakeBlobFaceUrl(profile, root, size = 128) {
  if (resolveIdentityMode(profile) !== 'blob') {
    return resolveEquippedAvatarUrl(profile, root);
  }
  const dim = Number(size) > 0 ? Math.round(Number(size)) : 128;
  const layers = [blobBaseSrc(root), ...(await blobFaceLayerSrcs(profile?.equipped_avatar, root))];

  /** @param {string} src */
  const loadImg = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`face layer failed: ${src}`));
      img.src = src;
    });

  try {
    const images = await Promise.all(layers.map((src) => loadImg(src)));
    const canvas = document.createElement('canvas');
    canvas.width = dim;
    canvas.height = dim;
    const ctx = canvas.getContext('2d');
    if (!ctx) return blobBaseSrc(root);
    ctx.imageSmoothingEnabled = false;
    for (const img of images) {
      ctx.drawImage(img, 0, 0, dim, dim);
    }
    return canvas.toDataURL('image/png');
  } catch {
    return blobBaseSrc(root);
  }
}
