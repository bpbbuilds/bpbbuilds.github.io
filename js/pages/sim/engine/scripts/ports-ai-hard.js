/**
 * Band AJ — HARD gap ports (engine hooks: timed DR, battle rage, shield afterBlock).
 */

import { grantInvuln, healActor, tryUseStamina } from '../actor.js';
import {
  grantStacks,
  grantTemporaryStacks,
  onBuffChanged,
  useMana,
  DEBUFF_KEYS,
} from '../buff-economy.js';
import { getItemsInside, affectedTargets } from '../board-graph.js';
import { startBattleRage, isBattleRaging } from '../battle-rage.js';
import { getP1, getP2, getP3, getPName } from '../params.js';
import { addBonusDamageFactor, addSpeed } from '../piece-stats.js';
import { gainStacks } from '../stacks.js';
import { grantTimedResistancePct } from '../timed-resistance.js';
import { grantTimedSpeed } from '../timed-speed.js';
import { armPieceCooldown } from '../cooldown.js';
import { canBeEmpoweredPiece } from './food-helpers.js';
import { pushActivate } from './ports-util.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/** Resistor.gd — onChargeReceived → Heat if under threshold. */
/** @type {ScriptHandler} */
export const resistorPort = {
  handlerId: 'resistor',
  family: 'unique',
  onChargeReceived(piece, ctx) {
    const heatT = Math.max(
      1,
      Math.round(getPName(piece.params, 'heatt', getP1(piece.params, 20))),
    );
    const heat = Math.max(
      1,
      Math.round(getPName(piece.params, 'heat', getP2(piece.params, 3))),
    );
    const cur = Number(ctx.player.stacks.heat) || 0;
    if (cur < heatT) {
      gainStacks(ctx.player, 'heat', heat);
      ctx.events.push({
        t: ctx.t,
        type: 'buff',
        target: 'player',
        amount: heat,
        itemId: piece.itemId,
        label: `${piece.name}: +${heat} Heat (charge)`,
        meta: { category: 'buff', stack: 'heat', script: true, handler: 'resistor' },
      });
    }
  },
};

/** LeatherBoots.gd — once: low HP → Lucky/Empower/Block + consume. */
/** @type {ScriptHandler} */
export const leatherBootsPort = {
  handlerId: 'leather_boots',
  family: 'unique',
  onCombatStart(piece, ctx) {
    piece._bootsFired = false;
    const thresh =
      getPName(piece.params, 'healtht', getP1(piece.params, 70)) / 100 - 0.0001;
    ctx.bus?.on?.('player_damaged', () => {
      if (piece._bootsFired || !piece.alive) return;
      const { player } = ctx;
      if (player.maxHp <= 0) return;
      if (player.hp / player.maxHp >= thresh) return;
      piece._bootsFired = true;
      const luck = Math.max(1, Math.round(getPName(piece.params, 'luck', getP2(piece.params, 1))));
      const emp = Math.max(
        1,
        Math.round(getPName(piece.params, 'empower', getP3(piece.params, 1))),
      );
      const block = Math.max(1, Math.round(Number(piece.blockGrant) || getPName(piece.params, 'block', 15)));
      grantStacks(player, 'lucky', luck, {
        originKey: piece.placementKey,
        originId: piece.itemId,
        rng: ctx.rng,
      });
      grantStacks(player, 'empower', emp, {
        originKey: piece.placementKey,
        originId: piece.itemId,
        rng: ctx.rng,
      });
      gainStacks(player, 'block', block);
      ctx.events.push({
        t: ctx.t,
        type: 'buff',
        target: 'player',
        amount: block,
        itemId: piece.itemId,
        label: `${piece.name}: low-HP +${luck} Lucky +${emp} Empower +${block} Block`,
        meta: { category: 'buff', script: true, handler: 'leather_boots' },
      });
      piece.alive = false;
      piece.charges = 0;
    });
  },
};

/** LeatherHelm.gd — prepare crit/stun resist; preCombat timed %DR; activate(). */
/** @type {ScriptHandler} */
export const leatherHelmPort = {
  handlerId: 'leather_helm',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const chance =
      Number(ctx.itemsById.get(piece.itemId)?.chance) || Number(piece.chance) || 15;
    ctx.player.critResistance = (Number(ctx.player.critResistance) || 0) + chance;
    ctx.player.stunResistance = (Number(ctx.player.stunResistance) || 0) + chance;
    const dr = Math.max(0, getPName(piece.params, 'damagereduction', getP1(piece.params, 25)));
    const dur = Math.max(0.5, getPName(piece.params, 'dur', getP2(piece.params, 3)));
    if (dr) grantTimedResistancePct(ctx.player, dr, ctx.t + dur, 'leather_helm');
    pushActivate(piece, ctx, 'leather_helm', `Armor: ${piece.name}`);
  },
};

