/**
 * Attribution for combat stat changes (tooltip “changed by”).
 * Script handlers wrap with withStatSource(actingPiece).
 */

/** @type {{ name: string, itemId: string, key: string }[]} */
const stack = [];

/**
 * @param {object | null | undefined} pieceOrSrc
 * @returns {{ name: string, itemId: string, key: string } | null}
 */
export function sourceFrom(pieceOrSrc) {
  if (!pieceOrSrc) return null;
  const name = String(pieceOrSrc.name || pieceOrSrc.itemId || '').trim();
  if (!name) return null;
  return {
    name,
    itemId: String(pieceOrSrc.itemId || ''),
    key: String(pieceOrSrc.placementKey || pieceOrSrc.key || ''),
  };
}

/**
 * @param {object | null | undefined} pieceOrSrc
 * @param {() => T} fn
 * @returns {T}
 * @template T
 */
export function withStatSource(pieceOrSrc, fn) {
  const src = sourceFrom(pieceOrSrc);
  if (!src) return fn();
  stack.push(src);
  try {
    return fn();
  } finally {
    stack.pop();
  }
}

export function currentStatSource() {
  return stack.length ? stack[stack.length - 1] : null;
}

/**
 * Run `fn` with an empty attribution stack so buff listeners do not inherit
 * the grantor's withStatSource (Mana Orb grant → weapon converts → wrongly
 * labeled "Bonus from Mana Orb").
 * @param {() => T} fn
 * @returns {T}
 * @template T
 */
export function runWithoutStatSource(fn) {
  if (!stack.length) return fn();
  const saved = stack.splice(0, stack.length);
  try {
    return fn();
  } finally {
    for (const s of saved) stack.push(s);
  }
}

/**
 * @param {object} piece
 * @param {{
 *   stat: string,
 *   amount: number,
 *   unit?: 'flat' | 'factor',
 *   via?: string | null,
 *   originKey?: string | null,
 *   originId?: string | null,
 *   originName?: string | null,
 * }} entry
 */
export function recordPieceMod(piece, entry) {
  const n = Number(entry.amount) || 0;
  if (!piece || !n) return;
  /** @type {{ name: string, itemId: string, key: string } | null} */
  let src = null;
  if (entry.originKey || entry.originId || entry.originName) {
    src = {
      name: String(entry.originName || entry.originId || 'combat').trim(),
      itemId: String(entry.originId || ''),
      key: String(entry.originKey || ''),
    };
  } else {
    src = currentStatSource();
  }
  if (!piece._statMods) piece._statMods = [];
  piece._statMods.push({
    stat: entry.stat,
    amount: n,
    unit: entry.unit || 'flat',
    via: entry.via ? String(entry.via) : null,
    source: src?.name || 'combat',
    sourceId: src?.itemId || '',
    sourceKey: src?.key || '',
  });
}

/** Weapon-like pieces that receive Empower flat damage in tips. */
function pieceShowsEmpowerDamage(piece) {
  if (piece.empowerable === false) return false;
  const lo = Number(piece.damageMin) || 0;
  const hi = Number(piece.damageMax) || 0;
  if (lo > 0 || hi > 0) return true;
  if (piece.kind === 'weapon') return true;
  return /weapon/i.test(String(piece.itemType || piece.item?.type || ''));
}

/**
 * Collapse logs + live stacks for a tooltip snapshot.
 * @param {object} piece
 * @param {{ empower?: number, heat?: number, cold?: number, lucky?: number, blind?: number } | null} [stacks]
 * @param {{ stackGrantByOrigin?: Record<string, Record<string, number>> | null }} [opts]
 */
export function summarizeStatMods(piece, stacks = null, opts = {}) {
  /** @type {Map<string, object>} */
  const map = new Map();

  const add = (stat, amount, unit, source, meta = {}) => {
    const n = Number(amount) || 0;
    if (!n || !source) return;
    const via = meta.via ? String(meta.via) : null;
    const sourceId = meta.sourceId ? String(meta.sourceId) : '';
    const sourceKey = meta.sourceKey ? String(meta.sourceKey) : '';
    const k = `${stat}\0${unit}\0${source}\0${via || ''}\0${sourceId}\0${sourceKey}\0${meta.isCauseTotal ? '1' : ''}`;
    const prev = map.get(k);
    if (prev) prev.amount += n;
    else {
      map.set(k, {
        stat,
        amount: n,
        unit,
        source,
        via,
        sourceId,
        sourceKey,
        isCauseTotal: !!meta.isCauseTotal,
      });
    }
  };

  for (const m of piece._statMods || []) {
    const srcId = String(m.sourceId || '').trim();
    const pieceId = String(piece.itemId || '').trim();
    // Socketed gems reuse the host placementKey — only treat as self when itemId matches.
    const self =
      m.sourceKey &&
      m.sourceKey === piece.placementKey &&
      (!srcId || srcId === pieceId)
        ? 'this item'
        : m.source || 'combat';
    add(m.stat, m.amount, m.unit || 'flat', self, {
      via: m.via,
      sourceId: m.sourceId,
      sourceKey: m.sourceKey,
    });
  }

  const emp = pieceShowsEmpowerDamage(piece)
    ? Math.max(0, Number(stacks?.empower) || 0)
    : 0;
  if (emp > 0) {
    add('damage', emp, 'flat', '__total__', { via: 'empower', isCauseTotal: true });
    const grants = opts.stackGrantByOrigin?.empower || {};
    for (const [originId, amt] of Object.entries(grants)) {
      const n = Number(amt) || 0;
      if (n > 0) {
        add('damage', n, 'flat', originId, { via: 'empower', sourceId: originId });
      }
    }
  }

  const heat = Number(stacks?.heat) || 0;
  const cold = Number(stacks?.cold) || 0;
  const heatNet = (heat - cold) * 0.02;
  if (heatNet) {
    add('speed', heatNet, 'factor', '__total__', {
      via: heatNet > 0 ? 'heat' : 'cold',
      isCauseTotal: true,
    });
  }

  const type = String(piece.itemType || piece.item?.type || '');
  const showsAccuracy = /weapon|ranged|melee/i.test(type);
  const lucky = Number(stacks?.lucky) || 0;
  const blind = Number(stacks?.blind) || 0;
  if (showsAccuracy && lucky) {
    add('accuracy', lucky * 5, 'flat', '__total__', { via: 'lucky', isCauseTotal: true });
  }
  if (showsAccuracy && blind) {
    add('accuracy', -blind * 5, 'flat', '__total__', { via: 'blind', isCauseTotal: true });
  }

  return [...map.values()].filter((r) => Math.abs(r.amount) > 1e-6);
}
