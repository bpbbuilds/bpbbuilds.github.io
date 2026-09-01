/**
 * Homepage combat day→night backdrop — scroll-scrubbed like game Round anim.
 *
 *   import { initCombatSky } from './combat-sky.js';
 *   initCombatSky();
 */

const DESIGN_W = 1920;
const DESIGN_H = 1080;
/** Match combat delay / morning start */
const T_START = 2.5;
/** Deep night hold (skip late star encore / loop) */
const T_END = 30;
/** Bright day freeze for reduced motion */
const T_REDUCED = 6;

function rootPrefix() {
  const raw = document.body?.dataset?.root ?? './';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

function rgb(r, g, b, a = 1) {
  return { r, g, b, a };
}

function toCss({ r, g, b, a }) {
  const R = Math.round(r * 255);
  const G = Math.round(g * 255);
  const B = Math.round(b * 255);
  return a >= 0.999 ? `rgb(${R},${G},${B})` : `rgba(${R},${G},${B},${a})`;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpColor(a, b, t) {
  return {
    r: lerp(a.r, b.r, t),
    g: lerp(a.g, b.g, t),
    b: lerp(a.b, b.b, t),
    a: lerp(a.a, b.a, t),
  };
}

/** Godot-ish ease: negative transition ≈ ease-in-out */
function easeT(t, transition = 1) {
  if (transition === 1 || Math.abs(transition - 1) < 1e-6) return t;
  return t * t * (3 - 2 * t);
}

/**
 * @param {number[]} times
 * @param {unknown[]} values
 * @param {number[]} [transitions]
 * @param {number} t
 * @param {(a: unknown, b: unknown, u: number) => unknown} mix
 */
function sampleTrack(times, values, transitions, t, mix) {
  if (t <= times[0]) return values[0];
  if (t >= times[times.length - 1]) return values[values.length - 1];
  let i = 0;
  while (i < times.length - 1 && times[i + 1] < t) i += 1;
  const t0 = times[i];
  const t1 = times[i + 1];
  const u = easeT((t - t0) / (t1 - t0), transitions?.[i] ?? 1);
  return mix(values[i], values[i + 1], u);
}

function sampleColor(times, values, transitions, t) {
  return /** @type {{r:number,g:number,b:number,a:number}} */ (
    sampleTrack(times, values, transitions, t, lerpColor)
  );
}

function sampleNum(times, values, transitions, t) {
  return /** @type {number} */ (sampleTrack(times, values, transitions, t, lerp));
}

/** Piecewise ease through numeric keys (sun/moon arcs). */
function samplePath(times, values, t) {
  return sampleNum(times, values, times.map(() => -1.5), t);
}

/* —— Round keyframes (Core/Main.tscn BackgroundAnimation) —— */

const SKY_MOD = {
  times: [0, 2, 6.2, 9.3, 11, 13.8, 15.7, 17.4, 21.2, 26.3],
  values: [
    rgb(1, 0.686275, 0.172549),
    rgb(0.172549, 0.643137, 1),
    rgb(0.34902, 0.658824, 1),
    rgb(0.533333, 0.713726, 0.968627),
    rgb(0.984314, 0.764706, 0.341176),
    rgb(0.905882, 0.301961, 0.141176),
    rgb(0.403922, 0.266667, 0.529412),
    rgb(0.0117647, 0.0470588, 0.407843),
    rgb(0.054902, 0.0980392, 0.509804),
    rgb(0, 0.0196078, 0.2),
  ],
  trans: [-1.51572, -1.51572, 1, -1.51572, -1.51572, -1.51572, -1.51572, -1.51572, 1, 1],
};

const SKY_Y = {
  times: [0, 2, 7.1, 17.2],
  values: [-400, -400, -700, 13],
  trans: [-2, -2, -2, -2],
};

const HILL1 = {
  times: [0, 4.5, 9.3, 10.7, 11.9, 14.2, 16.3, 19.1],
  values: [
    rgb(0.12549, 0.180392, 0.109804),
    rgb(0.678431, 0.694118, 0.203922),
    rgb(0.709804, 0.823529, 0.333333),
    rgb(0.831373, 0.615686, 0.207843),
    rgb(0.858824, 0.580392, 0.219608),
    rgb(0.807843, 0.521569, 0.333333),
    rgb(0.658824, 0.364706, 0.545098),
    rgb(0.196078, 0.266667, 0.352941),
  ],
  trans: Array(8).fill(-1.46409),
};

const HILL2 = {
  times: [0, 1.2, 8.6, 10.4, 13.7, 15.4, 18.8, 26.2],
  values: [
    rgb(0.227451, 0.298039, 0.164706),
    rgb(0.52549, 0.533333, 0.2),
    rgb(0.533333, 0.580392, 0.211765),
    rgb(0.521569, 0.372549, 0.101961),
    rgb(0.588235, 0.368627, 0.239216),
    rgb(0.447059, 0.235294, 0.364706),
    rgb(0.0823529, 0.113725, 0.172549),
    rgb(0.0627451, 0.109804, 0.203922),
  ],
  trans: [-1.46409, -1.46409, -1.46409, -1.46409, -1.46409, -1.46409, -1.46409, 1],
};

const HILL3 = {
  times: [0, 2, 8.1, 9, 10.3, 12.7, 14.9, 18.1, 21.4, 26.3],
  values: [
    rgb(0.458824, 0.572549, 0.247059),
    rgb(0.678431, 0.694118, 0.203922),
    rgb(0.726196, 0.858745, 0.354353),
    rgb(0.858824, 0.815686, 0.352941),
    rgb(0.694118, 0.439216, 0.109804),
    rgb(0.807843, 0.521569, 0.333333),
    rgb(0.729412, 0.392157, 0.6),
    rgb(0.0705882, 0.121569, 0.219608),
    rgb(0.133333, 0.168627, 0.239216),
    rgb(0.0509804, 0.101961, 0.215686),
  ],
  trans: [-1.46409, -1.46409, -1.46409, -1.46409, -1.46409, -1.46409, -1.46409, 1, 1, 1],
};

const MOUNTAINS = {
  times: [0, 2, 7.1, 9.6, 11, 14, 19.1],
  values: [
    rgb(0.584314, 0.584314, 0.584314),
    rgb(0.584314, 0.584314, 0.584314),
    rgb(0.941176, 0.941176, 0.941176),
    rgb(0.933333, 0.878431, 0.694118),
    rgb(0.513726, 0.415686, 0.282353),
    rgb(0.0235294, 0.0235294, 0.0705882),
    rgb(0, 0.00392157, 0.0313726),
  ],
  trans: Array(7).fill(-1.46409),
};

const HOUSE = {
  times: [0, 2, 7.1, 9.6, 11, 14, 19.1],
  values: [
    rgb(0.45098, 0.376471, 0.431373),
    rgb(0.45098, 0.376471, 0.431373),
    rgb(0.619608, 0.556863, 0.603922),
    rgb(0.529412, 0.368627, 0.407843),
    rgb(0.482353, 0.290196, 0.219608),
    rgb(0.309804, 0.192157, 0.25098),
    rgb(0.184314, 0.160784, 0.211765),
  ],
  trans: Array(7).fill(-1.46409),
};

const ROOF = {
  times: [0, 2, 7.1, 10.2, 13.9, 19.1],
  values: [
    rgb(0.898039, 0.588235, 0.505882),
    rgb(0.898039, 0.588235, 0.505882),
    rgb(0.992157, 0.505882, 0.376471),
    rgb(0.917647, 0.541176, 0.141176),
    rgb(0.309804, 0.223529, 0.184314),
    rgb(0.117647, 0.109804, 0.105882),
  ],
  trans: [1, 1, 1, 1, 1, 1],
};

const PATH = {
  times: [0, 4.4, 8.6, 11.5, 13.7, 16.8, 18.5, 20.5],
  values: [
    rgb(0.172549, 0.152941, 0.0823529),
    rgb(0.796078, 0.670588, 0.435294),
    rgb(0.945098, 0.776471, 0.466667),
    rgb(0.654902, 0.403922, 0.0980392),
    rgb(0.545098, 0.278431, 0.164706),
    rgb(0.47451, 0.2, 0.376471),
    rgb(0.14902, 0.172549, 0.309804),
    rgb(0.0862745, 0.160784, 0.239216),
  ],
  trans: Array(8).fill(1),
};

const WINDMILL = {
  times: [0, 1.8, 4.7, 9.5, 11.2, 12.8, 14.5, 16.4, 17.9],
  values: [
    rgb(0.847059, 0.545098, 0.243137),
    rgb(0.780392, 0.509804, 0.364706),
    rgb(0.92549, 0.576471, 0.376471),
    rgb(0.721569, 0.407843, 0.211765),
    rgb(0.807843, 0.541176, 0.247059),
    rgb(0.721569, 0.364706, 0.2),
    rgb(0.658824, 0.305882, 0.541176),
    rgb(0.254902, 0.25098, 0.478431),
    rgb(0.235294, 0.298039, 0.376471),
  ],
  trans: Array(9).fill(1),
};

const BLADES = {
  times: [0, 3, 6.3, 9.8, 12.1, 13.3, 14.7, 16.3, 17.8, 36.2],
  values: [
    rgb(0.929412, 0.839216, 0.584314),
    rgb(0.976471, 0.843137, 0.717647),
    rgb(0.945098, 0.905882, 0.8),
    rgb(0.898039, 0.780392, 0.580392),
    rgb(0.796078, 0.572549, 0.392157),
    rgb(0.839216, 0.486275, 0.305882),
    rgb(0.776471, 0.407843, 0.686275),
    rgb(0.298039, 0.360784, 0.545098),
    rgb(0.329412, 0.466667, 0.545098),
    rgb(0.760784, 0.733333, 0.607843),
  ],
  trans: Array(10).fill(1),
};

const SHRUB = { ...HILL3 };

const WINDOWS = {
  times: [0, 2, 3.1, 7.1, 10.3, 14, 21.6, 23.5],
  values: [
    rgb(0.0705882, 0.0705882, 0.0705882),
    rgb(0.215686, 0.215686, 0.215686),
    rgb(0.231373, 0.431373, 0.509804),
    rgb(0.52549, 0.486275, 0.517647),
    rgb(0.145098, 0.141176, 0.141176),
    rgb(0.670588, 0.607843, 0.301961),
    rgb(0.670588, 0.572549, 0.301961),
    rgb(0.184314, 0.160784, 0.211765),
  ],
  trans: [-1.46409, -1.46409, 1, -1.46409, -1.46409, -1.46409, -1.46409, -1.46409],
};

const SUN_A = {
  times: [0, 2, 13.6, 14.7, 50],
  values: [0.00392157, 1, 1, 0, 0],
  trans: [1, 1, 1, 1, 1],
};

const MOON_A = {
  times: [0, 2, 14.7, 15.6, 27, 27.8],
  values: [0, 0, 0, 1, 1, 0],
  trans: [1, 1, 1, 1, 1, 1],
};

const STAR1_A = {
  times: [0, 2, 17.8, 18.8, 19.4, 20.4, 20.9, 21.7, 23, 30.3],
  values: [0, 0, 0, 1, 0.490196, 1, 0.490196, 1, 0, 0],
};

const STAR2_A = {
  times: [0, 2, 21.5, 23.1, 24.2, 25.2, 25.7, 26.5, 27.3],
  values: [0, 0, 0, 1, 0.490196, 1, 0.490196, 1, 0],
};

const STAR3_A = {
  times: [0, 2, 23.6, 24.6, 25.2, 26.2, 26.7, 27.5, 28.5],
  values: [0, 0, 0, 1, 0.490196, 1, 0.490196, 1, 0],
};

function texUrl(root, name) {
  // Single quotes — safe inside style="...". Must be applied as mask-image/background-image
  // on the element (inline), not via a CSS custom property consumed by combat-sky.css —
  // urls in vars resolve against the stylesheet path (js/pages/home/), which 404s.
  return `url('${root}assets/theme/backgrounds/combat/${name}')`;
}

/** Inline mask declarations resolved against the document URL. */
function maskInline(root, name) {
  const u = texUrl(root, name);
  return `-webkit-mask-image:${u};mask-image:${u}`;
}

function setSpr(el, { x, y, mod, a }) {
  if (x != null) el.style.setProperty('--x', `${x}px`);
  if (y != null) el.style.setProperty('--y', `${y}px`);
  if (mod) el.style.setProperty('--mod', toCss(mod));
  if (a != null) el.style.setProperty('--a', String(a));
}

function setCelestial(el, { x, y, a }) {
  el.style.setProperty('--x', `${x}px`);
  el.style.setProperty('--y', `${y}px`);
  el.style.setProperty('--a', String(a));
}

/**
 * @param {HTMLElement} host
 * @param {number} t
 */
function applyTime(host, t) {
  const stage = host.querySelector('.combat-sky__stage');
  if (!stage) return;

  const skyMod = sampleColor(SKY_MOD.times, SKY_MOD.values, SKY_MOD.trans, t);
  const skyY = sampleNum(SKY_Y.times, SKY_Y.values, SKY_Y.trans, t);
  stage.style.setProperty('--sky-mod', toCss(skyMod));
  stage.style.setProperty('--sky-y', `${skyY}px`);

  const sunX = samplePath([0, 15.2], [57, 1950], Math.min(t, 15.2));
  const sunY = samplePath([0, 7, 15.2], [582, 119.446, 500], Math.min(t, 15.2));
  const sunA = sampleNum(SUN_A.times, SUN_A.values, SUN_A.trans, t);
  setCelestial(host.querySelector('[data-layer="sun"]'), { x: sunX, y: sunY, a: sunA });

  const moonT = Math.max(t, 15.7);
  const moonX = t < 15.7 ? 119 : samplePath([15.7, 28.9], [119, 2050], moonT);
  const moonY = t < 15.7 ? 633 : samplePath([15.7, 22.6, 28.9], [633, 119.446, 450], moonT);
  const moonA = sampleNum(MOON_A.times, MOON_A.values, MOON_A.trans, t);
  setCelestial(host.querySelector('[data-layer="moon"]'), { x: moonX, y: moonY, a: moonA });

  setCelestial(host.querySelector('[data-layer="star1"]'), {
    x: 195,
    y: 136,
    a: sampleNum(STAR1_A.times, STAR1_A.values, null, t),
  });
  setCelestial(host.querySelector('[data-layer="star2"]'), {
    x: 848,
    y: 213,
    a: sampleNum(STAR2_A.times, STAR2_A.values, null, t),
  });
  setCelestial(host.querySelector('[data-layer="star3"]'), {
    x: 1155,
    y: 312,
    a: sampleNum(STAR3_A.times, STAR3_A.values, null, t),
  });

  setSpr(host.querySelector('[data-layer="shrubbery"]'), {
    mod: sampleColor(SHRUB.times, SHRUB.values, SHRUB.trans, t),
  });
  setSpr(host.querySelector('[data-layer="mountains"]'), {
    mod: sampleColor(MOUNTAINS.times, MOUNTAINS.values, MOUNTAINS.trans, t),
  });
  setSpr(host.querySelector('[data-layer="hill3"]'), {
    mod: sampleColor(HILL3.times, HILL3.values, HILL3.trans, t),
  });
  setSpr(host.querySelector('[data-layer="house"]'), {
    mod: sampleColor(HOUSE.times, HOUSE.values, HOUSE.trans, t),
  });
  setSpr(host.querySelector('[data-layer="windows"]'), {
    mod: sampleColor(WINDOWS.times, WINDOWS.values, WINDOWS.trans, t),
  });
  setSpr(host.querySelector('[data-layer="roof"]'), {
    mod: sampleColor(ROOF.times, ROOF.values, ROOF.trans, t),
  });
  setSpr(host.querySelector('[data-layer="hill2"]'), {
    mod: sampleColor(HILL2.times, HILL2.values, HILL2.trans, t),
  });
  setSpr(host.querySelector('[data-layer="hill1"]'), {
    mod: sampleColor(HILL1.times, HILL1.values, HILL1.trans, t),
  });
  setSpr(host.querySelector('[data-layer="path"]'), {
    mod: sampleColor(PATH.times, PATH.values, PATH.trans, t),
  });

  const wm = host.querySelector('[data-layer="windmill"]');
  if (wm) {
    wm.style.setProperty('--mod', toCss(sampleColor(WINDMILL.times, WINDMILL.values, WINDMILL.trans, t)));
    wm.style.setProperty(
      '--blade-mod',
      toCss(sampleColor(BLADES.times, BLADES.values, BLADES.trans, t)),
    );
  }
}

function scrollTime(reduced) {
  if (reduced) return T_REDUCED;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const p = max <= 0 ? 0 : Math.min(1, Math.max(0, window.scrollY / max));
  return T_START + p * (T_END - T_START);
}

function fitScale(host) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scale = Math.max(vw / DESIGN_W, vh / DESIGN_H);
  host.style.setProperty('--combat-sky-scale', String(scale));
}

function buildDom(root) {
  const host = document.createElement('div');
  host.className = 'combat-sky';
  host.setAttribute('aria-hidden', 'true');

  const img = (file) => `${root}assets/theme/backgrounds/combat/${file}`;

  host.innerHTML = `
    <div class="combat-sky__stage">
      <div class="combat-sky__sky"></div>
      <div class="combat-sky__celestial" data-layer="sun" style="--w:282px;--h:282px;--sx:1.4;--sy:1.4">
        <img src="${img('Sun.png')}" alt="" width="282" height="282" decoding="async" />
      </div>
      <div class="combat-sky__celestial combat-sky__star" data-layer="star1" style="--w:106px;--h:125px;--sx:0.91;--sy:0.91">
        <img src="${img('Star.png')}" alt="" width="106" height="125" decoding="async" />
      </div>
      <div class="combat-sky__celestial combat-sky__star" data-layer="star2" style="--w:106px;--h:125px;--sx:1.11;--sy:1.11">
        <img src="${img('Star.png')}" alt="" width="106" height="125" decoding="async" />
      </div>
      <div class="combat-sky__celestial combat-sky__star" data-layer="star3" style="--w:106px;--h:125px;--sx:0.69;--sy:0.69">
        <img src="${img('Star.png')}" alt="" width="106" height="125" decoding="async" />
      </div>
      <div class="combat-sky__celestial" data-layer="moon" style="--w:270px;--h:294px">
        <img src="${img('Moon.png')}" alt="" width="270" height="294" decoding="async" />
      </div>
      <div class="combat-sky__spr" data-layer="shrubbery"
        style="--x:1179px;--y:350px;--w:601px;--h:147px;--rot:-14.8deg;${maskInline(root, 'Shrubbery.png')}"></div>
      <div class="combat-sky__windmill" data-layer="windmill"
        style="--x:1062px;--y:371px;--w:82px;--h:162px;--sy:1.012">
        <div class="combat-sky__windmill-tower" style="${maskInline(root, 'Windmill.png')}"></div>
        <div class="combat-sky__blade-pivot">
          <div class="combat-sky__blades" style="${maskInline(root, 'WindmillBlades.png')}"></div>
        </div>
      </div>
      <div class="combat-sky__spr" data-layer="mountains"
        style="--x:399px;--y:367px;--w:765px;--h:242px;${maskInline(root, 'Mountains.png')}"></div>
      <div class="combat-sky__spr" data-layer="hill3"
        style="--x:967.5px;--y:458px;--w:1920px;--h:511px;--sx:0.983;${maskInline(root, 'Hill3.png')}"></div>
      <div class="combat-sky__spr" data-layer="house"
        style="--x:853.8px;--y:415.5px;--w:125px;--h:82px;--sx:1.232;--sy:1.232;${maskInline(root, 'House.png')}"></div>
      <div class="combat-sky__spr" data-layer="windows"
        style="--x:858.5px;--y:416.25px;--w:104px;--h:41px;--sx:1.221;--sy:1.159;${maskInline(root, 'Windows.png')}"></div>
      <div class="combat-sky__spr" data-layer="roof"
        style="--x:853.5px;--y:383px;--w:151px;--h:55px;--sx:1.238;--sy:1.241;${maskInline(root, 'Roof.png')}"></div>
      <div class="combat-sky__spr" data-layer="hill2"
        style="--x:955px;--y:675px;--w:1920px;--h:595px;--sx:0.991;${maskInline(root, 'Hill2.png')}"></div>
      <div class="combat-sky__spr" data-layer="hill1"
        style="--x:959.5px;--y:754px;--w:1920px;--h:633px;--sx:0.998;${maskInline(root, 'Hill1.png')}"></div>
      <div class="combat-sky__spr" data-layer="path"
        style="--x:1439px;--y:828px;--w:968px;--h:499px;${maskInline(root, 'Path.png')}"></div>
      <div class="combat-sky__speckles" style="background-image:${texUrl(root, 'Speckles.jpg')}"></div>
    </div>
  `;
  return host;
}

export function initCombatSky() {
  if (!document.body.classList.contains('page-home')) return;
  if (document.querySelector('.combat-sky')) return;

  const root = rootPrefix();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const host = buildDom(root);
  document.body.insertBefore(host, document.body.firstChild);

  fitScale(host);
  applyTime(host, scrollTime(reduced));

  let raf = 0;
  const queue = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      applyTime(host, scrollTime(reduced));
    });
  };

  if (!reduced) {
    window.addEventListener('scroll', queue, { passive: true });
  }
  window.addEventListener(
    'resize',
    () => {
      fitScale(host);
      queue();
    },
    { passive: true },
  );
}
