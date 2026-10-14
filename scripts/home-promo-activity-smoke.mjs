import assert from 'node:assert/strict';
import { createPromoActivity } from '../js/pages/home/home-promo-activity.js';

const activity = createPromoActivity(true);
assert.equal(activity.active, true, 'promo starts active while visible and not hovered');

const changes = [];
const unsubscribe = activity.subscribe((active) => changes.push(active));

activity.setHovered(true);
assert.equal(activity.active, true, 'board hover does not interrupt an in-progress reveal');

activity.setBoardComplete(true);
assert.equal(activity.active, false, 'board hover pauses only after the reveal is complete');

let resumed = false;
const waiting = activity.wait().then(() => {
  resumed = true;
});
activity.setHovered(false);
await waiting;
assert.equal(resumed, true, 'leaving the board resumes the completed promo');
assert.equal(activity.active, true, 'promo is active after hover ends');
assert.deepEqual(changes, [true, false, true], 'activity reports initial, paused, and resumed states');

activity.setHovered(true);
activity.setBoardComplete(false);
assert.equal(activity.active, true, 'a new build can reveal while the pointer remains over the board');
activity.setBoardComplete(true);
assert.equal(activity.active, false, 'the next handoff waits for the pointer to leave the completed board');

activity.setViewportActive(false);
assert.equal(activity.active, false, 'out-of-viewport state still pauses the promo');
activity.setHovered(true);
const viewportWaiting = activity.wait();
activity.setHovered(false);
let viewportResumed = false;
const viewportResume = viewportWaiting.then(() => {
  viewportResumed = true;
});
activity.setViewportActive(true);
await viewportResume;
assert.equal(viewportResumed, true, 'viewport re-entry resumes the promo after hover is clear');
unsubscribe();

console.log('Home promo activity smoke passed.');