/** EvilCap.gd — opp heal eff; timed self %DR; buff nullify chance. */
/** @type {ScriptHandler} */
export const evilCapPort = {
  handlerId: 'evil_cap',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const healRed =
      getPName(piece.params, 'healreduction', getP3(piece.params, 30)) / 100;
    if (healRed) {
      ctx.dummy.unhealing = (Number(ctx.dummy.unhealing) || 0) + healRed;
    }
    const nullify =
      Number(ctx.itemsById.get(piece.itemId)?.chance) || Number(piece.chance) || 15;
    ctx.dummy.buffNullifyChance =
      (Number(ctx.dummy.buffNullifyChance) || 0) + nullify;
    const dr = Math.max(0, getPName(piece.params, 'damagereduction', getP1(piece.params, 25)));
    const dur = Math.max(0.5, getPName(piece.params, 'dur', getP2(piece.params, 5)));
    if (dr) grantTimedResistancePct(ctx.player, dr, ctx.t + dur, 'evil_cap');
    pushActivate(piece, ctx, 'evil_cap', `Accessory: ${piece.name}`);
  },
};

/** ShinyMantle.gd — mana → invuln; Blind on invuln start; escalating mana cost. */
/** @type {ScriptHandler} */
export const shinyMantlePort = {
  handlerId: 'shiny_mantle',
  family: 'unique',
  onCombatStart(piece, ctx) {
    piece._mantleMana = Math.max(
      1,
      Math.round(getPName(piece.params, 'manat', getPName(piece.params, 'p5', 3))),
    );
    piece._mantleUses = 0;
    // Gem gold duration factor — inventory gems not fully priced; use 0 (base dur only)
    piece._mantleGemDur = 0;
    ctx.bus?.on?.('character_invulnerable_start', (payload) => {
      if (payload?.sourceId !== piece.itemId) return;
      const blind = Math.max(
        1,
        Math.round(getPName(piece.params, 'blind', getPName(piece.params, 'p4', 3))),
      );
      gainStacks(ctx.dummy, 'blind', blind, { rng: ctx.rng, opponent: ctx.player });
      ctx.events.push({
        t: ctx.t,
        type: 'debuff',
        target: 'dummy',
        amount: blind,
        label: `${piece.name}: +${blind} Blind (invuln)`,
        meta: {
          category: 'debuff',
          stack: 'blind',
          script: true,
          handler: 'shiny_mantle',
        },
      });
    });
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, bus } = ctx;
    pushActivate(piece, ctx, 'shiny_mantle', `Armor: ${piece.name}`);
    const need = Number(piece._mantleMana) || 3;
    const maxUses = Math.max(
      1,
      Math.round(getPName(piece.params, 'max', getPName(piece.params, 'p7', 3))),
    );
    if ((Number(piece._mantleUses) || 0) >= maxUses) return true;
    if ((Number(player.stacks.mana) || 0) < need) return true;
    if (
      useMana(player, need, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      }).spent <= 0
    ) {
      return true;
    }
    const durBase = getPName(piece.params, 'dur_base', getP1(piece.params, 1));
    const durBonus = getPName(piece.params, 'dur_bonus', getP2(piece.params, 0.2));
    const invuDur = durBase + durBonus * (Number(piece._mantleGemDur) || 0);
    grantInvuln(player, invuDur, t, { bus, sourceId: piece.itemId });
    piece._mantleUses = (Number(piece._mantleUses) || 0) + 1;
    piece._mantleMana =
      need + Math.max(0, Math.round(getPName(piece.params, 'mana', getPName(piece.params, 'p6', 3))));
    events.push({
      t: t + 0.004,
      type: 'buff',
      target: 'player',
      amount: invuDur,
      label: `${piece.name}: invulnerable ${invuDur.toFixed(1)}s`,
      meta: { category: 'system', script: true, handler: 'shiny_mantle' },
    });
    if ((Number(piece._mantleUses) || 0) >= maxUses) {
      piece.alive = false;
      piece.charges = 0;
    }
    return true;
  },
};

