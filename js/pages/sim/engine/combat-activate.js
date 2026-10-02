/**
 * Activation pipeline — stamina, hit, block/DR, lifesteal, stacks, adjacency, cards.
 */

import { tryUseStamina } from './actor.js';
import { dealDamage } from './damage.js';
import { gainStacks } from './stacks.js';
import { affectedTargets } from './board-graph.js';
import { randInt, rollPercent } from './rng.js';
import { getScriptHandler } from './scripts/registry.js';
import { applyBonusDamageFactor, modifiedAccuracy } from './piece-stats.js';
import { pushActivate } from './scripts/ports-util.js';
import { logWeaponHitEvents } from './log-chain.js';
import { eventSideForPiece } from './vs-board.js';

/**
 * @param {import('./pieces.js').CombatPiece} piece
 * @param {{
 *   t: number,
 *   player: import('./actor.js').SimActor,
 *   dummy: import('./actor.js').SimActor,
 *   rng: () => number,
 *   events: import('../sim-events.js').SimEvent[],
 *   graph: import('./board-graph.js').BoardGraph,
 *   itemsById: Map<string, object>,
 *   canAffect: object | null,
 *   deckIndex: { i: number },
 *   cardKeys: string[],
 * }} ctx
 * @returns {boolean} activated
 */
export function activatePiece(piece, ctx) {
  const { t, player, dummy, rng, events } = ctx;
  const prevStamItem = player._staminaItem;
  player._staminaItem = piece;
  try {
    return activatePieceBody(piece, ctx);
  } finally {
    player._staminaItem = prevStamItem;
  }
}

/**
 * @param {import('./pieces.js').CombatPiece} piece
 * @param {Parameters<typeof activatePiece>[1]} ctx
 */
