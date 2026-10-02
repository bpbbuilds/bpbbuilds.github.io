/**
 * Band AE Wave C — scaling / threshold weapons (AG 204–206 deepen).
 */

import {
  DEBUFF_KEYS,
  grantStacks,
  inflictRandomDebuffs,
  onBuffChanged,
  useLucky,
  useRegeneration,
} from '../buff-economy.js';
import { giveBuffPower } from '../buff-power.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getP3, getP4, getPName } from '../params.js';
import { addAccuracy, addBonusDamage, addBonusDamageFromBuffChange, addSpeed } from '../piece-stats.js';
import { gainStacks, loseStacks } from '../stacks.js';
import { eventSideForPiece } from '../vs-board.js';
import { itemHasType } from './ports-util.js';
import { rollItemChance, weaponStrike } from './ports-wave-c-util.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/** @param {object} ctx @param {object} piece @param {string} type */
function countLinkedType(ctx, piece, type) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  let n = 0;
  for (const other of ctx.pieces || []) {
    if (!links.some((l) => l.key === other.placementKey)) continue;
    if (itemHasType(ctx.itemsById.get(other.itemId), type)) n += 1;
  }
  return n;
}

/** OnionCutter.gd */
/** @type {ScriptHandler} */
export const onionCutterPort = {
  handlerId: 'onion_cutter',
  family: 'on_hit',
  onCombatStart(piece, ctx) {
    const speed = getPName(piece.params, 'speed', getP1(piece.params, 10)) / 100;
    const n = countLinkedType(ctx, piece, 'food');
    if (n && speed) addSpeed(piece, n * speed);
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'onion_cutter');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    const factor = Math.abs(getPName(piece.params, 'dam', getP2(piece.params, 5)) / 100);
    if (factor) {
      ctx.dummy.damageResistancePct = Math.max(
        0,
        (Number(ctx.dummy.damageResistancePct) || 0) - factor * 100,
      );
    }
  },
};

/** ThornWhip.gd — spikes on hit; spike deltas → varying damage. */
/** @type {ScriptHandler} */
export const thornWhipPort = {
  handlerId: 'thorn_whip',
  family: 'on_hit',
  onCombatStart(piece, ctx) {
    const per = Number(getP1(piece.params, 1)) || 0;
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack !== 'spikes' || !per) return;
      addBonusDamageFromBuffChange(piece, ch, per);
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'thorn_whip');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    grantStacks(ctx.player, 'spikes', 1, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    ctx.events.push({
      t: ctx.t + 0.008,
      type: 'buff',
      target: 'player',
      amount: 1,
      label: `${piece.name}: +1 Spikes`,
      meta: { category: 'buff', stack: 'spikes', script: true, handler: 'thorn_whip' },
    });
  },
};

/** ClawsofAttack.gd — spikes → speed; N hits → empower. */
/** @type {ScriptHandler} */
export const clawsOfAttackPort = {
  handlerId: 'claws_of_attack',
  family: 'on_hit',
  onCombatStart(piece, ctx) {
    piece._clawHits = 0;
    piece._clawSpeed = 0;
    const syncSpeed = () => {
      const spikes = ctx.player.stacks.spikes || 0;
      const per = getP1(piece.params, 2);
      const cap = getP2(piece.params, 20);
      const bonus = Math.min(per * spikes, cap) / 100;
      const delta = bonus - (piece._clawSpeed || 0);
      if (delta) addSpeed(piece, delta);
      piece._clawSpeed = bonus;
    };
    syncSpeed();
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack === 'spikes') syncSpeed();
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'claws_of_attack');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    piece._clawHits = (piece._clawHits || 0) + 1;
    const need = Math.max(1, Math.round(getP3(piece.params, 3)));
    if (piece._clawHits >= need) {
      piece._clawHits = 0;
      grantStacks(ctx.player, 'empower', 1, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      ctx.events.push({
        t: ctx.t + 0.008,
        type: 'buff',
        target: 'player',
        amount: 1,
        label: `${piece.name}: +1 Empower`,
        meta: { category: 'buff', stack: 'empower', script: true, handler: 'claws_of_attack' },
      });
    }
  },
};

