"""Decode a random (or given) run from Backpack Battles history.db into placements."""
from __future__ import annotations

import csv
import json
import math
import random
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HISTORY = Path(
    r"c:\Users\Justin\AppData\Roaming\Godot\app_userdata"
    r"\Backpack Battles\76561198417460363\full\history.db"
)

MAX_HEALTH = 999
MAX_STAMINA = 999
MAX_SIZE = 10  # Inventory.MAX_SIZE
BASE64_OFFSET = 62

CLASSES = {
    0: "Ranger",
    1: "Reaper",
    2: "Berserker",
    3: "Pyromancer",
    4: "Mage",
    5: "Adventurer",
    6: "Engineer",
}
LEAGUES = [
    "bronze",
    "silver",
    "gold",
    "platinum",
    "diamond",
    "master",
    "grandmaster",
    "grandma",
]
# Game.leagueThresholds (partial — enough for getLeague_exact int part)
LEAGUE_THRESHOLDS = [0, 20, 50, 100, 200, 350, 550, 850, 10_000]


def ceil_log2(n: int) -> int:
    if n <= 1:
        return 0
    return math.ceil(math.log2(n))


def binary_ceil(n: int) -> int:
    return 2 ** math.ceil(math.log2(n)) if n > 1 else 1


class BitStream:
    def __init__(self) -> None:
        self.bits: list[int] = []
        self.current = 0

    def from_godot_string(self, s: str) -> bool:
        self.bits = []
        self.current = 0
        for ch in s.encode("latin-1", errors="strict"):
            offset = ch - BASE64_OFFSET
            if offset < 0 or offset > 63:
                return False
            for digit in range(5, -1, -1):
                self.bits.append(1 if (offset & (1 << digit)) else 0)
        return True

    def bits_left(self) -> int:
        return len(self.bits) - self.current

    def pull(self, range_max: int) -> int:
        nbits = ceil_log2(range_max)
        if self.current + nbits > len(self.bits):
            return -1
        value = 0
        for digit in range(nbits - 1, -1, -1):
            value += self.bits[self.current] << digit
            self.current += 1
        return value

    def pull_bitsize(self, nbits: int) -> int:
        if self.current + nbits > len(self.bits):
            return -1
        value = 0
        for digit in range(nbits - 1, -1, -1):
            value += self.bits[self.current] << digit
            self.current += 1
        return value


def load_catalog():
    rows = list(csv.DictReader((ROOT / "scripts/_cache/ItemData.csv").open(encoding="utf-8")))
    by_gid = {int(r["id"]): r for r in rows if r.get("id", "").isdigit()}
    layout = json.loads((ROOT / "assets/data/library-layout.json").read_text(encoding="utf-8"))
    gid_to_slug = {o["gid"]: o["id"] for o in layout["order"] if o.get("gid") is not None}
    # also map by name slugify fallback
    sock = json.loads((ROOT / "assets/data/socket-offsets.json").read_text(encoding="utf-8"))
    sockets_by_slug = {k: len(v) for k, v in (sock.get("byId") or {}).items()}
    # gem list = gems in CSV insertion order
    gems = [int(r["id"]) for r in rows if r.get("type") == "Gem"]
    total_num_gems = binary_ceil(len(gems) + 1)
    empty_socket = total_num_gems - 1
    # Magic Ring persistent bits — MagicRing.gd: numEffects * (2+4); CSV `2:effects`
    magic_ring_gid = next((int(r["id"]) for r in rows if r["name"] == "Magic Ring"), None)
    magic_ring_persist_bits = 12
    if magic_ring_gid is not None:
        row = by_gid.get(magic_ring_gid) or {}
        # params cell may include `2:effects`
        for cell in row.values():
            if not isinstance(cell, str) or "effects" not in cell:
                continue
            for part in cell.split(","):
                part = part.strip()
                if part.endswith(":effects") and part.split(":", 1)[0].isdigit():
                    n_eff = int(part.split(":", 1)[0])
                    magic_ring_persist_bits = n_eff * 6
                    break
    return {
        "by_gid": by_gid,
        "gid_to_slug": gid_to_slug,
        "sockets_by_slug": sockets_by_slug,
        "num_items": len(rows),
        "gems": gems,
        "total_num_gems": total_num_gems,
        "empty_socket": empty_socket,
        "magic_ring_gid": magic_ring_gid,
        "magic_ring_persist_bits": magic_ring_persist_bits,
    }


def sockets_for(gid: int, cat: dict) -> int:
    slug = cat["gid_to_slug"].get(gid)
    if slug and slug in cat["sockets_by_slug"]:
        return cat["sockets_by_slug"][slug]
    # fallback: ItemData doesn't store sockets; assume 0
    return 0