function activatePieceBody(piece, ctx) {
  const { t, player, dummy, rng, events } = ctx;
  piece._activationLogged = false;
  const actor = eventSideForPiece(piece);
  if (!piece.alive || player.dead || dummy.dead) return false;
  if (piece.charges != null && piece.charges <= 0) return false;

  // Cold slows: chance to skip activation
  if (player.stacks.cold > 0 && rollPercent(Math.min(40, player.stacks.cold * 5), rng)) {
    events.push({
      t,
      type: 'info',
      actor: player.id,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: slowed (Cold)`,
      meta: { category: 'status' },
    });
    return false;
  }

  // Band D: per-item / family script handler
  const script = getScriptHandler(piece.itemId);
  if (
    !script?.onCooldownEffect &&
    piece.kind !== 'weapon' &&
    piece.kind !== 'pet' &&
    piece.kind !== 'consumable' &&
    !(Number(piece.damageMax) > 0)
  ) {
    return false;
  }
  if (script?.onCooldownEffect) {
    const handled = script.onCooldownEffect(piece, ctx);
    if (handled) {
      if (!piece._activationLogged && script.handlerId) {
        pushActivate(piece, ctx, script.handlerId);
      }
      // Item.trigger — optional second doCooldownEffect via doubleActivationChance
      if (
        (Number(piece.doubleActivationChance) || 0) > 0 &&
        rollPercent((Number(piece.doubleActivationChance) || 0) * 100, rng)
      ) {
        script.onCooldownEffect(piece, { ...ctx, t: t + 0.001 });
        events.push({
          t: t + 0.0015,
          type: 'info',
          itemId: piece.itemId,
          placementKey: piece.placementKey,
          label: `${piece.name}: double activation`,
          meta: { category: 'system', script: true, doubleActivation: true },
        });
      }
      if (piece.charges != null) {
        piece.charges -= 1;
        if (piece.charges <= 0) piece.alive = false;
      }
      events.push({
        t: t + 0.009,
        type: 'cooldown',
        actor,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        amount: piece.cooldown,
        label: `${piece.name} CD ${piece.cooldown.toFixed(2)}s`,
        meta: { category: 'cooldown', script: true, handler: script.handlerId },
      });
      notifyPeerActivations(piece, ctx);
      return true;
    }
  }

  const stam = tryUseStamina(player, piece.staminaCost);
  if (stam === 'starve') {
    events.push({
      t,
      type: 'stamina',
      actor,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      amount: piece.staminaCost,
      label: `${piece.name}: out of stamina`,
      meta: { stamina: player.stamina, starved: true, category: 'stamina' },
    });
    return false;
  }

  const kindLabel =
    piece.kind === 'pet'
      ? 'Pet'
      : piece.kind === 'card'
        ? 'Card'
        : piece.kind === 'consumable'
          ? 'Spell'
          : 'Item';

  events.push({
    t,
    type: 'activate',
    actor,
    itemId: piece.itemId,
    placementKey: piece.placementKey,
    label: `${kindLabel}: ${piece.name}`,
    meta: {
      category: piece.kind,
      gems: piece.gemNames,
    },
  });

  // Adjacency / canAffect support (log only — do not invent Empower stacks)
  const links = affectedTargets(
    ctx.graph,
    piece.placementKey,
    ctx.itemsById,
    ctx.canAffect,
  );
  for (const link of links) {
    const ally = ctx.itemsById.get(link.id);
    events.push({
      t: t + 0.001,
      type: 'info',
      actor: player.id,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name} → ${ally?.name || link.id} (${link.via})`,
      meta: {
        category: 'adjacency',
        targetKey: link.key,
        via: link.via,
        color: link.color,
      },
    });
  }

  // Card chain: playing a card draws next for bonus
  let cardBonus = 0;
  if (piece.kind === 'card' && ctx.cardKeys.length) {
    const nextKey = ctx.cardKeys[ctx.deckIndex.i % ctx.cardKeys.length];
    ctx.deckIndex.i += 1;
    const next = ctx.graph.pieces.get(nextKey);
    const nextItem = next ? ctx.itemsById.get(next.id) : null;
    cardBonus = 4 + (nextItem ? 2 : 0);
    events.push({
      t: t + 0.003,
      type: 'info',
      actor: player.id,
      label: `Deck: next ${nextItem?.name || 'card'} (+${cardBonus} dmg)`,
      meta: { category: 'card', deckIndex: ctx.deckIndex.i },
    });
  }

  const hasDamage = piece.damageMax > 0 || piece.damageMin > 0;
  if (hasDamage || piece.kind === 'pet' || piece.kind === 'card') {
    let accuracy = modifiedAccuracy(piece, player.stacks);

    let raw = hasDamage
      ? randInt(piece.damageMin, piece.damageMax, rng)
      : piece.kind === 'pet'
        ? 8
        : 6;
    raw +=
      cardBonus +
      (piece.damageBonus || 0) +
      (piece.bonusDamage || 0);
    const critChance =
      piece.chanceTag === 'crit' && piece.chance > 0 ? piece.chance : 0;

    player._deferUnhealLog = true;
    dummy._deferUnhealLog = true;
    const res = dealDamage(player, dummy, {
      amount: applyBonusDamageFactor(piece, raw + (player.stacks.empower || 0)),
      originPiece: piece,
      onPreDealDamageEarly: (res) => ctx.notifyPreDealDamageEarly?.(piece, ctx, res),
      accuracy,
      canMiss: true,
      canCrit: critChance > 0,
      critChance,
      isAttack: true,
      isMelee: piece.damageKind !== 'ranged',
      vampiricItem: piece.vampiric,
      nowT: t,
      bus: ctx.bus,
      rng,
    });
    player._deferUnhealLog = false;
    dummy._deferUnhealLog = false;

    if (!res.hit) {
      events.push({
        t: t + 0.004,
        type: 'miss',
        actor: player.id,
        target: dummy.id,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name} missed`,
        meta: { category: 'damage', isAttack: true },
      });
      const missResult = {
        hit: false,
        healthDamage: 0,
        raw,
        critical: false,
        missed: true,
      };
      const n = res.attackEffectCount || 1;
      if (typeof ctx.notifyDealtDamage === 'function') {
        for (let i = 0; i < n; i += 1) {
          ctx.notifyDealtDamage(piece, ctx, missResult);
        }
      }
      ctx.bus?.emit?.('item_attacked', { piece, hit: missResult, t });
    } else {
      applyOnHitStacks(piece, dummy, player, events, t + 0.005, rng);

      const allocId = ctx.logChain?.nextId?.bind(ctx.logChain) || (() => 0);
      logWeaponHitEvents({
        t,
        piece,
        player,
        dummy,
        res,
        events,
        allocId,
        formatHitLabel,
      });

      if (typeof ctx.notifyDealtDamage === 'function') {
        const n = res.attackEffectCount || 1;
        const hitResult = {
          hit: true,
          healthDamage: res.healthDamage,
          raw,
          critical: res.critical,
          missed: false,
        };
        for (let i = 0; i < n; i += 1) {
          ctx.notifyDealtDamage(piece, ctx, hitResult);
        }
      }
      ctx.bus?.emit?.('piece_dealt_damage', {
        piece,
        hit: { hit: true, healthDamage: res.healthDamage },
        t,
      });
      ctx.bus?.emit?.('item_attacked', {
        piece,
        hit: {
          hit: true,
          healthDamage: res.healthDamage,
          damage: res.damage,
          raw,
          critical: res.critical,
          missed: false,
        },
        t,
      });
    }
  } else if (piece.blockGrant > 0) {
    // Catalog `block` is shield/tooltip power — not a per-activation Block grant.
    // Real giveBlock() comes from dedicated scripts (armor start, Cog, potions, …).
    events.push({
      t: t + 0.004,
      type: 'info',
      actor: player.id,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: activated`,
      meta: { category: 'system', blockPower: piece.blockGrant },
    });
  }

  if (piece.charges != null) {
    piece.charges -= 1;
    if (piece.charges <= 0) {
      piece.alive = false;
      events.push({
        t: t + 0.008,
        type: 'info',
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name} consumed`,
        meta: { category: piece.kind },
      });
    }
  }

  events.push({
    t: t + 0.009,
    type: 'cooldown',
    actor: player.id,
    itemId: piece.itemId,
    placementKey: piece.placementKey,
    amount: piece.cooldown,
    label: `${piece.name} CD ${piece.cooldown.toFixed(2)}s`,
    meta: { category: 'cooldown' },
  });

  notifyPeerActivations(piece, ctx);
  return true;
}

/**
 * Notify listen-only accessories (e.g. Amulet of Light) when an affected item activates.
 * @param {import('./pieces.js').CombatPiece} activated
 * @param {Parameters<typeof activatePiece>[1]} ctx
 */
function notifyPeerActivations(activated, ctx) {
  ctx.bus?.emit?.('piece_activated', { piece: activated, t: ctx.t });
  const pieces = ctx.pieces || [];
  for (const listener of pieces) {
    if (!listener?.alive) continue;
    if (listener.placementKey === activated.placementKey) continue;
    const script = getScriptHandler(listener.itemId);
    if (typeof script?.onPeerActivated !== 'function') continue;
    const links = affectedTargets(
      ctx.graph,
      listener.placementKey,
      ctx.itemsById,
      ctx.canAffect,
    );
    if (!links.some((l) => l.key === activated.placementKey)) continue;
    script.onPeerActivated(listener, activated, ctx);
  }
}

/**
 * @param {string} name
 * @param {number} raw
 * @param {{ blocked: number, reduced: number, healthDamage: number }} res
 */
function formatHitLabel(name, raw, res) {
  const bits = [];
  if (res.reduced > 0) bits.push(`−${res.reduced} DR`);
  if (res.blocked > 0) bits.push(`−${res.blocked} block`);
  const shown = Number(res.damage) || res.healthDamage;
  return bits.length
    ? `${name} hit ${raw} (${bits.join(', ')}) → ${shown}`
    : `${name} hit for ${shown}`;
}

/**
 * @param {import('./pieces.js').CombatPiece} piece
 * @param {import('./actor.js').SimActor} dummy
 * @param {import('./actor.js').SimActor} player
 * @param {import('../sim-events.js').SimEvent[]} events
 * @param {number} t
 * @param {() => number} rng
 */
function applyOnHitStacks(piece, dummy, player, events, t, rng) {
  const hints = piece.stackHints || [];
  const procs = 1 + (rollPercent((piece.doubleAttackEffectChance || 0) * 100, rng) ? 1 : 0);
  for (let proc = 0; proc < procs; proc++) {
    const dt = t + proc * 0.001;
    if (hints.includes('poison') && rollPercent(35, rng)) {
      gainStacks(dummy, 'poison', 1, { rng, opponent: player });
      events.push({
        t: dt,
        type: 'debuff',
        actor: player.id,
        target: dummy.id,
        amount: 1,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +1 Poison`,
        meta: { stack: 'poison', poison: dummy.stacks.poison, category: 'dot' },
      });
    }
    if (hints.includes('heat') && rollPercent(30, rng)) {
      gainStacks(dummy, 'heat', 1, { rng, opponent: player });
      events.push({
        t: dt,
        type: 'buff',
        actor: player.id,
        target: dummy.id,
        amount: 1,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +1 Heat`,
        meta: { stack: 'heat', category: 'buff' },
      });
    }
    if (hints.includes('cold') && rollPercent(25, rng)) {
      gainStacks(dummy, 'cold', 1, { rng, opponent: player });
      events.push({
        t: dt,
        type: 'debuff',
        actor: player.id,
        target: dummy.id,
        amount: 1,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +1 Cold`,
        meta: { stack: 'cold', category: 'status' },
      });
    }
    if (hints.includes('blind') && rollPercent(20, rng)) {
      gainStacks(dummy, 'blind', 1, { rng, opponent: player });
      events.push({
        t: dt,
        type: 'debuff',
        actor: player.id,
        target: dummy.id,
        amount: 1,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +1 Blind`,
        meta: { stack: 'blind', category: 'status' },
      });
    }
    if (hints.includes('regeneration') && rollPercent(25, rng)) {
      gainStacks(player, 'regeneration', 1);
      events.push({
        t: dt,
        type: 'buff',
        actor: player.id,
        target: player.id,
        amount: 1,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +1 Regeneration`,
        meta: { stack: 'regeneration', category: 'hot' },
      });
    }
    if (hints.includes('vampirism') && rollPercent(20, rng)) {
      gainStacks(player, 'vampirism', 1);
      events.push({
        t: dt,
        type: 'buff',
        actor: player.id,
        target: player.id,
        amount: 1,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +1 Vampirism`,
        meta: { stack: 'vampirism', category: 'buff' },
      });
    }
    if (piece.vampiric && rollPercent(15, rng)) {
      gainStacks(player, 'vampirism', 1);
      events.push({
        t: dt,
        type: 'buff',
        actor: player.id,
        target: player.id,
        amount: 1,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +1 Vampirism`,
        meta: { stack: 'vampirism', category: 'buff' },
      });
    }
  }
}
