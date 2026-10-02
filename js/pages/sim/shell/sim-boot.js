/**
 * Sim first-paint: field-shaped skeleton, then a hidden live stage revealed once.
 */

import { skelBar, skelBlock, skelRegion } from '../../../shared/skeleton.js';
import { hudClashHtml } from '../hud/sim-hud.js';

/**
 * @param {HTMLElement} main
 * @param {string} [root]
 */
export function paintSimLoading(main, root = '../') {
  const railSlot = (kind = '') =>
    skelBlock({
      className: `sim-skel-rail-slot${kind ? ` sim-skel-rail-slot--${kind}` : ''}`,
      width: kind === 'person' ? '2.55rem' : '2.05rem',
      height: kind === 'person' ? '2.55rem' : '2.05rem',
      radius: kind === 'person' ? '0' : '0.32rem',
    });
  const hudCard = () => `
    <div class="sim-skel-hud" aria-hidden="true">
      ${skelBar({ className: 'sim-skel-hud-banner', width: '78%', height: '1.35rem' })}
      ${skelBar({ width: '100%', height: '0.85rem' })}
      ${skelBar({ width: '100%', height: '0.85rem' })}
      ${skelBlock({ height: '3.4rem', radius: '0.3rem' })}
      ${skelBlock({ height: '3.4rem', radius: '0.3rem' })}
    </div>
  `;

  main.innerHTML = skelRegion(
    `
    <div class="sim-shell sim-shell--field">
      <div class="sim-field" data-sim-layout>
        <section class="sim-region sim-region--controls sim-field__scrub">
          ${skelBlock({ className: 'sim-skel-scrub', height: '4.35rem', radius: '0.35rem' })}
        </section>
        <section class="sim-region sim-region--stage sim-field__bag sim-field__bag--you">
          <div class="sim-bag-wrap">
            <div class="sim-bag-head">
              ${skelBar({ width: '55%', height: '1.15rem' })}
              ${skelBlock({ className: 'sim-skel-class', width: '2.35rem', height: '2.35rem', radius: '0.3rem' })}
            </div>
            ${skelBlock({ className: 'sim-skel-board' })}
          </div>
          <div class="sim-avatar-stack sim-avatar-stack--you">
            ${skelBlock({ className: 'sim-skel-avatar', radius: '0.4rem' })}
          </div>
          <div class="sim-side-rail sim-side-rail--you" aria-hidden="true">
            ${railSlot('person')}${railSlot()}${railSlot()}
          </div>
        </section>
        <section class="sim-region sim-region--log sim-field__mid">
          <div class="sim-field__logbook">
            ${skelBlock({ className: 'sim-skel-book', radius: '0.4rem' })}
          </div>
        </section>
        <section class="sim-region sim-region--stage sim-field__bag sim-field__bag--opp">
          <div class="sim-opp-chrome">
            <div class="sim-bag-head">
              ${skelBar({ width: '55%', height: '1.15rem' })}
              ${skelBlock({ className: 'sim-skel-class', width: '2.35rem', height: '2.35rem', radius: '0.3rem' })}
            </div>
            <div class="sim-bag-wrap sim-bag-wrap--opp">
              ${skelBlock({ className: 'sim-skel-board' })}
            </div>
            <div class="sim-avatar-stack sim-avatar-stack--foe">
              ${skelBlock({ className: 'sim-skel-avatar', radius: '0.4rem' })}
            </div>
          </div>
          <div class="sim-side-rail sim-side-rail--foe" aria-hidden="true">
            ${railSlot()}
          </div>
        </section>
        <section class="sim-region sim-region--hud sim-field__hud">
          <div class="sim-hud-row">
            ${hudClashHtml(root)}
            ${hudCard()}
            ${hudCard()}
          </div>
        </section>
      </div>
      <aside class="sim-region sim-region--lab sim-field__tools">
        ${skelBar({ width: '42%', height: '0.85rem' })}
      </aside>
      <div class="sim-chrome-dock">
        ${skelBlock({ className: 'sim-skel-gear', radius: '50%', width: '2.85rem', height: '2.85rem' })}
        ${skelBlock({ className: 'sim-skel-gear', radius: '50%' })}
      </div>
    </div>
  `,
    { className: 'sim-boot-skel', label: 'Loading sim board' },
  );
  main.setAttribute('aria-busy', 'true');
}

/**
 * Hidden live tree, same box as the skeleton, so grids measure at real size.
 * @param {HTMLElement} main
 */
export function attachSimBootStage(main) {
  const stage = document.createElement('div');
  stage.className = 'sim-boot-stage';
  stage.setAttribute('aria-hidden', 'true');
  main.appendChild(stage);
  return stage;
}

/**
 * Drop the skeleton and unwrap the live shell in one paint.
 * @param {HTMLElement} main
 * @param {HTMLElement} stage
 */
export function revealSimBoot(main, stage) {
  main.querySelector(':scope > .bpb-skel-region')?.remove();
  while (stage.firstChild) main.appendChild(stage.firstChild);
  stage.remove();
  main.removeAttribute('aria-busy');
}

/**
 * Wait for board/avatar images (capped) plus a frame so both columns paint together.
 * @param {ParentNode} root
 * @param {number} [ms]
 */
export function waitForSimAssets(root, ms = 1600) {
  const imgs = [...root.querySelectorAll('img')].filter(
    (img) => img instanceof HTMLImageElement && !img.complete,
  );
  /** @type {Promise<unknown>[]} */
  const pending = imgs.map((img) => {
    if (typeof img.decode === 'function') return img.decode().catch(() => {});
    return new Promise((res) => {
      img.addEventListener('load', res, { once: true });
      img.addEventListener('error', res, { once: true });
    });
  });
  const loaded = pending.length ? Promise.all(pending) : Promise.resolve();
  const cap = new Promise((res) => window.setTimeout(res, ms));
  return Promise.race([loaded, cap]).then(
    () =>
      new Promise((res) => {
        requestAnimationFrame(() => requestAnimationFrame(res));
      }),
  );
}
