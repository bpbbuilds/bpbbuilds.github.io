/**
 * Event build step — Needs / Wants / Good to have drop targets.
 * Priority is stored on the placement and submitted with the entry.
 */

/** @typedef {'needed' | 'nice' | 'optional'} TierId */

const TIERS = Object.freeze([
  { id: 'needed', label: 'Needs' },
  { id: 'nice', label: 'Wants' },
  { id: 'optional', label: 'Good to have' },
]);

/**
 * @param {string} s
 */
function escapeAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

export function tiersHtml() {
  const boxes = TIERS.map(
    (tier) => `
      <div class="event-enter__tier" data-enter-tier="${tier.id}">
        <p class="event-enter__tier-label">${tier.label}</p>
        <p class="event-enter__tier-empty" data-enter-tier-empty="${tier.id}">Drop item</p>
        <ul class="event-enter__tier-list" data-enter-tier-list="${tier.id}"></ul>
      </div>`,
  ).join('');
  return `
    <section class="event-enter__tiers" aria-label="Needs, wants, and good to have">
      <p class="cr-hint">Drag an item from the board into a tier.</p>
      ${boxes}
    </section>`;
}

/**
 * @param {{
 *   overlay: HTMLElement,
 *   itemsById: Map<string, object>,
 *   getSpriteUrl: (item: object) => string,
 *   getPlacements: () => { key?: string, id?: string, priority?: string | null }[],
 * }} opts
 */
export function mountEnterTiers(opts) {
  const root = opts.overlay;

  function refresh() {
    /** @type {Record<string, { key: string, id: string }[]>} */
    const byTier = { needed: [], nice: [], optional: [] };
    for (const p of opts.getPlacements()) {
      const priority = p.priority;
      if (priority !== 'needed' && priority !== 'nice' && priority !== 'optional') continue;
      const id = String(p.id || '');
      const item = opts.itemsById.get(id);
      if (!item || String(item.type || '') === 'Bag') continue;
      byTier[priority].push({ key: String(p.key || ''), id });
    }

    for (const tier of TIERS) {
      const list = root.querySelector(`[data-enter-tier-list="${tier.id}"]`);
      const empty = root.querySelector(`[data-enter-tier-empty="${tier.id}"]`);
      if (!(list instanceof HTMLElement)) continue;
      list.replaceChildren();
      const rows = byTier[tier.id];
      if (empty instanceof HTMLElement) empty.hidden = rows.length > 0;
      for (const row of rows) {
        const item = opts.itemsById.get(row.id);
        const src = item ? opts.getSpriteUrl(item) : '';
        if (!src) continue;
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'event-enter__tier-chip';
        btn.dataset.enterTierKey = row.key;
        btn.title = `Remove ${item?.name || row.id}`;
        btn.setAttribute('aria-label', `Remove ${item?.name || row.id} from ${tier.label}`);
        const img = document.createElement('img');
        img.src = src;
        img.alt = '';
        img.draggable = false;
        btn.appendChild(img);
        li.appendChild(btn);
        list.appendChild(li);
      }
    }

    const marked = new Set(
      opts
        .getPlacements()
        .filter((p) => p.priority === 'needed' || p.priority === 'nice' || p.priority === 'optional')
        .map((p) => String(p.key || '')),
    );
    root.querySelectorAll('.bpb-bg__item[data-placement-key]').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      el.classList.toggle('is-enter-tiered', marked.has(el.dataset.placementKey || ''));
    });
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {{ priority: TierId, el: HTMLElement } | null}
   */
  function tierAt(x, y) {
    const hit = document.elementFromPoint(x, y);
    const el = hit instanceof Element ? hit.closest('[data-enter-tier]') : null;
    if (!(el instanceof HTMLElement) || !root.contains(el)) return null;
    const priority = el.getAttribute('data-enter-tier');
    if (priority !== 'needed' && priority !== 'nice' && priority !== 'optional') return null;
    return { priority, el };
  }

  /**
   * @param {HTMLElement | null} el
   * @param {boolean} ok
   */
  function setHover(el, ok) {
    root.querySelectorAll('[data-enter-tier]').forEach((node) => {
      node.classList.remove('is-drop-hover', 'is-drop-reject');
    });
    if (!el) return;
    el.classList.add(ok ? 'is-drop-hover' : 'is-drop-reject');
  }

  /**
   * @param {MouseEvent} ev
   */
  function onClick(ev) {
    const t = ev.target instanceof Element ? ev.target : null;
    const btn = t?.closest('[data-enter-tier-key]');
    if (!(btn instanceof HTMLElement)) return;
    const key = btn.dataset.enterTierKey || '';
    const row = opts.getPlacements().find((p) => String(p.key) === key);
    if (!row) return;
    row.priority = null;
    refresh();
  }

  root.addEventListener('click', onClick);
  refresh();

  return {
    refresh,
    tierAt,
    setHover,
    destroy() {
      root.removeEventListener('click', onClick);
      setHover(null, false);
    },
  };
}
