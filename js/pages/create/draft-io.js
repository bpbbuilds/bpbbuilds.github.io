/**
 * Create-page draft I/O — localStorage + export/import JSON.
 */

import { HERO_CLASSES } from '../items/filter-logic.js';

/** Socket face 0–3. Local so draft I/O does not import the drag graph. */
function gemFace(n) {
  const f = Math.round(Number(n));
  if (!Number.isFinite(f)) return 0;
  return ((f % 4) + 4) % 4;
}

/**
 * Keep socket ids and non-zero faces. Trailing empty slots are dropped.
 * @param {{ gems?: string[], gemR?: number[] }} target
 * @param {Record<string, unknown>} raw
 */
function attachSocketGems(target, raw) {
  if (!Array.isArray(raw.gems)) return;
  const gems = raw.gems.map((g) => (g == null || g === '' ? '' : String(g)));
  while (gems.length && gems[gems.length - 1] === '') gems.pop();
  if (!gems.length) return;
  target.gems = gems;
  if (!Array.isArray(raw.gemR)) return;
  const gemR = gems.map((_, i) => gemFace(raw.gemR[i]));
  if (gemR.some((n) => n !== 0)) target.gemR = gemR;
}

export const DRAFT_STORAGE_KEY = 'bpb-create-draft:v1';
export const DRAFT_VERSION = 1;

/** @typedef {'needed' | 'nice' | 'optional' | null} Priority */

/**
 * @typedef {{
 *   id: string,
 *   x: number,
 *   y: number,
 *   r: number,
 *   key: string,
 *   gems?: string[],
 *   gemR?: number[],
 *   priority?: Priority,
 *   instance?: import('../sim/engine/placement-instance.js').PlacementInstance,
 * }} DraftPlacement
 */

/**
 * Soft stash (game storage stand-in) — flat items only (bags and former cargo
 * are separate entries). UI stacks identical `id`s with a count badge.
 * @typedef {{
 *   id: string,
 *   r: number,
 *   key: string,
 *   gems?: string[],
 *   gemR?: number[],
 *   priority?: Priority,
 * }} ParkedEntry
 */

/** @typedef {'theory' | 'feasible' | 'real' | null} BuildTag */

/** Normalize DB / legacy draft tag strings. */
export function normalizeBuildTag(raw) {
  if (raw === 'feasible' || raw === 'real' || raw === 'theory') return raw;
  if (raw === 'theorycraft') return 'theory';
  return null;
}

/**
 * Compact attached history.db run (for draft + publish + builds.history).
 * @typedef {{
 *   runId: number,
 *   rounds: {
 *     round: number,
 *     result: 'win' | 'loss',
 *     health?: number,
 *     stamina?: number,
 *     placements: { id: string, x: number, y: number, r: number, gems?: string[], gemR?: number[], instance?: import('../sim/engine/placement-instance.js').PlacementInstance }[],
 *   }[],
 * }} DraftHistory
 */

/**
 * @typedef {{
 *   version: number,
 *   title: string,
 *   blurb: string,
 *   notes: string,
 *   hero_class: string | null,
 *   build_tag: BuildTag,
 *   is_op: boolean,
 *   youtube_url: string | null,
 *   gold_count: number,
 *   rank: string | null,
 *   route_r3_item_id: string | null,
 *   route_r10_item_id: string | null,
 *   starting_bag_id: string | null,
 *   placements: DraftPlacement[],
 *   parked: ParkedEntry[],
 *   history: DraftHistory | null,
 * }} Draft
 */

/** Max rounds accepted on draft / submit. */
export const HISTORY_MAX_ROUNDS = 40;

/**
 * Normalize / compact a decoded run or stored history blob.
 * @param {unknown} raw
 * @returns {DraftHistory | null}
 */
