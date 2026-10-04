# Cursor handoff

Cursor writes this file only. Codex writes [`CODEX_HANDOFF.md`](CODEX_HANDOFF.md). Read **both** before starting. Do not edit the other handoff. Do not invent progress. Label new ideas **Proposal** until measured or approved.

Durable how-to stays in [`features/screenshot-detector.md`](features/screenshot-detector.md). Product intent stays in [`purpose.md`](purpose.md). Shared instructions stay in root [`AGENTS.md`](../AGENTS.md) — only one assistant edits that file at a time.

## Owned paths

Cursor released screenshot import on 2026-10-01. Codex owns these paths. Cursor does not:

- `js/shared/screenshot-grid.js`, `js/shared/screenshot-detector.js`
- `js/pages/create/screenshot-*.js`
- `scripts/screenshot-detector/`, `scripts/screenshot-eval/`, `scripts/screenshot-to-build/`
- `dev/screenshot-import/`, `dev/export-check/`
- `assets/data/detector-manifest.json`, `assets/data/detector-classes.json`, `assets/data/detector-bag-manifest.json`, `assets/data/detector-bag-classes.json`
- `assets/ml/screenshot-detector/`
- `docs/features/screenshot-detector.md`

Cursor still owns `docs/CURSOR_HANDOFF.md`. The history below stays here. No screenshot-import files were moved or deleted.

---

## Confirmed — project

Fan site for Backpack Battles builds (GitHub Pages + Supabase). Create-page screenshot import is the active accuracy work: a player crops a board with the Snipping Tool and the site tries to rebuild bags, items, rotations, skills, and loose jewels. Socketed gems stay on the host item.

| Piece | Live state |
|---|---|
| Item detector | **v1**, 426 classes, [`assets/data/detector-manifest.json`](../assets/data/detector-manifest.json) → `/assets/ml/screenshot-detector/v1/screenshot-detector.onnx` |
| Bag detector | **bags-v1b**, 27 classes — not retrained |
| Pipeline stamp | `seam` in [`js/pages/create/screenshot-pipeline-ver.js`](../js/pages/create/screenshot-pipeline-ver.js) |
| Grid | Leather-seam pitch in [`js/shared/screenshot-grid.js`](../js/shared/screenshot-grid.js) (`detectBagGrid` + `bestLattice`). Square cell. Cols/rows come from that pitch (can be 9×7, 12×7, 10×7, 7×6, 9×9, 8×8). |
| Bags | Cover may override cell size via `cell-from-boxes` in [`js/pages/create/screenshot-bags.js`](../js/pages/create/screenshot-bags.js) when bag boxes disagree with the fabric grid by >25%. That override is why leather-quad scored 3/5 on the seam run. |

A 518-class ONNX and [`scripts/_cache/synth-detector-v5/classes.json`](../scripts/_cache/synth-detector-v5/classes.json) must ship together. Live v1 cannot emit the 92 newer skill and jewel class ids.

---

## Confirmed — screenshot recognizer approach

1. Detect the leather grid from seam spacing (`bestLattice`). Crop to `bagRect`.
2. Item YOLO (YOLOv8n, input 640) names items. Bag YOLO names bags.
3. Boxes snap onto the grid. Solver, paint-refine, and gap-fill write the board.
4. Gap-fill can invent catalog items. It does not invent jewels. Skills stay backpack placements when detected.

Eval drives `/dev/screenshot-import/` in Playwright:

```bash
node scripts/screenshot-eval/run.mjs real-001 real-003 real-007 real-008 real-010 real-013 leather-quad pine-protector
```

Restore the live manifest with `Copy-Item` of [`scripts/_cache/detector-manifest-v1-backup.json`](../scripts/_cache/detector-manifest-v1-backup.json) (or the live backup written for an eval). Do not `Set-Content -Encoding utf8`.

---

## Confirmed — previous attempts

| Attempt | Result |
|---|---|
| Live v1 (426) | 58/150 on the seam grid. Still what the site uses. |
| v5-80 (518 classes, ~11k images, ~2.1 h, batch 32) | **64/150** on the seam grid. Best cached real-shot model. Weights: `scripts/_cache/synth-detector-v5/best-epoch80.pt`. ONNX: `scripts/_cache/synth-detector-v5/screenshot-detector.onnx`. |
| detect-ft / detect-ft2 | 62/150 and 64/150. Did not beat v5-80. |
| Forced 9×7 lock (`leather AABB / 9` and `/ 7`, cell-from-boxes off) | Regression. v5-80 fell to **47/150**; v7b on that grid was **43/150**. Reverted. Seam finder is back. |
| detect-v7 then detect-v7b (79 epochs on ~68k painted boards: old set + 7000 `exp7k_` boards × 8 copies) | **54/150** on the restored seam grid. Worse than v5-80 and worse than live v1. ONNX kept in cache only: `scripts/_cache/synth-detector-v5/screenshot-detector-v7b.onnx`. Not published. |
| Extra painted boards | Site-drawn sprites on a game background, not photos. Last useful painted train moved 58→64. The 7k run made it worse. |

Justin will **not** hand-label more than the existing 15 snips and does **not** want another train unless he asks.

Held-out (never train): real-001, 003, 007, 008, 010, 013. Train split of the 15: 002, 004, 005, 006, 009, 011, 012, 014, 015. Also scored: leather-quad, pine-protector.

---

## Confirmed — blockers

- Failures are mostly **empty detections** (2–8 boxes), not a missing 9×7 lock. The two good snips already lock 9×7 and return ~50 boxes (real-001 27/29, pine 29/29).
- real-003 is **4096×2304**. The model always sees a 640 image, so that board smears and scores **0/23**.
- Skills **1/7**, loose jewel **0/1**. Live v1 cannot output those class ids.
- **130/150** is not reached. Snapping a handful of boxes onto a perfect grid still leaves those boards empty.
- `C:\bpb-detector-train` may still hold an SSD copy of the train set (~20 GB). Originals stay under `scripts/_cache/synth-detector-v5` on D:. Safe to delete the C: copy if space is needed.

---

## Confirmed — recent changes