/** ForestDragon.gd — nature speed; regen deltas → dam; hit regen/luck. */
/** @type {ScriptHandler} */
export const forestDragonPort = {
  handlerId: 'forest_dragon',
  family: 'on_hit',
  onCombatStart(piece, ctx) {
    const speed = getPName(piece.params, 'speed', 5) / 100;
    const n = countLinkedType(ctx, piece, 'nature');
    if (n && speed) addSpeed(piece, n * speed);
    const per = Number(getPName(piece.params, 'dam', getP1(piece.params, 1))) || 0;
    const regen0 = ctx.player.stacks.regeneration || 0;
    if (regen0 && per) addBonusDamage(piece, Math.round(regen0 * per));
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack !== 'regeneration' || !per) return;
      addBonusDamageFromBuffChange(piece, ch, per);
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'forest_dragon');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    const regen = Math.max(1, Math.round(getPName(piece.params, 'regen', getP1(piece.params, 1))));
    const luck = Math.max(0, Math.round(getPName(piece.params, 'luck', getP2(piece.params, 1))));
    grantStacks(ctx.player, 'regeneration', regen, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    if (luck) {
      grantStacks(ctx.player, 'lucky', luck, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
  },
};

/** IceDragon.gd — cold on hit; cold threshold → block + resist. */
/** @type {ScriptHandler} */
export const iceDragonPort = {
  handlerId: 'ice_dragon',
  family: 'on_hit',
  onCombatStart(piece, ctx) {
    piece._iceBlock = false;
    const th = Math.max(1, Math.round(getPName(piece.params, 'coldt', getP2(piece.params, 8))));
    const damF = Math.abs(getPName(piece.params, 'damfactor', 10) / 100);
    onBuffChanged(ctx.dummy, (ch) => {
      if (ch.stack !== 'cold' || piece._iceBlock) return;
      if ((ctx.dummy.stacks.cold || 0) < th) return;
      piece._iceBlock = true;
      const block = Math.max(1, Math.round(piece.blockGrant || getP3(piece.params, 10)));
      gainStacks(ctx.player, 'block', block);
      if (damF) {
        ctx.dummy.damageResistancePct = Math.max(
          0,
          (Number(ctx.dummy.damageResistancePct) || 0) - damF * 100,
        );
      }
      ctx.events.push({
        t: ctx.t + 0.008,
        type: 'buff',
        target: 'player',
        amount: block,
        label: `${piece.name}: +${block} Block`,
        meta: { category: 'buff', stack: 'block', script: true, handler: 'ice_dragon' },
      });
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'ice_dragon');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    const cold = Math.max(1, Math.round(getPName(piece.params, 'cold', getP1(piece.params, 2))));
    grantStacks(ctx.dummy, 'cold', cold, {
      originKey: piece.placementKey,
      originId: piece.itemId,
      rng: ctx.rng,
      opponent: ctx.player,
    });
  },
};

/** Thornbloom.gd — spikes; spike/empower listeners. */
/** @type {ScriptHandler} */
export const thornbloomPort = {
  handlerId: 'thornbloom',
  family: 'on_hit',
  onCombatStart(piece, ctx) {
    const per = Number(getPName(piece.params, 'damperspike', getP2(piece.params, 1))) || 0;
    const hpPer = Math.max(0, Math.round(getPName(piece.params, 'maxhealth', 5)));
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack === 'spikes' && per) addBonusDamageFromBuffChange(piece, ch, per);
      if (ch.stack === 'empower' && ch.amount > 0 && hpPer) {
        const hp = hpPer * ch.amount;
        ctx.player.maxHp += hp;
        ctx.player.hp = Math.min(ctx.player.maxHp, ctx.player.hp + hp);
      }
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'thornbloom');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    const spikes = Math.max(1, Math.round(getPName(piece.params, 'spikes', getP1(piece.params, 1))));
    grantStacks(ctx.player, 'spikes', spikes, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    if (rollItemChance(piece, ctx.rng)) {
      const emp = Math.max(1, Math.round(getPName(piece.params, 'empower', getP3(piece.params, 1))));
      grantStacks(ctx.player, 'empower', emp, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
  },
};

/** FancyFencingRapier.gd */
/** @type {ScriptHandler} */
export const fancyFencingRapierPort = {
  handlerId: 'fancy_fencing_rapier',
  family: 'on_hit',
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'fancy_fencing_rapier');
  },
  onDealtDamage(piece, ctx, hit) {
    if (hit?.hit) {
      const need = Math.max(1, Math.round(getPName(piece.params, 'luckt', getP1(piece.params, 1))));
      if (
        useLucky(ctx.player, need, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        }).spent > 0
      ) {
        const dam = Math.max(1, Math.round(getPName(piece.params, 'dam', getP2(piece.params, 2))));
        addBonusDamage(piece, dam);
      }
    } else {
      const luck = Math.max(1, Math.round(getPName(piece.params, 'luck', getP3(piece.params, 1))));
      grantStacks(ctx.player, 'lucky', luck, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
  },
};

/** HungryBlade.gd — start vamp; vamp → max dmg; regen → vamp. */
/** @type {ScriptHandler} */
export const hungryBladePort = {
  handlerId: 'hungry_blade',
  family: 'on_hit',
  onCombatStart(piece, ctx) {
    const vamp = Math.max(1, Math.round(getP1(piece.params, 2)));
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack !== 'vampirism' || !ch.amount) return;
      piece.damageMax = (Number(piece.damageMax) || 0) + ch.amount;
    });
    grantStacks(ctx.player, 'vampirism', vamp, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'hungry_blade');
  },
  // HungryBlade.gd onPreDealDamage_early: regen→vamp after hit, before damage/vamp heal.
  onPreDealDamageEarly(piece, ctx, res) {
    if (res && !res.hit) return;
    const need = Math.max(1, Math.round(getP2(piece.params, 2)));
    if ((ctx.player.stacks.regeneration || 0) < need) return;
    useRegeneration(ctx.player, need, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    const side = eventSideForPiece(piece);
    const useId = ctx.logChain?.nextId?.() ?? null;
    ctx.events.push({
      t: ctx.t,
      type: 'buff',
      target: side,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      amount: -need,
      label: `${piece.name}: spent ${need} Regeneration`,
      meta: {
        category: 'buff',
        stack: 'regeneration',
        used: true,
        script: true,
        handler: 'hungry_blade',
        ...(useId != null ? { eventId: useId } : {}),
      },
    });
    const vamp = Math.max(1, Math.round(getP3(piece.params, 1)));
    grantStacks(ctx.player, 'vampirism', vamp, {
      originKey: piece.placementKey,
      originId: piece.itemId,
      silentLog: true,
    });
    ctx.events.push({
      t: ctx.t,
      type: 'buff',
      target: side,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      amount: vamp,
      label: `${piece.name}: +${vamp} Vampirism (spent Regeneration)`,
      meta: {
        category: 'buff',
        stack: 'vampirism',
        script: true,
        handler: 'hungry_blade',
        ...(useId != null ? { parentId: useId } : {}),
      },
    });
  },
};

