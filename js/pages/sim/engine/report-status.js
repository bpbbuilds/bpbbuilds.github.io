/**
 * Buff / debuff / heal / damage rollups for sim debug reports.
 */

const STACK_ALIASES = {
  luck: 'lucky',
  regen: 'regeneration',
  vamp: 'vampirism',
  lifesteal: 'vampirism',
};

const KNOWN_STACKS = new Set([
  'lucky',
  'regeneration',
  'vampirism',
  'blind',
  'poison',
  'heat',
  'cold',
  'spikes',
  'empower',
  'block',
  'mana',
  'buffprotect',
  'invulncharges',
]);

/**
 * @param {string} [raw]
 */
function normalizeStack(raw) {
  if (!raw) return null;
  const k = String(raw)
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  if (!k) return null;
  const aliased = STACK_ALIASES[k] || k;
  return KNOWN_STACKS.has(aliased) ? aliased : aliased;
}

/**
 * @param {object} e
 */
function inferStack(e) {
  const fromMeta = e.stack || e.meta?.stack;
  if (fromMeta) return normalizeStack(String(fromMeta));
  const label = String(e.label || '');
  const m = label.match(
    /\+\s*(-?\d+(?:\.\d+)?)\s+(lucky|luck|vampirism|regeneration|regen|blind|poison|heat|cold|spikes|empower|block|mana)\b/i,
  );
  if (m) return normalizeStack(m[2]);
  return null;
}

/**
 * @param {object} e
 * @param {'player' | 'dummy'} fallback
 */
function eventTarget(e, fallback) {
  if (e.target === 'player' || e.target === 'dummy') return e.target;
  return fallback;
}

/**
 * Who received a buff/heal (vs-board: prefer `opp:` placement over wrong target).
 * @param {object} e
 * @param {'player' | 'dummy'} fallback
 */
function buffOwner(e, fallback) {
  if (e.placementKey && String(e.placementKey).startsWith('opp:')) return 'dummy';
  if (e.actor === 'player' || e.actor === 'dummy') return e.actor;
  return eventTarget(e, fallback);
}

/**
 * @param {Map<string, object> | undefined} itemsById
 * @param {string | null | undefined} id
 */
function nameOf(itemsById, id) {
  if (!id) return null;
  const it = itemsById?.get(id);
  return it?.name ? String(it.name) : null;
}

/**
 * @param {Map<string, object> | undefined} itemsById
 * @param {string} name
 */
function idFromName(itemsById, name) {
  if (!itemsById || !name) return null;
  const want = name.toLowerCase();
  for (const [id, it] of itemsById) {
    if (String(it?.name || '').toLowerCase() === want) return id;
  }
  return null;
}

/**
 * @param {object} e
 * @param {Map<string, object> | undefined} itemsById
 */
function sourceOf(e, itemsById) {
  const handler = e.handler || e.meta?.handler || null;
  const fatigue = !!e.meta?.fatigue;
  const system = e.meta?.systemOrigin
    ? String(e.meta.systemOrigin)
    : fatigue
      ? 'Fatigue'
      : null;
  const labelName = String(e.label || '').match(/^([^:]+):/)?.[1]?.trim() || null;
  const itemId =
    e.itemId ||
    (handler && itemsById?.has(handler) ? handler : null) ||
    idFromName(itemsById, labelName) ||
    null;
  const name =
    nameOf(itemsById, itemId) ||
    nameOf(itemsById, handler) ||
    system ||
    labelName ||
    handler ||
    'unknown';
  const id = itemId || handler || system || (labelName ? labelName : 'unknown');
  return {
    id,
    itemId,
    handler,
    systemOrigin: system,
    name,
  };
}

function emptyGrant() {
  return {
    gained: 0,
    lost: 0,
    grants: 0,
    firstT: null,
    lastT: null,
    samples: [],
  };
}

/**
 * @param {Map<string, ReturnType<typeof emptyGrant>>} map
 * @param {string} key
 * @param {number} t
 * @param {number} amount
 * @param {object} extra
 */
function addGrant(map, key, t, amount, extra) {
  let row = map.get(key);
  if (!row) {
    row = { ...emptyGrant(), ...extra };
    map.set(key, row);
  }
  const n = Number(amount) || 0;
  if (n >= 0) row.gained += n;
  else row.lost += -n;
  row.grants += 1;
  row.firstT = row.firstT == null ? t : Math.min(row.firstT, t);
  row.lastT = row.lastT == null ? t : Math.max(row.lastT, t);
  if (row.samples.length < 8) {
    row.samples.push({ t: roundT(t), amount: n });
  }
}

function roundT(t) {
  return Math.round(Number(t) * 1000) / 1000;
}

function mapToList(map) {
  return [...map.values()]
    .map((row) => ({
      ...row,
      firstT: row.firstT == null ? null : roundT(row.firstT),
      lastT: row.lastT == null ? null : roundT(row.lastT),
    }))
    .sort((a, b) => Math.abs(b.gained) - Math.abs(a.gained) || a.id.localeCompare(b.id));
}

