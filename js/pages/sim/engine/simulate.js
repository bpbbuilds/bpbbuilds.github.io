/**
 * Combat engine orchestrator — Band B core + Band C systems.
 */

import { compareSimEvents, SIM_DURATION_SEC } from '../sim-events.js';
import {
  createActor,
  regenStamina,
  snapshotActor,
  addStack,
  isStunned,
  applyDamageToActor,
  applyStaminaSackInventoryMax,
  DUMMY_ATTACK_CD,
  DUMMY_ATTACK_DAMAGE,
  DUMMY_ATTACK_ACCURACY,
} from './actor.js';
import { takeDamage } from './damage.js';
import { makeRng } from './rng.js';
import { computeCoverage } from './coverage.js';
import { buildBoardGraph } from './board-graph.js';
import { buildCombatPieces, activeLoopPieces } from './pieces.js';
import { activatePiece } from './combat-activate.js';
import { runCharacterTick } from './ticks.js';
import { getScriptHandler } from './scripts/registry.js';
import { combatStartGemSockets, prepareGemSockets } from './gem-sockets.js';
import { buildCombatStartOrder } from './combat-start-priority.js';
import { deliverCharge, leaveCharge, processChargeJob, clearChargeTrackers } from './charge-delivery.js';
import { tickTimedSpeeds } from './timed-speed.js';
import { tickTimedResistances } from './timed-resistance.js';
import { tickBattleRage } from './battle-rage.js';
import { snapshotPieceStats } from './piece-stats.js';
import { collectPieceActivationAudits } from './report-weapon-audit.js';
import { assignAllDeckChains } from './scripts/card-chain.js';
import { armPieceCooldown, rearmAfterTrigger, rollIterationCooldown } from './cooldown.js';
import { pieceSpeed } from './piece-stats.js';
import { tickTemporaryStacks } from './buff-economy.js';
import { bindBuffCombatLog, unbindBuffCombatLog, collapseDuplicateBuffLogs } from './buff-log.js';
import { bindBuffPowerPieces, unbindBuffPowerPieces } from './buff-power.js';
import {
  FATIGUE_TICK_INTERVAL,
  advanceFatigueCounter,
  applyFatigueDamage,
  createFatigueState,
} from './fatigue.js';
import { createCombatBus } from './combat-bus.js';
import { createLogChainAllocator } from './log-chain.js';
import { applyUnhealingHit, flushUnloggedHeal } from './unhealing.js';
import { ctxForPiece, ownerStacks, tagOpponentPlacements } from './vs-board.js';
import { actorMaxHpForSim } from './round-health.js';

/** Game.COMBAT_DELAY */
export const COMBAT_DELAY = 2.5;
export const TICK_INTERVAL = 1.0;
const DT = 0.05;
const SNAPSHOT_EVERY = 0.5;

/**
 * @param {{ id: string, key: string }[]} placements
 * @param {Map<string, object>} itemsById
 * @param {import('./actor.js').SimActor} player
 * @param {import('../sim-events.js').SimEvent[]} events
 * @param {number} t
 * @param {import('./pieces.js').CombatPiece[]} pieces
 */
