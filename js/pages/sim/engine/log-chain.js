/**
 * Combat-log parent/child chains — mirrors CombatEvent.parentEvent depth.
 */

/**
 * @returns {{ nextId: () => number }}
 */
export function createLogChainAllocator() {
  let seq = 1;
  return {
    nextId: () => seq++,
  };
}

/**
 * Log weapon hit: damage → vamp heal → unhealing (nested like the game).
 * Mechanics already ran inside dealDamage; this only shapes the log.
 *
 * @param {{
 *   t: number,
 *   piece: object,
 *   player: object,
 *   dummy: object,
 *   res: { hit?: boolean, damage?: number, healthDamage?: number, raw?: number, critical?: boolean, blocked?: number, reduced?: number, vampHeal?: number, spikeDamage?: number },
 *   events: object[],
 *   allocId: () => number,
 *   formatHitLabel?: (name: string, raw: number, res: object) => string,
 * }} opts
 */
export function logWeaponHitEvents(opts) {
  const { t, piece, player, dummy, res, events, allocId } = opts;
  if (!res?.hit) return null;

  const formatHitLabel =
    opts.formatHitLabel ||
    ((name, raw, r) =>
      `${name} hit${r.critical ? ' crit' : ''} for ${r.damage ?? raw}`);

  const damageId = allocId();
  events.push({
    t,
    type: 'damage',
    actor: player.id,
    target: dummy.id,
    itemId: piece.itemId,
    placementKey: piece.placementKey,
    amount: res.damage,
    label: formatHitLabel(piece.name, res.raw, res),
    meta: {
      category: 'damage',
      eventId: damageId,
      isAttack: true,
      raw: res.raw,
      damage: res.damage,
      healthDamage: res.healthDamage,
      blocked: res.blocked,
      reduced: res.reduced,
      critical: res.critical,
      dummyHp: dummy.hp,
      playerHp: player.hp,
    },
  });

  /** @type {number | null} */
  let healId = null;
  if (res.vampHeal > 0) {
    if (player._lastHeal) player._lastHeal.meterAttached = true;
    healId = allocId();
    events.push({
      t,
      type: 'heal',
      actor: player.id,
      target: player.id,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      amount: res.vampHeal,
      label: `${piece.name}: vampirism +${res.vampHeal}`,
      meta: {
        category: 'heal',
        eventId: healId,
        parentId: damageId,
        playerHp: player.hp,
        systemOrigin: 'Vampirism',
        loggedAmount: res.vampHeal,
        stack: 'vampirism',
      },
    });
    flushDeferredUnhealLog(player, healId, events);
  }

  if (res.spikeDamage > 0) {
    events.push({
      t,
      type: 'damage',
      actor: dummy.id,
      target: player.id,
      amount: res.spikeDamage,
      label: `Spikes: ${res.spikeDamage} damage`,
      meta: {
        category: 'damage',
        parentId: damageId,
        stack: 'spikes',
        systemOrigin: 'Spikes',
        spikes: true,
      },
    });
  }

  return { damageId, healId };
}

/**
 * Attach deferred unhealing line from heal() to the vamp heal row.
 * @param {object} healer
 * @param {number} healEventId
 * @param {object[]} events
 */
export function flushDeferredUnhealLog(healer, healEventId, events) {
  const row = healer?._deferredUnhealLog;
  if (!row) return;
  healer._deferredUnhealLog = null;
  row.meta = {
    ...(row.meta || {}),
    parentId: healEventId,
    eventId: row.meta?.eventId,
  };
  events.push(row);
}
