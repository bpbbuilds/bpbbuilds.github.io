# Known failures

- High-resolution combat screenshots, especially `real-003` (4096x2304), smear at detector input and include player, opponent, and combat UI in the global seam rectangle.
- Leather seam fitting is not a reliable board-size detector. It has produced 12x7, 10x7, 7x6, 9x9, and 8x8 on screenshots that are logically 9x7.
- Dimmed / hover-state screenshots collapse item-background contrast. NCC and several normalization, retrieval, scale, and masking experiments did not solve that class of failure.
- Sparse boards frequently produce only 2-8 detector boxes. Empty detections, not just wrong grid size, are a dominant failure.
- The live 426-class detector cannot emit newer skill and jewel IDs. Cached 518-class heads require their 518-name list.
- Sprite drift exists for some item art; replacing the global solver or forcing a 9x7 lattice regressed the benchmark.
- `real-003` now has image-supported player/opponent board proposals, but restricted seam fitting remains 8x6 or 9x6 and phase-unstable. Do not claim a solved combat board grid.
