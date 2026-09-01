/**
 * Port of scripts/_decode-history-build.py — Godot bitstring → placements.
 */

const MAX_HEALTH = 999;
const MAX_STAMINA = 999;
const MAX_SIZE = 10;
const BASE64_OFFSET = 62;

const CLASSES = {
  0: 'Ranger',
  1: 'Reaper',
  2: 'Berserker',
  3: 'Pyromancer',
  4: 'Mage',
  5: 'Adventurer',
  6: 'Engineer',
};

const LEAGUES = [
  'bronze',
  'silver',
  'gold',
  'platinum',
  'diamond',
  'master',
  'grandmaster',
  'grandma',
];

const LEAGUE_THRESHOLDS = [0, 20, 50, 100, 200, 350, 550, 850, 10_000];

/**
 * @param {number} n
 * @returns {number}
 */
function ceilLog2(n) {
  if (n <= 1) return 0;
  return Math.ceil(Math.log2(n));
}

export class BitStream {
  constructor() {
    /** @type {number[]} */
    this.bits = [];
    this.current = 0;
  }

  /** @param {string} s */
  fromGodotString(s) {
    this.bits = [];
    this.current = 0;
    for (let i = 0; i < s.length; i += 1) {
      const offset = s.charCodeAt(i) - BASE64_OFFSET;
      if (offset < 0 || offset > 63) return false;
      for (let digit = 5; digit >= 0; digit -= 1) {
        this.bits.push(offset & (1 << digit) ? 1 : 0);
      }
    }
    return true;
  }

  bitsLeft() {
    return this.bits.length - this.current;
  }

  /** @param {number} rangeMax */
  pull(rangeMax) {
    const nbits = ceilLog2(rangeMax);
    if (this.current + nbits > this.bits.length) return -1;
    let value = 0;
    for (let digit = nbits - 1; digit >= 0; digit -= 1) {
      value += this.bits[this.current] << digit;
      this.current += 1;
    }
    return value;
  }

  /** @param {number} nbits */
  pullBitsize(nbits) {
    if (this.current + nbits > this.bits.length) return -1;
    let value = 0;
    for (let digit = nbits - 1; digit >= 0; digit -= 1) {
      value += this.bits[this.current] << digit;
      this.current += 1;
    }
    return value;
  }
}

/**
 * @param {number} ver
 * @returns {string}
 */
export function versionToString(ver) {
  const major = Math.floor(ver / 1_000_000);
  const minor = Math.floor((ver % 1_000_000) / 1000);
  const mini = ver % 1000;
  return `${major}.${minor}.${mini}`;
}

/**
 * @param {number | null | undefined} rating
 * @returns {string}
 */
export function leagueFromRating(rating) {
  if (rating == null || rating < 0) return 'bronze';
  const r = Math.max(0, Number(rating));
  let league = -1;
  for (const thr of LEAGUE_THRESHOLDS) {
    if (r >= thr) league += 1;
    else break;
  }
  league = Math.max(0, Math.min(league, LEAGUES.length - 1));
  return LEAGUES[league];
}

/**
 * @param {number} classI
 * @returns {string | null}
 */
export function classFromIndex(classI) {
  return CLASSES[classI] || null;
}

/**
 * @typedef {{
 *   numItems: number,
 *   gidToId: Record<string, string>,
 *   socketsById: Record<string, number>,
 *   gems: number[],
 *   totalNumGems: number,
 *   emptySocket: number,
 *   magicRingGid: number | null,
 *   magicRingPersistBits: number,
 * }} HistoryDecodeCatalog
 */

/** @type {HistoryDecodeCatalog | null} */
let catalogCache = null;

/**
 * @param {string} root
 * @returns {Promise<HistoryDecodeCatalog>}
 */
export async function loadHistoryCatalog(root) {
  if (catalogCache) return catalogCache;
  const base = root.endsWith('/') ? root : `${root}/`;
  const res = await fetch(`${base}assets/data/history-decode-catalog.json`);
  if (!res.ok) throw new Error('Could not load history decode catalog.');
  catalogCache = /** @type {HistoryDecodeCatalog} */ (await res.json());
  return catalogCache;
}

/**
 * @param {HistoryDecodeCatalog} cat
 * @param {number} gid
 */
function socketsFor(cat, gid) {
  const slug = cat.gidToId[String(gid)];
  if (slug && cat.socketsById[slug] != null) return cat.socketsById[slug];
  return 0;
}

/**
 * @param {string} version
 * @returns {boolean}
 */
function versionAtLeast110(version) {
  const parts = String(version || '0').split('.').map((x) => Number(x) || 0);
  const [a = 0, b = 0] = parts;
  return a > 1 || (a === 1 && b >= 1);
}

/**
 * @param {string} buildInfo
 * @param {HistoryDecodeCatalog} cat
 * @param {string} [version]
 */
export function deserializeItems(buildInfo, cat, version = '1.1.0') {
  const bs = new BitStream();
  if (!bs.fromGodotString(buildInfo)) return null;
  const health = bs.pull(MAX_HEALTH);
  const stamina = bs.pull(MAX_STAMINA);
  if (health < 0 || stamina < 0) return null;

  const totalNumItems = versionAtLeast110(version) ? cat.numItems : 510;
  /** @type {{ gid: number, id: string | null, x: number, y: number, r: number, gems: number[], persistent?: { magicRing?: number } }[]} */
  const items = [];
  while (bs.bitsLeft() >= 8) {
    const index = bs.pull(totalNumItems);
    if (index < 0 || index >= totalNumItems) return null;
    const x = bs.pull(MAX_SIZE);
    const y = bs.pull(MAX_SIZE);
    const face = bs.pull(4);
    if (x < 0 || y < 0 || face < 0) return null;

    /** @type {{ gid: number, id: string | null, x: number, y: number, r: number, gems: number[] }} */
    const entry = {
      gid: index,
      id: cat.gidToId[String(index)] || null,
      x,
      y,
      r: face,
      gems: [],
    };
    const nSock = socketsFor(cat, index);
    if (nSock > 0) {
      const hasGems = bs.pull(2);
      if (hasGems === 1) {
        for (let i = 0; i < nSock; i += 1) {
          const g = bs.pull(cat.totalNumGems);
          if (g < 0) return null;
          entry.gems.push(g);
        }
      } else if (hasGems < 0) return null;
    }

    if (index === cat.magicRingGid) {
      const persist = cat.magicRingPersistBits || 12;
      const dataAsInt = bs.pullBitsize(persist);
      if (dataAsInt < 0) return null;
      if (dataAsInt > 0) {
        entry.persistent = { magicRing: dataAsInt };
      }
    }

    items.push(entry);
  }

  return { health, stamina, items };
}

/**
 * Map gem slot indices → item ids ('' = empty).
 * @param {number[]} gemIndices
 * @param {HistoryDecodeCatalog} cat
 * @returns {string[]}
 */
export function resolveSocketGems(gemIndices, cat) {
  const gems = cat.gems || [];
  const empty = cat.emptySocket;
  /** @type {string[]} */
  const out = [];
  for (const g of gemIndices) {
    const idx = Number(g);
    if (!Number.isFinite(idx) || idx < 0 || idx === empty || idx >= gems.length) {
      out.push('');
      continue;
    }
    out.push(cat.gidToId[String(gems[idx])] || '');
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  return out;
}
