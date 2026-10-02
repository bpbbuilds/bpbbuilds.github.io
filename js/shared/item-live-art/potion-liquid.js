/**
 * Shared WebGL blit for BottleOfBooze + holo TIME-scroll (one program pair,
 * one context, many 2D canvases).
 */

const POTION_VS = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const POTION_FS = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_mask;
uniform sampler2D u_gradient;
uniform sampler2D u_noise;
uniform vec2 u_noiseScale;
uniform float u_angle;
uniform float u_foaminess;
uniform vec2 u_foamOffset;
uniform float u_levelOffset;

vec2 rotate(vec2 uv, vec2 pivot, float r) {
  mat2 rotation = mat2(vec2(sin(r), -cos(r)), vec2(cos(r), sin(r)));
  uv -= pivot;
  uv = rotation * uv;
  uv += pivot;
  return uv;
}

void main() {
  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec4 mask = texture2D(u_mask, uv);
  if (mask.a < 0.04) discard;
  vec2 rotated_uv = rotate(uv, vec2(0.5), u_angle);
  float bubbles = texture2D(u_noise, (uv - u_foamOffset) * u_noiseScale).r;
  float borderBonus = abs(rotated_uv.x - 0.5);
  borderBonus = pow(borderBonus, 4.0) * 2.0;
  float t = rotated_uv.y + bubbles * u_foaminess + borderBonus + u_levelOffset;
  vec4 gr = texture2D(u_gradient, vec2(clamp(t, 0.0, 1.0), 0.5));
  float a = gr.a * mask.a;
  gl_FragColor = vec4(gr.rgb * a, a);
}
`;

const HOLO_FS = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_mask;
uniform sampler2D u_gradient;
uniform sampler2D u_noise;
uniform vec2 u_scroll1;
uniform vec2 u_scroll2;
uniform float u_noise1Scale;
uniform float u_noise2Scale;
uniform float u_wobbliness;
uniform float u_time;

void main() {
  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec4 mask = texture2D(u_mask, uv);
  if (mask.a < 0.04) discard;
  float intensity1 = texture2D(u_noise, uv * u_noise1Scale + u_time * u_scroll1).r;
  float intensity2 = texture2D(u_noise, uv * u_noise2Scale + u_time * u_scroll2).r;
  float intensity = intensity1 * intensity2;
  vec4 gr = texture2D(u_gradient, vec2(clamp(pow(intensity, 1.45) * mask.a * u_wobbliness, 0.0, 1.0), 0.5));
  float a = gr.a * mask.a * 0.28;
  gl_FragColor = vec4(gr.rgb * a, a);
}
`;

const MAX_DRAW = 24;

/** @type {WebGLRenderingContext | null} */
let gl = null;
/** @type {HTMLCanvasElement | null} */
let glCanvas = null;
let potionProg = null;
let holoProg = null;
let quadBuf = null;
/** @type {Map<string, WebGLTexture>} */
const texCache = new Map();
/** @type {Map<string, HTMLImageElement | HTMLCanvasElement>} */
const imgCache = new Map();

function assetPrefix() {
  const raw = document.body?.dataset?.root ?? './';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

function compile(ctx, type, src) {
  const sh = ctx.createShader(type);
  ctx.shaderSource(sh, src);
  ctx.compileShader(sh);
  if (!ctx.getShaderParameter(sh, ctx.COMPILE_STATUS)) {
    console.warn(ctx.getShaderInfoLog(sh));
    ctx.deleteShader(sh);
    return null;
  }
  return sh;
}

function link(ctx, vsSrc, fsSrc) {
  const vs = compile(ctx, ctx.VERTEX_SHADER, vsSrc);
  const fs = compile(ctx, ctx.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) return null;
  const p = ctx.createProgram();
  ctx.attachShader(p, vs);
  ctx.attachShader(p, fs);
  ctx.bindAttribLocation(p, 0, 'a_pos');
  ctx.linkProgram(p);
  if (!ctx.getProgramParameter(p, ctx.LINK_STATUS)) {
    console.warn(ctx.getProgramInfoLog(p));
    ctx.deleteProgram(p);
    return null;
  }
  return p;
}

function ensureGl() {
  if (gl) return gl;
  glCanvas = document.createElement('canvas');
  glCanvas.width = 64;
  glCanvas.height = 64;
  gl = glCanvas.getContext('webgl', {
    premultipliedAlpha: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  if (!gl) return null;
  potionProg = link(gl, POTION_VS, POTION_FS);
  holoProg = link(gl, POTION_VS, HOLO_FS);
  quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  return gl;
}

function loadImage(url) {
  if (!url) return Promise.resolve(null);
  if (imgCache.has(url)) return Promise.resolve(imgCache.get(url));
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      imgCache.set(url, img);
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = url.startsWith('http') || url.startsWith('data:') ? url : `${assetPrefix()}${url.replace(/^\.\//, '')}`;
  });
}

function layerSrc(file) {
  if (!file) return '';
  if (file.startsWith('assets/')) return file;
  return `assets/item-layers/${file}`;
}

function uploadTex(ctx, key, source) {
  if (!source) return null;
  let tex = texCache.get(key);
  if (tex) return tex;
  tex = ctx.createTexture();
  ctx.bindTexture(ctx.TEXTURE_2D, tex);
  ctx.pixelStorei(ctx.UNPACK_FLIP_Y_WEBGL, 0);
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.REPEAT);
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.REPEAT);
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.LINEAR);
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.LINEAR);
  ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, ctx.RGBA, ctx.UNSIGNED_BYTE, source);
  texCache.set(key, tex);
  return tex;
}