/**
 * @param {object} actorSnap
 */
function endStacks(actorSnap) {
  if (!actorSnap || typeof actorSnap !== 'object') return {};
  const keys = [
    'lucky',
    'regeneration',
    'vampirism',
    'blind',
    'poison',
    'heat',
    'cold',
    'spikes',
    'empower',
    'block',
    'mana',
    'buffProtect',
    'invulnCharges',
  ];
  /** @type {Record<string, number>} */
  const out = {};
  for (const k of keys) {
    const n = Number(actorSnap[k]) || 0;
    if (!n) continue;
    const nk =
      k === 'buffProtect' ? 'buffprotect' : k === 'invulnCharges' ? 'invulncharges' : k;
    out[nk] = n;
  }
  return out;
}

/**
 * @param {import('../sim-events.js').SimRun} run
 * @param {Map<string, object> | undefined} itemsById
 */
export function summarizeStatusReport(run, itemsById) {
  /** @type {Record<string, { player: Map<string, object>, dummy: Map<string, object> }>} */
  const stacks = {};
  const itemBuffs = { player: new Map(), dummy: new Map() };
  const heals = { player: new Map(), dummy: new Map() };
  const damage = { player: new Map(), dummy: new Map() };
  const misses = { player: 0, dummy: 0 };
  const activations = { player: new Map() };
  const stats = [];

  const ensureStack = (who, stack) => {
    if (!stacks[stack]) {
      stacks[stack] = { player: new Map(), dummy: new Map() };
    }
    return stacks[stack][who];
  };

  for (const raw of run.events || []) {
    const e = {
      ...raw,
      handler: raw.meta?.handler,
      stack: raw.meta?.stack,
    };
    const t = Number(e.t) || 0;
    const amount = Number(e.amount);
    const src = sourceOf(e, itemsById);

    if (e.type === 'activate') {
      const who = e.actor === 'dummy' ? 'dummy' : 'player';
      if (!activations[who]) activations[who] = new Map();
      addGrant(activations[who], src.id, t, 1, {
        id: src.id,
        itemId: src.itemId,
        name: src.name,
        handler: src.handler,
      });
      continue;
    }

    if (e.type === 'miss') {
      if (e.actor === 'dummy') misses.dummy += 1;
      else misses.player += 1;
      continue;
    }

    if (e.type === 'stat') {
      stats.push({
        t: roundT(t),
        itemId: e.itemId || null,
        name: src.name,
        label: e.label || '',
        amount: Number.isFinite(amount) ? amount : null,
        stat: e.meta?.stat || null,
        total: e.meta?.total ?? null,
      });
      continue;
    }

    if (e.type === 'buff' || e.type === 'debuff') {
      const stack = inferStack(e);
      const who = buffOwner(e, e.type === 'debuff' ? 'dummy' : 'player');
      const n = Number.isFinite(amount) ? amount : 0;
      if (stack) {
        addGrant(ensureStack(who, stack), src.id, t, n, {
          id: src.id,
          itemId: src.itemId,
          name: src.name,
          handler: src.handler,
          systemOrigin: src.systemOrigin,
        });
      } else {
        addGrant(itemBuffs[who], `${src.id}:${e.label || e.type}`, t, n, {
          id: src.id,
          itemId: src.itemId,
          name: src.name,
          handler: src.handler,
          label: e.label || '',
        });
      }
      continue;
    }

    if (e.type === 'heal' || e.meta?.category === 'hot') {
      const who = buffOwner(e, 'player');
      const n = Number.isFinite(amount) ? amount : 0;
      const kind =
        e.meta?.stack === 'regeneration' || /regeneration/i.test(String(e.label))
          ? 'regeneration'
          : /vampirism/i.test(String(e.label))
            ? 'vampirism'
            : /max\s*hp/i.test(String(e.label))
              ? 'maxHp'
              : /lifesteal/i.test(String(e.label))
                ? 'lifesteal'
                : e.meta?.category === 'hot'
                  ? 'hot'
                  : 'heal';
      const gameOrigin =
        kind === 'vampirism'
          ? {
              id: 'Vampirism',
              itemId: null,
              name: 'Vampirism',
              handler: null,
              systemOrigin: 'Vampirism',
            }
          : kind === 'regeneration'
            ? {
                id: 'Regeneration',
                itemId: null,
                name: 'Regeneration',
                handler: null,
                systemOrigin: 'Regeneration',
              }
            : {
                id: src.id,
                itemId: src.itemId,
                name:
                  kind === 'maxHp'
                    ? `${src.name} (max HP — not Heal tab)`
                    : src.name,
                handler: src.handler,
              };
      addGrant(heals[who], `${gameOrigin.id}:${kind}`, t, n, {
        ...gameOrigin,
        kind,
        label: e.label || '',
        byItem: {},
      });
      const row = heals[who].get(`${gameOrigin.id}:${kind}`);
      const via = src.itemId || src.name;
      if (row && via && via !== gameOrigin.id) {
        row.byItem[via] = (row.byItem[via] || 0) + n;
      }
      continue;
    }

    if (e.type === 'damage') {
      const who = eventTarget(e, e.actor === 'dummy' ? 'player' : 'dummy');
      const n = Number.isFinite(amount) ? amount : 0;
      const kind = e.meta?.fatigue
        ? 'fatigue'
        : e.meta?.spikes
          ? 'spikes'
          : e.meta?.kind === 'unhealing' ||
              e.meta?.systemOrigin === 'Unhealing' ||
              /^Unhealing\b/i.test(String(e.label || ''))
            ? 'unhealing'
          : e.actor === 'dummy'
            ? 'dummy'
            : e.actor === 'system'
              ? 'system'
              : 'item';
      addGrant(damage[who], `${src.id}:${kind}`, t, n, {
        id: src.id,
        itemId: src.itemId,
        name: src.name || (kind === 'fatigue' ? 'Fatigue' : src.id),
        handler: src.handler,
        kind,
        crits: 0,
      });
      if (e.meta?.critical) {
        const row = damage[who].get(`${src.id}:${kind}`);
        if (row) row.crits = (row.crits || 0) + 1;
      }
    }
  }

  const playerEnd = endStacks(run.summary?.player);
  const dummyEnd = endStacks(run.summary?.dummy);

  /** @type {Record<string, object>} */
  const buffs = {};
  /** @type {Record<string, object>} */
  const debuffs = {};
  // Heat is a buff in-game (Damage Meter Heat tab + combat-log "Gained Heat").
  const DEBUFF_STACKS = new Set(['blind', 'poison', 'cold']);

  for (const [stack, sides] of Object.entries(stacks)) {
    const bucket = DEBUFF_STACKS.has(stack) ? debuffs : buffs;
    bucket[stack] = {
      player: {
        end: playerEnd[stack] || 0,
        sources: mapToList(sides.player),
      },
      dummy: {
        end: dummyEnd[stack] || 0,
        sources: mapToList(sides.dummy),
      },
    };
    const p = bucket[stack].player;
    const d = bucket[stack].dummy;
    p.gained = p.sources.reduce((s, r) => s + r.gained, 0);
    d.gained = d.sources.reduce((s, r) => s + r.gained, 0);
    if (!p.sources.length && !p.end) delete bucket[stack].player;
    if (!d.sources.length && !d.end) delete bucket[stack].dummy;
    if (!bucket[stack].player && !bucket[stack].dummy) delete bucket[stack];
  }

  const sumList = (list) => list.reduce((s, r) => s + r.gained, 0);

  const playerHeals = mapToList(heals.player);
  const dummyHeals = mapToList(heals.dummy);
  const toPlayerDmg = mapToList(damage.player);
  const toDummyDmg = mapToList(damage.dummy);

  const byKind = (list) => {
    /** @type {Record<string, { total: number, grants: number }>} */
    const out = {};
    for (const row of list) {
      const k = row.kind || 'other';
      if (!out[k]) out[k] = { total: 0, grants: 0 };
      out[k].total += row.gained;
      out[k].grants += row.grants;
    }
    return out;
  };

  return {
    buffs,
    debuffs,
    itemBuffs: {
      player: mapToList(itemBuffs.player),
      dummy: mapToList(itemBuffs.dummy),
    },
    heals: {
      player: {
        total: sumList(playerHeals.filter((r) => r.kind !== 'maxHp')),
        byKind: byKind(playerHeals),
        sources: playerHeals,
      },
      dummy: dummyHeals.length
        ? { total: sumList(dummyHeals), byKind: byKind(dummyHeals), sources: dummyHeals }
        : undefined,
    },
    damage: {
      toDummy: {
        total: sumList(toDummyDmg),
        byKind: byKind(toDummyDmg),
        sources: toDummyDmg,
      },
      toPlayer: {
        total: sumList(toPlayerDmg),
        byKind: byKind(toPlayerDmg),
        sources: toPlayerDmg,
      },
    },
    misses,
    activations: {
      player: {
        total: mapToList(activations.player).reduce((s, r) => s + r.gained, 0),
        sources: mapToList(activations.player),
      },
      dummy: mapToList(activations.dummy || new Map()).length
        ? {
            total: mapToList(activations.dummy).reduce((s, r) => s + r.gained, 0),
            sources: mapToList(activations.dummy),
          }
        : undefined,
    },
    stats: stats.length ? stats : undefined,
    end: {
      player: {
        hp: run.summary?.player?.hp,
        maxHp: run.summary?.player?.maxHp,
        stacks: playerEnd,
        healAmp: run.summary?.player?.healAmp || 0,
        unhealing: run.summary?.player?.unhealing || 0,
      },
      dummy: {
        hp: run.summary?.dummy?.hp,
        maxHp: run.summary?.dummy?.maxHp,
        stacks: dummyEnd,
      },
    },
  };
}
