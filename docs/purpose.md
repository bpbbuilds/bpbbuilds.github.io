# Website purpose

Product north star for BPB Website. When priorities conflict, this file wins.

---

## One-liner

> A Backpack Battles builds site with a **featured OP builds** home, deep per-build guide pages (route + YouTube), and later a community catalog — built to grow the creator’s channel.

## Why it exists

- Creator returning to YouTube; niche = **OP / broken Backpack Battles builds**
- Site pulls people into build pages where they watch the guide **on-site** (YouTube views still count)
- Inspiration: [BPB Builds](https://bpb-builds.vercel.app/items) for tools; **PCPartPicker** for catalog UX
- Domain leaning: generic BPB Builds–style (`bpbbuilds.com` / similar)

## Who it’s for

- Players who want a full **route/guide** for a build (not just a backpack screenshot)
- Viewers discovering OP builds + watching the showcase video
- (Later) Community posting normal builds; submitting OP candidates for approval
- (Later) People remixing builds in the in-browser creator

## Main jobs (ranked)

1. **Homepage featured OP section** → dedicated build pages
2. **Deep build guide pages** (see below) + seamless YouTube embed
3. **Build catalog** — named builds, filters/tags; votes/popularity **later**
4. **Remix** — open build creator preloaded with that build
5. **Item database** + tooltips
6. **(Later) Community builds** — free to post non-OP; OP requires approval
7. **(Later) Comments / auth / votes**
8. **(Later) Performance hub**

## Build page (core product surface)

URL shape: `/builds/{slug}` e.g. `/builds/bpbb321879`

A build page should teach someone how to **run** the build:

| Block | Content |
|---|---|
| Identity | Title, author (“by …”), tags (incl. OP when approved), class / subclass / class bag |
| Video | Seamless YouTube embed (views on YouTube; not self-hosted) |
| Backpack | Item layout on the grid + tooltips |
| Why it works | Synergies / explanation |
| Priority | **Essential** vs **nice to have** items |
| Route | **Round 3 skill** + **Round 10 skill** (required — every match picks these); other routing notes. Important amulets go on the board + **Needs / Wants** |
| Social | Share; like/dislike **later**. Discuss CTA: **Comment on YouTube** if the build has a video, else **[Discord](https://discord.gg/s5WghmrFSp)** |
| Actions | **Remix / create** → build creator with this build auto-loaded |
| Author | **[Smojo](https://www.youtube.com/@SmojoWasTaken)** — hardcode for MVP OK |

## Publishing rules

| Action | Who | Approval |
|---|---|---|
| Publish normal community build | Signed-in users (later) | **None** — post freely |
| Publish / feature **OP** build | Owner directly, or community **submit** | **Owner approval** required for OP |
| MVP publishing | Owner only | N/A |

Owner keeps a distinct **custom creator identity** on official OP posts.  
Community identity lean: **Steam login** (Steam name + avatar; less profile editing). Final auth choice still open.

## YouTube

- Example: https://www.youtube.com/watch?v=pcBjj7-78YA
- Iframe / IFrame API for seamless chrome; **views count on YouTube**
- No video files on Supabase
- YouTube Data API optional (titles/thumbs), not required to play

## Branding

- Generic builds brand preferred; homepage can still lead with Featured OP
- Clear author credit on every build page

## Competitive stance

Beat [BPB Builds](https://bpb-builds.vercel.app/items) on UX/visuals and depth of guide pages.  
Do not pixel-clone or imply official affiliation.

## Auth

- **MVP:** no public accounts required (owner publishes)
- **Later lean:** Steam for community name/avatar; custom brand treatment for owner
- Alternatives (Supabase Google/Discord) still OK if Steam is too heavy

## Out of scope (for now)

- Votes / comments / community posting before MVP build pages work
- Performance Hub
- Self-hosted video
- Pixel-perfect clone of the reference site

## Success looks like

- Homepage features OP builds → slug page has enough info to route the run + watch the video
- Remix path into the creator feels natural
- OP stays curated; normal builds can be open later without polluting the OP label
- YouTube views still accrue on the channel

## Tone / feel

- Game-adjacent, polished, guide-quality pages (not a bare form + grid)
- Creator-forward on OP; community space clearly separate later
- Embeds feel native

## Decisions log

- **MVP** = smallest useful first version: homepage with featured OP + at least one real `/builds/{slug}` guide page (full creator/catalog/auth can wait)
- Votes later; no native comment system at first
- Discuss CTA: YouTube if video linked, otherwise Discord
- Remix opens creator with build loaded
- Community posts: free; OP: approval required
- Author credit: **[Smojo](https://www.youtube.com/@SmojoWasTaken)** (hardcoded fine for now)
- Discuss fallback: [Discord](https://discord.gg/s5WghmrFSp)
- Round 3 + Round 10 skills = **required structured fields** on build guides
- Amulets = structured field when used (important, but not every build)
- Identity later: Steam lean for community; owner stays Smojo-branded
- Domain: generic BPB Builds–style
- Homepage layout: featured stage → OP cards → catalog Hot/New → Create CTA → channel row → footer (`docs/product/homepage.md`)

## Still open

- Final site/domain name
- Exact Steam vs other auth when community ships
- How freeform “why it works” writeup sits beside the structured route fields
- **Public launch (Phase 1)** — founding 50 Premium, Stripe, Discord roles, light blobs: [`launch-phase-1.md`](product/launch-phase-1.md)
- **After launch (Phase 2)** — parked tools (e.g. Premium `history.db` export): [`launch-phase-2.md`](product/launch-phase-2.md)
