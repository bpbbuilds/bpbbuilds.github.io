# File structure & JS conventions

How we organize HTML/CSS/JS as the site grows.

## Principles

1. **Page entrypoint** — each page has one `index.js` that wires its sections
2. **Section/feature files** — one job per file, keep each **≤ ~500 lines**
3. **Folder by purpose** — related modules share a folder
4. **HTML imports only `index.js`** for that page
5. **Nav + footer** are shared JS modules, not copy-pasted into every HTML file

## Layout

```text
css/
  theme.css                    # how the site looks (tokens, atmosphere)
  shared.css                   # optional shared helpers (not nav/footer markup)

js/
  shared/
    nav.js                     # mounts site nav
    footer.js                  # mounts site footer
    tooltip.js
    tooltip.css
    tooltip-hover.js
    backpack-grid/             # Itemiary pack + build placement renderer
      index.js
      shape.js
      pack.js
      render.js
      backpack-grid.css
    supabase.js
  pages/
    home/
      index.js                 # entry — imported by index.html
      featured-op.js
    items/
      index.js
      catalog.js
      catalog-filters.js
      catalog.css
    build-detail/
      index.js
      video-embed.js
      backpack-grid.js         # build editor later; shared packer is shared/backpack-grid/
      route-guide.js
      share.js
```

HTML:

```html
<link rel="stylesheet" href="/css/theme.css" />
<link rel="stylesheet" href="/css/shared.css" />
<!-- Tailwind setup TBD -->
<div id="site-nav"></div>
<main><!-- page content --></main>
<div id="site-footer"></div>
<script type="module" src="/js/pages/home/index.js"></script>
```

Page entry:

```js
// js/pages/home/index.js
import { initNav } from '../../shared/nav.js';
import { initFooter } from '../../shared/footer.js';
import { initFeaturedOp } from './featured-op.js';

initNav();
initFooter();
initFeaturedOp();
```

## theme vs shared CSS vs shared JS

| Concern | Where |
|---|---|
| How the site **looks** (colors, fonts, atmosphere) | `css/theme.css` |
| Optional shared layout helpers | `css/shared.css` |
| **Nav / footer components** | `js/shared/nav.js`, `js/shared/footer.js` |
| Page-specific layout | **Tailwind** on that page |
| Tooltip / complex skins | Module CSS (e.g. `tooltip.css`) |

`theme` = look.  
`shared.css` = optional shared style helpers.  
`nav.js` / `footer.js` = shared **components** injected on every page.

## HTML pages

- Prefer clear routes: `/` home, `/builds/{slug}/`, `/items/` later
- GitHub Pages friendly: folders with `index.html` work well

## When to split a JS file

Split when any of these are true:

- Approaching **500 lines**
- Two unrelated features live in the same file
- You want to reuse one piece on another page → move that piece to `js/shared/`
