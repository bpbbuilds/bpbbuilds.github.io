"""
Export the player's last N history.db runs (final boards) for the build-page
author “More builds” interactive thumbnails.

  python scripts/export-author-history-builds.py
  python scripts/export-author-history-builds.py 5
"""
from __future__ import annotations

import csv
import json
import sqlite3
import sys
from pathlib import Path

import importlib.util

_decode_path = Path(__file__).resolve().parent / "_decode-history-build.py"
_spec = importlib.util.spec_from_file_location("decode_history_build", _decode_path)
_dec = importlib.util.module_from_spec(_spec)
assert _spec and _spec.loader
_spec.loader.exec_module(_dec)
HISTORY = _dec.HISTORY
CLASSES = _dec.CLASSES
deserialize_items = _dec.deserialize_items
league_from_rating = _dec.league_from_rating
load_catalog = _dec.load_catalog
version_to_string = _dec.version_to_string

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/data/author-history-builds.json"
SPRITES = ROOT / "assets/item-sprites"
# Keep a few extras so the page can exclude the open build and still show 9.
N_DEFAULT = 12


def sprite_index() -> dict[str, str]:
    """Normalize stem → filename (FannyPack.png), keyed without underscores/case."""
    out: dict[str, str] = {}
    if not SPRITES.is_dir():
        return out
    for p in SPRITES.glob("*.png"):
        out[p.stem.replace("_", "").lower()] = p.name
    return out


def image_for_slug(slug: str, by_norm: dict[str, str]) -> str:
    key = slug.replace("_", "").lower()
    return by_norm.get(key) or f"{slug}.png"


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


def load_game_item_catalog() -> tuple[dict[str, dict], dict[str, str]]:
    """Full item stats + effect text for canAffect / tooltips (snake_case rows)."""
    by_id: dict[str, dict] = {}
    gi_path = ROOT / "scripts/_cache/game-items.json"
    if gi_path.is_file():
        for it in json.loads(gi_path.read_text(encoding="utf-8")).get("items") or []:
            sid = it.get("id")
            if sid:
                by_id[str(sid)] = it

    effects: dict[str, str] = {}
    gd_path = ROOT / "scripts/_cache/game-descr.json"
    if gd_path.is_file():
        for it in json.loads(gd_path.read_text(encoding="utf-8")).get("items") or []:
            sid = it.get("id")
            eff = it.get("effect")
            if sid and eff:
                effects[str(sid)] = str(eff)

    return by_id, effects


def item_row_for_slug(
    slug: str,
    *,
    gid: int | None,
    cat: dict,
    by_id_shape: dict,
    by_norm: dict[str, str],
    game_by_id: dict[str, dict],
    effects: dict[str, str],
    item_csv: dict[int, dict],
) -> dict:
    gi = game_by_id.get(slug) or {}
    csv_row = item_csv.get(gid) if gid is not None else None

    def split_csv(raw: str | None) -> list[str]:
        return [t.strip() for t in str(raw or "").split(",") if t.strip()]

    extra = gi.get("extraTypes")
    if not isinstance(extra, list):
        extra = split_csv((csv_row or {}).get("extraTypes"))

    tags = gi.get("tags")
    if not isinstance(tags, list):
        tags = split_csv((csv_row or {}).get("tags"))

    name = gi.get("displayName") or gi.get("name") or (csv_row or {}).get("name") or slug
    rarity = gi.get("rarity") or (csv_row or {}).get("rarity") or "Common"
    typ = gi.get("type") or (csv_row or {}).get("type") or ""
    klass = gi.get("class") or "Neutral"
    cost = gi.get("cost")
    if cost is None:
        cost = int(float((csv_row or {}).get("price") or 0) or 0)

    image = gi.get("image") or image_for_slug(slug, by_norm)
    if image and not (SPRITES / image).is_file():
        image = image_for_slug(slug, by_norm)

    return {
        "id": slug,
        "gid": gid if gid is not None else gi.get("gid"),
        "name": name,
        "rarity": rarity,
        "type": typ,
        "class": klass,
        "extra_types": extra,
        "tags": tags,
        "cost": cost,
        "effect": effects.get(slug) or "",
        "image": image,
        "shape": by_id_shape.get(slug) or gi.get("shape"),
        "sockets": cat["sockets_by_slug"].get(slug, 0),
        "accuracy": gi.get("accuracy"),
        "cooldown": gi.get("cooldown"),
        "stamina_cost": gi.get("staminaCost"),
        "damage_min": gi.get("damageMin"),
        "damage_max": gi.get("damageMax"),
        "block": gi.get("block"),
        "chance": gi.get("chance"),
        "chance_tag": gi.get("chanceTag"),
        "params": gi.get("params"),
    }


