# Sim marketing + IP (Phase 38 / 269)

**Not legal advice. Not a counsel sign-off.**

## Call (as of 269)

| Question | Call |
|---|---|
| Public ads / homepage / Discord / YouTube saying the sim **matches the game** or is **1:1 combat** | **No-go** until a lawyer reviews using game art + derived combat rules |
| Fan-site personal use of `/sim/` while iterating | **OK** — keep the fixture-subset banner; do not sell “official combat” |
| Paid membership that markets game-like combat as the product | **No-go** until Phase **38** is a written **go** (Band F) |

Do **not** treat About/Terms stubs as completing Phase 38. Counsel review is still **open**.

To allow the `/sim/` title **Engine 1:1** after that review, set both flags in `assets/data/sim-engine-claim.json` → `legal` (and re-run `npm run sim-engine-claim` so smoke stays aligned):

- `phase38CounselReview`: true
- `allowPublicMatchesTheGameMarketing`: true

Until then those flags stay **false**. Technical gates 252 / 258 / 264 / 265 are separate. Phase **270** closed the numbered AP–AS checklist without setting `engine11Achieved`.
