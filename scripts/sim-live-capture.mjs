/**
 * Phase 265 — merge a live fight capture into a parity fixture.
 *   node scripts/sim-live-capture.mjs --slug pyro-furnace --player-hp 142 --notes "8.2s vs Pyro, maxHP 200"
 *   node scripts/sim-live-capture.mjs --slug pyro-furnace --from capture.json
 *
 * Does not rewrite dummy `expect` bands. Opponent HP is stored as live.dummyEndHp only.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { applyLiveCapture, LIVE_STACK_KEYS } from '../js/pages/sim/engine/parity-live.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIX_DIR = path.join(__dirname, 'fixtures', 'parity');

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  if (i < 0 || i + 1 >= process.argv.length) return fallback;
  return process.argv[i + 1];
}

function parseStacks(raw) {
  if (!raw) return null;
  if (raw.trim().startsWith('{')) return JSON.parse(raw);
  /** @type {Record<string, number>} */
  const out = {};
  for (const part of raw.split(/[,;]/)) {
    const m = part.trim().match(/^([a-z]+)\s*[:=]\s*(-?\d+(?:\.\d+)?)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    if (LIVE_STACK_KEYS.includes(key) || key === 'luck') {
      out[key === 'luck' ? 'lucky' : key] = Number(m[2]);
    }
  }
  return Object.keys(out).length ? out : null;
}

const fromFile = arg('--from');
const slug = arg('--slug');
if (!slug) {
  console.error('Usage: node scripts/sim-live-capture.mjs --slug <fixture> [--from file.json | --player-hp N --notes "…"]');
  process.exit(1);
}

const fp = path.join(FIX_DIR, `${slug}.json`);
if (!fs.existsSync(fp)) {
  console.error(`No fixture ${fp}`);
  process.exit(1);
}

const fixture = JSON.parse(fs.readFileSync(fp, 'utf8'));
/** @type {object} */
let capture;
if (fromFile) {
  capture = JSON.parse(fs.readFileSync(fromFile, 'utf8'));
} else {
  capture = {
    playerEndHp: arg('--player-hp'),
    dummyEndHp: arg('--opponent-hp'),
    playerStamina: arg('--stam'),
    playerMaxHp: arg('--max-hp'),
    fightDurationSec: arg('--duration'),
    opponentClass: arg('--opponent-class'),
    notes: arg('--notes'),
    stacks: parseStacks(arg('--stacks')),
    capturedAt: arg('--captured-at'),
  };
}

applyLiveCapture(fixture, capture);
fs.writeFileSync(fp, `${JSON.stringify(fixture, null, 2)}\n`);
console.log(
  `Wrote live capture → ${path.relative(path.join(__dirname, '..'), fp)} pHP=${fixture.live.playerEndHp} band [${fixture.live.playerEndHpMin},${fixture.live.playerEndHpMax}]`,
);
