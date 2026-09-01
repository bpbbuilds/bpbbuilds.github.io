# Create board — placement rules

Game source: `Inventory.tryAddItem`, `Item.drop` / `dropIntoInventory`, `Bag.getItemsInside`.  
Create: `js/pages/create/try-add.js`, `drag-commit.js`, `bag-cargo.js`, `park-strip.js`.

## Drop order (must match game)

```text
pickup bag A (Default) → insides → drag.cargo (off board)
drop:
  1. Hotswap / remove displaced bag B (with B’s cargo snapshot)
  2. Place A on board
  3. Float cleanup (Default only) — bag cells exist first
  4. Re-add A’s cargo into A’s cells (dropIntoInventory)
  5. Free-follow B with its cargo
```

Do **not** run float cleanup while held cargo is still loose without A’s bag cells.

Hotswap handoff: commit must pass `{ cargo }` (snapshot taken **before** A’s cargo is re-added). An empty snapshot means B is empty — do **not** re-`captureBagCargo` from the live board (that steals A’s overlapping insides).

## Out of bounds / multi-select drop (game `Item.drop`)

**Main held item decides everything.** Marquee picks the bag closest to the cursor as main; click-drag uses the bag you grabbed. Followers are `draggedInsideItems` (cargo).

| Release | Game | Create |
|---|---|---|
| Main bag over storage (`STORAGEBOX.isHovered` uses **bag position**) | Main + insides → storage | Main float over **Parked** or **catalog** → Parked |
| Mouse over sellbox (`SELLBOX.isHovered`) | Sell main; cargo/gems → storage | Mouse over bottom-right Chestnut → **delete** main (sell wins over catalog-as-storage); cargo/gems → Parked |
| Main footprint valid on grid | `tryAdd(main)` then re-add followers | Same (1st failed follower free-follows; rest → Park) |
| Main invalid / off grid, home cells still free | **Flyback** (non-shop) / shop rules | **Flyback** |
| Main invalid, home cells no longer PotentialSpace | Main + insides → storage | → **Parked** |

Dragging the whole cluster off the board does **not** auto-park unless the **held main** is over storage/Park/catalog (or home was blocked). If the left bag is main and still fully on-grid, it places even when followers hang over the catalog — failed followers free-follow / park.

## Catalog / shop while dragging (game `InputBlocker.ItemDragging`)

While any item is held (including marquee free-follow), the catalog cannot start a new pick. Dropping when the **main bag** sits over the catalog is storage hover → **Parked** (game storage beside the board).

## Soft park (2+ bags)

Game sends 2+ overlapping bags (+ insides) to **storage**. Create has a **Parked** strip under the board:

- Place A → float clean → re-add A’s cargo
- Overlapping bags **and** their insides are parked as **separate flat items** (not bag-with-cargo)
- Identical item ids **stack** in the tray (one chip + count, e.g. Leather Bag ×5)
- Drag a chip to place one instance (count decreases). Esc cancels back to Parked
- Drag from **catalog** or **board** onto Parked to stash (bags flatten insides into separate chips)

## Straddling cargo (game `dropIntoInventory`)

Pickup bag pulls any item that touches its cells (including items that also sit in a neighbor bag). After place:

1. Bag-on-bag hotswap already used the free-follow slot → failed cargo that cannot fully sit in bag space → **Parked** (game storage)
2. Empty drop → first failed cargo free-follows; further failures → **Parked**
3. Displaced-bag cargo snapshots **must not** include items already riding with the held bag (straddlers would otherwise reappear on the free-follow bag)

Example: 2×3 armor on two stacked leathers; move the lower bag onto another bag → armor cannot re-fit in only that bag → Parked.

## APPROX (create vs game)

| Game | Create |
|---|---|
| Failed / extra cargo → storage | **Parked** strip |
| 2+ bag collisions → storage | Parked strip |
| Bag drop on storage hover → storage | Drop on **Parked** strip |
| Bag fail + home not PotentialSpace → storage | Parked |
| Bag fail + home free → moveback | Flyback |
| `bag_hotswapping` setting | Always pull insides on Default grab/hotswap |

## Quick checks

- Half-overlap: bag+item onto half of empty leather → item stays in placed bag; other bag free-follows
- Both bags with items → each cargo rides with the correct bag
- Bag A over B **and** C → A stays; B, C, and any insides appear as separate stacked chips in Parked
- ItemLayer: moving a bag does not pull/delete insides
