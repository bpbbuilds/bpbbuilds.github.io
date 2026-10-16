const PAGE_SIZE = 50;

const VERDICTS = Object.freeze({
  verified_1to1: { glyph: '✓', label: 'Source-verified 1:1', tone: 'pass' },
  confirmed_gap: { glyph: '×', label: 'Confirmed gap', tone: 'gap' },
  evidence_pending: { glyph: '?', label: 'Evidence pending', tone: 'pending' },
  no_independent_combat: { glyph: '—', label: 'No independent combat', tone: 'neutral' },
});

export function verdictMeta(verdict) {
  return VERDICTS[verdict] || VERDICTS.evidence_pending;
}

export function filterAuditRows(rows, filters) {
  const query = String(filters.query || '').trim().toLowerCase();
  return rows.filter((row) => {
    const text = [row.name, row.id, row.category, row.class, row.reason, row.knownDelta]
      .filter(Boolean).join(' ').toLowerCase();
    return (!query || text.includes(query))
      && (filters.verdict === 'all' || row.verdict === filters.verdict)
      && (filters.category === 'all' || row.category === filters.category)
      && (filters.className === 'all' || row.class === filters.className);
  });
}

function create(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function selectControl(label, name) {
  const wrap = create('label', 'admin-sim-audit__field');
  wrap.append(create('span', '', label));
  const select = create('select', 'cr-input');
  select.name = name;
  wrap.append(select);
  return { wrap, select };
}

function fillOptions(select, values, labels = {}) {
  select.replaceChildren();
  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = labels[value] || value;
    select.append(option);
  }
}

function detailsFor(row) {
  const details = create('details', 'admin-sim-audit__details');
  details.append(create('summary', '', 'Evidence and mappings'));
  const body = create('dl', 'admin-sim-audit__detail-list');
  const add = (term, value) => {
    if (!value || (Array.isArray(value) && !value.length)) return;
    body.append(create('dt', '', term));
    body.append(create('dd', '', Array.isArray(value) ? value.join(', ') : String(value)));
  };
  const source = row.source || {};
  const simulator = row.simulator || {};
  add('Game source', typeof source === 'string' ? source : source.script);
  add('Source functions', row.functions || source.sourceMethods);
  add('Simulator owner', simulator.owners || simulator.handlerModules);
  add('Runtime handler', simulator.runtimeHandler);
  add('Source status', row.sourceStatus);
  add('Known delta', row.knownDelta);
  add('Evidence', row.evidence ? JSON.stringify(row.evidence) : 'No retained 1:1 evidence recorded.');
  details.append(body);
  return details;
}

function rowView(row) {
  const meta = verdictMeta(row.verdict);
  const article = create('article', `admin-sim-audit__row is-${meta.tone}`);
  const state = create('span', `admin-sim-audit__verdict is-${meta.tone}`, meta.glyph);
  state.setAttribute('aria-label', meta.label);
  state.title = meta.label;
  const identity = create('div', 'admin-sim-audit__identity');
  identity.append(create('h3', '', row.name));
  identity.append(create('p', '', `${row.category}${row.class ? ` · ${row.class}` : ''}`));
  const reason = create('p', 'admin-sim-audit__reason', row.reason);
  article.append(state, identity, reason, detailsFor(row));
  return article;
}

function loadError(stage, message) {
  stage.replaceChildren(create('p', 'admin-gate__error', message));
}

