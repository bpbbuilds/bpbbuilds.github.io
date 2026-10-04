/**
 * Band Y Phase 139 — heal / onBuffsChanged thresholds (Toad siblings).
 */

import { PLAYER_MAX_STAMINA, PLAYER_STAMINA_REGEN, tryUseStamina, gainMaxStaminaTemporary, grantStun } from '../actor.js';
import { applyStaminaRegeneration, applyUnhealing } from '../actor-stats.js';
import {
  advanceBuffThresholds,
  giveAllBuffs,
  grantStacks,
  onBuffChanged,
  stealRandomBuff,
} from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getP3, getP4, getPName } from '../params.js';
import { addSpeed, multiplyStaminaCost } from '../piece-stats.js';
import { gainStacks, loseStacks } from '../stacks.js';
import { getScriptHandler } from './registry.js';
import { itemHasType, afterEffectFinished, pushActivate, pushBuffGrants } from './ports-util.js';
import { eventSideForPiece } from '../vs-board.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/** @type {ScriptHandler} */
export const angelCrystalPort = {
  handlerId: 'angel_crystal',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { t, player, events, graph, itemsById, canAffect } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    const regen =
      Math.max(1, Math.round(getPName(piece.params, 'regen', getP1(piece.params, 2)))) +
      links.length *
        Math.max(0, Math.round(getPName(piece.params, 'regen2', 1)));
    grantStacks(player, 'regeneration', regen, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    events.push({
      t,
      type: 'buff',
      target: 'player',
      amount: regen,
      label: `${piece.name}: +${regen} Regen`,
      meta: { category: 'buff', stack: 'regeneration', script: true, handler: 'angel_crystal' },
    });
    const maxPer = Math.max(
      0,
      Math.round(getPName(piece.params, 'maxhealth', getP2(piece.params, 2))),
    );
    onBuffChanged(player, (ch) => {
      if (ch.stack !== 'regeneration' || ch.amount <= 0) return;
      if (maxPer <= 0) return;
      const hp = ch.amount * maxPer;
      player.maxHp += hp;
      player.hp = Math.min(player.maxHp, player.hp + hp);
    });
    pushActivate(piece, ctx, 'angel_crystal', `Accessory: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, graph, itemsById, canAffect } = ctx;
    pushActivate(piece, ctx, 'angel_crystal', `Accessory: ${piece.name}`);
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    const emp =
      Math.max(1, Math.round(getPName(piece.params, 'empower', getP3(piece.params, 1)))) +
      links.length * Math.max(0, Math.round(getPName(piece.params, 'empower2', 0)));
    grantStacks(player, 'empower', emp, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    events.push({
      t: t + 0.004,
      type: 'buff',
      target: 'player',
      amount: emp,
      label: `${piece.name}: +${emp} Empower`,
      meta: { category: 'buff', stack: 'empower', script: true, handler: 'angel_crystal' },
    });
    afterEffectFinished(piece, ctx, 'angel_crystal', { activate: false });
    return true;
  },
};

/** @type {ScriptHandler} */
export const bloodManipulationPort = {
  handlerId: 'blood_manipulation',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { graph, itemsById, canAffect, player } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect).filter(
      (link) => itemHasType(itemsById.get(link.id), 'vampiric'),
    );
    const speed = getPName(piece.params, 'speed', getP1(piece.params, 5)) / 100;
    if (links.length && speed) addSpeed(piece, links.length * speed);
    const unhealing = Number(getPName(piece.params, 'unhealing', 0)) || 0;
    if (unhealing) {
      applyUnhealing(player, unhealing / 100, ctx, piece);
    }
  },
  onCooldownEffect(piece, ctx) {
    const { t, player } = ctx;
    pushActivate(piece, ctx, 'blood_manipulation', `Skill: ${piece.name}`);
    const vamp = Math.max(0, Math.round(getPName(piece.params, 'vampirism', getP2(piece.params, 1))));
    // grantStacks already combat-logs; do not also push a buff (same Lovers double-line bug).
    // Pass fireT — getT() is step-end and was duplicating ~+0.04s with the old manual push.
    grantStacks(player, 'vampirism', vamp, {
      originKey: piece.placementKey,
      originId: piece.itemId,
      t,
    });
    return true;
  },
};

/** Power of the Moon — peer activate → maxHP / buff (approx CD grant). */
/** @type {ScriptHandler} */
export const powerOfTheMoonPort = {
  handlerId: 'power_of_the_moon',
  family: 'unique',
  onPostCombatStart(piece, ctx) {
    const seconds = Math.max(0, getPName(piece.params, 'time', getP1(piece.params, 6)));
    ctx.fatigue?.advanceTime?.(seconds);
  },
  onPrepare(piece, ctx) {
    // PoweroftheMoon.gd connects only to the affected Moon Armor/Shield
    // instances during Item.prepare. Snapshot those keys so a later board
    // mutation cannot make an unrelated item trigger this listener.
    const links = affectedTargets(
      ctx.graph,
      piece.placementKey,
      ctx.itemsById,
      ctx.canAffect,
    );
    piece._moonLinkedKeys = new Set(links.map((link) => link.key));
  },
  onCombatStart(piece, ctx) {
    // Band Z 150 — listen for fatigue via combat bus
    ctx.bus?.on?.('fatigue_start', (payload) => {
      const pct = Math.max(
        0,
        getPName(piece.params, 'maxhealth', getP3(piece.params, 70)),
      ) / 100;
      const hp = Math.round(ctx.player.maxHp * pct);
      if (!(hp > 0)) return;
      ctx.player.maxHp += hp;
      ctx.player.hp = Math.min(ctx.player.maxHp, ctx.player.hp + hp);
      const side = eventSideForPiece(piece);
      ctx.events.push({
        t: payload?.t ?? ctx.t,
        type: 'heal',
        actor: side,
        target: side,
        amount: hp,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +${hp} max HP (fatigue)`,
        meta: {
          category: 'heal',
          script: true,
          handler: 'power_of_the_moon',
          kind: 'temp_max_hp',
          fatigue: true,
        },
      });
    });
  },
  onPeerActivated(listener, activated, ctx) {
    if (
      listener._moonLinkedKeys instanceof Set &&
      !listener._moonLinkedKeys.has(activated?.placementKey)
    ) {
      return;
    }
    const activatedId = String(activated?.itemId || '');
    const origin = {
      originKey: listener.placementKey,
      originId: listener.itemId,
      t: ctx.t,
      rng: ctx.rng,
      opponent: ctx.player,
    };
    if (activatedId === 'moon_armor') {
      const blind = Math.max(
        0,
        Math.round(getPName(listener.params, 'blind', getP2(listener.params, 2))),
      );
      if (blind > 0) grantStacks(ctx.dummy, 'blind', blind, origin);
      return;
    }
    if (activatedId === 'moon_shield') {
      const reflect = Math.max(0, Math.round(getPName(listener.params, 'reflect', 1)));
      if (reflect > 0) {
        ctx.player.debuffReflectStacks =
          (Number(ctx.player.debuffReflectStacks) || 0) + reflect;
      }
    }
  },
};

