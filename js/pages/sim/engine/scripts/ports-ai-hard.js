/**
 * Band AJ — HARD gap ports (engine hooks: timed DR, battle rage, shield afterBlock).
 */

import { drainStamina, grantInvuln, healActor, isInvulnerable } from '../actor.js';
import { applyHealEfficiency } from '../actor-stats.js';
import { takeDamage } from '../damage.js';
import {
  grantStacks,
  grantTemporaryStacks,
  onBuffChanged,
  useMana,
  DEBUFF_KEYS,
} from '../buff-economy.js';
import { getItemsInside, affectedTargets } from '../board-graph.js';
import { startBattleRage, isBattleRaging } from '../battle-rage.js';
import { getP1, getP2, getP3, getP4, getPName } from '../params.js';
import { modifiedParamValue } from '../placement-instance.js';
import { addBonusDamageFactor, addSpeed } from '../piece-stats.js';
import { gainStacks, getStackAmount } from '../stacks.js';
import { grantTimedResistancePct } from '../timed-resistance.js';
import { grantTimedSpeed } from '../timed-speed.js';
import { armPieceCooldown, deactivateCooldown } from '../cooldown.js';
import { PRIORITY } from '../combat-start-priority.js';
import { canBeEmpoweredPiece } from './food-helpers.js';
import {
  afterEffectFinished,
  itemHasType,
  pieceHasCombatCooldown,
  pushActivate,
} from './ports-util.js';
import { eventSideForPiece } from '../vs-board.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/** Resistor.gd — onChargeReceived → Heat if under threshold. */
/** @type {ScriptHandler} */
export const resistorPort = {
  handlerId: 'resistor',
  family: 'unique',
  onChargeReceived(piece, ctx) {
    const heatT = Math.trunc(getPName(piece.params, 'heatt', getP1(piece.params, 0)));
    const heat = Math.trunc(getPName(piece.params, 'heat', getP2(piece.params, 0)));
    const cur = getStackAmount(ctx.player, 'heat');
    if (cur < heatT) {
      const result = gainStacks(ctx.player, 'heat', heat, {
        originKey: piece.placementKey,
        originId: piece.itemId,
        rng: ctx.rng,
      });
      if (result.gained > 0) {
        ctx.events.push({
          t: ctx.t,
          type: 'buff',
          target: eventSideForPiece(piece),
          actor: eventSideForPiece(piece),
          amount: result.gained,
          itemId: piece.itemId,
          label: `${piece.name}: +${result.gained} Heat (charge)`,
          meta: {
            category: 'buff',
            stack: 'heat',
            script: true,
            handler: 'resistor',
            source: 'resistor_charge',
          },
        });
      }
      // Item.miniActivate() is VFX-only: retain the projection without a
      // normal `activate` event, which would inflate Activations metrics.
      ctx.events.push({
        t: ctx.t,
        type: 'info',
        actor: eventSideForPiece(piece),
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: mini activate`,
        meta: {
          category: 'system',
          script: true,
          handler: 'resistor',
          phase: 'charge_received',
          miniActivate: true,
        },
      });
    }
  },
};

/** LeatherBoots.gd — once: low HP → Lucky/Empower/Block + consume. */
/** @type {ScriptHandler} */
export const leatherBootsPort = {
  handlerId: 'leather_boots',
  family: 'unique',
  // LeatherBoots.gd connects during onPrepare, before Dark Lantern and other
  // start-of-battle self-damage can cross the threshold.
  onPrepare(piece, ctx) {
    piece._bootsFired = false;
    const thresh =
      getP1(piece.params, 70) / 100 - 0.0001;
    ctx.bus?.on?.('character_damaged', (payload) => {
      if (payload?.actor && payload.actor !== ctx.player) return;
      if (piece._bootsFired || !piece.alive) return;
      const { player } = ctx;
      if (player.maxHp <= 0) return;
      if (player.hp / player.maxHp >= thresh) return;
      piece._bootsFired = true;
      const luck = getP2(piece.params, 0);
      const emp = getP3(piece.params, 0);
      const catalogBlock = Number(ctx.itemsById.get(piece.itemId)?.block);
      const block = Number.isFinite(Number(piece.blockGrant))
        ? Number(piece.blockGrant)
        : (Number.isFinite(catalogBlock) ? catalogBlock : 0);
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
        t: payload?.t ?? ctx.t,
        type: 'buff',
        target: 'player',
        amount: block,
        itemId: piece.itemId,
        label: `${piece.name}: low-HP +${luck} Lucky +${emp} Empower +${block} Block`,
        meta: { category: 'buff', script: true, handler: 'leather_boots' },
      });
      piece.alive = false;
      piece.charges = 0;
    }, PRIORITY.High + 2);
  },
};

/** LeatherHelm.gd — prepare crit/stun resist; preCombat timed %DR; activate(). */
/** @type {ScriptHandler} */
export const leatherHelmPort = {
  handlerId: 'leather_helm',
  family: 'unique',
  onPrepare(piece, ctx) {
    piece._helmBuffsActive = 0;
    const catalogChance = Number(ctx.itemsById.get(piece.itemId)?.chance);
    const chance = Number.isFinite(catalogChance)
      ? catalogChance
      : (Number.isFinite(Number(piece.chance)) ? Number(piece.chance) : 0);
    ctx.player.critResistance = (Number(ctx.player.critResistance) || 0) + chance;
    ctx.player.stunResistance = (Number(ctx.player.stunResistance) || 0) + chance;
  },
  onPreCombatStart(piece, ctx) {
    const dr = getP1(piece.params, 0);
    const dur = getPName(piece.params, 'dur', getP2(piece.params, 0));
    piece._helmBuffsActive = (Number(piece._helmBuffsActive) || 0) + 1;
    piece.state = piece._helmBuffsActive;
    const tag = `leather_helm:${piece.placementKey || piece.itemId}`;
    if (dr && dur > 0) {
      grantTimedResistancePct(ctx.player, dr, (Number(ctx.t) || 0) + dur, tag);
      const previous = ctx.player._onTimedResistEnd;
      ctx.player._onTimedResistEnd = (endedTag, entry) => {
        previous?.(endedTag, entry);
        if (endedTag !== tag) return;
        piece._helmBuffsActive = Math.max(0, (Number(piece._helmBuffsActive) || 1) - 1);
        piece.state = piece._helmBuffsActive;
      };
    }
  },
  onCombatStart(piece, ctx) {
    pushActivate(piece, ctx, 'leather_helm', `Armor: ${piece.name}`);
  },
};

/** EvilCap.gd — opp heal eff; timed self %DR; buff nullify chance. */
/** @type {ScriptHandler} */
export const evilCapPort = {
  handlerId: 'evil_cap',
  family: 'unique',
  onPrepare(piece, ctx) {
    piece._evilNullifyApplied = false;
    const healRed =
      getPName(piece.params, 'healreduction', getP3(piece.params, 30)) / 100;
    if (healRed) {
      applyHealEfficiency(ctx.dummy, -healRed, ctx, {
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        name: piece.name,
      });
    }
  },
  onPreCombatStart(piece, ctx) {
    const dr = getPName(
      piece.params,
      'damagereduction',
      getP1(piece.params, 25),
    );
    const dur = getPName(piece.params, 'dur', getP2(piece.params, 5));
    const tag = `evil_cap:${piece.placementKey || piece.itemId}`;
    piece._evilResistTag = tag;
    if (!dr) return;
    const actor = ctx.player;
    const priorEnd = actor._onTimedResistEnd;
    actor._onTimedResistEnd = (endedTag, entry) => {
      priorEnd?.(endedTag, entry);
      if (endedTag !== tag) return;
      piece._evilBuffsActive = Math.max(0, (Number(piece._evilBuffsActive) || 0) - 1);
      piece._evilParticlesActive = piece._evilBuffsActive > 0;
    };
    grantTimedResistancePct(actor, dr, (Number(ctx.t) || 0) + dur, tag);
  },
  onCombatStart(piece, ctx) {
    if (!piece._evilNullifyApplied) {
      piece._evilNullifyApplied = true;
      const rawChance = piece.chance ?? ctx.itemsById?.get?.(piece.itemId)?.chance;
      const chance = rawChance == null || !Number.isFinite(Number(rawChance))
        ? 15
        : Number(rawChance);
      ctx.dummy.buffNullifyChance =
        (Number(ctx.dummy.buffNullifyChance) || 0) + chance;
    }
    piece._evilBuffsActive = (Number(piece._evilBuffsActive) || 0) + 1;
    piece._evilParticlesActive = true;
    pushActivate(piece, ctx, 'evil_cap', `Helmet: ${piece.name}`);
  },
};

/** ShinyMantle.gd — mana → invuln; Blind on invuln start; escalating mana cost. */
/** @type {ScriptHandler} */
function shinyMantleGemDurationFactor(piece, ctx) {
  const gold = getPName(piece.params, 'gold', getP3(piece.params, 10));
  if (!(gold > 0)) return 0;
  let value = 0;
  for (const other of ctx.pieces || []) {
    const item = ctx.itemsById?.get?.(other.itemId);
    if (itemHasType(item, 'gem')) value += Number(item?.cost) || 0;
    for (const gemId of other.gemIds || []) {
      value += Number(ctx.itemsById?.get?.(gemId)?.cost) || 0;
    }
  }
  return Math.floor(value / gold);
}

export const shinyMantlePort = {
  handlerId: 'shiny_mantle',
  family: 'unique',
  onPrepare(piece, ctx) {
    piece._mantleMana = Math.trunc(
      getPName(piece.params, 'manat', getPName(piece.params, 'p5', 3)),
    );
    piece._mantleManaIncrease = Math.trunc(
      getPName(piece.params, 'mana', getPName(piece.params, 'p6', 3)),
    );
    piece._mantleBlind = Math.trunc(
      getPName(piece.params, 'blind', getPName(piece.params, 'p4', 3)),
    );
    piece._mantleMaxUses = Math.trunc(
      getPName(piece.params, 'max', getPName(piece.params, 'p7', 3)),
    );
    piece._mantleUses = 0;
    // ShinyMantle.getCounterValue() / gold: sum the catalog value of gem counters.
    piece._mantleGemDur = shinyMantleGemDurationFactor(piece, ctx);
    piece._mantleCtx = ctx;
    ctx.bus?.on?.('character_invulnerable_start', (payload) => {
      if (payload?.sourceId !== piece.itemId) return;
      const eventCtx = piece._mantleCtx || ctx;
      const blind = Number(piece._mantleBlind) || 0;
      if (!(blind > 0)) return;
      const result = gainStacks(eventCtx.dummy, 'blind', blind, {
        rng: eventCtx.rng,
        opponent: eventCtx.player,
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      if (!(result.gained > 0)) return;
      eventCtx.events.push({
        t: Number(payload.t) || eventCtx.t,
        type: 'debuff',
        target: 'dummy',
        amount: result.gained,
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
    const need = Number.isFinite(Number(piece._mantleMana))
      ? Number(piece._mantleMana)
      : Math.trunc(getPName(piece.params, 'manat', getPName(piece.params, 'p5', 3)));
    const maxUses = Number.isFinite(Number(piece._mantleMaxUses))
      ? Number(piece._mantleMaxUses)
      : Math.trunc(getPName(piece.params, 'max', getPName(piece.params, 'p7', 3)));
    piece._activationLogged = true;
    if (!isInvulnerable(player, t) && (Number(player.stacks.mana) || 0) >= need) {
      const spent = useMana(player, need, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      }).spent;
      if (spent <= 0) return true;
      const durBase = getPName(piece.params, 'dur_base', getP1(piece.params, 1));
      const durBonus = getPName(piece.params, 'dur_bonus', getP2(piece.params, 0.2));
      const invuDur = durBase + durBonus * (Number(piece._mantleGemDur) || 0);
      grantInvuln(player, invuDur, t, {
        bus,
        sourceId: piece.itemId,
        sourceKey: piece.placementKey,
      });
      piece._mantleUses = (Number(piece._mantleUses) || 0) + 1;
      piece._mantleMana = need + (Number(piece._mantleManaIncrease) || 0);
      events.push({
        t: t + 0.004,
        type: 'buff',
        target: 'player',
        amount: invuDur,
        label: `${piece.name}: invulnerable ${invuDur.toFixed(1)}s`,
        meta: { category: 'system', script: true, handler: 'shiny_mantle' },
      });
      if ((Number(piece._mantleUses) || 0) === maxUses) {
        afterEffectFinished(piece, ctx, 'shiny_mantle', { label: `Armor: ${piece.name}` });
      } else {
        pushActivate(piece, ctx, 'shiny_mantle', `Armor: ${piece.name}`);
      }
    }
    return true;
  },
};

/** WoodenBuckler.gd — Shield chance-block + afterBlock stamina drain. */
/** @type {ScriptHandler} */
export const woodenBucklerPort = {
  handlerId: 'wooden_buckler',
  family: 'unique',
  onPrepare(piece, ctx) {
    const catalog = ctx.itemsById.get(piece.itemId);
    const chanceValue = piece.chance != null ? piece.chance : catalog?.chance;
    const baseChance = Number(chanceValue);
    const fallbackChance = Number.isFinite(baseChance) ? baseChance : 30;
    const stamDrain = getP2(piece.params, 0.3);
    if (!ctx.player._shields) ctx.player._shields = [];
    ctx.player._shields.push({
      piece,
      chance: fallbackChance,
      getChance() {
        const base = Number.isFinite(Number(piece.chance))
          ? Number(piece.chance)
          : Number.isFinite(Number(catalog?.chance))
            ? Number(catalog.chance)
            : 30;
        const add = Number(piece.bonusChanceAdd1) || 0;
        const mult = Number(piece.bonusChanceMult) || 0;
        return Math.max(0, Math.min(100, (base + add) * ((100 + mult) / 100)));
      },
      getDamblock() {
        return modifiedParamValue(
          piece,
          getPName(piece.params, 'damblock', getP1(piece.params, 7)),
          'damblock',
        );
      },
      afterBlock(payload) {
        if (!piece.alive) return;
        const drain = Math.max(0, Number(stamDrain) || 0);
        if (drain > 0) {
          drainStamina(ctx.player, drain, {
            events: ctx.events,
            t: payload?.t ?? ctx.t,
            actorSide: eventSideForPiece(piece),
            itemId: piece.itemId,
            placementKey: piece.placementKey,
            label: `${piece.name}: drain stamina (afterBlock)`,
            handler: 'wooden_buckler',
          });
        }
        pushActivate(
          piece,
          { ...ctx, t: payload?.t ?? ctx.t },
          'wooden_buckler',
          `Shield: ${piece.name}`,
        );
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
  onPrepare(piece, ctx) {
    piece._angyActivated = false;
    piece._angyRageDur = 0;
    ctx.bus?.on?.('battle_rage_started', (payload) => {
      if (payload?.actor && payload.actor !== ctx.player) return;
      if (!piece._angyActivated) {
        const duration = Number(payload?.duration);
        piece._angyRageDur = Number.isFinite(duration) ? duration : 0;
      }
    });
    ctx.bus?.on?.('battle_rage_ended', (payload) => {
      if (payload?.actor && payload.actor !== ctx.player) return;
      if (piece._angyActivated || !piece.alive) return;
      piece._angyActivated = true;
      piece._cdLocked = false;
      piece.cooldown = Number(piece.baseCooldown ?? ctx.itemsById?.get?.(piece.itemId)?.cooldown) || 0;
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
  onPreCombatStart(piece) {
    deactivateCooldown(piece);
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, bus } = ctx;
    const pct = getPName(piece.params, 'dur', getP1(piece.params, 100)) / 100;
    const dur = (Number(piece._angyRageDur) || 0) * pct;
    startBattleRage(player, dur, t, {
      bus,
      sourceId: piece.itemId,
      applyBonus: false,
    });
    events.push({
      t: t + 0.004,
      type: 'buff',
      target: 'player',
      amount: dur,
      label: `${piece.name}: battle rage ${dur.toFixed(1)}s`,
      meta: { category: 'system', script: true, handler: 'extra_angy' },
    });
    afterEffectFinished(piece, ctx, 'extra_angy', { label: `Skill: ${piece.name}` });
    return true;
  },
};

/** Toolbox.gd — insides speed/−dmg factor; CD rage; LS while raging on foe hits. */
/** @type {ScriptHandler} */
export const toolboxPort = {
  handlerId: 'toolbox',
  family: 'unique',
  onPrepare(piece, ctx) {
    const lifesteal = modifiedParamValue(
      piece,
      getPName(piece.params, 'lifesteal', getP4(piece.params, 35)),
      'lifesteal',
    ) / 100;
    piece._toolboxLifesteal = lifesteal;
    // Toolbox.gd connects to the owner's opponent.character_attacked signal
    // during onPrepare. The simulator's canonical equivalent is the damage
    // event whose actor is this owner and whose attacker is the opponent.
    ctx.bus?.on?.('character_damaged', (payload = {}) => {
      if (payload.actor && payload.actor !== ctx.player) return;
      if (payload.attacker && payload.attacker !== ctx.dummy) return;
      if (!piece.alive) return;
      const at = Number(payload.t ?? ctx.t);
      if (!isBattleRaging(ctx.player, at)) return;
      const hit =
        typeof payload.hit === 'object'
          ? payload.hit
          : { hit: payload.hit === true };
      if (hit.hit !== true) return;
      const source = payload.damage?.damageSource ?? payload.damageSource;
      if (source?.canApplyLifesteal === false || source?.isEffectDamage === true) return;
      if (typeof source?.canApplyLifesteal === 'function' && !source.canApplyLifesteal()) return;
      const damage = Number(payload.damage?.damage ?? payload.damage ?? payload.healthDamage) || 0;
      if (!(damage > 0) || !(lifesteal > 0)) return;
      const amount = Math.ceil(lifesteal * damage);
      if (!(amount > 0)) return;
      const healed = healActor(ctx.player, amount);
      const side = eventSideForPiece(piece);
      ctx.events.push({
        t: at,
        type: 'heal',
        actor: side,
        target: side,
        amount: Number(ctx.player._lastHeal?.loggedAmount) || amount,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: rage lifesteal +${amount}`,
        meta: {
          category: 'heal',
          script: true,
          handler: 'toolbox',
          applied: healed,
          damage: damage,
        },
      });
    });
  },
  onCombatStart(piece, ctx) {
    const { graph, pieces } = ctx;
    const speedRed =
      getPName(piece.params, 'speedreduction', getP1(piece.params, 30)) / 100;
    const damBonus =
      getPName(piece.params, 'dambonus', getP2(piece.params, 30)) / 100;
    const inside = getItemsInside(graph, piece.placementKey);
    for (const key of inside) {
      const other = (pieces || []).find((p) => p.placementKey === key);
      if (!other || !canBeEmpoweredPiece(other)) continue;
      if (speedRed) addSpeed(other, -speedRed);
      if (damBonus) addBonusDamageFactor(other, damBonus);
    }
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, bus } = ctx;
    const dur = Math.max(
      0,
      modifiedParamValue(
        piece,
        getPName(piece.params, 'dur_rage', getP3(piece.params, 5.5)),
        'dur_rage',
      ),
    );
    startBattleRage(player, dur, t, { bus, sourceId: piece.itemId });
    if (dur > 0) {
      const side = eventSideForPiece(piece);
      events.push({
        t: t + 0.004,
        type: 'buff',
        actor: side,
        target: side,
        amount: dur,
        label: `${piece.name}: battle rage ${dur.toFixed(1)}s`,
        meta: { category: 'system', script: true, handler: 'toolbox' },
      });
    }
    afterEffectFinished(piece, ctx, 'toolbox', { label: `Bag: ${piece.name}` });
    return true;
  },
};

