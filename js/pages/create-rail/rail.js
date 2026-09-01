/**
 * Create right-rail shell — Filters | Build tabs + placeholder panels.
 * Isolate tab chrome before mounting real filters / meta-pane on /create/.
 */

const RANKS = [
  { id: 'bronze', label: 'Bronze', file: 'League_Bronze.png' },
  { id: 'silver', label: 'Silver', file: 'League_Silver.png' },
  { id: 'gold', label: 'Gold', file: 'League_Gold.png' },
  { id: 'platinum', label: 'Platinum', file: 'League_Platinum.png' },
  { id: 'diamond', label: 'Diamond', file: 'League_Diamond.png' },
  { id: 'master', label: 'Master', file: 'League_Master.png' },
  { id: 'grandmaster', label: 'Grandmaster', file: 'League_Grandmaster.png' },
  { id: 'grandma', label: 'Grandma', file: 'League_Grandma.png' },
];

/**
 * @param {HTMLElement} host
 * @returns {{ destroy: () => void }}
 */
export function mountCreateRail(host) {
  const rootRaw = document.body?.dataset?.root ?? '../../';
  const root = rootRaw.endsWith('/') ? rootRaw : `${rootRaw}/`;

  host.innerHTML = `
    <aside class="cr-rail items-filters il-filter" aria-label="Create side rail (sandbox)">
      <div class="cr-tabs" role="tablist" aria-label="Rail panels">
        <button
          type="button"
          class="cr-tab is-active"
          role="tab"
          id="cr-tab-filters"
          aria-selected="true"
          aria-controls="cr-panel-filters"
          data-cr-tab="filters"
        >Filter</button>
        <button
          type="button"
          class="cr-tab"
          role="tab"
          id="cr-tab-build"
          aria-selected="false"
          aria-controls="cr-panel-build"
          data-cr-tab="build"
          tabindex="-1"
        >Build</button>
      </div>
      <div class="cr-rule" aria-hidden="true"></div>

      <div
        class="cr-panel is-active"
        role="tabpanel"
        id="cr-panel-filters"
        aria-labelledby="cr-tab-filters"
        data-cr-panel="filters"
      >
        <p class="cr-wire__note">Placeholder — real Item Library filters land here on /create/.</p>
        <div class="il-filter__shade cr-wire-group">
          <div class="cr-wire cr-wire--head">${skel('11rem')} ${skel('2rem', 'round')}</div>
          <div class="cr-wire cr-wire--block">${skel('100%', 'bar')}</div>
        </div>
        <div class="il-filter__shade cr-wire-group">
          <div class="cr-wire cr-wire--orbs">
            ${Array.from({ length: 8 }, () => skel('2.4rem', 'orb')).join('')}
          </div>
        </div>
        <div class="il-filter__shade cr-wire-group">
          <div class="cr-wire cr-wire--checks">
            ${skel('7rem')} ${skel('6rem')} ${skel('7.5rem')}
            ${skel('8rem')} ${skel('6.5rem')} ${skel('7rem')} ${skel('5.5rem')}
          </div>
        </div>
        <div class="il-filter__shade cr-wire-group">
          <div class="cr-wire cr-wire--types">
            ${Array.from({ length: 10 }, () => skel('2.1rem', 'type')).join('')}
          </div>
          <div class="cr-wire cr-wire--search">${skel('100%', 'search')}</div>
        </div>
      </div>

      <div
        class="cr-panel"
        role="tabpanel"
        id="cr-panel-build"
        aria-labelledby="cr-tab-build"
        data-cr-panel="build"
        hidden
      >
        <p class="cr-wire__note">Placeholder — meta pane (title, class, tags, rank, R3/R10, essentials).</p>
        <div class="il-filter__shade cr-field-shade">
          <label class="cr-field">
            <span class="cr-label">Title</span>
            <span class="cr-input" aria-hidden="true">Build name…</span>
          </label>
          <label class="cr-field">
            <span class="cr-label">Class</span>
            <span class="cr-input" aria-hidden="true">Adventurer ▾</span>
          </label>
        </div>
        <section class="cr-tags il-filter__shade" aria-label="Build tags (wireframe)">
          <h3 class="cr-label cr-label--block">Tags</h3>
          <p class="cr-hint">Theory / Feasible / Real (OP is owner-only — not here).</p>
          <div class="cr-tags__list" role="group" aria-label="Tags">
            <button type="button" class="cr-tag" data-tag="theory" aria-pressed="false">Theory</button>
            <button type="button" class="cr-tag is-on" data-tag="feasible" aria-pressed="true">Feasible</button>
            <button type="button" class="cr-tag" data-tag="real" aria-pressed="false">Real</button>
          </div>
        </section>
        <section class="cr-rank il-filter__shade" aria-label="Rank (wireframe)">
          <h3 class="cr-label cr-label--block">Rank</h3>
          <p class="cr-hint">League this build was aimed at / played in.</p>
          <div class="cr-rank__list" role="radiogroup" aria-label="League rank">
            ${RANKS.map(
              (r, i) => `
              <button
                type="button"
                class="cr-rank__btn${i === 0 ? ' is-on' : ''}"
                role="radio"
                aria-checked="${i === 0 ? 'true' : 'false'}"
                data-rank="${r.id}"
                title="${escapeAttr(r.label)}"
              >
                <img
                  class="cr-rank__icon"
                  src="${escapeAttr(root)}assets/icons/leagues/${escapeAttr(r.file)}"
                  alt=""
                  width="48"
                  height="48"
                  draggable="false"
                  onerror="this.style.display='none'"
                />
                <span class="cr-rank__label">${escapeAttr(r.label)}</span>
              </button>`,
            ).join('')}
          </div>
        </section>
        <section class="cr-route il-filter__shade" aria-label="Round skills (wireframe)">
          <h3 class="cr-label cr-label--block">Round skills</h3>
          <p class="cr-hint">Drop a skill from the catalog (skills only — later).</p>
          <div class="cr-field-row">
            <div class="cr-ess__tier">
              <span class="cr-label cr-label--sm">Round 3</span>
              <div class="cr-ess__drop cr-ess__drop--skill" data-route="r3">Drop skill</div>
            </div>
            <div class="cr-ess__tier">
              <span class="cr-label cr-label--sm">Round 10</span>
              <div class="cr-ess__drop cr-ess__drop--skill" data-route="r10">Drop skill</div>
            </div>
          </div>
        </section>
        <section class="cr-ess il-filter__shade" aria-label="Essentials (wireframe)">
          <h3 class="cr-label cr-label--block">Essentials</h3>
          <p class="cr-hint">Drop from catalog or board (later).</p>
          <div class="cr-ess__tier">
            <span class="cr-label cr-label--sm">Needs</span>
            <div class="cr-ess__drop" data-tier="need">Drop zone</div>
          </div>
          <div class="cr-ess__tier">
            <span class="cr-label cr-label--sm">Wants</span>
            <div class="cr-ess__drop" data-tier="want">Drop zone</div>
          </div>
          <div class="cr-ess__tier">
            <span class="cr-label cr-label--sm">Good to have</span>
            <div class="cr-ess__drop" data-tier="nice">Drop zone</div>
          </div>
        </section>
        <div class="cr-wire cr-wire--io il-filter__shade">
          ${skel('6rem')} ${skel('6rem')}
        </div>
      </div>
    </aside>
  `;

  const tabs = [...host.querySelectorAll('[data-cr-tab]')];
  const panels = [...host.querySelectorAll('[data-cr-panel]')];

  /**
   * @param {string} id
   */
  function selectTab(id) {
    for (const tab of tabs) {
      const on = tab.getAttribute('data-cr-tab') === id;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
    }
    for (const panel of panels) {
      const on = panel.getAttribute('data-cr-panel') === id;
      panel.classList.toggle('is-active', on);
      panel.hidden = !on;
    }
  }

  host.addEventListener('click', (e) => {
    const rankBtn = e.target?.closest?.('.cr-rank__btn[data-rank]');
    if (rankBtn instanceof HTMLElement) {
      for (const el of host.querySelectorAll('.cr-rank__btn[data-rank]')) {
        const on = el === rankBtn;
        el.classList.toggle('is-on', on);
        el.setAttribute('aria-checked', on ? 'true' : 'false');
      }
      return;
    }
    const tagBtn = e.target?.closest?.('.cr-tag[data-tag]');
    if (tagBtn instanceof HTMLElement) {
      for (const el of host.querySelectorAll('.cr-tag[data-tag]')) {
        const on = el === tagBtn;
        el.classList.toggle('is-on', on);
        el.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      return;
    }
    const btn = e.target?.closest?.('[data-cr-tab]');
    if (!(btn instanceof HTMLElement)) return;
    const id = btn.getAttribute('data-cr-tab');
    if (id) selectTab(id);
  });

  host.addEventListener('keydown', (e) => {
    const t = e.target?.closest?.('[data-cr-tab]');
    if (!(t instanceof HTMLElement)) return;
    const i = tabs.indexOf(t);
    if (i < 0) return;
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % tabs.length;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const id = tabs[next].getAttribute('data-cr-tab');
    if (id) {
      selectTab(id);
      tabs[next].focus();
    }
  });

  return {
    destroy() {
      host.innerHTML = '';
    },
  };
}

/**
 * @param {string} width
 * @param {'bar' | 'round' | 'orb' | 'type' | 'search'} [kind]
 */
function skel(width, kind = 'bar') {
  const extra =
    kind === 'round' || kind === 'orb'
      ? ' cr-skel--round'
      : kind === 'type'
        ? ' cr-skel--type'
        : kind === 'search'
          ? ' cr-skel--search'
          : '';
  return `<span class="cr-skel${extra}" style="width:${width}" aria-hidden="true"></span>`;
}

/** @param {string} s */
function escapeAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}
