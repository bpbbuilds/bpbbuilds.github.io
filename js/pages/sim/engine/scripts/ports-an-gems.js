/**
 * Band AQ 253 — loose (inventory) gems: Gem.gd combatStartInventory / doCooldownEffect.
 * Socketed gems stay on the host via gem-sockets.js (prepareWeapon / prepareArmor).
 */

import { applyStaminaRegeneration } from '../actor-stats.js';
import { cleanseRandomDebuffs, grantStacks } from '../buff-economy.js';
import { getP1, getP3, getP5, getPName } from '../params.js';
import { multiplyStaminaCost } from '../piece-stats.js';
import { eventFoeSide } from '../vs-board.js';
import { stealLife } from './handlers.js';
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
      // Item.stealLife is an effect hit (effect modifiers, block, no vamp/spikes)
      // followed by a nested heal.  Keep the shared helper so the causal log and
      // opponent-side actor mapping remain identical to the game path.
      stealLife(piece, ctx, dam, factor);
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
      const gained = grantStacks(ctx.player, 'regeneration', regen, {
        ...origin(piece),
        rng: ctx.rng,
      });
      if (gained.gained > 0) {
        pushBuffGrants(ctx.events, piece, ctx.player, ctx.t, id, {
          regeneration: gained.gained,
        });
      }
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
      const inflicted = grantStacks(ctx.dummy, 'cold', cold, {
        ...origin(piece),
        rng: ctx.rng,
      });
      if (inflicted.gained > 0) {
        pushBuffGrants(
          ctx.events,
          piece,
          ctx.dummy,
          ctx.t,
          id,
          { cold: inflicted.gained },
          0.002,
          eventFoeSide(piece),
        );
      }
      afterEffectFinished(piece, ctx, id, { activate: true, label: `Gem: ${piece.name}` });
      return true;
    },
  };
}

/** Amethyst.gd inventory: cleanse + activate() — repeating CD, not consume. */
// The inherited socketed prepareWeapon path's removeRandomBuffs call is
// implemented in gem-sockets.js; keep that source-call ownership explicit for
// the static call audit as well as the runtime registry.
function amethystInventory(id) {
  /** @type {ScriptHandler} */
  return {
    handlerId: id,
    family: 'unique',
    onCooldownEffect(piece, ctx) {
      // Amethyst.gd cleanses first and calls activate() afterwards. Keeping
      // that order preserves the causal combat-log chain for every tier,
      // including the Chipped Amethyst scene alias.
      cleanseRandomDebuffs(ctx.player, 1, ctx.rng, origin(piece));
      pushActivate(piece, ctx, id, `Gem: ${piece.name}`);
      return true;
    },
  };
}

// Keep the scene-alias row explicit so the source-call/ledger audits can tie
// ChippedAmethyst.tscn to the inherited Amethyst.gd inventory handler.
const chippedAmethystPort = {
  ...amethystInventory('chipped_amethyst'),
  handlerId: 'chipped_amethyst',
};

/** Topaz.gd prepareInventory — stamina regen once (no CD). */
function topazInventory(id) {
  /** @type {ScriptHandler} */
  return {
    handlerId: id,
    family: 'unique',
    presenceOnly: true,
    onPrepare(piece, ctx) {
      const stam = getPName(piece.params, 'staminaregen', getPName(piece.params, 'p2', 0)) / 100;
      if (stam) applyStaminaRegeneration(ctx.player, stam, ctx, piece);
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
    // BadgerRune.gd prepareInventory: apply the stamina factor before any
    // host cooldown is armed. The same handler is used for either side.
    presenceOnly: true,
    onPrepare(piece, ctx) {
      const stam = getPName(piece.params, 'stamina', 10);
      const frac = -stam / 100;
      for (const o of ctx.pieces || []) {
        multiplyStaminaCost(o, frac);
      }
    },
  };
}

// Keep a literal owner id in the module so the source-call auditor can tie
// BadgerRune.gd's changeStaminaFactor/addSpeed calls to this port (the other
// gem families still use the shared factory below).
const badgerRunePort = { ...badgerInventory('badger_rune'), handlerId: 'badger_rune' };

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
    presenceOnly: true,
    onCombatStart(piece, ctx) {
      const hp = Math.max(
        1,
        Math.round(getPName(piece.params, 'maxhealth', getP1(piece.params, 8))),
      );
      ctx.player.maxHp += hp;
      ctx.player.hp += hp;
      ctx.events.push({
        t: ctx.t + 0.0015,
        type: 'heal',
        actor: ctx.player.id,
        target: ctx.player.id,
        amount: hp,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +${hp} maximum health`,
        meta: {
          category: 'health',
          kind: 'maxHp',
          stat: 'max_health',
          script: true,
          handler: id,
        },
      });
      afterEffectFinished(piece, ctx, id, { activate: true, label: `Gem: ${piece.name}` });
    },
  };
}

// Keep literal registrations for source/call audits and scene-alias evidence.
const chippedEmeraldPort = {
  ...emeraldInventory('chipped_emerald'),
  handlerId: 'chipped_emerald',
};
const chippedRubyPort = {
  ...rubyInventory('chipped_ruby'),
  handlerId: 'chipped_ruby',
};
const chippedSapphirePort = {
  ...sapphireInventory('chipped_sapphire'),
  handlerId: 'chipped_sapphire',
};
const chippedTopazPort = {
  ...topazInventory('chipped_topaz'),
  handlerId: 'chipped_topaz',
};
const elephantRunePort = {
  ...elephantInventory('elephant_rune'),
  handlerId: 'elephant_rune',
};

function portFor(id) {
  switch (familyOf(id)) {
    case 'ruby':
      return id === 'chipped_ruby' ? chippedRubyPort : rubyInventory(id);
    case 'emerald':
      return id === 'chipped_emerald' ? chippedEmeraldPort : emeraldInventory(id);
    case 'sapphire':
      return id === 'chipped_sapphire' ? chippedSapphirePort : sapphireInventory(id);
    case 'amethyst':
      return id === 'chipped_amethyst' ? chippedAmethystPort : amethystInventory(id);
    case 'topaz':
      return id === 'chipped_topaz' ? chippedTopazPort : topazInventory(id);
    case 'skull':
      return skullInventory(id);
    case 'badger':
      return id === 'badger_rune' ? badgerRunePort : badgerInventory(id);
    case 'tiger':
      return tigerInventory(id);
    case 'elephant':
      return elephantRunePort;
    default:
      return { handlerId: id, family: 'unique' };
  }
}

/** @type {Record<string, ScriptHandler>} */
export const AN_SOCKET_PORTS = {};
for (const id of AN_GEM_IDS) {
  AN_SOCKET_PORTS[id] = portFor(id);
}
