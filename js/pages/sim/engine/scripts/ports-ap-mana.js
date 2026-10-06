/**
 * Band AP 245 — leftover `cd_mana` MAP items → `.gd` ports.
 */

import { drainStamina, giveStamina, healActor } from '../actor.js';
import { isBattleRaging } from '../battle-rage.js';
import {
  grantStacks,
  onBuffChanged,
  spendStacks,
  useLucky,
  useMana,
} from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getP3, getP4, getPName } from '../params.js';
import { addBonusDamage, addSpeed } from '../piece-stats.js';
import { gainStacks, getStackAmount } from '../stacks.js';
import { loseHealth } from './handlers.js';
import { deactivateCooldown } from '../cooldown.js';
import { eventSideForPiece } from '../vs-board.js';
import { canBeEmpoweredPiece } from './food-helpers.js';
import { giveTempMaxHp } from './ports-ap-start.js';
import { itemHasType, pushActivate } from './ports-util.js';
import { removeRandomBuffs } from './ports-wave-c-util.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

function linked(ctx, piece) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  return (ctx.pieces || []).filter((o) => links.some((l) => l.key === o.placementKey));
}

function linkedByColor(ctx, piece, color) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  return (ctx.pieces || []).filter((o) =>
    links.some((l) => l.key === o.placementKey && l.color === color),
  );
}

function origin(piece) {
  return { originKey: piece.placementKey, originId: piece.itemId };
}

function goldOf(ctx, o) {
  return Math.max(0, Number(ctx.itemsById.get(o.itemId)?.cost) || 0);
}

function pickNoRepeat(piece, key, rng) {
  let opts = piece[key];
  if (!Array.isArray(opts) || !opts.length) opts = [0, 1, 2];
  const pick = opts[Math.floor(rng() * opts.length)] ?? 0;
  piece[key] = [0, 1, 2].filter((x) => x !== pick);
  return pick;
}

function checkDjinn(piece, ctx) {
  if (piece._djinnOn || !piece._djinnWeapon) return;
  const p = ctx.player;
  const need = Math.max(1, Math.round(getP1(piece.params, 7)));
  const hpNeed = Math.max(1, Math.round(getP2(piece.params, 27)));
  let progress = 0;
  progress += Math.min(getStackAmount(p, 'block') || Number(p.block) || 0, need) / need;
  progress += Math.min(getStackAmount(p, 'spikes'), need) / need;
  progress += Math.min(getStackAmount(p, 'mana'), need) / need;
  progress += Math.min(getStackAmount(p, 'lucky'), need) / need;
  progress += Math.min(Math.max(0, (Number(p.hp) || 1) - 1), hpNeed) / hpNeed;
  progress /= 5;
  if (!(progress >= 0.9999)) return;
  piece._djinnOn = true;
  spendStacks(p, 'block', need, origin(piece));
  spendStacks(p, 'spikes', need, origin(piece));
  useMana(p, need, origin(piece));
  useLucky(p, need, origin(piece));
  loseHealth(piece, ctx, hpNeed);
  addBonusDamage(piece._djinnWeapon, getP3(piece.params, 27));
  pushActivate(piece, ctx, 'djinn_lamp', `Accessory: ${piece.name}`);
}

/** Cauldron.gd — speed × food/potion; CD heal / mana / heat, no immediate repeat. */
const cauldronPort = {
  handlerId: 'cauldron',
  family: 'unique',
  onPrepare(piece, ctx) {
    const n = linked(ctx, piece).length;
    const spd = getPName(piece.params, 'speedbonus', getP4(piece.params, 15)) / 100;
    if (n && spd) addSpeed(piece, spd * n);
    piece._cauldronOpts = [0, 1, 2];
  },
  onCooldownEffect(piece, ctx) {
    const pick = pickNoRepeat(piece, '_cauldronOpts', ctx.rng);
    if (pick === 0) {
      const heal = Math.max(1, Math.round(getPName(piece.params, 'heal', getP1(piece.params, 20))));
      const got = healActor(ctx.player, heal);
      if (got > 0) {
        ctx.events.push({
          t: ctx.t + 0.002,
          type: 'heal',
          target: 'player',
          amount: got,
          itemId: piece.itemId,
          placementKey: piece.placementKey,
          label: `${piece.name}: +${got} HP`,
          meta: { category: 'heal', script: true, handler: 'cauldron' },
        });
      }
    } else if (pick === 1) {
      grantStacks(
        ctx.player,
        'mana',
        Math.max(1, Math.round(getPName(piece.params, 'mana', getP2(piece.params, 6)))),
        origin(piece),
      );
    } else {
      grantStacks(
        ctx.player,
        'heat',
        Math.max(1, Math.round(getPName(piece.params, 'heat', getP3(piece.params, 5)))),
        origin(piece),
      );
    }
    // Cauldron.gd activates after the selected effect has completed.
    pushActivate(piece, ctx, 'cauldron', `Accessory: ${piece.name}`);
    return true;
  },
};