export function normalizeDraftHistory(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  const roundsIn = Array.isArray(o.rounds) ? o.rounds : [];
  if (!roundsIn.length || roundsIn.length > HISTORY_MAX_ROUNDS) return null;

  /** @type {DraftHistory['rounds']} */
  const rounds = [];
  for (const row of roundsIn) {
    if (!row || typeof row !== 'object') continue;
    const r = /** @type {Record<string, unknown>} */ (row);
    const roundNum = Number(r.round);
    if (!Number.isFinite(roundNum)) continue;
    const result = r.result === 'win' ? 'win' : r.result === 'loss' ? 'loss' : null;
    if (!result) continue;
    const placementsIn = Array.isArray(r.placements) ? r.placements : [];
    /** @type {DraftHistory['rounds'][number]['placements']} */
    const placements = [];
    for (const p of placementsIn) {
      if (!p || typeof p !== 'object') continue;
      const pl = /** @type {Record<string, unknown>} */ (p);
      const id = String(pl.id || '').trim();
      if (!id) continue;
      const x = Number(pl.x);
      const y = Number(pl.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      /** @type {DraftHistory['rounds'][number]['placements'][number]} */
      const next = {
        id,
        x,
        y,
        r: ((Number(pl.r) || 0) % 4 + 4) % 4,
      };
      attachSocketGems(next, pl);
      if (pl.instance && typeof pl.instance === 'object') {
        next.instance = /** @type {DraftHistory['rounds'][number]['placements'][number]['instance']} */ (
          pl.instance
        );
      }
      placements.push(next);
    }
    /** @type {DraftHistory['rounds'][number]} */
    const roundRow = { round: Math.round(roundNum), result, placements };
    const health = Number(r.health);
    const stamina = Number(r.stamina);
    if (Number.isFinite(health) && health > 0) roundRow.health = Math.round(health);
    if (Number.isFinite(stamina) && stamina > 0) roundRow.stamina = stamina;
    rounds.push(roundRow);
  }
  if (!rounds.length) return null;
  const runIdNum = Number(o.runId);
  return {
    runId: Number.isFinite(runIdNum) ? Math.round(runIdNum) : 0,
    rounds,
  };
}

/**
 * Last-round placements for catalog / submit, with essentials from draft when still on board.
 * @param {DraftHistory} history
 * @param {DraftPlacement[]} draftPlacements
 * @returns {DraftPlacement[]}
 */
export function lastRoundPlacementsFromHistory(history, draftPlacements = []) {
  const last = history?.rounds?.[history.rounds.length - 1];
  if (!last?.placements?.length) return [];

  /** @type {Map<string, Priority>} */
  const prioByKey = new Map();
  for (const p of draftPlacements || []) {
    if (!p?.id || p.priority == null) continue;
    prioByKey.set(`${p.id}|${p.x}|${p.y}|${p.r ?? 0}`, p.priority);
  }

  return last.placements.map((p, i) => {
    const r = ((Number(p.r) || 0) % 4 + 4) % 4;
    const prioKey = `${p.id}|${p.x}|${p.y}|${r}`;
    /** @type {DraftPlacement} */
    const row = {
      id: p.id,
      x: Number(p.x) || 0,
      y: Number(p.y) || 0,
      r,
      key: `hist-${i}:${p.id}:${p.x},${p.y}:${r}`,
      priority: prioByKey.get(prioKey) ?? null,
    };
    attachSocketGems(row, p);
    return row;
  });
}

/** @returns {Draft} */
export function emptyDraft() {
  return {
    version: DRAFT_VERSION,
    title: '',
    blurb: '',
    notes: '',
    hero_class: null,
    build_tag: null,
    is_op: false,
    youtube_url: null,
    gold_count: 0,
    rank: null,
    route_r3_item_id: null,
    route_r10_item_id: null,
    starting_bag_id: null,
    placements: [],
    parked: [],
    history: null,
  };
}

/**
 * @param {unknown} raw
 * @returns {ParkedEntry[]}
 */
function normalizeParkedList(raw) {
  if (!Array.isArray(raw)) return [];
  /** @type {ParkedEntry[]} */
  const out = [];
  for (let i = 0; i < raw.length; i += 1) {
    const row = raw[i];
    if (!row || typeof row !== 'object') continue;
    const o = /** @type {Record<string, unknown>} */ (row);
    const id = String(o.id || '').trim();
    if (!id) continue;
    const key =
      o.key != null && String(o.key).trim()
        ? String(o.key)
        : `park-${id}:${i}`;
    /** @type {Priority} */
    let priority = null;
    if (o.priority === 'needed' || o.priority === 'nice' || o.priority === 'optional') {
      priority = o.priority;
    }
    /** @type {ParkedEntry} */
    const entry = {
      id,
      r: ((Number(o.r) || 0) % 4 + 4) % 4,
      key,
      priority,
    };
    attachSocketGems(entry, o);
    out.push(entry);
    // Legacy nested cargo → flatten into sibling parked items
    if (Array.isArray(o.cargo)) {
      for (let j = 0; j < o.cargo.length; j += 1) {
        const c = o.cargo[j];
        if (!c || typeof c !== 'object') continue;
        const cr = /** @type {Record<string, unknown>} */ (c);
        const cid = String(cr.id || '').trim();
        if (!cid) continue;
        const ckey =
          cr.key != null && String(cr.key).trim()
            ? String(cr.key)
            : `park-${cid}:${i}:${j}`;
        /** @type {ParkedEntry} */
        const piece = {
          id: cid,
          r: ((Number(cr.r) || 0) % 4 + 4) % 4,
          key: ckey,
          priority: null,
        };
        attachSocketGems(piece, cr);
        out.push(piece);
      }
    }
  }
  return out;
}

/**
 * @param {unknown} raw
 * @returns {Draft | null}
 */
export function normalizeDraft(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  const version = Number(o.version) || DRAFT_VERSION;
  if (version > DRAFT_VERSION) return null;

  const placementsIn = Array.isArray(o.placements) ? o.placements : [];
  /** @type {DraftPlacement[]} */
  const placements = [];
  for (let i = 0; i < placementsIn.length; i += 1) {
    const p = placementsIn[i];
    if (!p || typeof p !== 'object') continue;
    const row = /** @type {Record<string, unknown>} */ (p);
    const id = String(row.id || '').trim();
    if (!id) continue;
    const x = Number(row.x);
    const y = Number(row.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const r = ((Number(row.r) || 0) % 4 + 4) % 4;
    const key =
      row.key != null && String(row.key).trim()
        ? String(row.key)
        : `${id}:${i}:${x},${y}:${r}`;
    /** @type {Priority} */
    let priority = null;
    if (row.priority === 'needed' || row.priority === 'nice' || row.priority === 'optional') {
      priority = row.priority;
    }
    /** @type {DraftPlacement} */
    const next = { id, x, y, r, key, priority };
    attachSocketGems(next, row);
    placements.push(next);
  }

  const heroRaw = o.hero_class != null ? String(o.hero_class).trim() : '';
  const hero = HERO_CLASSES.includes(heroRaw) ? heroRaw : null;
  const r3 = o.route_r3_item_id != null && String(o.route_r3_item_id).trim()
    ? String(o.route_r3_item_id).trim()
    : null;
  const r10 = o.route_r10_item_id != null && String(o.route_r10_item_id).trim()
    ? String(o.route_r10_item_id).trim()
    : null;
  /** @type {BuildTag} */
  let build_tag = normalizeBuildTag(o.build_tag);
  const is_op = o.is_op === true;
  // OP and Theory are mutually exclusive — keep OP, drop theory
  if (is_op && build_tag === 'theory') build_tag = null;
  const hist = normalizeDraftHistory(o.history);
  // Real requires attached history; history attached ⇒ Real
  if (hist) build_tag = 'real';
  else if (build_tag === 'real') build_tag = 'feasible';
  const ytRaw = o.youtube_url != null ? String(o.youtube_url).trim() : '';
  const youtube_url = ytRaw || null;
  const goldNum = Number(o.gold_count);
  const gold_count =
    Number.isFinite(goldNum) && goldNum >= 0 ? Math.round(goldNum) : 0;
  const rankRaw = o.rank != null && String(o.rank).trim() ? String(o.rank).trim() : null;
  const rank = rankRaw && /^[a-z]+$/.test(rankRaw) ? rankRaw : null;
  const bagRaw =
    o.starting_bag_id != null && String(o.starting_bag_id).trim()
      ? String(o.starting_bag_id).trim()
      : null;

  return {
    version: DRAFT_VERSION,
    title: String(o.title || ''),
    blurb: String(o.blurb || ''),
    notes: String(o.notes || ''),
    hero_class: hero,
    build_tag,
    is_op,
    youtube_url,
    gold_count,
    rank,
    route_r3_item_id: r3,
    route_r10_item_id: r10,
    starting_bag_id: bagRaw,
    placements,
    parked: normalizeParkedList(o.parked),
    history: normalizeDraftHistory(o.history),
  };
}

/** @returns {Draft} */
export function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return emptyDraft();
    const parsed = normalizeDraft(JSON.parse(raw));
    if (!parsed) return emptyDraft();
    // Empty unfinished board: no class until onboarding / meta picks one
    // (clears legacy Adventurer default from older drafts)
    if (!parsed.placements.length && !parsed.starting_bag_id) {
      parsed.hero_class = null;
    }
    return parsed;
  } catch {
    return emptyDraft();
  }
}

/** @param {Draft} draft */
export function saveDraft(draft) {
  try {
    // Set while ?fix=real-NNN is open so a label edit does not replace the create draft.
    if (sessionStorage.getItem('bpb-label-fix-hold') === '1') return;
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* quota / private mode */
  }
}

/** Clear local draft after a successful publish. */
export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** @param {Draft} draft */
export function downloadDraftJson(draft) {
  const slug = slugify(draft.title || 'untitled');
  const blob = new Blob([JSON.stringify(draft, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bpb-draft-${slug}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * @param {File} file
 * @returns {Promise<Draft>}
 */
export async function readDraftFile(file) {
  const text = await file.text();
  const parsed = normalizeDraft(JSON.parse(text));
  if (!parsed) throw new Error('Invalid draft file');
  return parsed;
}

/** @param {string} title */
function slugify(title) {
  const s = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return s || 'untitled';
}

/** @returns {string} */
export function newPlacementKey() {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
