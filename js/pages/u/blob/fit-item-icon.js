/**
 * Crop blob cosmetic overlays to opaque content for pouch tiles/slots.
 * Equip preview keeps the full 1:1 canvas; tiles only need the drawn pixels.
 */

/** @type {Map<string, Promise<string | null>>} */
const cropCache = new Map();

/**
 * @param {string} src
 * @returns {Promise<string | null>} cropped PNG data URL, or null if unchanged/empty
 */
export function cropSrcToContent(src) {
  const key = String(src || '').trim();
  if (!key) return Promise.resolve(null);
  const hit = cropCache.get(key);
  if (hit) return hit;

  const job = new Promise((resolve) => {
    const img = new Image();
    // Cosmetic assets normally live in Supabase Storage, while the page is
    // served from bpbbuilds.com. Request anonymous CORS access before drawing
    // the image to a canvas; otherwise getImageData() is blocked and the
    // caller has to fall back to the full blob-aligned canvas.
    if (/^https?:\/\//i.test(key)) img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      try {
        const w = img.naturalWidth | 0;
        const h = img.naturalHeight | 0;
        if (w < 1 || h < 1) {
          resolve(null);
          return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(0, 0, w, h);
        let minX = w;
        let minY = h;
        let maxX = -1;
        let maxY = -1;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (data[(y * w + x) * 4 + 3] < 10) continue;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
        if (maxX < 0) {
          resolve(null);
          return;
        }
        // 1px pad so outlines don’t clip
        minX = Math.max(0, minX - 1);
        minY = Math.max(0, minY - 1);
        maxX = Math.min(w - 1, maxX + 1);
        maxY = Math.min(h - 1, maxY + 1);
        const cw = maxX - minX + 1;
        const ch = maxY - minY + 1;
        // Already fills most of the canvas — keep original.
        if (cw * ch > w * h * 0.55) {
          resolve(null);
          return;
        }
        const out = document.createElement('canvas');
        out.width = cw;
        out.height = ch;
        const octx = out.getContext('2d');
        if (!octx) {
          resolve(null);
          return;
        }
        octx.drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);
        resolve(out.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = key;
  });

  cropCache.set(key, job);
  return job;
}

/**
 * Fit pouch / inventory item icons so the drawable fills the slot.
 * Skips equip-preview layers (those stay 1:1 with blob-base).
 * @param {ParentNode} root
 */
export function fitBlobItemIcons(root) {
  const imgs = root.querySelectorAll(
    'img.blob-item-icon:not([data-blob-icon-fit]), img.blob-swatch:not([data-blob-icon-fit]), img.events-featured__prize-item:not([data-blob-icon-fit])',
  );
  imgs.forEach((node) => {
    if (!(node instanceof HTMLImageElement)) return;
    if (node.classList.contains('blob-item-icon--letter')) return;
    const src = node.getAttribute('src') || node.currentSrc || '';
    if (!src || src.startsWith('data:')) {
      node.dataset.blobIconFit = '1';
      return;
    }
    node.dataset.blobIconFit = 'pending';
    cropSrcToContent(src).then((cropped) => {
      if (cropped) {
        node.src = cropped;
        node.removeAttribute('width');
        node.removeAttribute('height');
      }
      node.dataset.blobIconFit = '1';
    });
  });
}