/** DeathLotus.gd — dark speed; CD mana, strip opponent buffs, lucky→stamina. */
const deathLotusPort = {
  handlerId: 'death_lotus',
  family: 'unique',
  onPrepare(piece, ctx) {
    const n = linked(ctx, piece).filter((o) =>
      itemHasType(ctx.itemsById.get(o.itemId), 'dark'),
    ).length;
    const spd = getPName(piece.params, 'speed', getP4(piece.params, 10)) / 100;
    if (n && spd) addSpeed(piece, spd * n);
  },
  onCooldownEffect(piece, ctx) {
    const mana = Math.max(1, Math.round(getPName(piece.params, 'mana', getP1(piece.params, 4))));
    const buffs = Math.max(1, Math.round(getPName(piece.params, 'buffs', getP2(piece.params, 3))));
    const need = Math.max(1, Math.round(getPName(piece.params, 'luckt', getP3(piece.params, 1))));
    grantStacks(ctx.player, 'mana', mana, origin(piece));
    removeRandomBuffs(ctx.dummy, buffs, ctx.rng, origin(piece));
    if (getStackAmount(ctx.player, 'lucky') >= need) {
      useLucky(ctx.player, need, origin(piece));
      giveStamina(ctx.player, getPName(piece.params, 'stamina', 1.5));
    }
    pushActivate(piece, ctx, 'death_lotus', `Spell: ${piece.name}`);
    return true;
  },
};

