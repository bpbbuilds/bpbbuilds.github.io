# Phase 2 — After public launch

Parked work that starts **after** Phase 1 URL go-live ([`launch-phase-1.md`](launch-phase-1.md)). North star: [`purpose.md`](../purpose.md). Day-to-day leftovers stay in [`todo.md`](../todo.md).

Not a second founding promo. Not “matches live PvP.” Still fan-site **tools**.

---

## Export history.db (Premium)

Download a synthetic Steam `history.db` so a site board can be tested in the game’s History practice fight (sword / rematch). Same idea as BPB Builds’ download; we already **read** this file on `/create/`.

- [ ] Encode current create draft (and published build page) → downloadable `history.db` (one run, one board)
- [ ] Premium / founding only; free users get the shared upgrade offer (same gate as Play / sim / board PNG)
- [ ] Copy: backup the real `history.db` first; Steam Cloud can overwrite; History practice only — not ranked, not CombatLog replay
- [ ] Never stamp these files **Real** — Real stays for runs the game wrote
- [ ] Skip or warn if a placement has no catalog `gid`
- [ ] Terms / Privacy one-liner: we can generate a local History file
- [ ] Later: two slugs in one file (this build vs that build)

`/sim/` stays the no-file share-a-link test. This is for people who want the real client.

---

## Build combat stats (sim-derived)

Show a compact readout of what a board does in the sandbox: **DPS**, **heal / s**, **max HP / s**, **block / s**, and the same family (unhealing / s, stamina / s, etc. if the meter already has them). Not live ranked PvP — seeded sim vs dummy or a chosen foe, same honesty as `/sim/` (coverage chip, not “matches live”).

- [ ] One stats snapshot per board from a short sim run (default dummy; optional vs-build later)
- [ ] Surfaces: **build pages**, **`/sim/`**, **build hover tips**, catalog thumbs (feed / vault / picker) — same numbers, not a second formula
- [ ] Label the foe + duration so “DPS” isn’t a naked number (dummy 30s ≠ mirror)
- [ ] Skip or dim stats when coverage is too thin to be useful
- [ ] Cache or bake on publish so catalogs don’t run a full sim on every hover
- [ ] Don’t invent extra metrics the sim doesn’t already track; add rows only when the engine has them

---

## Cosmetics marketplace

Player **buy / sell** of **our** cosmetics (hats, overlays, the rest of the blob loadout, and **profile backgrounds**), not Backpack Battles items. Cosmetics attach to the Light blobs / profile hub in [`launch-phase-1.md`](launch-phase-1.md) and [`profile/profile.md`](../pages/profile/profile.md). Art / overlay contract (deferred): [`blob-cosmetics-pipeline.md`](../pages/profile/blob-cosmetics-pipeline.md). Phase 1 ships a small original-art set with **no** shop, trade, or coins — this is the later economy on top of that inventory.

Detail (currency, fees, listings UI) when we get to it. Until then: do not build a shop in Phase 1.

- [ ] Marketplace where users can list, buy, and sell cosmetics they own
- [ ] Listings and ownership tied to blob + profile-background inventory / equip (same items as profile + overlay)
- [ ] Original art only — not game item sprites or publisher marks
- [ ] Privacy / Terms when money or peer trades exist (stubs + [`monetization-ip.md`](monetization-ip.md) if the mix changes)

---

## Events hub

Owner **manage hub** for multiple community events (contests, featured weeks). Phase 1 ships only a **thin single launch event** ([`launch-event.md`](../pages/events/launch-event.md) · [`launch-phase-1.md`](launch-phase-1.md)) — not this hub.

- [ ] Events manage hub (owner) so you can run community events after the first launch contest
- [ ] Admin **event creation portal** owns entry knobs (`judgeWindowSec`, `requiredItemIds`, `maxEntriesPerUser`, `showSimDpsOnEntry`, `leaderboardVisibility`, …) — catalog holds defaults until then
- [ ] Public/community side of an event lands with that design (multi-event listing, archives)
- [ ] Event create flags (e.g. `hasVoting`, `hasBuilds`) drive which detail tabs appear
- [ ] Highest-DPS **auto** pipeline: `history.db` upload → fixed dummy / window score → leaderboard — [`highestDPS.md`](../pages/events/eventIdeas/highestDPS.md)
- [ ] **Highlight video from top 3:** after auto (or manual) leaderboard, export/replay top boards and cut a results video — same doc
- [x] Site **Enter event** wizard (history.db + gates + permanent build submit) — polish / LB UI still open
- [x] Builds catalog **Events** dropdown (All events / per-event; launch slug `highest-dps` wired; full multi-event hub still Phase 2)
- [x] Mid-event build privacy (gallery private until entries close; author can still see own entry)


