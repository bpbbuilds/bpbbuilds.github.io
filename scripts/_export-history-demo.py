"""Export scripts/_cache/history-pick.json → assets/data/history-demo-run.json"""
from __future__ import annotations

import csv
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

_decode_path = ROOT / "scripts" / "_decode-history-build.py"
_spec = importlib.util.spec_from_file_location("decode_history_build", _decode_path)
_dec = importlib.util.module_from_spec(_spec)
assert _spec and _spec.loader
_spec.loader.exec_module(_dec)


def resolve_socket_gems(
    gem_indices: list,
    cat: dict,
    item_ids: set[str],
) -> list[str | None]:
    """Map history.db gem slot indices → item ids (None = empty socket)."""
    gems = cat.get("gems") or []
    empty = cat.get("empty_socket")
    out: list[str | None] = []
    for g in gem_indices:
        try:
            idx = int(g)
        except (TypeError, ValueError):
            out.append(None)
            continue
        if idx < 0 or idx == empty or idx >= len(gems):
            out.append(None)
            continue
        slug = cat["gid_to_slug"].get(gems[idx])
        if slug:
            item_ids.add(slug)
            out.append(slug)
        else:
            out.append(None)
    return out


src = ROOT / "scripts/_cache/history-pick.json"
data = json.loads(src.read_text(encoding="utf-8"))
rows = {
    int(r["id"]): r
    for r in csv.DictReader((ROOT / "scripts/_cache/ItemData.csv").open(encoding="utf-8"))
}
cat = _dec.load_catalog()
item_ids: set[str] = set()

final = data["rounds"][-1]["placements"]
gold = 0
for p in final:
    price = rows.get(p["gid"], {}).get("price") or "0"
    try:
        gold += int(float(price))
    except ValueError:
        pass
data["goldCount"] = gold


def placement_out(i: int, p: dict) -> dict | None:
    if not p.get("id"):
        return None
    gems = resolve_socket_gems(p.get("gems") or [], cat, item_ids)
    out = {
        "key": f"{i}:{p['gid']}:{p['x']}:{p['y']}:{p['r']}",
        "id": p["id"],
        "gid": p["gid"],
        "x": p["x"],
        "y": p["y"],
        "r": p["r"],
    }
    if gems:
        out["gems"] = gems
    return out


web = {
    "runId": data["runId"],
    "heroClass": data["heroClass"],
    "rank": data["rank"],
    "rating": data["rating"],
    "goldCount": gold,
    "skill1Gid": data["skill1Gid"],
    "skill2Gid": data["skill2Gid"],
    "subclassGid": data["subclassGid"],
    "notes": (
        "Imported from a real Mage history run (id "
        f"{data['runId']}). Scrub rounds to see the board grow."
    ),
    "rounds": [
        {
            "round": r["round"],
            "result": r["result"],
            "placements": [
                pl
                for pl in (
                    placement_out(i, p) for i, p in enumerate(r["placements"])
                )
                if pl
            ],
        }
        for r in data["rounds"]
    ],
}
out = ROOT / "assets/data/history-demo-run.json"
out.write_text(json.dumps(web), encoding="utf-8")
wl = "".join("W" if r["result"] == "win" else "L" for r in web["rounds"])
print("gold", gold, "rounds", len(web["rounds"]), "wl", wl)
print("socket gems used:", ", ".join(sorted(item_ids)) or "(none)")
print("final", len(web["rounds"][-1]["placements"]), "->", out)
