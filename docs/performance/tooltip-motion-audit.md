# Tooltip motion audit

Date: 2026-10-14
Scope: shared item/cosmetic tooltips, build preview tooltips, and event tooltips.

## Reference audit

The Vault Hunters gear/loadout surface is available at [vaulthunters.gg/gear](https://vaulthunters.gg/gear), with the "Millions of unique gear loadouts" carousel on the home page. The production bundle was inspected and the gear hover behavior was reproduced in a desktop browser.

The reference uses the Tippy React helper for each gear card. Its relevant options are:

- `animation: "fade"`
- `placement: "auto-start"`
- `followCursor: true`
- `hideOnClick: false`
- `arrow: false`
- `offset: [30, 30]`

The rendered popper uses `data-animation="fade"`. Hidden poppers use `opacity: 0`; the visible state transitions `transform`, `visibility`, and `opacity` over `0.3s`. Each card has its own lifecycle, so moving from one card to another hides the old popper and shows the new one rather than repeatedly re-rendering the same popper while the pointer crosses child nodes.

## Local failure

Our shared item host is intentionally a singleton so placement, pinning, and responsive scaling stay consistent across pages. It listens to bubbling `pointerover` events. Before this fix, every descendant `pointerover` (the sprite, frame, text, or stat node inside one item) called `show()` again for the same anchor. That replaced the card and restarted the anchor-switch keyframe continuously while the pointer moved inside one item. In practice the fade could remain in a restart loop and look like a hard swap or no animation.

The previous lifecycle also used a shorter `160ms` cadence than the reference, making a switch especially easy to miss during rapid card-to-card movement.

## Implemented behavior

- `createTooltipHover.show()` now treats a visible, unchanged anchor as a no-op apart from re-placement. Descendant pointer events no longer replace content or restart motion.
- Anchor changes still replace the rendered card once and restart the shared `is-swapping` fade. The host fades through the new card instead of flashing at full opacity.
- Shared enter/leave/switch timing is now `300ms`, matching the audited Tippy fade cadence. The reduced-motion media query still disables all motion.
- Existing tooltip placement, scale, z-index, pinning, focus behavior, and mobile layout are unchanged. The timing is viewport-independent, so 1440px, 1080px/short desktop, tablet, and mobile use the same lifecycle.

## Regression coverage

The focused browser smoke now verifies:

- a hidden tooltip enters from opacity below `1` and reaches `1`;
- a descendant `pointerover` keeps the same card and does not add `is-swapping`;
- changing anchors visibly fades and renders the second card;
- content stays mounted during the fade-out and is removed after it completes;
- build/event tooltip hosts use the same motion helper;
- 1440px, 1080px, tablet, and mobile retain the fade, while reduced motion reports `0s`.

Commands:

```text
node scripts/tooltip-transition-smoke.mjs
node scripts/tooltip-transition-browser-smoke.mjs
```
