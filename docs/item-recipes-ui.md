# Item recipes UI (spotlight)

Mirrors game `BuildIntoRecipesTooltip` / `BuildIntoRecipe.gd`.

## Data

- Source: `combinations` + `combination_ingredients.quantity`
- Game `Recipe.gd`: owner is always an ingredient; `"Axe>Double Axe"` → **Axe + Axe**
- Import: [`scripts/import-game-combinations.mjs`](../scripts/import-game-combinations.mjs) counts duplicate names into `quantity` (do not drop dupes)

## Display

- Row: **result** · `Equals.png` · ingredients (quantity expanded to repeated icons)
- Sizing: same as Itemiary catalog — `spriteW/H` × live `--bpb-bg-cell` (not spotlight piece scale)
- Panel: shrink-wraps to the widest recipe row (grows only when needed); width locked after open so scroll can’t expand it; vertically centered; header fixed, list scrolls
- Frontend: [`js/pages/items/spotlight-recipes.js`](../js/pages/items/spotlight-recipes.js) (`recipeIconSize`, `expandIngredientIds`)

## Builds strip (bottom)

Public builds that place the focused item (`build_placements.item_id`):

- Horizontal parchment strip under the stage; recipes stay on the right
- Cap 10; hover uses build preview tip
- **Ranking:** item emphasis first (essentials `priority` needed/nice/optional + placement count), then `vote_score` / OP / featured / mild recency — not combat synergy ([`spotlight-builds.js`](../js/pages/items/spotlight-builds.js) `sortScoreForItem`)
- Frontend: [`js/pages/items/spotlight-builds.js`](../js/pages/items/spotlight-builds.js)
