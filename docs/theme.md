# Visual theme (from Backpack Battles)

Source refs: `assets/theme-refs/`

| File | Screen |
|---|---|
| `01-main-menu.png` | Main menu / town / hanging banners |
| `02-item-compendium.png` | Item DB on parchment + filter rail |
| `03-match-history.png` | History list + leather pouch backpack grid |

## Direction

**Cozy parchment & leather fantasy UI** — the site should feel like it belongs *in* Backpack Battles (journal / shop ledger), not like a flat SaaS skin painted tan.

Differentiate from [BPB Builds](https://bpb-builds.vercel.app): same family of materials, but closer to the **real game** (texture, leather cells, rarity paint-swipes, banner language) and cleaner UX hierarchy.

## Marketing / key art (placed)

These are **hero/brand images**, not tileable page backgrounds. Keep parchment textures separate when you have them.

| File | Best use | Notes |
|---|---|---|
| `assets/heroes/hero-engineer-cast.png` | Homepage hero / featured strip art (Engineer update cast) | Busy — put text beside or on a parchment panel, not on top of faces |
| `assets/heroes/hero-party-loot.png` | Primary homepage hero (no logo) | Best for custom site title (“Smojo” / site name) over/near art |
| `assets/heroes/hero-party-loot-logo.png` | Splash / about / “about the game” only | Logo baked in — don’t stack another big title on the logo |
| `assets/heroes/hero-ranger-market.jpg` | Alt homepage / about the game (classic ranger + stall) | Older key art; great story beat |
| `assets/heroes/hero-keyart1-horizontal.jpg` | Wide banner / OG key art | Older pack |
| `assets/heroes/hero-keyart1-vertical.jpg` | Mobile / tall hero | Portrait crop |
| `assets/heroes/hero-keyart3-full.png` | Full composite key art | Use when you want items+frame together |
| `assets/brand/logo-backpack-battles.png` | Game attribution / nav (top of page) | Black bg — prefer transparent PNG later |
| `assets/brand/logo-bpb.png` | Nav logo after scroll (BPB + gear) | Transparent PNG; keep Builds banner |

### Characters (cutouts)

| File | Best use |
|---|---|
| `assets/characters/char-ranger.png` | Class showcase / mascot (chibi composite) |
| `assets/characters/char-ranger-alt.png` | Alt ranger pose (press-kit) |
| `assets/characters/char-reaper.png` | Class showcase |
| `assets/characters/char-pyromancer.png` | Class showcase |
| `assets/characters/char-berserker.png` | Class showcase |
| `assets/characters/char-mage.png` | Class showcase |
| `assets/characters/char-adventurer.png` | Class showcase |
| `assets/characters/char-engineer.png` | Class showcase |
| `assets/characters/char-furcifer.png` | Shop/merchant accents |
| `assets/characters/char-goobert.png` | Fun accent / empty states (black bg — needs mask or transparent export later) |
| `assets/characters/char-puppy.png` | Fun accent |

Regenerate chibis from extract: `python scripts/composite-class-chibis.py`

### Recommended defaults

- **Homepage hero:** `hero-party-loot.png` (flex room for our branding)
- **Alt / classic hero:** `hero-ranger-market.jpg` or `hero-engineer-cast.png`
- **Game wordmark:** `logo-backpack-battles.png` as attribution; **Smojo** = site brand in nav

## UI chrome (placed)

Game-style interface pieces → `assets/theme/ui/` (black knocked out).

| File | What it is | Best use |
|---|---|---|
| `ui-wood-shelf.png` | Thin wooden plank / shelf | Nav link rail under the logo; section divider “ledge” |
| `ui-label-plate.png` | Blank ornate parchment label | Nav link / button background — overlay text (Builds, Items, OP) |
| `ui-label-banner-gold.png` | Long yellow text banner (same family as shop tag) | Overlay words (nav links, section titles, CTAs) |
| `ui-shop-tag-1.png` | Yellow tent price card with coin “1” | Shop/sale accents, featured-deal badges — **not** for nav |
| `ui-icon-youtube.png` | Framed wood/leather YouTube play badge | Nav social link (YouTube) |
| `ui-icon-discord.png` | Framed wood/leather Discord badge | Nav social link (Discord) |
| `ui-scholar-bag.png` | Mage Scholar Bag | Kept for later (bag-as-container experiments); stage uses parchment panel |
| `ui-badge-op.png` | Shorter/thicker burgundy gold “OP” ribbon | Hangs on featured / OP cards |
| `ui-badge-op-tall.png` | Taller OP ribbon variant | Kept as alternate |
| `ui-frame-video.png` | Ornate bronze video frame (transparent center) | Kept; featured stage now uses `ui-screen-frame` instead |
| `ui-plate-info.png` | Long riveted parchment plate (2136×688) | Kept; featured stage now uses separate framed parchment lanes |
| `ui-btn-crimson.png` | Red riveted button plate | Featured “Watch” CTA background |
| `ui-btn-steel.png` | Blue riveted button plate | Featured “View build” CTA background |
| `ui-screen-frame.png` | Game viewport Frame2 (1920×1080, transparent center) | Fixed site-wide screen chrome; also rim on home create-promo card |
| `ui-character-sheet.png` | Character Stats sheet (framed parchment + dashed bands) | Featured stage info lane |
| `ui-parchment-fill.png` | Mottled parchment texture | Fill inside home create-promo card (not the band) |
| `ui-ranger-plate.png` | Thin Ranger leather frame (transparent center; acorn flap + straps) | Kept for later bag-section experiments |
| `ui-coffin-plate.png` | Framed Storage Coffin panel (skull/rose + tufted fill) | Kept for later Reaper section |
| `ui-coffin-lining.png` | Purple tufted fill only (no frame) | Alt / tile fill if needed |

**Bag-as-section (homepage):** create promo card uses parchment fill + `ui-screen-frame.png` rim; band stays transparent (town) and flush to class showcase. Site chrome is the same frame on `body::after`.

### Recommended defaults

- **Nav link plate:** `ui-label-plate.png`
- **Nav / section ledge:** `ui-wood-shelf.png`
- **Text on yellow banner:** `ui-label-banner-gold.png`
- **Nav socials:** `ui-icon-youtube.png`, `ui-icon-discord.png`
- **Shop flair:** `ui-shop-tag-1.png` (or variants when you have more costs)

## Icons (placed)

From Icons pack → `assets/icons/`

| Folder | Contents | Best use |
|---|---|---|
| `classes/` | Berserker, Pyromancer, Ranger, Reaper | Build class label next to title |
| `status/` | Mana, Poison, Heat, Block, etc. | Tooltips / effect chips (later) |
| `league/` | Bronze → Grandmaster | Rank / ladder UI (later) |
| `misc/` | Backpack, Dice, GoldCoin | Buttons / accents (e.g. View build) |

## Scene backgrounds (placed)

From Background pack + older keyart layers → `assets/theme/backgrounds/`

| File | Best use |
|---|---|
| `combat/` (layer PNGs) | **Homepage atmosphere** — fixed day→night scene scrubbed by scroll (`combat-sky.js`) |
| `bg-town-square.jpg` | Alt / non-home pages — main-menu town |
| `bg-shop-interior.jpg` | Item DB / construct — empty wall for UI |
| `bg-study-shelves-portrait.png` | Tall/sidebar / mobile study vibe (keyart layer) |
| `bg-market-stall-arch.png` | Hero/build pages — stall left, **empty wall right for text** |
| `bg-parchment-panel.png` | **Best UI panel fill** — clean framed parchment (no items), 16:9 |
| `bg-parchment-panel-2x1.png` | Card/featured panels — same idea at **1024×512 (2:1)** |
| `bg-parchment-item-border.png` | Content frames with item border decoration |
| `bg-parchment-item-border-framed.png` | Same idea, framed variant |
| `bg-parchment-item-border-tall.png` | Item-border panel extended taller (featured cards) |
| `bg-hills-day-sun-left.jpg` | Bright sectional alt (precomposed stills) |
| `bg-hills-day-sun-center.jpg` | Bright sectional alt |
| `bg-hills-golden-hour.jpg` | Warm featured / OP section |
| `bg-hills-sunset.jpg` | Warm evening section |
| `bg-hills-dusk-pink.jpg` | Soft dusk section |
| `bg-hills-night-crescent.jpg` | Darker pages |
| `bg-hills-night-moon-star.jpg` | Dark section / footer band |
| `bg-hills-night-stars.jpg` | Dark section alt |
| `bg-hills-night-deep.jpg` | Darkest night option |

### Combat sky layers (`backgrounds/combat/`)

Source: game `Assets/Background/*` (Sun, Moon, Star, Hills, Mountains, House, Windmill, Path, Speckles, …). Homepage mounts a fixed stack and seeks the combat `Round` day→night keyframes from page scroll. Explore-items keeps its opaque dark band on top.

### Recommended defaults

- **Homepage atmosphere:** `combat/` layers via `js/pages/home/combat-sky.js` (not town-square)
- **Panels / cards / modals:** `bg-parchment-panel.png` ← biggest win from the older keyart pack
- **Featured carousel cards:** video lane = Frame2 on media only; info lane = slightly smaller `ui-character-sheet.png` tucked under the video so the sheet edge peeks behind the frame; copy stays centered in the visible sheet band (`--fs-info-tuck`)
- **Items / shop tools scene:** `bg-shop-interior.jpg` or `bg-market-stall-arch.png`
- **Precomposed hill JPGs:** optional sectional alts when you don’t need the living scrub

### CSS tip

Scene BGs often include a thin frame. Use `background-size: cover`; crop the frame or keep it for a “painting” look. For `bg-parchment-panel.png`, prefer as a **panel background** (`background-size: 100% 100%` or cover inside `.bpb-panel`), not necessarily full-page.

## Materials

- **Parchment** — warm mottled paper for page/panels
- **Leather pouch cells** — backpack grid slots (stitched square patches)
- **Wood / dark frame** — outer borders, sign-like controls
- **Hanging banners** — primary CTAs / mode-like emphasis (crimson, steel blue, forest)
- **Item art** — saturated sprites with ink outlines; they supply color pop

## Color tokens (approximate)

| Role | Approx | Notes |
|---|---|---|
| Parchment base | `#C4A882` → `#D9C5B2` | Page / panel fill |
| Parchment deep | `#A88868` | Recessed rows, sidebar |
| Ink / text | `#3D2B1F` | Body copy on paper |
| Frame / border | `#4A3428` | Dark brown edges |
| Gold / coin | `#E8C84A` | Highlights, currency feel |
| Banner crimson | `#8B2E2E` | Strong CTA / ranked energy |
| Banner steel | `#3D5A7A` | Secondary actions |
| Banner forest | `#3F6B4F` | Alt accent |
| Win | soft green bars | History / positive |
| Loss | soft red bars | History / negative |

### Rarity (paint-swipe labels from game)

| Rarity | Feel |
|---|---|
| Common | light green swipe |
| Rare | bright blue |
| Epic | purple |
| Legendary | orange / gold |
| Godly | bright yellow-orange |

Tooltip cream/gold stays for **item tooltips**; page chrome stays parchment/leather so the two layers still match.

## Type

The game uses **two** Latin faces (plus locale fallbacks). Match roles — don’t paint every outlined label with Milonga.

| Face | Token | Use for |
|---|---|---|
| **Libre Baskerville** (Regular / Bold / Italic) | `--bpb-font-body` | UI controls, filter checkboxes & dropdowns, “Items found” counts, body copy, meta lines, most outlined cream UI text in Item Library / Options |
| **Milonga** | `--bpb-font-display` | Page titles / headings, nav banner words, tooltip **item names**, logo-adjacent display, strong CTA sticker moments |

**Rule of thumb:** if it’s a control label or reading text → Baskerville. If it’s a title, name plate, or hanging banner word → Milonga.

Avoid Inter / Roboto / Arial as the brand voice.

### Item Library / Options UI labels (`OptionsFont.tres`)

Same recipe for **rarity**, **Class Items**, **Treasure**, **Shop / Crafted / Gated**, and most Options checkboxes — do not shrink shop rows relative to rarity.

| Property | Game value | Web guidance |
|---|---|---|
| Face | Libre Baskerville **Regular** (not Bold) | `font-family: var(--bpb-font-body); font-weight: 400` |
| Size | **26px** | `~1.625rem` (or `1.5rem` if the rail is scaled down) |
| Fill | Soft cream `rgb(255, 236, 212)` ≈ `#ffeCDC` / `Game.SOFTWHITE` | cream / `--il-cream` |
| Outline | **3px** solid `#3c261d` (`outline_size = 3`) ≈ **0.115em** at 26px | Match that ratio (`~0.1em` stroke + ink ring). Thin strokes leave gaps and make tracking look “loose” |
| Weight / thickness | Regular; heft comes from the **outline**, not Bold | don’t `font-weight: 700` on these labels |
| Letter-spacing (tracking) | **Default** — no `extra_spacing_char`; outlines visually merge | Prefer thick outline first; CSS may need a tiny nudge (`~-0.03em`) because browser stroke ≠ Godot outline |
| Line-height | N/A per glyph line — each label is its own control | use `line-height: ~1.15` on the word; space **rows** instead |
| Row pitch | Checkbox controls ~**56px** apart, hit box ~**62px** tall | gap / padding between filter rows ≈ half a capital’s height to a full cap height |

Other screens sometimes nudge `extra_spacing_char` / top / bottom (e.g. wishlist `extra_spacing_char = 1`) — treat those as one-offs. Filters stay at natural Baskerville spacing.

### Sticker / shop-label text

Outlined cream fill + ink stroke (angled **down-left** shadow). The **treatment** is shared; the **face** still follows the table above (filters → Baskerville; nav banners → Milonga).

| Token / class | Role |
|---|---|
| `--bpb-label-fill` | Cream-white letter fill |
| `--bpb-label-ink` | Outline + extrusion (`#442f1d`) |
| `--bpb-label-stroke` | Combined outline ring + hard shadow |
| `.bpb-label-text` | Apply the full treatment (defaults to display / Milonga for banner chrome) |

Use on gold banners, shop tags, and similar — not for body copy.

## UI patterns to borrow

- Soft parchment **panels** with thin dark borders (not heavy card shadows)
- **Filter rail** beside dense item grids (compendium)
- **Leather pouch grid** for backpacks on build pages
- Icon-first filters (class orbs, damage types)
- Recessed search fields carved into the panel
- Small version/meta text tucked in corners (optional)

## What not to do

- Flat `#F5F5F5` with a brown border pretending to be parchment
- Purple gradient “AI fantasy” skins
- Copy BPB Builds’ washed web parchment 1:1
- Overwhelm pages with hanging-banner chrome everywhere — use banners for key CTAs

## Implementation

- Tokens + atmosphere → `css/theme.css`
- Page layout → Tailwind
- Tooltip skin → `js/shared/tooltip.css` (unchanged approach)
- Real texture images can live under `assets/` later (parchment tile, leather cell); until then use CSS gradients/noise approximations
