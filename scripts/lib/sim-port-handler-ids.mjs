/**
 * Item ids that appear as dedicated PORT_HANDLERS keys (ports.js / ports-*.js).
 * Used by auto-port generation and the AP census.
 */
import fs from 'fs';
import path from 'path';

export const HANDLER_SKIP = new Set([
  'family',
  'handlerId',
  'onCombatStart',
  'onCooldownEffect',
  'onPeerActivated',
  'onChargeReceived',
  'onPreDealDamageEarly',
  'onDealtDamage',
  'onAttacked',
  'deferStartActivate',
]);

/**
 * @param {string} scriptsDir js/pages/sim/engine/scripts
 * @returns {Set<string>}
 */
export function extractPortHandlerIds(scriptsDir) {
  const portIds = new Set();
  const files = fs
    .readdirSync(scriptsDir)
    .filter((n) => n.startsWith('ports') && n.endsWith('.js'));
  for (const f of files) {
    const t = fs.readFileSync(path.join(scriptsDir, f), 'utf8');
    for (const m of t.matchAll(/handlerId:\s*'([^']+)'/g)) portIds.add(m[1]);
    for (const m of t.matchAll(/handlerId:\s*"([^"]+)"/g)) portIds.add(m[1]);
    for (const m of t.matchAll(/^\s{2}([a-z][a-z0-9_]*):\s*[A-Za-z_.]/gm)) {
      const id = m[1];
      if (!HANDLER_SKIP.has(id)) portIds.add(id);
    }
    // Dynamic maps: `handlerId: id` + `const SHOP = ['coins', …]` / `export const AN_GEM_IDS = [`
    for (const m of t.matchAll(
      /(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=\s*\[([\s\S]*?)\]/g,
    )) {
      const name = m[1];
      if (!/IDS$/.test(name) && name !== 'SHOP' && name !== 'CHESS') continue;
      for (const q of m[2].matchAll(/'([a-z][a-z0-9_]*)'/g)) portIds.add(q[1]);
    }
  }
  return portIds;
}
