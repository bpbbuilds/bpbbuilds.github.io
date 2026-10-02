/**
 * Paint one combat-sky frame. Layers are bound once; CSS vars skip if unchanged.
 */

import { sampleColor, sampleNum, samplePath, toCss } from './sample.js';
import {
  BLADES,
  HILL1,
  HILL2,
  HILL3,
  HOUSE,
  MOON_A,
  MOUNTAINS,
  PATH,
  ROOF,
  SHRUB,
  SKY_MOD,
  SKY_Y,
  STAR1_A,
  STAR2_A,
  STAR3_A,
  SUN_A,
  WINDOWS,
  WINDMILL,
} from './tracks.js';

/**
 * @param {HTMLElement} host
 */
export function bindSkyLayers(host) {
  const layer = (name) => host.querySelector(`[data-layer="${name}"]`);
  const wm = layer('windmill');
  return {
    stage: host.querySelector('.combat-sky__stage'),
    sun: layer('sun'),
    moon: layer('moon'),
    star1: layer('star1'),
    star2: layer('star2'),
    star3: layer('star3'),
    shrubbery: layer('shrubbery'),
    mountains: layer('mountains'),
    hill3: layer('hill3'),
    house: layer('house'),
    windows: layer('windows'),
    roof: layer('roof'),
    hill2: layer('hill2'),
    hill1: layer('hill1'),
    path: layer('path'),
    windmill: wm,
    last: /** @type {Record<string, string>} */ ({}),
  };
}

/**
 * @param {HTMLElement | null} el
 * @param {string} prop
 * @param {string} value
 * @param {Record<string, string>} last
 */
function setVar(el, prop, value, last) {
  if (!el) return;
  const key = `${el.dataset.layer || el.className}:${prop}`;
  if (last[key] === value) return;
  last[key] = value;
  el.style.setProperty(prop, value);
}

/**
 * @param {HTMLElement | null} el
 * @param {Record<string, string>} last
 * @param {{ x: number, y: number, a: number }} pose
 */
function setCelestial(el, last, pose) {
  setVar(el, '--x', `${pose.x.toFixed(2)}px`, last);
  setVar(el, '--y', `${pose.y.toFixed(2)}px`, last);
  setVar(el, '--a', pose.a.toFixed(3), last);
}

/**
 * @param {HTMLElement | null} el
 * @param {Record<string, string>} last
 * @param {{ r: number, g: number, b: number, a?: number }} mod
 */
function setMod(el, last, mod) {
  setVar(el, '--mod', toCss(mod), last);
}

/**
 * @param {ReturnType<typeof bindSkyLayers>} layers
 * @param {number} t
 */
export function applyTime(layers, t) {
  const { stage, last } = layers;
  if (!stage) return;

  setVar(stage, '--sky-mod', toCss(sampleColor(SKY_MOD.times, SKY_MOD.values, SKY_MOD.trans, t)), last);
  setVar(stage, '--sky-y', `${sampleNum(SKY_Y.times, SKY_Y.values, SKY_Y.trans, t).toFixed(2)}px`, last);

  const sunT = Math.min(t, 15.2);
  setCelestial(layers.sun, last, {
    x: samplePath([0, 15.2], [57, 1950], sunT),
    y: samplePath([0, 7, 15.2], [582, 119.446, 500], sunT),
    a: sampleNum(SUN_A.times, SUN_A.values, SUN_A.trans, t),
  });

  const moonT = Math.max(t, 15.7);
  setCelestial(layers.moon, last, {
    x: t < 15.7 ? 119 : samplePath([15.7, 28.9], [119, 2050], moonT),
    y: t < 15.7 ? 633 : samplePath([15.7, 22.6, 28.9], [633, 119.446, 450], moonT),
    a: sampleNum(MOON_A.times, MOON_A.values, MOON_A.trans, t),
  });

  setCelestial(layers.star1, last, {
    x: 195,
    y: 136,
    a: sampleNum(STAR1_A.times, STAR1_A.values, null, t),
  });
  setCelestial(layers.star2, last, {
    x: 848,
    y: 213,
    a: sampleNum(STAR2_A.times, STAR2_A.values, null, t),
  });
  setCelestial(layers.star3, last, {
    x: 1155,
    y: 312,
    a: sampleNum(STAR3_A.times, STAR3_A.values, null, t),
  });

  setMod(layers.shrubbery, last, sampleColor(SHRUB.times, SHRUB.values, SHRUB.trans, t));
  setMod(layers.mountains, last, sampleColor(MOUNTAINS.times, MOUNTAINS.values, MOUNTAINS.trans, t));
  setMod(layers.hill3, last, sampleColor(HILL3.times, HILL3.values, HILL3.trans, t));
  setMod(layers.house, last, sampleColor(HOUSE.times, HOUSE.values, HOUSE.trans, t));
  setMod(layers.windows, last, sampleColor(WINDOWS.times, WINDOWS.values, WINDOWS.trans, t));
  setMod(layers.roof, last, sampleColor(ROOF.times, ROOF.values, ROOF.trans, t));
  setMod(layers.hill2, last, sampleColor(HILL2.times, HILL2.values, HILL2.trans, t));
  const hill1Mod = sampleColor(HILL1.times, HILL1.values, HILL1.trans, t);
  setMod(layers.hill1, last, hill1Mod);
  setVar(stage, '--ground-mod', toCss(hill1Mod), last);
  setMod(layers.path, last, sampleColor(PATH.times, PATH.values, PATH.trans, t));

  if (layers.windmill) {
    setVar(
      layers.windmill,
      '--mod',
      toCss(sampleColor(WINDMILL.times, WINDMILL.values, WINDMILL.trans, t)),
      last,
    );
    setVar(
      layers.windmill,
      '--blade-mod',
      toCss(sampleColor(BLADES.times, BLADES.values, BLADES.trans, t)),
      last,
    );
  }
}
