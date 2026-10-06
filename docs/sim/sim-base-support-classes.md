# Simulator base and support class decisions

Reviewed 2026-10-06. These extracted scripts are either inherited combat
behavior already represented by the simulator or non-combat game/UI support.
They are not unowned simulator gaps.

| Source class | Decision | Evidence / boundary |
| --- | --- | --- |
| `DragonEgg` | Shop-only base; derived combat effects supported per item. | `DragonEgg.gd` only advances rounds and replaces an egg during shop entry. `amethyst_egg`, `ruby_egg`, `emerald_egg`, and `sapphire_egg` have their own combat ports. The simulator receives a fixed combat board, so it does not model between-round hatching. |
| `ChessPiece` | Explicit unsupported combat mode. | Pieces have no independent cooldown; the Chess Board owns movement/capture. Placement and visibility remain supported, but board-state movement/capture/elimination AI is outside simulator scope. |
| `ForestFriend` | Supported through `squirrel_archer`. | Its combat-start pet/food link speed is implemented in `ports-ap-basic.js` before Squirrel Archer's strike. |
| `GoldCounter` | UI-only; out of simulator scope. | Interface counter for shop gold and tooltip animation; it has no combat actor or item behavior. |
| `RotationSpring` | Visual-only; out of simulator scope. | Sprite physics gives inventory items inertial rotation while moved. |
| `Food` | Supported shared behavior. | `food-helpers.js#applyFoodPrepareSpeed` implements Food's prepare-time +10% speed per eligible linked food; derived ports opt in where they inherit it. |
| `GemSocket` | UI socket/hot-swap support is out of scope; socketed combat behavior is supported. | The source node only owns sprite visibility and drag/drop. `gem-sockets.js` runs socketed gem preparation and combat-start effects around the host lifecycle. |
| `ItemPushZone` | Title-screen physics; out of simulator scope. | It only pushes loose item bodies under the mouse on the title screen. |
| `SocketsNode` | Render-only; out of simulator scope. | It inverse-scales the socket display node. |
| `BagBorder` | Inventory drag visual; out of simulator scope. | It highlights a bag while a player drags an item; it has no combat effect. |

The Chess Piece boundary is repeated in `assets/data/sim-intentional-noops.json`
because it affects catalog combat classification. The other out-of-scope entries
are non-combat UI/shop support rather than catalog combat items.
