/**
 * Band AQ 253 — loose (inventory) gems: Gem.gd combatStartInventory / doCooldownEffect.
 * Socketed gems stay on the host via gem-sockets.js (prepareWeapon / prepareArmor).
 */

import { healActor } from '../actor.js';
import { applyStaminaRegeneration } from '../actor-stats.js';
import { cleanseRandomDebuffs, grantStacks } from '../buff-economy.js';
import { getP1, getP2, getP3, getP5, getPName } from '../params.js';
import { multiplyStaminaCost } from '../piece-stats.js';
import { modifiedParamValue } from '../placement-instance.js';
import { eventFoeSide } from '../vs-board.js';
import { stealLife } from './handlers.js';
import { giveTempMaxHp } from './ports-ap-start.js';
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
      // Ruby.gd passes getP3() directly to stealLife(); damage processing
      // performs the game's rounding downstream. Its factor uses getP_m(),
      // so preserve per-instance add/multiply modifiers on that named value.
      const rawDamage = Number(getPName(piece.params, 'flatsteal', getP3(piece.params, 4)));
      const dam = Number.isFinite(rawDamage) ? rawDamage : 0;
      const factorBase = getPName(piece.params, 'lifesteal_factor', 150);
      const factor = modifiedParamValue(piece, factorBase, 'lifesteal_factor') / 100;
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
      // Emerald.gd passes getP3() straight to giveRegeneration(); Item.gd
      // applies buff power and rounds inside giveStacks. Keep the raw source
      // amount here so zero/fractional values follow the same path.
      const rawRegen = Number(getPName(piece.params, 'regen', getP3(piece.params, 2)));
      const regen = Number.isFinite(rawRegen) ? rawRegen : 0;
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
      // Sapphire.gd passes getP5() directly to inflictCold(); let the shared
      // stack path perform the game's amplification and rounding.
      const rawCold = Number(getPName(piece.params, 'p5', getP5(piece.params, 1)));
      const cold = Number.isFinite(rawCold) ? rawCold : 0;
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
      // Topaz.gd reads the positional source value directly via getP2().
      // Named catalog aliases are descriptions, not an alternate lookup path.
      const stam = getP2(piece.params, 0) / 100;
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
      ctx.bus?.on?.('character_damaged', (payload = {}) => {
        if (piece._skullUsed) return;
        if (payload.actor && payload.actor !== ctx.dummy) return;
        const maxHp = Number(ctx.dummy.maxHp) || 1;
        if (ctx.dummy.hp / maxHp > th) return;
        piece._skullUsed = true;
        const heal = modifiedParamValue(
          piece,
          getPName(piece.params, 'heal', getP2(piece.params, 0)),
          'heal',
        );
        const got = healActor(ctx.player, heal);
        if (got > 0) {
          ctx.events.push({
            t: payload?.t ?? ctx.t,
            type: 'heal',
            target: 'player',
            amount: got,
            itemId: piece.itemId,
            placementKey: piece.placementKey,
            label: `${piece.name}: +${got} HP`,
            meta: { category: 'heal', script: true, handler: id },
          });
        }
        const empower = getP3(piece.params, 0);
        if (empower > 0) {
          grantStacks(ctx.player, 'empower', empower, origin(piece));
        }
        pushActivate(piece, ctx, id, `Gem: ${piece.name}`);
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
        if (o.side && piece.side && o.side !== piece.side) continue;
        multiplyStaminaCost(o, frac);
      }
    },
  };
}

// Keep a literal owner id in the module so the source-call auditor can tie
// BadgerRune.gd's changeStaminaFactor/addSpeed calls to this port (the other
// gem families still use the shared factory below).
const badgerRunePort = { ...badgerInventory('badger_rune'), handlerId: 'badger_rune' };