/** WarScythe.gd — +1 poison power on linked; poison spend → crit. */
/** @type {ScriptHandler} */
export const warScythePort = {
  handlerId: 'war_scythe',
  family: 'on_hit',
  onCombatStart(piece, ctx) {
    const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
    const keys = new Set(links.map((l) => l.key));
    for (const other of ctx.pieces || []) {
      if (!keys.has(other.placementKey)) continue;
      giveBuffPower(other, 'poison', 1);
    }
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'war_scythe');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    const need = Math.max(1, Math.round(getPName(piece.params, 'poisont', getP1(piece.params, 5))));
    if ((ctx.dummy.stacks.poison || 0) < need) return;
    loseStacks(ctx.dummy, 'poison', need);
    piece.critChance = (Number(piece.critChance) || 0) + (piece.chance || 10);
    const sev = getPName(piece.params, 'critdam', 0) / 100;
    if (sev) piece.critSeverity = (Number(piece.critSeverity) || 0) + sev;
    ctx.events.push({
      t: ctx.t + 0.008,
      type: 'info',
      label: `${piece.name}: poison → crit`,
      meta: { category: 'system', script: true, handler: 'war_scythe' },
    });
  },
};

/** Frostbite.gd — cold on hit; cold/vamp listeners. */
/** @type {ScriptHandler} */
export const frostbitePort = {
  handlerId: 'frostbite',
  family: 'on_hit',
  onCombatStart(piece, ctx) {
    piece._frostVamp = false;
    const per = Number(getP2(piece.params, 1)) || 0;
    const th = Math.max(1, Math.round(getP3(piece.params, 6)));
    const vampN = Math.max(1, Math.round(getP4(piece.params, 2)));
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack === 'vampirism' && ch.amount) addBonusDamageFromBuffChange(piece, ch);
    });
    onBuffChanged(ctx.dummy, (ch) => {
      if (ch.stack !== 'cold') return;
      if (per && ch.amount) addBonusDamageFromBuffChange(piece, ch, per);
      if (!piece._frostVamp && (ctx.dummy.stacks.cold || 0) >= th) {
        piece._frostVamp = true;
        grantStacks(ctx.player, 'vampirism', vampN, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
      }
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'frostbite');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit || !rollItemChance(piece, ctx.rng)) return;
    const cold = Math.max(1, Math.round(getP1(piece.params, 2)));
    grantStacks(ctx.dummy, 'cold', cold, {
      originKey: piece.placementKey,
      originId: piece.itemId,
      rng: ctx.rng,
      opponent: ctx.player,
    });
  },
};

