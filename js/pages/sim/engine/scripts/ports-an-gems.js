/**
 * Band AQ 253 — loose (inventory) gems: Gem.gd combatStartInventory / doCooldownEffect.
 * Socketed gems stay on the host via gem-sockets.js (prepareWeapon / prepareArmor).
 */

import { healActor } from '../actor.js';
import { cleanseRandomDebuffs, grantStacks } from '../buff-economy.js';
import { dealDamage } from '../damage.js';
import { getP1, getP3, getP5, getPName } from '../params.js';
import { multiplyStaminaCost } from '../piece-stats.js';
import { afterEffectFinished, pushActivate, pushBuffGrants } from './ports-util.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

export const AN_GEM_IDS = [
  'amethyst',
  'ruby',
  'emerald',
  'sapphire',
  'topaz',
  'badger_rune',
  'chipped_amethyst',
  'chipped_emerald',
  'chipped_ruby',
  'chipped_sapphire',
  'chipped_topaz',
  'elephant_rune',
  'flawed_amethyst',
  'flawed_emerald',
  'flawed_ruby',
  'flawed_sapphire',
  'flawed_topaz',
  'flawless_amethyst',
  'flawless_emerald',
  'flawless_ruby',
  'flawless_sapphire',
  'flawless_topaz',
  'perfect_amethyst',
  'perfect_emerald',
  'perfect_ruby',
  'perfect_sapphire',
  'perfect_topaz',
  'regular_amethyst',
  'regular_emerald',
  'regular_ruby',
  'regular_sapphire',
  'regular_topaz',
  'skull',
  'tiger_rune',
];

function familyOf(id) {
  const s = String(id || '');
  if (s.includes('amethyst')) return 'amethyst';
  if (s.includes('ruby')) return 'ruby';
  if (s.includes('emerald')) return 'emerald';
  if (s.includes('sapphire')) return 'sapphire';
  if (s.includes('topaz')) return 'topaz';
  if (s === 'skull') return 'skull';
  if (s === 'badger_rune') return 'badger';
  if (s === 'tiger_rune') return 'tiger';
  if (s === 'elephant_rune') return 'elephant';
  return 'stat';
}

function origin(piece) {
  return { originKey: piece.placementKey, originId: piece.itemId };
}

