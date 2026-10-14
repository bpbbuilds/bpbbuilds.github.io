#!/usr/bin/env node

/** Static contract for the shared tooltip fade lifecycle. */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [tooltipCss, hoverJs, eventCss, eventJs, buildCss, buildJs, motionJs] = await Promise.all([
  readFile(new URL('js/shared/tooltip.css', root), 'utf8'),
  readFile(new URL('js/shared/tooltip-hover.js', root), 'utf8'),
  readFile(new URL('js/pages/build/event-banner-tip.css', root), 'utf8'),
  readFile(new URL('js/pages/build/event-banner-tip.js', root), 'utf8'),
  readFile(new URL('js/pages/build/more-build-tip.css', root), 'utf8'),
  readFile(new URL('js/pages/build/more-build-tip.js', root), 'utf8'),
  readFile(new URL('js/shared/tooltip-motion.js', root), 'utf8'),
]);

for (const surface of ['bpb-tooltip-float', 'build-more-tip', 'build-event-tip']) {
  assert.match(tooltipCss + eventCss + buildCss, new RegExp(`\\.${surface}\\.is-visible`), `${surface} has a fade-in state`);
  assert.match(tooltipCss + eventCss + buildCss, new RegExp(`\\.${surface}\\.is-hiding`), `${surface} has a fade-out state`);
}
assert.match(tooltipCss, /transition:[^;]*opacity[^;]*transform[^;]*visibility/s, 'shared tooltip host transitions opacity, transform, and visibility');
assert.match(tooltipCss, /prefers-reduced-motion:\s*reduce[\s\S]*?bpb-tooltip-float[\s\S]*?transition:\s*none/s, 'shared tooltip fade respects reduced motion');
assert.match(hoverJs, /tooltip-motion\.js/, 'shared tooltip hover uses the shared motion helper');
assert.match(hoverJs, /showTooltip/, 'shared tooltip hover uses the shared show lifecycle');
assert.match(hoverJs, /hideTooltip/, 'shared tooltip hover uses the shared hide lifecycle');
assert.match(eventJs, /tooltip-motion\.js/, 'event tips use the shared motion helper');
assert.match(eventJs, /showTooltip/, 'event tips use the shared show lifecycle');
assert.match(eventJs, /hideTooltip/, 'event tips use the shared hide lifecycle');
assert.match(buildJs, /tooltip-motion\.js/, 'build tips use the shared motion helper');
assert.match(buildJs, /showTooltip/, 'build tips use the shared show lifecycle');
assert.match(buildJs, /hideTooltip/, 'build tips use the shared hide lifecycle');
assert.match(motionJs, /offsetWidth/, 'shared show lifecycle commits the hidden base frame before entering');

console.log('tooltip transition smoke passed.');