/** DeerTotem.gd — DR + rage duration; CD only while raging: heal + mana. */
const deerTotemPort = {
  handlerId: 'deer_totem',
  family: 'unique',
  onPrepare(piece, ctx) {
    const dr = getPName(piece.params, 'damreduction', getP1(piece.params, 15));
    ctx.player.damageResistancePct = (Number(ctx.player.damageResistancePct) || 0) + dr;
    const n = linked(ctx, piece).filter((o) =>
      itemHasType(ctx.itemsById.get(o.itemId), 'nature'),
    ).length;
    const extra = getPName(piece.params, 'dur_rage', getP2(piece.params, 0.8)) * n;
    ctx.player._battleRageDur = (Number(ctx.player._battleRageDur) || 0) + extra;
    ctx.bus?.on?.('battle_rage_started', () => {
      piece._cdLocked = false;
      const period = Math.max(0.35, Number(piece.baseCooldown) || 1);
      piece.cooldown = period;
      piece.triggerTime = period;
    });
    ctx.bus?.on?.('battle_rage_ended', () => {
      piece._cdLocked = true;
      piece.cooldown = 999;
      piece.triggerTime = 999;
    });
  },
  onPreCombatStart(piece) {
    deactivateCooldown(piece);
  },
  onCooldownEffect(piece, ctx) {
    if (!isBattleRaging(ctx.player, ctx.t)) return true;
    const heal = Math.max(1, Math.round(getPName(piece.params, 'heal', getP3(piece.params, 8))));
    const got = healActor(ctx.player, heal);
    if (got > 0) {
      const side = eventSideForPiece(piece);
      ctx.events.push({
        t: ctx.t + 0.002,
        type: 'heal',
        actor: side,
        target: side,
        amount: got,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +${got} HP`,
        meta: { category: 'heal', script: true, handler: 'deer_totem' },
      });
    }
    grantStacks(
      ctx.player,
      'mana',
      Math.max(1, Math.round(getPName(piece.params, 'mana', getP4(piece.params, 3)))),
      origin(piece),
    );
    pushActivate(piece, ctx, 'deer_totem', `Accessory: ${piece.name}`);
    return true;
  },
};

/** DjinnLamp.gd — CD least of lucky/spikes/mana; first empowerable +dmg at thresholds. */
const djinnLampPort = {
  handlerId: 'djinn_lamp',
  family: 'unique',
  onPrepare(piece, ctx) {
    piece._djinnOn = false;
    piece._djinnWeapon = linked(ctx, piece).find((o) => canBeEmpoweredPiece(o)) || null;
    onBuffChanged(ctx.player, () => checkDjinn(piece, ctx));
    const own = (payload = {}) => {
      if (!payload.actor || payload.actor === ctx.player) checkDjinn(piece, ctx);
    };
    ctx.bus?.on?.('character_block_changed', own);
    ctx.bus?.on?.('character_spikes_changed', own);
    ctx.bus?.on?.('character_mana_changed', own);
    ctx.bus?.on?.('character_lucky_changed', own);
    ctx.bus?.on?.('character_damaged', own);
    ctx.bus?.on?.('player_damaged', own);
    ctx.bus?.on?.('actor_healed', own);
  },
  onCooldownEffect(piece, ctx) {
    const L = getStackAmount(ctx.player, 'lucky');
    const S = getStackAmount(ctx.player, 'spikes');
    const M = getStackAmount(ctx.player, 'mana');
    let stack = 'mana';
    if (L < S) stack = L < M ? 'lucky' : 'mana';
    else stack = S < M ? 'spikes' : 'mana';
    grantStacks(ctx.player, stack, 1, origin(piece));
    // DjinnLamp.gd grants the selected resource before activating.
    pushActivate(piece, ctx, 'djinn_lamp', `Accessory: ${piece.name}`);
    return true;
  },
};

/** Fanfare.gd — speed × all; CD empower / mana+strip dummy mana / drain dummy stamina. */
const fanfarePort = {
  handlerId: 'fanfare',
  family: 'unique',
  onPrepare(piece, ctx) {
    const n = linked(ctx, piece).length;
    const spd = getPName(piece.params, 'p5', 10) / 100;
    if (n && spd) addSpeed(piece, spd * n);
    piece._fanfareOpts = [0, 1, 2];
  },
  onCooldownEffect(piece, ctx) {
    const pick = pickNoRepeat(piece, '_fanfareOpts', ctx.rng);
    if (pick === 0) {
      grantStacks(ctx.player, 'empower', Math.max(1, Math.round(getP1(piece.params, 1))), origin(piece));
    } else if (pick === 1) {
      grantStacks(ctx.player, 'mana', Math.max(1, Math.round(getP2(piece.params, 3))), origin(piece));
      spendStacks(ctx.dummy, 'mana', Math.max(1, Math.round(getP3(piece.params, 2))), origin(piece));
    } else {
      const drain = getP4(piece.params, 1);
      drainStamina(ctx.dummy, drain, {
        events: ctx.events,
        t: ctx.t,
        actorSide: ctx.dummy.id,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: Removed ${drain} stamina`,
        handler: 'fanfare',
      });
    }
    // Fanfare.gd applies its selected effect before activate().
    pushActivate(piece, ctx, 'fanfare', `Accessory: ${piece.name}`);
    return true;
  },
};

/** LevelUp.gd — speed × (round − skillround); CD max HP, stam, mana, luck. */
const levelUpPort = {
  handlerId: 'level_up',
  family: 'unique',
  onPrepare(piece, ctx) {
    const per = getPName(piece.params, 'speed', 10) / 100;
    const bought = Math.max(0, Math.round(getPName(piece.params, 'skillround', 3)));
    const round = Number(ctx.round) || bought;
    const passed = round - bought;
    if (passed && per) addSpeed(piece, passed * per);
  },
  onCooldownEffect(piece, ctx) {
    const hp = Math.max(1, Math.round(getPName(piece.params, 'maxhealth', getP1(piece.params, 10))));
    giveTempMaxHp(piece, ctx, 'level_up', hp);
    const stam = getPName(piece.params, 'stamina', getP2(piece.params, 1));
    const next = (Number(ctx.player.stamina) || 0) + stam;
    const cap = Number(ctx.player.maxStamina);
    ctx.player.stamina = cap > 0 ? Math.min(cap, next) : next;
    grantStacks(
      ctx.player,
      'mana',
      Math.max(1, Math.round(getPName(piece.params, 'mana', getP3(piece.params, 1)))),
      origin(piece),
    );
    grantStacks(
      ctx.player,
      'lucky',
      Math.max(1, Math.round(getPName(piece.params, 'luck', getP4(piece.params, 1)))),
      origin(piece),
    );
    pushActivate(piece, ctx, 'level_up', `Skill: ${piece.name}`);
    return true;
  },
};