/** Ruby.gd inventory: stealLife then onAfterEffectFinished → consume (1 activate). */
function rubyInventory(id) {
  /** @type {ScriptHandler} */
  return {
    handlerId: id,
    family: 'unique',
    onCooldownEffect(piece, ctx) {
      const dam = Math.max(1, Math.round(getPName(piece.params, 'flatsteal', getP3(piece.params, 4))));
      const factor = getPName(piece.params, 'lifesteal_factor', 150) / 100;
      const res = dealDamage(ctx.player, ctx.dummy, {
        amount: dam,
        canMiss: false,
        canCrit: false,
        isAttack: false,
        skipSpikes: true,
        nowT: ctx.t,
        rng: ctx.rng,
      });
      const dealt = Number(res.damage) || Number(res.healthDamage) || 0;
      const healed = healActor(ctx.player, Math.round(dealt * factor));
      ctx.events.push({
        t: ctx.t + 0.002,
        type: 'damage',
        actor: 'player',
        target: 'dummy',
        amount: dealt,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: steal ${dealt}`,
        meta: { category: 'damage', script: true, handler: id, effect: true },
      });
      if (healed > 0) {
        ctx.events.push({
          t: ctx.t + 0.004,
          type: 'heal',
          target: 'player',
          amount: healed,
          itemId: piece.itemId,
          placementKey: piece.placementKey,
          label: `${piece.name}: +${healed} HP`,
          meta: { category: 'heal', script: true, handler: id },
        });
      }
      afterEffectFinished(piece, ctx, id, { activate: true, label: `Gem: ${piece.name}` });
      return true;
    },
  };
}

/** Emerald.gd inventory: regen then consume. */
function emeraldInventory(id) {
  /** @type {ScriptHandler} */
  return {
    handlerId: id,
    family: 'unique',
    onCooldownEffect(piece, ctx) {
      const regen = Math.max(
        1,
        Math.round(getPName(piece.params, 'regen', getP3(piece.params, 2))),
      );
      grantStacks(ctx.player, 'regeneration', regen, origin(piece));
      pushBuffGrants(ctx.events, piece, ctx.player, ctx.t, id, { regeneration: regen });
      afterEffectFinished(piece, ctx, id, { activate: true, label: `Gem: ${piece.name}` });
      return true;
    },
  };
}

/** Sapphire.gd inventory: inflictCold(getP5) then consume. */
function sapphireInventory(id) {
  /** @type {ScriptHandler} */
  return {
    handlerId: id,
    family: 'unique',
    onCooldownEffect(piece, ctx) {
      const cold = Math.max(1, Math.round(getPName(piece.params, 'p5', getP5(piece.params, 1))));
      grantStacks(ctx.dummy, 'cold', cold, origin(piece));
      pushBuffGrants(ctx.events, piece, ctx.dummy, ctx.t, id, { cold }, 0.002, 'dummy');
      afterEffectFinished(piece, ctx, id, { activate: true, label: `Gem: ${piece.name}` });
      return true;
    },
  };
}

/** Amethyst.gd inventory: cleanse + activate() — repeating CD, not consume. */
function amethystInventory(id) {
  /** @type {ScriptHandler} */
  return {
    handlerId: id,
    family: 'unique',
    onCooldownEffect(piece, ctx) {
      pushActivate(piece, ctx, id, `Gem: ${piece.name}`);
      cleanseRandomDebuffs(ctx.player, 1, ctx.rng, origin(piece));
      return true;
    },
  };
}

/** Topaz.gd prepareInventory — stamina regen once (no CD). */
function topazInventory(id) {
  /** @type {ScriptHandler} */
  return {
    handlerId: id,
    family: 'unique',
    onCombatStart(piece, ctx) {
      const stam = getPName(piece.params, 'staminaregen', getPName(piece.params, 'p2', 0)) / 100;
      if (stam) {
        ctx.player.staminaRegen = (Number(ctx.player.staminaRegen) || 1) + stam;
      }
      void piece;
    },
  };
}

/** Skull.gd prepareInventory — once when dummy relative HP ≤ threshold. */
function skullInventory(id) {
  /** @type {ScriptHandler} */
  return {
    handlerId: id,
    family: 'unique',
    onCombatStart(piece, ctx) {
      piece._skullUsed = false;
      const th = getP1(piece.params, 50) / 100 - 0.0001;
      ctx.bus?.on?.('piece_dealt_damage', (payload) => {
        if (piece._skullUsed || !payload?.hit?.hit) return;
        const maxHp = Number(ctx.dummy.maxHp) || 1;
        if (ctx.dummy.hp / maxHp > th) return;
        piece._skullUsed = true;
        const heal = Math.max(1, Math.round(getPName(piece.params, 'heal', 20)));
        const got = healActor(ctx.player, heal);
        grantStacks(
          ctx.player,
          'empower',
          Math.max(1, Math.round(getP3(piece.params, 1))),
          origin(piece),
        );
        pushActivate(piece, ctx, id, `Gem: ${piece.name}`);
        if (got > 0) {
          ctx.events.push({
            t: ctx.t,
            type: 'heal',
            target: 'player',
            amount: got,
            itemId: piece.itemId,
            placementKey: piece.placementKey,
            label: `${piece.name}: +${got} HP`,
            meta: { category: 'heal', script: true, handler: id },
          });
        }
      });
    },
  };
}

/** BadgerRune.gd prepareInventory — staminaFactor on every item. */
function badgerInventory(id) {
  /** @type {ScriptHandler} */
  return {
    handlerId: id,
    family: 'unique',
    onCombatStart(piece, ctx) {
      const stam = getPName(piece.params, 'stamina', 10);
      const frac = -stam / 100;
      for (const o of ctx.pieces || []) {
        if (o.placementKey === piece.placementKey) continue;
        multiplyStaminaCost(o, frac);
      }
    },
  };
}

/** TigerRune.gd prepareInventory — buff chance on items/gems (socketed = host). */
function tigerInventory(id) {
  /** @type {ScriptHandler} */
  return {
    handlerId: id,
    family: 'unique',
    onCombatStart(piece, ctx) {
      const ch = Number(ctx.itemsById.get(piece.itemId)?.chance) || 0;
      if (!ch) return;
      for (const o of ctx.pieces || []) {
        o.buffChance = (Number(o.buffChance) || 0) + ch;
      }
    },
  };
}

/** ElephantRune.gd combatStartInventory — giveMaxHealth then consume. */
function elephantInventory(id) {
  /** @type {ScriptHandler} */
  return {
    handlerId: id,
    family: 'unique',
    onCombatStart(piece, ctx) {
      const hp = Math.max(
        1,
        Math.round(getPName(piece.params, 'maxhealth', getP1(piece.params, 8))),
      );
      ctx.player.maxHp += hp;
      ctx.player.hp += hp;
      afterEffectFinished(piece, ctx, id, { activate: true, label: `Gem: ${piece.name}` });
    },
  };
}

function portFor(id) {
  switch (familyOf(id)) {
    case 'ruby':
      return rubyInventory(id);
    case 'emerald':
      return emeraldInventory(id);
    case 'sapphire':
      return sapphireInventory(id);
    case 'amethyst':
      return amethystInventory(id);
    case 'topaz':
      return topazInventory(id);
    case 'skull':
      return skullInventory(id);
    case 'badger':
      return badgerInventory(id);
    case 'tiger':
      return tigerInventory(id);
    case 'elephant':
      return elephantInventory(id);
    default:
      return { handlerId: id, family: 'unique' };
  }
}

/** @type {Record<string, ScriptHandler>} */
export const AN_SOCKET_PORTS = {};
for (const id of AN_GEM_IDS) {
  AN_SOCKET_PORTS[id] = portFor(id);
}
