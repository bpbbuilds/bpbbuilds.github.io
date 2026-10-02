/**
 * Image augmentations for synth detector training.
 */
import { createCanvas, loadImage } from '@napi-rs/canvas';

/**
 * @param {import('@napi-rs/canvas').Canvas} canvas
 * @param {{
 *   boxes: { classId: string, cx: number, cy: number, bw: number, bh: number }[],
 * }} meta
 * @param {number} [seed]
 */
export async function augmentCanvas(canvas, meta, seed = Math.random()) {
  const rnd = mulberry32((seed * 1e9) | 0);
  let w = canvas.width;
  let h = canvas.height;
  let boxes = meta.boxes.map((b) => ({ ...b }));

  const scale = 0.85 + rnd() * 0.3;
  {
    const nw = Math.max(64, Math.round(w * scale));
    const nh = Math.max(64, Math.round(h * scale));
    const c = createCanvas(nw, nh);
    c.getContext('2d').drawImage(canvas, 0, 0, nw, nh);
    const sx = nw / w;
    const sy = nh / h;
    boxes = boxes.map((b) => ({
      ...b,
      cx: b.cx * sx,
      cy: b.cy * sy,
      bw: b.bw * sx,
      bh: b.bh * sy,
    }));
    canvas = c;
    w = nw;
    h = nh;
  }

  if (rnd() < 0.5) {
    const deg = (rnd() * 6 - 3) * (Math.PI / 180);
    const c = createCanvas(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#5c3a26';
    ctx.fillRect(0, 0, w, h);
    ctx.translate(w / 2, h / 2);
    ctx.rotate(deg);
    ctx.drawImage(canvas, -w / 2, -h / 2);
    // @napi-rs/canvas applies the current transform to putImageData (spec says it shouldn't).
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const cos = Math.cos(deg);
    const sin = Math.sin(deg);
    boxes = boxes.map((b) => {
      const x = b.cx - w / 2;
      const y = b.cy - h / 2;
      return {
        ...b,
        cx: x * cos - y * sin + w / 2,
        cy: x * sin + y * cos + h / 2,
      };
    });
    canvas = c;
  }

  {
    const ctx = canvas.getContext('2d');
    const id = ctx.getImageData(0, 0, w, h);
    const dr = (rnd() - 0.5) * 40;
    const dg = (rnd() - 0.5) * 40;
    const db = (rnd() - 0.5) * 40;
    const contrast = 0.85 + rnd() * 0.3;
    for (let i = 0; i < id.data.length; i += 4) {
      id.data[i] = clamp((id.data[i] - 128) * contrast + 128 + dr);
      id.data[i + 1] = clamp((id.data[i + 1] - 128) * contrast + 128 + dg);
      id.data[i + 2] = clamp((id.data[i + 2] - 128) * contrast + 128 + db);
    }
    if (rnd() < 0.7) {
      const amp = 4 + rnd() * 18;
      for (let i = 0; i < id.data.length; i += 4) {
        const n = (rnd() - 0.5) * amp;
        id.data[i] = clamp(id.data[i] + n);
        id.data[i + 1] = clamp(id.data[i + 1] + n);
        id.data[i + 2] = clamp(id.data[i + 2] + n);
      }
    }
    ctx.putImageData(id, 0, 0);
  }

  if (rnd() < 0.4) {
    const pad = Math.round((rnd() - 0.3) * Math.min(w, h) * 0.08);
    const nw = w + Math.abs(pad) * 2;
    const nh = h + Math.abs(pad) * 2;
    const c = createCanvas(nw, nh);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#4a2f1f';
    ctx.fillRect(0, 0, nw, nh);
    const ox = Math.max(0, pad);
    const oy = Math.max(0, pad);
    ctx.drawImage(canvas, ox, oy);
    boxes = boxes.map((b) => ({
      ...b,
      cx: b.cx + ox,
      cy: b.cy + oy,
    }));
    canvas = c;
    w = nw;
    h = nh;
  }

  const q = 40 + Math.floor(rnd() * 50);
  let out = canvas;
  try {
    const buf = canvas.toBuffer('image/jpeg', { quality: q / 100 });
    const img = await loadImage(buf);
    out = createCanvas(img.width, img.height);
    out.getContext('2d').drawImage(img, 0, 0);
  } catch {
    /* keep the unaugmented canvas when jpeg re-encode fails */
  }

  boxes = boxes
    .map((b) => ({
      ...b,
      cx: Math.max(0, Math.min(out.width, b.cx)),
      cy: Math.max(0, Math.min(out.height, b.cy)),
      bw: Math.max(4, Math.min(out.width, b.bw)),
      bh: Math.max(4, Math.min(out.height, b.bh)),
    }))
    .filter((b) => b.bw > 4 && b.bh > 4);

  return { canvas: out, boxes, jpegQuality: q };
}

function clamp(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/** @param {number} a */
function mulberry32(a) {
  return function rnd() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