/** Sloth.gd — prepare slow CD neighbors; start maxHP; CD awaken buffs+stun then consume. */
/** @type {ScriptHandler} */
export const slothPort = {
  handlerId: 'sloth',
  family: 'pet_like',
  onPreCombatStart(piece, ctx) {
    // Sloth.gd onPrepare: reduceSpeed on hasCooldown neighbors
    const slow = getPName(piece.params, 'speed', getP1(piece.params, 30)) / 100;
    if (!slow) return;
    const links = affectedTargets(
      ctx.graph,
      piece.placementKey,
      ctx.itemsById,
      ctx.canAffect,
    );
    for (const link of links) {
      const other = (ctx.pieces || []).find((p) => p.placementKey === link.key);
      if (other) addSpeed(other, -slow);
    }
  },
  onCombatStart(piece, ctx) {
    const { t, player, events, graph, itemsById, canAffect } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    const basePct = getPName(piece.params, 'maxhealth_base', getP2(piece.params, 10));
    const perPct = getPName(piece.params, 'maxhealth_item', getP3(piece.params, 15));
    const pct = (basePct + links.length * perPct) / 100;
    const hp = Math.max(1, Math.round(player.maxHp * pct));
    player.maxHp += hp;
    player.hp = Math.min(player.maxHp, player.hp + hp);
    events.push({
      t,
      type: 'heal',
      target: 'player',
      amount: hp,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: +${hp} max HP`,
      meta: { category: 'heal', script: true, handler: 'sloth', kind: 'temp_max_hp' },
    });
    // Game activate() — starts the awaken CD bar
    pushActivate(piece, ctx, 'sloth', `Pet: ${piece.name}`);
    // trigger() always sets awakenNow before doCooldownEffect in-game
    piece._slothAwaken = true;
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, dummy, events } = ctx;
    pushActivate(piece, ctx, 'sloth', `Pet: ${piece.name}`);
    const awaken = piece._slothAwaken !== false;
    piece._slothAwaken = false;
    if (awaken) {
      // Awaken: giveAllBuffs(buffs) + stun opponent + consume
      const n = Math.max(
        1,
        Math.round(getPName(piece.params, 'buffs', getP4(piece.params, 10))),
      );
      const picked = giveAllBuffs(player, n, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      pushBuffGrants(events, piece, player, t, 'sloth', picked);
      grantStun(
        dummy,
        Math.max(0.05, getPName(piece.params, 'dur_stun', getPName(piece.params, 'p6', 1.5))),
        t,
      );
      afterEffectFinished(piece, ctx, 'sloth', { activate: false });
    } else {
      // Amulet / non-trigger path: smaller buffs + short stun, keep looping
      const n = Math.max(
        1,
        Math.round(
          getPName(piece.params, 'buffs_amulet', getPName(piece.params, 'p5', 1)),
        ),
      );
      const picked = giveAllBuffs(player, n, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      pushBuffGrants(events, piece, player, t, 'sloth', picked);
      grantStun(
        dummy,
        Math.max(
          0.05,
          getPName(piece.params, 'dur_stun_amulet', getPName(piece.params, 'p7', 0.5)),
        ),
        t,
      );
    }
    return true;
  },
};

function bionicAccHealOrBlock(piece, ctx, amount) {
  if (!(amount > 0)) return;
  const { player, events } = ctx;
  const healthTh = Math.max(
    1,
    Math.round(getPName(piece.params, 'healtht', getPName(piece.params, 'p4', 10))),
  );
  const stamPer = Number(getPName(piece.params, 'maxstamina', getPName(piece.params, 'p3', 0.2))) || 0;
  if (!stamPer) return;
  piece._bionicAcc = (piece._bionicAcc || 0) + amount;
  const procs = Math.floor(piece._bionicAcc / healthTh);
  if (procs <= 0) return;
  piece._bionicAcc -= procs * healthTh;
  const gain = stamPer * procs;
  gainMaxStaminaTemporary(player, gain, { filled: true });
  events.push({
    t: ctx.t,
    type: 'info',
    label: `${piece.name}: +${gain} temp max stamina`,
    meta: { category: 'system', script: true, handler: 'bionic_armor' },
  });
  pushActivate(piece, ctx, 'bionic_armor', `Armor: ${piece.name}`);
}

/** @type {ScriptHandler} */
export const bionicArmorPort = {
  handlerId: 'bionic_armor',
  family: 'unique',
  onPreCombatStart(piece, ctx) {
    const { player } = ctx;
    piece._bionicAcc = 0;
    const malusPct =
      Math.abs(getPName(piece.params, 'staminaregen', getPName(piece.params, 'p1', 100))) / 100;
    if (malusPct > 0) {
      applyStaminaRegeneration(
        player,
        -malusPct * PLAYER_STAMINA_REGEN,
        ctx,
        piece,
      );
    }
    onBuffChanged(player, (ch) => {
      if (ch.stack !== 'block' || !(ch.amount > 0)) return;
      bionicAccHealOrBlock(piece, ctx, ch.amount);
    });
    player._combatBus?.on?.('actor_healed', (payload) => {
      if (payload?.actor !== player || !(payload?.amount > 0)) return;
      bionicAccHealOrBlock(piece, ctx, payload.amount);
    });
  },
  onCombatStart(piece, ctx) {
    const { t, player, events } = ctx;
    const block = Math.max(
      0,
      Math.round(
        piece.blockGrant ??
          Number(ctx.itemsById?.get?.(piece.itemId)?.block) ??
          100,
      ),
    );
    if (block > 0) {
      grantStacks(player, 'block', block, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      events.push({
        t,
        type: 'buff',
        target: 'player',
        amount: block,
        label: `${piece.name}: +${block} Block`,
        meta: { category: 'buff', stack: 'block', script: true, handler: 'bionic_armor' },
      });
    }
    pushActivate(piece, ctx, 'bionic_armor', `Armor: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    pushActivate(piece, ctx, 'bionic_armor', `Armor: ${piece.name}`);
    const th = Math.max(
      1,
      Math.round(getPName(piece.params, 'staminat1', getPName(piece.params, 'staminat', getP2(piece.params, 5)))),
    );
    if ((Number(player.stamina) || 0) < th) {
      const block2 = Math.max(
        1,
        Math.round(getPName(piece.params, 'block', getPName(piece.params, 'p5', 30))),
      );
      grantStacks(player, 'block', block2, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      events.push({
        t: t + 0.004,
        type: 'buff',
        target: 'player',
        amount: block2,
        label: `${piece.name}: +${block2} Block`,
        meta: { category: 'buff', stack: 'block', script: true, handler: 'bionic_armor' },
      });
    } else {
      const used = Math.max(
        1,
        Math.round(getPName(piece.params, 'staminat2', getPName(piece.params, 'stamina', 2))),
      );
      tryUseStamina(player, used);
      const emp = Math.max(1, Math.round(getPName(piece.params, 'empower', 1)));
      grantStacks(player, 'empower', emp, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      events.push({
        t: t + 0.004,
        type: 'buff',
        target: 'player',
        amount: emp,
        label: `${piece.name}: +${emp} Empower`,
        meta: { category: 'buff', stack: 'empower', script: true, handler: 'bionic_armor' },
      });
    }
    return true;
  },
};

/** @type {ScriptHandler} */
export const stoneArmorPort = {
  handlerId: 'stone_armor',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { t, player, events, pieces } = ctx;
    // StoneArmor.gd onPrepare: changeStaminaFactor(staminacost) on all items
    const stamPct = getPName(piece.params, 'staminacost', getPName(piece.params, 'stamina', 20)) / 100;
    if (stamPct) {
      for (const other of pieces || []) {
        if (other.placementKey === piece.placementKey) continue;
        const base = Number(other.staminaCost) || 0;
        if (!base) continue;
        multiplyStaminaCost(other, stamPct);
      }
    }
    piece._stoneArmorTriggered = false;
    const healthTh =
      getPName(piece.params, 'healtht', getPName(piece.params, 'p4', 50)) / 100;
    const blockPer =
      getPName(piece.params, 'blockperhealth', getPName(piece.params, 'p5', 50)) / 100;
    ctx.bus?.on?.('player_damaged', (payload) => {
      if (piece._stoneArmorTriggered || !payload?.hit) return;
      const rel = player.maxHp > 0 ? player.hp / player.maxHp : 1;
      if (rel >= healthTh) return;
      piece._stoneArmorTriggered = true;
      const missing = Math.max(0, (Number(player.maxHp) || 0) - (Number(player.hp) || 0));
      const bl = Math.max(1, Math.round(missing * blockPer));
      grantStacks(player, 'block', bl, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      events.push({
        t: payload?.t ?? ctx.t,
        type: 'buff',
        target: 'player',
        amount: bl,
        label: `${piece.name}: low HP +${bl} Block`,
        meta: { category: 'buff', stack: 'block', script: true, handler: 'stone_armor' },
      });
    });
    const block = Math.max(1, Math.round(piece.blockGrant || getP1(piece.params, 12)));
    grantStacks(player, 'block', block, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    events.push({
      t,
      type: 'buff',
      target: 'player',
      amount: block,
      label: `${piece.name}: +${block} Block`,
      meta: { category: 'buff', stack: 'block', script: true, handler: 'stone_armor' },
    });
  },
  onCooldownEffect(piece, ctx) {
    const { t, dummy, events } = ctx;
    pushActivate(piece, ctx, 'stone_armor', `Armor: ${piece.name}`);
    const spikeRem = Math.max(
      1,
      Math.round(getPName(piece.params, 'spikes', getP2(piece.params, 1))),
    );
    const empRem = Math.max(
      1,
      Math.round(getPName(piece.params, 'empower', getP3(piece.params, 1))),
    );
    loseStacks(dummy, 'spikes', Math.min(spikeRem, Number(dummy.stacks.spikes) || 0));
    loseStacks(dummy, 'empower', Math.min(empRem, Number(dummy.stacks.empower) || 0));
    events.push({
      t: t + 0.004,
      type: 'info',
      label: `${piece.name}: strip spikes/empower`,
      meta: { category: 'system', script: true, handler: 'stone_armor' },
    });
    return true;
  },
};

/**
 * Item.healthToBlock(health, block) — spend up to `health` HP (leave 1),
 * grant ceil((spent/health)*block) Block.
 * @param {import('../actor.js').SimActor} player
 * @param {number} healthCap
 * @param {number} blockCap
 */
function healthToBlock(player, healthCap, blockCap) {
  const want = Math.max(0, Number(healthCap) || 0);
  const blockWant = Math.max(0, Number(blockCap) || 0);
  if (!(want > 0) || !(blockWant > 0)) return { spent: 0, block: 0 };
  const clamped = Math.min(want, Math.max(0, (Number(player.hp) || 0) - 1));
  if (!(clamped > 0)) return { spent: 0, block: 0 };
  player.hp = Math.max(1, (Number(player.hp) || 0) - clamped);
  const block = Math.max(1, Math.ceil((clamped / want) * blockWant));
  grantStacks(player, 'block', block);
  return { spent: clamped, block };
}

/** VampiricArmor.gd */
/** @type {ScriptHandler} */
export const vampiricArmorPort = {
  handlerId: 'vampiric_armor',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { t, player, events, itemsById } = ctx;
    const healthCap = Math.max(1, Math.round(getPName(piece.params, 'healtht', getP1(piece.params, 50))));
    const blockCap = Math.max(
      1,
      Math.round(
        Number(piece.blockGrant) ||
          Number(itemsById?.get?.(piece.itemId)?.block) ||
          100,
      ),
    );
    const { spent, block } = healthToBlock(player, healthCap, blockCap);
    const vamp = Math.max(
      1,
      Math.round(getPName(piece.params, 'vampirism', getP2(piece.params, 5))),
    );
    grantStacks(player, 'vampirism', vamp, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushActivate(piece, ctx, 'vampiric_armor', `Armor: ${piece.name}`);
    events.push({
      t,
      type: 'buff',
      target: 'player',
      amount: block,
      label: `${piece.name}: HP→Block ${spent}→+${block}, +${vamp} Vamp`,
      meta: {
        category: 'buff',
        stack: 'block',
        script: true,
        handler: 'vampiric_armor',
        healthSpent: spent,
      },
    });
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    pushActivate(piece, ctx, 'vampiric_armor', `Armor: ${piece.name}`);
    const healthCap = Math.max(1, Math.round(getP3(piece.params, 10)));
    const blockCap = Math.max(1, Math.round(getP4(piece.params, 20)));
    const { spent, block } = healthToBlock(player, healthCap, blockCap);
    if (block > 0) {
      events.push({
        t: t + 0.004,
        type: 'buff',
        target: 'player',
        amount: block,
        label: `${piece.name}: HP→Block ${spent}→+${block}`,
        meta: {
          category: 'buff',
          stack: 'block',
          script: true,
          handler: 'vampiric_armor',
          healthSpent: spent,
        },
      });
    }
    return true;
  },
};

/** @type {ScriptHandler} */
export const heartOfDarknessPort = {
  handlerId: 'heart_of_darkness',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { graph, itemsById, canAffect, player } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    const speed = getPName(piece.params, 'darkspeed', getP1(piece.params, 5)) / 100;
    if (links.length && speed) addSpeed(piece, links.length * speed);
    piece._hodState = { gained: 0, used: 0 };
    const th = Math.max(1, Math.round(getPName(piece.params, 'regent', getP2(piece.params, 10))));
    onBuffChanged(player, (ch) => {
      if (ch.stack !== 'regeneration') return;
      advanceBuffThresholds(piece._hodState, ch.amount, th, th);
    });
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, dummy, events, rng } = ctx;
    pushActivate(piece, ctx, 'heart_of_darkness', `Accessory: ${piece.name}`);
    const num = Math.max(1, Math.round(getPName(piece.params, 'steal', getP3(piece.params, 1))));
    const stolen = stealRandomBuff(dummy, player, num, rng, {
      availableBuffs: [
        'lucky',
        'vampirism',
        'spikes',
        'mana',
        'empower',
        'heat',
      ],
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(events, piece, player, t, 'heart_of_darkness', stolen);
    return true;
  },
};

/** Piggybank.gd — giveMaxHealth(maxhealth × getNumAffectedItems()); consume. */
function piggybankStartOfBattleCount(graph, piece, itemsById, canAffect) {
  const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect).filter(
    (link) => link.via === 'rule',
  );
  if (canAffect?.rulesById) return links.length;
  return links.filter((link) => {
    const handler = getScriptHandler(link.id);
    return Boolean(handler?.onCombatStart && !handler?.onCooldownEffect);
  }).length;
}

export const piggybankPort = {
  handlerId: 'piggybank',
  family: 'start_buff',
  onCombatStart(piece, ctx) {
    const { graph, itemsById, canAffect, player, t, events } = ctx;
    pushActivate(piece, ctx, 'piggybank', `Accessory: ${piece.name}`);
    const per = Math.round(getPName(piece.params, 'maxhealth', getP2(piece.params, 2)));
    const n = piggybankStartOfBattleCount(graph, piece, itemsById, canAffect);
    const gain = Math.max(0, Math.round(per * n));
    const side = eventSideForPiece(piece);
    if (gain > 0) {
      player.maxHp += gain;
      player.hp += gain;
      events.push({
        t,
        type: 'heal',
        actor: side,
        target: side,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        amount: gain,
        label: `${piece.name}: +${gain} max HP (${per}×${n} start-of-battle)`,
        meta: {
          category: 'heal',
          script: true,
          handler: 'piggybank',
          kind: 'maxHp',
          consumed: true,
          playerHp: player.hp,
          affected: n,
        },
      });
    } else {
      events.push({
        t: t + 0.001,
        type: 'info',
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: 0 start-of-battle items in range`,
        meta: {
          category: 'adjacency',
          script: true,
          handler: 'piggybank',
          zeroGain: true,
          affected: 0,
        },
      });
    }
    piece.alive = false;
    piece.charges = 0;
  },
};

/** @type {Record<string, ScriptHandler>} */
export const THRESHOLD_PORTS = {
  angel_crystal: angelCrystalPort,
  blood_manipulation: bloodManipulationPort,
  piggybank: piggybankPort,
  power_of_the_moon: powerOfTheMoonPort,
  sloth: slothPort,
  bionic_armor: bionicArmorPort,
  stone_armor: stoneArmorPort,
  vampiric_armor: vampiricArmorPort,
  heart_of_darkness: heartOfDarknessPort,
};
