/**
 * Wrap the Item Library filter aside with Filter | Build tabs (Itemiary chrome).
 */

/**
 * @param {HTMLElement} filtersEl  `.items-filters` aside from the catalog
 * @param {{
 *   onSubmit?: () => void,
 *   onSubmitInfo?: () => void,
 * }} [opts]
 * @returns {{
 *   buildHost: HTMLElement,
 *   selectTab: (id: 'filters' | 'build') => void,
 *   setSubmitReady: (ready: boolean) => void,
 *   setSubmitBusy: (busy: boolean) => void,
 *   setSubmitForOp: (forOp: boolean) => void,
 *   destroy: () => void,
 * } | null}
 */
export function wrapFiltersWithTabs(filtersEl, opts = {}) {
  if (!(filtersEl instanceof HTMLElement)) return null;
  if (filtersEl.querySelector('[data-cr-tab]')) {
    const buildHost = filtersEl.querySelector('[data-create-meta]');
    return buildHost instanceof HTMLElement
      ? {
          buildHost,
          selectTab() {},
          setSubmitReady() {},
          setSubmitBusy() {},
          setSubmitForOp() {},
          destroy() {},
        }
      : null;
  }

  filtersEl.classList.add('create-rail');
  filtersEl.setAttribute('aria-label', 'Filters and build setup');

  const children = [...filtersEl.childNodes];

  const tabsBar = document.createElement('div');
  tabsBar.className = 'cr-tabs-bar';
  tabsBar.innerHTML = `
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
    <div class="cr-submit-group">
      <button
        type="button"
        class="cr-submit-info"
        data-cr-submit-info
        aria-label="What’s needed to submit"
        title="What’s needed to submit"
      >i</button>
      <button type="button" class="cr-submit" data-cr-submit disabled>Submit</button>
    </div>
  `;

  const rule = document.createElement('div');
  rule.className = 'cr-rule';
  rule.setAttribute('aria-hidden', 'true');

  const filterPanel = document.createElement('div');
  filterPanel.className = 'cr-panel cr-panel--filters is-active';
  filterPanel.setAttribute('role', 'tabpanel');
  filterPanel.id = 'cr-panel-filters';
  filterPanel.setAttribute('aria-labelledby', 'cr-tab-filters');
  filterPanel.setAttribute('data-cr-panel', 'filters');
  for (const node of children) filterPanel.appendChild(node);

  const buildPanel = document.createElement('div');
  buildPanel.className = 'cr-panel cr-panel--build';
  buildPanel.setAttribute('role', 'tabpanel');
  buildPanel.id = 'cr-panel-build';
  buildPanel.setAttribute('aria-labelledby', 'cr-tab-build');
  buildPanel.setAttribute('data-cr-panel', 'build');
  buildPanel.hidden = true;

  const buildHost = document.createElement('div');
  buildHost.setAttribute('data-create-meta', '');
  buildPanel.appendChild(buildHost);

  filtersEl.replaceChildren(tabsBar, rule, filterPanel, buildPanel);

  const submitBtn = tabsBar.querySelector('[data-cr-submit]');
  const infoBtn = tabsBar.querySelector('[data-cr-submit-info]');

  if (submitBtn instanceof HTMLButtonElement && typeof opts.onSubmit === 'function') {
    submitBtn.addEventListener('click', () => {
      if (submitBtn.disabled) return;
      opts.onSubmit();
    });
  }
  if (infoBtn instanceof HTMLElement && typeof opts.onSubmitInfo === 'function') {
    infoBtn.addEventListener('click', () => opts.onSubmitInfo());
  }

  let submitReady = false;
  let submitBusy = false;
  let submitForOp = false;

  function paintSubmit() {
    if (!(submitBtn instanceof HTMLButtonElement)) return;
    const can = submitReady && !submitBusy;
    submitBtn.disabled = !can;
    submitBtn.classList.toggle('is-ready', can);
    const idleLabel = submitForOp ? 'Submit for OP review' : 'Submit';
    submitBtn.textContent = submitBusy ? 'Submitting…' : idleLabel;
    submitBtn.title = submitBusy
      ? 'Publishing…'
      : submitReady
        ? submitForOp
          ? 'Publish and request OP review'
          : 'Submit build'
        : 'Complete required fields — tap i for what’s missing';
  }

  /**
   * @param {boolean} ready
   */
  function setSubmitReady(ready) {
    submitReady = !!ready;
    paintSubmit();
  }

  /**
   * @param {boolean} busy
   */
  function setSubmitBusy(busy) {
    submitBusy = !!busy;
    paintSubmit();
  }

  /**
   * @param {boolean} forOp
   */
  function setSubmitForOp(forOp) {
    submitForOp = !!forOp;
    paintSubmit();
  }

  setSubmitReady(false);

  const tabBtns = [...filtersEl.querySelectorAll('[data-cr-tab]')];
  const panels = [...filtersEl.querySelectorAll('[data-cr-panel]')];

  /**
   * @param {string} id
   */
  function selectTab(id) {
    for (const tab of tabBtns) {
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

  /** @param {MouseEvent} e */
  function onClick(e) {
    const btn = e.target?.closest?.('[data-cr-tab]');
    if (!(btn instanceof HTMLElement) || !filtersEl.contains(btn)) return;
    const id = btn.getAttribute('data-cr-tab');
    if (id === 'filters' || id === 'build') selectTab(id);
  }

  /** @param {KeyboardEvent} e */
  function onKey(e) {
    const t = e.target?.closest?.('[data-cr-tab]');
    if (!(t instanceof HTMLElement) || !filtersEl.contains(t)) return;
    const i = tabBtns.indexOf(t);
    if (i < 0) return;
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % tabBtns.length;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      next = (i - 1 + tabBtns.length) % tabBtns.length;
    }
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = tabBtns.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const id = tabBtns[next].getAttribute('data-cr-tab');
    if (id === 'filters' || id === 'build') {
      selectTab(id);
      tabBtns[next].focus();
    }
  }

  filtersEl.addEventListener('click', onClick);
  filtersEl.addEventListener('keydown', onKey);

  return {
    buildHost,
    selectTab,
    setSubmitReady,
    setSubmitBusy,
    setSubmitForOp,
    destroy() {
      filtersEl.removeEventListener('click', onClick);
      filtersEl.removeEventListener('keydown', onKey);
    },
  };
}
