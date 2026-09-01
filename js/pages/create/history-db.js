/**
 * Load history.db in-browser via sql.js and list / decode runs.
 */

import {
  classFromIndex,
  deserializeItems,
  leagueFromRating,
  loadHistoryCatalog,
  resolveSocketGems,
  versionToString,
} from './history-decode.js';

/** @type {Promise<any> | null} */
let sqlModulePromise = null;

/**
 * @param {string} root
 * @returns {Promise<any>}
 */
async function getSqlJs(root) {
  const base = root.endsWith('/') ? root : `${root}/`;
  if (!globalThis.initSqlJs) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `${base}js/vendor/sql-wasm.js`;
      s.async = true;
      s.onload = () => resolve(undefined);
      s.onerror = () => reject(new Error('Could not load sql.js'));
      document.head.appendChild(s);
    });
  }
  if (typeof globalThis.initSqlJs !== 'function') {
    throw new Error('sql.js failed to initialize');
  }
  if (!sqlModulePromise) {
    sqlModulePromise = globalThis.initSqlJs({
      locateFile: (file) => `${base}assets/vendor/${file}`,
    });
  }
  return sqlModulePromise;
}

/**
 * @typedef {{
 *   runId: number,
 *   heroClass: string | null,
 *   loadout: number,
 *   rating: number,
 *   rank: string,
 *   version: string,
 *   time: number,
 *   subclassGid: number,
 *   skill1Gid: number,
 *   skill2Gid: number,
 *   rounds: number,
 *   tries: number,
 * }} HistoryRunSummary
 */

/**
 * @typedef {{
 *   runId: number,
 *   heroClass: string | null,
 *   loadout: number,
 *   rating: number,
 *   rank: string,
 *   version: string,
 *   subclassGid: number,
 *   skill1Gid: number,
 *   skill2Gid: number,
 *   rounds: {
 *     round: number,
 *     result: 'win' | 'loss',
 *     health?: number,
 *     stamina?: number,
 *     placements: import('./draft-io.js').DraftPlacement[],
 *   }[],
 * }} HistoryDecodedRun
 */

/**
 * @param {ArrayBuffer} buffer
 * @param {string} root
 * @returns {Promise<{ db: any, runs: HistoryRunSummary[], close: () => void }>}
 */
export async function openHistoryDb(buffer, root) {
  const SQL = await getSqlJs(root);
  const db = new SQL.Database(new Uint8Array(buffer));
  let rows;
  try {
    rows = db.exec(`
      select runID, class, loadout, rank, version, time, subclass, skill1, skill2,
             (select count(*) from roundData r where r.runID = runData.runID) as rounds,
             (select tries from roundData r where r.runID = runData.runID
                order by roundID desc limit 1) as tries
      from runData
      order by time desc
    `);
  } catch (err) {
    db.close();
    throw new Error(
      err instanceof Error
        ? err.message
        : 'Not a Backpack Battles history.db (missing runData).',
    );
  }

  /** @type {HistoryRunSummary[]} */
  const runs = [];
  const table = rows[0];
  if (table?.values) {
    for (const r of table.values) {
      const classI = Number(r[1]);
      const rating = Number(r[3]);
      const ver = Number(r[4]);
      const roundCount = Number(r[9]) || 0;
      if (roundCount < 1) continue;
      runs.push({
        runId: Number(r[0]),
        heroClass: classFromIndex(classI),
        loadout: Number(r[2]),
        rating,
        rank: leagueFromRating(rating),
        version: versionToString(ver),
        time: Number(r[5]),
        subclassGid: Number(r[6]),
        skill1Gid: Number(r[7]),
        skill2Gid: Number(r[8]),
        rounds: roundCount,
        tries: Number(r[10]) || 0,
      });
    }
  }

  return {
    db,
    runs,
    close() {
      try {
        db.close();
      } catch {
        /* ignore */
      }
    },
  };
}

/**
 * Lightweight W/L sequence for list strips (no board decode).
 * @param {any} db
 * @param {number} runId
 * @returns {{ round: number, result: 'win' | 'loss' }[]}
 */
export function fetchRunResults(db, runId) {
  /** @type {{ round: number, result: 'win' | 'loss' }[]} */
  const out = [];
  try {
    const stmt = db.prepare(
      'select roundID, result from roundData where runID=? order by roundID',
    );
    stmt.bind([runId]);
    while (stmt.step()) {
      const row = stmt.getAsObject();
      out.push({
        round: Number(row.roundID) || out.length + 1,
        result: Number(row.result) === 0 ? 'win' : 'loss',
      });
    }
    stmt.free();
  } catch {
    /* ignore */
  }
  return out;
}

/**
 * @param {any} db
 * @param {HistoryRunSummary} summary
 * @param {string} root
 * @returns {Promise<HistoryDecodedRun>}
 */
export async function decodeHistoryRun(db, summary, root) {
  const cat = await loadHistoryCatalog(root);
  const stmt = db.prepare(
    'select roundID, result, buildInfo from roundData where runID=? order by roundID',
  );
  stmt.bind([summary.runId]);

  /** @type {HistoryDecodedRun['rounds']} */
  const rounds = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    const buildInfo = String(row.buildInfo || '');
    const data = deserializeItems(buildInfo, cat, summary.version);
    if (!data) continue;
    /** @type {import('./draft-io.js').DraftPlacement[]} */
    const placements = [];
    data.items.forEach((it, i) => {
      if (!it.id) return;
      const gems = resolveSocketGems(it.gems || [], cat);
      /** @type {import('./draft-io.js').DraftPlacement} */
      const p = {
        key: `${summary.runId}:${i}:${it.gid}:${it.x}:${it.y}:${it.r}`,
        id: it.id,
        x: it.x,
        y: it.y,
        r: it.r,
      };
      if (gems.length) p.gems = gems;
      if (it.persistent) {
        p.instance = { persistent: it.persistent };
      }
      placements.push(p);
    });
    /** @type {HistoryDecodedRun['rounds'][number]} */
    const roundRow = {
      round: Number(row.roundID),
      result: Number(row.result) === 0 ? 'win' : 'loss',
      placements,
    };
    if (Number.isFinite(data.health) && data.health > 0) {
      roundRow.health = Math.round(data.health);
    }
    if (Number.isFinite(data.stamina) && data.stamina > 0) {
      roundRow.stamina = data.stamina;
    }
    rounds.push(roundRow);
  }
  stmt.free();

  if (!rounds.length) {
    throw new Error(`Run ${summary.runId} had no decodable rounds.`);
  }

  return {
    runId: summary.runId,
    heroClass: summary.heroClass,
    loadout: summary.loadout,
    rating: summary.rating,
    rank: summary.rank,
    version: summary.version,
    subclassGid: summary.subclassGid,
    skill1Gid: summary.skill1Gid,
    skill2Gid: summary.skill2Gid,
    rounds,
  };
}
