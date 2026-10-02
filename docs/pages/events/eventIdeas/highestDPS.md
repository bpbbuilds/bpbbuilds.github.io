# DPS Stone / Highest DPS — event vision

**Public title:** DPS Stone (`slug: highest-dps`)  
**Related:** [`launch-event.md`](../launch-event.md) · [`launch-phase-2.md`](../../../product/launch-phase-2.md)

---

## Fairness model (locked)

| Piece | Role |
|---|---|
| Play **ranked / unranked** | Earn a real board (`history.db` proof — no create-only cheese) |
| Board must include **required items** (Stone) | Theme gate |
| Score = **sim vs shared dummy for N seconds** | Fair DPS; admin sets `judgeWindowSec` |
| Claimed DPS / screenshot / clip | Optional flavor only |
| Entries | Cap per user; **no user delete** after submit; site build on profile / builds |

Live opponent DPS is unfair (bag RNG). Photo/video don’t fix that.

---

## Launch entry wizard

Site **Enter event** opens a two-pane wizard: left steps, right build details (title + auto class/rank/bag from history). Upload `history.db`, pick run/round, optional proof, review + submit → permanent `builds` row with `event_slug`.

Catalog knobs on the event (`entry.*`) — later owned by the admin event portal:

- `judgeWindowSec`, `minGameVersion`, `requiredItemIds`, `allowedModes`
- `maxEntriesPerUser`, `showSimDpsOnEntry`, `leaderboardVisibility`

---

## Launch (manual judge fallback)

1. Players submit via the wizard (or Discord if site submit is down).
2. Boards stay **private while entries are open**.
3. Owner can still export + dummy-judge if auto sim isn’t trusted yet.
4. Gallery opens after entries close.

---

## Phase 2 — auto score + highlight video (todo)

- [ ] **Auto pipeline:** upload → sim score → public **leaderboard** (respect `leaderboardVisibility`).
- [ ] **Sim accuracy** good enough for trustworthy DPS.
- [ ] **Top‑3 highlight video** from leaderboard boards.
- [ ] Admin **event creation portal** owns all `entry.*` knobs.
- [ ] Optional media stays flavor-only.
