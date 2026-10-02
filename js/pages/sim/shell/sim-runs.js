/**
 * Save / compare sim run summaries (localStorage).
 */

const KEY = 'bpb-sim-saved-runs:v1';
const MAX = 8;

/**
 * @typedef {{
 *   id: string,
 *   savedAt: string,
 *   title: string,
 *   slug: string | null,
 *   mode: 'demo' | 'engine',
 *   seed: number,
 *   durationSec: number,
 *   playerMaxHp: number,
 *   playerEndHp: number,
 *   dummyMaxHp: number,
 *   dummyEndHp: number,
 *   activates: number,
 *   damageToDummy: number,
 *   damageToPlayer: number,
 *   heals: number,
 *   coveragePct: number | null,
 * }} SimRunSummary
 */

/**
 * @param {import('../../sim-events.js').SimRun} run
 * @param {{ title?: string, slug?: string | null, seed?: number }} meta
 * @returns {SimRunSummary}
 */
export function summarizeRun(run, meta = {}) {
  let activates = 0;
  let damageToDummy = 0;
  let damageToPlayer = 0;
  let heals = 0;
  for (const ev of run.events || []) {
    if (ev.type === 'activate' && ev.actor === 'player') activates += 1;
    if (ev.type === 'damage' && ev.target === 'dummy') {
      damageToDummy += Number(ev.amount) || 0;
    }
    if (ev.type === 'damage' && ev.target === 'player') {
      damageToPlayer += Number(ev.amount) || 0;
    }
    if (ev.type === 'heal') heals += Number(ev.amount) || 0;
  }
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    savedAt: new Date().toISOString(),
    title: meta.title || 'Sim run',
    slug: meta.slug || null,
    mode: run.mode,
    seed: Number(meta.seed) || 0,
    durationSec: Number(run.durationSec) || 30,
    playerMaxHp: Number(run.playerMaxHp) || 0,
    playerEndHp: Number(run.playerEndHp) || 0,
    dummyMaxHp: Number(run.dummyMaxHp) || 0,
    dummyEndHp: Number(run.dummyEndHp) || 0,
    activates,
    damageToDummy: Math.round(damageToDummy),
    damageToPlayer: Math.round(damageToPlayer),
    heals: Math.round(heals),
    coveragePct:
      typeof run.coverage?.pct === 'number' ? run.coverage.pct : null,
  };
}

/** @returns {SimRunSummary[]} */
export function listSavedRuns() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** @param {SimRunSummary} summary */
export function saveRunSummary(summary) {
  const list = listSavedRuns().filter((r) => r.id !== summary.id);
  list.unshift(summary);
  while (list.length > MAX) list.pop();
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* quota */
  }
  return list;
}

/** @param {string} id */
export function removeSavedRun(id) {
  const list = listSavedRuns().filter((r) => r.id !== id);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  return list;
}

/**
 * @param {SimRunSummary} a current
 * @param {SimRunSummary} b baseline
 */
export function diffSummaries(a, b) {
  /**
   * @param {number} cur
   * @param {number} base
   */
  function delta(cur, base) {
    const d = cur - base;
    const sign = d > 0 ? '+' : '';
    return { cur, base, d, label: `${sign}${d}` };
  }
  return {
    playerEndHp: delta(a.playerEndHp, b.playerEndHp),
    dummyEndHp: delta(a.dummyEndHp, b.dummyEndHp),
    damageToDummy: delta(a.damageToDummy, b.damageToDummy),
    damageToPlayer: delta(a.damageToPlayer, b.damageToPlayer),
    activates: delta(a.activates, b.activates),
    heals: delta(a.heals, b.heals),
  };
}

/**
 * Mount save / compare chrome under host.
 * @param {HTMLElement} host
 * @param {{
 *   getCurrent: () => import('../../sim-events.js').SimRun | null,
 *   getMeta: () => { title?: string, slug?: string | null, seed?: number },
 * }} opts
 */