/** WoodenBuckler.gd — Shield chance-block + afterBlock stamina drain. */
/** @type {ScriptHandler} */
export const woodenBucklerPort = {
  handlerId: 'wooden_buckler',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const chance =
      Number(ctx.itemsById.get(piece.itemId)?.chance) || Number(piece.chance) || 30;
    const damblock = Math.max(
      1,
      Math.round(getPName(piece.params, 'damblock', getP1(piece.params, 7))),
    );
    const stamDrain = getP2(piece.params, 0.3);
    if (!ctx.player._shields) ctx.player._shields = [];
    ctx.player._shields.push({
      piece,
      chance,
      damblock,
      afterBlock(payload) {
        if (!piece.alive) return;
        const drain = Math.max(0, Number(stamDrain) || 0);
        if (drain > 0) {
          tryUseStamina(ctx.player, drain);
          ctx.events.push({
            t: payload.t ?? ctx.t,
            type: 'stamina',
            label: `${piece.name}: drain ${drain} stamina (afterBlock)`,
            meta: { category: 'stamina', script: true, handler: 'wooden_buckler' },
          });
        }
        pushActivate(piece, ctx, 'wooden_buckler', `Shield: ${piece.name}`);
      },
    });
  },
};

/** ExtraAngy.gd — wait for rage end → unlock CD → restart scaled rage + consume. */
/** @type {ScriptHandler} */
export const extraAngyPort = {
  handlerId: 'extra_angy',
  family: 'unique',
  deferStartActivate: true,
  onCombatStart(piece, ctx) {
    piece._angyActivated = false;
    piece._angyRageDur = 0;
    piece._cdLocked = true;
    piece.triggerTime = 1e9;
    ctx.bus?.on?.('battle_rage_started', (payload) => {
      if (!piece._angyActivated) {
        piece._angyRageDur = Number(payload?.duration) || 0;
      }
    });
    ctx.bus?.on?.('battle_rage_ended', () => {
      if (piece._angyActivated || !piece.alive) return;
      piece._angyActivated = true;
      piece._cdLocked = false;
      armPieceCooldown(piece, ctx.player.stacks, ctx.rng);
      ctx.events.push({
        t: ctx.t,
        type: 'info',
        itemId: piece.itemId,
        label: `${piece.name}: unlocked after battle rage`,
        meta: { category: 'system', script: true, handler: 'extra_angy' },
      });
    });
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, bus } = ctx;
    pushActivate(piece, ctx, 'extra_angy', `Skill: ${piece.name}`);
    const pct = getPName(piece.params, 'dur', getP1(piece.params, 100)) / 100;
    const dur = Math.max(0.5, (Number(piece._angyRageDur) || 3) * pct);
    startBattleRage(player, dur, t, { bus, sourceId: piece.itemId });
    events.push({
      t: t + 0.004,
      type: 'buff',
      target: 'player',
      amount: dur,
      label: `${piece.name}: battle rage ${dur.toFixed(1)}s`,
      meta: { category: 'system', script: true, handler: 'extra_angy' },
    });
    piece.alive = false;
    piece.charges = 0;
    return true;
  },
};

/** Toolbox.gd — insides speed/−dmg factor; CD rage; LS while raging on foe hits. */
/** @type {ScriptHandler} */
export const toolboxPort = {
  handlerId: 'toolbox',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { t, events, graph, pieces } = ctx;
    const speedRed =
      getPName(piece.params, 'speedreduction', getPName(piece.params, 'p2', 30)) / 100;
    const damBonus =
      getPName(piece.params, 'dambonus', getPName(piece.params, 'p1', 30)) / 100;
    const inside = getItemsInside(graph, piece.placementKey);
    for (const key of inside) {
      const other = (pieces || []).find((p) => p.placementKey === key);
      if (!other || !canBeEmpoweredPiece(other)) continue;
      if (speedRed) addSpeed(other, -speedRed);
      if (damBonus) addBonusDamageFactor(other, damBonus);
    }
    const lsFrac =
      getPName(piece.params, 'lifesteal', getPName(piece.params, 'p4', 35)) / 100;
    ctx.bus?.on?.('piece_dealt_damage', (payload) => {
      if (!isBattleRaging(ctx.player, ctx.t)) return;
      const hit = payload?.hit;
      if (!hit?.hit || !(hit.healthDamage > 0)) return;
      const heal = Math.ceil(lsFrac * Number(hit.damage || hit.healthDamage || 0));
      if (heal > 0) {
        healActor(ctx.player, heal);
        events.push({
          t: ctx.t,
          type: 'heal',
          target: 'player',
          amount: heal,
          label: `${piece.name}: rage lifesteal ${heal}`,
          meta: { category: 'heal', script: true, handler: 'toolbox' },
        });
      }
    });
    events.push({
      t,
      type: 'activate',
      actor: 'player',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `Bag: ${piece.name}`,
      meta: { category: 'system', script: true, handler: 'toolbox' },
    });
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, bus } = ctx;
    pushActivate(piece, ctx, 'toolbox', `Bag: ${piece.name}`);
    const dur = Math.max(
      0.5,
      getPName(piece.params, 'dur_rage', getPName(piece.params, 'p3', 5.5)),
    );
    startBattleRage(player, dur, t, { bus, sourceId: piece.itemId });
    events.push({
      t: t + 0.004,
      type: 'buff',
      target: 'player',
      amount: dur,
      label: `${piece.name}: battle rage ${dur.toFixed(1)}s`,
      meta: { category: 'system', script: true, handler: 'toolbox' },
    });
    piece.alive = false;
    piece.charges = 0;
    return true;
  },
};

