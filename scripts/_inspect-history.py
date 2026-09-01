import json
import sqlite3
import sys

path = sys.argv[1] if len(sys.argv) > 1 else (
    r"c:\Users\Justin\AppData\Roaming\Godot\app_userdata\Backpack Battles\full\history.db"
)

con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
con.row_factory = sqlite3.Row
cur = con.cursor()
tables = [r[0] for r in cur.execute(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
)]
print("tables:", ", ".join(tables))

for name in tables:
    cols = list(cur.execute(f"PRAGMA table_info({name})"))
    n = cur.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0]
    print(f"\n## {name} ({n})")
    print(", ".join(f"{c[1]}:{c[2]}" for c in cols))
    if n:
        row = cur.execute(f"SELECT * FROM {name} LIMIT 1").fetchone()
        preview = {}
        for k in row.keys():
            v = row[k]
            if isinstance(v, (bytes, memoryview)):
                preview[k] = f"<blob {len(v)}b>"
            elif isinstance(v, str) and len(v) > 160:
                preview[k] = v[:160] + "…"
            else:
                preview[k] = v
        print("sample:", json.dumps(preview, indent=2, default=str))

con.close()
