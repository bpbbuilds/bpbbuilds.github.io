/**
 * BuildEntry-style History list row.
 */

/**
 * @param {string} s
 * @returns {string}
 */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {import('./run-model.js').HistoryRowModel} model
 * @param {{
 *   root: string,
 *   getSpriteUrl: (item: object) => string,
 *   itemsById: Map<string, object>,
 *   selected?: boolean,
 * }} opts
 * @returns {HTMLButtonElement}
 */
export function createRunRow(model, opts) {
  const root = opts.root.endsWith('/') ? opts.root : `${opts.root}/`;
  const winSrc = `${root}assets/icons/history/RoundResultTriangle.png`;
  const lossSrc = `${root}assets/icons/history/RoundResultTriangle_Loss.png`;
  const diceSrc = `${root}assets/icons/misc/DiceIcon.png`;
  const trophySrc = `${root}assets/icons/history/Trophy.png`;
  const watchSrc = `${root}assets/icons/history/Watch.png`;
  const heartSrc = `${root}assets/icons/history/Heart.png`;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'create-history__row';
  btn.setAttribute('role', 'option');
  btn.dataset.runId = String(model.runId);
  btn.setAttribute('aria-selected', opts.selected ? 'true' : 'false');
  if (opts.selected) btn.classList.add('is-selected');

  const className = escapeHtml(model.heroClass || 'Unknown');
  const strip = model.results
    .slice(0, 18)
    .map((r, i) => {
      const src = r.result === 'win' ? winSrc : lossSrc;
      return `<img
        class="create-history__wl"
        src="${src}"
        alt=""
        width="12"
        height="20"
        draggable="false"
        data-round-index="${i}"
        title="Round ${r.round}"
      />`;
    })
    .join('');

  const keyItems = model.keyItemIds
    .map((id) => {
      if (!id) return '';
      const item = opts.itemsById.get(id);
      if (!item) return '';
      const src = opts.getSpriteUrl(item);
      const name = escapeHtml(String(item.name || id));
      return `<img class="create-history__key" src="${escapeHtml(src)}" alt="${name}" title="${name}" width="36" height="36" draggable="false" />`;
    })
    .filter(Boolean)
    .join('');

  let rankHtml = '';
  if (model.showRanked && model.leagueIcon) {
    const dif = model.rankingDif;
    const difHtml =
      dif == null
        ? ''
        : `<span class="create-history__rank-dif ${
            dif > 0
              ? 'create-history__rank-dif--up'
              : 'create-history__rank-dif--down'
          }">${dif > 0 ? `+${dif}` : String(dif)}</span>`;
    rankHtml = `
      <div class="create-history__rank-wrap">
        <div class="create-history__rank-badge">
          <img class="create-history__league" src="${escapeHtml(model.leagueIcon)}" alt="${escapeHtml(model.rank)}" width="36" height="36" draggable="false" />
          <span class="create-history__rating">${model.leagueProgress}</span>
        </div>
        ${difHtml}
      </div>`;
  }

  btn.innerHTML = `
    <div class="create-history__row-top">
      <span class="create-history__date">${escapeHtml(model.relativeTime)}</span>
      ${
        model.version
          ? `<span class="create-history__version">${escapeHtml(model.version)}</span>`
          : ''
      }
    </div>
    <div class="create-history__row-main">
      <div class="create-history__class-wrap">
        ${
          model.classIcon
            ? `<img class="create-history__class-icon" src="${escapeHtml(model.classIcon)}" alt="${className}" width="40" height="40" draggable="false" />`
            : `<span class="create-history__class-fallback">${className.slice(0, 1)}</span>`
        }
        ${
          model.randomClass
            ? `<img class="create-history__dice" src="${diceSrc}" alt="Random class" width="18" height="18" draggable="false" />`
            : ''
        }
      </div>
      ${rankHtml}
      <div class="create-history__stats">
        <span class="create-history__stat" title="Wins">
          <img class="create-history__stat-icon" src="${trophySrc}" alt="" width="18" height="18" draggable="false" />
          <span class="create-history__stat-num">${model.wins}</span>
        </span>
        <span class="create-history__stat" title="Rounds">
          <img class="create-history__stat-icon" src="${watchSrc}" alt="" width="18" height="18" draggable="false" />
          <span class="create-history__stat-num">${model.rounds}</span>
        </span>
        <span class="create-history__stat create-history__stat--lives" title="Lives">
          <img class="create-history__stat-icon" src="${heartSrc}" alt="" width="18" height="18" draggable="false" />
          <span class="create-history__stat-num">${model.tries}</span>
        </span>
      </div>
    </div>
    ${
      strip || keyItems
        ? `<div class="create-history__row-bottom">
      ${
        strip
          ? `<div class="create-history__wl-strip" data-wl-strip>${strip}</div>`
          : ''
      }
      ${keyItems ? `<div class="create-history__keys">${keyItems}</div>` : ''}
    </div>`
        : ''
    }
  `;

  return btn;
}

/**
 * @param {HTMLButtonElement} btn
 * @param {boolean} selected
 */
export function setRunRowSelected(btn, selected) {
  btn.classList.toggle('is-selected', selected);
  btn.setAttribute('aria-selected', selected ? 'true' : 'false');
}