/** MrStruggles.gd — low-HP timed speed to links; debuff echo; fatigue CD. */
/** @type {ScriptHandler} */
export const mrStrugglesPort = {
  handlerId: 'mr_struggles',
  family: 'pet_like',
  onCombatStart(piece, ctx) {
    piece._struggleFired = false;
    piece._struggleDebuffN = 0;
    const thresh =
      getPName(piece.params, 'healtht', getP2(piece.params, 50)) / 100 - 0.0001;
    const speedBonus =
      getPName(piece.params, 'speedbonus', getP3(piece.params, 100)) / 100;
    const durSpeed = Math.max(
      0.5,
      getPName(piece.params, 'dur_speed', getPName(piece.params, 'p4', 8)),
    );
    ctx.bus?.on?.('player_damaged', () => {
      if (piece._struggleFired || !piece.alive) return;
      const { player } = ctx;
      if (player.maxHp <= 0 || player.hp / player.maxHp >= thresh) return;
      piece._struggleFired = true;
      const links = affectedTargets(
        ctx.graph,
        piece.placementKey,
        ctx.itemsById,
        ctx.canAffect,
      );
      for (const link of links) {
        const other = (ctx.pieces || []).find((p) => p.placementKey === link.key);
        if (!other || !(Number(other.cooldown) > 0)) continue;
        grantTimedSpeed(other, speedBonus, ctx.t + durSpeed, 'mr_struggles');
      }
      ctx.events.push({
        t: ctx.t,
        type: 'buff',
        target: 'player',
        amount: Math.round(speedBonus * 100),
        itemId: piece.itemId,
        label: `${piece.name}: haste linked items ${durSpeed}s`,
        meta: { category: 'system', script: true, handler: 'mr_struggles' },
      });
    });
    onBuffChanged(ctx.player, (ch) => {
      if (!DEBUFF_KEYS.includes(/** @type {any} */ (ch.stack))) return;
      if (ch.amount <= 0) return;
      piece._struggleDebuffN = (Number(piece._struggleDebuffN) || 0) + 1;
      if (piece._struggleDebuffN % 10 !== 0) return;
      const chance =
        Number(ctx.itemsById.get(piece.itemId)?.chance) || Number(piece.chance) || 25;
      if (ctx.rng() * 100 >= chance) return;
      grantTemporaryStacks(ctx.dummy, ch.stack, ch.amount, 3, ctx.t, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      ctx.events.push({
        t: ctx.t,
        type: 'debuff',
        target: 'dummy',
        amount: ch.amount,
        label: `${piece.name}: echo +${ch.amount} ${ch.stack}`,
        meta: {
          category: 'debuff',
          stack: ch.stack,
          script: true,
          handler: 'mr_struggles',
        },
      });
    });
  },
  onCooldownEffect(piece, ctx) {
    const { t, dummy, events } = ctx;
    pushActivate(piece, ctx, 'mr_struggles', `Pet: ${piece.name}`);
    const dam = Math.max(
      1,
      Math.round(getPName(piece.params, 'fatigue', getP1(piece.params, 1))),
    );
    dummy.hp = Math.max(0, dummy.hp - dam);
    events.push({
      t: t + 0.004,
      type: 'damage',
      target: 'dummy',
      amount: dam,
      label: `${piece.name}: ${dam} fatigue`,
      meta: { category: 'damage', script: true, handler: 'mr_struggles' },
    });
    return true;
  },
};

/** @type {Record<string, ScriptHandler>} */
export const AI_HARD_PORTS = {
  resistor: resistorPort,
  leather_boots: leatherBootsPort,
  leather_helm: leatherHelmPort,
  evil_cap: evilCapPort,
  shiny_mantle: shinyMantlePort,
  wooden_buckler: woodenBucklerPort,
  extra_angy: extraAngyPort,
  toolbox: toolboxPort,
  mr_struggles: mrStrugglesPort,
};
