/**
 * Shared SimEvent contract — demo timeline and engine both emit this shape.
 * Aligns with docs/sim-combat-audit.md (game CombatEvent / EventType).
 */

/**
 * @typedef {'player' | 'dummy'} SimActor
 */

/**
 * @typedef {'fight_start' | 'fight_end' | 'tick' | 'activate' | 'damage' | 'miss'
 *   | 'heal' | 'buff' | 'debuff' | 'stamina' | 'cooldown' | 'info' | 'charge' | 'stat'} SimEventType
 */

/**
 * @typedef {{
 *   t: number,
 *   type: SimEventType,
 *   actor?: SimActor,
 *   target?: SimActor,
 *   itemId?: string,
 *   placementKey?: string,
 *   amount?: number,
 *   label?: string,
 *   meta?: Record<string, unknown> & {
 *     category?: string,
 *     stack?: string,
 *     parentId?: string | number,
 *     eventId?: string | number,
 *     depth?: number,
 *     critical?: boolean,
 *   },
 * }} SimEvent
 */

/**
 * @typedef {{
 *   hp: number,
 *   maxHp: number,
 *   stamina: number,
 *   maxStamina: number,
 *   block: number,
 *   regeneration: number,
 *   poison: number,
 *   heat?: number,
 *   cold?: number,
 *   blind?: number,
 *   spikes?: number,
 *   vampirism?: number,
 *   empower?: number,
 *   lucky?: number,
 *   mana?: number,
 *   dead: boolean,
 *   healAmp?: number,
 *   unhealing?: number,
 *   combatStats?: Record<string, number>,
 *   temp?: Record<string, { amount: number, expiresAt: number }>,
 * }} SimActorSnap
 */

/**
 * @typedef {{
 *   t: number,
 *   player: SimActorSnap,
 *   dummy: SimActorSnap,
 * }} SimSnapshot
 */

/**
 * @typedef {{
 *   total: number,
 *   scripted: number,
 *   engineMatch?: number,
 *   handlerExists?: number,
 *   catalogCd: number,
 *   passive: number,
 *   noop?: number,
 *   supported: number,
 *   pct: number,
 *   label: string,
 * }} SimCoverage
 */

/**
 * @typedef {{
 *   mode: 'demo' | 'engine',
 *   durationSec: number,
 *   dummyMaxHp: number,
 *   dummyEndHp: number,
 *   playerMaxHp?: number,
 *   playerEndHp?: number,
 *   events: SimEvent[],
 *   snapshots?: SimSnapshot[],
 *   pieceSnapshots?: { t: number, byKey: Record<string, object> }[],
 *   summary?: Record<string, unknown>,
 *   coverage?: SimCoverage,
 * }} SimRun
 */

export const SIM_DURATION_SEC = 30;
export const DEMO_DUMMY_MAX_HP = 1200;

/** Same-t ordering: resolve hits before fight_end, keep fight_start first. */
const SIM_EVENT_ORDER = /** @type {Record<string, number>} */ ({
  fight_start: 0,
  tick: 10,
  info: 20,
  activate: 30,
  stat: 35,
  buff: 55,
  debuff: 45,
  heal: 50,
  stamina: 55,
  damage: 40,
  miss: 65,
  cooldown: 80,
  charge: 85,
  fight_end: 999,
});

/**
 * Combat-log side for sort: 0 = you, 1 = opponent (matches Game player batch then opponent).
 * @param {import('./sim-events.js').SimEvent} ev
 */
export function logSideRank(ev) {
  const key = ev.placementKey ? String(ev.placementKey) : '';
  if (key.startsWith('opp:')) return 1;
  if (ev.actor === 'dummy') return 1;
  if (ev.actor === 'player') return 0;
  if (ev.target === 'player' && (ev.type === 'damage' || ev.type === 'debuff')) return 1;
  if (ev.target === 'dummy' && (ev.type === 'damage' || ev.type === 'miss')) return 0;
  return 0;
}

/**
 * Same-t type rank. Intentional stack spends (meta.used / LOG_USE_BUFF) sort
 * before damage — HungryBlade onPreDealDamage_early logs use→vamp before the hit.
 * @param {SimEvent} ev
 */
function eventTypeOrder(ev) {
  if ((ev.type === 'buff' || ev.type === 'debuff') && ev.meta?.used) return 36;
  return SIM_EVENT_ORDER[ev.type] ?? 50;
}

/**
 * @param {SimEvent} a
 * @param {SimEvent} b
 */
export function compareSimEvents(a, b) {
  if (a.t !== b.t) return a.t - b.t;
  const sideA = logSideRank(a);
  const sideB = logSideRank(b);
  if (sideA !== sideB) return sideA - sideB;
  const seqA = Number(a.meta?.combatStartSeq);
  const seqB = Number(b.meta?.combatStartSeq);
  if (Number.isFinite(seqA) && Number.isFinite(seqB) && seqA !== seqB) {
    return seqA - seqB;
  }
  const pa = eventTypeOrder(a);
  const pb = eventTypeOrder(b);
  if (pa !== pb) return pa - pb;
  const idA = a.meta?.eventId;
  const idB = b.meta?.eventId;
  const parentA = a.meta?.parentId;
  const parentB = b.meta?.parentId;
  if (parentA != null && parentB == null && idB != null && parentA === idB) return 1;
  if (parentB != null && parentA == null && idA != null && parentB === idA) return -1;
  // Used spend before sibling gain at same type-order (pre-nest).
  if (a.type === 'buff' && b.type === 'buff') {
    const ua = !!a.meta?.used;
    const ub = !!b.meta?.used;
    if (ua !== ub) return ua ? -1 : 1;
  }
  return String(a.type).localeCompare(String(b.type));
}
