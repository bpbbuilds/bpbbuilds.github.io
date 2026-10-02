# Research summary

The project established a workable browser pipeline on clean, bright boards but did not meet a launch-quality recognition threshold across real screenshots. The cached v5-80 detector reached 64/150 item cells but is unpublished. The live v1 detector remains 58/150 and is now paused behind the launch gate.

The central failures are visual-state mismatch, weak detector recall on sparse/large shots, incorrect seam lattices, and combat UI contamination. Attempts to force 9x7, tile inference, add a global selector, broaden NCC search, alter scale, trim occlusion, or transfer screenshot pixels did not provide a safe product solution.

P17 established that all visual faces matter. P19 then isolated a genuine image-derived whole-board phase error on real-007: a +30,+12-pixel correction recovered 21/27 ordinary items at top-5 and raised the research retrieval aggregate to 64/68/72/75/75. P20 correctly abstained on real-003 and real-008. P21 found two bag components and an image/HUD-supported player side in real-003, but the existing seam detector still cannot produce a stable player-board lattice.

See [experiments/README.md](experiments/README.md) for the individual experiment record and preserved artifact locations.