function applyPreCombat(placements, itemsById, actor, events, t, pieces) {
  // Block stacks only come from item scripts (giveBlock / onCombatStart) —
  // catalog `item.block` is shield power / tooltip, not free start Block.
  let dr = 0;
  let spikes = 0;
  void placements;
  void itemsById;
  for (const piece of pieces) {
    if (piece.kind !== 'armor') continue;
    dr += piece.damageReduction;
    spikes += piece.spikes;
    if (piece.gemNames.length) {
      events.push({
        t: t + 0.015,
        type: 'info',
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name} gems: ${piece.gemNames.join(', ')}`,
        meta: { category: 'gem' },
      });
    }
  }
  actor.damageReduction += dr;
  if (spikes > 0) {
    addStack(actor, 'spikes', spikes);
    events.push({
      t: t + 0.02,
      type: 'buff',
      actor: actor.id,
      target: actor.id,
      amount: spikes,
      label: `Armor: +${spikes} Spikes`,
      meta: { stack: 'spikes', category: 'buff', systemOrigin: 'Armor' },
    });
  }
  // Passive armor DR applies to combat math only — not a Combat Log line in-game.
}

/**
 * @param {{
 *   placements: { id: string, x?: number, y?: number, r?: number, key: string, gems?: string[] }[],
 *   itemsById: Map<string, object>,
 *   durationSec?: number,
 *   seed?: number,
 *   canAffect?: object | null,
 *   dummyBlock?: number,
 *   dummyMaxHp?: number | null,
 *   dummyAttacks?: boolean,
 *   dummyAttackDamage?: number | null,
 *   dummyAttackCd?: number | null,
 *   opponentPlacements?: { id: string, key: string, gems?: string[] }[],
 *   round?: number | null,
 *   opponentRound?: number | null,
 *   playerMaxHp?: number | null,
 *   playerMaxStamina?: number | null,
 *   opponentMaxHp?: number | null,
 *   opponentMaxStamina?: number | null,
 *   captureLifecycle?: boolean,
 * }} opts
 * @returns {import('../sim-events.js').SimRun}
 */
export function simulateEngine(opts) {
  const durationSec = opts.durationSec ?? SIM_DURATION_SEC;
  const seed = opts.seed ?? 0xb0bd2026;
  const rng = makeRng(seed);
  const coverage = computeCoverage(opts.placements, opts.itemsById);
  const canAffect = opts.canAffect || null;
  const dummyBlockRaw = Math.max(0, Math.round(Number(opts.dummyBlock) || 0));
  const themPl = tagOpponentPlacements(opts.opponentPlacements || []);
  const vsBoard = themPl.length > 0;
  // Training-dummy start block is dummy-only; vs boards (public / mirror) start at 0.
  const dummyBlock = vsBoard ? 0 : dummyBlockRaw;
  const hp = actorMaxHpForSim(opts.round, vsBoard, opts.opponentRound);
  const playerHp = opts.playerMaxHp ?? hp.player;
  const dummyMaxOverride = Number(opts.dummyMaxHp);
  const dummyHp = vsBoard
    ? opts.opponentMaxHp ?? hp.dummy
    : Number.isFinite(dummyMaxOverride) && dummyMaxOverride > 0
      ? Math.round(dummyMaxOverride)
      : hp.dummy;
  const dummyAttacks = opts.dummyAttacks !== false;
  const dummyAtkDmg = Math.max(
    0,
    Math.round(
      Number.isFinite(Number(opts.dummyAttackDamage))
        ? Number(opts.dummyAttackDamage)
        : DUMMY_ATTACK_DAMAGE,
    ),
  );
  const dummyAtkCd = Math.max(
    0.05,
    Number.isFinite(Number(opts.dummyAttackCd)) && Number(opts.dummyAttackCd) > 0
      ? Number(opts.dummyAttackCd)
      : DUMMY_ATTACK_CD,
  );
  // Max stamina = base 5 + Stamina Sacks on the board (Character.recalculateMaxStamina).
  // Do not use history.stamina — that field is a checksum of the same formula, and
  // treating it as an override skipped sacks and inflated start pools (e.g. 13→15).
  /** @type {{ maxHp: number, block?: number }} */
  const playerOpts = { maxHp: playerHp };
  const player = createActor('player', playerOpts);
  /** @type {{ maxHp: number, block?: number }} */
  const dummyOpts = { maxHp: dummyHp };
  if (dummyBlock > 0) dummyOpts.block = dummyBlock;
  const dummy = createActor('dummy', dummyOpts);
  const youGraph = buildBoardGraph(opts.placements, opts.itemsById);
  const themGraph = vsBoard
    ? buildBoardGraph(themPl, opts.itemsById)
    : youGraph;
  const youPieces = buildCombatPieces(opts.placements, opts.itemsById);
  const themPieces = vsBoard ? buildCombatPieces(themPl, opts.itemsById) : [];
  applyStaminaSackInventoryMax(player, youPieces);
  if (vsBoard) applyStaminaSackInventoryMax(dummy, themPieces);
  const pieces = [...youPieces, ...themPieces];
  const loopPieces = () => activeLoopPieces(pieces);
  const youCardKeys = youPieces.filter((p) => p.kind === 'card').map((p) => p.placementKey);
  const themCardKeys = themPieces.filter((p) => p.kind === 'card').map((p) => p.placementKey);
  const cardKeys = youCardKeys;
  const deckIndex = { i: 0 };
  const youDeck = deckIndex;
  const themDeck = { i: 0 };
  let t = 0;
  /** Combat-start scripts run while `t` is still 0; log/HUD time should be COMBAT_DELAY. */
  let logClockOverride = /** @type {number | null} */ (null);

  /** @type {import('../sim-events.js').SimEvent[]} */
  const events = [];
  /** Test-only source lifecycle trace; never used as user-facing combat data. */
  const lifecycle = opts.captureLifecycle ? [] : null;
  const traceLifecycle = (phase, piece, at = t) => {
    lifecycle?.push({
      phase,
      t: at,
      side: piece.side === 'them' ? 'dummy' : 'player',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
    });
  };
  bindBuffCombatLog({
    events,
    getT: () => (logClockOverride != null ? logClockOverride : t),
    dummy,
  });
  bindBuffPowerPieces(pieces);
  try {
    return simulateEngineBody();
  } finally {
    unbindBuffPowerPieces();
    unbindBuffCombatLog();
  }

  function simulateEngineBody() {
  /** @type {import('../sim-events.js').SimSnapshot[]} */
  const snapshots = [];
  /** @type {{ t: number, byKey: Record<string, {
   *   itemId: string,
   *   damageMin: number,
   *   damageMax: number,
   *   damageBonus: number,
   *   cooldown: number,
   *   triggerTime: number,
   *   staminaCost: number,
   * }> }}[] */
  const pieceSnapshots = [];

  const snapshotPieces = () => {
    /** @type {Record<string, object>} */
    const byKey = {};
    for (const p of pieces) {
      // Heat / Empower / Luck are per-character — never apply your stacks to opp tips.
      const actor = p.side === 'them' ? dummy : player;
      const stacks = actor.stacks;
      byKey[p.placementKey] = snapshotPieceStats(p, stacks, {
        stackGrantByOrigin: actor.stackGrantByOrigin || null,
      });
    }
    return byKey;
  };

  let tickAccum = 0;
  let tickCounter = 0;
  let snapAccum = 0;
  let dummyCd = dummyAtkCd;
  let itemsLive = false;
  const logChain = createLogChainAllocator();
  const bus = createCombatBus();
  const fatigue = createFatigueState();
  player._combatBus = bus;
  dummy._combatBus = bus;
  player._eventLog = events;
  dummy._eventLog = events;
  for (const p of youPieces) {
    p._eventLog = events;
    p._owner = player;
  }
  for (const p of themPieces) {
    p._eventLog = events;
    p._owner = dummy;
  }
  bus.on('actor_healed', (payload) => {
    const healer = payload?.actor;
    if (!healer || (healer.id !== 'player' && healer.id !== 'dummy')) return;
    const foe = healer.id === 'player' ? dummy : player;
    const logged = Number(payload.loggedAmount ?? payload.amount) || 0;
    const at = Number.isFinite(Number(payload.t)) ? Number(payload.t) : t;
    applyUnhealingHit({
      healer,
      foe,
      logged,
      t: at,
      events,
      rng,
      deferLog: Boolean(healer._deferUnhealLog),
    });
  });

  assignAllDeckChains({
    pieces: youPieces,
    graph: youGraph,
    itemsById: opts.itemsById,
    canAffect,
  });
  if (vsBoard) {
    assignAllDeckChains({
      pieces: themPieces,
      graph: themGraph,
      itemsById: opts.itemsById,
      canAffect,
    });
  }

  const pushSnap = (atT = t) => {
    snapshots.push({
      t: atT,
      player: snapshotActor(player),
      dummy: snapshotActor(dummy),
    });
    pieceSnapshots.push({ t: atT, byKey: snapshotPieces() });
  };

  // Snapshot on every buff/debuff emit so HUD can step per grant (not once per DT)
  const rawPush = events.push.bind(events);
  events.push = (...args) => {
    const n = rawPush(...args);
    for (const ev of args) {
      if (ev?.type === 'heal') {
        const who = ev.actor === 'dummy' ? dummy : player;
        const last = who._lastHeal;
        if (last && !last.meterAttached) {
          ev.meta = {
            ...(ev.meta || {}),
            loggedAmount: last.loggedAmount,
            overheal: last.overheal,
          };
          last.meterAttached = true;
        }
      }
      if (!ev || (ev.type !== 'buff' && ev.type !== 'debuff' && ev.type !== 'stat')) continue;
      // Stamp the actor as it is *now*. Using ev.t while the delay clock
      // was still 0–2.5 wrote empty HP/Lucky onto t=3.05+ (HUD 14↔0).
      const at = t + 1e-9 >= COMBAT_DELAY ? t : Number(ev.t) || COMBAT_DELAY;
      if (at + 1e-9 < COMBAT_DELAY) continue;
      pushSnap(at);
      snapAccum = 0;
    }
    return n;
  };

  pushSnap(0);

  events.push({
    t: 0,
    type: 'fight_start',
    label: 'Engine fight start',
    meta: { seed, mode: 'engine', category: 'system' },
  });

  logClockOverride = COMBAT_DELAY;
  applyPreCombat(
    opts.placements,
    opts.itemsById,
    player,
    events,
    COMBAT_DELAY,
    youPieces,
  );
  if (vsBoard) {
    applyPreCombat(themPl, opts.itemsById, dummy, events, COMBAT_DELAY, themPieces);
  }

  const notifyDealtDamage = (piece, hitCtx, hitResult) => {
    const script = getScriptHandler(piece.itemId);
    script?.onDealtDamage?.(piece, hitCtx, hitResult);
  };
  const notifyPreDealDamageEarly = (piece, hitCtx, damageRes) => {
    const script = getScriptHandler(piece.itemId);
    script?.onPreDealDamageEarly?.(piece, hitCtx, damageRes);
  };
  const notifyPreDealDamageLate = (piece, hitCtx, damageRes) => {
    const script = getScriptHandler(piece.itemId);
    script?.onPreDealDamageLate?.(piece, hitCtx, damageRes);
    for (const fn of piece._preDealLate || []) fn?.(damageRes);
  };

  const world = {
    you: player,
    them: dummy,
    youGraph,
    themGraph,
    youPieces,
    themPieces,
    youDeck,
    themDeck,
    youCardKeys,
    themCardKeys,
    t: COMBAT_DELAY,
    rng,
    events,
    itemsById: opts.itemsById,
    canAffect,
    activatePiece,
    bus,
    fatigue,
    logChain,
    notifyDealtDamage,
    notifyPreDealDamageEarly,
    notifyPreDealDamageLate,
    chargeJobs: [],
  };

  clearChargeTrackers();

  player._simT = COMBAT_DELAY;
  dummy._simT = COMBAT_DELAY;
  // Game Item.prepare(): chanceRng.reset() before onPrepare / combat-start scripts.
  for (const piece of pieces) {
    piece.chanceRng?.reset?.();
    traceLifecycle('prepare', piece, 0);
    const script = getScriptHandler(piece.itemId);
    const prepareCtx = { ...ctxForPiece(piece, world), t: 0 };
    script?.onPrepare?.(piece, prepareCtx);
  }
  const startOrder = buildCombatStartOrder(youPieces, themPieces, rng);
  /** @type {Map<string, number>} */
  const combatStartOrderMap = new Map();
  for (let i = 0; i < startOrder.length; i += 1) {
    combatStartOrderMap.set(startOrder[i].placementKey, i);
  }
  // Item.gd preCombatStart: socket pre-start work, then adjustCooldown /
  // activateCooldown, then onPreCombatStart. Socket preparation must happen
  // before arming because it can alter host speed and listeners.
  for (const piece of startOrder) {
    const sc = ctxForPiece(piece, world);
    sc.combatStartSeq = combatStartOrderMap.get(piece.placementKey);
    traceLifecycle('socket_prepare', piece, COMBAT_DELAY);
    prepareGemSockets(piece, sc);
  }
  for (const piece of startOrder) {
    traceLifecycle('cooldown_arm', piece, COMBAT_DELAY);
    armPieceCooldown(piece, ownerStacks(piece, world), rng, {
      opponent: piece.side === 'them',
    });
  }
  for (const piece of startOrder) {
    const script = getScriptHandler(piece.itemId);
    const sc = ctxForPiece(piece, world);
    sc.combatStartSeq = combatStartOrderMap.get(piece.placementKey);
    traceLifecycle('pre_combat_start', piece, COMBAT_DELAY);
    script?.onPreCombatStart?.(piece, sc);
  }
  for (const piece of startOrder) {
    const script = getScriptHandler(piece.itemId);
    const sc = ctxForPiece(piece, world);
    sc.combatStartSeq = combatStartOrderMap.get(piece.placementKey);
    traceLifecycle('socket_combat_start', piece, COMBAT_DELAY);
    combatStartGemSockets(piece, sc);
    traceLifecycle('combat_start', piece, COMBAT_DELAY);
    script?.onCombatStart?.(piece, sc);
  }
  // Game Item.postCombatStart is a separate third pass after every item's
  // combatStart. Keep it explicit so post-start effects cannot accidentally
  // interleave with start-of-battle grants.
  for (const piece of startOrder) {
    const script = getScriptHandler(piece.itemId);
    const sc = ctxForPiece(piece, world);
    sc.combatStartSeq = combatStartOrderMap.get(piece.placementKey);
    traceLifecycle('post_combat_start', piece, COMBAT_DELAY);
    script?.onPostCombatStart?.(piece, sc);
  }
  flushUnloggedHeal(player, events, COMBAT_DELAY);
  flushUnloggedHeal(dummy, events, COMBAT_DELAY);
  // Combat-start stats (Unhealing, heal amp, …) land after the t=0 snap
  pushSnap(COMBAT_DELAY);
  logClockOverride = null;

  // Consumables without CD: fire once at combat start
  for (const piece of pieces) {
    if (piece.kind !== 'consumable' || piece.charges == null) continue;
    if (piece.cooldown < 500) continue;
    piece.triggerTime = 0;
  }

  const actCtx = (piece) => {
    world.t = t;
    return ctxForPiece(piece || { side: 'you' }, world);
  };

  const drainChargeJobs = (untilT) => {
    if (!world.chargeJobs.length) return;
    world.chargeJobs.sort((a, b) => a.at - b.at);
    while (world.chargeJobs.length && untilT + 1e-9 >= world.chargeJobs[0].at) {
      const job = world.chargeJobs.shift();
      world.t = job.at;
      processChargeJob(job, { pieces }, actCtx);
    }
    world.t = untilT;
  };

  // Combat-start already applied at COMBAT_DELAY. Do not run the clock
  // 0→2.5 again (that mixed empty-board snaps into t≈3+).
  t = COMBAT_DELAY;
  player._simT = t;
  dummy._simT = t;
  world.t = t;
  itemsLive = true;
  events.push({
    t: COMBAT_DELAY,
    type: 'info',
    label: `Items live (combat delay ${COMBAT_DELAY}s)`,
    meta: { category: 'system' },
  });
  for (const piece of pieces) {
    if (piece.kind === 'consumable' && piece.charges != null && piece.alive) {
      if (piece.cooldown >= 500) {
        const script = getScriptHandler(piece.itemId);
        if (script?.onCombatStart) continue;
        if (script?.deferStartActivate) continue;
        activatePiece(piece, { ...actCtx(piece), t: COMBAT_DELAY });
        piece.triggerTime = piece.cooldown;
      }
    }
  }
  // Generator combat-start charge lands at COMBAT_DELAY — process before first tick.
  drainChargeJobs(COMBAT_DELAY);

  while (t < durationSec - 1e-9 && !player.dead && !dummy.dead) {
    const step = Math.min(DT, durationSec - t);
    t += step;
    player._simT = t;
    dummy._simT = t;
    tickAccum += step;
    snapAccum += step;
    const eventsLenBeforeStep = events.length;

    regenStamina(player, step);
    regenStamina(dummy, step);
    tickTemporaryStacks(player, t, events);
    tickTemporaryStacks(dummy, t, events);

    if (itemsLive) {
      const combatTime = t - COMBAT_DELAY;
      if (!fatigue.started && combatTime + 1e-9 >= fatigue.startAt) {
        fatigue.started = true;
        fatigue.nextTickAt = t;
        bus.emit('fatigue_start', { t, combatTime });
        events.push({
          t,
          type: 'info',
          label: 'Fatigue starts',
          meta: { category: 'system', fatigue: true, phase: 'start' },
        });
      }
      while (
        fatigue.started &&
        Number.isFinite(fatigue.nextTickAt) &&
        t + 1e-9 >= fatigue.nextTickAt &&
        !player.dead &&
        !dummy.dead
      ) {
        const dmg = advanceFatigueCounter(fatigue, combatTime);
        const pLost = applyFatigueDamage(player, dmg);
        const dLost = applyFatigueDamage(dummy, dmg);
        bus.emit('fatigue_tick', { t, counter: fatigue.counter, damage: dmg });
        if (pLost > 0) {
          bus.emit('player_damaged', {
            t,
            hit: true,
            healthDamage: pLost,
            blocked: 0,
          });
          events.push({
            t,
            type: 'damage',
            actor: 'system',
            target: 'player',
            amount: pLost,
            label: `Fatigue ${fatigue.counter}: ${pLost} to player`,
            meta: {
              category: 'damage',
              fatigue: true,
              counter: fatigue.counter,
              systemOrigin: 'Fatigue',
              playerHp: player.hp,
            },
          });
        }
        if (dLost > 0) {
          events.push({
            t,
            type: 'damage',
            actor: 'system',
            target: 'dummy',
            amount: dLost,
            label: `Fatigue ${fatigue.counter}: ${dLost} to dummy`,
            meta: {
              category: 'damage',
              fatigue: true,
              counter: fatigue.counter,
              systemOrigin: 'Fatigue',
              dummyHp: dummy.hp,
            },
          });
        }
        fatigue.nextTickAt = t + FATIGUE_TICK_INTERVAL;
      }

      // Deferred charge path jobs (stat + deliver/leave) then legacy path-only queues
      drainChargeJobs(t);
      for (const piece of pieces) {
        const qLeave = piece.pendingChargeLeaves;
        if (qLeave?.length && piece.alive) {
          while (qLeave.length && t + 1e-9 >= qLeave[0].at) {
            const job = qLeave.shift();
            leaveCharge(piece, { ...actCtx(piece), t }, job?.meta || {});
          }
        }
        const q = piece.pendingCharges;
        if (q?.length && piece.alive) {
          while (q.length && t + 1e-9 >= q[0].at) {
            const job = q.shift();
            deliverCharge(piece, { ...actCtx(piece), t }, job?.meta || {});
          }
        }
        if (
          piece._engTimerAt != null &&
          t + 1e-9 >= piece._engTimerAt &&
          piece.alive
        ) {
          getScriptHandler(piece.itemId)?.onQueuedChargeTimeout?.(piece, {
            ...actCtx(piece),
            t,
          });
        }
      }
      tickTimedSpeeds(pieces, t);
      tickTimedResistances([player, dummy], t);
      tickBattleRage(player, t, { bus });
      tickBattleRage(dummy, t, { bus });
      for (const piece of pieces) {
        piece._lastSimT = t;
        if (typeof piece._tryCrownInvuln === 'function') piece._tryCrownInvuln(t);
      }

      // Decrement every ready piece first, then activate in fireT order.
      // Board-list order + interpolated stamps used to let a later fireT
      // (Bloodthorne) run before an earlier one (Mecha Bat) in the same DT —
      // vamp heal then missed stacks the log still showed as already granted.
      const ready = loopPieces();
      /** @type {{ piece: object, spd: number, trigBefore: number, stacks: object, cdOpts: object, firedThisStep: boolean }[]} */
      const stepEntries = [];
      for (const piece of ready) {
        const stacks = ownerStacks(piece, world);
        const cdOpts = { opponent: piece.side === 'them' };
        // Item._physics_process: triggerTime -= delta * getSpeed()
        const spd = pieceSpeed(piece, stacks);
        const trigBefore = piece.triggerTime;
        piece.triggerTime -= step * spd;
        stepEntries.push({
          piece,
          spd,
          trigBefore,
          stacks,
          cdOpts,
          firedThisStep: false,
        });
      }

      const fireTFor = (entry) => {
        const { spd, trigBefore, firedThisStep } = entry;
        // Stamp at the instant CD crossed 0 within this DT (not always step end).
        if (
          !firedThisStep &&
          spd > 0 &&
          Number.isFinite(trigBefore) &&
          trigBefore > 0
        ) {
          return Math.max(t - step, t - step + trigBefore / spd);
        }
        return t;
      };

      while (!player.dead && !dummy.dead) {
        /** @type {(typeof stepEntries)[number] | null} */
        let best = null;
        let bestFireT = Infinity;
        for (const entry of stepEntries) {
          const { piece, cdOpts } = entry;
          if (!piece.alive || piece.triggerTime > 0) continue;
          if (piece._cdLocked) {
            piece.triggerTime += rollIterationCooldown(piece, rng, cdOpts);
            continue;
          }
          const owner = piece.side === 'them' ? dummy : player;
          if (isStunned(owner, t)) {
            piece.triggerTime += rollIterationCooldown(piece, rng, cdOpts);
            continue;
          }
          const fireT = fireTFor(entry);
          if (fireT < bestFireT - 1e-12) {
            best = entry;
            bestFireT = fireT;
            continue;
          }
          if (Math.abs(fireT - bestFireT) > 1e-12 || !best) continue;
          // Same instant: higher priority first (buildCombatPieces order).
          const bp = best.piece;
          if (
            (piece.priority || 0) > (bp.priority || 0) ||
            ((piece.priority || 0) === (bp.priority || 0) &&
              String(piece.name || '').localeCompare(String(bp.name || '')) < 0)
          ) {
            best = entry;
            bestFireT = fireT;
          }
        }
        if (!best) break;

        const { piece, stacks, cdOpts } = best;
        const fireT = bestFireT;
        best.firedThisStep = true;
        // grantStacks auto-log uses getT() — pin to fireT so it matches port pushes
        // (same-tick duplicates were leaf_badge / banana / lovers style doubles).
        logClockOverride = fireT;
        player._simT = fireT;
        dummy._simT = fireT;
        const ok = activatePiece(piece, { ...actCtx(piece), t: fireT });
        logClockOverride = null;
        player._simT = t;
        dummy._simT = t;
        flushUnloggedHeal(player, events, fireT);
        flushUnloggedHeal(dummy, events, fireT);
        // Piece mutators (Oil Lamp dmg/acc, haste) — refresh tip snapshots
        if (ok) pushSnap(fireT);
        if (piece.kind === 'card' && !piece._revealing) {
          piece.cooldown = 999;
          piece.triggerTime = 999;
          continue;
        }
        rearmAfterTrigger(piece, stacks, rng, cdOpts);
        // Match prior per-piece loop: starved non-charge items still rearm, but
        // do not spin another activation in this DT (rearm leaves triggerTime > 0).
        if (!ok && piece.charges == null) continue;
      }

      // Dummy AI — skipped when an opponent bag is fighting or attacks disabled
      if (!vsBoard && dummyAttacks) {
      dummyCd -= step;
      while (dummyCd <= 0 && !player.dead && !dummy.dead) {
        if (isStunned(dummy, t)) {
          dummyCd += dummyAtkCd;
          break;
        }
        events.push({
          t,
          type: 'activate',
          actor: 'dummy',
          label: 'Training Dummy: swing',
          meta: { category: 'damage', systemOrigin: 'Training Dummy' },
        });
        const dummyAcc = Math.max(
          0,
          Math.min(
            100,
            DUMMY_ATTACK_ACCURACY +
              ((Number(dummy.stacks?.lucky) || 0) - (Number(dummy.stacks?.blind) || 0)) * 5,
          ),
        );
        const res = takeDamage(player, dummy, {
          amount: dummyAtkDmg,
          accuracy: dummyAcc,
          canMiss: true,
          isAttack: true,
          isMelee: true,
          nowT: t,
          bus,
          rng,
        });
        bus.emit('player_damaged', {
          t,
          hit: res.hit,
          healthDamage: res.healthDamage,
          blocked: res.blocked,
        });
        if (!res.hit) {
          events.push({
            t: t + 0.001,
            type: 'miss',
            actor: 'dummy',
            target: 'player',
            label: 'Training Dummy: missed',
            meta: { category: 'damage', systemOrigin: 'Training Dummy', isAttack: true },
          });
        } else {
          events.push({
            t: t + 0.002,
            type: 'damage',
            actor: 'dummy',
            target: 'player',
            amount: res.healthDamage,
            label:
              res.blocked > 0 || res.reduced > 0
                ? `Training Dummy: hit ${dummyAtkDmg} (DR/block) → ${res.healthDamage}`
                : `Training Dummy: hit for ${res.healthDamage}`,
            meta: {
              category: 'damage',
              systemOrigin: 'Training Dummy',
              isAttack: true,
              raw: dummyAtkDmg,
              blocked: res.blocked,
              reduced: res.reduced,
              playerHp: player.hp,
              dummyHp: dummy.hp,
            },
          });
          if (res.spikeDamage > 0) {
            events.push({
              t: t + 0.003,
              type: 'damage',
              actor: 'player',
              target: 'dummy',
              amount: res.spikeDamage,
              label: `Spikes: ${res.spikeDamage} damage`,
              meta: {
                category: 'damage',
                stack: 'spikes',
                systemOrigin: 'Spikes',
                dummyHp: dummy.hp,
                playerHp: player.hp,
              },
            });
          }
        }
        dummyCd += dummyAtkCd;
      }
      }

    }

    while (tickAccum + 1e-9 >= TICK_INTERVAL) {
      tickAccum -= TICK_INTERVAL;
      const tickT = t;
      const beforeLen = events.length;
      runCharacterTick(player, tickT, tickCounter, events);
      runCharacterTick(dummy, tickT, tickCounter, events);
      flushUnloggedHeal(player, events, tickT);
      flushUnloggedHeal(dummy, events, tickT);
      if (events.length > beforeLen) {
        events.push({
          t: tickT,
          type: 'tick',
          label: `Tick ${tickCounter}`,
          meta: { tickCounter, category: 'system' },
        });
      }
      tickCounter += 1;
    }

    // Snapshot immediately when stacks change so HUD buff icons track grants
    let stackSnap = false;
    for (let i = eventsLenBeforeStep; i < events.length; i++) {
      const ty = events[i]?.type;
      if (ty === 'buff' || ty === 'debuff') {
        stackSnap = true;
        break;
      }
    }
    if (t + 1e-9 < COMBAT_DELAY) {
      /* no HUD snaps during the post-start delay clock */
    } else if (stackSnap) {
      snapAccum = 0;
      pushSnap();
    } else if (snapAccum >= SNAPSHOT_EVERY) {
      snapAccum = 0;
      pushSnap();
    }
  }

  const endT = Math.min(durationSec, t);
  pushSnap();

  // Charge paths pre-queue cell log lines at future t; drop any that never fired.
  const trimAfter = endT + 1e-6;
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const ev = events[i];
    if (ev?.type === 'fight_start') continue;
    if ((Number(ev?.t) || 0) > trimAfter) events.splice(i, 1);
  }
  for (const ev of events) {
    const t = Number(ev?.t) || 0;
    if (Math.abs(t - COMBAT_DELAY) > 0.02) continue;
    const key = ev.placementKey ? String(ev.placementKey) : '';
    if (!key || !combatStartOrderMap.has(key)) continue;
    ev.meta = {
      ...(ev.meta || {}),
      combatStartSeq: combatStartOrderMap.get(key),
      combatStart: true,
    };
  }
  for (let i = snapshots.length - 1; i >= 0; i -= 1) {
    if ((Number(snapshots[i]?.t) || 0) > trimAfter) snapshots.splice(i, 1);
  }
  for (let i = pieceSnapshots.length - 1; i >= 0; i -= 1) {
    if ((Number(pieceSnapshots[i]?.t) || 0) > trimAfter) pieceSnapshots.splice(i, 1);
  }

  collapseDuplicateBuffLogs(events);
  // Reactive buff listeners can belong to an earlier-starting item than the
  // grant that woke them. Keep each complete causal chain in its source
  // item's batch after duplicate labels have been collapsed into port lines.
  const causalStartSeq = new Map();
  for (const ev of events) {
    const root = ev.meta?.causalRootId;
    const depth = Number(ev.meta?.causalDepth) || 0;
    const seq = Number(ev.meta?.combatStartSeq);
    if (root == null || depth !== 0 || !Number.isFinite(seq)) continue;
    causalStartSeq.set(root, seq);
  }
  for (const ev of events) {
    const root = ev.meta?.causalRootId;
    const baseSeq = root != null ? causalStartSeq.get(root) : Number(ev.meta?.combatStartSeq);
    if (!Number.isFinite(baseSeq)) continue;
    const depth = root != null ? Number(ev.meta?.causalDepth) || 0 : 0;
    // A small fractional tier keeps the source before every listener reaction
    // while retaining normal placement ordering between independent chains.
    ev.meta = { ...(ev.meta || {}), causalStartSeq: baseSeq, causalLogOrder: baseSeq + depth / 1000 };
  }
  events.sort(compareSimEvents);

  let endLabel = 'Time cap';
  if (dummy.dead) endLabel = 'Dummy defeated';
  else if (player.dead) endLabel = 'Player down';

  events.push({
    t: endT + 1e-6,
    type: 'fight_end',
    label: endLabel,
    meta: {
      category: 'system',
      dummyHp: dummy.hp,
      dummyMaxHp: dummy.maxHp,
      playerHp: player.hp,
      playerMaxHp: player.maxHp,
    },
  });
  snapshots.sort((a, b) => a.t - b.t);
  pieceSnapshots.sort((a, b) => a.t - b.t);
  const collapseSameT = (list) => {
    const out = [];
    for (const s of list) {
      const last = out[out.length - 1];
      if (last && Math.abs(last.t - s.t) <= 1e-9) out[out.length - 1] = s;
      else out.push(s);
    }
    return out;
  };
  snapshots.splice(0, snapshots.length, ...collapseSameT(snapshots));
  pieceSnapshots.splice(0, pieceSnapshots.length, ...collapseSameT(pieceSnapshots));

  const summary = {
    seed,
    endReason: dummy.dead
      ? 'dummy_dead'
      : player.dead
        ? 'player_dead'
        : 'time_cap',
    player: snapshotActor(player),
    dummy: snapshotActor(dummy),
    coverage,
    pieceCount: pieces.length,
    cardCount: cardKeys.length,
    petCount: pieces.filter((p) => p.kind === 'pet').length,
  };

  return {
    mode: 'engine',
    durationSec: endT,
    dummyMaxHp: dummy.maxHp,
    dummyEndHp: dummy.hp,
    playerMaxHp: player.maxHp,
    playerEndHp: player.hp,
    events,
    snapshots,
    pieceSnapshots,
    activationAudits: collectPieceActivationAudits(pieces),
    lifecycle,
    summary,
    coverage,
    dummyStartBlock: dummyBlock,
  };
  }
}