/** TigerRune.gd prepareInventory — amplify every inventory item's buff chance. */
function tigerInventory(id) {
  /** @type {ScriptHandler} */
  return {
    handlerId: id,
    family: 'unique',
    presenceOnly: true,
    onPrepare(piece, ctx) {
      // Item.gd stores this as one amplification value per buff type. The
      // simulator's buffAmpChance is the equivalent all-buffs surface and is
      // consumed by grantStacks before the actor's resistance roll.
      const ch = Number(piece.chance) || Number(ctx.itemsById.get(piece.itemId)?.chance) || 0;
      if (!ch) return;
      for (const o of ctx.pieces || []) {
        o.buffAmpChance = (Number(o.buffAmpChance) || 0) + ch;
      }
    },
  };
}

// Keep a literal source owner for the call/ledger audits; the factory above
// remains the shared implementation for the same Gem lifecycle on both sides.
const tigerRunePort = { ...tigerInventory('tiger_rune'), handlerId: 'tiger_rune' };

/** ElephantRune.gd combatStartInventory — giveMaxHealth then consume. */
function elephantInventory(id) {
  /** @type {ScriptHandler} */
  return {
    handlerId: id,
    family: 'unique',
    presenceOnly: true,
    onCombatStart(piece, ctx) {
      const hp = getPName(piece.params, 'maxhealth', getP1(piece.params, 8));
      giveTempMaxHp(piece, ctx, id, hp);
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

// These scene aliases reuse one of the five base Gem scripts. Keep each
// requested tier explicit: source audits can then tie its scene and handler
// together without turning the generic family fallback into false evidence.
const flawedAmethystPort = { ...amethystInventory('flawed_amethyst'), handlerId: 'flawed_amethyst' };
const flawedEmeraldPort = { ...emeraldInventory('flawed_emerald'), handlerId: 'flawed_emerald' };
const flawedRubyPort = { ...rubyInventory('flawed_ruby'), handlerId: 'flawed_ruby' };
const flawedSapphirePort = { ...sapphireInventory('flawed_sapphire'), handlerId: 'flawed_sapphire' };
const flawlessAmethystPort = {
  ...amethystInventory('flawless_amethyst'),
  handlerId: 'flawless_amethyst',
};
const flawlessEmeraldPort = {
  ...emeraldInventory('flawless_emerald'),
  handlerId: 'flawless_emerald',
};
const flawlessRubyPort = { ...rubyInventory('flawless_ruby'), handlerId: 'flawless_ruby' };
const flawlessSapphirePort = {
  ...sapphireInventory('flawless_sapphire'),
  handlerId: 'flawless_sapphire',
};
const flawlessTopazPort = { ...topazInventory('flawless_topaz'), handlerId: 'flawless_topaz' };

const EXPLICIT_TIER_PORTS = {
  flawed_amethyst: flawedAmethystPort,
  flawed_emerald: flawedEmeraldPort,
  flawed_ruby: flawedRubyPort,
  flawed_sapphire: flawedSapphirePort,
  flawless_amethyst: flawlessAmethystPort,
  flawless_emerald: flawlessEmeraldPort,
  flawless_ruby: flawlessRubyPort,
  flawless_sapphire: flawlessSapphirePort,
  flawless_topaz: flawlessTopazPort,
  perfect_amethyst: { ...amethystInventory('perfect_amethyst'), handlerId: 'perfect_amethyst' },
  perfect_emerald: { ...emeraldInventory('perfect_emerald'), handlerId: 'perfect_emerald' },
  perfect_ruby: { ...rubyInventory('perfect_ruby'), handlerId: 'perfect_ruby' },
  perfect_sapphire: { ...sapphireInventory('perfect_sapphire'), handlerId: 'perfect_sapphire' },
  perfect_topaz: { ...topazInventory('perfect_topaz'), handlerId: 'perfect_topaz' },
  regular_amethyst: { ...amethystInventory('regular_amethyst'), handlerId: 'regular_amethyst' },
};

function portFor(id) {
  if (EXPLICIT_TIER_PORTS[id]) return EXPLICIT_TIER_PORTS[id];
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
      return id === 'tiger_rune' ? tigerRunePort : tigerInventory(id);
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