/** MoonArmor.gd — start block + activate; CD mana + reflect stacks. */
const moonArmorPort = {
  handlerId: 'moon_armor',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const n = linked(ctx, piece).filter((o) =>
      itemHasType(ctx.itemsById.get(o.itemId), 'magic'),
    ).length;
    const block =
      (Number(ctx.itemsById.get(piece.itemId)?.block) || 50) + getP1(piece.params, 20) * n;
    gainStacks(ctx.player, 'block', block);
    pushActivate(piece, ctx, 'moon_armor', `Armor: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    grantStacks(
      ctx.player,
      'mana',
      Math.max(1, Math.round(getPName(piece.params, 'mana', getP2(piece.params, 3)))),
      origin(piece),
    );
    ctx.player.debuffReflectStacks =
      (Number(ctx.player.debuffReflectStacks) || 0) +
      Math.max(1, Math.round(getPName(piece.params, 'reflect', getP3(piece.params, 2))));
    pushActivate(piece, ctx, 'moon_armor', `Armor: ${piece.name}`);
    return true;
  },
};

/** Scale.gd — gold stars speed; CD mana vs regen (lower, or flip if tied). */
const scalePort = {
  handlerId: 'scale',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const c1 = linkedByColor(ctx, piece, 'primary').reduce((s, o) => s + goldOf(ctx, o), 0);
    const c2 = linkedByColor(ctx, piece, 'secondary').reduce((s, o) => s + goldOf(ctx, o), 0);
    const per = getPName(piece.params, 'speed', getP3(piece.params, 2)) / 100;
    addSpeed(piece, per * Math.min(c1, c2));
    const maxDif = Math.max(0, Math.round(getPName(piece.params, 'gold', getP4(piece.params, 5))));
    if (Math.abs(c1 - c2) <= maxDif) {
      const eq = getPName(piece.params, 'speed2', getPName(piece.params, 'p5', 30)) / 100;
      for (const o of [
        ...linkedByColor(ctx, piece, 'primary'),
        ...linkedByColor(ctx, piece, 'secondary'),
      ]) {
        addSpeed(o, eq);
      }
    }
  },
  onCooldownEffect(piece, ctx) {
    const mana = Math.max(1, Math.round(getPName(piece.params, 'mana', getP1(piece.params, 4))));
    const regen = Math.max(1, Math.round(getPName(piece.params, 'regen', getP2(piece.params, 3))));
    const curM = getStackAmount(ctx.player, 'mana');
    const curR = getStackAmount(ctx.player, 'regeneration');
    pushActivate(piece, ctx, 'scale', `Accessory: ${piece.name}`);
    let giveM = curM < curR;
    if (curR < curM) giveM = false;
    if (curM === curR) giveM = ctx.rng() < 0.5;
    grantStacks(ctx.player, giveM ? 'mana' : 'regeneration', giveM ? mana : regen, origin(piece));
    return true;
  },
};

/** SpintoWin.gd — face 0–3: heat / luck / regen / mana. */
const spinToWinPort = {
  handlerId: 'spin_to_win',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    const board = ctx.graph?.pieces?.get?.(piece.placementKey);
    const face = (((Number(board?.r) || Number(piece.r) || 0) % 4) + 4) % 4;
    pushActivate(piece, ctx, 'spin_to_win', `Skill: ${piece.name}`);
    const stacks = ['heat', 'lucky', 'regeneration', 'mana'];
    const amounts = [
      getPName(piece.params, 'heat', getP1(piece.params, 2)),
      getPName(piece.params, 'luck', getP2(piece.params, 3)),
      getPName(piece.params, 'regen', getP3(piece.params, 3)),
      getPName(piece.params, 'mana', getP4(piece.params, 4)),
    ];
    grantStacks(ctx.player, stacks[face], Math.max(1, Math.round(amounts[face])), origin(piece));
    return true;
  },
};

/** @type {Record<string, ScriptHandler>} */
export const AP_MANA_PORTS = {
  cauldron: cauldronPort,
  death_lotus: deathLotusPort,
  deer_totem: deerTotemPort,
  djinn_lamp: djinnLampPort,
  fanfare: fanfarePort,
  level_up: levelUpPort,
  moon_armor: moonArmorPort,
  scale: scalePort,
  spin_to_win: spinToWinPort,
};
