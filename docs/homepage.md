# Homepage layout

Working plan for `/` (index). Theme: parchment + game art (`docs/theme.md`). Purpose: OP builds → YouTube growth (`docs/purpose.md`).

**Atmosphere:** fixed combat day→night sky (`combat-sky.js`), scrubbed by page scroll. Class showcase + builds vault are transparent over it. Explore items keeps its opaque dark stepped band.

## Goals of the homepage

1. Show **what this site is** in one glance (OP / broken builds + Smojo)
2. Get people into a **build page** or **watching a video**
3. Make the next steps obvious (browse builds, create, Discord/YouTube)

## Shipped structure (top → bottom)

### 1. Nav (`nav.js`)

Always on.

- Site name / mark (Smojo Builds)
- Links: Home · Builds · Items · Create. **OP is a Builds filter**, not its own nav item
- YouTube + Discord icons
- Sticky top bar

### 2. Featured stage (`featured-stage.js`) — primary header

**Job:** “Here’s something to watch / a build worth opening.”

- Scroll-snap video carousel from `is_featured` public builds
- Watch + View build CTAs
- This is the only big carousel
- Sits over the scroll-scrubbed combat sky (day at top of page)

### 3. Promo band (`home-promo-band.js`)

**Job:** full-bleed brand / OP pitch after the carousel.

- Transparent over combat sky (golden hour as you scroll)
- Dark rounded card: left art · centered copy · right art
- Orange **Now live** pill, title, lede, **Browse OP builds** → `/builds/?tags=op`

### 4. Class showcase (`home-class-showcase.js`)

**Job:** visual “choose your hero” strip (VH mobs-section layout).

- Transparent band — combat sky is dusk/night by here
- Sticker-outlined title + subtitle on Patch3 shade panels (no Classes pill)
- Horizontal scroll-snap cards (chibi sprites; hover expands blurb + **two starting bags**)
- Bag hover → item tooltip; name / portrait → `/builds/?class={Hero}`
- Sprites: `assets/characters/char-{class}.png` (from game chibi extract)

### 5. Items explore (`home-items-explore.js`)

**Job:** sell the Item Library the way VH sells skills (stepped dark band).

- Opaque dark stepped band flushed to the screen-frame edges (covers combat sky)
- Sticker-outlined title + lede + category blurb on Patch3 shade (no Items pill)
- Text-only category tabs in tooltip gold (`rgb(255, 226, 56)`) + sticker stroke
- Two columns: left copy / tabs / blurb / **View items** steel banner CTA · right dual-ring orbiting sprites
- Tabs: Weapons · Armor · Bags · Skills · Treasures (swap blurb + orbit set)
- Each load picks a **random** preview set per tab from the catalog (Armor includes helmets + boots/Shoes)
- Sprite hover pauses that ring + game tooltip
- CTA → `/items/?category={weapons|armor|bags|skills|treasures}` (catalog reads `category` on init)

### 6. Featured OP builds — card row (`featured-cards.js`)

**Job:** browse curated picks fast.

- Horizontal parchment cards: thumb, OP/Featured flair, title, class, author
- Data: public builds with `is_op` or `is_featured`
- **See all OP** → `/builds/?tags=op`

### 7. From the catalog (`catalog-strip.js`)

**Job:** bridge home → full feed.

- Hot | New toggle (default Hot), up to 6 cards
- Same card chrome as the OP row
- **Browse all** → `/builds/` or `/builds/?sort=new`

### 8. Search by class (`home-class-search.js`)

**Job:** jump into the builds feed filtered to one hero.

- Grid of class icons + labels (Ranger → Engineer)
- Each tile → `/builds/?class={Hero}`
- **Browse all** → `/builds/`

### 9. Create CTA (`home-create-cta.js`)

**Job:** one clear path into the creator.

- Parchment banner + **Create a build** → `/create/`
- Not the Play premium-cta sparkle plaque

### 10. Guides and chat (`home-channel.js`)

**Job:** light channel growth without competing with the hero.

- Short copy + YouTube / Discord icons from `social-links.js`
- No YouTube iframe / Data API strip in this pass

### 11. Footer (`footer.js`)

- Discord, YouTube, disclaimer, legal / catalog links

---

## Later (not on home yet)

| Skip for now | Why |
|---|---|
| “How it works” blurb | Onboarding; P2 |
| Full YouTube video strip / API | Channel growth; light social row covers MVP |
| Explore tools grid (Creator cards) | Items entry covered by items explore; Create CTA + nav for the rest |
| Second big coverflow carousel | Redundant with featured stage |
| Votes / comments chrome on home | Later |
| Performance hub | Later |
| Full community feed on home | Catalog strip is enough |

---

## Section priority vs purpose

| Priority | Section | Status | Serves |
|---|---|---|---|
| P0 | Nav | Shipped | Wayfinding |
| P0 | Featured video stage | Shipped | Watch + enter build pages |
| P0 | Promo band | Shipped | Brand / OP pitch after carousel |
| P1 | Class showcase | Shipped | Visual class → builds entry |
| P1 | Items explore | Shipped | Item Library entry + category deep-links |
| P0 | OP build cards | Shipped | OP niche + catalog entry |
| P0 | Catalog Hot/New | Shipped | Feed bridge |
| P1 | Create CTA | Shipped | Remix / create |
| P1 | Channel row + footer socials | Shipped | Channel + Discord |
| P2 | “How it works” blurb | Later | Onboarding |
| P2 | Explore tools grid (Creator) | Later | Future features |
| Later | Full YouTube strip | Later | Channel growth depth |

---

## Assets to lean on

- Promo band: parchment card; `ui-scholar-bag.png`, `hero-party-loot.png`
- Page atmosphere: scroll-scrubbed combat sky (`js/pages/home/combat-sky.js` + `assets/theme/backgrounds/combat/`)
- Items explore exception: opaque dark stepped band (covers sky)
- Panels: `assets/theme/backgrounds/bg-parchment-panel.png`
- Featured cards: `assets/theme/backgrounds/bg-parchment-panel-2x1.png`
- Hero art fallback: `assets/heroes/hero-party-loot.png`
- Attribution: `assets/brand/logo-backpack-battles.png`

## Open for owner

- Final site display name in nav
- Whether Items link needs stronger home promotion later
