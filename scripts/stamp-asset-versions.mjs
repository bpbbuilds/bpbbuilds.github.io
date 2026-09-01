/**
 * Append ?v=<short-sha> to CSS / JS / font-preload URLs in site HTML.
 * Idempotent. Run before deploy when CDN long-caches CSS/JS (see docs/deploy-cache.md).
 *
 *   npm run stamp-assets
 */

import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function shortSha() {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim();
  } catch {
    return String(Date.now());
  }
}

/** @param {string} dir */
function* walkHtml(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* walkHtml(p);
    else if (name.endsWith('.html')) yield p;
  }
}

/**
 * Stamp href/src that point at first-party css/js/fonts (not CDN / data: / #).
 * @param {string} html
 * @param {string} ver
 */
function stampHtml(html, ver) {
  return html.replace(
    /\b(href|src)=(["'])([^"']+)\2/gi,
    (full, attr, quote, url) => {
      if (/^(https?:|\/\/|data:|mailto:|#)/i.test(url)) return full;
      const pathOnly = url.split(/[?#]/)[0];
      if (!/\.(css|js|woff2?|ttf|otf)$/i.test(pathOnly)) return full;
      return `${attr}=${quote}${pathOnly}?v=${ver}${quote}`;
    },
  );
}

const ver = shortSha();
let changed = 0;

for (const file of walkHtml(ROOT)) {
  const before = readFileSync(file, 'utf8');
  const after = stampHtml(before, ver);
  if (after !== before) {
    writeFileSync(file, after, 'utf8');
    changed += 1;
    console.log(`stamped ${relative(ROOT, file)}`);
  }
}

console.log(`stamp-assets: v=${ver} (${changed} file(s) updated)`);