- Todo lists an Item ideas page under Later / research. It is not built.
- Admin Cosmetics catalog images open the cosmetic tooltip. The tooltip adds Obtained by for starter, Premium, Founding, and event cosmetics. A plain market buy keeps the gold worth and skips that line.
- Create Build tab “Why it works” item chips open their tooltip to the left of the chip.
- A history-locked create board can still drag items onto Needs, Wants, and Good to have. That only sets priority. Moving, parking, or selling the item still asks to clear the run. Dropping it back on the same cell does not.
- Cosmetics Publish now sends the owner session. Missing wardrobe PNGs no longer request broken image URLs; Premium Crown still uses its file. The local preview script is allowed by the page policy hash.
- Admin Members uses the rewards plate. The three charts sit in one row, one chart per column.
- Admin Analytics visits sit on the rewards plate. Page rows use the form well: gold name, cream counts.
- Admin Members charts sit on the Patch3 shade. Lines, dates, and counts are cream, with a gold Premium line.
- Admin build tooltips get the creator’s Discord picture or blob. The admin-builds list now includes `avatar_url` and `equipped_avatar` from the author’s profile.
- Page CSP `frame-src` now allows this site, so the admin blob-cast preview can load `/overlay/blobs/`. YouTube embeds stay allowed. `frame-ancestors` is already absent from the live meta policy, and `font-src` already allows the Google font host. The Permissions-Policy ad-auction warnings are not sent by GitHub Pages.
- Events catalog is only DPS Stone (`highest-dps`). The six filler events were removed. Discord already posted only DPS Stone.
- Discord Community info has a read-only Cosmetic drops channel. Admin catalog rows have Publish. Upload still only saves. Publish records the cosmetic and the bot posts it once. Quest and event cosmetics stay quiet until published.
- Discord Website Stats sits directly under Main Chat. Information and the other categories follow it.
- Discord Website Stats has a locked voice channel for founding members, `👑 Founding members: used/10`. It follows `get_founding_status` and updates with the uploaded-builds counter.
- Patch notes todo now uses [BPBのビ](https://www.univ-bpb.tech/) as the historical backlog and asks for a reviewed draft when a new note appears. The page is not built.
- Discord build votes use the site’s up and down arrow icons. Discord still draws them as its own gray buttons, with the score between them.
- Discord build embeds add a Watch link when the build has a YouTube video. Builds without a video stay as they were.
- Discord build posts have Up and Down buttons. They use the same site vote score. Only a Discord account that has signed in on the site can vote. The middle button shows the score, and a site vote updates it on the next check.
- Discord build embeds put the links in columns: Create your own, View, More builds, and More from the creator. The old stacked link list was removed. All 10 current posts were updated.
- Discord build posts show the creator’s blob or Discord picture as the small image on the right of the embed. The board stays the large image. All 10 current posts were updated.
- Discord builds forum class tags use the class icons. Discord still requires a unique tag name, so the class word is gone and only a dot remains beside the icon.
- Discord build posts turn `[[item_id]]` into the item picture. Those pictures live on the bot’s emoji list (2,000), because the server list only holds 50 and 30 are already used.
- Discord event cards drop the description paragraph. DPS Stone lists the place rewards (Premium Crown, gold, gift card, titles) instead of “Event Trophy”.
- Discord events channel uses a small image on the intro. Each current event is one card with that event’s banner and its links. New events are posted on the next check. Ended or removed events are deleted.
- Discord onboarding is on. Everyone gets welcome, rules, announcements, main chat, builds, events, and bot commands. A question adds item ideas, cosmetics, past events, quest, market, and Premium.
- Discord membership screening is on. New members accept the server rules before they can talk.
- Discord server profile now has a description and a welcome screen: welcome, rules, main chat, the builds forum, and events.
- Discord rules are conduct rules. They no longer list what each chat allows.
- Discord welcome embed uses columns. Server columns are the category name, then the channel tags, with no per-channel writeup.
- Discord welcome is one message and one embed. The other welcome messages were removed. The logo stays on that embed.
- Discord past-events forum is under Forums. Finished events go there, and people can reply under a post.
- Discord Community info holds quest, market movement, and events. Current Events and Archived Events were removed.
- Discord main chat sits above every category.
- Discord Admin category is last. Community updates sits in it, still hidden from everyone except the Admin role. The extra Website Stats category was removed.
- Discord welcome GIFs show again. The first embed edit stored them with no size, so Discord drew nothing. A second edit after the files cached fills the size.
- Discord welcome GIFs play at 24 fps: the item catalog, the builds grid, and the create promo. The slide speed is the same as before.
- Discord quest channel in Information says quests are not made yet (TBA). Quest information goes there once quests exist.
- Discord events channel under Current Events posts new events, starting-soon notices, stage changes, and endings. Members cannot type there.
- Discord `/profile` shows the member’s blob, then their name and uploaded build count.
- Discord `/blob` shows a member’s equipped blob as an image embed.
- Discord `/inv` pages through a member’s blob inventory. Each page is one item on the blob, with Previous and Next.
- Discord market-movement channel says the market is not made yet (TBA). Reports start once the market exists.
- Discord channels sit in Information, Chat, Forums, events, then Website Stats. Definitely-post-here is in its own category at the bottom.
- Discord Premium channel explains the site Premium list. Members cannot type there.
- Discord welcome Builds card scrolls the builds-page grid.
- Discord welcome, rules, and announcements headers use the BPB logo.
- Discord welcome GIFs play slower, with more frames: catalog scroll, builds carousel, and the create promo.
- Discord welcome header uses the BPB logo.
- Discord `/test` replies that the bot is online. Register guild commands with `npm run bot:commands`.
- Discord welcome Create card uses a looping GIF of the home-page build creator filling a board.
- Discord welcome Builds card uses a looping GIF of the home-page featured builds carousel.
- Discord welcome Items card uses a looping GIF of the item catalog scrolling.
- Discord welcome guide no longer has a Home card. Each remaining section is still one embed.
- Discord build embeds keep the creator face as the small thumbnail only. The face is no longer drawn on the board picture.
- Discord welcome guide uses one embed per section. The picture and the text sit in the same card.
- Discord **Website Stats** category sits under announcements. The first counter is a locked voice channel, `🎒 Uploaded builds: N`, for every build saved on the site. The bot refreshes the number when it changes. Welcome mentions the category.
- Discord announcements channel `📢│ᴀɴɴᴏᴜɴᴄᴇᴍᴇɴᴛꜱ™` is read-only, just under rules. One embed says site and server news is posted there, with the site logo above the text. Welcome and rules mention it.
- Discord rules channel `📜│ʀᴜʟᴇꜱ™` is read-only, just under welcome. One embed holds the rules, with the site logo as the image above the text. The bot removes anything else posted there.
- Discord builds forum posts were deleted and sent again. Each board image has the creator’s blob or Discord picture in the bottom right, with a gold ring. The embed’s small thumbnail is that same face. The picture stays inside the embed.
- Discord forum `cosmetic-submissions` is under Forums. People post new blob cosmetics there with the art, the name, and a slot tag (Hat, Face, Neck, Full head, Body, Hand). A tag is required. The welcome guide mentions it.
- Discord welcome channel is a five-message guide. Each section is an embed with a banner image above the copy: the site pages (home, items, builds, create, events, market, quest, sim, profile, about), this server (main chat, builds forum, item ideas, bot commands, nicknames), and the YouTube channel @SmojoWasTaken. The channel stays read-only. The honeypot is not mentioned.
- Discord builds forum posts show the Export PNG inside the embed only. The loose file above the embed was removed. The picture is a public `discord-builds` storage URL. The creator face stays on the post as a normal image link.
- Discord builds forum links (create a build, view this build, view other builds) are in the auto-post embed. The separate follow-up message was removed.
- Discord builds forum cards show the board. Each public post’s embed image and thumbnail are a picture of that build (saved still, or a painted board when no still exists). Creator name, class emoji, and the link follow-up are unchanged. Existing posts were recreated so the board is the preview.
- Discord builds forum Class field uses the class emoji instead of the class name. Forum tags still use the class name.
- Discord builds forum posts credit the creator: their display name plus the Discord picture or website blob they picked in settings. Clicking the name opens their profile.
- Discord builds forum posts include a follow-up with links: create a build, view that build, and the builds catalog. Members cannot create posts. The bot still posts public website builds. Replies under an existing post are still allowed.
- Discord nickname changes stick. The bot rewrites them to `whatever they set | 🎒 real build count`. A cleared nickname falls back to the Discord name plus that count. Sign-in and publish keep the chosen name and only refresh the number.
- Discord nicknames are `Name | 🎒 count`. The backpack marks the number as uploaded builds. The server owner still cannot be renamed by the bot.
- Discord server emojis: 8 classes, 8 ranks (bronze through grandma), and the combat icons people name in chat (heat, poison, mana, regeneration, vampirism, spikes, block, empower, luck, cold, blind, weak, protection, stamina). UI chrome was not uploaded. Tier 0 still has room (30 of 50).
- Discord honeypot `🍯│definitely-post-here` is the last channel in the server list, under Forums. It is still visible so a spam bot can post in it.
- Discord welcome channel (`👋│ᴡᴇʟᴄᴏᴍᴇ™`) no longer accepts messages. @everyone is denied send, threads, and app commands there. The bot removes anything else that lands in the channel. The existing welcome note stays.
- Discord **builds** forum now receives each public website build. `npm run bot:watch` posts title, class, author, Real/Feasible/Theory, rank, link, and the board still when one is saved. Private builds are skipped. Forum topic says posts come from the website. Tags: class, Theory/Feasible/Real, OP.
- P8 photometric normalization + DINOv2 retrieval (eval only, `scripts/screenshot-eval/p8/`). The live importer was not changed. Ordinary-item top-5 stays **36/150** after 15 automatic normalizations (CLAHE 37/150). The five dimmed shots stay at **0/83** top-5 (CLAHE 1/83). Edge-only lifts top-20 to 47/150 and drops pine-protector top-1 from 20/29 to 17/29. DINOv2 ViT-S/14 is **16/150** top-5 and **1/41** on orbs/amulets/berries; equal-rank fusion with NCC reaches **43/150** top-5 and **5/83** on the dimmed shots. The pine-protector / real-001 pair is not a brightness pair (median luma ratio 0.999, interior correlation 0.915). Game hover is `Color(1.3,1.3,1.3)` on the hovered item, and edit-mode idle is alpha 0.6; inverting alpha 0.6 does not move recall. Evidence: `scripts/_cache/screenshot-eval/baselines/2026-10-01-p8/`.
- P9 forensic alignment (eval only, `scripts/screenshot-eval/p9/`). The live importer was not changed. Falcon Blade (3,1) gray NCC inside the production ±4px window is pine **0.791** at dx=4 and real-001 **0.026** at dx=4, matching P8. The same sprite at scale 1 and 0° residual reaches pine **0.927** (dx=4, dy=-1) and real-001 **0.897** (dx=6, dy=1). The real-001 peak is 2px outside ±4. Along dy=1 the real-001 scores are dx=4 **0.003**, dx=5 **0.520**, dx=6 **0.897**, dx=7 **0.516**. Pine’s ridge is dx=4 **0.927**, dx=6 **0.159**. Djinn Lamp (5,4) and Mana Orb (4,1) show the same pattern (real-001 ±4 scores 0.135 and 0.228; best at dx=7 and dx=6 are 0.812 and 0.892). Strong Stone Skin Potion peaks at dx=4 on both shots (0.956 / 0.970), which is why ±4 already ranks it 1. Edge-hit after that alignment is 0.92–0.95 for both Falcon blades. Pine item pixels transferred onto real-001 score **0.888** for Falcon (3,1). Across 29 shared items, 21 transfer at ≥0.70 and 0 of the catalog-strong masks fail the transfer. Shovel-B01 3000 stays ≤0.27 and Vampiric Armor ≤0.29 inside ±24px, scale 0.9–1.1, and ±8°. Those two are separate from the Falcon miss. Inventory art is one PNG (`Items/Sprites/FalconBlade.png`, icon scale 0.5); the cooldown shader is cleared when progress is 0; `FalconBladeAnimation.tscn` is a combat swoosh. Of 518 references: 470 single-layer game paths (120 `Items/Sprites`, 324 `Exclusive/Sprites`, 25 `Gems`, Fanfare), 28 layered bakes, 20 precomposed potion stills. Sheets: `scripts/_cache/screenshot-eval/baselines/2026-10-01-p9/sheets/`.
- P10 registration-window sweep (eval only, `scripts/screenshot-eval/p10/sweep.mjs`). The live importer was not changed. Same P3 thumbs NCC (gray 0.5 + edge 0.5, stride 2, 518 classes). ±4 reproduces P8: ordinary top-1/5/10/20 = **31/36/37/39** of 150. ±6 is **39/46/49/50**. ±8 is **42/47/47/49**. ±12 is **39/48/49/50**. The gain is real-001 top-5 **10 → 21** at ±8 (20 at ±12). Clean-bright top-5 stays **26/38**. The five previously failing shots stay **0/83** top-5 until ±12 (**2/83**). Of 29 truth references with gray NCC ≥ 0.70 inside ±12, 9 sit outside ±4 (dx 6 or 8; |dy| ≤ 2); none sit past ±8. ±6 and ±8 displace no ±4 top-1 or top-5 hit. ±12 displaces two pine Blueberries top-1s and one real-001 Djinn Lamp top-5, all to Wisp. 105/150 stay gray < 0.45 at ±12, including Vampiric Armor, Shovel-B01 3000, and Con-Trap-Tron on both paired shots. Wall clock 380s for all four radii in one pass. Evidence: `scripts/_cache/screenshot-eval/baselines/2026-10-01-p10/`.
- P11 geometry and scale sweep (eval only, `scripts/screenshot-eval/p11/run.mjs`). The live importer was not changed. Match crops are already 48px per detected cell, so a pure UI zoom cancels. On the 82 judged items (Vampiric Armor held out), translation ±12 at the catalog scale reaches gray NCC ≥0.45 for **0**. Sweeping uniform scale 0.55–1.55 reaches ≥0.45 for **1** (real-008 Star of Courage 0.506 at ×1.55, dx=−55, template origin clamped outside the crop) and ≥0.60 for **0**. Median scales are real-003 **0.74**, real-007 **0.65**, real-008 **0.90**, real-013 **0.66**, leather-quad **0.68**, with 30/82 winners on the 0.55–0.60 or 1.50–1.55 bounds. Anisotropic ±15% reaches ≥0.45 for 2 items (0.47, 0.46). Reranking all 518 classes at each shot’s median scale, ±8, stays **0** top-5. real-007’s seam cell is already ~80px (the game cell) and still fails; working real-010 downsamples 2.2×. Evidence: `scripts/_cache/screenshot-eval/baselines/2026-10-01-p11/`.
- P12 cross-screenshot transfer (eval only, `scripts/screenshot-eval/p12/run.mjs`). The live importer was not changed. References are item pixels from a working shot, masked by that shot’s catalog alignment, then searched ±12px and ×0.90–1.10 on the failing truth crop. Trusted locks (catalog gray ≥0.70): real-010 Banana **0.917**, real-001 Prismatic Orb **0.979**, real-010 Piggybank **0.880**, real-010 Star of Courage **0.928**. Self-check on every extract is **1.0**. On 11 trusted pairs, screenshot→screenshot gray ≥0.45 is **0** and ≥0.70 is **0** (best 0.330). Edge and RGB ≥0.70 are **0**. A 5-class bank (those four plus Blueberries at 0.658) ranks the true class top-1 on **2/15**; both wins are margins under 0.05 and every score stays under 0.49. Top-5 is 15/15 only because the bank has 5 classes. Amulet of Steel never locks (0.449) so real-003 is not in the trusted fork. Sheets: `scripts/_cache/screenshot-eval/baselines/2026-10-01-p12/sheets/`.
- P13 truth-to-image registration audit (eval only, `scripts/screenshot-eval/p13/run.mjs`). The live importer and the truth files were not changed. Pine Falcon Blade and real-010 Banana sit in the detected cell, so the overlay is aimed correctly when the lattice is right. real-007’s audited items (both bananas, Doom Cap, Darksaber, Blueberries, Holy Armor) are visibly inside the detected cells. real-013’s Star and Piggybank are inside theirs. real-003’s 12×7 pitch is 310px against a 413px 9-wide cell; by column 8 the truth box is on the combat HUD, not the herbs. real-008’s 7×6 pitch is 90px against 70px; Star of Courage (7,2) and Banana (6,4) sit in the 9×7 cell, and the detected cell is the next object over. A canon-9×7 board search finds that star at gray **0.709**. leather-quad’s 9×7 lattice matches itself and still misses: the boxes land on empty margin, and the pig is found about two cells away (search crop is the pink pig, gray **0.517**). Overlays: `scripts/_cache/screenshot-eval/baselines/2026-10-01-p13/overlays/`. Zooms: `.../zooms/`.
- P14 corrected-registration retrieval (eval only, `scripts/screenshot-eval/p14/cut.mjs` and `rank.mjs`). The live importer, the truth files, and the P10 scorer were not changed. real-003 and real-008 were recut on bag width/9 × bag height/7. leather-quad kept that 9×7 pitch and shifted origin by the pig center: **+221.67px, +148.33px** (pig gray **0.654**). Visual audit of every ordinary cell: leather **5/5** contain the labeled item (Broom’s cell also runs off the photo, cover 0.679). real-008 **13/22** contain the item; **8** are still the neighboring object; Star of Courage is only the top of the star. real-003 **3/23** contain the item (collar, boots, rapier); **19** are still HUD, the logbook, or a neighbor, because the seam bag rectangle includes the combat panel. Same P10 ±8 catalog pass on the new crops: real-003 **0/23** top-20, real-008 **0/22** top-20, leather **1/5** (Piggybank rank 1, gray **0.604**). Correct-reference gray medians: real-003 **0.141 → 0.126**, real-008 **0.120 → 0.150**, leather **0.172 → 0.230**. Cross-shot transfer on the new crops: Piggybank **0.657**; Star **0.216**, Banana **0.180**, Prismatic Orb **0.278**, Amulet of Steel **0.368**. Global ordinary ±8 becomes **43/47/48/48/50** of 150 (was **42/46/47/47/49**). The one new hit is the leather pig. real-007 and real-013 were not recut. Evidence: `scripts/_cache/screenshot-eval/baselines/2026-10-01-p14/`.
- P15 native forensic comparison (eval only, `scripts/screenshot-eval/p15/run.mjs`). The live importer and the truth files were not changed. Crops stay at screenshot resolution. Working controls lock: real-010 Banana anchored gray **0.96**, Star of Courage **0.99**, Piggybank **0.97**. real-007 Banana is that same sprite (free search **0.73** on the banana, with an extra highlight). real-008 Banana shows the same stem, outline, and ridges, but the collision window clips the body and the free search locks onto the neighboring scales at **0.50**. Leather Piggybank **0.88** and Wooden Buckler **0.93** match the current PNGs on the same photo where Wooden Sword (**0.41**) and Shortbow (**0.22**) do not: the photo sword has a straight crossguard and a narrower blade; the only `WoodenSword.png` has curved quillons and a wide diamond blade. real-013 Star and Piggybank are a few pixels wide (cell ~31px); the scale search sits on its 0.55 floor. Spicy Banana scores **0.30** on the working banana and is not a better reference. No second Banana, Wooden Sword, or Star of Courage sprite is in the extract. Sheets: `scripts/_cache/screenshot-eval/baselines/2026-10-01-p15/sheets/`.
- P16 visual bounds and occlusion trim (eval only, `scripts/screenshot-eval/p16/run.mjs`). The live importer was not changed. For the seven current-art diagnostics, catalog alpha outside the gameplay footprint is **0** (pineapple and Holy Armor **0.1%**), and **100%** of that alpha is already inside the production crop (footprint ±1.5 cells). A visual-bounds crop therefore matches the existing ±8 gray scores exactly: real-007 Banana **0.188**, Doom Cap **0.130**, Darksaber **0.128**, real-008 Banana **0.144**, Flute **0.230**, Pineapple **0.149**, Holy Armor **0.083**. None enter the top 200 of 518. Keeping the best 85/70/55% of sprite pixels raises those grays into the 0.4–0.8 range and raises distractors with them; 70% trim ranks stay **156–289**. Socket-disk masking lowers Darksaber (**0.064 → 0.007**) and Falcon Blade (**0.796 → 0.748**). A 3×3 blur does not move real-007 Banana (**0.188 → 0.205**). Square-footprint items are only tested at face 0: real-010 Banana is **0.218** at face 0 and **0.883** at the labeled face 3. Star, Falcon Blade, and Strong Stone Skin Potion stay rank 1. No full-benchmark rerun. Evidence: `scripts/_cache/screenshot-eval/baselines/2026-10-01-p16/`.
- P17 visual rotations plus the real-007 Banana resample check (eval only, `scripts/screenshot-eval/p17/rotate.mjs`, `banana.mjs`). The live importer was not changed. Square and 1×1 classes are scored at face 0 only: **185** 1×1 and **94** square multi-cell classes, **279/518**. Rectangular classes already get four faces (**239**). No thumb matches a 180° copy at gray 0.97 (Rainbow Orb is the high one, **0.924**). Scoring all four faces, max per class, same ±8 crops: ordinary top-1/3/5/10/20 goes **42/46/47/47/49 → 43/47/51/54/54** of 150. Face evals **1.98×**, wall **232s**. Six top-5 misses return on a new face: real-010 Banana **255 → 1** (face 3, gray **0.215 → 0.917**), real-010 Whetstone, and four Amulets of Darkness. Two Blueberries leave the top 5 (pine **1 → 6**, real-001 **3 → 6**). 1×1 top-5 **24 → 27** of 55. Square top-5 **0 → 1** of 16. Rectangles stay **23** top-5. real-003, real-007, real-008, real-013, and leather-quad stay **0** top-5. The real-007 Banana native pose replays at **0.733** and is **0.771** after the production box average. That pose sits **+27.6, +9.9** match pixels from the footprint center, outside ±8. Resamplers were not compared. Evidence: `scripts/_cache/screenshot-eval/baselines/2026-10-01-p17/`.
- P18 visual-anchor audit (eval only, `scripts/screenshot-eval/p18/anchor.mjs`). The live importer was not changed. The matcher places the sprite center at the rotated body-AABB center plus the unrotated `(anchorX, anchorY)`. The board painter rotates that anchor with the face. Banana’s anchor is **0**, and Icon and CollisionMap share `(17, -19)`, so that difference does not move Banana. On trustworthy cells, correct-class gray ≥0.60 is **41/94** inside ±8 and **64/94** inside ±40 (**67/94** on the full crop). real-007 is **0/27** inside ±8 and **20/27** on the crop. Sixteen of those peaks sit at about **+29, +11** match pixels on faces 0–3 and on columns 0–8. real-010 Banana is face 3 at gray **0.779**, **+3, +2**. Rotating the anchor raises ≥0.60 inside ±8 from **41** to **43**. No 518-class rerun. Evidence: `scripts/_cache/screenshot-eval/baselines/2026-10-01-p18/`.
- P7 board size: create, collision, the renderer, saved drafts, and published builds stay 9×7. Every labeled cell on the eight shots already fits that board. Create import now stops when the seam grid is a different size and tells the user the photo was not placed. The seam finder itself is unchanged. The eval sandbox still allows those grids so the 58/150 run stays comparable.
- P6 small objects (eval only, `scripts/screenshot-eval/small-objects.mjs`): skills use the 58 Skill classes on the labeled cell (6/7 cells are inside the detected grid; Thornburst on real-008 is not). Top-1 is 2/7, against live v1 at 0/7. The one loose jewel, Chipped Sapphire, is cropped at native resolution against the 34 Gem classes and misses (top-1 Chipped Ruby; v1 is 0/1). Socketed gems use the known socket offset on the labeled host and are stored on that host: top-1 2/15. Live v1 places 0 of the 11 hosts, so that pass would not run on these shots. The importer is unchanged. Evidence is in `scripts/_cache/screenshot-eval/baselines/2026-10-01-p6-small/`.
- P5 global selection (eval only, `scripts/screenshot-eval/global-select.mjs`): non-overlapping sprite matches on the bag cells from the live v1 run, kept only at a 0.55 visual+edge score. It scores 15/150 against the live placer's 58/150, with 2 unsupported placements instead of 38, and 238 bag cells left empty. It does not replace the placer. Evidence is in `scripts/_cache/screenshot-eval/baselines/2026-10-01-p5-select/`.
- P4 candidate recall (eval only, `scripts/screenshot-eval/candidate-recall.mjs`): for each labeled region, rank only catalog items with the same footprint, and only when that footprint sits on the detected grid and on the fixture's bag cells. Bright top-5 is 38/69 (pine-protector 19/29, real-010 8/10, real-001 11/30). Mean pool is 136 because most shapes are 1×1. Dimmed shots stay near zero. No solver was started. Evidence is in `scripts/_cache/screenshot-eval/baselines/2026-10-01-p4-candidates/`. The live importer is unchanged.
- Events catalog narrow view (≤1240px): the gold Filters tab is no longer a fixed vertical tab on the screen's right edge (it pushed the feed left with a 2.15rem right gutter). It is now an in-flow gold button above the feed, right-aligned (`.events-filters__open-row` in `events.css`; markup moved to the top of the layout in `catalog.js`). The rail still opens as a right-hand panel; backdrop/Escape close, focus returns to the toggle. The catalog skeleton mirrors the row (`events-skel-open-row`). Desktop (>1240px) keeps the sticky rail beside the feed, unchanged. Verified with `scripts/_cache/check-events-filters.mjs` (Playwright: 390/768/1100 toggle in flow + flush right, drawer open/close + focus, no horizontal overflow; 1300 desktop unchanged).
- Home create promo: items flying onto the board keep their shape. The flight uses one scale, so wide and tall sprites are no longer stretched to the landing box.
- Profile Settings identity is the Discord picture and the website blob. Click one to use it. The chosen picture has a gold border; the other is greyscale.
- Create history picker: a one-round run’s current-round outline hugs that round icon. It no longer stretches across the preview.
- Create history picker: the Class dropdown is a 3-column grid of class icons above the search. Several classes can be on at once, and the list shows runs for any of them. None lit still shows every class. The Mode dropdown stays. Event entry still uses the single-select icon row.
- Reverted the forced 9×7 cell (`bagRectW/9`, `bagRectH/7`) in `detectBagGrid`. Seam pitch + `bestLattice` is live again.
- Restored `cell-from-boxes` / leather lattice override in bag cover (needed for the 64/150 leather 3/5 score).
- Pipeline stamp set to `seam`.
- Live manifest is v1 again. v5-80 and v7b ONNX stay in cache only.
- Split the shared handoff into this file and `docs/CODEX_HANDOFF.md` so the two assistants do not overwrite each other.
- Create onboard Media drop is a soft rainbow wash plus a hue-shifting dashed border, with `GalleryOrb.png` instead of the word Media. The history.db label, path, and Copy path are white.
- Free Premium chip uses `assets/item-thumbs/2x/Crown.webp` at its own size. The old 16×12 pixel hat was scaled about 3.7× and looked soft. The blob hat file is unchanged.
- Founding cap is 10. `FOUNDING_TOTAL` in `js/shared/entitlements.js` and live `get_founding_status` / `claim_founding_slot` (`docs/db/sql/025_founding_total_10.sql`, applied). Promo still not started (`used` 0, `open` false).
- Admin tab is **Analytics** (`/admin/?tab=analytics`), not a second Metrics tab. Overview keeps the count tiles. Public pages record one visit per browser session (`js/shared/page-traffic.js` → `record_page_view`). Daily path totals only — no account, IP, or query string. Owner Discord sign-in reads them via `page_view_stats`. The break-glass secret cannot. SQL `docs/db/sql/026_page_views.sql` is applied. Admin and dev pages are not counted. Build guides roll up to `/builds/*`.
- Admin tab **Members** (`/admin/?tab=members`) charts users, paid Premium, founding, and monthly revenue. Revenue is paid Premium × $3. Founding is not charged. User line comes from `profiles.created_at`. Premium and revenue are a daily snapshot (`member_daily`, `docs/db/sql/027_member_daily.sql`, applied). Owner Discord sign-in only. Live snapshot on apply day: 2 users, 0 paid Premium, $0.
- Site cursor uses the game hands in `assets/cursors/` (`css/cursor.css`, pressed state in `js/shared/game-cursor.js`). URLs are root-absolute (`/assets/cursors/…`). Relative urls inside the cursor variables were resolved from each page CSS file and 404’d at `js/pages/assets/cursors/`.
- Empty create board: while a catalog item is dragged, the class picker swaps to “Place back here” and lets the drop through. Releasing back to the catalog with the board still empty restores “Pick a class to begin.”
- Builds catalog (`.builds-main`) uses the events page width: `min(72rem + 9 * 60px + filter rail, 108rem)`. Checked at a 2000px window: both mains are 1728px.
- Profile Builds tab: Liked filter listed your own upvoted builds in the author list and again under Liked builds. The liked section now skips slugs already on screen.
- Sim settings include Mute sounds. It is off until checked, then remembered in the browser. While it is on, fight sounds stay silent, including the out-of-stamina toot and the charge spark.
- Sim plays the game’s out-of-stamina toot (`Fanfare_sadtoot.ogg`) when a weapon starves during playback. The opponent’s toot is a little higher. Dragging the timeline does not play it.
- Sim footer sits on the viewport edge. The lab has no wood frame, so the slim bar no longer keeps the 3.25rem bottom pad the other pages use to clear that frame.
- Sim empty and error card (“Couldn’t run this sim”) is centered in the lab, under the nav and above the footer.
- Create page up to 1100px wide: the page itself does not scroll. A sideways touch on the catalog scrolls that strip; an upward touch drags the item onto the board. The sell chest sits in the catalog corner so it does not cover the board. history.db upload is off. Screenshot import stays. The board fills the space under the nav, and the item catalog is a 30% strip under it. Filters open from a gold tab on the right. Wider windows keep history.db upload, the board beside the vertical catalog, and the Filter|Build rail.
- iPad Pro 13 portrait (1032×1376, and any window up to 1100px wide): the shelf nav becomes the logo and menu, the wood screen frame is off, the featured carousel is one card with the video above the description, and the create demo is the board beside gold, rank, and Create. Items fly in from the screen edges. Wider windows keep the shelf, the frame, and the three-column demo.
- Mobile home: the combat sky’s grass stopped short of the screen, so the night fill (`#000533`) showed as a dark blue line along the bottom. A ground strip in the same color as the front hill now covers that gap. The color still follows the day-to-night scroll.
- Mobile create promo (≤900px): the Create button is only as wide as the bag icon and the word Create, plus a little banner padding. Desktop stays the wider banner.
- Mobile create promo (≤900px): the wood rim is an overlay on the card (`::after`, slice 28 of `ui-screen-frame.png`). The frame’s inner edge is transparent, so painting it as the card border let the page show through as a light bar. The parchment fill now shows under that edge. Desktop still stretches the same frame.
- Mobile create promo (≤900px): the title, creator, board, tags, and Create button sit closer together. The creator face is 2.6rem so it no longer leaves a tall empty band under the name.
- Mobile (≤1100px): the footer no longer keeps the 3.25rem bottom pad that clears the desktop wood rim (the frame is off there, so it read as a dead band above the screen edge). Default footer pads `max(1.25rem, safe-area-inset-bottom)`, slim footer `max(0.75rem, …)` (`css/shared.css`); the home override is in `js/pages/home/home-builds-vault.css`. Sim keeps its own edge-sitting pad. Desktop keeps the 52px rim clearance. Verified with `scripts/_cache/check-footer-mobile.mjs` + `check-footer-bottom.mjs` (390px gap 0 on home/items/builds/events; 1440px pad unchanged).
- Footer cursor: the full-size hand at the screen edge no longer restyles the page on every pointer move. The cursor kind is read once per element, then only the hand position updates.
- Builds catalog card header: the creator face is its own left column (76px). Name, title, and tags sit in the column to its right, aligned with each other.
- Builds catalog card view: Build Info is the same height as the board. The title, class, rank, subclass, and gold grow with that height. Below 900px the block still stacks under the board.
- Builds catalog creator face and name are larger. Card view is a 44px face and a 1.45rem name. Compact and grid use a 32px face and a 1.2rem name. Time and event stay the previous size.
- Profile page on narrow windows (1240px and below): Builds, Inventory, and the owner Blob wardrobe open filters from a right-hand panel (`js/shared/filter-drawer.js`). A gold Filters tab opens it; the gold ×, the dimmed page, or Escape closes it. Desktop keeps each rail beside the content. The rule is in `.cursor/rules/filters.mdc`. A visitor Blob view has no filter rail.
- Events catalog on narrow windows (1240px and below): filters open from a right-hand panel instead of sitting above the list. Phones tighten the featured card and the card view, and the compact view uses a smaller banner so several events fit on screen.
- Builds catalog on narrow windows (1240px and below): the filter rail is a right-hand panel. A gold Filters tab opens it; close, the dimmed page, or Escape shuts it. Desktop keeps the rail beside the feed. Phones also use one grid-view column.
- Create desktop (wider than 1100px): filter rail is a fixed 32rem, the board keeps its calculated width, and the catalog grows to fill the space before the rail so the left and right screen insets match. The catalog stays against the rail (1rem gap). Checked at 2560 (insets 53/53, catalog 1013), 1920 (40/40), and 1440 (30/30), with no horizontal page scroll. 1100px and below stays the stacked catalog and off-canvas rail. On that stacked layout the catalog track is the full screen width (the sell chest sits on top of the right side), and items pack down each column then to the right, so scrolling right goes from Common to Unique. Checked at 390: the left of the strip is Common/Rare and the right end is Unique. The horizontal scrollbar track is inset the same distance from the left screen edge and from the chest's left edge (0.65rem), and that inset is margin so the thumb stops at the track instead of sliding past it. Desktop still packs across, then down.
- Create mobile drag (≤1100px, touch): an upward touch on a catalog item picks it up (sideways still scrolls the strip). The drop follows the lifted item, so releasing while the finger is still over the catalog does not cancel a drop onto the board. Board items and parked chips use touch-action none so the browser does not steal the gesture. Checked at 390 with touch: a leather bag lands on the board, that bag can be dragged on the board, and a sideways swipe scrolls the catalog (scrollLeft 111) without leaving a drag stuck.
- Items detail on phones (≤900px): the focused item, tooltip, recipes, and builds are one scrolling column that starts under the nav, so the item is not behind the menu button. The tooltip scales to the column and keeps its full frame height, so the recipe block sits under the card instead of over the cost line. Build cards sit 1.15rem apart. Checked at 390px: Wooden Sword card bottom to recipes is a 16px gap. Desktop spotlight is unchanged.
- Items desktop hover: a tooltip that would run off the bottom of the screen is moved up so the whole card stays on screen. The height cap is only used when the card is taller than the window. Checked at 1600×900: a low catalog item (leather boots) opens a 591px card with its bottom at 874 and the rarity line inside the card. A 640px-tall window still pins the card to the top edge.
- 720p (≤1366px, above the phone nav): the shelf, logo, pennants, and banner words scale down. Featured carousel type, buttons, and the gaps inside the sheet scale down too, and the slides sit closer. 1920 and 1440p stay on the larger sizes.
- Home at 1920×1080: Free Premium stays under the right shelf (the outside-the-shelf spot starts at 2200px). The page clips horizontal overflow. Featured carousel type scales with the card, so 1080p is smaller than the 1440p size.
- Mobile nav drawer (≤900px) starts at the top of the screen and covers the header. Page links are Milonga sticker text. Login, founding, and socials sit at the bottom. Close is the leather button in the drawer.
- Mobile nav (≤900px): header is the logo plus a menu button. Shelves, pennants, and the Builds banner hide. Links, login, founding chip, and socials open in a left drawer (`js/shared/nav/drawer.js`). Desktop shelves are unchanged.
- Create empty-board drop hint: dragging a **bag** over the empty board now says **"Place Bag Here"**; dragging a non-bag item says **"Please place a bag before placing an item"** (game rule already rejects non-bag drops with no bag on the board). Wired via `registerDragLookup`/`getCurrentDrag` in `drag-source.js` (drag session registers a live lookup; `bpb-create-drag` event carries the drag too), read in `board-onboard.js` (`draggingBag`), styled with `.is-item-warning` in `create.css`.
- Create onboard bag step: bag icon row was flush-left in the panel (missing `align-self: center` that the class grid has). Fixed in `create.css` (`--bags` grid). Verified centered with `scripts/_audit-onboard-bags.mjs` (Playwright, measures row center vs panel center).
- Game cursor stays the full hand, including the footer. Chrome will not paint a CSS cursor that hangs off the screen, so that band uses the same artwork as an element (`.bpb-cursor-follower`) instead of the smaller `assets/cursors/sm/` hands.
- About, Terms, and Privacy use the rewards plate on the town scene (gold Baskerville titles). Privacy and Terms now say screenshot import runs in the browser; `?vision=edge` is the only OpenAI path. The update rule is `.cursor/rules/legal.mdc`.
- Home vault card footer: creator face on the left, creator name then build name beside it, class icon on the right of that row. Same on mobile and desktop.
- Home vault titles sit below the board still. The still paints one extra cell under the grid; that overhang was covering the build name on mobile and desktop. `.home-vault__board` now pads by `--bpb-still-cell`.
- Mobile create promo (≤900px): the card is one column, so the name, creator, board, tags, and Create button sit in the center. The wood rim uses a slice of `ui-screen-frame.png` (even 12px) instead of stretching that wide frame over the tall card. Desktop still stretches the same frame.
- Mobile home (≤900px): the create demo hides the item catalog and the gold / rank / description panel. The board keeps the build name and the creator. Items fly in from the left and right edges of the screen (`home-promo-assemble.js`). Widening the window mounts the catalog for the next loop. Phone featured carousel (≤767px) stays on the poster with a play mark until a tap, uses a shorter sheet, and peeks the next card. Desktop still auto-embeds and still shows the catalog plus gold, rank, and description.
- Mobile (≤900px): the wooden screen frame (`body::after` in `css/theme.css`) is off, and `--bpb-frame-edge-x` / `--bpb-frame-edge-y` are 0 so pages are not inset for that rim. Desktop keeps the frame. Card frames (video, promo board, event art) stay.
- YouTube embeds keep the game hand over the picture. A clear layer (`js/shared/youtube-cursor.js`) covers the frame except the bottom control strip, which stays on YouTube’s own cursor so play, volume, and fullscreen still work. A click on the picture pauses or plays.
- Build hover tips: creator face on the left, then three lines (creator, build name, class). The class icon stays on the right of that header.
- Screenshot import ownership moved to Codex on 2026-10-01. The path list is in Owned paths above. No importer, model, manifest, or doc files were changed.
- Mobile nav (≤1100px) shows the same BUILDS banner under the wordmark. It sits in the header, and the page spacer grows with it. Desktop stays the hanging banner. Checked at 390 and 1032: banner inside the header, menu still opens. Desktop 1440 stays absolute.
- Discord invite is `https://discord.gg/s5WghmrFSp` (`js/shared/social-links.js`, plus the Quest, Market, Events, About, Terms, and Privacy copies).
- Discord bot mirrors site plan onto roles and sets server nicknames to `Discord name | uploaded build count`. `npm run bot:sync` set 1 nickname; the server owner cannot be renamed by a bot. `npm run bot:watch` resets nicknames while that process is running, and bans anyone who posts in `#definitely-post-here` (owner and members who can ban are skipped). Sign-in, publish, and Stripe plan changes call the same nickname update. The join prompt is unchanged. Slash commands are still an empty list.

---

## Confirmed — validation (seam grid, 8 shots, 150 item cells)

Logs: [`scripts/_cache/seam-eval-v5.txt`](../scripts/_cache/seam-eval-v5.txt), [`scripts/_cache/seam-eval-v7b.txt`](../scripts/_cache/seam-eval-v7b.txt). Older locked-grid scores: `scripts/_cache/grid97-eval-v5-totals.txt`.

| Model | Total | real-001 | pine | leather | real-003 | 007 | 008 | 010 | 013 | skills | jewels |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Live v1 | 58/150 | — | — | — | — | — | — | — | — | 0/7 | 0 |
| v5-80 | **64/150** | 27/29 | 29/29 | 3/5 | 0/23 | 1/27 | 0/22 | 1/9 | 3/6 | 1/7 | 0/1 |
| v7b | 54/150 | 24/29 | 26/29 | 1/5 | 0/23 | 1/27 | 0/22 | 2/9 | 0/6 | 1/7 | 0/1 |

Grids on the 64/150 run: real-001 cell 56.5 **9×7**; pine 54 **9×7**; leather 89 **9×7**; real-003 68.1 **12×7**; real-007 80.4 **10×7**; real-008 90 **7×6**; real-010 90 **9×9**; real-013 32.5 **8×8**.

Ship gates (item cells ≥ v1 58/150 and ideally ≥ v5-80 64/150; leather-quad > 1/5; skills/jewels actually found) **failed** for v7b. v1 stays live.

---

## Confirmed — P3 sprite retrieval (2026-10-01)

Eval-only experiment; no importer/placer changes. Script: `scripts/screenshot-eval/sprite-retrieval.mjs`; evidence: `scripts/_cache/screenshot-eval/baselines/2026-10-01-p3-retrieval/` (report.json, all-rows.json, digest.html, per-fixture).

- **Pass on recognizable regions.** Masked NCC (gray + Sobel edge 0.5/0.5, anchor-aware, 48px/cell, all 518 classes, 4 faces for oblong) ranks truth top-1 on bright cells: pine-protector 20/29, real-010 7/10, real-001 7/30 (partial dimming; its bright cells hit #1 with 0.72–0.90 NCC).
- **Hover-dimmed shots fail** (real-003/007/008/013, leather-quad): ~0 top-20. Identical items at identical cells across real-001 vs pine-protector: bright 0.72–0.86 rank #1 vs dimmed 0.10–0.40. NCC is contrast-normalized, but dimming collapses item/background contrast; exposure normalization before NCC is the follow-up (measure before assuming P4 covers dark shots).
- Rotation recall on bright shots: **23/24** (oblong, known r). Skills 2/7, jewel 0/1 — P6 still needed.
- **Harness gotchas (recorded so we don't re-hit them):**
  - `preprocessScreenshotForVision` returns a bag-cropped dataUrl at **native** resolution; `grid.originX/Y` belong to the original image — drop them on the cropped buffer.
  - `grid.cellW` is in the ≤900px **detect** space; the cropped buffer is native (real-003 ≈ 310px/cell, not 68). Recompute cell size as `W * cellW / bagRect.w`.
  - Some catalog sprites never match live art (Vampiric Armor 0.036, Con-Trap-Tron 0.03–0.06 on both bright and dim) — sprite drift exists per item.
  - Sprite arms interchangeable for retrieval: site thumbs ≈ site `item-sprites` ≈ game extract (game arm lacks 85 class PNGs; use thumbs/site for full coverage).
- Queue status: P3 done → **P4 candidate-recall is next** (perfection doc), on recognizable regions.

---

## Proposal — next (not started, not approved)

Do not train again unless Justin asks. Do not publish v5-80 or v7b. Do not start another global solver. Do not change the live importer. Do not edit benchmark truth. Do not rebuild the reference library from this result.

P18 shows the real-007 Banana offset is the whole board. Sixteen strong matches on that shot share about **+29, +11** match pixels, on every face and from column 0 through column 8. real-010 Banana, same sprite and anchor 0, sits at **+3, +2**. Rotating the display anchor does not explain it.

Smallest next measurement: estimate one origin shift for real-007 from the seam lattice, then test whether that single shift puts the other strong items inside ±8. Do not widen the search to ±40, and do not start until reviewed.
