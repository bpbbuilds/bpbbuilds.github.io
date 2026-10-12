import assert from 'node:assert/strict';
import {
  DESKTOP_TOOLTIP_REFERENCE_WIDTH,
  desktopTooltipScale,
} from '../js/shared/tooltip-scale.js';

assert.equal(DESKTOP_TOOLTIP_REFERENCE_WIDTH, 1440);
assert.equal(desktopTooltipScale(1440), 1);
assert.equal(desktopTooltipScale(1080), 0.75);
assert.equal(desktopTooltipScale(800), 0.72);
assert.equal(desktopTooltipScale(640), 1);
assert.equal(desktopTooltipScale(390), 1);
assert.equal(desktopTooltipScale(1920), 1);
assert.equal(desktopTooltipScale(Number.NaN), 1);

console.log('tooltip scale smoke: ok (1440 reference, 1080 desktop, narrow clamp, mobile)');
