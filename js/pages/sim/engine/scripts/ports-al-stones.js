/**
 * Band AL — Stone.gd ammo + BagofStones.gd stars + artifact stones.
 */

import { grantStacks, onBuffChanged } from '../buff-economy.js';
import { applyFatigueDamage } from '../fatigue.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getP3, getPName } from '../params.js';
import { addBonusDamage } from '../piece-stats.js';
import { getStackAmount } from '../stacks.js';
import { tryUseStamina } from '../actor.js';
import { canBeEmpoweredPiece } from './food-helpers.js';
import { weaponStrike, removeBlock } from './ports-wave-c-util.js';
import { dealHit } from './handlers.js';
import { pushActivate } from './ports-util.js';
import { randInt } from '../rng.js';
import {
  applyBagOfStones,
  initStoneAmmo,
  spendStoneAmmo,
} from './stone-ammo.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

function linked(ctx, piece) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  return (ctx.pieces || []).filter((o) =>
    links.some((l) => l.key === o.placementKey),
  );
}

function lastEventStarved(ctx) {
  const evs = ctx.events || [];
  const last = evs[evs.length - 1];
  return Boolean(last?.meta?.starved);
}

function afterStoneThrow(piece, ctx) {
  if (lastEventStarved(ctx)) return;
  spendStoneAmmo(piece);
}

function chanceOf(piece, ctx, fallback = 1) {
  const item = ctx.itemsById.get(piece.itemId);
  return Number(item?.chance) || Number(piece.chance) || fallback;
}

/** Stone.gd — ammo 1 unless bag star; preHit removeBlock(getP1). */
/** @type {ScriptHandler} */
export const stonePort = {
  handlerId: 'stone',
  family: 'on_hit',
  onCombatStart(piece) {
    initStoneAmmo(piece);
  },
  onCooldownEffect(piece, ctx) {
    if ((piece.ammunition ?? 1) < 1) return true;
    const { t, player, events, rng } = ctx;
    if (tryUseStamina(player, piece.staminaCost) === 'starve') {
      events.push({
        t,
        type: 'stamina',
        label: `${piece.name}: out of stamina`,
        meta: { category: 'stamina', script: true, starved: true, handler: 'stone' },
      });
      return true;
    }
    pushActivate(piece, ctx, 'stone', `Weapon: ${piece.name}`);
    const raw = randInt(piece.damageMin, piece.damageMax, rng);
    dealHit(piece, ctx, raw);
    spendStoneAmmo(piece);
    return true;
  },
  onPreDealDamageLate(piece, ctx) {
    const strip = Math.max(0, Math.round(getPName(piece.params, 'blockremoval', getP1(piece.params, 4))));
    if (strip) removeBlock(ctx.dummy, strip, ctx, piece);
  },
};

/** BagofStones.gd — onPrepare setBagOfStones on UP-1 Stone tags. */
/** @type {ScriptHandler} */
export const bagOfStonesPort = {
  handlerId: 'bag_of_stones',
  family: 'unique',
  deferStartActivate: true,
  onCombatStart(piece, ctx) {
    applyBagOfStones(piece, ctx);
  },
};

/** ArtifactStoneCold.gd — preHit cold; linked weapon hits inflict cold. */
/** @type {ScriptHandler} */
export const artifactStoneColdPort = {
  handlerId: 'artifact_stone_cold',
  family: 'unique',
  onCombatStart(piece, ctx) {
    initStoneAmmo(piece);
    const keys = new Set(linked(ctx, piece).map((o) => o.placementKey));
    ctx.bus?.on?.('piece_dealt_damage', (payload) => {
      const src = payload?.piece;
      if (!src || !payload?.hit?.hit || !keys.has(src.placementKey)) return;
      grantStacks(ctx.dummy, 'cold', Math.max(1, Math.round(getP2(piece.params, 1))), {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    });
  },
  onCooldownEffect(piece, ctx) {
    if ((piece.ammunition ?? 1) < 1) return true;
    const done = weaponStrike(piece, ctx, 'artifact_stone_cold', {
      beforeDeal: () => {
        grantStacks(ctx.dummy, 'cold', Math.max(1, Math.round(getP1(piece.params, 1))), {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
      },
    });
    afterStoneThrow(piece, ctx);
    return done;
  },
};

/** ArtifactStoneHeat.gd — heat threshold bonus dmg; preHit giveHeat. */
/** @type {ScriptHandler} */
export const artifactStoneHeatPort = {
  handlerId: 'artifact_stone_heat',
  family: 'unique',
  onCombatStart(piece, ctx) {
    initStoneAmmo(piece);
    piece._ashOn = false;
    const need = Math.max(1, Math.round(getP2(piece.params, 4)));
    const bonus = Math.max(1, Math.round(getP3(piece.params, 2)));
    onBuffChanged(ctx.player, (ch) => {
      if (piece._ashOn || ch.stack !== 'heat') return;
      if ((getStackAmount(ctx.player, 'heat') || 0) < need) return;
      piece._ashOn = true;
      for (const w of linked(ctx, piece)) {
        if (canBeEmpoweredPiece(w)) {
          addBonusDamage(w, bonus, {
            originKey: piece.placementKey,
            originId: piece.itemId,
            originName: piece.name,
            via: 'heat',
          });
        }
      }
    });
  },
  onCooldownEffect(piece, ctx) {
    if ((piece.ammunition ?? 1) < 1) return true;
    const done = weaponStrike(piece, ctx, 'artifact_stone_heat', {
      beforeDeal: () => {
        grantStacks(ctx.player, 'heat', Math.max(1, Math.round(getP1(piece.params, 1))), {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
      },
    });
    afterStoneThrow(piece, ctx);
    return done;
  },
};

/** ArtifactStoneDeath.gd — fatigue → crit on linked; preHit fatigue dmg. */
/** @type {ScriptHandler} */
export const artifactStoneDeathPort = {
  handlerId: 'artifact_stone_death',
  family: 'unique',
  onCombatStart(piece, ctx) {
    initStoneAmmo(piece);
    piece._asdFat = 0;
    const per = chanceOf(piece, ctx);
    ctx.bus?.on?.('fatigue_tick', (payload) => {
      const dmg = Number(payload?.damage) || 0;
      const diff = dmg - (Number(piece._asdFat) || 0);
      piece._asdFat = dmg;
      if (!diff) return;
      for (const w of linked(ctx, piece)) {
        if ((w.damageMax || 0) > 0 || w.kind === 'weapon') {
          w.critChance = (Number(w.critChance) || 0) + per * diff;
        }
      }
    });
  },
  onCooldownEffect(piece, ctx) {
    if ((piece.ammunition ?? 1) < 1) return true;
    const done = weaponStrike(piece, ctx, 'artifact_stone_death', {
      beforeDeal: () => {
        applyFatigueDamage(ctx.dummy, Math.max(1, Math.round(getP1(piece.params, 1))));
      },
    });
    afterStoneThrow(piece, ctx);
    return done;
  },
};

export const AL_STONE_PORTS = {
  stone: stonePort,
  bag_of_stones: bagOfStonesPort,
  artifact_stone_cold: artifactStoneColdPort,
  artifact_stone_heat: artifactStoneHeatPort,
  artifact_stone_death: artifactStoneDeathPort,
};