function colorLuma(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function colorSat(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max < 1e-6 ? 0 : (max - min) / max;
}

function isFoamOrWhiteStop(c) {
  const r = Number(c?.[0]) || 0;
  const g = Number(c?.[1]) || 0;
  const b = Number(c?.[2]) || 0;
  const a = c?.[3] == null ? 1 : Number(c[3]);
  if (a < 0.25) return true;
  if (colorLuma(r, g, b) > 0.9 && colorSat(r, g, b) < 0.35) return true;
  if (colorLuma(r, g, b) > 0.85 && colorSat(r, g, b) < 0.2) return true;
  return false;
}

/**
 * Keep the foam/surface band (so drain still empties) but paint it with the
 * liquid RGB at alpha 0. Scene gradients use [1,1,1,0] foam; 2D gradients then
 * interpolate through chalk-white and blit as a filled flask.
 */
function sanitizePotionGradient(grad) {
  const cols = Array.isArray(grad?.colors) ? grad.colors : [[0.85, 0.1, 0.1, 1]];
  const offs =
    grad?.offsets?.length === cols.length
      ? grad.offsets
      : cols.map((_, i) => i / Math.max(1, cols.length - 1));
  let liq = null;
  for (const c of cols) {
    if (!isFoamOrWhiteStop(c)) {
      liq = c;
      break;
    }
  }
  if (!liq) liq = [0.85, 0.1, 0.1, 1];
  return {
    offsets: offs,
    colors: cols.map((c) => {
      if (!isFoamOrWhiteStop(c)) return c;
      return [liq[0], liq[1], liq[2], 0];
    }),
  };
}

function gradientCanvas(grad, potion) {
  const source = potion ? sanitizePotionGradient(grad) : grad;
  const key = `grad:${potion ? 'potion:' : ''}${JSON.stringify(source)}`;
  if (imgCache.has(key)) return imgCache.get(key);
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 1;
  const g = c.getContext('2d');
  const lg = g.createLinearGradient(0, 0, 256, 0);
  const offs = source?.offsets || [0, 1];
  const cols = source?.colors || [[1, 1, 1, 1]];
  for (let i = 0; i < cols.length; i += 1) {
    const t = offs[i] ?? i / Math.max(1, cols.length - 1);
    const [r, ge, b, a] = cols[i];
    lg.addColorStop(
      Math.min(1, Math.max(0, t)),
      `rgba(${Math.round(r * 255)},${Math.round(ge * 255)},${Math.round(b * 255)},${a ?? 1})`,
    );
  }
  g.fillStyle = lg;
  g.fillRect(0, 0, 256, 1);
  imgCache.set(key, c);
  return c;
}

function useQuad(ctx, prog) {
  ctx.useProgram(prog);
  ctx.bindBuffer(ctx.ARRAY_BUFFER, quadBuf);
  ctx.enableVertexAttribArray(0);
  ctx.vertexAttribPointer(0, 2, ctx.FLOAT, false, 0, 0);
}

function blitTo(target) {
  const ctx = target.getContext('2d', { alpha: true });
  if (!ctx || !glCanvas) return;
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(glCanvas, 0, 0, target.width, target.height);
}

function bindTex(ctx, prog, name, unit, tex) {
  const loc = ctx.getUniformLocation(prog, name);
  ctx.activeTexture(ctx.TEXTURE0 + unit);
  ctx.bindTexture(ctx.TEXTURE_2D, tex);
  ctx.uniform1i(loc, unit);
}

function sizeTarget(canvas, cssW, cssH) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(8, Math.round(cssW * dpr));
  const h = Math.max(8, Math.round(cssH * dpr));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  return { w, h };
}

/**
 * @param {HTMLCanvasElement} target
 * @param {object} spec
 * @param {{ angle: number, foaminess: number, foamOffset: number[], levelOffset: number }} state
 */
