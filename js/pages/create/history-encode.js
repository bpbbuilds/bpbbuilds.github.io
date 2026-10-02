/**
 * Write a Backpack Battles history.db the game can open.
 * One run per event entry, from the stored round boards.
 */

import { startingBagIdsForClass } from '../../shared/starting-bags.js';
import {
  BitStream,
  classToIndex,
  deserializeItems,
  loadHistoryCatalog,
  ringPersistBits,
} from './history-decode.js';
import { JUDGING_DUMMY_PLACEMENTS } from './judging-dummy-board.js';
import { getSqlJs } from './history-db.js';

const MAX_HEALTH = 999;
const MAX_STAMINA = 999;
const MAX_SIZE = 10;
/** 1.1.9 — same item-index width as the decode catalog. */
const HISTORY_VERSION = 1001009;
/** History fight copies this column onto the opponent. It is not capped at 999. */
const DUMMY_HEALTH = 99999999999;

const RANK_RATING = {
  bronze: 0,
  silver: 20,
  gold: 50,
  platinum: 100,
  diamond: 200,
  master: 350,
  grandmaster: 550,
  grandma: 850,
  unranked: -1,
};

/**
 * Game `BuildHistoryDB.verifyTables` compares sqlite_schema.sql to these
 * strings and drops both tables when they differ.
 */
const RUN_TABLE_SQL =
  'CREATE TABLE runData (runID int, class int, loadout int, rank int, version int, time int, subclass int, skill1 int, skill2 int, custom text, PRIMARY KEY(runID))';
const ROUND_TABLE_SQL =
  'CREATE TABLE roundData (runID int, roundID int, result int, tries int, health int, stamina int, buildInfo text, PRIMARY KEY(runID, roundID))';

/**
 * @param {import('./history-decode.js').HistoryDecodeCatalog} cat
 */
function idToGidMap(cat) {
  /** @type {Map<string, number>} */
  const map = new Map();
  for (const [gid, id] of Object.entries(cat.gidToId || {})) {
    if (!map.has(id)) map.set(id, Number(gid));
  }
  return map;
}

/**
 * @param {import('./history-decode.js').HistoryDecodeCatalog} cat
 */
function gemIndexMap(cat) {
  /** @type {Map<number, number>} */
  const map = new Map();
  (cat.gems || []).forEach((gid, index) => {
    if (!map.has(gid)) map.set(gid, index);
  });
  return map;
}

/**
 * @param {import('./history-decode.js').HistoryDecodeCatalog} cat
 * @param {number} gid
 */
function socketsFor(cat, gid) {
  const slug = cat.gidToId[String(gid)];
  if (slug && cat.socketsById[slug] != null) return cat.socketsById[slug];
  return 0;
}

/**
 * @param {number} value
 * @param {number} max
 */
function clamp(value, max) {
  const n = Math.round(Number(value) || 0);
  if (n < 0) return 0;
  if (n >= max) return max - 1;
  return n;
}

/**
 * @param {object[]} placements
 * @param {import('./history-decode.js').HistoryDecodeCatalog} cat
 * @param {number} health
 * @param {number} stamina
 */
export function serializeBuildInfo(placements, cat, health, stamina) {
  const bs = new BitStream();
  const ids = idToGidMap(cat);
  const gemsByGid = gemIndexMap(cat);
  bs.push(clamp(health, MAX_HEALTH), MAX_HEALTH);
  bs.push(clamp(stamina, MAX_STAMINA), MAX_STAMINA);

  for (const raw of placements || []) {
    if (!raw || typeof raw !== 'object') continue;
    const id = String(raw.id || '').trim();
    const gid = ids.get(id);
    if (gid == null || gid < 0 || gid >= cat.numItems) continue;
    bs.push(gid, cat.numItems);
    bs.push(clamp(raw.x, MAX_SIZE), MAX_SIZE);
    bs.push(clamp(raw.y, MAX_SIZE), MAX_SIZE);
    bs.push(((Number(raw.r) || 0) % 4 + 4) % 4, 4);

    const nSock = socketsFor(cat, gid);
    if (nSock > 0) {
      const gems = Array.isArray(raw.gems) ? raw.gems : [];
      /** @type {number[]} */
      const indices = [];
      let any = false;
      for (let i = 0; i < nSock; i += 1) {
        const gemId = gems[i] == null || gems[i] === '' ? '' : String(gems[i]);
        const gemGid = gemId ? ids.get(gemId) : undefined;
        const index = gemGid != null ? gemsByGid.get(gemGid) : undefined;
        if (index == null) {
          indices.push(cat.emptySocket);
        } else {
          indices.push(index);
          any = true;
        }
      }
      if (any) {
        bs.push(1, 2);
        for (const index of indices) bs.push(index, cat.totalNumGems);
      } else {
        bs.push(0, 2);
      }
    }

    const ringBits = ringPersistBits(cat, gid);
    if (ringBits > 0) {
      const persist = Number(raw.instance?.persistent?.magicRing) || 0;
      const max = 2 ** ringBits;
      bs.pushBitsize(clamp(persist, max), ringBits);
    }
  }

  return bs.toGodotString();
}