def deserialize_items(build_info: str, cat: dict, version: str = "1.1.0"):
    bs = BitStream()
    if not bs.from_godot_string(build_info):
        return None
    health = bs.pull(MAX_HEALTH)
    stamina = bs.pull(MAX_STAMINA)
    if health < 0 or stamina < 0:
        return None

    total_num_items = cat["num_items"] if tuple(map(int, version.split("."))) >= (1, 1, 0) else 510
    items = []
    while bs.bits_left() >= 8:
        index = bs.pull(total_num_items)
        if index < 0 or index >= total_num_items:
            return None
        x = bs.pull(MAX_SIZE)
        y = bs.pull(MAX_SIZE)
        face = bs.pull(4)
        if x < 0 or y < 0 or face < 0:
            return None

        entry = {"gid": index, "x": x, "y": y, "r": face, "gems": []}
        n_sock = sockets_for(index, cat)
        if n_sock > 0:
            has_gems = bs.pull(2)  # 1 bit, rangeMax=2
            if has_gems == 1:
                for _ in range(n_sock):
                    g = bs.pull(cat["total_num_gems"])
                    if g < 0:
                        return None
                    entry["gems"].append(g)
            elif has_gems < 0:
                return None

        # MagicRing.gd getDataPersistentBits = numEffects * (2+4); CSV effects=2 → 12 bits
        if index == cat["magic_ring_gid"]:
            persist_bits = cat.get("magic_ring_persist_bits", 12)
            if bs.pull_bitsize(persist_bits) < 0:
                return None

        row = cat["by_gid"].get(index)
        entry["name"] = row["name"] if row else f"gid:{index}"
        entry["slug"] = cat["gid_to_slug"].get(index)
        entry["type"] = row["type"] if row else ""
        items.append(entry)

    return {"health": health, "stamina": stamina, "items": items}


def version_to_string(ver: int) -> str:
    major = ver // 1_000_000
    minor = (ver % 1_000_000) // 1000
    mini = ver % 1000
    return f"{major}.{minor}.{mini}"


def league_from_rating(rating: float) -> str:
    if rating is None or rating < 0:
        return "bronze"
    rating = max(0.0, float(rating))
    league = -1  # ImpossibleWoodRank
    for thr in LEAGUE_THRESHOLDS:
        if rating >= thr:
            league += 1
        else:
            break
    league = max(0, min(league, len(LEAGUES) - 1))
    return LEAGUES[league]


def pick_run(con: sqlite3.Connection, run_id: int | None, seed: int):
    rows = con.execute(
        """
        select runID, class, loadout, rank, version, time, subclass, skill1, skill2,
               (select count(*) from roundData r where r.runID = runData.runID) as rounds
        from runData
        """
    ).fetchall()
    cands = [r for r in rows if r[9] >= 10]
    if run_id is not None:
        for r in rows:
            if r[0] == run_id:
                return r
        raise SystemExit(f"run {run_id} not found")
    rng = random.Random(seed)
    return rng.choice(cands)


def main():
    run_id = int(sys.argv[1]) if len(sys.argv) > 1 else None
    seed = int(sys.argv[2]) if len(sys.argv) > 2 else 20260720
    cat = load_catalog()
    con = sqlite3.connect(f"file:{HISTORY}?mode=ro", uri=True)
    run = pick_run(con, run_id, seed)
    rid, klass, loadout, rank, version, time, subclass, skill1, skill2, nrounds = run
    ver = version_to_string(version)
    print("PICKED RUN", rid)
    print("class", CLASSES.get(klass, klass), "loadout", loadout, "rank_rating", rank)
    print("league", league_from_rating(rank), "version", ver, "rounds", nrounds)
    print("subclass/skill1/skill2 gids", subclass, skill1, skill2)

    rounds = con.execute(
        "select roundID, result, tries, health, stamina, buildInfo from roundData where runID=? order by roundID",
        (rid,),
    ).fetchall()

    decoded_rounds = []
    for round_id, result, tries, health, stamina, build_info in rounds:
        data = deserialize_items(build_info, cat, ver)
        ok = data is not None
        n_items = len(data["items"]) if data else 0
        print(f"  round {round_id}: result={result} items={n_items} ok={ok}")
        if not ok:
            print("    FAIL decode")
            continue
        decoded_rounds.append(
            {
                "round": round_id,
                # Game.RoundResult: Win=0, Loss=1, Draw=2, RunOver=3
                "result": "win" if result == 0 else "loss",
                "tries": tries,
                "health": data["health"],
                "stamina": data["stamina"],
                "placements": [
                    {
                        "gid": it["gid"],
                        "id": it["slug"],
                        "name": it["name"],
                        "type": it["type"],
                        "x": it["x"],
                        "y": it["y"],
                        "r": it["r"],
                        "gems": it["gems"],
                    }
                    for it in data["items"]
                ],
            }
        )

    if not decoded_rounds:
        raise SystemExit("no rounds decoded")

    final = decoded_rounds[-1]
    print("\nFINAL BOARD", len(final["placements"]), "items")
    for p in final["placements"]:
        print(f"  {p['x']},{p['y']} r{p['r']} {p['id'] or p['gid']} ({p['name']}) gems={p['gems']}")

    out = {
        "source": str(HISTORY),
        "runId": rid,
        "heroClass": CLASSES.get(klass, str(klass)),
        "loadout": loadout,
        "rating": rank,
        "rank": league_from_rating(rank),
        "version": ver,
        "subclassGid": subclass,
        "skill1Gid": skill1,
        "skill2Gid": skill2,
        "rounds": decoded_rounds,
    }
    out_path = ROOT / "scripts/_cache/history-pick.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print("wrote", out_path)


if __name__ == "__main__":
    main()