/** MrStruggles.gd — low-HP timed speed to links; debuff echo; fatigue CD. */
/** @type {ScriptHandler} */
export const mrStrugglesPort = {
  handlerId: 'mr_struggles',
  family: 'pet_like',
  // MrStruggles.gd connects during onPrepare, before combat-start damage.
  onPrepare(piece, ctx) {
    piece._struggleFired = false;
    piece._struggleDebuffN = 0;
    const thresh =
      getPName(piece.params, 'healtht', getP2(piece.params, 50)) / 100 - 0.0001;
    const speedBonus =
      getPName(piece.params, 'speedbonus', getP3(piece.params, 100)) / 100;
    const durSpeed = Math.max(
      0,
      getPName(piece.params, 'dur_speed', getPName(piece.params, 'p4', 8)),
    );
    ctx.bus?.on?.('character_damaged', (payload) => {
      if (payload?.actor && payload.actor !== ctx.player) return;
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
        if (!other || !pieceHasCombatCooldown(other)) continue;
        grantTimedSpeed(other, speedBonus, ctx.t + durSpeed, 'mr_struggles');
      }
      ctx.events.push({
        t: payload?.t ?? ctx.t,
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
      const triggerT = Number(ctx.t) || 0;
      if (piece._struggleDebuffT !== triggerT) {
        piece._struggleDebuffT = triggerT;
        piece._struggleDebuffN = 0;
      }
      piece._struggleDebuffN = (Number(piece._struggleDebuffN) || 0) + 1;
      if (piece._struggleDebuffN > 10) return;
      const catalogChance = Number(ctx.itemsById.get(piece.itemId)?.chance);
      const chanceValue = Number(piece.chance);
      const chance = Number.isFinite(catalogChance)
        ? catalogChance
        : Number.isFinite(chanceValue)
        ? chanceValue
        : 25;
      if (ctx.rng() * 100 >= chance) return;
      const duration = Number.isFinite(Number(ch.duration)) ? Number(ch.duration) : -1;
      const grantOpts = {
        rng: ctx.rng,
        opponent: ctx.player,
        piece,
        originKey: piece.placementKey,
        originId: piece.itemId,
      };
      if (duration > 0) {
        grantTemporaryStacks(ctx.dummy, ch.stack, ch.amount, duration, ctx.t, grantOpts);
      } else {
        grantStacks(ctx.dummy, ch.stack, ch.amount, grantOpts);
      }
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
          ...(duration > 0 ? { temp: true, duration } : {}),
        },
      });
    });
  },
  onCooldownEffect(piece, ctx) {
    const { t, dummy, events, bus } = ctx;
    const fatigueIncrease = Math.trunc(
      getPName(piece.params, 'fatigue', getP1(piece.params, 1)),
    );
    dummy.bonusFatigueDamage =
      (Number(dummy.bonusFatigueDamage) || 0) + fatigueIncrease;
    const fatigueBase = Math.max(0, Math.round(Number(ctx.fatigue?.counter) || 0));
    const dam = Math.max(0, fatigueBase + (Number(dummy.bonusFatigueDamage) || 0));
    const result = takeDamage(dummy, ctx.player, {
      amount: dam,
      canMiss: false,
      canCrit: false,
      canBlock: true,
      isAttack: false,
      isFatigue: true,
      nowT: t,
      events,
      bus,
      rng: ctx.rng,
    });
    events.push({
      t: t + 0.004,
      type: 'damage',
      target: 'dummy',
      amount: result.healthDamage,
      label: `${piece.name}: ${dam} fatigue`,
      meta: {
        category: 'damage',
        script: true,
        handler: 'mr_struggles',
        fatigue: true,
        raw: result.raw,
        blocked: result.blocked,
      },
    });
    pushActivate(piece, ctx, 'mr_struggles', `Pet: ${piece.name}`);
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