/** @param {HTMLElement} stage @param {{ root: string }} options */
export async function mountSimAuditPanel(stage, { root }) {
  stage.replaceChildren(create('p', 'admin-sim-audit__status', 'Loading simulator audit…'));
  let dashboard;
  try {
    const response = await fetch(`${root}assets/data/sim-audit-dashboard.json`, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    dashboard = await response.json();
  } catch {
    loadError(stage, 'Could not load the simulator audit. It is not safe to infer a clean result.');
    return;
  }
  if (dashboard?.schema !== 1 || !Array.isArray(dashboard.items) || !Array.isArray(dashboard.mechanics)) {
    loadError(stage, 'Simulator audit data is invalid or from an unsupported schema. No parity result is shown.');
    return;
  }

  const wrap = create('section', 'admin-sim-audit');
  const intro = create('div', 'admin-sim-audit__intro');
  intro.append(create('p', 'admin-sim-audit__warning', '✓ means the current game source, automated regression, and every applicable projection are retained. It does not require you to provide a live match capture.'));
  intro.append(create('p', 'admin-sim-audit__freshness', `Catalog rows: ${dashboard.totals?.items ?? dashboard.items.length}. Shared mechanics: ${dashboard.totals?.mechanics ?? dashboard.mechanics.length}.`));
  const totals = create('div', 'admin-sim-audit__totals');
  for (const verdict of Object.keys(VERDICTS)) {
    const meta = verdictMeta(verdict);
    const tile = create('div', `admin-sim-audit__total is-${meta.tone}`);
    tile.append(create('strong', '', `${meta.glyph} ${dashboard.totals?.[verdict] ?? 0}`));
    tile.append(create('span', '', meta.label));
    totals.append(tile);
  }
  const controls = create('form', 'admin-sim-audit__controls');
  const search = create('input', 'cr-input');
  search.type = 'search'; search.placeholder = 'Search item, mechanic, source, or delta'; search.setAttribute('aria-label', 'Search simulator audit');
  const scope = selectControl('Scope', 'scope');
  const verdict = selectControl('Verdict', 'verdict');
  const category = selectControl('Category', 'category');
  const className = selectControl('Class', 'className');
  fillOptions(scope.select, ['items', 'mechanics'], { items: 'Items', mechanics: 'Mechanics' });
  fillOptions(verdict.select, ['all', ...Object.keys(VERDICTS)], { all: 'All verdicts', ...Object.fromEntries(Object.entries(VERDICTS).map(([key, value]) => [key, `${value.glyph} ${value.label}`])) });
  controls.append(search, scope.wrap, verdict.wrap, category.wrap, className.wrap);
  const count = create('p', 'admin-sim-audit__count');
  const list = create('div', 'admin-sim-audit__list');
  const pager = create('div', 'admin-sim-audit__pager');
  const previous = create('button', 'cr-btn-quiet', 'Previous'); previous.type = 'button';
  const next = create('button', 'cr-btn-quiet', 'Next'); next.type = 'button';
  const pageLabel = create('span', ''); pager.append(previous, pageLabel, next);
  wrap.append(intro, totals, controls, count, list, pager);
  stage.replaceChildren(wrap);

  let page = 0;
  const rebuildOptions = (rows) => {
    const selectedCategory = category.select.value || 'all';
    const selectedClass = className.select.value || 'all';
    fillOptions(category.select, ['all', ...new Set(rows.map((row) => row.category).filter(Boolean))], { all: 'All categories' });
    fillOptions(className.select, ['all', ...new Set(rows.map((row) => row.class).filter(Boolean))], { all: 'All classes' });
    category.select.value = [...category.select.options].some((option) => option.value === selectedCategory) ? selectedCategory : 'all';
    className.select.value = [...className.select.options].some((option) => option.value === selectedClass) ? selectedClass : 'all';
  };
  const render = (resetPage = false) => {
    const sourceRows = scope.select.value === 'items' ? dashboard.items : dashboard.mechanics;
    if (resetPage) { page = 0; rebuildOptions(sourceRows); }
    const filtered = filterAuditRows(sourceRows, { query: search.value, verdict: verdict.select.value, category: category.select.value, className: className.select.value });
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    page = Math.min(page, pages - 1);
    list.replaceChildren(...filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(rowView));
    count.textContent = `${filtered.length} ${scope.select.value} shown`;
    pageLabel.textContent = `Page ${page + 1} of ${pages}`;
    previous.disabled = page === 0; next.disabled = page >= pages - 1;
  };
  search.addEventListener('input', () => render(true));
  verdict.select.addEventListener('change', () => render(true));
  category.select.addEventListener('change', () => render(true));
  className.select.addEventListener('change', () => render(true));
  scope.select.addEventListener('change', () => render(true));
  previous.addEventListener('click', () => { page -= 1; render(); });
  next.addEventListener('click', () => { page += 1; render(); });
  render(true);
}
