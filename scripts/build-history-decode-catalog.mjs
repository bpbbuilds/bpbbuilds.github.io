/**
 * Build assets/data/history-decode-catalog.json for client history.db decode.
 * Sources: scripts/_cache/ItemData.csv, game-items.json, library-layout.json,
 * socket-offsets.json. The game extract is also used for history-only items
 * that are intentionally excluded from the live catalog (for example an
 * unreleased item that can still occur in an older/newer history.db).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function binaryCeil(n) {
  if (n <= 1) return 1;
  return 2 ** Math.ceil(Math.log2(n));
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    /** @type {Record<string, string>} */
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? '';
    });
    return row;
  });
}

/** Minimal CSV split (handles quotes). */
function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

const csvPath = path.join(ROOT, 'scripts/_cache/ItemData.csv');
const layoutPath = path.join(ROOT, 'assets/data/library-layout.json');
const sockPath = path.join(ROOT, 'assets/data/socket-offsets.json');
const gameItemsPath = path.join(ROOT, 'scripts/_cache/game-items.json');
const outPath = path.join(ROOT, 'assets/data/history-decode-catalog.json');

const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
const sock = JSON.parse(fs.readFileSync(sockPath, 'utf8'));
const gameItems = fs.existsSync(gameItemsPath)
  ? JSON.parse(fs.readFileSync(gameItemsPath, 'utf8'))
  : { items: [] };

/** @type {Record<string, string>} */
const gidToId = {};
for (const o of layout.order || []) {
  if (o?.gid != null && o?.id) gidToId[String(o.gid)] = String(o.id);
}

// Keep the published layout as the authority for normal catalog IDs, then
// fill any game IDs that are absent from that layout so history decoding does
// not turn a valid game item into a null placement.
for (const item of gameItems.items || []) {
  if (item?.gid != null && item?.id && !gidToId[String(item.gid)]) {
    gidToId[String(item.gid)] = String(item.id);
  }
}

const layoutIds = new Set(
  (layout.order || []).map((o) => String(o?.id || '')).filter(Boolean),
);
/** @type {Record<string, object>} */
const historyOnly = {};
for (const item of gameItems.items || []) {
  if (!item?.id || item.gid == null || layoutIds.has(String(item.id))) continue;
  // This metadata is deliberately scoped to history decoding. It is not a
  // replacement for the live Supabase catalog and therefore does not make an
  // unreleased item appear in the Items page or become publishable.
  historyOnly[String(item.id)] = {
    id: String(item.id),
    gid: Number(item.gid),
    name: String(item.name || item.displayName || item.id),
    rarity: item.rarity || null,
    type: item.type || null,
    class: item.class || null,
    extraTypes: Array.isArray(item.extraTypes) ? item.extraTypes : [],
    cost: item.cost == null ? null : Number(item.cost),
    image: item.image || null,
    shape: Array.isArray(item.shape) ? item.shape : null,
    sockets: item.sockets ?? null,
    params: item.params && typeof item.params === 'object' ? item.params : null,
    releaseState: item.releaseState || 'unreleased',
  };
}

/** @type {Record<string, number>} */
const socketsById = {};
for (const [id, offsets] of Object.entries(sock.byId || {})) {
  socketsById[id] = Array.isArray(offsets) ? offsets.length : 0;
}

const gems = rows.filter((r) => r.type === 'Gem' && /^\d+$/.test(r.id)).map((r) => Number(r.id));
const totalNumGems = binaryCeil(gems.length + 1);
const emptySocket = totalNumGems - 1;

const magicRing = rows.find((r) => r.name === 'Magic Ring');
let magicRingGid = magicRing && /^\d+$/.test(magicRing.id) ? Number(magicRing.id) : null;
let magicRingPersistBits = 12;
if (magicRing) {
  for (const cell of Object.values(magicRing)) {
    if (typeof cell !== 'string' || !cell.includes('effects')) continue;
    for (const part of cell.split(',')) {
      const p = part.trim();
      if (p.endsWith(':effects') && /^\d+:/.test(p)) {
        magicRingPersistBits = Number(p.split(':')[0]) * 6;
        break;
      }
    }
  }
}

const catalog = {
  numItems: rows.length,
  gidToId,
  historyOnly,
  socketsById,
  gems,
  totalNumGems,
  emptySocket,
  magicRingGid,
  magicRingPersistBits,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(catalog)}\n`, 'utf8');
console.log(
  'wrote',
  path.relative(ROOT, outPath),
  'items',
  catalog.numItems,
  'gids',
  Object.keys(gidToId).length,
  'gems',
  gems.length,
);