/** CursedDagger.gd — random debuffs; debuff deltas → crit/acc (+ linked). */
/** @type {ScriptHandler} */
export const cursedDaggerPort = {
  handlerId: 'cursed_dagger',
  family: 'on_hit',
  onCombatStart(piece, ctx) {
    const chance = piece.chance || 5;
    const acc = Math.max(0, getP2(piece.params, 1));
    onBuffChanged(ctx.dummy, (ch) => {
      if (!DEBUFF_KEYS.includes(String(ch.stack)) || !ch.amount) return;
      piece.critChance = (Number(piece.critChance) || 0) + ch.amount * chance;
      if (acc) addAccuracy(piece, ch.amount * acc);
      const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
      for (const other of ctx.pieces || []) {
        if (!links.some((l) => l.key === other.placementKey)) continue;
        other.critChance = (Number(other.critChance) || 0) + ch.amount * chance;
        if (acc && (other.kind === 'weapon' || other.damageMax > 0)) {
          addAccuracy(other, ch.amount * acc);
        }
      }
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'cursed_dagger');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    const n = Math.max(1, Math.round(getP1(piece.params, 1)));
    inflictRandomDebuffs(ctx.dummy, n, ctx.rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
      rng: ctx.rng,
      opponent: ctx.player,
    });
  },
};

/** Wrench.gd — amp / crit on primary / secondary neighbors. */
/** @type {ScriptHandler} */
export const wrenchPort = {
  handlerId: 'wrench',
  family: 'on_hit',
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'wrench');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
    const others = (ctx.pieces || []).filter((o) =>
      links.some((l) => l.key === o.placementKey),
    );
    if (others[0]) {
      others[0].buffAmpChance = (Number(others[0].buffAmpChance) || 0) + (piece.chance || 10);
    }
    if (others[1]) {
      others[1].critChance =
        (Number(others[1].critChance) || 0) + (piece.chance2 || piece.chance || 5);
    }
    ctx.events.push({
      t: ctx.t + 0.008,
      type: 'info',
      label: `${piece.name}: amp/crit neighbors`,
      meta: { category: 'adjacency', script: true, handler: 'wrench' },
    });
  },
};

/** @type {Record<string, ScriptHandler>} */
export const WAVE_C_SCALE_PORTS = {
  onion_cutter: onionCutterPort,
  thorn_whip: thornWhipPort,
  claws_of_attack: clawsOfAttackPort,
  forest_dragon: forestDragonPort,
  ice_dragon: iceDragonPort,
  thornbloom: thornbloomPort,
  fancy_fencing_rapier: fancyFencingRapierPort,
  hungry_blade: hungryBladePort,
  war_scythe: warScythePort,
  frostbite: frostbitePort,
  cursed_dagger: cursedDaggerPort,
  wrench: wrenchPort,
};