export function mountSimRunsPanel(host, opts) {
  host.innerHTML = `
    <div class="sim-runs">
      <div class="sim-runs__actions">
        <button type="button" class="sim-runs__btn" data-act="save">Save run</button>
        <button type="button" class="sim-runs__btn" data-act="compare" disabled>Compare</button>
        <span class="sim-runs__hint" data-hint></span>
      </div>
      <div class="sim-runs__compare" data-compare hidden></div>
      <ul class="sim-runs__list" data-list aria-label="Saved sim runs"></ul>
    </div>
  `;

  const listEl = host.querySelector('[data-list]');
  const compareEl = host.querySelector('[data-compare]');
  const hintEl = host.querySelector('[data-hint]');
  const compareBtn = host.querySelector('[data-act="compare"]');
  /** @type {string | null} */
  let selectedId = null;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function paintList() {
    const runs = listSavedRuns();
    if (!(listEl instanceof HTMLElement)) return;
    if (!runs.length) {
      listEl.innerHTML =
        '<li class="sim-runs__empty">No saved runs yet — Save after a fight to compare later.</li>';
      selectedId = null;
    } else {
      listEl.innerHTML = runs
        .map((r) => {
          const when = new Date(r.savedAt).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
          const sel = r.id === selectedId ? ' is-selected' : '';
          return `<li class="sim-runs__item${sel}" data-id="${escapeHtml(r.id)}">
            <button type="button" class="sim-runs__pick" data-pick="${escapeHtml(r.id)}">
              <span class="sim-runs__title">${escapeHtml(r.title)}</span>
              <span class="sim-runs__meta">${escapeHtml(r.mode)} · seed ${r.seed} · dummy ${r.dummyEndHp}/${r.dummyMaxHp} · ${escapeHtml(when)}</span>
            </button>
            <button type="button" class="sim-runs__del" data-del="${escapeHtml(r.id)}" aria-label="Delete saved run">×</button>
          </li>`;
        })
        .join('');
    }
    if (compareBtn instanceof HTMLButtonElement) {
      compareBtn.disabled = !selectedId || !opts.getCurrent();
    }
  }

  function showCompare() {
    const run = opts.getCurrent();
    if (!run || !selectedId || !(compareEl instanceof HTMLElement)) return;
    const baseline = listSavedRuns().find((r) => r.id === selectedId);
    if (!baseline) return;
    const cur = summarizeRun(run, opts.getMeta());
    const d = diffSummaries(cur, baseline);
    compareEl.hidden = false;
    compareEl.innerHTML = `
      <p class="sim-runs__compare-title">Current vs saved “${escapeHtml(baseline.title)}”</p>
      <dl class="sim-runs__diff">
        <div><dt>Dummy end HP</dt><dd>${d.dummyEndHp.cur} <span class="sim-runs__delta">${escapeHtml(d.dummyEndHp.label)}</span></dd></div>
        <div><dt>Your end HP</dt><dd>${d.playerEndHp.cur} <span class="sim-runs__delta">${escapeHtml(d.playerEndHp.label)}</span></dd></div>
        <div><dt>Dmg to dummy</dt><dd>${d.damageToDummy.cur} <span class="sim-runs__delta">${escapeHtml(d.damageToDummy.label)}</span></dd></div>
        <div><dt>Dmg taken</dt><dd>${d.damageToPlayer.cur} <span class="sim-runs__delta">${escapeHtml(d.damageToPlayer.label)}</span></dd></div>
        <div><dt>Activates</dt><dd>${d.activates.cur} <span class="sim-runs__delta">${escapeHtml(d.activates.label)}</span></dd></div>
        <div><dt>Healing</dt><dd>${d.heals.cur} <span class="sim-runs__delta">${escapeHtml(d.heals.label)}</span></dd></div>
      </dl>
    `;
  }

  host.addEventListener('click', (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const save = t.closest('[data-act="save"]');
    if (save) {
      const run = opts.getCurrent();
      if (!run) return;
      saveRunSummary(summarizeRun(run, opts.getMeta()));
      if (hintEl) hintEl.textContent = 'Saved';
      window.setTimeout(() => {
        if (hintEl) hintEl.textContent = '';
      }, 1600);
      paintList();
      return;
    }
    if (t.closest('[data-act="compare"]')) {
      showCompare();
      return;
    }
    const del = t.closest('[data-del]');
    if (del instanceof HTMLElement) {
      const id = del.getAttribute('data-del');
      if (id) {
        if (selectedId === id) selectedId = null;
        removeSavedRun(id);
        if (compareEl instanceof HTMLElement) compareEl.hidden = true;
        paintList();
      }
      return;
    }
    const pick = t.closest('[data-pick]');
    if (pick instanceof HTMLElement) {
      selectedId = pick.getAttribute('data-pick');
      paintList();
    }
  });

  paintList();

  return {
    refresh: paintList,
    destroy() {
      host.replaceChildren();
    },
  };
}
