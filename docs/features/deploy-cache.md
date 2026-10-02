# Deploy cache (GitHub Pages)

Static site on **GitHub Pages**. Pages does **not** honor `_headers`, Netlify, or Vercel cache files — you cannot set `Cache-Control` from the repo alone. Bare Pages CDN TTL stays relatively short.

## Local DevTools noise

[`.vscode/settings.json`](../../.vscode/settings.json) Live Server uses `Cache-Control: no-cache, no-store, must-revalidate`. That inflates “short cache” tips when profiling locally — ignore it for production judgments.

## Recommended: Cloudflare (or similar) in front

When a custom domain proxies the Pages origin, add cache rules roughly:

| Path | Policy |
|---|---|
| `/assets/*` (fonts, icons, `item-sprites`, `item-thumbs`) | Long TTL + immutable |
| `*.css` / `*.js` | Long TTL **only if** URLs are versioned (`?v=…`) |
| `*.html` | Short TTL or bypass (always pick up new asset URLs) |

Rarity cells and some tooltip icons already load from the external CDN (`awerc.github.io/bpb-cdn`); focus edge rules on first-party `/assets/*` and versioned CSS/JS.

## Version stamps (safe long CSS/JS cache)

```bash
npm run stamp-assets
```

[`scripts/stamp-asset-versions.mjs`](../../scripts/stamp-asset-versions.mjs) appends `?v=<short-git-sha>` to stylesheet, module/classic script, and font `preload` URLs in site HTML. Idempotent (replaces an existing `?v=`).

It also stamps **screenshot pipeline** `import … from '….js'` specifiers (`js/pages/create/screenshot-*.js`, create `index.js` → `page.js` → `board-editor.js` → `board-import.js`, `js/shared/screenshot-*.js`, `js/pages/dev-screenshot-import/index.js`) and writes [`js/pages/create/screenshot-pipeline-ver.js`](../../js/pages/create/screenshot-pipeline-ver.js). Nested ESM imports are not covered by the HTML stamp alone — without this, `/create/` can keep a cached `screenshot-direct.js` while a fresh `/dev/screenshot-import/` pulls new files.

After screenshot pipeline edits, run `npm run stamp-assets` (or hard-refresh both pages) before comparing `/create/` vs the harness. Both should log the same `[screenshot] pipeline v=<sha>`.

Run **before deploy** when using long-cache CDN rules for CSS/JS. On bare GitHub Pages (no edge long-cache) the stamp is harmless and does not lengthen Pages TTL by itself.

## Out of scope here

- Moving item sprites to Supabase Storage
- Full hashed-filename bundler pipeline
- Configuring a Cloudflare account (ops, not repo)