/**
 * @param {string | null | undefined} hero
 * @param {string | null | undefined} bagId
 */
function loadoutForBag(hero, bagId) {
  const ids = startingBagIdsForClass(hero);
  return ids.indexOf(String(bagId || '').trim()) === 1 ? 1 : 0;
}

/**
 * @param {import('./history-decode.js').HistoryDecodeCatalog} cat
 * @param {string | null | undefined} itemId
 */
function gidOrNull(cat, itemId) {
  const id = String(itemId || '').trim();
  if (!id) return null;
  const n = idToGidMap(cat).get(id);
  return n == null ? null : n;
}

/**
 * @param {unknown} raw
 */
function roundsOf(raw) {
  const history = typeof raw === 'string' ? safeJson(raw) : raw;
  if (!history || typeof history !== 'object') return [];
  const rounds = /** @type {{ rounds?: unknown }} */ (history).rounds;
  return Array.isArray(rounds) ? rounds : [];
}

/**
 * @param {string} raw
 */
function safeJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * @param {object[]} builds
 * @param {string} root
 * @returns {Promise<{ bytes: Uint8Array, included: number, skipped: number }>}
 */
export async function buildEventHistoryDb(builds, root) {
  const cat = await loadHistoryCatalog(root);
  const SQL = await getSqlJs(root);
  const db = new SQL.Database();
  db.run(ROUND_TABLE_SQL);
  db.run(RUN_TABLE_SQL);

  let included = 0;
  let skipped = 0;
  let runId = 1;

  for (const build of builds || []) {
    const rounds = roundsOf(build?.history);
    /** @type {{ round: number, result: number, health: number, stamina: number, buildInfo: string }[]} */
    const encoded = [];
    for (const round of rounds) {
      if (!round || typeof round !== 'object') continue;
      const placements = Array.isArray(round.placements) ? round.placements : [];
      if (!placements.length) continue;
      const health = Number(round.health) > 0 ? Number(round.health) : 100;
      const stamina = Number(round.stamina) > 0 ? Number(round.stamina) : 20;
      const buildInfo = serializeBuildInfo(placements, cat, health, stamina);
      const back = deserializeItems(buildInfo, cat, '1.1.9');
      if (!back?.items?.length) continue;
      encoded.push({
        round: Math.round(Number(round.round) || encoded.length + 1),
        result: round.result === 'loss' ? 1 : 0,
        health: Math.round(health),
        stamina: Math.round(stamina),
        buildInfo,
      });
    }
    if (!encoded.length) {
      skipped += 1;
      continue;
    }
    encoded.sort((a, b) => a.round - b.round);
    encoded.forEach((round, index) => {
      round.round = index + 1;
    });

    const hero = String(build.hero_class || '');
    const created = Date.parse(String(build.created_at || ''));
    const time = Number.isFinite(created) ? Math.floor(created / 1000) : Math.floor(Date.now() / 1000);
    const rankName = String(build.rank || '').trim().toLowerCase();
    db.run(
      `insert into runData (runID, class, loadout, rank, version, time, subclass, skill1, skill2, custom)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        runId,
        classToIndex(hero),
        loadoutForBag(hero, build.starting_bag_id),
        RANK_RATING[rankName] ?? 0,
        HISTORY_VERSION,
        time,
        null,
        gidOrNull(cat, build.route_r3_item_id),
        gidOrNull(cat, build.route_r10_item_id),
        '',
      ],
    );
    for (const round of encoded) {
      db.run(
        `insert into roundData (runID, roundID, result, tries, health, stamina, buildInfo)
         values (?, ?, ?, ?, ?, ?, ?)`,
        [runId, round.round, round.result, 4, round.health, round.stamina, round.buildInfo],
      );
    }
    included += 1;
    runId += 1;
  }

  if (included > 0) insertDummyRun(db, cat, runId);

  const bytes = db.export();
  db.close();
  return { bytes, included, skipped };
}

/**
 * Bomb dummy for judging. Highest run id, so it sits at the top of History.
 * @param {any} db
 * @param {import('./history-decode.js').HistoryDecodeCatalog} cat
 * @param {number} runId
 */
function insertDummyRun(db, cat, runId) {
  const buildInfo = serializeBuildInfo(JUDGING_DUMMY_PLACEMENTS, cat, 100, 20);
  db.run(
    `insert into runData (runID, class, loadout, rank, version, time, subclass, skill1, skill2, custom)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      runId,
      classToIndex('Mage'),
      loadoutForBag('Mage', 'scholar_bag'),
      -1,
      HISTORY_VERSION,
      Math.floor(Date.now() / 1000),
      null,
      null,
      null,
      '',
    ],
  );
  db.run(
    `insert into roundData (runID, roundID, result, tries, health, stamina, buildInfo)
     values (?, ?, ?, ?, ?, ?, ?)`,
    [runId, 1, 0, 4, DUMMY_HEALTH, 20, buildInfo],
  );
}
