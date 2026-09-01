/**
 * Shared loading skeletons — parchment shimmer bars/blocks.
 *
 *   import { skelBar, skelBlock, ensureSkeletonStyles } from '../../shared/skeleton.js';
 *
 * CSS: js/shared/skeleton.css (also pulled in via css/shared.css).
 */

/**
 * @param {{ className?: string, width?: string, height?: string, radius?: string }} [opts]
 */
export function skelBar(opts = {}) {
  const cls = ['bpb-skel', 'bpb-skel--bar', opts.className].filter(Boolean).join(' ');
  const style = [
    opts.width ? `width:${opts.width}` : '',
    opts.height ? `height:${opts.height}` : '',
    opts.radius ? `border-radius:${opts.radius}` : '',
  ]
    .filter(Boolean)
    .join(';');
  return `<span class="${cls}" style="${style}" aria-hidden="true"></span>`;
}

/**
 * @param {{ className?: string, width?: string, height?: string, radius?: string }} [opts]
 */
export function skelBlock(opts = {}) {
  const cls = ['bpb-skel', 'bpb-skel--block', opts.className].filter(Boolean).join(' ');
  const style = [
    opts.width ? `width:${opts.width}` : '',
    opts.height ? `height:${opts.height}` : '',
    opts.radius ? `border-radius:${opts.radius}` : '',
  ]
    .filter(Boolean)
    .join(';');
  return `<span class="${cls}" style="${style}" aria-hidden="true"></span>`;
}

/**
 * Wrap skeleton content with busy semantics.
 * @param {string} innerHtml
 * @param {{ className?: string, label?: string }} [opts]
 */
export function skelRegion(innerHtml, opts = {}) {
  const cls = ['bpb-skel-region', opts.className].filter(Boolean).join(' ');
  const label = opts.label || 'Loading';
  return `<div class="${cls}" role="status" aria-busy="true" aria-label="${label}">${innerHtml}</div>`;
}
