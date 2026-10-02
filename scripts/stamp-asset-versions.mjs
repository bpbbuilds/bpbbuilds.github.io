/**
 * Append ?v=<short-sha> to CSS / JS / font-preload URLs in site HTML,
 * and to screenshot-pipeline module imports (create vs harness cache parity).
 * Idempotent. Run before deploy when CDN long-caches CSS/JS (see docs/features/deploy-cache.md).
 *
 *   npm run stamp-assets
 */

import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PIPELINE_VER_FILE = join(ROOT, 'js/pages/create/screenshot-pipeline-ver.js');

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

/**
 * Screenshot graph modules whose import specifiers get ?v=.
 * @param {string} basename
 */
function isScreenshotGraphModule(basename) {
  return (
    basename === 'page.js' ||
    basename === 'board-editor.js' ||
    basename === 'board-import.js' ||
    basename === 'screenshot-pipeline-ver.js' ||
    basename === 'screenshot-bags-merge.js' ||
    /^screenshot[^/]*\.js$/.test(basename)
  );
}

/**
 * Stamp `from '…/screenshot-….js'` (and board-import) in a JS module.
 * @param {string} src
 * @param {string} ver
 */
function stampJsImports(src, ver) {
  return src.replace(
    /(\bfrom\s+)(['"])([^'"]+\.js)(?:\?v=[^'"]*)?\2/g,
    (full, prefix, quote, url) => {
      const pathOnly = url.split(/[?#]/)[0];
      const base = pathOnly.replace(/^.*\//, '');
      if (!isScreenshotGraphModule(base)) return full;
      return `${prefix}${quote}${pathOnly}?v=${ver}${quote}`;
    },
  );
}

/** @returns {string[]} */
function screenshotGraphFiles() {
  /** @type {string[]} */
  const out = [];
  const addDir = (dir, pred) => {
    const abs = join(ROOT, dir);
    for (const name of readdirSync(abs)) {
      if (!pred(name)) continue;
      out.push(join(abs, name));
    }
  };
  addDir('js/pages/create', (n) => n.startsWith('screenshot') && n.endsWith('.js'));
  addDir('js/pages/create', (n) =>
    n === 'index.js' || n === 'page.js' || n === 'board-import.js' || n === 'board-editor.js',
  );
  addDir('js/shared', (n) => n.startsWith('screenshot') && n.endsWith('.js'));
  out.push(join(ROOT, 'js/pages/dev-screenshot-import/index.js'));
  return out;
}

const ver = shortSha();
let changed = 0;

writeFileSync(
  PIPELINE_VER_FILE,
  `/**
 * Screenshot pipeline cache-bust version. Written by \`npm run stamp-assets\`.
 * Compare \`[screenshot] pipeline v=\` on /create/ vs /dev/screenshot-import/.
 */
export const SCREENSHOT_PIPELINE_VER = '${ver}';
`,
);
console.log(`wrote ${relative(ROOT, PIPELINE_VER_FILE)} v=${ver}`);

for (const file of walkHtml(ROOT)) {
  const before = readFileSync(file, 'utf8');
  const after = stampHtml(before, ver);
  if (after !== before) {
    writeFileSync(file, after, 'utf8');
    changed += 1;
    console.log(`stamped ${relative(ROOT, file)}`);
  }
}

for (const file of screenshotGraphFiles()) {
  const before = readFileSync(file, 'utf8');
  const after = stampJsImports(before, ver);
  if (after !== before) {
    writeFileSync(file, after, 'utf8');
    changed += 1;
    console.log(`stamped ${relative(ROOT, file)}`);
  }
}

console.log(`stamp-assets: v=${ver} (${changed} file(s) updated)`);