export function drawPotion(target, spec, state) {
  const ctx = ensureGl();
  if (!ctx || !potionProg) return false;
  const maskImg = imgCache.get(layerSrc(spec.mask));
  const noiseImg = imgCache.get(layerSrc(spec.noise || 'LavaNoise.png'));
  if (!maskImg || !noiseImg) return false;
  const { w, h } = sizeTarget(target, target.clientWidth || 64, target.clientHeight || 64);
  glCanvas.width = w;
  glCanvas.height = h;
  ctx.viewport(0, 0, w, h);
  ctx.clearColor(0, 0, 0, 0);
  ctx.clear(ctx.COLOR_BUFFER_BIT);
  useQuad(ctx, potionProg);
  const maskTex = uploadTex(ctx, `mask:${spec.mask}`, maskImg);
  const noiseTex = uploadTex(ctx, `noise:${spec.noise}`, noiseImg);
  const gradSrc = sanitizePotionGradient(spec.gradient);
  const gradTex = uploadTex(ctx, `grad:${JSON.stringify(gradSrc)}`, gradientCanvas(spec.gradient, true));
  bindTex(ctx, potionProg, 'u_mask', 0, maskTex);
  bindTex(ctx, potionProg, 'u_gradient', 1, gradTex);
  bindTex(ctx, potionProg, 'u_noise', 2, noiseTex);
  ctx.uniform2f(
    ctx.getUniformLocation(potionProg, 'u_noiseScale'),
    spec.noiseScale?.[0] || 1,
    spec.noiseScale?.[1] || 1,
  );
  ctx.uniform1f(ctx.getUniformLocation(potionProg, 'u_angle'), state.angle);
  ctx.uniform1f(ctx.getUniformLocation(potionProg, 'u_foaminess'), state.foaminess);
  ctx.uniform2f(
    ctx.getUniformLocation(potionProg, 'u_foamOffset'),
    state.foamOffset[0],
    state.foamOffset[1],
  );
  ctx.uniform1f(ctx.getUniformLocation(potionProg, 'u_levelOffset'), state.levelOffset);
  ctx.enable(ctx.BLEND);
  ctx.blendFunc(ctx.ONE, ctx.ONE_MINUS_SRC_ALPHA);
  ctx.drawArrays(ctx.TRIANGLE_STRIP, 0, 4);
  blitTo(target);
  return true;
}

/**
 * @param {HTMLCanvasElement} target
 * @param {object} spec
 * @param {HTMLImageElement | null} maskImg
 * @param {number} time
 */
export function drawHolo(target, spec, maskImg, time) {
  const ctx = ensureGl();
  if (!ctx || !holoProg || !maskImg) return false;
  const noiseImg = imgCache.get(layerSrc(spec.noise || 'SparkleNoise.png'));
  if (!noiseImg) return false;
  const { w, h } = sizeTarget(target, target.clientWidth || 64, target.clientHeight || 64);
  glCanvas.width = w;
  glCanvas.height = h;
  ctx.viewport(0, 0, w, h);
  ctx.clearColor(0, 0, 0, 0);
  ctx.clear(ctx.COLOR_BUFFER_BIT);
  useQuad(ctx, holoProg);
  const maskTex = uploadTex(ctx, `holomask:${maskImg.src || 'still'}`, maskImg);
  const noiseTex = uploadTex(ctx, `holonoise:${spec.noise}`, noiseImg);
  const gradTex = uploadTex(ctx, `holograd:${JSON.stringify(spec.gradient)}`, gradientCanvas(spec.gradient));
  bindTex(ctx, holoProg, 'u_mask', 0, maskTex);
  bindTex(ctx, holoProg, 'u_gradient', 1, gradTex);
  bindTex(ctx, holoProg, 'u_noise', 2, noiseTex);
  ctx.uniform2f(ctx.getUniformLocation(holoProg, 'u_scroll1'), spec.scroll1?.[0] || 0.003, spec.scroll1?.[1] || 0.22);
  ctx.uniform2f(ctx.getUniformLocation(holoProg, 'u_scroll2'), spec.scroll2?.[0] || -0.01, spec.scroll2?.[1] || 0.34);
  ctx.uniform1f(ctx.getUniformLocation(holoProg, 'u_noise1Scale'), spec.noise1Scale ?? 0.5);
  ctx.uniform1f(ctx.getUniformLocation(holoProg, 'u_noise2Scale'), spec.noise2Scale ?? 0.7);
  ctx.uniform1f(ctx.getUniformLocation(holoProg, 'u_wobbliness'), spec.wobbliness ?? 2.5);
  ctx.uniform1f(ctx.getUniformLocation(holoProg, 'u_time'), time);
  ctx.enable(ctx.BLEND);
  ctx.blendFunc(ctx.ONE, ctx.ONE_MINUS_SRC_ALPHA);
  ctx.drawArrays(ctx.TRIANGLE_STRIP, 0, 4);
  blitTo(target);
  return true;
}

export function preloadPotionMaps(spec) {
  return Promise.all([
    loadImage(layerSrc(spec.mask)),
    loadImage(layerSrc(spec.noise || 'LavaNoise.png')),
    spec.flask ? loadImage(layerSrc(spec.flask)) : null,
    spec.overlay ? loadImage(layerSrc(spec.overlay)) : null,
    spec.glow ? loadImage(layerSrc(spec.glow)) : null,
  ]);
}

export function preloadHoloMaps(spec) {
  return loadImage(layerSrc(spec.noise || 'SparkleNoise.png'));
}

export { MAX_DRAW, layerSrc, loadImage };