def main() -> None:
    n = int(sys.argv[1]) if len(sys.argv) > 1 else N_DEFAULT
    cat = load_catalog()
    con = sqlite3.connect(f"file:{HISTORY}?mode=ro", uri=True)

    runs = con.execute(
        """
        select runID, class, loadout, rank, version, time, subclass, skill1, skill2
        from runData
        order by runID desc
        limit ?
        """,
        (n * 3,),  # oversample; skip undecodable
    ).fetchall()

    shapes = json.loads((ROOT / "assets/data/item-shapes.json").read_text(encoding="utf-8"))
    by_id_shape = shapes.get("byId") or {}
    item_csv = {
        int(r["id"]): r
        for r in csv.DictReader((ROOT / "scripts/_cache/ItemData.csv").open(encoding="utf-8"))
        if r.get("id", "").isdigit()
    }

    builds = []
    item_ids: set[str] = set()
    skill_gids: set[int] = set()

    for rid, klass, loadout, rating, version, time, subclass, skill1, skill2 in runs:
        if len(builds) >= n:
            break
        ver = version_to_string(version)
        round_rows = con.execute(
            """
            select roundID, result, buildInfo
            from roundData
            where runID=?
            order by roundID
            """,
            (rid,),
        ).fetchall()
        if not round_rows:
            continue

        rounds_out = []
        for round_id, result, build_info in round_rows:
            data = deserialize_items(build_info, cat, ver)
            if not data or not data["items"]:
                print(f"skip run {rid} round {round_id}: decode failed")
                continue
            placements = []
            for i, it in enumerate(data["items"]):
                slug = it.get("slug")
                if not slug:
                    continue
                item_ids.add(slug)
                gem_ids = resolve_socket_gems(it.get("gems") or [], cat, item_ids)
                placements.append(
                    {
                        "key": f"{round_id}:{i}:{it['gid']}:{it['x']}:{it['y']}:{it['r']}",
                        "id": slug,
                        "gid": it["gid"],
                        "x": it["x"],
                        "y": it["y"],
                        "r": it["r"],
                        "gems": gem_ids,
                    }
                )
            if not placements:
                continue
            rounds_out.append(
                {
                    "round": round_id,
                    "result": "win" if result == 0 else "loss",
                    "placements": placements,
                }
            )

        if not rounds_out:
            print(f"skip run {rid}: no rounds decoded")
            continue

        final = rounds_out[-1]
        for gid in (skill1, skill2):
            if gid is not None and int(gid) >= 0:
                skill_gids.add(int(gid))
                slug = cat["gid_to_slug"].get(int(gid))
                if slug:
                    item_ids.add(slug)

        skill1_id = cat["gid_to_slug"].get(int(skill1)) if skill1 is not None else None
        skill2_id = cat["gid_to_slug"].get(int(skill2)) if skill2 is not None else None

        # Typical bag cost = sum of final-board item prices (gems not included).
        gold = 0
        for p in final["placements"]:
            price = item_csv.get(int(p["gid"]), {}).get("price") or "0"
            try:
                gold += int(float(price))
            except (TypeError, ValueError):
                pass

        hero = CLASSES.get(klass, str(klass))
        builds.append(
            {
                "runId": rid,
                "slug": f"history-{rid}",
                "title": f"{hero} · run {rid}",
                "hero_class": hero,
                "rank": league_from_rating(rating),
                "rating": rating,
                "loadout": loadout,
                "round": final["round"],
                "result": final["result"],
                "gold_count": gold,
                "skill1Gid": skill1,
                "skill2Gid": skill2,
                "route_r3_item_id": skill1_id,
                "route_r10_item_id": skill2_id,
                "placements": final["placements"],
                "rounds": rounds_out,
            }
        )
        print(
            f"ok run {rid} {hero} rounds={len(rounds_out)} "
            f"final={len(final['placements'])} gold={gold} skills={skill1_id}/{skill2_id}"
        )

    con.close()

    # Full item rows for grid + tooltips + canAffect (stats from game-items).
    by_norm = sprite_index()
    game_by_id, effects = load_game_item_catalog()
    items = []
    for slug in sorted(item_ids):
        gid = next((g for g, s in cat["gid_to_slug"].items() if s == slug), None)
        items.append(
            item_row_for_slug(
                slug,
                gid=gid,
                cat=cat,
                by_id_shape=by_id_shape,
                by_norm=by_norm,
                game_by_id=game_by_id,
                effects=effects,
                item_csv=item_csv,
            )
        )

    out = {
        "source": str(HISTORY),
        "exportedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "author_name": "Smojo",
        "builds": builds,
        "items": items,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out), encoding="utf-8")
    print(f"wrote {OUT} builds={len(builds)} items={len(items)}")


if __name__ == "__main__":
    main()
