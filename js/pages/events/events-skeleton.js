/**
 * Events loading shells. Same grid as the finished catalog and event page,
 * with the banner slot at the real 16:9 size.
 */

import { skelBar, skelBlock, skelRegion } from '../../shared/skeleton.js';

/**
 * @param {string} width
 * @param {string} [height]
 */
function bar(width, height = '0.85rem') {
  return skelBar({ width, height, radius: '0.2rem' });
}

/**
 * @param {number} count
 * @param {string} icon
 */
function prizeRows(count, icon) {
  return Array.from({ length: count }, () => {
    return `<span class="events-skel-prize-row">${skelBlock({
      width: icon,
      height: icon,
      radius: '0.15rem',
    })}${bar('6.5rem', '0.8rem')}</span>`;
  }).join('');
}

/** Catalog: featured banner + details + rewards, and the filter rail. */
export function eventsCatalogSkeletonHtml() {
  const check = (width) =>
    `<span class="events-skel-check">${skelBlock({
      width: '1.35rem',
      height: '1.35rem',
      radius: '0.2rem',
    })}${bar(width, '1.05rem')}</span>`;

  return skelRegion(
    `<div class="events-layout">
      <div class="events-skel-open-row" aria-hidden="true">
        ${skelBlock({ width: '5.75rem', height: '2.2rem', radius: '0.45rem' })}
      </div>
      <div class="events-feed-col">
        <article class="events-featured">
          <span class="events-featured__media-link">
            <span class="events-featured__media">
              <span class="bpb-skel bpb-skel--block events-skel-art"></span>
            </span>
          </span>
          <div class="events-featured__body">
            <div class="events-featured__cols">
              <div class="events-featured__info events-skel-stack">
                ${bar('11rem', '1.85rem')}
                ${bar('6.5rem', '1.35rem')}
                ${bar('100%', '1.15rem')}
                ${bar('72%', '1.15rem')}
                <span class="events-skel-stack">
                  ${bar('100%')}
                  ${bar('94%')}
                  ${bar('61%')}
                </span>
                ${skelBlock({ width: '8.5rem', height: '2.35rem', radius: '0.25rem' })}
              </div>
              <aside class="events-featured__prize-col bpb-panel--rewards" aria-hidden="true">
                <div class="events-skel-stack">
                  ${bar('5.5rem', '0.95rem')}
                  ${bar('4.2rem', '0.8rem')}
                  ${prizeRows(1, '2.6rem')}
                  ${prizeRows(3, '1.35rem')}
                  ${bar('4.2rem', '0.8rem')}
                  ${prizeRows(2, '1.35rem')}
                </div>
              </aside>
            </div>
          </div>
        </article>
      </div>
      <aside class="items-filters il-filter events-filters" aria-hidden="true">
        <div class="il-filter__head">
          ${bar('8.5rem', '1.15rem')}
          ${skelBlock({ width: '2rem', height: '2rem', radius: '50%' })}
        </div>
        <div class="il-filter__shade events-filters__search events-skel-stack">
          ${bar('4.5rem', '1.15rem')}
          ${skelBlock({ width: '100%', height: '2.15rem', radius: '0.25rem' })}
        </div>
        <div class="il-filter__shade events-filters__menus">
          ${skelBlock({ width: '7.5rem', height: '2.1rem', radius: '0.25rem' })}
          ${skelBlock({ width: '6.5rem', height: '2.1rem', radius: '0.25rem' })}
        </div>
        <div class="il-filter__shade events-skel-stack">
          ${bar('4.2rem', '1.15rem')}
          <div class="il-filter__checks">
            ${check('3.2rem')}
            ${check('8.2rem')}
            ${check('4.2rem')}
            ${check('5.4rem')}
            ${check('3.6rem')}
          </div>
        </div>
      </aside>
    </div>`,
    { className: 'events-skel', label: 'Loading events' },
  );
}

/** Event page: title, section rail, overview (hero + cards), join column. */
export function eventsDetailSkeletonHtml() {
  const tab = skelBlock({ width: '100%', height: '2.15rem', radius: '0.2rem' });
  const fact = () =>
    `<section class="events-detail-stage__card events-skel-stack">
      ${bar('6.5rem', '1.15rem')}
      ${bar('100%')}
      ${bar('88%')}
      ${bar('54%')}
    </section>`;

  return skelRegion(
    `<div class="events-layout events-layout--detail">
      <article class="events-detail-hub">
        <header class="events-detail-persona">
          <div class="events-detail-persona__copy events-skel-stack">
            ${bar('12rem', '2.15rem')}
            ${bar('100%')}
            ${bar('76%')}
          </div>
        </header>
        <div class="events-detail-grid">
          <nav class="events-detail-rail" aria-hidden="true">
            <div class="events-detail-rail__list">
              ${tab}${tab}${tab}${tab}
            </div>
          </nav>
          <div class="events-detail-stage">
            <div class="events-detail-stage__panel events-detail-stage__panel--overview">
              <div class="events-detail-stage__overview-lead">
                <div class="events-detail-stage__overview-media">
                  <div class="events-detail-stage__hero">
                    <span class="bpb-skel bpb-skel--block events-skel-art"></span>
                  </div>
                  <div class="events-detail-stage__tags">
                    ${bar('5.4rem', '1.2rem')}
                    ${bar('4.4rem', '1.2rem')}
                    ${bar('6.2rem', '1.2rem')}
                    ${bar('3.6rem', '1.2rem')}
                  </div>
                </div>
                <section class="events-detail-stage__card events-skel-stack">
                  ${bar('8rem', '1.2rem')}
                  ${bar('100%')}
                  ${bar('96%')}
                  ${bar('91%')}
                  ${bar('64%')}
                </section>
              </div>
              <div class="events-detail-stage__overview-facts">
                ${fact()}${fact()}${fact()}
              </div>
            </div>
          </div>
          <div class="events-detail-join">
            <div class="events-detail-join__top">
              <div class="events-detail-join__station events-skel-stack">
                ${bar('6.5rem', '1.35rem')}
                ${bar('7.5rem', '2.2rem')}
              </div>
              ${skelBlock({ width: '100%', height: '2.6rem', radius: '0.25rem' })}
            </div>
            <aside class="events-detail-aside events-skel-stack" aria-hidden="true">
              ${bar('7rem', '1.25rem')}
              ${bar('100%')}
              ${bar('92%')}
              ${bar('84%')}
              ${bar('70%')}
            </aside>
          </div>
        </div>
      </article>
    </div>`,
    { className: 'events-skel', label: 'Loading event' },
  );
}
